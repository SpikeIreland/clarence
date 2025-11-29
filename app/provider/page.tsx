'use client';

// ============================================================
// SECTION 1: IMPORTS
// ============================================================

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ============================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================

interface TokenValidation {
    valid: boolean;
    sessionId: string;
    sessionNumber: string;
    customerCompany: string;
    invitedEmail: string;
    contractType: string;
    dealValue: string;
    alreadyRegistered: boolean;
    providerId?: string;
    providerCompany?: string;
    error?: string;
}

interface RegistrationData {
    token: string;
    sessionId: string;
    companyName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    companySize: string;
    industry: string;
}

// ============================================================
// SECTION 3: SHARED HEADER COMPONENT
// ============================================================

function ProviderHeader() {
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    {/* Logo & Brand - Blue gradient for Provider */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">Provider Portal</div>
                        </div>
                    </Link>

                    {/* Right: Customer Portal Link */}
                    <div className="flex items-center gap-4">
                        <Link
                            href="/auth/login"
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Customer Portal →
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    );
}

// ============================================================
// SECTION 4: SHARED FOOTER COMPONENT
// ============================================================

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

// ============================================================
// SECTION 5: LOADING COMPONENT
// ============================================================

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />
            <main className="flex-1 flex items-center justify-center">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full mx-4 text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Loading Provider Portal
                    </h2>
                    <p className="text-slate-500">
                        Please wait...
                    </p>
                </div>
            </main>
            <ProviderFooter />
        </div>
    );
}

// ============================================================
// SECTION 6: MAIN PROVIDER PORTAL CONTENT
// ============================================================

function ProviderPortalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ============================================================
    // SECTION 7: STATE MANAGEMENT
    // ============================================================

    const [view, setView] = useState<'landing' | 'validating' | 'register' | 'error'>('landing');
    const [tokenData, setTokenData] = useState<TokenValidation | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [manualToken, setManualToken] = useState('');

    const [formData, setFormData] = useState<RegistrationData>({
        token: '',
        sessionId: '',
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        companySize: '',
        industry: ''
    });

    // ============================================================
    // SECTION 8: CHECK FOR TOKEN ON MOUNT
    // ============================================================

    useEffect(() => {
        const token = searchParams.get('token');
        const sessionId = searchParams.get('session_id');

        if (token) {
            setView('validating');
            validateToken(token, sessionId || '');
        }
    }, [searchParams]);

    // ============================================================
    // SECTION 9: API FUNCTIONS
    // ============================================================

    const validateToken = async (token: string, sessionId: string) => {
        try {
            const response = await fetch(
                `https://spikeislandstudios.app.n8n.cloud/webhook/validate-provider-token?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(sessionId)}`,
                { method: 'GET' }
            );

            if (!response.ok) {
                throw new Error('Token validation failed');
            }

            const data = await response.json();

            if (data.valid) {
                setTokenData(data);

                if (data.alreadyRegistered && data.providerId) {
                    localStorage.setItem('providerSession', JSON.stringify({
                        providerId: data.providerId,
                        sessionId: data.sessionId,
                        companyName: data.providerCompany,
                        token: token
                    }));
                    router.push(`/provider/welcome?session_id=${data.sessionId}&provider_id=${data.providerId}`);
                    return;
                }

                setFormData(prev => ({
                    ...prev,
                    token: token,
                    sessionId: data.sessionId,
                    contactEmail: data.invitedEmail || ''
                }));
                setView('register');
            } else {
                setView('error');
                setErrorMessage(data.error || 'Invalid or expired invitation token.');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            setView('error');
            setErrorMessage('Unable to validate invitation. Please check your token and try again.');
        }
    };

    const handleManualTokenSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualToken.trim()) {
            setView('validating');
            validateToken(manualToken.trim(), '');
        }
    };

    const handleRegistrationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            if (!formData.companyName || !formData.contactName || !formData.contactEmail) {
                throw new Error('Please fill in all required fields.');
            }

            const response = await fetch(
                'https://spikeislandstudios.app.n8n.cloud/webhook/provider-register',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...formData,
                        registeredAt: new Date().toISOString()
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Registration failed');
            }

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('providerSession', JSON.stringify({
                    providerId: result.providerId,
                    sessionId: formData.sessionId,
                    companyName: formData.companyName,
                    contactName: formData.contactName,
                    contactEmail: formData.contactEmail,
                    token: formData.token,
                    registeredAt: new Date().toISOString()
                }));

                router.push(`/provider/welcome?session_id=${formData.sessionId}&provider_id=${result.providerId}`);
            } else {
                throw new Error(result.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Registration failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturnToSession = () => {
        const storedSession = localStorage.getItem('providerSession');
        if (storedSession) {
            try {
                const session = JSON.parse(storedSession);
                if (session.providerId && session.sessionId) {
                    router.push(`/provider/welcome?session_id=${session.sessionId}&provider_id=${session.providerId}`);
                    return;
                }
            } catch (e) {
                console.error('Error parsing stored session:', e);
            }
        }
        setErrorMessage('No active session found. Please use your invitation link.');
    };

    // ============================================================
    // SECTION 10: FORM INPUT HANDLER
    // ============================================================

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ============================================================
    // SECTION 11: RENDER - LANDING PAGE (Default View)
    // ============================================================

    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />

                <main className="flex-1 py-12 px-4">
                    <div className="max-w-4xl mx-auto">
                        {/* Welcome Section */}
                        <div className="text-center mb-12">
                            <h1 className="text-3xl font-bold text-slate-800 mb-4">
                                Welcome to CLARENCE Provider Portal
                            </h1>
                            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                                CLARENCE is an AI-powered contract mediation platform that helps providers and customers
                                reach fair, balanced agreements through transparent negotiation.
                            </p>
                        </div>

                        {/* Error Message */}
                        {errorMessage && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-md mx-auto flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-700 text-sm flex-1">{errorMessage}</span>
                                <button
                                    onClick={() => setErrorMessage('')}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* Action Cards */}
                        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                            {/* I Have an Invitation Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 hover:border-blue-300 hover:shadow-md transition">
                                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                                    <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                                    I Have an Invitation
                                </h3>
                                <p className="text-slate-500 mb-6 text-sm">
                                    Enter your invitation token to begin the contract negotiation process.
                                </p>

                                <form onSubmit={handleManualTokenSubmit}>
                                    <input
                                        type="text"
                                        value={manualToken}
                                        onChange={(e) => setManualToken(e.target.value)}
                                        placeholder="Enter invitation token (e.g., INV-XXXXXXXX)"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualToken.trim()}
                                        className={`w-full py-3 rounded-lg font-medium transition text-sm
                                            ${manualToken.trim()
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                    >
                                        Validate Invitation
                                    </button>
                                </form>
                            </div>

                            {/* Return to Session Card */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 hover:border-slate-300 hover:shadow-md transition">
                                <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-6">
                                    <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                                    Return to Session
                                </h3>
                                <p className="text-slate-500 mb-6 text-sm">
                                    Already started? Continue where you left off with your existing negotiation session.
                                </p>

                                <button
                                    onClick={handleReturnToSession}
                                    className="w-full py-3 rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-sm cursor-pointer"
                                >
                                    Continue Session
                                </button>
                            </div>
                        </div>

                        {/* Help Text */}
                        <div className="text-center mt-12">
                            <p className="text-slate-500 text-sm">
                                Don&apos;t have an invitation? Contact the customer who invited you to receive a new link.
                            </p>
                        </div>

                        {/* Customer Link */}
                        <div className="text-center mt-8 p-4 bg-white rounded-xl border border-slate-200 max-w-md mx-auto">
                            <p className="text-sm text-slate-500 mb-2">Are you a customer looking to create contracts?</p>
                            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1">
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

    // ============================================================
    // SECTION 12: RENDER - VALIDATING STATE
    // ============================================================

    if (view === 'validating') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />

                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Validating Your Invitation
                        </h2>
                        <p className="text-slate-500">
                            Please wait while we verify your invitation token...
                        </p>
                    </div>
                </main>

                <ProviderFooter />
            </div>
        );
    }

    // ============================================================
    // SECTION 13: RENDER - ERROR STATE
    // ============================================================

    if (view === 'error') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />

                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>

                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            Invitation Error
                        </h2>
                        <p className="text-slate-500 mb-6">
                            {errorMessage}
                        </p>

                        <button
                            onClick={() => {
                                setView('landing');
                                setErrorMessage('');
                                setManualToken('');
                            }}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                </main>

                <ProviderFooter />
            </div>
        );
    }

    // ============================================================
    // SECTION 14: RENDER - REGISTRATION FORM
    // ============================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />

            <main className="flex-1 py-12 px-4">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">
                            Complete Your Registration
                        </h1>
                        <p className="text-slate-500">
                            Register to begin the contract negotiation process
                        </p>
                    </div>

                    {/* Contract Details Card */}
                    {tokenData && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                            <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Contract Opportunity
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500">Customer:</span>
                                    <p className="font-medium text-slate-800">{tokenData.customerCompany}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Contract Type:</span>
                                    <p className="font-medium text-slate-800">{tokenData.contractType || 'BPO Services'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Estimated Value:</span>
                                    <p className="font-medium text-blue-600">
                                        {tokenData.dealValue ? `£${parseInt(tokenData.dealValue).toLocaleString()}` : 'To be discussed'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Session Reference:</span>
                                    <p className="font-medium text-slate-800 font-mono">{tokenData.sessionNumber}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Registration Form */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                        <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Provider Registration
                        </h2>

                        {/* Error Message */}
                        {errorMessage && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-700 text-sm">{errorMessage}</span>
                            </div>
                        )}

                        <form onSubmit={handleRegistrationSubmit} className="space-y-5">
                            {/* Company Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Company Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter your company name"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                />
                            </div>

                            {/* Contact Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Your Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="contactName"
                                    value={formData.contactName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter your full name"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                />
                            </div>

                            {/* Contact Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="contactEmail"
                                    value={formData.contactEmail}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter your email address"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                />
                                {tokenData?.invitedEmail && formData.contactEmail && formData.contactEmail !== tokenData.invitedEmail && (
                                    <p className="text-amber-600 text-xs mt-1.5 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Note: This differs from the invited email ({tokenData.invitedEmail})
                                    </p>
                                )}
                            </div>

                            {/* Contact Phone */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="contactPhone"
                                    value={formData.contactPhone}
                                    onChange={handleInputChange}
                                    placeholder="Enter your phone number"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                />
                            </div>

                            {/* Company Size */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Company Size <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="companySize"
                                    value={formData.companySize}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                >
                                    <option value="">Select company size</option>
                                    <option value="1-10">1-10 employees</option>
                                    <option value="11-50">11-50 employees</option>
                                    <option value="51-200">51-200 employees</option>
                                    <option value="201-500">201-500 employees</option>
                                    <option value="501-1000">501-1000 employees</option>
                                    <option value="1000+">1000+ employees</option>
                                </select>
                            </div>

                            {/* Industry */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Primary Industry <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="industry"
                                    value={formData.industry}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                                >
                                    <option value="">Select your industry</option>
                                    <option value="BPO">Business Process Outsourcing (BPO)</option>
                                    <option value="IT Services">IT Services</option>
                                    <option value="Customer Service">Customer Service</option>
                                    <option value="Finance & Accounting">Finance & Accounting</option>
                                    <option value="HR Services">HR Services</option>
                                    <option value="Legal Services">Legal Services</option>
                                    <option value="Consulting">Consulting</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full py-3.5 rounded-lg text-white font-medium transition mt-2
                                    ${isSubmitting
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Registering...
                                    </span>
                                ) : (
                                    'Continue to Provider Onboarding'
                                )}
                            </button>
                        </form>

                        {/* Back Link */}
                        <div className="text-center mt-6 pt-6 border-t border-slate-200">
                            <button
                                onClick={() => {
                                    setView('landing');
                                    setErrorMessage('');
                                }}
                                className="text-slate-500 hover:text-slate-700 text-sm cursor-pointer inline-flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Provider Portal
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            <ProviderFooter />
        </div>
    );
}

// ============================================================
// SECTION 15: MAIN EXPORT WITH SUSPENSE WRAPPER
// ============================================================

export default function ProviderPortalPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <ProviderPortalContent />
        </Suspense>
    );
}