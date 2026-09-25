# Fase 2 Plan — Keycloak RBAC & Navigasi Berbasis Database

**Status:** Draft — menunggu review, **implementasi ditunda**
**Tanggal:** 2026-09-25
**Terkait:** `ARCHITECTURE.md` §21.2 (Fase 2), `CONTRACT.md` §9/§10, `DEVELOPER-GUIDE.md`
**Konteks:** Backend memakai Keycloak RBAC. Navigasi/menu produksi dimuat dari database dan difilter berdasarkan role.

---

## 0. Keputusan yang Sudah Dikunci

| Topik | Keputusan |
| --- | --- |
| Otoritas otorisasi | Backend + Keycloak. Frontend hanya UX (hide menu). Backend tetap 403 per endpoint. |
| Model frontend | Frontend memakai **permission key** (`product.read`, `user.manage`), bukan nama role Keycloak, kecuali diputuskan lain (lihat §11). |
| Navigasi produksi | **DB-driven**: server memfilter menu berdasarkan role dari token. |
| Navigasi dev/fallback | Registry `menu.register` di kode tetap ada sebagai default dev + fallback saat API gagal. |
| Label menu | **i18n key saja** (`namespace:key`, mis. `user-management:menu.users`). Tanpa tabel terjemahan. Admin bisa ubah struktur/urutan/visibility/role tanpa deploy; teks baru butuh key baru di bundle. |
| Struktur menu | Maksimal **2 level** (group + item). |
| Render sidebar | Accordion group, auto-expand group yang memuat route aktif, persist preferensi. |
| Guard route | Dari `meta.permissions` yang dideklarasikan kode, **deny-by-default**. Menu DB bukan pengaman. |
| Identitas menu | DB merujuk `navKey` stabil yang dideklarasikan route kode — bukan path/komponen bebas. |

---

## 1. Arsitektur Target

```
Bootstrap
  └─ module init(deps): routes.add({ path, element, meta: { navKey, permissions } })
       + menu.register(...)  ← default dev & fallback produksi
  └─ router dibuat (route wajib terdaftar sinkron; menu tidak memblok router)

Runtime
  keycloak.init(check-sso) → session { user, roles, permissions }
       ↓
  GET /api/navigation (Bearer token)
       ↓  server filter by role (otoritas)
  Resolver: validasi tiap node
       ├─ navKey ada di route inventory?  ── tidak → hide + telemetry
       └─ labelKey ada di bundle i18n?    ── tidak → hide + warning (dev)
       ↓
  Sidebar (2 level, accordion)  +  Route guard (meta.permissions, deny-by-default)
       ↓
  API gagal → fallback static menu (menu.register) + filter permission client-side
```

Prinsip: **DB memiliki struktur navigasi; kode memiliki inventory route/komponen + aturan permission.**

---

## 2. Kontrak & Interface

### 2.1 Config runtime (`AppConfig`)

```ts
interface AppConfig {
  client: string;
  modules: string[];
  apiBase: string;
  featureFlags?: Record<string, boolean>;
  auth: {
    url: string;      // https://sso.example.com
    realm: string;    // arsi
    clientId: string; // arsi-web
    /** 'keycloak' | 'mock' — mock hanya untuk dev/test lokal */
    mode?: 'keycloak' | 'mock';
  };
}
```

- `public/config.json` + `docker/entrypoint.sh` menambah env: `VITE_AUTH_URL`, `VITE_AUTH_REALM`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_MODE`.
- `loadConfig.normalizeConfig` memvalidasi blok `auth`; fallback `mode: 'mock'` bila tidak lengkap (dev tetap jalan tanpa Keycloak).

### 2.2 Session (pengganti `authStore` stub)

```ts
type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthUser {
  id: string;          // token.sub
  username: string;    // preferred_username
  displayName: string; // name ?? preferred_username
  email?: string;
}

