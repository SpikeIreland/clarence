'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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

interface ChatMessage {
  id: string
  type: 'user' | 'clarence'
  content: string
  timestamp: Date
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
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetrics, setShowMetrics] = useState(false) // Changed to false by default
  const [showChatOverlay, setShowChatOverlay] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMinimized, setChatMinimized] = useState(false)

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
    
    // Total value calculation
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
    // FIX: Changed from 'session' to 'session_id' to match webhook expectations
    const queryParams = providerId 
      ? `?session_id=${session.sessionId}&provider=${providerId}`
      : `?session_id=${session.sessionId}`
    
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

  // ========== SECTION 5: CHAT FUNCTIONS ==========
  async function sendChatMessage() {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      // Build context for CLARENCE
      const dashboardContext = {
        userInfo: userInfo,
        totalContracts: sessions.length,
        activeContracts: sessions.filter(s => s.status !== 'completed').length,
        completedContracts: sessions.filter(s => s.status === 'completed').length,
        totalValue: sessions.reduce((sum, s) => sum + parseInt(s.dealValue || '0'), 0),
        contractTypes: [...new Set(sessions.map(s => s.serviceRequired))],
        currentPhases: sessions.map(s => ({
          sessionNumber: s.sessionNumber,
          phase: s.phase,
          status: s.status
        }))
      }

      const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/clarence-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: 'dashboard',
          dashboardData: dashboardContext,
          sessionId: null, // No specific session on dashboard
          userId: userInfo?.userId || 'unknown'
        })
      })

      const data = await response.json()
      
      const clarenceMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'clarence',
        content: data.response || data.message || "I can help you understand your contracts and guide you through the negotiation process. What would you like to know?",
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, clarenceMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'clarence',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Initialize chat with welcome message
  useEffect(() => {
    if (showChatOverlay && chatMessages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: '1',
        type: 'clarence',
        content: `Hello ${userInfo?.firstName || 'there'}! I'm CLARENCE, your contract negotiation assistant. I can help you understand your contracts, explain the negotiation process, or guide you to start a new negotiation. What would you like to explore today?`,
        timestamp: new Date()
      }
      setChatMessages([welcomeMessage])
    }
  }, [showChatOverlay, chatMessages.length, userInfo])

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ========== SECTION 6: USE EFFECTS ==========
  useEffect(() => {
    loadUserInfo()
    loadSessions()
  }, [loadUserInfo])

  // ========== SECTION 7: METRICS CALCULATION ==========
  const metrics = getMetricsData()

  // ========== SECTION 8: RENDER START ==========
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ========== SECTION 9: NAVIGATION BAR ========== */}
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
                onClick={() => setShowChatOverlay(true)}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all"
              >
                💬 CLARENCE Chat
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ========== SECTION 10: MAIN CONTENT CONTAINER ========== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ========== SECTION 11: HEADER BANNER ========== */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-8">
          <h1 className="text-2xl font-medium mb-2">
            Welcome back, {userInfo?.firstName || 'User'}
          </h1>
          <p className="text-slate-300 text-sm">
            {userInfo?.company || 'Your Company'} | {userInfo?.role === 'admin' ? 'Administrator' : 'Customer Portal'}
          </p>
        </div>

        {/* ========== SECTION 12: COLLAPSIBLE METRICS ========== */}
        {sessions.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-700">📊 Contract Analytics</h3>
                <svg 
                  className={`w-5 h-5 text-slate-500 transition-transform ${showMetrics ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {!showMetrics && (
                <div className="flex gap-6 mt-3 text-sm text-slate-600">
                  <span>Active: {sessions.filter(s => s.status !== 'completed').length}</span>
                  <span>Completed: {sessions.filter(s => s.status === 'completed').length}</span>
                  <span>Total Value: £{metrics.totalValue.toLocaleString()}</span>
                  <span>Avg. Progress: {metrics.avgCompletion}%</span>
                </div>
              )}
            </button>

            {showMetrics && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              </div>
            )}
          </div>
        )}

        {/* ========== SECTION 13: QUICK STATS CARDS ========== */}
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

        {/* ========== SECTION 14: SESSIONS LIST ========== */}
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
                onClick={() => setShowChatOverlay(true)}
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

      {/* ========== SECTION 15: CHAT OVERLAY ========== */}
      {showChatOverlay && (
        <div className={`fixed ${chatMinimized ? 'bottom-4 right-4' : 'inset-0'} z-50 ${chatMinimized ? '' : 'bg-black/50'}`}>
          <div className={`${chatMinimized ? 'w-80' : 'absolute right-0 top-0 h-full w-full md:w-96'} bg-white ${chatMinimized ? 'rounded-lg shadow-xl' : ''} flex flex-col`}>
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-4 flex justify-between items-center rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="font-bold">C</span>
                </div>
                <div>
                  <div className="font-medium">CLARENCE</div>
                  <div className="text-xs text-slate-300">Dashboard Assistant</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChatMinimized(!chatMinimized)}
                  className="text-white/80 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={chatMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>
                <button
                  onClick={() => setShowChatOverlay(false)}
                  className="text-white/80 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {!chatMinimized && (
              <>
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  {chatMessages.map(message => (
                    <div key={message.id} className={`mb-4 ${message.type === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block max-w-[80%] ${
                        message.type === 'user' 
                          ? 'bg-slate-600 text-white rounded-lg px-4 py-2' 
                          : 'bg-white rounded-lg px-4 py-2 shadow-sm border border-slate-200'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-slate-300' : 'text-slate-500'}`}>
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="mb-4">
                      <div className="inline-block bg-white rounded-lg px-4 py-3 shadow-sm border border-slate-200">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-slate-200 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Ask about contracts, process, or guidance..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========== SECTION 16: FLOATING CHAT BUTTON ========== */}
      {!showChatOverlay && (
        <button
          onClick={() => setShowChatOverlay(true)}
          className="fixed bottom-8 right-8 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
          title="Open CLARENCE Chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
          </svg>
        </button>
      )}
    </div>
  )
}