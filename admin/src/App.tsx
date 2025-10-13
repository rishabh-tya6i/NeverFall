import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import OrdersPage from './pages/OrdersPage';
import CouponsPage from './pages/CouponsPage';
import LoginPage from './pages/LoginPage';

// This is a minimal authentication check, you should implement proper context/state management
const isAuthenticated = true; // Placeholder for actual auth logic

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Admin Routes */}
        <Route 
          path="/" 
          element={isAuthenticated ? <AdminLayout /> : <LoginPage />}
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          {/* Add routes for Products, Categories, Settings etc. */}
        </Route>

        <Route path="*" element={<h1 className="text-xl p-8">404 Not Found</h1>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;