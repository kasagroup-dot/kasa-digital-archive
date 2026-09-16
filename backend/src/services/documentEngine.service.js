import { AppError } from '../utils/AppError.js';
import { writeAuditSafe } from './audit.service.js';
import {
  createDriveResumableSession,
  getDriveFileMetadata,
  moveDriveFile,
  renameDriveFile,
  sendDriveResumableChunk,
  streamDriveFile
} from './googleDrive.service.js';
import {
  addFavorite,
  createUploadSession,
  favoriteExists,
  findDocumentById,
  findDocumentVersion,
  findDuplicateDocument,
  findUploadSession,
  getMaxUploadBytes,
  insertDocument,
  insertDocumentVersion,
  insertRecycleDocument,
  listDocumentVersions,
  listSiblingDocumentNames,
  removeFavorite,
  updateDocument,
  updateUploadSession
} from '../repositories/documentEngine.repository.js';
import {
  findActiveDivisionById,
  findFolderById,
  getActiveFolderUnlocks,
  listActiveFoldersForDivision
} from '../repositories/fileManager.repository.js';

const CHUNK_BYTES = 4 * 1024 * 1024;
const UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;

function requirePermission(auth, key, message) {
  if (auth?.user?.role === 'SUPER_ADMIN') return;
  if (!auth?.permissions?.[key]) throw new AppError(message || 'Akses ditolak.', { statusCode: 403, code: 'PERMISSION_DENIED' });
}

function extOf(filename) {
  const text = String(filename || '').trim();
  const index = text.lastIndexOf('.');
  return index > 0 && index < text.length - 1 ? text.slice(index + 1).toLowerCase() : '';
}

function baseName(filename) {
  const text = String(filename || '').trim();
  const index = text.lastIndexOf('.');
  return index > 0 ? text.slice(0, index) : text;
}

function classifyFile(filename, mimeType = '') {
  const ext = extOf(filename);
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF';
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'IMAGE';
  if (mime.startsWith('video/') || ['mp4','mov','mkv','avi','webm','m4v'].includes(ext)) return 'VIDEO';
  if (mime.startsWith('audio/') || ['mp3','wav','m4a','aac','ogg','flac'].includes(ext)) return 'AUDIO';
  if (['xls','xlsx','xlsm','csv','ods'].includes(ext)) return 'EXCEL';
  if (['doc','docx','odt','rtf'].includes(ext)) return 'WORD';
  if (['ppt','pptx','odp'].includes(ext)) return 'POWERPOINT';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return 'ARCHIVE';
  if (['txt','md','json','xml','log'].includes(ext) || mime.startsWith('text/')) return 'TEXT';
  return (ext || 'FILE').toUpperCase();
}

function cleanFilename(value) {
  const text = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/\s+/g, ' ');
  if (!text) throw new AppError('Nama file tidak valid.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  return text.slice(0, 240);
}

