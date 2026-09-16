# TAHAP 5 — Koneksi Backend ke Supabase

Tujuan tahap ini hanya satu: memastikan backend Node.js lokal dapat membaca database KASA di Supabase dengan aman.

## 1. Ambil Project URL

Buka project KASA di Supabase. Gunakan tombol **Connect** atau buka **Settings → API Keys**.
Salin Project URL yang bentuknya seperti:

`https://xxxxxxxxxxxx.supabase.co`

Jangan kirim Secret Key ke chat.

## 2. Ambil Secret Key untuk backend

Di Supabase buka **Settings → API Keys**.
Cari bagian **Publishable and secret API keys**.
Untuk backend pilih **Secret key** yang diawali `sb_secret_...`.

Jika project lama belum punya Secret key baru, buat melalui **Create new API keys** / buat secret key di halaman tersebut.
Jangan gunakan Publishable key untuk backend admin KASA.

## 3. Isi `.env`

Di project lokal buka:

`C:\Users\Rifki\Documents\kasa-digital-archive\backend\.env`

Isi minimal:

```env
NODE_ENV=development
PORT=4000
API_PREFIX=/api/v1
FRONTEND_URLS=http://localhost:5173

SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_ISI_KEY_ANDA
SUPABASE_SERVICE_ROLE_KEY=

JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=7

GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

APP_NAME=KASA DIGITAL ARCHIVE
COMPANY_NAME=PT. KASA GROUP
APP_VERSION=FULLSTACK-0.5.0
```

## 4. File yang diganti dari Tahap 4

Copy full replacement files dari paket Tahap 5 ke folder backend Anda:

- `.env.example`
- `package.json`
- `src/config/env.js`
- `src/config/supabase.js`
- `src/services/health.service.js`
- `src/controllers/health.controller.js`
- `src/routes/health.routes.js`

Tidak perlu menghapus `node_modules` dan tidak perlu `npm install` ulang karena dependency tidak berubah.

## 5. Restart backend

Terminal yang sedang menjalankan backend: tekan `Ctrl + C`.
Kemudian:

```cmd
npm run dev
```

## 6. Tes server health

Buka:

`http://localhost:4000/api/v1/health`

Harus menunjukkan `supabaseConfigured: true`.

## 7. Tes koneksi database nyata

Buka:

`http://localhost:4000/api/v1/health/supabase`

Target:

- success = true
- message = Koneksi Supabase berhasil.
- status = connected
- divisionCount = 12
- settings APP_NAME = KASA DIGITAL ARCHIVE

Jika `divisionCount` bukan 12 atau ada error, STOP dan kirim screenshot error (JANGAN tampilkan Secret Key).
