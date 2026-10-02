# Deployment Guide — DevOps Engineer

**Version**: 0.1.0
**Audience**: DevOps / platform engineer
**Terkait**: `ARCHITECTURE.md` §16 (Build & Deployment), §17 (CI/CD); `CONTRACT.md`; `DEVELOPER-GUIDE.md`
**Target deployment saat ini**: **Docker** (satu image per client, config di-inject saat container start). Kubernetes belum dipakai (langkah pipeline `KubernetesManifest` masih scaffold — lihat §8).

> English version: `DEPLOYMENT-GUIDE.en.md`.

---

## 1. Overview

Arsitektur deploy:

```
3 repo (side-by-side)                    1 image per client              Runtime config
┌──────────────────────┐                ┌─────────────────────┐         ┌──────────────────┐
│ web-container        │  docker build  │ nginx + dist/client │  env →  │ /config.json     │
│ web-modules          │ ─────────────► │ (static SPA)        │ ──────► │ (generated saat  │
│ web-extension-<cli>  │  context=root  │                     │  start  │  container start)│
└──────────────────────┘                └─────────────────────┘         └──────────────────┘
```

Prinsip:

- **Satu image, banyak environment** — staging/production memakai image yang sama; perbedaan hanya env var saat start.
- **Config bukan bagian dari image** — `entrypoint.sh` menulis `/config.json` di dalam container dari env (`VITE_*`). Tidak perlu rebuild untuk ganti API base/modul.
- **Tidak ada secret di image** — image hanya berisi aset publik + config publik. Secret (registry, TLS) di luar image.
- **Build context wajib workspace root** — Dockerfile menyalin `web-container/`, `web-modules/`, dan `web-extension-<client>/` sekaligus.

---

## 2. Prerequisites

| Tool | Versi | Catatan |
| --- | --- | --- |
| Node.js | 20.x | `engines: ">=20"`; CI/Docker memakai `node:20-alpine` |
| npm | 10+ | dipakai untuk `npm ci` di 3 repo |
| Docker | 20+ | build multi-stage; BuildKit tidak wajib (Dockerfile memakai `COPY` biasa) |
| Registry | — | ACR/ECR/GHCR; login sebelum push |
| (Opsional) reverse proxy/TLS | — | nginx/Traefik/ALB di host — TLS tidak ditangani container |

---

## 3. Repo Layout & Build

### 3.1 Layout wajib (side-by-side)

Ketiga repo harus berada dalam satu parent directory dengan nama folder persis seperti di Dockerfile:

```
<workspace>/
├── web-container/
├── web-modules/
└── web-extension-client-a/
```

Path mapping (`aliases.cjs`) dan Dockerfile bergantung pada layout ini. Jangan mengubah nama folder di build context.

### 3.2 Build lokal (tanpa Docker)

```bash
cd web-container
ln -sfn ../web-extension-client-a current-client   # symlink client aktif
npm run build:client-a                              # pre-hook otomatis: gen:modules
# output: web-container/dist/client-a/
```

Catatan:

- `npm run build:client-a` menjalankan **pre-hook** `gen:modules` (loader map di-generate dari `web-modules/modules/*/package.json`).
- Jangan memanggil `npx vite build` langsung — pre-hook tidak jalan dan loader map bisa stale.
- Guard Docker: `cd web-container && npm run check:dockerfile` memastikan **semua** `package.json` modul sudah di-COPY di Dockerfile.

### 3.3 Urutan verifikasi (wajib di CI)

```bash
cd web-modules    && npm ci && npm run typecheck && npm test && npm run lint
cd ../web-extension-client-a && npm ci && npm run typecheck && npm test && npm run lint
cd ../web-container && ln -sfn ../web-extension-client-a current-client && npm ci
npm run typecheck && npm test && npm run check:dockerfile && npm run build:client-a
```

---

## 4. Docker Build

### 4.1 Perintah

```bash
# dari WORKSPACE ROOT (bukan dari web-container/)
docker build \
  -f web-container/Dockerfile \
  -t myorg.azurecr.io/arsi-web-client-a:$(git rev-parse --short HEAD) \
  .
```

### 4.2 Cara kerja Dockerfile

