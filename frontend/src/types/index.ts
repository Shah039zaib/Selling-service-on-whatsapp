export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
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

export interface Service {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  packages?: Package[];
  _count?: { packages: number };
}

export interface Package {
  id: string;
  serviceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration?: string;
  features: string[];
  isPopular: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  service?: { id: string; name: string };
  _count?: { orders: number };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  packageId: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentProofUrl?: string;
  amount: number;
  currency: string;
  notes?: string;
  adminNotes?: string;
  paidAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  package?: Package & { service?: Service };
  actions?: OrderAction[];
}

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_SUBMITTED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'REFUNDED';

export type PaymentMethod = 'EASYPAISA' | 'JAZZCASH' | 'BANK_TRANSFER';

export interface OrderAction {
  id: string;
  orderId: string;
  userId?: string;
  action: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  notes?: string;
  createdAt: string;
  user?: { id: string; name: string };
}

export interface Customer {
  id: string;
  phoneNumber: string;
  name?: string;
  language: string;
  lastMessageAt?: string;
  totalOrders: number;
  totalSpent: number;
  isBlocked: boolean;
  blockReason?: string;
  createdAt: string;
  updatedAt: string;
  orders?: Order[];
  _count?: { orders: number; messages: number };
}

export interface Message {
  id: string;
  customerId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  messageType: MessageType;
  content: string;
  mediaUrl?: string;
  aiGenerated: boolean;
  aiProvider?: string;
  timestamp: string;
  createdAt: string;
}

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'AUDIO'
  | 'VIDEO'
  | 'STICKER'
  | 'LOCATION'
  | 'CONTACT';

export interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber?: string;
  status: WhatsAppStatus;
  qrCode?: string;
  isDefault: boolean;
  lastConnected?: string;
  createdAt: string;
  updatedAt: string;
  connectionState?: ConnectionState;
  _count?: { customers: number; messages: number };
}

export type WhatsAppStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'BANNED';

export interface ConnectionState {
  accountId: string;
  status: WhatsAppStatus;
  qrCode?: string;
  phoneNumber?: string;
  lastConnected?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  apiKey: string;
  model?: string;
  dailyLimit: number;
  usedToday: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AIProviderType = 'CLAUDE' | 'GEMINI' | 'GROQ' | 'COHERE';

export interface PaymentConfig {
  id: string;
  method: PaymentMethod;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  instructions?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  description?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  overview: {
    totalCustomers: number;
    newCustomersToday: number;
    totalOrders: number;
    pendingOrders: number;
    paymentSubmittedOrders: number;
    totalRevenue: number;
    messagesLast24h: number;
    activeConversations: number;
  };
  whatsapp: {
    connectedAccounts: number;
    activeAccounts: number;
  };
  ai: {
    providers: AIProviderStats[];
    totalProviders: number;
    availableProviders: number;
  };
  realtime: {
    connectedClients: number;
  };
  trends: {
    ordersLast7Days: OrderTrend[];
    topServices: ServiceStat[];
  };
}

export interface AIProviderStats {
  id: string;
  type: AIProviderType;
  usedToday: number;
  dailyLimit: number;
  available: boolean;
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

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldData?: object;
  newData?: object;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}
