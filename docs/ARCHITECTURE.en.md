# Architecture Guide — Modular Web Platform

**Version**: 0.1.0
**Audience**: Developer, tech lead, architect
**Status**: Living document

---

## Table of Contents

1. Overview
2. Design Principles
3. Repo & Ownership
4. Layer Architecture
5. Boot Sequence
6. Configuration
7. Dependency Injection — deps + hooks
8. State Management
9. Data Fetching
10. Service Registry
11. UI Kit & Shared Components
12. Override Mechanisms
13. i18n, Toast, Modal
14. Event Bus
15. Path Mapping & Aliases
16. Build & Deployment
17. CI/CD
18. Governance
19. Development Workflow
20. Anti-patterns
21. Roadmap

---

## 1. Overview

### 1.1 What Is Being Built

Modular web platform for **multiple clients** with a stable core and isolated per-client customization.

**Characteristics:**

- 50+ business modules in the future
- 5+ clients each with their own customization
- React 19 + Vite + TypeScript
- Backend microservices accessed via path-based routing (nginx)
- Per-client deploy via CI/CD Azure DevOps

### 1.2 Why Modular

Without modular:

- A single change in client A can break client B.
- Bundle size balloons because all features are loaded.
- Onboarding a new client developer is slow.
- Product development is disrupted by client customization.

With modular:

- Stable base, isolated extension.
- Selective bundle per client.
- Fast onboarding: clone 3 small repos.
- Product and client development run in parallel.

### 1.3 Philosophy

| Principle                          | Implication                                        |
| ---------------------------------- | -------------------------------------------------- |
| **Container doesn't know modules** | Discovery-based, not hardcoded                     |
| **Modules don't know extensions**  | Slot-based, not conditional                        |
| **Extension knows the base**       | Extension may import the public API                |
| **Public API as contract**         | Each layer exposes via `public.ts` / `index.ts`    |
| **Config-driven**                  | URL and module selection from runtime config       |
| **Fail-fast**                      | Duplicate service, slot, route → error             |
| **One image, many environments**   | Runtime config, not build-time                     |

---

## 2. Design Principles

### 2.1 Separation of Concerns

| Concern                       | Owner                       |
| ----------------------------- | --------------------------- |
| Shell (auth, routing, layout) | Container                   |
| UI primitives                 | Shared                      |
| Business features             | Module                      |
| Client customization          | Extension                   |
| Global state                  | Container (Zustand)         |
| Feature state                 | Module (Zustand)            |
| Server state                  | React Query (via container) |
| Config                        | Container (runtime)         |

### 2.2 Dependency Direction

```
Container  →  (does not import anything from other layers)
Shared     →  (does not import anything)
Module     →  Container (public), Shared
Extension  →  Container (public), Shared, Module (public)
```

**Rule:** dependencies may only point to lower layers. No upward dependency.

### 2.3 Client Isolation

- Each client has its own extension repo.
- Client A cannot access client B's code.
- Changes in client A do not affect client B.
- CI/CD per client is independent.

### 2.4 YAGNI vs Investment

| Phase      | Focus                                            |
| ---------- | ------------------------------------------------ |
| Prototype  | Path mapping, module selection via config        |
| Production | Contract test, versioning, observability         |
| Scale      | Azure Artifacts, release train, package registry |

Don't over-engineer at the start. But also don't accrue architecture debt that is hard to pay off.

---

## 3. Repo & Ownership

### 3.1 Repo Structure

```
workspace/
├── web-container/              # Application shell
├── web-modules/                # Shared + business modules
├── web-extension-client-a/     # Client A extension
├── web-extension-client-b/     # Client B extension
└── web-extension-template/     # Template for new clients
```

**Must be side by side** while using path mapping.

### 3.2 Ownership Matrix

| Repo                     | Owner                    | Contributors                     |
| ------------------------ | ------------------------ | -------------------------------- |
| `web-container`          | Platform team / lead dev | Internal developers              |
| `web-modules`            | Platform team / lead dev | Internal developers              |
| `web-extension-<client>` | Client developer         | Can view base, but cannot modify |
| `web-extension-template` | Platform team            | —                                |

### 3.3 Repo Contents

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
- `modules/<name>/` — business features
- Each module has `public.ts` as its contract

