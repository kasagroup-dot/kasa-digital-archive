# KASA Backend — Tahap 10 Migration

Versi 0.10.0. Basis: Tahap 9C yang sudah lolos CRUD + Google Drive.

Tambahan Tahap 10:
- `npm run migrate:archive:dry` — baca Spreadsheet legacy + validasi, TANPA menulis Supabase.
- `npm run migrate:archive` — backup target, export source, lalu migrasi metadata.
- `npm run migrate:archive:verify` — bandingkan jumlah legacy source vs Supabase.

Migrasi tidak upload ulang, memindahkan, rename, atau menghapus file Google Drive.
Legacy sessions sengaja tidak dimigrasikan.
