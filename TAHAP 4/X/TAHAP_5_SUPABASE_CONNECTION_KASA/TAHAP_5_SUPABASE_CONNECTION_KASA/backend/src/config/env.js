import dotenv from 'dotenv';

dotenv.config();

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOrigins(value) {
  return String(value || 'http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const supabaseSecretKey = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const supabaseLegacyServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseServerKey = supabaseSecretKey || supabaseLegacyServiceRoleKey;

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePositiveInteger(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  frontendUrls: parseOrigins(process.env.FRONTEND_URLS),

  appName: process.env.APP_NAME || 'KASA DIGITAL ARCHIVE',
  companyName: process.env.COMPANY_NAME || 'PT. KASA GROUP',
  appVersion: process.env.APP_VERSION || 'FULLSTACK-0.5.0',

  supabaseUrl: String(process.env.SUPABASE_URL || '').trim(),
  supabaseSecretKey,
  supabaseLegacyServiceRoleKey,
  supabaseServerKey,
  supabaseKeyMode: supabaseSecretKey ? 'secret' : (supabaseLegacyServiceRoleKey ? 'legacy_service_role' : 'none'),

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshTokenDays: parsePositiveInteger(process.env.REFRESH_TOKEN_DAYS, 7),

  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY || '',
  googleDriveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || ''
});

export function assertSupabaseEnv() {
  const missing = [];
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabaseServerKey) missing.push('SUPABASE_SECRET_KEY');

  if (missing.length) {
    const error = new Error(`Environment Supabase belum lengkap: ${missing.join(', ')}`);
    error.code = 'SUPABASE_ENV_MISSING';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }
}

export function isProduction() {
  return env.nodeEnv === 'production';
}
