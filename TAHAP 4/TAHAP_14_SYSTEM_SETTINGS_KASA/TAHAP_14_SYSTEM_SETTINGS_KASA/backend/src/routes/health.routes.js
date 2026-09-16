import { Router } from 'express';
import { healthCheck, supabaseHealthCheck } from '../controllers/health.controller.js';

const router = Router();

router.get('/', healthCheck);
router.get('/supabase', supabaseHealthCheck);

export default router;
