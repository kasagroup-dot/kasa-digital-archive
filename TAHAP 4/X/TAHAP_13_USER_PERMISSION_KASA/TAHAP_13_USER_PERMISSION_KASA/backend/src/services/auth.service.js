import { getSupabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { writeAuditSafe } from './audit.service.js';
import { makeBcryptHash, validateNewPassword, verifyUserPassword } from './password.service.js';
import { createAccessToken, hashRefreshToken, newRefreshToken } from './token.service.js';
import {
  changePasswordHash,
  findUserById,
  findUserByUsername,
  getPermissionsForUser,
  updateLastLogin,
  upgradeUserPasswordToBcrypt
} from '../repositories/user.repository.js';

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function sanitizeUser(user, permissions) {
  return {
    id: user.id,
    legacyId: user.legacy_id || null,
    name: user.full_name,
    username: user.username,
    email: user.email || '',
    divisionId: user.division_id || null,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at || null,
    permissions: {
      CAN_VIEW: Boolean(permissions?.can_view),
      CAN_UPLOAD: Boolean(permissions?.can_upload),
      CAN_DOWNLOAD: Boolean(permissions?.can_download),
      CAN_PREVIEW: Boolean(permissions?.can_preview),
      CAN_CREATE_FOLDER: Boolean(permissions?.can_create_folder),
      CAN_RENAME: Boolean(permissions?.can_rename),
      CAN_MOVE: Boolean(permissions?.can_move),
      CAN_DELETE: Boolean(permissions?.can_delete),
      CAN_RESTORE: Boolean(permissions?.can_restore),
      CAN_VIEW_LOG: Boolean(permissions?.can_view_log)
    }
  };
}

async function createSession({ user, rememberMe, ipAddress, userAgent }) {
  const supabase = getSupabaseAdmin();
  const refreshToken = newRefreshToken();
  const refreshHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const expiresAt = rememberMe ? addDays(now, env.refreshTokenDays) : addHours(now, env.sessionNormalHours);

  const { data, error } = await supabase
    .from('auth_sessions')
    .insert({
      user_id: user.id,
      refresh_token_hash: refreshHash,
      remember_me: Boolean(rememberMe),
      status: 'ACTIVE',
      expires_at: expiresAt.toISOString(),
      last_activity_at: now.toISOString(),
      ip_address: ipAddress || null,
      user_agent: userAgent || null
    })
    .select('id,expires_at,remember_me')
    .single();

  if (error) throw error;

  const accessToken = createAccessToken({ user, sessionId: data.id });
  return { accessToken, refreshToken, sessionId: data.id, expiresAt: data.expires_at, rememberMe: data.remember_me };
}

export async function login({ username, password, rememberMe, ipAddress, userAgent }) {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername || !password) throw new AppError('Username dan password wajib diisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });

  const user = await findUserByUsername(cleanUsername);
  if (!user || user.status !== 'ACTIVE') throw new AppError('Username atau password tidak sesuai.', { statusCode: 401, code: 'INVALID_CREDENTIALS' });

  const valid = await verifyUserPassword(user, String(password));
  if (!valid) throw new AppError('Username atau password tidak sesuai.', { statusCode: 401, code: 'INVALID_CREDENTIALS' });

  let migratedToBcrypt = false;
  if (user.password_algorithm === 'legacy_sha256_2500') {
    const newHash = await makeBcryptHash(String(password));
    await upgradeUserPasswordToBcrypt(user.id, newHash);
    user.password_hash = newHash;
    user.password_algorithm = 'bcrypt';
    user.legacy_password_salt = null;
    migratedToBcrypt = true;
  }

  const permissions = await getPermissionsForUser(user);
  const session = await createSession({ user, rememberMe, ipAddress, userAgent });

  // Last-login dan audit tidak boleh menahan response login.
  // Keduanya tetap dijalankan best-effort setelah session berhasil dibuat.
  void updateLastLogin(user.id).catch((error) => {
    console.error('Update last login gagal:', error?.message || error);
  });

  void writeAuditSafe({
    user,
    action: 'LOGIN',
    objectId: user.id,
    objectName: user.username,
    detail: migratedToBcrypt ? 'Login berhasil; password legacy dimigrasikan ke bcrypt.' : 'Login berhasil.',
    ipAddress,
    userAgent,
    metadata: { rememberMe: Boolean(rememberMe), migratedToBcrypt }
  });

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.expiresAt,
    user: sanitizeUser(user, permissions),
    migratedToBcrypt
  };
}

