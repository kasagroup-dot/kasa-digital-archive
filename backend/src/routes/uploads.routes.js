import express, { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/documentEngine.controller.js';

const router = Router();
router.use(authenticate);
router.post('/preflight', controller.duplicatePreflight);
router.post('/resumable/start', controller.startUpload);
router.put('/resumable/:uploadId/chunk', express.raw({ type: 'application/octet-stream', limit: '5mb' }), controller.chunkUpload);
router.delete('/resumable/:uploadId', controller.cancel);

export default router;
