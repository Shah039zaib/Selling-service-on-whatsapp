'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Header from '@/components/layout/Header';
import { Card, CardHeader } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { getAnalytics } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await getAnalytics(parseInt(period));
        if (response.success && response.data) {
          setAnalytics(response.data);
        }
      } catch (error) {
        console.error('Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  const periodOptions = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
  ];

  return (
    <DashboardLayout>
      <Header
        title="Analytics"
        description="View platform statistics and trends"
        action={
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={periodOptions}
            className="w-40"
          />
        }
      />

      <div className="p-8">
        {isLoading ? (
          <Loading className="py-20" />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader title="Orders by Status" />
                <div className="space-y-3">
                  {analytics?.ordersByStatus?.map((item: any) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.status.replace('_', ' ')}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Orders by Payment Method" />
                <div className="space-y-3">
                  {analytics?.ordersByPaymentMethod?.map((item: any) => (
                    <div key={item.method} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{item.method || 'Not selected'}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader title="Customer Growth" />
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium">
                    {analytics?.customerGrowth?.reduce((acc: number, c: any) => acc + c.count, 0) || 0}
                  </p>
                  <p className="text-sm">New customers in selected period</p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Message Volume" />
              <div className="space-y-4">
                {analytics?.messageVolume?.slice(0, 10).map((item: any) => (
                  <div key={item.date} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{item.date}</span>
                    <div className="flex space-x-4 text-sm">
                      <span className="text-green-600">In: {item.inbound}</span>
                      <span className="text-blue-600">Out: {item.outbound}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="AI Usage" />
              <div className="space-y-4">
                {analytics?.aiUsage?.slice(0, 10).map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{item.date}</span>
                    <div className="flex space-x-4 text-sm">
                      <span>Requests: {item.count}</span>
                      <span className="text-gray-500">Tokens: {item.tokens}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
