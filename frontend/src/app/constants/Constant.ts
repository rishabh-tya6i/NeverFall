const BASE_URL = 'http://127.0.0.1:8080';

export const SEND_OTP = BASE_URL + "/api/auth/otp/request/mobile";
export const VERIFY_OTP = BASE_URL + "/api/auth/otp/verify/mobile";
export const ME = BASE_URL + "/api/auth/me";
export const LOGOUT = BASE_URL + "/api/auth/logout";