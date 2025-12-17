'use client';

// ============================================================================
// RESET PASSWORD PAGE
// Location: app/reset-password/page.tsx
// 
// PUBLIC PAGE - Accessible before authentication
// 
// Handles password reset flow from Supabase email links.
// Also handles account activation for existing providers migrating to new auth.
// 
// URL: clarencelegal.ai/reset-password
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SECTION 2: SUPABASE INITIALIZATION
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading...</p>
            </div>
        </div>
    );
}

// ============================================================================
// SECTION 4: MAIN CONTENT COMPONENT
// ============================================================================

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ========================================================================
    // SECTION 4A: STATE MANAGEMENT
    // ========================================================================

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isValidSession, setIsValidSession] = useState(false);
    const [isActivation, setIsActivation] = useState(false);

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });

    // ========================================================================
    // SECTION 4B: VERIFY SESSION ON MOUNT
    // ========================================================================

    useEffect(() => {
        const verifySession = async () => {
            try {
                // Check if this is an activation flow
                const type = searchParams.get('type');
                if (type === 'activation') {
                    setIsActivation(true);
                }

                // Supabase handles the token verification automatically when the user
                // clicks the email link. We just need to check if there's a valid session.
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Session error:', error);
                    setErrorMessage('Invalid or expired reset link. Please request a new one.');
                    setIsLoading(false);
                    return;
                }

                if (session) {
                    // Valid session - user can reset password
                    setIsValidSession(true);
                } else {
                    // No session - try to exchange the token from URL
                    // Supabase v2 handles this via the hash fragment
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        const { error: setSessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });

                        if (setSessionError) {
                            console.error('Set session error:', setSessionError);
                            setErrorMessage('Invalid or expired reset link. Please request a new one.');
                        } else {
                            setIsValidSession(true);
                        }
                    } else {
                        // Check for error in URL
                        const error = searchParams.get('error');
                        const errorDescription = searchParams.get('error_description');

                        if (error) {
                            setErrorMessage(errorDescription || 'Invalid or expired reset link.');
                        } else {
                            setErrorMessage('Invalid or expired reset link. Please request a new one.');
                        }
                    }
                }
            } catch (error) {
                console.error('Verification error:', error);
                setErrorMessage('Something went wrong. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        verifySession();
    }, [searchParams]);

    // ========================================================================
    // SECTION 4C: PASSWORD UPDATE HANDLER
    // ========================================================================

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            // Validation
            if (!formData.password || !formData.confirmPassword) {
                throw new Error('Please fill in all fields.');
            }

            if (formData.password.length < 8) {
                throw new Error('Password must be at least 8 characters.');
            }

            if (formData.password !== formData.confirmPassword) {
                throw new Error('Passwords do not match.');
            }

            // Update password
            const { error } = await supabase.auth.updateUser({
                password: formData.password
            });

            if (error) {
                throw new Error(error.message);
            }

            // Success
            setSuccessMessage(
                isActivation
                    ? 'Your account has been activated! Redirecting to login...'
                    : 'Your password has been updated! Redirecting to login...'
            );

            // Sign out and redirect to login
            await supabase.auth.signOut();

            setTimeout(() => {
                // Check if this was a provider activation
                const returnTo = searchParams.get('return_to');
                if (returnTo) {
                    router.push(returnTo);
                } else if (isActivation) {
                    router.push('/provider?message=activated');
                } else {
                    router.push('/auth/login?message=password_reset');
                }
            }, 2000);

        } catch (error) {
            console.error('Password update error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to update password.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ========================================================================
    // SECTION 4D: REQUEST NEW LINK HANDLER
    // ========================================================================

    const handleRequestNewLink = () => {
        if (isActivation) {
            router.push('/provider');
        } else {
            router.push('/auth/login');
        }
    };

    // ========================================================================
    // SECTION 5: RENDER - LOADING STATE
    // ========================================================================

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full mx-4 text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Verifying Link
                    </h2>
                    <p className="text-slate-500">
                        Please wait while we verify your reset link...
                    </p>
                </div>
            </div>
        );
    }

    // ========================================================================
    // SECTION 6: RENDER - INVALID/EXPIRED LINK
    // ========================================================================

    if (!isValidSession) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                {/* Header */}
                <header className="bg-slate-800 text-white">
                    <div className="container mx-auto px-6">
                        <nav className="flex justify-between items-center h-16">
                            <Link href="/" className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">C</span>
                                </div>
                                <div>
                                    <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                    <div className="text-xs text-slate-400">The Honest Broker</div>
                                </div>
                            </Link>
                        </nav>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Link Expired or Invalid
                        </h2>
                        <p className="text-slate-500 mb-6">
                            {errorMessage || 'This password reset link has expired or is invalid.'}
                        </p>

                        <button
                            onClick={handleRequestNewLink}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium cursor-pointer"
                        >
                            Request New Link
                        </button>

                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <p className="text-sm text-slate-500">
                                Need help?{' '}
                                <a href="mailto:support@clarencelegal.ai" className="text-blue-600 hover:text-blue-700">
                                    Contact Support
                                </a>
                            </p>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-slate-900 text-slate-400 py-6">
                    <div className="container mx-auto px-6 text-center text-sm">
                        © {new Date().getFullYear()} CLARENCE. The Honest Broker.
                    </div>
                </footer>
            </div>
        );
    }

    // ========================================================================
    // SECTION 7: RENDER - PASSWORD RESET FORM
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-3">
                            <div className={`w-10 h-10 bg-gradient-to-br ${isActivation ? 'from-blue-500 to-blue-600' : 'from-emerald-500 to-teal-600'} rounded-lg flex items-center justify-center`}>
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">
                                    {isActivation ? 'Provider Portal' : 'The Honest Broker'}
                                </div>
                            </div>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 py-12 px-4">
                <div className="max-w-md mx-auto">

                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <div className={`w-16 h-16 ${isActivation ? 'bg-blue-100' : 'bg-emerald-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                            <svg className={`w-8 h-8 ${isActivation ? 'text-blue-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">
                            {isActivation ? 'Activate Your Account' : 'Reset Your Password'}
                        </h1>
                        <p className="text-slate-500">
                            {isActivation
                                ? 'Create a password to activate your CLARENCE account'
                                : 'Enter your new password below'
                            }
                        </p>
                    </div>

                    {/* Form Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">

                        {/* Success Message */}
                        {successMessage && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-emerald-700 text-sm">{successMessage}</span>
                            </div>
                        )}

                        {/* Error Message */}
                        {errorMessage && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-700 text-sm">{errorMessage}</span>
                            </div>
                        )}

                        {/* Form */}
                        {!successMessage && (
                            <form onSubmit={handleSubmit} className="space-y-5">

                                {/* New Password */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        {isActivation ? 'Create Password' : 'New Password'}
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder="Minimum 8 characters"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Must be at least 8 characters
                                    </p>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        placeholder="Re-enter your password"
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm
                                            ${formData.confirmPassword && formData.password !== formData.confirmPassword
                                                ? 'border-red-300 bg-red-50'
                                                : 'border-slate-300'
                                            }`}
                                    />
                                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                        <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full py-3.5 rounded-lg text-white font-medium transition
                                        ${isSubmitting
                                            ? 'bg-slate-300 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            {isActivation ? 'Activating Account...' : 'Updating Password...'}
                                        </span>
                                    ) : (
                                        isActivation ? 'Activate Account' : 'Update Password'
                                    )}
                                </button>
                            </form>
                        )}

                        {/* Back to Login Link */}
                        {!successMessage && (
                            <div className="text-center mt-6 pt-6 border-t border-slate-200">
                                <Link
                                    href={isActivation ? '/provider' : '/auth/login'}
                                    className="text-slate-500 hover:text-slate-700 text-sm inline-flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back to {isActivation ? 'Provider Portal' : 'Login'}
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Security Note */}
                    <div className="mt-6 p-4 bg-slate-100 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-slate-700">Security Tip</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Choose a strong password that you don&apos;t use on other websites.
                                    Consider using a mix of letters, numbers, and symbols.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-6">
                <div className="container mx-auto px-6 text-center text-sm">
                    © {new Date().getFullYear()} CLARENCE. The Honest Broker.
                </div>
            </footer>
        </div>
    );
}

// ============================================================================
// SECTION 8: MAIN EXPORT WITH SUSPENSE WRAPPER
// ============================================================================

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <ResetPasswordContent />
        </Suspense>
    );
}