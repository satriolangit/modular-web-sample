# Developer Guide — Building Modules & Extensions

**Version**: 0.7.4
**Audience**: Developers of `web-modules`, `web-extension-<client>`
**Related documents**: `ARCHITECTURE.md` (why & how), `CONTRACT.md` (hard rules — violations = PR rejected)

> This guide is the fast path to safely add a **new business module** or a **client extension**. All examples are taken from real code in this workspace (`user-management`, `product-management`, `web-extension-client-a`).

---

## Table of Contents

1. Setup & Workspace Map
2. 5-Minute Mental Model
3. Creating a New Module
4. Creating an Extension (module-extension)
5. Quick Conventions
6. Testing Playbook
7. Troubleshooting
8. PR Checklist
9. References & Living Examples

---

## 1. Setup & Workspace Map

### 1.1 Structure

```
arsi-web-workspace/
├── Dockerfile                  # base image (multi-target: builder | runtime)
├── ci/build-base.sh            # build + push the base image
├── docs/                       # ARCHITECTURE.md, CONTRACT.md, this guide
├── web-container/              # shell: DI, routing, layout, config, registries
│   └── current-client -> ../web-extension-client-a   (symlink)
├── web-modules/                # shared/ (UI kit) + modules/<name>/ (business features)
├── web-extension-base/         # default extension (client "base") for the base image
├── web-extension-client-a/     # overrides for client-a
└── web-extension-template/     # template for new clients
```

The repos **must sit side by side** as long as path mapping is used.

### 1.2 Prerequisites

- Node.js 20.x (Docker/CI uses `node:20-alpine`; `engines: ">=20"`).
- npm 10+.

### 1.3 First-time setup

```bash
cd web-modules && npm install
cd ../web-container && npm run link:client-a && npm install
cd ../web-extension-client-a && npm install
```

### 1.4 Daily commands

