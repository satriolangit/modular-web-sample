# Deployment Guide — DevOps Engineer

**Version**: 0.2.0
**Audience**: DevOps / platform engineer
**Terkait**: `ARCHITECTURE.md` §16 (Build & Deployment), §17 (CI/CD); `CONTRACT.md`; `DEVELOPER-GUIDE.md`
**Target deployment saat ini**: **Docker** — base dibangun sekali menjadi image `arsi-web-base`, lalu tiap extension membangun satu image client `FROM` base image tersebut. Config di-inject saat container start.

> English version: `DEPLOYMENT-GUIDE.en.md`.

---

## 1. Overview

Base dibangun sekali; extension dibangun di atasnya tanpa menyentuh repo base.

```
repo base (arsi-web-base)                       image base
┌───────────────────────────────┐  build-base   ┌────────────────────────────────────┐
│ Dockerfile (multi-target)     │ ────────────► │ <org>/arsi-web-base:<ver>-builder  │
│  web-container/               │               │  node:22-alpine + source           │
│  web-modules/                 │               │  + node_modules + /app/BASE_VERSION│
│  web-extension-base/          │               ├────────────────────────────────────┤
│  ci/build-base.sh             │ ────────────► │ <org>/arsi-web-base:<ver>          │
└───────────────────────────────┘               │  nginx:1.27-alpine + SPA base      │
                                                └─────────────────┬──────────────────┘
                                                                  │ FROM builder & runtime
repo extension (arsi-extension-<client>)                          ▼
┌───────────────────────────────┐  build-client ┌────────────────────────────────────┐
│ Dockerfile                    │ ────────────► │ <org>/arsi-web-<client>:<buildId>  │
│ manifest.json (baseVersion)   │               │  nginx + dist client (1 image)     │
│ ci/build-client.sh + src/     │               │  ENV VITE_CLIENT=<client>          │
└───────────────────────────────┘               └────────────────────────────────────┘
```

Prinsip:

- **Base sekali, banyak extension** — base dibuild sekali (2 image); tiap extension membangun image client sendiri dari base image, tanpa checkout/rebuild `web-container` + `web-modules`.
- **Satu image, banyak environment** — staging/production memakai image client yang sama; perbedaan hanya env var saat start.
- **Config bukan bagian dari image** — `entrypoint.sh` (dibawa base runtime) menulis `/config.json` di dalam container dari env (`VITE_*`). Tidak perlu rebuild untuk ganti API base/modul.
- **Tidak ada secret di image** — image hanya berisi aset publik + config publik. Secret (Docker Hub, TLS) di luar image.
- **Versi base dipin exact** — `manifest.json.baseVersion` di repo extension harus sama persis dengan tag base; mismatch = build gagal (`check:base`).

---

## 2. Prerequisites

| Tool | Versi | Catatan |
| --- | --- | --- |
| Node.js | 22.x | image `node:22-alpine` (v22.23.3); jsdom@30/undici@8 butuh ≥22.22, Node 20 EOL April 2026 |
| npm | 10+ | dipakai untuk `npm ci` di repo base (container, web-modules, extension default) dan repo extension |
| Docker | 20+ | build multi-stage/multi-target; BuildKit tidak wajib |
| Registry | — | Docker Hub (`docker.io/<org>`); `docker login` sebelum push; base builder sebaiknya private |
| (Opsional) reverse proxy/TLS | — | nginx/Traefik/ALB di host — TLS tidak ditangani container |

---

## 3. Repo Layout & Build

### 3.1 Layout repo base

```
arsi-web-base/
├── Dockerfile                  # multi-target: builder | base-app | runtime
├── .dockerignore
├── ci/
│   └── build-base.sh
├── web-container/
├── web-modules/
└── web-extension-base/         # extension default (client: "base")
```

### 3.2 Layout repo extension

```
arsi-extension-<client>/
├── Dockerfile                  # FROM base <ver>-builder → FROM base <ver>
├── .dockerignore
├── ci/
│   └── build-client.sh
├── manifest.json               # client + baseVersion (pin exact ke tag base)
├── package.json + package-lock.json
└── src/
```

Catatan: repo extension **tidak** memuat `web-container`/`web-modules` — keduanya tersedia dari base builder image (`/app/web-container`, `/app/web-modules`). Folder extension di builder image selalu `/app/extension`, di-symlink sebagai `current-client` saat build.

### 3.3 Build lokal (tanpa Docker)

Build base default (`client: "base"`):

