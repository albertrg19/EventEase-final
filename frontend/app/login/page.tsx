'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Lock, User, ArrowRight, UserPlus, Phone, Loader2, Play, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TabType = 'login' | 'register';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('login');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setActiveTab('register');
    }
  }, [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

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
        body: JSON.stringify({ identifier: email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || 'Login failed');
      } else {
        localStorage.setItem('token', data.token);
        if (remember) {
          localStorage.setItem('remember', 'true');
        }
        try {
          const tokenParts = data.token.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          const role = payload.role;
          if (role === 'admin') {
            router.push('/admin/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
        } catch {
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
        body: JSON.stringify({ 
          name, 
          email: regEmail,
          phone: phoneNumber, 
          password: regPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || 'Registration failed');
      } else {
        setMsg('Please verify your account to continue...');
        setTimeout(() => {
          router.push(`/verify-account?email=${encodeURIComponent(regEmail)}&phone=${encodeURIComponent(phoneNumber)}`);
        }, 1500);
      }
    } catch (err: any) {
      setMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden">
      
      {/* LEFT PANEL */}
      <div className="relative hidden md:flex w-1/2 lg:w-[55%] items-center justify-center p-12 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 z-0">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-80">
            <source src="/video11.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-slate-950/40 to-slate-950/90 pointer-events-none"></div>
        </div>

        <div className="relative z-10 w-full max-w-xl text-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <Link href="/" className="inline-block mb-10">
              <img src="/Logooo.png" alt="EventEase" className="h-10 lg:h-12 w-auto object-contain drop-shadow-[0_4px_16px_rgba(255,215,0,0.15)] hover:scale-[1.02] transition-transform duration-500" />
            </Link>
            
            <h1 className="text-4xl lg:text-[3rem] font-bold leading-[1.15] mb-4 tracking-tight drop-shadow-sm">
              Curating <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-300 via-indigo-300 to-purple-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]">Exceptional</span><br />
              Spaces, For Your<br />
              <span className="text-white">Unforgettable Moments.</span>
            </h1>
            
            <p className="text-lg text-slate-300/90 leading-relaxed max-w-md font-light">
              Join thousands of event organizers who trust EventEase to bring their vision to life with precision, elegance, and peace of mind.
            </p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full md:w-1/2 lg:w-[45%] flex flex-col bg-white relative z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.05)] h-screen overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-6 sm:px-10 lg:px-8 py-6">
          
          <div className="md:hidden flex justify-center mb-6">
            <Link href="/">
              <img src="/Logooo.png" alt="EventEase Logo" className="h-8 w-auto object-contain" />
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1.5">
              {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm">
              {activeTab === 'login' ? 'Enter your details to access your dashboard.' : 'Enter your details to get started with EventEase.'}
            </p>
          </div>

          <div className="flex p-1 bg-slate-100/80 backdrop-blur-sm rounded-lg mb-6 relative h-10">
            <button
              onClick={() => { setActiveTab('login'); setMsg(null); }}
              className={`flex-1 text-sm font-semibold rounded-md z-10 transition-colors duration-300 ${activeTab === 'login' ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setActiveTab('register'); setMsg(null); }}
              className={`flex-1 text-sm font-semibold rounded-md z-10 transition-colors duration-300 ${activeTab === 'register' ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Register
            </button>
            
            <motion.div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white shadow-sm rounded-md border border-slate-200/60 z-0"
              initial={false}
              animate={{ x: activeTab === 'login' ? 4 : '100%' }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </div>

          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg text-xs font-medium mb-4 flex items-start gap-2 ${
                msg.includes('success') || msg.includes('successful') || msg.includes('verify') 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}
            >
              {msg.includes('verify') || msg.includes('success') ? (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
              )}
              {msg}
            </motion.div>
          )}

          <div className="relative">
            <AnimatePresence mode="wait">
              {activeTab === 'login' ? (
                <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, ease: "easeInOut" }} onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1 relative group">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pl-1">Email or Phone</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                        <User className="h-4 w-4" />
                      </div>
                      <Input type="text" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 pl-9 bg-slate-50 border-slate-200 text-sm rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-gray-400" />
                    </div>
                  </div>

                  <div className="space-y-1 relative group">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pl-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                        <Lock className="h-4 w-4" />
                      </div>
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10 pl-9 pr-10 bg-slate-50 border-slate-200 text-sm rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-gray-400" />
                      <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
                        <div className="w-4 h-4 border-2 border-slate-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all group-hover:border-blue-500"></div>
                        <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5.5L6 10.5L16 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span className="text-xs font-medium text-slate-600 select-none group-hover:text-slate-900 transition-colors">Remember me</span>
                    </label>
                    <Link href="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">Forgot Password?</Link>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-10 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-lg shadow-[0_4px_14px_-4px_rgba(59,130,246,0.4)] hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                    {!loading && <ArrowRight className="h-3.5 w-3.5" />}
                  </Button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                    <div className="relative flex justify-center text-[10px]"><span className="px-3 bg-white text-slate-400 font-medium uppercase tracking-widest">Or continue with</span></div>
                  </div>

                  <Button type="button" onClick={() => window.location.href = `${api}/api/auth/google`} variant="outline" className="w-full h-10 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-lg flex items-center justify-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Google
                  </Button>
                </motion.form>
              ) : (
                <motion.form key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease: "easeInOut" }} onSubmit={handleRegister} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 relative group">
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pl-1">Full Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors"><User className="h-4 w-4" /></div>
                        <Input type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required className="h-10 pl-9 bg-slate-50 border-slate-200 text-sm rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-gray-400" />
                      </div>
                    </div>
                    <div className="space-y-1 relative group">
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pl-1">Phone</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors"><Phone className="h-4 w-4" /></div>
                        <Input type="tel" placeholder="09123456789" maxLength={11} pattern="[0-9]{11}" value={phoneNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 11) setPhoneNumber(val); }} required className="h-10 pl-9 bg-slate-50 border-slate-200 text-sm rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 relative group">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pl-1">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors"><Mail className="h-4 w-4" /></div>
                      <Input type="email" placeholder="john@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="h-10 pl-9 bg-slate-50 border-slate-200 text-sm rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-gray-400" />
                    </div>
                  </div>

                  <div className="space-y-1 relative group">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider pl-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors"><Lock className="h-4 w-4" /></div>
                      <Input type={showRegPassword ? "text" : "password"} placeholder="Create a strong password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required className="h-10 pl-9 pr-10 bg-slate-50 border-slate-200 text-sm rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all font-medium placeholder:font-normal placeholder:text-gray-400" />
                      <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setShowRegPassword(!showRegPassword)}>
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer group">
                      <div className="relative mt-0.5 flex items-center justify-center flex-shrink-0">
                        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="peer sr-only" />
                        <div className="w-4 h-4 border-2 border-slate-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all group-hover:border-blue-500"></div>
                        <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5.5L6 10.5L16 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span className="text-[10px] sm:text-xs font-medium text-slate-500 leading-snug">
                        By creating an account, you agree to our <Link href="/terms" className="font-bold text-blue-600 hover:text-blue-800 transition-colors">Terms of Service</Link> and <Link href="/privacy" className="font-bold text-blue-600 hover:text-blue-800 transition-colors">Privacy Policy</Link>.
                      </span>
                    </label>
                  </div>

                  <Button type="submit" disabled={loading || !termsAccepted} className="w-full h-10 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-lg shadow-[0_4px_14px_-4px_rgba(59,130,246,0.4)] hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 transition-all duration-300 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                    {!loading && <UserPlus className="h-4 w-4" />}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-medium text-slate-400">
            <span>© 2025 EventEase</span>
            <div className="flex gap-4">
              <Link href="/help" className="hover:text-blue-600 transition-colors">Help</Link>
              <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
