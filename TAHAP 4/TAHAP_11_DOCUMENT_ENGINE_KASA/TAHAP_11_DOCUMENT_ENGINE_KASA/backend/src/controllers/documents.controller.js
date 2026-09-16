import { sendSuccess } from '../utils/apiResponse.js';
import { getGlobalDocumentDetails, listGlobalDocuments } from '../services/documents.service.js';

export async function list(req, res, next) {
  try {
    const data = await listGlobalDocuments({
      auth: req.auth,
      divisionId: req.query?.divisionId,
      search: req.query?.search,
      fileType: req.query?.fileType,
      category: req.query?.category,
      sort: req.query?.sort,
      page: req.query?.page,
      pageSize: req.query?.pageSize
    });
    return sendSuccess(res, { message: 'Dokumen berhasil dimuat.', data });
  } catch (error) {
    return next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const data = await getGlobalDocumentDetails({ auth: req.auth, documentId: req.params.documentId });
    return sendSuccess(res, { message: 'Detail dokumen berhasil dimuat.', data });
  } catch (error) {
    return next(error);
  }
}
