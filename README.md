# NeverFall - E-commerce Platform

A modern, full-stack e-commerce platform built with Next.js, Tailwind CSS, Daisy UI, and Node.js/Express backend.

## 🚀 Features

### Frontend Features
- **Modern UI/UX**: Built with Next.js 15, Tailwind CSS, and Daisy UI
- **Responsive Design**: Mobile-first approach with beautiful responsive layouts
- **Product Catalog**: Browse products with advanced filtering and search
- **Shopping Cart**: Add/remove items, quantity management, and cart persistence
- **User Authentication**: OTP-based authentication system
- **Order Management**: Place orders, track status, and view order history
- **Wishlist**: Save favorite products for later
- **Reviews & Ratings**: Product reviews and rating system
- **Returns & Exchanges**: Request returns and exchanges
- **Payment Integration**: Razorpay payment gateway integration
- **Dark/Light Theme**: Toggle between themes
- **Real-time Updates**: Live cart count and notifications

### Backend Features
- **RESTful API**: Comprehensive API endpoints for all features
- **Authentication**: JWT-based authentication with OTP verification
- **Product Management**: CRUD operations for products and variants
- **Order Processing**: Complete order lifecycle management
- **Payment Processing**: Multiple payment gateway support (Razorpay, PayU)
- **Inventory Management**: Stock tracking and reservation
- **Coupon System**: Discount codes and promotional offers
- **Review System**: Product reviews and ratings
- **Return/Exchange**: Return request management
- **Delivery Tracking**: Pincode-based delivery checking
- **Admin Panel**: Administrative interface for managing the platform

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS + Daisy UI
- **State Management**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **UI Components**: Daisy UI + Custom Components
- **Authentication**: React Secure Storage
- **TypeScript**: Full TypeScript support

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Caching**: Redis
- **Authentication**: JWT + OTP
- **Payment**: Razorpay, PayU integration
- **File Upload**: Multer
- **Logging**: Winston
- **Validation**: Joi

## 📁 Project Structure

```
NevrFall/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App Router pages and components
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── products/    # Product-related pages
│   │   │   ├── orders/      # Order management pages
│   │   │   ├── returns/     # Return management pages
│   │   │   └── ...
│   │   ├── services/        # API service layer
│   │   └── constants/       # Application constants
│   ├── public/              # Static assets
│   └── package.json
├── backend/                 # Express.js backend application
│   ├── Controllers/         # Route controllers
│   ├── Models/             # Database models
│   ├── Routes/             # API routes
│   ├── Services/           # Business logic services
│   ├── Middlewares/        # Custom middlewares
│   └── utils/              # Utility functions
└── admin/                  # Admin dashboard (React)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB
- Redis
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd NevrFall
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   npm install

   # Admin (optional)
   cd ../admin
   npm install
   ```

3. **Environment Setup**
   
   Create `.env` files in the respective directories:

   **Backend (.env)**
   ```env
   PORT=8080
   MONGODB_URI=mongodb://localhost:27017/nevrfall
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your-jwt-secret
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   CLIENT_URL=http://localhost:3000
   ```

   **Frontend (.env.local)**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key
   ```

4. **Start the applications**
   
   **Backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

   **Admin (optional):**
   ```bash
   cd admin
   npm run dev
   ```

## 📱 Available Pages

### Customer Pages
- **Home** (`/`) - Landing page with featured products
- **Products** (`/products`) - Product catalog with filters
- **Product Details** (`/products/[slug]`) - Individual product page
- **Categories** (`/categories`) - Browse by categories
- **Cart** (`/cart`) - Shopping cart
- **Checkout** (`/checkout`) - Order placement
- **Orders** (`/orders`) - Order history
- **Order Details** (`/orders/[id]`) - Individual order details
- **Returns** (`/returns`) - Return requests
- **Return Details** (`/returns/[id]`) - Return request details
- **Profile** (`/profile`) - User profile management
- **About** (`/about`) - About page
- **Contact** (`/contact`) - Contact page

### Admin Pages
- Product management
- Order management
- User management
- Analytics dashboard
- Settings

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/otp/request/mobile` - Request OTP
- `POST /api/auth/otp/verify/mobile` - Verify OTP
- `GET /api/auth/me` - Get user profile
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products/all` - Get all products
- `GET /api/products/filter` - Filter products
- `GET /api/products/search` - Search products
- `GET /api/products/featured` - Get featured products
- `GET /api/products/new-arrivals` - Get new arrivals
- `GET /api/products/trending` - Get trending products
- `GET /api/products/:id` - Get product details

### Cart
- `GET /api/cart/:userId` - Get user cart
- `POST /api/cart/add` - Add to cart
- `POST /api/cart/remove` - Remove from cart
- `DELETE /api/cart/delete` - Delete from cart

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/cancel` - Cancel order

### Reviews
- `GET /api/reviews` - Get product reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

## 🎨 UI Components

### Reusable Components
- **ProductCard** - Product display card
- **LoadingSpinner** - Loading states
- **SearchBar** - Product search
- **Pagination** - Page navigation
- **LoginDialog** - Authentication modal

### Layout Components
- **Navbar** - Navigation with cart and user menu
- **Footer** - Site footer
- **Providers** - Context providers wrapper

## 🔐 Authentication Flow

1. User enters phone number
2. OTP is sent to the phone
3. User enters OTP for verification
4. JWT token is issued and stored securely
5. User is logged in and can access protected features

## 💳 Payment Integration

- **Razorpay**: Primary payment gateway
- **PayU**: Alternative payment gateway
- **COD**: Cash on Delivery
- **Wallet**: User wallet balance

## 🚚 Delivery & Returns

- **Pincode Check**: Verify delivery availability
- **Return Policy**: 30-day return window
- **Exchange**: Size/color exchanges
- **Tracking**: Order status tracking

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm run test

# Backend tests
cd backend
npm run test
```

## 📦 Deployment

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables
3. Deploy automatically on push

### Backend (Railway/Heroku)
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Database
- MongoDB Atlas for production
- Redis Cloud for caching

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

- **Frontend**: Next.js, Tailwind CSS, Daisy UI
- **Backend**: Node.js, Express, MongoDB
- **DevOps**: Vercel, Railway, MongoDB Atlas

## 📞 Support

For support, email support@neverfall.com or create an issue in the repository.

---

**NeverFall** - Your Ultimate Fashion Destination 🛍️
