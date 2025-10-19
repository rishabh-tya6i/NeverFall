import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { paymentApi } from '@/api/payments';
import Table from '@/components/Table';
import Pagination from '@/components/Pagination';
import { Payment } from '@/types';
import clsx from 'clsx';

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchPayments();
  }, [page, statusFilter]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await paymentApi.getPayments({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setPayments(data.payments || []);
      setTotal(data.total);
      setTotalPages(data.totalPages || data.pages || 1);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'paymentId',
      header: 'Payment ID',
      render: (item: Payment) => (
        <span className="font-mono text-sm">{item._id.slice(-8)}</span>
      ),
    },
    {
      key: 'user',
      header: 'Customer',
      render: (item: Payment) =>
        typeof item.user === 'object' ? item.user.name : 'N/A',
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: Payment) => `₹${item.amount.toLocaleString()}`,
    },
    {
      key: 'method',
      header: 'Method',
      render: (item: Payment) => (
        <span className="capitalize">{item.method}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Payment) => (
        <span
          className={clsx(
            'rounded-full px-2 py-1 text-xs font-medium',
            statusColors[item.status] || 'bg-gray-100 text-gray-800'
          )}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (item: Payment) => format(new Date(item.createdAt), 'MMM dd, yyyy'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="rounded-lg bg-white shadow">
        <Table
          columns={columns}
          data={payments}
          keyExtractor={(item) => item._id}
          loading={loading}
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default Payments;