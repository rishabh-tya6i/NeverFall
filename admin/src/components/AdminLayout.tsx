import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Search, Bell, User } from 'lucide-react';

const AdminLayout: React.FC = () => {
  // Simple Header/Navbar
  const Header: React.FC = () => (
    <header className="flex justify-between items-center h-16 bg-white dark:bg-gray-800 shadow px-6 sticky top-0 z-10">
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {/* Dynamically get page title based on route if needed */}
          Dashboard
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white">
          <Search className="w-5 h-5" />
        </button>
        <button className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white">
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2 cursor-pointer">
          <User className="w-8 h-8 rounded-full text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin</span>
        </div>
      </div>
    </header>
  );

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Sidebar />
      
      {/* Content Area */}
      <div className="flex-1 ml-64 flex flex-col">
        <Header />
        
        {/* Main Content */}
        <main className="p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;