import { AppError } from '../utils/AppError.js';
import { writeAuditSafe } from './audit.service.js';
import { createDriveFolder, moveDriveFolder, renameDriveFolder } from './googleDrive.service.js';
import { makeFolderPasswordHash, validateFolderPassword, verifyFolderPassword } from './folderPassword.service.js';
import {
  clearFolderUnlocks,
  countActiveChildren,
  findActiveDivisionById,
  findFolderById,
  getActiveFolderUnlocks,
  insertFolderRecord,
  insertRecycleFolder,
  listActiveFoldersForDivision,
  siblingFolderExists,
  updateFolderRecord,
  upsertFolderUnlock
} from '../repositories/fileManager.repository.js';

const unlockFailures = new Map();

function requirePermission(auth, key, message) {
  if (auth?.user?.role === 'SUPER_ADMIN') return;
  if (!auth?.permissions?.[key]) throw new AppError(message || 'Permission tidak tersedia.', { statusCode: 403, code: 'PERMISSION_DENIED' });
}

function cleanFolderName(value) {
  return String(value || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}
function cleanDescription(value) { return String(value || '').trim().slice(0, 1000); }

async function resolveDivision(auth, requestedDivisionId) {
  let id = String(requestedDivisionId || '').trim();
  if (auth.user.role !== 'SUPER_ADMIN') {
    if (!auth.user.division_id) throw new AppError('User belum mempunyai divisi.', { statusCode: 403, code: 'DIVISION_REQUIRED' });
    if (id && id !== auth.user.division_id) throw new AppError('Anda tidak mempunyai akses ke divisi tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
    id = auth.user.division_id;
  }
  if (!id) throw new AppError('Pilih divisi terlebih dahulu.', { statusCode: 400, code: 'DIVISION_REQUIRED' });
  const division = await findActiveDivisionById(id);
  if (!division) throw new AppError('Divisi tidak ditemukan.', { statusCode: 404, code: 'DIVISION_NOT_FOUND' });
  if (!division.google_drive_folder_id) throw new AppError('Google Drive folder divisi belum dikonfigurasi.', { statusCode: 409, code: 'DRIVE_FOLDER_MISSING' });
  return division;
}

function buildMap(rows) { return new Map(rows.map((row) => [row.id, row])); }

async function assertFolderChainUnlocked(auth, folderId, rows = null) {
  if (!folderId) return;
  const folders = rows || await listActiveFoldersForDivision((await findFolderById(folderId))?.division_id);
  const map = buildMap(folders);
  const unlockRows = await getActiveFolderUnlocks(auth.sessionId);
  const unlockMap = new Map(unlockRows.map((row) => [row.folder_id, Number(row.password_version || 0)]));
  let current = map.get(folderId);
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.password_enabled && unlockMap.get(current.id) !== Number(current.password_version || 0)) {
      throw new AppError(`Folder "${current.name}" dilindungi password.`, {
        statusCode: 423,
        code: 'FOLDER_LOCKED',
        details: { folderId: current.id, folderName: current.name, passwordVersion: Number(current.password_version || 0) }
      });
    }
    current = current.parent_folder_id ? map.get(current.parent_folder_id) : null;
  }
}

