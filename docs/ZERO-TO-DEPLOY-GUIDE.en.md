# Zero to Deploy Guide — Clone → Extension → Compile → Deploy

**Version**: 0.1.0
**Audience**: Developer / DevOps deploying a new client from scratch
**Registry**: Docker Hub `satriolangit` — https://hub.docker.com/repositories/satriolangit
**Related documents**: `DEVELOPER-GUIDE.en.md` (module/extension details), `DEPLOYMENT-GUIDE.en.md` (build/CI/tagging), `VM-DEPLOYMENT-GUIDE.en.md` (VM operations), `CONTRACT.en.md` (hard rules)

> Indonesian version: `ZERO-TO-DEPLOY-GUIDE.md`.

---

## Table of Contents

1. [Flow Overview](#1-flow-overview)
2. [Prerequisites](#2-prerequisites)
3. [Stage 1 — Clone & Set Up the Workspace](#3-stage-1--clone--set-up-the-workspace)
4. [Stage 2 — Create the Client Extension](#4-stage-2--create-the-client-extension)
5. [Stage 3 — Compile: Build & Push Images](#5-stage-3--compile-build--push-images)
6. [Stage 4 — Deploy to a Linux VM](#6-stage-4--deploy-to-a-linux-vm)
7. [Stage 5 — Update & Rollback](#7-stage-5--update--rollback)
8. [Go-Live Checklist & Troubleshooting](#8-go-live-checklist--troubleshooting)
9. [References](#9-references)

---

## 1. Flow Overview

```
┌─────────────┐   ┌──────────────┐   ┌────────────────────┐   ┌─────────────────┐   ┌──────────────┐
│ 1. Clone    │ → │ 2. Extension │ → │ 3. Compile         │ → │ 4. Deploy VM    │ → │ 5. Verify    │
│ base+client │   │ manifest+src │   │ build+push image   │   │ compose + TLS   │   │ smoke test   │
└─────────────┘   └──────────────┘   └────────────────────┘   └─────────────────┘   └──────────────┘
```

| Stage | Outcome | Key command |
| --- | --- | --- |
| 1. Clone | base + extension workspace side by side | `git clone <git-url-arsi-web-base> arsi-web-base` |
| 2. Extension | `web-extension-<client>` repo with `manifest.json` | copy the template / clone the extension repo |
| 3. Compile | `satriolangit/arsi-web-base:<ver>[-builder]` + `satriolangit/arsi-web-<client>:<buildId>` | `ci/build-base.sh`, `ci/build-client.sh` |
| 4. Deploy | container running on the VM + HTTPS | `docker compose pull && docker compose up -d` |
| 5. Verify | `/config.json` matches the environment | `curl https://app.example.com/config.json` |

Repo responsibilities:

| Repo | Contents | When it changes |
| --- | --- | --- |
| `arsi-web-base` (1 repo) | `web-container` + `web-modules` + `web-extension-base` | shell, UI kit, business modules, base releases |
| `arsi-extension-<client>` (1 repo per client) | client-specific overrides (`src/`) | client slots/routes/services/i18n |

Key rules: **the extension is fixed at build time** (1 repo = 1 client image), **modules are activated at deploy time** (`VITE_MODULES`), and **the full config can be overridden at deploy time** (`VITE_CONFIG_JSON`).

---

## 2. Prerequisites

| Need | For | Notes |
| --- | --- | --- |
| Node.js 22.x + npm 10+ | laptop: local build & dev | see `DEVELOPER-GUIDE.en.md` §0.2 |
| Git | cloning repos | set `user.name`/`user.email` |
| Docker + Compose | laptop: build images; VM: run | Docker Desktop (laptop) / Docker Engine (VM) |
| Docker Hub account `satriolangit` | push/pull images | https://hub.docker.com/repositories/satriolangit |
| Docker Hub token (push) | laptop/CI with `PUSH=1` | read-only token on the VM; push token only on laptop/CI |
| Linux VM + domain | production deploy | Ubuntu/Debian, public IP, DNS A record |
| SSH access to the VM | deploy | `deploy` user with a key |

Repo URLs (placeholders — replace with the real URLs):

- base: `<git-url-arsi-web-base>`
- extension: `<git-url-arsi-extension-<client>>`

---

## 3. Stage 1 — Clone & Set Up the Workspace

The extension **must** live inside the base repo folder (the `current-client` symlink and extension aliases depend on it):

```bash
mkdir -p ~/works/arsi && cd ~/works/arsi
git clone <git-url-arsi-web-base> arsi-web-base
cd arsi-web-base
git clone <git-url-arsi-extension-<client>> web-extension-<client>
echo "web-extension-*/" >> .git/info/exclude   # keep the extension clone out of the base repo
```

Install dependencies (order: modules → container → extension):

```bash
(cd web-modules && npm ci)
(cd web-container && npm ci && CLIENT=<client> npm run link:client)
(cd web-extension-<client> && npm ci)
```

Start the dev server to confirm the workspace is healthy:

```bash
cd web-container
npm run dev:client-a        # http://localhost:5173
```

Notes:

- `npm run dev:client-a` reads dev config from `web-container/public/config.json`. For a new client, add a `dev:<client>` script like `dev:client-a` in `web-container/package.json` (once) — details: `DEVELOPER-GUIDE.en.md` §4.10.
- Switch the active client: `CLIENT=<client> npm run link:client`, then restart the dev server.
- Full laptop setup (nvm/WSL): `DEVELOPER-GUIDE.en.md` §0.

---

## 4. Stage 2 — Create the Client Extension

If the extension repo does not exist yet, create it from the template:

```bash
cd arsi-web-base
cp -R web-extension-template web-extension-<client>
cd web-extension-<client>
rm -rf node_modules
```

Adjust:

1. `package.json` → `"name": "@arsi/extension-<client>"`.
2. `manifest.json`:
   ```json
   {
     "client": "<client>",
     "baseVersion": "0.1.0",
     "modules": { "user-management": "^0.1.0" },
     "shared": "^0.1.0",
     "overrides": []
   }
   ```
   `baseVersion` **must** match the base tag in use exactly (enforced by `check:base` during the build).
3. `src/index.tsx` → default export `init(deps)`; register overrides (slot/route/service/i18n) there.
4. Add the `@arsi/module-<name>` alias in `aliases.cjs` + `tsconfig.json` for every overridden module (details: `DEVELOPER-GUIDE.en.md` §4.2).

Verify locally:

```bash
cd ../web-container && CLIENT=<client> npm run link:client && npm run dev:client-a
cd ../web-extension-<client> && npm run typecheck && npm run test --if-present && npm run lint
```

If the extension repo already exists (existing client), just clone it (Stage 1) and continue to Stage 3.

---

## 5. Stage 3 — Compile: Build & Push Images

Log in to Docker Hub (once per machine):

```bash
docker login docker.io -u satriolangit
```

### 5.1 Build & push the base image (once per base version)

From the **base repo root**:

```bash
cd ~/works/arsi/arsi-web-base
ORG=satriolangit VERIFY=1 PUSH=1 ./ci/build-base.sh
```

Result:

| Image | Contents | Visibility |
| --- | --- | --- |
| `satriolangit/arsi-web-base:0.1.0-builder` | Node 22 + source + node_modules (extension build input) | **private** (recommended) |
| `satriolangit/arsi-web-base:0.1.0` | nginx + base SPA + runtime config | private/public per policy |

- The version comes from `web-container/package.json:version` (example `0.1.0`); immutable `<sha>` tags are also created.
- `VERIFY=1` runs tests + guards before building. Repeat this stage only when the base changes/bumps.
- Verify on Docker Hub: https://hub.docker.com/r/satriolangit/arsi-web-base/tags

### 5.2 Build & push the client image

From the **extension repo root**:

```bash
cd ~/works/arsi/arsi-web-base/web-extension-<client>
ORG=satriolangit PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh
```

Result: `satriolangit/arsi-web-<client>:<buildId>` (example client `bca` → `satriolangit/arsi-web-bca`).

- The script pulls `arsi-web-base:<baseVersion>-builder` + `:baseVersion` from the registry, runs typecheck/test/lint + `check:base` inside the builder image, then builds Vite.
- `check:base` fails when `manifest.json:baseVersion` does not match the base image → fix the manifest or build the right base.
- Verify: https://hub.docker.com/repositories/satriolangit

### 5.3 Local smoke test before using it on the VM (optional)

Without pushing, use local images:

```bash
# local base
cd ~/works/arsi/arsi-web-base
ORG=satriolangit VERIFY=0 PUSH=0 ./ci/build-base.sh

# local client
cd web-extension-<client>
ORG=satriolangit PULL=0 PUSH=0 BUILD_ID=local ./ci/build-client.sh

# run & check config
docker run -d --name arsi-local -p 8080:80 \
  -e VITE_MODULES=user-management \
  -e VITE_API_BASE=https://api.example.com \
  satriolangit/arsi-web-<client>:local
sleep 2
curl -s http://localhost:8080/config.json | jq .
docker rm -f arsi-local
```

---

## 6. Stage 4 — Deploy to a Linux VM

### 6.1 Prepare the VM (once)

Follow `VM-DEPLOYMENT-GUIDE.en.md` §3–§4: `deploy` user, firewall (22/80/443), Docker Engine + Compose. Condensed:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg jq ufw
# install Docker Engine + compose plugin: VM-DEPLOYMENT-GUIDE.en.md §4
sudo usermod -aG docker deploy
sudo mkdir -p /opt/arsi/<client> && sudo chown deploy:deploy /opt/arsi/<client>
```

### 6.2 Create the deploy files

`/opt/arsi/<client>/.env` (chmod 600):

```dotenv
IMAGE_TAG=<buildId>
VITE_CLIENT=<client>
VITE_MODULES=user-management
VITE_API_BASE=https://api.example.com
VITE_ENABLE_AUDIT_LIVE=false
```

`/opt/arsi/<client>/compose.yaml`:

```yaml
name: arsi-<client>

services:
  web:
    image: satriolangit/arsi-web-<client>:${IMAGE_TAG:?set IMAGE_TAG in .env}
    container_name: arsi-web-<client>
    ports:
      - "127.0.0.1:8080:80"
    environment:
      VITE_CLIENT: ${VITE_CLIENT}
      VITE_MODULES: ${VITE_MODULES:?set VITE_MODULES in .env}
      VITE_API_BASE: ${VITE_API_BASE:?set VITE_API_BASE in .env}
      VITE_ENABLE_AUDIT_LIVE: ${VITE_ENABLE_AUDIT_LIVE:-false}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    security_opt:
      - no-new-privileges:true
```

For CI-driven full config, replace the `environment:` block with:

```yaml
    environment:
      VITE_CONFIG_JSON: |
        {"client":"<client>","modules":["user-management"],"apiBase":"https://api.example.com","featureFlags":{"enableAuditLive":false}}
```

### 6.3 Run it

```bash
cd /opt/arsi/<client>
docker login docker.io -u satriolangit    # if the image is private
docker compose pull
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:8080/config.json | jq .
```

### 6.4 Reverse proxy + TLS

Terminate TLS on the host (the container only serves HTTP:80, bound to `127.0.0.1`):

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

```nginx
server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com --redirect --agree-tos -m ops@example.com
```

Caddy alternative and firewall/operations details: `VM-DEPLOYMENT-GUIDE.en.md` §9–§13.

---

## 7. Stage 5 — Update & Rollback

Deploy a new version (client image already pushed):

```bash
cd /opt/arsi/<client>
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<new-buildId>/' .env
docker compose pull
docker compose up -d
curl -sf http://127.0.0.1:8080/config.json | jq -e '.client and .modules and .apiBase'
```

Config-only change (no new image):

```bash
nano .env    # VITE_MODULES / VITE_API_BASE / VITE_CONFIG_JSON
docker compose up -d --force-recreate
```

Rollback:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<previous-buildId>/' .env
docker compose pull && docker compose up -d
```

Adopting a new base version: bump `manifest.json:baseVersion` in the extension repo via PR → CI builds a new client image → deploy as above. Other clients are unaffected until they bump it themselves.

---

## 8. Go-Live Checklist & Troubleshooting

Checklist:

- [ ] `docker compose ps` → `running` + `healthy`.
- [ ] `https://app.example.com/config.json` → correct `client`/`modules`/`apiBase`, `no-store`.
- [ ] Login and every module in `VITE_MODULES` renders; deep links do not 404.
- [ ] API calls succeed (no CORS/4xx/5xx in the console).
- [ ] TLS valid + auto-renew (`systemctl list-timers | grep certbot`).
- [ ] Immutable image tag recorded + rollback tag known.
- [ ] `ufw` enabled; container bound to `127.0.0.1`; `.env` `chmod 600`.

| Symptom | Fix |
| --- | --- |
| `pull access denied` | Private image and not logged in (read-only token) — §6.3. |
| Container fails to start `[entrypoint] VITE_CONFIG_JSON must be a JSON object` | The value is not a JSON object; fix it or unset it. |
| App boots with no modules | `VITE_MODULES` empty/wrong; use bundled module names. |
| `[bootstrap] module "x" … has no entry` | Module not in the build; rebuild the base including that module. |
| `check:base` mismatch while building the client | `manifest.json:baseVersion` ≠ base tag; align them. |
| Config changes not visible | Recreate the container + hard refresh (`no-store`). |
| 502 from the proxy | Container down/wrong port; check `docker compose ps` + `curl 127.0.0.1:8080`. |

Detailed troubleshooting: `VM-DEPLOYMENT-GUIDE.en.md` §16 and `DEPLOYMENT-GUIDE.en.md` §11.

---

## 9. References

| Document | Contents |
| --- | --- |
| `DEVELOPER-GUIDE.en.md` | Laptop onboarding, creating/modifying modules & extensions, tests, local image builds |
| `DEPLOYMENT-GUIDE.en.md` | Build/tags/CI, runtime env, registry & rollback |
| `VM-DEPLOYMENT-GUIDE.en.md` | VM operations: Docker, TLS, updates, firewall, monitoring |
| `CONTRACT.en.md` | Hard rules for layers, config, versioning |
| Docker Hub | https://hub.docker.com/repositories/satriolangit |

---

**Document version**: 0.1.0
**Last updated**: 2026-10-03
