import { getServerHealth } from '../services/health.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export function healthCheck(_req, res) {
  return sendSuccess(res, {
    message: 'KASA Digital Archive API aktif.',
    data: getServerHealth()
  });
}
