# KASA MOVE DOCUMENT FIX V15.2

Patch khusus aksi **Pindahkan Dokumen**.

## Yang diperbaiki
1. Move ke folder yang sama tidak lagi memanggil Google Drive API.
2. Tombol **Pindahkan** dinonaktifkan bila folder tujuan sama dengan folder saat ini.
3. Backend memvalidasi `google_drive_folder_id` tujuan dan `google_drive_file_id` dokumen.
4. Error Google Drive move sekarang menjadi jelas (`GOOGLE_DRIVE_MOVE_FAILED`) dan server log mencatat detail aman tanpa secret.

## Cara pasang
Copy/replace hanya 2 file berikut:

- `backend/src/services/documentEngine.service.js`
- `frontend/src/components/DocumentActionModal.jsx`

Jangan replace `.env`, package.json, package-lock.json, atau credential Google.

## Setelah copy
### Test lokal
Backend:
`npm start`

Frontend:
`npm run dev`

Test:
- buka dokumen
- klik Pindah
- folder saat ini harus memberi warning dan tombol Pindahkan disable
- pilih folder lain lalu Pindahkan

### Push ke GitHub
Dari root project:
`git add backend/src/services/documentEngine.service.js frontend/src/components/DocumentActionModal.jsx`
`git commit -m "Fix document move handling"`
`git push`

Railway akan redeploy backend otomatis.

Karena frontend production di-upload manual ke Cloudflare, setelah source frontend diperbarui:
1. pastikan `.env.production` tetap berisi `VITE_API_URL=https://kasa-digital-archive-production.up.railway.app/api/v1`
2. jalankan `npm run build`
3. Cloudflare Workers & Pages -> New deployment -> upload isi folder `frontend/dist`
