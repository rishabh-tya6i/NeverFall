import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import toast from 'react-hot-toast';
import { authApi } from '@/api/auth';
import { Lock, Mail, Phone, ArrowRight, ArrowLeft } from 'lucide-react';

type LoginStep = 'phone' | 'verify-phone' | 'email' | 'verify-email';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  
  const [step, setStep] = useState<LoginStep>('phone');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Timer for resend OTP
  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Step 1: Request Phone OTP
  const handleRequestPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await authApi.requestMobileOtp(phone);
      toast.success('OTP sent to your phone');
      setStep('verify-phone');
      setResendTimer(60);
    } catch (error: any) {
      console.error('Request OTP error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Phone OTP
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneOtp || phoneOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyMobileOtp(phone, phoneOtp);
      
      // Check if user has admin/support/manager role
      if (!['admin', 'support', 'manager', 'Support'].includes(response.user.role)) {
        toast.error('Access denied. Admin privileges required.');
        setStep('phone');
        setPhone('');
        setPhoneOtp('');
        return;
      }

      // If user already has email, login directly
      if (response.user.email) {
        login(response.token, response.user);
        toast.success('Login successful!');
        navigate('/');
      } else {
        // Proceed to email verification
        toast.success('Phone verified! Please verify your email.');
        setStep('email');
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Request Email OTP
  const handleRequestEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authApi.requestEmailOtp(email, phone);
      toast.success('OTP sent to your email');
      setStep('verify-email');
      setResendTimer(60);
    } catch (error: any) {
      console.error('Request Email OTP error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify Email OTP
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailOtp || emailOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyEmailOtp(email, phone, emailOtp);
      
      login(response.token, response.user);
      toast.success('Login successful!');
      navigate('/');
    } catch (error: any) {
      console.error('Verify Email OTP error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    setLoading(true);
    try {
      if (step === 'verify-phone') {
        await authApi.requestMobileOtp(phone);
        toast.success('OTP resent to your phone');
      } else if (step === 'verify-email') {
        await authApi.requestEmailOtp(email, phone);
        toast.success('OTP resent to your email');
      }
      setResendTimer(60);
    } catch (error) {
      console.error('Resend OTP error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Go back
  const handleGoBack = () => {
    if (step === 'verify-phone') {
      setStep('phone');
      setPhoneOtp('');
    } else if (step === 'email') {
      setStep('phone');
      setPhone('');
      setPhoneOtp('');
    } else if (step === 'verify-email') {
      setStep('email');
      setEmailOtp('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {/* Logo/Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <Lock className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="mt-2 text-gray-600">
              {step === 'phone' && 'Enter your phone number'}
              {step === 'verify-phone' && 'Verify phone OTP'}
              {step === 'email' && 'Enter your email'}
              {step === 'verify-email' && 'Verify email OTP'}
            </p>
          </div>

          {/* Step 1: Phone Number */}
          {step === 'phone' && (
            <form onSubmit={handleRequestPhoneOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="block w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="1234567890"
                    maxLength={10}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter 10-digit mobile number
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Sending OTP...
                  </div>
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Verify Phone OTP */}
          {step === 'verify-phone' && (
            <form onSubmit={handleVerifyPhoneOtp} className="space-y-6">
              <div>
                <div className="mb-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
                  OTP sent to {phone}
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl tracking-widest focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="font-medium text-primary-600 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="font-medium text-gray-600 hover:text-gray-500"
                >
                  Change Number
                </button>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="flex w-1/3 items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || phoneOtp.length !== 6}
                  className="flex w-2/3 items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Verifying...
                    </div>
                  ) : (
                    'Verify OTP'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestEmailOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="flex w-1/3 items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="flex w-2/3 items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Sending OTP...
                    </div>
                  ) : (
                    <>
                      Send OTP
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Step 4: Verify Email OTP */}
          {step === 'verify-email' && (
            <form onSubmit={handleVerifyEmailOtp} className="space-y-6">
              <div>
                <div className="mb-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-700">
                  OTP sent to {email}
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl tracking-widest focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="font-medium text-primary-600 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="font-medium text-gray-600 hover:text-gray-500"
                >
                  Change Email
                </button>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="flex w-1/3 items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || emailOtp.length !== 6}
                  className="flex w-2/3 items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Verifying...
                    </div>
                  ) : (
                    'Verify & Login'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Info Box */}
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-700">Admin Login Required</p>
            <p className="mt-1 text-xs text-gray-600">
              Only users with admin, manager, or support roles can access this panel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-white">
          © 2025 NevrFall Admin Panel. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;