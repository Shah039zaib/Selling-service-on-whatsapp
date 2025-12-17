import { Response } from 'express';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { aiService } from '../services/ai.service.js';
import { socketService } from '../websocket/socket.service.js';

export const getDashboardStats = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    newCustomersToday,
    totalOrders,
    pendingOrders,
    paymentSubmittedOrders,
    revenueResult,
    messagesLast24h,
    activeConversations,
    connectedAccounts,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({
      where: { createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'PAYMENT_SUBMITTED' } }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { amount: true },
    }),
    prisma.message.count({ where: { createdAt: { gte: last24h } } }),
    prisma.conversation.count({ where: { status: 'ACTIVE' } }),
    prisma.whatsAppAccount.count({ where: { status: 'CONNECTED' } }),
  ]);

  const ordersLast7Days = await prisma.$queryRaw<
    { date: Date; count: bigint; revenue: number }[]
  >`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN status IN ('PAID', 'COMPLETED') THEN amount ELSE 0 END), 0) as revenue
    FROM orders
    WHERE created_at >= ${last7d}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  const topServices = await prisma.$queryRaw<
    { service_id: string; service_name: string; order_count: bigint; revenue: number }[]
  >`
    SELECT
      s.id as service_id,
      s.name as service_name,
      COUNT(o.id) as order_count,
      COALESCE(SUM(CASE WHEN o.status IN ('PAID', 'COMPLETED') THEN o.amount ELSE 0 END), 0) as revenue
    FROM services s
    LEFT JOIN packages p ON p.service_id = s.id
    LEFT JOIN orders o ON o.package_id = p.id
    GROUP BY s.id, s.name
    ORDER BY order_count DESC
    LIMIT 5
  `;

  const aiStats = aiService.getProviderStats();
  const activeWhatsAppAccounts = whatsappService.getActiveAccounts();
  const connectedClients = socketService.getConnectedClients();

  res.json({
    success: true,
    data: {
      overview: {
        totalCustomers,
        newCustomersToday,
        totalOrders,
        pendingOrders,
        paymentSubmittedOrders,
        totalRevenue: Number(revenueResult._sum.amount || 0),
        messagesLast24h,
        activeConversations,
      },
      whatsapp: {
        connectedAccounts,
        activeAccounts: activeWhatsAppAccounts.length,
      },
      ai: {
        providers: aiStats,
        totalProviders: aiStats.length,
        availableProviders: aiStats.filter((p) => p.available).length,
      },
      realtime: {
        connectedClients,
      },
      trends: {
        ordersLast7Days: ordersLast7Days.map((d) => ({
          date: d.date.toISOString().split('T')[0],
          count: Number(d.count),
          revenue: Number(d.revenue),
        })),
        topServices: topServices.map((s) => ({
          serviceId: s.service_id,
          serviceName: s.service_name,
          orderCount: Number(s.order_count),
          revenue: Number(s.revenue),
        })),
      },
    },
  });
});

export const getRecentActivity = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { limit = '20' } = req.query;
  const limitNum = parseInt(limit as string, 10);

  const [recentOrders, recentMessages, recentCustomers] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      include: {
        customer: {
          select: { id: true, phoneNumber: true, name: true },
        },
        package: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.message.findMany({
      where: { direction: 'INBOUND' },
      orderBy: { timestamp: 'desc' },
      take: limitNum,
      include: {
        customer: {
          select: { id: true, phoneNumber: true, name: true },
        },
      },
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        createdAt: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      recentOrders,
      recentMessages,
      recentCustomers,
    },
  });
});

export const getAnalytics = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { period = '30' } = req.query;
  const days = parseInt(period as string, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [
    ordersByStatus,
    ordersByPaymentMethod,
    customerGrowth,
    messageVolume,
    aiUsage,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: startDate } },
    }),
    prisma.order.groupBy({
      by: ['paymentMethod'],
      _count: true,
      where: {
        createdAt: { gte: startDate },
        paymentMethod: { not: null },
      },
    }),
    prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM customers
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
    prisma.$queryRaw<{ date: Date; inbound: bigint; outbound: bigint }[]>`
      SELECT
        DATE(timestamp) as date,
        SUM(CASE WHEN direction = 'INBOUND' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'OUTBOUND' THEN 1 ELSE 0 END) as outbound
      FROM messages
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `,
    prisma.$queryRaw<{ date: Date; provider_id: string; count: bigint; tokens: bigint }[]>`
      SELECT
        DATE(created_at) as date,
        provider_id,
        COUNT(*) as count,
        SUM(input_tokens + output_tokens) as tokens
      FROM ai_usage_logs
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at), provider_id
      ORDER BY date ASC
    `,
  ]);

  res.json({
    success: true,
    data: {
      ordersByStatus: ordersByStatus.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      ordersByPaymentMethod: ordersByPaymentMethod.map((o) => ({
        method: o.paymentMethod,
        count: o._count,
      })),
      customerGrowth: customerGrowth.map((c) => ({
        date: c.date.toISOString().split('T')[0],
        count: Number(c.count),
      })),
      messageVolume: messageVolume.map((m) => ({
        date: m.date.toISOString().split('T')[0],
        inbound: Number(m.inbound),
        outbound: Number(m.outbound),
      })),
      aiUsage: aiUsage.map((a) => ({
        date: a.date.toISOString().split('T')[0],
        providerId: a.provider_id,
        count: Number(a.count),
        tokens: Number(a.tokens),
      })),
    },
  });
});

export const getAuditLogs = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { page = '1', limit = '50', entity, action, userId } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const where: any = {};

  if (entity) {
    where.entity = entity;
  }

  if (action) {
    where.action = action;
  }

  if (userId) {
    where.userId = userId;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export const getSystemHealth = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const startTime = Date.now();

  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const whatsappAccounts = await prisma.whatsAppAccount.findMany({
    select: { id: true, name: true, status: true },
  });

  const aiProviders = aiService.getProviderStats();

  res.json({
    success: true,
    data: {
      status: dbHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      latency: Date.now() - startTime,
      services: {
        database: dbHealthy ? 'up' : 'down',
        whatsapp: {
          accounts: whatsappAccounts,
          connected: whatsappAccounts.filter((a) => a.status === 'CONNECTED').length,
        },
        ai: {
          providers: aiProviders,
          available: aiProviders.filter((p) => p.available).length,
        },
        websocket: {
          clients: socketService.getConnectedClients(),
        },
      },
    },
  });
});
