import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate);
router.get('/summary', dashboardController.summary);

export default router;
