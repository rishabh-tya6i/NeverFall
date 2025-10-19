export interface User {
  _id: string;
  name: string;
  email?: string;
  phone: string;
  role: string;
}

// Image schema matching backend
export interface ProductImage {
  url: string;
  alt: string;
}

// Updated Product to match your schema
export interface Product {
  _id: string;
  parent: ParentProduct | string;
  title: string;
  slug: string;
  color: string;
  colorLabel: string;
  coverImage?: string;
  images: ProductImage[];
  priceFrom: number;
  compareAtFrom?: number;
  inStock: boolean;
  availableSizes: string[];
  currency: string;
  isTrending: boolean;
  collections: string[];
  publishAt?: Date;
  primaryCategoryId?: string;
  clicks: number;
  purchases: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParentProduct {
  _id: string;
  title: string;
  slug: string;
  description: string;
  details: Record<string, any>;
  tags: string[];
  categories: string;
  CollectionType?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  _id: string;
  product: string;
  size: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

export interface Order {
  _id: string;
  user: User | string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  shipping?: any;
  payment?: any;
  meta?: {
    statusHistory?: StatusHistory[];
    refund?: RefundInfo;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'confirmed'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'return-requested'
  | 'returned'
  | 'exchange-requested'
  | 'exchange-approved'
  | 'pickup-scheduled'
  | 'picked-up'
  | 'exchanged'
  | 'exchange-rejected';

export interface OrderItem {
  product: string;
  variant: string;
  quantity: number;
  price: number;
}

export interface StatusHistory {
  status: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface RefundInfo {
  approvedBy: string;
  approvedAt: Date;
  reason: string;
  refundResults: RefundResult[];
}

export interface RefundResult {
  paymentId: string;
  refundId: string;
  method: string;
  amount: number;
  status: string;
  error?: string;
  gatewayResponse?: any;
}

export interface Payment {
  _id: string;
  order: Order | string;
  user: User | string;
  method: 'cod' | 'wallet' | 'razorpay' | 'payu';
  walletTransactionId?: string;
  amount: number;
  currency: string;
  gatewayPaymentId?: string;
  status: PaymentStatus;
  meta?: Record<string, any>;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus = 
  | 'created' 
  | 'attempted' 
  | 'success' 
  | 'failed' 
  | 'cod_pending' 
  | 'refunded';

export interface Review {
  _id: string;
  user: User | string;
  product: Product | string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  flagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Analytics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface PaymentAnalytics {
  totalVolume: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
}

export interface PaginatedResponse<T> {
  items?: T[];
  orders?: T[];
  payments?: T[];
  reviews?: T[];
  total: number;
  page: number;
  pages?: number;
  totalPages?: number;
  limit?: number;
}