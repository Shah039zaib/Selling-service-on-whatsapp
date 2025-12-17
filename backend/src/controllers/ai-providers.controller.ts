import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';
import { aiService } from '../services/ai.service.js';
import { maskSensitiveData } from '../utils/helpers.js';

export const createProviderSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum(['CLAUDE', 'GEMINI', 'GROQ', 'COHERE']),
  apiKey: z.string().min(10, 'API key is required'),
  model: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateProviderSchema = createProviderSchema.omit({ type: true }).partial();

export const getProviders = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const providers = await prisma.aIProvider.findMany({
    orderBy: { priority: 'desc' },
  });

  const providersWithMaskedKeys = providers.map((p) => ({
    ...p,
    apiKey: maskSensitiveData(p.apiKey, 4),
  }));

  const stats = aiService.getProviderStats();

  res.json({
    success: true,
    data: {
      providers: providersWithMaskedKeys,
      stats,
    },
  });
});

export const getProvider = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const provider = await prisma.aIProvider.findUnique({
    where: { id },
    include: {
      usageLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!provider) {
    res.status(404).json({
      success: false,
      error: 'AI provider not found',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: maskSensitiveData(provider.apiKey, 4),
    },
  });
});

export const createProvider = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createProviderSchema>;

  const provider = await prisma.aIProvider.create({
    data: {
      name: data.name,
      type: data.type,
      apiKey: data.apiKey,
      model: data.model,
      dailyLimit: data.dailyLimit ?? 1000,
      priority: data.priority ?? 0,
      isActive: data.isActive ?? true,
    },
  });

  await aiService.reloadProviders();

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'ai_provider',
        entityId: provider.id,
        newData: { ...data, apiKey: '[REDACTED]' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: {
      ...provider,
      apiKey: maskSensitiveData(provider.apiKey, 4),
    },
    message: 'AI provider created successfully',
  });
});

export const updateProvider = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updateProviderSchema>;

  const existing = await prisma.aIProvider.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'AI provider not found',
    });
    return;
  }

  const provider = await prisma.aIProvider.update({
    where: { id },
    data,
  });

  await aiService.reloadProviders();

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'ai_provider',
        entityId: id,
        oldData: { ...existing, apiKey: '[REDACTED]' },
        newData: { ...data, apiKey: data.apiKey ? '[REDACTED]' : undefined },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: maskSensitiveData(provider.apiKey, 4),
    },
    message: 'AI provider updated successfully',
  });
});

export const deleteProvider = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.aIProvider.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'AI provider not found',
    });
    return;
  }

  await prisma.aIProvider.delete({
    where: { id },
  });

  await aiService.reloadProviders();

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'ai_provider',
        entityId: id,
        oldData: { ...existing, apiKey: '[REDACTED]' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'AI provider deleted successfully',
  });
});

export const getProviderUsage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const { days = '7' } = req.query;

  const daysNum = parseInt(days as string, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  const usage = await prisma.aIUsageLog.groupBy({
    by: ['providerId'],
    where: {
      providerId: id,
      createdAt: { gte: startDate },
    },
    _count: true,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      latencyMs: true,
    },
    _avg: {
      latencyMs: true,
    },
  });

  const dailyUsage = await prisma.$queryRaw`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      AVG(latency_ms) as avg_latency
    FROM ai_usage_logs
    WHERE provider_id = ${id} AND created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  res.json({
    success: true,
    data: {
      summary: usage[0] || null,
      daily: dailyUsage,
    },
  });
});

export const resetDailyUsage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const provider = await prisma.aIProvider.update({
    where: { id },
    data: {
      usedToday: 0,
      lastResetAt: new Date(),
    },
  });

  await aiService.reloadProviders();

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'reset_usage',
        entity: 'ai_provider',
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    data: {
      ...provider,
      apiKey: maskSensitiveData(provider.apiKey, 4),
    },
    message: 'Daily usage reset successfully',
  });
});
