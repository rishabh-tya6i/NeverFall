import axios from '@/utils/axios';
import { Payment, PaymentAnalytics, StatusDistribution, PaginatedResponse } from '@/types';

export const paymentApi = {
  // Get all payments
  getPayments: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    orderId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Payment>> => {
    const { data } = await axios.get('/admin/payments', { params });
    return data;
  },

  // Get analytics
  getAnalytics: async (period: '24h' | '7d' | '30d' = '30d') => {
    const { data } = await axios.get('/admin/payments/analytics', {
      params: { period },
    });
    return data as {
      period: string;
      analytics: PaymentAnalytics;
      statusDistribution: StatusDistribution[];
    };
  },
};