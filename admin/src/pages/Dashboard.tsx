import React, { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { orderApi } from '@/api/orders';
import { paymentApi } from '@/api/payments';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Dashboard: React.FC = () => {
  const [orderAnalytics, setOrderAnalytics] = useState<any>(null);
  const [paymentAnalytics, setPaymentAnalytics] = useState<any>(null);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [orders, payments] = await Promise.all([
        orderApi.getAnalytics(period),
        paymentApi.getAnalytics(period),
      ]);
      setOrderAnalytics(orders);
      setPaymentAnalytics(payments);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Sales"
          value={`₹${orderAnalytics?.analytics?.totalSales?.toLocaleString() || 0}`}
          icon={DollarSign}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          title="Total Orders"
          value={orderAnalytics?.analytics?.totalOrders || 0}
          icon={ShoppingBag}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Avg Order Value"
          value={`₹${orderAnalytics?.analytics?.averageOrderValue?.toFixed(2) || 0}`}
          icon={TrendingUp}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Transactions"
          value={paymentAnalytics?.analytics?.totalTransactions || 0}
          icon={Users}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Order Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={orderAnalytics?.statusDistribution || []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {orderAnalytics?.statusDistribution?.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Payment Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentAnalytics?.statusDistribution || []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {paymentAnalytics?.statusDistribution?.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Payment Analytics</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-gray-600">Total Volume</p>
            <p className="text-2xl font-semibold text-gray-900">
              ₹{paymentAnalytics?.analytics?.totalVolume?.toLocaleString() || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Successful</p>
            <p className="text-2xl font-semibold text-green-600">
              {paymentAnalytics?.analytics?.successfulTransactions || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Failed</p>
            <p className="text-2xl font-semibold text-red-600">
              {paymentAnalytics?.analytics?.failedTransactions || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;