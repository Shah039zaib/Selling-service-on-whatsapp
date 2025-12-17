import { prisma } from '../config/database.js';
import { logger, createChildLogger } from '../utils/logger.js';
import { whatsappService } from './whatsapp.service.js';
import { aiService } from './ai.service.js';
import { cloudinaryService } from './cloudinary.service.js';
import { socketService } from '../websocket/socket.service.js';
import {
  WhatsAppMessage,
  AIConversationContext,
  AIMessage,
  ConversationIntent,
  OrderStatus,
  MessageType,
  PaymentMethod,
} from '../types/index.js';
import { generateOrderNumber, detectLanguage, extractPhoneNumber } from '../utils/helpers.js';
import { WAMessage } from 'baileys';

export class ConversationService {
  private processingQueue: Map<string, Promise<void>> = new Map();

  async initialize(): Promise<void> {
    whatsappService.on('message', async ({ accountId, message, rawMessage }) => {
      await this.handleIncomingMessage(accountId, message, rawMessage);
    });

    logger.info('Conversation service initialized');
  }

  private async handleIncomingMessage(
    accountId: string,
    message: WhatsAppMessage,
    rawMessage: WAMessage
  ): Promise<void> {
    const log = createChildLogger({
      accountId,
      from: message.from,
      service: 'conversation',
    });

    if (message.isGroup) {
      log.debug('Ignoring group message');
      return;
    }

    const existingProcess = this.processingQueue.get(message.from);
    if (existingProcess) {
      await existingProcess;
    }

    const processPromise = this.processMessage(accountId, message, rawMessage, log);
    this.processingQueue.set(message.from, processPromise);

    try {
      await processPromise;
    } finally {
      this.processingQueue.delete(message.from);
    }
  }

  private async processMessage(
    accountId: string,
    message: WhatsAppMessage,
    rawMessage: WAMessage,
    log: ReturnType<typeof createChildLogger>
  ): Promise<void> {
    try {
      let customer = await prisma.customer.findUnique({
        where: { phoneNumber: message.from },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            phoneNumber: message.from,
            name: message.pushName,
            language: detectLanguage(message.content),
            whatsappAccountId: accountId,
          },
        });
        log.info({ customerId: customer.id }, 'New customer created');
      }

      if (customer.isBlocked) {
        log.warn('Message from blocked customer ignored');
        return;
      }

      let conversation = await prisma.conversation.findFirst({
        where: {
          customerId: customer.id,
          status: { in: ['ACTIVE', 'WAITING_PAYMENT'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            customerId: customer.id,
            status: 'ACTIVE',
          },
        });
      }

      let mediaUrl: string | undefined;
      let mediaPublicId: string | undefined;

      if (
        message.type !== 'TEXT' &&
        ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(message.type)
      ) {
        const mediaBuffer = await whatsappService.downloadMedia(accountId, rawMessage);
        if (mediaBuffer) {
          const uploadResult = await cloudinaryService.uploadMedia(mediaBuffer, {
            customerId: customer.id,
            messageId: message.id,
            resourceType: this.getResourceType(message.type),
          });
          mediaUrl = uploadResult.secureUrl;
          mediaPublicId = uploadResult.publicId;

          if (message.type === 'IMAGE') {
            const pendingOrder = await this.findPendingPaymentOrder(customer.id);
            if (pendingOrder) {
              await this.handlePaymentProofSubmission(
                customer.id,
                pendingOrder.id,
                mediaUrl,
                mediaPublicId,
                accountId
              );
              return;
            }
          }
        }
      }

      await prisma.message.create({
        data: {
          customerId: customer.id,
          conversationId: conversation.id,
          whatsappAccountId: accountId,
          direction: 'INBOUND',
          messageType: message.type,
          content: message.content,
          mediaUrl,
          mediaPublicId,
          whatsappMessageId: message.id,
          timestamp: message.timestamp,
        },
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          lastMessageAt: new Date(),
          language: detectLanguage(message.content) || customer.language,
          name: message.pushName || customer.name,
        },
      });

      socketService.emitToAdmins('message:new', {
        customerId: customer.id,
        message: {
          id: message.id,
          customerId: customer.id,
          direction: 'INBOUND',
          messageType: message.type,
          content: message.content,
          mediaUrl,
          aiGenerated: false,
          timestamp: message.timestamp,
        },
      });

      const context = await this.buildConversationContext(customer.id, conversation.id);
      const aiResponse = await aiService.generateResponse(context);

      await this.sendResponse(
        accountId,
        customer.id,
        conversation.id,
        message.from,
        aiResponse.content,
        aiResponse.providerType
      );

