# Panduan Developer — Membuat Module & Extension

**Version**: 0.5.0
**Audience**: Developer `web-modules`, `web-extension-<client>`
**Dokumen terkait**: `ARCHITECTURE.md` (kenapa & bagaimana), `CONTRACT.md` (aturan keras — pelanggaran = PR ditolak)

> Panduan ini adalah jalur cepat untuk menambah **module bisnis baru** atau **extension client** dengan aman. Semua contoh diambil dari kode nyata di workspace ini (`user-management`, `product-management`, `web-extension-client-a`).

---

## Daftar Isi

1. [Setup & Peta Workspace](#1-setup--peta-workspace)
2. [Model Mental 5 Menit](#2-model-mental-5-menit)
3. [Membuat Module Baru](#3-membuat-module-baru)
4. [Membuat Extension (module-extension)](#4-membuat-extension-module-extension)
5. [Konvensi Cepat](#5-konvensi-cepat)
6. [Testing Playbook](#6-testing-playbook)
7. [Troubleshooting](#7-troubleshooting)
8. [Checklist PR](#8-checklist-pr)
9. [Referensi & Contoh Hidup](#9-referensi--contoh-hidup)

---

## 1. Setup & Peta Workspace

### 1.1 Struktur

```
arsi-web-workspace/
├── docs/                       # ARCHITECTURE.md, CONTRACT.md, panduan ini
├── web-container/              # shell: DI, routing, layout, config, registry
│   └── current-client -> ../web-extension-client-a   (symlink)
├── web-modules/                # shared/ (UI kit) + modules/<name>/ (fitur bisnis)
├── web-extension-client-a/     # override untuk client-a
└── web-extension-template/     # template untuk client baru
```

Repo **wajib bersebelahan** selama memakai path mapping.

### 1.2 Prasyarat

- Node.js 20.x (Docker/CI memakai `node:20-alpine`; `engines: ">=20"`).
- npm 10+.

### 1.3 Setup pertama kali

```bash
cd web-modules && npm install
cd ../web-container && npm run link:client-a && npm install
cd ../web-extension-client-a && npm install
```

### 1.4 Perintah harian

| Kebutuhan | Perintah |
| --- | --- |
| Dev server client-a | `cd web-container && npm run dev:client-a` (http://localhost:5173) |
| Ganti client aktif | `cd web-container && npm run link:client-a` (ulangi dev server) |
| Build client-a | `cd web-container && npm run build:client-a` → `dist/client-a/` |
| Test | `npm test` di repo mana pun (`web-modules`, `web-container`, extension) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (container & extension) |

### 1.5 Peta dokumen

| Dokumen | Isi |
| --- | --- |
| `ARCHITECTURE.md` | Filosofi, layer, boot sequence, roadmap |
| `CONTRACT.md` | Aturan keras per layer, naming, governance |
| `DEVELOPER-GUIDE.md` (ini) | Langkah praktis membuat module/extension |
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
12. Wiring container (4 file) + web-modules (2 file)
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

### 3.12 Wiring — 6 file (jangan ada yang terlewat)

| File | Yang ditambahkan |
| --- | --- |
| `web-container/aliases.cjs` | alias `@arsi/module-order-management/entry` (**WAJIB di atas** alias base) dan `@arsi/module-order-management` |
| `web-container/tsconfig.json` | 2 paths dengan nama yang sama |
| `web-container/src/bootstrap/discover.ts` | `'order-management': () => import('@arsi/module-order-management/entry')` |
| `web-container/public/config.json` | `"modules": [..., "order-management"]` |
| `web-modules/aliases.cjs` | alias (untuk vitest repo web-modules) |
| `web-modules/tsconfig.json` | paths (untuk typecheck repo web-modules) |

```js
// web-container/aliases.cjs — urutan penting!
module.exports = {
  '@arsi/module-order-management/entry': path.join(workspaceRoot, 'web-modules', 'modules', 'order-management', 'index.tsx'),
  '@arsi/module-order-management': path.join(workspaceRoot, 'web-modules', 'modules', 'order-management', 'public.ts'),
  // ...alias lain
};
```

Kenapa urutan penting: Vite mencocokkan alias sebagai prefix. Kalau alias base di atas, `@arsi/module-order-management/entry` akan menjadi `.../public.ts/entry` → error `ENOTDIR`.

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
cd ../web-container && npm run typecheck && npm test && npm run build:client-a
cd ../web-container && npm run dev:client-a
# buka http://localhost:5173 → menu Orders muncul, halaman render
```

---

## 4. Membuat Extension (module-extension)

Extension = repo `web-extension-<client>`; hanya punya **satu** entry: default export `init(deps)` di `src/index.tsx`. Container memuatnya lewat alias `@arsi/extension` (symlink `current-client`).

### 4.1 Struktur & `manifest.json`

```
web-extension-client-a/
├── package.json
├── manifest.json
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

`override` untuk path yang belum diregistrasi module akan **throw** — urutan boot menjamin module init sebelum extension, jadi pastikan path-nya benar.

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

```bash
cp -R web-extension-template web-extension-client-x   # atau clone repo template
cd web-extension-client-x
# edit: package.json (name), manifest.json (client, modules), .azure-pipelines.yml
cd ../web-container
ln -sfn ../web-extension-client-x current-client       # pola sama seperti link:client-a
```

Tips: tambahkan script `"link:client-x": "ln -sfn ../web-extension-client-x current-client"` di `web-container/package.json` agar konsisten. Lalu `npm install` di extension baru dan jalankan dev server.

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
| Build error `ENOTDIR .../public.ts/entry` | Alias `/entry` tertulis **setelah** alias base di `aliases.cjs`. Pindahkan `/entry` ke atas. |
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
| Engine warning saat `npm install` | Node lokal > versi target beberapa paket; aman diabaikan selama test lulus. CI/Docker memakai Node 20. |
| Mutasi DummyJSON "tidak tersimpan" | Memang simulasi (create/update/delete tidak persist). Pilot memakai strategi optimistic cache + rollback; saat backend nyata tambahkan `invalidateQueries` di `onSettled`. |
| Search Topbar tidak memfilter produk | Listener `containerEvents.searchChanged` tidak ter-register (cek `init`) atau modul product tidak aktif di `config.json`. Listen lewat konstanta, bukan string literal. |

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
- [ ] Store memakai persist key `module:<name>`; devtools via `isDev`.
- [ ] `public.ts` diperbarui; alias/tsconfig/discover/config.json ter-wiring.
- [ ] Test ditambahkan (service, query keys, store, public API, komponen).
- [ ] `typecheck`, `test`, `lint`, `build:client-a` lulus.

**Extension**

- [ ] Hanya default export `init(deps)`; semua registrasi di dalamnya + idempoten.
- [ ] Import module hanya dari `@arsi/module-<name>` (public API).
- [ ] Tidak override service core; service baru bernama `<client>.<service>`.
- [ ] Slot/route/modal/i18n override sesuai kesepakatan; tidak mengisi slot yang tidak dideklarasikan.
- [ ] Styling override memakai token (§5.4); tanpa hex mentah / utility `dark:`.
- [ ] Tidak listen event extension lain; tidak membuat module listen event extension.
- [ ] `manifest.json` diperbarui (client, modules, overrides).
- [ ] Test override ditambahkan; `typecheck`, `test`, `lint` lulus.

---

## 9. Referensi & Contoh Hidup

### 9.1 Dokumen

- `ARCHITECTURE.md` §19 — Development Workflow (setup, tambah module/client).
- `CONTRACT.md` §20 — Review Checklist resmi.
- `CONTRACT.md` §15 — Naming conventions.
- `CONTRACT.md` §10.4 — Brand token ARSI Purple & aturan styling.
- `CONTRACT.md` §9.4 — Aturan import UI kit (termasuk container self-contained).
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

**Extension** (`web-extension-<client>/`):

```
package.json + manifest.json + tsconfig.json + aliases.cjs + vitest.config.ts
src/index.tsx         → default export init(deps) (bagian 4.2)
src/components/…      → komponen khas client
src/overrides/<module>/…  → halaman override
```

Langkah paling cepat: salin module/extension pilot yang paling mirip, lalu ganti nama & isi. Jangan lupa [wiring 6 file](#312-wiring--6-file-jangan-ada-yang-terlewat) untuk module baru.

---

**Document version**: 0.5.0
**Last updated**: 2026-09-25