| Stage | Isi |
| --- | --- |
| `builder` (`node:20-alpine`) | COPY `package.json` + lockfile per repo/modul → `npm ci` per repo → COPY source → symlink `current-client` → `npm run build:client-a` |
| `runner` (`nginx:1.27-alpine`) | COPY `dist/client-a` → `/usr/share/nginx/html`; COPY `nginx.conf`; COPY `entrypoint.sh` → `/docker-entrypoint.d/40-generate-config.sh` |

- `npm ci` dijalankan **per repo** (container, web-modules workspace, extension) — bukan satu install global.
- `COPY package.json` untuk setiap modul **eksplisit**. Menambah modul baru = menambah baris COPY + jalankan `check:dockerfile` (kalau lupa, build/CI gagal di guard).
- `.dockerignore` (root) mengecualikan `**/node_modules`, `**/dist`, `**/coverage`, `.git`, `web-container/current-client`, log, `.DS_Store`.

### 4.3 Push

```bash
docker login myorg.azurecr.io
docker push myorg.azurecr.io/arsi-web-client-a:$(git rev-parse --short HEAD)
```

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
  myorg.azurecr.io/arsi-web-client-a:<tag>
```

### 5.2 `docker-compose.yml` (contoh)

```yaml
services:
  web:
    image: myorg.azurecr.io/arsi-web-client-a:${TAG:-latest}
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

`entrypoint.sh` (dijalankan otomatis oleh image nginx saat start) menulis `/usr/share/nginx/html/config.json`:

| Env | Default | Fungsi |
| --- | --- | --- |
| `VITE_CLIENT` | `client-a` | Nama client di config (`client`); dipakai untuk logging/identitas |
| `VITE_MODULES` | `user-management` | CSV modul yang **di-init** saat runtime (contoh: `user-management,product-management,module-sample`) |
| `VITE_API_BASE` | `https://dummyjson.com` | Base URL API untuk `deps.api` dan service modul |
| `VITE_ENABLE_AUDIT_LIVE` | `true` | Feature flag (`featureFlags.enableAuditLive`) |

Catatan penting:

- **Modul harus ada di build** — semua modul di `web-modules/modules/` selalu ter-bundle (lazy chunk); `VITE_MODULES` hanya menentukan mana yang aktif saat runtime. Nama modul **harus sama** dengan nama folder; kalau tidak, app gagal boot dengan `[bootstrap] module "x" is declared in config.modules but has no entry in web-modules/modules`.
- Config dibaca dengan `cache: 'no-store'`; nginx juga mengirim `Cache-Control: no-store` untuk `/config.json`.
- Ganti env = recreate container (`docker compose up -d --force-recreate`), tanpa rebuild image.
- Verifikasi setelah start: `curl -s http://localhost:8080/config.json | jq .`

---

## 7. Registry & Tagging

- Tag **immutable** yang disarankan: `$(Build.BuildId)` (CI) atau `git rev-parse --short HEAD`; hindari `latest` di produksi.
- Promosi staging → production = **retag/pull image yang sama**, bukan rebuild:
  ```bash
  docker pull myorg.azurecr.io/arsi-web-client-a:<buildId>
  docker tag  myorg.azurecr.io/arsi-web-client-a:<buildId> myorg.azurecr.io/arsi-web-client-a:prod-<date>
  docker push myorg.azurecr.io/arsi-web-client-a:prod-<date>
  ```
- Rollback = deploy tag sebelumnya (`TAG=<buildId-sebelumnya> docker compose up -d --force-recreate`).

---

## 8. CI/CD (Azure DevOps)

Contoh pipeline aktual: `web-extension-client-a/.azure-pipelines.yml`. Ringkas + tambahan guard:

```yaml
trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

variables:
  clientName: client-a
  dockerRepository: arsi-web-client-a

steps:
  - checkout: self
    path: web-extension-client-a
  - checkout: git://MyOrg/web-container
    path: web-container
  - checkout: git://MyOrg/web-modules
    path: web-modules

  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

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
      buildContext: $(Pipeline.Workspace)      # WAJIB workspace root
      tags: |
        $(Build.BuildId)
```

