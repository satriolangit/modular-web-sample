# Perbandingan: Auto-Discovery vs Manual Wiring

**Status:** Analisis + hasil pengukuran
**Tanggal:** 2026-09-25
**Branch manual:** `main` (+ `feat/module-sample-main`)
**Branch auto-discovery:** `feat/zero-edit-module-discovery` (+ `feat/module-sample` stacked)
**Konteks:** Dua versi discovery hidup berdampingan; `main` **tidak** di-merge dengan auto-discovery.

---

## 1. Ringkasan Eksekutif

| Concern utama | Manual | Auto | Pemenang |
| --- | --- | --- | --- |
| Frekuensi modifikasi `web-container` | 7 file per modul baru (linear) | 0 file per modul baru | **Auto** |
| Bundle size | baseline | ±0 (delta hanya kode discovery < 1 KB) | Seri |
| Runtime performance | lazy `import()` | lazy `import()` | Seri |
| tsc coverage source modul di container | Ya | Tidak (pindah ke web-modules) | Manual |
| Prasyarat infra | Docker apa pun | BuildKit ≥ 1.7 (`COPY --parents`) | Manual |
| Kerja paralel antar tim modul | Rawan konflik file bersama | Nol konflik | **Auto** |

Kesimpulan: perbedaan sesungguhnya ada di **DX/maintenance**, bukan di bundle/performance. Angka presisi ada di §8.

> **Update:** sejak branch `feat/module-loaders-codegen`, tersedia **varian ketiga** — manual wiring dengan loader map yang di-generate dari `package.json` name (tetap static/lazy, bukan glob). Varian ini menghilangkan edit `discover.ts`/alias/tsconfig tanpa kehilangan tsc coverage — lihat §2b.

---

## 2. Mekanisme

| Aspek | Manual (`main`) | Auto (`feat/zero-edit-module-discovery`) |
| --- | --- | --- |
| Registrasi entry | Map literal di `discover.ts` | `import.meta.glob('../../../web-modules/modules/*/index.tsx')` + `createModuleLoaders()` di `moduleLoaders.ts` |
| Alias modul (container) | Per modul: `@arsi/module-<name>` + `@arsi/module-<name>/entry` | 1 aturan wildcard regex `^@arsi/module-([^/]+)$` → `public.ts` (entry tidak pakai alias) |
| tsconfig paths modul | Per modul (2 paths) | 1 wildcard `@arsi/module-*` |
| Docker | `COPY` eksplisit per modul + guard `check:dockerfile` | `# syntax=docker/dockerfile:1.7` + `COPY --parents web-modules/modules/*/package.json` |
| Lazy loading | `import()` dinamis per modul → chunk terpisah | `import.meta.glob` default `eager: false` → chunk terpisah |
| config.json | Runtime selection; produksi dikelola CI | Sama |
| Konvensi | Eksplisit (daftar manual) | Folder `modules/<name>/index.tsx` = nama di `config.modules` |

---

### 2b. Varian Ketiga: Manual + Codegen (generated loader map)

Branch `feat/module-loaders-codegen`. Loader map `src/bootstrap/moduleLoaders.generated.ts` di-generate dari `web-modules/modules/*/package.json` (`name`) via `npm run gen:modules` (otomatis lewat pre-hooks) + sync test; alias/tsconfig memakai wildcard satu kali.

| Aspek | Manual lama | Manual + codegen | Auto (glob) |
| --- | --- | --- | --- |
| Edit container per modul | 7 file / 10 titik | **2 file** (Dockerfile + config.json) | 0 |
| Sumber map | tulis tangan | generated (committed) | implicit glob |
| tsc coverage source modul | ✅ | ✅ (import statis) | ❌ |
| Langkah tambahan | — | `gen:modules` (pre-hooks) | — |
| Prasyarat infra | — | — | BuildKit ≥1.7 |
| Risiko stale | — | ada → sync test | — |
| Dev: tambah modul | edit + restart | `gen:modules` + restart | terdeteksi tanpa restart |
| Bundle | baseline | ≈ baseline (kode map setara) | +100 B gzip |

## 3. Frekuensi Modifikasi `web-container`

**Bukti commit:**

