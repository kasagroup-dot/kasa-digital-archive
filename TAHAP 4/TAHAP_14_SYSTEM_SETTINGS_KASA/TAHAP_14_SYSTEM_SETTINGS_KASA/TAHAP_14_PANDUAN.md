# TAHAP 14 — System Settings + Final Operational Hardening
## KASA Digital Archive — PT. KASA GROUP

Tahap 14 adalah tahap hardening lokal terakhir sebelum deployment production.

## Fitur yang aktif

### System Settings
- Maximum Upload per file (1–1024 MB)
- Direct Preview Limit (1–100 MB)
- Normal Session (1–72 jam)
- Remember Session (1–30 hari)
- Default Page Size (10–100)
- Maximum Page Size (default s.d. 500)
- Maintenance Mode + custom message
- Google Drive Root ditampilkan read-only
- Security model ditampilkan read-only

### Diagnostics
- Supabase server-key status
- Google Drive root connectivity
- JWT secret readiness
- CORS allowlist
- NODE_ENV readiness
- HTTPS frontend readiness
- Cookie SameSite / Secure mode
- Active users/divisions/folders/documents
- Active/stale sessions
- Recycle items / pending password reset / audit count

### Hardening backend
- Semua response API diberi `Cache-Control: no-store`
- Refresh cookie otomatis `Secure` di production
- Refresh cookie SameSite configurable; default production `none`, development `lax`
- Session duration sekarang membaca runtime setting Supabase
- File Manager + Dokumen Global membaca runtime pagination setting
- Maintenance Mode diblok di backend, bukan hanya UI
- Super Admin tetap dapat login saat Maintenance Mode aktif
- Cleanup expired session
- Production readiness script

Tidak ada perubahan schema Supabase pada Tahap 14.

---

# 1. STOP BACKEND DAN FRONTEND

Terminal backend dan frontend:

```text
Ctrl + C
```

# 2. REPLACE BACKEND

Extract:

`KASA_BACKEND_TAHAP14_CLEAN.zip`

Copy semua isi hasil extract ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\backend
```

Pilih **Replace**.

JANGAN hapus file lokal berikut:

```text
.env
google-oauth-client.json
```

Paket CLEAN tidak membawa kedua file secret tersebut.

# 3. REPLACE FRONTEND

Extract:

`KASA_FRONTEND_TAHAP14_CLEAN.zip`

Copy seluruh isinya ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\frontend
```

Pilih **Replace**.

Tidak ada dependency baru, jadi tidak wajib `npm install` ulang.

# 4. OPSIONAL — UPDATE LABEL VERSION DI .env

Buka:

```text
backend\.env
```

Ubah hanya baris APP_VERSION jika masih versi lama:

```env
APP_VERSION=FULLSTACK-0.14.0
```

Untuk development lokal, tidak perlu menambahkan setting cookie. Default otomatis `lax`.

# 5. HIDUPKAN BACKEND

CMD Terminal 1:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

Biarkan terminal hidup.

# 6. HIDUPKAN FRONTEND

CMD Terminal 2:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Buka:

```text
http://localhost:5173
```

Tekan `Ctrl + F5`.

# 7. TEST SYSTEM SETTINGS

Login sebagai `ADMIN`.

Masuk:

```text
ADMINISTRATION
→ System Settings
```

Target halaman:

```text
System Settings
├─ Upload & Preview
├─ Session Policy
├─ Pagination
├─ Maintenance Mode
└─ Production Readiness
```

Pada development lokal, status yang normal adalah:

```text
CORE READY · PROD CONFIG PENDING
```

Karena:

```text
NODE_ENV=development
Frontend=http://localhost:5173
```

Keduanya memang belum production dan BUKAN error.

# 8. TEST SAVE SETTINGS

Untuk test awal, pertahankan nilai aman:

```text
Maximum Upload       250 MB
Direct Preview       8 MB
Normal Session       8 jam
Remember Session     7 hari
Default Page Size    25
Maximum Page Size    100
Maintenance Mode     OFF
```

Klik:

**Simpan Settings**

Harus muncul notifikasi sukses.

# 9. TEST MAINTENANCE MODE

Test ini hanya sebentar.

1. ADMIN → System Settings.
2. Nyalakan **Maintenance Mode**.
3. Isi pesan test.
4. Klik **Simpan Settings**.
5. Buka Incognito dan coba login `TEST13` / user non-Super Admin.

Target:

```text
user non-admin → ditolak dengan pesan maintenance
ADMIN          → tetap bisa masuk
```

Setelah test BERHASIL, segera kembali ke ADMIN dan ubah:

```text
Maintenance Mode = OFF
```

Simpan lagi.

**Jangan tinggalkan Maintenance Mode ON sebelum deployment.**

# 10. TEST CLEANUP SESSION

Klik:

```text
Cleanup Expired Sessions
```

Fitur ini hanya mengubah session ACTIVE yang waktu kedaluwarsanya sudah lewat menjadi `EXPIRED`.

Session valid tidak disentuh.

# 11. TEST PRODUCTION READINESS DI TERMINAL

Di folder backend:

```cmd
npm run production:check
```

Pada komputer lokal, hasil boleh memperlihatkan warning:

```text
NODE_ENV=development
Frontend HTTP localhost
```

Yang penting bagian critical seperti:

```text
Supabase server key ✅
JWT access secret   ✅
Google Drive OAuth  ✅
CORS allowlist      ✅
Critical ready      YES
```

Setelah nanti environment Railway sudah diisi production, kita akan menjalankan:

```cmd
npm run production:check:strict
```

# 12. COOKIE PRODUCTION

Tahap 14 sudah menyiapkan cookie cross-site untuk arsitektur Cloudflare + Railway.

Production `.env` Railway nanti akan memakai:

```env
NODE_ENV=production
REFRESH_COOKIE_SAME_SITE=none
```

Saat `NODE_ENV=production`, backend otomatis memakai:

```text
Secure = true
HttpOnly = true
```

Kalau nanti kita memakai custom domain dengan frontend/backend satu site, konfigurasi cookie bisa kita sesuaikan saat deployment.

---

# CHECKPOINT TAHAP 14

Tahap 14 dianggap sukses apabila:

```text
System Settings terbuka               ✅
Save settings                         ✅
Google Drive diagnostics connected    ✅
Supabase diagnostics ready            ✅
Maintenance test                      ✅
Super Admin tetap bisa saat maintenance ✅
User biasa diblok saat maintenance    ✅
Cleanup session                       ✅
npm run production:check              ✅
```

Setelah checkpoint ini selesai, tahap berikutnya adalah:

# TAHAP 15 — DEPLOYMENT PRODUCTION

Target:

```text
Git + GitHub
Backend  → Railway
Frontend → Cloudflare Pages
Supabase → Production Database yang sekarang
Storage  → Google Drive yang sekarang
HTTPS + CORS + Cookie production
Final smoke test
Cutover dari Apps Script lama
Rollback plan
```
