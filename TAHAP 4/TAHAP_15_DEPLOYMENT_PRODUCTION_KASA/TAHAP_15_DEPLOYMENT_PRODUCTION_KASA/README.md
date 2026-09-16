# KASA Digital Archive — Production Deployment Package

Monorepo production-ready baseline setelah Tahap 14.1.

- `backend/` — Node.js + Express, deploy ke Railway
- `frontend/` — React + Vite, deploy ke Cloudflare Pages
- `TAHAP_15_PANDUAN_DEPLOYMENT.md` — panduan klik demi klik

## Security

Jangan pernah commit:
- `.env`
- Google OAuth client JSON
- Supabase secret key
- JWT secret
- Google refresh token

Semua secret production dimasukkan lewat Railway Variables, bukan GitHub.
