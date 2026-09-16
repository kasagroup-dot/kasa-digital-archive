import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/documentEngine.controller.js';

const router = Router();
router.use(authenticate);
router.get('/:documentId/preview', controller.preview);
router.get('/:documentId/download', controller.download);
router.get('/:documentId/versions', controller.versions);
router.get('/:documentId/versions/:versionId/download', controller.download);
router.patch('/:documentId/rename', controller.rename);
router.patch('/:documentId/move', controller.move);
router.post('/:documentId/favorite', controller.favorite);
router.delete('/:documentId', controller.remove);

export default router;