| | Manual | Auto |
| --- | --- | --- |
| Commit wiring per modul | `35bee47` — 7 file, +36 baris (aliases +14, tsconfig container +4, discover +1, Dockerfile +1, config +2, web-modules aliases +12, tsconfig +4/−2) | Tidak ada file wiring; `0fe21d3` hanya file modul + lockfile web-modules |
| Pertumbuhan | Linear per modul (alias & paths bertambah terus) | Konstan (0) |
| Titik gagal | Lupa 1 dari 7 file → `[bootstrap] ... not wired` / chunk hilang; guard hanya meng-cover Docker | Fail-fast otomatis (`has no entry in web-modules/modules`) |
| Kerja paralel antar tim modul | Semua tim mengedit file yang sama (`aliases.cjs`, `tsconfig.json`, `discover.ts`) → konflik merge rutin | Tidak ada file bersama → nol konflik |
| Repo web-modules | Alias + tsconfig per modul juga wajib edit | Tidak perlu |

Jumlah entri per modul (terukur dari file): alias container 2 baris, paths container 2 baris, loader 1 baris, Dockerfile 1 baris, alias web-modules 2 baris, paths web-modules 2 baris = **10 titik edit per modul** (7 file).

---

## 4. Bundle Size — Analisis

- Kedua versi memakai dynamic import per modul → **jumlah dan isi chunk modul identik** (source & module graph sama).
- Delta hanya kode discovery yang masuk main chunk:
  - Manual: object literal 3 import + lookup loop (~0,3 KB).
  - Auto: object literal hasil glob + `createModuleLoaders()` (loop + regex) (~0,5–1 KB).
- `COPY --parents` hanya memengaruhi Docker build, bukan bundle.
- Risiko khusus auto: file apa pun di `modules/*/index.tsx` **otomatis ikut ter-bundle** (chunk) walau tidak ada di `config.modules`; manual hanya membundel yang didaftarkan.

Baseline manual (3 modul, sebelum pengukuran formal): total 884 KB raw / ~279 KB gzip; main chunk 528 KB; chunk `module-sample` 28 KB raw / 7,1 KB gzip.

---

## 5. Performance — Analisis

| Dimensi | Manual | Auto | Catatan |
| --- | --- | --- | --- |
| Runtime load | Lazy saat init, urutan `config.modules` | Sama | Identik |
| Boot overhead | Map literal (0) | Bangun map sekali (O(n), n kecil) + regex | Mikrodetik |
| Dev server (tambah modul) | Wajib edit file → HMR normal | File baru: perlu diuji apakah perlu restart | Diuji di §8.4 |
| Build time | Baseline | Scan folder kecil + alias regex | Diukur di §8.1 |
| CI/typecheck | `tsc` container ikut memeriksa source modul (import alias statis) | `tsc` tidak menganalisis glob → coverage modul hanya di web-modules | Gate kualitas |
| Docker build | COPY per modul (cache aman) | `COPY --parents` (cache aman, BuildKit ≥1.7) | Prasyarat infra |

---

## 6. Matriks Keputusan

| Concern | Manual | Auto |
| --- | --- | --- |
| Frekuensi edit container | ❌ 7 file / 10 titik per modul | ✅ 0 |
| Konflik paralel tim | ❌ tinggi | ✅ nol |
| Bundle size | ✅ baseline | ✅ ±0 |
| Runtime performance | ✅ | ✅ |
| tsc coverage modul di container | ✅ | ❌ (pindah ke web-modules) |
| Prasyarat Docker | ✅ apa pun | ⚠️ BuildKit ≥1.7 |
| Eksplisit/traceable | ✅ | ⚠️ bergantung konvensi folder |
| Risiko bundling tak sengaja | ✅ terkendali | ⚠️ ada |

---

## 7. Rekomendasi

1. **Banyak modul + tim paralel** → auto-discovery arah yang benar; dua gap ditutup dengan: (a) `web-modules` typecheck sebagai gate CI wajib, (b) BuildKit (sudah tersedia di `ubuntu-latest`).
2. **Baseline stabil** → manual (eksplisit, tanpa prasyarat, tsc coverage ganda) untuk `main` saat ini.
3. Tiga varian yang tersedia: `main` = manual klasik; `feat/module-loaders-codegen` = manual + generated loader map (kompromi: nol edit discover/alias/tsconfig, tsc coverage terjaga); `feat/zero-edit-module-discovery` = auto glob (nol edit, tanpa tsc coverage, butuh BuildKit). `module-sample` tersedia di ketiganya.

