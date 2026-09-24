Fase 1 Scaffold — Complete
File tree created (147 files, excl. node_modules/lockfiles)
arsi-web-workspace/
├── .dockerignore # workspace-root build context for Docker
├── docs/ # untouched
├── web-container/ # 74 files
│ ├── CONTRACT.md (copy) · Dockerfile · nginx.conf · docker/entrypoint.sh
│ ├── aliases.cjs · vite.config.ts · vitest.config.ts · tailwind/postcss.cjs
│ ├── tsconfig.json + tsconfig.node.json · .eslintrc.cjs
│ ├── index.html · public/config.json # runtime config (client-a → dummyjson)
│ ├── current-client → ../web-extension-client-a (symlink)
│ └── src/
│ ├── main.tsx · bootstrap/{index.tsx, discover.ts} # config → deps → discover → router
│ ├── config/ · di/ · api/ · events/ · i18n/(en,id) · query/ · toast/ · modal/
│ ├── slots/ · routes/ · menu/ · logger/ · store/{auth,theme,locale}Store
│ ├── hooks/ (10) · auth/ · theme/ · layout/ (6) · providers/ · styles/globals.css
│ └── public/index.ts # ONLY container public API (hooks + types)
├── web-modules/ # 40 files
│ ├── package.json (workspaces) · tsconfig.json · aliases.cjs · vitest.config.ts · .eslintrc.cjs
│ ├── shared/ # UI kit: 7 shadcn primitives, 3 composites, preset, components.json
│ └── modules/user-management/
│ ├── index.tsx (init) · public.ts (contract) · slots/queryKeys/modals/events/types
│ ├── services/service.user.ts · hooks/useUser.ts · store/useUserStore.ts
│ ├── components/ · pages/ · i18n/{en,id}.json · 5 test files
├── web-extension-client-a/ # 13 files
│ ├── src/index.tsx (init) · manifest.json · .azure-pipelines.yml · aliases.cjs · vitest.config.ts
│ ├── src/components/AuditButton.tsx · src/overrides/user-management/ClientAUserDetail.tsx
│ └── src/i18n/{en,id}.json · .eslintrc.cjs · 1 test file
└── web-extension-template/ # 7 files (empty init, manifest, lint/tsconfig)
Verification (executed)
Check web-container
typecheck ✅ (both tsconfigs)
tests ✅ 22
lint ✅ 0 errors (3 warnings)
build ✅ dist/client-a — module + extension code-split
dev server ✅ /, /config.json, module entry, extension entry all 200 with alias resolution
42 tests total. Build: 464 KB main (gzip 148 KB) + lazy module/extension chunks. Dev smoke: config served (no-store), @arsi/module-user-management/entry and @arsi/extension resolve via /@fs/... (path mapping + server.fs.allow working).
Commands to re-run:
cd web-modules && npm run typecheck && npm test && npm run lint
cd web-container && npm run link:client-a && npm run typecheck && npm test && npm run build:client-a
cd web-container && npm run dev:client-a # manual: login stub → /users → create → /users/:id (client-a override + AuditButton) → theme/locale
Decisions made during implementation (flag for review)
index.tsx over index.ts for module entry — contains JSX (protocol #9); aliases/tsconfig/tests updated.
Modules import react-router-dom directly (useNavigate/useParams/Link) — not in the §2.3 container hook list; alternatives were adding router hooks to container public API (governance item). Currently direct imports, ESLint does not restrict it.
Alias order matters: /entry must precede the base module alias (Vite prefix matching caused a build failure — fixed).
user service registered in init with baseURL: deps.config.apiBase (runtime config, no hardcoded domain) per your DummyJSON decision; deps.api also uses it. Production config should supply the path-based base per §4.5.
Modal components own their Radix Dialog (via shared); ModalHost only mounts the registered component — matches §8.4 "container doesn't care about contents".
Extension registers its own client-a i18n namespace (docs only define module-namespace overrides) — extension-specific strings need a home.
Menu items use i18n key + namespace (small extension of the §5.2 label example so strings pass through i18n).
Container internal imports are relative (not @/), so its sources stay loadable from other repos' bundlers/tests.
@typescript-eslint/no-restricted-imports with allowTypeImports for axios — required to permit §5.2's import type { AxiosInstance }.
Known limitations
Browser-level QA not performed (no browser automation available) — dev-server/asset checks + build only; use the manual checklist above.
Docker build not executed — daemon not running; Dockerfile/nginx/entrypoint authored, shell-syntax-checked, and the entrypoint's config generation tested standalone.
Azure pipeline is scaffold with placeholder org/registry/k8s/staging.yaml.
client-a.audit registered but unused in dev; AuditButton is UI-only (toast/event) until an audit backend exists.
Auth stub (any non-empty credentials); Keycloak = Fase 2. Forms use local state (no react-hook-form).
Shared Dialog's sr-only close label is hardcoded English (shared can't use container i18n).
Node here is v22.17 vs spec 20.x — jsdom 30 engine warnings only; CI/Docker pin Node 20.
No git repos initialized, no commits (not requested). Test coverage is unit/contract-level; no integration render tests through the real container (UI tests mock @arsi/container).
