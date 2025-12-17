import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';
import { parsePaginationQuery, createPaginationMeta } from '../utils/helpers.js';

export const createServiceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  shortDescription: z.string().optional(),
  imageUrl: z.string().url().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const paginationSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
});

export const getServices = asyncHandler(async (
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

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      skip,
      take,
      orderBy: orderBy || { displayOrder: 'asc' },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { packages: true },
        },
      },
    }),
    prisma.service.count({ where }),
  ]);

  res.json({
    success: true,
    data: services,
    pagination: createPaginationMeta(total, query.page || 1, query.limit || 20),
  });
});

export const getService = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      packages: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!service) {
    res.status(404).json({
      success: false,
      error: 'Service not found',
    });
    return;
  }

  res.json({
    success: true,
    data: service,
  });
});

export const createService = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createServiceSchema>;

  const service = await prisma.service.create({
    data: {
      name: data.name,
      description: data.description,
      shortDescription: data.shortDescription,
      imageUrl: data.imageUrl,
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
    },
    include: {
      packages: true,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'service',
        entityId: service.id,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: service,
    message: 'Service created successfully',
  });
});

export const updateService = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updateServiceSchema>;

  const existing = await prisma.service.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Service not found',
    });
    return;
  }

  const service = await prisma.service.update({
    where: { id },
    data,
    include: {
      packages: true,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'service',
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
    data: service,
    message: 'Service updated successfully',
  });
});

export const deleteService = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.service.findUnique({
    where: { id },
    include: {
      _count: {
        select: { packages: true },
      },
    },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Service not found',
    });
    return;
  }

  if (existing._count.packages > 0) {
    res.status(400).json({
      success: false,
      error: 'Cannot delete service with existing packages. Delete packages first or deactivate the service.',
    });
    return;
  }

  await prisma.service.delete({
    where: { id },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'service',
        entityId: id,
        oldData: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'Service deleted successfully',
  });
});
