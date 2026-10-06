# CONTRACT.md

**Version**: 0.1.0
**Location**: `web-container/CONTRACT.md`
**Audience**: Developer `web-container`, `web-modules`, `web-extension-client-<x>`

> This document is a **hard contract**. All code in the three repos must follow the rules here. Contract violation = PR rejected.

---

## Table of Contents

1. Layer & Dependency Rules
2. Access Patterns — deps + hooks
3. State Management — Zustand
4. Service Registry
5. Data Fetching — Axios + React Query
6. i18n — react-i18next
7. Toast — Sonner
8. Modal — Dialog
9. UI Kit — shadcn-ui
10. Tailwind
11. Slots
12. Routes
13. Events
14. Configuration
15. Naming Conventions
16. Versioning
17. Testing
18. Observability
19. Governance
20. Review Checklist

---

## 1. Layer & Dependency Rules

### 1.1 Layer

| Layer     | Repo                         | Responsibility                                                  |
| --------- | ---------------------------- | --------------------------------------------------------------- |
| Container | `web-container`              | Shell: auth, routing, layout, DI, config, API client, event bus |
| Shared    | `web-modules/shared`         | UI kit (shadcn-ui), hooks, utils                                |
| Module    | `web-modules/modules/<name>` | Business features                                               |
| Extension | `web-extension-client-<x>`     | Per-client override                                             |

### 1.2 Dependency Matrix

| From \ To | Container  | Shared | Module     | Extension |
| --------- | ---------- | ------ | ---------- | --------- |
| Container | —          | ✗      | ✗          | ✗         |
| Shared    | ✗          | —      | ✗          | ✗         |
| Module    | ✓ (public) | ✓      | ✗          | ✗         |
| Extension | ✓ (public) | ✓      | ✓ (public) | ✗         |

**Read:** modules may import the container public API and shared. Extensions may import container, shared, and module public APIs.

### 1.3 Hard Rules

- Container **must not** import modules or extensions.
- Shared **must not** import anything from other layers.
- Modules **must not** import other modules.
- Modules **must not** import extensions.
- Extensions **must not** import module internals (only via `public.ts`).
- Extensions **must not** import other extensions.

### 1.4 Public API

Each layer exposes only through specific files:

| Layer                          | Public API                                                      |
| ------------------------------ | --------------------------------------------------------------- |
| Container                      | `src/public/index.ts`                                           |
| Shared                         | `shared/index.ts`                                               |
| Module                         | `modules/<name>/public.ts`                                      |
| Module entry (for container)   | `modules/<name>/index.tsx` via generated loader map (`src/bootstrap/moduleLoaders.generated.ts`) |
| Extension                      | `src/index.tsx` (only default export `init(deps)`)             |

Importing from files outside the public API is a **contract violation**.

### 1.5 Aliases

| Alias                              | Resolves to                            | For whom          |
| ---------------------------------- | -------------------------------------- | ----------------- |
| `@arsi/container`                  | `web-container/src/public`             | Modules & extensions |
| `@arsi/shared`                     | `web-modules/shared`                   | Modules & extensions |
| `@arsi/module-<name>` (wildcard)   | `web-modules/modules/<name>/public.ts` | Extensions        |
| `@arsi/module-<name>/entry` (wildcard) | `web-modules/modules/<name>/index.tsx` | Container (generated loader map) |
| `@arsi/extension`                  | `web-container/current-client/src`     | Container         |

**Rules:**

- Extensions **must** use `@arsi/module-<name>` (public API).
- Container uses `@arsi/module-<name>/entry` **only** from the generated file; adding aliases/paths per module is **forbidden**.
- The `/entry` pattern **must** come before the base pattern in `aliases.cjs`/`tsconfig.json` — Vite & TypeScript pick the first matching pattern.
- Cross-module relative imports are **forbidden**.

### 1.6 Dependency Policy (library/package)

**Package ownership** — install in the owning repo; container does **not** install module/extension dependencies (Vite resolves from the origin tree of the file).

| Package used by | Install in | Example |
| --- | --- | --- |
| Container/shell only | `web-container` | radix dialog, sonner |
| UI kit (modules + extensions) | `web-modules/shared` | radix, lucide, CVA |
| Module features | `web-modules` workspace | `cd web-modules && npm install <pkg> -w @arsi/module-<name>` |
| Client-specific | `web-extension-client-<x>` | axios, react-router-dom |

**Hard rules:**

