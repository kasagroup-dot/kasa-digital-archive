# KASA Digital Archive — Frontend Tahap 14.1

Maintenance Enforcement patch.

Perubahan utama:
- Runtime status dipoll setiap 10 detik.
- User non-Super Admin yang sedang login akan diarahkan ke Maintenance Screen saat mode ON.
- Login page menunjukkan banner maintenance; backend hanya mengizinkan Super Admin.
- System Settings memverifikasi state maintenance yang benar-benar tersimpan.
