# TAHAP 8 — DASHBOARD REACT PT. KASA GROUP

## Status sebelum mulai

Tahap 7 sudah berhasil apabila login React menampilkan user Administrator / Super Admin. Tahap 8 mengganti checkpoint tersebut menjadi dashboard aplikasi.

## Yang dibuat pada Tahap 8

Backend baru:
- `GET /api/v1/dashboard/summary`
- filter divisi untuk SUPER_ADMIN
- statistik dokumen, folder, storage, user, upload bulan berjalan, divisi
- distribusi dokumen per divisi
- recent activity
- pembatasan scope divisi untuk user non-Super Admin

Frontend baru:
- sidebar
- topbar
- dashboard cards
- Documents by Division
- Recent Activity
- filter divisi
- logout
- session restore
- responsive mobile

## Penting mengenai angka 0

Data user dan divisi sudah ada di Supabase karena dimigrasikan pada Tahap 6.
Metadata `DOCUMENTS` dan `FOLDERS` lama belum dimigrasikan. Migrasi data lama memang dijadwalkan pada Tahap 10.
Karena itu TOTAL DOCUMENTS / TOTAL FOLDERS / STORAGE dapat bernilai 0 di Tahap 8. Itu bukan error.

## STEP 1 — Stop backend dan frontend

Di terminal backend tekan `Ctrl + C`.
Di terminal frontend tekan `Ctrl + C`.

## STEP 2 — Replace backend

Extract `KASA_BACKEND_TAHAP8_CLEAN.zip`.
Copy semua isinya ke:

`C:\Users\Rifki\Documents\kasa-digital-archive\backend`

Pilih **Replace the files in the destination**.

JANGAN hapus atau replace file `.env` milik Anda. Paket clean tidak menyertakan `.env`.
JANGAN hapus `node_modules`.

Tidak ada dependency baru, jadi `npm install` tidak perlu diulang apabila Tahap 7 sudah jalan.

## STEP 3 — Replace frontend

Extract `KASA_FRONTEND_TAHAP8_CLEAN.zip`.
Copy semua isinya ke:

`C:\Users\Rifki\Documents\kasa-digital-archive\frontend`

Pilih Replace.

Paket clean juga tidak menyertakan `.env`, sehingga `VITE_API_URL` Anda tetap aman.

## STEP 4 — Jalankan backend

Command Prompt / terminal backend:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

Biarkan terminal backend hidup.

## STEP 5 — Jalankan frontend

Buka terminal kedua:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Jika terminal VS Code sedang PowerShell dan `npm` diblokir Execution Policy, gunakan:

```powershell
npm.cmd run dev
```

## STEP 6 — Buka aplikasi

Buka Chrome:

`http://localhost:5173`

Kalau session Tahap 7 masih aktif, browser dapat langsung masuk dashboard.
Kalau kembali ke login, login lagi memakai ADMIN dan password yang sekarang.

## STEP 7 — Hasil yang diharapkan

Dashboard menampilkan:
- KASA Group Digital Command Center
- TOTAL DOCUMENTS
- TOTAL FOLDERS
- STORAGE USED
- TOTAL USERS
- UPLOAD THIS MONTH
- TOTAL DIVISIONS
- Documents by Division
- Recent Activity

Untuk SUPER_ADMIN, dropdown kanan atas berisi Semua Divisi dan 12 divisi.
TOTAL USERS seharusnya membaca user aktif dari Supabase. TOTAL DIVISIONS seharusnya 12 pada scope global.

## STEP 8 — Menu lainnya

Sidebar sudah menampilkan menu aplikasi lama, tetapi pada Tahap 8 hanya Dashboard yang diaktifkan penuh.
Klik menu lain akan memberi pemberitahuan bahwa menu tersebut akan dimigrasikan pada Tahap 9.

## Troubleshooting

### Dashboard gagal dimuat
Cek backend masih aktif lalu buka:
`http://127.0.0.1:4000/api/v1/health`

### Login sukses tapi Dashboard 401
Refresh halaman. Frontend Tahap 8 punya automatic refresh-token retry.

### CORS
Pastikan backend `.env` memiliki:
`FRONTEND_URLS=http://localhost:5173`
Lalu restart backend.

### Documents = 0
Normal pada Tahap 8 jika metadata documents/folders lama belum dimigrasikan ke Supabase.
