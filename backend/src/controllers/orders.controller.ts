import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse, OrderStatus } from '../types/index.js';
import { parsePaginationQuery, createPaginationMeta } from '../utils/helpers.js';
import { conversationService } from '../services/conversation.service.js';

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAYMENT_SUBMITTED', 'PAID', 'REJECTED', 'CANCELLED', 'COMPLETED', 'REFUNDED']),
  adminNotes: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  status: z.enum(['PENDING', 'PAYMENT_SUBMITTED', 'PAID', 'REJECTED', 'CANCELLED', 'COMPLETED', 'REFUNDED']).optional(),
  customerId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const getOrders = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const query = paginationSchema.parse(req.query);
  const { skip, take, orderBy } = parsePaginationQuery({
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder || 'desc',
  });

  const where: any = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.packageId) {
    where.packageId = query.packageId;
  }

  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: 'insensitive' } },
      { customer: { phoneNumber: { contains: query.search } } },
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      where.createdAt.gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      where.createdAt.lte = new Date(query.dateTo);
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        actions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    success: true,
    data: orders,
    pagination: createPaginationMeta(total, query.page || 1, query.limit || 20),
  });
});

export const getOrder = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      package: {
        include: {
          service: true,
        },
      },
      actions: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    res.status(404).json({
      success: false,
      error: 'Order not found',
    });
    return;
  }

  res.json({
    success: true,
    data: order,
  });
});

export const updateOrderStatus = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const id = req.params.id as string;
  const { status, adminNotes } = req.body as z.infer<typeof updateOrderStatusSchema>;

  const existing = await prisma.order.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Order not found',
    });
    return;
  }

  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['PAYMENT_SUBMITTED', 'CANCELLED'],
    PAYMENT_SUBMITTED: ['PAID', 'REJECTED', 'CANCELLED'],
    PAID: ['COMPLETED', 'REFUNDED'],
    REJECTED: ['PENDING', 'CANCELLED'],
    CANCELLED: [],
    COMPLETED: ['REFUNDED'],
    REFUNDED: [],
  };

  const allowedTransitions = validTransitions[existing.status as OrderStatus] || [];

  if (!allowedTransitions.includes(status as OrderStatus)) {
    res.status(400).json({
      success: false,
      error: `Cannot transition from ${existing.status} to ${status}`,
    });
    return;
  }

  await conversationService.updateOrderStatus(
    id,
    status as OrderStatus,
    req.user?.id ?? '',
    adminNotes
  );

  const updatedOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      package: {
        include: {
          service: true,
        },
      },
      actions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  res.json({
    success: true,
    data: updatedOrder,
    message: 'Order status updated successfully',
  });
});

export const getOrderStats = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const [
    totalOrders,
    pendingOrders,
    paidOrders,
    completedOrders,
    totalRevenue,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { amount: true },
    }),
  ]);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const recentOrders = await prisma.order.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: { gte: last7Days },
    },
    _count: true,
  });

  res.json({
    success: true,
    data: {
      totalOrders,
      pendingOrders,
      paidOrders,
      completedOrders,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      recentOrdersCount: recentOrders.length,
    },
  });
});
