import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, Percent, Box, Tag, Settings } from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, isActive }) => {
  const baseClasses = "flex items-center p-3 rounded-lg transition-colors";
  const activeClasses = "bg-indigo-700 text-white";
  const inactiveClasses = "text-indigo-200 hover:bg-indigo-600 hover:text-white";

  return (
    <li>
      <Link 
        to={to} 
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      >
        <Icon className="w-5 h-5 mr-3" />
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </li>
  );
};

const Sidebar: React.FC = () => {
  const { pathname } = useLocation();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/products', icon: Box, label: 'Products' },
    { to: '/categories', icon: Tag, label: 'Categories' },
    { to: '/coupons', icon: Percent, label: 'Coupons' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-64 min-h-screen bg-indigo-800 flex flex-col fixed left-0 top-0 text-white">
      <div className="p-6 text-2xl font-semibold border-b border-indigo-700">
        NeverFall Admin
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.to || (item.to === '/' && pathname === '/')}
            />
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-indigo-700">
        <p className="text-xs text-indigo-300">© 2025 NeverFall</p>
      </div>
    </div>
  );
};

export default Sidebar;