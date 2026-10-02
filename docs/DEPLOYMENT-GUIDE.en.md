# Deployment Guide — DevOps Engineer

**Version**: 0.1.0
**Audience**: DevOps / platform engineers
**Related**: `ARCHITECTURE.md` §16 (Build & Deployment), §17 (CI/CD); `CONTRACT.md`; `DEVELOPER-GUIDE.md`
**Current deployment target**: **Docker** (one image per client, config injected at container start). Kubernetes is not in use yet (the `KubernetesManifest` pipeline step is still a scaffold — see §8).

> Indonesian version: `DEPLOYMENT-GUIDE.md`.

---

## 1. Overview

Deployment architecture:

```
3 repos (side-by-side)                    1 image per client              Runtime config
┌──────────────────────┐                ┌─────────────────────┐         ┌──────────────────┐
│ web-container        │  docker build  │ nginx + dist/client │  env →  │ /config.json     │
│ web-modules          │ ─────────────► │ (static SPA)        │ ──────► │ (generated at    │
│ web-extension-<cli>  │  context=root  │                     │  start  │  container start)│
└──────────────────────┘                └─────────────────────┘         └──────────────────┘
```

Principles:

- **One image, many environments** — staging/production use the same image; the only difference is environment variables at start.
- **Config is not baked into the image** — `entrypoint.sh` writes `/config.json` inside the container from env vars (`VITE_*`). No rebuild needed to change the API base/modules.
- **No secrets in the image** — the image only contains public assets + public config. Secrets (registry, TLS) live outside the image.
- **Build context must be the workspace root** — the Dockerfile copies `web-container/`, `web-modules/`, and `web-extension-<client>/` together.

---

## 2. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.x | `engines: ">=20"`; CI/Docker use `node:20-alpine` |
| npm | 10+ | used for `npm ci` in the 3 repos |
| Docker | 20+ | multi-stage build; BuildKit not required (the Dockerfile uses plain `COPY`) |
| Registry | — | ACR/ECR/GHCR; log in before pushing |
| (Optional) reverse proxy/TLS | — | nginx/Traefik/ALB on the host — TLS is not handled by the container |

---

## 3. Repo Layout & Build

### 3.1 Required layout (side-by-side)

The three repos must live under a single parent directory with folder names exactly as in the Dockerfile:

```
<workspace>/
├── web-container/
├── web-modules/
└── web-extension-client-a/
```

Path mapping (`aliases.cjs`) and the Dockerfile depend on this layout. Do not rename folders in the build context.

### 3.2 Local build (without Docker)

```bash
cd web-container
ln -sfn ../web-extension-client-a current-client   # active client symlink
npm run build:client-a                              # pre-hook runs automatically: gen:modules
# output: web-container/dist/client-a/
```

Notes:

- `npm run build:client-a` runs the **pre-hook** `gen:modules` (the loader map is generated from `web-modules/modules/*/package.json`).
- Do not call `npx vite build` directly — the pre-hook will not run and the loader map can become stale.
- Docker guard: `cd web-container && npm run check:dockerfile` ensures **every** module `package.json` is COPYed in the Dockerfile.

### 3.3 Verification order (required in CI)

```bash
cd web-modules    && npm ci && npm run typecheck && npm test && npm run lint
cd ../web-extension-client-a && npm ci && npm run typecheck && npm test && npm run lint
cd ../web-container && ln -sfn ../web-extension-client-a current-client && npm ci
npm run typecheck && npm test && npm run check:dockerfile && npm run build:client-a
```

---

## 4. Docker Build

### 4.1 Command

```bash
# from the WORKSPACE ROOT (not from web-container/)
docker build \
  -f web-container/Dockerfile \
  -t myorg.azurecr.io/arsi-web-client-a:$(git rev-parse --short HEAD) \
  .
```

### 4.2 How the Dockerfile works

| Stage | Contents |
| --- | --- |
| `builder` (`node:20-alpine`) | COPY `package.json` + lockfile per repo/module → `npm ci` per repo → COPY sources → symlink `current-client` → `npm run build:client-a` |
| `runner` (`nginx:1.27-alpine`) | COPY `dist/client-a` → `/usr/share/nginx/html`; COPY `nginx.conf`; COPY `entrypoint.sh` → `/docker-entrypoint.d/40-generate-config.sh` |

- `npm ci` runs **per repo** (container, web-modules workspace, extension) — not a single global install.
- The `COPY package.json` line for each module is **explicit**. Adding a new module means adding a COPY line + running `check:dockerfile` (if forgotten, the build/CI fails at the guard).
- The root `.dockerignore` excludes `**/node_modules`, `**/dist`, `**/coverage`, `.git`, `web-container/current-client`, logs, `.DS_Store`.

### 4.3 Push

```bash
docker login myorg.azurecr.io
docker push myorg.azurecr.io/arsi-web-client-a:$(git rev-parse --short HEAD)
```

---

