import { sendSuccess } from '../utils/apiResponse.js';
import { getActivityLog, getFavorites, getRecentDocuments, getRecycleBin, purgeDocument, purgeFolder, restoreDocument, restoreFolder } from '../services/operations.service.js';

function meta(req) { return { ipAddress: req.ip || null, userAgent: req.get('user-agent') || null }; }

export async function recent(req, res, next) {
  try { return sendSuccess(res, { message: 'Dokumen terbaru dimuat.', data: await getRecentDocuments({ auth: req.auth, divisionId: req.query?.divisionId, limit: req.query?.limit, search: req.query?.search }) }); }
  catch (error) { return next(error); }
}
export async function favorites(req, res, next) {
  try { return sendSuccess(res, { message: 'Favorit dimuat.', data: await getFavorites({ auth: req.auth, search: req.query?.search }) }); }
  catch (error) { return next(error); }
}
export async function recycle(req, res, next) {
  try { return sendSuccess(res, { message: 'Recycle Bin dimuat.', data: await getRecycleBin({ auth: req.auth, divisionId: req.query?.divisionId }) }); }
  catch (error) { return next(error); }
}
export async function restoreDoc(req, res, next) {
  try { return sendSuccess(res, { message: 'Dokumen berhasil direstore.', data: await restoreDocument({ auth: req.auth, documentId: req.params.documentId, ...meta(req) }) }); }
  catch (error) { return next(error); }
}
export async function restoreFld(req, res, next) {
  try { return sendSuccess(res, { message: 'Folder berhasil direstore.', data: await restoreFolder({ auth: req.auth, folderId: req.params.folderId, ...meta(req) }) }); }
  catch (error) { return next(error); }
}
export async function purgeDoc(req, res, next) {
  try { return sendSuccess(res, { message: 'Dokumen dihapus permanen.', data: await purgeDocument({ auth: req.auth, documentId: req.params.documentId, ...meta(req) }) }); }
  catch (error) { return next(error); }
}
export async function purgeFld(req, res, next) {
  try { return sendSuccess(res, { message: 'Folder dihapus permanen.', data: await purgeFolder({ auth: req.auth, folderId: req.params.folderId, ...meta(req) }) }); }
  catch (error) { return next(error); }
}
export async function activity(req, res, next) {
  try { return sendSuccess(res, { message: 'Activity Log dimuat.', data: await getActivityLog({ auth: req.auth, params: req.query || {} }) }); }
  catch (error) { return next(error); }
}
