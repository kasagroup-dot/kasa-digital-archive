# TAHAP 9C — Folder CRUD + Password Folder + Sinkron Google Drive
## KASA DIGITAL ARCHIVE — PT. KASA GROUP

Versi: FULLSTACK-0.9.4

Tahap ini mengaktifkan operasi folder yang sebelumnya masih read-only:

- Buat folder
- Rename folder
- Pindah folder
- Soft delete folder ke Recycle Bin
- Password folder
- Unlock folder per session
- Sinkron create / rename / move ke Google Drive
- Audit log folder
- Permission backend tetap berlaku

> Catatan: metadata arsip folder/dokumen lama belum dimigrasikan. Itu tetap dikerjakan pada Tahap 10. Tahap 9C dapat dites dengan membuat folder baru.

---

## A. Update project

### 1. Stop backend dan frontend

Di terminal backend dan frontend tekan:

```text
Ctrl + C
```

### 2. Replace backend

Extract `KASA_BACKEND_TAHAP9C_CLEAN.zip`.

Copy seluruh isi hasil extract ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\backend
```

Pilih **Replace the files in the destination**.

Jangan hapus `.env` yang sudah ada. Paket CLEAN tidak membawa `.env`.

### 3. Replace frontend

Extract `KASA_FRONTEND_TAHAP9C_CLEAN.zip`.

Copy seluruh isi hasil extract ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\frontend
```

Pilih **Replace**.

### 4. Install dependency backend baru

Tahap 9C menambahkan library `googleapis`, jadi kali ini `npm install` WAJIB dijalankan kembali.

Buka Command Prompt:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm install
```

Tunggu sampai selesai.

---

# B. Hubungkan backend ke Google Drive

Aplikasi lama menggunakan Google Drive milik akun KASA. Backend Node.js sekarang perlu izin OAuth dari akun Google yang memiliki / mengelola folder arsip tersebut.

Kita menggunakan OAuth user, bukan Service Account, supaya tetap kompatibel dengan struktur My Drive yang sudah dipakai aplikasi lama.

## 1. Buka Google Cloud Console

Buka browser:

```text
https://console.cloud.google.com/
```

Login menggunakan akun Google yang akan mengelola project API KASA.

## 2. Buat / pilih Google Cloud Project

Di bagian atas klik dropdown nama project.

Pilih **New Project**.

Nama yang disarankan:

```text
KASA Digital Archive
```

Klik **Create** lalu pastikan project tersebut sedang aktif.

## 3. Aktifkan Google Drive API

Di menu Google Cloud cari:

```text
APIs & Services
```

Masuk ke:

```text
Library
```

Cari:

```text
Google Drive API
```

Klik **Google Drive API** → klik **Enable**.

## 4. Siapkan OAuth Consent / Google Auth Platform

Cari menu:

```text
Google Auth Platform
```

Jika muncul tombol **Get Started**, klik.

Isi kira-kira:

```text
App name            : KASA Digital Archive
User support email  : akun Google KASA
Developer contact   : akun Google KASA
```

Untuk Audience:

- Jika menggunakan akun `gmail.com`, pilih **External**.
- Jika memakai Google Workspace dan hanya untuk organisasi sendiri, opsi Internal dapat dipilih jika tersedia.

Kalau status aplikasi masih Testing, tambahkan akun Google pemilik arsip sebagai **Test User**.

Simpan.

## 5. Buat OAuth Client ID

Masuk ke:

```text
Google Auth Platform
→ Clients
```

atau pada tampilan lama:

```text
APIs & Services
→ Credentials
```

Klik:

```text
Create Client
```

Pilih Application Type:

```text
Desktop app
```

Nama:

```text
KASA Backend Local
```

Klik **Create**.

Setelah client terbentuk, klik **Download JSON**.

## 6. Rename JSON OAuth

File hasil download biasanya bernama mirip:

```text
client_secret_xxxxxxxxx.apps.googleusercontent.com.json
```

Rename menjadi tepat:

```text
google-oauth-client.json
```

Copy file itu ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\backend\google-oauth-client.json
```

JANGAN kirim file tersebut ke chat dan jangan upload ke GitHub. File ini berisi OAuth Client Secret.

`.gitignore` Tahap 9C sudah mengabaikan file tersebut.

## 7. Jalankan OAuth Drive

Pastikan backend server sedang STOP dulu, kemudian dari Command Prompt di folder backend jalankan:

```cmd
npm run drive:auth
```

Script akan membuka browser otomatis.

Login menggunakan **akun Google yang mempunyai akses penuh ke folder arsip KASA lama**.

Google akan meminta izin Google Drive.

Klik **Allow / Continue**.

Jika muncul layar bahwa aplikasi belum diverifikasi dan ini adalah OAuth project milik Anda sendiri, ikuti opsi Advanced / Continue yang tersedia untuk melanjutkan sebagai test user.

Setelah sukses browser akan menampilkan:

```text
KASA Digital Archive
Google Drive berhasil terhubung.
```

Terminal akan menampilkan:

```text
✅ Google Drive OAuth berhasil.
```

