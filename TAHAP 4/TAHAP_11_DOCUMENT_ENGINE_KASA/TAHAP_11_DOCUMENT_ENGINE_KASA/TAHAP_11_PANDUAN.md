# TAHAP 11 — DOCUMENT ENGINE
## KASA Digital Archive — PT. KASA GROUP

Tahap 11 mengaktifkan workflow dokumen harian di aplikasi full-stack baru.

## Fitur yang aktif
- FilePond upload queue
- Resumable upload 4 MB/chunk
- Multi-file upload
- Duplicate preflight
- Duplicate action: New Version / Auto Rename
- Preview Google Drive
- Download melalui backend terautentikasi
- Open in Google Drive
- Rename dokumen + nama file Drive
- Move dokumen + sinkron parent Drive
- Soft delete ke Recycle Bin
- Favorite toggle
- Version history
- Download versi lama
- Permission dan division access tetap dicek backend
- Folder password tetap dihormati

## Tidak perlu SQL baru
Schema Tahap 3 sudah memiliki `document_versions`, `favorites`, `recycle_items`, dan `upload_sessions`, jadi Tahap 11 tidak membutuhkan perubahan schema Supabase.

## 1. Stop backend dan frontend
Di terminal backend dan frontend tekan:

```text
Ctrl + C
```

## 2. Replace backend
Extract `KASA_BACKEND_TAHAP11_CLEAN.zip`.
Copy seluruh isi hasil extract ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\backend
```

Pilih **Replace**.

Jangan hapus:
- `.env`
- `google-oauth-client.json`
- credential lokal lain yang sudah berhasil dipakai

ZIP CLEAN tidak membawa `.env` asli.

Backend Tahap 11 tidak menambah dependency baru dibanding Tahap 10, tetapi aman jika ingin menjalankan:

```cmd
npm install
```

## 3. Replace frontend
Extract `KASA_FRONTEND_TAHAP11_CLEAN.zip`.
Copy seluruh isi ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\frontend
```

Pilih **Replace**.

## 4. Wajib npm install frontend
Tahap 11 menambah package:
- `filepond`
- `react-filepond`

Jalankan:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm install
```

## 5. Hidupkan backend
Terminal 1:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

Biarkan hidup.

## 6. Hidupkan frontend
Terminal 2:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Jika PowerShell memblok `npm.ps1`:

```powershell
npm.cmd run dev
```

Buka:

```text
http://localhost:5173
```

Lakukan `Ctrl + F5` sekali.

# TEST WAJIB TAHAP 11

## Test 1 — Upload file baru
ADMIN → Semua Divisi → DATA → masuk folder yang aman → **Upload File**.

Pilih file kecil dulu, misalnya PDF / XLSX 1–5 MB.

Target:
- File muncul di FilePond sebelum submit
- Progress per file bergerak
- Selesai tanpa overlay global lama
- File muncul di File Manager
- File fisik muncul di Google Drive folder yang sama
- Metadata masuk ke Supabase `documents`

## Test 2 — Preview
Klik dokumen → **Preview**.

Target:
- modal Document Engine terbuka
- Google Drive preview tampil di dalam modal

## Test 3 — Download
Klik **Download**.

Target:
- file diunduh melalui backend
- permission `CAN_DOWNLOAD` tetap berlaku

## Test 4 — Favorite
Klik **Favorit**.

Target:
- status favorit berubah
- refresh tetap mempertahankan status

## Test 5 — Rename
Klik **Rename**.

Contoh:
```text
TEST DOKUMEN TAHAP 11
```

Target:
- nama dokumen berubah di Supabase
- nama file fisik di Drive ikut berubah dengan extension yang sama

## Test 6 — Move Document
Klik **Pindah** → pilih folder tujuan.

Target:
- dokumen pindah folder di aplikasi
- parent file di Google Drive ikut pindah

## Test 7 — Duplicate / New Version
Upload file dengan nama yang sama lagi.

FilePond harus mendeteksi duplicate dan menawarkan:
- Upload sebagai versi baru
- Auto rename

Pilih **Upload sebagai versi baru**.

Target:
- dokumen tetap satu record aktif
- `current_version` naik
- file lama masuk `document_versions`
- menu **Versi** menampilkan history

## Test 8 — Auto Rename
Upload duplicate lagi → pilih **Auto rename**.

Target contoh:
```text
Laporan.xlsx
Laporan (1).xlsx
```

Keduanya menjadi dua dokumen aktif.

## Test 9 — Delete
Klik **Hapus**.

Target:
- record status menjadi DELETED
- masuk `recycle_items`
- hilang dari File Manager aktif
- file Google Drive belum dihapus permanen (diselesaikan pada modul Recycle Bin)

## Test 10 — File besar
Setelah file kecil sukses, coba file 20–50 MB.

Target:
- progress terus bergerak
- upload dilakukan 4 MB/chunk
- browser tidak perlu mengubah file ke Base64

# Endpoint Tahap 11

```text
POST   /api/v1/uploads/preflight
POST   /api/v1/uploads/resumable/start
PUT    /api/v1/uploads/resumable/:uploadId/chunk?offset=...
DELETE /api/v1/uploads/resumable/:uploadId

GET    /api/v1/document-engine/:documentId/preview
GET    /api/v1/document-engine/:documentId/download
GET    /api/v1/document-engine/:documentId/versions
GET    /api/v1/document-engine/:documentId/versions/:versionId/download
PATCH  /api/v1/document-engine/:documentId/rename
PATCH  /api/v1/document-engine/:documentId/move
POST   /api/v1/document-engine/:documentId/favorite
DELETE /api/v1/document-engine/:documentId
```

# Catatan keamanan
- OAuth Google refresh token tetap hanya di backend `.env`.
- React tidak pernah menerima Google OAuth token atau Supabase secret key.
- Download tetap melewati JWT/session KASA.
- Upload memeriksa division, permission, dan folder password di server.
- Delete Tahap 11 bersifat soft delete.

# Status setelah Tahap 11
Tahap berikutnya dapat difokuskan ke menu yang masih belum aktif penuh:
- Dokumen Terbaru
- Favorit
- Recycle Bin + Restore/Permanent Delete
- Activity Log
- Manajemen User
- Permission
- System Settings
