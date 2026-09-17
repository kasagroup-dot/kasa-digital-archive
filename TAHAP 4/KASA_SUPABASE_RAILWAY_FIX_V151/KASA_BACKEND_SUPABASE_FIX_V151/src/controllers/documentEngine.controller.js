import { sendSuccess } from '../utils/apiResponse.js';
import {
  cancelUpload,
  checkUploadDuplicates,
  deleteDocument,
  getDownloadStream,
  getPreviewInfo,
  getVersionHistory,
  moveDocument,
  renameDocument,
  startResumableUpload,
  toggleFavorite,
  uploadChunk
} from '../services/documentEngine.service.js';

function requestMeta(req) {
  return { ipAddress: req.ip || null, userAgent: req.get('user-agent') || null };
}

export async function duplicatePreflight(req, res, next) {
  try { return sendSuccess(res, { message: 'Preflight upload selesai.', data: await checkUploadDuplicates({ auth: req.auth, divisionId: req.body?.divisionId, folderId: req.body?.folderId, names: req.body?.names }) }); }
  catch (error) { return next(error); }
}

export async function startUpload(req, res, next) {
  try { return sendSuccess(res, { message: 'Upload session dibuat.', data: await startResumableUpload({ auth: req.auth, payload: req.body || {}, ...requestMeta(req) }) }); }
  catch (error) { return next(error); }
}

export async function chunkUpload(req, res, next) {
  try {
    return sendSuccess(res, { message: 'Chunk upload diterima.', data: await uploadChunk({ auth: req.auth, uploadId: req.params.uploadId, offset: req.query?.offset, buffer: req.body, ...requestMeta(req) }) });
  } catch (error) { return next(error); }
}

export async function cancel(req, res, next) {
  try { return sendSuccess(res, { message: 'Upload dibatalkan.', data: await cancelUpload({ auth: req.auth, uploadId: req.params.uploadId }) }); }
  catch (error) { return next(error); }
}

export async function preview(req, res, next) {
  try { return sendSuccess(res, { message: 'Preview dokumen siap.', data: await getPreviewInfo({ auth: req.auth, documentId: req.params.documentId }) }); }
  catch (error) { return next(error); }
}

export async function download(req, res, next) {
  try {
    const result = await getDownloadStream({ auth: req.auth, documentId: req.params.documentId, versionId: req.params.versionId || null });
    res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.filename || 'download')}`);
    if (result.size) res.setHeader('Content-Length', String(result.size));
    result.stream.on('error', next);
    result.stream.pipe(res);
  } catch (error) { return next(error); }
}

export async function rename(req, res, next) {
  try { return sendSuccess(res, { message: 'Dokumen berhasil diubah namanya.', data: await renameDocument({ auth: req.auth, documentId: req.params.documentId, documentName: req.body?.documentName, ...requestMeta(req) }) }); }
  catch (error) { return next(error); }
}

export async function move(req, res, next) {
  try { return sendSuccess(res, { message: 'Dokumen berhasil dipindahkan.', data: await moveDocument({ auth: req.auth, documentId: req.params.documentId, targetFolderId: req.body?.targetFolderId, ...requestMeta(req) }) }); }
  catch (error) { return next(error); }
}

export async function remove(req, res, next) {
  try { return sendSuccess(res, { message: 'Dokumen dipindahkan ke Recycle Bin.', data: await deleteDocument({ auth: req.auth, documentId: req.params.documentId, ...requestMeta(req) }) }); }
  catch (error) { return next(error); }
}

export async function favorite(req, res, next) {
  try { return sendSuccess(res, { message: 'Favorit diperbarui.', data: await toggleFavorite({ auth: req.auth, documentId: req.params.documentId }) }); }
  catch (error) { return next(error); }
}

export async function versions(req, res, next) {
  try { return sendSuccess(res, { message: 'Riwayat versi dimuat.', data: await getVersionHistory({ auth: req.auth, documentId: req.params.documentId }) }); }
  catch (error) { return next(error); }
}
