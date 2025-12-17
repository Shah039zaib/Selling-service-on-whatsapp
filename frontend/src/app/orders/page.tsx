'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EyeIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { getOrders, updateOrderStatus, getOrder } from '@/lib/api';
import { formatCurrency, formatRelativeTime, formatDateTime, getStatusColor, formatPhoneNumber } from '@/lib/utils';
import { useSocketEvent } from '@/hooks/useSocket';
import { Order, OrderStatus } from '@/types';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAYMENT_SUBMITTED', label: 'Payment Submitted' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  const fetchOrders = async () => {
    try {
      const response = await getOrders({ status: statusFilter || undefined, limit: 50 });
      if (response.success && response.data) {
        setOrders(response.data);
      }
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleOrderUpdate = useCallback(() => {
    fetchOrders();
  }, [statusFilter]);

  useSocketEvent('order:update', handleOrderUpdate);

  const openOrderDetails = async (order: Order) => {
    try {
      const response = await getOrder(order.id);
      if (response.success && response.data) {
        setSelectedOrder(response.data);
        setAdminNotes('');
        setIsModalOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load order details');
    }
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      const response = await updateOrderStatus(selectedOrder.id, newStatus, adminNotes || undefined);
      if (response.success) {
        toast.success(`Order ${newStatus.toLowerCase().replace('_', ' ')}`);
        setIsModalOpen(false);
        fetchOrders();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextActions = (status: OrderStatus): { status: OrderStatus; label: string; variant: 'primary' | 'danger' }[] => {
    switch (status) {
      case 'PAYMENT_SUBMITTED':
        return [
          { status: 'PAID', label: 'Approve Payment', variant: 'primary' },
          { status: 'REJECTED', label: 'Reject Payment', variant: 'danger' },
        ];
      case 'PAID':
        return [{ status: 'COMPLETED', label: 'Mark Complete', variant: 'primary' }];
      case 'REJECTED':
        return [{ status: 'PENDING', label: 'Revert to Pending', variant: 'primary' }];
      default:
        return [];
    }
  };

  return (
    <DashboardLayout>
      <Header
        title="Orders"
        description="Manage customer orders and payments"
        action={
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="w-48"
          />
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : orders.length === 0 ? (
          <Card>
            <EmptyState
              title="No orders found"
              description={statusFilter ? 'Try changing the status filter' : 'Orders will appear here when customers place them'}
            />
          </Card>
        ) : (
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Order</TableCell>
                  <TableCell header>Customer</TableCell>
                  <TableCell header>Package</TableCell>
                  <TableCell header>Amount</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Date</TableCell>
                  <TableCell header>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{order.customer?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">
                          {formatPhoneNumber(order.customer?.phoneNumber || '')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{order.package?.name}</p>
                        <p className="text-xs text-gray-500">{order.package?.service?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(order.amount), order.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatRelativeTime(order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Order ${selectedOrder?.orderNumber}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Customer</h4>
                <p className="mt-1">{selectedOrder.customer?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">
                  {formatPhoneNumber(selectedOrder.customer?.phoneNumber || '')}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Package</h4>
                <p className="mt-1">{selectedOrder.package?.name}</p>
                <p className="text-sm text-gray-500">{selectedOrder.package?.service?.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Amount</h4>
                <p className="mt-1 text-lg font-bold">
                  {formatCurrency(Number(selectedOrder.amount), selectedOrder.currency)}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Status</h4>
                <Badge className={`mt-1 ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Payment Method</h4>
                <p className="mt-1">{selectedOrder.paymentMethod || 'Not selected'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Created</h4>
                <p className="mt-1">{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
            </div>

            {selectedOrder.paymentProofUrl && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Payment Proof</h4>
                <a
                  href={selectedOrder.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={selectedOrder.paymentProofUrl}
                    alt="Payment proof"
                    className="max-w-full h-48 object-contain rounded-lg border border-gray-200"
                  />
                </a>
              </div>
            )}

            {selectedOrder.actions && selectedOrder.actions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">History</h4>
                <div className="space-y-2">
                  {selectedOrder.actions.map((action) => (
                    <div key={action.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span>
                        {action.action.replace(/_/g, ' ')} by {action.user?.name || 'System'}
                      </span>
                      <span className="text-gray-500">{formatRelativeTime(action.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {getNextActions(selectedOrder.status).length > 0 && (
              <>
                <Textarea
                  label="Admin Notes (optional)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this action..."
                  rows={2}
                />
                <div className="flex justify-end space-x-3">
                  {getNextActions(selectedOrder.status).map((action) => (
                    <Button
                      key={action.status}
                      variant={action.variant}
                      onClick={() => handleStatusUpdate(action.status)}
                      isLoading={isUpdating}
                    >
                      {action.variant === 'primary' ? (
                        <CheckIcon className="h-4 w-4 mr-2" />
                      ) : (
                        <XMarkIcon className="h-4 w-4 mr-2" />
                      )}
                      {action.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<DashboardLayout><Loading className="py-20" /></DashboardLayout>}>
      <OrdersPageContent />
    </Suspense>
  );
}
