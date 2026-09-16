import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return sendError(res, {
      statusCode: 400,
      message: 'Data request tidak valid.',
      code: 'VALIDATION_ERROR',
      details: err.issues
    });
  }

  const statusCode = Number(err.statusCode || err.status || 500);
  const code = err.code || 'INTERNAL_ERROR';
  const operational = Boolean(err.isOperational) || statusCode < 500;

  if (statusCode >= 500) {
    console.error('[KASA API ERROR]', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack
    });
  }

  const message = operational || !isProduction()
    ? (err.message || 'Terjadi kesalahan pada server.')
    : 'Terjadi kesalahan pada server.';

  return sendError(res, {
    statusCode,
    message,
    code,
    details: !isProduction() && err.details ? err.details : undefined
  });
}
