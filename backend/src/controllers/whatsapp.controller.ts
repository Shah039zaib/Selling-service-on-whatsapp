import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthenticatedRequest, APIResponse } from '../types/index.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { conversationService } from '../services/conversation.service.js';

export const createAccountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  isDefault: z.boolean().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  isDefault: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  content: z.string().min(1, 'Message content is required'),
});

export const getAccounts = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const accounts = await prisma.whatsAppAccount.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          customers: true,
          messages: true,
        },
      },
    },
  });

  const accountsWithState = accounts.map((account) => ({
    ...account,
    connectionState: whatsappService.getConnectionState(account.id),
  }));

  res.json({
    success: true,
    data: accountsWithState,
  });
});

export const getAccount = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          customers: true,
          messages: true,
        },
      },
    },
  });

  if (!account) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      ...account,
      connectionState: whatsappService.getConnectionState(id),
    },
  });
});

export const createAccount = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const data = req.body as z.infer<typeof createAccountSchema>;

  if (data.isDefault) {
    await prisma.whatsAppAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const account = await prisma.whatsAppAccount.create({
    data: {
      name: data.name,
      isDefault: data.isDefault ?? false,
      status: 'DISCONNECTED',
    },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'create',
        entity: 'whatsapp_account',
        entityId: account.id,
        newData: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.status(201).json({
    success: true,
    data: account,
    message: 'WhatsApp account created. Connect it to start receiving messages.',
  });
});

export const updateAccount = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const data = req.body as z.infer<typeof updateAccountSchema>;

  const existing = await prisma.whatsAppAccount.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  if (data.isDefault) {
    await prisma.whatsAppAccount.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const account = await prisma.whatsAppAccount.update({
    where: { id },
    data,
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'update',
        entity: 'whatsapp_account',
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
    data: account,
    message: 'WhatsApp account updated successfully',
  });
});

export const deleteAccount = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.whatsAppAccount.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  await whatsappService.disconnectAccount(id);

  await prisma.whatsAppAccount.delete({
    where: { id },
  });

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'delete',
        entity: 'whatsapp_account',
        entityId: id,
        oldData: existing,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'WhatsApp account deleted successfully',
  });
});

export const connectAccount = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
  });

  if (!account) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  if (account.status === 'CONNECTED') {
    res.status(400).json({
      success: false,
      error: 'Account is already connected',
    });
    return;
  }

  await whatsappService.initializeAccount(id);

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'connect',
        entity: 'whatsapp_account',
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'Connection initiated. Scan the QR code when it appears.',
  });
});

export const disconnectAccount = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
  });

  if (!account) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  await whatsappService.disconnectAccount(id);

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'disconnect',
        entity: 'whatsapp_account',
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  res.json({
    success: true,
    message: 'Account disconnected successfully',
  });
});

export const getAccountQR = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
    select: { qrCode: true, status: true },
  });

  if (!account) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      qrCode: account.qrCode,
      status: account.status,
    },
  });
});

export const sendMessage = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const { id } = req.params;
  const { customerId, content } = req.body as z.infer<typeof sendMessageSchema>;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
  });

  if (!account) {
    res.status(404).json({
      success: false,
      error: 'WhatsApp account not found',
    });
    return;
  }

  if (account.status !== 'CONNECTED') {
    res.status(400).json({
      success: false,
      error: 'WhatsApp account is not connected',
    });
    return;
  }

  await conversationService.sendManualMessage(id, customerId, content);

  res.json({
    success: true,
    message: 'Message sent successfully',
  });
});

export const getActiveAccounts = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<APIResponse>
): Promise<void> => {
  const activeAccountIds = whatsappService.getActiveAccounts();

  res.json({
    success: true,
    data: {
      activeAccounts: activeAccountIds,
      count: activeAccountIds.length,
    },
  });
});
