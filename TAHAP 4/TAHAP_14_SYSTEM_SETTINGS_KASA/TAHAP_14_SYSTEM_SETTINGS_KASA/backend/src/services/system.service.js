import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { writeAuditSafe } from './audit.service.js';
import { getDriveFolderMetadata } from './googleDrive.service.js';
import { getRuntimeSettings, invalidateRuntimeSettings } from './runtimeSettings.service.js';
import {
  expireStaleSessions,
  getLastAuditActivity,
  getSystemCounts,
  listAppSettings,
  upsertAppSettings
} from '../repositories/system.repository.js';

const DESCRIPTIONS = Object.freeze({
  MAX_UPLOAD_SIZE: 'Batas upload per file dalam byte',
  MAX_PREVIEW_SIZE: 'Batas preview langsung dalam byte',
  SESSION_DURATION_HOURS: 'Durasi session normal dalam jam',
  REMEMBER_SESSION_DAYS: 'Durasi session Remember Me dalam hari',
  DEFAULT_PAGE_SIZE: 'Default pagination',
  MAX_PAGE_SIZE: 'Maximum pagination page size',
  MAINTENANCE_MODE: 'Mode pemeliharaan; Super Admin tetap dapat masuk',
  MAINTENANCE_MESSAGE: 'Pesan yang ditampilkan saat maintenance aktif'
});

