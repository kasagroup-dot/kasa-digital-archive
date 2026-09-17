import { getGoogleDriveHealth, getServerHealth, getSupabaseHealth } from '../services/health.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export function healthCheck(_req, res) {
  return sendSuccess(res, {
    message: 'KASA Digital Archive API aktif.',
    data: getServerHealth()
  });
}

export async function supabaseHealthCheck(_req, res) {
  const data = await getSupabaseHealth();
  return sendSuccess(res, {
    message: 'Koneksi Supabase berhasil.',
    data
  });
}


export async function googleDriveHealthCheck(_req, res) {
  const data = await getGoogleDriveHealth();
  return sendSuccess(res, {
    message: 'Koneksi Google Drive berhasil.',
    data
  });
}
