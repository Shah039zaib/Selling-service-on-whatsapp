import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';

export const createPaymentConfigSchema = z.object({
  method: z.enum(['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER']),
  accountTitle: z.string().min(2, 'Account title is required'),
  accountNumber: z.string().min(5, 'Account number is required'),
  bankName: z.string().optional(),
  instructions: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updatePaymentConfigSchema = createPaymentConfigSchema.omit({ method: true }).partial();

export const getPaymentConfigs = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const configs = await prisma.paymentConfig.findMany({
    orderBy: { method: 'asc' },
  });

  res.json({
    success: true,
    data: configs,
  });
});

export const getPaymentConfig = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const config = await prisma.paymentConfig.findUnique({
    where: { id },
  });

  if (!config) {
    res.status(404).json({
      success: false,
      error: 'Payment configuration not found',
    });
    return;
  }

  res.json({
    success: true,
    data: config,
  });
});

export const createPaymentConfig = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createPaymentConfigSchema>;

  const existing = await prisma.paymentConfig.findUnique({
    where: { method: data.method },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: 'Payment configuration for this method already exists',
    });
    return;
  }

  const config = await prisma.paymentConfig.create({
    data: {
      method: data.method,
      accountTitle: data.accountTitle,
      accountNumber: data.accountNumber,
      bankName: data.bankName,
      instructions: data.instructions,
      isActive: data.isActive ?? true,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'payment_config',
        entityId: config.id,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: config,
    message: 'Payment configuration created successfully',
  });
});

export const updatePaymentConfig = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updatePaymentConfigSchema>;

  const existing = await prisma.paymentConfig.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Payment configuration not found',
    });
    return;
  }

  const config = await prisma.paymentConfig.update({
    where: { id },
    data,
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'payment_config',
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
    data: config,
    message: 'Payment configuration updated successfully',
  });
});

export const deletePaymentConfig = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.paymentConfig.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Payment configuration not found',
    });
    return;
  }

  await prisma.paymentConfig.delete({
    where: { id },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'payment_config',
        entityId: id,
        oldData: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'Payment configuration deleted successfully',
  });
});

export const getActivePaymentMethods = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const configs = await prisma.paymentConfig.findMany({
    where: { isActive: true },
    select: {
      id: true,
      method: true,
      accountTitle: true,
      accountNumber: true,
      bankName: true,
      instructions: true,
    },
  });

  res.json({
    success: true,
    data: configs,
  });
});
