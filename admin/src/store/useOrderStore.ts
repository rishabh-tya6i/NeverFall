import { create } from 'zustand';
import { Order } from '@/types';
import { orderApi } from '@/api/orders';

interface OrderState {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  fetchOrders: (params?: any) => Promise<void>;
  updateOrderStatus: (id: string, status: string) => Promise<void>;
  approveRefund: (id: string, reason?: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,

  fetchOrders: async (params = {}) => {
    set({ loading: true });
    try {
      const data = await orderApi.getOrders(params);
      set({
        orders: data.orders || [],
        total: data.total,
        page: data.page,
        totalPages: data.totalPages || data.pages || 1,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
    }
  },

  updateOrderStatus: async (id: string, status: string) => {
    await orderApi.updateOrderStatus(id, status);
    const { fetchOrders } = get();
    await fetchOrders();
  },

  approveRefund: async (id: string, reason?: string) => {
    await orderApi.approveRefund(id, reason);
    const { fetchOrders } = get();
    await fetchOrders();
  },
}));