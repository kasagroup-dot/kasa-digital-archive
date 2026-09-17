import { sendSuccess } from '../utils/apiResponse.js';
import {
  adminResetPassword,
  adminRevokeSessions,
  cancelResetRequestAdmin,
  createAdminUser,
  getPermissionsAdmin,
  getResetRequestsAdmin,
  getUserAdminDetail,
  getUserAdminList,
  updateAdminUserProfile,
  updatePermissionsAdmin
} from '../services/admin.service.js';

function meta(req) {
  return { ipAddress: req.ip || null, userAgent: req.get('user-agent') || null };
}

export async function users(req, res, next) {
  try { return sendSuccess(res, { message: 'Manajemen user dimuat.', data: await getUserAdminList({ params: req.query || {} }) }); }
  catch (error) { return next(error); }
}

export async function userDetail(req, res, next) {
  try { return sendSuccess(res, { message: 'Detail user dimuat.', data: await getUserAdminDetail(req.params.userId) }); }
  catch (error) { return next(error); }
}

export async function createUser(req, res, next) {
  try { return sendSuccess(res, { statusCode: 201, message: 'User berhasil dibuat.', data: await createAdminUser({ auth: req.auth, payload: req.body || {}, ...meta(req) }) }); }
  catch (error) { return next(error); }
}

export async function updateUser(req, res, next) {
  try { return sendSuccess(res, { message: 'User berhasil diperbarui.', data: await updateAdminUserProfile({ auth: req.auth, userId: req.params.userId, payload: req.body || {}, ...meta(req) }) }); }
  catch (error) { return next(error); }
}

export async function resetPassword(req, res, next) {
  try { return sendSuccess(res, { message: 'Password user berhasil direset.', data: await adminResetPassword({ auth: req.auth, userId: req.params.userId, payload: req.body || {}, ...meta(req) }) }); }
  catch (error) { return next(error); }
}

export async function revokeSessions(req, res, next) {
  try { return sendSuccess(res, { message: 'Session user berhasil direvoke.', data: await adminRevokeSessions({ auth: req.auth, userId: req.params.userId, ...meta(req) }) }); }
  catch (error) { return next(error); }
}

export async function permissions(req, res, next) {
  try { return sendSuccess(res, { message: 'Permission user dimuat.', data: await getPermissionsAdmin(req.params.userId) }); }
  catch (error) { return next(error); }
}

export async function updatePermissions(req, res, next) {
  try { return sendSuccess(res, { message: 'Permission user berhasil diperbarui.', data: await updatePermissionsAdmin({ auth: req.auth, userId: req.params.userId, payload: req.body || {}, ...meta(req) }) }); }
  catch (error) { return next(error); }
}

export async function resetRequests(req, res, next) {
  try { return sendSuccess(res, { message: 'Password reset requests dimuat.', data: await getResetRequestsAdmin({ params: req.query || {} }) }); }
  catch (error) { return next(error); }
}

export async function cancelResetRequest(req, res, next) {
  try { return sendSuccess(res, { message: 'Permintaan reset dibatalkan.', data: await cancelResetRequestAdmin({ auth: req.auth, requestId: req.params.requestId, ...meta(req) }) }); }
  catch (error) { return next(error); }
}
