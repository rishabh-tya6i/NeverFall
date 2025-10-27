
import { create } from 'zustand';
import api from '@/services/api';

interface Category {
  _id: string;
  name: string;
  image?: string;
}

interface CategoryStore {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  loading: false,
  error: null,
  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('api/products/getAllCategories');
      set({ categories: response.data.data || [], loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch categories', loading: false });
    }
  },
}));
