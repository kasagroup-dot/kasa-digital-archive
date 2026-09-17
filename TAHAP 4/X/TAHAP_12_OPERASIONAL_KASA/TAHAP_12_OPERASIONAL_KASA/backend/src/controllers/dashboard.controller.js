import { sendSuccess } from '../utils/apiResponse.js';
import { getDashboardSummary } from '../services/dashboard.service.js';

export async function summary(req, res, next) {
  try {
    const data = await getDashboardSummary({
      user: req.auth.user,
      requestedDivisionId: req.query?.divisionId || null
    });
    return sendSuccess(res, {
      message: 'Dashboard berhasil dimuat.',
      data
    });
  } catch (error) {
    return next(error);
  }
}