async function assertFolderInDivision(auth, folderId, divisionId, { unlocked = true } = {}) {
  const folder = await findFolderById(folderId);
  if (!folder || folder.division_id !== divisionId) throw new AppError('Folder tidak ditemukan pada divisi ini.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  if (unlocked) await assertFolderChainUnlocked(auth, folder.id);
  return folder;
}

function canManagePassword(auth, folder) {
  if (['SUPER_ADMIN', 'DIVISION_ADMIN'].includes(auth.user.role)) return true;
  return Boolean(auth.permissions?.can_create_folder) && String(folder.created_by_user_id || '') === String(auth.user.id || '');
}

function isDescendant(rows, sourceId, targetId) {
  const map = buildMap(rows);
  let cur = map.get(targetId);
  let guard = 0;
  while (cur && guard++ < 100) {
    if (cur.id === sourceId) return true;
    cur = cur.parent_folder_id ? map.get(cur.parent_folder_id) : null;
  }
  return false;
}

function driveError(error) {
  const status = Number(error?.response?.status || error?.code || 0);
  if (status === 401 || status === 403) {
    return new AppError('Google Drive menolak akses. Jalankan ulang npm run drive:auth menggunakan akun pemilik arsip.', { statusCode: 503, code: 'GOOGLE_DRIVE_AUTH_FAILED' });
  }
  return error;
}

export async function createFolder({ auth, payload, ipAddress, userAgent }) {
  requirePermission(auth, 'can_create_folder', 'Anda tidak mempunyai izin membuat folder.');
  const division = await resolveDivision(auth, payload?.divisionId);
  const parentFolderId = String(payload?.parentFolderId || '').trim() || null;
  const allFolders = await listActiveFoldersForDivision(division.id);
  let parent = null;
  if (parentFolderId) {
    parent = await assertFolderInDivision(auth, parentFolderId, division.id);
  }
  const name = cleanFolderName(payload?.name);
  if (!name) throw new AppError('Nama folder wajib diisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (await siblingFolderExists({ divisionId: division.id, parentFolderId, name })) throw new AppError('Folder dengan nama yang sama sudah tersedia.', { statusCode: 409, code: 'DUPLICATE_FOLDER' });

  const plainPassword = String(payload?.password || '');
  if (plainPassword) {
    const validation = validateFolderPassword(plainPassword);
    if (validation) throw new AppError(validation, { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const parentDriveId = parent?.google_drive_folder_id || division.google_drive_folder_id;
  let driveFolder = null;
  try {
    driveFolder = await createDriveFolder({ name, parentDriveFolderId: parentDriveId });
    const passwordHash = plainPassword ? await makeFolderPasswordHash(plainPassword) : null;
    const now = new Date().toISOString();
    const record = await insertFolderRecord({
      name,
      google_drive_folder_id: driveFolder.id,
      parent_folder_id: parentFolderId,
      division_id: division.id,
      description: cleanDescription(payload?.description),
      created_by_user_id: auth.user.id,
      created_by_username_snapshot: auth.user.username,
      status: 'ACTIVE',
      password_enabled: Boolean(plainPassword),
      password_hash: passwordHash,
      password_algorithm: plainPassword ? 'bcrypt' : null,
      password_salt: null,
      password_version: plainPassword ? 1 : 0,
      password_updated_at: plainPassword ? now : null,
      password_updated_by_user_id: plainPassword ? auth.user.id : null,
      password_updated_by_snapshot: plainPassword ? auth.user.username : null
    });
    if (plainPassword) {
      await upsertFolderUnlock({ authSessionId: auth.sessionId, folderId: record.id, passwordVersion: 1, expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString() });
    }
    void writeAuditSafe({ user: auth.user, action: 'CREATE_FOLDER', objectType: 'FOLDER', objectId: record.id, objectName: name, detail: plainPassword ? 'Folder dibuat dengan password.' : 'Folder dibuat.', ipAddress, userAgent });
    return { id: record.id, name: record.name, passwordProtected: Boolean(record.password_enabled) };
  } catch (error) {
    if (driveFolder?.id) {
      try {
        const { getGoogleDrive } = await import('./googleDrive.service.js');
        await getGoogleDrive().files.update({ fileId: driveFolder.id, requestBody: { trashed: true }, supportsAllDrives: true });
      } catch (_) {}
    }
    throw driveError(error);
  }
}

export async function renameFolder({ auth, folderId, newName, ipAddress, userAgent }) {
  requirePermission(auth, 'can_rename', 'Anda tidak mempunyai izin rename folder.');
  const folder = await findFolderById(folderId);
  if (!folder) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  const division = await resolveDivision(auth, folder.division_id);
  await assertFolderChainUnlocked(auth, folder.id);
  const name = cleanFolderName(newName);
  if (!name) throw new AppError('Nama folder tidak valid.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (await siblingFolderExists({ divisionId: division.id, parentFolderId: folder.parent_folder_id, name, excludeFolderId: folder.id })) throw new AppError('Folder dengan nama yang sama sudah tersedia.', { statusCode: 409, code: 'DUPLICATE_FOLDER' });
  const oldName = folder.name;
  try {
    await renameDriveFolder(folder.google_drive_folder_id, name);
    await updateFolderRecord(folder.id, { name, updated_at: new Date().toISOString() });
  } catch (error) {
    try { await renameDriveFolder(folder.google_drive_folder_id, oldName); } catch (_) {}
    throw driveError(error);
  }
  void writeAuditSafe({ user: auth.user, action: 'RENAME_FOLDER', objectType: 'FOLDER', objectId: folder.id, objectName: name, detail: `Folder diubah nama dari ${oldName}.`, ipAddress, userAgent });
  return { id: folder.id, name };
}

export async function moveFolder({ auth, folderId, targetParentFolderId, ipAddress, userAgent }) {
  requirePermission(auth, 'can_move', 'Anda tidak mempunyai izin memindahkan folder.');
  const folder = await findFolderById(folderId);
  if (!folder) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  const division = await resolveDivision(auth, folder.division_id);
  const targetId = String(targetParentFolderId || '').trim() || null;
  if (targetId === folder.id) throw new AppError('Folder tidak dapat dipindahkan ke dirinya sendiri.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  const allFolders = await listActiveFoldersForDivision(division.id);
  await assertFolderChainUnlocked(auth, folder.id, allFolders);
  let target = null;
  if (targetId) {
    target = await assertFolderInDivision(auth, targetId, division.id);
    if (isDescendant(allFolders, folder.id, targetId)) throw new AppError('Folder tidak dapat dipindahkan ke subfoldernya sendiri.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (await siblingFolderExists({ divisionId: division.id, parentFolderId: targetId, name: folder.name, excludeFolderId: folder.id })) throw new AppError('Di lokasi tujuan sudah ada folder dengan nama yang sama.', { statusCode: 409, code: 'DUPLICATE_FOLDER' });
  const targetDriveId = target?.google_drive_folder_id || division.google_drive_folder_id;
  const oldParentId = folder.parent_folder_id || null;
  const oldParent = oldParentId ? allFolders.find((row) => row.id === oldParentId) : null;
  const oldDriveParentId = oldParent?.google_drive_folder_id || division.google_drive_folder_id;
  try {
    await moveDriveFolder(folder.google_drive_folder_id, targetDriveId);
    await updateFolderRecord(folder.id, { parent_folder_id: targetId, updated_at: new Date().toISOString() });
  } catch (error) {
    try { await moveDriveFolder(folder.google_drive_folder_id, oldDriveParentId); } catch (_) {}
    throw driveError(error);
  }
  void writeAuditSafe({ user: auth.user, action: 'MOVE_FOLDER', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Folder dipindahkan.', ipAddress, userAgent });
  return { id: folder.id, parentFolderId: targetId };
}

export async function deleteFolder({ auth, folderId, ipAddress, userAgent }) {
  requirePermission(auth, 'can_delete', 'Anda tidak mempunyai izin menghapus folder.');
  const folder = await findFolderById(folderId);
  if (!folder) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  await resolveDivision(auth, folder.division_id);
  await assertFolderChainUnlocked(auth, folder.id);
  const children = await countActiveChildren(folder.id);
  if (children.folderCount || children.documentCount) throw new AppError('Folder masih berisi dokumen/subfolder. Kosongkan folder sebelum menghapus.', { statusCode: 409, code: 'FOLDER_NOT_EMPTY' });
  const now = new Date().toISOString();
  await updateFolderRecord(folder.id, {
    status: 'DELETED',
    original_parent_folder_id: folder.parent_folder_id || null,
    deleted_by_user_id: auth.user.id,
    deleted_by_username_snapshot: auth.user.username,
    deleted_at: now,
    updated_at: now
  });
  try {
    await insertRecycleFolder({ folderId: folder.id, divisionId: folder.division_id, originalParentFolderId: folder.parent_folder_id, userId: auth.user.id, username: auth.user.username });
  } catch (error) {
    await updateFolderRecord(folder.id, { status: 'ACTIVE', original_parent_folder_id: null, deleted_by_user_id: null, deleted_by_username_snapshot: null, deleted_at: null, updated_at: new Date().toISOString() });
    throw error;
  }
  await clearFolderUnlocks(folder.id);
  void writeAuditSafe({ user: auth.user, action: 'DELETE_FOLDER', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Folder dipindahkan ke Recycle Bin.', ipAddress, userAgent });
  return { id: folder.id };
}

export async function unlockFolder({ auth, folderId, password, ipAddress, userAgent }) {
  requirePermission(auth, 'can_view', 'Anda tidak mempunyai izin membuka folder.');
  const folder = await findFolderById(folderId);
  if (!folder) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  await resolveDivision(auth, folder.division_id);
  if (!folder.password_enabled) return { id: folder.id, unlocked: true };

  const key = `${auth.sessionId}|${folder.id}`;
  const state = unlockFailures.get(key) || { attempts: 0, blockedUntil: 0 };
  if (state.blockedUntil > Date.now()) throw new AppError('Terlalu banyak percobaan password folder. Coba lagi beberapa menit.', { statusCode: 429, code: 'FOLDER_PASSWORD_RATE_LIMIT' });
  const ok = await verifyFolderPassword(folder, password);
  if (!ok) {
    state.attempts += 1;
    if (state.attempts >= 5) { state.blockedUntil = Date.now() + 10 * 60_000; state.attempts = 0; }
    unlockFailures.set(key, state);
    throw new AppError('Password folder salah.', { statusCode: 401, code: 'FOLDER_PASSWORD_INVALID' });
  }
  unlockFailures.delete(key);

  let version = Number(folder.password_version || 0);
  if (folder.password_algorithm !== 'bcrypt') {
    const hash = await makeFolderPasswordHash(String(password));
    version += 1;
    await updateFolderRecord(folder.id, {
      password_hash: hash,
      password_algorithm: 'bcrypt',
      password_salt: null,
      password_version: version,
      password_updated_at: new Date().toISOString(),
      password_updated_by_user_id: auth.user.id,
      password_updated_by_snapshot: auth.user.username
    });
    await clearFolderUnlocks(folder.id);
  }
  await upsertFolderUnlock({ authSessionId: auth.sessionId, folderId: folder.id, passwordVersion: version, expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString() });
  void writeAuditSafe({ user: auth.user, action: 'UNLOCK_FOLDER', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Folder dibuka dengan password.', ipAddress, userAgent });
  return { id: folder.id, unlocked: true };
}

export async function setFolderPassword({ auth, folderId, password, ipAddress, userAgent }) {
  const folder = await findFolderById(folderId);
  if (!folder) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  await resolveDivision(auth, folder.division_id);
  if (!canManagePassword(auth, folder)) throw new AppError('Anda tidak memiliki izin mengatur password folder ini.', { statusCode: 403, code: 'PERMISSION_DENIED' });
  const validation = validateFolderPassword(password);
  if (validation) throw new AppError(validation, { statusCode: 400, code: 'VALIDATION_ERROR' });
  const hash = await makeFolderPasswordHash(password);
  const version = Number(folder.password_version || 0) + 1;
  const now = new Date().toISOString();
  await updateFolderRecord(folder.id, {
    password_enabled: true,
    password_hash: hash,
    password_algorithm: 'bcrypt',
    password_salt: null,
    password_version: version,
    password_updated_at: now,
    password_updated_by_user_id: auth.user.id,
    password_updated_by_snapshot: auth.user.username,
    updated_at: now
  });
  await clearFolderUnlocks(folder.id);
  await upsertFolderUnlock({ authSessionId: auth.sessionId, folderId: folder.id, passwordVersion: version, expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString() });
  void writeAuditSafe({ user: auth.user, action: 'SET_FOLDER_PASSWORD', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Password folder diaktifkan/diubah.', ipAddress, userAgent });
  return { id: folder.id, passwordProtected: true, passwordVersion: version };
}

export async function removeFolderPassword({ auth, folderId, ipAddress, userAgent }) {
  const folder = await findFolderById(folderId);
  if (!folder) throw new AppError('Folder tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  await resolveDivision(auth, folder.division_id);
  if (!canManagePassword(auth, folder)) throw new AppError('Anda tidak memiliki izin mengatur password folder ini.', { statusCode: 403, code: 'PERMISSION_DENIED' });
  const version = Number(folder.password_version || 0) + 1;
  const now = new Date().toISOString();
  await updateFolderRecord(folder.id, {
    password_enabled: false,
    password_hash: null,
    password_algorithm: null,
    password_salt: null,
    password_version: version,
    password_updated_at: now,
    password_updated_by_user_id: auth.user.id,
    password_updated_by_snapshot: auth.user.username,
    updated_at: now
  });
  await clearFolderUnlocks(folder.id);
  void writeAuditSafe({ user: auth.user, action: 'REMOVE_FOLDER_PASSWORD', objectType: 'FOLDER', objectId: folder.id, objectName: folder.name, detail: 'Password folder dihapus.', ipAddress, userAgent });
  return { id: folder.id, passwordProtected: false, passwordVersion: version };
}
