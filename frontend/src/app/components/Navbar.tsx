'use client';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { cartAPI, authAPI } from '@/services/api';
import LoginDialog from "./LoginDialog";
import secureLocalStorage from 'react-secure-storage';

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    setMounted(true);
    const token = secureLocalStorage.getItem('auth_token');
    const userId = localStorage.getItem('userId');
    if (token && userId) {
      setIsLoggedIn(true);
    }
  }, []);

  // Fetch user data
  const { data: userData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await authAPI.me();
      return res.data;
    },
    enabled: isLoggedIn,
  });

  // Fetch cart count
  const { data: cartData } = useQuery({
    queryKey: ['cart-count'],
    queryFn: async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) return { count: 0 };
      const res = await cartAPI.get(userId);
      return { count: res.data?.items?.length || 0 };
    },
    enabled: isLoggedIn,
  });

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      secureLocalStorage.removeItem('auth_token');
      localStorage.removeItem('userId');
      setIsLoggedIn(false);
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="navbar bg-base-100/40 shadow-sm sticky top-0 z-10 backdrop-blur-md">
        <div className="navbar-start lg:hidden">
            <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /> </svg>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
                <li><Link href='/'>Home</Link></li>
                <li><Link href='/products'>Products</Link></li>
                <li><Link href='/categories'>Categories</Link></li>
                <li><Link href='/about'>About</Link></li>
                <li><Link href='/contact'>Contact</Link></li>
            </ul>
            </div>
        </div>
        <div className="navbar-center lg:navbar-start">
            <Link href="/" className="btn btn-ghost text-xl">NeverFall</Link>
        </div>

        <ul className="lg:navbar-center md:hidden sm:hidden menu menu-vertical lg:menu-horizontal bg-base-200 rounded-box">
            <li><Link href='/'>Home</Link></li>
            <li><Link href='/products'>Products</Link></li>
            <li><Link href='/categories'>Categories</Link></li>
            <li><Link href='/about'>About</Link></li>
            <li><Link href='/contact'>Contact</Link></li>
        </ul>

        <div className="navbar-end">
            {mounted && (
              <button className="btn btn-ghost btn-circle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                  {theme === 'light' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m8.66-12.66l-.707.707M4.04 19.96l-.707.707M21 12h-1M4 12H3m16.66 7.96l-.707-.707M5.04 5.04l-.707-.707" />
                      </svg>
                  )}
              </button>
            )}
            
            <button 
              className="btn btn-ghost btn-circle"
              onClick={() => router.push('/cart')}
            >
              <div className="indicator">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 11-4 0v-6m4 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                </svg>
                {cartData && cartData.count > 0 && (
                  <span className="badge badge-xs badge-primary indicator-item">
                    {cartData.count}
                  </span>
                )}
              </div>
            </button>

            {isLoggedIn ? (
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                  <div className="w-10 rounded-full">
                    <div className="bg-primary text-primary-content rounded-full w-10 h-10 flex items-center justify-center">
                      {userData?.name?.charAt(0) || 'U'}
                    </div>
                  </div>
                </div>
                <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
                  <li>
                    <div className="justify-between">
                      <span>Profile</span>
                      <span className="badge">New</span>
                    </div>
                  </li>
                  <li><Link href="/profile">My Profile</Link></li>
                  <li><Link href="/orders">My Orders</Link></li>
                  <li><Link href="/returns">My Returns</Link></li>
                  <li><button onClick={handleLogout}>Logout</button></li>
                </ul>
              </div>
            ) : (
              <div className='ml-4'><LoginDialog/></div>
            )}
        </div>
    </div>
  )
}

export default Navbar