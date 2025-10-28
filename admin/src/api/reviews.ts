import axios from '@/utils/axios';
import { Review, PaginatedResponse } from '@/types';

export const reviewApi = {
  // Get all reviews
  getReviews: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    productId?: string;
    userId?: string;
    flagged?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Review>> => {
    const { data } = await axios.get('/api/admin/reviews', { params });
    return data;
  },

  // Approve review
  approveReview: async (id: string) => {
    const { data } = await axios.patch(`/api/admin/reviews/${id}/approve`);
    return data;
  },

  // Reject review
  rejectReview: async (id: string) => {
    const { data } = await axios.patch(`/api/admin/reviews/${id}/reject`);
    return data;
  },

  // Flag review
  flagReview: async (id: string, flagged: boolean) => {
    const { data } = await axios.patch(`/api/admin/reviews/${id}/flag`, {
      flagged,
    });
    return data;
  },

  // Delete review
  deleteReview: async (id: string) => {
    const { data } = await axios.delete(`/api/admin/reviews/${id}`);
    return data;
  },
};