interface AuthState {
  status: SessionStatus;
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  login: () => Promise<void>;   // redirect ke Keycloak (atau mock login)
  logout: () => Promise<void>;  // end_session_endpoint (atau clear lokal)
  hasRole: (role: string) => boolean;
  can: (permission: string) => boolean;
}
```

- Abstraksi `SessionService` di `src/auth/session/`:
  - `KeycloakSessionService` (produksi) — `keycloak-js`, Authorization Code + PKCE, `check-sso`, `updateToken(30)`, `logout` ke end-session.
  - `MockSessionService` (dev/test) — role/permission dari config/URL untuk keperluan QA.
- Token **tidak** ditaruh di persist localStorage; simpan di memori service + refresh otomatis. Persist hanya user ringan untuk menghindari flicker.
- `ProtectedRoute` → `SessionGate`: `loading` render skeleton/blank, `unauthenticated` redirect `/login` (bawa `state.from`), `authenticated` render anak.

### 2.3 Route & Menu (perluasan kontrak)

```ts
interface RouteMeta {
  group?: string;
  module?: string;
  navKey?: string;            // kunci stabil untuk DB navigation
  permissions?: string[];     // deny-by-default untuk route non-index
  public?: boolean;           // true = tidak butuh permission (mis. /403)
}

interface MenuItemDefinition {
  path: string;
  label: string;
  namespace?: string;
  order?: number;
  navKey?: string;
  group?: string;             // id group (2 level)
  permissions?: string[];     // untuk filter fallback client-side
}

interface MenuGroupDefinition {
  id: string;
  label: string;              // i18n key
  namespace?: string;
  order?: number;
  permissions?: string[];
}
```

`MenuRegistry` bertambah: `registerGroup(def)`, `getGroups()`, `getAll()` tetap (item flat dengan `group?`). Aturan baru:

- Duplikat `id` group → throw (pola `[menu] ... already registered`).
- Item dengan `group` tak dikenal → throw saat `getAll()`/validasi bootstrap (fail-fast di dev).
- Depth 2 dipaksa: registry tidak menerima `children`.

### 2.4 API `GET /api/navigation`

Request: `Authorization: Bearer <access_token>`; opsional `If-None-Match` (ETag).

```json
{
  "version": "2026-09-25T10:00:00Z",
  "items": [
    {
      "navKey": "system",
      "labelKey": "common:nav.groups.system",
      "icon": "settings",
      "order": 90,
      "children": [
        { "navKey": "user-management.users", "labelKey": "user-management:menu.users", "icon": "users", "order": 10 },
        { "navKey": "system.roles", "labelKey": "common:nav.roles", "icon": "shield", "order": 20 },
        { "navKey": "system.settings", "labelKey": "common:nav.settings", "icon": "sliders", "order": 30 }
      ]
    }
  ]
}
```

- Server **sudah** memfilter berdasarkan role token; item tanpa akses tidak dikirim.
- `icon` opsional: hanya nama dari allowlist container (map nama → inline SVG). Tidak ada import dinamis dari data.
- Error: 401 (token invalid → refresh/logout), 403 (diperlakukan sebagai menu kosong + log), 5xx/network (`ApiError`).

### 2.5 Skema DB (sketch) & Keycloak

```sql
CREATE TABLE nav_items (
  id              BIGSERIAL PRIMARY KEY,
  client_id       TEXT NOT NULL,            -- multi-client
  parent_id       BIGINT REFERENCES nav_items(id),
  nav_key         TEXT NOT NULL,            -- merujuk route inventory kode
  label_key       TEXT NOT NULL,            -- 'namespace:key'
  icon            TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
  min_app_version TEXT,                     -- feature gating rilis
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, nav_key)
);

