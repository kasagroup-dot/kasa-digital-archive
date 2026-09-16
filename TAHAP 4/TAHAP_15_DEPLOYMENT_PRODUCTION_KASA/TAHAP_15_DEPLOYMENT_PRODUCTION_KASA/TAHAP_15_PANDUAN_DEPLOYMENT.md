# TAHAP 15 — DEPLOYMENT PRODUCTION
## KASA Digital Archive — PT. KASA GROUP

Target:

```
GitHub (private monorepo)
   ├── backend/  -> Railway
   └── frontend/ -> Cloudflare Pages
                       |
                       +--> HTTPS
Railway -> Supabase + Google Drive
```

## A. Sebelum upload GitHub

Pastikan Maintenance Mode kembali **OFF** setelah pengujian.

Dari root project lokal:

```cmd
git status
```

Jangan pernah ada file berikut di commit:

- `backend/.env`
- `frontend/.env`
- `backend/google-oauth-client.json`
- `backend/client_secret*.json`
- `node_modules`
- `dist`

Paket ini sudah menyediakan `.gitignore` root.

## B. GitHub

1. Buat repository **Private** bernama `kasa-digital-archive`.
2. Jangan centang README/gitignore/license ketika membuat repo jika folder lokal akan langsung dipush.
3. Di CMD pada folder `C:\Users\Rifki\Documents\kasa-digital-archive`:

```cmd
git init
git add .
git status
git commit -m "KASA Digital Archive production baseline"
git branch -M main
git remote add origin https://github.com/USERNAME_GITHUB/kasa-digital-archive.git
git push -u origin main
```

Sebelum `git commit`, cek `git status` sekali lagi dan pastikan secret tidak muncul.

## C. Railway — backend

1. Buka Railway dan buat project baru.
2. Pilih **Deploy from GitHub repo** lalu repository `kasa-digital-archive`.
3. Pilih/create service backend.
4. Service > **Settings**:
   - Root Directory: `/backend`
   - Start Command: `npm start` (Railpack biasanya mendeteksi otomatis, tetapi boleh dipastikan manual)
   - Healthcheck Path: `/api/v1/health`
5. Service > **Variables**: masukkan variable production dari `backend/railway.env.example` menggunakan nilai asli dari `.env` lokal.
   - Jangan set `PORT`; Railway inject otomatis.
   - `NODE_ENV=production`
   - sementara `FRONTEND_URLS` boleh diisi `http://localhost:5173`; setelah Cloudflare URL didapat, WAJIB diganti.
   - `REFRESH_COOKIE_SAME_SITE=none` untuk domain sementara pages.dev + railway.app.
6. Deploy.
7. Settings > Networking > **Generate Domain**.
8. Test:

```
https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/v1/health
https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/v1/health/supabase
```

Keduanya harus `success: true`.

## D. Cloudflare Pages — frontend

1. Cloudflare Dashboard > **Workers & Pages**.
2. Create application > **Pages** > Import existing Git repository.
3. Pilih repository `kasa-digital-archive`.
4. Build configuration:
   - Production branch: `main`
   - Root directory: `/frontend`
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Environment variables (Production):
   - `VITE_API_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/v1`
   - `VITE_APP_VERSION=FULLSTACK-0.15.0`
   - `NODE_VERSION=20`
6. Save and Deploy.
7. Catat URL `https://YOUR-PROJECT.pages.dev`.

## E. Final CORS + cookie

Kembali ke Railway > backend > Variables:

```env
FRONTEND_URLS=https://YOUR-PROJECT.pages.dev
REFRESH_COOKIE_SAME_SITE=none
NODE_ENV=production
```

Apply / redeploy.

Setelah backend redeploy selesai, buka Pages URL dan test login.

> Catatan cookie: `pages.dev` dan `railway.app` berbeda site. `SameSite=None; Secure` sudah disiapkan untuk testing production sementara. Untuk reliabilitas session terbaik di semua browser, tahap akhir dianjurkan memakai custom domain satu induk, misalnya `archive.example.com` + `api-archive.example.com`.

## F. Production smoke test

Uji berurutan:

1. ADMIN login.
2. Refresh browser (session harus tetap ada).
3. Dashboard dan Semua Divisi.
4. Buka folder hasil migrasi.
5. Upload file kecil dengan FilePond.
6. Preview + download.
7. Duplicate -> New Version / Auto Rename.
8. Rename + Move.
9. Favorite.
10. Delete -> Recycle Bin -> Restore.
11. Test user division: tidak boleh melihat divisi lain.
12. Permission restriction.
13. Maintenance ON: non-Super Admin diblok; ADMIN tetap masuk; setelah test kembalikan OFF.
14. System Settings > Refresh Diagnostics.

## G. Production readiness

Railway shell/local environment production harus memenuhi:

```text
Critical ready   : YES
Production ready : YES
```

Jangan mematikan aplikasi Apps Script lama sebelum smoke test production selesai.

## H. Cutover aman

Setelah production lolos:

1. Lakukan final sync jika ada perubahan pada aplikasi lama setelah Tahap 10.
2. Set aplikasi Apps Script lama read-only / Maintenance.
3. Gunakan aplikasi production baru untuk transaksi arsip baru.
4. Simpan aplikasi lama sementara sebagai rollback.
5. Jangan hapus Spreadsheet lama atau Apps Script pada hari cutover.

## I. Rollback

Jika production mengalami masalah kritis:

1. Aktifkan Maintenance di aplikasi baru bila masih dapat diakses.
2. Arahkan user sementara kembali ke aplikasi Apps Script lama.
3. Jangan hapus record Supabase/Drive secara manual.
4. Perbaiki branch GitHub, deploy ulang Railway/Cloudflare.
5. Lakukan rekonsiliasi data baru sebelum cutover ulang.
