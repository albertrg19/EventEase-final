'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    useEffect(() => {
        if (!token) {
            setError('Invalid reset link. Please request a new password reset.');
        }
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${api}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data?.error || 'Failed to reset password');
            } else {
                setSuccess(true);
                // Redirect to login after 3 seconds
                setTimeout(() => {
                    router.push('/login');
                }, 3000);
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

                        {!token ? (
                            /* Invalid Token State */
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
                                <p className="text-gray-600 mb-6">
                                    This password reset link is invalid or has expired. Please request a new one.
                                </p>
                                <Link href="/forgot-password">
                                    <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                                        Request New Link
                                    </Button>
                                </Link>
                            </div>
                        ) : success ? (
                            /* Success State */
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
                                <p className="text-gray-600 mb-6">
                                    Your password has been successfully reset. You&apos;ll be redirected to the login page shortly.
                                </p>
                                <Link href="/login">
                                    <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                                        Go to Login
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h2>
                                    <p className="text-gray-600">
                                        Please enter your new password below.
                                    </p>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                            <Lock className="h-4 w-4 text-gray-500" />
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Enter new password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                minLength={6}
                                                className="h-11 pl-10 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                            <Lock className="h-4 w-4 text-gray-500" />
                                            Confirm Password
                                        </label>
                                        <div className="relative">
                                            <Input
                                                type={showConfirmPassword ? "text" : "password"}
                                                placeholder="Confirm new password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                                minLength={6}
                                                className="h-11 pl-10 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password Requirements */}
                                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                                        <p className="font-semibold mb-1">Password must:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li className={password.length >= 6 ? 'text-green-600' : ''}>
                                                Be at least 6 characters long
                                            </li>
                                        </ul>
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
                                        {loading ? 'Resetting...' : 'Reset Password'}
                                    </Button>
                                </form>
                            </>
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

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
