import React from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Phone, Mail } from 'lucide-react';

const Header: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <h2 className="text-xl font-semibold text-gray-800">
        Welcome back, {user?.name || 'Admin'}
      </h2>
      
      <div className="flex items-center space-x-4">
        <div className="hidden md:block text-right text-sm">
          {user?.phone && (
            <div className="flex items-center text-gray-600">
              <Phone className="mr-1 h-4 w-4" />
              {user.phone}
            </div>
          )}
          {user?.email && (
            <div className="flex items-center text-gray-500">
              <Mail className="mr-1 h-4 w-4" />
              {user.email}
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
          {user?.name?.charAt(0).toUpperCase() || user?.phone?.charAt(0) || 'A'}
        </div>
      </div>
    </header>
  );
};

export default Header;