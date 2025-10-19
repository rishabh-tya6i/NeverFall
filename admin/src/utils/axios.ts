import axios from 'axios';
import toast from 'react-hot-toast';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For cookies
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.response?.data?.message || 'An error occurred';

    if (status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('auth-storage');
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
        toast.error('Session expired. Please login again.');
      }
    } else if (status === 403) {
      // Don't redirect on 403, just show error
      toast.error(message);
    } else if (status === 429) {
      toast.error(message);
    } else if (status >= 400) {
      toast.error(message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;