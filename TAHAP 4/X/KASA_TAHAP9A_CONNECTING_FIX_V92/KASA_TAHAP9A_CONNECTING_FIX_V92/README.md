# KASA Tahap 9A — Connecting Fix V9.2

Patch ini memperbaiki kondisi tombol LOGIN berhenti di `CONNECTING` tanpa batas.

Perubahan:
- Frontend semua request punya timeout aman (default 15 detik).
- Login timeout 12 detik.
- Supabase backend punya fetch timeout 10 detik.
- Update `last_login` dan audit login tidak lagi menahan response login.
- Session restore fix V9.1 tetap dipertahankan.

## File yang direplace
Backend:
- `src/config/supabase.js`
- `src/services/auth.service.js`

Frontend:
- `src/services/api.js`
- `src/pages/LoginPage.jsx`

Setelah replace, restart backend dan frontend.
