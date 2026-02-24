'use client';

// ============================================================================
// PROVIDER PORTAL - HOME BASE
// Location: app/provider/page.tsx
// 
// Provider's central hub for all CLARENCE contract activity.
// 
// FLOW:
// 1. Provider arrives → check for existing Supabase session
// 2. If session exists → show dashboard with all active contracts
// 3. If no session → show login/signup form
// 4. After login → show dashboard
//
// DASHBOARD shows:
// - Quick Create contracts (from qc_recipients)
// - Contract Studio sessions (from provider-sessions-api)
// Each item has a status badge and "Continue" / "Enter" button
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

// Dashboard item - unified type for both QC and Contract Studio
interface DashboardItem {
    id: string;
    type: 'quick_create' | 'contract_studio';
    name: string;
    contractType: string;
    status: string;
    statusLabel: string;
    customerCompany: string;
    description?: string;
    lastActivity?: string;
    route: string;
}

// Logged-in user info for dashboard header
interface LoggedInUser {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    company: string;
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
                        <span className="font-semibold text-lg">CLARENCE</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <FeedbackButton />
                    </div>
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
        <footer className="bg-slate-50 border-t border-slate-200 py-6 mt-auto">
            <div className="container mx-auto px-6 text-center">
                <p className="text-sm text-slate-400">
                    &copy; {new Date().getFullYear()} Clarence Legal Limited. All rights reserved.
                </p>
            </div>
        </footer>
    );
}

// ============================================================================
// SECTION 6: LOADING COMPONENT
// ============================================================================

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Loading Provider Portal...</p>
            </div>
        </div>
    );
}