## 5. Run Container (Docker)

### 5.1 `docker run`

```bash
docker run -d \
  --name arsi-web-client-a \
  -p 8080:80 \
  -e VITE_CLIENT=client-a \
  -e VITE_MODULES=user-management,product-management,module-sample \
  -e VITE_API_BASE=https://staging-api.example.com \
  -e VITE_ENABLE_AUDIT_LIVE=true \
  --restart unless-stopped \
  --health-cmd "wget -qO- http://127.0.0.1/ >/dev/null || exit 1" \
  --health-interval 30s --health-timeout 5s --health-retries 3 \
  myorg.azurecr.io/arsi-web-client-a:<tag>
```

### 5.2 `docker-compose.yml` (example)

```yaml
services:
  web:
    image: myorg.azurecr.io/arsi-web-client-a:${TAG:-latest}
    container_name: arsi-web-client-a
    ports:
      - "8080:80"
    environment:
      VITE_CLIENT: client-a
      VITE_MODULES: user-management,product-management,module-sample
      VITE_API_BASE: https://staging-api.example.com
      VITE_ENABLE_AUDIT_LIVE: "true"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

```bash
TAG=2026.10.01 docker compose up -d
TAG=2026.10.01 docker compose up -d --force-recreate   # apply new env
```

TLS/reverse proxy (nginx/Traefik/ALB) is configured on the host, not in this container.

---

## 6. Runtime Configuration

`entrypoint.sh` (executed automatically by the nginx image at start) writes `/usr/share/nginx/html/config.json`:

| Env | Default | Purpose |
| --- | --- | --- |
| `VITE_CLIENT` | `client-a` | Client name in config (`client`); used for logging/identity |
| `VITE_MODULES` | `user-management` | CSV of modules **initialized** at runtime (example: `user-management,product-management,module-sample`) |
| `VITE_API_BASE` | `https://dummyjson.com` | API base URL for `deps.api` and module services |
| `VITE_ENABLE_AUDIT_LIVE` | `true` | Feature flag (`featureFlags.enableAuditLive`) |

Important notes:

- **Modules must exist in the build** — every module under `web-modules/modules/` is always bundled (lazy chunk); `VITE_MODULES` only selects which ones are active at runtime. The module name **must match** the folder name; otherwise the app fails to boot with `[bootstrap] module "x" is declared in config.modules but has no entry in web-modules/modules`.
- Config is fetched with `cache: 'no-store'`; nginx also sends `Cache-Control: no-store` for `/config.json`.
- Changing env = recreate the container (`docker compose up -d --force-recreate`), no image rebuild.
- Verify after start: `curl -s http://localhost:8080/config.json | jq .`

---

## 7. Registry & Tagging

- Recommended **immutable** tags: `$(Build.BuildId)` (CI) or `git rev-parse --short HEAD`; avoid `latest` in production.
- Promoting staging → production = **retag/pull the same image**, never rebuild:
  ```bash
  docker pull myorg.azurecr.io/arsi-web-client-a:<buildId>
  docker tag  myorg.azurecr.io/arsi-web-client-a:<buildId> myorg.azurecr.io/arsi-web-client-a:prod-<date>
  docker push myorg.azurecr.io/arsi-web-client-a:prod-<date>
  ```
- Rollback = deploy the previous tag (`TAG=<previous-buildId> docker compose up -d --force-recreate`).

---

## 8. CI/CD (Azure DevOps)

Actual pipeline example: `web-extension-client-a/.azure-pipelines.yml`. Condensed + guard:

```yaml
trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

variables:
  clientName: client-a
  dockerRepository: arsi-web-client-a

steps:
  - checkout: self
    path: web-extension-client-a
  - checkout: git://MyOrg/web-container
    path: web-container
  - checkout: git://MyOrg/web-modules
    path: web-modules

  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: |
      cd $(Pipeline.Workspace)/web-modules && npm ci
      cd $(Pipeline.Workspace)/web-extension-client-a && npm ci
      cd $(Pipeline.Workspace)/web-container
      ln -sfn ../web-extension-client-a current-client
      npm ci
    displayName: Install dependencies

  - script: |
      cd $(Pipeline.Workspace)/web-modules && npm run typecheck && npm test && npm run lint
      cd $(Pipeline.Workspace)/web-extension-client-a && npm run typecheck && npm test && npm run lint
      cd $(Pipeline.Workspace)/web-container
      npm run typecheck && npm test && npm run check:dockerfile && npm run build:client-a
    displayName: Verify and build

  - task: Docker@2
    inputs:
      command: buildAndPush
      repository: $(dockerRepository)
      dockerfile: $(Pipeline.Workspace)/web-container/Dockerfile
      buildContext: $(Pipeline.Workspace)      # MUST be the workspace root
      tags: |
        $(Build.BuildId)
```

Notes:

