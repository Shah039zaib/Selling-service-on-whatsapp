'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { getAIProviders, createAIProvider, updateAIProvider, deleteAIProvider, resetAIProviderUsage } from '@/lib/api';
import { getProviderColor } from '@/lib/utils';
import { AIProvider, AIProviderType } from '@/types';

const providerTypes = [
  { value: 'CLAUDE', label: 'Claude (Anthropic)' },
  { value: 'GEMINI', label: 'Gemini (Google)' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'COHERE', label: 'Cohere' },
];

export default function AIProvidersPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'CLAUDE' as AIProviderType,
    apiKey: '',
    model: '',
    dailyLimit: 1000,
    priority: 0,
    isActive: true,
  });

  const fetchProviders = async () => {
    try {
      const response = await getAIProviders();
      if (response.success && response.data) {
        setProviders(response.data.providers || []);
        setStats(response.data.stats || []);
      }
    } catch (error) {
      toast.error('Failed to load AI providers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const openModal = (provider?: AIProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name,
        type: provider.type,
        apiKey: '',
        model: provider.model || '',
        dailyLimit: provider.dailyLimit,
        priority: provider.priority,
        isActive: provider.isActive,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        type: 'CLAUDE',
        apiKey: '',
        model: '',
        dailyLimit: 1000,
        priority: providers.length,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingProvider) {
        const updateData: any = { ...formData };
        if (!updateData.apiKey) delete updateData.apiKey;
        delete updateData.type;
        const response = await updateAIProvider(editingProvider.id, updateData);
        if (response.success) {
          toast.success('Provider updated successfully');
          fetchProviders();
        }
      } else {
        const response = await createAIProvider(formData);
        if (response.success) {
          toast.success('Provider created successfully');
          fetchProviders();
        }
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save provider');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (provider: AIProvider) => {
    if (!confirm(`Are you sure you want to delete "${provider.name}"?`)) return;

    try {
      await deleteAIProvider(provider.id);
      toast.success('Provider deleted');
      fetchProviders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete provider');
    }
  };

  const handleResetUsage = async (provider: AIProvider) => {
    try {
      await resetAIProviderUsage(provider.id);
      toast.success('Usage reset successfully');
      fetchProviders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset usage');
    }
  };

  return (
    <DashboardLayout>
      <Header
        title="AI Providers"
        description="Manage AI service providers for conversations"
        action={
          <Button onClick={() => openModal()}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Provider
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : providers.length === 0 ? (
          <Card>
            <EmptyState
              title="No AI providers configured"
              description="Add an AI provider to enable automated conversations"
              action={{ label: 'Add Provider', onClick: () => openModal() }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => {
              const providerStats = stats.find((s) => s.id === provider.id);
              const usagePercent = (provider.usedToday / provider.dailyLimit) * 100;

              return (
                <Card key={provider.id}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                      <Badge className={`mt-1 ${getProviderColor(provider.type)}`}>
                        {provider.type}
                      </Badge>
                    </div>
                    <Badge variant={provider.isActive ? 'success' : 'default'}>
                      {provider.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {provider.model && (
                    <p className="text-sm text-gray-500 mb-3">Model: {provider.model}</p>
                  )}

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Daily Usage</span>
                      <span>{provider.usedToday} / {provider.dailyLimit}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetUsage(provider)}
                      title="Reset daily usage"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openModal(provider)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(provider)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProvider ? 'Edit AI Provider' : 'Add AI Provider'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Claude Free Tier"
            required
          />
          {!editingProvider && (
            <Select
              label="Provider Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AIProviderType })}
              options={providerTypes}
              required
            />
          )}
          <Input
            label={editingProvider ? 'API Key (leave empty to keep current)' : 'API Key'}
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            required={!editingProvider}
          />
          <Input
            label="Model (optional)"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="e.g., claude-3-haiku-20240307"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daily Limit"
              type="number"
              value={formData.dailyLimit}
              onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) })}
            />
            <Input
              label="Priority"
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              helperText="Higher = used first"
            />
          </div>
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
              {editingProvider ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
