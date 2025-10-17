'use client';
import Link from 'next/link';
import React from 'react';
import { useTheme } from 'next-themes';
import LoginDialog from "./LoginDialog";

const Navbar = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="navbar bg-base-100/40 shadow-sm sticky top-0 z-10 backdrop-blur-md">
        <div className="navbar-start lg:hidden">
            <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /> </svg>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
                <li><a>Homepage</a></li>
                <li><a>Portfolio</a></li>
                <li><a>About</a></li>
            </ul>
            </div>
        </div>
        <div className="navbar-center lg:navbar-start">
            <a className="btn btn-ghost text-xl">NeverFall..</a>
        </div>

        <ul className="lg:navbar-center md:hidden sm:hidden menu menu-vertical lg:menu-horizontal bg-base-200 rounded-box">
            <li><Link href='/'>Home</Link></li>
            <li><Link href='/products'>Products</Link></li>
            <li><Link href='/categories'>Categories</Link></li>
            <li><Link href='/about'>About</Link></li>
            <li><Link href='/contact'>Reach Us</Link></li>
        </ul>

        <div className="navbar-end">
            <button className="btn btn-ghost btn-circle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m8.66-12.66l-.707.707M4.04 19.96l-.707.707M21 12h-1M4 12H3m16.66 7.96l-.707-.707M5.04 5.04l-.707-.707" />
                    </svg>
                )}
            </button>
            <button className="btn btn-ghost btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> </svg>
            </button>
            <button className="btn btn-ghost btn-circle">
            <div className="indicator">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> </svg>
                <span className="badge badge-xs badge-primary indicator-item"></span>
            </div>
            </button>
            <div className='ml-4'><LoginDialog/></div>
        </div>
    </div>
  )
}

export default Navbar