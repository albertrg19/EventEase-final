'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, X } from 'lucide-react';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailParam = searchParams.get('email');

    const [email, setEmail] = useState(emailParam || '');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [status, setStatus] = useState<'input' | 'loading' | 'success' | 'error'>('input');
    const [message, setMessage] = useState('');
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Handle input change for each digit
    function handleDigitChange(index: number, value: string) {
        if (value && !/^\d$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent) {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    function handlePaste(e: React.ClipboardEvent) {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newCode = [...code];
        for (let i = 0; i < pasted.length; i++) {
            newCode[i] = pasted[i];
        }
        setCode(newCode);
        const nextEmpty = newCode.findIndex(d => !d);
        inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    }

    async function handleVerify() {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setMessage('Please enter all 6 digits');
            return;
        }
        if (!email) {
            setMessage('Please enter your email address');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch(`${api}/api/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: fullCode }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus('success');
                setMessage(data.message || 'Email verified successfully!');
                setTimeout(() => router.push('/login'), 2500);
            } else {
                setStatus('error');
                setMessage(data.error || 'Invalid verification code');
                setTimeout(() => setStatus('input'), 2000);
            }
        } catch (error) {
            setStatus('error');
            setMessage('Network error. Please try again.');
            setTimeout(() => setStatus('input'), 2000);
        }
    }

    async function handleResend() {
        if (!email || countdown > 0) return;

        setResending(true);
        try {
            const res = await fetch(`${api}/api/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage('New code sent! Check your email.');
                setCountdown(60);
                setCode(['', '', '', '', '', '']);
            } else if (res.status === 429) {
                setMessage('Please wait before requesting another code.');
            } else {
                setMessage(data.error || 'Could not send code.');
            }
        } catch (error) {
            setMessage('Network error. Please try again.');
        } finally {
            setResending(false);
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

            <div className="w-full max-w-md relative z-10">
                <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl">
                    <CardContent className="p-8">
                        {/* Close button */}
                        <div className="flex justify-end -mt-2 -mr-2 mb-2">
                            <Link href="/login" className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="h-5 w-5" />
                            </Link>
                        </div>

                        {/* Envelope Icon */}
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <div className="w-16 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg shadow-lg flex items-center justify-center">
                                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-br from-orange-300 to-amber-400 rounded-t-lg"
                                        style={{ clipPath: 'polygon(0 0, 50% 100%, 100% 0)' }}></div>
                                    <div className="flex gap-0.5 mt-2">
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className="w-1 h-1 bg-gray-700 rounded-full"></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">
                            Verify Your Email Address
                        </h1>
                        <p className="text-gray-500 text-sm text-center mb-6">
                            Enter the 6 digit code sent to {email || 'your email'}
                        </p>

                        {/* Success State */}
                        {status === 'success' && (
                            <div className="py-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-300">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                                <p className="text-green-700 font-medium">{message}</p>
                                <p className="text-sm text-gray-500 mt-2">Redirecting to login...</p>
                            </div>
                        )}

                        {/* Error State */}
                        {status === 'error' && (
                            <div className="py-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center animate-in zoom-in duration-300">
                                    <XCircle className="h-8 w-8 text-red-600" />
                                </div>
                                <p className="text-red-700 font-medium">{message}</p>
                            </div>
                        )}

                        {/* Loading State */}
                        {status === 'loading' && (
                            <div className="py-6 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                                </div>
                                <p className="text-gray-600">Verifying...</p>
                            </div>
                        )}

                        {/* Input State */}
                        {status === 'input' && (
                            <>
                                {/* OTP Input Boxes */}
                                <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
                                    {code.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={(el) => { inputRefs.current[index] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleDigitChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            className={`w-11 h-12 text-center text-xl font-bold border-2 rounded-lg transition-all
                        ${digit ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
                        focus:border-blue-600 focus:ring-2 focus:ring-blue-200 focus:bg-white
                        outline-none`}
                                        />
                                    ))}
                                </div>

                                {/* Change email link */}
                                <p className="text-sm text-gray-500 text-center mb-5">
                                    Want to Change Your Email Address?{' '}
                                    <Link href="/login?tab=register" className="text-blue-600 hover:text-blue-700 font-medium underline">
                                        Change Here
                                    </Link>
                                </p>

                                {/* Error message */}
                                {message && (
                                    <p className={`text-sm text-center mb-4 ${message.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
                                        {message}
                                    </p>
                                )}

                                {/* Verify Button */}
                                <Button
                                    onClick={handleVerify}
                                    disabled={code.some(d => !d) || !email}
                                    className="w-full py-5 text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Verify Email
                                </Button>

                                {/* Resend Code */}
                                <div className="text-center mt-4">
                                    <button
                                        onClick={handleResend}
                                        disabled={resending || countdown > 0 || !email}
                                        className="text-gray-600 hover:text-gray-800 text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {resending ? (
                                            <span className="flex items-center gap-1 justify-center">
                                                <Loader2 className="h-3 w-3 animate-spin" /> Sending...
                                            </span>
                                        ) : countdown > 0 ? (
                                            `Resend Code (${countdown}s)`
                                        ) : (
                                            'Resend Code'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex items-center justify-center">
                <div className="text-white flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Loading...
                </div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