CREATE TABLE nav_item_roles (
  nav_item_id BIGINT NOT NULL REFERENCES nav_items(id) ON DELETE CASCADE,
  role_code   TEXT NOT NULL,                -- realm/client role Keycloak
  PRIMARY KEY (nav_item_id, role_code)
);
```

- Depth 2 divalidasi server (`parent_id` hanya boleh menunjuk node root).
- Item tanpa row `nav_item_roles` = tidak terlihat oleh siapa pun (fail-closed) atau berlaku untuk semua (keputusan di §11).
- Tidak ada tabel terjemahan (keputusan §0).

---

## 3. Fase 2a — Keycloak & Session

**Estimasi:** M (3–5 hari)

### Deliverables

- Dependency: `keycloak-js` + tipe; `AppConfig.auth` + `entrypoint.sh` + `public/config.json` + `loadConfig` + tests.
- `src/auth/session/` — `SessionService`, `KeycloakSessionService`, `MockSessionService`, `createSessionService(config)`.
- `authStore` baru (status machine) + hook `useCan`, `useSession`; `AuthUser`.
- `SessionGate` menggantikan `ProtectedRoute`; route `/login` jadi halaman "mengalihkan ke SSO" (bukan form kredensial), tetap dipakai sebagai landing `post_logout_redirect_uri`.
- Axios: request interceptor Bearer; response interceptor 401 → `updateToken` → retry sekali → gagal = `logout()`; 403 → toast error (`errors.forbidden` — key baru en/id).
- Topbar: sign-out memanggil Keycloak `logout()`; tampilkan `user.displayName`.
- Dev: opsi `docker/keycloak/` (container + realm export `arsi` + client `arsi-web` + user demo) **atau** `mode: 'mock'` untuk dev tanpa Keycloak.
- Docs: CONTRACT §Auth + DEVELOPER-GUIDE setup dev Keycloak.

### Acceptance

- Refresh halaman saat sesi valid → tidak dilempar ke `/login`.
- Deep link ke halaman terlindungi saat belum login → redirect SSO → kembali ke halaman asal (`state.from`).
- Token expired saat request → refresh otomatis tanpa interaksi user.
- Logout → sesi SSO Keycloak ikut berakhir (bukan hanya state lokal).
- `mode: 'mock'` membuat semua test/dev berjalan tanpa Keycloak.
- `typecheck`, `lint`, `test`, `build:client-a` lulus.

---

## 4. Fase 2b — Inventory Route + Guard + Sidebar 2 Level (statis)

**Estimasi:** M (3–5 hari)

### Deliverables

- `RouteMeta` + `MenuItemDefinition` + `MenuGroupDefinition` + `menuRegistry.registerGroup` (validasi duplikat/group tak dikenal) + tests.
- Permission key per module diekspor dari `public.ts` (mis. `productPermissions = { read: 'product.read', write: 'product.write' }`) dan dipakai di `routes.add({ meta: { navKey, permissions } })`.
- `PermissionGuard` (layout route) membaca `useMatches()` → `handle.permissions`; gagal → `/403`. Index route & route `public: true` dikecualikan. Semua route module **wajib** mendeklarasikan `permissions` (deny-by-default).
- Halaman `/403` + i18n (`errors.forbidden`, halaman 403) + CTA kembali ke halaman pertama yang boleh diakses.
- Sidebar: grouping 2 level + accordion + auto-expand route aktif + persist `container:sidebar` + `aria-expanded`/`aria-controls` + hide group kosong (lihat §7).
- Update `user-management` & `product-management`: `navKey`, `permissions`, `group` untuk item yang relevan.
- Extension: route override wajib menyertakan `meta` lengkap (atau `routes.override` diubah agar merge `meta` — lihat §11); extension dapat `registerGroup` untuk menu khusus client.
- Tests: registry group, resolver permission, guard (allow/deny/deep-link), Sidebar (group render, auto-expand, hidden group), fallback behavior.

### Acceptance

- Menu "System Management" (group) berisi item 2 level, accordion berfungsi keyboard-only.
- User tanpa permission tidak melihat menu & tidak bisa mengakses route (403), termasuk via deep link.
- Detail route (`/users/:id`) ter-guard walau tidak ada di menu.
- Group tanpa item visible otomatis hilang; tidak ada group kosong.
- `menu.register` lama tanpa `group`/`permissions` tetap render (backward compatible) — tapi hanya dipakai untuk dev/fallback.
- Semua test + build lulus.

---

## 5. Fase 2c — Navigasi dari DB

**Estimasi:** M (3–5 hari, tergantung kesiapan API + DB)

### Deliverables

- Client API `createNavigationService(api)` → `getNavigation(): Promise<NavTree>`; hook React Query `useNavigation()` (staleTime 10 menit, ETag, retry terbatas) + `navigationKeys`.
- Resolver murni `resolveNavigation(nodes, routeInventory, can)`:
  - validasi `navKey` vs route inventory (`route.meta.navKey`),
  - validasi `labelKey` ada di bundle i18n (`i18n.exists`),
  - filter `permissions` client-side (jaring kedua setelah server),
  - buang node tak dikenal → log terstruktur (`logger.warn`, rate-limited) + counter.
- Sidebar mengonsumsi hasil resolver; skeleton saat first load; **fallback** ke menu static (`menu.register`) + filter `can()` saat API error, disertai indikator halus (bukan toast yang berisik).
- Persist "last known good menu" (localStorage `container:navigation`) untuk mencegah flash/offline.
- Invalidate cache saat login/logout/perubahan role; sediakan refresh manual (opsional di menu user).
- Icon allowlist container (`navIcons.ts`; map nama → inline SVG) — bila icon dipakai di DB.
- Multi-client: kirim `client` bila perlu; `navKey` extension (`client-a.*`) terdaftar oleh extension.
- Tests: resolver (node tak dikenal, label hilang, permission filter, sorting, depth), fallback, cache/persist.

### Acceptance

- Menu produksi sepenuhnya dari `GET /api/navigation`; tidak ada dead link (node invalid hilang + ter-log).
- API gagal → fallback static menu muncul tanpa error page; user tetap bisa navigasi.
- Perubahan struktur/urutan/visibility di DB terlihat setelah TTL/refetch tanpa deploy frontend.
- Menambah menu dengan `navKey` yang belum ada di kode → tidak muncul (fail-closed), tidak error.
- Test + build lulus.

---

## 6. Fase 2d — Admin UI / Operasional Menu

**Estimasi:** S–M (backend-first; frontend opsional)

- Backend: endpoint CRUD `nav_items` + `nav_item_roles` (namespace admin), validasi depth 2, `navKey` unik per client, `min_app_version`.
- UI admin (boleh terpisah dari app ini): list/tree, drag-order, toggle visibility, assign role Keycloak.
- Observability: log node tak dikenal per `navKey` + versi app, agar drift DB↔kode cepat ketahuan.
- Runbook: cara menambah menu baru (deploy key i18n + route dulu, baru row DB), rollback (set `is_visible=false`).
- Acceptance: admin bisa menambah/menyembunyikan menu tanpa deploy; perubahan tervalidasi (tidak ada dead link).

---

## 7. Spesifikasi UI/UX Sidebar (2 Level)

- **Pola:** collapsible accordion group (bukan flyout; sidebar 240px terlalu sempit untuk submenu melayang).
- **Header group:** `text-xs font-medium uppercase tracking-wide text-muted-foreground` + chevron rotate 90°; `<button aria-expanded aria-controls>`; area klik penuh.
- **Item anak:** indent 12–16px + guide line `border-l`; row 36–40px; ikon 16px opsional dari allowlist.
- **Active state:** anak aktif = `bg-accent` + bar 2–3px `border-primary` + `text-accent-foreground`; parent dari anak aktif = `text-primary font-medium` (tanpa background ganda); `aria-current="page"` dari NavLink.
- **Expansion:** auto-expand group yang memuat route aktif (wajib, termasuk deep-link); user tidak bisa menutup group aktif tanpa pindah; preferensi persist di `container:sidebar`.
- **Motion:** 150–200ms; sudah tercakup `prefers-reduced-motion` global.
- **Density:** 3–7 item per group; > 8 → pertimbangkan command palette (Cmd+K) sebagai komplemen, bukan level ke-3.
- **Loading:** skeleton sidebar (shimmer) saat first load; hindari layout shift.
- **A11y:** `<nav><ul><li>` bertingkat, focus ring existing, skip-link "Skip to content" (nice-to-have).
- **Mobile:** sidebar tetap `hidden md:block`; drawer mobile adalah pekerjaan terpisah (bukan bagian fase ini).

---

## 8. Strategi Testing

| Level | Cakupan |
| --- | --- |
| Unit | registry (group/duplikat), resolver navigasi (pure), `can()`/permission mapping, normalisasi config auth |
| Component | Sidebar (group, accordion, auto-expand, hide-empty), guard (allow/deny/deep-link), SessionGate (3 status) |
| Contract | bentuk `RouteMeta`/`MenuItemDefinition`/`NavNode` stabil; node resolver output = input Sidebar |
| Mock | `MockSessionService` + MSW/fetch-mock untuk `/api/navigation` (sukses, 401, 403, 5xx, tree invalid) |
| Manual QA | light/dark, keyboard-only, deep-link, refresh saat sesi valid, logout SSO, fallback saat API mati |

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Menu DB jadi dead link | Validasi `navKey` vs inventory + hide + telemetry; `min_app_version` |
| Drift DB ↔ kode saat rilis | Runbook §6d + log `navKey` tak dikenal; flag `is_visible` untuk rollback |
| Persepsi "menu = security" | Dokumentasi + test guard; backend 403 tetap wajib |
| Token/cabut role tidak langsung terlihat | Access token lifespan pendek (mis. 5 menit) + `updateToken` sebelum request penting |
| Flicker/regresi bootstrap | Menu async, skeleton sidebar, `SessionGate` status `loading`; route tetap sinkron |
| Refactor besar menyentuh `authStore` | `SessionService` abstraction + `MockSessionService`; test unit per fase; fase 2a terpisah dari 2b/2c |
| Konflik navKey extension/module | Namespace wajib (`<module>.*`, `<client>.*`), validasi duplikat di registry |

---

## 10. Out of Scope (fase ini)

- Mobile drawer navigation.
- Server-driven komponen (micro-frontend/module federation).
- Conditional module loading per role (`discover()` dua fase) — dievaluasi terpisah.
- Tabel terjemahan menu di DB (diputuskan label = i18n key).
- Breadcrumb (baru relevan untuk depth 3+).
- Fine-grained/ABAC (owner/tenant scoping) — backend dapat menambah sendiri tanpa mengubah kontrak menu.

---

## 11. Open Decisions (perlu diputuskan sebelum fase terkait)

1. **Bentuk role Keycloak** (dibutuhkan di 2a): client roles langsung sebagai permission key (mis. `product.read`) *vs* realm roles kasar + mapping di container. Rekomendasi: client roles = permission key.
2. **Item tanpa `nav_item_roles`** (dibutuhkan di 2c): fail-closed (tidak terlihat siapa pun) *vs* berlaku untuk semua. Rekomendasi: fail-closed.
3. **`routes.override` merge `meta`** (dibutuhkan di 2b): merge otomatis (aman untuk permission) *vs* tetap replace + wajib deklarasi ulang. Rekomendasi: merge.
4. **Label group default** di fallback static: group yang hanya dipakai DB-driven perlu definisi group di kode juga, atau hanya saat fallback?
5. **Lokasi admin UI menu** (2d): dalam app ini (module admin baru) atau tooling backend terpisah.

---

## 12. Acceptance Criteria Akhir (Fase 2 selesai)

- Login/logout via Keycloak (PKCE) dengan refresh otomatis dan tanpa flicker saat reload.
- Sidebar 2 level dari database, terfilter role (server) dan tervalidasi kode (client), dengan fallback static saat API gagal.
- Setiap route (termasuk detail route) ter-guard permission deny-by-default; deep link tanpa akses → 403 yang ramah.
- Admin dapat mengubah struktur/urutan/visibility menu tanpa deploy frontend; menu baru tetap butuh `navKey` + key i18n dari kode (didokumentasikan).
- Aksesibilitas: keyboard-only, `aria-expanded`/`aria-current`, fokus terlihat, reduced-motion.
- Semua repo lulus `typecheck`, `lint`, `test`, `build:client-a`; dokumentasi (CONTRACT/DEVELOPER-GUIDE) diperbarui.
