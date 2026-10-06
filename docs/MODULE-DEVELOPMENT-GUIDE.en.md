# Module Guide — Run, Create, Install

**Version**: 0.1.0
**Audience**: Module developers & platform engineers
**Related documents**: `DEVELOPER-GUIDE.en.md` (module/extension conventions), `MODULE-REGISTRY-GUIDE.en.md` (registry service + admin UI), `CONTRACT.en.md`, `DEPLOYMENT-GUIDE.en.md`

> Indonesian version: `MODULE-DEVELOPMENT-GUIDE.md`.

---

## Table of Contents

1. [Overview & Prerequisites](#1-overview--prerequisites)
2. [Running web-container](#2-running-web-container)
3. [Two Module Tracks](#3-two-module-tracks)
4. [Creating an Installable Module](#4-creating-an-installable-module)
5. [Build & Pack the Module](#5-build--pack-the-module)
6. [Installing the Module](#6-installing-the-module)
7. [Troubleshooting](#7-troubleshooting)
8. [References](#8-references)

---

## 1. Overview & Prerequisites

The three flows covered by this guide:

```
1. Run       : run web-container locally (dev server + env config)
2. Create    : create an installable module (runtime bundle) in runtime-modules/<name>/
3. Install   : build + pack → upload to the registry service → enable → verify
```

| Need | Version | Notes |
| --- | --- | --- |
| Node.js | 22.x | image/Docker uses `node:22-alpine` |
| npm | 10+ | `npm ci` in web-modules, web-container, extension |
| Docker | optional | only for image builds (see `DEPLOYMENT-GUIDE.en.md`) |
| Playwright | optional | only for e2e (`npx playwright install chromium`) |

Default ports: web-container `5173`, registry service `4310`.

---

## 2. Running web-container

### 2.1 Dependency setup

```bash
cd <workspace>
(cd web-modules && npm ci)
(cd web-container && npm ci && CLIENT=client-a npm run link:client)
(cd web-extension-client-a && npm ci)
```

`link:client` creates the `web-container/current-client -> ../web-extension-client-a` symlink (the active dev extension).

### 2.2 Dev env (optional, gitignored)

```bash
cd web-container
cp .env.example .env
```

| Env | Purpose |
| --- | --- |
| `VITE_CLIENT` | client identity (optional; defaults to the `current-client` symlink) |
| `VITE_MODULES` | CSV of modules initialized at boot |
| `VITE_API_BASE` | API base URL (`deps.api`) |
| `VITE_REGISTRY_URL` | `registry.json` URL for the installable-module loader |
| `VITE_REGISTRY_ADMIN_URL` | registry service base URL for the admin UI `/system/modules` |
| `VITE_CONFIG_JSON` | full `/config.json` override (JSON object) |

The dev server generates the dev config from the envs above; `public/config.json` is only a fallback (no per-client edits needed).

### 2.3 Start the dev server

```bash
cd web-container
npm run dev        # http://localhost:5173
```

Quick check:

```bash
curl -s http://localhost:5173/config.json | jq .
```

- Dev login accepts any non-empty username/password.
- The menu follows `modules` in `/config.json`.
- **Restart** the dev server after adding a module (loader map is generated) or switching clients (the symlink changes).
- Full conventions & daily commands: `DEVELOPER-GUIDE.en.md` §0–§1.

---

## 3. Two Module Tracks

| Aspect | Built-in module | Installable module |
| --- | --- | --- |
| Source location | `web-modules/modules/<name>/` | `runtime-modules/<name>/` |
| When it is bundled | at container build (`moduleLoaders.generated.ts`) | built separately (`build:module`) |
| Distribution | ships in the base/client image | zip uploaded to the registry |
| Container hook access | import from `@arsi/container` | `deps.runtime` (P2) |
| CSS | scanned by container Tailwind at build | its own `module.css` (Tailwind CLI + shared preset) |
| Activation | `config.modules` (always in the image) | `config.modules` + registry entry `enabled` |
| Living example | `user-management`, `product-management` | `runtime-modules/module-runtime-demo` |

Hard rules for installable modules:

- **Only** `import type` from `@arsi/container`; never value-import (the container would be bundled in and the context breaks).
- All hooks are accessed through `deps.runtime` (see §4).
- The module **must** ship its own built CSS (`styles.css` → `module.css`).
- The manifest `apiVersion` must match the container `RUNTIME_API_VERSION` (currently `1`).
- Do not put installable modules under `web-modules/modules/` — they would enter the built-in loader map and shadow the registry path.

Full conventions (services, query keys, stores, i18n, naming) still follow `DEVELOPER-GUIDE.en.md` §3; only hook access and distribution differ.

---

## 4. Creating an Installable Module

Case study: `order-management`. Most complete living example: `runtime-modules/module-runtime-demo`.

### 4.1 Folder structure

```
runtime-modules/order-management/
├── package.json
├── runtime.ts          # RuntimeHooks holder + useRuntime()
├── index.tsx           # init(deps): setRuntime + i18n + menu + routes
├── pages/OrderListPage.tsx
├── components/
├── i18n/{en,id}.json
└── styles.css          # @tailwind utilities;
```

### 4.2 `package.json`

```json
{
  "name": "@arsi/module-order-management",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Folder name = package suffix (`@arsi/module-<folder>`), consistent with the module convention.

### 4.3 `runtime.ts` — container hook access

```ts
import type { RuntimeHooks } from '@arsi/container';

let runtime: RuntimeHooks | null = null;

export function setRuntime(value: RuntimeHooks): void {
  runtime = value;
}

export function useRuntime(): RuntimeHooks {
  if (!runtime) {
    throw new Error('[order-management] runtime belum di-init');
  }
  return runtime;
}
```

### 4.4 `index.tsx` — `init(deps)`

```tsx
import type { Deps } from '@arsi/container';

import en from './i18n/en.json';
import id from './i18n/id.json';
import { OrderListPage } from './pages/OrderListPage';
import { setRuntime } from './runtime';

export default async function init(deps: Deps): Promise<void> {
  setRuntime(deps.runtime);
  deps.i18n.addResourceBundle('en', 'order-management', en, true, true);
  deps.i18n.addResourceBundle('id', 'order-management', id, true, true);
  deps.menu.register({ path: '/orders', label: 'Orders', order: 50 });
  deps.routes.add({
    path: '/orders',
    element: <OrderListPage />,
    meta: { group: 'order', module: 'order-management' },
  });
}
```

### 4.5 Page — use hooks from `useRuntime()`

```tsx
import { useRuntime } from '../runtime';

export function OrderListPage() {
  const { useApi, useQuery, useTranslation } = useRuntime();
  const { t } = useTranslation('order-management');
  const api = useApi();
  const { data, isLoading } = useQuery({
    queryKey: ['order-management', 'orders'],
    queryFn: async () => (await api.get('/orders')).data,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-soft">
      <h1 className="text-xl font-semibold text-primary">{t('title')}</h1>
      <pre className="mt-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
```

Hooks available in `deps.runtime`: `useConfig`, `useLogger`, `useApi`, `useApiRegistry`, `useEventBus`, `useToast`, `useModal`, `useNotifications`, `useSlot`, `useTheme`, `useLocale`, `useAuth`, `useTranslation`, `useQuery`, `useMutation`, `useQueryClient`, `useAuthStore`, `useThemeStore`, `useLocaleStore`.

### 4.6 `styles.css`

```css
@tailwind utilities;
```

Tailwind utilities are generated at module build (preset `web-modules/shared/tailwind.preset.cjs`), then injected by the loader when the module loads.

---

## 5. Build & Pack the Module

From `web-container`:

```bash
cd web-container

# build the remote (MF) + CSS
MODULE=order-management npm run build:module

# manifest + hash + zip
MODULE=order-management npm run pack:module
```

Artifacts:

```
web-container/dist/modules/order-management/
├── remoteEntry.js
├── mf-manifest.json
├── assets/*.js
└── module.css

web-container/dist/modules/order-management-0.1.0.zip
```

`pack:module` prints `{ integrity, zip, registryEntry }` JSON. The `manifest.json` inside the zip:

```json
{
  "name": "order-management",
  "version": "0.1.0",
  "apiVersion": 1,
  "requires": { "container": ">=0.1.0" },
  "entry": "remoteEntry.js",
  "css": ["module.css"],
  "builtAgainst": { "container": "0.1.0" }
}
```

Notes:

- `integrity` = `sha384-<base64>` over the bytes of **`mf-manifest.json`** (the file the loader verifies) — not `manifest.json`.
- If the registry service has `SIGNING_PUBLIC_KEY` set, include `signature.ed25519` in the zip (ed25519 verification over `mf-manifest.json`).
- `apiVersion` must be `1`; a mismatch is rejected at load time.

---

## 6. Installing the Module

### 6.1 Run the registry service

```bash
cd registry-service
npm install
ADMIN_TOKEN=admin-secret \
ADMIN_CORS_ORIGIN=http://localhost:5173 \
DATA_DIR=./data \
npm start        # http://localhost:4310
```

Key envs: `ADMIN_TOKEN` (required), `ADMIN_CORS_ORIGIN` (admin UI origin; empty = no cross-origin access), `DATA_DIR`, `PUBLIC_BASE_URL`, `CORS_ORIGIN` (public artifacts), `SIGNING_PUBLIC_KEY` (optional). Details: `MODULE-REGISTRY-GUIDE.en.md` §3.

### 6.2 Admin UI flow

1. Set the app envs then restart the dev server:

   ```dotenv
   VITE_MODULES=user-management,module-sample,registry-admin,order-management
   VITE_REGISTRY_URL=http://localhost:4310/registry.json
   VITE_REGISTRY_ADMIN_URL=http://localhost:4310
   ```

   `module-sample` is required because the client-a extension overrides its route.

2. Open `http://localhost:5173/system/modules`.
3. Enter the **Admin token** (`admin-secret`) → **Save token**.
4. Upload `dist/modules/order-management-0.1.0.zip` (drag-drop or pick the file).
5. The module appears in the table; use **Enable/Disable** or **Delete**.
6. Reload the app: the active module shows in the menu/routes. Verify with `curl -s localhost:5173/config.json | jq .` and the dev log `module "order-management" initialized (registry 0.1.0)`.

### 6.3 Curl alternative (CI/headless)

```bash
TOKEN=admin-secret
BASE=http://localhost:4310

# upload
curl -sS -X POST "$BASE/api/modules" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@web-container/dist/modules/order-management-0.1.0.zip" | jq .

# list
curl -sS "$BASE/api/modules" -H "Authorization: Bearer $TOKEN" | jq .

# disable / enable
curl -sS -X PATCH "$BASE/api/modules/order-management" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"enabled":false}' | jq .

# delete (removes entry + files)
curl -sS -X DELETE "$BASE/api/modules/order-management" \
  -H "Authorization: Bearer $TOKEN" -o /dev/null -w '%{http_code}\n'
```

---

## 7. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| Module does not appear even after upload | Name missing from `VITE_MODULES`; registry entry `enabled:false`; `VITE_REGISTRY_URL` points at a different service. |
| `integrity mismatch` in the log | The zip changed after packing, or the registry points at an older version. Re-pack + re-upload. |
| `apiVersion` mismatch | The module was built for a different runtime version. Align `RUNTIME_API_VERSION` (currently `1`) and rebuild. |
| Upload rejected 400 | Incomplete zip structure (`manifest.json`/`mf-manifest.json`/`remoteEntry.js`/css/assets), non-kebab name, non-semver version, or size > 20 MB. |
| Upload 409 | `name@version` already exists. Bump `version` in the module `package.json`. |
| Admin UI 401 | Wrong/empty token in localStorage. Re-enter it via the TokenBar. |
| Admin UI fails cross-origin | Set the service `ADMIN_CORS_ORIGIN` to the admin UI origin (`http://localhost:5173`). |
| `/system/modules` says "not configured" | `VITE_REGISTRY_ADMIN_URL` is empty. Set the env and restart. |
| Module CSS not applied | `module.css` missing from the zip / not listed in the manifest `css`. Re-run `build:module` + `pack:module`. |
| `Invalid hook call` in the module | A value-import from `@arsi/container` exists. Switch to `deps.runtime`/`useRuntime()`. |
| `module "x" ... not found in the registry` | The registry is unreachable or the module was not uploaded; the loader is fail-closed and skips it (the app still boots). |
| Extension fails to init after installing a module | `VITE_MODULES` must include modules overridden by the active extension (client-a: `module-sample`). |

---

## 8. References

| Document | Contents |
| --- | --- |
| `DEVELOPER-GUIDE.en.md` | Laptop onboarding, module/extension conventions, services/query keys/stores, testing |
| `MODULE-REGISTRY-GUIDE.en.md` | Registry service (env, API, curl), admin UI, security & deployment |
| `CONTRACT.en.md` | Hard layer rules, config (§14), versioning (§16) |
| `DEPLOYMENT-GUIDE.en.md` | Image builds, tagging, CI, rollback |
| `ZERO-TO-DEPLOY-GUIDE.en.md` | Clone → extension → compile → deploy walkthrough |
| `runtime-modules/module-runtime-demo/` | Living example of an installable module (runtime API, build, pack) |

---

**Document version**: 0.1.0
**Last updated**: 2026-10-06
