# Deployment Guide — DevOps Engineer

**Version**: 0.2.0
**Audience**: DevOps / platform engineers
**Related**: `ARCHITECTURE.md` §16 (Build & Deployment), §17 (CI/CD); `CONTRACT.md`; `DEVELOPER-GUIDE.md`
**Current deployment target**: **Docker** — the base is built once into `arsi-web-base` images, then each extension builds one client image `FROM` that base image. Config is injected at container start.

> Indonesian version: `DEPLOYMENT-GUIDE.md`.

---

## 1. Overview

The base is built once; extensions build on top of it without touching the base repo.

```
base repo (arsi-web-base)                        base images
┌───────────────────────────────┐  build-base   ┌────────────────────────────────────┐
│ Dockerfile (multi-target)     │ ────────────► │ <org>/arsi-web-base:<ver>-builder  │
│  web-container/               │               │  node:22-alpine + source           │
│  web-modules/                 │               │  + node_modules + /app/BASE_VERSION│
│  web-extension-base/          │               ├────────────────────────────────────┤
│  ci/build-base.sh             │ ────────────► │ <org>/arsi-web-base:<ver>          │
└───────────────────────────────┘               │  nginx:1.27-alpine + base SPA      │
                                                └─────────────────┬──────────────────┘
                                                                  │ FROM builder & runtime
extension repo (arsi-extension-<client>)                          ▼
┌───────────────────────────────┐  build-client ┌────────────────────────────────────┐
│ Dockerfile                    │ ────────────► │ <org>/arsi-web-<client>:<buildId>  │
│ manifest.json (baseVersion)   │               │  nginx + client dist (1 image)     │
│ ci/build-client.sh + src/     │               │  ENV VITE_CLIENT=<client>          │
└───────────────────────────────┘               └────────────────────────────────────┘
```

Principles:

- **Build the base once, many extensions** — the base is built once (2 images); each extension builds its own client image from the base image, without checking out or rebuilding `web-container` + `web-modules`.
- **One image, many environments** — staging/production use the same client image; the only difference is environment variables at start.
- **Config is not baked into the image** — `entrypoint.sh` (shipped in the base runtime) writes `/config.json` inside the container from env vars (`VITE_*`). No rebuild needed to change the API base/modules.
- **No secrets in the image** — the image only contains public assets + public config. Secrets (Docker Hub, TLS) live outside the image.
- **Base version pinned exactly** — `manifest.json.baseVersion` in the extension repo must equal the base tag; a mismatch fails the build (`check:base`).

---

## 2. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22.x | image `node:22-alpine` (v22.23.3); jsdom@30/undici@8 require ≥22.22, Node 20 EOL April 2026 |
| npm | 10+ | used for `npm ci` in the base repo (container, web-modules, default extension) and the extension repo |
| Docker | 20+ | multi-stage/multi-target build; BuildKit not required |
| Registry | — | Docker Hub (`docker.io/<org>`); `docker login` before pushing; keep the builder base private |
| (Optional) reverse proxy/TLS | — | nginx/Traefik/ALB on the host — TLS is not handled by the container |

---

## 3. Repo Layout & Build

### 3.1 Base repo layout

```
arsi-web-base/
├── Dockerfile                  # multi-target: builder | base-app | runtime
├── .dockerignore
├── ci/
│   └── build-base.sh
├── web-container/
├── web-modules/
└── web-extension-base/         # default extension (client: "base")
```

### 3.2 Extension repo layout

```
arsi-extension-<client>/
├── Dockerfile                  # FROM base <ver>-builder → FROM base <ver>
├── .dockerignore
├── ci/
│   └── build-client.sh
├── manifest.json               # client + baseVersion (pinned exactly to the base tag)
├── package.json + package-lock.json
└── src/
```

Note: the extension repo does **not** contain `web-container`/`web-modules` — both come from the base builder image (`/app/web-container`, `/app/web-modules`). The extension folder in the builder image is always `/app/extension`, symlinked as `current-client` during the build.

### 3.3 Local build (without Docker)

Default base build (`client: "base"`):

```bash
cd web-container
CLIENT=base npm run link:client     # symlink current-client -> ../web-extension-base
CLIENT=base npm run build:client    # pre-hook runs automatically: gen:modules
# output: web-container/dist/base/
```

Per-client development keeps using the client-specific scripts:

```bash
cd web-container
npm run link:client-a               # or: CLIENT=client-a npm run link:client
npm run dev:client-a
```

Notes:

- `build:client` / `build:client-a` run the **pre-hook** `gen:modules` (the loader map is generated from `web-modules/modules/*/package.json`).
- Do not call `npx vite build` directly — the pre-hook will not run and the loader map can become stale.
- Docker guard: `cd web-container && npm run check:dockerfile` ensures **every** `package.json` (including `web-extension-base`) is COPYed in the base repo root `Dockerfile`.

