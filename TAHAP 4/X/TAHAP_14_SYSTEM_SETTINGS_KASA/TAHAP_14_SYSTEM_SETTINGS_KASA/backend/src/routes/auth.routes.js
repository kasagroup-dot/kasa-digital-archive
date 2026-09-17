import { Router } from 'express';
import { assertAuthEnv } from '../config/env.js';
import { authenticate } from '../middleware/authenticate.js';
import { forgotPasswordRateLimit, loginRateLimit } from '../middleware/authRateLimit.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.use((_req, _res, next) => {
  try {
    assertAuthEnv();
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/login', loginRateLimit, authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', forgotPasswordRateLimit, authController.forgotPassword);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

export default router;
