import { google } from 'googleapis';
import { env, assertGoogleDriveEnv } from '../config/env.js';

let oauthClient = null;
let driveClient = null;

export function getGoogleOAuthClient() {
  assertGoogleDriveEnv();
  if (!oauthClient) {
    oauthClient = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleOauthRedirectUri
    );
    oauthClient.setCredentials({ refresh_token: env.googleRefreshToken });
  }
  return oauthClient;
}

export function getGoogleDrive() {
  if (!driveClient) driveClient = google.drive({ version: 'v3', auth: getGoogleOAuthClient() });
  return driveClient;
}

export async function getDriveFolderMetadata(folderId) {
  const drive = getGoogleDrive();
  const { data } = await drive.files.get({
    fileId: String(folderId),
    fields: 'id,name,mimeType,parents,trashed,webViewLink',
    supportsAllDrives: true
  });
  return data;
}

export async function createDriveFolder({ name, parentDriveFolderId }) {
  const drive = getGoogleDrive();
  const { data } = await drive.files.create({
    requestBody: {
      name: String(name),
      mimeType: 'application/vnd.google-apps.folder',
      parents: [String(parentDriveFolderId)]
    },
    fields: 'id,name,parents,webViewLink',
    supportsAllDrives: true
  });
  return data;
}

export async function renameDriveFolder(folderId, newName) {
  const drive = getGoogleDrive();
  const { data } = await drive.files.update({
    fileId: String(folderId),
    requestBody: { name: String(newName) },
    fields: 'id,name,parents,webViewLink',
    supportsAllDrives: true
  });
  return data;
}

export async function moveDriveFolder(folderId, newParentDriveFolderId) {
  const drive = getGoogleDrive();
  const { data: current } = await drive.files.get({
    fileId: String(folderId),
    fields: 'id,parents',
    supportsAllDrives: true
  });
  const currentParents = Array.isArray(current.parents) ? current.parents : [];
  const target = String(newParentDriveFolderId);
  if (currentParents.length === 1 && currentParents[0] === target) return current;

  const { data } = await drive.files.update({
    fileId: String(folderId),
    addParents: target,
    removeParents: currentParents.join(',') || undefined,
    fields: 'id,name,parents,webViewLink',
    supportsAllDrives: true
  });
  return data;
}

export async function trashDriveItem(fileId, trashed = true) {
  const drive = getGoogleDrive();
  const { data } = await drive.files.update({
    fileId: String(fileId),
    requestBody: { trashed: Boolean(trashed) },
    fields: 'id,name,trashed,parents',
    supportsAllDrives: true
  });
  return data;
}

export async function getDriveFileMetadata(fileId) {
  const drive = getGoogleDrive();
  const { data } = await drive.files.get({
    fileId: String(fileId),
    fields: 'id,name,mimeType,size,parents,trashed,webViewLink,modifiedTime',
    supportsAllDrives: true
  });
  return data;
}

export async function renameDriveFile(fileId, newName) {
  const drive = getGoogleDrive();
  const { data } = await drive.files.update({
    fileId: String(fileId),
    requestBody: { name: String(newName) },
    fields: 'id,name,mimeType,size,parents,webViewLink',
    supportsAllDrives: true
  });
  return data;
}

export async function moveDriveFile(fileId, newParentDriveFolderId) {
  const drive = getGoogleDrive();
  const { data: current } = await drive.files.get({
    fileId: String(fileId),
    fields: 'id,parents',
    supportsAllDrives: true
  });
  const parents = Array.isArray(current.parents) ? current.parents : [];
  const target = String(newParentDriveFolderId);
  if (parents.length === 1 && parents[0] === target) return current;
  const { data } = await drive.files.update({
    fileId: String(fileId),
    addParents: target,
    removeParents: parents.join(',') || undefined,
    fields: 'id,name,mimeType,size,parents,webViewLink',
    supportsAllDrives: true
  });
  return data;
}

async function accessToken_() {
  try {
    const result = await getGoogleOAuthClient().getAccessToken();
    const token = typeof result === 'string' ? result : result?.token;
    if (!token) throw new Error('Google OAuth access token tidak tersedia.');
    return token;
  } catch (error) {
    const detail = String(error?.response?.data?.error_description || error?.response?.data?.error?.message || error?.message || error || 'unknown_error').slice(0, 500);
    const wrapped = new Error(`Google OAuth gagal memperoleh access token: ${detail}`);
    wrapped.code = 'GOOGLE_OAUTH_TOKEN_FAILED';
    wrapped.statusCode = 503;
    wrapped.isOperational = true;
    throw wrapped;
  }
}

export async function createDriveResumableSession({ name, mimeType, fileSize, parentDriveFolderId }) {
  const token = await accessToken_();
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,parents,webViewLink';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': String(mimeType || 'application/octet-stream'),
      'X-Upload-Content-Length': String(Number(fileSize || 0))
    },
    body: JSON.stringify({
      name: String(name),
      mimeType: String(mimeType || 'application/octet-stream'),
      parents: [String(parentDriveFolderId)]
    })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Drive gagal membuat resumable session (${response.status}): ${text.slice(0, 500)}`);
  }
  const location = response.headers.get('location');
  if (!location) throw new Error('Google Drive tidak mengembalikan resumable session URL.');
  return location;
}

export async function sendDriveResumableChunk({ sessionUrl, buffer, offset, totalSize, mimeType }) {
  const end = Number(offset) + buffer.length - 1;
  const response = await fetch(String(sessionUrl), {
    method: 'PUT',
    headers: {
      'Content-Type': String(mimeType || 'application/octet-stream'),
      'Content-Length': String(buffer.length),
      'Content-Range': `bytes ${Number(offset)}-${end}/${Number(totalSize)}`
    },
    body: buffer,
    redirect: 'manual'
  });
  if (response.status === 308) return { complete: false, range: response.headers.get('range') || '' };
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google Drive chunk upload gagal (${response.status}): ${text.slice(0, 500)}`);
  }
  const data = await response.json();
  return { complete: true, file: data };
}

const GOOGLE_EXPORTS = {
  'application/vnd.google-apps.document': { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
  'application/vnd.google-apps.presentation': { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' }
};

export async function streamDriveFile(fileId) {
  const drive = getGoogleDrive();
  const { data: meta } = await drive.files.get({
    fileId: String(fileId),
    fields: 'id,name,mimeType,size',
    supportsAllDrives: true
  });
  const exportSpec = GOOGLE_EXPORTS[meta.mimeType];
  if (exportSpec) {
    const response = await drive.files.export({ fileId: String(fileId), mimeType: exportSpec.mimeType }, { responseType: 'stream' });
    const name = meta.name?.toLowerCase().endsWith(`.${exportSpec.extension}`) ? meta.name : `${meta.name}.${exportSpec.extension}`;
    return { stream: response.data, mimeType: exportSpec.mimeType, size: null, filename: name };
  }
  const response = await drive.files.get({ fileId: String(fileId), alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
  return { stream: response.data, mimeType: meta.mimeType || 'application/octet-stream', size: Number(meta.size || 0) || null, filename: meta.name || 'download' };
}
