'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PlusIcon,
  SignalIcon,
  SignalSlashIcon,
  QrCodeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import {
  getWhatsAppAccounts,
  createWhatsAppAccount,
  deleteWhatsAppAccount,
  connectWhatsAppAccount,
  disconnectWhatsAppAccount,
  getWhatsAppQR,
} from '@/lib/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { formatRelativeTime, getStatusColor, formatPhoneNumber } from '@/lib/utils';
import { WhatsAppAccount } from '@/types';

export default function WhatsAppPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchAccounts = async () => {
    try {
      const response = await getWhatsAppAccounts();
      if (response.success && response.data) {
        setAccounts(response.data);
      }
    } catch (error) {
      toast.error('Failed to load WhatsApp accounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleQRUpdate = useCallback(({ accountId, qrCode: newQR }: { accountId: string; qrCode: string }) => {
    if (selectedAccount?.id === accountId) {
      setQrCode(newQR);
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, qrCode: newQR, status: 'CONNECTING' } : a))
    );
  }, [selectedAccount]);

  const handleConnected = useCallback(({ accountId, phoneNumber }: { accountId: string; phoneNumber: string }) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, status: 'CONNECTED', phoneNumber, qrCode: undefined } : a
      )
    );
    if (selectedAccount?.id === accountId) {
      setIsQRModalOpen(false);
      toast.success('WhatsApp connected successfully!');
    }
  }, [selectedAccount]);

  const handleDisconnected = useCallback(({ accountId }: { accountId: string }) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, status: 'DISCONNECTED', qrCode: undefined } : a))
    );
  }, []);

  useSocketEvent('whatsapp:qr', handleQRUpdate);
  useSocketEvent('whatsapp:connected', handleConnected);
  useSocketEvent('whatsapp:disconnected', handleDisconnected);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await createWhatsAppAccount({ name: newAccountName });
      if (response.success) {
        toast.success('WhatsApp account created');
        setIsCreateModalOpen(false);
        setNewAccountName('');
        fetchAccounts();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnect = async (account: WhatsAppAccount) => {
    setSelectedAccount(account);
    setQrCode(null);
    setIsQRModalOpen(true);

    try {
      await connectWhatsAppAccount(account.id);

      const pollQR = async () => {
        const response = await getWhatsAppQR(account.id);
        if (response.success && response.data?.qrCode) {
          setQrCode(response.data.qrCode);
        }
      };

      setTimeout(pollQR, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect');
      setIsQRModalOpen(false);
    }
  };

  const handleDisconnect = async (account: WhatsAppAccount) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;

    try {
      await disconnectWhatsAppAccount(account.id);
      toast.success('Account disconnected');
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    }
  };

  const handleDelete = async (account: WhatsAppAccount) => {
    if (!confirm(`Are you sure you want to delete "${account.name}"?`)) return;

    try {
      await deleteWhatsAppAccount(account.id);
      toast.success('Account deleted');
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    }
  };

  return (
    <DashboardLayout>
      <Header
        title="WhatsApp Accounts"
        description="Manage your WhatsApp connections"
        action={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Account
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : accounts.length === 0 ? (
          <Card>
            <EmptyState
              title="No WhatsApp accounts"
              description="Add a WhatsApp account to start receiving messages"
              action={{ label: 'Add Account', onClick: () => setIsCreateModalOpen(true) }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <Card key={account.id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{account.name}</h3>
                    {account.phoneNumber && (
                      <p className="text-sm text-gray-500">
                        {formatPhoneNumber(account.phoneNumber)}
                      </p>
                    )}
                  </div>
                  <Badge className={getStatusColor(account.status)}>{account.status}</Badge>
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-4">
                  <div className="flex justify-between">
                    <span>Customers</span>
                    <span className="font-medium">{account._count?.customers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Messages</span>
                    <span className="font-medium">{account._count?.messages || 0}</span>
                  </div>
                  {account.lastConnected && (
                    <div className="flex justify-between">
                      <span>Last connected</span>
                      <span>{formatRelativeTime(account.lastConnected)}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  {account.status === 'CONNECTED' ? (
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDisconnect(account)}
                    >
                      <SignalSlashIcon className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleConnect(account)}
                    >
                      <QrCodeIcon className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(account)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add WhatsApp Account"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Account Name"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="e.g., Main Business Account"
            required
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        title="Scan QR Code"
        description="Open WhatsApp on your phone and scan this QR code"
      >
        <div className="flex flex-col items-center py-8">
          {qrCode ? (
            <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg">
              <Loading />
            </div>
          )}
          <p className="mt-4 text-sm text-gray-500 text-center">
            Waiting for connection...
          </p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
