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
  appVersion: process.env.APP_VERSION || 'FULLSTACK-0.9.4',

  supabaseUrl: String(process.env.SUPABASE_URL || '').trim(),
  supabaseSecretKey,
  supabaseLegacyServiceRoleKey,
  supabaseServerKey,
  supabaseKeyMode: supabaseSecretKey ? 'secret' : (supabaseLegacyServiceRoleKey ? 'legacy_service_role' : 'none'),

  jwtAccessSecret: String(process.env.JWT_ACCESS_SECRET || '').trim(),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtIssuer: process.env.JWT_ISSUER || 'kasa-digital-archive-api',
  jwtAudience: process.env.JWT_AUDIENCE || 'kasa-digital-archive-web',

  sessionNormalHours: parsePositiveInteger(process.env.SESSION_NORMAL_HOURS, 8),
  refreshTokenDays: parsePositiveInteger(process.env.REFRESH_TOKEN_DAYS, 7),
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'kasa_refresh',
  bcryptRounds: Math.min(14, Math.max(10, parsePositiveInteger(process.env.BCRYPT_ROUNDS, 12))),

  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY || '',
  googleDriveRootFolderId: String(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '').trim(),
  googleClientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
  googleClientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  googleRefreshToken: String(process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
  googleOauthRedirectUri: String(process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback').trim(),
  legacyFolderPasswordPepper: String(process.env.LEGACY_FOLDER_PASSWORD_PEPPER || '').trim()
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

export function assertAuthEnv() {
  assertSupabaseEnv();
  if (!env.jwtAccessSecret || env.jwtAccessSecret.length < 32) {
    const error = new Error('JWT_ACCESS_SECRET belum diisi atau terlalu pendek. Jalankan npm run auth:secret lalu simpan hasilnya ke file .env.');
    error.code = 'JWT_SECRET_MISSING';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }
}

export function isProduction() {
  return env.nodeEnv === 'production';
}

export function assertGoogleDriveEnv() {
  const missing = [];
  if (!env.googleClientId) missing.push('GOOGLE_CLIENT_ID');
  if (!env.googleClientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!env.googleRefreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
  if (missing.length) {
    const error = new Error(`Google Drive OAuth belum lengkap: ${missing.join(', ')}. Jalankan npm run drive:auth.`);
    error.code = 'GOOGLE_DRIVE_ENV_MISSING';
    error.statusCode = 503;
    error.isOperational = true;
    throw error;
  }
}
