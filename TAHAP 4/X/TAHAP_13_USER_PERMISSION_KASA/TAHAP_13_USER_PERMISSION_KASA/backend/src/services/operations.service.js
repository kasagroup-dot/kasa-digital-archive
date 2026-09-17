import { AppError } from '../utils/AppError.js';
import { writeAuditSafe } from './audit.service.js';
import { moveDriveFile, moveDriveFolder, trashDriveItem } from './googleDrive.service.js';
import { findActiveDivisionById, findFolderById, getActiveFolderUnlocks, listActiveFoldersForDivision, siblingFolderExists } from '../repositories/fileManager.repository.js';
import { findDuplicateDocument } from '../repositories/documentEngine.repository.js';
import {
  findRecycleDocument,
  findRecycleFolder,
  listActivityActions,
  listActivityRows,
  listDeletedDocumentsByIds,
  listDeletedFoldersByIds,
  listDivisionMapRows,
  listDocumentVersionDriveIds,
  listDocumentsByIds,
  listFavoriteDocumentIds,
  listRecentDocumentsRaw,
  listRecycleRows,
  removeFavoritesForDocument,
  removeRecycleDocument,
  removeRecycleFolder,
  updateDocumentRecord,
  updateFolderRecord
} from '../repositories/operations.repository.js';

function requirePermission(auth, key, message) {
  if (auth?.user?.role === 'SUPER_ADMIN') return;
  if (!auth?.permissions?.[key]) throw new AppError(message || 'Akses ditolak.', { statusCode: 403, code: 'PERMISSION_DENIED' });
}

function resolveDivisionScope(auth, requested = '') {
  const asked = String(requested || '').trim();
  if (auth.user.role === 'SUPER_ADMIN') return asked || null;
  if (!auth.user.division_id) throw new AppError('User belum mempunyai divisi.', { statusCode: 403, code: 'DIVISION_REQUIRED' });
  if (asked && asked !== auth.user.division_id) throw new AppError('Anda tidak mempunyai akses ke divisi tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
  return auth.user.division_id;
}

async function divisionMap() {
  const rows = await listDivisionMapRows();
  return new Map(rows.map((row) => [row.id, row]));
}

function publicDoc(row, divMap, favorite = false) {
  return {
    id: row.id,
    legacyId: row.legacy_id || null,
    documentName: row.document_name,
    originalFilename: row.original_filename,
    driveUrl: row.drive_url || `https://drive.google.com/file/d/${row.google_drive_file_id}/view`,
    folderId: row.folder_id || null,
    divisionId: row.division_id,
    divisionName: divMap.get(row.division_id)?.name || '',
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

async function buildUnlockContext(auth, divisions) {
  const [unlocks, ...folderSets] = await Promise.all([
    getActiveFolderUnlocks(auth.sessionId),
    ...divisions.map((id) => listActiveFoldersForDivision(id))
  ]);
  const folderMap = new Map();
  folderSets.flat().forEach((row) => folderMap.set(row.id, row));
  const unlockMap = new Map(unlocks.map((row) => [row.folder_id, Number(row.password_version || 0)]));
  return { folderMap, unlockMap };
}

function isUnlocked(folderId, context) {
  if (!folderId) return true;
  let current = context.folderMap.get(folderId);
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.password_enabled && context.unlockMap.get(current.id) !== Number(current.password_version || 0)) return false;
    current = current.parent_folder_id ? context.folderMap.get(current.parent_folder_id) : null;
  }
  return true;
}

async function assertTargetFolderUnlocked(auth, divisionId, folderId) {
  if (!folderId) return null;
  const rows = await listActiveFoldersForDivision(divisionId);
  const map = new Map(rows.map((row) => [row.id, row]));
  const unlocks = await getActiveFolderUnlocks(auth.sessionId);
  const unlockMap = new Map(unlocks.map((row) => [row.folder_id, Number(row.password_version || 0)]));
  let current = map.get(folderId);
  if (!current) return null;
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.password_enabled && unlockMap.get(current.id) !== Number(current.password_version || 0)) {
      throw new AppError('Folder tujuan memerlukan password sebelum restore.', { statusCode: 423, code: 'FOLDER_LOCKED', details: { folderId: current.id, folderName: current.name } });
    }
    current = current.parent_folder_id ? map.get(current.parent_folder_id) : null;
  }
  return map.get(folderId) || null;
}

