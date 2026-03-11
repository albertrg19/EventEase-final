'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MessageSquare, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

type VerificationMethod = 'email' | 'sms' | null;

function VerifyAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const [identifier, setIdentifier] = useState('');
  const [method, setMethod] = useState<VerificationMethod>(null);
  const [step, setStep] = useState<'select' | 'verify' | 'success'>('select');
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const id = searchParams.get('identifier');
    if (id) {
      setIdentifier(id);
    }
  }, [searchParams]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRequestOTP = async (selectedMethod: VerificationMethod) => {
    if (!identifier) {
      setMsg({ text: 'No user identifier provided. Please return to login.', type: 'error' });
      return;
    }
    
    setMethod(selectedMethod);
    setLoading(true);
    setMsg(null);
    
    try {
      const res = await fetch(`${api}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, method: selectedMethod })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to send OTP.', type: 'error' });
      } else {
        setMsg({ text: `Verification code sent via ${selectedMethod?.toUpperCase()}.`, type: 'success' });
        setStep('verify');
        setCountdown(60); // 60 seconds cooldown
      }
    } catch (err) {
      setMsg({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setMsg({ text: 'Please enter a valid 6-digit code.', type: 'error' });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(`${api}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, code: otp, method })
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg({ text: data.error || 'Verification failed. Incorrect code.', type: 'error' });
      } else {
        setStep('success');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    } catch (err) {
      setMsg({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>
      
      <div className="w-full max-w-md relative z-10">
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Verify Your Account</h1>
            <p className="text-blue-100 text-sm">
              {step === 'select' && 'Secure your account by verifying your identity'}
              {step === 'verify' && `Enter the 6-digit code sent via ${method?.toUpperCase()}`}
              {step === 'success' && 'Account verified successfully!'}
            </p>
          </div>

          <CardContent className="p-8">
            {msg && (
              <div className={`p-4 rounded-xl text-sm mb-6 flex items-start gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                <div className="mt-0.5">
                  {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <span className="font-bold">!</span>}
                </div>
                <p>{msg.text}</p>
              </div>
            )}

            {step === 'select' && (
              <div className="space-y-4">
                <Button
                  onClick={() => handleRequestOTP('email')}
                  disabled={loading || !identifier}
                  variant="outline"
                  className="w-full h-16 justify-start px-6 gap-4 text-lg font-medium border-2 hover:border-blue-500 hover:bg-blue-50 transition-all rounded-xl"
                >
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  Verify via Email
                </Button>
                
                <Button
                  onClick={() => handleRequestOTP('sms')}
                  disabled={loading || !identifier}
                  variant="outline"
                  className="w-full h-16 justify-start px-6 gap-4 text-lg font-medium border-2 hover:border-blue-500 hover:bg-blue-50 transition-all rounded-xl"
                >
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  Verify via SMS
                </Button>

                <div className="mt-8 text-center">
                  <Link href="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                    Back to Login
                  </Link>
                </div>
              </div>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Enter OTP Code
                  </label>
                  <Input
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\\D/g, '').slice(0, 6))}
                    className="h-14 text-center text-2xl tracking-[0.5em] font-bold bg-gray-50 border-2 focus-visible:ring-0 focus-visible:border-blue-500 rounded-xl"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg shadow-xl shadow-blue-500/20 rounded-xl"
                >
                  {loading ? 'Verifying...' : 'Verify Now'}
                  {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>

                <div className="text-center pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-2">Didn't receive the code?</p>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={countdown > 0 || loading}
                    onClick={() => handleRequestOTP(method)}
                    className="text-blue-600 font-semibold hover:bg-blue-50 rounded-lg px-4"
                  >
                    {countdown > 0 ? `Resend available in ${countdown}s` : 'Resend Code'}
                  </Button>
                </div>
                
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('select');
                      setOtp('');
                      setMsg(null);
                    }}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 underline underline-offset-4"
                  >
                    Choose a different verification method
                  </button>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">You're All Set!</h3>
                <p className="text-gray-500 mb-6">Redirecting you to login automatically...</p>
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyAccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <VerifyAccountContent />
    </Suspense>
  );
}