export async function refresh({ refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) throw new AppError('Refresh session tidak tersedia.', { statusCode: 401, code: 'REFRESH_REQUIRED' });

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const tokenHash = hashRefreshToken(refreshToken);

  const { data: session, error } = await supabase
    .from('auth_sessions')
    .select('id,user_id,remember_me,status,expires_at')
    .eq('refresh_token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!session || session.status !== 'ACTIVE') throw new AppError('Session sudah tidak aktif.', { statusCode: 401, code: 'SESSION_INVALID' });
  if (new Date(session.expires_at).getTime() <= now.getTime()) {
    await supabase.from('auth_sessions').update({ status: 'EXPIRED' }).eq('id', session.id);
    throw new AppError('Session sudah kedaluwarsa.', { statusCode: 401, code: 'SESSION_EXPIRED' });
  }

  const user = await findUserById(session.user_id);
  if (!user || user.status !== 'ACTIVE') throw new AppError('User sudah tidak aktif.', { statusCode: 401, code: 'USER_INACTIVE' });

  const rotatedToken = newRefreshToken();
  const rotatedHash = hashRefreshToken(rotatedToken);
  const { error: rotateError } = await supabase
    .from('auth_sessions')
    .update({
      refresh_token_hash: rotatedHash,
      last_activity_at: now.toISOString(),
      ip_address: ipAddress || null,
      user_agent: userAgent || null
    })
    .eq('id', session.id);
  if (rotateError) throw rotateError;

  const accessToken = createAccessToken({ user, sessionId: session.id });
  const permissions = await getPermissionsForUser(user);

  return {
    accessToken,
    refreshToken: rotatedToken,
    refreshExpiresAt: session.expires_at,
    user: sanitizeUser(user, permissions)
  };
}

export async function logout({ refreshToken, authUser, ipAddress, userAgent }) {
  const supabase = getSupabaseAdmin();
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await supabase
      .from('auth_sessions')
      .update({
        status: 'REVOKED',
        revoked_at: new Date().toISOString(),
        revoked_reason: 'USER_LOGOUT'
      })
      .eq('refresh_token_hash', tokenHash)
      .eq('status', 'ACTIVE');
  }

  if (authUser) {
    await writeAuditSafe({
      user: authUser,
      action: 'LOGOUT',
      objectId: authUser.id,
      objectName: authUser.username,
      detail: 'User logout.',
      ipAddress,
      userAgent
    });
  }
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);
  if (!user || user.status !== 'ACTIVE') throw new AppError('User tidak aktif atau tidak ditemukan.', { statusCode: 401, code: 'USER_INACTIVE' });
  const permissions = await getPermissionsForUser(user);
  return sanitizeUser(user, permissions);
}

export async function changePassword({ userId, oldPassword, newPassword, confirmPassword, currentSessionId, ipAddress, userAgent }) {
  if (String(newPassword || '') !== String(confirmPassword || '')) throw new AppError('Konfirmasi password tidak sama.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  const validation = validateNewPassword(newPassword);
  if (validation) throw new AppError(validation, { statusCode: 400, code: 'VALIDATION_ERROR' });

  const user = await findUserById(userId);
  if (!user || user.status !== 'ACTIVE') throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });
  const oldValid = await verifyUserPassword(user, String(oldPassword || ''));
  if (!oldValid) throw new AppError('Password lama tidak sesuai.', { statusCode: 400, code: 'OLD_PASSWORD_INVALID' });

  const hash = await makeBcryptHash(String(newPassword));
  await changePasswordHash(user.id, hash);

  const supabase = getSupabaseAdmin();
  await supabase
    .from('auth_sessions')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString(), revoked_reason: 'PASSWORD_CHANGED' })
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .neq('id', currentSessionId);

  await writeAuditSafe({
    user,
    action: 'CHANGE_PASSWORD',
    objectId: user.id,
    objectName: user.username,
    detail: 'Password diperbarui ke bcrypt.',
    ipAddress,
    userAgent
  });
}

export async function requestPasswordReset({ username, ipAddress, userAgent }) {
  const user = await findUserByUsername(String(username || '').trim());
  if (!user || user.status !== 'ACTIVE') return;

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from('password_reset_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'PENDING')
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await supabase.from('password_reset_requests').insert({
      user_id: user.id,
      username_snapshot: user.username,
      division_id: user.division_id || null,
      status: 'PENDING',
      detail: 'Permintaan reset password dari halaman login.'
    });
    if (error) throw error;
  }

  await writeAuditSafe({
    user,
    action: 'PASSWORD_RESET_REQUEST',
    objectId: user.id,
    objectName: user.username,
    detail: 'Permintaan reset password dibuat.',
    ipAddress,
    userAgent
  });
}
