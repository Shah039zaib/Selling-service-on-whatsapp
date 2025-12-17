import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getPackages,
  getPackage,
  createPackage,
  createPackageSchema,
  updatePackage,
  updatePackageSchema,
  deletePackage,
} from '../controllers/packages.controller.js';

const router = Router();

router.get('/', authenticate, getPackages);
router.get('/:id', authenticate, getPackage);
router.post('/', authenticate, validate(createPackageSchema), createPackage);
router.patch('/:id', authenticate, validate(updatePackageSchema), updatePackage);
router.delete('/:id', authenticate, deletePackage);

export default router;
