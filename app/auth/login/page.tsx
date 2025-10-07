'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  userId?: string
  user_id?: string
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
  email?: string
  companyName?: string
  company_name?: string
  role?: string
}

interface ApiResponse {
  success: boolean
  message?: string
  sessionToken?: string
  user?: User
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null)

  // Configuration
  const API_BASE = 'https://spikeislandstudios.app.n8n.cloud'

  // API call helper
  async function apiCall(endpoint: string, method = 'GET', body: Record<string, unknown> | null = null, token: string | null = null): Promise<ApiResponse> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const config: RequestInit = {
      method,
      headers
    }

    if (body) {
      config.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config)
      const data = await response.json()
      return data
    } catch (error) {
      console.error('API Error:', error)
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.'
      }
    }
  }

  // Login function
  async function login(email: string, password: string, rememberMe: boolean = false) {
    const result = await apiCall('/webhook/auth-login', 'POST', {
      email,
      password,
      rememberMe
    })
    
    if (result.success) {
      localStorage.setItem('sessionToken', result.sessionToken || '')
      localStorage.setItem('user', JSON.stringify(result.user))
      
      if (rememberMe) {
        localStorage.setItem('rememberUser', email)
      }
    }
    
    return result
  }

  // Redirect based on role
  function redirectBasedOnRole(user: User) {
    const userData = {
      userId: user.userId || user.user_id,
      name: `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim(),
      firstName: user.firstName || user.first_name,
      lastName: user.lastName || user.last_name,
      email: user.email,
      company: user.companyName || user.company_name,
      role: user.role,
      sessionToken: localStorage.getItem('sessionToken') || 'temp-token'
    }
    
    localStorage.setItem('clarence_auth', JSON.stringify({
      userId: userData.userId,
      sessionToken: userData.sessionToken,
      userInfo: userData
    }))
    
    router.push('/auth/contracts-dashboard')
  }

  // Check existing session - using useCallback to fix the dependency warning
  const checkExistingSession = useCallback(async () => {
    const token = localStorage.getItem('sessionToken')
    if (token) {
      const result = await apiCall('/webhook/auth-validate', 'GET', null, token)
      if (result.success && result.user) {
        const userData = {
          userId: result.user.user_id,
          firstName: result.user.first_name,
          lastName: result.user.last_name,
          email: result.user.email,
          company: result.user.company_name,
          role: result.user.role,
          sessionToken: token
        }
        
        setMessage({ text: `Welcome back, ${userData.firstName}! Redirecting...`, type: 'success' })
        setTimeout(() => redirectBasedOnRole(userData), 1000)
      } else {
        localStorage.removeItem('sessionToken')
        localStorage.removeItem('user')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession()
    
    // Pre-fill remembered email
    const rememberedEmail = localStorage.getItem('rememberUser')
    if (rememberedEmail) {
      setEmail(rememberedEmail)
      setRememberMe(true)
    }
  }, [checkExistingSession])

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const result = await login(email, password, rememberMe)

    if (result.success && result.user) {
      setMessage({ 
        text: `Welcome back, ${result.user.firstName || result.user.first_name}! Redirecting...`, 
        type: 'success' 
      })
      setTimeout(() => redirectBasedOnRole(result.user!), 1500)
    } else {
      setMessage({ 
        text: result.message || 'Login failed. Please check your credentials.', 
        type: 'error' 
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center p-5">
      {/* Back to Home Link - Top Left */}
      <a 
        href="/" 
        className="absolute top-8 left-8 text-slate-400 hover:text-white text-sm font-medium transition-colors duration-300"
      >
        ← Back to Home
      </a>

      <div className="bg-slate-50 rounded-xl shadow-2xl p-10 w-full max-w-md relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-600 to-slate-700"></div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-medium text-slate-800 mb-2 tracking-wide">CLARENCE</h1>
          <p className="text-sm text-slate-500 font-light tracking-wider">The Honest Broker</p>
          <div className="mt-6">
            <h2 className="text-lg font-normal text-slate-700">Sign In</h2>
            <p className="text-sm text-slate-500 mt-1">Access your contract negotiations</p>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded-lg mb-6 text-center text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block mb-2 text-slate-600 font-medium text-sm">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all"
              placeholder="your.email@company.com"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-slate-600 font-medium text-sm">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all"
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="mb-6 flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mr-2 w-4 h-4 text-slate-600 rounded border-slate-300 focus:ring-slate-500"
            />
            <label htmlFor="rememberMe" className="text-slate-600 text-sm">
              Keep me signed in
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed relative"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Sign up link */}
        <div className="text-center mt-6 pt-6 border-t border-slate-200">
          <p className="text-slate-600 text-sm">
            Don&apos;t have an account?{' '}
            <a href="/auth/signup" className="text-slate-700 font-medium hover:text-slate-900 hover:underline transition-colors">
              Create account
            </a>
          </p>
        </div>

        {/* Footer link */}
        <div className="text-center mt-4">
          <a href="/forgot-password" className="text-slate-500 text-sm hover:text-slate-700 transition-colors">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  )
}