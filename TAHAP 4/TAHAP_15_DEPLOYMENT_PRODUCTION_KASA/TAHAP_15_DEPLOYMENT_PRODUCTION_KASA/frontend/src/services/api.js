const API_BASE = String(import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

let accessToken = '';

export function getApiBase() { return API_BASE; }
export function getAccessToken() { return accessToken; }
export function setAccessToken(token) { accessToken = String(token || ''); }

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) payload = await response.json();
  else {
    const text = await response.text();
    payload = { success: response.ok, message: text || response.statusText };
  }
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = payload?.code || 'REQUEST_FAILED';
    error.payload = payload;
    if (error.code === 'MAINTENANCE_MODE' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kasa:maintenance', {
        detail: { enabled: true, message: error.message }
      }));
    }
    throw error;
  }
  return payload;
}

async function request(path, options = {}) {
  const { timeoutMs = 15000, signal: externalSignal, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && fetchOptions.body && !(fetchOptions.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken && fetchOptions.auth !== false) headers.set('Authorization', `Bearer ${accessToken}`);

  let controller = null;
  let timeoutId = null;
  let signal = externalSignal;

  if (!signal && Number(timeoutMs) > 0) {
    controller = new AbortController();
    signal = controller.signal;
    timeoutId = window.setTimeout(() => controller.abort(), Number(timeoutMs));
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      ...(signal ? { signal } : {})
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Backend terlalu lama merespons. Silakan login ulang.');
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }

  if (response.status === 401 && fetchOptions.auth !== false && fetchOptions.retryAuth !== false) {
    try {
      await refreshSession({ timeoutMs: 6000 });
      return request(path, { ...fetchOptions, retryAuth: false, timeoutMs });
    } catch (_) {
      setAccessToken('');
    }
  }
  return parseResponse(response);
}


export async function getRuntimeStatus() {
  return request('/runtime/status', { method: 'GET', auth: false, retryAuth: false, timeoutMs: 8000 });
}

export async function login(username, password, rememberMe) {
  const result = await request('/auth/login', {
    method: 'POST', auth: false, timeoutMs: 12000,
    body: JSON.stringify({ username, password, rememberMe: Boolean(rememberMe) })
  });
  setAccessToken(result?.data?.accessToken || '');
  return result;
}

export async function refreshSession({ timeoutMs = 6000 } = {}) {
  const result = await request('/auth/refresh', {
    method: 'POST', auth: false, retryAuth: false,
    timeoutMs,
    body: JSON.stringify({})
  });
  setAccessToken(result?.data?.accessToken || '');
  return result;
}

export async function getMe() { return request('/auth/me', { method: 'GET' }); }

export async function logout() {
  try { return await request('/auth/logout', { method: 'POST', body: JSON.stringify({}) }); }
  finally { setAccessToken(''); }
}

export async function forgotPassword(username) {
  return request('/auth/forgot-password', { method: 'POST', auth: false, body: JSON.stringify({ username }) });
}

export async function getDashboardSummary(divisionId = '') {
  const qs = divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : '';
  return request(`/dashboard/summary${qs}`, { method: 'GET' });
}

export async function getFileManagerDivisions() {
  return request('/file-manager/divisions', { method: 'GET' });
}

export async function getFileManagerContents({ divisionId, folderId = '', search = '', fileType = '', category = '', sort = 'newest', page = 1, pageSize = 25 } = {}) {
  const qs = new URLSearchParams();
  if (divisionId) qs.set('divisionId', divisionId);
  if (folderId) qs.set('folderId', folderId);
  if (search) qs.set('search', search);
  if (fileType) qs.set('fileType', fileType);
  if (category) qs.set('category', category);
  if (sort) qs.set('sort', sort);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));
  return request(`/file-manager/contents?${qs.toString()}`, { method: 'GET' });
}

export async function getFileManagerTree(divisionId) {
  const qs = new URLSearchParams({ divisionId: String(divisionId || '') });
  return request(`/file-manager/tree?${qs.toString()}`, { method: 'GET' });
}

