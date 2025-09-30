'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
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
  
  const [companies, setCompanies] = useState<any[]>([])
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

  function selectCompany(company: any) {
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
    let feedback = []
    
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
        } catch (e) {}
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error('Sign up error:', error)
      setMessage({ text: error.message || 'Registration failed', type: 'error' })
      setLoading(false)
    }
  }

  function handleRegistrationSuccess(response: any) {
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
    setTimeout(() => router.push('/chat'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-10 text-center">
          <h1 className="text-4xl font-bold mb-2">CLARENCE</h1>
          <p className="text-xl">Create Your Account</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mx-8 mt-6 p-4 rounded-lg text-center font-medium ${
            message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-10">
          {/* Account Information */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>👤</span> Account Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">This will be your login username</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🏢</span> Company Information
            </h3>
            <div className="relative mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleCompanySearch(e.target.value)}
                onFocus={() => companies.length > 0 && setShowCompanyDropdown(true)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                placeholder="Start typing to search or enter new company"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Select existing company or enter a new one</p>
              
              {showCompanyDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {companies
                    .filter(c => c.name.toLowerCase().includes(formData.companyName.toLowerCase()))
                    .map(company => (
                      <div
                        key={company.id}
                        onClick={() => selectCompany(company)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Senior Partner, Manager"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
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
          <div className="bg-gray-50 rounded-xl p-6 mb-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🔐</span> Security
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, password: e.target.value }))
                  checkPasswordStrength(e.target.value)
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
              <div className="mt-2">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${passwordStrength.class}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">{passwordStrength.text}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Terms */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5 mb-8">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }))}
                className="mt-1"
                required
              />
              <span className="text-sm text-gray-700">
                I agree to the{' '}
                <a href="/terms" className="text-blue-600 font-semibold hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-600 font-semibold hover:underline">Privacy Policy</a>.
                I understand that CLARENCE will use my information to facilitate contract negotiation and mediation services.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !formData.acceptTerms}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center mt-6 text-gray-600">
            Already have an account?{' '}
            <a h