**`web-extension-<client>`:**

- `src/index.ts` — entry point `init(deps)`
- `src/components/` — client-specific components
- `src/overrides/<module>/` — per-module overrides
- `manifest.json` — declares modules & versions

**`web-extension-template`:**

- Same as an extension, but empty
- To be cloned when creating a new client

---

## 4. Layer Architecture

### 4.1 Layer Diagram

```
┌────────────────────────────────────────────┐
│  web-extension-<client>                    │
│  - UI override (slot)                      │
│  - route override                          │
│  - service wrapper                         │
│  - client-specific components              │
└─────────────────┬──────────────────────────┘
                  │ import public API
                  ▼
┌────────────────────────────────────────────┐
│  web-modules                               │
│  ┌──────────────────────────────────────┐  │
│  │ shared/ — UI kit, hooks, utils       │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ modules/<name>/ — business features  │  │
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

| From \ To | Container | Shared | Module   | Extension |
| --------- | --------- | ------ | -------- | --------- |
| Container | —         | ✗      | ✗        | ✗         |
| Shared    | ✗         | —      | ✗        | ✗         |
| Module    | ✓ public  | ✓      | ✗        | ✗         |
| Extension | ✓ public  | ✓      | ✓ public | ✗         |

### 4.3 Public API per Layer

| Layer     | Public API                              |
| --------- | --------------------------------------- |
| Container | `src/public/index.ts`                   |
| Shared    | `shared/index.ts`                       |
| Module    | `modules/<name>/public.ts`              |
| Extension | `src/index.tsx` (default export `init`) |

Importing outside the public API is a contract violation.

---

## 5. Boot Sequence

### 5.1 Sequence

```
1. main.tsx
   ├─ loadConfig()              → fetch /config.json
   ├─ setConfig(config)         → set into container config
   └─ bootstrap()

2. bootstrap()
   ├─ discover()
   │   ├─ moduleLoaders.generated.ts    → map name → lazy import (result of `npm run gen:modules`)
   │   ├─ for module in config.modules:
   │   │   ├─ module.init(deps)         → register service, menu, route, i18n
   │   │   └─ module.registerModal(deps) → optional
   │   └─ initExtension(deps)           → register slot, override route, event
   └─ createBrowserRouter(routeRegistry.getRoutes())

3. ReactDOM.createRoot().render()
   └─ <RouterProvider router={router} />
```

### 5.2 What Happens in `init(deps)`

Every module and extension has an `init(deps)` hook that is called **once** at boot.

**Module `init`:**

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

  // 5. Listen event (optional)
  deps.events.on('user.created', (payload) => { /* ... */ });
}
```

**Extension `init`:**

```ts
export default async function init(deps) {
  // 1. Fill slot
  deps.slots.register('user-management.userTableActions', AuditButton);

  // 2. Override route
  deps.routes.override('/users/:id', { element: <ClientAUserDetail /> });

  // 3. Register new service (optional)
  deps.apiRegistry.register('client-a.audit', axios.create({ baseURL: '/api/audit' }));

  // 4. Listen to module event
  deps.events.on('user-management.user.updated', (payload) => { /* ... */ });
}
```

### 5.3 Idempotency

`init` may be called twice in React 19 StrictMode. Modules must be idempotent:

- `slots.register` → throws on duplicate. Wrap with a guard or make it idempotent.
- `routes.add` → throws on duplicate. Same.
- `apiRegistry.register` → throws on duplicate. Same.

**Solution:** the container provides an `isInitialized` flag. Or modules check `if (deps.slots.has(name)) return;`.

---

## 6. Configuration

### 6.1 Config Source

| Environment | Source                                                  |
| ----------- | ------------------------------------------------------- |
| Local dev   | `web-container/public/config.json`                      |
| Production  | `/config.json` generated by the entrypoint from env vars |

### 6.2 Config Structure

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

### 6.4 Rules

- The container **must** load config before bootstrap.
- Modules and extensions **must not** access `import.meta.env` directly.
- Modules and extensions access config via `deps.config` or `useConfig()`.
- Config **must** be fetched with `cache: 'no-store'`.
- Config **must** have a default fallback so the app can boot when the fetch fails.

### 6.5 Runtime vs Build-time

