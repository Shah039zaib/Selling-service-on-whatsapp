'use client';

import { useEffect, useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  NoSymbolIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { getCustomers, blockCustomer, unblockCustomer } from '@/lib/api';
import { formatCurrency, formatRelativeTime, formatPhoneNumber, debounce } from '@/lib/utils';
import { Customer } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async (searchQuery?: string) => {
    try {
      const response = await getCustomers({ search: searchQuery, limit: 50 });
      if (response.success && response.data) {
        setCustomers(response.data);
      }
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = debounce((value: string) => {
    fetchCustomers(value);
  }, 300);

  const handleBlock = async (customer: Customer) => {
    const reason = prompt('Enter reason for blocking (optional):');
    try {
      await blockCustomer(customer.id, reason || undefined);
      toast.success('Customer blocked');
      fetchCustomers(search);
    } catch (error: any) {
      toast.error(error.message || 'Failed to block customer');
    }
  };

  const handleUnblock = async (customer: Customer) => {
    try {
      await unblockCustomer(customer.id);
      toast.success('Customer unblocked');
      fetchCustomers(search);
    } catch (error: any) {
      toast.error(error.message || 'Failed to unblock customer');
    }
  };

  return (
    <DashboardLayout>
      <Header
        title="Customers"
        description="View and manage your customers"
        action={
          <Input
            placeholder="Search by phone or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-64"
          />
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : customers.length === 0 ? (
          <Card>
            <EmptyState
              title="No customers found"
              description={search ? 'Try a different search term' : 'Customers will appear here when they message you'}
            />
          </Card>
        ) : (
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Customer</TableCell>
                  <TableCell header>Orders</TableCell>
                  <TableCell header>Total Spent</TableCell>
                  <TableCell header>Messages</TableCell>
                  <TableCell header>Last Active</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">
                          {formatPhoneNumber(customer.phoneNumber)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{customer.totalOrders}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(customer.totalSpent))}
                    </TableCell>
                    <TableCell>{customer._count?.messages || 0}</TableCell>
                    <TableCell className="text-gray-500">
                      {customer.lastMessageAt ? formatRelativeTime(customer.lastMessageAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.isBlocked ? 'danger' : 'success'}>
                        {customer.isBlocked ? 'Blocked' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`/customers/${customer.id}`}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="View conversation"
                        >
                          <ChatBubbleLeftRightIcon className="h-5 w-5" />
                        </a>
                        {customer.isBlocked ? (
                          <button
                            onClick={() => handleUnblock(customer)}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Unblock"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlock(customer)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Block"
                          >
                            <NoSymbolIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
