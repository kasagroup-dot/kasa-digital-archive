import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(`Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`, {
    statusCode: 404,
    code: 'NOT_FOUND'
  }));
}
