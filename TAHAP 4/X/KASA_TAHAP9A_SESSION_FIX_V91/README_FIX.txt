KASA DIGITAL ARCHIVE — TAHAP 9A SESSION BOOT FIX V9.1

Masalah yang diperbaiki:
- Halaman berhenti selamanya pada "Checking secure session..." jika /auth/refresh atau koneksi backend/Supabase tidak merespons.

Perbaikan:
- Refresh session diberi timeout 6 detik.
- Jika timeout/gagal, aplikasi otomatis menampilkan halaman Login, bukan spinner tanpa akhir.
- Tidak mengubah .env, backend, Supabase, user, atau data.

Cara pasang:
1. Stop frontend (Ctrl+C).
2. Copy src/App.jsx ke frontend/src/App.jsx (Replace).
3. Copy src/services/api.js ke frontend/src/services/api.js (Replace).
4. Jalankan frontend lagi: npm run dev (atau npm.cmd run dev di PowerShell).
5. Buka http://localhost:5173 lalu Ctrl+F5.
