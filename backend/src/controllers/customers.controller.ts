import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';
import { parsePaginationQuery, createPaginationMeta } from '../utils/helpers.js';

export const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  language: z.string().optional(),
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  isBlocked: z.string().transform((v) => v === 'true').optional(),
});

export const getCustomers = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const query = paginationSchema.parse(req.query);
  const { skip, take, orderBy } = parsePaginationQuery({
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy || 'lastMessageAt',
    sortOrder: query.sortOrder || 'desc',
  });

  const where: any = {};

  if (query.search) {
    where.OR = [
      { phoneNumber: { contains: query.search } },
      { name: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.isBlocked !== undefined) {
    where.isBlocked = query.isBlocked;
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { lastMessageAt: 'desc' },
      include: {
        _count: {
          select: {
            orders: true,
            messages: true,
          },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({
    success: true,
    data: customers,
    pagination: createPaginationMeta(total, query.page || 1, query.limit || 20),
  });
});

export const getCustomer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          package: {
            include: {
              service: true,
            },
          },
        },
      },
      conversations: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: {
        select: {
          orders: true,
          messages: true,
        },
      },
    },
  });

  if (!customer) {
    res.status(404).json({
      success: false,
      error: 'Customer not found',
    });
    return;
  }

  res.json({
    success: true,
    data: customer,
  });
});

export const getCustomerMessages = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const { page = '1', limit = '50' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer) {
    res.status(404).json({
      success: false,
      error: 'Customer not found',
    });
    return;
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { customerId: id },
      orderBy: { timestamp: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.message.count({ where: { customerId: id } }),
  ]);

  res.json({
    success: true,
    data: messages.reverse(),
    pagination: createPaginationMeta(total, pageNum, limitNum),
  });
});

export const updateCustomer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updateCustomerSchema>;

  const existing = await prisma.customer.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Customer not found',
    });
    return;
  }

  const customer = await prisma.customer.update({
    where: { id },
    data,
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'customer',
        entityId: id,
        oldData: existing,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    data: customer,
    message: 'Customer updated successfully',
  });
});

export const blockCustomer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const { reason } = req.body;

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      isBlocked: true,
      blockReason: reason,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'block',
        entity: 'customer',
        entityId: id,
        newData: { reason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    data: customer,
    message: 'Customer blocked successfully',
  });
});

export const unblockCustomer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      isBlocked: false,
      blockReason: null,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'unblock',
        entity: 'customer',
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    data: customer,
    message: 'Customer unblocked successfully',
  });
});

export const getCustomerStats = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const [
    totalCustomers,
    activeCustomers,
    blockedCustomers,
    customersToday,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({
      where: {
        lastMessageAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.customer.count({ where: { isBlocked: true } }),
    prisma.customer.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalCustomers,
      activeCustomers,
      blockedCustomers,
      customersToday,
    },
  });
});