```bash
cd web-container
CLIENT=base npm run link:client     # symlink current-client -> ../web-extension-base
CLIENT=base npm run build:client    # pre-hook otomatis: gen:modules
# output: web-container/dist/base/
```

Dev per client tetap memakai script khusus:

```bash
cd web-container
npm run link:client-a               # atau: CLIENT=client-a npm run link:client
npm run dev:client-a
```

Catatan:

- `build:client` / `build:client-a` menjalankan **pre-hook** `gen:modules` (loader map di-generate dari `web-modules/modules/*/package.json`).
- Jangan memanggil `npx vite build` langsung — pre-hook tidak jalan dan loader map bisa stale.
- Guard Docker: `cd web-container && npm run check:dockerfile` memastikan **semua** `package.json` (termasuk `web-extension-base`) sudah di-COPY di `Dockerfile` root repo base.

### 3.4 Urutan verifikasi (wajib di CI)

Repo base:

```bash
cd web-modules          && npm ci && npm run typecheck && npm test && npm run lint
cd ../web-extension-base && npm ci && npm run typecheck && npm run lint
cd ../web-container     && CLIENT=base npm run link:client && npm ci
npm run typecheck && npm test && npm run check:dockerfile && CLIENT=base npm run build:client
```

Repo extension:

```bash
cd web-extension-client-a && npm ci && npm run typecheck && npm test && npm run lint
```

`ci/build-base.sh` dengan `VERIFY=1` menjalankan urutan repo base di atas. Verifikasi repo extension juga berjalan **di dalam builder image** saat `ci/build-client.sh`.

---

## 4. Docker Build

### 4.1 Build base

Dari root repo base:

```bash
ORG=<dockerhub-org> VERIFY=1 PUSH=1 ./ci/build-base.sh
```

| Env | Default | Fungsi |
| --- | --- | --- |
| `REGISTRY` | `docker.io` | Registry Docker Hub |
| `ORG` | — (wajib) | Namespace/org Docker Hub |
| `BASE_VERSION` | `web-container/package.json:version` (sekarang `0.1.0`) | Tag base `<ver>` dan `<ver>-builder` |
| `SHA` | `git rev-parse --short HEAD` | Tag immutable `<sha>` dan `<sha>-builder` |
| `VERIFY` | `0` | `1` = jalankan typecheck/test/lint + `check:dockerfile` + build base default sebelum build image |
| `PUSH` | `0` | `1` = push semua tag ke registry |

Dockerfile root (`Dockerfile`) multi-target:

| Stage | Isi |
| --- | --- |
| `builder` (`node:22-alpine`) | COPY `package.json` + lockfile per tree (web-container, web-modules, shared, tiap modul, web-extension-base) → `npm ci` per tree → COPY source → tulis `/app/BASE_VERSION` |
| `base-app` | `FROM builder`; symlink `current-client -> ../web-extension-base`; `CLIENT=base npm run build:client` |
| `runtime` (`nginx:1.27-alpine`) | COPY `dist/base` → `/usr/share/nginx/html`; COPY `nginx.conf`; COPY `entrypoint.sh`; `LABEL` versi; `EXPOSE 80` |

- `COPY package.json` tiap modul **eksplisit**. Menambah modul baru = menambah baris COPY + jalankan `npm run check:dockerfile` (kalau lupa, guard gagal).
- Runtime base dapat di-deploy standalone: extension default `web-extension-base` (client `base`).
- Hasil: tag `<ver>-builder`, `<sha>-builder`, `<ver>`, `<sha>`.

### 4.2 Build extension

Dari root repo extension:

```bash
ORG=<dockerhub-org> PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh
```

| Env | Default | Fungsi |
| --- | --- | --- |
| `REGISTRY` | `docker.io` | Registry Docker Hub |
| `ORG` | — (wajib) | Namespace/org Docker Hub |
| `BASE_VERSION` | `manifest.json:baseVersion` | Tag base yang dipakai |
| `CLIENT_NAME` | `manifest.json:client` | Nama image client (`arsi-web-<client>`) |
| `BUILD_ID` | `git rev-parse --short HEAD` | Tag image client |
| `PULL` | `1` | Pull base builder + runtime sebelum build |
| `PUSH` | `0` | `1` = push image client |
| `BASE_BUILDER_IMAGE` / `BASE_RUNTIME_IMAGE` | `<registry>/<org>/arsi-web-base:<ver>[-builder]` | Override penuh referensi base image |

Dockerfile extension:

