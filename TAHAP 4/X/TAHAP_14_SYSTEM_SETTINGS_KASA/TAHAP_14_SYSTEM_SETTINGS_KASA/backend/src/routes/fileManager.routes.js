import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/fileManager.controller.js';

const router = Router();
router.use(authenticate);
router.get('/divisions', controller.divisions);
router.get('/contents', controller.contents);
router.get('/tree', controller.tree);
router.post('/folders', controller.createFolderAction);
router.patch('/folders/:folderId/rename', controller.renameFolderAction);
router.patch('/folders/:folderId/move', controller.moveFolderAction);
router.delete('/folders/:folderId', controller.deleteFolderAction);
router.post('/folders/:folderId/unlock', controller.unlockFolderAction);
router.put('/folders/:folderId/password', controller.setFolderPasswordAction);
router.delete('/folders/:folderId/password', controller.removeFolderPasswordAction);
export default router;
