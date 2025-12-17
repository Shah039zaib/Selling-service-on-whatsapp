'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  UsersIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { getDashboardStats, getRecentActivity } from '@/lib/api';
import { formatCurrency, formatRelativeTime, getStatusColor } from '@/lib/utils';
import { useSocketEvent } from '@/hooks/useSocket';
import { DashboardStats, Order, Message, Customer } from '@/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        getDashboardStats(),
        getRecentActivity(10),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (activityRes.success && activityRes.data) {
        setRecentOrders(activityRes.data.recentOrders || []);
        setRecentMessages(activityRes.data.recentMessages || []);
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOrderUpdate = useCallback(() => {
    fetchData();
  }, []);

  useSocketEvent('order:update', handleOrderUpdate);

  const statCards = stats ? [
    {
      title: 'Total Customers',
      value: stats.overview.totalCustomers,
      change: `+${stats.overview.newCustomersToday} today`,
      icon: UsersIcon,
      color: 'bg-blue-500',
    },
    {
      title: 'Total Orders',
      value: stats.overview.totalOrders,
      change: `${stats.overview.pendingOrders} pending`,
      icon: ShoppingCartIcon,
      color: 'bg-green-500',
    },
    {
      title: 'Revenue',
      value: formatCurrency(stats.overview.totalRevenue),
      change: 'All time',
      icon: CurrencyDollarIcon,
      color: 'bg-yellow-500',
    },
    {
      title: 'Messages (24h)',
      value: stats.overview.messagesLast24h,
      change: `${stats.overview.activeConversations} active`,
      icon: ChatBubbleLeftRightIcon,
      color: 'bg-purple-500',
    },
  ] : [];

  return (
    <DashboardLayout>
      <Header
        title="Dashboard"
        description="Overview of your WhatsApp SaaS platform"
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {statCards.map((stat) => (
                <Card key={stat.title} className="relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center">
                        <ArrowTrendingUpIcon className="h-3 w-3 mr-1 text-green-500" />
                        {stat.change}
                      </p>
                    </div>
                    <div className={`${stat.color} p-3 rounded-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader title="System Status" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">WhatsApp</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {stats?.whatsapp.activeAccounts || 0} connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">AI Providers</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {stats?.ai.availableProviders || 0}/{stats?.ai.totalProviders || 0} available
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Real-time</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {stats?.realtime.connectedClients || 0} clients
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Pending Actions"
                  action={
                    <a href="/orders?status=PAYMENT_SUBMITTED" className="text-sm text-primary-600 hover:text-primary-700">
                      View all
                    </a>
                  }
                />
                <div className="space-y-3">
                  {stats?.overview.paymentSubmittedOrders ? (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center space-x-3">
                        <ClockIcon className="h-5 w-5 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">
                          Payments to verify
                        </span>
                      </div>
                      <Badge variant="warning">{stats.overview.paymentSubmittedOrders}</Badge>
                    </div>
                  ) : null}
                  {stats?.overview.pendingOrders ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-3">
                        <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          Pending orders
                        </span>
                      </div>
                      <Badge variant="info">{stats.overview.pendingOrders}</Badge>
                    </div>
                  ) : null}
                  {!stats?.overview.paymentSubmittedOrders && !stats?.overview.pendingOrders && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No pending actions
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader
                  title="Recent Orders"
                  action={
                    <a href="/orders" className="text-sm text-primary-600 hover:text-primary-700">
                      View all
                    </a>
                  }
                />
                <div className="space-y-3">
                  {recentOrders.length > 0 ? (
                    recentOrders.slice(0, 5).map((order) => (
                      <a
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {order.customer?.phoneNumber} - {order.package?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.replace('_', ' ')}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatRelativeTime(order.createdAt)}
                          </p>
                        </div>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent orders</p>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Recent Messages"
                  action={
                    <a href="/customers" className="text-sm text-primary-600 hover:text-primary-700">
                      View all
                    </a>
                  }
                />
                <div className="space-y-3">
                  {recentMessages.length > 0 ? (
                    recentMessages.slice(0, 5).map((message) => (
                      <a
                        key={message.id}
                        href={`/customers/${message.customerId}`}
                        className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {(message as any).customer?.name || (message as any).customer?.phoneNumber}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{message.content}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatRelativeTime(message.timestamp)}
                        </span>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent messages</p>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
