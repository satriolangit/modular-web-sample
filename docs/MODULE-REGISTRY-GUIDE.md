# Module Registry Guide — Upload & Kelola Module Runtime

**Version**: 0.1.0
**Audience**: DevOps / platform engineer
**Terkait**: `DEPLOYMENT-GUIDE.md` §6 (Runtime Configuration), `CONTRACT.md` §14 (Configuration), `ZERO-TO-DEPLOY-GUIDE.md`, `VM-DEPLOYMENT-GUIDE.en.md`
**Folder**: `registry-service/` (service) + `web-modules/modules/registry-admin/` (module core UI)

> English version: `MODULE-REGISTRY-GUIDE.en.md`.

---

## 1. Ikhtisar

`registry-service` adalah service Node/Express yang menjadi **satu-satunya penulis** `registry.json` dan penyimpan file module (`data/modules/<name>/<version>/`). Container membacanya lewat loader runtime, dan module core `registry-admin` menyediakan UI admin di route `/system/modules`.

- **Upload** zip module (hasil `pack:module`) → validasi → ekstraksi → registry diperbarui → audit JSONL.
- **List**, **enable/disable**, dan **delete** module lewat API admin ber-bearer token.
- **Publik** (`/registry.json`, `/modules/**`) dibaca container; **admin** (`/api/modules`) butuh token service.
- Perubahan terlihat saat **boot berikutnya**: loader fail-closed, app klien yang sedang jalan tidak dimatikan.

---

## 2. Arsitektur

```
web-container (SPA)                              registry-service (Node/Express)
┌───────────────────────────────┐                ┌──────────────────────────────────────┐
│ module core registry-admin    │ Bearer token   │ POST   /api/modules      (upload)    │
│  route /system/modules        │ ─────────────► │ GET    /api/modules      (list)      │
│ loader runtime                │                │ PATCH  /api/modules/:name (enabled)  │
│  baca /registry.json ─────────┼──────────────► │ DELETE /api/modules/:name            │
└───────────────────────────────┘  GET publik    │ GET /registry.json, /modules/**      │
                                                 │ data/: registry.json, modules/**,    │
                                                 │        audit.jsonl                   │
                                                 └──────────────────────────────────────┘
```

Prinsip:

- **Satu sumber kebenaran** — hanya service yang menulis `registry.json` (atomic temp + rename); UI tidak menyentuh file.
- **UI tipis** — module hanya memanggil API + render; seluruh validasi/verifikasi ada di service.
- **API admin ketat** — tanpa `ADMIN_CORS_ORIGIN`, `/api/**` tidak mengirim header CORS (same-origin).

---

## 3. Environment Service

| Env | Default | Wajib | Fungsi |
| ------------------- | ------------------------ | ----- | ------------------------------------------------------------ |
| `PORT` | `4310` | Tidak | Port HTTP service. |
| `ADMIN_TOKEN` | — | **Ya** | Bearer token untuk `/api/modules*`; service gagal start bila kosong. |
| `ADMIN_ACTOR` | `sysadmin` | Tidak | Nama aktor yang dicatat di `audit.jsonl`. |
| `ADMIN_CORS_ORIGIN` | — (kosong) | Tidak | Origin UI admin yang diizinkan (mis. `https://portal.example.com`). Bila kosong, **tidak ada** header CORS di `/api/**` (strict same-origin); preflight `OPTIONS` dijawab `204`. |
| `CORS_ORIGIN` | `*` | Tidak | Origin untuk `/registry.json` dan `/modules/**` (aset publik yang dibaca lintas origin oleh container). |
| `DATA_DIR` | `./data` | Tidak | Folder data: `registry.json`, `modules/`, `audit.jsonl`. |
| `PUBLIC_BASE_URL` | `http://localhost:<PORT>` | Tidak | Base URL publik untuk `manifest`/`css` di `registry.json`; wajib benar di produksi. |
| `SIGNING_PUBLIC_KEY` | — | Tidak | Public key ed25519 (PEM) untuk memverifikasi `signature.ed25519`; bila diisi, zip tanpa signature valid ditolak. |
| `MAX_UPLOAD_BYTES` | `20971520` (20 MB) | Tidak | Batas ukuran file zip; lebih besar → `413`. |

Catatan:

- `ADMIN_CORS_ORIGIN` **tidak** membuka `/api/**` ke publik — token tetap wajib.
- `CORS_ORIGIN=*` hanya untuk aset publik tanpa credential; jangan pakai `*` untuk endpoint admin.

---

## 4. Menjalankan Service

```bash
cd registry-service
npm install
ADMIN_TOKEN=<token-panjang-acak> npm start
```

