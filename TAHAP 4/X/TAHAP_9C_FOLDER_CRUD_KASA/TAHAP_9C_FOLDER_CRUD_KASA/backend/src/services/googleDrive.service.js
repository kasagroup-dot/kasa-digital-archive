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
