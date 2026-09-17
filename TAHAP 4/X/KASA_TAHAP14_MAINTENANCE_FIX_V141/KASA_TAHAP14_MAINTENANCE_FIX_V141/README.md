# KASA Tahap 14.1 — Maintenance Fix

Copy folder `backend` ke backend project dan folder `frontend` ke frontend project, lalu pilih Replace.
Tidak ada `.env` production/user yang disertakan.

Test:
1. Restart backend/frontend.
2. ADMIN → System Settings → Maintenance ON → Simpan Settings.
3. Notice harus menyebut `MAINTENANCE ON aktif` dan jumlah session yang dicabut.
4. Browser TEST13 maksimal ~10 detik akan masuk Maintenance Screen; login baru TEST13 ditolak.
5. ADMIN tetap bisa masuk.
6. `npm run production:check` pada lokal menampilkan warning ⚠️ untuk NODE_ENV development, bukan error ❌.
7. Kembalikan Maintenance OFF setelah test.
