# TAHAP 9A — SEMUA DIVISI + FILE MANAGER
## KASA DIGITAL ARCHIVE — PT. KASA GROUP

Tahap 9 dibagi satu per satu agar lebih aman:

- **9A (paket ini): Semua Divisi + File Manager read/navigation**
- 9B: Dokumen global + pencarian/filter dokumen
- 9C: Folder CRUD + password folder + Google Drive write

## Yang sudah aktif di 9A

1. Menu **Semua Divisi** benar-benar aktif.
2. Super Admin melihat semua 12 divisi.
3. Division Admin/User hanya melihat divisinya sendiri.
4. Tiap card divisi menampilkan jumlah folder dan dokumen aktif dari Supabase.
5. Klik divisi membuka **File Manager**.
6. File Manager mempunyai breadcrumb, grid/list, search dalam folder, sort, pagination, folder/document card.
7. Endpoint backend:
   - `GET /api/v1/file-manager/divisions`
   - `GET /api/v1/file-manager/contents`
   - `GET /api/v1/file-manager/tree`
8. Backend tetap memeriksa JWT, session aktif, `CAN_VIEW`, dan pembatasan divisi.
9. Folder password tetap dijaga: nama folder boleh terlihat, tetapi backend menolak membuka isi folder yang terkunci sampai ada unlock session yang valid.

## Kenapa isi File Manager masih bisa 0

Metadata `FOLDERS` dan `DOCUMENTS` dari Spreadsheet lama belum dimigrasikan ke Supabase. Itu memang dijadwalkan pada Tahap 10. Jadi pada Tahap 9A yang diuji adalah menu, permission, navigation, dan API baru.

## Cara update

### 1. Stop backend dan frontend
Pada dua terminal yang aktif tekan `Ctrl + C`.

### 2. Backend
Extract `KASA_BACKEND_TAHAP9A_CLEAN.zip` lalu copy semua isinya ke:

`C:\Users\Rifki\Documents\kasa-digital-archive\backend`

Pilih **Replace the files in the destination**.

Jangan hapus `.env` milik Anda. Paket CLEAN tidak membawa file `.env`.

Tidak perlu `npm install` ulang karena tidak ada dependency baru.

Jalankan:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

### 3. Frontend
Extract `KASA_FRONTEND_TAHAP9A_CLEAN.zip` lalu copy semua isinya ke:

`C:\Users\Rifki\Documents\kasa-digital-archive\frontend`

Pilih **Replace**.

Tidak perlu `npm install` ulang.

Jalankan:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Jika terminal VS Code Anda PowerShell dan `npm.ps1` diblokir, gunakan:

```powershell
npm.cmd run dev
```

### 4. Test
Buka `http://localhost:5173`.

Login ADMIN, lalu:

1. Klik **Semua Divisi**.
2. Harus muncul 12 card divisi.
3. Klik salah satu, misalnya DATA / HR / IT.
4. Halaman harus berubah ke **File Manager**.
5. Breadcrumb root harus memakai nama divisi.
6. Tombol Grid/List harus bekerja.
7. Search dan sort harus dapat digunakan.
8. Karena data lama belum dimigrasikan, empty-state masih normal.

## Jangan lanjut dulu ke 9B jika

- Semua Divisi tidak muncul,
- hanya sebagian divisi muncul saat login ADMIN,
- klik divisi error,
- File Manager blank,
- login/session berubah bermasalah.

Kirim screenshot bila ada error.
