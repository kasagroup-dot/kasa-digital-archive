import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import * as controller from '../controllers/system.controller.js';

const router = Router();
router.use(authenticate, requireSuperAdmin);
router.get('/settings', controller.settings);
router.patch('/settings', controller.updateSettings);
router.get('/status', controller.status);
router.post('/sessions/cleanup', controller.cleanupSessions);
export default router;
