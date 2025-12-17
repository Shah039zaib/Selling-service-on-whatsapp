import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getPaymentConfigs,
  getPaymentConfig,
  createPaymentConfig,
  createPaymentConfigSchema,
  updatePaymentConfig,
  updatePaymentConfigSchema,
  deletePaymentConfig,
  getActivePaymentMethods,
} from '../controllers/payment-config.controller.js';

const router = Router();

router.get('/', authenticate, getPaymentConfigs);
router.get('/active', authenticate, getActivePaymentMethods);
router.get('/:id', authenticate, getPaymentConfig);
router.post('/', authenticate, validate(createPaymentConfigSchema), createPaymentConfig);
router.patch('/:id', authenticate, validate(updatePaymentConfigSchema), updatePaymentConfig);
router.delete('/:id', authenticate, deletePaymentConfig);

export default router;
