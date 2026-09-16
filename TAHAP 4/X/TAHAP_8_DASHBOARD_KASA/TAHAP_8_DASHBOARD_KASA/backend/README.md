# KASA Digital Archive Backend — Tahap 8

Backend Express untuk PT. KASA GROUP Digital Archive.

Tahap 8 menambahkan endpoint dashboard yang membaca data langsung dari Supabase:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/summary?divisionId=<uuid>` untuk Super Admin

Authentication Tahap 6 dan health check Tahap 5 tetap dipertahankan.

## Menjalankan

```bash
npm start
```

Jangan mengganti file `.env` yang sudah berisi Supabase Secret Key dan JWT secret.