| Aspect       | Build-time (`import.meta.env`) | Runtime (`/config.json`) |
| ------------ | ------------------------------ | ------------------------ |
| When set     | Build                          | Container start          |
| Image        | Per environment                | One for all              |
| Change URL   | Rebuild                        | Restart container        |
| CI variable  | Before build                   | After build (deploy)     |

**Choice:** runtime config. One image, many environments.

---

## 7. Dependency Injection — deps + hooks

### 7.1 Concept

The container provides instances via two channels:

| Channel       | When used                            |
| ------------- | ------------------------------------ |
| `deps` object | In `init(deps)` — outside React tree |
| React hooks   | In components — inside React tree    |

Both point to the same instance.

### 7.2 Contents of `deps`

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

### 7.3 Available Hooks

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

### 7.4 When to Use What

| Context                    | Use       |
| -------------------------- | --------- |
| `init(deps)`               | `deps`    |
| Event listener in `init`   | `deps`    |
| Route definition in `init` | `deps`    |
| Component body             | hooks     |
| Custom hook                | hooks     |
| Utility function           | parameter |

### 7.5 Anti-pattern

```ts
// ❌ Don't — access deps at module top-level
import { deps } from "@arsi/container";
const client = deps.queryClient; // executed when the module loads
```

```ts
// ✅ Correct — access inside a function/hook
function useUsers() {
  const queryClient = useQueryClient();
  // ...
}
```

---

## 8. State Management

### 8.1 Three Kinds of Store

| Store     | Owner     | Example             | Persist  |
| --------- | --------- | ------------------- | -------- |
| Global    | Container | auth, theme, locale | Yes      |
| Module    | Module    | `useUserStore`      | Optional |
| Extension | Extension | `useClientAStore`   | Optional |

### 8.2 Zustand Pattern

**Module:**

```ts
// modules/user-management/store/useUserStore.ts
import { create } from "zustand";

export const useUserStore = create((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
}));
```

**Export in the public API:**

```ts
// modules/user-management/public.ts
export { useUserStore } from "./store/useUserStore";
```

**Extension uses it:**

```ts
import { useUserStore } from "@arsi/module-user-management";

function ClientAComponent() {
  const selectedId = useUserStore((s) => s.selectedId);
}
```

### 8.3 Rules

- Each module **must** have its own store for module state.
- Modules **must not** access another module's store.
- Cross-module communication goes through the **event bus**, not a shared store.
- Extensions **may** access the global store via container hooks.
- Extensions **may** access a module store via hooks exposed by the module.
- Persist keys **must** be namespaced: `<layer>:<name>`.

### 8.4 When to Use Zustand vs React Query

| Data                                 | Use                           |
| ------------------------------------ | ----------------------------- |
| Server data (list, detail)           | React Query                   |
| UI state (modal open, selected item) | Zustand                       |
| Form state                           | Local state / react-hook-form |
| Auth, theme, locale                  | Zustand global                |
| Session data                         | Zustand + persist             |

**Rule:** if the data comes from an API, use React Query. If it is purely UI state, use Zustand.

---

## 9. Data Fetching

### 9.1 Division of Responsibility

| Layer       | Responsibility                         |
| ----------- | -------------------------------------- |
| Axios       | HTTP request, interceptor, auth header |
| React Query | Cache, stale, loading/error state      |
| Service     | Combination of axios + business logic  |
| Hook        | Wrap service with React Query          |

### 9.2 Service Pattern

A service **must** be a factory function that receives an axios instance:

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

**Rules:**

- Services **must not** access `deps` directly.
- Services **must not** import React.
- Services **must not** import `@tanstack/react-query`.
- Services **must** be pure — take parameters, return data.

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

Export it in `public.ts` so extensions can invalidate:

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

The container initializes `queryClient` and renders `QueryClientProvider` at the root. Modules and extensions **must not** create their own `QueryClient`.

### 9.7 Rules

- Modules **must not** import `axios` directly (except to register services in `init`).
- Modules **may** import `useQuery`, `useMutation`, `useQueryClient` from the container.
- Query keys **must** use a factory, namespaced.
- Query key factories **must** be exported in `public.ts` if extensions need to invalidate.

---

## 10. Service Registry

### 10.1 Concept

The container provides:

- **`deps.api`** — default axios instance, without a specific baseURL.
- **`deps.apiRegistry`** — registry for services with different configs.

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

Extension registers a new service:

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

### 10.3 Use Service

```ts
// In init
const user = await deps.apiRegistry.get("user").get("/users/1");

// In a component
const apiRegistry = useApiRegistry();
const user = await apiRegistry.get("user").get("/users/1");
```

### 10.4 Rules

- Service names **must** be unique. Duplicate → throw.
- Service names **must** be namespaced: `<module>` or `<client>.<service>`.
- Core services (`auth`, `user`) **must** be registered in the base.
- Extensions **must not** override core services.
- Registration **must** happen in `init(deps)`, not at top-level.
- Services **must** use path-based URLs (`/api/<service>`), not full domains.

### 10.5 When to Use `api` vs `apiRegistry`

| Need                               | Use                |
| ---------------------------------- | ------------------ |
| Simple endpoint, one baseURL       | `deps.api`         |
| Service with a different baseURL   | `deps.apiRegistry` |
| Service with a different config    | `deps.apiRegistry` |
| Service registered by an extension | `deps.apiRegistry` |

---

## 11. UI Kit & Shared Components

### 11.1 shadcn-ui in `web-modules/shared`

- shadcn-ui primitives: `shared/components/ui/`
- Composite components: `shared/components/composite/`
- Public API: `shared/index.ts`

### 11.2 Tailwind & Brand Tokens

- Preset: `web-modules/shared/tailwind.preset.cjs`
- Config: `web-container/tailwind.config.cjs` extends the preset
- CSS variables: `web-container/src/styles/globals.css`
- ARSI Purple brand token (`#551AB9`) + semantic tokens + usage rules: see CONTRACT §10.4.
- The `Card` component is available in `shared/components/ui/card.tsx` for modules/extensions. The container remains self-contained (does not import `@arsi/shared`).

### 11.3 Add a New Component

```bash
cd web-modules/shared
npx shadcn@latest add <component>
```

The component is automatically placed in `components/ui/`.

### 11.4 Rules

- Modules **must** use components from `@arsi/shared`.
- Modules **must not** import shadcn-ui directly from `components/ui/...`.
- Extensions **must** use components from `@arsi/shared`.
- If you need a new component, **add it to shared**, don't create it in a module.
- Highly module-specific components (`UserTable`) may live in the module.
- Theme (colors, radius) lives in the container CSS variables.
- Modules and extensions **must not** define their own Tailwind config.

---

## 12. Override Mechanisms

Extensions can override modules at three levels. Pick the lightest one.

### 12.1 Level 1 — Slot (lightest)

The module exposes a slot, the extension fills it.

**Module defines:**

```ts
// modules/user-management/slots.ts
export const userSlots = {
  userTableActions: "user-management.userTableActions",
  userDetailSidebar: "user-management.userDetailSidebar",
};
```

**Module uses:**

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

**Extension fills:**

```ts
deps.slots.register(userSlots.userTableActions, AuditButton);
```

**When to use:** add UI without changing the module.

### 12.2 Level 2 — Route Override (medium)

The extension replaces a full page.

```ts
deps.routes.override('/users/:id', {
  element: <ClientAUserDetail />,
});
```

**When to use:** replace a full page, change the navigation flow.

### 12.3 Level 3 — Service Wrapper (heaviest)

The extension replaces logic with a wrapper.

```ts
import { createUserService } from "@arsi/module-user-management";

const base = createUserService(api);
const wrapped = {
  ...base,
  updateUser: async (id, patch) => {
    if (!patch.email.endsWith("@client-a.com")) {
      throw new Error("Email must use the client-a domain");
    }
    return base.updateUser(id, patch);
  },
};
```

**When to use:** change business rules, add validation, side effects.

### 12.4 Decision Table

| Need                    | Level           |
| ----------------------- | --------------- |
| Add a column to a table | Slot            |
| Replace a button        | Slot            |
| Replace a full page     | Route           |
| Add a new route         | Route           |
| Change validation       | Service wrapper |

A living example of all three levels: `module-sample` + `web-extension-client-a` (see DEVELOPER-GUIDE §4.3–§4.5).
| Add a side effect       | Service wrapper |
| Change a business rule  | Service wrapper |