export async function getGlobalDocuments({ divisionId = '', search = '', fileType = '', category = '', sort = 'newest', page = 1, pageSize = 25 } = {}) {
  const qs = new URLSearchParams();
  if (divisionId && divisionId !== 'ALL') qs.set('divisionId', divisionId);
  if (search) qs.set('search', search);
  if (fileType && fileType !== 'ALL') qs.set('fileType', fileType);
  if (category && category !== 'ALL') qs.set('category', category);
  if (sort) qs.set('sort', sort);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));
  return request(`/documents?${qs.toString()}`, { method: 'GET' });
}

export async function getGlobalDocumentDetail(documentId) {
  return request(`/documents/${encodeURIComponent(String(documentId || ''))}`, { method: 'GET' });
}

export async function createFolder({ divisionId, parentFolderId = '', name, description = '', password = '' }) {
  return request('/file-manager/folders', {
    method: 'POST', timeoutMs: 20000,
    body: JSON.stringify({ divisionId, parentFolderId, name, description, password })
  });
}

export async function renameFolder(folderId, name) {
  return request(`/file-manager/folders/${encodeURIComponent(folderId)}/rename`, {
    method: 'PATCH', timeoutMs: 20000, body: JSON.stringify({ name })
  });
}

export async function moveFolder(folderId, targetParentFolderId = '') {
  return request(`/file-manager/folders/${encodeURIComponent(folderId)}/move`, {
    method: 'PATCH', timeoutMs: 20000, body: JSON.stringify({ targetParentFolderId })
  });
}