export async function getRecentDocuments({ auth, divisionId = '', limit = 30, search = '' }) {
  requirePermission(auth, 'can_view', 'Anda tidak mempunyai izin melihat dokumen.');
  const scope = resolveDivisionScope(auth, divisionId);
  const rows = await listRecentDocumentsRaw({ divisionId: scope, limit: Math.min((Number(limit) || 30) * 3, 100), search });
  const divIds = [...new Set(rows.map((row) => row.division_id).filter(Boolean))];
  const [divMap, unlockContext, favorites] = await Promise.all([divisionMap(), buildUnlockContext(auth, divIds), listFavoriteDocumentIds(auth.user.id)]);
  const favoriteSet = new Set(favorites.map((row) => row.document_id));
  return rows.filter((row) => isUnlocked(row.folder_id, unlockContext)).slice(0, Math.min(Math.max(Number(limit) || 30, 1), 100)).map((row) => publicDoc(row, divMap, favoriteSet.has(row.id)));
}

export async function getFavorites({ auth, search = '' }) {
  requirePermission(auth, 'can_view', 'Anda tidak mempunyai izin melihat dokumen.');
  const favRows = await listFavoriteDocumentIds(auth.user.id);
  const order = new Map(favRows.map((row, index) => [row.document_id, index]));
  let docs = await listDocumentsByIds(favRows.map((row) => row.document_id));
  if (auth.user.role !== 'SUPER_ADMIN') docs = docs.filter((row) => row.division_id === auth.user.division_id);
  const q = String(search || '').trim().toLowerCase();
  if (q) docs = docs.filter((row) => [row.document_name,row.original_filename,row.category,row.document_number,(row.tags || []).join(' ')].join(' ').toLowerCase().includes(q));
  const divIds = [...new Set(docs.map((row) => row.division_id).filter(Boolean))];
  const [divMap, unlockContext] = await Promise.all([divisionMap(), buildUnlockContext(auth, divIds)]);
  return docs.filter((row) => isUnlocked(row.folder_id, unlockContext)).sort((a,b) => (order.get(a.id) ?? 999999) - (order.get(b.id) ?? 999999)).map((row) => publicDoc(row, divMap, true));
}

export async function getRecycleBin({ auth, divisionId = '' }) {
  requirePermission(auth, 'can_view', 'Anda tidak mempunyai izin melihat Recycle Bin.');
  const scope = resolveDivisionScope(auth, divisionId);
  const recycleRows = await listRecycleRows({ divisionId: scope });
  const docIds = recycleRows.filter((row) => row.object_type === 'DOCUMENT').map((row) => row.document_id).filter(Boolean);
  const folderIds = recycleRows.filter((row) => row.object_type === 'FOLDER').map((row) => row.folder_id).filter(Boolean);
  const [docs, folders, divMap] = await Promise.all([listDeletedDocumentsByIds(docIds), listDeletedFoldersByIds(folderIds), divisionMap()]);
  const docMap = new Map(docs.map((row) => [row.id, row]));
  const folderMap = new Map(folders.map((row) => [row.id, row]));
  return recycleRows.map((row) => {
    if (row.object_type === 'DOCUMENT') {
      const doc = docMap.get(row.document_id);
      if (!doc) return null;
      return { kind: 'document', deletedAt: row.deleted_at, deletedBy: row.deleted_by_username_snapshot || doc.deleted_by_username_snapshot || '', data: { ...publicDoc(doc, divMap, false), status: doc.status } };
    }
    const folder = folderMap.get(row.folder_id);
    if (!folder) return null;
    return { kind: 'folder', deletedAt: row.deleted_at, deletedBy: row.deleted_by_username_snapshot || folder.deleted_by_username_snapshot || '', data: { id: folder.id, legacyId: folder.legacy_id || null, name: folder.name, divisionId: folder.division_id, divisionName: divMap.get(folder.division_id)?.name || '', description: folder.description || '', parentFolderId: folder.parent_folder_id || null, originalParentFolderId: folder.original_parent_folder_id || null, passwordProtected: Boolean(folder.password_enabled), status: folder.status } };
  }).filter(Boolean);
}

