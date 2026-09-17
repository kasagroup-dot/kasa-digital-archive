# KASA Digital Archive — Backend Tahap 14.1

Maintenance Enforcement & Local Readiness patch.

Perubahan utama:
- Maintenance Mode diverifikasi setelah disimpan ke Supabase.
- Saat ON, seluruh session non-Super Admin yang aktif langsung direvoke.
- Login, refresh, dan protected API tetap memblokir non-Super Admin saat maintenance.
- Public runtime status `/api/v1/runtime/status` untuk frontend maintenance heartbeat.
- `production:check` memakai ⚠️ untuk warning development, bukan ❌.
