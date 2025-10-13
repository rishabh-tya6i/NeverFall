import React from 'react';

const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Table and CRUD operations for the User model (including changing roles: user, admin, Support, manager) will go here.
      </p>
    </div>
  );
};

export default UsersPage;