export async function restoreDocument({ auth, documentId, ipAddress, userAgent }) {
  requirePermission(auth, 'can_restore', 'Anda tidak mempunyai izin restore dokumen.');
  const { recycle, document } = await findRecycleDocument(documentId);
  if (!recycle || !document || document.status !== 'DELETED') throw new AppError('Dokumen tidak berada di Recycle Bin.', { statusCode: 400, code: 'NOT_IN_RECYCLE' });
  resolveDivisionScope(auth, document.division_id);
  const division = await findActiveDivisionById(document.division_id);
  if (!division) throw new AppError('Divisi dokumen tidak aktif.', { statusCode: 409, code: 'DIVISION_INACTIVE' });
  let targetFolderId = document.original_folder_id || recycle.original_parent_folder_id || null;
  let targetFolder = targetFolderId ? await findFolderById(targetFolderId) : null;
  if (!targetFolder || targetFolder.division_id !== document.division_id) { targetFolderId = null; targetFolder = null; }
  if (targetFolderId) await assertTargetFolderUnlocked(auth, document.division_id, targetFolderId);
  const duplicate = await findDuplicateDocument({ divisionId: document.division_id, folderId: targetFolderId, filename: document.original_filename, excludeDocumentId: document.id });
  if (duplicate) throw new AppError('Restore dibatalkan karena ada file aktif dengan nama yang sama di lokasi tujuan.', { statusCode: 409, code: 'RESTORE_DUPLICATE' });
  const driveTarget = targetFolder?.google_drive_folder_id || division.google_drive_folder_id;
  try { await trashDriveItem(document.google_drive_file_id, false); await moveDriveFile(document.google_drive_file_id, driveTarget); } catch (_) {}
  const now = new Date().toISOString();
  await updateDocumentRecord(document.id, { status: 'ACTIVE', folder_id: targetFolderId, deleted_by_user_id: null, deleted_by_username_snapshot: null, deleted_at: null, updated_at: now });
  await removeRecycleDocument(document.id);
  void writeAuditSafe({ user: auth.user, action: 'RESTORE_DOCUMENT', objectType: 'DOCUMENT', objectId: document.id, objectName: document.original_filename, detail: 'Dokumen direstore dari Recycle Bin.', ipAddress, userAgent });
  return { id: document.id, restored: true, folderId: targetFolderId };
}