---

## 8. Hasil Pengukuran

Dijalankan 2026-09-25 pada branch manual `feat/module-sample-main` dan auto `feat/module-sample` (3 modul aktif: user-management, product-management, module-sample). Artefak build: `dist/manual` dan `dist/auto`.

### 8.1 Metodologi

- Build terpisah per versi: `vite build --outDir dist/manual` / `dist/auto`, masing-masing 3 run; dilaporkan semua + median.
- Metrik bundle: total JS raw & gzip, jumlah chunk, ukuran main chunk (terbesar), ukuran chunk `module-sample` (via marker `module-sample.sample.postCreated`), delta main chunk antar versi (proxy footprint kode discovery).
- Dev server: uji deteksi file modul baru tanpa restart (auto) dengan probe `modules/glob-probe/index.tsx` dan request ulang modul transform `moduleLoaders.ts`.
- Runtime: mikro-benchmark konstruksi map loader (`createModuleLoaders`) sebagai proxy overhead boot.

### 8.2 Build time (wall-clock, 3 run)

| Run | Manual | Auto |
| --- | --- | --- |
| 1 (dingin) | 3,80 s | 3,62 s |
| 2 | 3,01 s | 3,19 s |
| 3 | 2,83 s | 2,85 s |
| **Median** | **3,01 s** | **3,19 s** |
| Vite internal (run 3) | 2,44 s | 2,46 s |

Selisih median 0,18 s (6%) masih dalam noise run-to-run; Vite internal hanya +0,02 s. **Tidak signifikan.**

### 8.3 Bundle size (presisi byte)

| Metrik | Manual | Auto | Delta |
| --- | --- | --- | --- |
| Jumlah chunk JS | 12 | 12 | 0 |
| Total JS raw | 876.238 B | 876.608 B | **+370 B (+0,04%)** |
| Total JS gzip | 282.436 B | 282.536 B | **+100 B (+0,035%)** |
| Main chunk raw | 539.175 B | 539.540 B | +365 B |
| Main chunk gzip | 173.441 B | 173.554 B | +113 B |
| Chunk `module-sample` raw | 25.683 B | 25.678 B | −5 B (noise) |
| Chunk `module-sample` gzip | 7.107 B | 7.101 B | −6 B |
| CSS raw / gzip | 32.106 / 8.700 | 32.106 / 8.700 | 0 |

Seluruh delta (+100 B gzip) berasal dari kode discovery di main chunk. **Praktis nol.**

### 8.4 Dev server: deteksi file modul baru (versi auto)

- Probe `web-modules/modules/glob-probe/index.tsx` dibuat saat dev server berjalan (tanpa edit file container).
- Dalam <2 detik, transform `moduleLoaders.ts` sudah memuat `glob-probe` **tanpa restart**.
- Kesimpulan: kekhawatiran "glob perlu restart" **tidak terbukti** di Vite 5.4 — glob di-watch secara dinamis.

### 8.5 Runtime overhead (mikro-benchmark)

| Jumlah entries | Konstruksi map (`createModuleLoaders`) |
| --- | --- |
| 3 | 0,48 µs/call |
| 50 | 8,53 µs/call |

Dijalankan sekali saat boot; tidak terukur dibanding biaya dynamic import modul itu sendiri (identik di kedua versi).

### 8.6 Kesimpulan Pengukuran

- **Bundle size: seri** — auto +100 B gzip (+0,035%), hanya kode discovery.
- **Build time: seri** — perbedaan dalam noise.
- **Runtime: seri** — keduanya lazy `import()`; overhead map auto ~sub-mikrodetik.
- **Dev experience: auto lebih baik** — modul baru terdeteksi tanpa edit container dan tanpa restart.
- Keputusan akhir tetap pada trade-off maintenance vs (tsc coverage + prasyarat BuildKit) di §6.