- `react`/`react-dom` **must** be `peerDependencies`; forbidden as `dependencies` in shared/module/extension.
- Libraries imported by more than one tree (container ↔ module/extension) **must** be listed in `resolve.dedupe` in `web-container/vite.config.ts`; versions aligned (version source = container).
- Libraries based on React context/singleton (router, form, theme, query, state) **must** be a single copy.
- Forbidden to add libraries that duplicate container capabilities: toast, modal, notifications, i18n, React Query, HTTP client, event bus.
- Modules/extensions **must not** have Tailwind/PostCSS config; the Tailwind plugin lives only in `shared/tailwind.preset.cjs`.
- Global CSS from libraries **must not** be imported from modules; import only in `web-container/src/styles/globals.css`.
- The base `Dockerfile` lives at the **root of the base repo** (`arsi-web-base` = `web-container` + `web-modules` + `web-extension-default` + `web-extension-template`); a new workspace package (module) → add `COPY <package.json>` in the root Dockerfile, run `npm run check:dockerfile` in `web-container` (the guard validates the root Dockerfile, including `web-extension-default/package.json`); lockfile **must** be committed.
- Extension repos **do not** add module `COPY` lines — the build consumes the base builder image (`/app/extension`, symlink `current-client -> ../extension`); extensions **must** pin `manifest.json.baseVersion` exactly to the base version (checked by `npm run check:base` during the client image build).

**Mandatory verification when adding a dependency:**

1. `typecheck` + `lint` + `test` + `npm run build` pass (all affected packages).
2. No duplicates in the bundle: `grep node_modules/<pkg> web-container/dist/client-a/assets/*.map` → 1 root.
3. Chunk size doesn't bloat without reason (diff before/after).

**Governance (lead dev discussion):** license (GPL/AGPL), bundle size, maintenance status, `npm audit` results, React 19 support, ESM/tree-shakeable format, and global side effects.

### 1.7 Generated Loader Map

- `web-container/src/bootstrap/moduleLoaders.generated.ts` is **generated** by `scripts/generate-module-loaders.mjs` from `web-modules/modules/*/package.json` (field `name`).
- The generated file **must** be committed and **must not** be edited manually; regenerate via `npm run gen:modules` (automatically via pre-hooks `predev`, `pretypecheck`, `pretest`, `prebuild`).
- Naming convention: folder = name in `config.modules` = suffix of the package `name` (`@arsi/module-<folder>`); a mismatch makes the script fail.
- `discover.ts` only consumes the map — adding a module **does not** change `discover.ts`, `aliases.cjs`, or `tsconfig.json`.
- Sync test (`moduleLoaders.generated.test.ts`) **must** pass — it guarantees the generated file isn't stale.
- Dev server needs a restart after adding a module (loader map is static, not a glob).

---

## 2. Access Patterns — deps + hooks

### 2.1 When to Use `deps`, When to Use Hooks

| Context                           | Use                     |
| --------------------------------- | ----------------------- |
| `init(deps)` — outside React tree | `deps`                  |
| Event listener in `init`          | `deps`                  |
| Route definition in `init`        | `deps`                  |
| Slot registration in `init`       | `deps`                  |
| Service registration in `init`    | `deps`                  |
| Modal registration in `init`      | `deps`                  |
| Component body                    | hooks                   |
| Custom hook                       | hooks                   |
| Utility function                  | parameter, not import   |

### 2.2 Contents of the `deps` Bag

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
  notifications, // Notification service (header bell)
  slots, // Slot registry
  routes, // Route registry
  menu, // Menu registry
};
```

### 2.3 Available Hooks

All hooks are exported from `@arsi/container`:

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
// ❌ Don't — access deps at module top-level
import { deps } from "@arsi/container";
const client = deps.queryClient; // executed at module load
```

```ts
// ✅ Correct — access inside a function/hook
function useUsers() {
  const queryClient = useQueryClient();
  // ...
}
```

---

## 3. State Management — Zustand

### 3.1 Three Kinds of Store

| Store     | Owner     | Example             | Persist  |
| --------- | --------- | ------------------- | -------- |
| Global    | Container | auth, theme, locale | Yes      |
| Module    | Module    | `useUserStore`      | Optional |
| Extension | Extension | `useClientAStore`   | Optional |

### 3.2 Rules