| Stage | Isi |
| --- | --- |
| `builder` (`FROM <ver>-builder`) | COPY `package.json` + lock → `/app/extension` → `npm ci` → COPY source → symlink `web-container/current-client -> ../extension` → typecheck + test (`--if-present`) + lint → `check:base` → `CLIENT=<client> npm run build:client` |
| `runtime` (`FROM <ver>`) | Ganti `/usr/share/nginx/html` dengan dist client; `ENV VITE_CLIENT=<client>` |

- Verifikasi (typecheck/test/lint) berjalan **di dalam builder image** — dijamin terhadap base yang sama; pipeline extension tidak perlu checkout repo base.
- `check:base` membandingkan `manifest.json:baseVersion` dengan `/app/BASE_VERSION` di builder image; mismatch = build berhenti.
- Base image private → `docker login` sebelum build (skrip tidak menangani auth).
- Image final hanya nginx + dist client (tanpa source/node_modules).

---

## 5. Run Container (Docker)

### 5.1 `docker run`

```bash
docker run -d \
  --name arsi-web-client-a \
  -p 8080:80 \
  -e VITE_CLIENT=client-a \
  -e VITE_MODULES=user-management,product-management,module-sample \
  -e VITE_API_BASE=https://staging-api.example.com \
  -e VITE_ENABLE_AUDIT_LIVE=true \
  --restart unless-stopped \
  --health-cmd "wget -qO- http://127.0.0.1/ >/dev/null || exit 1" \
  --health-interval 30s --health-timeout 5s --health-retries 3 \
  docker.io/<org>/arsi-web-client-a:<tag>
```

Base runtime juga bisa dijalankan standalone (extension default, client `base`):

```bash
docker run -d -p 8080:80 docker.io/<org>/arsi-web-base:<ver>
```

### 5.2 `docker-compose.yml` (contoh)

```yaml
services:
  web:
    image: docker.io/<org>/arsi-web-client-a:${TAG:-latest}
    container_name: arsi-web-client-a
    ports:
      - "8080:80"
    environment:
      VITE_CLIENT: client-a
      VITE_MODULES: user-management,product-management,module-sample
      VITE_API_BASE: https://staging-api.example.com
      VITE_ENABLE_AUDIT_LIVE: "true"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

```bash
TAG=2026.10.01 docker compose up -d
TAG=2026.10.01 docker compose up -d --force-recreate   # apply env baru
```

TLS/reverse proxy (nginx/Traefik/ALB) dikonfigurasi di host, bukan di container ini.

---

## 6. Runtime Configuration

`entrypoint.sh` (dibawa base runtime, dijalankan otomatis oleh image nginx saat start) menulis `/usr/share/nginx/html/config.json`:

| Env | Default | Fungsi |
| --- | --- | --- |
| `VITE_CLIENT` | `base` | Nama client di config (`client`); image client menyetel `ENV VITE_CLIENT=<client>` |
| `VITE_MODULES` | `user-management` | CSV modul yang **di-init** saat runtime (contoh: `user-management,product-management,module-sample`) |
| `VITE_API_BASE` | `https://dummyjson.com` | Base URL API untuk `deps.api` dan service modul |
| `VITE_ENABLE_AUDIT_LIVE` | `true` | Feature flag (`featureFlags.enableAuditLive`) |

Catatan penting:

- **Modul harus ada di build** — semua modul di `web-modules/modules/` selalu ter-bundle (lazy chunk); `VITE_MODULES` hanya menentukan mana yang aktif saat runtime. Nama modul **harus sama** dengan nama folder; kalau tidak, app gagal boot dengan `[bootstrap] module "x" is declared in config.modules but has no entry in web-modules/modules`.
- Config runtime satu sumber di base: `entrypoint.sh` + `nginx.conf` dibawa base runtime; image client hanya mengganti `/usr/share/nginx/html` dengan dist client.
- Config dibaca dengan `cache: 'no-store'`; nginx juga mengirim `Cache-Control: no-store` untuk `/config.json`.
- Ganti env = recreate container (`docker compose up -d --force-recreate`), tanpa rebuild image.
- Verifikasi setelah start: `curl -s http://localhost:8080/config.json | jq .`

---

## 7. Registry & Tagging

- Registry: **Docker Hub**. Image base `<org>/arsi-web-base`; image client `<org>/arsi-web-<client>` (contoh `<org>/arsi-web-client-a`).
- Tag base: `<ver>` + `<ver>-builder` (dari `web-container/package.json:version`), ditambah immutable `<sha>` + `<sha>-builder`.
- Tag client: `<buildId>` (immutable; CI build ID / short SHA). Hindari `latest` di produksi.
- Promosi staging → production = **retag/pull image yang sama**, bukan rebuild:
  ```bash
  docker pull docker.io/<org>/arsi-web-client-a:<buildId>
  docker tag  docker.io/<org>/arsi-web-client-a:<buildId> docker.io/<org>/arsi-web-client-a:prod-<date>
  docker push docker.io/<org>/arsi-web-client-a:prod-<date>
  ```
