'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: CONSTANTS & TYPES
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

interface TokenData {
    valid: boolean
    bidId: string
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    providerEmail: string
    provider_contact_email?: string  // API might return this name
    bidStatus: string
    error?: string
    message?: string
}

interface SessionAccessResult {
    valid: boolean
    sessionId?: string
    sessionStatus?: string
    bidStatus?: string
    intakeComplete?: boolean
    questionnaireComplete?: boolean
    error?: string
    message?: string
}

// ============================================================================
// SECTION 2: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function ProviderPortalPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading provider portal...</p>
                </div>
            </div>
        }>
            <ProviderPortalContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 3: MAIN CONTENT COMPONENT
// ============================================================================

function ProviderPortalContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // ========================================================================
    // SECTION 4: STATE
    // ========================================================================

    const [activeView, setActiveView] = useState<'welcome' | 'token' | 'register' | 'session-login'>('welcome')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Token input & validation
    const [inviteToken, setInviteToken] = useState('')
    const [tokenData, setTokenData] = useState<TokenData | null>(null)

    // Registration form (session-scoped)
    const [registerPassword, setRegisterPassword] = useState('')
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
    const [registerFirstName, setRegisterFirstName] = useState('')
    const [registerLastName, setRegisterLastName] = useState('')
    const [registerCompany, setRegisterCompany] = useState('')

    // Session login form
    const [loginSessionNumber, setLoginSessionNumber] = useState('')
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')

    // ========================================================================
    // SECTION 5: URL PARAMETER HANDLING
    // ========================================================================

    useEffect(() => {
        // Check for token in URL (from email link)
        const urlToken = searchParams.get('token')
        const urlSessionId = searchParams.get('session_id')

        if (urlToken) {
            setInviteToken(urlToken)
            // Auto-validate if we have both
            if (urlSessionId) {
                validateTokenFromUrl(urlSessionId, urlToken)
            } else {
                setActiveView('token')
            }
        }
    }, [searchParams])

    async function validateTokenFromUrl(sessionId: string, token: string) {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(
                `${API_BASE}/validate-provider-invite?session_id=${sessionId}&token=${token}`
            )
            const data: TokenData = await response.json()

            if (data.valid) {
                setTokenData(data)
                setActiveView('register')
            } else {
                setError(data.message || 'Invalid or expired invitation')
                setActiveView('token')
            }
        } catch (err) {
            console.error('Token validation error:', err)
            setError('Failed to validate invitation. Please try entering your token manually.')
            setActiveView('token')
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 6: TOKEN VALIDATION
    // ========================================================================

    async function handleValidateToken(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (!inviteToken.trim()) {
            setError('Please enter your invitation token')
            return
        }

        setLoading(true)

        try {
            let token = inviteToken.trim()
            let sessionId = ''

            // Check if user pasted a full URL
            if (token.includes('session_id=') || token.includes('token=')) {
                try {
                    const url = new URL(token.includes('http') ? token : `https://example.com?${token}`)
                    sessionId = url.searchParams.get('session_id') || ''
                    token = url.searchParams.get('token') || token
                } catch {
                    // Not a valid URL, treat as raw token
                }
            }

            const validateUrl = sessionId
                ? `${API_BASE}/validate-provider-invite?session_id=${sessionId}&token=${token}`
                : `${API_BASE}/validate-provider-invite?token=${token}`

            const response = await fetch(validateUrl)
            const data: TokenData = await response.json()

            if (data.valid) {
                setTokenData(data)
                setInviteToken(token) // Store clean token
                setActiveView('register')
            } else {
                setError(data.message || 'Invalid or expired invitation token.')
            }
        } catch (err) {
            console.error('Token validation error:', err)
            setError('Failed to validate token. Please check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 7: REGISTRATION HANDLER (SESSION-SCOPED)
    // ========================================================================

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        // Validation
        if (!registerFirstName || !registerLastName || !registerCompany) {
            setError('Please fill in all fields')
            return
        }
        if (registerPassword.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }
        if (registerPassword !== registerConfirmPassword) {
            setError('Passwords do not match')
            return
        }
        if (!tokenData) {
            setError('Session data missing. Please re-enter your token.')
            setActiveView('token')
            return
        }

        // Get email from token data (API might use different field names)
        const providerEmail = tokenData.providerEmail || tokenData.provider_contact_email || ''

        if (!providerEmail) {
            setError('Provider email not found. Please re-enter your token.')
            setActiveView('token')
            return
        }

        setLoading(true)

        try {
            // Create auth account
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: providerEmail,
                password: registerPassword,
                options: {
                    data: {
                        first_name: registerFirstName,
                        last_name: registerLastName,
                        company_name: registerCompany,
                        user_type: 'provider'
                    }
                }
            })

            if (signUpError) {
                // Check if user already exists
                if (signUpError.message.includes('already registered')) {
                    setError('An account with this email already exists. Please use "Return to Session" to sign in.')
                    return
                }
                throw signUpError
            }

            if (data.user) {
                // Store provider session info
                const providerAuth = {
                    sessionId: tokenData.sessionId,
                    sessionNumber: tokenData.sessionNumber,
                    email: providerEmail,
                    firstName: registerFirstName,
                    lastName: registerLastName,
                    company: registerCompany,
                    role: 'provider',
                    token: inviteToken,
                    registeredAt: new Date().toISOString()
                }
                localStorage.setItem('clarence_provider_session', JSON.stringify(providerAuth))

                // Navigate to welcome page
                router.push(`/provider/welcome?session_id=${tokenData.sessionId}`)
            }
        } catch (err: unknown) {
            console.error('Registration error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to register. Please try again.'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 8: SESSION LOGIN HANDLER
    // ========================================================================

    async function handleSessionLogin(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (!loginSessionNumber || !loginEmail || !loginPassword) {
            setError('Please fill in all fields')
            return
        }

        setLoading(true)

        try {
            // First, authenticate
            const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword
            })

            if (signInError) throw signInError

            if (authData.user) {
                // Validate session access
                const sessionNum = loginSessionNumber.toUpperCase().replace('SES-', '')
                const response = await fetch(
                    `${API_BASE}/validate-provider-session-access?session_number=${sessionNum}&email=${loginEmail}`
                )
                const accessData: SessionAccessResult = await response.json()

                if (!accessData.valid) {
                    // Sign out since they don't have access
                    await supabase.auth.signOut()
                    setError(accessData.message || 'You do not have access to this session.')
                    return
                }

                // Check session status
                if (accessData.sessionStatus === 'completed' || accessData.sessionStatus === 'cancelled') {
                    await supabase.auth.signOut()
                    setError('This opportunity has concluded. Thank you for your participation.')
                    return
                }

                if (accessData.bidStatus === 'rejected') {
                    await supabase.auth.signOut()
                    setError('Your bid was not selected for this opportunity. Thank you for your interest.')
                    return
                }

                // Store session info
                const providerAuth = {
                    sessionId: accessData.sessionId,
                    sessionNumber: sessionNum,
                    email: loginEmail,
                    role: 'provider',
                    intakeComplete: accessData.intakeComplete,
                    questionnaireComplete: accessData.questionnaireComplete,
                    loggedInAt: new Date().toISOString()
                }
                localStorage.setItem('clarence_provider_session', JSON.stringify(providerAuth))

                // Route based on progress
                if (!accessData.intakeComplete) {
                    router.push(`/provider/intake?session_id=${accessData.sessionId}`)
                } else if (!accessData.questionnaireComplete) {
                    router.push(`/provider/questionnaire?session_id=${accessData.sessionId}`)
                } else {
                    router.push(`/auth/contract-studio?session_id=${accessData.sessionId}`)
                }
            }
        } catch (err: unknown) {
            console.error('Login error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to sign in. Please check your credentials.'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 9: RENDER - WELCOME VIEW
    // ========================================================================

    if (activeView === 'welcome') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-lg">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-block">
                            <div className="text-4xl font-light text-white mb-2 tracking-wide">CLARENCE</div>
                            <div className="text-xs text-blue-400 tracking-[0.3em] font-light">PROVIDER ACCESS</div>
                        </div>
                        <p className="text-slate-400 mt-6 text-sm max-w-sm mx-auto">
                            Access contract opportunities you&apos;ve been invited to participate in
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8">
                        <div className="space-y-4">
                            {/* Option 1: I Have an Invitation */}
                            <button
                                onClick={() => setActiveView('token')}
                                className="w-full p-5 bg-gradient-to-r from-blue-600/20 to-blue-500/10 border border-blue-500/30 rounded-xl hover:border-blue-400/50 hover:from-blue-600/30 hover:to-blue-500/20 transition-all text-left group cursor-pointer"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/30 transition">
                                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white mb-1">I Have an Invitation</h3>
                                        <p className="text-sm text-slate-400">
                                            Enter your invitation token to register for a new opportunity
                                        </p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition ml-auto mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>

                            {/* Option 2: Return to Session */}
                            <button
                                onClick={() => setActiveView('session-login')}
                                className="w-full p-5 bg-slate-700/30 border border-slate-600/50 rounded-xl hover:border-slate-500/50 hover:bg-slate-700/50 transition-all text-left group cursor-pointer"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-slate-600/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600/50 transition">
                                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white mb-1">Return to Session</h3>
                                        <p className="text-sm text-slate-400">
                                            Sign in to continue with an existing opportunity
                                        </p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition ml-auto mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="my-6 border-t border-slate-700/50"></div>

                        {/* Info Box */}
                        <div className="p-4 bg-slate-700/20 rounded-xl border border-slate-600/30">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-white mb-1">What is CLARENCE?</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        CLARENCE is an AI-powered contract mediation platform. You&apos;ve been invited
                                        by a customer to participate in a fair, transparent negotiation process where
                                        both parties work toward mutually beneficial agreements.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Customer Link */}
                    <div className="text-center mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                        <p className="text-sm text-slate-500 mb-2">Are you a customer looking to create contracts?</p>
                        <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium text-sm inline-flex items-center gap-1">
                            Go to Customer Portal
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </Link>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6 text-xs text-slate-500">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 10: RENDER - TOKEN INPUT VIEW
    // ========================================================================

    if (activeView === 'token') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-block">
                            <div className="text-4xl font-light text-white mb-2 tracking-wide">CLARENCE</div>
                            <div className="text-xs text-blue-400 tracking-[0.3em] font-light">PROVIDER ACCESS</div>
                        </div>
                        <p className="text-slate-400 mt-4 text-sm">
                            Enter your invitation token to get started
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8">
                        {/* Back Button */}
                        <button
                            onClick={() => {
                                setActiveView('welcome')
                                setError(null)
                            }}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 cursor-pointer transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleValidateToken} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Invitation Token
                                </label>
                                <input
                                    type="text"
                                    value={inviteToken}
                                    onChange={(e) => setInviteToken(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm font-mono placeholder-slate-500"
                                    placeholder="INV-XXXXXXXX-XXXXXX"
                                    disabled={loading}
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Find this in your invitation email, or paste the full link
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !inviteToken.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Validate Token
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Help */}
                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                            <p className="text-sm text-slate-400 mb-2">Don&apos;t have a token?</p>
                            <p className="text-xs text-slate-500">
                                Tokens are sent by customers who want to negotiate with you.
                                Contact the customer directly if you believe you should have received one.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6 text-xs text-slate-500">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 11: RENDER - REGISTRATION VIEW (SESSION-SCOPED)
    // ========================================================================

    if (activeView === 'register' && tokenData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-block">
                            <div className="text-4xl font-light text-white mb-2 tracking-wide">CLARENCE</div>
                            <div className="text-xs text-blue-400 tracking-[0.3em] font-light">PROVIDER ACCESS</div>
                        </div>
                    </div>

                    {/* Opportunity Banner */}
                    <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 border border-blue-500/30 rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">Invitation Validated</div>
                                <div className="text-xs text-slate-300 mt-1">
                                    {tokenData.customerCompany} • {tokenData.serviceRequired}
                                </div>
                                {tokenData.dealValue && (
                                    <div className="text-xs text-emerald-400 mt-0.5">
                                        Contract Value: £{Number(tokenData.dealValue).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
                        {/* Back Button */}
                        <button
                            onClick={() => {
                                setActiveView('token')
                                setError(null)
                            }}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 cursor-pointer transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>

                        <h2 className="text-lg font-medium text-white mb-1">Register for this Opportunity</h2>
                        <p className="text-sm text-slate-400 mb-6">Create your credentials to participate in this negotiation</p>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-4">
                            {/* Email (Read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                                <div className="w-full px-4 py-2.5 bg-slate-700/30 border border-slate-600/30 rounded-lg text-slate-400 text-sm">
                                    {tokenData.providerEmail || tokenData.provider_contact_email}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">This is the email the invitation was sent to</p>
                            </div>

                            {/* Name Fields */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={registerFirstName}
                                        onChange={(e) => setRegisterFirstName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                        placeholder="John"
                                        disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={registerLastName}
                                        onChange={(e) => setRegisterLastName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                        placeholder="Doe"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Company */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Company Name</label>
                                <input
                                    type="text"
                                    value={registerCompany}
                                    onChange={(e) => setRegisterCompany(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                    placeholder="Your Company Ltd"
                                    disabled={loading}
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Create Password</label>
                                <input
                                    type="password"
                                    value={registerPassword}
                                    onChange={(e) => setRegisterPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                                <p className="text-xs text-slate-500 mt-1">Minimum 6 characters. Use this to return to your session.</p>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={registerConfirmPassword}
                                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer mt-6"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Registering...
                                    </>
                                ) : (
                                    <>
                                        Continue to Welcome
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6 text-xs text-slate-500">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 12: RENDER - SESSION LOGIN VIEW
    // ========================================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-block">
                        <div className="text-4xl font-light text-white mb-2 tracking-wide">CLARENCE</div>
                        <div className="text-xs text-blue-400 tracking-[0.3em] font-light">PROVIDER ACCESS</div>
                    </div>
                    <p className="text-slate-400 mt-4 text-sm">
                        Sign in to return to your session
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8">
                    {/* Back Button */}
                    <button
                        onClick={() => {
                            setActiveView('welcome')
                            setError(null)
                        }}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 cursor-pointer transition"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSessionLogin} className="space-y-4">
                        {/* Session Number */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Session Number</label>
                            <input
                                type="text"
                                value={loginSessionNumber}
                                onChange={(e) => setLoginSessionNumber(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm font-mono placeholder-slate-500"
                                placeholder="SES-001 or 001"
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500 mt-1">From your invitation email or registration confirmation</p>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                            <input
                                type="email"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                placeholder="you@company.com"
                                disabled={loading}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                            <input
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm placeholder-slate-500"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Access Session
                                </>
                            )}
                        </button>
                    </form>

                    {/* Help */}
                    <div className="mt-6 pt-6 border-t border-slate-700/50">
                        <p className="text-sm text-slate-400 mb-2">First time here?</p>
                        <button
                            onClick={() => setActiveView('token')}
                            className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer"
                        >
                            Enter your invitation token instead →
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-xs text-slate-500">
                    © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                </div>
            </div>
        </div>
    )
}