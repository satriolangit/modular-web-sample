# Panduan Module — Run, Buat, Install

**Version**: 0.1.0
**Audience**: Developer module & platform engineer
**Dokumen terkait**: `DEVELOPER-GUIDE.md` (konvensi module/extension), `MODULE-REGISTRY-GUIDE.md` (registry service + UI admin), `CONTRACT.md`, `DEPLOYMENT-GUIDE.md`

> English version: `MODULE-DEVELOPMENT-GUIDE.en.md`.

---

## Daftar Isi

1. [Ringkasan & Prasyarat](#1-ringkasan--prasyarat)
2. [Menjalankan web-container](#2-menjalankan-web-container)
3. [Dua Jalur Module](#3-dua-jalur-module)
4. [Membuat Module Installable](#4-membuat-module-installable)
5. [Build & Pack Module](#5-build--pack-module)
6. [Install Module](#6-install-module)
7. [Troubleshooting](#7-troubleshooting)
8. [Referensi](#8-referensi)

---

## 1. Ringkasan & Prasyarat

Tiga alur yang dicakup panduan ini:

```
1. Run       : jalankan web-container di lokal (dev server + config env)
2. Create    : buat module installable (runtime bundle) di runtime-modules/<name>/
3. Install   : build + pack → upload ke registry service → aktifkan → verifikasi
```

| Kebutuhan | Versi | Catatan |
| --- | --- | --- |
| Node.js | 22.x | image/Docker memakai `node:22-alpine` |
| npm | 10+ | `npm ci` di web-modules, web-container, extension |
| Docker | opsional | hanya untuk build image (lihat `DEPLOYMENT-GUIDE.md`) |
| Playwright | opsional | hanya untuk e2e (`npx playwright install chromium`) |

Port default: web-container `5173`, registry service `4310`.

---

## 2. Menjalankan web-container

### 2.1 Setup dependency

```bash
cd <workspace>
(cd web-modules && npm ci)
(cd web-container && npm ci && CLIENT=client-a npm run link:client)
(cd web-extension-client-a && npm ci)
```

`link:client` membuat symlink `web-container/current-client -> ../web-extension-client-a` (extension yang aktif di dev).

### 2.2 Env dev (opsional, gitignored)

```bash
cd web-container
cp .env.example .env
```

| Env | Fungsi |
| --- | --- |
| `VITE_CLIENT` | identitas client (opsional; default dari symlink `current-client`) |
| `VITE_MODULES` | CSV module yang di-init saat boot |
| `VITE_API_BASE` | base URL API (`deps.api`) |
| `VITE_REGISTRY_URL` | URL `registry.json` untuk loader module installable |
| `VITE_REGISTRY_ADMIN_URL` | base URL registry service untuk UI admin `/system/modules` |
| `VITE_CONFIG_JSON` | override penuh `/config.json` (JSON object) |

Config dev = env individual **menimpa** base `public/config.json`, dengan fallback default (`user-management`, dummyjson); `VITE_CONFIG_JSON` menang penuh. `public/config.json` **tidak perlu** diubah per client — base repo ini sudah memuat 4 module dev (termasuk `module-sample` yang di-override extension client-a).

### 2.3 Jalankan dev server

```bash
cd web-container
npm run dev        # http://localhost:5173
```

Cek cepat:

```bash
curl -s http://localhost:5173/config.json | jq .
```

- Login dev menerima username/password apa pun yang tidak kosong.
- Menu mengikuti `modules` di `/config.json`.
- **Restart** dev server setelah menambah module (loader map di-generate) atau mengganti client (symlink berubah).
- Konvensi & perintah harian lengkap: `DEVELOPER-GUIDE.md` §0–§1.

---

## 3. Dua Jalur Module

| Aspek | Built-in module | Installable module |
| --- | --- | --- |
| Lokasi sumber | `web-modules/modules/<name>/` | `runtime-modules/<name>/` |
| Kapan dibundel | saat build container (`moduleLoaders.generated.ts`) | dibuild terpisah (`build:module`) |
| Distribusi | ikut image base/client | zip diupload ke registry |
| Akses hook container | import dari `@arsi/container` | `deps.runtime` (P2) |
| CSS | dipindai Tailwind container saat build | `module.css` sendiri (Tailwind CLI + preset shared) |
| Aktivasi | `config.modules` (selalu ada di image) | `config.modules` + registry entry `enabled` |
| Contoh hidup | `user-management`, `product-management` | `runtime-modules/module-runtime-demo` |

Aturan keras module installable:

- **Hanya** `import type` dari `@arsi/container`; jangan value-import (container akan ikut ter-bundel dan context putus).
- Semua hook diakses lewat `deps.runtime` (lihat §4).
- Module **wajib** membawa CSS hasil build sendiri (`styles.css` → `module.css`).
- `apiVersion` manifest harus sama dengan `RUNTIME_API_VERSION` container (saat ini `1`).
- Jangan taruh module installable di `web-modules/modules/` — akan ikut loader map built-in dan menutupi jalur registry.

Konvensi penuh (service, query key, store, i18n, naming) tetap mengikuti `DEVELOPER-GUIDE.md` §3; perbedaannya hanya cara akses hook dan distribusi.

---

## 4. Membuat Module Installable

Studi kasus: `order-management`. Contoh hidup paling lengkap: `runtime-modules/module-runtime-demo`.

### 4.1 Struktur folder

```
runtime-modules/order-management/
├── package.json
├── runtime.ts          # holder RuntimeHooks + useRuntime()
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

Nama folder = suffix package (`@arsi/module-<folder>`), konsisten dengan konvensi module.

### 4.3 `runtime.ts` — akses hook container

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

### 4.5 Halaman — pakai hook dari `useRuntime()`

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

Hook yang tersedia di `deps.runtime`: `useConfig`, `useLogger`, `useApi`, `useApiRegistry`, `useEventBus`, `useToast`, `useModal`, `useNotifications`, `useSlot`, `useTheme`, `useLocale`, `useAuth`, `useTranslation`, `useQuery`, `useMutation`, `useQueryClient`, `useAuthStore`, `useThemeStore`, `useLocaleStore`.

### 4.6 `styles.css`

```css
@tailwind utilities;
```

Utilitas Tailwind di-generate saat build module (preset `web-modules/shared/tailwind.preset.cjs`), lalu di-inject loader saat module dimuat.

---

## 5. Build & Pack Module

Dari `web-container`:

```bash
cd web-container

# build remote (MF) + CSS
MODULE=order-management npm run build:module

# manifest + hash + zip
MODULE=order-management npm run pack:module
```

Artefak:

```
web-container/dist/modules/order-management/
├── remoteEntry.js
├── mf-manifest.json
├── assets/*.js
└── module.css

web-container/dist/modules/order-management-0.1.0.zip
```

`pack:module` mencetak JSON `{ integrity, zip, registryEntry }`. Isi `manifest.json` di zip:

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

Catatan:

- `integrity` = `sha384-<base64>` atas bytes **`mf-manifest.json`** (file yang diverifikasi loader) — bukan `manifest.json`.
- Bila registry service di-set `SIGNING_PUBLIC_KEY`, sertakan `signature.ed25519` di zip (verifikasi ed25519 atas `mf-manifest.json`).
- `apiVersion` harus `1`; mismatch ditolak saat load.

---

## 6. Install Module

### 6.1 Jalankan registry service

```bash
cd registry-service
npm install
ADMIN_TOKEN=admin-secret \
ADMIN_CORS_ORIGIN=http://localhost:5173 \
DATA_DIR=./data \
npm start        # http://localhost:4310
```

Env penting: `ADMIN_TOKEN` (wajib), `ADMIN_CORS_ORIGIN` (origin admin UI; kosong = tanpa akses lintas origin), `DATA_DIR`, `PUBLIC_BASE_URL`, `CORS_ORIGIN` (artefak publik), `SIGNING_PUBLIC_KEY` (opsional). Detail: `MODULE-REGISTRY-GUIDE.md` §3.

### 6.2 Alur UI admin

1. Set env app lalu restart dev server:

   ```dotenv
   VITE_MODULES=user-management,module-sample,registry-admin,order-management
   VITE_REGISTRY_URL=http://localhost:4310/registry.json
   VITE_REGISTRY_ADMIN_URL=http://localhost:4310
   ```

   `module-sample` diperlukan karena extension client-a meng-override route-nya.

2. Buka `http://localhost:5173/system/modules`.
3. Isi **Admin token** (`admin-secret`) → **Save token**.
4. Upload zip `dist/modules/order-management-0.1.0.zip` (drag-drop atau pilih file).
5. Module muncul di tabel; atur **Enable/Disable** atau **Delete**.
6. Reload app: module aktif tampil di menu/route. Verifikasi `curl -s localhost:5173/config.json | jq .` dan log dev `module "order-management" initialized (registry 0.1.0)`.

### 6.3 Alternatif curl (CI/headless)

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

# delete (hapus entry + file)
curl -sS -X DELETE "$BASE/api/modules/order-management" \
  -H "Authorization: Bearer $TOKEN" -o /dev/null -w '%{http_code}\n'
```

---

## 7. Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| Module tidak muncul walau sudah diupload | Nama belum ada di `VITE_MODULES`; registry entry `enabled:false`; `VITE_REGISTRY_URL` menunjuk service yang berbeda. |
| `integrity mismatch` di log | Zip diubah setelah pack, atau registry menunjuk versi lama. Pack ulang + upload ulang. |
| `apiVersion` mismatch | Module dibuild untuk versi runtime lain. Sesuaikan `RUNTIME_API_VERSION` (saat ini `1`) lalu build ulang. |
| Upload ditolak 400 | Struktur zip tidak lengkap (`manifest.json`/`mf-manifest.json`/`remoteEntry.js`/css/assets), nama bukan kebab-case, versi bukan semver, atau ukuran > 20 MB. |
| Upload 409 | `name@version` sudah ada. Naikkan `version` di `package.json` module. |
| UI admin 401 | Token di localStorage salah/kosong. Isi ulang lewat TokenBar. |
| UI admin gagal lintas origin | Set `ADMIN_CORS_ORIGIN` di service sama dengan origin admin UI (`http://localhost:5173`). |
| Halaman `/system/modules` bilang "not configured" | `VITE_REGISTRY_ADMIN_URL` kosong. Set env lalu restart. |
| CSS module tidak tampil | `module.css` tidak ada di zip / tidak terdaftar di manifest `css`. Jalankan `build:module` + `pack:module` ulang. |
| `Invalid hook call` di module | Ada value-import dari `@arsi/container`. Ganti ke `deps.runtime`/`useRuntime()`. |
| `module "x" ... not found in the registry` | Registry tidak bisa dibaca atau module belum diupload; loader fail-closed melewati module (app tetap boot). |
| Extension gagal init / override dilewati setelah install module | `VITE_MODULES` harus memuat module yang di-override extension aktif (client-a: `module-sample`). Dengan guard `routes.has`, extension hanya `warn` dan melewati override (fitur override tidak aktif) alih-alih error. |

---

## 8. Referensi

| Dokumen | Isi |
| --- | --- |
| `DEVELOPER-GUIDE.md` | Onboarding laptop, konvensi module/extension, service/query key/store, testing |
| `MODULE-REGISTRY-GUIDE.md` | Registry service (env, API, curl), UI admin, keamanan & deployment |
| `CONTRACT.md` | Aturan keras layer, config (§14), versioning (§16) |
| `DEPLOYMENT-GUIDE.md` | Build image, tagging, CI, rollback |
| `ZERO-TO-DEPLOY-GUIDE.md` | Alur clone → extension → compile → deploy |
| `runtime-modules/module-runtime-demo/` | Contoh hidup module installable (runtime API, build, pack) |

---

**Document version**: 0.1.0
**Last updated**: 2026-10-06
