import { create } from 'zustand';
import { Review } from '@/types';
import { reviewApi } from '@/api/reviews';

interface ReviewState {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  fetchReviews: (params?: any) => Promise<void>;
  approveReview: (id: string) => Promise<void>;
  rejectReview: (id: string) => Promise<void>;
  flagReview: (id: string, flagged: boolean) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,

  fetchReviews: async (params = {}) => {
    set({ loading: true });
    try {
      const data = await reviewApi.getReviews(params);
      set({
        reviews: data.reviews || [],
        total: data.total,
        page: data.page,
        totalPages: data.totalPages || data.pages || 1,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
    }
  },

  approveReview: async (id: string) => {
    await reviewApi.approveReview(id);
    const { fetchReviews } = get();
    await fetchReviews();
  },

  rejectReview: async (id: string) => {
    await reviewApi.rejectReview(id);
    const { fetchReviews } = get();
    await fetchReviews();
  },

  flagReview: async (id: string, flagged: boolean) => {
    await reviewApi.flagReview(id, flagged);
    const { fetchReviews } = get();
    await fetchReviews();
  },

  deleteReview: async (id: string) => {
    await reviewApi.deleteReview(id);
    const { fetchReviews } = get();
    await fetchReviews();
  },
}));