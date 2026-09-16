import { AppError } from '../utils/AppError.js';
import {
  findActiveDocumentById,
  listActiveDivisionsForDocuments,
  listActiveDocuments,
  listActiveFolders,
  listActiveFolderUnlocksForSession,
  listFavoriteDocumentIdsForUser
} from '../repositories/documents.repository.js';

function requireView(auth) {
  if (!auth?.permissions?.can_view) {
    throw new AppError('Anda tidak mempunyai izin melihat dokumen.', { statusCode: 403, code: 'PERMISSION_DENIED' });
  }
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function allowedDivisionIds(auth, divisions, requestedDivisionId = '') {
  const requested = String(requestedDivisionId || '').trim();
  if (auth.user.role !== 'SUPER_ADMIN') {
    if (!auth.user.division_id) {
      throw new AppError('User belum mempunyai divisi.', { statusCode: 403, code: 'DIVISION_REQUIRED' });
    }
    if (requested && requested !== auth.user.division_id) {
      throw new AppError('Anda tidak mempunyai akses ke divisi tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
    }
    return [auth.user.division_id];
  }
  if (!requested || requested === 'ALL') return divisions.map((row) => row.id);
  if (!divisions.some((row) => row.id === requested)) {
    throw new AppError('Divisi tidak ditemukan atau tidak aktif.', { statusCode: 404, code: 'DIVISION_NOT_FOUND' });
  }
  return [requested];
}

function searchText(document, divisionName = '') {
  return [
    document.document_name,
    document.original_filename,
    document.document_number,
    document.category,
    Array.isArray(document.tags) ? document.tags.join(' ') : document.tags,
    document.description,
    document.uploaded_by_username_snapshot,
    document.extension,
    document.file_type,
    divisionName
  ].map(normalize).join(' ');
}

function buildFolderMap(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}

function buildUnlockMap(rows) {
  return new Map(rows.map((row) => [row.folder_id, Number(row.password_version || 0)]));
}

function folderChainAccessible(folderId, folderMap, unlockMap) {
  if (!folderId) return true;
  let current = folderMap.get(folderId);
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.password_enabled) {
      const unlockedVersion = unlockMap.get(current.id);
      if (unlockedVersion !== Number(current.password_version || 0)) return false;
    }
    current = current.parent_folder_id ? folderMap.get(current.parent_folder_id) : null;
  }
  return true;
}

function folderPath(folderId, folderMap) {
  if (!folderId) return 'Root';
  const names = [];
  let current = folderMap.get(folderId);
  let guard = 0;
  while (current && guard++ < 100) {
    names.unshift(current.name);
    current = current.parent_folder_id ? folderMap.get(current.parent_folder_id) : null;
  }
  return names.length ? names.join(' / ') : 'Root';
}

function sortDocuments(rows, sort) {
  const mode = String(sort || 'newest');
  const copy = [...rows];
  const name = (row) => normalize(row.document_name || row.original_filename);
  const uploaded = (row) => new Date(row.uploaded_at || row.updated_at || 0).getTime();
  const documentDate = (row) => new Date(row.document_date || row.uploaded_at || 0).getTime();
  const size = (row) => Number(row.file_size || 0);
  copy.sort((a, b) => {
    if (mode === 'oldest') return uploaded(a) - uploaded(b) || name(a).localeCompare(name(b));
    if (mode === 'name_asc') return name(a).localeCompare(name(b));
    if (mode === 'name_desc') return name(b).localeCompare(name(a));
    if (mode === 'size_desc') return size(b) - size(a) || name(a).localeCompare(name(b));
    if (mode === 'size_asc') return size(a) - size(b) || name(a).localeCompare(name(b));
    if (mode === 'document_date_desc') return documentDate(b) - documentDate(a) || name(a).localeCompare(name(b));
    if (mode === 'document_date_asc') return documentDate(a) - documentDate(b) || name(a).localeCompare(name(b));
    return uploaded(b) - uploaded(a) || name(a).localeCompare(name(b));
  });
  return copy;
}

function publicDocument(row, { divisionName, path, favorite }) {
  return {
    id: row.id,
    legacyId: row.legacy_id || null,
    documentName: row.document_name,
    originalFilename: row.original_filename,
    driveUrl: row.drive_url || '',
    folderId: row.folder_id || null,
    folderPath: path,
    divisionId: row.division_id,
    divisionName,
    fileType: row.file_type || '',
    mimeType: row.mime_type || '',
    extension: row.extension || '',
    fileSize: Number(row.file_size || 0),
    documentNumber: row.document_number || '',
    documentDate: row.document_date || null,
    category: row.category || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: row.description || '',
    version: Number(row.current_version || 1),
    uploadedBy: row.uploaded_by_username_snapshot || '',
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
    isFavorite: Boolean(favorite)
  };
}