function intRange(value, label, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AppError(`${label} harus antara ${min} dan ${max}.`, { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  return n;
}

function mbToBytes(value, label, minMb, maxMb) {
  return intRange(value, label, minMb, maxMb) * 1024 * 1024;
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  return ['1','true','yes','on'].includes(String(value || '').toLowerCase());
}

function settingsMap(rows) {
  return new Map((rows || []).map((row) => [row.key, row.value]));
}

export async function getSystemSettings() {
  const rows = await listAppSettings();
  const map = settingsMap(rows);
  const runtime = await getRuntimeSettings({ force: true });
  return {
    branding: {
      appName: map.get('APP_NAME') || env.appName,
      companyName: map.get('COMPANY_NAME') || env.companyName,
      appVersion: map.get('APP_VERSION') || env.appVersion,
      securityModel: map.get('SECURITY_MODEL') || 'EXPRESS_API_SUPABASE_PRIVATE_GOOGLE_DRIVE'
    },
    storage: {
      rootDriveFolderId: map.get('ROOT_DRIVE_FOLDER_ID') || env.googleDriveRootFolderId || '',
      maxUploadMb: Math.max(1, Math.round(runtime.maxUploadBytes / 1024 / 1024)),
      maxPreviewMb: Math.max(1, Math.round(runtime.maxPreviewBytes / 1024 / 1024))
    },
    session: {
      sessionDurationHours: runtime.sessionDurationHours,
      rememberSessionDays: runtime.rememberSessionDays
    },
    pagination: {
      defaultPageSize: runtime.defaultPageSize,
      maxPageSize: runtime.maxPageSize
    },
    maintenance: {
      enabled: runtime.maintenanceMode,
      message: runtime.maintenanceMessage
    },
    updatedAt: rows.reduce((latest, row) => !latest || String(row.updated_at || '') > latest ? String(row.updated_at || '') : latest, '') || null
  };
}

export async function updateSystemSettings({ auth, payload = {}, ipAddress, userAgent }) {
  const storage = payload.storage || {};
  const session = payload.session || {};
  const pagination = payload.pagination || {};
  const maintenance = payload.maintenance || {};

  const maxUploadBytes = mbToBytes(storage.maxUploadMb, 'Batas upload (MB)', 1, 1024);
  const maxPreviewBytes = mbToBytes(storage.maxPreviewMb, 'Batas preview (MB)', 1, 100);
  const sessionDurationHours = intRange(session.sessionDurationHours, 'Session normal (jam)', 1, 72);
  const rememberSessionDays = intRange(session.rememberSessionDays, 'Remember session (hari)', 1, 30);
  const defaultPageSize = intRange(pagination.defaultPageSize, 'Default page size', 10, 100);
  const maxPageSize = intRange(pagination.maxPageSize, 'Maximum page size', defaultPageSize, 500);
  const maintenanceEnabled = parseBool(maintenance.enabled);
  const maintenanceMessage = String(maintenance.message || '').trim().slice(0, 300) || 'Sistem sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.';

  await upsertAppSettings([
    { key: 'MAX_UPLOAD_SIZE', value: maxUploadBytes, description: DESCRIPTIONS.MAX_UPLOAD_SIZE },
    { key: 'MAX_PREVIEW_SIZE', value: maxPreviewBytes, description: DESCRIPTIONS.MAX_PREVIEW_SIZE },
    { key: 'SESSION_DURATION_HOURS', value: sessionDurationHours, description: DESCRIPTIONS.SESSION_DURATION_HOURS },
    { key: 'REMEMBER_SESSION_DAYS', value: rememberSessionDays, description: DESCRIPTIONS.REMEMBER_SESSION_DAYS },
    { key: 'DEFAULT_PAGE_SIZE', value: defaultPageSize, description: DESCRIPTIONS.DEFAULT_PAGE_SIZE },
    { key: 'MAX_PAGE_SIZE', value: maxPageSize, description: DESCRIPTIONS.MAX_PAGE_SIZE },
    { key: 'MAINTENANCE_MODE', value: maintenanceEnabled ? 'TRUE' : 'FALSE', description: DESCRIPTIONS.MAINTENANCE_MODE },
    { key: 'MAINTENANCE_MESSAGE', value: maintenanceMessage, description: DESCRIPTIONS.MAINTENANCE_MESSAGE }
  ]);
  invalidateRuntimeSettings();

  await writeAuditSafe({
    user: auth.user,
    action: 'UPDATE_SYSTEM_SETTINGS',
    objectType: 'SYSTEM',
    objectId: 'APP_SETTINGS',
    objectName: 'System Settings',
    detail: `System Settings diperbarui. Maintenance: ${maintenanceEnabled ? 'ON' : 'OFF'}.`,
    ipAddress,
    userAgent,
    metadata: { maxUploadMb: maxUploadBytes / 1024 / 1024, sessionDurationHours, rememberSessionDays, defaultPageSize, maxPageSize, maintenanceEnabled }
  });

  return getSystemSettings();
}

function checkItem(key, label, ok, detail, severity = 'critical') {
  return { key, label, ok: Boolean(ok), detail: String(detail || ''), severity };
}

export async function getSystemStatus() {
  const [settings, counts, lastActivity] = await Promise.all([
    getSystemSettings(),
    getSystemCounts(),
    getLastAuditActivity()
  ]);

  let drive = { connected: false, name: '-', id: settings.storage.rootDriveFolderId || '', trashed: null, error: '' };
  if (settings.storage.rootDriveFolderId) {
    try {
      const meta = await getDriveFolderMetadata(settings.storage.rootDriveFolderId);
      drive = { connected: true, name: meta.name || '-', id: meta.id || settings.storage.rootDriveFolderId, trashed: Boolean(meta.trashed), error: '' };
    } catch (error) {
      drive.error = error?.message || 'Google Drive tidak dapat dibaca.';
    }
  }

  const httpsOrigins = env.frontendUrls.filter((item) => item === '*' || /^https:\/\//i.test(item));
  const checks = [
    checkItem('SUPABASE', 'Supabase server key', Boolean(env.supabaseUrl && env.supabaseServerKey), env.supabaseKeyMode === 'secret' ? 'Secret key server terkonfigurasi.' : `Mode key: ${env.supabaseKeyMode}`),
    checkItem('JWT', 'JWT access secret', env.jwtAccessSecret.length >= 32, env.jwtAccessSecret.length >= 32 ? 'JWT secret memenuhi minimum panjang.' : 'JWT secret belum aman.'),
    checkItem('DRIVE', 'Google Drive OAuth', drive.connected && !drive.trashed, drive.connected ? `${drive.name} dapat diakses.` : (drive.error || 'Drive belum terhubung.')),
    checkItem('CORS', 'CORS allowlist', !env.frontendUrls.includes('*'), env.frontendUrls.includes('*') ? 'Wildcard CORS tidak boleh dipakai di production.' : env.frontendUrls.join(', ')),
    checkItem('NODE_ENV', 'Production environment', env.nodeEnv === 'production', `NODE_ENV=${env.nodeEnv}`, 'warning'),
    checkItem('HTTPS', 'Frontend HTTPS', env.nodeEnv !== 'production' || httpsOrigins.length === env.frontendUrls.length, env.nodeEnv === 'production' ? env.frontendUrls.join(', ') : 'Development local diperbolehkan memakai HTTP.', 'warning'),
    checkItem('MAINTENANCE', 'Maintenance mode', !settings.maintenance.enabled, settings.maintenance.enabled ? 'Maintenance sedang aktif.' : 'Maintenance OFF.', 'warning')
  ];

  const criticalReady = checks.filter((item) => item.severity === 'critical').every((item) => item.ok);
  const productionReady = checks.every((item) => item.ok);

  return {
    environment: {
      nodeEnv: env.nodeEnv,
      apiPrefix: env.apiPrefix,
      frontendUrls: env.frontendUrls,
      supabaseKeyMode: env.supabaseKeyMode,
      appVersion: env.appVersion,
      cookie: {
        secure: env.nodeEnv === 'production',
        sameSite: env.refreshCookieSameSite
      }
    },
    drive,
    counts,
    lastActivity,
    checks,
    criticalReady,
    productionReady,
    maintenance: settings.maintenance,
    checkedAt: new Date().toISOString()
  };
}

export async function cleanupExpiredSessions({ auth, ipAddress, userAgent }) {
  const expired = await expireStaleSessions();
  await writeAuditSafe({
    user: auth.user,
    action: 'CLEANUP_EXPIRED_SESSIONS',
    objectType: 'SYSTEM',
    objectId: 'AUTH_SESSIONS',
    objectName: 'Auth Sessions',
    detail: `${expired} session kedaluwarsa ditandai EXPIRED.`,
    ipAddress,
    userAgent,
    metadata: { expired }
  });
  return { expired };
}
