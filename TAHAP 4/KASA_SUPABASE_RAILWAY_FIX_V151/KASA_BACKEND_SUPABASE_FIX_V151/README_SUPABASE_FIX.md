# KASA Backend V15.1 — Supabase SDK Compatibility Fix

Fix untuk deployment Railway yang menjalankan Node.js 20 dan memakai Supabase secret key format `sb_secret_...`.

Perubahan utama:
- `@supabase/supabase-js` dipin ke `2.109.0`.
- `engines.node` dipin ke `20.x` agar konsisten dengan Railway saat ini.

Alasan: backend sebelumnya masih memakai dependency lama `^2.57.4`. Versi 2.109.0 adalah versi terakhir Supabase JS yang resmi mendukung Node.js 20.

## Cara pasang lokal
1. Replace `package.json` backend dengan versi ini, atau copy seluruh paket backend.
2. Di folder backend jalankan:
   `npm install`
3. Test lokal:
   `npm start`
   lalu buka `/api/v1/health/supabase`.
4. Commit `backend/package.json` dan `backend/package-lock.json` ke GitHub.
5. Push ke branch `main` agar Railway auto redeploy.
