import { Request } from 'express';
import { User, Customer, OrderStatus, PaymentMethod, MessageDirection, MessageType, AIProviderType, WhatsAppAccountStatus, ConversationStatus } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  timestamp: Date;
  isGroup: boolean;
  pushName?: string;
}

export interface WhatsAppConnectionState {
  accountId: string;
  status: WhatsAppAccountStatus;
  qrCode?: string;
  phoneNumber?: string;
  lastConnected?: Date;
}

export interface AIConversationContext {
  customerId: string;
  customerName?: string;
  phoneNumber: string;
  language: string;
  conversationHistory: AIMessage[];
  currentIntent?: ConversationIntent;
  selectedService?: ServiceContext;
  selectedPackage?: PackageContext;
  orderInProgress?: OrderContext;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ServiceContext {
  id: string;
  name: string;
  description: string;
}

export interface PackageContext {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
}

export interface OrderContext {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  amount: number;
  currency: string;
}

export type ConversationIntent =
  | 'greeting'
  | 'inquiry'
  | 'service_selection'
  | 'package_selection'
  | 'payment_pending'
  | 'payment_submitted'
  | 'support'
  | 'complaint'
  | 'unknown';

export interface AIProviderConfig {
  id: string;
  type: AIProviderType;
  apiKey: string;
  model?: string;
  dailyLimit: number;
  usedToday: number;
  priority: number;
}

export interface AIGenerationResult {
  content: string;
  providerId: string;
  providerType: AIProviderType;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
}

export interface PaymentDetails {
  method: PaymentMethod;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  instructions?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  activeConversations: number;
  messagesLast24h: number;
  ordersLast7Days: OrderTrend[];
  topServices: ServiceStat[];
}

export interface OrderTrend {
  date: string;
  count: number;
  revenue: number;
}

export interface ServiceStat {
  serviceId: string;
  serviceName: string;
  orderCount: number;
  revenue: number;
}

export interface SocketEvents {
  'whatsapp:qr': { accountId: string; qrCode: string };
  'whatsapp:connected': { accountId: string; phoneNumber: string };
  'whatsapp:disconnected': { accountId: string; reason: string };
  'whatsapp:message': { accountId: string; message: WhatsAppMessage };
  'message:new': { customerId: string; message: MessagePayload };
  'order:update': { orderId: string; status: OrderStatus };
  'conversation:update': { customerId: string; status: ConversationStatus };
  'system:alert': { type: 'info' | 'warning' | 'error'; message: string };
}

export interface MessagePayload {
  id: string;
  customerId: string;
  direction: MessageDirection;
  messageType: MessageType;
  content: string;
  mediaUrl?: string;
  aiGenerated: boolean;
  timestamp: Date;
}

export interface CreateServiceDTO {
  name: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateServiceDTO extends Partial<CreateServiceDTO> {}

export interface CreatePackageDTO {
  serviceId: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  duration?: string;
  features: string[];
  isPopular?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdatePackageDTO extends Partial<Omit<CreatePackageDTO, 'serviceId'>> {}

export interface CreateOrderDTO {
  customerId: string;
  packageId: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface UpdateOrderStatusDTO {
  status: OrderStatus;
  adminNotes?: string;
}

export interface CreateAIProviderDTO {
  name: string;
  type: AIProviderType;
  apiKey: string;
  model?: string;
  dailyLimit?: number;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateAIProviderDTO extends Partial<Omit<CreateAIProviderDTO, 'type'>> {}

export interface CreatePaymentConfigDTO {
  method: PaymentMethod;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  instructions?: string;
  isActive?: boolean;
}

export interface UpdatePaymentConfigDTO extends Partial<Omit<CreatePaymentConfigDTO, 'method'>> {}

export interface CreateMessageTemplateDTO {
  name: string;
  content: string;
  variables?: string[];
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface UpdateMessageTemplateDTO extends Partial<CreateMessageTemplateDTO> {}

export interface CreateSystemPromptDTO {
  name: string;
  content: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateSystemPromptDTO extends Partial<CreateSystemPromptDTO> {}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export {
  User,
  Customer,
  OrderStatus,
  PaymentMethod,
  MessageDirection,
  MessageType,
  AIProviderType,
  WhatsAppAccountStatus,
  ConversationStatus
};
