import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { authLimiter } from '../middleware/rate-limit.middleware.js';
import {
  login,
  loginSchema,
  register,
  registerSchema,
  getProfile,
  changePassword,
  changePasswordSchema,
  logout,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', authLimiter, validate(registerSchema), register);
router.get('/profile', authenticate, getProfile);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/logout', authenticate, logout);

export default router;
