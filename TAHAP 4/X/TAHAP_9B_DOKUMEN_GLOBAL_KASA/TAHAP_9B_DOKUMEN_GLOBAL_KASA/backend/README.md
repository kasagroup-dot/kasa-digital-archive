# KASA Digital Archive — Backend Tahap 9B

Versi 0.9.3. Tahap ini mengaktifkan API **Dokumen Global** di atas backend Tahap 9A dan seluruh fix koneksi/session V9.1–V9.2.

Endpoint baru:

- `GET /api/v1/documents`
- `GET /api/v1/documents/:documentId`

Fitur: filter divisi, pencarian metadata/tag, filter tipe file & kategori, sorting, pagination, favorite flag, path folder, serta filtering folder terkunci berdasarkan session unlock.

Tidak ada `.env` di paket ini. Replace isi folder ke backend yang sudah ada agar secret lokal tidak tertimpa.
