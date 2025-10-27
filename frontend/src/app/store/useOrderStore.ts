import {create} from 'zustand';

interface OrderState {
  coupon: string;
  setCoupon: (tab: string) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  coupon: '',
  setCoupon: (tab) => set({ coupon: tab }),
}));
