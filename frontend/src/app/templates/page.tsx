'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import {
  getMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  getSystemPrompts,
  createSystemPrompt,
  updateSystemPrompt,
  deleteSystemPrompt,
} from '@/lib/api';
import { MessageTemplate, SystemPrompt } from '@/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'prompts'>('templates');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MessageTemplate | SystemPrompt | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    content: '',
    description: '',
    category: '',
    isActive: true,
  });

  const fetchData = async () => {
    try {
      const [templatesRes, promptsRes] = await Promise.all([
        getMessageTemplates(),
        getSystemPrompts(),
      ]);
      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data);
      }
      if (promptsRes.success && promptsRes.data) {
        setPrompts(promptsRes.data);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (item?: MessageTemplate | SystemPrompt) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        content: item.content,
        description: item.description || '',
        category: (item as MessageTemplate).category || '',
        isActive: item.isActive,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        content: '',
        description: '',
        category: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (activeTab === 'templates') {
        if (editingItem) {
          await updateMessageTemplate(editingItem.id, formData);
          toast.success('Template updated');
        } else {
          await createMessageTemplate(formData);
          toast.success('Template created');
        }
      } else {
        if (editingItem) {
          await updateSystemPrompt(editingItem.id, formData);
          toast.success('Prompt updated');
        } else {
          await createSystemPrompt(formData);
          toast.success('Prompt created');
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: MessageTemplate | SystemPrompt) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      if (activeTab === 'templates') {
        await deleteMessageTemplate(item.id);
      } else {
        await deleteSystemPrompt(item.id);
      }
      toast.success('Deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  return (
    <DashboardLayout>
      <Header
        title="Templates & Prompts"
        description="Manage message templates and AI system prompts"
        action={
          <Button onClick={() => openModal()}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add {activeTab === 'templates' ? 'Template' : 'Prompt'}
          </Button>
        }
      />

      <div className="p-8">
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Message Templates
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'prompts'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            System Prompts
          </button>
        </div>

        {isLoading ? (
          <Loading className="py-20" />
        ) : activeTab === 'templates' ? (
          templates.length === 0 ? (
            <Card>
              <EmptyState
                title="No message templates"
                description="Create templates for common messages"
                action={{ label: 'Add Template', onClick: () => openModal() }}
              />
            </Card>
          ) : (
            <Card padding="none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Name</TableCell>
                    <TableCell header>Category</TableCell>
                    <TableCell header>Content Preview</TableCell>
                    <TableCell header>Status</TableCell>
                    <TableCell header>Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="info">{template.category || 'General'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-500">
                        {template.content.slice(0, 50)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? 'success' : 'default'}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <button onClick={() => openModal(template)} className="p-1 text-gray-400 hover:text-primary-600">
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDelete(template)} className="p-1 text-gray-400 hover:text-red-600">
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        ) : prompts.length === 0 ? (
          <Card>
            <EmptyState
              title="No system prompts"
              description="Create system prompts to configure AI behavior"
              action={{ label: 'Add Prompt', onClick: () => openModal() }}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => (
              <Card key={prompt.id}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
                    {prompt.description && (
                      <p className="text-sm text-gray-500 mt-1">{prompt.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={prompt.isActive ? 'success' : 'default'}>
                      {prompt.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <button onClick={() => openModal(prompt)} className="p-1 text-gray-400 hover:text-primary-600">
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(prompt)} className="p-1 text-gray-400 hover:text-red-600">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                  {prompt.content}
                </pre>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `Edit ${activeTab === 'templates' ? 'Template' : 'Prompt'}` : `Create ${activeTab === 'templates' ? 'Template' : 'Prompt'}`}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          {activeTab === 'templates' && (
            <Input
              label="Category (optional)"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., greeting, payment, order"
            />
          )}
          <Textarea
            label="Content"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={activeTab === 'prompts' ? 12 : 6}
            required
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
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