### 3.4 Verification order (required in CI)

Base repo:

```bash
cd web-modules          && npm ci && npm run typecheck && npm test && npm run lint
cd ../web-extension-base && npm ci && npm run typecheck && npm run lint
cd ../web-container     && CLIENT=base npm run link:client && npm ci
npm run typecheck && npm test && npm run check:dockerfile && CLIENT=base npm run build:client
```

Extension repo:

```bash
cd web-extension-client-a && npm ci && npm run typecheck && npm run test --if-present && npm run lint
```

`ci/build-base.sh` with `VERIFY=1` runs the base repo sequence above. Extension verification also runs **inside the builder image** during `ci/build-client.sh`.

---

## 4. Docker Build

### 4.1 Build the base

From the base repo root:

```bash
ORG=<dockerhub-org> VERIFY=1 PUSH=1 ./ci/build-base.sh
```

| Env | Default | Purpose |
| --- | --- | --- |
| `REGISTRY` | `docker.io` | Docker Hub registry |
| `ORG` | — (required) | Docker Hub namespace/org |
| `BASE_VERSION` | `web-container/package.json:version` (currently `0.1.0`) | Base tag `<ver>` and `<ver>-builder` |
| `SHA` | `git rev-parse --short HEAD` | Immutable tag `<sha>` and `<sha>-builder` |
| `VERIFY` | `0` | `1` = run typecheck/test/lint + `check:dockerfile` + default base build before building the images |
| `PUSH` | `0` | `1` = push all tags to the registry |

Root `Dockerfile` (multi-target):

| Stage | Contents |
| --- | --- |
| `builder` (`node:22-alpine`) | COPY `package.json` + lockfile per tree (web-container, web-modules, shared, each module, web-extension-base) → `npm ci` per tree → COPY sources → write `/app/BASE_VERSION` |
| `base-app` | `FROM builder`; symlink `current-client -> ../web-extension-base`; `CLIENT=base npm run build:client` |
| `runtime` (`nginx:1.27-alpine`) | COPY `dist/base` → `/usr/share/nginx/html`; COPY `nginx.conf`; COPY `entrypoint.sh`; version `LABEL`; `EXPOSE 80` |

- The `COPY package.json` line for each module is **explicit**. Adding a new module means adding a COPY line + running `npm run check:dockerfile` (if forgotten, the guard fails).
- The base runtime can be deployed standalone: default extension `web-extension-base` (client `base`).
- Output: tags `<ver>-builder`, `<sha>-builder`, `<ver>`, `<sha>`.

### 4.2 Build an extension

From the extension repo root:

```bash
ORG=<dockerhub-org> PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh
```

| Env | Default | Purpose |
| --- | --- | --- |
| `REGISTRY` | `docker.io` | Docker Hub registry |
| `ORG` | — (required) | Docker Hub namespace/org |
| `BASE_VERSION` | `manifest.json:baseVersion` | Base tag in use |
| `CLIENT_NAME` | `manifest.json:client` | Client image name (`arsi-web-<client>`) |
| `BUILD_ID` | `git rev-parse --short HEAD` | Client image tag |
| `PULL` | `1` | Pull the base builder + runtime before building |
| `PUSH` | `0` | `1` = push the client image |
| `BASE_BUILDER_IMAGE` / `BASE_RUNTIME_IMAGE` | `<registry>/<org>/arsi-web-base:<ver>[-builder]` | Full override of the base image references |

Extension Dockerfile:

| Stage | Contents |
| --- | --- |
| `builder` (`FROM <ver>-builder`) | COPY `package.json` + lock → `/app/extension` → `npm ci` → COPY sources → symlink `web-container/current-client -> ../extension` → typecheck + test (`--if-present`) + lint → `check:base` → `CLIENT=<client> npm run build:client` |
| `runtime` (`FROM <ver>`) | Replace `/usr/share/nginx/html` with the client dist; `ENV VITE_CLIENT=<client>` |

- Verification (typecheck/test/lint) runs **inside the builder image** — guaranteed against the same base; the extension pipeline does not need to check out the base repo.
- `check:base` compares `manifest.json:baseVersion` with `/app/BASE_VERSION` in the builder image; a mismatch stops the build.
- Private base image → `docker login` before building (the script does not handle auth).
- The final image is only nginx + client dist (no source/node_modules).

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
  docker.io/<org>/arsi-web-client-a:<tag>
```

The base runtime can also run standalone (default extension, client `base`):

```bash
docker run -d -p 8080:80 docker.io/<org>/arsi-web-base:<ver>
```

### 5.2 `docker-compose.yml` (example)

```yaml
services:
  web:
    image: docker.io/<org>/arsi-web-client-a:${TAG:-latest}
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