Kesehatan: `curl -s http://localhost:4310/healthz` → `{"ok":true}`.

- Mode dev (watch): `ADMIN_TOKEN=... npm run dev`.
- Data lokal di `registry-service/data/` (gitignored); override dengan `DATA_DIR=/var/lib/registry`.
- Token produksi dari secret manager; jangan simpan di repo atau di `VITE_*`.

---

## 5. API + Contoh curl

| Method | Path | Auth | Hasil sukses | Error umum |
| ------ | -------------------- | ------ | ---------------------- | ---------------------------- |
| `GET` | `/healthz` | — | `200 {"ok":true}` | — |
| `GET` | `/registry.json` | — | `200` isi registry | — |
| `GET` | `/modules/**` | — | `200` file statis | `404` |
| `POST` | `/api/modules` | Bearer | `201 {module}` | `400`, `401`, `409`, `413` |
| `GET` | `/api/modules` | Bearer | `200 {modules:[...]}` | `401` |
| `PATCH` | `/api/modules/:name` | Bearer | `200 {module}` | `400`, `401`, `404` |
| `DELETE` | `/api/modules/:name` | Bearer | `204` | `401`, `404` |

Upload:

```bash
# 1) Build + pack module (dari web-container) → dist/modules/<name>-<versi>.zip
cd web-container
MODULE=module-runtime-demo npm run build:module
MODULE=module-runtime-demo npm run pack:module --silent

# 2) Upload zip ke service
curl -fsS -X POST http://localhost:4310/api/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@dist/modules/module-runtime-demo-0.1.0.zip"
```

List:

```bash
curl -fsS http://localhost:4310/api/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Enable/disable:

```bash
curl -fsS -X PATCH http://localhost:4310/api/modules/module-runtime-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Delete:

```bash
curl -fsS -X DELETE http://localhost:4310/api/modules/module-runtime-demo \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Menghubungkan container ke service (env runtime):

```dotenv
VITE_REGISTRY_URL=https://registry.example.com/registry.json
VITE_REGISTRY_ADMIN_URL=https://registry.example.com
VITE_MODULES=user-management,registry-admin,module-runtime-demo
```

---

## 6. Alur UI

1. Set `VITE_REGISTRY_ADMIN_URL` + `VITE_REGISTRY_URL` (§5) lalu recreate container.
2. Aktifkan module core: `VITE_MODULES=...,registry-admin`.
3. Buka `/system/modules` (menu **Module Registry**, group `system`).
4. Isi **Admin token** (`ADMIN_TOKEN`) → **Save token**; disimpan di `localStorage['registry-admin:token']`.
5. Upload zip hasil `pack:module` (drag-drop atau pilih file).
6. Kelola tabel: **Enable/Disable** dan **Delete** per module.

Catatan:

- Bila `config.registryAdminUrl` kosong, halaman menampilkan error "not configured"; service tidak diregister.
- Request memakai header `Authorization: Bearer <token>` dari localStorage; `401` berarti token salah.
- Delete menghapus entry registry sekaligus file module; disable hanya mengubah flag `enabled`.

---

## 7. Keamanan & Deployment

- **Token** — `ADMIN_TOKEN` statis dan wajib; kirim via header `Authorization`; rotasi berkala dan selalu lewat HTTPS.
- **Zip-slip** — service menolak entry absolut, `..`, dan backslash, lalu hanya mengekstrak setelah validasi manifest/file wajib.
- **Ukuran** — `MAX_UPLOAD_BYTES` (default 20 MB) membatasi zip; kelebihan → `413`.
- **CORS** — `/api/**` strict (hanya `ADMIN_CORS_ORIGIN` bila diisi); `/registry.json` + `/modules/**` publik untuk loader.
- **Batas jaminan** — `integrity` (sha384 atas `mf-manifest.json`) dan signature opsional menjamin **manifest**, bukan autentikasi seluruh kode bundle; jangan upload dari sumber tidak tepercaya.
- **Deploy service** — jalankan di belakang reverse proxy TLS, set `PUBLIC_BASE_URL=https://registry.example.com`, persistenkan `DATA_DIR` + backup; single instance untuk MVP.
- **Deploy container** — CSP sebaiknya mengizinkan `script-src`/`style-src`/`connect-src` ke origin registry (remote entry + CSS dimuat dari sana); sajikan `/registry.json` dengan `no-store` dan `/modules/**` immutable.
- **Core module** — `registry-admin` ikut `config.modules` default (dev/portal internal), bukan dipaksa ke semua klien produksi; aksi tetap butuh token service dan RBAC menyusul di `phase.02-rbac-navigation.md`.

---

**Document version**: 0.1.0
**Last updated**: 2026-10-06