**Rule:** always try slot first. If that doesn't work, route. If that doesn't work, service. Don't jump straight to a service wrapper.

### 12.5 Naming Rules

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
| Module    | `<module-name>`            |
| Extension | `<module-name>` (override) |

**Module registers:**

```ts
deps.i18n.addResourceBundle("en", "user-management", en);
deps.i18n.addResourceBundle("id", "user-management", id);
```

**Extension overrides:**

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

**Use in a component:**

```tsx
const { t } = useTranslation("user-management");
return <h1>{t("title")}</h1>;
```

**Rules:**

- Namespaces **must** be unique per module.
- Extensions **may** override a module's namespace.
- Extensions **must not** override the `common` namespace unless agreed upon.
- Translation keys **must** be descriptive.

### 13.2 Toast — Sonner

**Default:**

```ts
deps.toast.success('User created');
deps.toast.error('Failed');
deps.toast.info('Loading...');
deps.toast.custom(<CustomToast />);
```

**Custom per module:** use `toast.custom()` to render your own component.

**Rules:**

- Toasts **must** use `deps.toast` or `useToast`, not `sonner` directly.
- Toast messages **must** use i18n, not be hardcoded.

### 13.3 Modal — Dialog

**Register:**

```ts
deps.modal.register("user-management.create", CreateUserDialog);
```

**Open:**

```ts
deps.modal.open("user-management.create", { onSuccess: () => {} });
// or
const modal = useModal();
modal.open("user-management.create", { onSuccess: () => {} });
```

**Rules:**

- Modal names **must** be namespaced: `<module>.<action>`.
- Modals **must** be registered in `init`, not in a component.
- Extensions **may** register modals under their own names.
- Extensions **may** override a module's modal by registering again (must be agreed upon).

---

## 14. Event Bus

### 14.1 Concept

Event bus for cross-module communication. The container doesn't know who is listening.

### 14.2 Pattern

**Module emits:**

```ts
deps.events.emit("user-management.user.updated", { id, changes });
```

**Extension listens:**

```ts
deps.events.on("user-management.user.updated", (payload) => {
  deps.logger.info("user updated", payload);
});
```

**In a component:**

```tsx
const events = useEventBus();
events.emit("client-a.audit.requested", { userId });
```

### 14.3 Naming Convention

| Layer     | Format                       | Example                        |
| --------- | ---------------------------- | ------------------------------ |
| Module    | `<module>.<entity>.<action>` | `user-management.user.updated` |
| Extension | `<client>.<entity>.<action>` | `client-a.audit.requested`     |

### 14.4 Rules

- Event names **must** be namespaced.
- Modules **may** emit events that have no listeners.
- Extensions **may** listen to module events.
- Modules **must not** listen to extension events.
- The base **must not** depend on extension events.

---

## 15. Path Mapping & Aliases

### 15.1 Alias Convention

| Alias                             | Resolves to                                     |
| --------------------------------- | ----------------------------------------------- |
| `@arsi/container`                 | `web-container/src/public`                      |
| `@arsi/shared`                    | `web-modules/shared`                            |
| `@arsi/module-*` (wildcard)       | `web-modules/modules/*/public.ts` (extension)   |
| `@arsi/module-*/entry` (wildcard) | `web-modules/modules/*/index.tsx` (container)   |
| `@arsi/extension`                 | `web-container/current-client/src`              |

### 15.2 Wildcard Alias + Generated Loader Map

- `@arsi/module-<name>` → `public.ts` (contract, for extensions) — wildcard, no need to add one per module.
- `@arsi/module-<name>/entry` → `index.tsx` (container entry) — used **only** by `moduleLoaders.generated.ts`, which is generated from the `package.json` `name`.
- The `/entry` pattern must come above the base pattern (Vite & TypeScript pick the first matching pattern).

### 15.3 Single Source of Truth

`aliases.cjs` in each repo. Used by:

- `vite.config.ts` → `resolve.alias`
- `.eslintrc.cjs` → `settings.import/resolver.typescript` (reads `paths` from tsconfig)
- `tsconfig.json` → `paths` (manual, cannot import `.cjs`)

### 15.4 `current-client` Symlink

The container has a symlink:

```
web-container/current-client → ../web-extension-<client>
```

Switch client:

```bash
npm run link:client-a
npm run link:client-b
```

