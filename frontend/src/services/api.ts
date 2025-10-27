// frontend/src/services/api.ts
import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = secureLocalStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth APIs
export const authAPI = {
  requestOtp: (phone: string) => api.post('/api/auth/otp/request/mobile', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/api/auth/otp/verify/mobile', { phone, otp }),
  requestEmailOtp: (email: string, phone: string) => api.post('/api/auth/otp/request/email', { email, phone }),
  verifyEmailOtp: (email: string, otp: string, phone: string) => api.post('/api/auth/otp/verify/email', { email, otp, phone }),
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

// Product APIs
export const productAPI = {
  getAll: (params: { limit?: number; cursor?: string; sort?: string }) => 
    api.get('/api/products/all', { params }),
  getByFilter: (params: any) => api.get('/api/products/filter', { params }),
  search: (params: { q: string; limit?: number; cursor?: string }) => 
    api.get('/api/products/search', { params }),
  getFacets: (params?: any) => api.get('/api/products/facets', { params }),
  getNewArrivals: (params: { limit?: number; cursor?: string }) => 
    api.get('/api/products/new-arrivals', { params }),
  getFeatured: (params: { limit?: number; cursor?: string }) => 
    api.get('/api/products/featured', { params }),
  getTrending: (params: { limit?: number; cursor?: string }) => 
    api.get('/api/products/trending', { params }),
  getRecommended: (params: { limit?: number; cursor?: string }) =>
    api.get('/api/products/recommended', { params }),
  getDetails: (idOrSlug: string, params?: { sku?: string }) => 
    api.get(`/api/products/${idOrSlug}`, { params }),
  getVariant: (params: { sku?: string; productId?: string; size?: string }) => 
    api.get('/api/products/variant/lookup', { params }),
  getColorFeed: (params: { limit?: number; cursor?: string; sort?: string; seed?: string }) =>
    api.get('/api/products/color-feed', { params }),
  getAllCategories: () => api.get('/api/products/getAllCategories'),
};

// Cart APIs
export const cartAPI = {
  get: (userId: string) => api.get(`/api/cart/${userId}`),
  add: (data: { userId: string; variantId: string; quantity?: number }) => 
    api.post('/api/cart/add', data),
  remove: (data: { userId: string; variantId: string; size: string }) => 
    api.post('/api/cart/remove', data),
  delete: (data: { userId: string; variantId: string }) => 
    api.delete('/api/cart/delete', { data }),
};

// Order APIs
export const orderAPI = {
  create: (data: any) => api.post('/api/orders', data),
  get: (id: string) => api.get(`/api/orders/${id}`),
  list: (params: { page?: number; limit?: number; status?: string }) => 
    api.get('/api/orders', { params }),
  cancel: (id: string, data: { reason?: string }) => 
    api.post(`/api/orders/${id}/cancel`, data),
  createPaymentSession: (orderId: string, data: any) => 
    api.post(`/api/orders/${orderId}/payment-session`, data),
  checkPaymentStatus: (sessionId: string) => 
    api.get(`/api/orders/payment/status/${sessionId}`),
};

// Payment APIs
export const paymentAPI = {
  verifyPayment: (data: {
    sessionId: string;
    gatewayPaymentId: string;
    gatewayOrderId: string;
    gatewaySignature: string;
  }) => api.post('/api/payments/webhook/razorpay', data),
  createPaymentSession: (data: any) => api.post('/api/payments/session', data),
  getPaymentStatus: (sessionId: string) => api.get(`/api/payments/status/${sessionId}`),
};

// Coupon APIs
export const couponAPI = {
  validate: (data: { code: string; userId: string; items: any[] }) => 
    api.post('/api/coupons/use', data),
};

// Wishlist APIs
export const wishlistAPI = {
  get: (params?: { fresh?: boolean }) => api.get('/api/wishlist', { params }),
  add: (data: { productId: string }) => api.post('/api/wishlist/add', data),
  remove: (data: { itemId?: string; productId?: string }) => 
    api.post('/api/wishlist/remove', data),
};

// Review APIs
export const reviewAPI = {
  getProductReviews: (params: { parentProductId: string; page?: number; limit?: number }) => 
    api.get('/api/reviews', { params }),
  create: (data: {
    productId: string;
    rating: number;
    body?: string;
    images?: string[];
    orderId?: string;
  }) => api.post('/api/reviews', data),
  update: (id: string, data: any) => api.put(`/api/reviews/${id}`, data),
  delete: (id: string) => api.delete(`/api/reviews/${id}`),
  getMyReview: (params: { productId: string }) => 
    api.get('/api/reviews/my', { params }),
};

// Delivery APIs
export const deliveryAPI = {
  checkPincode: (pin: string) => 
    api.get('/api/delivery/delivery/pincode/delhivery', { params: { pin } }),
};

// Return APIs
export const returnAPI = {
  create: (data: any) => api.post('/api/return/create', data),
  cancel: (id: string) => api.post(`/api/return/${id}/cancel`),
  list: (params: { page?: number; limit?: number }) => 
    api.get('/api/return/my-returns', { params }),
  get: (id: string) => api.get(`/api/return/${id}`),
};

// Exchange APIs
export const exchangeAPI = {
  create: (data: any) => api.post('/api/exchange/create', data),
  confirmPayment: (data: { exchangeId: string; paymentMethod?: string }) => 
    api.post('/api/exchange/confirm-payment', data),
};

export default api;