| Need | Command |
| --- | --- |
| client-a dev server | `cd web-container && npm run dev:client-a` (http://localhost:5173) |
| Switch active client | `cd web-container && CLIENT=<client> npm run link:client` (or `npm run link:client-a`); restart the dev server |
| Build client | `cd web-container && CLIENT=<client> npm run build:client` → `dist/<client>/` (client-a: `npm run build:client-a`) |
| Build base (default image) | `cd web-container && CLIENT=base npm run link:client && CLIENT=base npm run build:client` → `dist/base/` |
| Tests | `npm test` in any repo (`web-modules`, `web-container`, extension) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (container & extension) |

### 1.5 Document map

| Document | Contents |
| --- | --- |
| `ARCHITECTURE.md` | Philosophy, layers, boot sequence, roadmap |
| `CONTRACT.md` | Hard rules per layer, naming, governance |
| `DEVELOPER-GUIDE.md` (this) | Practical steps to build a module/extension |
| `docs/DEPLOYMENT-GUIDE.en.md` | DevOps deployment: Docker build/run, env, CI, rollback |
| `docs/phase.02-rbac-navigation.md` | Phase 2 plan: Keycloak RBAC + database-driven navigation |

---

## 2. 5-Minute Mental Model

### 2.1 Dependency direction (must not be violated)

```
Container  ←  Module  ←  Extension
   ↑            ↑            ↑
   └──── Shared ┘────────────┘
```

| From | May import |
| --- | --- |
| Container | no other layer (except discovery in `bootstrap/discover.ts`) |
| Shared | no other layer (must stay pure) |
| Module | Container **public API**, Shared |
| Extension | Container **public API**, Shared, Module **public API** |

Forbidden: a module importing another module, an extension importing a module's internal files, the container importing a module/extension (other than discovery).

### 2.2 Two channels for accessing instances

| Context | Use |
| --- | --- |
| `init(deps)` outside the React tree | `deps` |
| Component / custom hook | hooks from `@arsi/container` |
| Utility function | parameters (do not import `deps`) |

```ts
// ❌ Don't — access deps at module top-level
import { deps } from '@arsi/container';
const client = deps.queryClient;

// ✅ Do — inside a hook/function
function useOrders() {
  const apiRegistry = useApiRegistry();
  // ...
}
```

### 2.3 State: React Query vs Zustand

| Data | Use |
| --- | --- |
| Server data (list, detail) | React Query (`useQuery`/`useMutation` from the container) |
| UI state (filter, page, selected) | the module's own Zustand store |
| Form state | React Hook Form + Zod (see `product-management`) |
| Auth, theme, locale | the container's global Zustand stores |

**Rule**: data from the API → React Query. Pure UI state → Zustand. Cross-module → event bus (not a shared store).

### 2.4 Three override levels (extension)

Always try from the lightest: **Slot → Route → Service wrapper**.

| Need | Level |
| --- | --- |
| Add a column/button in a table | Slot |
| Replace a whole page / add a route | Route |
| Replace validation / business rule | Service wrapper |

---

## 3. Creating a New Module

Case study: `order-management`. Copy the structure from `web-modules/modules/product-management/` as a complete CRUD reference, or `user-management` for a simpler version.

### 3.0 Step checklist

1. Folder + `package.json`
2. `types.ts`
3. `services/service.<name>.ts`
4. `queryKeys.ts`
5. `slots.ts`, `modals.ts`, `events.ts`
6. `store/use<Name>Store.ts`
7. `hooks/use<Name>.ts`
8. `components/` + `pages/`
9. `i18n/en.json` + `i18n/id.json`
10. `index.tsx` — `init(deps)`
11. `public.ts` — the contract
12. Wiring: the loader map is generated automatically (`npm run gen:modules`); add the COPY package.json in the `Dockerfile` at the base repo root + the `config.json` entry
13. Tests
14. Verification

### 3.1 Folder & `package.json`

```
web-modules/modules/order-management/
├── package.json
├── index.tsx          # entry init(deps) — used by the container
├── public.ts          # contract — used by extensions
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

Note: `axios` may only be imported as a **value** in `index.tsx` (to register the service). `import type { AxiosInstance }` in the service is still allowed (ESLint `allowTypeImports`).

`name` **must** follow `@arsi/module-<folder>` — validated by `npm run gen:modules` (the loader map is generated from this field).

### 3.2 `types.ts`

All module domain types. Split the list type (concise) and the detail type (complete) when the endpoint uses `select` — see `ProductListItem` vs `Product`.

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

### 3.3 `services/service.<name>.ts` — factory, not singleton

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

Service rules: a **factory function** that receives an `AxiosInstance`; does not access `deps`; does not import React / React Query; pure (parameters in, data out).

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

The root key **must** be `['<module>', '<entity>']`. The factory **must** be exported in `public.ts` when an extension needs to invalidate queries.

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

The persist key **must** be `module:<name>`. Use `isDev` from the container (modules are **forbidden** from accessing `import.meta.env`).

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

Rules: import `useQuery`/`useMutation`/`useQueryClient` **from the container**, not from `@tanstack/react-query`. Mutations must always invalidate the related query key (or do an optimistic update + rollback — see the pattern in `product-management/hooks/useProduct.ts`). Emit events from hooks via `useEventBus()`.

### 3.8 Components & pages

- **Must** use components from `@arsi/shared` (`Button`, `DataTable`, `Dialog`, `Form`, etc.). **Forbidden** to import `components/ui/...` directly.
- Components that are very specific to a module may live in the module (examples: `ProductTable`, `ProductForm`).
- Pages use `PageHeader` + state/error/empty from shared (`ErrorState`, `DataTablePagination`, `DataTable` already provide empty/loading states).
- Navigation uses `react-router-dom` directly (`useNavigate`, `useParams`, `Link`) — the current pilot convention.
- All UI text goes through i18n: `const { t } = useTranslation('<module>')`.
- User feedback: `useToast()` for transient messages; `useNotifications()` for the header bell (persistent, CONTRACT §7.4). `source` **must** be namespaced to the module/extension.

```tsx
const { push } = useNotifications();
push({ title: t('notifications.sample.title'), variant: 'info', source: 'order-management' });
```

Production forms: React Hook Form + Zod + the shared `Form`.

```tsx
const schema = useMemo(() => createOrderSchema(t), [t]);
const form = useForm<OrderFormInput, unknown, OrderFormValues>({
  resolver: zodResolver(schema),
  defaultValues: initialValues ?? EMPTY_ORDER_FORM,
});
```

The schema factory receives `t` so validation messages are i18n — see `product-management/schemas/productSchema.ts`. Important trick: numeric fields are validated as **strings** and then `.transform(Number)`; that is why `useForm` needs the third generic (input vs output).

### 3.9 `i18n/en.json` + `i18n/id.json`

Namespace = module name. Descriptive keys (not `text1`).

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
    return; // React StrictMode can invoke this twice
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

`init` rules:

- **All** registrations (service, route, menu, modal, slot, i18n, event) happen inside `init`, **never** at module top-level.
- Must be **idempotent** (guard with `initialized` + the container registries throw on true duplicates).
- Service name = `<module>` (or `<client>.<service>` for extensions), must be unique.
- For a real backend, the service baseURL **must** be path-based `/api/<service>` (CONTRACT §4.5). The DummyJSON pilot uses `deps.config.apiBase` (runtime config, no hardcoded domain).
- Modal: `deps.modal.register('<module>.<action>', Component)` — the component receives `{ payload, close }` and renders the Dialog itself (see `ProductDeleteDialog`).
- Non-React notifications: `deps.notifications.push({ title, message?, variant?, source })` — e.g. from an event listener or backend integration; `source` = `<module>`/`<client>`. Example: `web-extension-client-a/src/components/AuditButton.tsx`.
- Container events: listen to the `containerEvents` constants (payload `ContainerSearchPayload`, both from `@arsi/container`) inside `init(deps)`. Example: `product-management/events/containerSearch.ts` (Topbar global search → product filter). The container **must not** listen to module/extension events (CONTRACT §13.3).

The core of a container event listener in `init`:

```ts
deps.events.on<ContainerSearchPayload>(containerEvents.searchChanged, ({ query }) => {
  useProductStore.getState().setSearch(query);
});
```

### 3.11 `public.ts` — the contract for extensions

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

Anything **not** exported here is considered internal — extensions are forbidden from accessing it.

### 3.12 Wiring — 2 files (automatic loader map)

The loader map `web-container/src/bootstrap/moduleLoaders.generated.ts` is **generated** from `web-modules/modules/*/package.json` (the `name` field) by `npm run gen:modules`. Adding a module does **not** change `discover.ts`, aliases, or tsconfig.

| File | What to add |
| --- | --- |
| `Dockerfile` (base repo root) | `COPY web-modules/modules/order-management/package.json ./web-modules/modules/order-management/` before `npm ci` (+ `npm run check:dockerfile` in `web-container`) |
| `web-container/public/config.json` | `"modules": [..., "order-management"]` (dev; production is managed by CI) |

```bash
cd web-modules && npm install                 # workspace lockfile
cd ../web-container && npm run gen:modules    # regenerate the loader map
```

- `gen:modules` runs automatically via pre-hooks: `predev:client-a`, `pretypecheck`, `pretest`, `prebuild:client-a`.
- The sync test `moduleLoaders.generated.test.ts` fails when the generated file is stale.
- Convention: folder name = name in `config.modules` = package `name` suffix (`@arsi/module-<folder>`); a mismatch makes the script fail.
- Wildcard aliases `@arsi/module-*` and `@arsi/module-*/entry` are already available; **the `/entry` pattern must come before the base pattern** (Vite & TS pick the first matching pattern).

### 3.13 Tests

Minimum (CONTRACT §17 — a module **must** have tests for its public API):

```
services/service.order.test.ts   # mock AxiosInstance, assert endpoints & params
queryKeys.test.ts                # namespace & factory
store/useOrderStore.test.ts      # store actions + persist key (mock isDev)
public.test.ts                   # export contract (mock @arsi/container)
components/OrderTable.test.tsx   # render (mock @arsi/container)
```

Full mocking patterns are in section 6.

### 3.14 Verification

```bash
cd web-modules && npm run typecheck && npm test && npm run lint
cd ../web-container && npm run typecheck && npm test && npm run check:dockerfile && npm run build:client-a
cd ../web-container && CLIENT=base npm run link:client && CLIENT=base npm run build:client   # verify the base image
cd ../web-container && npm run link:client-a && npm run dev:client-a
# open http://localhost:5173 → the Orders menu appears, the page renders
```

`gen:modules` runs automatically via the pre-hooks above; run it manually after changing the module list. The dev server needs a restart after adding a module (static loader map).

### 3.15 Adding a dependency (library/package)

Full rules: CONTRACT §1.6. Practical steps:

1. Decide the owner: UI kit → `shared`; feature → the module package; client-specific → extension; shell → container.
2. Install in the owning repo: `cd web-modules && npm install <pkg> -w @arsi/module-<name>` (or `npm install` in the container/extension). Commit the lockfile.
3. `react`/`react-dom` stay peers; never make them dependencies.
4. If the library is imported by the container **and** a module/extension → add it to `resolve.dedupe` (`web-container/vite.config.ts`) + align versions. Context/singleton-based libs **must** be a single copy.
5. Do not add a library that duplicates container capabilities (toast/modal/notifications/i18n/query/HTTP/event).
6. Libraries without global CSS; Tailwind plugins only in the shared preset.
7. New module → add the `COPY package.json` in the `Dockerfile` at the base repo root + run `npm run check:dockerfile` in `web-container`.
8. Duplicate check: `grep node_modules/<pkg> web-container/dist/client-a/assets/*.map` must show 1 root; compare chunk sizes.

### 3.16 API Client & Service Registry

Two ways to reach the backend:

| Need | Use | Why |
| --- | --- | --- |
| Simple endpoint, one baseURL (`deps.config.apiBase`) | `deps.api` / `useApi()` | The container's default axios instance; no registration |
| A service with a different baseURL/config, or registered by an extension | `deps.apiRegistry` / `useApiRegistry()` | Named registry; duplicate `register` throws, unknown `get` throws |
| Server state in a component | `useQuery` + service factory | The service never touches React; the hook wraps it |

**Complete pattern (module):**

```ts
// 1) index.tsx — register the client in init (once)
const orderClient = axios.create({ baseURL: deps.config.apiBase, timeout: 8000 });
deps.apiRegistry.register('order', orderClient);
```

```ts
// 2) services/service.order.ts — factory, receives an AxiosInstance (see §3.3)
export function createOrderService(api: AxiosInstance) {
  return { list: (params?: OrderListParams) => api.get('/orders', { params }).then((r) => r.data) };
}
```

```ts
// 3) hooks/useOrder.ts — get the instance from the registry, wrap React Query
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
// 4) component — consume the hook, not axios
const { data } = useOrderList({ limit: 10 });
```

**Direct access without the registry** (simple endpoint, `module-sample` example):

```tsx
import { useApi, useQuery } from '@arsi/container';

const api = useApi();
const { data } = useQuery({
  queryKey: ['module-sample', 'user', 1],
  queryFn: async () => (await api.get<SampleUser>('/users/1')).data,
});
```

**In an extension:**

```ts
// New client-owned service — namespace <client>.<service>; never override core (auth/user/product)
deps.apiRegistry.register('client-a.audit', axios.create({ baseURL: '/api/audit-client-a' }));
```

```ts
// Service wrapper: wrap a module factory (see §4.5)
const base = createSampleService(apiRegistry.get('module-sample'));
const wrapped = {
  ...base,
  getUser: async (id: number) => {
    if (id > 3) throw new Error('client-a: only users 1-3');
    return base.getUser(id);
  },
};
```

**Rules:**

- Registration **must** happen in `init(deps)`; names unique & namespaced (`<module>` or `<client>.<service>`).
- Components **must** get instances via `useApi()`/`useApiRegistry()` — creating an axios client in a component is forbidden.
- Service factories **must not** access `deps`/React; they only receive an `AxiosInstance`.
- Extensions **must not** override core services — register a new name; change business rules via a service wrapper (§4.5).
- Duplicate `apiRegistry.register` → throws; unknown `get` → throws (fail-fast at init/test).

Living example: `module-sample` pages `/module-sample/api` (`deps.api`) and `/module-sample/api-registry` (registry + factory); extension wrapper in `web-extension-client-a/src/hooks/useClientASample.ts`.

---

## 4. Creating an Extension (module-extension)

An extension = a `web-extension-<client>` repo; it has only **one** entry: the default export `init(deps)` in `src/index.tsx`. The container loads it through the `@arsi/extension` alias (the `current-client` symlink).

### 4.1 Structure & `manifest.json`

```
web-extension-client-a/
├── package.json
├── manifest.json               # client + baseVersion (exact pin to the base tag)
├── Dockerfile                  # FROM base image: <ver>-builder → <ver>
├── ci/build-client.sh          # build + push the client image
├── tsconfig.json / aliases.cjs / .eslintrc.cjs / vitest.config.ts
└── src/
    ├── index.tsx              # init(deps)
    ├── components/            # client-specific components
    ├── overrides/<module>/    # overridden pages/components
    └── i18n/{en,id}.json      # client-owned namespace
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

Extension repos do **not** contain `web-container`/`web-modules` — both come from the base builder image (`/app/web-container`, `/app/web-modules`). `baseVersion` **must** pin the base tag exactly and is checked by `npm run check:base` during the client image build (CONTRACT §1.6; details: `DEPLOYMENT-GUIDE.en.md` §3–§4).

### 4.2 `init(deps)` — complete example

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

  // 1. New client-owned service (path-based, namespace <client>.<service>)
  deps.apiRegistry.register('client-a.audit', axios.create({ baseURL: '/api/audit-client-a', timeout: 5000 }));

  // 2. Fill a module slot
  deps.slots.register(userSlots.userTableActions, AuditButton);

  // 3. Override a module route
  deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });

  // 4. Listen to a module event (the allowed direction)
  deps.events.on<UserUpdatedPayload>(userEvents.updated, (payload) => {
    void deps.queryClient.invalidateQueries({ queryKey: userKeys.detail(payload.id) });
    deps.logger.info('client-a: user updated', payload);
  });

  // 5. Override module i18n (deep merge + overwrite)
  deps.i18n.addResourceBundle('en', 'user-management', { title: 'Client A Users' }, true, true);
}
```

Rules: extensions **must not** override core services (`auth`, `user`, `product`) — register a new name `<client>.<service>`. Extensions **must not** import a module through `/entry`, only `@arsi/module-<name>` (public API).

Living example of the 3 levels (slot → route override → service wrapper): `web-extension-client-a` + `module-sample` — see §4.3–§4.5.

**Prerequisite for overriding module X**: add the alias in the extension repo (once per module) —

```js
// web-extension-client-a/aliases.cjs
'@arsi/module-product-management': path.join(workspaceRoot, 'web-modules', 'modules', 'product-management', 'public.ts'),
```

```json
// web-extension-client-a/tsconfig.json → compilerOptions.paths
"@arsi/module-product-management": ["../web-modules/modules/product-management/public.ts"]
```

Without this, the extension's `@arsi/module-<name>` import will not resolve during typecheck/test.

### 4.3 Slot

1. The module declares it in `slots.ts` + exports it in `public.ts` + uses `useSlot` in its components.
2. The extension fills it in `init`:

```tsx
deps.slots.register(userSlots.userTableActions, AuditButton);
```

The slot component receives props agreed with the module (examples: `{ user }`, `{ product }`). A slot may only be filled once.

Living example: `web-extension-client-a/src/components/ClientASamplePanel.tsx` fills `sampleSlots.overviewPanel` from `module-sample`.

### 4.4 Route

```ts
// override a whole page
deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });

// add a new route (meta.module is required)
deps.routes.add({
  path: '/users/:id/audit',
  element: <ClientAUserAudit />,
  meta: { group: 'user', module: 'user-management' },
});
```

`override` on a path the module has not registered will **throw** — the boot order guarantees the module initializes before the extension, so make sure the path is correct. Don't forget to include `meta` (an override replaces the whole entry).

Living example: `/module-sample/extension-points` is overridden by client-a (`web-extension-client-a/src/components/ClientAExtensionPointsPage.tsx`).

### 4.5 Service wrapper (the heaviest level, use when slots & routes are not enough)

```tsx
import { createUserService } from '@arsi/module-user-management';

const base = createUserService(apiRegistry.get('user'));
const wrapped = {
  ...base,
  update: async (id: number, patch: UpdateUserInput) => {
    if (!patch.email?.endsWith('@client-a.com')) {
      throw new Error('Email must use the client-a domain');
    }
    return base.update(id, patch);
  },
};
```

The wrapper is used through the extension's own hook; do not modify the instance registered by the module.

Living example: `web-extension-client-a/src/hooks/useClientASample.ts` wraps `createSampleService(apiRegistry.get('module-sample'))` (adds a suffix, blocks ID > 3, logs an event).

### 4.6 i18n

- Client-owned namespace for client-specific text: `deps.i18n.addResourceBundle('en', 'client-a', en, true, true)`.
- Override a module namespace: `addResourceBundle(lng, '<module>', res, true, true)` (deep merge + overwrite).
- Do not override the `common` namespace without agreement.

### 4.7 Events

| Direction | Allowed |
| --- | --- |
| Module emit → extension listen | ✓ |
| Extension emit → module listen | ✗ (the base must not know about the extension) |
| Extension emit → extension/container listen | ✓ (namespace `<client>.<entity>.<action>`) |

### 4.8 Extension tests

Required: tests for the override. Pattern: fake `deps` + `vi.resetModules()` so the `initialized` guard does not leak between tests — see `web-extension-client-a/src/__tests__/init.test.ts`.

```ts
const { deps, slots, routes } = createFakeDeps();
const init = await loadInit(); // vi.resetModules() + dynamic import
await init(deps);
expect(slots.register).toHaveBeenCalledWith(userSlots.userTableActions, expect.anything());
```

### 4.9 New client from the template

1. Copy `web-extension-template` into a new `web-extension-<client>` repo (e.g. `web-extension-client-x`) and make it its own Git repo.
2. Adjust `package.json` (`name`) and fill in `manifest.json`: `client` = `<client>`, `baseVersion` = the current base tag (exact, e.g. `0.1.0`), plus `modules`/`shared`/`overrides` as needed.
3. Build & push the client image — the base is **not** rebuilt; the script uses the base image `FROM` the registry:

```bash
cd web-extension-client-x
ORG=<dockerhub-org> PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh
```

4. Optional local dev (symlink `current-client` + a `dev:<client>` script):

```bash
cd web-container
CLIENT=client-x npm run link:client    # symlink current-client -> ../web-extension-client-x
# add a "dev:client-x" script like dev:client-a, then run it
```

`ci/build-client.sh` runs the extension verification (typecheck/test/lint) inside the base builder image; `check:base` ensures `baseVersion` matches the base in use. Full build/run/rollback details: `DEPLOYMENT-GUIDE.en.md` §3–§5.

---

## 5. Quick Conventions

### 5.1 Naming

| Aspect | Format | Example |
| --- | --- | --- |
| Module folder | kebab-case | `order-management` |
| Component file | PascalCase | `OrderTable.tsx` |
| Hook file | `use<Name>.ts` | `useOrder.ts` |
| Service file | `service.<name>.ts` | `service.order.ts` |
| Store file | `use<Name>Store.ts` | `useOrderStore.ts` |
| Slot | `<module>.<slotName>` | `order-management.orderTableActions` |
| Modal | `<module>.<action>` | `order-management.create` |
| Event | `<module>.<entity>.<action>` | `order-management.order.updated` |
| i18n namespace | `<module>` | `order-management` |
| Service | `<module>` / `<client>.<service>` | `order`, `client-a.audit` |
| Query key root | `[<module>, <entity>]` | `['order-management', 'order']` |
| Store persist key | `module:<name>` / `container:<name>` | `module:order-management` |
| Config file | `.cjs` | `aliases.cjs`, `tailwind.config.cjs` |
| Files containing JSX | `.tsx` | `index.tsx`, `OrderListPage.tsx` |

### 5.2 Imports: wrong → right

| ✗ | ✓ |
| --- | --- |
| `import axios from 'axios'` in a module service/hook | Only in `index.tsx` when registering the service |
| `import { useQuery } from '@tanstack/react-query'` | `import { useQuery } from '@arsi/container'` |
| `import { toast } from 'sonner'` | `useToast()` / `deps.toast` |
| `import i18next from 'i18next'` | `useTranslation()` / `deps.i18n` |
| `import { Button } from '@arsi/shared/components/ui/button'` | `import { Button } from '@arsi/shared'` |
| `import { X } from '@arsi/module-user-management/internal'` (extension) | `import { X } from '@arsi/module-user-management'` |
| `import.meta.env.VITE_*` in a module/extension | `deps.config` / `useConfig()` |
| Creating your own `QueryClient` | Use `useQueryClient()` / `deps.queryClient` |

ESLint already enforces most of these rules (`no-restricted-imports` per repo).

### 5.3 Governance

| Allowed without discussion | Requires lead dev discussion |
| --- | --- |
| Add a module/slot/route/service/query key/translation | Change the public API (breaking) |
| Add a shadcn component in shared | Change naming conventions / layer rules |
| — | Override a module modal from an extension |
| — | Override a core service |

### 5.4 Styling & Theme

Brand: **ARSI Purple `#551AB9`**. Full token table + usage rules: `CONTRACT.md` §10.4.

| Rule | Detail |
| --- | --- |
| Colors | **Must use tokens** (`bg-primary`, `text-success-strong`, etc.). Raw hex / direct Tailwind palette colors in components are forbidden. |
| Hover/selected | Use brand tokens: `hover:bg-primary-hover` (buttons), `bg-accent` (hover/selected surface, table rows). |
| Status | Tint-pattern badges: `bg-success/10 text-success-strong border-success/20` (same for `warning`/`info`/`destructive`). Semantic text uses the `-strong` variants so contrast passes AA in light & dark. |
| Dark mode | Do not use `dark:` utilities in source. Everything goes through tokens that flip automatically (`web-container/src/styles/globals.css`). |
| Font | Plus Jakarta Sans self-hosted (`@fontsource-variable/plus-jakarta-sans`, imported from `globals.css`); do not add a Google Fonts `<link>`. |
| Changing/adding tokens | Only in `globals.css` (values) + `tailwind.preset.cjs` (mapping); the test `web-container/src/styles/tokens.test.ts` must pass. |
| Container | **Self-contained**: the container must not import `@arsi/shared` (enforced by ESLint `no-restricted-imports`). The shell uses token utilities directly; shared components (`Card`, `Button`, etc.) are only for modules/extensions. |

---

## 6. Testing Playbook

### 6.1 Levels & requirements

| Level | Required for |
| --- | --- |
| Unit: service / query keys / store | Module |
| `public.ts` contract | Module (every module) |
| Component render | Module (at least 1 main component) |
| Override & `init` registration | Extension (every extension) |

### 6.2 Pattern 1 — service test (mock AxiosInstance)

```ts
const api = { get: vi.fn(), post: vi.fn() };
const service = createOrderService(api as unknown as AxiosInstance);
await service.list({ limit: 5 });
expect(api.get).toHaveBeenCalledWith('/orders', { params: { limit: 5, skip: 0 } });
```

### 6.3 Pattern 2 — component test (mock `@arsi/container`)

```tsx
vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useSlot: () => undefined,
  useLocale: () => ({ locale: 'en' }),
}));
```

Mock only the hooks the component uses. For the `public.ts` barrel, provide every hook it touches (see `product-management/public.test.ts`). Components using `useNotifications`/`useToast`/`useModal` need stubs so calls can be asserted — examples: `user-management/components/SendNotificationButton.test.tsx`, `web-extension-client-a/src/components/AuditButton.test.tsx`.

### 6.4 Pattern 3 — module hook in a component test

```tsx
const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));
vi.mock('../hooks/useProduct', () => ({
  useDeleteProduct: () => ({ mutate: mutateMock, isPending: false }),
}));
```

### 6.5 Pattern 4 — extension init test

Fake `deps` (cast `as unknown as Deps`) + `vi.resetModules()` + dynamic import so the `initialized` guard is fresh per test. Idempotency test: call `init` twice and assert registration happens only once.

### 6.6 Pattern 5 — container event listener

Container events are listened to in `init`, so the test is a unit test of the listener function + a fake EventBus. Partially mock `@arsi/container` so the **real** `containerEvents` is used (the event name is part of the test).

```ts
vi.mock('@arsi/container', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arsi/container')>();
  return { ...actual, isDev: false };
});

const bus = { on: /* store handler */, emit: /* call handler */ } as unknown as EventBus;
registerContainerSearchListener(bus);
bus.emit(containerEvents.searchChanged, { query: 'phone' });
expect(useProductStore.getState().search).toBe('phone');
```

Full example: `product-management/events/containerSearch.test.ts`.

### 6.7 Notes

- `vitest.setup.ts` in web-modules calls RTL `cleanup()` after every test (because `globals: false`).
- Store tests: mock `isDev` (`vi.mock('@arsi/container', () => ({ isDev: false }))`) and `localStorage.clear()` in `beforeEach`.
- Container event tests: do not mock `containerEvents` with string literals — use `importOriginal` so the event-name contract is tested too.
- All tests run per repo: `cd web-modules && npm test`, etc.

---

## 7. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `@arsi/module-*/entry` resolves incorrectly (`.../public.ts/entry`) | The `/entry` pattern must come **before** the base pattern in `aliases.cjs`/`tsconfig.json` — Vite & TypeScript pick the first matching pattern. |
| Extension test fails with `Cannot read properties of null (reading 'useCallback')` | Two React copies (shared/Radix components vs the extension's `react-dom`). In the extension's `vitest.config.ts`: alias `react`/`react-dom` to the extension's node_modules + `server.deps.inline` for `@arsi/shared` & `@radix-ui`. |
| Tailwind warning "matching all of node_modules" | Nested `node_modules` under `web-modules/modules/*` (npm places some deps there). Make sure the container's `tailwind.config.cjs` includes the negation `'!../web-modules/modules/**/node_modules/**'`. |
| Colors do not change when switching themes | Raw hex or `dark:` utilities in a component. Replace with tokens (`bg-card`, `text-muted-foreground`, etc.) — see §5.4. |
| Palette/contrast test fails | `cd web-container && npm test -- src/styles/tokens.test.ts`. Update the values in `globals.css` + the mapping in `tailwind.preset.cjs`; do not loosen the test. |
| ESLint "Container must stay self-contained" | `web-container` imports `@arsi/shared`. The container must stay self-contained; shared components are only for modules/extensions. |
| Font is still the system font | The `@fontsource-variable/plus-jakarta-sans` import in `globals.css` was removed, or the preset `fontFamily.sans` changed. Run `tokens.test.ts`. |
| `[apiRegistry] service "x" is not registered` | The service is registered in an `init` that has not run, or the name is wrong. Check the order in `config.json` and the names in `register`/`get`. |
| `[routes] cannot override unknown route` | The extension overrides a path the module has not registered. Check the exact path (`/users/:id`). |
| `[slots] slot "x" already has a component` | The slot was filled twice (or `init` ran twice without a guard). Ensure the `initialized` guard and that only one extension fills it. |
| TS error "not assignable to Control<...>" on `useForm` | Forms with Zod `.transform()` need the third generic: `useForm<Input, unknown, Output>`. The shared `FormField` supports it. |
| Test fails with "found multiple elements" | RTL is not cleaning up (globals off). Make sure `vitest.setup.ts` calls `cleanup()` in `afterEach`. |
| `init` runs twice during dev | React StrictMode. The container already runs it `runOnce`; modules/extensions still **must** have an `initialized` guard. |
| Changes do not appear after switching clients | The `current-client` symlink changed → restart the dev server. |
| `current-client` points at the wrong extension | Wrong `CLIENT` name or a stale link. Check `readlink web-container/current-client`; re-run `npm run link:client-a` / `CLIENT=<client> npm run link:client`, then restart the dev server. |
| Engine warnings during `npm install` | Local Node is newer than some packages' target; safe to ignore as long as tests pass. CI/Docker uses Node 20. |
| DummyJSON mutations "do not persist" | That is the simulation (create/update/delete do not persist). The pilot uses optimistic cache + rollback; with a real backend add `invalidateQueries` in `onSettled`. |
| Topbar search does not filter products | The `containerEvents.searchChanged` listener is not registered (check `init`) or the product module is not enabled in `config.json`. Listen via the constant, not a string literal. |
| Duplicate packages in the bundle / chunks growing | A library is imported across trees without dedupe. Check `grep node_modules/<pkg> web-container/dist/client-a/assets/*.map`; add it to `resolve.dedupe` + align versions (CONTRACT §1.6). |
| `Invalid hook call` / `useNavigate() may be used only in the context of a <Router>` | Two copies of React or React Router in the bundle. Add the library to `resolve.dedupe` in `vite.config.ts` + `vitest.config.ts`. |
| Docker build fails after adding a module/dependency | The module `package.json` is not COPYed or the lockfile is not committed. Run `cd web-container && npm run check:dockerfile`. |
| New module is not loaded (loader map) | The generated file is stale or the package name does not follow the convention. Run `cd web-container && npm run gen:modules`; the sync test will fail in CI if forgotten. |
| Error "Option 'baseUrl' is deprecated" (TS 6+) | The tsconfig uses `baseUrl`. Remove `baseUrl` and keep `paths` (relative to the tsconfig, supported since TS 4.1; TS 7 removes `baseUrl`). |

---

## 8. PR Checklist

**Module**

- [ ] Imports only from allowed layers; no imports from other modules.
- [ ] No `deps` access at top-level; all registrations inside `init(deps)`.
- [ ] `init` is idempotent (guard) and can be called twice without errors.
- [ ] Services are factories, do not access `deps`, do not import React/React Query.
- [ ] Services are registered in `init`, with unique namespaced names.
- [ ] Query keys use a factory + namespace; exported in `public.ts` when used by extensions.
- [ ] Slot/modal/event/route names are namespaced; route paths are unique + have `meta.module`.
- [ ] Container events are listened to via `containerEvents` in `init`; no listening to extension events.
- [ ] All UI text uses i18n (en + id), namespace `<module>`.
- [ ] UI uses `@arsi/shared` components; no direct `components/ui/...` imports.
- [ ] Styling uses tokens (§5.4): no raw hex / `dark:` utilities; contrast follows CONTRACT §10.4.
- [ ] Feedback uses `useToast`/`useNotifications` (not a custom store); notification `source` is namespaced.
- [ ] New dependencies follow CONTRACT §1.6 (react stays a peer, dedupe when cross-tree, no global CSS).
- [ ] Stores use the persist key `module:<name>`; devtools via `isDev`.
- [ ] `public.ts` is updated; alias/tsconfig/discover/config.json are wired.
- [ ] Tests added (service, query keys, store, public API, component).
- [ ] `typecheck`, `test`, `lint`, `check:dockerfile`, `build:client-a` pass (base image build: `CLIENT=base npm run build:client`).

**Extension**

- [ ] Only the default export `init(deps)`; all registrations inside it + idempotent.
- [ ] Module imports only from `@arsi/module-<name>` (public API).
- [ ] Does not override core services; new services are named `<client>.<service>`.
- [ ] Slot/route/modal/i18n overrides follow the agreement; does not fill undeclared slots.
- [ ] Override styling uses tokens (§5.4); no raw hex / `dark:` utilities.
- [ ] New dependencies follow CONTRACT §1.6 (react stays a peer, dedupe when cross-tree).
- [ ] Does not listen to other extensions' events; does not make modules listen to extension events.
- [ ] `manifest.json` is updated (client, baseVersion, modules, overrides).
- [ ] Override tests added; `typecheck`, `test`, `lint` pass; the client image builds via `ci/build-client.sh` (`check:base` passes).

---

## 9. References & Living Examples

### 9.1 Documents

- `ARCHITECTURE.md` §19 — Development Workflow (setup, adding a module/client).
- `CONTRACT.md` §20 — Official Review Checklist.
- `CONTRACT.md` §15 — Naming conventions.
- `CONTRACT.md` §10.4 — ARSI Purple brand tokens & styling rules.
- `CONTRACT.md` §9.4 — UI kit import rules (including container self-contained).
- `docs/DEPLOYMENT-GUIDE.en.md` — base/client image builds, container runtime env, CI, rollback.
- `docs/phase.02-rbac-navigation.md` — Phase 2 plan: Keycloak RBAC + database-driven navigation.

### 9.2 Code example map

| Want to see an example of | File |
| --- | --- |
| Full CRUD module (list, detail, create, edit, delete, filter, sort, pagination) | `web-modules/modules/product-management/` |
| RHF + Zod + i18n validation | `product-management/schemas/productSchema.ts`, `components/ProductForm.tsx` |
| Optimistic cache + rollback | `product-management/hooks/useProduct.ts` |
| Modal with payload (confirm delete) | `product-management/components/ProductDeleteDialog.tsx` |
| Simple module + slot | `web-modules/modules/user-management/` |
| Module `init(deps)` | `user-management/index.tsx`, `product-management/index.tsx` |
| Complete extension (slot, route override, service, event, i18n) | `web-extension-client-a/src/index.tsx` |
| Extension test (fake deps + idempotency) | `web-extension-client-a/src/__tests__/init.test.ts` |
| Container registries (slot/route/menu/modal/event) | `web-container/src/{slots,routes,menu,modal,events}/` |
| Bootstrap & discovery | `web-container/src/bootstrap/` |
| Shared UI kit | `web-modules/shared/` |
| Reference module (demos every container dependency: api, apiRegistry, query, zustand, toast, modal, notifications, events, slots, i18n, logger) | `web-modules/modules/module-sample/` |
| Extension 3-level override (slot → route override → service wrapper) | `web-extension-client-a/src/index.tsx`, `components/ClientASamplePanel.tsx`, `components/ClientAExtensionPointsPage.tsx`, `hooks/useClientASample.ts`, `web-modules/modules/module-sample/pages/SampleExtensionPage.tsx` |
| Topbar global search → container event → module filter | `web-container/src/layout/GlobalSearch.tsx`, `web-container/src/events/containerEvents.ts`, `product-management/events/containerSearch.ts` |
| Notification bell (module/extension → container) | `web-container/src/notifications/`, `user-management/components/SendNotificationButton.tsx`, `web-extension-client-a/src/components/AuditButton.tsx` |
| Token palette & contrast test | `web-container/src/styles/tokens.test.ts` |

### 9.3 Minimal skeleton

**Module** (`web-modules/modules/order-management/`):

```
package.json          → copy from product-management, rename
index.tsx             → init(deps): i18n + service + menu + routes (section 3.10)
public.ts             → export the contract (section 3.11)
types.ts              → domain types
services/service.order.ts
hooks/useOrder.ts
pages/OrderListPage.tsx
i18n/{en,id}.json
```

**Extension** (`web-extension-<client>/`):

```
package.json + manifest.json + tsconfig.json + aliases.cjs + vitest.config.ts
src/index.tsx         → default export init(deps) (section 4.2)
src/components/…      → client-specific components
src/overrides/<module>/…  → overridden pages
```

Fastest path: copy the pilot module/extension that is closest, then rename & fill in. Don't forget the wiring (see §3.12) for a new module.

---

**Document version**: 0.7.4
**Last updated**: 2026-10-02
