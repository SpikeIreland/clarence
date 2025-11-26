'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function ProviderPortal() {
    const router = useRouter()
    const supabase = createClient()

    // ========================================================================
    // SECTION 3: STATE
    // ========================================================================

    const [activeView, setActiveView] = useState<'welcome' | 'token' | 'login' | 'register'>('welcome')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Token input
    const [inviteToken, setInviteToken] = useState('')
    const [tokenData, setTokenData] = useState<{
        sessionId: string
        sessionNumber: string
        customerCompany: string
        serviceRequired: string
        dealValue: string
        providerEmail: string
    } | null>(null)

    // Login form
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')

    // Register form
    const [registerEmail, setRegisterEmail] = useState('')
    const [registerPassword, setRegisterPassword] = useState('')
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
    const [registerFirstName, setRegisterFirstName] = useState('')
    const [registerLastName, setRegisterLastName] = useState('')
    const [registerCompany, setRegisterCompany] = useState('')

    // ========================================================================
    // SECTION 4: TOKEN VALIDATION
    // ========================================================================

    async function handleValidateToken(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (!inviteToken.trim()) {
            setError('Please enter your invitation token')
            return
        }

        setLoading(true)

        try {
            // Extract session_id from token if it's a full URL
            let token = inviteToken.trim()
            let sessionId = ''

            // Check if user pasted a full URL
            if (token.includes('session_id=')) {
                const url = new URL(token.includes('http') ? token : `https://example.com?${token}`)
                sessionId = url.searchParams.get('session_id') || ''
                token = url.searchParams.get('token') || token
            }

            // If we don't have a session_id, we need to look it up by token
            const validateUrl = sessionId
                ? `${API_BASE}/validate-provider-invite?session_id=${sessionId}&token=${token}`
                : `${API_BASE}/validate-provider-invite?token=${token}`

            const response = await fetch(validateUrl)
            const data = await response.json()

            if (data.valid) {
                setTokenData({
                    sessionId: data.sessionId,
                    sessionNumber: data.sessionNumber || '',
                    customerCompany: data.customerCompany || 'Customer',
                    serviceRequired: data.serviceRequired || 'Service Agreement',
                    dealValue: data.dealValue || '',
                    providerEmail: data.providerEmail || ''
                })

                // Pre-fill email if available
                if (data.providerEmail) {
                    setRegisterEmail(data.providerEmail)
                    setLoginEmail(data.providerEmail)
                }

                setSuccess('Token validated! Please sign in or create an account to continue.')
                setActiveView('login')
            } else {
                setError(data.message || 'Invalid or expired invitation token. Please check and try again.')
            }
        } catch (err) {
            console.error('Token validation error:', err)
            setError('Failed to validate token. Please check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 5: LOGIN HANDLER
    // ========================================================================

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (!loginEmail || !loginPassword) {
            setError('Please enter your email and password')
            return
        }

        setLoading(true)

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword
            })

            if (signInError) throw signInError

            if (data.user) {
                // Get user profile
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_id', data.user.id)
                    .single()

                if (userError && userError.code !== 'PGRST116') {
                    throw userError
                }

                // Store user info
                const authData = {
                    userInfo: {
                        userId: data.user.id,
                        email: loginEmail,
                        firstName: userData?.first_name || '',
                        lastName: userData?.last_name || '',
                        company: userData?.company_name || '',
                        role: 'provider'
                    },
                    timestamp: new Date().toISOString()
                }
                localStorage.setItem('clarence_auth', JSON.stringify(authData))

                // Redirect based on whether we have a pending token
                if (tokenData?.sessionId) {
                    router.push(`/auth/provider-intake?session_id=${tokenData.sessionId}&token=${inviteToken}`)
                } else {
                    router.push('/provider/dashboard')
                }
            }
        } catch (err: unknown) {
            console.error('Login error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to login. Please check your credentials.'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 6: REGISTER HANDLER
    // ========================================================================

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        // Validation
        if (!registerEmail || !registerPassword || !registerFirstName || !registerLastName || !registerCompany) {
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

        setLoading(true)

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: registerEmail,
                password: registerPassword,
                options: {
                    data: {
                        first_name: registerFirstName,
                        last_name: registerLastName,
                        company_name: registerCompany,
                        role: 'provider'
                    }
                }
            })

            if (signUpError) throw signUpError

            if (data.user) {
                // Store user info
                const authData = {
                    userInfo: {
                        userId: data.user.id,
                        email: registerEmail,
                        firstName: registerFirstName,
                        lastName: registerLastName,
                        company: registerCompany,
                        role: 'provider'
                    },
                    timestamp: new Date().toISOString()
                }
                localStorage.setItem('clarence_auth', JSON.stringify(authData))

                // Check if email confirmation required
                if (data.user.identities && data.user.identities.length === 0) {
                    setSuccess('Please check your email to confirm your account.')
                    setActiveView('login')
                } else {
                    // Redirect to intake or dashboard
                    if (tokenData?.sessionId) {
                        router.push(`/auth/provider-intake?session_id=${tokenData.sessionId}&token=${inviteToken}`)
                    } else {
                        router.push('/provider/dashboard')
                    }
                }
            }
        } catch (err: unknown) {
            console.error('Register error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to create account.'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 7: RENDER - WELCOME VIEW
    // ========================================================================

    if (activeView === 'welcome') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-lg">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-block">
                            <div className="text-4xl font-medium text-slate-800 mb-2">CLARENCE</div>
                            <div className="text-xs text-slate-500 tracking-widest font-light">PROVIDER PORTAL</div>
                        </div>
                        <p className="text-slate-600 mt-4 text-sm">
                            Access contract negotiations you&apos;ve been invited to participate in
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="space-y-4">
                            {/* Option 1: Enter Token */}
                            <button
                                onClick={() => setActiveView('token')}
                                className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition text-left group cursor-pointer"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 mb-1">I Have an Invitation</h3>
                                        <p className="text-sm text-slate-500">
                                            Enter your invitation token from the email you received
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {/* Option 2: Sign In */}
                            <button
                                onClick={() => setActiveView('login')}
                                className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition text-left group cursor-pointer"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition">
                                        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800 mb-1">Sign In to Existing Account</h3>
                                        <p className="text-sm text-slate-500">
                                            Access your provider dashboard and ongoing negotiations
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* Info Box */}
                        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">What is CLARENCE?</h4>
                            <p className="text-xs text-blue-700">
                                CLARENCE is an AI-powered contract mediation platform. Customers invite providers
                                like you to negotiate contracts through a fair, transparent process where both
                                parties work toward mutually beneficial agreements.
                            </p>
                        </div>
                    </div>

                    {/* Customer Link */}
                    <div className="text-center mt-6">
                        <p className="text-sm text-slate-500 mb-2">Are you a customer looking to create contracts?</p>
                        <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                            Go to Customer Portal →
                        </Link>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6 text-sm text-slate-400">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: RENDER - TOKEN INPUT VIEW
    // ========================================================================

    if (activeView === 'token') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-block">
                            <div className="text-4xl font-medium text-slate-800 mb-2">CLARENCE</div>
                            <div className="text-xs text-slate-500 tracking-widest font-light">PROVIDER PORTAL</div>
                        </div>
                        <p className="text-slate-600 mt-4 text-sm">
                            Enter your invitation token to access the contract
                        </p>
                    </div>

                    {/* Main Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        {/* Back Button */}
                        <button
                            onClick={() => {
                                setActiveView('welcome')
                                setError(null)
                                setSuccess(null)
                            }}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-6 cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>

                        {/* Error/Success Messages */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleValidateToken} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Invitation Token
                                </label>
                                <input
                                    type="text"
                                    value={inviteToken}
                                    onChange={(e) => setInviteToken(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                                    placeholder="INV-XXXXXXXX-XXXXXX"
                                    disabled={loading}
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    You can find this token in your invitation email, or paste the full invitation link
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !inviteToken.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

                        {/* Help Text */}
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <p className="text-sm text-slate-600 mb-2">Don&apos;t have a token?</p>
                            <p className="text-xs text-slate-500">
                                Invitation tokens are sent by customers who want to negotiate a contract with you.
                                If you believe you should have received an invitation, please contact the customer directly.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6 text-sm text-slate-400">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 9: RENDER - LOGIN/REGISTER VIEW
    // ========================================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-block">
                        <div className="text-4xl font-medium text-slate-800 mb-2">CLARENCE</div>
                        <div className="text-xs text-slate-500 tracking-widest font-light">PROVIDER PORTAL</div>
                    </div>
                    <p className="text-slate-600 mt-4 text-sm">
                        {activeView === 'login' ? 'Sign in to your provider account' : 'Create your provider account'}
                    </p>
                </div>

                {/* Token Info Banner (if token validated) */}
                {tokenData && (
                    <div className="bg-blue-600 text-white rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Invitation Validated</div>
                                <div className="text-xs text-blue-100 mt-1">
                                    {tokenData.customerCompany} • {tokenData.serviceRequired}
                                    {tokenData.dealValue && ` • £${Number(tokenData.dealValue).toLocaleString()}`}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Back Button */}
                    <div className="px-6 pt-6">
                        <button
                            onClick={() => {
                                setActiveView(tokenData ? 'token' : 'welcome')
                                setError(null)
                                setSuccess(null)
                            }}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 mt-4">
                        <button
                            onClick={() => {
                                setActiveView('login')
                                setError(null)
                            }}
                            className={`flex-1 py-4 text-sm font-medium transition cursor-pointer ${activeView === 'login'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => {
                                setActiveView('register')
                                setError(null)
                            }}
                            className={`flex-1 py-4 text-sm font-medium transition cursor-pointer ${activeView === 'register'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                            {success}
                        </div>
                    )}

                    {/* Login Form */}
                    {activeView === 'login' && (
                        <form onSubmit={handleLogin} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="you@company.com"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            <div className="text-center text-sm text-slate-500">
                                <button type="button" className="text-blue-600 hover:underline cursor-pointer">
                                    Forgot password?
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Register Form */}
                    {activeView === 'register' && (
                        <form onSubmit={handleRegister} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        value={registerFirstName}
                                        onChange={(e) => setRegisterFirstName(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        placeholder="John"
                                        disabled={loading}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        value={registerLastName}
                                        onChange={(e) => setRegisterLastName(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        placeholder="Doe"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={registerCompany}
                                    onChange={(e) => setRegisterCompany(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="Your Company Ltd"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={registerEmail}
                                    onChange={(e) => setRegisterEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="you@company.com"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={registerPassword}
                                    onChange={(e) => setRegisterPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                                <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={registerConfirmPassword}
                                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>

                            <p className="text-xs text-slate-500 text-center">
                                By signing up, you agree to our Terms of Service and Privacy Policy
                            </p>
                        </form>
                    )}
                </div>

                {/* Customer Link */}
                <div className="text-center mt-6">
                    <p className="text-sm text-slate-500 mb-2">Are you a customer looking to create contracts?</p>
                    <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                        Go to Customer Portal →
                    </Link>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-sm text-slate-400">
                    © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                </div>
            </div>
        </div>
    )
}