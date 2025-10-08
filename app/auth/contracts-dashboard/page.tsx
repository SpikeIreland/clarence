'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'

// ========== SECTION 1: INTERFACES ==========
interface UserInfo {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  role?: string
  userId?: string
}

interface Session {
  sessionId: string
  sessionNumber?: string
  customerCompany: string
  providerCompany?: string
  serviceRequired: string
  dealValue: string
  status: string
  phase?: number
  phaseAlignment?: number
  createdAt?: string
  lastUpdated?: string
}

const phases: Record<number, { name: string; description: string; color: string }> = {
  1: { name: 'Preliminary', description: 'Deal profile & leverage assessment', color: '#64748b' },
  2: { name: 'Foundation', description: 'Contract foundation', color: '#94a3b8' },
  3: { name: 'Gap Narrowing', description: 'High-moderate alignment', color: '#475569' },
  4: { name: 'Complex Issues', description: 'Low alignment areas', color: '#334155' },
  5: { name: 'Commercial', description: 'Schedules & operations', color: '#1e293b' },
  6: { name: 'Final Review', description: 'Consistency & execution', color: '#0f172a' }
}

// Contract type categories for John's metrics
const contractTypes: Record<string, string> = {
  'IT Services': 'IT Services',
  'IT Consulting': 'IT Services',
  'Software Development': 'IT Services',
  'Process Management': 'Process Management',
  'BPO': 'Process Management',
  'SaaS': 'SaaS Agreements',
  'Software': 'SaaS Agreements',
  'Lease': 'Leases',
  'Property': 'Leases',
  'Sale': 'Sale & Purchase',
  'Purchase': 'Sale & Purchase',
  'Other': 'Other'
}

// Deal size categories for John's metrics
const dealSizeCategories = [
  { min: 0, max: 250000, label: '0-250k', color: '#94a3b8' },
  { min: 250000, max: 500000, label: '250-500k', color: '#64748b' },
  { min: 500000, max: 1000000, label: '500k-1m', color: '#475569' },
  { min: 1000000, max: 2000000, label: '1-2m', color: '#334155' },
  { min: 2000000, max: 5000000, label: '2-5m', color: '#1e293b' },
  { min: 5000000, max: Infinity, label: '5m+', color: '#0f172a' }
]