For a complete production runtime guide on a Linux VM (Docker install, TLS with Let's Encrypt, updates, rollback, firewall, operations), see `VM-DEPLOYMENT-GUIDE.en.md`.

---

## 6. Runtime Configuration

`entrypoint.sh` (shipped in the base runtime, executed automatically by the nginx image at start) writes `/usr/share/nginx/html/config.json`:

| Env | Default | Purpose |
| --- | --- | --- |
| `VITE_CLIENT` | `base` | Client name in config (`client`); the client image sets `ENV VITE_CLIENT=<client>` |
| `VITE_MODULES` | `user-management` | CSV of modules **initialized** at runtime (example: `user-management,product-management,module-sample`) |
| `VITE_API_BASE` | `https://dummyjson.com` | API base URL for `deps.api` and module services |
| `VITE_ENABLE_AUDIT_LIVE` | `true` | Feature flag (`featureFlags.enableAuditLive`) |

Important notes:

- **Modules must exist in the build** — every module under `web-modules/modules/` is always bundled (lazy chunk); `VITE_MODULES` only selects which ones are active at runtime. The module name **must match** the folder name; otherwise the app fails to boot with `[bootstrap] module "x" is declared in config.modules but has no entry in web-modules/modules`.
- Runtime config has a single source in the base: `entrypoint.sh` + `nginx.conf` ship in the base runtime; the client image only replaces `/usr/share/nginx/html` with the client dist.
- Config is fetched with `cache: 'no-store'`; nginx also sends `Cache-Control: no-store` for `/config.json`.
- Changing env = recreate the container (`docker compose up -d --force-recreate`), no image rebuild.
- Verify after start: `curl -s http://localhost:8080/config.json | jq .`

---

## 7. Registry & Tagging

- Registry: **Docker Hub**. Base image `<org>/arsi-web-base`; client image `<org>/arsi-web-<client>` (example `<org>/arsi-web-client-a`).
- Base tags: `<ver>` + `<ver>-builder` (from `web-container/package.json:version`), plus immutable `<sha>` + `<sha>-builder`.
- Client tags: `<buildId>` (immutable; CI build ID / short SHA). Avoid `latest` in production.
- Promoting staging → production = **retag/pull the same image**, never rebuild:
  ```bash
  docker pull docker.io/<org>/arsi-web-client-a:<buildId>
  docker tag  docker.io/<org>/arsi-web-client-a:<buildId> docker.io/<org>/arsi-web-client-a:prod-<date>
  docker push docker.io/<org>/arsi-web-client-a:prod-<date>
  ```
- Rollback = deploy the previous tag (`TAG=<previous-buildId> docker compose up -d --force-recreate`).
- Base is pinned per client: a client image is only built against the base `<ver>` in `manifest.json:baseVersion`. Do not retag an old base to a new version.

---

## 8. CI/CD (Generic)

There is no platform-specific YAML; any pipeline (Azure DevOps, GitHub Actions, Jenkins) just calls the shell scripts in each repo.

### 8.1 Base repo pipeline

| Step | Command |
| --- | --- |
| Check out the base repo | `git clone <base-repo>` |
| Node 22 on the runner (for `VERIFY=1`) | `actions/setup-node@v4` / `NodeTool@0` / etc. |
| Log in to the registry | `docker login` (token from a CI secret) |
| Build + push the base | `ORG=<org> VERIFY=1 PUSH=1 ./ci/build-base.sh` |

### 8.2 Extension repo pipeline

| Step | Command |
| --- | --- |
| Check out the extension repo | `git clone <repo-extension-<client>>` |
| Log in to the registry (private base image) | `docker login` (token from a CI secret) |
| Build + push the client | `ORG=<org> PUSH=1 BUILD_ID=$CI_BUILD_ID ./ci/build-client.sh` |
| Smoke test | `docker run` the built image → `curl -sf localhost:8080/config.json` (+ `/`, deep link) before/after push |

Notes:

- The extension pipeline does **not** check out the base repo; the build only needs to pull the base image from the registry.
- `VERIFY=1` is optional; extension verification already runs inside the builder image during `ci/build-client.sh`.
- Adopting a new base = a PR in the extension repo bumping `manifest.json:baseVersion` (see §9).

---

## 9. Environments & Promotion

| Environment | Image | Config |
| --- | --- | --- |
| Staging | client image `<buildId>` | `VITE_API_BASE=https://staging-api…`, `VITE_MODULES=…` |
| Production | the **same** image, promoted | `VITE_API_BASE=https://api…`, `VITE_MODULES=…` |

- The only difference is **env** — no rebuild.
- Keep per-environment values in a secret manager/CI variable group (not in the repo).
- After changing env: recreate the container; verify `/config.json`.
- **Adopting a new base**: bump `baseVersion` in the extension repo `manifest.json` (PR) → CI rebuilds the client image against the new base tag. The base repo is not checked out, and other clients are unaffected until they bump it themselves.

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
| `check:base` mismatch | Message `[check:base] baseVersion manifest (x) != base image (y)`. Align `manifest.json:baseVersion` with the base tag, or use the correct `BASE_BUILDER_IMAGE`/rebuild the base. |
| Base tag `<ver>-builder` not found when pulling | That base version was not built/pushed, or `REGISTRY`/`ORG` is wrong. Run `ci/build-base.sh` in the base repo or align `BASE_VERSION`/`manifest.json:baseVersion`. |
| Docker build fails: module `package.json` not found | A new module is missing its `COPY` line in the base repo root `Dockerfile`. Run `npm run check:dockerfile`, add the COPY line. |
| Extension `npm ci` fails (lockfile) | The extension `package-lock.json` is out of sync with its `package.json` (or with this lockfile version). Run `npm install` in the extension repo, commit the new lockfile. |
| `npm ci` fails in CI | Lockfile out of sync (new module not `npm install`ed in `web-modules`). Commit the lockfile. |
| Deep link returns 404 | `try_files` is missing/changed in nginx — ensure `nginx.conf` uses `try_files $uri $uri/ /index.html`. |
| Loader map stale in the image | The build was invoked outside `npm run build:client` / `build:client-a` (the `gen:modules` pre-hook did not run). Use the npm script. |
| Docker build wrong context (`COPY failed`) | The base must be built from the base repo root; an extension from the extension repo root. The `ci/build-*.sh` scripts already run `docker build` from the correct directory. |
| Assets 404 after deploy | Did the Vite `base` change? Do not change it without coordination; assets are served from `/assets/`. |
| `pull access denied` / 401 on base image | The base builder/runtime is private; run `docker login` (CI token) before building the extension. |
| Engine warnings during `npm install` | Local Node is newer than the target; safe when tests pass. CI/Docker uses Node 22. |

---

## 12. Security

- **No secrets in the image** — public config only. Never put tokens/secrets in `VITE_*` (the value ends up in `/config.json`, readable by anyone).
- TLS terminates at the host reverse proxy/ingress; the container only serves HTTP:80.
- Restrict registry access (Docker Hub access token/robot account); scan images (Docker Hub/Trivy) before promotion.
- The base builder image contains source + `node_modules` — keep it private; only extension pipelines use it.
- Run the container as a non-root user when required (the nginx master currently runs as root; hardening is a separate option).
- Audit: record the client image tag + base version + env values per deploy; `config.json` exposes `client`, `modules`, `apiBase` — make sure they are not sensitive.

---

## 13. Appendix — Cheat Sheet

```bash
# Build the base (base repo root)
ORG=<dockerhub-org> VERIFY=1 PUSH=1 ./ci/build-base.sh

# Build a client (extension repo root)
ORG=<dockerhub-org> PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh

# Verify before building (base repo)
cd web-container && npm run check:dockerfile

# Run a client
docker run -d -p 8080:80 -e VITE_API_BASE=https://staging-api.example.com \
  docker.io/<org>/arsi-web-client-a:<tag>

# Check config & logs
curl -s localhost:8080/config.json | jq .
docker logs arsi-web-client-a | grep Generated

# Rollback
TAG=<previous-tag> docker compose up -d --force-recreate
```

| File | Role |
| --- | --- |
| `Dockerfile` (base repo root) | Multi-target base: `builder` / `base-app` / `runtime` |
| `ci/build-base.sh` | Build + push the 2 base images + immutable tags |
| `web-extension-base/` | Default extension for the base runtime (client `base`) |
| `web-container/docker/entrypoint.sh` | Generates `/config.json` from env |
| `web-container/nginx.conf` | SPA fallback + cache headers |
| `web-container/scripts/check-dockerfile-modules.mjs` | Guard for module `package.json` COPY in the root Dockerfile |
| `web-container/scripts/check-base-version.mjs` | Guard for manifest `baseVersion` vs base image |
| `.dockerignore` (base repo root) | Excludes node_modules/dist/non-base extension folders from the context |
| `web-extension-<client>/Dockerfile` | Builds the client image `FROM` the base image |
| `web-extension-<client>/ci/build-client.sh` | Build + push the client image |
| `web-extension-<client>/manifest.json` | `client` + `baseVersion` (exact pin) |

---

**Document version**: 0.2.0
**Last updated**: 2026-10-02
