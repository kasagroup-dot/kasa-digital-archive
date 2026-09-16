# TAHAP 13 — MANAJEMEN USER + PERMISSION
## KASA Digital Archive — PT. KASA GROUP

## Target
Tahap ini membuat menu Administration benar-benar aktif untuk Super Admin:

1. Manajemen User
2. Permission
3. Password Reset Queue
4. Forced Password Change
5. Revoke Session
6. Audit aktivitas administrator

Tidak ada SQL/schema tambahan pada Tahap 13.

---

## 1. Install paket

Stop backend dan frontend dengan `Ctrl + C`.

Extract `KASA_BACKEND_TAHAP13_CLEAN.zip` lalu copy seluruh isinya ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\backend
```

Pilih **Replace**. Jangan hapus `.env` dan `google-oauth-client.json` yang sudah ada di komputer.

Extract `KASA_FRONTEND_TAHAP13_CLEAN.zip` lalu copy seluruh isinya ke:

```text
C:\Users\Rifki\Documents\kasa-digital-archive\frontend
```

Pilih **Replace**.

Tidak perlu `npm install` karena tidak ada dependency baru.

---

## 2. Jalankan aplikasi

Terminal 1:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\backend
npm start
```

Terminal 2:

```cmd
cd /d C:\Users\Rifki\Documents\kasa-digital-archive\frontend
npm run dev
```

Buka:

```text
http://localhost:5173
```

Login sebagai `ADMIN`.

---

## 3. Test Manajemen User

Klik:

```text
ADMINISTRATION
→ Manajemen User
```

Harus tampil seluruh user lama yang sudah dimigrasikan.

Test yang disarankan: buat user sementara **DIVISION_USER**, jangan Super Admin.

Contoh:

```text
Nama     : TEST USER TAHAP 13
Username : TEST13
Role     : Division User
Divisi   : IT
Status   : ACTIVE
Password : password sementara minimal 6 karakter
```

Biarkan opsi **Wajib ganti password** aktif.

Setelah user dibuat, buka browser Incognito lalu login dengan `TEST13` dan password sementara.

User harus masuk ke halaman:

```text
SECURITY REQUIRED
Ganti password sebelum melanjutkan.
```

Setelah password baru berhasil disimpan, barulah user dapat menggunakan aplikasi.

---

## 4. Test Permission

Login kembali sebagai ADMIN.

Klik:

```text
ADMINISTRATION
→ Permission
```

Pilih `TEST13`.

Default Division User adalah:

```text
CAN_VIEW      = ON
CAN_DOWNLOAD  = ON
CAN_PREVIEW   = ON
```

Hak upload/create/rename/move/delete/restore/log default OFF.

Aktifkan atau nonaktifkan beberapa permission lalu klik **Simpan Permission**.

Permission tersedia:

```text
CAN_VIEW
CAN_UPLOAD
CAN_DOWNLOAD
CAN_PREVIEW
CAN_CREATE_FOLDER
CAN_RENAME
CAN_MOVE
CAN_DELETE
CAN_RESTORE
CAN_VIEW_LOG
```

Super Admin selalu full access dan tidak dapat dibatasi.

---

## 5. Test Reset Password

Di Manajemen User, pilih user test lalu klik **Reset**.

Isi password baru. Setelah reset:
- Hash disimpan sebagai bcrypt.
- Session aktif user tersebut direvoke.
- Jika opsi wajib ganti password aktif, login berikutnya akan masuk ke halaman ganti password.
- Password reset request yang masih PENDING untuk user itu otomatis RESOLVED.

---

## 6. Test Inactive User

Edit `TEST13` lalu ubah status menjadi:

```text
INACTIVE
```

User tersebut harus langsung tidak dapat menggunakan session aktif maupun login baru.

Setelah test, boleh dikembalikan ke ACTIVE atau dibiarkan sebagai user test.

---

## 7. Password Reset Queue

Jika user memakai **Forgot password?** pada halaman login, request akan muncul di bagian:

```text
Manajemen User
→ Password Reset Queue
```

Super Admin dapat:
- Reset Password
- Batalkan request

Tidak ada password yang dikirim melalui email pada tahap ini.

---

## Security Tahap 13

- Seluruh endpoint `/api/v1/admin/*` mewajibkan JWT/session aktif + role `SUPER_ADMIN`.
- Password baru hanya disimpan sebagai bcrypt.
- Password plaintext tidak dicatat di Audit Log.
- Menonaktifkan user merevoke session aktif.
- Reset password merevoke seluruh session user target.
- Super Admin tidak dapat menonaktifkan/menurunkan role akun yang sedang ia gunakan.
- Super Admin tidak dapat reset password dirinya sendiri melalui menu admin; gunakan Change Password.
- User dengan `must_change_password=true` diblok oleh backend dari endpoint operasional sampai password diganti.

---

## Endpoint Baru

```text
GET    /api/v1/admin/users
POST   /api/v1/admin/users
GET    /api/v1/admin/users/:userId
PATCH  /api/v1/admin/users/:userId
POST   /api/v1/admin/users/:userId/reset-password
POST   /api/v1/admin/users/:userId/revoke-sessions
GET    /api/v1/admin/users/:userId/permissions
PUT    /api/v1/admin/users/:userId/permissions
GET    /api/v1/admin/password-reset-requests
POST   /api/v1/admin/password-reset-requests/:requestId/cancel
```

---

## Setelah Tahap 13

Tahap berikutnya disarankan:

**TAHAP 14 — System Settings + final operational hardening**, termasuk pengaturan app/upload/session, maintenance tools, serta penyelesaian bagian administrasi terakhir sebelum deployment production.
