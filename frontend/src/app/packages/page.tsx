'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
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
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { getPackages, getServices, createPackage, updatePackage, deletePackage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Package, Service } from '@/types';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [featuresInput, setFeaturesInput] = useState('');

  const [formData, setFormData] = useState({
    serviceId: '',
    name: '',
    description: '',
    price: 0,
    currency: 'PKR',
    duration: '',
    features: [] as string[],
    isPopular: false,
    displayOrder: 0,
    isActive: true,
  });

  const fetchData = async () => {
    try {
      const [packagesRes, servicesRes] = await Promise.all([
        getPackages(),
        getServices(),
      ]);
      if (packagesRes.success && packagesRes.data) {
        setPackages(packagesRes.data);
      }
      if (servicesRes.success && servicesRes.data) {
        setServices(servicesRes.data);
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

  const openModal = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        serviceId: pkg.serviceId,
        name: pkg.name,
        description: pkg.description,
        price: Number(pkg.price),
        currency: pkg.currency,
        duration: pkg.duration || '',
        features: pkg.features,
        isPopular: pkg.isPopular,
        displayOrder: pkg.displayOrder,
        isActive: pkg.isActive,
      });
      setFeaturesInput(pkg.features.join('\n'));
    } else {
      setEditingPackage(null);
      setFormData({
        serviceId: services[0]?.id || '',
        name: '',
        description: '',
        price: 0,
        currency: 'PKR',
        duration: '',
        features: [],
        isPopular: false,
        displayOrder: packages.length,
        isActive: true,
      });
      setFeaturesInput('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const features = featuresInput
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f);

    try {
      const data = { ...formData, features };
      if (editingPackage) {
        const { serviceId, ...updateData } = data;
        const response = await updatePackage(editingPackage.id, updateData);
        if (response.success) {
          toast.success('Package updated successfully');
          fetchData();
        }
      } else {
        const response = await createPackage(data);
        if (response.success) {
          toast.success('Package created successfully');
          fetchData();
        }
      }
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save package');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (pkg: Package) => {
    if (!confirm(`Are you sure you want to delete "${pkg.name}"?`)) return;

    try {
      const response = await deletePackage(pkg.id);
      if (response.success) {
        toast.success('Package deleted successfully');
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete package');
    }
  };

  const serviceOptions = services.map((s) => ({ value: s.id, label: s.name }));

  return (
    <DashboardLayout>
      <Header
        title="Packages"
        description="Manage service packages and pricing"
        action={
          <Button onClick={() => openModal()}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Package
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : packages.length === 0 ? (
          <Card>
            <EmptyState
              title="No packages yet"
              description="Create packages for your services"
              action={{ label: 'Add Package', onClick: () => openModal() }}
            />
          </Card>
        ) : (
          <Card padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Package</TableCell>
                  <TableCell header>Service</TableCell>
                  <TableCell header>Price</TableCell>
                  <TableCell header>Duration</TableCell>
                  <TableCell header>Orders</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="font-medium">{pkg.name}</span>
                        {pkg.isPopular && (
                          <StarIconSolid className="h-4 w-4 ml-2 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{pkg.service?.name}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(pkg.price), pkg.currency)}
                    </TableCell>
                    <TableCell className="text-gray-500">{pkg.duration || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="info">{pkg._count?.orders || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pkg.isActive ? 'success' : 'default'}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openModal(pkg)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(pkg)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
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
        title={editingPackage ? 'Edit Package' : 'Create Package'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {!editingPackage && (
              <Select
                label="Service"
                value={formData.serviceId}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                options={serviceOptions}
                required
              />
            )}
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              required
            />
            <Input
              label="Duration"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="e.g., 7-10 days"
            />
          </div>
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            required
          />
          <Textarea
            label="Features (one per line)"
            value={featuresInput}
            onChange={(e) => setFeaturesInput(e.target.value)}
            rows={5}
            placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
            required
          />
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isPopular}
                onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700">Mark as Popular</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingPackage ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
