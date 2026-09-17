# KASA Drive Production Fix V15.2

Patch backend untuk diagnosis dan error Google Drive production yang sebelumnya hanya tampil `Terjadi kesalahan pada server`.

## File yang direvisi
- `src/routes/health.routes.js`
- `src/controllers/health.controller.js`
- `src/services/health.service.js`
- `src/services/googleDrive.service.js`
- `src/services/documentEngine.service.js`

## Fitur baru
Endpoint aman tanpa menampilkan secret:

`GET /api/v1/health/drive`

Contoh sukses:
```json
{
  "success": true,
  "message": "Koneksi Google Drive berhasil.",
  "data": {
    "status": "connected",
    "configured": {
      "clientId": true,
      "clientSecret": true,
      "refreshToken": true,
      "redirectUri": true
    },
    "rootFolderName": "PT KASA GROUP - DIGITAL ARCHIVE"
  }
}
```

Jika gagal, endpoint menampilkan penyebab Google Drive/OAuth yang sudah disanitasi, misalnya `invalid_grant`, `invalid_client`, `File not found`, atau credential yang belum ada.

## Cara pasang
Copy folder `src` patch ini ke folder `backend` project dan pilih Replace.
Tidak perlu `npm install`.
Commit dan push ke GitHub agar Railway redeploy.
