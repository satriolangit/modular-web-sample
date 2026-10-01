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
3. Dua versi dipertahankan: `main` = manual; `feat/zero-edit-module-discovery` = kandidat auto. `module-sample` tersedia di keduanya.

---

## 8. Hasil Pengukuran

_(diisi setelah pengukuran presisi — commit berikutnya)_

### 8.1 Metodologi

- Build terpisah per versi: `vite build --outDir dist/manual` (branch `feat/module-sample-main`) dan `dist/auto` (branch `feat/module-sample`), masing-masing 3 run; dilaporkan semua + median.
- Metrik bundle: total JS raw & gzip, jumlah chunk, ukuran main chunk (terbesar), ukuran chunk `module-sample` (dicari via marker `module-sample.sample.postCreated`), delta main chunk antar versi (proxy footprint kode discovery).
- Dev server: uji deteksi file modul baru tanpa restart (auto) dengan probe file `modules/glob-probe/index.tsx` dan request ulang modul transform `moduleLoaders.ts`.
- Runtime: mikro-benchmark konstruksi map loader (loop `createModuleLoaders`) sebagai proxy overhead boot; load modul itu sendiri didominasi dynamic import yang identik di kedua versi.
