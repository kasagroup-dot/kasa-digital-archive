import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/operations.controller.js';

const router = Router();
router.use(authenticate);
router.get('/recent', controller.recent);
router.get('/favorites', controller.favorites);
router.get('/recycle', controller.recycle);
router.post('/recycle/documents/:documentId/restore', controller.restoreDoc);
router.delete('/recycle/documents/:documentId/permanent', controller.purgeDoc);
router.post('/recycle/folders/:folderId/restore', controller.restoreFld);
router.delete('/recycle/folders/:folderId/permanent', controller.purgeFld);
router.get('/activity', controller.activity);
export default router;
