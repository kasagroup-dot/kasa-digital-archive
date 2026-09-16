import { AppError } from '../utils/AppError.js';
import {
  findActiveDivisionById,
  getActiveCountsByDivision,
  getFavoriteDocumentIds,
  getActiveFolderUnlocks,
  listActiveDivisions,
  listActiveFoldersForDivision,
  listDirectDocuments,
  listDirectFolders
} from '../repositories/fileManager.repository.js';

function requireView(auth) {
  if (!auth?.permissions?.can_view) {
    throw new AppError('Anda tidak mempunyai izin melihat dokumen.', { statusCode: 403, code: 'PERMISSION_DENIED' });
  }
}

async function resolveDivision(user, requestedDivisionId) {
  let divisionId = String(requestedDivisionId || '').trim();
  if (user.role !== 'SUPER_ADMIN') {
    if (!user.division_id) throw new AppError('User belum mempunyai divisi.', { statusCode: 403, code: 'DIVISION_REQUIRED' });
    if (divisionId && divisionId !== user.division_id) {
      throw new AppError('Anda tidak mempunyai akses ke divisi tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
    }
    divisionId = user.division_id;
  }
  if (!divisionId) throw new AppError('Pilih divisi terlebih dahulu.', { statusCode: 400, code: 'DIVISION_REQUIRED' });
  const division = await findActiveDivisionById(divisionId);
  if (!division) throw new AppError('Divisi tidak ditemukan atau tidak aktif.', { statusCode: 404, code: 'DIVISION_NOT_FOUND' });
  return division;
}

function normalizeText(value) { return String(value || '').trim().toLowerCase(); }

function folderSearchText(row) {
  return [row.name, row.description, row.created_by_username_snapshot].map(normalizeText).join(' ');
}

function documentSearchText(row) {
  return [
    row.document_name, row.original_filename, row.document_number, row.category,
    Array.isArray(row.tags) ? row.tags.join(' ') : row.tags,
    row.description, row.uploaded_by_username_snapshot, row.extension, row.file_type
  ].map(normalizeText).join(' ');
}

function sortCombined(items, sort) {
  const value = String(sort || 'newest');
  const copy = [...items];
  const nameOf = (item) => normalizeText(item.kind === 'folder' ? item.data.name : item.data.document_name || item.data.original_filename);
  const timeOf = (item) => new Date(item.data.updated_at || item.data.uploaded_at || item.data.created_at || 0).getTime();
  const sizeOf = (item) => Number(item.kind === 'document' ? item.data.file_size || 0 : 0);
  copy.sort((a, b) => {
    if (value === 'oldest') return timeOf(a) - timeOf(b) || nameOf(a).localeCompare(nameOf(b));
    if (value === 'name_asc') return nameOf(a).localeCompare(nameOf(b));
    if (value === 'name_desc') return nameOf(b).localeCompare(nameOf(a));
    if (value === 'size_desc') return sizeOf(b) - sizeOf(a) || nameOf(a).localeCompare(nameOf(b));
    if (value === 'size_asc') return sizeOf(a) - sizeOf(b) || nameOf(a).localeCompare(nameOf(b));
    return timeOf(b) - timeOf(a) || nameOf(a).localeCompare(nameOf(b));
  });
  return copy;
}

function buildFolderMap(rows) { return new Map(rows.map((row) => [row.id, row])); }

async function assertFolderChainUnlocked(auth, folderId, folderMap) {
  if (!folderId) return;
  const unlockRows = await getActiveFolderUnlocks(auth.sessionId);
  const unlockMap = new Map(unlockRows.map((row) => [row.folder_id, Number(row.password_version || 0)]));
  let current = folderMap.get(folderId);
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.password_enabled) {
      const unlockedVersion = unlockMap.get(current.id);
      const requiredVersion = Number(current.password_version || 0);
      if (unlockedVersion !== requiredVersion) {
        throw new AppError('Folder memerlukan password sebelum dapat dibuka.', {
          statusCode: 423,
          code: 'FOLDER_LOCKED',
          details: { folderId: current.id, folderName: current.name, passwordVersion: requiredVersion }
        });
      }
    }
    current = current.parent_folder_id ? folderMap.get(current.parent_folder_id) : null;
  }
}

function buildBreadcrumb(division, folderId, rows) {
  const result = [{ id: '', name: division.name, isRoot: true }];
  if (!folderId) return result;
  const map = buildFolderMap(rows);
  let current = map.get(folderId);
  if (!current) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  const stack = [];
  let guard = 0;
  while (current && guard++ < 100) {
    stack.unshift({ id: current.id, name: current.name, passwordProtected: Boolean(current.password_enabled) });
    current = current.parent_folder_id ? map.get(current.parent_folder_id) : null;
  }
  return result.concat(stack);
}

function pathFor(folder, map) {
  const names = [folder.name];
  let current = folder;
  let guard = 0;
  while (current.parent_folder_id && guard++ < 100) {
    current = map.get(current.parent_folder_id);
    if (!current) break;
    names.unshift(current.name);
  }
  return names.join(' / ');
}

