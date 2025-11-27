'use client'
import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: LOADING COMPONENT
// ============================================================================

function LoginLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
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

  // ========================================================================
  // SECTION 3: STATE
  // ========================================================================

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  // ========================================================================
  // SECTION 4: VALIDATION
  // ========================================================================

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

  // ========================================================================
  // SECTION 5: LOGIN HANDLER
  // ========================================================================

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

        // Redirect to dashboard
        router.push('/auth/contracts-dashboard')
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
  // SECTION 6: SIGNUP HANDLER
  // ========================================================================

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
        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          setSuccess('Please check your email to confirm your account before logging in.')
          setActiveTab('login')
        } else {
          setSuccess('Account created successfully! Redirecting...')

          // Store user info in localStorage
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

          // Redirect to dashboard after short delay
          setTimeout(() => {
            router.push('/auth/contracts-dashboard')
          }, 1500)
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

  // ========================================================================
  // SECTION 7: RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <div className="text-4xl font-medium text-slate-800 mb-2">CLARENCE</div>
            <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
          </div>
          <p className="text-slate-600 mt-4 text-sm">
            {activeTab === 'login'
              ? 'Sign in to your customer account'
              : 'Create your customer account to get started'
            }
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
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
              Login
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
              Sign Up
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mx-6 mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mt-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Login Form */}
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
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
                <button type="button" className="text-emerald-600 hover:underline">
                  Reset it
                </button>
              </div>
            </form>
          )}

          {/* Signup Form */}
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    placeholder="Doe"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
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

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-500">
          © {new Date().getFullYear()} CLARENCE by Spike Island Studios
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 8: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginSignupContent />
    </Suspense>
  )
}