export async function restoreFolder({ auth, folderId, ipAddress, userAgent }) {
  requirePermission(auth, 'can_restore', 'Anda tidak mempunyai izin restore folder.');
  const { recycle, folder } = await findRecycleFolder(folderId);
  if (!recycle || !folder || folder.status !== 'DELETED') throw new AppError('Folder tidak berada di Recycle Bin.', { statusCode: 400, code: 'NOT_IN_RECYCLE' });
  resolveDivisionScope(auth, folder.division_id);
  const division = await findActiveDivisionById(folder.division_id);
  if (!division) throw new AppError('Divisi folder tidak aktif.', { statusCode: 409, code: 'DIVISION_INACTIVE' });
  let parentId = folder.original_parent_folder_id || recycle.original_parent_folder_id || null;
  let parent = parentId ? await findFolderById(parentId) : null;
  if (!parent || parent.division_id !== folder.division_id) { parentId = null; parent = null; }
  if (parentId) await assertTargetFolderUnlocked(auth, folder.division_id, parentId);
  if (await siblingFolderExists({ divisionId: folder.division_id, parentFolderId: parentId, name: folder.name, excludeFolderId: folder.id })) throw new AppError('Restore dibatalkan karena ada folder aktif dengan nama yang sama di lokasi tujuan.', { statusCode: 409, code: 'RESTORE_DUPLICATE' });
  const driveTarget = parent?.google_drive_folder_id || division.google_drive_folder_id;
  try { await trashDriveItem(folder.google_drive_folder_id, false); await moveDriveFolder(folder.google_drive_folder_id, driveTarget); } catch (_) {}
  const now = new Date().toISOString();
  await updateFolderRecord(folder.id, { status: 'ACTIVE', parent_folder_id: parentId, deleted_by_user_id: null, deleted_by_username_snapshot: null, deleted_at: null, updated_at: now });
  await removeRecycleFolder(folder.id);
  void writeAuditSafe({ user: auth.user, action: 'RESTORE_FOLDER', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Folder direstore dari Recycle Bin.', ipAddress, userAgent });
  return { id: folder.id, restored: true, parentFolderId: parentId };
}

export async function purgeDocument({ auth, documentId, ipAddress, userAgent }) {
  requirePermission(auth, 'can_delete', 'Anda tidak mempunyai izin menghapus permanen dokumen.');
  const { recycle, document } = await findRecycleDocument(documentId);
  if (!recycle || !document || document.status !== 'DELETED') throw new AppError('Hanya dokumen di Recycle Bin yang dapat dihapus permanen.', { statusCode: 400, code: 'NOT_IN_RECYCLE' });
  resolveDivisionScope(auth, document.division_id);
  const versionIds = await listDocumentVersionDriveIds(document.id);
  await Promise.allSettled([document.google_drive_file_id, ...versionIds].filter(Boolean).map((id) => trashDriveItem(id, true)));
  await updateDocumentRecord(document.id, { status: 'PURGED', updated_at: new Date().toISOString() });
  await removeRecycleDocument(document.id);
  await removeFavoritesForDocument(document.id);
  void writeAuditSafe({ user: auth.user, action: 'PERMANENT_DELETE', objectType: 'DOCUMENT', objectId: document.id, objectName: document.original_filename, detail: 'Dokumen dihapus permanen / dipindahkan ke Trash Google Drive.', ipAddress, userAgent });
  return { id: document.id, purged: true };
}

export async function purgeFolder({ auth, folderId, ipAddress, userAgent }) {
  requirePermission(auth, 'can_delete', 'Anda tidak mempunyai izin menghapus permanen folder.');
  const { recycle, folder } = await findRecycleFolder(folderId);
  if (!recycle || !folder || folder.status !== 'DELETED') throw new AppError('Hanya folder di Recycle Bin yang dapat dihapus permanen.', { statusCode: 400, code: 'NOT_IN_RECYCLE' });
  resolveDivisionScope(auth, folder.division_id);
  await Promise.allSettled([trashDriveItem(folder.google_drive_folder_id, true)]);
  await updateFolderRecord(folder.id, { status: 'PURGED', updated_at: new Date().toISOString() });
  await removeRecycleFolder(folder.id);
  void writeAuditSafe({ user: auth.user, action: 'PERMANENT_DELETE_FOLDER', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Folder dihapus permanen / dipindahkan ke Trash Google Drive.', ipAddress, userAgent });
  return { id: folder.id, purged: true };
}

export async function getActivityLog({ auth, params = {} }) {
  requirePermission(auth, 'can_view_log', 'Anda tidak mempunyai izin melihat Activity Log.');
  let divisionId = resolveDivisionScope(auth, params.divisionId || '');
  const result = await listActivityRows({
    divisionId,
    userId: null,
    username: params.user || '',
    action: params.action || '',
    query: params.query || '',
    dateFrom: params.dateFrom || '',
    dateTo: params.dateTo || '',
    page: params.page || 1,
    pageSize: params.pageSize || 50
  });
  const [divMap, actions] = await Promise.all([divisionMap(), listActivityActions()]);
  return {
    items: result.rows.map((row) => ({ id: row.id, occurredAt: row.occurred_at, userId: row.user_id, username: row.username_snapshot || 'SYSTEM', divisionId: row.division_id || null, divisionName: divMap.get(row.division_id)?.name || '', action: row.action, objectType: row.object_type || '', objectId: row.object_id || '', objectName: row.object_name || '', detail: row.detail || '', ipAddress: row.ip_address || '' })),
    pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)) },
    actions
  };
}
