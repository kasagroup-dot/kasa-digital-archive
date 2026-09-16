# TAHAP 12 — MENU OPERASIONAL HARIAN
## KASA DIGITAL ARCHIVE — PT. KASA GROUP

Tahap 12 mengaktifkan empat menu sidebar yang sebelumnya masih placeholder:

1. Dokumen Terbaru
2. Favorit
3. Recycle Bin
4. Activity Log

## Fitur

### Dokumen Terbaru
- Data real Supabase.
- Filter divisi mengikuti Topbar.
- Search Topbar bekerja.
- Folder password tetap dihormati.
- Klik dokumen membuka Document Engine Tahap 11.

### Favorit
- Favorit per user.
- Search Topbar bekerja.
- Klik dokumen membuka Document Engine.
- Hapus/tambah favorit langsung memperbarui daftar.

### Recycle Bin
- Menampilkan folder dan dokumen status DELETED.
- Filter divisi untuk Super Admin.
- Restore ke parent asli jika parent masih aktif.
- Bila parent sudah tidak aktif, restore ke root divisi.
- Restore menolak duplicate nama.
- Hapus Permanen mengubah metadata menjadi PURGED dan memindahkan file/folder fisik ke Trash Google Drive.
- Version files dokumen juga dipindahkan ke Trash Google Drive saat purge dokumen.

### Activity Log
- Filter divisi.
- Search Topbar.
- Filter username, action, tanggal awal/akhir.
- Pagination 50 baris.
- Permission `CAN_VIEW_LOG` / `can_view_log` tetap diperiksa backend.

## Instalasi

1. Stop backend dan frontend (`Ctrl + C`).
2. Extract `KASA_BACKEND_TAHAP12_CLEAN.zip`.
3. Copy seluruh isi ke:
   `C:\Users\Rifki\Documents\kasa-digital-archive\backend`
4. Pilih Replace. Jangan hapus `.env` dan `google-oauth-client.json`.
5. Extract `KASA_FRONTEND_TAHAP12_CLEAN.zip`.
6. Copy seluruh isi ke:
   `C:\Users\Rifki\Documents\kasa-digital-archive\frontend`
7. Pilih Replace.
8. Tidak perlu `npm install` karena tidak ada dependency baru.

## Menjalankan

Terminal 1:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

Terminal 2:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Buka `http://localhost:5173` lalu `Ctrl + F5`.

## Test Tahap 12

### Test A — Dokumen Terbaru
- Buka `Dokumen Terbaru`.
- Dokumen upload Tahap 11 harus muncul di atas.
- Klik dokumen dan pastikan Document Engine terbuka.

### Test B — Favorit
- Buka satu dokumen > klik `Favorit`.
- Buka menu `Favorit`.
- Dokumen harus muncul.
- Buka dokumen dari halaman Favorit > klik `Hapus Favorit` > daftar harus ikut berubah setelah refresh.

### Test C — Recycle Bin Restore
- Hapus satu dokumen test dari File Manager.
- Buka `Recycle Bin`.
- Klik `Restore`.
- Dokumen harus kembali ke folder asal dan status kembali ACTIVE.

### Test D — Hapus Permanen
Gunakan FILE TEST, bukan dokumen penting.
- Delete file test ke Recycle Bin.
- Klik `Hapus Permanen`.
- Item hilang dari Recycle Bin.
- Metadata menjadi PURGED.
- File fisik masuk Trash Google Drive.

### Test E — Activity Log
- Buka Activity Log.
- Cari action `UPLOAD_DOCUMENT`, `RESTORE_DOCUMENT`, atau `PERMANENT_DELETE`.
- Coba filter tanggal dan username.

## Catatan keamanan
- Restore memerlukan `can_restore`.
- Permanent delete memerlukan `can_delete`.
- Activity Log memerlukan `can_view_log`.
- Backend tetap membatasi user non-Super Admin pada divisinya.
