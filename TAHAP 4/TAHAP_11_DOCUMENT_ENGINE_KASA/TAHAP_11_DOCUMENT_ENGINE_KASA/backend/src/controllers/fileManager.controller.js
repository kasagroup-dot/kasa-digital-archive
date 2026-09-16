import { sendSuccess } from '../utils/apiResponse.js';
import { getDivisionDirectory, getFolderContents, getFolderTree } from '../services/fileManager.service.js';

export async function divisions(req, res, next) {
  try {
    const data = await getDivisionDirectory({ auth: req.auth });
    return sendSuccess(res, { message: 'Daftar divisi berhasil dimuat.', data });
  } catch (error) { return next(error); }
}

export async function contents(req, res, next) {
  try {
    const data = await getFolderContents({
      auth: req.auth,
      divisionId: req.query?.divisionId,
      folderId: req.query?.folderId,
      search: req.query?.search,
      fileType: req.query?.fileType,
      category: req.query?.category,
      sort: req.query?.sort,
      page: req.query?.page,
      pageSize: req.query?.pageSize
    });
    return sendSuccess(res, { message: 'File Manager berhasil dimuat.', data });
  } catch (error) { return next(error); }
}

export async function tree(req, res, next) {
  try {
    const data = await getFolderTree({ auth: req.auth, divisionId: req.query?.divisionId });
    return sendSuccess(res, { message: 'Folder tree berhasil dimuat.', data });
  } catch (error) { return next(error); }
}

function requestMeta(req) {
  return { ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null };
}

export async function createFolderAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.createFolder({ auth: req.auth, payload: req.body || {}, ...requestMeta(req) });
    return sendSuccess(res, { statusCode: 201, message: 'Folder berhasil dibuat.', data });
  } catch (error) { return next(error); }
}

export async function renameFolderAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.renameFolder({ auth: req.auth, folderId: req.params.folderId, newName: req.body?.name, ...requestMeta(req) });
    return sendSuccess(res, { message: 'Nama folder berhasil diubah.', data });
  } catch (error) { return next(error); }
}

export async function moveFolderAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.moveFolder({ auth: req.auth, folderId: req.params.folderId, targetParentFolderId: req.body?.targetParentFolderId, ...requestMeta(req) });
    return sendSuccess(res, { message: 'Folder berhasil dipindahkan.', data });
  } catch (error) { return next(error); }
}

export async function deleteFolderAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.deleteFolder({ auth: req.auth, folderId: req.params.folderId, ...requestMeta(req) });
    return sendSuccess(res, { message: 'Folder dipindahkan ke Recycle Bin.', data });
  } catch (error) { return next(error); }
}

export async function unlockFolderAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.unlockFolder({ auth: req.auth, folderId: req.params.folderId, password: req.body?.password, ...requestMeta(req) });
    return sendSuccess(res, { message: 'Folder berhasil dibuka.', data });
  } catch (error) { return next(error); }
}

export async function setFolderPasswordAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.setFolderPassword({ auth: req.auth, folderId: req.params.folderId, password: req.body?.password, ...requestMeta(req) });
    return sendSuccess(res, { message: 'Password folder berhasil disimpan.', data });
  } catch (error) { return next(error); }
}

export async function removeFolderPasswordAction(req, res, next) {
  try {
    const mod = await import('../services/folderMutations.service.js');
    const data = await mod.removeFolderPassword({ auth: req.auth, folderId: req.params.folderId, ...requestMeta(req) });
    return sendSuccess(res, { message: 'Password folder berhasil dihapus.', data });
  } catch (error) { return next(error); }
}
