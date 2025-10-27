import axios from '@/utils/axios';
import { Product, ParentProduct, ProductVariant, PaginatedResponse } from '@/types';

export const productApi = {
  // Get all products
  getProducts: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Product>> => {
    const { data } = await axios.get('/admin/products', { params });
    return data;
  },

  // Get all parent products
  getParentProducts: async (): Promise<ParentProduct[]> => {
    const { data } = await axios.get('/admin/products/parents');
    return data.items;
  },

  // Create parent product
  createParentProduct: async (payload: Partial<ParentProduct>) => {
    const { data } = await axios.post('/admin/products/parent', payload);
    return data;
  },

  // Create product
  createProduct: async (payload: any) => {
    const { data } = await axios.post('/admin/products', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  // Update product
  updateProduct: async (id: string, payload: Partial<Product>) => {
    const { data } = await axios.put(`/admin/products/${id}`, payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  // Delete product
  deleteProduct: async (id: string) => {
    const { data } = await axios.delete(`/admin/products/${id}`);
    return data;
  },

  // Update stock
  updateStock: async (variantId: string, stock: number) => {
    const { data } = await axios.patch(`/admin/products/${variantId}/stock`, {
      stock,
    });
    return data;
  },

  // Bulk update stock
  bulkUpdateStock: async (updates: Array<{ variantId: string; stock: number }>) => {
    const { data } = await axios.post('/admin/products/stock/bulk', {
      updates,
    });
    return data;
  },
};