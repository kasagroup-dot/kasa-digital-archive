import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import * as controller from '../controllers/admin.controller.js';

const router = Router();
router.use(authenticate, requireSuperAdmin);

router.get('/users', controller.users);
router.post('/users', controller.createUser);
router.get('/users/:userId', controller.userDetail);
router.patch('/users/:userId', controller.updateUser);
router.post('/users/:userId/reset-password', controller.resetPassword);
router.post('/users/:userId/revoke-sessions', controller.revokeSessions);
router.get('/users/:userId/permissions', controller.permissions);
router.put('/users/:userId/permissions', controller.updatePermissions);

router.get('/password-reset-requests', controller.resetRequests);
router.post('/password-reset-requests/:requestId/cancel', controller.cancelResetRequest);

export default router;
