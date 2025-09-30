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
    
    // For now, redirect to the chat page we created
    // Later you can create a dashboard page and redirect there
    router.push('/chat')
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-lg relative overflow-hidden">
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-purple-800"></div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">CLARENCE</h1>
          <div className="text-lg font-semibold text-purple-600 mb-2">AI-Powered Mediation Portal</div>
          <p className="text-gray-600">Sign in to access your negotiations</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 text-center font-medium ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-semibold text-sm">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base bg-gray-50 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
              placeholder="your.email@company.com"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block mb-2 text-gray-700 font-semibold text-sm">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base bg-gray-50 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
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
              className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="rememberMe" className="text-gray-700 text-sm">
              Keep me signed in
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-xl font-semibold text-base transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed relative"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
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
        <div className="text-center mt-6 pt-6 border-t border-gray-200">
          <p className="text-gray-600">
            Don&apos;t have an account?{' '}
            <a href="/auth/signup" className="text-purple-600 font-semibold hover:text-purple-800 hover:underline transition-colors">
              Create account
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