      log.info('Message processed and response sent');
    } catch (error) {
      log.error({ error }, 'Failed to process message');
    }
  }

  private getResourceType(
    messageType: MessageType
  ): 'image' | 'video' | 'raw' | 'auto' {
    switch (messageType) {
      case 'IMAGE':
        return 'image';
      case 'VIDEO':
        return 'video';
      default:
        return 'raw';
    }
  }

  private async findPendingPaymentOrder(customerId: string) {
    return prisma.order.findFirst({
      where: {
        customerId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async handlePaymentProofSubmission(
    customerId: string,
    orderId: string,
    mediaUrl: string,
    mediaPublicId: string,
    accountId: string
  ): Promise<void> {
    const log = createChildLogger({ customerId, orderId, service: 'conversation' });

    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAYMENT_SUBMITTED',
          paymentProofUrl: mediaUrl,
          paymentProofPublicId: mediaPublicId,
        },
        include: { customer: true, package: true },
      });

      await prisma.orderAction.create({
        data: {
          orderId,
          action: 'payment_proof_submitted',
          fromStatus: 'PENDING',
          toStatus: 'PAYMENT_SUBMITTED',
        },
      });

      const template = await prisma.messageTemplate.findFirst({
        where: { name: 'payment_received', isActive: true },
      });

      const responseMessage =
        template?.content ||
        `Thank you! We have received your payment proof for Order #${order.orderNumber}. Our team will verify it shortly and you'll be notified once confirmed. 🙏`;

      const customer = order.customer;
      const conversation = await prisma.conversation.findFirst({
        where: { customerId, status: { in: ['ACTIVE', 'WAITING_PAYMENT'] } },
      });

      if (conversation) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'WAITING_PAYMENT' },
        });
      }

      await this.sendResponse(
        accountId,
        customerId,
        conversation?.id || null,
        customer.phoneNumber,
        responseMessage,
        'SYSTEM'
      );

      socketService.emitToAdmins('order:update', {
        orderId,
        status: 'PAYMENT_SUBMITTED',
      });

      log.info('Payment proof processed');
    } catch (error) {
      log.error({ error }, 'Failed to handle payment proof');
    }
  }

  private async buildConversationContext(
    customerId: string,
    conversationId: string
  ): Promise<AIConversationContext> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
      take: 20,
    });

    const conversationHistory: AIMessage[] = messages.map((m) => ({
      role: m.direction === 'INBOUND' ? 'user' : 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    }));

    const pendingOrder = await this.findPendingPaymentOrder(customerId);

    let currentIntent: ConversationIntent = 'unknown';
    let selectedPackage: { id: string; name: string; price: number; currency: string; features: string[] } | undefined;
    let orderInProgress: { orderId: string; orderNumber: string; status: OrderStatus; amount: number; currency: string } | undefined;

    if (pendingOrder) {
      const pkg = await prisma.package.findUnique({
        where: { id: pendingOrder.packageId },
      });

      currentIntent = 'payment_pending';
      selectedPackage = pkg
        ? {
            id: pkg.id,
            name: pkg.name,
            price: Number(pkg.price),
            currency: pkg.currency,
            features: pkg.features,
          }
        : undefined;
      orderInProgress = {
        orderId: pendingOrder.id,
        orderNumber: pendingOrder.orderNumber,
        status: pendingOrder.status,
        amount: Number(pendingOrder.amount),
        currency: pendingOrder.currency,
      };
    }

    return {
      customerId,
      customerName: customer.name || undefined,
      phoneNumber: customer.phoneNumber,
      language: customer.language,
      conversationHistory,
      currentIntent,
      selectedPackage,
      orderInProgress,
    };
  }

  private async sendResponse(
    accountId: string,
    customerId: string,
    conversationId: string | null,
    phoneNumber: string,
    content: string,
    aiProvider: string
  ): Promise<void> {
    const result = await whatsappService.sendMessage(accountId, phoneNumber, content);

    const message = await prisma.message.create({
      data: {
        customerId,
        conversationId,
        whatsappAccountId: accountId,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        content,
        whatsappMessageId: result?.key?.id,
        aiGenerated: aiProvider !== 'SYSTEM',
        aiProvider,
        timestamp: new Date(),
      },
    });

    socketService.emitToAdmins('message:new', {
      customerId,
      message: {
        id: message.id,
        customerId,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        content,
        aiGenerated: aiProvider !== 'SYSTEM',
        timestamp: message.timestamp,
      },
    });
  }

  async createOrder(
    customerId: string,
    packageId: string,
    accountId: string
  ): Promise<{ orderId: string; orderNumber: string }> {
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { service: true },
    });

    if (!pkg || !pkg.isActive) {
      throw new Error('Package not found or inactive');
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        packageId,
        amount: pkg.price,
        currency: pkg.currency,
        status: 'PENDING',
      },
    });

    await prisma.orderAction.create({
      data: {
        orderId: order.id,
        action: 'order_created',
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
      },
    });

    const paymentConfigs = await prisma.paymentConfig.findMany({
      where: { isActive: true },
    });

    const paymentInfo = paymentConfigs
      .map(
        (p) =>
          `*${p.method}*\nAccount: ${p.accountTitle}\nNumber: ${p.accountNumber}${p.bankName ? `\nBank: ${p.bankName}` : ''}${p.instructions ? `\n${p.instructions}` : ''}`
      )
      .join('\n\n');

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (customer) {
      const message = `🎉 Order Created!\n\n*Order #${orderNumber}*\nPackage: ${pkg.name}\nAmount: ${pkg.currency} ${pkg.price}\n\nPlease send payment to one of these accounts:\n\n${paymentInfo}\n\n📸 After payment, send a screenshot here for verification.`;

      const conversation = await prisma.conversation.findFirst({
        where: { customerId, status: 'ACTIVE' },
      });

      await this.sendResponse(
        accountId,
        customerId,
        conversation?.id || null,
        customer.phoneNumber,
        message,
        'SYSTEM'
      );
    }

    socketService.emitToAdmins('order:update', {
      orderId: order.id,
      status: 'PENDING',
    });

    return { orderId: order.id, orderNumber };
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId?: string,
    notes?: string
  ): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, package: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const oldStatus = order.status;

    const updateData: any = {
      status: newStatus,
    };

    if (notes) {
      updateData.adminNotes = notes;
    }

    if (newStatus === 'PAID') {
      updateData.paidAt = new Date();
    } else if (newStatus === 'COMPLETED') {
      updateData.completedAt = new Date();

      await prisma.customer.update({
        where: { id: order.customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: Number(order.amount) },
        },
      });
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: updateData,
      }),
      prisma.orderAction.create({
        data: {
          orderId,
          userId,
          action: `status_changed_to_${newStatus.toLowerCase()}`,
          fromStatus: oldStatus,
          toStatus: newStatus,
          notes,
        },
      }),
    ]);

    const conversation = await prisma.conversation.findFirst({
      where: { customerId: order.customerId, status: { in: ['ACTIVE', 'WAITING_PAYMENT'] } },
    });

    let customerMessage = '';

    switch (newStatus) {
      case 'PAID':
        customerMessage = `✅ Payment Confirmed!\n\nYour payment for Order #${order.orderNumber} has been verified. Thank you!\n\nWe will begin processing your order shortly.`;
        if (conversation) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: 'COMPLETED' },
          });
        }
        break;

      case 'REJECTED':
        customerMessage = `❌ Payment Issue\n\nWe couldn't verify your payment for Order #${order.orderNumber}.\n\nPlease check and send a clear screenshot of the payment confirmation.${notes ? `\n\nReason: ${notes}` : ''}`;
        break;

      case 'COMPLETED':
        customerMessage = `🎉 Order Complete!\n\nYour order #${order.orderNumber} for ${order.package.name} has been completed.\n\nThank you for your business! We hope to serve you again soon.`;
        break;

      case 'CANCELLED':
        customerMessage = `Order #${order.orderNumber} has been cancelled.${notes ? `\n\nReason: ${notes}` : ''}`;
        break;
    }

    if (customerMessage && order.customer) {
      const whatsappAccount = await prisma.whatsAppAccount.findFirst({
        where: { status: 'CONNECTED' },
      });

      if (whatsappAccount) {
        await this.sendResponse(
          whatsappAccount.id,
          order.customerId,
          conversation?.id || null,
          order.customer.phoneNumber,
          customerMessage,
          'SYSTEM'
        );
      }
    }

    socketService.emitToAdmins('order:update', {
      orderId,
      status: newStatus,
    });
  }

  async sendManualMessage(
    accountId: string,
    customerId: string,
    content: string
  ): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const conversation = await prisma.conversation.findFirst({
      where: { customerId, status: { in: ['ACTIVE', 'WAITING_PAYMENT'] } },
    });

    await this.sendResponse(
      accountId,
      customerId,
      conversation?.id || null,
      customer.phoneNumber,
      content,
      'MANUAL'
    );
  }
}

export const conversationService = new ConversationService();
