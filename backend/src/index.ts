import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rate-limit.middleware.js';
import routes from './routes/index.js';
import { socketService } from './websocket/socket.service.js';
import { whatsappService } from './services/whatsapp.service.js';
import { aiService } from './services/ai.service.js';
import { conversationService } from './services/conversation.service.js';
import { prisma } from './config/database.js';

const app = express();
const httpServer = createServer(app);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: env.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    logger.info('Starting server...');

    await connectDatabase();
    logger.info('Database connected');

    await aiService.initialize();
    logger.info('AI service initialized');

    socketService.initialize(httpServer);
    logger.info('Socket.io initialized');

    await conversationService.initialize();
    logger.info('Conversation service initialized');

    const connectedAccounts = await prisma.whatsAppAccount.findMany({
      where: { status: 'CONNECTED' },
    });

    for (const account of connectedAccounts) {
      try {
        await whatsappService.initializeAccount(account.id);
        logger.info({ accountId: account.id }, 'WhatsApp account reconnected');
      } catch (error) {
        logger.error({ error, accountId: account.id }, 'Failed to reconnect WhatsApp account');
      }
    }

    httpServer.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  try {
    await whatsappService.shutdown();
    logger.info('WhatsApp service stopped');

    await socketService.shutdown();
    logger.info('Socket.io stopped');

    await disconnectDatabase();
    logger.info('Database disconnected');

    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);

  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
});

startServer();
