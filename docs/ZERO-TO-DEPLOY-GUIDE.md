# Panduan Zero to Deploy — Clone → Extension → Compile → Deploy

**Version**: 0.1.0
**Audience**: Developer / DevOps yang men-deploy client baru dari nol
**Registry**: Docker Hub `satriolangit` — https://hub.docker.com/repositories/satriolangit
**Dokumen terkait**: `DEVELOPER-GUIDE.md` (detail module/extension), `DEPLOYMENT-GUIDE.md` (build/CI/tagging), `VM-DEPLOYMENT-GUIDE.en.md` (operasional VM), `CONTRACT.md` (aturan keras)

> English version: `ZERO-TO-DEPLOY-GUIDE.en.md`.

---

## Daftar Isi

1. [Ringkasan Alur](#1-ringkasan-alur)
2. [Prasyarat](#2-prasyarat)
3. [Tahap 1 — Clone & Setup Workspace](#3-tahap-1--clone--setup-workspace)
4. [Tahap 2 — Buat Extension Client](#4-tahap-2--buat-extension-client)
5. [Tahap 3 — Compile: Build & Push Image](#5-tahap-3--compile-build--push-image)
6. [Tahap 4 — Deploy ke VM Linux](#6-tahap-4--deploy-ke-vm-linux)
7. [Tahap 5 — Update & Rollback](#7-tahap-5--update--rollback)
8. [Checklist Go-Live & Troubleshooting](#8-checklist-go-live--troubleshooting)
9. [Referensi](#9-referensi)

---

## 1. Ringkasan Alur

```
┌─────────────┐   ┌──────────────┐   ┌────────────────────┐   ┌─────────────────┐   ┌──────────────┐
│ 1. Clone    │ → │ 2. Extension │ → │ 3. Compile         │ → │ 4. Deploy VM    │ → │ 5. Verifikasi│
│ base+client │   │ manifest+src │   │ build+push image   │   │ compose + TLS   │   │ smoke test   │
└─────────────┘   └──────────────┘   └────────────────────┘   └─────────────────┘   └──────────────┘
```

| Tahap | Hasil | Perintah kunci |
| --- | --- | --- |
| 1. Clone | workspace base + extension bersebelahan | `git clone <git-url-arsi-web-base> arsi-web-base` |
| 2. Extension | repo `web-extension-client-<x>` dengan `manifest.json` | copy template / clone repo extension |
| 3. Compile | `satriolangit/arsi-web-base:<ver>[-builder]` + `satriolangit/arsi-web-<client>:<buildId>` | `ci/build-base.sh`, `ci/build-client.sh` |
| 4. Deploy | container jalan di VM + HTTPS | `docker compose pull && docker compose up -d` |
| 5. Verifikasi | `/config.json` sesuai environment | `curl https://app.example.com/config.json` |

Peran tiap repo:

| Repo | Isi | Kapan diubah |
| --- | --- | --- |
| `arsi-web-base` (1 repo) | `web-container` + `web-modules` + `web-extension-default` + `web-extension-template` | shell, UI kit, module bisnis, rilis base, template client |
| `arsi-web-client-<x>` (1 repo per client) | override khas client (`src/`) | slot/route/service/i18n client |

Aturan penting: **extension ditentukan saat build** (1 repo = 1 image client), **module diaktifkan saat deploy** (`VITE_MODULES`), **config penuh bisa di-override saat deploy** (`VITE_CONFIG_JSON`).

---

## 2. Prasyarat

| Kebutuhan | Untuk | Catatan |
| --- | --- | --- |
| Node.js 22.x + npm 10+ | laptop: build lokal & dev | lihat `DEVELOPER-GUIDE.md` §0.2 |
| Git | clone repo | set `user.name`/`user.email` |
| Docker + Compose | laptop: build image; VM: run | Docker Desktop (laptop) / Docker Engine (VM) |
| Akun Docker Hub `satriolangit` | push/pull image | https://hub.docker.com/repositories/satriolangit |
| Token Docker Hub (push) | laptop/CI saat `PUSH=1` | read-only token di VM; push token hanya di laptop/CI |
| VM Linux + domain | deploy produksi | Ubuntu/Debian, IP publik, DNS A record |
| Akses SSH ke VM | deploy | user `deploy` dengan key |

URL repo (placeholder — ganti dengan URL asli):

- base: `<git-url-arsi-web-base>`
- extension: `<git-url-arsi-web-client-<x>>`

---

## 3. Tahap 1 — Clone & Setup Workspace

Extension **wajib** berada di dalam folder base repo (symlink `current-client` dan alias extension bergantung padanya):

```bash
mkdir -p ~/works/arsi && cd ~/works/arsi
git clone <git-url-arsi-web-base> arsi-web-base
cd arsi-web-base
git clone <git-url-arsi-web-client-<x>> web-extension-client-<x>
echo "web-extension-*/" >> .git/info/exclude   # clone extension jangan ikut ter-commit ke base
```

Install dependency (urutan: modules → container → extension):

```bash
(cd web-modules && npm ci)
(cd web-container && npm ci && CLIENT=<client> npm run link:client)
(cd web-extension-client-<x> && npm ci)
```

Jalankan dev server untuk memastikan workspace sehat:

```bash
cd web-container
npm run dev        # http://localhost:5173
```

Catatan:

- `npm run dev` mengambil client dari symlink `current-client` (atau `VITE_CLIENT` di `.env`) dan men-generate `/config.json` dari env (`VITE_MODULES`, `VITE_API_BASE`, `VITE_ENABLE_AUDIT_LIVE`, atau `VITE_CONFIG_JSON`); `public/config.json` hanya fallback. Detail: `DEVELOPER-GUIDE.md` §0.5.
- Ganti client aktif: `CLIENT=<client> npm run link:client`, lalu restart dev server.
- Setup laptop lengkap (nvm/WSL): `DEVELOPER-GUIDE.md` §0.

---

## 4. Tahap 2 — Buat Extension Client

Jika repo client belum ada, buat dari template (folder `web-extension-template` di repo base):

```bash
cd arsi-web-base
cp -R web-extension-template web-extension-client-<x>
cd web-extension-client-<x>
rm -rf node_modules
```

Sesuaikan:

1. `package.json` → `"name": "@arsi/extension-client-<x>"`.
2. `manifest.json`:
   ```json
   {
     "client": "client-<x>",
     "baseVersion": "0.1.0",
     "modules": { "user-management": "^0.1.0" },
     "shared": "^0.1.0",
     "overrides": []
   }
   ```
   `baseVersion` **wajib** sama persis dengan tag base yang dipakai (dicek `check:base` saat build).
3. `src/index.tsx` → default export `init(deps)`; daftarkan override (slot/route/service/i18n) di sini.
4. Tambahkan alias `@arsi/module-<name>` di `aliases.cjs` + `tsconfig.json` untuk setiap module yang di-override (detail: `DEVELOPER-GUIDE.md` §4.2).

### 4.1 Jadikan repo Git sendiri

Folder client berada **di dalam** direktori base repo (wajib sibling untuk symlink/alias), tetapi **bukan** bagian dari repo base. Buat repo kosong `arsi-web-client-<x>` di GitHub org `satriolangit`, lalu:

```bash
# di dalam web-extension-client-<x>
git init -b main
git add .
git commit -m "feat: initial extension client-<x>"
git remote add origin <git-url-arsi-web-client-<x>>
git push -u origin main
```

- `.git/info/exclude` di base repo (Tahap 1) memuat `web-extension-*/` agar folder client **tidak muncul di `git status`** base dan **tidak ikut ter-commit** ke repo base. Ignore ini hanya berlaku untuk file **untracked**; kalau folder terlanjur ter-`git add`, keluarkan dengan `git rm -r --cached web-extension-client-<x>`. Jangan pakai `git add -f`.
- `web-extension-default/` dan `web-extension-template/` **sengaja tracked** di repo base (bagian dari base); pola ignore tidak memengaruhi file yang sudah tracked.
- Verifikasi: `cd ..` (base repo) → `git status` harus **clean**, dan `git check-ignore -v web-extension-client-<x>/` harus menunjuk `.git/info/exclude`.

Verifikasi lokal:

```bash
cd ../web-container && CLIENT=client-<x> npm run link:client && npm run dev
cd ../web-extension-client-<x> && npm run typecheck && npm run test --if-present && npm run lint
```

Jika repo extension sudah ada (klien existing), cukup clone (Tahap 1) dan lanjut ke Tahap 3.

---

## 5. Tahap 3 — Compile: Build & Push Image

Login ke Docker Hub (sekali per mesin):

```bash
docker login docker.io -u satriolangit
```

### 5.1 Build & push image base (sekali per versi base)

Dari **root repo base**:

```bash
cd ~/works/arsi/arsi-web-base
ORG=satriolangit VERIFY=1 PUSH=1 ./ci/build-base.sh
```

Hasil:

| Image | Isi | Visibility |
| --- | --- | --- |
| `satriolangit/arsi-web-base:0.1.0-builder` | Node 22 + source + node_modules (bahan build extension) | **private** (disarankan) |
| `satriolangit/arsi-web-base:0.1.0` | nginx + SPA base + config runtime | private/public sesuai kebijakan |

- Versi diambil dari `web-container/package.json:version` (contoh `0.1.0`); tag immutable `<sha>` juga dibuat.
- `VERIFY=1` menjalankan test + guard sebelum build. Ulangi tahap ini hanya saat base berubah/naik versi.
- Verifikasi di Docker Hub: https://hub.docker.com/r/satriolangit/arsi-web-base/tags

### 5.2 Build & push image client

Dari **root repo extension**:

```bash
cd ~/works/arsi/arsi-web-base/web-extension-client-<x>
ORG=satriolangit PUSH=1 BUILD_ID=$(git rev-parse --short HEAD) ./ci/build-client.sh
```

Hasil: `satriolangit/arsi-web-<client>:<buildId>` (contoh client `bca` → `satriolangit/arsi-web-bca`).

- Script menarik `arsi-web-base:<baseVersion>-builder` + `:baseVersion` dari registry, menjalankan typecheck/test/lint + `check:base` di dalam builder image, lalu build Vite.
- `check:base` gagal bila `manifest.json:baseVersion` tidak sama dengan base image → perbaiki manifest atau build base yang benar.
- Verifikasi: https://hub.docker.com/repositories/satriolangit

### 5.3 Smoke test lokal sebelum dipakai di VM (opsional)

Tanpa push, pakai image lokal:

```bash
# base lokal
cd ~/works/arsi/arsi-web-base
ORG=satriolangit VERIFY=0 PUSH=0 ./ci/build-base.sh

# client lokal
cd web-extension-client-<x>
ORG=satriolangit PULL=0 PUSH=0 BUILD_ID=local ./ci/build-client.sh

# jalankan & cek config
docker run -d --name arsi-local -p 8080:80 \
  -e VITE_MODULES=user-management \
  -e VITE_API_BASE=https://api.example.com \
  satriolangit/arsi-web-<client>:local
sleep 2
curl -s http://localhost:8080/config.json | jq .
docker rm -f arsi-local
```

---

## 6. Tahap 4 — Deploy ke VM Linux

### 6.1 Siapkan VM (sekali)

Ikuti `VM-DEPLOYMENT-GUIDE.en.md` §3–§4: user `deploy`, firewall (22/80/443), Docker Engine + Compose. Ringkas:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg jq ufw
# install Docker Engine + compose plugin: VM-DEPLOYMENT-GUIDE.en.md §4
sudo usermod -aG docker deploy
sudo mkdir -p /opt/arsi/<client> && sudo chown deploy:deploy /opt/arsi/<client>
```

### 6.2 Siapkan file deploy

`/opt/arsi/<client>/.env` (chmod 600):

```dotenv
IMAGE_TAG=<buildId>
VITE_CLIENT=<client>
VITE_MODULES=user-management
VITE_API_BASE=https://api.example.com
VITE_ENABLE_AUDIT_LIVE=false
```

`/opt/arsi/<client>/compose.yaml`:

```yaml
name: arsi-<client>

services:
  web:
    image: satriolangit/arsi-web-<client>:${IMAGE_TAG:?set IMAGE_TAG in .env}
    container_name: arsi-web-<client>
    ports:
      - "127.0.0.1:8080:80"
    environment:
      VITE_CLIENT: ${VITE_CLIENT}
      VITE_MODULES: ${VITE_MODULES:?set VITE_MODULES in .env}
      VITE_API_BASE: ${VITE_API_BASE:?set VITE_API_BASE in .env}
      VITE_ENABLE_AUDIT_LIVE: ${VITE_ENABLE_AUDIT_LIVE:-false}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    security_opt:
      - no-new-privileges:true
```

Untuk config penuh dari CI, ganti blok `environment:` dengan:

```yaml
    environment:
      VITE_CONFIG_JSON: |
        {"client":"<client>","modules":["user-management"],"apiBase":"https://api.example.com","featureFlags":{"enableAuditLive":false}}
```

### 6.3 Jalankan

```bash
cd /opt/arsi/<client>
docker login docker.io -u satriolangit    # bila image private
docker compose pull
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:8080/config.json | jq .
```

### 6.4 Reverse proxy + TLS

Terminasi TLS di host (container hanya HTTP:80, di-bind ke `127.0.0.1`):

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

```nginx
server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com --redirect --agree-tos -m ops@example.com
```

Alternatif Caddy dan detail firewall/operasional: `VM-DEPLOYMENT-GUIDE.en.md` §9–§13.

---

## 7. Tahap 5 — Update & Rollback

Deploy versi baru (image client sudah di-push):

```bash
cd /opt/arsi/<client>
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<buildId-baru>/' .env
docker compose pull
docker compose up -d
curl -sf http://127.0.0.1:8080/config.json | jq -e '.client and .modules and .apiBase'
```

Ganti config saja (tanpa image baru):

```bash
nano .env    # VITE_MODULES / VITE_API_BASE / VITE_CONFIG_JSON
docker compose up -d --force-recreate
```

Rollback:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<buildId-lama>/' .env
docker compose pull && docker compose up -d
```

Adopsi base versi baru: bump `manifest.json:baseVersion` di repo extension via PR → CI build image client baru → deploy seperti di atas. Client lain tidak terpengaruh sampai mereka bump sendiri.

---

## 8. Checklist Go-Live & Troubleshooting

Checklist:

- [ ] `docker compose ps` → `running` + `healthy`.
- [ ] `https://app.example.com/config.json` → `client`/`modules`/`apiBase` benar, `no-store`.
- [ ] Login & semua module di `VITE_MODULES` tampil; deep link tidak 404.
- [ ] API call sukses (tidak ada CORS/4xx/5xx di console).
- [ ] TLS valid + auto-renew (`systemctl list-timers | grep certbot`).
- [ ] Tag image immutable tercatat + tag rollback diketahui.
- [ ] `ufw` aktif; container hanya di `127.0.0.1`; `.env` `chmod 600`.

| Gejala | Solusi |
| --- | --- |
| `pull access denied` | Image private & belum `docker login` (token read-only) — §6.3. |
| Container gagal start `[entrypoint] VITE_CONFIG_JSON must be a JSON object` | Nilai bukan object JSON; perbaiki atau kosongkan. |
| App boot tanpa module | `VITE_MODULES` kosong/salah; isi nama module yang ter-bundle. |
| `[bootstrap] module "x" … has no entry` | Module tidak ada di build; rebuild base dengan module tersebut. |
| `check:base` mismatch saat build client | `manifest.json:baseVersion` ≠ tag base; samakan. |
| Config berubah tidak terlihat | Recreate container + hard refresh (`no-store`). |
| 502 dari proxy | Container mati/port salah; cek `docker compose ps` + `curl 127.0.0.1:8080`. |

Detail troubleshooting: `VM-DEPLOYMENT-GUIDE.en.md` §16 dan `DEPLOYMENT-GUIDE.md` §11.

---

## 9. Referensi

| Dokumen | Isi |
| --- | --- |
| `DEVELOPER-GUIDE.md` | Onboarding laptop, membuat/mengubah module & extension, test, build image lokal |
| `DEPLOYMENT-GUIDE.md` | Build/tag/CI, env runtime, registry & rollback |
| `VM-DEPLOYMENT-GUIDE.en.md` | Operasional VM: Docker, TLS, update, firewall, monitoring |
| `CONTRACT.md` | Aturan keras layer, config, versioning |
| Docker Hub | https://hub.docker.com/repositories/satriolangit |

---

**Document version**: 0.1.0
**Last updated**: 2026-10-03