// ========== SECTION 2: MAIN COMPONENT START ==========
export default function ContractsDashboard() {
  const router = useRouter()
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)

  // ========== SECTION 4: FUNCTIONS ==========
  const loadUserInfo = useCallback(async () => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    const authData = JSON.parse(auth)
    setUserInfo(authData.userInfo)
  }, [router])

  async function loadSessions() {
    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) return
      
      const authData = JSON.parse(auth)
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}`
      
      console.log('Loading sessions from:', apiUrl)
      
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        console.log('Sessions data received:', data)
        setSessions(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to load sessions:', response.status)
        setSessions([])
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const getMetricsData = () => {
    // Active vs Closed contracts (John's metric #1)
    const active = sessions.filter(s => s.status !== 'completed').length
    const completed = sessions.filter(s => s.status === 'completed').length
    
    // Contract types distribution (John's metric #2)
    const typeDistribution: Record<string, number> = {}
    sessions.forEach(session => {
      let category = 'Other'
      for (const [keyword, cat] of Object.entries(contractTypes)) {
        if (session.serviceRequired?.toLowerCase().includes(keyword.toLowerCase())) {
          category = cat
          break
        }
      }
      typeDistribution[category] = (typeDistribution[category] || 0) + 1
    })
    
    const contractTypeData = Object.entries(typeDistribution).map(([type, count]) => ({
      type: type.length > 15 ? type.substring(0, 15) + '...' : type,
      count
    }))

    // Deal size distribution (John's metric #3)
    const sizeDistribution: Record<string, number> = {}
    sessions.forEach(session => {
      const dealValue = parseInt(session.dealValue || '0')
      // Note: Fixed - dealValue is per contract, not cumulative of providers
      const category = dealSizeCategories.find(cat => dealValue >= cat.min && dealValue < cat.max)
      if (category) {
        sizeDistribution[category.label] = (sizeDistribution[category.label] || 0) + 1
      }
    })

    const dealSizeData = dealSizeCategories
      .filter(cat => sizeDistribution[cat.label] > 0)
      .map(cat => ({
        name: cat.label,
        value: sizeDistribution[cat.label] || 0,
        color: cat.color
      }))
    
    // Total value calculation - fixed to not multiply by providers
    const totalValue = sessions.reduce((sum, s) => sum + parseInt(s.dealValue || '0'), 0)
    
    return {
      statusData: [
        { name: 'Active', value: active || 0, color: '#475569' },
        { name: 'Closed', value: completed || 0, color: '#94a3b8' }
      ],
      contractTypeData,
      dealSizeData,
      totalValue,
      avgCompletion: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.phaseAlignment || 0), 0) / sessions.length)
        : 0
    }
  }

  function continueWithClarence(sessionId?: string) {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId)
      router.push(`/auth/chat?sessionId=${sessionId}`)
    } else {
      router.push('/auth/chat')
    }
  }

  function navigateToPhase(session: Session, providerId?: string) {
    localStorage.setItem('currentSessionId', session.sessionId)
    localStorage.setItem('currentSession', JSON.stringify(session))
    
    if (providerId) {
      localStorage.setItem('selectedProviderId', providerId)
    }
    
    const phase = session.phase || 1
    const queryParams = providerId 
      ? `?session=${session.sessionId}&provider=${providerId}`
      : `?session=${session.sessionId}`
    
    switch(phase) {
      case 1:
        router.push(`/auth/assessment${queryParams}`)
        break
      case 2:
        router.push(`/auth/foundation${queryParams}`)
        break
      case 3:
      case 4:
        router.push(`/auth/assessment${queryParams}`)
        break
      case 5:
        router.push(`/auth/commercial${queryParams}`)
        break
      case 6:
        continueWithClarence(session.sessionId)
        break
      default:
        router.push(`/auth/assessment${queryParams}`)
    }
  }

  function getStatusBadgeClass(status: string) {
    const statusClasses: Record<string, string> = {
      'created': 'bg-yellow-50 text-yellow-700',
      'initiated': 'bg-yellow-50 text-yellow-700',
      'assessment_complete': 'bg-slate-100 text-slate-700',
      'completed': 'bg-green-50 text-green-700',
      'provider_matched': 'bg-purple-50 text-purple-700',
      'mediation_pending': 'bg-orange-50 text-orange-700',
      'in_progress': 'bg-indigo-50 text-indigo-700'
    }
    return statusClasses[status] || 'bg-slate-100 text-slate-700'
  }

  function getPhaseActionButton(session: Session) {
    const phase = session.phase || 1
    
    if (session.status === 'completed') {
      return {
        text: '✓ Contract Completed',
        className: 'bg-slate-400 cursor-not-allowed text-white',
        disabled: true
      }
    }
    
    switch(phase) {
      case 1:
        return {
          text: session.status === 'assessment_complete' 
            ? 'Review Assessment' 
            : 'Start Phase 1: Assessment',
          className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
          disabled: false
        }
      case 2:
        return {
          text: 'Continue Phase 2: Foundation',
          className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
          disabled: false
        }
      default:
        return {
          text: 'Start Assessment',
          className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
          disabled: false
        }
    }
  }

  // ========== SECTION 5: USE EFFECTS ==========
  useEffect(() => {
    loadUserInfo()
    loadSessions()
  }, [loadUserInfo])

  // ========== SECTION 6: METRICS CALCULATION ==========
  const metrics = getMetricsData()

  // ========== SECTION 7: RENDER START ==========
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ========== SECTION 8: NAVIGATION BAR ========== */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <div>
                  <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                  <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                </div>
              </Link>
              <span className="ml-4 text-slate-600 text-sm">Contract Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="text-slate-600 hover:text-slate-900 text-sm transition-colors"
              >
                {showMetrics ? '📊 Hide Metrics' : '📊 Show Metrics'}
              </button>
              <button
                onClick={() => continueWithClarence()}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all"
              >
                💬 CLARENCE Chat
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== SECTION 9: MAIN CONTENT CONTAINER ========== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ========== SECTION 10: HEADER BANNER ========== */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-8">
          <h1 className="text-2xl font-medium mb-2">
            Welcome back, {userInfo?.firstName || 'User'}
          </h1>
          <p className="text-slate-300 text-sm">
            {userInfo?.company || 'Your Company'} | {userInfo?.role === 'admin' ? 'Administrator' : 'Customer Portal'}
          </p>
        </div>

        {/* ========== SECTION 11: JOHN'S REQUESTED METRICS ========== */}
        {showMetrics && sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Metric #1: Active vs Closed Contracts */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-base font-medium mb-4 text-slate-700">Active vs Closed Contracts</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metrics.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {metrics.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Metric #2: Contract Types */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-base font-medium mb-4 text-slate-700">Contracts by Type</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.contractTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#64748b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Metric #3: Deal Size Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-base font-medium mb-4 text-slate-700">Deal Size Distribution</h3>
              {metrics.dealSizeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={metrics.dealSizeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                    >
                      {metrics.dealSizeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                  No data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== SECTION 12: QUICK STATS CARDS ========== */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="text-2xl font-medium text-slate-700">{sessions.length}</div>
            <div className="text-slate-600 text-sm">Total Contracts</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="text-2xl font-medium text-slate-700">
              {sessions.filter(s => s.status !== 'completed').length}
            </div>
            <div className="text-slate-600 text-sm">Active Negotiations</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="text-2xl font-medium text-slate-700">
              £{metrics.totalValue.toLocaleString()}
            </div>
            <div className="text-slate-600 text-sm">Total Deal Value</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="text-2xl font-medium text-slate-700">
              {metrics.avgCompletion}%
            </div>
            <div className="text-slate-600 text-sm">Avg. Completion</div>
          </div>
        </div>

        {/* ========== SECTION 13: SESSIONS LIST ========== */}
        <div>
          <h2 className="text-xl font-medium mb-4 text-slate-800">Active Contract Negotiations</h2>
          
          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center border border-slate-200">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading contracts...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white p-12 rounded-xl text-center border border-slate-200">
              <h3 className="text-lg font-medium mb-2 text-slate-800">Welcome to CLARENCE!</h3>
              <p className="text-slate-600 mb-6 text-sm">{`You don't have any active contracts yet.`}</p>
              <button
                onClick={() => continueWithClarence()}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-lg text-sm"
              >
                💬 Start with CLARENCE Chat
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map(session => {
                const phase = session.phase || 1;
                const actionButton = getPhaseActionButton(session);
                
                return (
                  <div key={session.sessionId} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-medium text-slate-800">
                          {session.sessionNumber || `Contract ${session.sessionId.substring(0, 8)}`}
                        </h3>
                        <p className="text-slate-600 text-sm">{session.serviceRequired}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(session.status)}`}>
                        Phase {phase}: {phases[phase]?.name || 'Unknown'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">Customer:</span>
                        <p className="font-medium text-slate-700">{session.customerCompany}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Provider:</span>
                        <p className="font-medium text-slate-700">{session.providerCompany || 'TBD'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Value:</span>
                        <p className="font-medium text-slate-700">£{parseInt(session.dealValue || '0').toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Progress:</span>
                        <p className="font-medium text-slate-700">{session.phaseAlignment || 0}%</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div 
                          className="bg-slate-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${session.phaseAlignment || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigateToPhase(session)}
                        disabled={actionButton.disabled}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${actionButton.className}`}
                      >
                        {actionButton.text}
                      </button>
                      
                      <button
                        onClick={() => continueWithClarence(session.sessionId)}
                        className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg text-sm"
                      >
                        💬 Chat
                      </button>
                      
                      <button
                        onClick={() => continueWithClarence(session.sessionId)}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========== SECTION 14: FLOATING CHAT BUTTON ========== */}
      <button
        onClick={() => continueWithClarence()}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
        title="Open CLARENCE Chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
        </svg>
      </button>
    </div>
  )
}