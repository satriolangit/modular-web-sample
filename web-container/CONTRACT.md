# CONTRACT.md

**Version**: 0.1.0
**Location**: `web-container/CONTRACT.md`
**Audience**: Developer `web-container`, `web-modules`, `web-extension-client-<x>`

> Dokumen ini adalah **kontrak keras**. Semua kode di ketiga repo wajib mengikuti aturan di sini. Pelanggaran kontrak = PR ditolak.

---

## Table of Contents

1. [Layer & Dependency Rules](#1-layer--dependency-rules)
2. [Access Patterns — deps + hooks](#2-access-patterns--deps--hooks)
3. [State Management — Zustand](#3-state-management--zustand)
4. [Service Registry](#4-service-registry)
5. [Data Fetching — Axios + React Query](#5-data-fetching--axios--react-query)
6. [i18n — react-i18next](#6-i18n--react-i18next)
7. [Toast — Sonner](#7-toast--sonner)
8. [Modal — Dialog](#8-modal--dialog)
9. [UI Kit — shadcn-ui](#9-ui-kit--shadcn-ui)
10. [Tailwind](#10-tailwind)
11. [Slots](#11-slots)
12. [Routes](#12-routes)
13. [Events](#13-events)
14. [Configuration](#14-configuration)
15. [Naming Conventions](#15-naming-conventions)
16. [Versioning](#16-versioning)
17. [Testing](#17-testing)
18. [Observability](#18-observability)
19. [Governance](#19-governance)
20. [Review Checklist](#20-review-checklist)

---

## 1. Layer & Dependency Rules

### 1.1 Layer

| Layer     | Repo                         | Tanggung jawab                                                  |
| --------- | ---------------------------- | --------------------------------------------------------------- |
| Container | `web-container`              | Shell: auth, routing, layout, DI, config, API client, event bus |
| Shared    | `web-modules/shared`         | UI kit (shadcn-ui), hooks, utils                                |
| Module    | `web-modules/modules/<name>` | Fitur bisnis                                                    |
| Extension | `web-extension-client-<x>`     | Override per client                                             |

### 1.2 Dependency Matrix

| From \ To | Container  | Shared | Module     | Extension |
| --------- | ---------- | ------ | ---------- | --------- |
| Container | —          | ✗      | ✗          | ✗         |
| Shared    | ✗          | —      | ✗          | ✗         |
| Module    | ✓ (public) | ✓      | ✗          | ✗         |
| Extension | ✓ (public) | ✓      | ✓ (public) | ✗         |

**Baca:** modul boleh import container public API dan shared. Extension boleh import container, shared, dan module public API.

### 1.3 Aturan Keras

- Container **tidak boleh** import modul atau extension.
- Shared **tidak boleh** import apa pun dari layer lain.
- Modul **tidak boleh** import modul lain.
- Modul **tidak boleh** import extension.
- Extension **tidak boleh** import internal modul (hanya lewat `public.ts`).
- Extension **tidak boleh** import extension lain.

### 1.4 Public API

Setiap layer expose hanya lewat file tertentu:

| Layer                          | Public API                                                      |
| ------------------------------ | --------------------------------------------------------------- |
| Container                      | `src/public/index.ts`                                           |
| Shared                         | `shared/index.ts`                                               |
| Module                         | `modules/<name>/public.ts`                                      |
| Module entry (untuk container) | `modules/<name>/index.tsx` via generated loader map (`src/bootstrap/moduleLoaders.generated.ts`) |
| Extension                      | `src/index.tsx` (hanya default export `init(deps)`)             |

Import dari file lain di luar public API adalah **pelanggaran kontrak**.

### 1.5 Alias

| Alias                              | Resolve ke                             | Untuk siapa       |
| ---------------------------------- | -------------------------------------- | ----------------- |
| `@arsi/container`                  | `web-container/src/public`             | Modul & extension |
| `@arsi/shared`                     | `web-modules/shared`                   | Modul & extension |
| `@arsi/module-<name>` (wildcard)   | `web-modules/modules/<name>/public.ts` | Extension         |
| `@arsi/module-<name>/entry` (wildcard) | `web-modules/modules/<name>/index.tsx` | Container (generated loader map) |
| `@arsi/extension`                  | `web-container/current-client/src`     | Container         |

**Aturan:**

- Extension **wajib** pakai `@arsi/module-<name>` (public API).
- Container memakai `@arsi/module-<name>/entry` **hanya** dari file generated; menambah alias/paths per modul **dilarang**.
- Pola `/entry` **wajib** di atas pola base di `aliases.cjs`/`tsconfig.json` — Vite & TypeScript memilih pola pertama yang match.
- Import relatif lintas modul **dilarang**.

### 1.6 Dependency Policy (library/package)

**Kepemilikan package** — install di repo pemiliknya; container **tidak** meng-install dependency modul/extension (Vite me-resolve dari tree asal file).

| Package dipakai oleh | Install di | Contoh |
| --- | --- | --- |
| Container/shell saja | `web-container` | radix dialog, sonner |
| UI kit (modul + extension) | `web-modules/shared` | radix, lucide, CVA |
| Fitur modul | `web-modules` workspace | `cd web-modules && npm install <pkg> -w @arsi/module-<name>` |
| Khusus client | `web-extension-client-<x>` | axios, react-router-dom |

**Aturan keras:**

- `react`/`react-dom` **wajib** `peerDependencies`; dilarang jadi `dependencies` di shared/modul/extension.
- Library yang di-import lebih dari satu tree (container ↔ modul/extension) **wajib** masuk `resolve.dedupe` di `web-container/vite.config.ts`; versi disamakan (sumber versi = container).
- Library berbasis React context/singleton (router, form, theme, query, state) **wajib** single copy.
- Dilarang menambah library yang menduplikasi kapabilitas container: toast, modal, notifikasi, i18n, React Query, HTTP client, event bus.
- Modul/extension **dilarang** punya Tailwind/PostCSS config; plugin Tailwind hanya di `shared/tailwind.preset.cjs`.
- Global CSS dari library **dilarang** di-import dari modul; import hanya di `web-container/src/styles/globals.css`.
- Dockerfile base ada di **root repo base** (`arsi-web-base` = `web-container` + `web-modules` + `web-extension-default` + `web-extension-template`); package workspace baru (modul) → tambah `COPY <package.json>` di Dockerfile root, jalankan `npm run check:dockerfile` di `web-container` (guard memvalidasi Dockerfile root, termasuk `web-extension-default/package.json`); lockfile **wajib** di-commit.
- Repo extension **tidak** menambah `COPY` modul — build memakai base builder image (`/app/extension`, symlink `current-client -> ../extension`); extension **wajib** pin `manifest.json.baseVersion` exact ke versi base (dicek `npm run check:base` saat build image client).

**Verifikasi wajib saat menambah dependency:**

1. `typecheck` + `lint` + `test` + `npm run build` lulus (semua package terdampak).
2. Tidak ada duplikat di bundle: `grep node_modules/<pkg> web-container/dist/client-a/assets/*.map` → 1 root.
3. Ukuran chunk tidak membengkak tanpa alasan (diff sebelum/sesudah).

**Governance (diskusi lead dev):** lisensi (GPL/AGPL), ukuran bundle, status maintenance, hasil `npm audit`, dukungan React 19, format ESM/tree-shakeable, dan side-effect global.

### 1.7 Generated Loader Map

- `web-container/src/bootstrap/moduleLoaders.generated.ts` **di-generate** oleh `scripts/generate-module-loaders.mjs` dari `web-modules/modules/*/package.json` (field `name`).
- File generated **wajib** di-commit dan **dilarang** diedit manual; regenerate via `npm run gen:modules` (otomatis lewat pre-hooks `predev`, `pretypecheck`, `pretest`, `prebuild`).
- Konvensi nama: folder = nama di `config.modules` = suffix `name` package (`@arsi/module-<folder>`); mismatch membuat script gagal.
- `discover.ts` hanya mengonsumsi map — menambah modul **tidak** mengubah `discover.ts`, `aliases.cjs`, atau `tsconfig.json`.
- Sync test (`moduleLoaders.generated.test.ts`) **wajib** lulus — menjamin file generated tidak stale.
- Dev server perlu restart setelah menambah modul (loader map statis, bukan glob).

---

## 2. Access Patterns — deps + hooks

### 2.1 Kapan Pakai `deps`, Kapan Pakai Hooks

| Konteks                           | Pakai                   |
| --------------------------------- | ----------------------- |
| `init(deps)` — di luar React tree | `deps`                  |
| Event listener di `init`          | `deps`                  |
| Route definition di `init`        | `deps`                  |
| Slot registration di `init`       | `deps`                  |
| Service registration di `init`    | `deps`                  |
| Modal registration di `init`      | `deps`                  |
| Component body                    | hooks                   |
| Custom hook                       | hooks                   |
| Utility function                  | parameter, bukan import |

### 2.2 Isi `deps` Bag

```ts
deps = {
  config, // AppConfig
  logger, // Logger
  api, // Axios default instance
  apiRegistry, // Service registry
  events, // EventBus
  i18n, // i18next instance
  queryClient, // TanStack QueryClient
  toast, // Toast service
  modal, // Modal service
  notifications, // Notification service (bell header)
  slots, // Slot registry
  routes, // Route registry
  menu, // Menu registry
};
```

### 2.3 Hooks yang Tersedia

Semua hooks di-export dari `@arsi/container`:

```ts
import {
  // Config & logging
  useConfig,
  useLogger,

  // HTTP
  useApi,
  useApiRegistry,

  // Events
  useEventBus,

  // State
  useAuthStore,
  useThemeStore,
  useLocaleStore,

  // i18n
  useTranslation,

  // Server state
  useQueryClient,
  useQuery,
  useMutation,

  // UI
  useToast,
  useModal,
  useNotifications,
  useSlot,

  // Auth
  useAuth,
} from "@arsi/container";
```

### 2.4 Anti-pattern

```ts
// ❌ Jangan — akses deps di top-level module
import { deps } from "@arsi/container";
const client = deps.queryClient; // dieksekusi saat module load
```

```ts
// ✅ Benar — akses di dalam function/hook
function useUsers() {
  const queryClient = useQueryClient();
  // ...
}
```

---

## 3. State Management — Zustand

### 3.1 Tiga Jenis Store

| Store     | Pemilik   | Contoh              | Persist  |
| --------- | --------- | ------------------- | -------- |
| Global    | Container | auth, theme, locale | Ya       |
| Module    | Modul     | `useUserStore`      | Opsional |
| Extension | Extension | `useClientAStore`   | Opsional |

### 3.2 Aturan

- Setiap modul **wajib** punya store sendiri untuk state modul.
- Modul **tidak boleh** akses store modul lain.
- Cross-module communication lewat **event bus**, bukan shared store.
- Extension **boleh** akses global store via hook container.
- Extension **boleh** akses module store via hook yang di-expose modul di `public.ts`.
- Persist key **wajib** di-namespace: `<layer>:<name>`.

### 3.3 Pattern Modul

```ts
// modules/user-management/store/useUserStore.ts
import { create } from "zustand";

interface UserState {
  selectedId: string | null;
  select: (id: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
}));
```

Export di `public.ts`:

```ts
export { useUserStore } from "./store/useUserStore";
```

Extension pakai:

```ts
import { useUserStore } from "@arsi/module-user-management";

function ClientAComponent() {
  const selectedId = useUserStore((s) => s.selectedId);
}
```

### 3.4 Kapan Pakai Zustand vs React Query

| Data                                 | Pakai                         |
| ------------------------------------ | ----------------------------- |
| Server data (list, detail)           | React Query                   |
| UI state (modal open, selected item) | Zustand                       |
| Form state                           | Local state / react-hook-form |
| Auth, theme, locale                  | Zustand global                |
| Session data                         | Zustand + persist             |

**Rule:** kalau data datang dari API, pakai React Query. Kalau state UI murni, pakai Zustand.

### 3.5 DevTools

Aktifkan `devtools` middleware di dev, matikan di production.

---

## 4. Service Registry

### 4.1 Konsep

Container menyediakan:

- **`deps.api`** — axios instance default, tanpa baseURL spesifik.
- **`deps.apiRegistry`** — registry untuk service dengan config berbeda.

Service registry berguna untuk:

- Scoped baseURL per service (path-based nginx).
- Config per service (timeout, retry, headers).
- Circuit breaker per service (nanti).
- Observability per service (nanti).

### 4.2 Kapan Pakai `api` vs `apiRegistry`

| Kebutuhan                          | Pakai              |
| ---------------------------------- | ------------------ |
| Endpoint sederhana, satu baseURL   | `deps.api`         |
| Service dengan baseURL berbeda     | `deps.apiRegistry` |
| Service dengan config berbeda      | `deps.apiRegistry` |
| Service yang di-register extension | `deps.apiRegistry` |

### 4.3 Register Service

Modul register service di `init(deps)`:

```ts
// modules/user-management/index.ts
import axios from "axios";

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
import axios from "axios";

export default async function init(deps) {
  const auditClient = axios.create({
    baseURL: "/api/audit-client-a",
    timeout: 5000,
  });
  deps.apiRegistry.register("client-a.audit", auditClient);
}
```

### 4.4 Pakai Service

```ts
// Di init(deps)
const user = await deps.apiRegistry.get("user").get("/users/1");
```

```tsx
// Di component
const apiRegistry = useApiRegistry();
const user = await apiRegistry.get("user").get("/users/1");
```

### 4.5 Aturan

- Nama service **wajib** unik. Kalau duplikat, `register` throw error.
- Nama service **wajib** di-namespace: `<module>` atau `<client>.<service>`.
- Service core (`auth`, `user`) **wajib** diregister base.
- Extension **tidak boleh** override service core.
- Register **wajib** di `init(deps)`, bukan di component atau top-level module.
- Service **wajib** pakai path-based URL (`/api/<service>`), bukan domain penuh.

### 4.6 Naming Convention

| Service              | Pemilik                  | Nama                 |
| -------------------- | ------------------------ | -------------------- |
| Auth                 | Container                | `auth`               |
| User management      | Modul `user-management`  | `user`               |
| Order management     | Modul `order-management` | `order`              |
| Audit (client A)     | Extension client-a       | `client-a.audit`     |
| Reporting (client A) | Extension client-a       | `client-a.reporting` |

### 4.7 Anti-pattern

```ts
// ❌ Register di top-level module
import axios from "axios";
deps.apiRegistry.register("user", axios.create({ baseURL: "/api/user" }));

// ❌ Pakai domain penuh
deps.apiRegistry.register(
  "user",
  axios.create({ baseURL: "https://user.api.example.com" }),
);

// ❌ Override service core
deps.apiRegistry.register("auth", customAuthClient);

// ✅ Benar — register di init
async function init(deps) {
  deps.apiRegistry.register("user", axios.create({ baseURL: "/api/user" }));
}
```

---

## 5. Data Fetching — Axios + React Query

### 5.1 Pembagian Tanggung Jawab

| Layer       | Tanggung jawab                         |
| ----------- | -------------------------------------- |
| Axios       | HTTP request, interceptor, auth header |
| React Query | Cache, stale, loading/error state      |
| Service     | Gabungan axios + business logic        |
| Hook        | Bungkus service dengan React Query     |

### 5.2 Service Pattern — Factory Function

Service **wajib** berupa **factory function** yang terima axios instance sebagai parameter.

```ts
// modules/user-management/services/service.user.ts
import type { AxiosInstance } from "axios";

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
}

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

    async create(input: CreateUserInput) {
      const res = await api.post("/users/add", input);
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

### 5.3 Hook Pattern

```ts
// modules/user-management/hooks/useUser.ts
import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useApi,
  useToast,
  useTranslation,
} from "@arsi/container";
import {
  createUserService,
  type CreateUserInput,
} from "../services/service.user";
import { userKeys } from "../queryKeys";

export function useUserList(params?: { limit?: number; skip?: number }) {
  const api = useApi();
  const service = useMemo(() => createUserService(api), [api]);

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => service.list(params),
  });
}

export function useUser(id: string | number) {
  const api = useApi();
  const service = useMemo(() => createUserService(api), [api]);

  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => service.getById(id),
    enabled: !!id,
  });
}

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

### 5.4 Query Key Factory

Query key **wajib** di-namespace dan pakai factory:

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
// modules/user-management/public.ts
export { userKeys } from "./queryKeys";
```

Extension pakai:

```ts
// web-extension-client-a/src/index.tsx
import { userKeys } from "@arsi/module-user-management";

export default async function init(deps) {
  deps.events.on("client-a.audit.completed", (payload) => {
    deps.queryClient.invalidateQueries({
      queryKey: userKeys.detail(payload.userId),
    });
  });
}
```

### 5.5 QueryClient

Container init `queryClient` dan render `QueryClientProvider` di root. Modul dan extension **tidak boleh** bikin `QueryClient` sendiri.

```ts
// Container
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 5.6 Mutation

- Mutation di modul, bukan di extension.
- Extension yang butuh mutation custom, bikin hook sendiri di extension.
- Mutation **wajib** invalidate query key yang relevan.

### 5.7 Aturan

- Modul **tidak boleh** import `axios` langsung (kecuali di `init` untuk register service).
- Modul **boleh** import `useQuery`, `useMutation`, `useQueryClient` dari container.
- **Wajib** pakai `useApi`, `useApiRegistry`, `useQueryClient` dari container.
- Query key **wajib** unik per modul.
- Query key **wajib** pakai factory.
- Service **wajib** factory function.

### 5.8 Anti-pattern

```ts
// ❌ Service akses deps langsung
import { deps } from "@arsi/container";
export const userService = {
  list: () => deps.api.get("/users"),
};

// ❌ Hook pakai axios langsung
import axios from "axios";
export function useUserList() {
  return useQuery({
    queryFn: () => axios.get("/users"),
  });
}

// ❌ Bikin QueryClient sendiri
const queryClient = new QueryClient();

// ❌ Query key tidak di-namespace
useQuery({ queryKey: ["users"] });

// ✅ Benar
useQuery({ queryKey: userKeys.list(params) });
```

---

## 6. i18n — react-i18next

### 6.1 Namespace Convention

| Layer     | Namespace                  | Contoh                  |
| --------- | -------------------------- | ----------------------- |
| Container | `common`, `auth`, `errors` | `common.ok`             |
| Modul     | `<module-name>`            | `user-management.title` |
| Extension | `<module-name>` (override) | `user-management.title` |

### 6.2 Register Resource

Modul register di `init`:

```ts
deps.i18n.addResourceBundle("en", "user-management", {
  title: "Users",
  create: "Create User",
});
deps.i18n.addResourceBundle("id", "user-management", {
  title: "Pengguna",
  create: "Tambah Pengguna",
});
```

Extension override:

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

### 6.3 Pakai di Component

```tsx
import { useTranslation } from "@arsi/container";

function UserTable() {
  const { t } = useTranslation("user-management");
  return <h1>{t("title")}</h1>;
}
```

### 6.4 Aturan

- Namespace **wajib** unik per modul.
- Extension **boleh** override namespace modul.
- Extension **tidak boleh** override namespace `common` kecuali disepakati.
- Key translation **wajib** deskriptif, bukan `text1`, `text2`.
- Pesan UI **wajib** pakai i18n, bukan hardcode string.

---

## 7. Toast — Sonner

### 7.1 Default

Container expose:

```ts
deps.toast.success('User created');
deps.toast.error('Failed to create user');
deps.toast.info('Loading...');
deps.toast.custom(<CustomToast />);
```

Component:

```tsx
const toast = useToast();
toast.success("User created");
```

### 7.2 Custom per Modul

Modul boleh pakai `toast.custom()` untuk render komponen sendiri. Tidak perlu register renderer.

### 7.3 Aturan

- Toast **wajib** pakai `deps.toast` atau `useToast`, bukan `sonner` langsung.
- Extension **boleh** override dengan `toast.custom()`.
- Pesan toast **wajib** pakai i18n, bukan hardcode.

### 7.4 Notifikasi (Bell Header)

Notifikasi persisten (bell di Topbar container). Module/extension **mendorong** notifikasi; container merender.

```ts
// Di init (non-React)
deps.notifications.push({ title: '...', message: '...', variant: 'info', source: 'user-management' });

// Di component
const { push, notifications, unreadCount } = useNotifications();
push({ title: t('notifications.sample.title'), variant: 'success', source: 'client-a' });
```

Bentuk data:

```ts
interface NotificationInput {
  title: string;                                  // wajib
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'error'; // default 'info'
  source?: string;                                // '<module>' | '<client>' | 'container'
}
```

Aturan:

- Notifikasi **wajib** pakai `deps.notifications` atau `useNotifications`, bukan store/event buatan sendiri.
- `source` **wajib** diisi namespace module/extension agar asal notifikasi jelas di panel.
- Judul/pesan **wajib** i18n (namespace module/extension sendiri).
- Daftar in-memory, maksimum 50 item terbaru; backend/websocket cukup memanggil `push` (tidak mengubah UI).
- Container **tidak boleh** import `@arsi/shared`; bell memakai token styling container.

---

## 8. Modal — Dialog

### 8.1 Default

Container sediakan modal service:

```ts
deps.modal.register("user-management.create", CreateUserDialog);
deps.modal.open("user-management.create", { onSuccess: () => {} });
deps.modal.close("user-management.create");
```

### 8.2 Register di `init`

```ts
async function init(deps) {
  deps.modal.register("user-management.create", CreateUserDialog);
}
```

### 8.3 Buka dari Component

```tsx
const modal = useModal();
modal.open("user-management.create", { onSuccess: () => {} });
```

### 8.4 Custom per Modul

Modul boleh register komponen modal sendiri. Container tidak peduli isinya.

### 8.5 Aturan

- Nama modal **wajib** di-namespace: `<module>.<action>`.
- Modal **wajib** register di `init`, bukan di component.
- Extension **boleh** register modal dengan nama sendiri.
- Extension **boleh** override modal modul dengan register ulang (harus disepakati lead dev).

---

## 9. UI Kit — shadcn-ui

### 9.1 Lokasi

- shadcn-ui primitives: `web-modules/shared/components/ui/`
- Composite components: `web-modules/shared/components/composite/`
- Public API: `web-modules/shared/index.ts`

### 9.2 Import

```tsx
import { Button, Input, Dialog, DataTable } from "@arsi/shared";
```

### 9.3 Tambah Komponen Baru

Jalankan CLI di `web-modules/shared`:

```bash
cd web-modules/shared
npx shadcn@latest add <component>
```

Komponen otomatis masuk ke `components/ui/`.

### 9.4 Aturan

- Modul **wajib** pakai komponen dari `@arsi/shared`.
- Modul **tidak boleh** import shadcn-ui langsung dari `components/ui/...`.
- Extension **wajib** pakai komponen dari `@arsi/shared`.
- Kalau butuh komponen baru, **tambahkan ke shared**, bukan buat di modul.
- Container **tidak boleh** import `@arsi/shared` — container self-contained (di-enforce ESLint `no-restricted-imports`). Styling shell container memakai utility token langsung.

**Pengecualian:** komponen yang sangat spesifik modul (misal `UserTable`) boleh di modul.

---

## 10. Tailwind

### 10.1 Config

- Preset: `web-modules/shared/tailwind.preset.cjs`
- Config: `web-container/tailwind.config.cjs` extends preset
- CSS variables: `web-container/src/styles/globals.css`

### 10.2 Content

```js
content: [
  "./index.html",
  "./src/**/*.{ts,tsx}",
  "./current-client/src/**/*.{ts,tsx}",
  "../web-modules/shared/**/*.{ts,tsx}",
  "../web-modules/modules/**/*.{ts,tsx}",
];
```

### 10.3 Aturan

- Theme (warna, radius) di CSS variables container.
- Modul **tidak boleh** define Tailwind config sendiri.
- Extension **tidak boleh** define Tailwind config sendiri.
- Kalau butuh utility baru, tambahkan ke preset shared.

### 10.4 Brand Token — ARSI Purple

Brand color: **`#551AB9`** (deep/royal purple). Nilai token hanya boleh diubah di `globals.css`.

| Peran                           | Light     | Dark      |
| ------------------------------- | --------- | --------- |
| Primary (aksi/aktif/fokus)      | `#551AB9` | `#A78BFA` |
| Primary hover                   | `#3D0F8A` | `#B9A5FC` |
| Primary light (aksen)           | `#8B5CF6` | `#A78BFA` |
| Accent (hover/selected surface) | `#F3EEFC` | `#2A2340` |
| Background                      | `#F8F9FB` | `#13111C` |
| Surface (card/popover)          | `#FFFFFF` | `#1E1B2E` |
| Border                          | `#E5E7EB` | `#2D2A3D` |
| Text primary / secondary        | `#1F2937` / `#6B7280` | `#F3F4F6` / `#9CA3AF` |
| Success / Warning / Info / Danger | `#16A34A` / `#F59E0B` / `#0EA5E9` / `#DC2626` | idem |

Aturan pakai:

- Token semantik punya varian `-strong` (`text-success-strong`, dst): lebih gelap di light, lebih terang di dark — utility class sama, otomatis benar di dua tema.
- Badge status memakai pola tint: `bg-success/10 text-success-strong border-success/20`.
- Hindari `text-muted-foreground` di atas `bg-muted` (kontras marginal 4.39:1).
- Focus visible: `ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Jangan pakai utility `dark:` di app source — tema hanya lewat token yang flip.
- Font: Plus Jakarta Sans (self-host `@fontsource-variable/plus-jakarta-sans`, di-import dari `globals.css`).
- Kontras & palet dijaga test `web-container/src/styles/tokens.test.ts` (palet ±1 channel + 21 pasangan WCAG).

---

## 11. Slots

### 11.1 Definisi

Slot adalah **extension point** yang di-expose modul. Extension bisa isi slot dengan komponen sendiri.

### 11.2 Modul Define Slot

```ts
// modules/user-management/slots.ts
export const userSlots = {
  userTableActions: "user-management.userTableActions",
  userDetailSidebar: "user-management.userDetailSidebar",
} as const;
```

### 11.3 Modul Pakai Slot

```tsx
import { useSlot } from "@arsi/container";
import { userSlots } from "../slots";

function UserTable() {
  const ExtraActions = useSlot(userSlots.userTableActions);
  return <>{ExtraActions && <ExtraActions user={row} />}</>;
}
```

### 11.4 Extension Isi Slot

```ts
// web-extension-client-a/src/index.tsx
import { userSlots } from "@arsi/module-user-management";

export default async function init(deps) {
  deps.slots.register(userSlots.userTableActions, AuditButton);
}
```

### 11.5 Aturan

- Nama slot **wajib** di-namespace: `<module>.<slotName>`.
- Slot **wajib** di-declare di `slots.ts` modul dan di-export di `public.ts`.
- Extension **tidak boleh** isi slot yang tidak di-declare.
- Extension **tidak boleh** register slot yang sama dua kali.
- Slot **wajib** register di `init(deps)`.

---

## 12. Routes

### 12.1 Add Route (dari Modul)

```ts
deps.routes.add({
  path: '/users',
  element: <UserTable />,
  meta: { group: 'user', module: 'user-management' },
});
```

### 12.2 Override Route (dari Extension)

```ts
deps.routes.override('/users/:id', {
  element: <ClientAUserDetail />,
});
```

### 12.3 Add Route (dari Extension)

```ts
deps.routes.add({
  path: '/users/:id/audit',
  element: <ClientAUserAudit />,
  meta: { group: 'user', module: 'user-management' },
});
```

### 12.4 Aturan

- Route path **wajib** unik. Kalau duplikat, error.
- Extension **boleh** override route modul.
- Extension yang meng-override route milik module **opsional** **wajib** memeriksa `routes.has(path)` lebih dulu (lewati + `logger.warn` bila belum ada) atau memastikan module tersebut aktif di `config.modules`; override route tak dikenal tetap **throw** di registry.
- Extension **boleh** tambah route baru.
- Route baru **wajib** punya `meta.module` untuk tracking.
- Route path **wajib** konsisten dengan prefix modul.
- Route **wajib** register di `init(deps)`.

---

## 13. Events

### 13.1 Event Bus

```ts
deps.events.on("user-management.user.updated", (payload) => {
  /* ... */
});
deps.events.emit("user-management.user.updated", { id: 1 });
```

Container → module (contoh: global search di Topbar):

```ts
// Container component
const events = useEventBus();
events.emit("container.search.changed", { query: "phone" });

// Module init
deps.events.on<ContainerSearchPayload>(containerEvents.searchChanged, ({ query }) => {
  useProductStore.getState().setSearch(query);
});
```

Konstanta (`containerEvents`) dan tipe payload (`ContainerSearchPayload`) di-export dari `@arsi/container`.

### 13.2 Naming Convention

| Layer     | Format                         | Contoh                         |
| --------- | ------------------------------ | ------------------------------ |
| Container | `container.<entity>.<action>`  | `container.search.changed`     |
| Modul     | `<module>.<entity>.<action>`   | `user-management.user.updated` |
| Extension | `<client>.<entity>.<action>`   | `client-a.audit.requested`     |

### 13.3 Aturan

- Event name **wajib** di-namespace.
- Modul **boleh** emit event yang tidak ada listener.
- Extension **boleh** listen event modul.
- Modul **tidak boleh** listen event extension.
- Container **boleh** emit event; modul/extension **boleh** listen event container.
- Container **tidak boleh** listen event modul/extension (base tidak depend ke atas).
- Base **tidak boleh** depend ke event extension.
- Event listener **wajib** register di `init(deps)`, bukan di top-level module.

---

## 14. Configuration

### 14.1 Sumber Config

| Environment | Sumber                                                  |
| ----------- | ------------------------------------------------------- |
| Dev lokal   | dev server env-driven (selaras production); `public/config.json` = fallback |
| Production  | `/config.json` di-generate entrypoint dari env variable (`VITE_*`, termasuk `registryAdminUrl` dari `VITE_REGISTRY_ADMIN_URL`; override penuh via `VITE_CONFIG_JSON`) |

### 14.2 Struktur Config

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

### 14.3 Aturan

- Container **wajib** load config dari `/config.json` saat boot, sebelum bootstrap.
- Container **wajib** fetch dengan `cache: 'no-store'`.
- Modul dan extension **tidak boleh** fetch `/config.json` sendiri.
- Modul dan extension akses config via `deps.config` atau `useConfig()`.
- Env variable **tidak boleh** dipakai di modul/extension (`import.meta.env.VITE_*` dilarang).
- `VITE_CONFIG_JSON` **boleh** dipakai di production untuk override penuh `config.json` (object JSON; env individual diabaikan bila diisi). Ini env **runtime container**, bukan `import.meta.env` — larangan env di modul/extension tetap berlaku.
- Config **wajib** punya default fallback agar app bisa boot saat gagal fetch.
- Module core `registry-admin` menyediakan route `/system/modules`; semua aksi manajemen module (upload, enable/disable, delete) **wajib** token service (`ADMIN_TOKEN`) via header `Authorization: Bearer` — visibilitas route bukan kontrol akses (RBAC menyusul di `phase.02-rbac-navigation.md`).

---

## 15. Naming Conventions

| Aspek                  | Format                               | Contoh                                    |
| ---------------------- | ------------------------------------ | ----------------------------------------- |
| Repo                   | kebab-case                           | `web-container`, `web-extension-client-a` |
| Folder modul           | kebab-case                           | `user-management`                         |
| File component         | PascalCase                           | `UserTable.tsx`                           |
| File hook              | camelCase, prefix `use`              | `useUser.ts`                              |
| File service           | `service.<name>.ts`                  | `service.user.ts`                         |
| File store             | `use<Name>Store.ts`                  | `useUserStore.ts`                         |
| File slot              | `slots.ts`                           | —                                         |
| File query keys        | `queryKeys.ts`                       | —                                         |
| File public API        | `public.ts`                          | —                                         |
| Config file (CommonJS) | `.cjs`                               | `aliases.cjs`, `tailwind.config.cjs`      |
| File dengan JSX        | `.tsx`                               | `bootstrap.tsx`, `AppShell.tsx`           |
| Route path             | kebab-case                           | `/users/:id`                              |
| Slot name              | `<module>.<slotName>`                | `user-management.userTableActions`        |
| Modal name             | `<module>.<action>`                  | `user-management.create`                  |
| Event name             | `<module>.<entity>.<action>`         | `user-management.user.updated`            |
| i18n namespace         | `<module>`                           | `user-management`                         |
| Service name           | `<module>` atau `<client>.<service>` | `user`, `client-a.audit`                  |
| Query key root         | `[<module>, <entity>]`               | `['user-management', 'user']`             |
| Store persist key      | `<layer>:<name>`                     | `module:user-management`                  |
| Repo base              | `arsi-web-base`                      | `arsi-web-base`                           |
| Repo client            | `arsi-web-client-<x>`                | `arsi-web-client-bca`                     |
| Client id (`manifest`) | `client-<x>`                         | `client-bca`                              |
| Docker image           | `<org>/arsi-web-base` (base), `<org>/arsi-web-<client>` (client) | `<org>/arsi-web-base`, `<org>/arsi-web-client-bca` |
| Docker image tag       | `<ver>` (runtime), `<ver>-builder` (builder) | `0.1.0`, `0.1.0-builder`                  |

---

## 16. Versioning

### 16.1 Versi

- Container: semver
- Shared: semver
- Modul: semver
- Extension: semver per client

### 16.2 Manifest Extension

```json
{
  "client": "client-a",
  "baseVersion": "0.1.0",
  "modules": {
    "user-management": "^0.1.0"
  },
  "shared": "^0.1.0",
  "overrides": ["user-management"]
}
```

### 16.3 Aturan

- Breaking change di public API modul = major version.
- Breaking change di shared = major version.
- Extension **wajib** declare `baseVersion` (pin exact ke `web-container/package.json:version` — sekarang `0.1.0`) dan `modules`.
- Build image client **wajib** menjalankan `npm run check:base` di builder image; mismatch `baseVersion` = build gagal.

---

## 17. Testing

### 17.1 Level

| Level          | Fokus                           |
| -------------- | ------------------------------- |
| Unit modul     | Service, hook, store, component |
| Unit extension | Override, slot, komponen        |
| Integration    | Modul + extension di container  |
| Contract       | Public API modul                |

### 17.2 Aturan

- Modul **wajib** punya test untuk public API.
- Extension **wajib** punya test untuk override.
- Contract test **wajib** untuk setiap modul yang di-override.

---

## 18. Observability

### 18.1 Error Report

Setiap error report **wajib** berisi:

| Field            | Sumber            |
| ---------------- | ----------------- |
| `client_id`      | Build metadata    |
| `app_version`    | Build metadata    |
| `module_name`    | Error context     |
| `module_version` | Build metadata    |
| `correlation_id` | Frontend generate |
| `route`          | Router            |
| `stack`          | Error             |

### 18.2 Correlation ID

Setiap HTTP request **wajib** membawa:

- `X-Request-Id` — unik per HTTP request.
- `X-Correlation-Id` — sama untuk satu user journey.

---

## 19. Governance

### 19.1 Yang Boleh Diubah Tanpa Diskusi

- Tambah komponen shadcn-ui di shared.
- Tambah modul baru.
- Tambah slot di modul.
- Tambah translation.
- Tambah route di modul.
- Tambah service di modul.
- Tambah query key di modul.

### 19.2 Yang Butuh Diskusi Lead Dev

- Ubah public API modul (breaking).
- Ubah shared public API (breaking).
- Ubah container public API.
- Ubah naming convention.
- Ubah layer rules.
- Tambah layer baru.
- Override modal modul dari extension.
- Override service core.

### 19.3 Yang Dilarang

- Modul import modul lain.
- Extension import internal modul.
- Container import modul/extension.
- Modul akses store modul lain.
- Extension override global store tanpa diskusi.
- Service akses `deps` langsung.
- Modul bikin `QueryClient` sendiri.
- Register service di top-level module.
- Subscribe event di top-level module.
- Akses `deps` di top-level module.
- Import `axios`, `sonner`, `i18next` langsung di modul/extension.

---

## 20. Review Checklist

Sebelum merge PR:

- [ ] Import hanya dari public API layer yang diizinkan.
- [ ] Tidak ada akses `deps` di top-level module.
- [ ] Tidak ada import `sonner`, `i18next`, `axios` langsung (kecuali di `init` untuk register service).
- [ ] Import `@tanstack/react-query` hanya `useQuery`, `useMutation`, `useQueryClient`.
- [ ] Tidak ada import `components/ui/...` langsung — pakai `@arsi/shared`.
- [ ] Service berupa factory function, bukan singleton.
- [ ] Service tidak akses `deps` langsung.
- [ ] Query key pakai factory, di-namespace.
- [ ] Query key factory di-export di `public.ts` kalau extension perlu invalidate.
- [ ] Service baru diregister di `init(deps)`, bukan di top-level.
- [ ] Nama service di-namespace dan unik.
- [ ] Service pakai path-based URL, bukan domain penuh.
- [ ] Service core tidak di-override.
- [ ] Slot name di-namespace.
- [ ] Modal name di-namespace.
- [ ] Event name di-namespace.
- [ ] Translation pakai i18n, bukan hardcode.
- [ ] Route path unik.
- [ ] Tidak ada circular dependency.
- [ ] Public API di-update kalau ada perubahan.
- [ ] Test ditambahkan.
- [ ] Config file pakai `.cjs`.
- [ ] File dengan JSX pakai `.tsx`.
- [ ] `init(deps)` idempoten (bisa dipanggil dua kali tanpa error).

---

**Document version**: 0.7.5
**Last updated**: 2026-10-06

**Changelog:**

- **0.7.5** — §12.4: extension yang meng-override route module opsional wajib guard `routes.has` (lewati + warn) atau pastikan module aktif; config dev memakai base `public/config.json` (env menimpa per-field).
- **0.7.4** — Module registry admin: config `registryAdminUrl` (`VITE_REGISTRY_ADMIN_URL`), module core `registry-admin` (route `/system/modules`, aksi butuh token service) + panduan `MODULE-REGISTRY-GUIDE.md`; §14.1/§14.3 diperbarui.
- **0.7.3** — Dev env-driven: script generik `dev`/`build` membaca symlink `current-client` (atau `VITE_CLIENT` dari `.env`); `/config.json` dev digenerate dev server dari env (mapping sama dengan production, termasuk `VITE_CONFIG_JSON`); script per-client dihapus; §14.1 diperbarui.
- **0.7.2** — Struktur repo: extension default `web-extension-base` → `web-extension-default` (package `@arsi/extension-default`); repo client `arsi-web-client-<x>` (checkout `web-extension-client-<x>`, client id `client-<x>`); `web-extension-template` menjadi bagian repo base; script `npm run link:base` untuk base. Aturan §1.6/§15 diperbarui.
- **0.7.1** — Override penuh `config.json` via env runtime `VITE_CONFIG_JSON` (entrypoint base, validasi fail-fast, env individual diabaikan bila diisi); aturan §14.1/§14.3 diperbarui.
- **0.7.0** — Base image & extension deployment: Dockerfile pindah ke root repo base (`arsi-web-base`) dengan base image multi-target (builder + runtime, Node 22 builder); extension `FROM` base image tanpa `COPY` modul; `manifest.json.baseVersion` pin exact + guard `check:base` saat build extension; aturan Docker di §1.6/§15/§16 diperbarui.
- **0.6.0** — Generated Loader Map (§1.7): map entry di-generate dari `package.json` name, alias wildcard (§1.5), sync test, pre-hooks; menambah modul tidak menyentuh `discover.ts`/alias/tsconfig.
- **0.5.0** — Dependency Policy (§1.6): kepemilikan package, aturan peer/dedupe, larangan duplikasi kapabilitas container, aturan CSS/Tailwind, Docker `check:dockerfile`, dan verifikasi duplikat bundle.
- **0.4.0** — Event container → module (`containerEvents` / `ContainerSearchPayload`), global search di Topbar sebagai sample; aturan di §13.
- **0.3.0** — Notification service (`deps.notifications` / `useNotifications`) + bell header container; aturan di §7.4.
- **0.2.0** — Brand token ARSI Purple (`#551AB9`) untuk light+dark, token semantik (`success`/`warning`/`info` + varian `-strong`), font Plus Jakarta Sans self-hosted, komponen `Card` di shared, dan aturan container self-contained (tanpa import `@arsi/shared`) di §9.4/§10.4.
- **0.1.0** — Initial contract. Mencakup 20 section: layer rules, access patterns, state management (Zustand), service registry, data fetching (Axios + React Query), i18n, toast, modal, UI kit, Tailwind, slots, routes, events, configuration, naming conventions, versioning, testing, observability, governance, dan review checklist.

---
