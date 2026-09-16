import { Router } from 'express';
import { getRuntimeSettings } from '../services/runtimeSettings.service.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/status', async (_req, res, next) => {
  try {
    const runtime = await getRuntimeSettings({ force: true });
    return sendSuccess(res, {
      message: 'Runtime status siap.',
      data: {
        appVersion: env.appVersion,
        maintenance: {
          enabled: runtime.maintenanceMode,
          message: runtime.maintenanceMessage
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