function makeFilterOptions(rows) {
  const fileTypes = new Set();
  const categories = new Set();
  rows.forEach((row) => {
    const fileType = String(row.file_type || row.extension || '').trim();
    const category = String(row.category || '').trim();
    if (fileType) fileTypes.add(fileType);
    if (category) categories.add(category);
  });
  return {
    fileTypes: [...fileTypes].sort((a, b) => a.localeCompare(b, 'id')),
    categories: [...categories].sort((a, b) => a.localeCompare(b, 'id'))
  };
}

export async function listGlobalDocuments({
  auth,
  divisionId = '',
  search = '',
  fileType = '',
  category = '',
  sort = 'newest',
  page = 1,
  pageSize = 25
}) {
  requireView(auth);

  const divisions = await listActiveDivisionsForDocuments();
  const divisionIds = allowedDivisionIds(auth, divisions, divisionId);
  const divisionMap = new Map(divisions.map((row) => [row.id, row]));

  const [documents, folders, favoriteIds, unlockRows] = await Promise.all([
    listActiveDocuments({ divisionIds }),
    listActiveFolders({ divisionIds }),
    listFavoriteDocumentIdsForUser(auth.user.id),
    listActiveFolderUnlocksForSession(auth.sessionId)
  ]);

  const folderMap = buildFolderMap(folders);
  const unlockMap = buildUnlockMap(unlockRows);

  const accessible = documents.filter((row) => folderChainAccessible(row.folder_id, folderMap, unlockMap));
  const options = makeFilterOptions(accessible);

  const q = normalize(search);
  const ft = normalize(fileType);
  const cat = normalize(category);

  let filtered = accessible.filter((row) => {
    const divisionName = divisionMap.get(row.division_id)?.name || '';
    if (q && !searchText(row, divisionName).includes(q)) return false;
    if (ft && ft !== 'all' && normalize(row.file_type || row.extension) !== ft && normalize(row.extension) !== ft) return false;
    if (cat && cat !== 'all' && !normalize(row.category).includes(cat)) return false;
    return true;
  });

  filtered = sortDocuments(filtered, sort);

  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const effectivePage = Math.min(safePage, totalPages);
  const start = (effectivePage - 1) * safePageSize;
  const pageRows = filtered.slice(start, start + safePageSize).map((row) => publicDocument(row, {
    divisionName: divisionMap.get(row.division_id)?.name || '—',
    path: folderPath(row.folder_id, folderMap),
    favorite: favoriteIds.has(row.id)
  }));

  const totalBytes = filtered.reduce((sum, row) => sum + Number(row.file_size || 0), 0);

  return {
    items: pageRows,
    pagination: { page: effectivePage, pageSize: safePageSize, total, totalPages },
    stats: { totalDocuments: total, totalBytes },
    divisionOptions: divisions
      .filter((row) => auth.user.role === 'SUPER_ADMIN' || row.id === auth.user.division_id)
      .map((row) => ({ id: row.id, legacyId: row.legacy_id || null, name: row.name, slug: row.slug })),
    filterOptions: options,
    filters: {
      divisionId: divisionId || (auth.user.role === 'SUPER_ADMIN' ? 'ALL' : auth.user.division_id),
      search: String(search || ''),
      fileType: String(fileType || ''),
      category: String(category || ''),
      sort: String(sort || 'newest')
    }
  };
}

export async function getGlobalDocumentDetails({ auth, documentId }) {
  requireView(auth);
  const document = await findActiveDocumentById(documentId);
  if (!document) throw new AppError('Dokumen tidak ditemukan.', { statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });

  if (auth.user.role !== 'SUPER_ADMIN' && document.division_id !== auth.user.division_id) {
    throw new AppError('Anda tidak mempunyai akses ke dokumen tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
  }

  const [divisions, folders, favoriteIds, unlockRows] = await Promise.all([
    listActiveDivisionsForDocuments(),
    listActiveFolders({ divisionIds: [document.division_id] }),
    listFavoriteDocumentIdsForUser(auth.user.id),
    listActiveFolderUnlocksForSession(auth.sessionId)
  ]);
  const folderMap = buildFolderMap(folders);
  if (!folderChainAccessible(document.folder_id, folderMap, buildUnlockMap(unlockRows))) {
    throw new AppError('Folder dokumen memerlukan password sebelum dapat dibuka.', {
      statusCode: 423,
      code: 'FOLDER_LOCKED'
    });
  }
  const division = divisions.find((row) => row.id === document.division_id);
  return publicDocument(document, {
    divisionName: division?.name || '—',
    path: folderPath(document.folder_id, folderMap),
    favorite: favoriteIds.has(document.id)
  });
}
