# Architecture Guide — Modular Web Platform

**Version**: 0.1.0
**Audience**: Developer, tech lead, arsitek
**Status**: Living document

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prinsip Desain](#2-prinsip-desain)
3. [Repo & Ownership](#3-repo--ownership)
4. [Layer Architecture](#4-layer-architecture)
5. [Boot Sequence](#5-boot-sequence)
6. [Configuration](#6-configuration)
7. [Dependency Injection — deps + hooks](#7-dependency-injection--deps--hooks)
8. [State Management](#8-state-management)
9. [Data Fetching](#9-data-fetching)
10. [Service Registry](#10-service-registry)
11. [UI Kit & Shared Components](#11-ui-kit--shared-components)
12. [Override Mechanisms](#12-override-mechanisms)
13. [i18n, Toast, Modal](#13-i18n-toast-modal)
14. [Event Bus](#14-event-bus)
15. [Path Mapping & Aliases](#15-path-mapping--aliases)
16. [Build & Deployment](#16-build--deployment)
17. [CI/CD](#17-cicd)
18. [Governance](#18-governance)
19. [Development Workflow](#19-development-workflow)
20. [Anti-patterns](#20-anti-patterns)
21. [Roadmap](#21-roadmap)

---

## 1. Overview

### 1.1 Apa yang dibangun

Platform web modular untuk **multiple client** dengan core yang stabil dan customization per client yang terisolasi.

**Karakteristik:**

- 50+ modul bisnis di masa depan
- 5+ client dengan customization masing-masing
- React 19 + Vite + TypeScript
- Backend microservice diakses via path-based routing (nginx)
- Deploy per client via CI/CD Azure DevOps

### 1.2 Mengapa modular

Tanpa modular:

- Satu perubahan client A bisa merusak client B.
- Bundle size membengkak karena semua fitur dimuat.
- Onboarding developer client baru lambat.
- Product development terganggu oleh client customization.

Dengan modular:

- Base stabil, extension terisolasi.
- Bundle selective per client.
- Onboarding cepat: clone 3 repo kecil.
- Product dan client development berjalan paralel.

### 1.3 Filosofi

| Prinsip                            | Implikasi                                          |
| ---------------------------------- | -------------------------------------------------- |
| **Container tidak tahu modul**     | Discovery-based, bukan hardcode                    |
| **Modul tidak tahu extension**     | Slot-based, bukan conditional                      |
| **Extension tahu base**            | Extension boleh import public API                  |
| **Public API sebagai kontrak**     | Setiap layer expose lewat `public.ts` / `index.ts` |
| **Config-driven**                  | URL dan module selection dari runtime config       |
| **Fail-fast**                      | Duplikasi service, slot, route → error             |
| **Satu image, banyak environment** | Runtime config, bukan build-time                   |

---

## 2. Prinsip Desain

### 2.1 Separation of Concerns

| Concern                       | Pemilik                     |
| ----------------------------- | --------------------------- |
| Shell (auth, routing, layout) | Container                   |
| UI primitives                 | Shared                      |
| Fitur bisnis                  | Modul                       |
| Client customization          | Extension                   |
| State global                  | Container (Zustand)         |
| State fitur                   | Modul (Zustand)             |
| Server state                  | React Query (via container) |
| Config                        | Container (runtime)         |

### 2.2 Dependency Direction

```
Container  →  (tidak import apa pun dari layer lain)
Shared     →  (tidak import apa pun)
Modul      →  Container (public), Shared
Extension  →  Container (public), Shared, Modul (public)
```

**Aturan:** dependency hanya boleh mengarah ke layer yang lebih rendah. Tidak ada upward dependency.

### 2.3 Isolasi Client

- Setiap client punya repo extension sendiri.
- Client A tidak bisa akses kode client B.
- Perubahan client A tidak memengaruhi client B.
- CI/CD per client independen.

### 2.4 YAGNI vs Investasi

| Fase       | Fokus                                            |
| ---------- | ------------------------------------------------ |
| Prototype  | Path mapping, module selection via config        |
| Production | Contract test, versioning, observability         |
| Scale      | Azure Artifacts, release train, package registry |

Jangan over-engineer di awal. Tapi jangan juga utang arsitektur yang susah dibayar.

---

## 3. Repo & Ownership

### 3.1 Repo Structure

```
workspace/
├── web-container/              # Shell aplikasi
├── web-modules/                # Shared + modul bisnis
├── web-extension-client-a/     # Extension client A
├── web-extension-client-b/     # Extension client B
└── web-extension-template/     # Template untuk client baru
```

**Wajib bersebelahan** selama pakai path mapping.

### 3.2 Ownership Matrix

| Repo                     | Owner                    | Kontributor                      |
| ------------------------ | ------------------------ | -------------------------------- |
| `web-container`          | Platform team / lead dev | Developer internal               |
| `web-modules`            | Platform team / lead dev | Developer internal               |
| `web-extension-<client>` | Developer client         | Bisa lihat base, tapi tidak ubah |
| `web-extension-template` | Platform team            | —                                |

### 3.3 Isi Repo

**`web-container`:**

- Bootstrap & DI
- Auth integration
- Routing host
- Layout
- API client & registry
- Query client
- i18n
- Toast, Modal
- Event bus
- Slot, Route, Menu registry
- Global store (Zustand)
- Tailwind config
- Docker + nginx
- `CONTRACT.md`

**`web-modules`:**

- `shared/` — UI kit, hooks, utils
- `modules/<name>/` — fitur bisnis
- Setiap modul punya `public.ts` sebagai kontrak

**`web-extension-<client>`:**

- `src/index.ts` — entry point `init(deps)`
- `src/components/` — komponen client-specific
- `src/overrides/<module>/` — override per modul
- `manifest.json` — declare modul & versi

**`web-extension-template`:**

- Sama dengan extension, tapi kosong
- Untuk di-clone saat bikin client baru

---

## 4. Layer Architecture

### 4.1 Layer Diagram

```
┌────────────────────────────────────────────┐
│  web-extension-<client>                    │
│  - override UI (slot)                      │
│  - override route                          │
│  - service wrapper                         │
│  - komponen client-specific                │
└─────────────────┬──────────────────────────┘
                  │ import public API
                  ▼
┌────────────────────────────────────────────┐
│  web-modules                               │
│  ┌──────────────────────────────────────┐  │
│  │ shared/ — UI kit, hooks, utils       │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ modules/<name>/ — fitur bisnis       │  │
│  └──────────────────────────────────────┘  │
└─────────────────┬──────────────────────────┘
                  │ import public API
                  ▼
┌────────────────────────────────────────────┐
│  web-container                             │
│  - shell, DI, auth, routing, layout        │
│  - instance: queryClient, i18n, store,     │
│    api, apiRegistry, eventBus, slots,      │
│    routes, menu, toast, modal              │
└────────────────────────────────────────────┘
```

### 4.2 Dependency Matrix

| From \ To | Container | Shared | Modul    | Extension |
| --------- | --------- | ------ | -------- | --------- |
| Container | —         | ✗      | ✗        | ✗         |
| Shared    | ✗         | —      | ✗        | ✗         |
| Modul     | ✓ public  | ✓      | ✗        | ✗         |
| Extension | ✓ public  | ✓      | ✓ public | ✗         |

### 4.3 Public API per Layer

| Layer     | Public API                              |
| --------- | --------------------------------------- |
| Container | `src/public/index.ts`                   |
| Shared    | `shared/index.ts`                       |
| Modul     | `modules/<name>/public.ts`              |
| Extension | `src/index.tsx` (default export `init`) |

Import di luar public API adalah pelanggaran kontrak.

---

## 5. Boot Sequence

### 5.1 Urutan

```
1. main.tsx
   ├─ loadConfig()              → fetch /config.json
   ├─ setConfig(config)         → set ke container config
   └─ bootstrap()

2. bootstrap()
   ├─ discover()
   │   ├─ moduleLoaders.generated.ts    → map name → lazy import (hasil `npm run gen:modules`)
   │   ├─ for module in config.modules:
   │   │   ├─ module.init(deps)         → register service, menu, route, i18n
   │   │   └─ module.registerModal(deps) → opsional
   │   └─ initExtension(deps)           → register slot, override route, event
   └─ createBrowserRouter(routeRegistry.getRoutes())

3. ReactDOM.createRoot().render()
   └─ <RouterProvider router={router} />
```

### 5.2 Yang Terjadi di `init(deps)`

Setiap modul dan extension punya hook `init(deps)` yang dipanggil **sekali** saat boot.

**Modul `init`:**

```ts
async init(deps) {
  // 1. Register service
  deps.apiRegistry.register('user', axios.create({ baseURL: '/api/user' }));

  // 2. Register menu
  deps.menu.register({ path: '/users', label: 'Users', order: 10 });

  // 3. Register route
  deps.routes.add({ path: '/users', element: <UserTable /> });

  // 4. Register i18n
  deps.i18n.addResourceBundle('en', 'user-management', en);

  // 5. Listen event (opsional)
  deps.events.on('user.created', (payload) => { /* ... */ });
}
```

**Extension `init`:**

```ts
export default async function init(deps) {
  // 1. Isi slot
  deps.slots.register('user-management.userTableActions', AuditButton);

  // 2. Override route
  deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });

  // 3. Register service baru (opsional)
  deps.apiRegistry.register('client-a.audit', axios.create({ baseURL: '/api/audit' }));

  // 4. Listen event modul
  deps.events.on('user-management.user.updated', (payload) => { /* ... */ });
}
```

### 5.3 Idempotensi

`init` bisa dipanggil dua kali di React 19 StrictMode. Modul harus idempoten:

- `slots.register` → throw kalau duplikat. Bungkus dengan guard atau ubah agar idempoten.
- `routes.add` → throw kalau duplikat. Sama.
- `apiRegistry.register` → throw kalau duplikat. Sama.

**Solusi:** container sediakan flag `isInitialized`. Atau modul cek `if (deps.slots.has(name)) return;`.

---

## 6. Configuration

### 6.1 Sumber Config

| Environment | Sumber                                                  |
| ----------- | ------------------------------------------------------- |
| Dev lokal   | `web-container/public/config.json`                      |
| Production  | `/config.json` di-generate entrypoint dari env variable |

### 6.2 Struktur Config

```json
{
  "client": "client-a",
  "modules": ["user-management", "product-management"],
  "apiBase": "https://dummyjson.com",
  "featureFlags": {
    "enableAuditLive": true
  }
}
```

### 6.3 Load Config

```ts
// main.tsx
async function main() {
  const config = await loadConfig();
  setConfig(config);
  const router = await bootstrap();
  ReactDOM.createRoot(...).render(<RouterProvider router={router} />);
}
```

### 6.4 Aturan

- Container **wajib** load config sebelum bootstrap.
- Modul dan extension **tidak boleh** akses `import.meta.env` langsung.
- Modul dan extension akses config via `deps.config` atau `useConfig()`.
- Config **wajib** di-fetch dengan `cache: 'no-store'`.
- Config **wajib** punya default fallback agar app bisa boot saat gagal fetch.

### 6.5 Runtime vs Build-time

| Aspek        | Build-time (`import.meta.env`) | Runtime (`/config.json`) |
| ------------ | ------------------------------ | ------------------------ |
| Kapan di-set | Build                          | Container start          |
| Image        | Per environment                | Satu untuk semua         |
| Ganti URL    | Rebuild                        | Restart container        |
| CI variable  | Sebelum build                  | Setelah build (deploy)   |

**Pilihan:** runtime config. Satu image, banyak environment.

---

## 7. Dependency Injection — deps + hooks

### 7.1 Konsep

Container sediakan instance via dua channel:

| Channel       | Kapan dipakai                        |
| ------------- | ------------------------------------ |
| `deps` object | Di `init(deps)` — di luar React tree |
| React hooks   | Di component — di dalam React tree   |

Keduanya menunjuk ke instance yang sama.

### 7.2 Isi `deps`

```ts
deps = {
  config, // AppConfig
  logger, // Logger
  api, // Axios default
  apiRegistry, // Service registry
  events, // Event bus
  i18n, // i18next instance
  queryClient, // TanStack QueryClient
  toast, // Toast service
  modal, // Modal service
  slots, // Slot registry
  routes, // Route registry
  menu, // Menu registry
};
```

### 7.3 Hooks yang Tersedia

```ts
import {
  useConfig,
  useLogger,
  useApi,
  useApiRegistry,
  useEventBus,
  useTranslation,
  useQueryClient,
  useQuery,
  useMutation,
  useToast,
  useModal,
  useSlot,
  useAuth,
  useTheme,
  useLocale,
} from "@arsi/container";
```

### 7.4 Kapan Pakai Apa

| Konteks                    | Pakai     |
| -------------------------- | --------- |
| `init(deps)`               | `deps`    |
| Event listener di `init`   | `deps`    |
| Route definition di `init` | `deps`    |
| Component body             | hooks     |
| Custom hook                | hooks     |
| Utility function           | parameter |

### 7.5 Anti-pattern

```ts
// ❌ Jangan — akses deps di top-level module
import { deps } from "@arsi/container";
const client = deps.queryClient; // dieksekusi saat module load
```

```ts
// ✅ Benar — akses di function/hook
function useUsers() {
  const queryClient = useQueryClient();
  // ...
}
```

---

## 8. State Management

### 8.1 Tiga Jenis Store

| Store     | Pemilik   | Contoh              | Persist  |
| --------- | --------- | ------------------- | -------- |
| Global    | Container | auth, theme, locale | Ya       |
| Module    | Modul     | `useUserStore`      | Opsional |
| Extension | Extension | `useClientAStore`   | Opsional |

### 8.2 Zustand Pattern

**Modul:**

```ts
// modules/user-management/store/useUserStore.ts
import { create } from "zustand";

export const useUserStore = create((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
}));
```

**Export di public API:**

```ts
// modules/user-management/public.ts
export { useUserStore } from "./store/useUserStore";
```

**Extension pakai:**

```ts
import { useUserStore } from "@arsi/module-user-management";

function ClientAComponent() {
  const selectedId = useUserStore((s) => s.selectedId);
}
```

### 8.3 Aturan

- Setiap modul **wajib** punya store sendiri untuk state modul.
- Modul **tidak boleh** akses store modul lain.
- Cross-module communication lewat **event bus**, bukan shared store.
- Extension **boleh** akses global store via hook container.
- Extension **boleh** akses module store via hook yang di-expose modul.
- Persist key **wajib** di-namespace: `<layer>:<name>`.

### 8.4 Kapan Pakai Zustand vs React Query

| Data                                 | Pakai                         |
| ------------------------------------ | ----------------------------- |
| Server data (list, detail)           | React Query                   |
| UI state (modal open, selected item) | Zustand                       |
| Form state                           | Local state / react-hook-form |
| Auth, theme, locale                  | Zustand global                |
| Session data                         | Zustand + persist             |

**Rule:** kalau data datang dari API, pakai React Query. Kalau state UI murni, pakai Zustand.

---

## 9. Data Fetching

### 9.1 Pembagian Tanggung Jawab

| Layer       | Tanggung jawab                         |
| ----------- | -------------------------------------- |
| Axios       | HTTP request, interceptor, auth header |
| React Query | Cache, stale, loading/error state      |
| Service     | Gabungan axios + business logic        |
| Hook        | Bungkus service dengan React Query     |

### 9.2 Service Pattern

Service **wajib** factory function yang terima axios instance:

```ts
// modules/user-management/services/service.user.ts
import type { AxiosInstance } from "axios";

export function createUserService(api: AxiosInstance) {
  return {
    async list({ limit = 10, skip = 0 } = {}) {
      const res = await api.get("/users", { params: { limit, skip } });
      return res.data;
    },
    async getById(id: string | number) {
      const res = await api.get(`/users/${id}`);
      return res.data;
    },
  };
}
```

**Aturan:**

- Service **tidak boleh** akses `deps` langsung.
- Service **tidak boleh** import React.
- Service **tidak boleh** import `@tanstack/react-query`.
- Service **wajib** pure — terima parameter, return data.

### 9.3 Hook Pattern

```ts
// modules/user-management/hooks/useUser.ts
import { useMemo } from "react";
import { useQuery, useApi } from "@arsi/container";
import { createUserService } from "../services/service.user";
import { userKeys } from "../queryKeys";

export function useUserList(params?: { limit?: number; skip?: number }) {
  const api = useApi();
  const service = useMemo(() => createUserService(api), [api]);

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => service.list(params),
  });
}
```

### 9.4 Query Key Factory

```ts
// modules/user-management/queryKeys.ts
export const userKeys = {
  all: ["user-management", "user"] as const,
  list: (params?: any) => [...userKeys.all, "list", params] as const,
  detail: (id: string | number) => [...userKeys.all, "detail", id] as const,
};
```

Export di `public.ts` supaya extension bisa invalidate:

```ts
export { userKeys } from "./queryKeys";
```

### 9.5 Mutation

```ts
export function useCreateUser() {
  const api = useApi();
  const service = useMemo(() => createUserService(api), [api]);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("user-management");

  return useMutation({
    mutationFn: (input: CreateUserInput) => service.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(t("create.success"));
    },
    onError: () => toast.error(t("create.error")),
  });
}
```

### 9.6 QueryClient

Container init `queryClient` dan render `QueryClientProvider` di root. Modul dan extension **tidak boleh** bikin `QueryClient` sendiri.

### 9.7 Aturan

- Modul **tidak boleh** import `axios` langsung (kecuali untuk register service di `init`).
- Modul **boleh** import `useQuery`, `useMutation`, `useQueryClient` dari container.
- Query key **wajib** pakai factory, di-namespace.
- Query key factory **wajib** di-export di `public.ts` kalau extension perlu invalidate.

---

## 10. Service Registry

### 10.1 Konsep

Container sediakan:

- **`deps.api`** — axios instance default, tanpa baseURL spesifik.
- **`deps.apiRegistry`** — registry untuk service dengan config berbeda.

### 10.2 Register Service

```ts
// modules/user-management/index.ts
async function init(deps) {
  const userClient = axios.create({
    baseURL: "/api/user",
    timeout: 8000,
  });
  deps.apiRegistry.register("user", userClient);
}
```

Extension register service baru:

```ts
// web-extension-client-a/src/index.tsx
async function init(deps) {
  const auditClient = axios.create({
    baseURL: "/api/audit-client-a",
    timeout: 5000,
  });
  deps.apiRegistry.register("client-a.audit", auditClient);
}
```

### 10.3 Pakai Service

```ts
// Di init
const user = await deps.apiRegistry.get("user").get("/users/1");

// Di component
const apiRegistry = useApiRegistry();
const user = await apiRegistry.get("user").get("/users/1");
```

### 10.4 Aturan

- Nama service **wajib** unik. Duplikat → throw.
- Nama service **wajib** di-namespace: `<module>` atau `<client>.<service>`.
- Service core (`auth`, `user`) **wajib** diregister base.
- Extension **tidak boleh** override service core.
- Register **wajib** di `init(deps)`, bukan top-level.
- Service **wajib** pakai path-based URL (`/api/<service>`), bukan domain penuh.

### 10.5 Kapan Pakai `api` vs `apiRegistry`

| Kebutuhan                          | Pakai              |
| ---------------------------------- | ------------------ |
| Endpoint sederhana, satu baseURL   | `deps.api`         |
| Service dengan baseURL berbeda     | `deps.apiRegistry` |
| Service dengan config berbeda      | `deps.apiRegistry` |
| Service yang di-register extension | `deps.apiRegistry` |

---

## 11. UI Kit & Shared Components

### 11.1 shadcn-ui di `web-modules/shared`

- shadcn-ui primitives: `shared/components/ui/`
- Composite components: `shared/components/composite/`
- Public API: `shared/index.ts`

### 11.2 Tailwind & Brand Token

- Preset: `web-modules/shared/tailwind.preset.cjs`
- Config: `web-container/tailwind.config.cjs` extends preset
- CSS variables: `web-container/src/styles/globals.css`
- Brand token ARSI Purple (`#551AB9`) + token semantik + aturan pakai: lihat CONTRACT §10.4.
- Komponen `Card` tersedia di `shared/components/ui/card.tsx` untuk modul/extension. Container tetap self-contained (tidak import `@arsi/shared`).

### 11.3 Tambah Komponen Baru

```bash
cd web-modules/shared
npx shadcn@latest add <component>
```

Komponen otomatis masuk ke `components/ui/`.

### 11.4 Aturan

- Modul **wajib** pakai komponen dari `@arsi/shared`.
- Modul **tidak boleh** import shadcn-ui langsung dari `components/ui/...`.
- Extension **wajib** pakai komponen dari `@arsi/shared`.
- Kalau butuh komponen baru, **tambahkan ke shared**, bukan buat di modul.
- Komponen sangat spesifik modul (`UserTable`) boleh di modul.
- Theme (warna, radius) di CSS variables container.
- Modul dan extension **tidak boleh** define Tailwind config sendiri.

---

## 12. Override Mechanisms

Extension bisa override modul dengan tiga tingkat. Pilih yang paling ringan.

### 12.1 Tingkat 1 — Slot (paling ringan)

Modul expose slot, extension isi.

**Modul define:**

```ts
// modules/user-management/slots.ts
export const userSlots = {
  userTableActions: "user-management.userTableActions",
  userDetailSidebar: "user-management.userDetailSidebar",
};
```

**Modul pakai:**

```tsx
import { useSlot } from "@arsi/container";

function UserTable() {
  const ExtraActions = useSlot(userSlots.userTableActions);
  return (
    <>
      {/* ... */}
      {ExtraActions && <ExtraActions user={row} />}
    </>
  );
}
```

**Extension isi:**

```ts
deps.slots.register(userSlots.userTableActions, AuditButton);
```

**Kapan pakai:** tambah UI tanpa ubah modul.

### 12.2 Tingkat 2 — Route Override (sedang)

Extension ganti halaman penuh.

```ts
deps.routes.override('/users/:id', {
  element: <ClientAUserDetail />,
});
```

**Kapan pakai:** ganti halaman penuh, ubah alur navigasi.

### 12.3 Tingkat 3 — Service Wrapper (paling berat)

Extension ganti logic dengan wrapper.

```ts
import { createUserService } from "@arsi/module-user-management";

const base = createUserService(api);
const wrapped = {
  ...base,
  updateUser: async (id, patch) => {
    if (!patch.email.endsWith("@client-a.com")) {
      throw new Error("Email harus domain client-a");
    }
    return base.updateUser(id, patch);
  },
};
```

**Kapan pakai:** ganti business rule, tambah validasi, efek samping.

### 12.4 Decision Table

| Kebutuhan             | Tingkat         |
| --------------------- | --------------- |
| Tambah kolom di tabel | Slot            |
| Ganti tombol          | Slot            |
| Ganti halaman penuh   | Route           |
| Tambah route baru     | Route           |
| Ganti validasi            | Service wrapper |

Contoh hidup ketiga tingkat: `module-sample` + `web-extension-client-a` (lihat DEVELOPER-GUIDE §4.3–§4.5).
| Tambah efek samping   | Service wrapper |
| Ganti business rule   | Service wrapper |

**Aturan:** selalu coba slot dulu. Kalau tidak bisa, route. Kalau tidak bisa, service. Jangan langsung service wrapper.

### 12.5 Aturan Naming

- Slot name: `<module>.<slotName>` — `user-management.userTableActions`
- Modal name: `<module>.<action>` — `user-management.create`
- Event name: `<module>.<entity>.<action>` — `user-management.user.updated`

---

## 13. i18n, Toast, Modal

### 13.1 i18n

**Namespace convention:**

| Layer     | Namespace                  |
| --------- | -------------------------- |
| Container | `common`, `auth`, `errors` |
| Modul     | `<module-name>`            |
| Extension | `<module-name>` (override) |

**Modul register:**

```ts
deps.i18n.addResourceBundle("en", "user-management", en);
deps.i18n.addResourceBundle("id", "user-management", id);
```

**Extension override:**

```ts
deps.i18n.addResourceBundle(
  "en",
  "user-management",
  {
    title: "Client A Users",
  },
  true,
  true,
); // deep merge, overwrite
```

**Pakai di component:**

```tsx
const { t } = useTranslation("user-management");
return <h1>{t("title")}</h1>;
```

**Aturan:**

- Namespace **wajib** unik per modul.
- Extension **boleh** override namespace modul.
- Extension **tidak boleh** override namespace `common` kecuali disepakati.
- Key translation **wajib** deskriptif.

### 13.2 Toast — Sonner

**Default:**

```ts
deps.toast.success('User created');
deps.toast.error('Failed');
deps.toast.info('Loading...');
deps.toast.custom(<CustomToast />);
```

**Custom per modul:** pakai `toast.custom()` untuk render komponen sendiri.

**Aturan:**

- Toast **wajib** pakai `deps.toast` atau `useToast`, bukan `sonner` langsung.
- Pesan toast **wajib** pakai i18n, bukan hardcode.

### 13.3 Modal — Dialog

**Register:**

```ts
deps.modal.register("user-management.create", CreateUserDialog);
```

**Buka:**

```ts
deps.modal.open("user-management.create", { onSuccess: () => {} });
// atau
const modal = useModal();
modal.open("user-management.create", { onSuccess: () => {} });
```

**Aturan:**

- Nama modal **wajib** di-namespace: `<module>.<action>`.
- Modal **wajib** register di `init`, bukan di component.
- Extension **boleh** register modal dengan nama sendiri.
- Extension **boleh** override modal modul dengan register ulang (harus disepakati).

---

## 14. Event Bus

### 14.1 Konsep

Event bus untuk cross-module communication. Container tidak tahu siapa yang listen.

### 14.2 Pattern

**Modul emit:**

```ts
deps.events.emit("user-management.user.updated", { id, changes });
```

**Extension listen:**

```ts
deps.events.on("user-management.user.updated", (payload) => {
  deps.logger.info("user updated", payload);
});
```

**Di component:**

```tsx
const events = useEventBus();
events.emit("client-a.audit.requested", { userId });
```

### 14.3 Naming Convention

| Layer     | Format                       | Contoh                         |
| --------- | ---------------------------- | ------------------------------ |
| Modul     | `<module>.<entity>.<action>` | `user-management.user.updated` |
| Extension | `<client>.<entity>.<action>` | `client-a.audit.requested`     |

### 14.4 Aturan

- Event name **wajib** di-namespace.
- Modul **boleh** emit event yang tidak ada listener.
- Extension **boleh** listen event modul.
- Modul **tidak boleh** listen event extension.
- Base **tidak boleh** depend ke event extension.

---

## 15. Path Mapping & Aliases

### 15.1 Alias Convention

| Alias                              | Resolve ke                                      |
| ---------------------------------- | ----------------------------------------------- |
| `@arsi/container`                  | `web-container/src/public`                      |
| `@arsi/shared`                     | `web-modules/shared`                            |
| `@arsi/module-*` (wildcard)        | `web-modules/modules/*/public.ts` (extension)   |
| `@arsi/module-*/entry` (wildcard)  | `web-modules/modules/*/index.tsx` (container)   |
| `@arsi/extension`                  | `web-container/current-client/src`              |

### 15.2 Wildcard Alias + Generated Loader Map

- `@arsi/module-<name>` → `public.ts` (kontrak, untuk extension) — wildcard, tidak perlu ditambah per modul.
- `@arsi/module-<name>/entry` → `index.tsx` (entry container) — dipakai **hanya** oleh `moduleLoaders.generated.ts` yang di-generate dari `package.json` `name`.
- Pola `/entry` wajib di atas pola base (Vite & TypeScript memilih pola pertama yang match).

### 15.3 Single Source of Truth

`aliases.cjs` di setiap repo. Dipakai oleh:

- `vite.config.ts` → `resolve.alias`
- `.eslintrc.cjs` → `settings.import/resolver.typescript` (membaca `paths` dari tsconfig)
- `tsconfig.json` → `paths` (manual, tidak bisa import `.cjs`)

### 15.4 Symlink `current-client`

Container punya symlink:

```
web-container/current-client → ../web-extension-<client>
```

Ganti client:

```bash
npm run link:client-a
npm run link:client-b
```

### 15.5 Aturan

- Alias **wajib** menyerupai package name (`@arsi/module-user-management`), bukan alias sederhana (`@modules/user`).
- Modul **tidak boleh** import modul lain.
- Extension **tidak boleh** import internal modul.
- `current-client` **wajib** symlink, bukan copy.

---

## 16. Build & Deployment

### 16.1 Build Local

```bash
cd web-container
ln -sfn ../web-extension-client-a current-client
npm run build:client-a
```

Output: `web-container/dist/client-a/`.

### 16.2 Docker

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN ln -sfn ../web-extension-client-a current-client || true
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist/client-a /usr/share/nginx/html
COPY docker/entrypoint.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Entrypoint** generate `/config.json` dari env variable:

```sh
#!/bin/sh
set -e
CONFIG_FILE=/usr/share/nginx/html/config.json
CLIENT="${VITE_CLIENT:-client-a}"
MODULES="${VITE_MODULES:-user-management}"
API_BASE="${VITE_API_BASE:-https://dummyjson.com}"
# ... generate JSON
cat > "$CONFIG_FILE" <<EOF
{
  "client": "$CLIENT",
  "modules": $MODULES_JSON,
  "apiBase": "$API_BASE"
}
EOF
```

### 16.3 Run Container

```bash
docker run -p 8080:80 \
  -e VITE_CLIENT=client-a \
  -e VITE_MODULES=user-management,product-management \
  -e VITE_API_BASE=https://staging-api.example.com \
  myorg-web-client-a:latest
```

### 16.4 Deployment Targets

| Environment | Image | Config Source       |
| ----------- | ----- | ------------------- |
| Staging     | Sama  | K8s ConfigMap / env |
| Production  | Sama  | K8s ConfigMap / env |

Satu image, banyak environment. Config di-inject saat container start.

---

## 17. CI/CD

### 17.1 Pipeline per Client

Setiap repo `web-extension-<client>` punya pipeline sendiri di Azure DevOps.

```yaml
trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

steps:
  - checkout: self
    path: web-extension-client-a
  - checkout: git://MyOrg/web-container
    path: web-container
  - checkout: git://MyOrg/web-modules
    path: web-modules

  - task: NodeTool@0
    inputs:
      versionSpec: "20.x"

  - script: |
      cd $(Pipeline.Workspace)/web-container
      ln -sfn ../web-extension-client-a current-client
      npm ci
      npm run build:client-a
    displayName: Build

  - task: Docker@2
    inputs:
      command: buildAndPush
      repository: myorg-web-client-a
      tags: $(Build.BuildId)

  - task: KubernetesManifest@1
    inputs:
      action: deploy
      manifests: k8s/staging.yaml
      containers: myorg.azurecr.io/myorg-web-client-a:$(Build.BuildId)
```

### 17.2 Struktur Pipeline

| Repo                     | Pipeline                                            |
| ------------------------ | --------------------------------------------------- |
| `web-container`          | Build + test container, publish base image          |
| `web-modules`            | Build + test modul, publish artifact                |
| `web-extension-<client>` | Build + test extension, build & deploy image client |
| `web-extension-template` | Tidak ada pipeline                                  |

### 17.3 Artifact

- Container: base image
- Modul: npm artifact (opsional, untuk migrasi registry nanti)
- Extension: Docker image per client

---

## 18. Governance

### 18.1 Yang Boleh Diubah Tanpa Diskusi

- Tambah komponen shadcn-ui di shared.
- Tambah modul baru.
- Tambah slot di modul.
- Tambah translation.
- Tambah route di modul.
- Tambah service di modul.
- Tambah query key di modul.

### 18.2 Yang Butuh Diskusi Lead Dev

- Ubah public API modul (breaking).
- Ubah shared public API (breaking).
- Ubah container public API.
- Ubah naming convention.
- Ubah layer rules.
- Tambah layer baru.
- Override modal modul dari extension.
- Override service core.

### 18.3 Yang Dilarang

- Modul import modul lain.
- Extension import internal modul.
- Container import modul/extension.
- Modul akses store modul lain.
- Extension override global store tanpa diskusi.
- Service akses `deps` langsung.
- Modul bikin `QueryClient` sendiri.
- Register service di top-level module.

### 18.4 Review Checklist

Sebelum merge PR:

- [ ] Import hanya dari public API layer yang diizinkan.
- [ ] Tidak ada akses `deps` di top-level module.
- [ ] Tidak ada import `sonner`, `i18next`, `axios` langsung.
- [ ] Import `@tanstack/react-query` hanya `useQuery`, `useMutation`, `useQueryClient`.
- [ ] Tidak ada import `components/ui/...` langsung.
- [ ] Service berupa factory function.
- [ ] Query key pakai factory, di-namespace.
- [ ] Service baru diregister di `init(deps)`.
- [ ] Nama service di-namespace dan unik.
- [ ] Service pakai path-based URL.
- [ ] Slot, modal, event name di-namespace.
- [ ] Translation pakai i18n.
- [ ] Route path unik.
- [ ] Tidak ada circular dependency.
- [ ] Public API di-update kalau ada perubahan.
- [ ] Test ditambahkan.

---

## 19. Development Workflow

### 19.1 Setup Awal

```bash
mkdir workspace && cd workspace

git clone <web-container-url>
git clone <web-modules-url>
git clone <web-extension-client-a-url>

cd web-container
ln -sfn ../web-extension-client-a current-client
npm install
npm run dev:client-a
```

### 19.2 Ganti Client

```bash
cd web-container
npm run link:client-b
npm run dev:client-b
```

### 19.3 Tambah Modul Baru

1. Buat folder di `web-modules/modules/<name>/` (nama folder = nama di `config.modules`).
2. Buat `package.json` (name `@arsi/module-<folder>`), `index.tsx` (default export `init(deps)`), `public.ts`.
3. Buat `routes/`, `services/`, `hooks/`, `components/`, `slots.ts`, `queryKeys.ts`, `i18n/`.
4. Jalankan `npm run gen:modules` di web-container (otomatis via pre-hooks) — loader map di-generate dari `package.json` name; **tidak ada** edit `discover.ts`/alias/tsconfig.
5. Tambah `COPY web-modules/modules/<name>/package.json ...` di Dockerfile + `npm run check:dockerfile`.
6. Tambah ke `config.modules` (dev: `public/config.json`; produksi dikelola CI).

### 19.4 Tambah Client Baru

```bash
git clone <web-extension-template-url> web-extension-client-x
cd web-extension-client-x
rm -rf .git && git init

# Edit manifest.json, package.json, .azure-pipelines.yml
# Push ke repo baru
# Setup pipeline di Azure DevOps

cd ../web-container
npm run link:client-x
VITE_CLIENT=client-x VITE_MODULES=user-management npm run dev
```

### 19.5 Override dari Extension

**Slot:**

```ts
deps.slots.register("user-management.userTableActions", AuditButton);
```

**Route:**

```ts
deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });
```

**Service wrapper:**

```ts
const base = createUserService(api);
const wrapped = {
  ...base,
  updateUser: async (id, patch) => {
    /* ... */
  },
};
```

---

## 20. Anti-patterns

### 20.1 Dependency

| ❌                              | ✅                            |
| ------------------------------- | ----------------------------- |
| Container import modul          | Container discover via config |
| Modul import modul lain         | Lewat event bus               |
| Extension import internal modul | Import dari `public.ts`       |
| Shared import container         | Shared harus pure             |
| Modul install lib lintas tree tanpa dedupe | Tambah ke `resolve.dedupe` + samakan versi (CONTRACT §1.6) |

### 20.2 State

| ❌                                  | ✅               |
| ----------------------------------- | ---------------- |
| Modul akses store modul lain        | Event bus        |
| Extension bikin QueryClient sendiri | Pakai container  |
| Query key tidak di-namespace        | Pakai factory    |
| Service akses `deps` langsung       | Factory function |

### 20.3 UI

| ❌                              | ✅                    |
| ------------------------------- | --------------------- |
| Import `components/ui/button`   | Import `@arsi/shared` |
| Bikin komponen UI di modul      | Tambah ke shared      |
| Define Tailwind config di modul | Pakai preset shared   |

### 20.4 Config

| ❌                                | ✅             |
| --------------------------------- | -------------- |
| `import.meta.env` di modul        | `deps.config`  |
| Hardcode URL                      | Runtime config |
| Config di-commit untuk production | Inject via env |

### 20.5 Init

| ❌                            | ✅                        |
| ----------------------------- | ------------------------- |
| Register service di top-level | Register di `init(deps)`  |
| Subscribe event di top-level  | Subscribe di `init(deps)` |
| Akses `deps` di top-level     | Akses di function body    |

---

## 21. Roadmap

### 21.1 Fase 1 — Fondasi (sekarang)

- ✅ 3 repo + template
- ✅ Container shell
- ✅ Modul pilot `user-management`
- ✅ Extension pilot `client-a`
- ✅ Path mapping
- ✅ Runtime config
- ✅ React 19 + shadcn-ui + Zustand + React Query

### 21.2 Fase 2 — Scale

- Modul kedua: `product-management`
- ESLint boundaries plugin
- Contract test
- Keycloak integration
- Observability (Sentry + correlation ID)
- Health check endpoint di service

### 21.3 Fase 3 — Production Hardening

- Release train bulanan
- Versioning formal
- Error handling section di kontrak
- Route override + service wrapper sample
- CI/CD template final
- Performance budget

### 21.4 Fase 4 — Long-term

- Evaluasi Azure Artifacts
- Migrasi dari path mapping ke package registry
- Micro-frontend (kalau perlu)
- Contract test otomatis di CI
- Automated dependency upgrade

---

## Appendix A — Struktur Folder Reference

### A.1 `web-container`

```
web-container/
├── aliases.cjs
├── current-client/              # symlink
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.cjs
├── postcss.config.cjs
├── .eslintrc.cjs
├── index.html
├── package.json
├── CONTRACT.md
├── Dockerfile
├── nginx.conf
├── docker/
│   └── entrypoint.sh
├── scripts/                     # generate-module-loaders + check-dockerfile-modules
├── public/
│   └── config.json
└── src/
    ├── main.tsx
    ├── vite-env.d.ts
    ├── styles/globals.css
    ├── bootstrap/
    ├── auth/
    ├── api/
    ├── i18n/
    ├── query/
    ├── toast/
    ├── modal/
    ├── events/
    ├── menu/
    ├── slots/
    ├── routes/
    ├── store/
    ├── theme/
    ├── layout/
    └── public/
```

### A.2 `web-modules`

```
web-modules/
├── aliases.cjs
├── tsconfig.json
├── package.json
├── shared/
│   ├── package.json
│   ├── components.json
│   ├── tailwind.preset.cjs
│   ├── index.ts
│   ├── lib/utils.ts
│   ├── components/
│   │   ├── ui/
│   │   └── composite/
│   └── hooks/
└── modules/
    ├── user-management/
    ├── product-management/
    └── module-sample/           # reference module (12 halaman demo dependency)
        ├── package.json         # name wajib @arsi/module-<folder>
        ├── index.tsx
        ├── public.ts
        ├── slots.ts
        ├── modals.ts
        ├── events.ts
        ├── queryKeys.ts
        ├── types.ts
        ├── services/
        ├── hooks/
        ├── store/
        ├── components/
        ├── pages/
        └── i18n/
```

### A.3 `web-extension-<client>`

```
web-extension-client-a/
├── aliases.cjs
├── tsconfig.json
├── package.json
├── manifest.json
├── .eslintrc.cjs
├── .azure-pipelines.yml
├── README.md
└── src/
    ├── index.tsx
    ├── components/
    ├── hooks/
    ├── i18n/
    └── overrides/
        └── user-management/
```

---

## Appendix B — Naming Convention Summary

| Aspek             | Format                               | Contoh                             |
| ----------------- | ------------------------------------ | ---------------------------------- |
| Repo              | kebab-case                           | `web-extension-client-a`           |
| Folder modul      | kebab-case                           | `user-management`                  |
| File component    | PascalCase                           | `UserTable.tsx`                    |
| File hook         | camelCase `use*`                     | `useUser.ts`                       |
| File service      | `service.<name>.ts`                  | `service.user.ts`                  |
| File store        | `use<Name>Store.ts`                  | `useUserStore.ts`                  |
| File query keys   | `queryKeys.ts`                       | —                                  |
| File slots        | `slots.ts`                           | —                                  |
| File public API   | `public.ts`                          | —                                  |
| Route path        | kebab-case                           | `/users/:id`                       |
| Slot name         | `<module>.<slotName>`                | `user-management.userTableActions` |
| Modal name        | `<module>.<action>`                  | `user-management.create`           |
| Event name        | `<module>.<entity>.<action>`         | `user-management.user.updated`     |
| i18n namespace    | `<module>`                           | `user-management`                  |
| Service name      | `<module>` atau `<client>.<service>` | `user`, `client-a.audit`           |
| Query key root    | `[<module>, <entity>]`               | `['user-management', 'user']`      |
| Store persist key | `<layer>:<name>`                     | `module:user-management`           |
| Docker image      | `<org>-web-<client>`                 | `myorg-web-client-a`               |

---

## Appendix C — Kontrak Cepat

### Container → Modul

- `deps` bag berisi semua instance.
- Hooks tersedia: `useApi`, `useApiRegistry`, `useEventBus`, `useTranslation`, `useQueryClient`, `useToast`, `useModal`, `useSlot`, `useConfig`, `useLogger`, `useAuth`, `useTheme`, `useLocale`.

### Modul → Extension

- `public.ts` — komponen, hook, service, route, query key, slot.
- Modul **tidak tahu** extension.

### Extension → Modul

- Import dari `@arsi/module-<name>` saja.
- Override via slot, route, service wrapper.
- Register service baru via `deps.apiRegistry.register()`.

---

**Document version**: 0.2.0
**Last updated**: 2026-09-25

**Changelog:**

- **0.1.0** — Initial architecture guide. Mencakup layer architecture, boot sequence, DI, state management, data fetching, service registry, override mechanisms, build & deployment, CI/CD, governance, dan development workflow.
