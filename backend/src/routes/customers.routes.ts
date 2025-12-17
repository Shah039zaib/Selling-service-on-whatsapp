import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getCustomers,
  getCustomer,
  getCustomerMessages,
  updateCustomer,
  updateCustomerSchema,
  blockCustomer,
  unblockCustomer,
  getCustomerStats,
} from '../controllers/customers.controller.js';

const router = Router();

router.get('/', authenticate, getCustomers);
router.get('/stats', authenticate, getCustomerStats);
router.get('/:id', authenticate, getCustomer);
router.get('/:id/messages', authenticate, getCustomerMessages);
router.patch('/:id', authenticate, validate(updateCustomerSchema), updateCustomer);
router.post('/:id/block', authenticate, blockCustomer);
router.post('/:id/unblock', authenticate, unblockCustomer);

export default router;
