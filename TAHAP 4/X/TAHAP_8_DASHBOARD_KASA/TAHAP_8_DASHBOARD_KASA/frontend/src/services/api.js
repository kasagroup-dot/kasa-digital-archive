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
    throw error;
  }
  return payload;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken && options.auth !== false) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (response.status === 401 && options.auth !== false && options.retryAuth !== false) {
    try {
      await refreshSession();
      return request(path, { ...options, retryAuth: false });
    } catch (_) {
      setAccessToken('');
    }
  }
  return parseResponse(response);
}

export async function login(username, password, rememberMe) {
  const result = await request('/auth/login', {
    method: 'POST', auth: false,
    body: JSON.stringify({ username, password, rememberMe: Boolean(rememberMe) })
  });
  setAccessToken(result?.data?.accessToken || '');
  return result;
}

export async function refreshSession() {
  const result = await request('/auth/refresh', { method: 'POST', auth: false, retryAuth: false, body: JSON.stringify({}) });
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
