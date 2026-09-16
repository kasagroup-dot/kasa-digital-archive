import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { hashLegacyPassword2500 } from './password.service.js';

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function validateFolderPassword(password) {
  const value = String(password || '');
  if (value.length < 6) return 'Password folder minimal 6 karakter.';
  if (value.length > 64) return 'Password folder maksimal 64 karakter.';
  return '';
}

export async function makeFolderPasswordHash(password) {
  return bcrypt.hash(String(password), env.bcryptRounds);
}

export async function verifyFolderPassword(folder, plainPassword) {
  if (!folder?.password_enabled) return true;
  const algorithm = String(folder.password_algorithm || '');
  const stored = String(folder.password_hash || '');
  const salt = String(folder.password_salt || '');
  const plain = String(plainPassword || '');

  if (algorithm === 'bcrypt') return bcrypt.compare(plain, stored);
  if (algorithm === 'legacy_sha256_2500') {
    if (!salt || !stored) return false;
    return safeEqual(hashLegacyPassword2500(plain, salt), stored);
  }
  if (algorithm === 'legacy_fp2_hmac_sha256') {
    if (!salt || !stored || !env.legacyFolderPasswordPepper) return false;
    const hex = crypto.createHmac('sha256', env.legacyFolderPasswordPepper).update(`${salt}|${plain}`, 'utf8').digest('hex');
    return safeEqual(`FP2$${hex}`, stored);
  }
  return false;
}
