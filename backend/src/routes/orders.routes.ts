import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrderStatusSchema,
  getOrderStats,
} from '../controllers/orders.controller.js';

const router = Router();

router.get('/', authenticate, getOrders);
router.get('/stats', authenticate, getOrderStats);
router.get('/:id', authenticate, getOrder);
router.patch('/:id/status', authenticate, validate(updateOrderStatusSchema), updateOrderStatus);

export default router;
