import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Flag, Trash2 } from 'lucide-react';
import { useReviewStore } from '@/store/useReviewStore';
import Table from '@/components/Table';
import Pagination from '@/components/Pagination';
import { Review } from '@/types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const statusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

const Reviews: React.FC = () => {
  const {
    reviews,
    total,
    page,
    totalPages,
    loading,
    fetchReviews,
    approveReview,
    rejectReview,
    flagReview,
    deleteReview,
  } = useReviewStore();
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchReviews({ status: statusFilter || undefined });
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    try {
      await approveReview(id);
      toast.success('Review approved');
    } catch (error) {
      toast.error('Failed to approve review');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectReview(id);
      toast.success('Review rejected');
    } catch (error) {
      toast.error('Failed to reject review');
    }
  };

  const handleFlag = async (id: string, flagged: boolean) => {
    try {
      await flagReview(id, flagged);
      toast.success(flagged ? 'Review flagged' : 'Review unflagged');
    } catch (error) {
      toast.error('Failed to flag review');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      await deleteReview(id);
      toast.success('Review deleted');
    } catch (error) {
      toast.error('Failed to delete review');
    }
  };

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (item: Review) =>
        typeof item.user === 'object' ? item.user.name : 'N/A',
    },
    {
      key: 'product',
      header: 'Product',
      render: (item: Review) =>
        typeof item.product === 'object' ? item.product.title : 'N/A',
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (item: Review) => (
        <div className="flex items-center">
          <span className="mr-1 text-yellow-500">★</span>
          {item.rating}
        </div>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (item: Review) => (
        <span className="line-clamp-2 max-w-xs">{item.comment}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Review) => (
        <div className="flex items-center space-x-2">
          <span
            className={clsx(
              'rounded-full px-2 py-1 text-xs font-medium',
              statusColors[item.status] || 'bg-gray-100 text-gray-800'
            )}
          >
            {item.status}
          </span>
          {item.flagged && (
            <Flag className="h-4 w-4 text-red-600" fill="currentColor" />
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (item: Review) => format(new Date(item.createdAt), 'MMM dd, yyyy'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Review) => (
        <div className="flex space-x-1">
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(item._id)}
                className="rounded p-1 text-green-600 hover:bg-green-50"
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleReject(item._id)}
                className="rounded p-1 text-red-600 hover:bg-red-50"
                title="Reject"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => handleFlag(item._id, !item.flagged)}
            className={clsx(
              'rounded p-1 hover:bg-yellow-50',
              item.flagged ? 'text-red-600' : 'text-yellow-600'
            )}
            title={item.flagged ? 'Unflag' : 'Flag'}
          >
            <Flag className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(item._id)}
            className="rounded p-1 text-red-600 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="rounded-lg bg-white shadow">
        <Table
          columns={columns}
          data={reviews}
          keyExtractor={(item) => item._id}
          loading={loading}
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => fetchReviews({ page: p, status: statusFilter || undefined })}
        />
      </div>
    </div>
  );
};

export default Reviews;