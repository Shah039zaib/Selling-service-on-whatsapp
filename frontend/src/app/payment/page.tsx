'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { getPaymentConfigs, createPaymentConfig, updatePaymentConfig, deletePaymentConfig } from '@/lib/api';
import { getPaymentMethodLabel } from '@/lib/utils';
import { PaymentConfig, PaymentMethod } from '@/types';

const paymentMethods = [
  { value: 'EASYPAISA', label: 'EasyPaisa' },
  { value: 'JAZZCASH', label: 'JazzCash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

export default function PaymentPage() {
  const [configs, setConfigs] = useState<PaymentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PaymentConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    method: 'EASYPAISA' as PaymentMethod,
    accountTitle: '',
    accountNumber: '',
    bankName: '',
    instructions: '',
    isActive: true,
  });

  const fetchConfigs = async () => {
    try {
      const response = await getPaymentConfigs();
      if (response.success && response.data) {
        setConfigs(response.data);
      }
    } catch (error) {
      toast.error('Failed to load payment configurations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const usedMethods = configs.map((c) => c.method);
  const availableMethods = paymentMethods.filter((m) => !usedMethods.includes(m.value as PaymentMethod) || editingConfig?.method === m.value);

  const openModal = (config?: PaymentConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        method: config.method,
        accountTitle: config.accountTitle,
        accountNumber: config.accountNumber,
        bankName: config.bankName || '',
        instructions: config.instructions || '',
        isActive: config.isActive,
      });
    } else {
      setEditingConfig(null);
      const availableMethod = paymentMethods.find((m) => !usedMethods.includes(m.value as PaymentMethod));
      setFormData({
        method: (availableMethod?.value || 'EASYPAISA') as PaymentMethod,
        accountTitle: '',
        accountNumber: '',
        bankName: '',
        instructions: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingConfig) {
        const { method, ...updateData } = formData;
        const response = await updatePaymentConfig(editingConfig.id, updateData);
        if (response.success) {
          toast.success('Payment method updated');
          fetchConfigs();
        }
      } else {
        const response = await createPaymentConfig(formData);
        if (response.success) {
          toast.success('Payment method added');
          fetchConfigs();
        }
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (config: PaymentConfig) => {
    if (!confirm(`Are you sure you want to delete ${getPaymentMethodLabel(config.method)}?`)) return;

    try {
      await deletePaymentConfig(config.id);
      toast.success('Payment method deleted');
      fetchConfigs();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  return (
    <DashboardLayout>
      <Header
        title="Payment Methods"
        description="Configure payment options for customers"
        action={
          availableMethods.length > 0 && (
            <Button onClick={() => openModal()}>
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Method
            </Button>
          )
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : configs.length === 0 ? (
          <Card>
            <EmptyState
              title="No payment methods configured"
              description="Add payment methods so customers can pay for services"
              action={{ label: 'Add Payment Method', onClick: () => openModal() }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <Card key={config.id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {getPaymentMethodLabel(config.method)}
                    </h3>
                    <p className="text-sm text-gray-500">{config.accountTitle}</p>
                  </div>
                  <Badge variant={config.isActive ? 'success' : 'default'}>
                    {config.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account Number</span>
                    <span className="font-mono">{config.accountNumber}</span>
                  </div>
                  {config.bankName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bank</span>
                      <span>{config.bankName}</span>
                    </div>
                  )}
                </div>

                {config.instructions && (
                  <p className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded">
                    {config.instructions}
                  </p>
                )}

                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => openModal(config)}
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(config)}
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingConfig ? 'Edit Payment Method' : 'Add Payment Method'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingConfig && (
            <Select
              label="Payment Method"
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as PaymentMethod })}
              options={availableMethods}
              required
            />
          )}
          <Input
            label="Account Title"
            value={formData.accountTitle}
            onChange={(e) => setFormData({ ...formData, accountTitle: e.target.value })}
            placeholder="e.g., Your Business Name"
            required
          />
          <Input
            label="Account Number"
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            placeholder="e.g., 03001234567"
            required
          />
          {formData.method === 'BANK_TRANSFER' && (
            <Input
              label="Bank Name"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              placeholder="e.g., HBL - Habib Bank Limited"
            />
          )}
          <Textarea
            label="Instructions (optional)"
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            rows={2}
            placeholder="Any special instructions for customers..."
          />
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingConfig ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
