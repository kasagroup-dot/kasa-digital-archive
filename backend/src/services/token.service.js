import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function createAccessToken({ user, sessionId }) {
  return jwt.sign(
    {
      sid: sessionId,
      username: user.username,
      role: user.role,
      divisionId: user.division_id || null
    },
    env.jwtAccessSecret,
    {
      subject: user.id,
      expiresIn: env.jwtAccessExpiresIn,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, {
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });
}

export function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}
