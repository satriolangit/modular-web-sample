# Panduan Developer — Membuat Module & Extension

**Version**: 0.8.0
**Audience**: Developer `web-modules`, `web-extension-client-<x>`, dan new joiner
**Dokumen terkait**: `ARCHITECTURE.md` (kenapa & bagaimana), `CONTRACT.md` (aturan keras — pelanggaran = PR ditolak), `DEPLOYMENT-GUIDE.md` (build/CI), `VM-DEPLOYMENT-GUIDE.en.md` (deploy produksi di VM Linux)

> Panduan ini adalah jalur cepat untuk menambah **module bisnis baru** atau **extension client** dengan aman. Semua contoh diambil dari kode nyata di workspace ini (`user-management`, `product-management`, `web-extension-client-a`).

---

## Daftar Isi

0. [Onboarding: Dari Nol sampai Jalan](#0-onboarding-dari-nol-sampai-jalan)
1. [Setup & Peta Workspace](#1-setup--peta-workspace)
2. [Model Mental 5 Menit](#2-model-mental-5-menit)
3. [Membuat Module Baru](#3-membuat-module-baru)
4. [Membuat Extension (module-extension)](#4-membuat-extension-module-extension)
5. [Konvensi Cepat](#5-konvensi-cepat)
6. [Testing Playbook](#6-testing-playbook)
7. [Troubleshooting](#7-troubleshooting)
8. [Checklist PR](#8-checklist-pr)
9. [Referensi & Contoh Hidup](#9-referensi--contoh-hidup)
10. [Build Image Lokal & Smoke Test](#10-build-image-lokal--smoke-test)

---

## 0. Onboarding: Dari Nol sampai Jalan

Bagian ini menuntun developer baru dari laptop kosong sampai aplikasi berjalan, satu perubahan kecil, dan PR pertama. Detail pendalaman ada di §2–§9; build image ada di §10.

### 0.0 Quick start (TL;DR)

```bash
# 1) Node 22 (via nvm; boleh fnm)
nvm install 22 && nvm use 22
node -v                                  # v22.x

# 2) Clone base repo + extension repo (extension DI DALAM folder base)
mkdir -p ~/works/arsi && cd ~/works/arsi
git clone <repo-arsi-web-base> arsi-web-base
cd arsi-web-base
git clone <repo-arsi-web-client-a> web-extension-client-a
echo "web-extension-*/" >> .git/info/exclude   # clone extension jangan ikut ter-commit ke base

# 3) Install dependency (urutan: modules → container → extension)
(cd web-modules && npm ci)
(cd web-container && npm ci && npm run link:client-a)
(cd web-extension-client-a && npm ci)

# 4) Jalankan dev server
cd web-container && npm run dev:client-a   # http://localhost:5173
```

> Workspace sample ini sudah berisi semua folder (layout flat) — jika Anda bekerja di sample, lewati langkah clone dan mulai dari langkah 3.

### 0.1 Peta 5 menit: repo & tanggung jawab

| Repo | Isi | Anda mengubah apa |
| --- | --- | --- |
| `arsi-web-base` (1 repo) | `web-container` + `web-modules` + `web-extension-default` + `web-extension-template` | shell/DI/routing, UI kit, module bisnis, extension default, template |
| `arsi-web-client-<x>` (1 repo per client) | override khas client (`src/`) | slot, route override, service wrapper, i18n/modal/event khas client |

Arah dependensi: `Container ← Module ← Extension`, Shared dipakai Module & Extension. Extension **tidak boleh** menyentuh internal module — hanya `public.ts` (CONTRACT §1).

### 0.2 Setup laptop

| Kebutuhan | Cara |
| --- | --- |
| Node 22.x | `nvm install 22 && nvm use 22` (atau `fnm use 22`); verifikasi `node -v` |
| npm 10+ | ikut Node; `npm -v` |
| Git | `git --version`; set `user.name`/`user.email` |
| Docker (opsional) | Docker Desktop / Docker Engine + Compose — hanya untuk §10 (build image lokal) |
| jq (opsional) | untuk smoke test §10; `brew install jq` (macOS) / `apt-get install jq` (Linux) |
| Editor | VS Code + ESLint; format mengikuti `.eslintrc.cjs` repo |

Catatan OS:

- **macOS/Linux**: semua perintah guide ini jalan native.
- **Windows**: gunakan **WSL2** (Ubuntu) — script repo memakai `ln -sfn`, `sh`, dan path POSIX. Jangan clone di filesystem Windows (`/mnt/c/...`) karena symlink/performa; clone di home WSL.

### 0.3 Clone & layout repo produksi

```bash
mkdir -p ~/works/arsi && cd ~/works/arsi
git clone <repo-arsi-web-base> arsi-web-base
cd arsi-web-base
git clone <repo-arsi-web-client-a> web-extension-client-a
```

> Belum ada repo `arsi-web-client-<x>`? Buat dulu dari template (§4.9), baru lanjut install dependency di §0.4.

Kenapa extension harus **di dalam** folder base repo? Dua kontrak path bergantung padanya:

- container: `web-container/current-client -> ../web-extension-client-a` (symlink relatif ke parent `web-container`);
- extension: `aliases.cjs`/`tsconfig.json` meresolve `../web-container` dan `../web-modules` relatif ke folder extension.

Agar clone extension tidak muncul sebagai untracked di repo base, tambahkan ke exclude lokal (berlaku untuk file **untracked**; detail & caveat di §4.9):

```bash
echo "web-extension-*/" >> .git/info/exclude
```

> Workspace sample (`modular-web-sample`) memakai layout flat: `web-container`, `web-modules`, `web-extension-client-a`, `web-extension-template` bersaudara. Di sample, semua sudah terpasang; langkah clone di atas untuk repo produksi.

### 0.4 Install dependency

Urutan penting: `web-modules` dulu (workspace package), lalu `web-container`, lalu extension.

```bash
cd arsi-web-base
(cd web-modules && npm ci)
(cd web-container && npm ci && npm run link:client-a)   # link current-client ke extension aktif
(cd web-extension-client-a && npm ci)
```

- Pakai `npm ci` (lockfile di-commit). `npm install` hanya bila Anda memang mengubah dependency — lalu commit lockfile.
- Ulangi `npm ci` setelah `git pull` yang mengubah lockfile.
- Ganti client aktif: `cd web-container && CLIENT=<client> npm run link:client` (restart dev server).
- Untuk client baru, ganti `web-extension-client-a` → `web-extension-client-<x>`; buat repo-nya dulu bila belum ada (§4.9).

### 0.5 Jalankan dev server

```bash
cd arsi-web-base/web-container
npm run dev:client-a          # http://localhost:5173
```

- Config dev dibaca dari `web-container/public/config.json` (client-a, 3 module, `apiBase` dummyjson). Ubah file itu untuk mencoba kombinasi module lain.
- Hot reload untuk perubahan `web-modules/` dan extension aktif.
- **Restart** dev server setelah: menambah module (loader map di-generate) atau mengganti client (symlink berubah).
- Cek cepat: halaman login tampil, menu sesuai `modules` di config, tidak ada error di console.

### 0.6 Alur kerja harian

1. Buat branch dari branch utama repo yang tepat: `feat/<ringkas>` atau `fix/<ringkas>`.
2. Kerjakan perubahan; jalankan test/typecheck/lint repo terkait (§6).
3. Commit kecil dengan conventional commit (`feat(<scope>): ...`, `fix(<scope>): ...`).
4. PR ke repo yang tepat: perubahan module/shared/container → repo base; override client → repo extension. Checklist: §8.
5. Perubahan yang mengadopsi base baru: bump `baseVersion` (§4.11).

### 0.7 Peta belajar berikutnya

| Ingin | Baca |
| --- | --- |
| Paham layer & aturan main | §2 (model mental), `CONTRACT.md` |
| Membuat module baru | §3 |
| Mengubah module yang ada | §3.17–§3.18 |
| Membuat/mengubah extension client | §4 |
| Membuat repo client baru dari template (belum ada) | §4.9 |
| Menulis test | §6 |
| Build image & smoke test lokal | §10 |
| Deploy ke server | `DEPLOYMENT-GUIDE.md`, `VM-DEPLOYMENT-GUIDE.en.md` |
| Deploy end-to-end (clone → extension → compile → deploy) | `ZERO-TO-DEPLOY-GUIDE.md` |

---

## 1. Setup & Peta Workspace

### 1.1 Struktur

Struktur produksi (1 repo base + 1 repo per client):

```
arsi-web-base/                      # repo base
├── Dockerfile                      # image base (multi-target: builder | runtime)
├── ci/build-base.sh                # build + push image base
├── docs/                           # ARCHITECTURE.md, CONTRACT.md, panduan ini
├── web-container/                  # shell: DI, routing, layout, config, registry
│   └── current-client -> ../web-extension-client-<x>   (symlink)
├── web-modules/                    # shared/ (UI kit) + modules/<name>/ (fitur bisnis)
├── web-extension-default/          # extension default (client "base") untuk image base
├── web-extension-template/         # template repo client baru
└── web-extension-client-<x>/       # checkout repo client (clone terpisah, di dalam base repo)
```

Folder extension **wajib bersebelahan** dengan `web-container` dan `web-modules` — symlink `current-client` dan alias extension (`../web-container`) bergantung padanya. Di laptop, clone repo extension **di dalam** folder base repo (langkah lengkap: §0.3).

> Workspace sample ini (`modular-web-sample`) memakai layout flat — `web-container`, `web-modules`, `web-extension-client-a`, `web-extension-template` bersaudara dalam satu repo. Layout itu untuk kontribusi ke sample; struktur produksi mengikuti diagram di atas.

### 1.2 Prasyarat

- Node.js 22.x (Docker/CI memakai `node:22-alpine`; jsdom@30/undici@8 butuh ≥22.22; `engines: ">=20"` di package.json). Disarankan via `nvm`/`fnm` (§0.2).
- npm 10+.
- Git.
- Docker + Docker Compose (opsional — hanya untuk build image lokal & smoke test, §10).
- OS: macOS/Linux native; Windows wajib WSL2 (script `ln -sfn` butuh shell POSIX).

### 1.3 Setup pertama kali

Clone & layout: §0.3. Untuk workspace sample ini (semua folder sudah bersaudara):

```bash
cd web-modules && npm ci
cd ../web-container && npm ci && npm run link:client-a
cd ../web-extension-client-a && npm ci
```

Jalankan dev server: `cd web-container && npm run dev:client-a` → http://localhost:5173 (§0.5).

### 1.4 Perintah harian

| Kebutuhan | Perintah |
| --- | --- |
| Dev server client-a | `cd web-container && npm run dev:client-a` (http://localhost:5173) |
| Ganti client aktif | `cd web-container && CLIENT=<client> npm run link:client` (atau `npm run link:client-a`); restart dev server |
| Build client | `cd web-container && CLIENT=<client> npm run build:client` → `dist/<client>/` (client-a: `npm run build:client-a`) |
| Build base (image default) | `cd web-container && npm run link:base && CLIENT=base npm run build:client` → `dist/base/` |
| Test | `npm test` di repo mana pun (`web-modules`, `web-container`, extension) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (container & extension) |
| Guard COPY module | `cd web-container && npm run check:dockerfile` |
| Build image base lokal | `ORG=<dockerhub-org> VERIFY=0 PUSH=0 ./ci/build-base.sh` (dari root repo base; §10.2) |
| Build image client lokal | `cd web-extension-client-<x> && ORG=<dockerhub-org> PULL=0 PUSH=0 BUILD_ID=local ./ci/build-client.sh` (§10.3) |
| Adopsi base versi baru | bump `manifest.json:baseVersion` via PR (§4.11) |

### 1.5 Peta dokumen

| Dokumen | Isi |
| --- | --- |
| `ARCHITECTURE.md` | Filosofi, layer, boot sequence, roadmap |
| `CONTRACT.md` | Aturan keras per layer, naming, governance |
| `DEVELOPER-GUIDE.md` (ini) | Langkah praktis membuat module/extension |
| `docs/DEPLOYMENT-GUIDE.md` | Deployment DevOps: Docker build/run, env, CI, rollback |
| `docs/VM-DEPLOYMENT-GUIDE.en.md` | Deploy runtime produksi di VM Linux: Docker, TLS, update/rollback, operasional (English) |
| `docs/phase.02-rbac-navigation.md` | Rencana Fase 2: Keycloak RBAC + navigasi dari database |

---

## 2. Model Mental 5 Menit

### 2.1 Arah dependensi (tidak boleh dilanggar)

```
Container  ←  Module  ←  Extension
   ↑            ↑            ↑
   └──── Shared ┘────────────┘
```

| Dari | Boleh import |
| --- | --- |
| Container | tidak ada layer lain (kecuali discovery di `bootstrap/discover.ts`) |
| Shared | tidak ada layer lain (harus pure) |
| Module | Container **public API**, Shared |
| Extension | Container **public API**, Shared, Module **public API** |

Dilarang: module import module lain, extension import file internal module, container import module/extension (selain discovery).

### 2.2 Dua kanal akses instance

| Konteks | Pakai |
| --- | --- |
| `init(deps)` di luar React tree | `deps` |
| Component / custom hook | hook dari `@arsi/container` |
| Utility function | parameter (jangan import `deps`) |

```ts
// ❌ Jangan — akses deps di top-level module
import { deps } from '@arsi/container';
const client = deps.queryClient;

// ✅ Benar — di dalam hook/function
function useOrders() {
  const apiRegistry = useApiRegistry();
  // ...
}
```

### 2.3 State: React Query vs Zustand

| Data | Pakai |
| --- | --- |
| Server data (list, detail) | React Query (`useQuery`/`useMutation` dari container) |
| UI state (filter, halaman, selected) | Zustand store milik module |
| Form state | React Hook Form + Zod (lihat `product-management`) |
| Auth, theme, locale | Zustand global container |

**Rule**: data dari API → React Query. State UI murni → Zustand. Cross-module → event bus (bukan shared store).

### 2.4 Tiga tingkat override (extension)

Selalu coba dari yang paling ringan: **Slot → Route → Service wrapper**.

| Kebutuhan | Tingkat |
| --- | --- |
| Tambah kolom/tombol di tabel | Slot |
| Ganti halaman penuh / tambah route | Route |
| Ganti validasi / business rule | Service wrapper |

---

## 3. Membuat Module Baru

Studi kasus: `order-management`. Salin struktur dari `web-modules/modules/product-management/` sebagai referensi CRUD lengkap, atau `user-management` untuk versi lebih sederhana.

### 3.0 Checklist langkah

1. Folder + `package.json`
2. `types.ts`
3. `services/service.<nama>.ts`
4. `queryKeys.ts`
5. `slots.ts`, `modals.ts`, `events.ts`
6. `store/use<Name>Store.ts`
7. `hooks/use<Name>.ts`
8. `components/` + `pages/`
9. `i18n/en.json` + `i18n/id.json`
10. `index.tsx` — `init(deps)`
11. `public.ts` — kontrak
12. Wiring: loader map di-generate otomatis (`npm run gen:modules`); tambah COPY package.json di `Dockerfile` root repo base + entri `config.json`
13. Tests
14. Verifikasi

### 3.1 Folder & `package.json`

```
web-modules/modules/order-management/
├── package.json
├── index.tsx          # entry init(deps) — dipakai container
├── public.ts          # kontrak — dipakai extension
├── types.ts
├── slots.ts
├── modals.ts
├── events.ts
├── queryKeys.ts
├── services/service.order.ts
├── hooks/useOrder.ts
├── store/useOrderStore.ts
├── components/
├── pages/
└── i18n/{en,id}.json
```

```json
{
  "name": "@arsi/module-order-management",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "main": "public.ts",
  "types": "public.ts",
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@arsi/shared": "^0.1.0",
    "axios": "~1.7.9",
    "react-router-dom": "^6.30.6",
    "zustand": "^5.0.15"
  }
}
```

Catatan: `axios` hanya boleh di-import sebagai **value** di `index.tsx` (register service). Import `import type { AxiosInstance }` di service tetap boleh (ESLint `allowTypeImports`).

`name` **wajib** mengikuti `@arsi/module-<folder>` — divalidasi oleh `npm run gen:modules` (loader map di-generate dari field ini).

### 3.2 `types.ts`

Semua tipe domain module. Pisahkan tipe list (ringkas) dan detail (lengkap) bila endpoint memakai `select` — lihat `ProductListItem` vs `Product`.

```ts
export interface Order {
  id: number;
  code: string;
  status: 'draft' | 'paid' | 'cancelled';
  total: number;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateOrderInput {
  code: string;
  total: number;
}
```

### 3.3 `services/service.<nama>.ts` — factory, bukan singleton

```ts
import type { AxiosInstance } from 'axios';
import type { CreateOrderInput, Order, OrderListResponse } from '../types';

export interface OrderListParams {
  limit?: number;
  skip?: number;
}

export function createOrderService(api: AxiosInstance) {
  return {
    async list(params: OrderListParams = {}): Promise<OrderListResponse> {
      const { limit = 10, skip = 0 } = params;
      const res = await api.get<OrderListResponse>('/orders', { params: { limit, skip } });
      return res.data;
    },
    async getById(id: string | number): Promise<Order> {
      const res = await api.get<Order>(`/orders/${id}`);
      return res.data;
    },
    async create(input: CreateOrderInput): Promise<Order> {
      const res = await api.post<Order>('/orders/add', input);
      return res.data;
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
```

Aturan service: **factory function** terima `AxiosInstance`; tidak akses `deps`; tidak import React / React Query; pure (parameter masuk, data keluar).

### 3.4 `queryKeys.ts` — factory + namespace

```ts
import type { OrderListParams } from './services/service.order';

export const orderKeys = {
  all: ['order-management', 'order'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params?: OrderListParams) => [...orderKeys.lists(), params ?? {}] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...orderKeys.details(), id] as const,
};
```

Root key **wajib** `['<module>', '<entity>']`. Factory **wajib** diekspor di `public.ts` bila extension perlu invalidate.

### 3.5 `slots.ts`, `modals.ts`, `events.ts`

```ts
// slots.ts
export const orderSlots = {
  orderTableActions: 'order-management.orderTableActions',
} as const;

// modals.ts
export const orderModals = {
  create: 'order-management.create',
} as const;

// events.ts
export const orderEvents = {
  created: 'order-management.order.created',
  updated: 'order-management.order.updated',
} as const;

export interface OrderCreatedPayload {
  order: Order;
}
```

Naming: slot `<module>.<slotName>`, modal `<module>.<action>`, event `<module>.<entity>.<action>`.

### 3.6 `store/use<Name>Store.ts`

```ts
import { isDev } from '@arsi/container';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface OrderUiState {
  status: string | null;
  page: number;
  setStatus: (status: string | null) => void;
  setPage: (page: number) => void;
}

export const useOrderStore = create<OrderUiState>()(
  devtools(
    persist(
      (set) => ({
        status: null,
        page: 1,
        setStatus: (status) => set({ status, page: 1 }),
        setPage: (page) => set({ page }),
      }),
      { name: 'module:order-management' },
    ),
    { name: 'order-management', enabled: isDev },
  ),
);
```

Persist key **wajib** `module:<name>`. Gunakan `isDev` dari container (module **dilarang** akses `import.meta.env`).

### 3.7 `hooks/use<Name>.ts`

```ts
import { useMemo } from 'react';
import {
  useApiRegistry,
  useMutation,
  useQuery,
  useQueryClient,
  useToast,
  useTranslation,
} from '@arsi/container';

import { orderKeys } from '../queryKeys';
import { createOrderService, type OrderListParams } from '../services/service.order';
import type { CreateOrderInput } from '../types';

function useOrderService() {
  const apiRegistry = useApiRegistry();
  return useMemo(() => createOrderService(apiRegistry.get('order')), [apiRegistry]);
}

export function useOrderList(params?: OrderListParams) {
  const service = useOrderService();
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => service.list(params),
  });
}

export function useCreateOrder() {
  const service = useOrderService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('order-management');

  return useMutation({
    mutationFn: (input: CreateOrderInput) => service.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success(t('create.success'));
    },
    onError: () => toast.error(t('create.error')),
  });
}
```

Aturan: import `useQuery`/`useMutation`/`useQueryClient` **dari container**, bukan `@tanstack/react-query`. Mutation selalu invalidate query key terkait (atau optimistic update + rollback — lihat pola di `product-management/hooks/useProduct.ts`). Emit event dari hook via `useEventBus()`.

### 3.8 Components & pages

- **Wajib** pakai komponen dari `@arsi/shared` (`Button`, `DataTable`, `Dialog`, `Form`, dst). **Dilarang** import `components/ui/...` langsung.
- Komponen sangat spesifik module boleh di module (contoh: `ProductTable`, `ProductForm`).
- Halaman pakai `PageHeader` + state/error/empty dari shared (`ErrorState`, `DataTablePagination`, `DataTable` sudah punya empty/loading).
- Navigasi memakai `react-router-dom` langsung (`useNavigate`, `useParams`, `Link`) — konvensi pilot saat ini.
- Semua teks UI lewat i18n: `const { t } = useTranslation('<module>')`.
- Feedback user: `useToast()` untuk pesan transient; `useNotifications()` untuk bell header (persisten, CONTRACT §7.4). `source` **wajib** di-namespace module/extension.

```tsx
const { push } = useNotifications();
push({ title: t('notifications.sample.title'), variant: 'info', source: 'order-management' });
```

Form produksi: React Hook Form + Zod + `Form` shared.

```tsx
const schema = useMemo(() => createOrderSchema(t), [t]);
const form = useForm<OrderFormInput, unknown, OrderFormValues>({
  resolver: zodResolver(schema),
  defaultValues: initialValues ?? EMPTY_ORDER_FORM,
});
```

Schema factory menerima `t` supaya pesan validasi i18n — lihat `product-management/schemas/productSchema.ts`. Trik penting: field angka divalidasi sebagai **string** lalu di-`.transform(Number)`; itu sebabnya `useForm` butuh generic ke-3 (input vs output).

### 3.9 `i18n/en.json` + `i18n/id.json`

Namespace = nama module. Key deskriptif (bukan `text1`).

```json
{
  "title": "Orders",
  "menu": { "orders": "Orders" },
  "actions": { "create": "Create order", "retry": "Try again" },
  "empty": "No orders found",
  "create": { "success": "Order created", "error": "Failed to create order" }
}
```

### 3.10 `index.tsx` — `init(deps)`

```tsx
import axios from 'axios';
import type { Deps } from '@arsi/container';

import { OrderListPage } from './pages/OrderListPage';
import en from './i18n/en.json';
import id from './i18n/id.json';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return; // React StrictMode bisa memanggil dua kali
  }
  initialized = true;

  deps.i18n.addResourceBundle('en', 'order-management', en, true, true);
  deps.i18n.addResourceBundle('id', 'order-management', id, true, true);

  const orderClient = axios.create({
    baseURL: deps.config.apiBase,
    timeout: 8000,
  });
  deps.apiRegistry.register('order', orderClient);

  deps.menu.register({
    path: '/orders',
    label: 'menu.orders',
    namespace: 'order-management',
    order: 30,
  });

  deps.routes.add({
    path: '/orders',
    element: <OrderListPage />,
    meta: { group: 'order', module: 'order-management' },
  });
}
```

Aturan `init`:

- **Semua** registrasi (service, route, menu, modal, slot, i18n, event) di dalam `init`, **tidak pernah** di top-level module.
- Wajib **idempoten** (guard `initialized` + registry container akan throw kalau benar-benar duplikat).
- Service name = `<module>` (atau `<client>.<service>` untuk extension), harus unik.
- Untuk backend nyata, baseURL service **wajib** path-based `/api/<service>` (CONTRACT §4.5). Pilot DummyJSON memakai `deps.config.apiBase` (runtime config, tanpa domain hardcode).
- Modal: `deps.modal.register('<module>.<action>', Component)` — komponen menerima `{ payload, close }` dan merender Dialog sendiri (lihat `ProductDeleteDialog`).
- Notifikasi non-React: `deps.notifications.push({ title, message?, variant?, source })` — mis. dari event listener atau integrasi backend; `source` = `<module>`/`<client>`. Contoh: `web-extension-client-a/src/components/AuditButton.tsx`.
- Event dari container: listen konstanta `containerEvents` (payload `ContainerSearchPayload`, keduanya dari `@arsi/container`) di `init(deps)`. Contoh: `product-management/events/containerSearch.ts` (global search Topbar → filter product). Container **tidak boleh** listen event modul/extension (CONTRACT §13.3).

Inti listener event container di `init`:

```ts
deps.events.on<ContainerSearchPayload>(containerEvents.searchChanged, ({ query }) => {
  useProductStore.getState().setSearch(query);
});
```

### 3.11 `public.ts` — kontrak untuk extension

```ts
export { OrderListPage } from './pages/OrderListPage';
export { useOrderList, useCreateOrder } from './hooks/useOrder';
export { createOrderService, type OrderService } from './services/service.order';
export { orderKeys } from './queryKeys';
export { orderSlots } from './slots';
export { orderModals } from './modals';
export { orderEvents, type OrderCreatedPayload } from './events';
export { useOrderStore } from './store/useOrderStore';
export type { Order, OrderListResponse } from './types';
```

Apa pun yang **tidak** diekspor di sini dianggap internal — extension dilarang mengaksesnya.

### 3.12 Wiring — 2 file (loader map otomatis)

Loader map `web-container/src/bootstrap/moduleLoaders.generated.ts` **di-generate** dari `web-modules/modules/*/package.json` (field `name`) oleh `npm run gen:modules`. Menambah modul **tidak** mengubah `discover.ts`, alias, atau tsconfig.

| File | Yang ditambahkan |
| --- | --- |
| `Dockerfile` (root repo base) | `COPY web-modules/modules/order-management/package.json ./web-modules/modules/order-management/` sebelum `npm ci` (+ `npm run check:dockerfile` di `web-container`) |
| `web-container/public/config.json` | `"modules": [..., "order-management"]` (dev; produksi dikelola CI) |

```bash
cd web-modules && npm install                 # lockfile workspace
cd ../web-container && npm run gen:modules    # regenerate loader map
```

- `gen:modules` otomatis lewat pre-hooks: `predev:client-a`, `pretypecheck`, `pretest`, `prebuild:client-a`.
- Sync test `moduleLoaders.generated.test.ts` gagal bila file generated stale.
- Konvensi: nama folder = nama di `config.modules` = suffix `name` package (`@arsi/module-<folder>`); mismatch → script gagal.
- Alias wildcard `@arsi/module-*` dan `@arsi/module-*/entry` sudah tersedia; **pola `/entry` wajib di atas pola base** (Vite & TS memilih pola pertama yang match).

### 3.13 Tests

Minimal (CONTRACT §17 — module **wajib** punya test untuk public API):

```
services/service.order.test.ts   # mock AxiosInstance, cek endpoint & params
queryKeys.test.ts                # namespace & factory
store/useOrderStore.test.ts      # aksi store + persist key (mock isDev)
public.test.ts                   # kontrak export (mock @arsi/container)
components/OrderTable.test.tsx   # render (mock @arsi/container)
```

Pola mocking lengkap di [bagian 6](#6-testing-playbook).

### 3.14 Verifikasi

```bash
cd web-modules && npm run typecheck && npm test && npm run lint
cd ../web-container && npm run typecheck && npm test && npm run check:dockerfile && npm run build:client-a
cd ../web-container && npm run link:base && CLIENT=base npm run build:client   # verifikasi image base
cd ../web-container && npm run link:client-a && npm run dev:client-a
# buka http://localhost:5173 → menu Orders muncul, halaman render
```

`gen:modules` berjalan otomatis lewat pre-hooks di atas; jalankan manual setelah mengubah daftar modul. Dev server perlu restart setelah menambah modul (loader map statis).

### 3.15 Menambah dependency (library/package)

Aturan lengkap: CONTRACT §1.6. Langkah praktis:

1. Tentukan pemilik: UI kit → `shared`; fitur → package modul; khusus client → extension; shell → container.
2. Install di repo pemiliknya: `cd web-modules && npm install <pkg> -w @arsi/module-<name>` (atau `npm install` di container/extension). Commit lockfile.
3. `react`/`react-dom` tetap peer; jangan dijadikan dependency.
4. Jika library di-import container **dan** modul/extension → tambahkan ke `resolve.dedupe` (`web-container/vite.config.ts`) + samakan versi. Lib berbasis context/singleton **wajib** single copy.
5. Jangan tambah lib yang menduplikasi kapabilitas container (toast/modal/notifikasi/i18n/query/HTTP/event).
6. Library tanpa global CSS; plugin Tailwind hanya di preset shared.
7. Modul baru → tambah `COPY package.json` di `Dockerfile` root repo base + jalankan `npm run check:dockerfile` di `web-container`.
8. Verifikasi duplikat: `grep node_modules/<pkg> web-container/dist/client-a/assets/*.map` harus 1 root; bandingkan ukuran chunk.

### 3.16 API Client & Service Registry

Dua cara mengakses backend:

| Kebutuhan | Pakai | Kenapa |
| --- | --- | --- |
| Endpoint sederhana, satu baseURL (`deps.config.apiBase`) | `deps.api` / `useApi()` | Instance axios default container; tanpa registrasi |
| Service dengan baseURL/config berbeda, atau di-register extension | `deps.apiRegistry` / `useApiRegistry()` | Registry bernama; `register` duplikat throw, `get` nama tak dikenal throw |
| Butuh server state di component | `useQuery` + service factory | Service tidak menyentuh React; hook yang membungkus |

**Pola lengkap (modul):**

```ts
// 1) index.tsx — daftarkan client di init (sekali)
const orderClient = axios.create({ baseURL: deps.config.apiBase, timeout: 8000 });
deps.apiRegistry.register('order', orderClient);
```

```ts
// 2) services/service.order.ts — factory, terima AxiosInstance (lihat §3.3)
export function createOrderService(api: AxiosInstance) {
  return { list: (params?: OrderListParams) => api.get('/orders', { params }).then((r) => r.data) };
}
```

```ts
// 3) hooks/useOrder.ts — ambil instance dari registry, bungkus React Query
import { useApiRegistry, useQuery } from '@arsi/container';

function useOrderService() {
  const apiRegistry = useApiRegistry();
  return useMemo(() => createOrderService(apiRegistry.get('order')), [apiRegistry]);
}

export function useOrderList(params?: OrderListParams) {
  const service = useOrderService();
  return useQuery({ queryKey: orderKeys.list(params), queryFn: () => service.list(params) });
}
```

```tsx
// 4) component — konsumsi hook, bukan axios
const { data } = useOrderList({ limit: 10 });
```

**Akses langsung tanpa registry** (endpoint sederhana, contoh `module-sample`):

```tsx
import { useApi, useQuery } from '@arsi/container';

const api = useApi();
const { data } = useQuery({
  queryKey: ['module-sample', 'user', 1],
  queryFn: async () => (await api.get<SampleUser>('/users/1')).data,
});
```

**Di extension:**

```ts
// Service baru milik client — namespace <client>.<service>; jangan override core (auth/user/product)
deps.apiRegistry.register('client-a.audit', axios.create({ baseURL: '/api/audit-client-a' }));
```

```ts
// Service wrapper: bungkus factory modul (lihat §4.5)
const base = createSampleService(apiRegistry.get('module-sample'));
const wrapped = {
  ...base,
  getUser: async (id: number) => {
    if (id > 3) throw new Error('client-a: hanya user 1-3');
    return base.getUser(id);
  },
};
```

**Aturan:**

- Registrasi **wajib** di `init(deps)`; nama unik & di-namespace (`<module>` atau `<client>.<service>`).
- Component **wajib** ambil instance via `useApi()`/`useApiRegistry()` — dilarang membuat axios client di component.
- Service factory **tidak boleh** mengakses `deps`/React; hanya menerima `AxiosInstance`.
- Extension **tidak boleh** override service core — daftarkan nama baru; ubah business rule lewat service wrapper (§4.5).
- `apiRegistry.register` duplikat → throw; `get` nama tak dikenal → throw (fail-fast saat init/test).

Contoh hidup: `module-sample` halaman `/module-sample/api` (`deps.api`) dan `/module-sample/api-registry` (registry + factory); wrapper extension di `web-extension-client-a/src/hooks/useClientASample.ts`.

### 3.17 Mengubah Module yang Ada (bukan module baru)

Alur aman saat menambah/mengubah fitur di module existing (mis. `user-management`):

1. **Cek kontrak dulu** — `public.ts` module adalah API untuk extension. Tambahan yang tidak breaking:
   - slot baru → deklarasikan di `slots.ts`, ekspor di `public.ts`, pakai `useSlot` di komponen;
   - method service baru → factory di `services/`, query key baru di `queryKeys.ts`, hook baru, ekspor yang perlu di `public.ts`;
   - route baru → `deps.routes.add({ path, element, meta: { group, module } })` di `init`;
   - key i18n baru → `i18n/{en,id}.json` (namespace `<module>`).
2. **Perubahan breaking** (rename/hapus export `public.ts`, ubah signature factory, hapus slot/route) **wajib diskusi lead dev** (CONTRACT §19.2), lalu:
   - perbarui semua pemakai (extension yang import dari `@arsi/module-<name>`);
   - catat di PR + changelog module; tambahkan test kontrak.
3. **Dependency baru** mengikuti CONTRACT §1.6 — install di workspace: `cd web-modules && npm install <pkg> -w @arsi/module-<name>`; commit lockfile; tambahkan `resolve.dedupe` bila library di-import lintas tree.
4. **Module baru** (bukan mengubah yang ada) tetap butuh COPY `package.json` di `Dockerfile` root repo base + `npm run check:dockerfile` (langkah §3.0 poin 12).
5. **Jangan** import module lain, akses store module lain, atau menaruh state lintas module — komunikasi lewat event bus (CONTRACT §3.2, §13).
6. **Menambah field config** — ubah `AppConfig` + `DEFAULT_CONFIG` + `normalizeConfig` di `web-container/src/config/`. Entrypoint **tidak perlu** diubah bila deploy memakai `VITE_CONFIG_JSON` (JSON penuh); bila memakai env individual, tambahkan env + test di `web-container/docker/entrypoint.sh` / `entrypoint.test.sh`.

### 3.18 Uji cepat perubahan module

```bash
# module + dependennya
cd web-modules && npm run typecheck && npm test -- modules/<name> && npm run lint

# pastikan container + bundle tetap sehat
cd ../web-container && npm run typecheck && npm test && CLIENT=client-a npm run build:client

# pastikan extension yang memakai public API module tetap kompilasi
cd ../web-extension-client-a && npm run typecheck && npm test
```

Untuk perubahan `public.ts` (breaking atau tidak), **selalu** jalankan typecheck + test extension — itu konsumen utama kontrak module.

---

## 4. Membuat Extension (module-extension)

Extension = repo `web-extension-client-<x>`; hanya punya **satu** entry: default export `init(deps)` di `src/index.tsx`. Container memuatnya lewat alias `@arsi/extension` (symlink `current-client`).

### 4.1 Struktur & `manifest.json`

```
web-extension-client-a/
├── package.json
├── manifest.json               # client + baseVersion (pin exact ke tag base)
├── Dockerfile                  # FROM base image: <ver>-builder → <ver>
├── ci/build-client.sh          # build + push image client
├── tsconfig.json / aliases.cjs / .eslintrc.cjs / vitest.config.ts
└── src/
    ├── index.tsx              # init(deps)
    ├── components/            # komponen khas client
    ├── overrides/<module>/    # halaman/komponen override
    └── i18n/{en,id}.json      # namespace milik client
```

```json
{
  "client": "client-a",
  "baseVersion": "0.1.0",
  "modules": { "user-management": "^0.1.0", "product-management": "^0.1.0" },
  "shared": "^0.1.0",
  "overrides": ["user-management"]
}
```

Repo extension **tidak** memuat `web-container`/`web-modules` — keduanya tersedia dari base builder image (`/app/web-container`, `/app/web-modules`). `baseVersion` **wajib** pin exact ke tag base dan dicek `npm run check:base` saat build image client (CONTRACT §1.6; detail: `DEPLOYMENT-GUIDE.md` §3–§4).

### 4.2 `init(deps)` — contoh lengkap

```tsx
import axios from 'axios';
import type { Deps } from '@arsi/container';
import { userEvents, userKeys, userSlots, type UserUpdatedPayload } from '@arsi/module-user-management';

import { AuditButton } from './components/AuditButton';
import { ClientAUserDetail } from './overrides/user-management/ClientAUserDetail';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  // 1. Service baru milik client (path-based, namespace <client>.<service>)
  deps.apiRegistry.register('client-a.audit', axios.create({ baseURL: '/api/audit-client-a', timeout: 5000 }));

  // 2. Isi slot module
  deps.slots.register(userSlots.userTableActions, AuditButton);

  // 3. Override route module
  deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });

  // 4. Listen event module (arah yang diizinkan)
  deps.events.on<UserUpdatedPayload>(userEvents.updated, (payload) => {
    void deps.queryClient.invalidateQueries({ queryKey: userKeys.detail(payload.id) });
    deps.logger.info('client-a: user updated', payload);
  });

  // 5. Override i18n module (deep merge + overwrite)
  deps.i18n.addResourceBundle('en', 'user-management', { title: 'Client A Users' }, true, true);
}
```

Aturan: extension **tidak boleh** override service core (`auth`, `user`, `product`) — daftarkan nama baru `<client>.<service>`. Extension **tidak boleh** import module lewat `/entry`, hanya `@arsi/module-<name>` (public API).

Contoh hidup 3 tingkat (slot → route override → service wrapper): `web-extension-client-a` + `module-sample` — lihat §4.3–§4.5.

**Prasyarat override module X**: tambahkan alias di repo extension (sekali saja per module) —

```js
// web-extension-client-a/aliases.cjs
'@arsi/module-product-management': path.join(workspaceRoot, 'web-modules', 'modules', 'product-management', 'public.ts'),
```

```json
// web-extension-client-a/tsconfig.json → compilerOptions.paths
"@arsi/module-product-management": ["../web-modules/modules/product-management/public.ts"]
```

Tanpa ini, import `@arsi/module-<name>` di extension tidak akan resolve saat typecheck/test.

### 4.3 Slot

1. Module mendeklarasikan di `slots.ts` + mengekspor di `public.ts` + memakai `useSlot` di komponennya.
2. Extension mengisi di `init`:

```tsx
deps.slots.register(userSlots.userTableActions, AuditButton);
```

Komponen slot menerima props yang disepakati module (contoh: `{ user }`, `{ product }`). Satu slot hanya boleh diisi sekali.

Contoh hidup: `web-extension-client-a/src/components/ClientASamplePanel.tsx` mengisi `sampleSlots.overviewPanel` milik `module-sample`.

### 4.4 Route

```ts
// override halaman penuh
deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });

// tambah route baru (wajib meta.module)
deps.routes.add({
  path: '/users/:id/audit',
  element: <ClientAUserAudit />,
  meta: { group: 'user', module: 'user-management' },
});
```

`override` untuk path yang belum diregistrasi module akan **throw** — urutan boot menjamin module init sebelum extension, jadi pastikan path-nya benar. Jangan lupa sertakan `meta` (override mengganti seluruh entry).

Contoh hidup: `/module-sample/extension-points` di-override oleh client-a (`web-extension-client-a/src/components/ClientAExtensionPointsPage.tsx`).

### 4.5 Service wrapper (paling berat, pakai jika slot & route tidak cukup)

```tsx
import { createUserService } from '@arsi/module-user-management';

const base = createUserService(apiRegistry.get('user'));
const wrapped = {
  ...base,
  update: async (id: number, patch: UpdateUserInput) => {
    if (!patch.email?.endsWith('@client-a.com')) {
      throw new Error('Email harus domain client-a');
    }
    return base.update(id, patch);
  },
};
```

Wrapper dipakai lewat hook milik extension sendiri; jangan mengubah instance yang diregistrasi module.

Contoh hidup: `web-extension-client-a/src/hooks/useClientASample.ts` membungkus `createSampleService(apiRegistry.get('module-sample'))` (tambah suffix, blokir ID > 3, log event).

### 4.6 i18n

- Namespace milik client untuk teks khas client: `deps.i18n.addResourceBundle('en', 'client-a', en, true, true)`.
- Override namespace module: `addResourceBundle(lng, '<module>', res, true, true)` (deep merge + overwrite).
- Jangan override namespace `common` tanpa kesepakatan.

### 4.7 Event

| Arah | Diizinkan |
| --- | --- |
| Module emit → extension listen | ✓ |
| Extension emit → module listen | ✗ (base tidak boleh tahu extension) |
| Extension emit → extension/container listen | ✓ (namespace `<client>.<entity>.<action>`) |

### 4.8 Tests extension

Wajib: test untuk override. Pola: fake `deps` + `vi.resetModules()` agar guard `initialized` tidak bocor antar test — lihat `web-extension-client-a/src/__tests__/init.test.ts`.

```ts
const { deps, slots, routes } = createFakeDeps();
const init = await loadInit(); // vi.resetModules() + dynamic import
await init(deps);
expect(slots.register).toHaveBeenCalledWith(userSlots.userTableActions, expect.anything());
```

### 4.9 Client baru dari template

Dipakai bila repo/folder `web-extension-client-<x>` **belum ada**:

1. Buat repo kosong `arsi-web-client-<x>` di GitHub org (mis. `satriolangit`).
2. Salin template dari repo base (folder client harus sibling `web-container`/`web-modules`):

   ```bash
   cd arsi-web-base
   cp -R web-extension-template web-extension-client-<x>
   rm -rf web-extension-client-<x>/node_modules
   ```

3. Sesuaikan `package.json` (`name` = `@arsi/extension-client-<x>`) dan `manifest.json`: `client` = `client-<x>` (mis. `client-bca`), `baseVersion` = tag base saat ini (exact, mis. `0.1.0`), plus `modules`/`shared`/`overrides` sesuai kebutuhan.
4. Jadikan repo Git sendiri, lalu push:

   ```bash
   cd web-extension-client-<x>
   git init -b main
   git add .
   git commit -m "feat: initial extension client-<x>"
   git remote add origin <git-url-arsi-web-client-<x>>
   git push -u origin main
   ```

   - `.git/info/exclude` di repo base (§0.3) memuat `web-extension-*/` agar folder client **tidak muncul di `git status`** base dan **tidak ikut ter-commit** ke repo base. Ignore hanya berlaku untuk file **untracked**; kalau terlanjur ter-`git add`, keluarkan dengan `git rm -r --cached web-extension-client-<x>`. Jangan pakai `git add -f`.
   - `web-extension-default/` dan `web-extension-template/` **sengaja tracked** di repo base; pola ignore tidak memengaruhi file yang sudah tracked.
   - Verifikasi: `cd ..` → `git status` harus **clean**, dan `git check-ignore -v web-extension-client-<x>/` harus menunjuk `.git/info/exclude`.

5. Build & push image client — base **tidak** dibangun ulang; script memakai base image `FROM` registry:

   ```bash
   cd web-extension-client-<x>
   ORG=<dockerhub-org> PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh
   ```

6. Dev lokal opsional (symlink `current-client` + script `dev:<client>`):

   ```bash
   cd web-extension-client-<x>
   npm ci                                 # install dependency extension
   cd ../web-container
   CLIENT=client-<x> npm run link:client  # symlink current-client -> ../web-extension-client-<x>
   # tambahkan script "dev:client-<x>" seperti dev:client-a, lalu jalankan
   ```

`ci/build-client.sh` menjalankan verifikasi extension (typecheck/test/lint) di dalam base builder image; `check:base` memastikan `baseVersion` cocok dengan base yang dipakai. Detail build/run/rollback: `DEPLOYMENT-GUIDE.md` §3–§5; walkthrough end-to-end: `ZERO-TO-DEPLOY-GUIDE.md` §4.1.

### 4.10 Menjalankan & menguji extension di lokal

```bash
# 1) arahkan container ke extension Anda
cd web-container
CLIENT=client-a npm run link:client      # symlink current-client -> ../web-extension-client-a
readlink current-client                  # pastikan benar

# 2) jalankan dev server
npm run dev:client-a                     # http://localhost:5173
```

- Perubahan hanya di `src/` extension langsung hot-reload; **restart** dev server setelah menambah module atau mengganti client (loader map & symlink statis).
- Uji extension: `cd web-extension-client-a && npm run typecheck && npm test && npm run lint`.
- Override module yang belum pernah di-import extension butuh alias `@arsi/module-<name>` di `aliases.cjs` + `tsconfig.json` extension (lihat §4.2).
- Debug cepat: `readlink web-container/current-client`; jalankan `npm run link:client-a` bila menunjuk extension yang salah.

### 4.11 Adopsi base versi baru (bump `baseVersion`)

Base dirilis sebagai tag (`<ver>`, mis. `0.2.0`). Client **tidak** otomatis ikut — adopsi eksplisit lewat PR:

1. Di repo extension, ubah `manifest.json:baseVersion` ke tag base baru (exact, tanpa `^`).
2. Jalankan verifikasi lokal: `npm run typecheck && npm run test --if-present && npm run lint`, lalu build image lokal (§10.3) — `check:base` akan gagal bila versi tidak cocok.
3. Buka PR; CI membangun ulang image client terhadap base baru. Repo base **tidak** di-checkout; client lain tidak terpengaruh sampai mereka bump sendiri.
4. Jika base membawa perubahan breaking pada public API module, koordinasikan dengan lead dev sebelum merge (CONTRACT §19.2).
5. Jangan retag base lama ke nomor baru — selalu pakai tag asli hasil rilis.

---

## 5. Konvensi Cepat

### 5.1 Naming

| Aspek | Format | Contoh |
| --- | --- | --- |
| Folder module | kebab-case | `order-management` |
| File component | PascalCase | `OrderTable.tsx` |
| File hook | `use<Name>.ts` | `useOrder.ts` |
| File service | `service.<nama>.ts` | `service.order.ts` |
| File store | `use<Name>Store.ts` | `useOrderStore.ts` |
| Slot | `<module>.<slotName>` | `order-management.orderTableActions` |
| Modal | `<module>.<action>` | `order-management.create` |
| Event | `<module>.<entity>.<action>` | `order-management.order.updated` |
| i18n namespace | `<module>` | `order-management` |
| Service | `<module>` / `<client>.<service>` | `order`, `client-a.audit` |
| Query key root | `[<module>, <entity>]` | `['order-management', 'order']` |
| Store persist key | `module:<name>` / `container:<name>` | `module:order-management` |
| Config file | `.cjs` | `aliases.cjs`, `tailwind.config.cjs` |
| File berisi JSX | `.tsx` | `index.tsx`, `OrderListPage.tsx` |

### 5.2 Import: salah → benar

| ✗ | ✓ |
| --- | --- |
| `import axios from 'axios'` di service/hook module | Hanya di `index.tsx` saat register service |
| `import { useQuery } from '@tanstack/react-query'` | `import { useQuery } from '@arsi/container'` |
| `import { toast } from 'sonner'` | `useToast()` / `deps.toast` |
| `import i18next from 'i18next'` | `useTranslation()` / `deps.i18n` |
| `import { Button } from '@arsi/shared/components/ui/button'` | `import { Button } from '@arsi/shared'` |
| `import { X } from '@arsi/module-user-management/internal'` (extension) | `import { X } from '@arsi/module-user-management'` |
| `import.meta.env.VITE_*` di module/extension | `deps.config` / `useConfig()` |
| Bikin `QueryClient` sendiri | Pakai `useQueryClient()` / `deps.queryClient` |

ESLint sudah menegakkan sebagian besar aturan ini (`no-restricted-imports` per repo).

### 5.3 Governance

| Boleh tanpa diskusi | Wajib diskusi lead dev |
| --- | --- |
| Tambah module/slot/route/service/query key/translation | Ubah public API (breaking) |
| Tambah komponen shadcn di shared | Ubah naming convention / layer rules |
| — | Override modal module dari extension |
| — | Override service core |

### 5.4 Styling & Theme

Brand: **ARSI Purple `#551AB9`**. Tabel token lengkap + aturan pakai: `CONTRACT.md` §10.4.

| Aturan | Detail |
| --- | --- |
| Warna | **Wajib token** (`bg-primary`, `text-success-strong`, dst). Dilarang hex mentah / warna Tailwind palette langsung di komponen. |
| Hover/selected | Pakai token brand: `hover:bg-primary-hover` (tombol), `bg-accent` (hover/selected surface, row tabel). |
| Status | Badge pola tint: `bg-success/10 text-success-strong border-success/20` (idem `warning`/`info`/`destructive`). Teks semantik pakai varian `-strong` agar kontras AA di light & dark. |
| Dark mode | Jangan pakai utility `dark:` di source. Semua lewat token yang flip otomatis (`web-container/src/styles/globals.css`). |
| Font | Plus Jakarta Sans self-host (`@fontsource-variable/plus-jakarta-sans`, di-import dari `globals.css`); jangan tambah `<link>` Google Fonts. |
| Ganti/tambah token | Hanya di `globals.css` (nilai) + `tailwind.preset.cjs` (mapping); test `web-container/src/styles/tokens.test.ts` wajib lulus. |
| Container | **Self-contained**: container tidak boleh import `@arsi/shared` (di-enforce ESLint `no-restricted-imports`). Shell memakai utility token langsung; komponen shared (`Card`, `Button`, dst) hanya untuk module/extension. |

---

## 6. Testing Playbook

### 6.1 Level & kewajiban

| Level | Wajib untuk |
| --- | --- |
| Unit service / query keys / store | Module |
| Kontrak `public.ts` | Module (setiap module) |
| Component render | Module (minimal 1 komponen utama) |
| Override & registrasi `init` | Extension (setiap extension) |

### 6.2 Pola 1 — service test (mock AxiosInstance)

```ts
const api = { get: vi.fn(), post: vi.fn() };
const service = createOrderService(api as unknown as AxiosInstance);
await service.list({ limit: 5 });
expect(api.get).toHaveBeenCalledWith('/orders', { params: { limit: 5, skip: 0 } });
```

### 6.3 Pola 2 — component test (mock `@arsi/container`)

```tsx
vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useSlot: () => undefined,
  useLocale: () => ({ locale: 'en' }),
}));
```

Mock hanya hook yang dipakai komponen. Untuk barrel `public.ts`, sediakan semua hook yang tersentuh (lihat `product-management/public.test.ts`). Komponen yang memakai `useNotifications`/`useToast`/`useModal` perlu stub-nya agar panggilan bisa di-assert — contoh: `user-management/components/SendNotificationButton.test.tsx`, `web-extension-client-a/src/components/AuditButton.test.tsx`.

### 6.4 Pola 3 — hook module di component test

```tsx
const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));
vi.mock('../hooks/useProduct', () => ({
  useDeleteProduct: () => ({ mutate: mutateMock, isPending: false }),
}));
```

### 6.5 Pola 4 — extension init test

Fake `deps` (cast `as unknown as Deps`) + `vi.resetModules()` + dynamic import agar guard `initialized` fresh per test. Test idempotensi: panggil `init` dua kali, pastikan registrasi hanya sekali.

### 6.6 Pola 5 — listener event container

Event container di-listen di `init`, jadi test-nya unit test fungsi listener + fake EventBus. Partial-mock `@arsi/container` agar `containerEvents` **asli** tetap terpakai (nama event ikut teruji).

```ts
vi.mock('@arsi/container', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arsi/container')>();
  return { ...actual, isDev: false };
});

const bus = { on: /* simpan handler */, emit: /* panggil handler */ } as unknown as EventBus;
registerContainerSearchListener(bus);
bus.emit(containerEvents.searchChanged, { query: 'phone' });
expect(useProductStore.getState().search).toBe('phone');
```

Lengkap: `product-management/events/containerSearch.test.ts`.

### 6.7 Catatan

- `vitest.setup.ts` web-modules memanggil RTL `cleanup()` setiap test (karena `globals: false`).
- Store test: mock `isDev` (`vi.mock('@arsi/container', () => ({ isDev: false }))`) dan `localStorage.clear()` di `beforeEach`.
- Test event container: jangan mock `containerEvents` dengan string literal — pakai `importOriginal` agar kontrak nama event ikut teruji.
- Semua test dijalankan per repo: `cd web-modules && npm test`, dst.

---

## 7. Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| `@arsi/module-*/entry` salah resolve (`.../public.ts/entry`) | Pola `/entry` harus di **atas** pola base di `aliases.cjs`/`tsconfig.json` — Vite & TypeScript memilih pola pertama yang match. |
| Test extension gagal `Cannot read properties of null (reading 'useCallback')` | Dua salinan React (komponen shared/Radix vs `react-dom` extension). Di `vitest.config.ts` extension: alias `react`/`react-dom` ke node_modules extension + `server.deps.inline` untuk `@arsi/shared` & `@radix-ui`. |
| Warning Tailwind "matching all of node_modules" | Ada `node_modules` nested di `web-modules/modules/*` (npm menaruh sebagian deps di sana). Pastikan `tailwind.config.cjs` container memuat negasi `'!../web-modules/modules/**/node_modules/**'`. |
| Warna tidak berubah saat ganti tema | Ada hex mentah atau utility `dark:` di komponen. Ganti dengan token (`bg-card`, `text-muted-foreground`, dst) — lihat §5.4. |
| Test palet/kontras gagal | `cd web-container && npm test -- src/styles/tokens.test.ts`. Update nilai di `globals.css` + mapping di `tailwind.preset.cjs`; jangan longgarkan test. |
| ESLint "Container must stay self-contained" | `web-container` import `@arsi/shared`. Container wajib self-contained; komponen shared hanya untuk module/extension. |
| Font masih system font | Import `@fontsource-variable/plus-jakarta-sans` di `globals.css` terhapus atau `fontFamily.sans` preset berubah. Jalankan `tokens.test.ts`. |
| `[apiRegistry] service "x" is not registered` | Service diregistrasi di `init` module yang belum jalan, atau salah nama. Cek urutan di `config.json` dan nama di `register`/`get`. |
| `[routes] cannot override unknown route` | Extension override path yang belum diregistrasi module. Cek path persisnya (`/users/:id`). |
| `[slots] slot "x" already has a component` | Slot diisi dua kali (atau `init` jalan dua kali tanpa guard). Pastikan guard `initialized` dan hanya satu extension mengisi. |
| Error TS "not assignable to Control<...>" pada `useForm` | Form dengan Zod `.transform()` butuh generic ke-3: `useForm<Input, unknown, Output>`. `FormField` shared sudah mendukung. |
| Test gagal "found multiple elements" | RTL tidak cleanup (globals off). Pastikan `vitest.setup.ts` memanggil `cleanup()` di `afterEach`. |
| `init` jalan dua kali saat dev | React StrictMode. Container sudah `runOnce`; module/extension tetap **wajib** punya guard `initialized`. |
| Perubahan tidak muncul setelah ganti client | Symlink `current-client` berubah → restart dev server. |
| `current-client` menunjuk extension yang salah | Salah nama `CLIENT` atau link lama tertinggal. Cek `readlink web-container/current-client`; ulangi `npm run link:client-a` / `CLIENT=<client> npm run link:client`, lalu restart dev server. |
| Engine warning saat `npm install` | Node lokal > versi target beberapa paket; aman diabaikan selama test lulus. CI/Docker memakai Node 22. |
| Mutasi DummyJSON "tidak tersimpan" | Memang simulasi (create/update/delete tidak persist). Pilot memakai strategi optimistic cache + rollback; saat backend nyata tambahkan `invalidateQueries` di `onSettled`. |
| Search Topbar tidak memfilter produk | Listener `containerEvents.searchChanged` tidak ter-register (cek `init`) atau modul product tidak aktif di `config.json`. Listen lewat konstanta, bukan string literal. |
| Duplikat paket di bundle / chunk membengkak | Library di-import lintas tree tanpa dedupe. Cek `grep node_modules/<pkg> web-container/dist/client-a/assets/*.map`; tambahkan ke `resolve.dedupe` + samakan versi (CONTRACT §1.6). |
| `Invalid hook call` / `useNavigate() may be used only in the context of a <Router>` | Ada dua salinan React atau React Router di bundle. Tambahkan library ke `resolve.dedupe` di `vite.config.ts` + `vitest.config.ts`. |
| Docker build gagal setelah tambah modul/dependency | `package.json` modul belum di-COPY atau lockfile belum di-commit. Jalankan `cd web-container && npm run check:dockerfile`. |
| Modul baru tidak ter-load (loader map) | File generated stale atau nama package tidak sesuai konvensi. Jalankan `cd web-container && npm run gen:modules`; sync test akan gagal di CI bila lupa. |
| Error "Option 'baseUrl' is deprecated" (TS 6+) | tsconfig memakai `baseUrl`. Hapus `baseUrl`, pertahankan `paths` (relatif ke tsconfig, didukung sejak TS 4.1; TS 7 menghapus `baseUrl`). |

---

## 8. Checklist PR

**Module**

- [ ] Import hanya dari layer yang diizinkan; tidak ada import module lain.
- [ ] Tidak ada akses `deps` di top-level; semua registrasi di `init(deps)`.
- [ ] `init` idempoten (guard) dan dipanggil dua kali tanpa error.
- [ ] Service berupa factory, tidak akses `deps`, tidak import React/React Query.
- [ ] Service diregistrasi di `init`, nama unik & di-namespace.
- [ ] Query key pakai factory + namespace; diekspor di `public.ts` bila dipakai extension.
- [ ] Slot/modal/event/route di-namespace; route path unik + `meta.module`.
- [ ] Event container di-listen lewat `containerEvents` di `init`; tidak listen event extension.
- [ ] Semua teks UI pakai i18n (en + id), namespace `<module>`.
- [ ] UI memakai komponen `@arsi/shared`; tidak import `components/ui/...`.
- [ ] Styling memakai token (§5.4): tanpa hex mentah / utility `dark:`; kontras mengikuti CONTRACT §10.4.
- [ ] Feedback memakai `useToast`/`useNotifications` (bukan store sendiri); `source` notifikasi di-namespace.
- [ ] Dependency baru mengikuti CONTRACT §1.6 (react tetap peer, dedupe jika lintas tree, tanpa global CSS).
- [ ] Store memakai persist key `module:<name>`; devtools via `isDev`.
- [ ] `public.ts` diperbarui; alias/tsconfig/discover/config.json ter-wiring.
- [ ] Test ditambahkan (service, query keys, store, public API, komponen).
- [ ] `typecheck`, `test`, `lint`, `check:dockerfile`, `build:client-a` lulus (build image base: `CLIENT=base npm run build:client`).

**Extension**

- [ ] Hanya default export `init(deps)`; semua registrasi di dalamnya + idempoten.
- [ ] Import module hanya dari `@arsi/module-<name>` (public API).
- [ ] Tidak override service core; service baru bernama `<client>.<service>`.
- [ ] Slot/route/modal/i18n override sesuai kesepakatan; tidak mengisi slot yang tidak dideklarasikan.
- [ ] Styling override memakai token (§5.4); tanpa hex mentah / utility `dark:`.
- [ ] Dependency baru mengikuti CONTRACT §1.6 (react tetap peer, dedupe jika lintas tree).
- [ ] Tidak listen event extension lain; tidak membuat module listen event extension.
- [ ] `manifest.json` diperbarui (client, baseVersion, modules, overrides).
- [ ] Test override ditambahkan; `typecheck`, `test`, `lint` lulus; image client terbangun via `ci/build-client.sh` (`check:base` lulus).
- [ ] `baseVersion` di-bump bila mengadopsi base versi baru (§4.11); client lain tidak ikut berubah tanpa PR mereka.
- [ ] Smoke test image lokal (`PUSH=0 PULL=0 BUILD_ID=local`) — `/config.json` sesuai env (§10.4).

---

## 9. Referensi & Contoh Hidup

### 9.1 Dokumen

- `ARCHITECTURE.md` §19 — Development Workflow (setup, tambah module/client).
- `CONTRACT.md` §20 — Review Checklist resmi.
- `CONTRACT.md` §15 — Naming conventions.
- `CONTRACT.md` §10.4 — Brand token ARSI Purple & aturan styling.
- `CONTRACT.md` §9.4 — Aturan import UI kit (termasuk container self-contained).
- `docs/DEPLOYMENT-GUIDE.md` — build image base/client, env runtime container, CI, rollback.
- `docs/VM-DEPLOYMENT-GUIDE.en.md` — deploy runtime produksi di VM Linux (Docker, TLS, update/rollback, operasional).
- `docs/phase.02-rbac-navigation.md` — rencana Fase 2: Keycloak RBAC + navigasi berbasis database.

### 9.2 Peta contoh di kode

| Ingin melihat contoh | File |
| --- | --- |
| Module CRUD lengkap (list, detail, create, edit, delete, filter, sort, pagination) | `web-modules/modules/product-management/` |
| Form RHF + Zod + validasi i18n | `product-management/schemas/productSchema.ts`, `components/ProductForm.tsx` |
| Optimistic cache + rollback | `product-management/hooks/useProduct.ts` |
| Modal dengan payload (confirm delete) | `product-management/components/ProductDeleteDialog.tsx` |
| Module sederhana + slot | `web-modules/modules/user-management/` |
| `init(deps)` module | `user-management/index.tsx`, `product-management/index.tsx` |
| Extension lengkap (slot, route override, service, event, i18n) | `web-extension-client-a/src/index.tsx` |
| Test extension (fake deps + idempotensi) | `web-extension-client-a/src/__tests__/init.test.ts` |
| Registry container (slot/route/menu/modal/event) | `web-container/src/{slots,routes,menu,modal,events}/` |
| Bootstrap & discovery | `web-container/src/bootstrap/` |
| Shared UI kit | `web-modules/shared/` |
| Reference module (demo semua dependency container: api, apiRegistry, query, zustand, toast, modal, notifications, events, slots, i18n, logger) | `web-modules/modules/module-sample/` |
| Extension 3 tingkat override (slot → route override → service wrapper) | `web-extension-client-a/src/index.tsx`, `components/ClientASamplePanel.tsx`, `components/ClientAExtensionPointsPage.tsx`, `hooks/useClientASample.ts`, `web-modules/modules/module-sample/pages/SampleExtensionPage.tsx` |
| Global search Topbar → event container → filter module | `web-container/src/layout/GlobalSearch.tsx`, `web-container/src/events/containerEvents.ts`, `product-management/events/containerSearch.ts` |
| Notifikasi bell (module/extension → container) | `web-container/src/notifications/`, `user-management/components/SendNotificationButton.tsx`, `web-extension-client-a/src/components/AuditButton.tsx` |
| Test palet & kontras token | `web-container/src/styles/tokens.test.ts` |

### 9.3 Skeleton minimal

**Module** (`web-modules/modules/order-management/`):

```
package.json          → salin dari product-management, ganti nama
index.tsx             → init(deps): i18n + service + menu + routes (bagian 3.10)
public.ts             → ekspor kontrak (bagian 3.11)
types.ts              → tipe domain
services/service.order.ts
hooks/useOrder.ts
pages/OrderListPage.tsx
i18n/{en,id}.json
```

**Extension** (`web-extension-client-<x>/`):

```
package.json + manifest.json + tsconfig.json + aliases.cjs + vitest.config.ts
src/index.tsx         → default export init(deps) (bagian 4.2)
src/components/…      → komponen khas client
src/overrides/<module>/…  → halaman override
```

Langkah paling cepat: salin module/extension pilot yang paling mirip, lalu ganti nama & isi. Jangan lupa [wiring 2 file](#312-wiring--2-file-loader-map-otomatis) untuk module baru.

---

## 10. Build Image Lokal & Smoke Test

Verifikasi paling dekat ke produksi sebelum PR: bangun image base + image client di laptop, jalankan container, cek `/config.json`. Tanpa push ke registry.

### 10.1 Prasyarat

- Docker + Docker Compose berjalan (`docker version`).
- Berada di root repo base (untuk base) / root repo extension (untuk client).
- Base dan extension memakai `ORG` yang sama agar tag lokal saling ketemu.

### 10.2 Build image base lokal

```bash
cd arsi-web-base
ORG=<dockerhub-org> VERIFY=1 PUSH=0 ./ci/build-base.sh
docker image ls | grep arsi-web-base
```

- `VERIFY=1` menjalankan typecheck/test/lint + `check:dockerfile` + build base default sebelum image dibangun (opsional; percepat dengan `VERIFY=0`).
- Hasil: `docker.io/<org>/arsi-web-base:0.1.0` dan `:0.1.0-builder` (versi dari `web-container/package.json`).
- Belum di-push — extension akan memakai image lokal ini (`PULL=0`).

### 10.3 Build image client lokal

```bash
cd arsi-web-base/web-extension-client-a
ORG=<dockerhub-org> PULL=0 PUSH=0 BUILD_ID=local ./ci/build-client.sh
docker image ls | grep arsi-web-client-a
```

- `PULL=0` = jangan tarik base dari registry (pakai image lokal hasil §10.2).
- Verifikasi (typecheck/test/lint), `check:base`, dan build Vite berjalan **di dalam** builder image.
- Hasil: `docker.io/<org>/arsi-web-client-a:local`.

### 10.4 Jalankan & smoke test

```bash
docker run -d --name arsi-local -p 8080:80 \
  -e VITE_MODULES=user-management,product-management,module-sample \
  -e VITE_API_BASE=https://dummyjson.com \
  docker.io/<org>/arsi-web-client-a:local

sleep 2
curl -s http://localhost:8080/config.json | jq .          # client + modules + apiBase
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/     # 200
curl -s http://localhost:8080/halaman/tidak-ada | grep -q '<div id="root">' && echo "SPA fallback OK"
docker logs arsi-local 2>&1 | grep Generated
docker rm -f arsi-local
```

### 10.5 Catatan

- **Negative test `check:base`** (opsional): ubah sementara `manifest.json:baseVersion` ke `9.9.9` → build gagal dengan pesan mismatch; kembalikan nilainya.
- **Apple Silicon**: image lokal dibangun untuk `linux/arm64`; CI/VM produksi umumnya `linux/amd64`. Untuk meniru produksi gunakan `docker build --platform linux/amd64` (script belum menyetel platform) atau andalkan CI.
- Selanjutnya: `DEPLOYMENT-GUIDE.md` (tag/CI/rollback) dan `VM-DEPLOYMENT-GUIDE.en.md` (deploy ke VM Linux).

---

**Document version**: 0.8.0
**Last updated**: 2026-10-03