// ============================================================================
// SECTION 7: MAIN COMPONENT
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

    // Reset password
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

    // Dashboard state
    const [showDashboard, setShowDashboard] = useState(false);
    const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);

    // ========================================================================
    // SECTION 7B: AUTO-SESSION CHECK ON MOUNT
    // ========================================================================

    useEffect(() => {
        async function checkExistingSession() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const metadata = user.user_metadata || {};
                    const userInfo: LoggedInUser = {
                        userId: user.id,
                        email: user.email || '',
                        firstName: metadata.first_name || '',
                        lastName: metadata.last_name || '',
                        company: metadata.company || ''
                    };
                    setLoggedInUser(userInfo);
                    console.log('[Provider] Existing session found for', user.email);
                    await fetchDashboardItems(user.email || '');
                }
            } catch (err) {
                console.error('[Provider] Session check error:', err);
            }
        }
        checkExistingSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ========================================================================
    // SECTION 7C: FETCH DASHBOARD ITEMS
    // ========================================================================

    async function fetchDashboardItems(email: string) {
        setDashboardLoading(true);
        console.log('[Provider Dashboard] Fetching items for', email);

        const items: DashboardItem[] = [];

        // ------------------------------------------------------------------
        // PART 1: Fetch Quick Create contracts (qc_recipients)
        // ------------------------------------------------------------------
        try {
            const { data: qcData, error: qcError } = await supabase
                .from('qc_recipients')
                .select(`
                    recipient_id, status, recipient_email, recipient_name,
                    quick_contracts!inner (
                        quick_contract_id, contract_name, contract_type,
                        status, description, created_at, updated_at,
                        companies!quick_contracts_company_id_fkey (company_name)
                    )
                `)
                .eq('recipient_email', email);

            if (qcError) {
                console.error('[Provider Dashboard] QC query error:', qcError);
            } else if (qcData) {
                console.log('[Provider Dashboard] QC contracts found:', qcData.length);
                for (const row of qcData) {
                    const qc = row.quick_contracts as unknown as Record<string, unknown>;
                    if (!qc) continue;

                    // Skip cancelled contracts
                    const contractStatus = qc.status as string;
                    if (contractStatus === 'cancelled') continue;

                    // Determine status label
                    let statusLabel = 'Pending Review';
                    const recipientStatus = row.status;
                    if (recipientStatus === 'accepted') statusLabel = 'Accepted';
                    else if (recipientStatus === 'declined') statusLabel = 'Declined';
                    else if (contractStatus === 'sent') statusLabel = 'Awaiting Response';
                    else if (contractStatus === 'negotiating') statusLabel = 'In Negotiation';

                    const companies = qc.companies as Record<string, string> | null;

                    items.push({
                        id: qc.quick_contract_id as string,
                        type: 'quick_create',
                        name: qc.contract_name as string || 'Untitled Contract',
                        contractType: qc.contract_type as string || 'standard',
                        status: recipientStatus,
                        statusLabel,
                        customerCompany: companies?.company_name || 'Unknown',
                        description: qc.description as string || undefined,
                        lastActivity: qc.updated_at as string || qc.created_at as string,
                        route: `/auth/quick-contract/studio/${qc.quick_contract_id as string}`
                    });
                }
            }
        } catch (err) {
            console.error('[Provider Dashboard] QC fetch error:', err);
        }

        // ------------------------------------------------------------------
        // PART 2: Fetch Contract Studio sessions (existing API)
        // ------------------------------------------------------------------
        try {
            const sessionsResponse = await fetch(
                `${API_BASE}/provider-sessions-api?email=${encodeURIComponent(email)}`
            );

            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                const sessions: ProviderSession[] = sessionsData.sessions || [];
                console.log('[Provider Dashboard] Contract Studio sessions found:', sessions.length);

                for (const session of sessions) {
                    // Determine status and route
                    let statusLabel = 'Active';
                    let route = `/auth/contract-studio?session_id=${session.sessionId}&provider_id=${session.providerId}`;

                    if (!session.intakeComplete) {
                        statusLabel = 'Intake Required';
                        route = `/provider/intake?session_id=${session.sessionId}&provider_id=${session.providerId}`;
                    } else if (!session.questionnaireComplete) {
                        statusLabel = 'Questionnaire Required';
                        route = `/provider/questionnaire?session_id=${session.sessionId}&provider_id=${session.providerId}`;
                    }

                    items.push({
                        id: session.sessionId,
                        type: 'contract_studio',
                        name: session.serviceRequired || 'Contract Negotiation',
                        contractType: 'negotiation',
                        status: session.status,
                        statusLabel,
                        customerCompany: session.customerCompany || 'Unknown',
                        description: session.dealValue ? `Deal value: ${session.dealValue}` : undefined,
                        lastActivity: undefined,
                        route
                    });
                }
            }
        } catch (err) {
            console.error('[Provider Dashboard] Sessions fetch error:', err);
        }

        // ------------------------------------------------------------------
        // PART 3: Sort by most recent activity and show dashboard
        // ------------------------------------------------------------------
        items.sort((a, b) => {
            if (a.lastActivity && b.lastActivity) {
                return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
            }
            return a.lastActivity ? -1 : 1;
        });

        console.log('[Provider Dashboard] Total items:', items.length);
        setDashboardItems(items);
        setDashboardLoading(false);
        setShowDashboard(true);
        setIsLoading(false);
    }

    // ========================================================================
    // SECTION 7D: TOKEN VALIDATION (for signup)
    // ========================================================================

    async function validateToken(token: string, email: string) {
        setIsValidatingToken(true);
        setTokenValidation(null);

        try {
            const response = await fetch(
                `${API_BASE}/provider-validate-token?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
            );
            if (!response.ok) throw new Error('Validation failed');

            const data = await response.json();
            setTokenValidation(data);
            setTokenValidated(true);

            // Pre-fill form if data available
            if (data.valid && data.invitedEmail) {
                setSignupForm(prev => ({
                    ...prev,
                    email: data.invitedEmail,
                    companyName: data.providerCompany || prev.companyName
                }));
            }
        } catch (error) {
            console.error('Token validation error:', error);
            setTokenValidation({
                valid: false,
                sessionId: '',
                sessionNumber: '',
                customerCompany: '',
                invitedEmail: '',
                contractType: '',
                dealValue: '',
                serviceRequired: '',
                alreadyRegistered: false,
                error: 'Failed to validate invitation token'
            });
        } finally {
            setIsValidatingToken(false);
        }
    }

    // ========================================================================
    // SECTION 7D2: SIGNUP HANDLER
    // ========================================================================

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            if (signupForm.password !== signupForm.confirmPassword) {
                throw new Error('Passwords do not match');
            }

            if (signupForm.password.length < 8) {
                throw new Error('Password must be at least 8 characters');
            }

            if (!tokenValidated || !tokenValidation?.valid) {
                throw new Error('Please enter a valid invitation token first');
            }

            // Create Supabase Auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: signupForm.email,
                password: signupForm.password,
                options: {
                    data: {
                        first_name: signupForm.contactName.split(' ')[0] || '',
                        last_name: signupForm.contactName.split(' ').slice(1).join(' ') || '',
                        company: signupForm.companyName,
                        role: 'provider'
                    }
                }
            });

            if (authError) {
                // Check if this is an "already exists" type error - redirect to login
                if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                    throw new Error('An account with this email already exists. Please use the Login tab.');
                }
                throw new Error(authError.message);
            }

            if (!authData.user) {
                throw new Error('Account creation failed. Please try again.');
            }

            eventLogger.completed('provider_onboarding', 'signup_successful', {
                userId: authData.user.id,
                email: signupForm.email
            });

            // If session exists (email verification disabled), go to dashboard
            if (authData.session) {
                const userInfo: LoggedInUser = {
                    userId: authData.user.id,
                    email: signupForm.email,
                    firstName: signupForm.contactName.split(' ')[0] || '',
                    lastName: signupForm.contactName.split(' ').slice(1).join(' ') || '',
                    company: signupForm.companyName
                };
                setLoggedInUser(userInfo);

                localStorage.setItem('clarence_auth', JSON.stringify({
                    authenticated: true,
                    userInfo: { ...userInfo, role: 'provider' },
                    loginTime: new Date().toISOString()
                }));

                await fetchDashboardItems(signupForm.email);
                return;
            }

            setSuccessMessage('Account created! Please check your email to verify your account, then log in.');
            setActiveTab('login');

        } catch (error) {
            console.error('Signup error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Signup failed. Please try again.');

            eventLogger.failed('provider_onboarding', 'signup_attempted',
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

            // ================================================================
            // STEP 2: Set clarence_auth in localStorage
            // ================================================================
            const userInfo: LoggedInUser = {
                userId: user.id,
                email: user.email || '',
                firstName: metadata.first_name || '',
                lastName: metadata.last_name || '',
                company: metadata.company || ''
            };
            setLoggedInUser(userInfo);

            localStorage.setItem('clarence_auth', JSON.stringify({
                authenticated: true,
                userInfo: { ...userInfo, role: 'provider' },
                loginTime: new Date().toISOString()
            }));

            // ================================================================
            // STEP 2B: FAST-PATH REDIRECT (from QC Studio auth bounce)
            // If sessionStorage has a redirect, the provider was trying to
            // reach a specific studio and got bounced here to authenticate.
            // ================================================================
            const qcRedirect = sessionStorage.getItem('clarence_qc_redirect');
            console.log('[Provider Login] sessionStorage check:', {
                qcRedirect: qcRedirect,
            });
            if (qcRedirect) {
                sessionStorage.removeItem('clarence_qc_redirect');
                console.log('Provider login: redirecting to', qcRedirect);
                window.location.replace(qcRedirect);
                // Halt execution — never-resolving promise prevents finally block
                return await new Promise(() => { });
            }

            eventLogger.completed('provider_onboarding', 'login_successful', {
                userId: user.id,
                email: user.email
            });

            // ================================================================
            // STEP 3: Load the dashboard with all active items
            // ================================================================
            await fetchDashboardItems(user.email || loginForm.email);

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

    async function checkExistingProvider(email: string): Promise<boolean> {
        try {
            const response = await fetch(
                `${API_BASE}/provider-check?email=${encodeURIComponent(email)}`
            );
            if (!response.ok) return false;
            const data = await response.json();
            return data.exists === true;
        } catch {
            return false;
        }
    }

    // ========================================================================
    // SECTION 7E3: ACTIVATE ACCOUNT HANDLER
    // ========================================================================

    async function handleActivateAccount() {
        setIsLoading(true);
        setErrorMessage('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
                redirectTo: `${window.location.origin}/reset-password?type=activation`
            });

            if (error) throw new Error(error.message);

            setActivationEmailSent(true);
            setSuccessMessage('Activation email sent! Please check your inbox to set your password.');

        } catch (error) {
            console.error('Activation error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send activation email.');
        } finally {
            setIsLoading(false);
        }
    }

    // ========================================================================
    // SECTION 7E4: RESET PASSWORD HANDLER
    // ========================================================================

    async function handleResetPassword() {
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            if (!loginForm.email) {
                throw new Error('Please enter your email address first.');
            }

            const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) throw new Error(error.message);

            setResetEmailSent(true);
            setSuccessMessage('Password reset email sent! Please check your inbox.');

        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send reset email.');
        } finally {
            setIsLoading(false);
        }
    }

    // ========================================================================
    // SECTION 7F: LOGOUT HANDLER
    // ========================================================================

    async function handleLogout() {
        await supabase.auth.signOut();
        localStorage.removeItem('clarence_auth');
        localStorage.removeItem('clarence_provider_session');
        setShowDashboard(false);
        setLoggedInUser(null);
        setDashboardItems([]);
        setLoginForm({ email: '', password: '' });
    }

    // ========================================================================
    // SECTION 7G: NAVIGATE TO ITEM
    // ========================================================================

    function handleNavigateToItem(item: DashboardItem) {
        console.log('[Provider Dashboard] Navigating to:', item.type, item.route);

        // Store session info for Contract Studio items
        if (item.type === 'contract_studio') {
            localStorage.setItem('clarence_provider_session', JSON.stringify({
                sessionId: item.id,
                providerId: '', // Will be in the route params
                customerCompany: item.customerCompany,
                serviceRequired: item.name,
                status: item.status
            }));
        }

        // Use hard navigation to avoid GoTrueClient issues
        window.location.href = item.route;
    }

    // ========================================================================
    // SECTION 7H: TOKEN CHANGE HANDLER
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

    // ========================================================================
    // SECTION 8-DASHBOARD: PROVIDER DASHBOARD VIEW
    // ========================================================================

    if (showDashboard) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />

                <main className="flex-1 py-8 px-4">
                    <div className="max-w-3xl mx-auto">

                        {/* ================================================ */}
                        {/* DASHBOARD HEADER */}
                        {/* ================================================ */}

                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">
                                    Provider Dashboard
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">
                                    {loggedInUser?.firstName
                                        ? `Welcome back, ${loggedInUser.firstName}`
                                        : `Signed in as ${loggedInUser?.email || ''}`
                                    }
                                    {loggedInUser?.company ? ` · ${loggedInUser.company}` : ''}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 
                                         rounded-lg border border-slate-200 hover:border-slate-300 
                                         transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>

                        {/* ================================================ */}
                        {/* LOADING STATE */}
                        {/* ================================================ */}

                        {dashboardLoading && (
                            <div className="text-center py-16">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-slate-500 text-sm">Loading your contracts...</p>
                            </div>
                        )}

                        {/* ================================================ */}
                        {/* EMPTY STATE */}
                        {/* ================================================ */}

                        {!dashboardLoading && dashboardItems.length === 0 && (
                            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-semibold text-slate-700 mb-2">No Active Contracts</h2>
                                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                    You don&apos;t have any active contract invitations yet. When a customer invites you to negotiate, their contracts will appear here.
                                </p>
                                <p className="text-slate-400 text-xs mt-4">
                                    Check your email for invitation links from customers.
                                </p>
                            </div>
                        )}

                        {/* ================================================ */}
                        {/* CONTRACT CARDS */}
                        {/* ================================================ */}

                        {!dashboardLoading && dashboardItems.length > 0 && (
                            <div className="space-y-3">
                                {dashboardItems.map((item) => (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 
                                                   hover:shadow-sm transition-all p-5"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            {/* Left: Contract info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {/* Type badge */}
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                                        ${item.type === 'quick_create'
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-blue-50 text-blue-700'
                                                        }`}
                                                    >
                                                        {item.type === 'quick_create' ? 'Quick Create' : 'Contract Studio'}
                                                    </span>
                                                    {/* Status badge */}
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                                        ${item.status === 'accepted' ? 'bg-green-50 text-green-700' :
                                                            item.status === 'declined' ? 'bg-red-50 text-red-700' :
                                                                item.statusLabel === 'In Negotiation' ? 'bg-amber-50 text-amber-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                        }`}
                                                    >
                                                        {item.statusLabel}
                                                    </span>
                                                </div>
                                                <h3 className="font-semibold text-slate-800 truncate">
                                                    {item.name}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-0.5">
                                                    From: {item.customerCompany}
                                                </p>
                                                {item.description && (
                                                    <p className="text-xs text-slate-400 mt-1 truncate">
                                                        {item.description}
                                                    </p>
                                                )}
                                                {item.lastActivity && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Last activity: {new Date(item.lastActivity).toLocaleDateString('en-GB', {
                                                            day: 'numeric', month: 'short', year: 'numeric'
                                                        })}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Right: Action button */}
                                            <button
                                                onClick={() => handleNavigateToItem(item)}
                                                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium 
                                                           transition-colors whitespace-nowrap
                                                    ${item.type === 'quick_create'
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    }`}
                                            >
                                                {item.statusLabel === 'Intake Required' || item.statusLabel === 'Questionnaire Required'
                                                    ? 'Continue Setup'
                                                    : item.status === 'accepted' || item.status === 'declined'
                                                        ? 'View'
                                                        : 'Enter Studio'
                                                }
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ================================================ */}
                        {/* HELP TEXT */}
                        {/* ================================================ */}

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
            </div>
        );
    }

    // ========================================================================
    // SECTION 8-AUTH: LOGIN / SIGNUP VIEW (not logged in)
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

                            {/* Error/Success Messages */}
                            {errorMessage && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {errorMessage}
                                </div>
                            )}
                            {successMessage && (
                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                    {successMessage}
                                </div>
                            )}

                            {/* ======================================================== */}
                            {/* SECTION 8C: SIGNUP TAB */}
                            {/* ======================================================== */}

                            {activeTab === 'signup' && (
                                <form onSubmit={handleSignup} className="space-y-4">

                                    {/* Token Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Invitation Token
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={signupForm.token}
                                                onChange={(e) => handleTokenChange(e.target.value)}
                                                placeholder="Paste your invitation token"
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            />
                                            {isValidatingToken && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                                                </div>
                                            )}
                                            {tokenValidated && tokenValidation?.valid && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Token Validation Result */}
                                        {tokenValidation && (
                                            <div className={`mt-2 p-3 rounded-lg text-xs ${tokenValidation.valid
                                                ? 'bg-green-50 text-green-700'
                                                : 'bg-red-50 text-red-700'
                                                }`}>
                                                {tokenValidation.valid
                                                    ? `Valid invitation from ${tokenValidation.customerCompany}`
                                                    : tokenValidation.error || 'Invalid token'
                                                }
                                                {tokenValidation.alreadyRegistered && (
                                                    <span className="block mt-1 font-medium">
                                                        You already have an account. Please use the Log In tab.
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Name Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={signupForm.contactName}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, contactName: e.target.value }))}
                                            placeholder="Full name"
                                            required
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    {/* Company Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Company Name
                                        </label>
                                        <input
                                            type="text"
                                            value={signupForm.companyName}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, companyName: e.target.value }))}
                                            placeholder="Your company"
                                            required
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    {/* Email Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Work Email
                                        </label>
                                        <input
                                            type="email"
                                            value={signupForm.email}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="you@company.com"
                                            required
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    {/* Password Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            value={signupForm.password}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="At least 8 characters"
                                            required
                                            minLength={8}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    {/* Confirm Password Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={signupForm.confirmPassword}
                                            onChange={(e) => setSignupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            placeholder="Confirm your password"
                                            required
                                            minLength={8}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isLoading || !tokenValidated || !tokenValidation?.valid}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                                                 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Creating Account...
                                            </span>
                                        ) : (
                                            'Create Account'
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* ======================================================== */}
                            {/* SECTION 8D: LOGIN TAB */}
                            {/* ======================================================== */}

                            {activeTab === 'login' && (
                                <>
                                    {/* Activate Account Message */}
                                    {showActivateAccount && !activationEmailSent && (
                                        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-sm text-amber-800 font-medium mb-2">
                                                Account Activation Required
                                            </p>
                                            <p className="text-xs text-amber-700 mb-3">
                                                We found your account but it needs to be activated with a new password.
                                                Click below to receive an activation email.
                                            </p>
                                            <button
                                                onClick={handleActivateAccount}
                                                disabled={isLoading}
                                                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg
                                                         text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                {isLoading ? 'Sending...' : 'Send Activation Email'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Reset Password */}
                                    {showResetPassword ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    value={loginForm.email}
                                                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                                                    placeholder="your@email.com"
                                                    required
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                />
                                            </div>

                                            {resetEmailSent ? (
                                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                                    Check your email for a password reset link.
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleResetPassword}
                                                    disabled={isLoading}
                                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                                                             font-medium text-sm transition-colors disabled:opacity-50"
                                                >
                                                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setShowResetPassword(false);
                                                    setResetEmailSent(false);
                                                    setErrorMessage('');
                                                    setSuccessMessage('');
                                                }}
                                                className="w-full text-sm text-slate-500 hover:text-slate-700"
                                            >
                                                Back to login
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleLogin} className="space-y-4">
                                            {/* Email */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    value={loginForm.email}
                                                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                                                    placeholder="your@email.com"
                                                    required
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                />
                                            </div>

                                            {/* Password */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Password
                                                </label>
                                                <input
                                                    type="password"
                                                    value={loginForm.password}
                                                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                                                    placeholder="Your password"
                                                    required
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm
                                                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                />
                                            </div>

                                            {/* Forgot Password Link */}
                                            <div className="text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowResetPassword(true);
                                                        setErrorMessage('');
                                                        setSuccessMessage('');
                                                    }}
                                                    className="text-sm text-blue-600 hover:text-blue-700"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>

                                            {/* Submit */}
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                                                         font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isLoading ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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