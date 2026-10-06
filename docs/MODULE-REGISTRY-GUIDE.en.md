# Module Registry Guide — Upload & Manage Runtime Modules

**Version**: 0.1.0
**Audience**: DevOps / platform engineer
**Related**: `DEPLOYMENT-GUIDE.en.md` §6 (Runtime Configuration), `CONTRACT.en.md` §14 (Configuration), `ZERO-TO-DEPLOY-GUIDE.en.md`, `VM-DEPLOYMENT-GUIDE.en.md`
**Folders**: `registry-service/` (service) + `web-modules/modules/registry-admin/` (core module UI)

> Indonesian version: `MODULE-REGISTRY-GUIDE.md`.

---

## 1. Overview

`registry-service` is a Node/Express service that is the **single writer** of `registry.json` and stores module files (`data/modules/<name>/<version>/`). The container reads it via the runtime loader, and the core module `registry-admin` provides the admin UI at route `/system/modules`.

- **Upload** a module zip (output of `pack:module`) → validation → extraction → registry updated → JSONL audit.
- **List**, **enable/disable**, and **delete** modules through the bearer-token admin API.
- **Public** (`/registry.json`, `/modules/**`) is read by the container; **admin** (`/api/modules`) requires the service token.
- Changes take effect on the **next boot**: the loader is fail-closed, running client apps are not killed.
- How to create an installable module (`deps.runtime` pattern, `build:module`, `pack:module`): `MODULE-DEVELOPMENT-GUIDE.en.md`.

---

## 2. Architecture

```
web-container (SPA)                              registry-service (Node/Express)
┌───────────────────────────────┐                ┌──────────────────────────────────────┐
│ core module registry-admin    │ Bearer token   │ POST   /api/modules      (upload)    │
│  route /system/modules        │ ─────────────► │ GET    /api/modules      (list)      │
│ runtime loader                │                │ PATCH  /api/modules/:name (enabled)  │
│  reads /registry.json ────────┼──────────────► │ DELETE /api/modules/:name            │
└───────────────────────────────┘  public GET    │ GET /registry.json, /modules/**      │
                                                 │ data/: registry.json, modules/**,    │
                                                 │        audit.jsonl                   │
                                                 └──────────────────────────────────────┘
```

Principles:

- **Single source of truth** — only the service writes `registry.json` (atomic temp + rename); the UI never touches files.
- **Thin UI** — the module only calls the API + renders; all validation/verification lives in the service.
- **Strict admin API** — without `ADMIN_CORS_ORIGIN`, `/api/**` sends no CORS header (same-origin).

---

## 3. Service Environment

| Env | Default | Required | Purpose |
| ------------------- | ------------------------ | ----- | ------------------------------------------------------------ |
| `PORT` | `4310` | No | Service HTTP port. |
| `ADMIN_TOKEN` | — | **Yes** | Bearer token for `/api/modules*`; the service fails to start when empty. |
| `ADMIN_ACTOR` | `sysadmin` | No | Actor name recorded in `audit.jsonl`. |
| `ADMIN_CORS_ORIGIN` | — (empty) | No | Allowed admin UI origin (e.g. `https://portal.example.com`). When empty, **no** CORS header is sent on `/api/**` (strict same-origin); `OPTIONS` preflight returns `204`. |
| `CORS_ORIGIN` | `*` | No | Origin for `/registry.json` and `/modules/**` (public assets read cross-origin by the container). |
| `DATA_DIR` | `./data` | No | Data folder: `registry.json`, `modules/`, `audit.jsonl`. |
| `PUBLIC_BASE_URL` | `http://localhost:<PORT>` | No | Public base URL for `manifest`/`css` in `registry.json`; must be correct in production. |
| `SIGNING_PUBLIC_KEY` | — | No | ed25519 public key (PEM) to verify `signature.ed25519`; when set, zips without a valid signature are rejected. |
| `MAX_UPLOAD_BYTES` | `20971520` (20 MB) | No | Zip file size limit; larger → `413`. |

Notes:

- `ADMIN_CORS_ORIGIN` does **not** expose `/api/**` publicly — the token is still required.
- `CORS_ORIGIN=*` is only for public assets without credentials; do not use `*` for admin endpoints.

---

## 4. Running the Service

```bash
cd registry-service
npm install
ADMIN_TOKEN=<long-random-token> ADMIN_CORS_ORIGIN=https://portal.example.com npm start
```

Health: `curl -s http://localhost:4310/healthz` → `{"ok":true}`.

