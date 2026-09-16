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
