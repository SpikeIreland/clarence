'use client'
import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: LOADING COMPONENT
// ============================================================================

function LoginLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 2: MAIN LOGIN/SIGNUP COMPONENT
// ============================================================================

function LoginSignupContent() {
  const router = useRouter()
  const supabase = createClient()

  // ==========================================================================
  // SECTION 3: STATE
  // ==========================================================================

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup form
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [signupFirstName, setSignupFirstName] = useState('')
  const [signupLastName, setSignupLastName] = useState('')
  const [signupCompany, setSignupCompany] = useState('')
  const signupRole = 'customer' // Customers only - providers have separate portal

  // ==========================================================================
  // SECTION 4: VALIDATION
  // ==========================================================================

  function validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  function validateLoginForm(): string | null {
    if (!loginEmail || !loginPassword) {
      return 'Please fill in all fields'
    }
    if (!validateEmail(loginEmail)) {
      return 'Please enter a valid email address'
    }
    if (loginPassword.length < 6) {
      return 'Password must be at least 6 characters'
    }
    return null
  }

  function validateSignupForm(): string | null {
    if (!signupEmail || !signupPassword || !signupConfirmPassword || !signupFirstName || !signupLastName || !signupCompany) {
      return 'Please fill in all fields'
    }
    if (!validateEmail(signupEmail)) {
      return 'Please enter a valid email address'
    }
    if (signupPassword.length < 6) {
      return 'Password must be at least 6 characters'
    }
    if (signupPassword !== signupConfirmPassword) {
      return 'Passwords do not match'
    }
    if (signupFirstName.length < 2) {
      return 'First name must be at least 2 characters'
    }
    if (signupLastName.length < 2) {
      return 'Last name must be at least 2 characters'
    }
    if (signupCompany.length < 2) {
      return 'Company name must be at least 2 characters'
    }
    return null
  }

  // ==========================================================================
  // SECTION 5: LOGIN HANDLER
  // ==========================================================================

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validate
    const validationError = validateLoginForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      // Sign in with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      })

      if (signInError) throw signInError

      if (data.user) {
        // Get user profile from public.users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', data.user.id)
          .single()

        if (userError) throw userError

        // Store user info in localStorage for legacy compatibility
        const authData = {
          userInfo: {
            userId: userData.auth_id,
            email: userData.email,
            firstName: userData.first_name,
            lastName: userData.last_name,
            company: userData.company_name,
            role: userData.role
          },
          timestamp: new Date().toISOString()
        }
        localStorage.setItem('clarence_auth', JSON.stringify(authData))

        // Check role and redirect accordingly
        if (userData.role === 'provider') {
          // Provider logged in via customer portal - redirect to provider dashboard
          localStorage.setItem('clarence_provider_session', JSON.stringify({
            providerId: userData.auth_id,
            email: userData.email,
            role: 'provider'
          }))
          setSuccess('Redirecting to Provider Portal...')
          router.push('/provider/dashboard')
        } else {
          // Customer - redirect to customer dashboard
          router.push('/auth/contracts-dashboard')
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

  // ==========================================================================
  // SECTION 6: SIGNUP HANDLER
  // ==========================================================================

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validate
    const validationError = validateSignupForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: 'https://www.clarencelegal.ai/auth/callback',
          data: {
            first_name: signupFirstName,
            last_name: signupLastName,
            company_name: signupCompany,
            role: signupRole
          }
        }
      })

      if (signUpError) throw signUpError

      if (data.user) {
        // Check if user already exists (identities array is empty)
        if (data.user.identities && data.user.identities.length === 0) {
          setError('An account with this email already exists. Please sign in instead.')
          setActiveTab('login')
          setLoginEmail(signupEmail) // Pre-fill login email
          setLoading(false)
          return
        }

        // Check if email is confirmed (session exists only if confirmed or confirmation disabled)
        const emailConfirmed = data.user.email_confirmed_at !== null

        if (emailConfirmed && data.session) {
          // Email already confirmed (confirmation disabled in Supabase)
          setSuccess('Account created successfully! Redirecting...')

          const authData = {
            userInfo: {
              userId: data.user.id,
              email: signupEmail,
              firstName: signupFirstName,
              lastName: signupLastName,
              company: signupCompany,
              role: signupRole
            },
            timestamp: new Date().toISOString()
          }
          localStorage.setItem('clarence_auth', JSON.stringify(authData))

          setTimeout(() => {
            router.push('/auth/contracts-dashboard')
          }, 1500)
        } else {
          // Email confirmation required - show confirmation message
          setShowEmailConfirmation(true)
        }
      }
    } catch (err: unknown) {
      console.error('Signup error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account. Please try again.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================================
  // SECTION 7: RENDER
  // ==========================================================================

  // ==========================================================================
  // SECTION 7: RENDER
  // ==========================================================================

  // Show email confirmation screen after signup
  if (showEmailConfirmation) {
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

        {/* Email Confirmation Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              {/* Success Header */}
              <div className="bg-emerald-50 p-8 text-center border-b border-emerald-100">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Check Your Email</h2>
                <p className="text-slate-600 text-sm">We&apos;ve sent a confirmation link to:</p>
                <p className="text-emerald-700 font-medium mt-1">{signupEmail}</p>
              </div>

              {/* Instructions */}
              <div className="p-6">
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-slate-700 mb-3 text-sm">Next Steps:</h3>
                  <ol className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                      <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                      <span>Open the email from CLARENCE</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                      <span>Click &quot;Confirm Email Address&quot;</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                      <span>Return here to sign in</span>
                    </li>
                  </ol>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-700">
                  <strong>Didn&apos;t receive the email?</strong><br />
                  Check your spam folder. Emails can take up to 5 minutes to arrive.
                </div>

                <button
                  onClick={() => {
                    setShowEmailConfirmation(false)
                    setActiveTab('login')
                    setLoginEmail(signupEmail)
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition"
                >
                  Go to Sign In
                </button>

                <button
                  onClick={() => setShowEmailConfirmation(false)}
                  className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Use a different email
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-6">
          <div className="container mx-auto px-6 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.</p>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ================================================================== */}
      {/* SECTION 8: NAVIGATION HEADER */}
      {/* ================================================================== */}
      <header className="bg-slate-800 text-white">
        <div className="container mx-auto px-6">
          <nav className="flex justify-between items-center h-16">
            {/* Logo & Brand */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                <div className="text-xs text-slate-400">The Honest Broker</div>
              </div>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center gap-6">
              <Link
                href="/how-it-works"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/phases"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                The 6 Phases
              </Link>

              {/* Sign In Buttons */}
              <div className="flex items-center gap-3 ml-2">
                <span className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg">
                  Customer Sign In
                </span>
                <a
                  href="https://www.clarencelegal.ai/provider"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Provider Sign In
                </a>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* ================================================================== */}
      {/* SECTION 9: MAIN CONTENT */}
      {/* ================================================================== */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {activeTab === 'login' ? 'Welcome Back' : 'Create Your Account'}
            </h1>
            <p className="text-slate-600 text-sm">
              {activeTab === 'login'
                ? 'Sign in to your customer account to continue'
                : 'Get started with CLARENCE contract mediation'
              }
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => {
                  setActiveTab('login')
                  setError(null)
                  setSuccess(null)
                }}
                className={`flex-1 py-4 text-sm font-medium transition ${activeTab === 'login'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setActiveTab('signup')
                  setError(null)
                  setSuccess(null)
                }}
                className={`flex-1 py-4 text-sm font-medium transition ${activeTab === 'signup'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
              >
                Create Account
              </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mx-6 mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            {success && (
              <div className="mx-6 mt-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 10: LOGIN FORM */}
            {/* ============================================================ */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
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
                  Forgot password?{' '}
                  <button type="button" className="text-blue-600 hover:underline">
                    Reset it
                  </button>
                </div>
              </form>
            )}

            {/* ============================================================ */}
            {/* SECTION 11: SIGNUP FORM */}
            {/* ============================================================ */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignup} className="p-6 space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={signupFirstName}
                      onChange={(e) => setSignupFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                      value={signupLastName}
                      onChange={(e) => setSignupLastName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Smith"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={signupCompany}
                    onChange={(e) => setSignupCompany(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Acme Corporation"
                    disabled={loading}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="you@company.com"
                    disabled={loading}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
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
                  By signing up, you agree to our{' '}
                  <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                </p>
              </form>
            )}
          </div>

          {/* Provider Portal Link */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
            <p className="text-sm text-slate-700">
              Are you a service provider?{' '}
              <a
                href="https://www.clarencelegal.ai/provider"
                className="text-blue-600 font-medium hover:underline"
              >
                Access the Provider Portal →
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* ================================================================== */}
      {/* SECTION 12: FOOTER */}
      {/* ================================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-white font-medium">CLARENCE</span>
            </div>

            {/* Links */}
            <div className="flex gap-8 text-sm">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-6 pt-6 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ============================================================================
// SECTION 13: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginSignupContent />
    </Suspense>
  )
}