- Dev mode (watch): `ADMIN_TOKEN=... npm run dev`.
- Local data in `registry-service/data/` (gitignored); override with `DATA_DIR=/var/lib/registry`.
- Production token from a secret manager; never store it in the repo or in `VITE_*`.

---

## 5. API + curl Examples

| Method | Path | Auth | Success | Common errors |
| ------ | -------------------- | ------ | ---------------------- | ---------------------------- |
| `GET` | `/healthz` | — | `200 {"ok":true}` | — |
| `GET` | `/registry.json` | — | `200` registry body | — |
| `GET` | `/modules/**` | — | `200` static file | `404` |
| `POST` | `/api/modules` | Bearer | `201 {module}` | `400`, `401`, `409`, `413` |
| `GET` | `/api/modules` | Bearer | `200 {modules:[...]}` | `401` |
| `PATCH` | `/api/modules/:name` | Bearer | `200 {module}` | `400`, `401`, `404` |
| `DELETE` | `/api/modules/:name` | Bearer | `204` | `401`, `404` |

Upload:

```bash
# 1) Build + pack the module (from web-container) → dist/modules/<name>-<version>.zip
cd web-container
MODULE=module-runtime-demo npm run build:module
MODULE=module-runtime-demo npm run pack:module --silent

# 2) Upload the zip to the service
curl -fsS -X POST http://localhost:4310/api/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@dist/modules/module-runtime-demo-0.1.0.zip"
```

List:

```bash
curl -fsS http://localhost:4310/api/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Enable/disable:

```bash
curl -fsS -X PATCH http://localhost:4310/api/modules/module-runtime-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Delete:

```bash
curl -fsS -X DELETE http://localhost:4310/api/modules/module-runtime-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Connecting the container to the service (runtime env):

```dotenv
VITE_REGISTRY_URL=https://registry.example.com/registry.json
VITE_REGISTRY_ADMIN_URL=https://registry.example.com
VITE_MODULES=user-management,registry-admin,module-runtime-demo
```

> **Warning:** `VITE_REGISTRY_URL` and `VITE_REGISTRY_ADMIN_URL` must point at the same service; when only `VITE_REGISTRY_ADMIN_URL` is set, uploaded modules will never load in the app.

---

## 6. UI Flow

1. Set `VITE_REGISTRY_ADMIN_URL` + `VITE_REGISTRY_URL` (§5) then recreate the container.
2. Enable the core module: `VITE_MODULES=...,registry-admin`.
3. Open `/system/modules` (menu **Module Registry**, group `system`).
4. Fill in the **Admin token** (`ADMIN_TOKEN`) → **Save token**; stored in `localStorage['registry-admin:token']`.
5. Upload the `pack:module` zip (drag-drop or pick a file).
6. Manage the table: **Enable/Disable** and **Delete** per module.

Notes:

- When `config.registryAdminUrl` is empty, the page shows a "not configured" error; the service is not registered.
- Requests use the `Authorization: Bearer <token>` header from localStorage; `401` means a wrong token.
- Delete removes the registry entry and the module files; disable only flips the `enabled` flag.

---

## 7. Security & Deployment

- **Token** — `ADMIN_TOKEN` is static and required; send it via the `Authorization` header; rotate it regularly and always over HTTPS.
- **Zip-slip** — the service rejects absolute entries, `..`, and backslashes, then only extracts after validating the manifest/required files.
- **Size** — `MAX_UPLOAD_BYTES` (default 20 MB) caps the zip; exceeding it → `413`.
- **CORS** — `/api/**` is strict (only `ADMIN_CORS_ORIGIN` when set); `/registry.json` + `/modules/**` are public for the loader.
- **Guarantee limits** — `integrity` (sha384 over `mf-manifest.json`) and the optional signature guarantee the **manifest**, not the authenticity of the whole bundle code; do not upload from untrusted sources.
- **Service deploy** — run behind a TLS reverse proxy, set `PUBLIC_BASE_URL=https://registry.example.com`, persist `DATA_DIR` + backup; single instance for the MVP.
- **Container deploy** — CSP should allow `script-src`/`style-src`/`connect-src` to the registry origin (remote entry + CSS are loaded from there); serve `/registry.json` with `no-store` and `/modules/**` immutable.
- **Core module** — `registry-admin` ships in the default `config.modules` (dev/internal portal), not forced into every production client; actions still require the service token and RBAC follows in `phase.02-rbac-navigation.md`.

---

**Document version**: 0.1.0
**Last updated**: 2026-10-06