### 15.5 Rules

- Aliases **must** resemble package names (`@arsi/module-user-management`), not simple aliases (`@modules/user`).
- Modules **must not** import other modules.
- Extensions **must not** import a module's internals.
- `current-client` **must** be a symlink, not a copy.

---

## 16. Build & Deployment

Full step-by-step guide for DevOps (build, run Docker, CI, rollback, smoke test): `DEPLOYMENT-GUIDE.en.md`.

### 16.1 Build Locally

```bash
cd web-container
ln -sfn ../web-extension-client-a current-client
npm run build:client-a
```

Output: `web-container/dist/client-a/`.

### 16.2 Docker

Build context = the **workspace root** (the Dockerfile COPYs all 3 repos):

```bash
docker build -f web-container/Dockerfile -t myorg.azurecr.io/arsi-web-client-a:<tag> .
```

Actual Dockerfile (abridged):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY web-container/package.json web-container/package-lock.json ./web-container/
COPY web-modules/package.json web-modules/package-lock.json ./web-modules/
COPY web-modules/shared/package.json ./web-modules/shared/
COPY web-modules/modules/<module>/package.json ./web-modules/modules/<module>/   # one line per module
COPY web-extension-client-a/package.json web-extension-client-a/package-lock.json ./web-extension-client-a/
RUN cd web-container && npm ci
RUN cd web-modules && npm ci
RUN cd web-extension-client-a && npm ci
COPY web-container ./web-container
COPY web-modules ./web-modules
COPY web-extension-client-a ./web-extension-client-a
RUN cd web-container \
    && ln -sfn ../web-extension-client-a current-client \
    && npm run build:client-a

FROM nginx:1.27-alpine
COPY --from=builder /app/web-container/dist/client-a /usr/share/nginx/html
COPY web-container/nginx.conf /etc/nginx/conf.d/default.conf
COPY web-container/docker/entrypoint.sh /docker-entrypoint.d/40-generate-config.sh
EXPOSE 80
```

- New module → add the `COPY` line + run `npm run check:dockerfile` (guard).
- `entrypoint.sh` generates `/config.json` at container start from env (`VITE_CLIENT`, `VITE_MODULES`, `VITE_API_BASE`, `VITE_ENABLE_AUDIT_LIVE`).

### 16.3 Run Container

```bash
docker run -p 8080:80 \
  -e VITE_CLIENT=client-a \
  -e VITE_MODULES=user-management,product-management,module-sample \
  -e VITE_API_BASE=https://staging-api.example.com \
  -e VITE_ENABLE_AUDIT_LIVE=true \
  myorg.azurecr.io/arsi-web-client-a:<tag>
