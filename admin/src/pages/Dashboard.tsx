import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-gray-800 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Orders</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">1,245</p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Revenue</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">$88,542</p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">New Users</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">78</p>
        </div>
      </div>
      {/* Add recent orders/products tables here */}
    </div>
  );
};

export default Dashboard;