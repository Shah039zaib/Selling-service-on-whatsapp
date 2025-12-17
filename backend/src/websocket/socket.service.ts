import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger, createChildLogger } from '../utils/logger.js';
import { prisma } from '../config/database.js';
import { JWTPayload, SocketEvents } from '../types/index.js';
import { whatsappService } from '../services/whatsapp.service.js';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
  userRole: string;
}

class SocketService {
  private io: Server | null = null;
  private authenticatedSockets: Map<string, AuthenticatedSocket> = new Map();

  initialize(httpServer: HTTPServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN.split(','),
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        (socket as AuthenticatedSocket).userId = payload.userId;
        (socket as AuthenticatedSocket).userEmail = payload.email;
        (socket as AuthenticatedSocket).userRole = payload.role;

        next();
      } catch (error) {
        logger.error({ error }, 'Socket authentication failed');
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket as AuthenticatedSocket);
    });

    this.setupWhatsAppEventForwarding();

    logger.info('Socket.io service initialized');
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const log = createChildLogger({
      socketId: socket.id,
      userId: socket.userId,
      service: 'socket',
    });

    log.info('Client connected');

    this.authenticatedSockets.set(socket.id, socket);

    socket.join('admins');

    socket.on('subscribe:customer', async (customerId: string) => {
      socket.join(`customer:${customerId}`);
      log.debug({ customerId }, 'Subscribed to customer room');
    });

    socket.on('unsubscribe:customer', (customerId: string) => {
      socket.leave(`customer:${customerId}`);
      log.debug({ customerId }, 'Unsubscribed from customer room');
    });

    socket.on('subscribe:whatsapp', async (accountId: string) => {
      socket.join(`whatsapp:${accountId}`);
      log.debug({ accountId }, 'Subscribed to WhatsApp account room');

      const state = whatsappService.getConnectionState(accountId);
      if (state) {
        socket.emit('whatsapp:status', state);
      }
    });

    socket.on('unsubscribe:whatsapp', (accountId: string) => {
      socket.leave(`whatsapp:${accountId}`);
    });

    socket.on('whatsapp:init', async (accountId: string) => {
      try {
        await whatsappService.initializeAccount(accountId);
        socket.emit('whatsapp:init:success', { accountId });
      } catch (error) {
        socket.emit('whatsapp:init:error', {
          accountId,
          error: (error as Error).message,
        });
      }
    });

    socket.on('whatsapp:disconnect', async (accountId: string) => {
      try {
        await whatsappService.disconnectAccount(accountId);
        socket.emit('whatsapp:disconnect:success', { accountId });
      } catch (error) {
        socket.emit('whatsapp:disconnect:error', {
          accountId,
          error: (error as Error).message,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      log.info({ reason }, 'Client disconnected');
      this.authenticatedSockets.delete(socket.id);
    });

    socket.on('error', (error) => {
      log.error({ error }, 'Socket error');
    });
  }

  private setupWhatsAppEventForwarding(): void {
    whatsappService.on('qr', ({ accountId, qrCode }) => {
      this.emitToRoom(`whatsapp:${accountId}`, 'whatsapp:qr', {
        accountId,
        qrCode,
      });
      this.emitToAdmins('whatsapp:qr', { accountId, qrCode });
    });

    whatsappService.on('connected', ({ accountId, phoneNumber }) => {
      this.emitToRoom(`whatsapp:${accountId}`, 'whatsapp:connected', {
        accountId,
        phoneNumber,
      });
      this.emitToAdmins('whatsapp:connected', { accountId, phoneNumber });
    });

    whatsappService.on('disconnected', ({ accountId, reason }) => {
      this.emitToRoom(`whatsapp:${accountId}`, 'whatsapp:disconnected', {
        accountId,
        reason,
      });
      this.emitToAdmins('whatsapp:disconnected', { accountId, reason });
    });

    whatsappService.on('message', ({ accountId, message }) => {
      this.emitToAdmins('whatsapp:message', { accountId, message });
    });
  }

  emitToAdmins<K extends keyof SocketEvents>(
    event: K,
    data: SocketEvents[K]
  ): void {
    if (this.io) {
      this.io.to('admins').emit(event, data);
    }
  }

  emitToRoom<K extends keyof SocketEvents>(
    room: string,
    event: K,
    data: SocketEvents[K]
  ): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  emitToAll<K extends keyof SocketEvents>(event: K, data: SocketEvents[K]): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    for (const [, socket] of this.authenticatedSockets) {
      if (socket.userId === userId) {
        socket.emit(event, data);
      }
    }
  }

  getConnectedClients(): number {
    return this.authenticatedSockets.size;
  }

  getIO(): Server | null {
    return this.io;
  }

  async shutdown(): Promise<void> {
    if (this.io) {
      await new Promise<void>((resolve) => {
        this.io?.close(() => {
          logger.info('Socket.io server closed');
          resolve();
        });
      });
    }
  }
}

export const socketService = new SocketService();
