import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  variables: z.array(z.string()).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createSystemPromptSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  content: z.string().min(50, 'Content must be at least 50 characters'),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateSystemPromptSchema = createSystemPromptSchema.partial();

export const getTemplates = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { category, isActive } = req.query;

  const where: any = {};

  if (category) {
    where.category = category;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const templates = await prisma.messageTemplate.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: templates,
  });
});

export const getTemplate = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const template = await prisma.messageTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    res.status(404).json({
      success: false,
      error: 'Template not found',
    });
    return;
  }

  res.json({
    success: true,
    data: template,
  });
});

export const createTemplate = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createTemplateSchema>;

  const existing = await prisma.messageTemplate.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: 'A template with this name already exists',
    });
    return;
  }

  const template = await prisma.messageTemplate.create({
    data: {
      name: data.name,
      content: data.content,
      variables: data.variables || [],
      description: data.description,
      category: data.category,
      isActive: data.isActive ?? true,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'message_template',
        entityId: template.id,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: template,
    message: 'Template created successfully',
  });
});

export const updateTemplate = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updateTemplateSchema>;

  const existing = await prisma.messageTemplate.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Template not found',
    });
    return;
  }

  if (data.name && data.name !== existing.name) {
    const nameExists = await prisma.messageTemplate.findUnique({
      where: { name: data.name },
    });

    if (nameExists) {
      res.status(409).json({
        success: false,
        error: 'A template with this name already exists',
      });
      return;
    }
  }

  const template = await prisma.messageTemplate.update({
    where: { id },
    data,
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'message_template',
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
    data: template,
    message: 'Template updated successfully',
  });
});

export const deleteTemplate = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.messageTemplate.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Template not found',
    });
    return;
  }

  await prisma.messageTemplate.delete({
    where: { id },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'message_template',
        entityId: id,
        oldData: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'Template deleted successfully',
  });
});

export const getSystemPrompts = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const prompts = await prisma.systemPrompt.findMany({
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: prompts,
  });
});

export const getSystemPrompt = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const prompt = await prisma.systemPrompt.findUnique({
    where: { id },
  });

  if (!prompt) {
    res.status(404).json({
      success: false,
      error: 'System prompt not found',
    });
    return;
  }

  res.json({
    success: true,
    data: prompt,
  });
});

export const createSystemPrompt = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createSystemPromptSchema>;

  const existing = await prisma.systemPrompt.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: 'A system prompt with this name already exists',
    });
    return;
  }

  const prompt = await prisma.systemPrompt.create({
    data: {
      name: data.name,
      content: data.content,
      description: data.description,
      isActive: data.isActive ?? true,
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'system_prompt',
        entityId: prompt.id,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: prompt,
    message: 'System prompt created successfully',
  });
});

export const updateSystemPrompt = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updateSystemPromptSchema>;

  const existing = await prisma.systemPrompt.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'System prompt not found',
    });
    return;
  }

  const prompt = await prisma.systemPrompt.update({
    where: { id },
    data,
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'system_prompt',
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
    data: prompt,
    message: 'System prompt updated successfully',
  });
});

export const deleteSystemPrompt = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.systemPrompt.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'System prompt not found',
    });
    return;
  }

  await prisma.systemPrompt.delete({
    where: { id },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'system_prompt',
        entityId: id,
        oldData: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'System prompt deleted successfully',
  });
});
