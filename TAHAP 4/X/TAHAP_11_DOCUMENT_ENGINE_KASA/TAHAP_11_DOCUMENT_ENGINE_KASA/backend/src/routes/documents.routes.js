import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/documents.controller.js';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.get('/:documentId', controller.detail);

export default router;
