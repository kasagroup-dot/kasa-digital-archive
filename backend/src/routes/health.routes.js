import { Router } from 'express';
import { googleDriveHealthCheck, healthCheck, supabaseHealthCheck } from '../controllers/health.controller.js';

const router = Router();

router.get('/', healthCheck);
router.get('/supabase', supabaseHealthCheck);
router.get('/drive', googleDriveHealthCheck);

export default router;
