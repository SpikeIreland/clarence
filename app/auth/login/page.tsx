'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// Location: app/auth/login/page.tsx
// ============================================================================

type UserRole = 'initiator' | 'respondent' | null

interface LoginFormData {
  email: string
  password: string
}

// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole>(null)
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // ========================================================================
  // SECTION 3: HANDLERS
  // ========================================================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedRole) {
      setError('Please select your role to continue')
      return
    }

    if (!formData.email || !formData.password) {
      setError('Please enter your email and password')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual authentication API call
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ...formData, role: selectedRole }),
      // })

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Store auth data (replace with actual implementation)
      localStorage.setItem('clarence_auth', JSON.stringify({
        userInfo: {
          email: formData.email,
          role: selectedRole,
          firstName: formData.email.split('@')[0] // Placeholder
        }
      }))

      // Redirect based on role
      if (selectedRole === 'initiator') {
        router.push('/auth/contracts-dashboard')
      } else {
        router.push('/auth/provider-dashboard')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Login failed. Please check your credentials and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ========================================================================
  // SECTION 4: RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
      {/* ================================================================== */}
      {/* SECTION 5: NAVIGATION */}
      {/* ================================================================== */}
      <nav className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Back to Home */}
            <Link
              href="/"
              className="text-slate-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>

            {/* Nav Links */}
            <div className="flex gap-6 items-center">
              <Link
                href="/how-it-works"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ================================================================== */}
      {/* SECTION 6: MAIN CONTENT */}
      {/* ================================================================== */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-md mx-auto">
          {/* ============================================================ */}
          {/* SECTION 7: BRANDING */}
          {/* ============================================================ */}
          <div className="text-center mb-8">
            {/* Logo */}
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome to CLARENCE</h1>
            <p className="text-slate-400 text-sm">The Honest Broker</p>
          </div>

          {/* ============================================================ */}
          {/* SECTION 8: LOGIN CARD */}
          {/* ============================================================ */}
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
            {/* Role Selection Header */}
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-4">Select Your Role</h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Contract Initiator */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('initiator')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${selectedRole === 'initiator'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${selectedRole === 'initiator' ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="font-medium text-white text-sm mb-1">Contract Initiator</div>
                  <div className="text-xs text-slate-400">Start & manage contracts</div>
                </button>

                {/* Contract Respondent */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('respondent')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${selectedRole === 'respondent'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${selectedRole === 'respondent' ? 'bg-blue-500' : 'bg-slate-600'
                    }`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="font-medium text-white text-sm mb-1">Contract Respondent</div>
                  <div className="text-xs text-slate-400">Respond to invitations</div>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 9: LOGIN FORM */}
            {/* ============================================================ */}
            <form onSubmit={handleSubmit} className="p-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Sign in to your account</h3>

              {/* Email Field */}
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm text-slate-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="you@company.com"
                />
              </div>

              {/* Password Field */}
              <div className="mb-6">
                <label htmlFor="password" className="block text-sm text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link href="/auth/forgot-password" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${selectedRole === 'initiator'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25'
                    : selectedRole === 'respondent'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-slate-600 hover:bg-slate-500 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    {selectedRole && (
                      <span className="text-sm opacity-75">
                        as {selectedRole === 'initiator' ? 'Initiator' : 'Respondent'}
                      </span>
                    )}
                  </>
                )}
              </button>
            </form>

            {/* ============================================================ */}
            {/* SECTION 10: FOOTER LINKS */}
            {/* ============================================================ */}
            <div className="px-6 pb-6">
              {/* Divider */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-px bg-slate-700"></div>
                <span className="text-xs text-slate-500">or</span>
                <div className="flex-1 h-px bg-slate-700"></div>
              </div>

              {/* Request Trial Link */}
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-2">Don't have an account?</p>
                <Link
                  href="/request-trial"
                  className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors"
                >
                  Request a Free Trial
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 11: HELP TEXT */}
          {/* ============================================================ */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              Need help? Contact{' '}
              <a href="mailto:support@clarencelegal.ai" className="text-slate-400 hover:text-white transition-colors">
                support@clarencelegal.ai
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 12: FOOTER */}
      {/* ================================================================== */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-slate-400 text-sm">CLARENCE - The Honest Broker</span>
            </div>

            {/* Links */}
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-slate-500 hover:text-slate-300 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-slate-500 hover:text-slate-300 transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}