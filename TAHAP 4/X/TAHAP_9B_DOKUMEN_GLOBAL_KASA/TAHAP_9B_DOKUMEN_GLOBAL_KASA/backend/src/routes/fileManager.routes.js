import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/fileManager.controller.js';

const router = Router();
router.use(authenticate);
router.get('/divisions', controller.divisions);
router.get('/contents', controller.contents);
router.get('/tree', controller.tree);
export default router;
