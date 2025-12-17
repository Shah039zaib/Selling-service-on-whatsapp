import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';
import { parsePaginationQuery, createPaginationMeta } from '../utils/helpers.js';

export const createPackageSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  currency: z.string().default('PKR'),
  duration: z.string().optional(),
  features: z.array(z.string()).min(1, 'At least one feature is required'),
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updatePackageSchema = createPackageSchema.omit({ serviceId: true }).partial();

export const paginationSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  serviceId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
});

export const getPackages = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const query = paginationSchema.parse(req.query);
  const { skip, take, orderBy } = parsePaginationQuery({
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy || 'displayOrder',
    sortOrder: query.sortOrder || 'asc',
  });

  const where: any = {};

  if (query.serviceId) {
    where.serviceId = query.serviceId;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const [packages, total] = await Promise.all([
    prisma.package.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { displayOrder: 'asc' },
      include: {
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    }),
    prisma.package.count({ where }),
  ]);

  res.json({
    success: true,
    data: packages,
    pagination: createPaginationMeta(total, query.page || 1, query.limit || 20),
  });
});

export const getPackage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const pkg = await prisma.package.findUnique({
    where: { id },
    include: {
      service: true,
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!pkg) {
    res.status(404).json({
      success: false,
      error: 'Package not found',
    });
    return;
  }

  res.json({
    success: true,
    data: pkg,
  });
});

export const createPackage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createPackageSchema>;

  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
  });

  if (!service) {
    res.status(404).json({
      success: false,
      error: 'Service not found',
    });
    return;
  }

  const pkg = await prisma.package.create({
    data: {
      serviceId: data.serviceId,
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      duration: data.duration,
      features: data.features,
      isPopular: data.isPopular ?? false,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
    },
    include: {
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'package',
        entityId: pkg.id,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: pkg,
    message: 'Package created successfully',
  });
});

export const updatePackage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updatePackageSchema>;

  const existing = await prisma.package.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Package not found',
    });
    return;
  }

  const pkg = await prisma.package.update({
    where: { id },
    data,
    include: {
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'package',
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
    data: pkg,
    message: 'Package updated successfully',
  });
});

export const deletePackage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.package.findUnique({
    where: { id },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Package not found',
    });
    return;
  }

  if (existing._count.orders > 0) {
    res.status(400).json({
      success: false,
      error: 'Cannot delete package with existing orders. Deactivate it instead.',
    });
    return;
  }

  await prisma.package.delete({
    where: { id },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'package',
        entityId: id,
        oldData: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'Package deleted successfully',
  });
});
