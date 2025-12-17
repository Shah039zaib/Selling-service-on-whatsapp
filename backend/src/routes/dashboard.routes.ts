import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getDashboardStats,
  getRecentActivity,
  getAnalytics,
  getAuditLogs,
  getSystemHealth,
} from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/stats', authenticate, getDashboardStats);
router.get('/activity', authenticate, getRecentActivity);
router.get('/analytics', authenticate, getAnalytics);
router.get('/audit-logs', authenticate, getAuditLogs);
router.get('/health', authenticate, getSystemHealth);

export default router;
