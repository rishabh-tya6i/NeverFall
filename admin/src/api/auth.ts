import axios from '@/utils/axios';

export interface RequestOtpResponse {
  ok: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    email?: string;
    role: string;
    name?: string;
  };
}

export const authApi = {
  // Request OTP to mobile
  requestMobileOtp: async (phone: string): Promise<RequestOtpResponse> => {
    const { data } = await axios.post('/api/auth/otp/request/mobile', { phone });
    return data;
  },

  // Verify mobile OTP
  verifyMobileOtp: async (phone: string, otp: string): Promise<VerifyOtpResponse> => {
    const { data } = await axios.post('/api/auth/otp/verify/mobile', { phone, otp });
    return data;
  },

  // Request OTP to email
  requestEmailOtp: async (email: string, phone: string): Promise<RequestOtpResponse> => {
    const { data } = await axios.post('/api/auth/otp/request/email', { email, phone });
    return data;
  },

  // Verify email OTP
  verifyEmailOtp: async (
    email: string,
    phone: string,
    otp: string
  ): Promise<VerifyOtpResponse> => {
    const { data } = await axios.post('/api/auth/otp/verify/email', { email, phone, otp });
    return data;
  },

  // Get current user
  me: async () => {
    const { data } = await axios.get('/api/auth/me');
    return data;
  },

  // Logout
  logout: async () => {
    const { data } = await axios.post('/api/auth/logout');
    return data;
  },
};