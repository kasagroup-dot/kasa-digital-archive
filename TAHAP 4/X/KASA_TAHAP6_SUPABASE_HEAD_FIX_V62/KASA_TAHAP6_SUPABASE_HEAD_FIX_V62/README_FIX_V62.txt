KASA TAHAP 6 - SUPABASE HEAD FIX V6.2

Masalah yang diperbaiki:
- GET /health/supabase dapat gagal pada query count yang memakai HTTP HEAD.
- Beberapa jaringan/proxy/Windows dapat menolak/intermitten HEAD walau GET biasa berhasil.
- Error sebelumnya bisa tampak kosong: "Supabase divisions gagal dibaca:"

Replace 3 file ini ke backend:
1. src/services/health.service.js
2. scripts/migrate-legacy-users.js
3. scripts/verify-auth.js

Setelah replace:
1. Stop server (Ctrl+C)
2. npm start
3. curl http://127.0.0.1:4000/api/v1/health
4. curl http://127.0.0.1:4000/api/v1/health/supabase
5. npm run auth:verify
6. npm run auth:test