function publicFolder(row, auth) {
  const role = String(auth?.user?.role || '');
  const canManagePassword = ['SUPER_ADMIN','DIVISION_ADMIN'].includes(role) || (Boolean(auth?.permissions?.can_create_folder) && String(row.created_by_user_id || '') === String(auth?.user?.id || ''));
  return {
    id: row.id,
    legacyId: row.legacy_id || null,
    name: row.name,
    description: row.description || '',
    parentFolderId: row.parent_folder_id || null,
    divisionId: row.division_id,
    createdBy: row.created_by_username_snapshot || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    passwordProtected: Boolean(row.password_enabled),
    passwordVersion: Number(row.password_version || 0),
    canManagePassword
  };
}

function publicDocument(row, favoriteSet) {
  return {
    id: row.id,
    legacyId: row.legacy_id || null,
    documentName: row.document_name,
    originalFilename: row.original_filename,
    driveUrl: row.drive_url || '',
    folderId: row.folder_id || null,
    divisionId: row.division_id,
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
    isFavorite: favoriteSet.has(row.id)
  };
}

export async function getDivisionDirectory({ auth }) {
  requireView(auth);
  const divisions = await listActiveDivisions();
  const { folderCounts, documentCounts } = await getActiveCountsByDivision();
  const allowed = auth.user.role === 'SUPER_ADMIN'
    ? divisions
    : divisions.filter((division) => division.id === auth.user.division_id);
  return allowed.map((division) => ({
    id: division.id,
    legacyId: division.legacy_id || null,
    name: division.name,
    slug: division.slug,
    description: division.description || '',
    folderCount: folderCounts.get(division.id) || 0,
    documentCount: documentCounts.get(division.id) || 0
  }));
}

export async function getFolderContents({ auth, divisionId, folderId = '', search = '', fileType = '', category = '', sort = 'newest', page = 1, pageSize = 25 }) {
  requireView(auth);
  const division = await resolveDivision(auth.user, divisionId);
  const normalizedFolderId = String(folderId || '').trim() || null;
  const allFolders = await listActiveFoldersForDivision(division.id);
  const map = buildFolderMap(allFolders);
  if (normalizedFolderId) {
    const current = map.get(normalizedFolderId);
    if (!current || current.division_id !== division.id) throw new AppError('Folder tidak ditemukan pada divisi ini.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
    await assertFolderChainUnlocked(auth, normalizedFolderId, map);
  }

  const [folders, documents, favoriteSet] = await Promise.all([
    listDirectFolders({ divisionId: division.id, parentFolderId: normalizedFolderId }),
    listDirectDocuments({ divisionId: division.id, folderId: normalizedFolderId }),
    getFavoriteDocumentIds(auth.user.id)
  ]);

  const q = normalizeText(search);
  const ft = normalizeText(fileType);
  const cat = normalizeText(category);
  let folderItems = folders;
  let documentItems = documents;
  if (q) {
    folderItems = folderItems.filter((row) => folderSearchText(row).includes(q));
    documentItems = documentItems.filter((row) => documentSearchText(row).includes(q));
  }
  if (ft) documentItems = documentItems.filter((row) => normalizeText(row.extension) === ft || normalizeText(row.file_type) === ft);
  if (cat) documentItems = documentItems.filter((row) => normalizeText(row.category).includes(cat));

  let combined = folderItems.map((row) => ({ kind: 'folder', data: publicFolder(row, auth) }))
    .concat(documentItems.map((row) => ({ kind: 'document', data: publicDocument(row, favoriteSet) })));
  combined = sortCombined(combined, sort);

  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const effectivePage = Math.min(safePage, totalPages);
  const start = (effectivePage - 1) * safePageSize;

  return {
    division: { id: division.id, legacyId: division.legacy_id || null, name: division.name, slug: division.slug },
    folderId: normalizedFolderId,
    breadcrumb: buildBreadcrumb(division, normalizedFolderId, allFolders),
    items: combined.slice(start, start + safePageSize),
    pagination: { page: effectivePage, pageSize: safePageSize, total, totalPages },
    filters: { search: String(search || ''), fileType: String(fileType || ''), category: String(category || ''), sort: String(sort || 'newest') },
    capabilities: {
      createFolder: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_create_folder),
      rename: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_rename),
      move: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_move),
      delete: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_delete),
      upload: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_upload),
      download: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_download),
      preview: Boolean(auth.user.role === 'SUPER_ADMIN' || auth.permissions?.can_preview)
    }
  };
}

export async function getFolderTree({ auth, divisionId }) {
  requireView(auth);
  const division = await resolveDivision(auth.user, divisionId);
  const rows = await listActiveFoldersForDivision(division.id);
  const map = buildFolderMap(rows);
  return [{ folderId: '', name: 'Root', path: 'Root', passwordProtected: false }]
    .concat(rows.map((row) => ({
      folderId: row.id,
      name: row.name,
      path: pathFor(row, map),
      passwordProtected: Boolean(row.password_enabled),
      createdBy: row.created_by_username_snapshot || ''
    })).sort((a, b) => a.path.localeCompare(b.path, 'id')));
}
