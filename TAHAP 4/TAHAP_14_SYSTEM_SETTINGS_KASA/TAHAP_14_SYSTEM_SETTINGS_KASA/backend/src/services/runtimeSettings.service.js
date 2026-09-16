import { listAppSettings } from '../repositories/system.repository.js';

const CACHE_TTL_MS = 30_000;
let cached = null;
let cachedAt = 0;

const DEFAULTS = Object.freeze({
  maxUploadBytes: 250 * 1024 * 1024,
  maxPreviewBytes: 8 * 1024 * 1024,
  sessionDurationHours: 8,
  rememberSessionDays: 7,
  defaultPageSize: 25,
  maxPageSize: 100,
  maintenanceMode: false,
  maintenanceMessage: 'Sistem sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.'
});

function positiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function boolValue(value) {
  return ['1','TRUE','YES','ON'].includes(String(value || '').trim().toUpperCase());
}

export function invalidateRuntimeSettings() {
  cached = null;
  cachedAt = 0;
}

export async function getRuntimeSettings({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const rows = await listAppSettings([
    'MAX_UPLOAD_SIZE','MAX_PREVIEW_SIZE','SESSION_DURATION_HOURS','REMEMBER_SESSION_DAYS',
    'DEFAULT_PAGE_SIZE','MAX_PAGE_SIZE','MAINTENANCE_MODE','MAINTENANCE_MESSAGE'
  ]);
  const map = new Map(rows.map((row) => [row.key, row.value]));

  cached = Object.freeze({
    maxUploadBytes: positiveInt(map.get('MAX_UPLOAD_SIZE'), DEFAULTS.maxUploadBytes),
    maxPreviewBytes: positiveInt(map.get('MAX_PREVIEW_SIZE'), DEFAULTS.maxPreviewBytes),
    sessionDurationHours: positiveInt(map.get('SESSION_DURATION_HOURS'), DEFAULTS.sessionDurationHours),
    rememberSessionDays: positiveInt(map.get('REMEMBER_SESSION_DAYS'), DEFAULTS.rememberSessionDays),
    defaultPageSize: positiveInt(map.get('DEFAULT_PAGE_SIZE'), DEFAULTS.defaultPageSize),
    maxPageSize: positiveInt(map.get('MAX_PAGE_SIZE'), DEFAULTS.maxPageSize),
    maintenanceMode: boolValue(map.get('MAINTENANCE_MODE')),
    maintenanceMessage: String(map.get('MAINTENANCE_MESSAGE') || DEFAULTS.maintenanceMessage).slice(0, 300)
  });
  cachedAt = Date.now();
  return cached;
}
