# KASA Digital Archive — Backend Tahap 13

Tahap 13 mengaktifkan **Manajemen User + Permission** untuk Super Admin.

Fitur utama:
- List/search/filter user
- Create/Edit/Activate/Deactivate user
- Reset password dengan bcrypt
- Revoke session aktif
- Password reset queue
- Permission granular 10 hak akses
- Audit log untuk aksi administrator
- Forced password change untuk password sementara/reset

Tidak ada perubahan schema Supabase pada tahap ini.

> Jangan menyalin/menimpa file `.env` yang sudah aktif di komputer Anda. Paket CLEAN ini tidak menyertakan `.env`.
