import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getProviders,
  getProvider,
  createProvider,
  createProviderSchema,
  updateProvider,
  updateProviderSchema,
  deleteProvider,
  getProviderUsage,
  resetDailyUsage,
} from '../controllers/ai-providers.controller.js';

const router = Router();

router.get('/', authenticate, getProviders);
router.get('/:id', authenticate, getProvider);
router.get('/:id/usage', authenticate, getProviderUsage);
router.post('/', authenticate, validate(createProviderSchema), createProvider);
router.patch('/:id', authenticate, validate(updateProviderSchema), updateProvider);
router.delete('/:id', authenticate, deleteProvider);
router.post('/:id/reset-usage', authenticate, resetDailyUsage);

export default router;
