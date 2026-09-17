import { env, isProduction } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as authService from '../services/auth.service.js';

function requestIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function requestAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 1000) || null;
}

function cookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: `${env.apiPrefix}/auth`,
    expires: new Date(expiresAt)
  };
}

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(env.refreshCookieName, token, cookieOptions(expiresAt));
}

export async function login(req, res, next) {
  try {
    const result = await authService.login({
      username: req.body?.username,
      password: req.body?.password,
      rememberMe: Boolean(req.body?.rememberMe),
      ipAddress: requestIp(req),
      userAgent: requestAgent(req)
    });
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return sendSuccess(res, {
      message: 'Login berhasil.',
      data: {
        accessToken: result.accessToken,
        user: result.user,
        migratedToBcrypt: result.migratedToBcrypt
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const result = await authService.refresh({
      refreshToken: req.cookies?.[env.refreshCookieName],
      ipAddress: requestIp(req),
      userAgent: requestAgent(req)
    });
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    return sendSuccess(res, {
      message: 'Access token diperbarui.',
      data: { accessToken: result.accessToken, user: result.user }
    });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req, res, next) {
  try {
    await authService.logout({
      refreshToken: req.cookies?.[env.refreshCookieName],
      authUser: req.auth?.user || null,
      ipAddress: requestIp(req),
      userAgent: requestAgent(req)
    });
    res.clearCookie(env.refreshCookieName, { path: `${env.apiPrefix}/auth` });
    return sendSuccess(res, { message: 'Logout berhasil.', data: null });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.auth.user.id);
    return sendSuccess(res, { message: 'OK', data: { user } });
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword({
      userId: req.auth.user.id,
      oldPassword: req.body?.oldPassword,
      newPassword: req.body?.newPassword,
      confirmPassword: req.body?.confirmPassword,
      currentSessionId: req.auth.sessionId,
      ipAddress: requestIp(req),
      userAgent: requestAgent(req)
    });
    return sendSuccess(res, { message: 'Password berhasil diperbarui.', data: null });
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    await authService.requestPasswordReset({
      username: req.body?.username,
      ipAddress: requestIp(req),
      userAgent: requestAgent(req)
    });
    return sendSuccess(res, {
      message: 'Jika username tersedia dan aktif, permintaan reset password sudah dicatat.',
      data: null
    });
  } catch (error) {
    return next(error);
  }
}