Script otomatis menulis variabel berikut ke `backend/.env`:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
GOOGLE_OAUTH_REDIRECT_URI
```

Tidak perlu copy refresh token secara manual.

## 8. Test Google Drive

Masih di folder backend:

```cmd
npm run drive:test
```

Target:

```text
✅ Google Drive terhubung.
Root Folder : PT KASA GROUP - DIGITAL ARCHIVE
Root ID     : ...
Trashed     : false
```

Jika test gagal dengan access denied, pastikan OAuth dilakukan menggunakan akun Google yang memang memiliki akses terhadap root folder lama.

---

# C. Hidupkan aplikasi

## Terminal 1 — Backend

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

Biarkan terminal hidup.

## Terminal 2 — Frontend

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Jika terminal VS Code memakai PowerShell dan `npm.ps1` diblok:

```powershell
npm.cmd run dev
```

Buka:

```text
http://localhost:5173
```

Login ADMIN.

---

# D. Test Folder CRUD

Masuk:

```text
Semua Divisi
→ DATA (atau divisi lain)
```

## Test 1 — Buat Folder

Klik:

```text
+ Folder Baru
```

Isi contoh:

```text
Nama Folder : TEST TAHAP 9C
Deskripsi   : Pengujian Folder CRUD
Password    : kosong dahulu
```

Klik **Buat Folder**.

Folder harus muncul di File Manager dan secara fisik juga muncul di Google Drive pada folder divisi tersebut.

## Test 2 — Rename

Klik tombol `...` pada folder → **Rename**.

Ganti menjadi:

```text
TEST TAHAP 9C RENAME
```

Nama di Supabase dan Google Drive harus sama-sama berubah.

## Test 3 — Password Folder

Klik `...` → **Pasang Password**.

Masukkan password minimal 6 karakter dan konfirmasi.

Folder akan menampilkan icon kunci.

Session yang memasang password otomatis dianggap sudah unlock.

Untuk test lock sesungguhnya:

1. Logout.
2. Login kembali.
3. Buka folder tersebut.
4. Aplikasi harus meminta password folder.

Setelah password benar, unlock berlaku sekitar 6 jam untuk session login tersebut.

## Test 4 — Move Folder

Buat folder tujuan lain, lalu klik `...` → **Pindahkan**.

Pilih target.

Supabase `parent_folder_id` dan Google Drive parent harus berubah bersama-sama.

Aplikasi menolak:

- pindah ke dirinya sendiri
- pindah ke anak/subfolder sendiri
- pindah ke divisi lain
- duplicate folder name di parent yang sama

## Test 5 — Delete Folder

Folder harus kosong.

Klik `...` → **Hapus Folder**.

Folder berubah menjadi `DELETED` pada Supabase dan masuk `recycle_items`.

Pada soft delete ini folder Drive belum ditaruh ke Trash — sama seperti business logic aplikasi Apps Script lama. Penghapusan fisik permanen dari Google Drive dilakukan nanti pada menu Recycle Bin/permanent delete.

---

# E. Security Folder Password

Password folder baru disimpan sebagai:

```text
bcrypt
```

Bukan plaintext.

Tabel `folder_unlocks` menyimpan status unlock per login session, bukan password.

Jika password folder diganti:

- `password_version` naik
- seluruh unlock lama dibatalkan
- session admin yang baru mengganti password otomatis mendapat unlock baru

Maksimal 5 password salah berturut-turut akan memicu blok sementara sekitar 10 menit untuk session-folder tersebut.

Folder password tetap merupakan proteksi di aplikasi KASA. Jika folder divisi Google Drive masih menggunakan model `Anyone with the link → Viewer`, orang yang memperoleh direct Drive link tetap mengikuti kebijakan Google Drive tersebut.

---

# F. Error umum

## `Google Drive OAuth belum lengkap`

Jalankan:

```cmd
npm run drive:auth
```

## `Cannot find package 'googleapis'`

Jalankan:

```cmd
npm install
```

## Browser OAuth tidak terbuka

Terminal akan mencetak URL authorization. Copy URL tersebut ke Chrome.

## Tidak mendapatkan refresh token

Pastikan `drive:auth` menggunakan prompt consent. Jika tetap tidak ada, cabut koneksi OAuth KASA pada Google Account → Security → Third-party connections, lalu jalankan ulang `npm run drive:auth`.

## `Folder masih berisi dokumen/subfolder`

Ini sesuai aplikasi lama. Kosongkan isi folder lebih dulu sebelum soft delete.

---

# G. Status setelah Tahap 9C

```text
Dashboard Global       ✅
Semua Divisi           ✅
File Manager           ✅
Dokumen Global         ✅
Create Folder          ✅
Rename Folder          ✅
Move Folder            ✅
Delete Folder          ✅
Folder Password        ✅
Folder Unlock          ✅
Google Drive Sync      ✅ create / rename / move

Dokumen Terbaru        ⏳
Favorit                 ⏳
Recycle Bin UI          ⏳
Activity Log UI         ⏳
Upload dokumen baru     ⏳
Migrasi arsip lama      ⏳ Tahap 10
```
