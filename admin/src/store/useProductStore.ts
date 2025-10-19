import { create } from 'zustand';
import { Product } from '@/types';
import { productApi } from '@/api/products';

interface ProductState {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  fetchProducts: (page?: number, limit?: number) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,

  fetchProducts: async (page = 1, limit = 20) => {
    set({ loading: true });
    try {
      const data = await productApi.getProducts({ page, limit });
      set({
        products: data.items || [],
        total: data.total,
        page: data.page,
        totalPages: data.totalPages || data.pages || 1,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
    }
  },

  deleteProduct: async (id: string) => {
    await productApi.deleteProduct(id);
    const { fetchProducts, page } = get();
    await fetchProducts(page);
  },
}));