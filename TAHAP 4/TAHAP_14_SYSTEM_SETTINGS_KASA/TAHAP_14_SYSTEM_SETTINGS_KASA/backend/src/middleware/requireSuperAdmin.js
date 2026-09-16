import { AppError } from '../utils/AppError.js';

export function requireSuperAdmin(req, _res, next) {
  try {
    if (!req.auth?.user || req.auth.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Fitur ini hanya dapat diakses Super Admin.', {
        statusCode: 403,
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}
