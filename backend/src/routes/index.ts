import { Router } from 'express';
import authRoutes from './auth.routes.js';
import servicesRoutes from './services.routes.js';
import packagesRoutes from './packages.routes.js';
import ordersRoutes from './orders.routes.js';
import customersRoutes from './customers.routes.js';
import whatsappRoutes from './whatsapp.routes.js';
import aiProvidersRoutes from './ai-providers.routes.js';
import paymentConfigRoutes from './payment-config.routes.js';
import templatesRoutes from './templates.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/services', servicesRoutes);
router.use('/packages', packagesRoutes);
router.use('/orders', ordersRoutes);
router.use('/customers', customersRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/ai-providers', aiProvidersRoutes);
router.use('/payment-config', paymentConfigRoutes);
router.use('/templates', templatesRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
