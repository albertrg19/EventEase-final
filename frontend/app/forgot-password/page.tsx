'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${api}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data?.error || 'Something went wrong');
            } else {
                setSubmitted(true);
            }
        } catch (err: any) {
            setError('Network error. Please try again.');
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

                        {!submitted ? (
                            <>
                                {/* Header */}
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
                                    <p className="text-gray-600">
                                        No worries! Enter your email and we&apos;ll send you a link to reset your password.
                                    </p>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-gray-500" />
                                            Email Address
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

                                    {error && (
                                        <div className="p-3 rounded-md text-sm bg-red-50 text-red-700">
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {loading ? 'Sending...' : (
                                            <>
                                                <Send className="h-5 w-5" />
                                                Send Reset Link
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </>
                        ) : (
                            /* Success State */
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                                <p className="text-gray-600 mb-6">
                                    We&apos;ve sent a password reset link to <strong>{email}</strong>.
                                    The link will expire in 1 hour.
                                </p>
                                <p className="text-sm text-gray-500 mb-6">
                                    Didn&apos;t receive the email? Check your spam folder or{' '}
                                    <button
                                        onClick={() => setSubmitted(false)}
                                        className="text-blue-600 hover:text-blue-800 font-semibold"
                                    >
                                        try again
                                    </button>
                                </p>
                            </div>
                        )}

                        {/* Back to Login Link */}
                        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Login
                            </Link>
                        </div>

                        {/* Footer */}
                        <div className="mt-6 text-center text-xs text-gray-500">
                            <p>© 2025 EventEase | <Link href="/privacy" className="text-blue-600 hover:text-blue-800">Privacy Policy</Link> | <Link href="/help" className="text-blue-600 hover:text-blue-800">Help</Link></p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