```

### 16.4 Deployment Targets

| Environment | Image            | Config Source             |
| ----------- | ---------------- | ------------------------- |
| Staging     | Same (`<tag>`)   | Container env / compose   |
| Production  | the same image, promoted | Container env / compose |

One image, many environments. Config is injected when the container starts (no rebuild); TLS/reverse proxy is handled by the host. Deployment today is via Docker (Kubernetes is not active yet — see `DEPLOYMENT-GUIDE.en.md` §8).

---

## 17. CI/CD

### 17.1 Pipeline per Client

Each `web-extension-<client>` repo has its own pipeline in Azure DevOps.

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

- `buildContext` **must** be the workspace root (the Dockerfile COPYs 3 repos).
- `check:dockerfile` in the verify stage prevents build failures when a module is missing its COPY line.
- The `KubernetesManifest` step in the original pipeline file is still a **scaffold** (deployment today is Docker). Details: `DEPLOYMENT-GUIDE.en.md` §8.

### 17.2 Pipeline Structure

| Repo                     | Pipeline                                            |
| ------------------------ | --------------------------------------------------- |
| `web-container`          | Build + test container, publish base image          |
| `web-modules`            | Build + test modules, publish artifact              |
| `web-extension-<client>` | Build + test extension, build & deploy client image |
| `web-extension-template` | No pipeline                                         |

### 17.3 Artifacts

- Container: base image
- Modules: npm artifact (optional, for a later registry migration)
- Extension: Docker image per client

---

## 18. Governance

### 18.1 Changes Allowed Without Discussion

- Add a shadcn-ui component in shared.
- Add a new module.
- Add a slot in a module.
- Add a translation.
- Add a route in a module.
- Add a service in a module.
- Add a query key in a module.

### 18.2 Changes Requiring Lead Dev Discussion

- Change a module's public API (breaking).
- Change the shared public API (breaking).
- Change the container public API.
- Change naming conventions.
- Change layer rules.
- Add a new layer.
- Override a module's modal from an extension.
- Override a core service.

### 18.3 Prohibited

- A module importing another module.
- An extension importing a module's internals.
- The container importing a module/extension.
- A module accessing another module's store.
- An extension overriding the global store without discussion.
- A service accessing `deps` directly.
- A module creating its own `QueryClient`.
- Registering a service at module top-level.

### 18.4 Review Checklist

Before merging a PR:

- [ ] Imports only from the allowed layer public APIs.
- [ ] No `deps` access at module top-level.
- [ ] No direct imports of `sonner`, `i18next`, `axios`.
- [ ] `@tanstack/react-query` imports limited to `useQuery`, `useMutation`, `useQueryClient`.
- [ ] No direct imports of `components/ui/...`.
- [ ] Services are factory functions.
- [ ] Query keys use a factory, namespaced.
- [ ] New services are registered in `init(deps)`.
- [ ] Service names are namespaced and unique.
- [ ] Services use path-based URLs.
- [ ] Slot, modal, and event names are namespaced.
- [ ] Translations use i18n.
- [ ] Route paths are unique.
- [ ] No circular dependencies.
- [ ] Public APIs are updated when there are changes.
- [ ] Tests are added.

---

## 19. Development Workflow

### 19.1 Initial Setup

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

### 19.2 Switch Client

```bash
cd web-container
npm run link:client-b
npm run dev:client-b
```

### 19.3 Add a New Module

1. Create a folder in `web-modules/modules/<name>/` (folder name = name in `config.modules`).
2. Create `package.json` (name `@arsi/module-<folder>`), `index.tsx` (default export `init(deps)`), `public.ts`.
3. Create `routes/`, `services/`, `hooks/`, `components/`, `slots.ts`, `queryKeys.ts`, `i18n/`.
4. Run `npm run gen:modules` in web-container (automatic via pre-hooks) — the loader map is generated from the `package.json` name; there are **no** edits to `discover.ts`/aliases/tsconfig.
5. Add `COPY web-modules/modules/<name>/package.json ...` to the Dockerfile + `npm run check:dockerfile`.
6. Add it to `config.modules` (dev: `public/config.json`; production is managed by CI).

### 19.4 Add a New Client

```bash
git clone <web-extension-template-url> web-extension-client-x
cd web-extension-client-x
rm -rf .git && git init

# Edit manifest.json, package.json, .azure-pipelines.yml
# Push to the new repo
# Set up the pipeline in Azure DevOps

