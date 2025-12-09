'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Lock, User, ArrowRight, UserPlus } from 'lucide-react';

type TabType = 'login' | 'register';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  
  // Check URL parameter on mount to set active tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setActiveTab('register');
    }
  }, [searchParams]);
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  
  // Register states
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${api}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || 'Login failed');
      } else {
        localStorage.setItem('token', data.token);
        if (remember) {
          localStorage.setItem('remember', 'true');
        }
        // Decode JWT to get role
        try {
          const tokenParts = data.token.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          const role = payload.role;
          // Redirect based on role
          if (role === 'admin') {
            router.push('/admin/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
        } catch {
          // Fallback to customer dashboard if token decode fails
          router.push('/customer/dashboard');
        }
      }
    } catch (err: any) {
      setMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) {
      setMsg('Please accept the Terms and Conditions');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${api}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: regEmail, password: regPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || 'Registration failed');
      } else {
        setMsg('Registration successful! Please login.');
        // Switch to login tab after successful registration
        setTimeout(() => {
          setActiveTab('login');
          setEmail(regEmail);
          setMsg(null);
        }, 2000);
      }
    } catch (err: any) {
      setMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>
      
      <div className="w-full max-w-lg relative z-10">
        {/* Login/Register Card */}
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl">
          <CardContent className="p-8">
            {/* Logo and Title */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <img 
                src="/Logooo.png" 
                alt="EventEase Logo" 
                className="h-16 w-auto object-contain"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setMsg(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <ArrowRight className={`h-4 w-4 ${activeTab === 'login' ? '' : 'hidden'}`} />
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setMsg(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <UserPlus className={`h-4 w-4 ${activeTab === 'register' ? '' : 'hidden'}`} />
                Register
              </button>
        </div>

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    Email
                  </label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                    className="h-11 pl-10"
                />
              </div>

              <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-500" />
                    Password
                  </label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                    className="h-11 pl-10"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                  Forgot Password?
                </Link>
              </div>

              {msg && (
                  <div className={`p-3 rounded-md text-sm ${msg.includes('success') || msg.includes('successful') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {msg}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? 'Logging in...' : (
                    <>
                      Login
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    Full Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11 pl-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="h-11 pl-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-500" />
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="h-11 pl-10"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-600">
                    I agree to the{' '}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-800 font-semibold">
                      Terms and Conditions
                    </Link>
                  </span>
                </label>

                {msg && (
                  <div className={`p-3 rounded-md text-sm ${msg.includes('success') || msg.includes('successful') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {msg}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? 'Creating Account...' : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      Create Account
                    </>
                  )}
              </Button>
            </form>
            )}

            {/* Social Login Separator */}
            {(activeTab === 'login' || activeTab === 'register') && (
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-sm text-gray-500">OR</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>
            )}

            {/* Social Login Options */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
                title="Login with Google"
              >
                <span className="font-bold text-lg">G</span>
              </button>
              <button
                type="button"
                className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
                title="Login with Facebook"
              >
                <span className="font-bold text-lg">f</span>
              </button>
              <button
                type="button"
                className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
                title="Login with Twitter"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
              <p>© 2025 EventEase | <Link href="/privacy" className="text-blue-600 hover:text-blue-800">Privacy Policy</Link> | <Link href="/help" className="text-blue-600 hover:text-blue-800">Help</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}


