import { APIResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class APIClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.setToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      throw new Error(data.error || 'An error occurred');
    }

    return data;
  }

  async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new APIClient();

export async function login(email: string, password: string) {
  const response = await api.post<{ token: string; user: any }>('/auth/login', {
    email,
    password,
  });
  if (response.success && response.data) {
    api.setToken(response.data.token);
  }
  return response;
}

export async function register(email: string, password: string, name: string) {
  const response = await api.post<{ token: string; user: any }>('/auth/register', {
    email,
    password,
    name,
  });
  if (response.success && response.data) {
    api.setToken(response.data.token);
  }
  return response;
}

export function logout() {
  api.setToken(null);
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export async function getProfile() {
  return api.get<any>('/auth/profile');
}

export async function getDashboardStats() {
  return api.get<any>('/dashboard/stats');
}

export async function getRecentActivity(limit = 20) {
  return api.get<any>(`/dashboard/activity?limit=${limit}`);
}

export async function getAnalytics(period = 30) {
  return api.get<any>(`/dashboard/analytics?period=${period}`);
}

export async function getServices(params?: { page?: number; limit?: number; search?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  return api.get<any[]>(`/services?${query}`);
}

export async function getService(id: string) {
  return api.get<any>(`/services/${id}`);
}

export async function createService(data: any) {
  return api.post<any>('/services', data);
}

export async function updateService(id: string, data: any) {
  return api.patch<any>(`/services/${id}`, data);
}

export async function deleteService(id: string) {
  return api.delete(`/services/${id}`);
}

export async function getPackages(params?: { page?: number; limit?: number; serviceId?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.serviceId) query.set('serviceId', params.serviceId);
  return api.get<any[]>(`/packages?${query}`);
}

export async function getPackage(id: string) {
  return api.get<any>(`/packages/${id}`);
}

export async function createPackage(data: any) {
  return api.post<any>('/packages', data);
}

export async function updatePackage(id: string, data: any) {
  return api.patch<any>(`/packages/${id}`, data);
}

export async function deletePackage(id: string) {
  return api.delete(`/packages/${id}`);
}

export async function getOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.customerId) query.set('customerId', params.customerId);
  return api.get<any[]>(`/orders?${query}`);
}

export async function getOrder(id: string) {
  return api.get<any>(`/orders/${id}`);
}

export async function updateOrderStatus(id: string, status: string, adminNotes?: string) {
  return api.patch<any>(`/orders/${id}/status`, { status, adminNotes });
}

export async function getCustomers(params?: { page?: number; limit?: number; search?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  return api.get<any[]>(`/customers?${query}`);
}

export async function getCustomer(id: string) {
  return api.get<any>(`/customers/${id}`);
}

export async function getCustomerMessages(id: string, params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  return api.get<any[]>(`/customers/${id}/messages?${query}`);
}

export async function blockCustomer(id: string, reason?: string) {
  return api.post<any>(`/customers/${id}/block`, { reason });
}

export async function unblockCustomer(id: string) {
  return api.post<any>(`/customers/${id}/unblock`);
}

export async function getWhatsAppAccounts() {
  return api.get<any[]>('/whatsapp');
}

export async function getWhatsAppAccount(id: string) {
  return api.get<any>(`/whatsapp/${id}`);
}

export async function createWhatsAppAccount(data: { name: string; isDefault?: boolean }) {
  return api.post<any>('/whatsapp', data);
}

export async function updateWhatsAppAccount(id: string, data: any) {
  return api.patch<any>(`/whatsapp/${id}`, data);
}

export async function deleteWhatsAppAccount(id: string) {
  return api.delete(`/whatsapp/${id}`);
}

export async function connectWhatsAppAccount(id: string) {
  return api.post<any>(`/whatsapp/${id}/connect`);
}

export async function disconnectWhatsAppAccount(id: string) {
  return api.post<any>(`/whatsapp/${id}/disconnect`);
}

export async function getWhatsAppQR(id: string) {
  return api.get<{ qrCode: string; status: string }>(`/whatsapp/${id}/qr`);
}

export async function sendWhatsAppMessage(accountId: string, customerId: string, content: string) {
  return api.post<any>(`/whatsapp/${accountId}/send`, { customerId, content });
}

export async function getAIProviders() {
  return api.get<{ providers: any[]; stats: any[] }>('/ai-providers');
}

export async function getAIProvider(id: string) {
  return api.get<any>(`/ai-providers/${id}`);
}

export async function createAIProvider(data: any) {
  return api.post<any>('/ai-providers', data);
}

export async function updateAIProvider(id: string, data: any) {
  return api.patch<any>(`/ai-providers/${id}`, data);
}

export async function deleteAIProvider(id: string) {
  return api.delete(`/ai-providers/${id}`);
}

export async function resetAIProviderUsage(id: string) {
  return api.post<any>(`/ai-providers/${id}/reset-usage`);
}

export async function getPaymentConfigs() {
  return api.get<any[]>('/payment-config');
}

export async function getPaymentConfig(id: string) {
  return api.get<any>(`/payment-config/${id}`);
}

export async function createPaymentConfig(data: any) {
  return api.post<any>('/payment-config', data);
}

export async function updatePaymentConfig(id: string, data: any) {
  return api.patch<any>(`/payment-config/${id}`, data);
}

export async function deletePaymentConfig(id: string) {
  return api.delete(`/payment-config/${id}`);
}

export async function getMessageTemplates() {
  return api.get<any[]>('/templates/messages');
}

export async function createMessageTemplate(data: any) {
  return api.post<any>('/templates/messages', data);
}

export async function updateMessageTemplate(id: string, data: any) {
  return api.patch<any>(`/templates/messages/${id}`, data);
}

export async function deleteMessageTemplate(id: string) {
  return api.delete(`/templates/messages/${id}`);
}

export async function getSystemPrompts() {
  return api.get<any[]>('/templates/prompts');
}

export async function createSystemPrompt(data: any) {
  return api.post<any>('/templates/prompts', data);
}

export async function updateSystemPrompt(id: string, data: any) {
  return api.patch<any>(`/templates/prompts/${id}`, data);
}

export async function deleteSystemPrompt(id: string) {
  return api.delete(`/templates/prompts/${id}`);
}

export async function getAuditLogs(params?: { page?: number; limit?: number; entity?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.entity) query.set('entity', params.entity);
  return api.get<any[]>(`/dashboard/audit-logs?${query}`);
}

export async function getSystemHealth() {
  return api.get<any>('/dashboard/health');
}