function cleanDocumentName(value, fallback) {
  const text = String(value || fallback || '').trim().replace(/\s+/g, ' ');
  if (!text) throw new AppError('Nama dokumen wajib diisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  return text.slice(0, 255);
}

function uniqueFilename(filename, existingNames) {
  const names = new Set((existingNames || []).map((name) => String(name).toLowerCase()));
  if (!names.has(filename.toLowerCase())) return filename;
  const ext = extOf(filename);
  const base = ext ? filename.slice(0, -(ext.length + 1)) : filename;
  for (let i = 1; i < 10000; i += 1) {
    const candidate = `${base} (${i})${ext ? `.${ext}` : ''}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
  throw new AppError('Tidak dapat membuat nama file unik.', { statusCode: 409, code: 'FILENAME_CONFLICT' });
}

async function resolveDivision(auth, requestedDivisionId) {
  let divisionId = String(requestedDivisionId || '').trim();
  if (auth.user.role !== 'SUPER_ADMIN') {
    if (!auth.user.division_id) throw new AppError('User belum mempunyai divisi.', { statusCode: 403, code: 'DIVISION_REQUIRED' });
    if (divisionId && divisionId !== auth.user.division_id) throw new AppError('Anda tidak mempunyai akses ke divisi tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
    divisionId = auth.user.division_id;
  }
  if (!divisionId) throw new AppError('Divisi wajib dipilih.', { statusCode: 400, code: 'DIVISION_REQUIRED' });
  const division = await findActiveDivisionById(divisionId);
  if (!division) throw new AppError('Divisi tidak ditemukan.', { statusCode: 404, code: 'DIVISION_NOT_FOUND' });
  return division;
}

async function assertFolderUnlocked(auth, divisionId, folderId) {
  if (!folderId) return null;
  const folder = await findFolderById(folderId);
  if (!folder || folder.division_id !== divisionId) throw new AppError('Folder tujuan tidak ditemukan.', { statusCode: 404, code: 'FOLDER_NOT_FOUND' });
  const [allFolders, unlocks] = await Promise.all([listActiveFoldersForDivision(divisionId), getActiveFolderUnlocks(auth.sessionId)]);
  const map = new Map(allFolders.map((row) => [row.id, row]));
  const unlockMap = new Map(unlocks.map((row) => [row.folder_id, Number(row.password_version || 0)]));
  let current = map.get(folderId);
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.password_enabled && unlockMap.get(current.id) !== Number(current.password_version || 0)) {
      throw new AppError('Folder memerlukan password sebelum dapat diakses.', { statusCode: 423, code: 'FOLDER_LOCKED', details: { folderId: current.id, folderName: current.name } });
    }
    current = current.parent_folder_id ? map.get(current.parent_folder_id) : null;
  }
  return folder;
}

async function assertDocumentAccess(auth, document, permissionKey = 'can_view') {
  requirePermission(auth, permissionKey, 'Anda tidak mempunyai izin untuk aksi dokumen ini.');
  if (!document) throw new AppError('Dokumen tidak ditemukan.', { statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
  if (auth.user.role !== 'SUPER_ADMIN' && document.division_id !== auth.user.division_id) {
    throw new AppError('Anda tidak mempunyai akses ke dokumen tersebut.', { statusCode: 403, code: 'DIVISION_ACCESS_DENIED' });
  }
  await assertFolderUnlocked(auth, document.division_id, document.folder_id);
  return document;
}

function previewKind(document) {
  const mime = String(document.mime_type || '').toLowerCase();
  const ext = String(document.extension || '').toLowerCase();
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (['xls','xlsx','xlsm','csv','doc','docx','ppt','pptx'].includes(ext)) return 'office';
  if (mime.startsWith('text/') || ['txt','md','json','xml','log'].includes(ext)) return 'text';
  return 'drive';
}

function publicDocument(document) {
  return {
    id: document.id,
    documentName: document.document_name,
    originalFilename: document.original_filename,
    divisionId: document.division_id,
    folderId: document.folder_id || null,
    driveUrl: document.drive_url || '',
    googleDriveFileId: document.google_drive_file_id,
    fileType: document.file_type || '',
    mimeType: document.mime_type || '',
    extension: document.extension || '',
    fileSize: Number(document.file_size || 0),
    version: Number(document.current_version || 1),
    documentNumber: document.document_number || '',
    documentDate: document.document_date || null,
    category: document.category || '',
    tags: Array.isArray(document.tags) ? document.tags : [],
    description: document.description || '',
    uploadedBy: document.uploaded_by_username_snapshot || '',
    uploadedAt: document.uploaded_at,
    updatedAt: document.updated_at
  };
}

export async function checkUploadDuplicates({ auth, divisionId, folderId = '', names = [] }) {
  requirePermission(auth, 'can_upload', 'Anda tidak mempunyai izin upload.');
  const division = await resolveDivision(auth, divisionId);
  const normalizedFolderId = String(folderId || '').trim() || null;
  await assertFolderUnlocked(auth, division.id, normalizedFolderId);
  const output = [];
  for (const raw of (Array.isArray(names) ? names.slice(0, 50) : [])) {
    const name = cleanFilename(raw);
    const found = await findDuplicateDocument({ divisionId: division.id, folderId: normalizedFolderId, filename: name });
    if (found) output.push({ name, documentId: found.id, version: Number(found.current_version || 1) });
  }
  return { duplicates: output };
}

export async function startResumableUpload({ auth, payload, ipAddress, userAgent }) {
  requirePermission(auth, 'can_upload', 'Anda tidak mempunyai izin upload.');
  const division = await resolveDivision(auth, payload?.divisionId);
  const folderId = String(payload?.folderId || '').trim() || null;
  const folder = await assertFolderUnlocked(auth, division.id, folderId);
  const requestedFilename = cleanFilename(payload?.filename);
  const mimeType = String(payload?.mimeType || 'application/octet-stream').slice(0, 255);
  const fileSize = Number(payload?.fileSize || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) throw new AppError('Ukuran file tidak valid.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  const maxBytes = await getMaxUploadBytes();
  if (fileSize > maxBytes) throw new AppError(`File melebihi batas upload ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`, { statusCode: 413, code: 'UPLOAD_TOO_LARGE' });

  const duplicate = await findDuplicateDocument({ divisionId: division.id, folderId, filename: requestedFilename });
  const duplicateAction = String(payload?.duplicateAction || 'none').toLowerCase();
  if (duplicate && !['version','autorename'].includes(duplicateAction)) {
    throw new AppError('File dengan nama yang sama sudah tersedia.', { statusCode: 409, code: 'DUPLICATE_FILE', details: { duplicate: { documentId: duplicate.id, name: requestedFilename, version: duplicate.current_version } } });
  }

  let finalFilename = requestedFilename;
  if (duplicate && duplicateAction === 'autorename') {
    finalFilename = uniqueFilename(requestedFilename, await listSiblingDocumentNames({ divisionId: division.id, folderId }));
  }
  const documentName = cleanDocumentName(payload?.documentName, baseName(finalFilename));
  const targetDriveFolderId = folder?.google_drive_folder_id || division.google_drive_folder_id;
  if (!targetDriveFolderId) throw new AppError('Google Drive folder tujuan belum terhubung.', { statusCode: 500, code: 'DRIVE_TARGET_MISSING' });

  const sessionUrl = await createDriveResumableSession({ name: finalFilename, mimeType, fileSize, parentDriveFolderId: targetDriveFolderId });
  const now = new Date();
  const session = await createUploadSession({
    user_id: auth.user.id,
    division_id: division.id,
    folder_id: folderId,
    client_upload_id: String(payload?.clientUploadId || '').slice(0, 150) || null,
    original_filename: finalFilename,
    document_name: documentName,
    mime_type: mimeType,
    file_size: fileSize,
    bytes_uploaded: 0,
    duplicate_action: duplicate ? duplicateAction : 'none',
    duplicate_document_id: duplicate?.id || null,
    google_drive_target_id: targetDriveFolderId,
    drive_resumable_uri: sessionUrl,
    status: 'INITIATED',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + UPLOAD_TTL_MS).toISOString()
  });
  void writeAuditSafe({ user: auth.user, action: 'UPLOAD_STARTED', objectType: 'UPLOAD', objectId: session.id, objectName: finalFilename, detail: `Resumable upload dimulai (${fileSize} bytes).`, ipAddress, userAgent });
  return { uploadId: session.id, filename: finalFilename, documentName, chunkSize: CHUNK_BYTES, maxUploadBytes: maxBytes, duplicateAction: session.duplicate_action };
}

async function finalizeUpload({ auth, session, driveFile, ipAddress, userAgent }) {
  const now = new Date().toISOString();
  const filename = session.original_filename;
  const ext = extOf(filename);
  const fileType = classifyFile(filename, session.mime_type || driveFile.mimeType);
  const common = {
    google_drive_file_id: driveFile.id,
    drive_url: driveFile.webViewLink || `https://drive.google.com/file/d/${driveFile.id}/view`,
    original_filename: filename,
    document_name: session.document_name,
    mime_type: session.mime_type || driveFile.mimeType || 'application/octet-stream',
    extension: ext,
    file_type: fileType,
    file_size: Number(driveFile.size || session.file_size || 0),
    folder_id: session.folder_id || null,
    division_id: session.division_id,
    uploaded_by_user_id: auth.user.id,
    uploaded_by_username_snapshot: auth.user.username,
    updated_at: now
  };

  let document;
  if (session.duplicate_document_id && session.duplicate_action === 'version') {
    const old = await findDocumentById(session.duplicate_document_id);
    await assertDocumentAccess(auth, old, 'can_upload');
    const oldVersion = Number(old.current_version || 1);
    await insertDocumentVersion({
      document_id: old.id,
      version_number: oldVersion,
      google_drive_file_id: old.google_drive_file_id,
      drive_url: old.drive_url || null,
      original_filename: old.original_filename,
      mime_type: old.mime_type || null,
      extension: old.extension || null,
      file_size: Number(old.file_size || 0),
      uploaded_by_user_id: old.uploaded_by_user_id || null,
      uploaded_by_username_snapshot: old.uploaded_by_username_snapshot || null,
      uploaded_at: old.uploaded_at || now,
      description: 'Versi terdahulu sebelum upload versi baru'
    });
    document = await updateDocument(old.id, { ...common, current_version: oldVersion + 1, uploaded_at: now, status: 'ACTIVE' });
    void writeAuditSafe({ user: auth.user, action: 'UPLOAD_NEW_VERSION', objectType: 'DOCUMENT', objectId: old.id, objectName: filename, detail: `Versi ${oldVersion + 1} diupload.`, ipAddress, userAgent });
  } else {
    document = await insertDocument({ ...common, current_version: 1, uploaded_at: now, status: 'ACTIVE' });
    void writeAuditSafe({ user: auth.user, action: 'UPLOAD_DOCUMENT', objectType: 'DOCUMENT', objectId: document.id, objectName: filename, detail: 'Dokumen berhasil diupload.', ipAddress, userAgent });
  }
  await updateUploadSession(session.id, { status: 'COMPLETED', bytes_uploaded: session.file_size, completed_document_id: document.id, updated_at: now });
  return publicDocument(document);
}

export async function uploadChunk({ auth, uploadId, offset, buffer, ipAddress, userAgent }) {
  requirePermission(auth, 'can_upload', 'Anda tidak mempunyai izin upload.');
  const session = await findUploadSession(uploadId);
  if (!session || session.user_id !== auth.user.id) throw new AppError('Upload session tidak ditemukan.', { statusCode: 404, code: 'UPLOAD_SESSION_NOT_FOUND' });
  if (!['INITIATED','UPLOADING'].includes(session.status)) throw new AppError(`Upload session berstatus ${session.status}.`, { statusCode: 409, code: 'UPLOAD_SESSION_INVALID' });
  if (new Date(session.expires_at).getTime() <= Date.now()) throw new AppError('Upload session sudah kedaluwarsa.', { statusCode: 410, code: 'UPLOAD_SESSION_EXPIRED' });
  await resolveDivision(auth, session.division_id);
  await assertFolderUnlocked(auth, session.division_id, session.folder_id);
  const expectedOffset = Number(session.bytes_uploaded || 0);
  const givenOffset = Number(offset || 0);
  if (givenOffset !== expectedOffset) throw new AppError(`Offset upload tidak sesuai. Server menunggu byte ${expectedOffset}.`, { statusCode: 409, code: 'UPLOAD_OFFSET_MISMATCH', details: { expectedOffset } });
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new AppError('Chunk upload kosong.', { statusCode: 400, code: 'UPLOAD_CHUNK_EMPTY' });
  if (buffer.length > CHUNK_BYTES + 1024) throw new AppError('Chunk upload terlalu besar.', { statusCode: 413, code: 'UPLOAD_CHUNK_TOO_LARGE' });
  const end = givenOffset + buffer.length - 1;
  if (end >= Number(session.file_size)) throw new AppError('Chunk melebihi ukuran file.', { statusCode: 400, code: 'UPLOAD_RANGE_INVALID' });

  await updateUploadSession(session.id, { status: 'UPLOADING', updated_at: new Date().toISOString() });
  try {
    const result = await sendDriveResumableChunk({ sessionUrl: session.drive_resumable_uri, buffer, offset: givenOffset, totalSize: Number(session.file_size), mimeType: session.mime_type });
    const nextOffset = end + 1;
    if (!result.complete) {
      await updateUploadSession(session.id, { bytes_uploaded: nextOffset, updated_at: new Date().toISOString() });
      return { uploadId: session.id, complete: false, bytesUploaded: nextOffset, totalBytes: Number(session.file_size) };
    }
    const document = await finalizeUpload({ auth, session: { ...session, bytes_uploaded: nextOffset }, driveFile: result.file, ipAddress, userAgent });
    return { uploadId: session.id, complete: true, bytesUploaded: Number(session.file_size), totalBytes: Number(session.file_size), document };
  } catch (error) {
    await updateUploadSession(session.id, { status: 'FAILED', error_message: String(error?.message || error).slice(0, 1000), updated_at: new Date().toISOString() }).catch(() => {});
    throw error;
  }
}

export async function cancelUpload({ auth, uploadId }) {
  const session = await findUploadSession(uploadId);
  if (!session || session.user_id !== auth.user.id) return { cancelled: true };
  if (!['COMPLETED','CANCELLED'].includes(session.status)) await updateUploadSession(session.id, { status: 'CANCELLED', updated_at: new Date().toISOString() });
  return { cancelled: true };
}

export async function getPreviewInfo({ auth, documentId }) {
  const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_preview');
  const metadata = await getDriveFileMetadata(document.google_drive_file_id).catch(() => null);
  return {
    ...publicDocument(document),
    previewKind: previewKind(document),
    previewUrl: `https://drive.google.com/file/d/${document.google_drive_file_id}/preview`,
    openUrl: metadata?.webViewLink || document.drive_url || `https://drive.google.com/file/d/${document.google_drive_file_id}/view`
  };
}

export async function getDownloadStream({ auth, documentId, versionId = null }) {
  let driveFileId;
  let filename;
  if (versionId) {
    const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_download');
    const version = await findDocumentVersion(documentId, versionId);
    if (!version) throw new AppError('Versi dokumen tidak ditemukan.', { statusCode: 404, code: 'VERSION_NOT_FOUND' });
    driveFileId = version.google_drive_file_id;
    filename = version.original_filename || document.original_filename;
  } else {
    const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_download');
    driveFileId = document.google_drive_file_id;
    filename = document.original_filename;
  }
  const stream = await streamDriveFile(driveFileId);
  return { ...stream, filename };
}

export async function renameDocument({ auth, documentId, documentName, ipAddress, userAgent }) {
  const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_rename');
  const newDocumentName = cleanDocumentName(documentName, document.document_name);
  const ext = document.extension || extOf(document.original_filename);
  const newFilename = cleanFilename(`${newDocumentName}${ext ? `.${ext}` : ''}`);
  const duplicate = await findDuplicateDocument({ divisionId: document.division_id, folderId: document.folder_id, filename: newFilename, excludeDocumentId: document.id });
  if (duplicate) throw new AppError('Nama file tersebut sudah digunakan di folder yang sama.', { statusCode: 409, code: 'DUPLICATE_FILE' });
  await renameDriveFile(document.google_drive_file_id, newFilename);
  const updated = await updateDocument(document.id, { document_name: newDocumentName, original_filename: newFilename, updated_at: new Date().toISOString() });
  void writeAuditSafe({ user: auth.user, action: 'RENAME_DOCUMENT', objectType: 'DOCUMENT', objectId: document.id, objectName: newFilename, detail: `Dokumen diubah dari ${document.original_filename}.`, ipAddress, userAgent });
  return publicDocument(updated);
}

export async function moveDocument({ auth, documentId, targetFolderId = '', ipAddress, userAgent }) {
  const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_move');
  const targetId = String(targetFolderId || '').trim() || null;
  const division = await resolveDivision(auth, document.division_id);
  const targetFolder = await assertFolderUnlocked(auth, division.id, targetId);
  const targetDriveFolderId = targetFolder?.google_drive_folder_id || division.google_drive_folder_id;
  try {
    await moveDriveFile(document.google_drive_file_id, targetDriveFolderId);
  } catch (error) {
    const detail = String(error?.response?.data?.error?.message || error?.response?.data?.error_description || error?.message || error || 'unknown_error').slice(0, 500);
    throw new AppError(`Google Drive gagal memindahkan dokumen: ${detail}`, {
      statusCode: 502,
      code: 'GOOGLE_DRIVE_MOVE_FAILED'
    });
  }
  const updated = await updateDocument(document.id, { folder_id: targetId, updated_at: new Date().toISOString() });
  void writeAuditSafe({ user: auth.user, action: 'MOVE_DOCUMENT', objectType: 'DOCUMENT', objectId: document.id, objectName: document.original_filename, detail: 'Dokumen dipindahkan.', ipAddress, userAgent });
  return publicDocument(updated);
}

export async function deleteDocument({ auth, documentId, ipAddress, userAgent }) {
  const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_delete');
  const now = new Date().toISOString();
  await updateDocument(document.id, { status: 'DELETED', original_folder_id: document.folder_id || null, deleted_by_user_id: auth.user.id, deleted_by_username_snapshot: auth.user.username, deleted_at: now, updated_at: now });
  await insertRecycleDocument({ documentId: document.id, divisionId: document.division_id, originalFolderId: document.folder_id, userId: auth.user.id, username: auth.user.username });
  void writeAuditSafe({ user: auth.user, action: 'DELETE_DOCUMENT', objectType: 'DOCUMENT', objectId: document.id, objectName: document.original_filename, detail: 'Dokumen dipindahkan ke Recycle Bin.', ipAddress, userAgent });
  return { id: document.id, deleted: true };
}

export async function toggleFavorite({ auth, documentId }) {
  const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_view');
  const existing = await favoriteExists(auth.user.id, document.id);
  if (existing) {
    await removeFavorite(auth.user.id, document.id);
    return { favorite: false };
  }
  await addFavorite(auth.user.id, document.id);
  return { favorite: true };
}

export async function getVersionHistory({ auth, documentId }) {
  const document = await assertDocumentAccess(auth, await findDocumentById(documentId), 'can_view');
  const history = await listDocumentVersions(document.id);
  return {
    current: {
      id: 'current', versionNumber: Number(document.current_version || 1), current: true,
      filename: document.original_filename, fileSize: Number(document.file_size || 0), uploadedBy: document.uploaded_by_username_snapshot || '', uploadedAt: document.uploaded_at,
      previewUrl: `https://drive.google.com/file/d/${document.google_drive_file_id}/preview`, driveUrl: document.drive_url || `https://drive.google.com/file/d/${document.google_drive_file_id}/view`
    },
    history: history.map((row) => ({
      id: row.id, versionNumber: Number(row.version_number || 1), current: false,
      filename: row.original_filename || document.original_filename, fileSize: Number(row.file_size || 0), uploadedBy: row.uploaded_by_username_snapshot || '', uploadedAt: row.uploaded_at,
      description: row.description || '', previewUrl: `https://drive.google.com/file/d/${row.google_drive_file_id}/preview`, driveUrl: row.drive_url || `https://drive.google.com/file/d/${row.google_drive_file_id}/view`
    }))
  };
}