- Every module **must** have its own store for module state.
- Modules **must not** access another module's store.
- Cross-module communication goes through the **event bus**, not a shared store.
- Extensions **may** access the global store via container hooks.
- Extensions **may** access a module store via hooks exposed by the module in `public.ts`.
- Persist key **must** be namespaced: `<layer>:<name>`.

### 3.3 Module Pattern

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

Export in `public.ts`:

```ts
export { useUserStore } from "./store/useUserStore";
```

Extension usage:

```ts
import { useUserStore } from "@arsi/module-user-management";

function ClientAComponent() {
  const selectedId = useUserStore((s) => s.selectedId);
}
```

### 3.4 When to Use Zustand vs React Query

| Data                                 | Use                           |
| ------------------------------------ | ----------------------------- |
| Server data (list, detail)           | React Query                   |
| UI state (modal open, selected item) | Zustand                       |
| Form state                           | Local state / react-hook-form |
| Auth, theme, locale                  | Global Zustand                |
| Session data                         | Zustand + persist             |

**Rule:** if data comes from an API, use React Query. If it's purely UI state, use Zustand.

### 3.5 DevTools

Enable the `devtools` middleware in dev, disable it in production.

---

## 4. Service Registry

### 4.1 Concept

Container provides:

- **`deps.api`** — default axios instance, without a specific baseURL.
- **`deps.apiRegistry`** — registry for services with different configs.

The service registry is useful for:

- Scoped baseURL per service (path-based nginx).
- Per-service config (timeout, retry, headers).
- Per-service circuit breaker (later).
- Per-service observability (later).

### 4.2 When to Use `api` vs `apiRegistry`

| Need                               | Use                |
| ---------------------------------- | ------------------ |
| Simple endpoint, single baseURL    | `deps.api`         |
| Service with a different baseURL   | `deps.apiRegistry` |
| Service with a different config    | `deps.apiRegistry` |
| Service registered by an extension | `deps.apiRegistry` |

### 4.3 Register Service

Modules register services in `init(deps)`:

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

Extension registers a new service:

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

### 4.4 Use Service

```ts
// In init(deps)
const user = await deps.apiRegistry.get("user").get("/users/1");
```

```tsx
// In component
const apiRegistry = useApiRegistry();
const user = await apiRegistry.get("user").get("/users/1");
```

### 4.5 Rules

- Service names **must** be unique. If duplicated, `register` throws an error.
- Service names **must** be namespaced: `<module>` or `<client>.<service>`.
- Core services (`auth`, `user`) **must** be registered in base.
- Extensions **must not** override core services.
- Registration **must** happen in `init(deps)`, not in a component or at module top-level.
- Services **must** use path-based URLs (`/api/<service>`), not full domains.

### 4.6 Naming Convention

| Service              | Owner                    | Name                 |
| -------------------- | ------------------------ | -------------------- |
| Auth                 | Container                | `auth`               |
| User management      | Module `user-management` | `user`               |
| Order management     | Module `order-management`| `order`              |
| Audit (client A)     | Extension client-a       | `client-a.audit`     |
| Reporting (client A) | Extension client-a       | `client-a.reporting` |

### 4.7 Anti-pattern

```ts
// ❌ Register at module top-level
import axios from "axios";
deps.apiRegistry.register("user", axios.create({ baseURL: "/api/user" }));

// ❌ Use a full domain
deps.apiRegistry.register(
  "user",
  axios.create({ baseURL: "https://user.api.example.com" }),
);

// ❌ Override a core service
deps.apiRegistry.register("auth", customAuthClient);

// ✅ Correct — register in init
async function init(deps) {
  deps.apiRegistry.register("user", axios.create({ baseURL: "/api/user" }));
}
```

---

## 5. Data Fetching — Axios + React Query

### 5.1 Division of Responsibility

| Layer       | Responsibility                         |
| ----------- | -------------------------------------- |
| Axios       | HTTP request, interceptor, auth header |
| React Query | Cache, stale, loading/error state      |
| Service     | Combination of axios + business logic  |
| Hook        | Wrap service with React Query          |

### 5.2 Service Pattern — Factory Function

Services **must** be **factory functions** that take an axios instance as a parameter.

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

**Rules:**

- Services **must not** access `deps` directly.
- Services **must not** import React.
- Services **must not** import `@tanstack/react-query`.
- Services **must** be pure — take parameters, return data.

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

Query keys **must** be namespaced and use a factory:

```ts
// modules/user-management/queryKeys.ts
export const userKeys = {
  all: ["user-management", "user"] as const,
  list: (params?: any) => [...userKeys.all, "list", params] as const,
  detail: (id: string | number) => [...userKeys.all, "detail", id] as const,
};
```

Export in `public.ts` so extensions can invalidate:

```ts
// modules/user-management/public.ts
export { userKeys } from "./queryKeys";
```

Extension usage:

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

Container inits `queryClient` and renders `QueryClientProvider` at the root. Modules and extensions **must not** create their own `QueryClient`.

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

- Mutations live in modules, not in extensions.
- Extensions that need custom mutations create their own hooks in the extension.
- Mutations **must** invalidate the relevant query keys.

### 5.7 Rules

- Modules **must not** import `axios` directly (except in `init` for service registration).
- Modules **may** import `useQuery`, `useMutation`, `useQueryClient` from container.
- **Must** use `useApi`, `useApiRegistry`, `useQueryClient` from container.
- Query keys **must** be unique per module.
- Query keys **must** use a factory.
- Services **must** be factory functions.

### 5.8 Anti-pattern

```ts
// ❌ Service accesses deps directly
import { deps } from "@arsi/container";
export const userService = {
  list: () => deps.api.get("/users"),
};

// ❌ Hook uses axios directly
import axios from "axios";
export function useUserList() {
  return useQuery({
    queryFn: () => axios.get("/users"),
  });
}

// ❌ Create your own QueryClient
const queryClient = new QueryClient();

// ❌ Query key not namespaced
useQuery({ queryKey: ["users"] });

// ✅ Correct
useQuery({ queryKey: userKeys.list(params) });
```

---

## 6. i18n — react-i18next

### 6.1 Namespace Convention

| Layer     | Namespace                  | Example                 |
| --------- | -------------------------- | ----------------------- |
| Container | `common`, `auth`, `errors` | `common.ok`             |
| Module    | `<module-name>`            | `user-management.title` |
| Extension | `<module-name>` (override) | `user-management.title` |

### 6.2 Register Resource

Modules register in `init`:

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

### 6.3 Use in Component

```tsx
import { useTranslation } from "@arsi/container";

function UserTable() {
  const { t } = useTranslation("user-management");
  return <h1>{t("title")}</h1>;
}
```

### 6.4 Rules

- Namespaces **must** be unique per module.
- Extensions **may** override module namespaces.
- Extensions **must not** override the `common` namespace unless agreed.
- Translation keys **must** be descriptive, not `text1`, `text2`.
- UI messages **must** use i18n, not hardcoded strings.

---

## 7. Toast — Sonner

### 7.1 Default

Container exposes:

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

### 7.2 Custom per Module

Modules may use `toast.custom()` to render their own components. No need to register a renderer.

### 7.3 Rules

- Toasts **must** use `deps.toast` or `useToast`, not `sonner` directly.
- Extensions **may** override with `toast.custom()`.
- Toast messages **must** use i18n, not hardcoded.

### 7.4 Notifications (Bell Header)

Persistent notifications (bell in the container Topbar). Modules/extensions **push** notifications; the container renders them.

```ts
// In init (non-React)
deps.notifications.push({ title: '...', message: '...', variant: 'info', source: 'user-management' });

// In component
const { push, notifications, unreadCount } = useNotifications();
push({ title: t('notifications.sample.title'), variant: 'success', source: 'client-a' });
```

Data shape:

```ts
interface NotificationInput {
  title: string;                                  // required
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'error'; // default 'info'
  source?: string;                                // '<module>' | '<client>' | 'container'
}
```

Rules:

- Notifications **must** use `deps.notifications` or `useNotifications`, not a homemade store/event.
- `source` **must** be filled with the module/extension namespace so the notification origin is clear in the panel.
- Title/message **must** be i18n (own module/extension namespace).
- In-memory list, maximum 50 most recent items; backend/websocket just calls `push` (doesn't change the UI).
- Container **must not** import `@arsi/shared`; the bell uses container styling tokens.

---

## 8. Modal — Dialog

### 8.1 Default

Container provides a modal service:

```ts
deps.modal.register("user-management.create", CreateUserDialog);
deps.modal.open("user-management.create", { onSuccess: () => {} });
deps.modal.close("user-management.create");
```

### 8.2 Register in `init`

```ts
async function init(deps) {
  deps.modal.register("user-management.create", CreateUserDialog);
}
```

### 8.3 Open from Component

```tsx
const modal = useModal();
modal.open("user-management.create", { onSuccess: () => {} });
```

### 8.4 Custom per Module

Modules may register their own modal components. The container doesn't care about the contents.

### 8.5 Rules

- Modal names **must** be namespaced: `<module>.<action>`.
- Modals **must** be registered in `init`, not in a component.
- Extensions **may** register modals with their own names.
- Extensions **may** override module modals by re-registering (must be agreed by lead dev).

---

## 9. UI Kit — shadcn-ui

### 9.1 Location

- shadcn-ui primitives: `web-modules/shared/components/ui/`
- Composite components: `web-modules/shared/components/composite/`
- Public API: `web-modules/shared/index.ts`

### 9.2 Import

```tsx
import { Button, Input, Dialog, DataTable } from "@arsi/shared";
```

### 9.3 Add New Component

Run the CLI in `web-modules/shared`:

```bash
cd web-modules/shared
npx shadcn@latest add <component>
```

Components automatically go into `components/ui/`.

### 9.4 Rules

- Modules **must** use components from `@arsi/shared`.
- Modules **must not** import shadcn-ui directly from `components/ui/...`.
- Extensions **must** use components from `@arsi/shared`.
- If you need a new component, **add it to shared**, don't create it in a module.
- Container **must not** import `@arsi/shared` — container is self-contained (enforced by ESLint `no-restricted-imports`). Container shell styling uses utility tokens directly.

**Exception:** components that are highly module-specific (e.g. `UserTable`) may live in the module.

---

## 10. Tailwind

### 10.1 Config

- Preset: `web-modules/shared/tailwind.preset.cjs`
- Config: `web-container/tailwind.config.cjs` extends the preset
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

### 10.3 Rules

- Theme (colors, radius) in container CSS variables.
- Modules **must not** define their own Tailwind config.
- Extensions **must not** define their own Tailwind config.
- If you need a new utility, add it to the shared preset.

### 10.4 Brand Token — ARSI Purple

Brand color: **`#551AB9`** (deep/royal purple). Token values may only be changed in `globals.css`.

| Role                            | Light     | Dark      |
| ------------------------------- | --------- | --------- |
| Primary (action/active/focus)   | `#551AB9` | `#A78BFA` |
| Primary hover                   | `#3D0F8A` | `#B9A5FC` |
| Primary light (accent)          | `#8B5CF6` | `#A78BFA` |
| Accent (hover/selected surface) | `#F3EEFC` | `#2A2340` |
| Background                      | `#F8F9FB` | `#13111C` |
| Surface (card/popover)          | `#FFFFFF` | `#1E1B2E` |
| Border                          | `#E5E7EB` | `#2D2A3D` |
| Text primary / secondary        | `#1F2937` / `#6B7280` | `#F3F4F6` / `#9CA3AF` |
| Success / Warning / Info / Danger | `#16A34A` / `#F59E0B` / `#0EA5E9` / `#DC2626` | same |

Usage rules:

- Semantic tokens have `-strong` variants (`text-success-strong`, etc.): darker in light, brighter in dark — same utility class, automatically correct in both themes.
- Status badges use the tint pattern: `bg-success/10 text-success-strong border-success/20`.
- Avoid `text-muted-foreground` on top of `bg-muted` (marginal contrast 4.39:1).
- Focus visible: `ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Don't use the `dark:` utility in app source — theming only via tokens that flip.
- Font: Plus Jakarta Sans (self-host `@fontsource-variable/plus-jakarta-sans`, imported from `globals.css`).
- Contrast & palette are guarded by the test `web-container/src/styles/tokens.test.ts` (palette ±1 channel + 21 WCAG pairs).

---

## 11. Slots

### 11.1 Definition

Slots are **extension points** exposed by modules. Extensions can fill slots with their own components.

### 11.2 Module Defines Slot

```ts
// modules/user-management/slots.ts
export const userSlots = {
  userTableActions: "user-management.userTableActions",
  userDetailSidebar: "user-management.userDetailSidebar",
} as const;
```

### 11.3 Module Uses Slot

```tsx
import { useSlot } from "@arsi/container";
import { userSlots } from "../slots";

function UserTable() {
  const ExtraActions = useSlot(userSlots.userTableActions);
  return <>{ExtraActions && <ExtraActions user={row} />}</>;
}
```

### 11.4 Extension Fills Slot

```ts
// web-extension-client-a/src/index.tsx
import { userSlots } from "@arsi/module-user-management";

export default async function init(deps) {
  deps.slots.register(userSlots.userTableActions, AuditButton);
}
```

### 11.5 Rules

- Slot names **must** be namespaced: `<module>.<slotName>`.
- Slots **must** be declared in the module's `slots.ts` and exported in `public.ts`.
- Extensions **must not** fill slots that aren't declared.
- Extensions **must not** register the same slot twice.
- Slots **must** be registered in `init(deps)`.

---

## 12. Routes

### 12.1 Add Route (from Module)

```ts
deps.routes.add({
  path: '/users',
  element: <UserTable />,
  meta: { group: 'user', module: 'user-management' },
});
```

### 12.2 Override Route (from Extension)

```ts
deps.routes.override('/users/:id', {
  element: <ClientAUserDetail />,
});
```

### 12.3 Add Route (from Extension)

```ts
deps.routes.add({
  path: '/users/:id/audit',
  element: <ClientAUserAudit />,
  meta: { group: 'user', module: 'user-management' },
});
```

### 12.4 Rules

- Route paths **must** be unique. If duplicated, error.
- Extensions **may** override module routes.
- Extensions **may** add new routes.
- New routes **must** have `meta.module` for tracking.
- Route paths **must** be consistent with the module prefix.
- Routes **must** be registered in `init(deps)`.

---

## 13. Events

### 13.1 Event Bus

```ts
deps.events.on("user-management.user.updated", (payload) => {
  /* ... */
});
deps.events.emit("user-management.user.updated", { id: 1 });
```

Container → module (example: global search in the Topbar):

```ts
// Container component
const events = useEventBus();
events.emit("container.search.changed", { query: "phone" });

// Module init
deps.events.on<ContainerSearchPayload>(containerEvents.searchChanged, ({ query }) => {
  useProductStore.getState().setSearch(query);
});
```

Constants (`containerEvents`) and payload type (`ContainerSearchPayload`) are exported from `@arsi/container`.

### 13.2 Naming Convention

| Layer     | Format                        | Example                        |
| --------- | ----------------------------- | ------------------------------ |
| Container | `container.<entity>.<action>` | `container.search.changed`     |
| Module    | `<module>.<entity>.<action>`  | `user-management.user.updated` |
| Extension | `<client>.<entity>.<action>`  | `client-a.audit.requested`     |

### 13.3 Rules

- Event names **must** be namespaced.
- Modules **may** emit events that have no listeners.
- Extensions **may** listen to module events.
- Modules **must not** listen to extension events.
- Container **may** emit events; modules/extensions **may** listen to container events.
- Container **must not** listen to module/extension events (base doesn't depend upward).
- Base **must not** depend on extension events.
- Event listeners **must** be registered in `init(deps)`, not at module top-level.

---

## 14. Configuration

### 14.1 Config Sources

| Environment | Source                                                  |
| ----------- | ------------------------------------------------------- |
| Local dev   | env-driven dev server (mirrors production); `public/config.json` = fallback |
| Production  | `/config.json` generated by the entrypoint from env variables (`VITE_*`, including `registryAdminUrl` from `VITE_REGISTRY_ADMIN_URL`; full override via `VITE_CONFIG_JSON`) |

### 14.2 Config Structure

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

### 14.3 Rules

- Container **must** load config from `/config.json` at boot, before bootstrap.
- Container **must** fetch with `cache: 'no-store'`.
- Modules and extensions **must not** fetch `/config.json` themselves.
- Modules and extensions access config via `deps.config` or `useConfig()`.
- Env variables **must not** be used in modules/extensions (`import.meta.env.VITE_*` forbidden).
- `VITE_CONFIG_JSON` **may** be used in production for a full `config.json` override (JSON object; individual envs are ignored when set). This is a **container runtime** env, not `import.meta.env` — the env ban for modules/extensions still applies.
- Config **must** have default fallbacks so the app can boot when the fetch fails.
- The core module `registry-admin` provides route `/system/modules`; all module management actions (upload, enable/disable, delete) **require** the service token (`ADMIN_TOKEN`) via the `Authorization: Bearer` header — route visibility is not access control (RBAC follows in `phase.02-rbac-navigation.md`).

---

## 15. Naming Conventions

| Aspect                 | Format                               | Example                                   |
| ---------------------- | ------------------------------------ | ----------------------------------------- |
| Repo                   | kebab-case                           | `web-container`, `web-extension-client-a` |
| Module folder          | kebab-case                           | `user-management`                         |
| Component file         | PascalCase                           | `UserTable.tsx`                           |
| Hook file              | camelCase, prefix `use`              | `useUser.ts`                              |
| Service file           | `service.<name>.ts`                  | `service.user.ts`                         |
| Store file             | `use<Name>Store.ts`                  | `useUserStore.ts`                         |
| Slot file              | `slots.ts`                           | —                                         |
| Query keys file        | `queryKeys.ts`                       | —                                         |
| Public API file        | `public.ts`                          | —                                         |
| Config file (CommonJS) | `.cjs`                               | `aliases.cjs`, `tailwind.config.cjs`      |
| File with JSX          | `.tsx`                               | `bootstrap.tsx`, `AppShell.tsx`           |
| Route path             | kebab-case                           | `/users/:id`                              |
| Slot name              | `<module>.<slotName>`                | `user-management.userTableActions`        |
| Modal name             | `<module>.<action>`                  | `user-management.create`                  |
| Event name             | `<module>.<entity>.<action>`         | `user-management.user.updated`            |
| i18n namespace         | `<module>`                           | `user-management`                         |
| Service name           | `<module>` or `<client>.<service>`   | `user`, `client-a.audit`                  |
| Query key root         | `[<module>, <entity>]`               | `['user-management', 'user']`             |
| Store persist key      | `<layer>:<name>`                     | `module:user-management`                  |
| Base repo              | `arsi-web-base`                      | `arsi-web-base`                           |
| Client repo            | `arsi-web-client-<x>`                | `arsi-web-client-bca`                     |
| Client id (`manifest`) | `client-<x>`                         | `client-bca`                              |
| Docker image           | `<org>/arsi-web-base` (base), `<org>/arsi-web-<client>` (client) | `<org>/arsi-web-base`, `<org>/arsi-web-client-bca` |
| Docker image tag       | `<ver>` (runtime), `<ver>-builder` (builder) | `0.1.0`, `0.1.0-builder`                  |

---

## 16. Versioning

### 16.1 Versions

- Container: semver
- Shared: semver
- Module: semver
- Extension: semver per client

### 16.2 Extension Manifest

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

### 16.3 Rules

- Breaking change in a module's public API = major version.
- Breaking change in shared = major version.
- Extensions **must** declare `baseVersion` (exact pin to `web-container/package.json:version` — currently `0.1.0`) and `modules`.
- The client image build **must** run `npm run check:base` in the builder image; a `baseVersion` mismatch = build failure.

---

## 17. Testing

### 17.1 Levels

| Level          | Focus                           |
| -------------- | ------------------------------- |
| Module unit    | Service, hook, store, component |
| Extension unit | Override, slot, components      |
| Integration    | Module + extension in container |
| Contract       | Module public API               |

### 17.2 Rules

- Modules **must** have tests for the public API.
- Extensions **must** have tests for overrides.
- Contract tests **must** exist for every module that is overridden.

---

## 18. Observability

### 18.1 Error Report

Every error report **must** contain:

| Field            | Source            |
| ---------------- | ----------------- |
| `client_id`      | Build metadata    |
| `app_version`    | Build metadata    |
| `module_name`    | Error context     |
| `module_version` | Build metadata    |
| `correlation_id` | Frontend-generated |
| `route`          | Router            |
| `stack`          | Error             |

### 18.2 Correlation ID

Every HTTP request **must** carry:

- `X-Request-Id` — unique per HTTP request.
- `X-Correlation-Id` — the same for one user journey.

---

## 19. Governance

### 19.1 What Can Be Changed Without Discussion

- Add shadcn-ui components in shared.
- Add a new module.
- Add a slot in a module.
- Add translations.
- Add a route in a module.
- Add a service in a module.
- Add a query key in a module.

### 19.2 What Requires Lead Dev Discussion

- Change a module's public API (breaking).
- Change shared public API (breaking).
- Change container public API.
- Change naming conventions.
- Change layer rules.
- Add a new layer.
- Override a module modal from an extension.
- Override a core service.

### 19.3 What Is Forbidden

- Module importing another module.
- Extension importing module internals.
- Container importing modules/extensions.
- Module accessing another module's store.
- Extension overriding the global store without discussion.
- Service accessing `deps` directly.
- Module creating its own `QueryClient`.
- Registering a service at module top-level.
- Subscribing to events at module top-level.
- Accessing `deps` at module top-level.
- Importing `axios`, `sonner`, `i18next` directly in modules/extensions.

---

## 20. Review Checklist

Before merging a PR:

- [ ] Imports only from allowed public API layers.
- [ ] No `deps` access at module top-level.
- [ ] No direct imports of `sonner`, `i18next`, `axios` (except in `init` for service registration).
- [ ] `@tanstack/react-query` imports limited to `useQuery`, `useMutation`, `useQueryClient`.
- [ ] No direct imports of `components/ui/...` — use `@arsi/shared`.
- [ ] Services are factory functions, not singletons.
- [ ] Services don't access `deps` directly.
- [ ] Query keys use a factory, are namespaced.
- [ ] Query key factory is exported in `public.ts` if extensions need to invalidate.
- [ ] New services are registered in `init(deps)`, not at top-level.
- [ ] Service names are namespaced and unique.
- [ ] Services use path-based URLs, not full domains.
- [ ] Core services are not overridden.
- [ ] Slot names are namespaced.
- [ ] Modal names are namespaced.
- [ ] Event names are namespaced.
- [ ] Translations use i18n, not hardcoded.
- [ ] Route paths are unique.
- [ ] No circular dependencies.
- [ ] Public API is updated if there are changes.
- [ ] Tests are added.
- [ ] Config files use `.cjs`.
- [ ] Files with JSX use `.tsx`.
- [ ] `init(deps)` is idempotent (can be called twice without error).

---

**Document version**: 0.7.4
**Last updated**: 2026-10-06

**Changelog:**

- **0.7.4** — Module registry admin: `registryAdminUrl` config (`VITE_REGISTRY_ADMIN_URL`), core module `registry-admin` (route `/system/modules`, actions require the service token) + `MODULE-REGISTRY-GUIDE.en.md` guide; §14.1/§14.3 updated.
- **0.7.3** — Env-driven dev: generic `dev`/`build` scripts read the `current-client` symlink (or `VITE_CLIENT` from `.env`); the dev `/config.json` is generated by the dev server from env (same mapping as production, including `VITE_CONFIG_JSON`); per-client scripts removed; §14.1 updated.
- **0.7.2** — Repo structure: default extension `web-extension-base` → `web-extension-default` (package `@arsi/extension-default`); client repo `arsi-web-client-<x>` (checkout `web-extension-client-<x>`, client id `client-<x>`); `web-extension-template` is part of the base repo; `npm run link:base` script for the base. §1.6/§15 rules updated.
- **0.7.1** — Full `config.json` override via the `VITE_CONFIG_JSON` runtime env (base entrypoint, fail-fast validation, individual envs ignored when set); §14.1/§14.3 rules updated.
- **0.7.0** — Base image & extension deployment: Dockerfile moved to the base repo root (`arsi-web-base`) with a multi-target base image (builder + runtime, Node 22 builder); extensions `FROM` the base image with no module `COPY` lines; `manifest.json.baseVersion` exact pin + `check:base` guard during the extension build; Docker rules in §1.6/§15/§16 updated.
- **0.6.0** — Generated Loader Map (§1.7): map entry generated from `package.json` name, wildcard alias (§1.5), sync test, pre-hooks; adding a module doesn't touch `discover.ts`/aliases/tsconfig.
- **0.5.0** — Dependency Policy (§1.6): package ownership, peer/dedupe rules, prohibition on duplicating container capabilities, CSS/Tailwind rules, Docker `check:dockerfile`, and bundle duplicate verification.
- **0.4.0** — Container → module event (`containerEvents` / `ContainerSearchPayload`), global search in the Topbar as a sample; rules in §13.
- **0.3.0** — Notification service (`deps.notifications` / `useNotifications`) + container header bell; rules in §7.4.
- **0.2.0** — ARSI Purple brand token (`#551AB9`) for light+dark, semantic tokens (`success`/`warning`/`info` + `-strong` variants), self-hosted Plus Jakarta Sans font, `Card` component in shared, and self-contained container rules (no `@arsi/shared` import) in §9.4/§10.4.
- **0.1.0** — Initial contract. Covers 20 sections: layer rules, access patterns, state management (Zustand), service registry, data fetching (Axios + React Query), i18n, toast, modal, UI kit, Tailwind, slots, routes, events, configuration, naming conventions, versioning, testing, observability, governance, and review checklist.

---
