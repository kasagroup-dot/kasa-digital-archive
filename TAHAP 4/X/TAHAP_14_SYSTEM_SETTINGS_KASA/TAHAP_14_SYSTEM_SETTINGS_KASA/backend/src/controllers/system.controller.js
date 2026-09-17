import { sendSuccess } from '../utils/apiResponse.js';
import * as service from '../services/system.service.js';

function requestIp(req) { return req.ip || req.socket?.remoteAddress || null; }
function requestAgent(req) { return String(req.headers['user-agent'] || '').slice(0, 1000) || null; }

export async function settings(req, res, next) {
  try {
    return sendSuccess(res, { message: 'System settings siap.', data: await service.getSystemSettings() });
  } catch (error) { return next(error); }
}

export async function updateSettings(req, res, next) {
  try {
    const data = await service.updateSystemSettings({
      auth: req.auth,
      payload: req.body || {},
      ipAddress: requestIp(req),
      userAgent: requestAgent(req)
    });
    return sendSuccess(res, { message: 'System settings berhasil disimpan.', data });
  } catch (error) { return next(error); }
}

export async function status(req, res, next) {
  try {
    return sendSuccess(res, { message: 'System diagnostics siap.', data: await service.getSystemStatus() });
  } catch (error) { return next(error); }
}

export async function cleanupSessions(req, res, next) {
  try {
    const data = await service.cleanupExpiredSessions({ auth: req.auth, ipAddress: requestIp(req), userAgent: requestAgent(req) });
    return sendSuccess(res, { message: `${data.expired} session kedaluwarsa dibersihkan.`, data });
  } catch (error) { return next(error); }
}
