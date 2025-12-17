import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getAccounts,
  getAccount,
  createAccount,
  createAccountSchema,
  updateAccount,
  updateAccountSchema,
  deleteAccount,
  connectAccount,
  disconnectAccount,
  getAccountQR,
  sendMessage,
  sendMessageSchema,
  getActiveAccounts,
} from '../controllers/whatsapp.controller.js';

const router = Router();

router.get('/', authenticate, getAccounts);
router.get('/active', authenticate, getActiveAccounts);
router.get('/:id', authenticate, getAccount);
router.get('/:id/qr', authenticate, getAccountQR);
router.post('/', authenticate, validate(createAccountSchema), createAccount);
router.patch('/:id', authenticate, validate(updateAccountSchema), updateAccount);
router.delete('/:id', authenticate, deleteAccount);
router.post('/:id/connect', authenticate, connectAccount);
router.post('/:id/disconnect', authenticate, disconnectAccount);
router.post('/:id/send', authenticate, validate(sendMessageSchema), sendMessage);

export default router;
