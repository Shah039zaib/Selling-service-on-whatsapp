import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getServices,
  getService,
  createService,
  createServiceSchema,
  updateService,
  updateServiceSchema,
  deleteService,
} from '../controllers/services.controller.js';

const router = Router();

router.get('/', authenticate, getServices);
router.get('/:id', authenticate, getService);
router.post('/', authenticate, validate(createServiceSchema), createService);
router.patch('/:id', authenticate, validate(updateServiceSchema), updateService);
router.delete('/:id', authenticate, deleteService);

export default router;
