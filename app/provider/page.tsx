'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ============================================================
// SECTION 1: TYPE DEFINITIONS
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
// SECTION 2: LOADING COMPONENT
// ============================================================

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-[#2563eb] rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">
                    Loading Provider Portal
                </h2>
                <p className="text-slate-600">
                    Please wait...
                </p>
            </div>
        </div>
    );
}

// ============================================================
// SECTION 3: MAIN PROVIDER PORTAL CONTENT
// ============================================================

function ProviderPortalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // ============================================================
    // SECTION 4: STATE MANAGEMENT
    // ============================================================

    // View states: 'landing' | 'validating' | 'register' | 'error'
    const [view, setView] = useState<'landing' | 'validating' | 'register' | 'error'>('landing');
    const [tokenData, setTokenData] = useState<TokenValidation | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Token entry state (for manual entry)
    const [manualToken, setManualToken] = useState('');

    // Form state for registration
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
    // SECTION 5: CHECK FOR TOKEN ON MOUNT
    // ============================================================

    useEffect(() => {
        const token = searchParams.get('token');
        const sessionId = searchParams.get('session_id');

        // If token is in URL, automatically validate it
        if (token) {
            setView('validating');
            validateToken(token, sessionId || '');
        }
        // Otherwise show the landing page with options
    }, [searchParams]);

    // ============================================================
    // SECTION 6: API FUNCTIONS
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

                // If provider already registered, redirect to welcome/intake
                if (data.alreadyRegistered && data.providerId) {
                    // Store session info and redirect
                    localStorage.setItem('providerSession', JSON.stringify({
                        providerId: data.providerId,
                        sessionId: data.sessionId,
                        companyName: data.providerCompany,
                        token: token
                    }));
                    router.push(`/provider/welcome?session_id=${data.sessionId}&provider_id=${data.providerId}`);
                    return;
                }

                // Otherwise, show registration form
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
            // Validate required fields
            if (!formData.companyName || !formData.contactName || !formData.contactEmail) {
                throw new Error('Please fill in all required fields.');
            }

            // Submit registration to N8N workflow
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
                // Store provider info for subsequent pages
                localStorage.setItem('providerSession', JSON.stringify({
                    providerId: result.providerId,
                    sessionId: formData.sessionId,
                    companyName: formData.companyName,
                    contactName: formData.contactName,
                    contactEmail: formData.contactEmail,
                    token: formData.token,
                    registeredAt: new Date().toISOString()
                }));

                // Redirect to welcome page
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
        // Check if there's a stored session
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
        // If no valid session, show error
        setErrorMessage('No active session found. Please use your invitation link.');
    };

    // ============================================================
    // SECTION 7: FORM INPUT HANDLER
    // ============================================================

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ============================================================
    // SECTION 8: RENDER - LANDING PAGE (Default View)
    // ============================================================

    if (view === 'landing') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                {/* Header */}
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2563eb] rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">CLARENCE</h1>
                                <p className="text-xs text-slate-500">Provider Portal</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-4xl mx-auto px-4 py-12">
                    {/* Welcome Section */}
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Welcome to CLARENCE Provider Portal
                        </h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            CLARENCE is an AI-powered contract mediation platform that helps providers and customers
                            reach fair, balanced agreements through transparent negotiation.
                        </p>
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-8 max-w-md mx-auto">
                            {errorMessage}
                            <button
                                onClick={() => setErrorMessage('')}
                                className="ml-2 text-red-500 hover:text-red-700"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Action Cards */}
                    <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">

                        {/* I Have an Invitation Card */}
                        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-transparent hover:border-[#2563eb] transition">
                            <div className="w-14 h-14 bg-[#2563eb]/10 rounded-xl flex items-center justify-center mb-6">
                                <svg className="w-7 h-7 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-3">
                                I Have an Invitation
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Enter your invitation token to begin the contract negotiation process.
                            </p>

                            <form onSubmit={handleManualTokenSubmit}>
                                <input
                                    type="text"
                                    value={manualToken}
                                    onChange={(e) => setManualToken(e.target.value)}
                                    placeholder="Enter invitation token (e.g., INV-XXXXXXXX)"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                                />
                                <button
                                    type="submit"
                                    disabled={!manualToken.trim()}
                                    className={`w-full py-3 rounded-lg font-semibold transition
                    ${manualToken.trim()
                                            ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    Validate Invitation
                                </button>
                            </form>
                        </div>

                        {/* Return to Session Card */}
                        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-transparent hover:border-slate-300 transition">
                            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-6">
                                <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-3">
                                Return to Session
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Already started? Continue where you left off with your existing negotiation session.
                            </p>

                            <button
                                onClick={handleReturnToSession}
                                className="w-full py-3 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
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
                </main>

                {/* Footer */}
                <footer className="fixed bottom-0 left-0 right-0 bg-white border-t py-4">
                    <div className="max-w-7xl mx-auto px-4 text-center">
                        <p className="text-slate-500 text-sm">
                            Powered by <span className="font-semibold text-[#2563eb]">CLARENCE</span> - The Honest Broker
                        </p>
                    </div>
                </footer>
            </div>
        );
    }

    // ============================================================
    // SECTION 9: RENDER - VALIDATING STATE
    // ============================================================

    if (view === 'validating') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
                    {/* Spinner */}
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-[#2563eb] rounded-full animate-spin mx-auto mb-6"></div>

                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Validating Your Invitation
                    </h2>
                    <p className="text-slate-600">
                        Please wait while we verify your invitation token...
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // SECTION 10: RENDER - ERROR STATE
    // ============================================================

    if (view === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
                    {/* Error Icon */}
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>

                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Invitation Error
                    </h2>
                    <p className="text-slate-600 mb-6">
                        {errorMessage}
                    </p>

                    <button
                        onClick={() => {
                            setView('landing');
                            setErrorMessage('');
                            setManualToken('');
                        }}
                        className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================
    // SECTION 11: RENDER - REGISTRATION FORM
    // ============================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
            <div className="max-w-2xl mx-auto">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#2563eb] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-white font-bold text-2xl">C</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">
                        Welcome to CLARENCE
                    </h1>
                    <p className="text-slate-600">
                        Complete your registration to begin the contract negotiation process
                    </p>
                </div>

                {/* Contract Details Card */}
                {tokenData && (
                    <div className="bg-gradient-to-r from-[#2563eb]/10 to-[#1e40af]/10 border border-[#2563eb]/20 rounded-xl p-6 mb-8">
                        <h3 className="text-lg font-semibold text-[#1e40af] mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                <p className="font-medium text-slate-800">
                                    {tokenData.dealValue ? `£${parseInt(tokenData.dealValue).toLocaleString()}` : 'To be discussed'}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Session Reference:</span>
                                <p className="font-medium text-slate-800">{tokenData.sessionNumber}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Registration Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Provider Registration
                    </h2>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleRegistrationSubmit} className="space-y-6">

                        {/* Company Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Company Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter your company name"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
                            />
                        </div>

                        {/* Contact Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Your Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="contactName"
                                value={formData.contactName}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter your full name"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
                            />
                        </div>

                        {/* Contact Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                name="contactEmail"
                                value={formData.contactEmail}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter your email address"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
                            />
                            {tokenData?.invitedEmail && formData.contactEmail && formData.contactEmail !== tokenData.invitedEmail && (
                                <p className="text-amber-600 text-sm mt-1">
                                    Note: This differs from the invited email ({tokenData.invitedEmail})
                                </p>
                            )}
                        </div>

                        {/* Contact Phone */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                name="contactPhone"
                                value={formData.contactPhone}
                                onChange={handleInputChange}
                                placeholder="Enter your phone number"
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
                            />
                        </div>

                        {/* Company Size */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Company Size <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="companySize"
                                value={formData.companySize}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
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
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Primary Industry <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="industry"
                                value={formData.industry}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition"
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
                            className={`w-full py-4 rounded-lg text-white font-semibold text-lg transition
                ${isSubmitting
                                    ? 'bg-slate-400 cursor-not-allowed'
                                    : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                                }`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Registering...
                                </span>
                            ) : (
                                'Continue to Provider Onboarding'
                            )}
                        </button>
                    </form>

                    {/* Back Link */}
                    <div className="text-center mt-6">
                        <button
                            onClick={() => {
                                setView('landing');
                                setErrorMessage('');
                            }}
                            className="text-slate-500 hover:text-slate-700 text-sm"
                        >
                            ← Back to Provider Portal
                        </button>
                    </div>
                </div>

                {/* CLARENCE Branding */}
                <div className="text-center mt-8">
                    <p className="text-slate-500 text-sm">
                        Powered by <span className="font-semibold text-[#2563eb]">CLARENCE</span> - The Honest Broker
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// SECTION 12: MAIN EXPORT WITH SUSPENSE WRAPPER
// ============================================================

export default function ProviderPortalPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <ProviderPortalContent />
        </Suspense>
    );
}