cd ../web-container
npm run link:client-x
VITE_CLIENT=client-x VITE_MODULES=user-management npm run dev
```

### 19.5 Override from an Extension

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

| ❌                                         | ✅                                                          |
| ------------------------------------------ | ----------------------------------------------------------- |
| Container imports modules                 | Container discovers via config                              |
| Module imports another module              | Go through the event bus                                    |
| Extension imports a module's internals     | Import from `public.ts`                                     |
| Shared imports container                   | Shared must be pure                                         |
| Module installs a lib across trees without dedupe | Add to `resolve.dedupe` + align versions (CONTRACT §1.6) |

### 20.2 State

| ❌                                  | ✅               |
| ----------------------------------- | ---------------- |
| Module accesses another module's store | Event bus     |
| Extension creates its own QueryClient | Use the container |
| Query keys are not namespaced       | Use a factory    |
| Service accesses `deps` directly    | Factory function |

### 20.3 UI

| ❌                              | ✅                    |
| ------------------------------- | --------------------- |
| Import `components/ui/button`   | Import `@arsi/shared` |
| Create UI components in a module | Add to shared        |
| Define Tailwind config in a module | Use the shared preset |

### 20.4 Config

| ❌                                | ✅             |
| --------------------------------- | -------------- |
| `import.meta.env` in a module     | `deps.config`  |
| Hardcoded URLs                    | Runtime config |
| Config committed for production   | Inject via env |

### 20.5 Init

| ❌                            | ✅                        |
| ----------------------------- | ------------------------- |
| Register service at top-level | Register in `init(deps)`  |
| Subscribe to events at top-level | Subscribe in `init(deps)` |
| Access `deps` at top-level    | Access in a function body |

---

## 21. Roadmap

### 21.1 Phase 1 — Foundation (now)

- ✅ 3 repos + template
- ✅ Container shell
- ✅ Pilot module `user-management`
- ✅ Pilot extension `client-a`
- ✅ Path mapping
- ✅ Runtime config
- ✅ React 19 + shadcn-ui + Zustand + React Query

### 21.2 Phase 2 — Scale

- Second module: `product-management`
- ESLint boundaries plugin
- Contract testing
- Keycloak integration
- Observability (Sentry + correlation ID)
- Health check endpoint in services

### 21.3 Phase 3 — Production Hardening

- Monthly release train
- Formal versioning
- Error handling section in the contract
- Route override + service wrapper samples
- Final CI/CD template
- Performance budget

### 21.4 Phase 4 — Long-term

- Evaluate Azure Artifacts
- Migrate from path mapping to package registry
- Micro-frontend (if needed)
- Automated contract tests in CI
- Automated dependency upgrades

---

## Appendix A — Folder Structure Reference

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
    └── module-sample/           # reference module (12 pages demonstrating dependencies)
        ├── package.json         # name must be @arsi/module-<folder>
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

| Aspect            | Format                               | Example                            |
| ----------------- | ------------------------------------ | ---------------------------------- |
| Repo              | kebab-case                           | `web-extension-client-a`           |
| Module folder     | kebab-case                           | `user-management`                  |
| Component file    | PascalCase                           | `UserTable.tsx`                    |
| Hook file         | camelCase `use*`                     | `useUser.ts`                       |
| Service file      | `service.<name>.ts`                  | `service.user.ts`                  |
| Store file        | `use<Name>Store.ts`                  | `useUserStore.ts`                  |
| Query keys file   | `queryKeys.ts`                       | —                                  |
| Slots file        | `slots.ts`                           | —                                  |
| Public API file   | `public.ts`                          | —                                  |
| Route path        | kebab-case                           | `/users/:id`                       |
| Slot name         | `<module>.<slotName>`                | `user-management.userTableActions` |
| Modal name        | `<module>.<action>`                  | `user-management.create`           |
| Event name        | `<module>.<entity>.<action>`         | `user-management.user.updated`     |
| i18n namespace    | `<module>`                           | `user-management`                  |
| Service name      | `<module>` or `<client>.<service>`   | `user`, `client-a.audit`           |
| Query key root    | `[<module>, <entity>]`               | `['user-management', 'user']`      |
| Store persist key | `<layer>:<name>`                     | `module:user-management`           |
| Docker image      | `<org>-web-<client>`                 | `myorg-web-client-a`               |

---

## Appendix C — Quick Contract

### Container → Module

- The `deps` bag contains all instances.
- Available hooks: `useApi`, `useApiRegistry`, `useEventBus`, `useTranslation`, `useQueryClient`, `useToast`, `useModal`, `useSlot`, `useConfig`, `useLogger`, `useAuth`, `useTheme`, `useLocale`.

### Module → Extension

- `public.ts` — components, hooks, services, routes, query keys, slots.
- Modules **don't know about** extensions.

### Extension → Module

- Import only from `@arsi/module-<name>`.
- Override via slot, route, service wrapper.
- Register new services via `deps.apiRegistry.register()`.

---

**Document version**: 0.2.1
**Last updated**: 2026-10-01

**Changelog:**

- **0.2.1** — Deployment sections (§16/§17) synced with the actual Dockerfile & pipeline (workspace-root build context, `check:dockerfile`, Docker as the deployment target); link to `DEPLOYMENT-GUIDE.en.md`.
- **0.2.0** — Generated loader map (`moduleLoaders.generated.ts` + wildcard aliases), module-sample (reference module), 3-tier extension override (slot → route → service wrapper), and wiring docs sync.
- **0.1.0** — Initial architecture guide. Covers layer architecture, boot sequence, DI, state management, data fetching, service registry, override mechanisms, build & deployment, CI/CD, governance, and development workflow.
