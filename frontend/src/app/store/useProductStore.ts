
import { create } from 'zustand';
import { productAPI } from '@/services/api';

interface ProductState {
  products: any[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  filters: any;
  fetchProducts: (filters: any, page?: number) => Promise<void>;
  setFilters: (filters: any) => void;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  filters: {
    search: '',
    sort: '',
    category: '',
    priceRange: '',
  },

  fetchProducts: async (filters, page = 1) => {
    set({ loading: true });
    try {
      const params = {
        ...filters,
        limit: 12,
        page,
      };
      
      const res = await productAPI.getByFilter(params);
      
      set({
        products: res.data.items || [],
        total: res.data.total,
        page: res.data.page,
        totalPages: res.data.totalPages || res.data.pages || 1,
        loading: false,
        filters,
      });
    } catch (error) {
      set({ loading: false });
    }
  },

  setFilters: (newFilters) => {
    const { filters } = get();
    const updatedFilters = { ...filters, ...newFilters };
    set({ filters: updatedFilters, page: 1 }); // Reset to page 1 on filter change
  },
}));
