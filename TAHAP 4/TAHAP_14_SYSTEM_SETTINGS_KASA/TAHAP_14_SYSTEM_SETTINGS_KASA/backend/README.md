# KASA Digital Archive — Backend Tahap 14

Tahap 14 mengaktifkan **System Settings + final operational hardening** sebelum deployment production.

Fitur:
- System Settings tersimpan di Supabase `app_settings`
- Runtime upload limit
- Runtime normal/remember session duration
- Maintenance Mode (Super Admin tetap bisa masuk)
- System diagnostics Supabase + Google Drive + data count + session count
- Cleanup stale expired sessions
- Production readiness checks
- API response `Cache-Control: no-store`
- Cookie production hardening: Secure + configurable SameSite/domain
- `npm run production:check`
- `npm run production:check:strict`

Tidak ada perubahan schema Supabase pada Tahap 14.

> Jangan menimpa `.env` yang sudah aktif. Paket CLEAN tidak menyertakan `.env`.