- Rollback = deploy tag sebelumnya (`TAG=<buildId-sebelumnya> docker compose up -d --force-recreate`).
- Base dipin per client: image client hanya dibangun terhadap base `<ver>` sesuai `manifest.json:baseVersion`. Jangan retag base lama ke versi baru.

---

## 8. CI/CD (Generik)

Tidak ada YAML platform spesifik; pipeline apa pun (Azure DevOps, GitHub Actions, Jenkins) cukup memanggil skrip shell di tiap repo.

### 8.1 Pipeline repo base

| Langkah | Perintah |
| --- | --- |
| Checkout repo base | `git clone <repo-base>` |
| Node 22 di runner (untuk `VERIFY=1`) | `actions/setup-node@v4` / `NodeTool@0` / dsb. |
| Login registry | `docker login` (token dari secret CI) |
| Build + push base | `ORG=<org> VERIFY=1 PUSH=1 ./ci/build-base.sh` |

### 8.2 Pipeline repo extension

| Langkah | Perintah |
| --- | --- |
| Checkout repo extension | `git clone <repo-extension-<client>>` |
| Login registry (base image private) | `docker login` (token dari secret CI) |
| Build + push client | `ORG=<org> PUSH=1 BUILD_ID=$CI_BUILD_ID ./ci/build-client.sh` |
| Smoke test | `docker run` image hasil → `curl -sf localhost:8080/config.json` (+ `/`, deep link) sebelum/sesudah push |

Catatan:

- Pipeline extension **tidak** men-checkout repo base; build hanya butuh pull image base dari registry.
- `VERIFY=1` opsional; verifikasi extension sudah berjalan di dalam builder image saat `ci/build-client.sh`.
- Mengadopsi base baru = PR di repo extension yang menaikkan `manifest.json:baseVersion` (lihat §9).

---

## 9. Environments & Promotion

| Environment | Image | Config |
| --- | --- | --- |
| Staging | client image `<buildId>` | `VITE_API_BASE=https://staging-api…`, `VITE_MODULES=…` |
| Production | image yang **sama**, dipromosikan | `VITE_API_BASE=https://api…`, `VITE_MODULES=…` |

- Perbedaan **hanya env** — tidak ada rebuild.
- Simpan nilai env per environment di secret manager/CI variable group (bukan di repo).
- Setelah ubah env: recreate container; cek `/config.json`.
- **Adopsi base baru**: bump `baseVersion` di `manifest.json` repo extension (PR) → CI membangun ulang image client terhadap base tag baru. Repo base tidak di-checkout dan client lain tidak terpengaruh sampai mereka bump sendiri.

---

## 10. Smoke Test Pasca-Deploy

```bash
BASE=http://localhost:8080

# 1. Config sesuai environment
curl -sf "$BASE/config.json" | jq -e '.client and .modules and .apiBase'

# 2. Halaman utama 200
curl -sI "$BASE/" | head -1

# 3. Deep link SPA fallback (harus 200 + index.html)
curl -s "$BASE/products/1" | grep -q '<div id="root">'

# 4. Header cache aset immutable
curl -sI "$BASE/assets/$(curl -s "$BASE/" | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2)" \
  | grep -i 'cache-control: public, immutable'

# 5. Log entrypoint
docker logs arsi-web-client-a | grep 'Generated'
```

Checklist manual: login/route modul sesuai `VITE_MODULES`, theme/locale, deep-link tidak 404, `config.json` tidak ter-cache browser.

---

