// API Base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';

// Auth API Endpoints
export const SEND_OTP = `${API_BASE_URL}/api/auth/otp/request/mobile`;
export const VERIFY_OTP = `${API_BASE_URL}/api/auth/otp/verify/mobile`;
export const SEND_EMAIL_OTP = `${API_BASE_URL}/api/auth/otp/request/email`;
export const VERIFY_EMAIL_OTP = `${API_BASE_URL}/api/auth/otp/verify/email`;
export const ME = `${API_BASE_URL}/api/auth/me`;
export const LOGOUT = `${API_BASE_URL}/api/auth/logout`;

// Product API Endpoints
export const PRODUCTS_ALL = `${API_BASE_URL}/api/products/all`;
export const PRODUCTS_FILTER = `${API_BASE_URL}/api/products/filter`;
export const PRODUCTS_SEARCH = `${API_BASE_URL}/api/products/search`;
export const PRODUCTS_FACETS = `${API_BASE_URL}/api/products/facets`;
export const PRODUCTS_NEW_ARRIVALS = `${API_BASE_URL}/api/products/new-arrivals`;
export const PRODUCTS_FEATURED = `${API_BASE_URL}/api/products/featured`;
export const PRODUCTS_TRENDING = `${API_BASE_URL}/api/products/trending`;
export const PRODUCT_DETAILS = (id: string) => `${API_BASE_URL}/api/products/${id}`;
export const PRODUCT_VARIANT = `${API_BASE_URL}/api/products/variant/lookup`;

// Cart API Endpoints
export const CART_GET = (userId: string) => `${API_BASE_URL}/api/cart/${userId}`;
export const CART_ADD = `${API_BASE_URL}/api/cart/add`;
export const CART_REMOVE = `${API_BASE_URL}/api/cart/remove`;
export const CART_DELETE = `${API_BASE_URL}/api/cart/delete`;

// Order API Endpoints
export const ORDERS_CREATE = `${API_BASE_URL}/api/orders`;
export const ORDERS_GET = (id: string) => `${API_BASE_URL}/api/orders/${id}`;
export const ORDERS_LIST = `${API_BASE_URL}/api/orders`;
export const ORDERS_CANCEL = (id: string) => `${API_BASE_URL}/api/orders/${id}/cancel`;
export const ORDERS_PAYMENT_SESSION = (id: string) => `${API_BASE_URL}/api/orders/${id}/payment-session`;
export const ORDERS_PAYMENT_STATUS = (sessionId: string) => `${API_BASE_URL}/api/orders/payment/status/${sessionId}`;

// Payment API Endpoints
export const PAYMENT_VERIFY = `${API_BASE_URL}/api/payments/webhook/razorpay`;
export const PAYMENT_SESSION = `${API_BASE_URL}/api/payments/session`;
export const PAYMENT_STATUS = (sessionId: string) => `${API_BASE_URL}/api/payments/status/${sessionId}`;

// Coupon API Endpoints
export const COUPON_VALIDATE = `${API_BASE_URL}/api/coupons/use`;

// Wishlist API Endpoints
export const WISHLIST_GET = `${API_BASE_URL}/api/wishlist`;
export const WISHLIST_ADD = `${API_BASE_URL}/api/wishlist/add`;
export const WISHLIST_REMOVE = `${API_BASE_URL}/api/wishlist/remove`;

// Review API Endpoints
export const REVIEWS_GET = `${API_BASE_URL}/api/reviews`;
export const REVIEWS_CREATE = `${API_BASE_URL}/api/reviews`;
export const REVIEWS_UPDATE = (id: string) => `${API_BASE_URL}/api/reviews/${id}`;
export const REVIEWS_DELETE = (id: string) => `${API_BASE_URL}/api/reviews/${id}`;
export const REVIEWS_MY = `${API_BASE_URL}/api/reviews/my`;

// Delivery API Endpoints
export const DELIVERY_CHECK_PINCODE = `${API_BASE_URL}/api/delivery/delivery/pincode/delhivery`;

// Return API Endpoints
export const RETURN_CREATE = `${API_BASE_URL}/api/return/create`;
export const RETURN_CANCEL = (id: string) => `${API_BASE_URL}/api/return/${id}/cancel`;
export const RETURN_LIST = `${API_BASE_URL}/api/return/my-returns`;
export const RETURN_GET = (id: string) => `${API_BASE_URL}/api/return/${id}`;

// Exchange API Endpoints
export const EXCHANGE_CREATE = `${API_BASE_URL}/api/exchange/create`;
export const EXCHANGE_CONFIRM_PAYMENT = `${API_BASE_URL}/api/exchange/confirm-payment`;

// App Constants
export const APP_NAME = "NeverFall";
export const APP_DESCRIPTION = "Your Ultimate Fashion Destination";

// Pagination
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

// Cart
export const CART_STORAGE_KEY = "cart";
export const USER_STORAGE_KEY = "user";

// Theme
export const THEME_STORAGE_KEY = "theme";

// Local Storage Keys
export const AUTH_TOKEN_KEY = "auth_token";
export const USER_ID_KEY = "userId";