export async function deleteFolder(folderId) {
  return request(`/file-manager/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE', timeoutMs: 15000 });
}

export async function unlockFolder(folderId, password) {
  return request(`/file-manager/folders/${encodeURIComponent(folderId)}/unlock`, {
    method: 'POST', timeoutMs: 12000, body: JSON.stringify({ password })
  });
}

export async function setFolderPassword(folderId, password) {
  return request(`/file-manager/folders/${encodeURIComponent(folderId)}/password`, {
    method: 'PUT', timeoutMs: 15000, body: JSON.stringify({ password })
  });
}

export async function removeFolderPassword(folderId) {
  return request(`/file-manager/folders/${encodeURIComponent(folderId)}/password`, { method: 'DELETE', timeoutMs: 15000 });
}

// ============================================================================
// TAHAP 11 — DOCUMENT ENGINE
// ============================================================================
export async function checkUploadDuplicates({ divisionId, folderId = '', names = [] }) {
  return request('/uploads/preflight', {
    method: 'POST',
    timeoutMs: 12000,
    body: JSON.stringify({ divisionId, folderId, names })
  });
}

export async function startResumableUpload({ divisionId, folderId = '', file, documentName = '', duplicateAction = 'none', clientUploadId = '' }) {
  return request('/uploads/resumable/start', {
    method: 'POST',
    timeoutMs: 20000,
    body: JSON.stringify({
      divisionId,
      folderId,
      filename: file?.name || '',
      mimeType: file?.type || 'application/octet-stream',
      fileSize: Number(file?.size || 0),
      documentName,
      duplicateAction,
      clientUploadId
    })
  });
}

export async function cancelResumableUpload(uploadId) {
  if (!uploadId) return null;
  return request(`/uploads/resumable/${encodeURIComponent(uploadId)}`, { method: 'DELETE', timeoutMs: 8000 });
}

export async function uploadFileResumable({ divisionId, folderId = '', file, documentName = '', duplicateAction = 'none', progress, signal, onSession }) {
  const started = await startResumableUpload({
    divisionId,
    folderId,
    file,
    documentName,
    duplicateAction,
    clientUploadId: `${Date.now()}-${Math.random().toString(36).slice(2)}`
  });
  const session = started.data || {};
  onSession?.(session);
  const chunkSize = Number(session.chunkSize || 4 * 1024 * 1024);
  let offset = 0;
  let finalResult = null;
  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException('Upload dibatalkan.', 'AbortError');
    const end = Math.min(file.size, offset + chunkSize);
    const chunk = file.slice(offset, end);
    const result = await request(`/uploads/resumable/${encodeURIComponent(session.uploadId)}/chunk?offset=${offset}`, {
      method: 'PUT',
      timeoutMs: 0,
      signal,
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk
    });
    finalResult = result.data || {};
    offset = Number(finalResult.bytesUploaded ?? end);
    progress?.(true, offset, file.size);
  }
  return { uploadId: session.uploadId, ...finalResult };
}

export async function getDocumentPreview(documentId) {
  return request(`/document-engine/${encodeURIComponent(documentId)}/preview`, { method: 'GET', timeoutMs: 15000 });
}

async function fetchBinary(path, { retryAuth = true } = {}) {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response = await fetch(`${API_BASE}${path}`, { method: 'GET', headers, credentials: 'include' });
  if (response.status === 401 && retryAuth) {
    await refreshSession({ timeoutMs: 6000 });
    return fetchBinary(path, { retryAuth: false });
  }
  if (!response.ok) {
    let message = `Download gagal (HTTP ${response.status}).`;
    try { const payload = await response.json(); message = payload?.message || message; } catch (_) {}
    const error = new Error(message); error.status = response.status; throw error;
  }
  return response;
}

export async function downloadDocument(documentId, filename = 'download') {
  const response = await fetchBinary(`/document-engine/${encodeURIComponent(documentId)}/download`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename || 'download';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadDocumentVersion(documentId, versionId, filename = 'download') {
  const response = await fetchBinary(`/document-engine/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/download`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename || 'download';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function renameDocument(documentId, documentName) {
  return request(`/document-engine/${encodeURIComponent(documentId)}/rename`, {
    method: 'PATCH', timeoutMs: 20000, body: JSON.stringify({ documentName })
  });
}

export async function moveDocument(documentId, targetFolderId = '') {
  return request(`/document-engine/${encodeURIComponent(documentId)}/move`, {
    method: 'PATCH', timeoutMs: 20000, body: JSON.stringify({ targetFolderId })
  });
}

export async function deleteDocument(documentId) {
  return request(`/document-engine/${encodeURIComponent(documentId)}`, { method: 'DELETE', timeoutMs: 15000 });
}

export async function toggleDocumentFavorite(documentId) {
  return request(`/document-engine/${encodeURIComponent(documentId)}/favorite`, { method: 'POST', body: JSON.stringify({}) });
}

export async function getDocumentVersions(documentId) {
  return request(`/document-engine/${encodeURIComponent(documentId)}/versions`, { method: 'GET', timeoutMs: 15000 });
}

// ============================================================================
// TAHAP 12 — RECENT / FAVORITES / RECYCLE BIN / ACTIVITY LOG
// ============================================================================
export async function getRecentDocuments({ divisionId = 'ALL', search = '', limit = 30 } = {}) {
  const qs = new URLSearchParams();
  if (divisionId && divisionId !== 'ALL') qs.set('divisionId', divisionId);
  if (search) qs.set('search', search);
  qs.set('limit', String(limit));
  return request(`/operations/recent?${qs.toString()}`, { method: 'GET' });
}
export async function getFavoriteDocuments({ search = '' } = {}) {
  const qs = new URLSearchParams(); if (search) qs.set('search', search);
  return request(`/operations/favorites?${qs.toString()}`, { method: 'GET' });
}
export async function getRecycleBin(divisionId = 'ALL') {
  const qs = new URLSearchParams(); if (divisionId && divisionId !== 'ALL') qs.set('divisionId', divisionId);
  return request(`/operations/recycle?${qs.toString()}`, { method: 'GET' });
}
export async function restoreRecycleDocument(documentId) { return request(`/operations/recycle/documents/${encodeURIComponent(documentId)}/restore`, { method: 'POST', body: JSON.stringify({}) }); }
export async function permanentlyDeleteRecycleDocument(documentId) { return request(`/operations/recycle/documents/${encodeURIComponent(documentId)}/permanent`, { method: 'DELETE', timeoutMs: 20000 }); }
export async function restoreRecycleFolder(folderId) { return request(`/operations/recycle/folders/${encodeURIComponent(folderId)}/restore`, { method: 'POST', body: JSON.stringify({}) }); }
export async function permanentlyDeleteRecycleFolder(folderId) { return request(`/operations/recycle/folders/${encodeURIComponent(folderId)}/permanent`, { method: 'DELETE', timeoutMs: 20000 }); }
export async function getActivityLog({ divisionId='ALL', query='', user='', action='', dateFrom='', dateTo='', page=1, pageSize=50 } = {}) {
  const qs = new URLSearchParams();
  if (divisionId && divisionId !== 'ALL') qs.set('divisionId',divisionId);
  if (query) qs.set('query',query); if (user) qs.set('user',user); if (action) qs.set('action',action); if (dateFrom) qs.set('dateFrom',dateFrom); if (dateTo) qs.set('dateTo',dateTo);
  qs.set('page',String(page)); qs.set('pageSize',String(pageSize));
  return request(`/operations/activity?${qs.toString()}`, { method:'GET' });
}

// ============================================================================
// TAHAP 13 — SUPER ADMIN: USER MANAGEMENT + PERMISSIONS
// ============================================================================
export async function getAdminUsers({ search = '', role = '', status = '', divisionId = '', page = 1, pageSize = 25 } = {}) {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  if (role && role !== 'ALL') qs.set('role', role);
  if (status && status !== 'ALL') qs.set('status', status);
  if (divisionId && divisionId !== 'ALL') qs.set('divisionId', divisionId);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));
  return request(`/admin/users?${qs.toString()}`, { method: 'GET' });
}

export async function getAdminUserDetail(userId) {
  return request(`/admin/users/${encodeURIComponent(String(userId || ''))}`, { method: 'GET' });
}

export async function createAdminUser(payload) {
  return request('/admin/users', { method: 'POST', timeoutMs: 20000, body: JSON.stringify(payload || {}) });
}

export async function updateAdminUser(userId, payload) {
  return request(`/admin/users/${encodeURIComponent(String(userId || ''))}`, { method: 'PATCH', timeoutMs: 20000, body: JSON.stringify(payload || {}) });
}

export async function resetAdminUserPassword(userId, payload) {
  return request(`/admin/users/${encodeURIComponent(String(userId || ''))}/reset-password`, { method: 'POST', timeoutMs: 20000, body: JSON.stringify(payload || {}) });
}

export async function revokeAdminUserSessions(userId) {
  return request(`/admin/users/${encodeURIComponent(String(userId || ''))}/revoke-sessions`, { method: 'POST', timeoutMs: 15000, body: JSON.stringify({}) });
}

export async function getAdminUserPermissions(userId) {
  return request(`/admin/users/${encodeURIComponent(String(userId || ''))}/permissions`, { method: 'GET' });
}

export async function updateAdminUserPermissions(userId, permissions) {
  return request(`/admin/users/${encodeURIComponent(String(userId || ''))}/permissions`, { method: 'PUT', timeoutMs: 15000, body: JSON.stringify({ permissions }) });
}

export async function getAdminPasswordResetRequests(status = 'PENDING') {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  return request(`/admin/password-reset-requests?${qs.toString()}`, { method: 'GET' });
}

export async function cancelAdminPasswordResetRequest(requestId) {
  return request(`/admin/password-reset-requests/${encodeURIComponent(String(requestId || ''))}/cancel`, { method: 'POST', body: JSON.stringify({}) });
}

export async function changeMyPassword({ oldPassword, newPassword, confirmPassword }) {
  return request('/auth/change-password', {
    method: 'POST', timeoutMs: 20000,
    body: JSON.stringify({ oldPassword, newPassword, confirmPassword })
  });
}

// ============================================================================
// TAHAP 14 — SYSTEM SETTINGS + PRODUCTION HARDENING
// ============================================================================
export async function getSystemSettings() {
  return request('/admin/system/settings', { method: 'GET', timeoutMs: 15000 });
}

export async function updateSystemSettings(payload) {
  return request('/admin/system/settings', { method: 'PATCH', timeoutMs: 20000, body: JSON.stringify(payload || {}) });
}

export async function getSystemStatus() {
  return request('/admin/system/status', { method: 'GET', timeoutMs: 20000 });
}

export async function cleanupExpiredSessions() {
  return request('/admin/system/sessions/cleanup', { method: 'POST', timeoutMs: 15000, body: JSON.stringify({}) });
}
