# TAHAP 9B — DOKUMEN GLOBAL + SEARCH/FILTER
## KASA DIGITAL ARCHIVE — PT. KASA GROUP

Tahap 9B mengaktifkan menu **Dokumen** setelah Tahap 9A Semua Divisi + File Manager berhasil.

## 1. Sebelum mulai
Pastikan Tahap 9A + Fix V9.2 sudah berhasil login dan dashboard/file manager dapat dibuka.

## 2. Stop server
Di terminal backend dan frontend tekan `Ctrl + C`.

## 3. Replace backend
Extract `KASA_BACKEND_TAHAP9B_CLEAN.zip` lalu copy seluruh isinya ke:

`C:\Users\Rifki\Documents\kasa-digital-archive\backend`

Pilih **Replace**. Jangan hapus `.env`. Paket CLEAN tidak berisi `.env`.

Tidak perlu `npm install` karena tidak ada dependency baru.

Jalankan:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

## 4. Replace frontend
Extract `KASA_FRONTEND_TAHAP9B_CLEAN.zip`, copy seluruh isinya ke:

`C:\Users\Rifki\Documents\kasa-digital-archive\frontend`

Pilih **Replace**. `.env` lokal tidak tertimpa.

Jalankan:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Jika menggunakan PowerShell dan npm.ps1 diblokir:

```powershell
npm.cmd run dev
```

## 5. Test
Buka `http://localhost:5173`, login ADMIN, lalu klik **Dokumen**.

Yang harus aktif:
- Menu Dokumen tersorot.
- Dropdown divisi Super Admin dapat memfilter dokumen.
- Search topbar mencari nama dokumen, filename, nomor dokumen, kategori, tag, deskripsi, uploader, extension/file type, dan nama divisi.
- Filter Tipe File dan Kategori.
- Sorting terbaru/terlama, tanggal dokumen, nama, ukuran.
- Grid/List.
- Pagination.
- Klik dokumen membuka detail.

## 6. Kondisi data saat ini
Sebelum Tahap 10 migrasi metadata, menu Dokumen kemungkinan masih menunjukkan **0 dokumen**. Itu benar. Tahap 9B membangun workflow/UI/API terlebih dahulu; data lama baru dimigrasikan pada Tahap 10.

## 7. Security
DIVISION_ADMIN/DIVISION_USER hanya dapat membaca divisinya sendiri. Dokumen di folder password yang belum di-unlock tidak ditampilkan oleh API Dokumen Global.

## 8. Endpoint baru
- `GET /api/v1/documents`
- `GET /api/v1/documents/:documentId`

Query list: `divisionId`, `search`, `fileType`, `category`, `sort`, `page`, `pageSize`.

## Next
Setelah 9B lolos test, lanjut **Tahap 9C — Folder CRUD + password folder + operasi Google Drive**.
