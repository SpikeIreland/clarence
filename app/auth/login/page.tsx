'use client'

// ============================================================================
// CUSTOMER LOGIN PAGE - BLUE THEME
// Location: app/auth/login/page.tsx
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  // ========================================================================
  // SECTION 3: STATE
  // ========================================================================

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  // ========================================================================
  // SECTION 4: LOGIN HANDLER
  // ========================================================================

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!email || !password) {
      setMessage({ text: 'Please enter both email and password', type: 'error' })
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw error
      }

      if (data.user) {
        // Check user type and route accordingly
        const userType = data.user.user_metadata?.user_type

        if (userType === 'provider') {
          setMessage({ text: 'This login is for customers. Please use the provider portal.', type: 'error' })
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        // Store auth data
        const authData = {
          userId: data.user.id,
          userInfo: {
            firstName: data.user.user_metadata?.first_name || '',
            lastName: data.user.user_metadata?.last_name || '',
            email: data.user.email,
            company: data.user.user_metadata?.company_name || '',
            role: 'customer',
          }
        }
        localStorage.setItem('clarence_auth', JSON.stringify(authData))

        setMessage({ text: '✓ Login successful! Redirecting...', type: 'success' })
        setTimeout(() => router.push('/auth/dashboard'), 1000)
      }

    } catch (error) {
      console.error('Login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Login failed'

      if (errorMessage.includes('Invalid login credentials')) {
        setMessage({ text: 'Invalid email or password. Please try again.', type: 'error' })
      } else if (errorMessage.includes('Email not confirmed')) {
        setMessage({ text: 'Please confirm your email before signing in. Check your inbox.', type: 'error' })
      } else {
        setMessage({ text: errorMessage, type: 'error' })
      }
      setLoading(false)
    }
  }

  // ========================================================================
  // SECTION 5: FORGOT PASSWORD HANDLER
  // ========================================================================

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (!email) {
      setMessage({ text: 'Please enter your email address', type: 'error' })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.clarencelegal.ai/auth/reset-password'
      })

      if (error) throw error

      setMessage({
        text: '✉️ Password reset email sent! Check your inbox.',
        type: 'success'
      })
      setShowForgotPassword(false)

    } catch (error) {
      console.error('Reset password error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email'
      setMessage({ text: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // ========================================================================
  // SECTION 6: RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-5">
      {/* Back to Home Link */}
      <Link
        href="/"
        className="absolute top-8 left-8 text-blue-300 hover:text-white text-sm font-medium transition-colors duration-300"
      >
        ← Back to Home
      </Link>

      <div className="bg-slate-50 rounded-xl shadow-2xl overflow-hidden w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white p-8 text-center">
          <h1 className="text-3xl font-medium mb-2 tracking-wide">CLARENCE</h1>
          <p className="text-sm text-blue-200 font-light tracking-wider mb-4">The Honest Broker</p>
          <p className="text-lg font-normal">
            {showForgotPassword ? 'Reset Password' : 'Welcome Back'}
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mx-6 mt-6 p-3 rounded-lg text-center text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <div className="p-8">
          {!showForgotPassword ? (
            // Login Form
            <form onSubmit={handleLogin}>
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex justify-end mb-6">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            // Forgot Password Form
            <form onSubmit={handleForgotPassword}>
              <p className="text-sm text-slate-600 mb-5">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed mb-4"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false)
                  setMessage(null)
                }}
                className="w-full py-2 text-slate-600 hover:text-slate-800 text-sm transition-colors"
              >
                ← Back to login
              </button>
            </form>
          )}

          {/* Sign Up Link */}
          {!showForgotPassword && (
            <p className="text-center mt-6 text-slate-600 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/auth/customer" className="text-blue-700 font-medium hover:text-blue-900 hover:underline">
                Create one here
              </Link>
            </p>
          )}

          {/* Provider Link */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-center text-xs text-slate-500">
              Are you a provider?{' '}
              <Link href="/provider" className="text-blue-600 hover:underline">
                Access provider portal
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}