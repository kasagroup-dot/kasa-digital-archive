KASA TAHAP 6 - AUTH TEST FIX V6.1

Replace file:
backend/scripts/test-login.js

Perubahan:
- memakai 127.0.0.1 (menghindari masalah localhost/IPv6 Windows)
- health check otomatis sebelum meminta login
- pesan error koneksi lebih jelas
- API_BASE_URL dapat dioverride lewat environment bila perlu

Cara test:
Terminal 1:
  cd C:\Users\Rifki\Documents\kasa-digital-archive\backend
  npm run dev

Terminal 2:
  cd C:\Users\Rifki\Documents\kasa-digital-archive\backend
  npm run auth:test
