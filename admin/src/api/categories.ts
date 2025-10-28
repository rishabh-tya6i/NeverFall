import axios from '@/utils/axios';
import { Category } from '@/types';

export const categoryApi = {
  getCategories: async (): Promise<Category[]> => {
    const { data } = await axios.get('/api/products/getAllCategories');
    return data.data;
  },
};