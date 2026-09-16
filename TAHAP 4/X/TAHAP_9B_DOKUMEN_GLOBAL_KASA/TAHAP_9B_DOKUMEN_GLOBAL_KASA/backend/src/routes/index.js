import { Router } from 'express';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import fileManagerRoutes from './fileManager.routes.js';
import documentsRoutes from './documents.routes.js';

const router = Router();

router.get('/', (_req, res) => sendSuccess(res, {
  message: 'KASA Digital Archive API',
  data: {
    app: env.appName,
    company: env.companyName,
    version: env.appVersion,
    healthEndpoint: `${env.apiPrefix}/health`,
    authEndpoint: `${env.apiPrefix}/auth`,
    dashboardEndpoint: `${env.apiPrefix}/dashboard`,
    fileManagerEndpoint: `${env.apiPrefix}/file-manager`,
    documentsEndpoint: `${env.apiPrefix}/documents`
  }
}));

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/file-manager', fileManagerRoutes);
router.use('/documents', documentsRoutes);

export default router;
