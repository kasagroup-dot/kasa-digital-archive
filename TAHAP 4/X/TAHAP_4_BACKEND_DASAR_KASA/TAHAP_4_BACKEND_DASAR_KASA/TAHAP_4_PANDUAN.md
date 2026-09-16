# TAHAP 4 — BACKEND DASAR NODE.JS + EXPRESS
## KASA DIGITAL ARCHIVE — PT. KASA GROUP

Tahap ini sengaja hanya membuat **fondasi backend**. Kita belum mengetes koneksi Supabase Database karena itu adalah Tahap 5.

---

## A. HASIL YANG HARUS DICAPAI

Di akhir Tahap 4, browser harus bisa membuka:

```text
http://localhost:4000/api/v1/health
```

Dan server merespons JSON `success: true`.

---

## B. CARA PASANG DI WINDOWS + VS CODE

### 1. Extract ZIP Tahap 4

Extract paket ini. Di dalamnya ada folder:

```text
backend
```

### 2. Buat folder project utama

Di File Explorer buat folder:

```text
kasa-digital-archive
```

Contoh lokasi yang mudah:

```text
C:\Users\<nama-user>\Documents\kasa-digital-archive
```

### 3. Copy folder `backend`

Hasil akhirnya harus seperti:

```text
kasa-digital-archive
└── backend
    ├── package.json
    ├── .env.example
    ├── .gitignore
    └── src
```

### 4. Buka project di VS Code

- Buka VS Code.
- Klik **File**.
- Klik **Open Folder...**.
- Pilih folder `kasa-digital-archive`.
- Klik **Select Folder**.

### 5. Buka Terminal VS Code

Klik:

```text
Terminal > New Terminal
```

Lalu masuk ke backend:

```powershell
cd backend
```

### 6. Install package

Jalankan:

```powershell
npm install
```

Tunggu sampai selesai.

### 7. Buat file `.env`

Pada terminal PowerShell jalankan:

```powershell
Copy-Item .env.example .env
```

Kalau command itu tidak berjalan, boleh manual:

- klik kanan `.env.example`
- Copy
- Paste
- rename hasil copy menjadi `.env`

**Penting:** jangan hapus `.env.example`.

### 8. Untuk Tahap 4, `.env` belum perlu credential Supabase

Biarkan bagian ini kosong dulu:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Kita isi bersama pada Tahap 5 agar tidak salah mengambil key.

### 9. Jalankan backend

Di terminal:

```powershell
npm run dev
```

Kalau berhasil, terminal akan menampilkan kurang lebih:

```text
KASA DIGITAL ARCHIVE — BACKEND
Environment : development
Port        : 4000
API         : http://localhost:4000/api/v1
Health      : http://localhost:4000/api/v1/health
```

### 10. Tes di Chrome

Buka:

```text
http://localhost:4000/api/v1/health
```

Hasil normal kurang lebih:

```json
{
  "success": true,
  "message": "KASA Digital Archive API aktif.",
  "data": {
    "status": "ok",
    "app": "KASA DIGITAL ARCHIVE",
    "company": "PT. KASA GROUP",
    "version": "FULLSTACK-0.4.0",
    "environment": "development",
    "supabaseConfigured": false
  }
}
```

`supabaseConfigured: false` pada Tahap 4 adalah **BENAR**.

---

## C. JIKA ADA ERROR

### `npm is not recognized`

Node.js belum terpasang atau terminal VS Code belum direstart setelah instalasi Node.js.

Cek:

```powershell
node -v
npm -v
```

Project ini membutuhkan Node.js **20 atau lebih baru**.

### Port 4000 already in use

Jangan ubah file source. Ubah `.env`:

```env
PORT=4001
```

Lalu stop server dengan `Ctrl+C`, jalankan lagi `npm run dev`, dan buka:

```text
http://localhost:4001/api/v1/health
```

### `Cannot find package ...`

Pastikan sedang berada di folder `backend`, lalu:

```powershell
npm install
```

---

## D. SECURITY YANG SUDAH DIPASANG

Tahap 4 sudah menyiapkan:

- `helmet` — security headers
- `cors` — hanya frontend yang diizinkan
- `express-rate-limit` — membatasi request berlebihan
- request ID — membantu audit/debugging
- generic production error — error internal tidak bocor ke user
- `x-powered-by` dimatikan
- `trust proxy` untuk Railway/Cloudflare
- Service Role Supabase hanya disiapkan di backend, tidak di frontend

---

## E. JANGAN DILAKUKAN DULU

Pada tahap ini jangan:

- memasukkan Service Role Key ke React/browser;
- membuat login;
- memasukkan user secara manual;
- memigrasi data Spreadsheet;
- mengubah Google Drive folder;
- deploy Railway;
- deploy Cloudflare.

Tahap berikutnya adalah **TAHAP 5 — Test koneksi Backend -> Supabase Database**.

---

## F. KAPAN BOLEH LANJUT?

Kalau URL berikut berhasil:

```text
http://localhost:4000/api/v1/health
```

balas:

```text
HEALTH SUKSES, GAS TAHAP 5
```
