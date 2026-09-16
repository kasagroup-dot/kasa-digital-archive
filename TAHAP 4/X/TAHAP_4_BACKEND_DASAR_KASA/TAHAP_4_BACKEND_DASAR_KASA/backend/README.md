# KASA DIGITAL ARCHIVE — Backend Tahap 4

Backend dasar untuk migrasi aplikasi **KASA DIGITAL ARCHIVE — PT. KASA GROUP** dari Google Apps Script menjadi Node.js + Express.

## Status Tahap 4

Yang sudah dibuat:

- Express server
- struktur `route -> controller -> service`
- `.env` loader
- server-only Supabase client factory
- security header Helmet
- CORS whitelist
- compression
- request ID
- global rate limiter
- JSON error response konsisten
- health endpoint
- graceful shutdown untuk Railway

Yang **belum** dilakukan pada Tahap 4:

- query ke Supabase Database
- login/JWT
- user migration
- Google Drive integration
- dokumen/folder CRUD

Itu dilakukan bertahap agar debugging mudah.

## Menjalankan

```bash
npm install
```

Copy `.env.example` menjadi `.env`, lalu:

```bash
npm run dev
```

Buka:

```text
http://localhost:4000/api/v1/health
```

Response normal:

```json
{
  "success": true,
  "message": "KASA Digital Archive API aktif.",
  "data": {
    "status": "ok"
  }
}
```

Pada Tahap 4, `supabaseConfigured: false` **normal** jika credential Supabase belum dimasukkan. Koneksi database baru diuji pada Tahap 5.
