import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { getDriveFolderMetadata } from './googleDrive.service.js';

export function getServerHealth() {
  return {
    status: 'ok',
    app: env.appName,
    company: env.companyName,
    version: env.appVersion,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    serverTime: new Date().toISOString(),
    supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServerKey),
    supabaseKeyMode: env.supabaseKeyMode
  };
}

export async function getSupabaseHealth() {
  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();

  const [{ data: settingsRows, error: settingsError }, { data: divisionRows, error: divisionsError }] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['APP_NAME', 'COMPANY_NAME', 'APP_VERSION']),
    // Gunakan GET biasa, bukan HEAD. Pada beberapa jaringan/Windows/proxy,
    // request HEAD ke PostgREST dapat gagal walaupun GET normal berhasil.
    supabase
      .from('divisions')
      .select('id')
  ]);

  if (settingsError) {
    const detail = settingsError?.message || settingsError?.details || settingsError?.hint || JSON.stringify(settingsError || {});
    const error = new Error(`Supabase app_settings gagal dibaca: ${detail}`);
    error.code = 'SUPABASE_QUERY_FAILED';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  if (divisionsError) {
    const detail = divisionsError?.message || divisionsError?.details || divisionsError?.hint || JSON.stringify(divisionsError || {});
    const error = new Error(`Supabase divisions gagal dibaca: ${detail}`);
    error.code = 'SUPABASE_QUERY_FAILED';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  const settings = Object.fromEntries(
    (settingsRows || []).map((row) => [String(row.key), String(row.value ?? '')])
  );

  let projectHost = '';
  try {
    projectHost = new URL(env.supabaseUrl).host;
  } catch {
    projectHost = 'invalid-url';
  }

  return {
    status: 'connected',
    projectHost,
    keyMode: env.supabaseKeyMode,
    latencyMs: Date.now() - startedAt,
    divisionCount: Array.isArray(divisionRows) ? divisionRows.length : 0,
    settings
  };
}


function sanitizeGoogleError(error) {
  const raw = String(error?.response?.data?.error?.message || error?.response?.data?.error_description || error?.message || error || 'Unknown Google Drive error');
  return raw
    .replace(/ya29\.[A-Za-z0-9._-]+/g, '[ACCESS_TOKEN]')
    .replace(/1\/\/[A-Za-z0-9._-]+/g, '[REFRESH_TOKEN]')
    .slice(0, 700);
}

async function resolveRootDriveFolderId() {
  if (env.googleDriveRootFolderId) return env.googleDriveRootFolderId;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ROOT_DRIVE_FOLDER_ID')
      .maybeSingle();
    if (error) return '';
    return String(data?.value || '').trim();
  } catch {
    return '';
  }
}

export async function getGoogleDriveHealth() {
  const configured = {
    clientId: Boolean(env.googleClientId),
    clientSecret: Boolean(env.googleClientSecret),
    refreshToken: Boolean(env.googleRefreshToken),
    redirectUri: Boolean(env.googleOauthRedirectUri)
  };
  const missing = [];
  if (!configured.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!configured.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!configured.refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');

  const rootFolderId = await resolveRootDriveFolderId();
  if (!rootFolderId) missing.push('GOOGLE_DRIVE_ROOT_FOLDER_ID / app_settings.ROOT_DRIVE_FOLDER_ID');

  if (missing.length) {
    const error = new Error(`Google Drive production belum lengkap: ${missing.join(', ')}`);
    error.code = 'GOOGLE_DRIVE_CONFIG_MISSING';
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }

  const startedAt = Date.now();
  try {
    const meta = await getDriveFolderMetadata(rootFolderId);
    return {
      status: 'connected',
      latencyMs: Date.now() - startedAt,
      configured,
      rootFolderId: meta.id,
      rootFolderName: meta.name,
      trashed: Boolean(meta.trashed),
      mimeType: meta.mimeType
    };
  } catch (error) {
    const detail = sanitizeGoogleError(error);
    const wrapped = new Error(`Google Drive production gagal: ${detail}`);
    wrapped.code = 'GOOGLE_DRIVE_HEALTH_FAILED';
    wrapped.statusCode = 503;
    wrapped.isOperational = true;
    throw wrapped;
  }
}