## 11. Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| `[bootstrap] module "x" … has no entry` | `VITE_MODULES` memuat nama yang bukan folder di `web-modules/modules/`. Perbaiki env atau tambahkan modul ke build. |
| Modul tidak muncul walau env benar | Modul belum ter-bundle (build lama) atau tidak ada di `config.json` runtime. Cek `curl /config.json`, rebuild image. |
| Perubahan config tidak terlihat | Browser cache (harus `no-store`) atau container belum di-recreate. `docker compose up -d --force-recreate`. |
| `check:base` mismatch | Pesan `[check:base] baseVersion manifest (x) != base image (y)`. Samakan `manifest.json:baseVersion` dengan tag base, atau pakai `BASE_BUILDER_IMAGE` yang benar/rebuild base. |
| Tag base `<ver>-builder` tidak ditemukan saat pull | Base versi itu belum dibuild/push, atau `REGISTRY`/`ORG` salah. Jalankan `ci/build-base.sh` di repo base atau samakan `BASE_VERSION`/`manifest.json:baseVersion`. |
| Build Docker gagal: `package.json` modul tidak ditemukan | Modul baru belum ditambah `COPY` di `Dockerfile` root repo base. Jalankan `npm run check:dockerfile`, tambah baris COPY. |
| `npm ci` extension gagal (lockfile) | `package-lock.json` extension tidak sinkron dengan `package.json`-nya (atau dengan lockfile versi ini). Jalankan `npm install` di repo extension, commit lockfile baru. |
| `npm ci` gagal di CI | Lockfile tidak sinkron (modul baru belum `npm install` di `web-modules`). Commit lockfile. |
| Deep link 404 | `try_files` nginx hilang/berubah — pastikan `nginx.conf` memakai `try_files $uri $uri/ /index.html`. |
| Loader map stale di image | Build dipanggil bukan lewat `npm run build:client` / `build:client-a` (pre-hook `gen:modules` tidak jalan). Pakai script npm. |
| Docker build konteks salah (`COPY failed`) | Base wajib dibuild dari root repo base; extension dari root repo extension. Skrip `ci/build-*.sh` sudah menjalankan `docker build` dari direktori yang benar. |
| Asset 404 setelah deploy | Base path berubah? Jangan ubah `base` Vite tanpa koordinasi; aset dilayani dari `/assets/`. |
| `pull access denied` / 401 base image | Base builder/runtime private; jalankan `docker login` (token CI) sebelum build extension. |
| Engine warning saat `npm install` | Node lokal > target; aman bila test lulus. CI/Docker memakai Node 22. |

---

## 12. Security

- **Tidak ada secret di image** — hanya config publik. Jangan pernah menaruh token/secret di `VITE_*` (nilainya masuk `/config.json` yang bisa dibaca siapa pun).
- TLS diterminasi di reverse proxy/ingress host; container hanya HTTP:80.
- Batasi akses registry (access token/robot account Docker Hub); scan image (Docker Hub/Trivy) sebelum promosi.
- Base builder image memuat source + `node_modules` — jaga tetap private; hanya dipakai pipeline extension.
- Jalankan container dengan user non-root bila diperlukan (nginx master saat ini root; opsi hardening terpisah).
- Audit: catat tag image client + base version + nilai env per deploy; `config.json` mengungkap `client`, `modules`, `apiBase` — pastikan tidak sensitif.

---

## 13. Appendix — Cheat Sheet

```bash
# Build base (root repo base)
ORG=<dockerhub-org> VERIFY=1 PUSH=1 ./ci/build-base.sh

# Build client (root repo extension)
ORG=<dockerhub-org> PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh

# Verifikasi sebelum build (repo base)
cd web-container && npm run check:dockerfile

# Jalankan client
docker run -d -p 8080:80 -e VITE_API_BASE=https://staging-api.example.com \
  docker.io/<org>/arsi-web-client-a:<tag>

# Cek config & log
curl -s localhost:8080/config.json | jq .
docker logs arsi-web-client-a | grep Generated

# Rollback
TAG=<tag-sebelumnya> docker compose up -d --force-recreate
```

| File | Peran |
| --- | --- |
| `Dockerfile` (root repo base) | Multi-target base: `builder` / `base-app` / `runtime` |
| `ci/build-base.sh` | Build + push 2 image base + tag immutable |
| `web-extension-base/` | Extension default untuk base runtime (client `base`) |
| `web-container/docker/entrypoint.sh` | Generate `/config.json` dari env |
| `web-container/nginx.conf` | SPA fallback + cache header |
| `web-container/scripts/check-dockerfile-modules.mjs` | Guard COPY `package.json` modul di Dockerfile root |
| `web-container/scripts/check-base-version.mjs` | Guard `baseVersion` manifest vs base image |
| `.dockerignore` (root repo base) | Exclude node_modules/dist/folder extension non-base dari context |
| `web-extension-<client>/Dockerfile` | Build image client `FROM` base image |
| `web-extension-<client>/ci/build-client.sh` | Build + push image client |
| `web-extension-<client>/manifest.json` | `client` + `baseVersion` (pin exact) |

---

**Document version**: 0.2.0
**Last updated**: 2026-10-02
