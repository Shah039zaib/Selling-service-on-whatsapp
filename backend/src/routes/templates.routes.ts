import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  createTemplateSchema,
  updateTemplate,
  updateTemplateSchema,
  deleteTemplate,
  getSystemPrompts,
  getSystemPrompt,
  createSystemPrompt,
  createSystemPromptSchema,
  updateSystemPrompt,
  updateSystemPromptSchema,
  deleteSystemPrompt,
} from '../controllers/templates.controller.js';

const router = Router();

router.get('/messages', authenticate, getTemplates);
router.get('/messages/:id', authenticate, getTemplate);
router.post('/messages', authenticate, validate(createTemplateSchema), createTemplate);
router.patch('/messages/:id', authenticate, validate(updateTemplateSchema), updateTemplate);
router.delete('/messages/:id', authenticate, deleteTemplate);

router.get('/prompts', authenticate, getSystemPrompts);
router.get('/prompts/:id', authenticate, getSystemPrompt);
router.post('/prompts', authenticate, validate(createSystemPromptSchema), createSystemPrompt);
router.patch('/prompts/:id', authenticate, validate(updateSystemPromptSchema), updateSystemPrompt);
router.delete('/prompts/:id', authenticate, deleteSystemPrompt);

export default router;
