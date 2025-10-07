'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Company {
  id: string
  name: string
  industry: string
}

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  companyName: string
  companyId: string
  jobTitle: string
  department: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

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

interface RegistrationResponse {
  userId?: string
  sessionToken?: string
  user?: User
}

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    companyId: '',
    jobTitle: '',
    department: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  })
  
  const [companies, setCompanies] = useState<Company[]>([])
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: 'Password strength will appear here', class: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null)

  const API_BASE = 'https://spikeislandstudios.app.n8n.cloud'

  // Load existing companies on mount
  useEffect(() => {
    loadExistingCompanies()
  }, [])

  async function loadExistingCompanies() {
    try {
      const response = await fetch(`${API_BASE}/webhook/companies-list`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setCompanies(data.map(c => ({
            id: c.company_id,
            name: c.company_name,
            industry: c.industry
          })))
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  function handleCompanySearch(value: string) {
    setFormData(prev => ({ ...prev, companyName: value, companyId: '' }))
    
    if (value.length < 2) {
      setShowCompanyDropdown(false)
      return
    }

    const matches = companies.filter(company =>
      company.name.toLowerCase().includes(value.toLowerCase())
    )

    setShowCompanyDropdown(matches.length > 0)
  }

  function selectCompany(company: Company) {
    setFormData(prev => ({
      ...prev,
      companyName: company.name,
      companyId: company.id
    }))
    setShowCompanyDropdown(false)
    setMessage({ text: `Selected existing company: ${company.name}`, type: 'info' })
  }

  function checkPasswordStrength(password: string) {
    if (!password) {
      setPasswordStrength({ score: 0, text: 'Password strength will appear here', class: '' })
      return
    }
    
    let score = 0
    const feedback = []
    
    if (password.length >= 8) score++
    else feedback.push('at least 8 characters')
    
    if (/[A-Z]/.test(password)) score++
    else feedback.push('uppercase letter')
    
    if (/[a-z]/.test(password)) score++
    else feedback.push('lowercase letter')
    
    if (/\d/.test(password)) score++
    else feedback.push('number')
    
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++
    else feedback.push('special character')
    
    if (score <= 2) {
      setPasswordStrength({ score, text: `Weak - Add: ${feedback.join(', ')}`, class: 'bg-red-500' })
    } else if (score === 3) {
      setPasswordStrength({ score, text: `Fair - Add: ${feedback.join(', ')}`, class: 'bg-yellow-500' })
    } else if (score === 4) {
      setPasswordStrength({ score, text: 'Good', class: 'bg-yellow-400' })
    } else {
      setPasswordStrength({ score, text: 'Strong password', class: 'bg-green-500' })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setMessage({ text: 'Passwords do not match', type: 'error' })
      return
    }
    
    if (formData.password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters', type: 'error' })
      return
    }
    
    if (!formData.acceptTerms) {
      setMessage({ text: 'Please accept the terms and conditions', type: 'error' })
      return
    }

    setLoading(true)
    setMessage({ text: 'Creating your account...', type: 'info' })

    try {
      const response = await fetch(`${API_BASE}/webhook/auth-register`, {
        method: 'POST',
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          companyId: formData.companyId || null,
          role: 'customer',
          industry: formData.department || null
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        handleRegistrationSuccess(result)
      } else {
        let errorMessage = `Server returned ${response.status}`
        try {
          const error = await response.json()
          errorMessage = error.message || errorMessage
        } catch {
          // Could not parse error response
        }
        throw new Error(errorMessage)
      }
      
    } catch (error) {
      console.error('Sign up error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      setMessage({ text: errorMessage, type: 'error' })
      setLoading(false)
    }
  }

  function handleRegistrationSuccess(response: RegistrationResponse) {
    setMessage({ text: '🎉 Account created! Redirecting to dashboard...', type: 'success' })
    
    const authData = {
      userId: response.userId || response.user?.userId || response.user?.user_id,
      sessionToken: response.sessionToken,
      userInfo: {
        firstName: response.user?.firstName || response.user?.first_name,
        lastName: response.user?.lastName || response.user?.last_name,
        email: response.user?.email,
        company: response.user?.companyName || response.user?.company_name,
        role: response.user?.role || 'customer',
      }
    }
    
    localStorage.setItem('clarence_auth', JSON.stringify(authData))
    setTimeout(() => router.push('/auth/contracts-dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center p-5">
      {/* Back to Home Link - Top Left */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 text-slate-400 hover:text-white text-sm font-medium transition-colors duration-300"
      >
        ← Back to Home
      </Link>

      <div className="bg-slate-50 rounded-xl shadow-2xl overflow-hidden w-full max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-8 text-center">
          <h1 className="text-3xl font-medium mb-2 tracking-wide">CLARENCE</h1>
          <p className="text-sm text-slate-300 font-light tracking-wider mb-4">The Honest Broker</p>
          <p className="text-lg font-normal">Create Your Account</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mx-8 mt-6 p-3 rounded-lg text-center text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* Account Information */}
          <div className="bg-white rounded-lg p-5 mb-5 border-l-4 border-slate-500">
            <h3 className="text-base font-medium text-slate-700 mb-4 flex items-center gap-2">
              <span className="text-slate-500">👤</span> Account Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">This will be your login username</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="bg-white rounded-lg p-5 mb-5 border-l-4 border-slate-500">
            <h3 className="text-base font-medium text-slate-700 mb-4 flex items-center gap-2">
              <span className="text-slate-500">🏢</span> Company Information
            </h3>
            <div className="relative mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleCompanySearch(e.target.value)}
                onFocus={() => companies.length > 0 && setShowCompanyDropdown(true)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                placeholder="Start typing to search or enter new company"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Select existing company or enter a new one</p>
              
              {showCompanyDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {companies
                    .filter(c => c.name.toLowerCase().includes(formData.companyName.toLowerCase()))
                    .map(company => (
                      <div
                        key={company.id}
                        onClick={() => selectCompany(company)}
                        className="px-4 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 text-sm"
                      >
                        {company.name}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  placeholder="e.g., Senior Partner, Manager"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                  <option value="">Select department</option>
                  <option value="Legal">Legal</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="IT">IT</option>
                  <option value="HR">HR</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white rounded-lg p-5 mb-5 border-l-4 border-slate-500">
            <h3 className="text-base font-medium text-slate-700 mb-4 flex items-center gap-2">
              <span className="text-slate-500">🔐</span> Security
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, password: e.target.value }))
                  checkPasswordStrength(e.target.value)
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                required
              />
              <div className="mt-2">
                <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${passwordStrength.class}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1">{passwordStrength.text}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                required
              />
            </div>
          </div>

          {/* Terms */}
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }))}
                className="mt-1 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
                required
              />
              <span className="text-xs text-slate-700">
                I agree to the{' '}
                <Link href="/terms" className="text-slate-800 font-medium hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-slate-800 font-medium hover:underline">Privacy Policy</Link>.
                I understand that CLARENCE will use my information to facilitate contract negotiation and mediation services.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !formData.acceptTerms}
            className="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center mt-6 text-slate-600 text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-slate-700 font-medium hover:text-slate-900 hover:underline">
              Sign in here
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}