Catatan:

- `buildContext: $(Pipeline.Workspace)` **wajib** — Dockerfile meng-COPY 3 repo.
- `check:dockerfile` ditambahkan di tahap verify (mencegah build gagal karena modul lupa di-COPY).
- Langkah `KubernetesManifest` di file asli masih **scaffold** (file `k8s/staging.yaml` belum ada). Deployment saat ini via Docker; aktifkan K8s nanti setelah manifest disiapkan.

---

## 9. Environments & Promotion

| Environment | Image | Config |
| --- | --- | --- |
| Staging | sama (`<buildId>`) | `VITE_API_BASE=https://staging-api…`, `VITE_MODULES=…` |
| Production | image yang **sama**, dipromosikan | `VITE_API_BASE=https://api…`, `VITE_MODULES=…` |

- Perbedaan **hanya env** — tidak ada rebuild.
- Simpan nilai env per environment di secret manager/CI variable group (bukan di repo).
- Setelah ubah env: recreate container; cek `/config.json`.

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
| Build Docker gagal: `package.json` modul tidak ditemukan | Modul baru belum ditambah `COPY` di `web-container/Dockerfile`. Jalankan `npm run check:dockerfile`, tambah baris COPY. |
| `npm ci` gagal di CI | Lockfile tidak sinkron (modul baru belum `npm install` di `web-modules`). Commit lockfile. |
| Deep link 404 | `try_files` nginx hilang/berubah — pastikan `nginx.conf` memakai `try_files $uri $uri/ /index.html`. |
| Loader map stale di image | Build dipanggil bukan lewat `npm run build:client-a` (pre-hook `gen:modules` tidak jalan). Pakai script npm. |
| Docker build konteks salah (`COPY failed`) | Build dijalankan dari `web-container/`, bukan workspace root. Gunakan `-f web-container/Dockerfile .` dari root. |
| Asset 404 setelah deploy | Base path berubah? Jangan ubah `base` Vite tanpa koordinasi; aset dilayani dari `/assets/`. |
| Engine warning saat `npm install` | Node lokal > target; aman bila test lulus. CI memakai Node 20. |

---

## 12. Security

- **Tidak ada secret di image** — hanya config publik. Jangan pernah menaruh token/secret di `VITE_*` (nilainya masuk `/config.json` yang bisa dibaca siapa pun).
- TLS diterminasi di reverse proxy/ingress host; container hanya HTTP:80.
- Batasi akses registry (service connection/robot account); scan image (ACR Tasks/Trivy) sebelum promosi.
- Jalankan container dengan user non-root bila diperlukan (nginx master saat ini root; opsi hardening terpisah).
- Audit: catat tag image + nilai env per deploy; `config.json` mengungkap `client`, `modules`, `apiBase` — pastikan tidak sensitif.

---

## 13. Appendix — Cheat Sheet

```bash
# Build image (workspace root)
docker build -f web-container/Dockerfile -t myorg.azurecr.io/arsi-web-client-a:<tag> .

# Verifikasi sebelum build
cd web-container && npm run check:dockerfile

# Jalankan
docker run -d -p 8080:80 -e VITE_CLIENT=client-a \
  -e VITE_MODULES=user-management,product-management,module-sample \
  -e VITE_API_BASE=https://staging-api.example.com \
  myorg.azurecr.io/arsi-web-client-a:<tag>

# Cek config & log
curl -s localhost:8080/config.json | jq .
docker logs arsi-web-client-a | grep Generated

# Rollback
TAG=<tag-sebelumnya> docker compose up -d --force-recreate
```

| File | Peran |
| --- | --- |
| `web-container/Dockerfile` | Multi-stage build → nginx |
| `web-container/docker/entrypoint.sh` | Generate `/config.json` dari env |
| `web-container/nginx.conf` | SPA fallback + cache header |
| `.dockerignore` (root) | Exclude node_modules/dist dari context |
| `web-extension-client-a/.azure-pipelines.yml` | Pipeline build + push image |
| `web-container/scripts/check-dockerfile-modules.mjs` | Guard COPY `package.json` modul |

---

**Document version**: 0.1.0
**Last updated**: 2026-10-01
