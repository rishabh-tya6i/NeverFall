import axios from '@/utils/axios';
import { Order, Analytics, StatusDistribution, PaginatedResponse } from '@/types';

export const orderApi = {
  // Get all orders
  getOrders: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>> => {
    const { data } = await axios.get('/admin/orders', { params });
    return data;
  },

  // Update order status
  updateOrderStatus: async (id: string, status: string) => {
    const { data } = await axios.patch(`/admin/orders/${id}/status`, {
      status,
    });
    return data;
  },

  // Approve refund
  approveRefund: async (id: string, reason?: string) => {
    const { data } = await axios.post(`/admin/orders/${id}/refund`, {
      reason,
    });
    return data;
  },

  // Get analytics
  getAnalytics: async (period: '24h' | '7d' | '30d' = '30d') => {
    const { data } = await axios.get('/admin/orders/analytics', {
      params: { period },
    });
    return data as {
      period: string;
      analytics: Analytics;
      statusDistribution: StatusDistribution[];
    };
  },
};