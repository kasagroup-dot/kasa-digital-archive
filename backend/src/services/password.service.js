import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function safeEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function hashLegacyPassword2500(password, salt) {
  let value = `${salt}|${password}`;
  for (let i = 0; i < 2500; i += 1) {
    value = sha256Hex(`${value}|${salt}|${i}`);
  }
  return value;
}

export async function verifyUserPassword(user, plainPassword) {
  if (!user || !plainPassword) return false;

  if (user.password_algorithm === 'bcrypt') {
    return bcrypt.compare(String(plainPassword), String(user.password_hash || ''));
  }

  if (user.password_algorithm === 'legacy_sha256_2500') {
    if (!user.legacy_password_salt || !user.password_hash) return false;
    const candidate = hashLegacyPassword2500(String(plainPassword), String(user.legacy_password_salt));
    return safeEqualHex(candidate, String(user.password_hash));
  }

  return false;
}

export async function makeBcryptHash(plainPassword) {
  return bcrypt.hash(String(plainPassword), env.bcryptRounds);
}

export function validateNewPassword(password) {
  const value = String(password || '');
  if (value.length < 6) return 'Password minimal 6 karakter.';
  if (value.length > 128) return 'Password maksimal 128 karakter.';
  return '';
}
