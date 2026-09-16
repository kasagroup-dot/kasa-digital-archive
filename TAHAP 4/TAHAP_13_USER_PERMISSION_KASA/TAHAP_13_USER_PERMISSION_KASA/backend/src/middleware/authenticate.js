import { getSupabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../services/token.service.js';
import { findUserById, getPermissionsForUser } from '../repositories/user.repository.js';

function extractBearer(req) {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

export async function authenticate(req, _res, next) {
  try {
    const token = extractBearer(req);
    if (!token) throw new AppError('Access token wajib dikirim.', { statusCode: 401, code: 'ACCESS_TOKEN_REQUIRED' });

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError('Access token tidak valid atau kedaluwarsa.', { statusCode: 401, code: 'ACCESS_TOKEN_INVALID' });
    }

    const supabase = getSupabaseAdmin();
    const { data: session, error } = await supabase
      .from('auth_sessions')
      .select('id,user_id,status,expires_at')
      .eq('id', payload.sid)
      .eq('user_id', payload.sub)
      .maybeSingle();
    if (error) throw error;

    if (!session || session.status !== 'ACTIVE' || new Date(session.expires_at).getTime() <= Date.now()) {
      throw new AppError('Session tidak aktif.', { statusCode: 401, code: 'SESSION_INVALID' });
    }

    const user = await findUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE') throw new AppError('User tidak aktif.', { statusCode: 401, code: 'USER_INACTIVE' });
    if (user.must_change_password) {
      const originalUrl = String(req.originalUrl || '');
      const allowedWhileChanging = ['/auth/change-password', '/auth/logout', '/auth/me'];
      if (!allowedWhileChanging.some((suffix) => originalUrl.includes(suffix))) {
        throw new AppError('Anda wajib mengganti password sebelum menggunakan aplikasi.', { statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
      }
    }

    const permissions = await getPermissionsForUser(user);

    req.auth = { user, permissions, sessionId: session.id, tokenPayload: payload };
    next();
  } catch (error) {
    next(error);
  }
}
