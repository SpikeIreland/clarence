'use client';

// ============================================================================
// PROVIDER AUTH PAGE - REDESIGNED
// Location: app/provider/page.tsx
// 
// Two-tab auth page for providers:
// - Sign Up tab: For new providers arriving from invitation email
// - Log In tab: For returning providers
//
// Token is ONLY used to validate invitation during signup.
// After account creation, providers use standard email/password login.
//
// DATA PROTECTION: Only collects name and work email (no phone numbers)
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { eventLogger } from '@/lib/eventLogger';
import { createClient } from '@supabase/supabase-js';
import FeedbackButton from '@/app/components/FeedbackButton';

// ============================================================================
// SECTION 2: SUPABASE INITIALIZATION
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook';

// ============================================================================
// SECTION 3: TYPE DEFINITIONS
// ============================================================================

type AuthTab = 'signup' | 'login';

interface TokenValidation {
    valid: boolean;
    sessionId: string;
    sessionNumber: string;
    customerCompany: string;
    invitedEmail: string;
    contractType: string;
    dealValue: string;
    serviceRequired: string;
    alreadyRegistered: boolean;
    providerId?: string;
    providerCompany?: string;
    intakeComplete?: boolean;
    questionnaireComplete?: boolean;
    error?: string;
}

interface SignupFormData {
    token: string;
    email: string;
    password: string;
    confirmPassword: string;
    companyName: string;
    contactName: string;
    // REMOVED: phone field - data protection compliance
}

interface LoginFormData {
    email: string;
    password: string;
}

interface ProviderSession {
    sessionId: string;
    sessionNumber: string;
    providerId: string;
    customerCompany: string;
    serviceRequired: string;
    dealValue: string;
    status: string;
    intakeComplete: boolean;
    questionnaireComplete: boolean;
}

// ============================================================================
// SECTION 4: HEADER COMPONENT
// ============================================================================

function ProviderHeader() {
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">Provider Portal</div>
                        </div>
                    </Link>

                    <Link
                        href="/auth/login"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Customer Portal →
                    </Link>
                </nav>
            </div>
        </header>
    );
}

// ============================================================================
// SECTION 5: FOOTER COMPONENT
// ============================================================================

function ProviderFooter() {
    return (
        <footer className="bg-slate-900 text-slate-400 py-8">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center gap-3 mb-4 md:mb-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <span className="text-white font-medium">CLARENCE</span>
                        <span className="text-slate-500 text-sm">Provider Portal</span>
                    </div>
                    <div className="text-sm">
                        © {new Date().getFullYear()} CLARENCE. The Honest Broker.
                    </div>
                </div>
            </div>
        </footer>
    );
}

// ============================================================================
// SECTION 6: LOADING COMPONENT
// ============================================================================

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </main>
            <ProviderFooter />

            {/* Beta Feedback Button */}
            <FeedbackButton position="bottom-left" />
        </div>
    );
}

// ============================================================================
// SECTION 7: MAIN AUTH CONTENT COMPONENT
// ============================================================================

function ProviderAuthContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ========================================================================
    // SECTION 7A: STATE MANAGEMENT
    // ========================================================================

    const [activeTab, setActiveTab] = useState<AuthTab>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Token validation state
    const [tokenValidation, setTokenValidation] = useState<TokenValidation | null>(null);
    const [isValidatingToken, setIsValidatingToken] = useState(false);
    const [tokenValidated, setTokenValidated] = useState(false);

    // Activate Account flow (for existing providers without Supabase Auth)
    const [showActivateAccount, setShowActivateAccount] = useState(false);
    const [activationEmailSent, setActivationEmailSent] = useState(false);

    // Signup form - REMOVED phone field for data protection
    const [signupForm, setSignupForm] = useState<SignupFormData>({
        token: '',
        email: '',
        password: '',
        confirmPassword: '',
        companyName: '',
        contactName: ''
    });

    // Login form
    const [loginForm, setLoginForm] = useState<LoginFormData>({
        email: '',
        password: ''
    });

    // ========================================================================
    // SECTION 7B: INITIALIZATION - CHECK URL PARAMS
    // ========================================================================

    useEffect(() => {
        const token = searchParams.get('token');
        const sessionId = searchParams.get('session_id');

        if (token) {
            // Arrived from email link - go to signup tab and validate token
            setActiveTab('signup');
            setSignupForm(prev => ({ ...prev, token }));
            validateToken(token, sessionId || '');

            eventLogger.completed('provider_onboarding', 'invitation_link_clicked', {
                hasToken: true,
                hasSessionId: !!sessionId
            });
        } else {
            // Arrived from homepage - stay on login tab
            eventLogger.completed('provider_onboarding', 'provider_portal_loaded', {
                hasToken: false
            });
        }
    }, [searchParams]);

    // ========================================================================
    // SECTION 7C: TOKEN VALIDATION
    // ========================================================================

    const validateToken = async (token: string, sessionId: string) => {
        if (!token.trim()) {
            setTokenValidation(null);
            setTokenValidated(false);
            return;
        }

        setIsValidatingToken(true);
        setErrorMessage('');

        try {
            const url = sessionId
                ? `${API_BASE}/validate-provider-token?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(sessionId)}`
                : `${API_BASE}/validate-provider-token?token=${encodeURIComponent(token)}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Token validation failed');
            }

            const data = await response.json();

            if (data.valid) {
                setTokenValidation(data);
                setTokenValidated(true);

                // Pre-fill email if provided
                if (data.invitedEmail) {
                    setSignupForm(prev => ({
                        ...prev,
                        email: data.invitedEmail
                    }));
                }

                // If already registered, suggest login
                if (data.alreadyRegistered) {
                    setSuccessMessage('You already have an account. Please log in to continue.');
                    setActiveTab('login');
                    setLoginForm(prev => ({
                        ...prev,
                        email: data.invitedEmail || ''
                    }));
                }

                eventLogger.completed('provider_onboarding', 'invite_token_validated', {
                    sessionId: data.sessionId,
                    alreadyRegistered: data.alreadyRegistered
                });
            } else {
                setTokenValidation(null);
                setTokenValidated(false);
                setErrorMessage(data.error || 'Invalid or expired invitation token.');

                eventLogger.failed('provider_onboarding', 'invite_token_validated',
                    data.error || 'Invalid token', 'INVALID_TOKEN');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            setTokenValidation(null);
            setTokenValidated(false);
            setErrorMessage('Unable to validate token. Please try again.');

            eventLogger.failed('provider_onboarding', 'invite_token_validated',
                error instanceof Error ? error.message : 'Validation failed', 'VALIDATION_ERROR');
        } finally {
            setIsValidatingToken(false);
        }
    };

    // ========================================================================
    // SECTION 7D: SIGNUP HANDLER
    // ========================================================================

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Validation
            if (!tokenValidated || !tokenValidation) {
                throw new Error('Please enter a valid invitation token first.');
            }

            if (!signupForm.email || !signupForm.password || !signupForm.companyName || !signupForm.contactName) {
                throw new Error('Please fill in all required fields.');
            }

            if (signupForm.password.length < 8) {
                throw new Error('Password must be at least 8 characters.');
            }

            if (signupForm.password !== signupForm.confirmPassword) {
                throw new Error('Passwords do not match.');
            }

            // Split name for Supabase
            const nameParts = signupForm.contactName.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // ================================================================
            // STEP 1: Create Supabase Auth Account
            // ================================================================
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: signupForm.email,
                password: signupForm.password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        company: signupForm.companyName,
                        role: 'provider'
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    throw new Error('An account with this email already exists. Please log in instead.');
                }
                throw new Error(authError.message);
            }

            if (!authData.user) {
                throw new Error('Failed to create account.');
            }

            const userId = authData.user.id;

            eventLogger.completed('provider_onboarding', 'user_account_created', {
                userId,
                email: signupForm.email
            });

            // ================================================================
            // STEP 2: Register provider via N8N workflow
            // REMOVED: contactPhone field - data protection compliance
            // ================================================================
            const registerResponse = await fetch(`${API_BASE}/provider-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: signupForm.token,
                    sessionId: tokenValidation.sessionId,
                    userId: userId,
                    companyName: signupForm.companyName,
                    contactName: signupForm.contactName,
                    contactEmail: signupForm.email,
                    // REMOVED: contactPhone - data protection compliance
                    registeredAt: new Date().toISOString()
                })
            });

            if (!registerResponse.ok) {
                throw new Error('Provider registration failed. Please try again.');
            }

            const registerResult = await registerResponse.json();

            if (!registerResult.success) {
                throw new Error(registerResult.message || 'Registration failed.');
            }

            eventLogger.completed('provider_onboarding', 'provider_record_created', {
                providerId: registerResult.providerId,
                sessionId: tokenValidation.sessionId
            });

            // ================================================================
            // STEP 3: Set clarence_auth in localStorage
            // ================================================================
            const clarenceAuth = {
                authenticated: true,
                userInfo: {
                    userId: userId,
                    email: signupForm.email,
                    firstName: firstName,
                    lastName: lastName,
                    company: signupForm.companyName,
                    role: 'provider'
                },
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('clarence_auth', JSON.stringify(clarenceAuth));

            // ================================================================
            // STEP 4: Store provider session for this contract
            // ================================================================
            const providerSession = {
                providerId: registerResult.providerId,
                sessionId: tokenValidation.sessionId,
                sessionNumber: tokenValidation.sessionNumber,
                companyName: signupForm.companyName,
                customerCompany: tokenValidation.customerCompany,
                serviceRequired: tokenValidation.serviceRequired || tokenValidation.contractType,
                dealValue: tokenValidation.dealValue
            };
            localStorage.setItem('clarence_provider_session', JSON.stringify(providerSession));

            // ================================================================
            // STEP 5: Redirect to welcome/intake
            // ================================================================
            eventLogger.completed('provider_onboarding', 'signup_completed', {
                providerId: registerResult.providerId,
                sessionId: tokenValidation.sessionId
            });

            router.push(`/provider/welcome?session_id=${tokenValidation.sessionId}&provider_id=${registerResult.providerId}`);

        } catch (error) {
            console.error('Signup error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Signup failed. Please try again.');

            eventLogger.failed('provider_onboarding', 'signup_submitted',
                error instanceof Error ? error.message : 'Signup failed', 'SIGNUP_ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================================================
    // SECTION 7E: LOGIN HANDLER
    // ========================================================================

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        setShowActivateAccount(false);

        try {
            if (!loginForm.email || !loginForm.password) {
                throw new Error('Please enter your email and password.');
            }

            // ================================================================
            // STEP 1: Authenticate with Supabase
            // ================================================================
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: loginForm.email,
                password: loginForm.password
            });

            if (authError) {
                // Check if this might be an existing provider without Supabase Auth
                if (authError.message.includes('Invalid login')) {
                    const existsInSystem = await checkExistingProvider(loginForm.email);
                    if (existsInSystem) {
                        // They exist in our system but not in Supabase Auth
                        setShowActivateAccount(true);
                        setIsLoading(false);
                        return;
                    }
                }
                throw new Error('Invalid email or password.');
            }

            if (!authData.user) {
                throw new Error('Login failed. Please try again.');
            }

            const user = authData.user;
            const metadata = user.user_metadata || {};

            eventLogger.completed('provider_onboarding', 'login_successful', {
                userId: user.id,
                email: user.email
            });

            // ================================================================
            // STEP 2: Set clarence_auth in localStorage
            // ================================================================
            const clarenceAuth = {
                authenticated: true,
                userInfo: {
                    userId: user.id,
                    email: user.email,
                    firstName: metadata.first_name || '',
                    lastName: metadata.last_name || '',
                    company: metadata.company || '',
                    role: 'provider'
                },
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('clarence_auth', JSON.stringify(clarenceAuth));

            // ================================================================
            // STEP 3: Find active sessions for this provider
            // ================================================================
            const sessionsResponse = await fetch(
                `${API_BASE}/provider-sessions-api?email=${encodeURIComponent(loginForm.email)}`
            );

            let sessions: ProviderSession[] = [];

            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                sessions = sessionsData.sessions || [];
            }

            // ================================================================
            // STEP 4: Route based on sessions
            // ================================================================
            if (sessions.length === 0) {
                // No active sessions
                setSuccessMessage('Login successful! However, you have no active contract invitations. Please check your email for an invitation link.');
                setIsLoading(false);
                return;
            }

            if (sessions.length === 1) {
                // Single session - go directly
                const session = sessions[0];
                localStorage.setItem('clarence_provider_session', JSON.stringify(session));

                // Determine where to redirect based on completion status
                if (!session.intakeComplete) {
                    router.push(`/provider/intake?session_id=${session.sessionId}&provider_id=${session.providerId}`);
                } else if (!session.questionnaireComplete) {
                    router.push(`/provider/questionnaire?session_id=${session.sessionId}&provider_id=${session.providerId}`);
                } else {
                    router.push(`/auth/contract-studio?session_id=${session.sessionId}&provider_id=${session.providerId}`);
                }
                return;
            }

            // Multiple sessions - for now, go to most recent
            // TODO: Add session picker modal
            const mostRecent = sessions[0];
            localStorage.setItem('clarence_provider_session', JSON.stringify(mostRecent));

            if (!mostRecent.intakeComplete) {
                router.push(`/provider/intake?session_id=${mostRecent.sessionId}&provider_id=${mostRecent.providerId}`);
            } else if (!mostRecent.questionnaireComplete) {
                router.push(`/provider/questionnaire?session_id=${mostRecent.sessionId}&provider_id=${mostRecent.providerId}`);
            } else {
                router.push(`/auth/contract-studio?session_id=${mostRecent.sessionId}&provider_id=${mostRecent.providerId}`);
            }

        } catch (error) {
            console.error('Login error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Login failed. Please try again.');

            eventLogger.failed('provider_onboarding', 'login_attempted',
                error instanceof Error ? error.message : 'Login failed', 'LOGIN_ERROR');
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================================================
    // SECTION 7E2: CHECK EXISTING PROVIDER
    // ========================================================================

    const checkExistingProvider = async (email: string): Promise<boolean> => {
        try {
            const response = await fetch(
                `${API_BASE}/provider-sessions-api?email=${encodeURIComponent(email)}`
            );
            if (response.ok) {
                const data = await response.json();
                return data.sessions && data.sessions.length > 0;
            }
            return false;
        } catch {
            return false;
        }
    };

    // ========================================================================
    // SECTION 7E3: ACTIVATE ACCOUNT HANDLER
    // ========================================================================

    const handleActivateAccount = async () => {
        if (!loginForm.email) {
            setErrorMessage('Please enter your email address.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            // Send password reset email - this will work even if account doesn't exist in Supabase
            // It essentially creates the account on first password set
            const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
                redirectTo: `${window.location.origin}/reset-password?type=activation`
            });

            if (error) {
                throw new Error(error.message);
            }

            setActivationEmailSent(true);
            setShowActivateAccount(false);

            eventLogger.completed('provider_onboarding', 'activation_email_sent', {
                email: loginForm.email
            });

        } catch (error) {
            console.error('Activation error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send activation email.');
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================================================
    // SECTION 7F: FORGOT PASSWORD HANDLER
    // ========================================================================

    const handleForgotPassword = async () => {
        if (!loginForm.email) {
            setErrorMessage('Please enter your email address first.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) {
                throw new Error(error.message);
            }

            setSuccessMessage('Password reset email sent. Please check your inbox.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send reset email.');
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================================================
    // SECTION 7G: TOKEN INPUT HANDLER
    // ========================================================================

    const handleTokenChange = (value: string) => {
        setSignupForm(prev => ({ ...prev, token: value }));
        setTokenValidated(false);
        setTokenValidation(null);

        // Auto-validate after a short delay
        if (value.trim().length >= 10) {
            const timeoutId = setTimeout(() => {
                validateToken(value, '');
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    };

    // ========================================================================
    // SECTION 8: RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />

            <main className="flex-1 py-12 px-4">
                <div className="max-w-md mx-auto">

                    {/* ============================================================ */}
                    {/* SECTION 8A: PAGE HEADER */}
                    {/* ============================================================ */}

                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">
                            Provider Portal
                        </h1>
                        <p className="text-slate-500">
                            {activeTab === 'signup'
                                ? 'Create your account to start negotiating'
                                : 'Sign in to continue your negotiations'
                            }
                        </p>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 8B: TAB SWITCHER */}
                    {/* ============================================================ */}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                        {/* Tab Headers */}
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => {
                                    setActiveTab('signup');
                                    setErrorMessage('');
                                    setSuccessMessage('');
                                    setShowActivateAccount(false);
                                    setActivationEmailSent(false);
                                }}
                                className={`flex-1 py-4 text-sm font-medium transition-colors
                                    ${activeTab === 'signup'
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                Sign Up
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('login');
                                    setErrorMessage('');
                                    setSuccessMessage('');
                                    setShowActivateAccount(false);
                                    setActivationEmailSent(false);
                                }}
                                className={`flex-1 py-4 text-sm font-medium transition-colors
                                    ${activeTab === 'login'
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                Log In
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-6">

                            {/* Error Message */}
                            {errorMessage && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-red-700 text-sm flex-1">{errorMessage}</span>
                                    <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* Success Message */}
                            {successMessage && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-emerald-700 text-sm flex-1">{successMessage}</span>
                                    <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-emerald-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* ======================================================== */}
                            {/* SECTION 8C: SIGNUP TAB CONTENT */}
                            {/* ======================================================== */}

                            {activeTab === 'signup' && (
                                <form onSubmit={handleSignup} className="space-y-5">

                                    {/* Token Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Invitation Token <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={signupForm.token}
                                                onChange={(e) => handleTokenChange(e.target.value)}
                                                placeholder="e.g., INV-XXXXXXXX-XXXXXX"
                                                className={`w-full px-4 py-3 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm font-mono
                                                    ${tokenValidated
                                                        ? 'border-emerald-300 bg-emerald-50'
                                                        : signupForm.token && !isValidatingToken
                                                            ? 'border-red-300 bg-red-50'
                                                            : 'border-slate-300'
                                                    }`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {isValidatingToken ? (
                                                    <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                                                ) : tokenValidated ? (
                                                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : signupForm.token ? (
                                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                ) : null}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1.5">
                                            Your invitation token was sent via email. It&apos;s only used once to verify your invitation.
                                        </p>
                                    </div>

                                    {/* Contract Details (shown when token is valid) */}
                                    {tokenValidated && tokenValidation && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-slate-800 mb-2 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Invitation Verified
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="text-slate-500">Customer:</span>
                                                    <p className="font-medium text-slate-800">{tokenValidation.customerCompany}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Contract:</span>
                                                    <p className="font-medium text-slate-800">{tokenValidation.serviceRequired || tokenValidation.contractType || 'Service Agreement'}</p>
                                                </div>
                                                {tokenValidation.dealValue && (
                                                    <div>
                                                        <span className="text-slate-500">Value:</span>
                                                        <p className="font-medium text-blue-600">£{parseInt(tokenValidation.dealValue).toLocaleString()}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-slate-500">Reference:</span>
                                                    <p className="font-medium text-slate-800 font-mono text-xs">{tokenValidation.sessionNumber}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Divider */}
                                    {tokenValidated && (
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-slate-200"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs">
                                                <span className="px-2 bg-white text-slate-500">Create your account</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Work Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={signupForm.email}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="you@company.com"
                                            disabled={!tokenValidated}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            value={signupForm.password}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="Minimum 8 characters"
                                            disabled={!tokenValidated}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Confirm Password <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            value={signupForm.confirmPassword}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            placeholder="Confirm your password"
                                            disabled={!tokenValidated}
                                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-slate-100 disabled:cursor-not-allowed
                                                ${signupForm.confirmPassword && signupForm.password !== signupForm.confirmPassword
                                                    ? 'border-red-300 bg-red-50'
                                                    : 'border-slate-300'
                                                }`}
                                        />
                                        {signupForm.confirmPassword && signupForm.password !== signupForm.confirmPassword && (
                                            <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
                                        )}
                                    </div>

                                    {/* Company Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Company Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={signupForm.companyName}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, companyName: e.target.value }))}
                                            placeholder="Your company name"
                                            disabled={!tokenValidated}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Contact Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Your Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={signupForm.contactName}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, contactName: e.target.value }))}
                                            placeholder="Your full name"
                                            disabled={!tokenValidated}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* REMOVED: Phone Number field - data protection compliance */}

                                    {/* Data Protection Notice */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                            <p className="text-xs text-slate-600">
                                                We only collect your name and work email. Your data is stored securely and never used to train AI models.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isLoading || !tokenValidated}
                                        className={`w-full py-3.5 rounded-lg text-white font-medium transition
                                            ${isLoading || !tokenValidated
                                                ? 'bg-slate-300 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                            }`}
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Creating Account...
                                            </span>
                                        ) : (
                                            'Create Account & Continue'
                                        )}
                                    </button>

                                    {/* Help Text */}
                                    <p className="text-xs text-slate-500 text-center">
                                        After creating your account, you&apos;ll use your email and password to log in.
                                    </p>
                                </form>
                            )}

                            {/* ======================================================== */}
                            {/* SECTION 8D: LOGIN TAB CONTENT */}
                            {/* ======================================================== */}

                            {activeTab === 'login' && (
                                <>
                                    {/* Activation Email Sent Success */}
                                    {activationEmailSent ? (
                                        <div className="text-center py-6">
                                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                                Check Your Email
                                            </h3>
                                            <p className="text-slate-600 text-sm mb-4">
                                                We&apos;ve sent an activation link to <strong>{loginForm.email}</strong>
                                            </p>
                                            <p className="text-slate-500 text-xs mb-6">
                                                Click the link in the email to set your password and activate your account.
                                                The link will expire in 24 hours.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setActivationEmailSent(false);
                                                    setLoginForm({ email: '', password: '' });
                                                }}
                                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                            >
                                                ← Back to Login
                                            </button>
                                        </div>
                                    ) : showActivateAccount ? (
                                        /* Activate Account Prompt */
                                        <div className="text-center py-4">
                                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                                Account Activation Required
                                            </h3>
                                            <p className="text-slate-600 text-sm mb-2">
                                                We found your account for <strong>{loginForm.email}</strong>
                                            </p>
                                            <p className="text-slate-500 text-xs mb-6">
                                                Your account was created before our new login system.
                                                Click below to receive an email to set your password and activate your account.
                                            </p>

                                            <button
                                                onClick={handleActivateAccount}
                                                disabled={isLoading}
                                                className={`w-full py-3 rounded-lg text-white font-medium transition mb-4
                                                    ${isLoading
                                                        ? 'bg-slate-300 cursor-not-allowed'
                                                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                                    }`}
                                            >
                                                {isLoading ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        Sending...
                                                    </span>
                                                ) : (
                                                    'Send Activation Email'
                                                )}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setShowActivateAccount(false);
                                                    setLoginForm(prev => ({ ...prev, password: '' }));
                                                }}
                                                className="text-slate-500 hover:text-slate-700 text-sm"
                                            >
                                                ← Try different credentials
                                            </button>
                                        </div>
                                    ) : (
                                        /* Standard Login Form */
                                        <form onSubmit={handleLogin} className="space-y-5">

                                            {/* Email */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                    Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    value={loginForm.email}
                                                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                                                    placeholder="you@company.com"
                                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                                />
                                            </div>

                                            {/* Password */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                    Password
                                                </label>
                                                <input
                                                    type="password"
                                                    value={loginForm.password}
                                                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                                                    placeholder="Enter your password"
                                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                                />
                                            </div>

                                            {/* Forgot Password Link */}
                                            <div className="text-right">
                                                <button
                                                    type="button"
                                                    onClick={handleForgotPassword}
                                                    disabled={isLoading}
                                                    className="text-sm text-blue-600 hover:text-blue-700"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>

                                            {/* Submit Button */}
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className={`w-full py-3.5 rounded-lg text-white font-medium transition
                                                    ${isLoading
                                                        ? 'bg-slate-300 cursor-not-allowed'
                                                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                                    }`}
                                            >
                                                {isLoading ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        Signing In...
                                                    </span>
                                                ) : (
                                                    'Sign In'
                                                )}
                                            </button>

                                            {/* Help Text */}
                                            <div className="text-center pt-4 border-t border-slate-200">
                                                <p className="text-sm text-slate-500">
                                                    Don&apos;t have an account?
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Check your email for an invitation from a customer, then use the Sign Up tab.
                                                </p>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 8E: CUSTOMER PORTAL LINK */}
                    {/* ============================================================ */}

                    <div className="text-center mt-8 p-4 bg-white rounded-xl border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Are you a customer?</p>
                        <Link
                            href="/auth/login"
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1"
                        >
                            Go to Customer Portal
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </Link>
                    </div>

                </div>
            </main>

            <ProviderFooter />

            {/* Beta Feedback Button */}
            <FeedbackButton position="bottom-left" />
        </div>
    );
}

// ============================================================================
// SECTION 9: MAIN EXPORT WITH SUSPENSE WRAPPER
// ============================================================================

export default function ProviderPortalPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <ProviderAuthContent />
        </Suspense>
    );
}