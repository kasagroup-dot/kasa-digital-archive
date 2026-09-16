import { Router } from 'express';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.get('/', (_req, res) => sendSuccess(res, {
  message: 'KASA Digital Archive API',
  data: {
    app: env.appName,
    company: env.companyName,
    version: env.appVersion,
    healthEndpoint: `${env.apiPrefix}/health`,
    authEndpoint: `${env.apiPrefix}/auth`,
    dashboardEndpoint: `${env.apiPrefix}/dashboard`
  }
}));

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