- `buildContext: $(Pipeline.Workspace)` is **required** — the Dockerfile COPYs 3 repos.
- `check:dockerfile` was added to the verify stage (prevents build failures from a module missing its COPY line).
- The `KubernetesManifest` step in the original file is still a **scaffold** (`k8s/staging.yaml` does not exist yet). Deployment today is via Docker; enable K8s later once manifests are ready.

---

## 9. Environments & Promotion

| Environment | Image | Config |
| --- | --- | --- |
| Staging | the same (`<buildId>`) | `VITE_API_BASE=https://staging-api…`, `VITE_MODULES=…` |
| Production | the **same** image, promoted | `VITE_API_BASE=https://api…`, `VITE_MODULES=…` |

- The only difference is **env** — no rebuild.
- Keep per-environment values in a secret manager/CI variable group (not in the repo).
- After changing env: recreate the container; verify `/config.json`.

---

## 10. Post-Deploy Smoke Test

```bash
BASE=http://localhost:8080

# 1. Config matches the environment
curl -sf "$BASE/config.json" | jq -e '.client and .modules and .apiBase'

# 2. Main page returns 200
curl -sI "$BASE/" | head -1

# 3. SPA deep-link fallback (must be 200 + index.html)
curl -s "$BASE/products/1" | grep -q '<div id="root">'

# 4. Immutable asset cache header
curl -sI "$BASE/assets/$(curl -s "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2)" \
  | grep -i 'cache-control: public, immutable'

# 5. Entrypoint log
docker logs arsi-web-client-a | grep 'Generated'
```

Manual checklist: login/module routes per `VITE_MODULES`, theme/locale, deep links not 404, `config.json` not cached by the browser.

---

## 11. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `[bootstrap] module "x" … has no entry` | `VITE_MODULES` contains a name that is not a folder under `web-modules/modules/`. Fix the env or add the module to the build. |
| Module does not appear even though env is correct | The module was not bundled (stale build) or is missing from the runtime `config.json`. Check `curl /config.json`, rebuild the image. |
| Config changes are not visible | Browser cache (must be `no-store`) or the container was not recreated. `docker compose up -d --force-recreate`. |
| Docker build fails: module `package.json` not found | A new module is missing its `COPY` line in `web-container/Dockerfile`. Run `npm run check:dockerfile`, add the COPY line. |
| `npm ci` fails in CI | Lockfile out of sync (new module not `npm install`ed in `web-modules`). Commit the lockfile. |
| Deep link returns 404 | `try_files` is missing/changed in nginx — ensure `nginx.conf` uses `try_files $uri $uri/ /index.html`. |
| Loader map stale in the image | The build was invoked outside `npm run build:client-a` (the `gen:modules` pre-hook did not run). Use the npm script. |
| Docker build wrong context (`COPY failed`) | The build was run from `web-container/`, not the workspace root. Use `-f web-container/Dockerfile .` from the root. |
| Assets 404 after deploy | Did the Vite `base` change? Do not change it without coordination; assets are served from `/assets/`. |
| Engine warnings during `npm install` | Local Node is newer than the target; safe when tests pass. CI uses Node 20. |

---

## 12. Security

- **No secrets in the image** — public config only. Never put tokens/secrets in `VITE_*` (the value ends up in `/config.json`, readable by anyone).
- TLS terminates at the host reverse proxy/ingress; the container only serves HTTP:80.
- Restrict registry access (service connection/robot account); scan images (ACR Tasks/Trivy) before promotion.
- Run the container as a non-root user when required (the nginx master currently runs as root; hardening is a separate option).
- Audit: record the image tag + env values per deploy; `config.json` exposes `client`, `modules`, `apiBase` — make sure they are not sensitive.

---

## 13. Appendix — Cheat Sheet

```bash
# Build image (workspace root)
docker build -f web-container/Dockerfile -t myorg.azurecr.io/arsi-web-client-a:<tag> .

# Verify before building
cd web-container && npm run check:dockerfile

# Run
docker run -d -p 8080:80 -e VITE_CLIENT=client-a \
  -e VITE_MODULES=user-management,product-management,module-sample \
  -e VITE_API_BASE=https://staging-api.example.com \
  myorg.azurecr.io/arsi-web-client-a:<tag>

# Check config & logs
curl -s localhost:8080/config.json | jq .
docker logs arsi-web-client-a | grep Generated

# Rollback
TAG=<previous-tag> docker compose up -d --force-recreate
```

| File | Role |
| --- | --- |
| `web-container/Dockerfile` | Multi-stage build → nginx |
| `web-container/docker/entrypoint.sh` | Generates `/config.json` from env |
| `web-container/nginx.conf` | SPA fallback + cache headers |
| `.dockerignore` (root) | Excludes node_modules/dist from the context |
| `web-extension-client-a/.azure-pipelines.yml` | Build + push image pipeline |
| `web-container/scripts/check-dockerfile-modules.mjs` | Guard for module `package.json` COPY |

---

**Document version**: 0.1.0
**Last updated**: 2026-10-01
