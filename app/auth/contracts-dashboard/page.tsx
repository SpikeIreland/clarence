'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================
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

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================
const phases: Record<number, { name: string; description: string; color: string }> = {
  1: { name: 'Preliminary', description: 'Deal profile & leverage assessment', color: '#64748b' },
  2: { name: 'Foundation', description: 'Contract foundation', color: '#94a3b8' },
  3: { name: 'Gap Narrowing', description: 'High-moderate alignment', color: '#475569' },
  4: { name: 'Complex Issues', description: 'Low alignment areas', color: '#334155' },
  5: { name: 'Commercial', description: 'Schedules & operations', color: '#1e293b' },
  6: { name: 'Final Review', description: 'Consistency & execution', color: '#0f172a' }
}

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

const dealSizeCategories = [
  { min: 0, max: 250000, label: '0-250k', color: '#94a3b8' },
  { min: 250000, max: 500000, label: '250-500k', color: '#64748b' },
  { min: 500000, max: 1000000, label: '500k-1m', color: '#475569' },
  { min: 1000000, max: 2000000, label: '1-2m', color: '#334155' },
  { min: 2000000, max: 5000000, label: '2-5m', color: '#1e293b' },
  { min: 5000000, max: Infinity, label: '5m+', color: '#0f172a' }
]

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================
export default function ContractsDashboard() {
  const router = useRouter()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ============================================================================
  // SECTION 4: STATE DECLARATIONS
  // ============================================================================
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showChatOverlay, setShowChatOverlay] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMinimized, setChatMinimized] = useState(false)
  const [isCreatingContract, setIsCreatingContract] = useState(false)

  // ============================================================================
  // SECTION 5: DATA LOADING FUNCTIONS
  // ============================================================================
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
      const apiUrl = `${API_BASE}/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}`

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

  // ============================================================================
  // SECTION 6: CREATE NEW CONTRACT FUNCTION
  // ============================================================================
  async function createNewContract() {
    if (isCreatingContract) return

    setIsCreatingContract(true)

    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) {
        router.push('/auth/login')
        return
      }

      const authData = JSON.parse(auth)

      // Call the session-create API
      const response = await fetch(`${API_BASE}/session-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.userInfo?.userId,
          userEmail: authData.userInfo?.email,
          companyName: authData.userInfo?.company,
          userName: `${authData.userInfo?.firstName || ''} ${authData.userInfo?.lastName || ''}`.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('New session created:', data)

        // Store the new session ID and redirect to Customer Requirements
        localStorage.setItem('currentSessionId', data.sessionId)
        localStorage.setItem('newSessionNumber', data.sessionNumber)

        // Redirect to Customer Requirements form with session ID
        router.push(`/auth/customerRequirements?session_id=${data.sessionId}&session_number=${data.sessionNumber}`)
      } else {
        const errorData = await response.json()
        console.error('Failed to create session:', errorData)
        alert('Failed to create new contract. Please try again.')
      }
    } catch (error) {
      console.error('Error creating contract:', error)
      alert('Failed to create new contract. Please try again.')
    } finally {
      setIsCreatingContract(false)
    }
  }

  // ============================================================================
  // SECTION 7: METRICS CALCULATION
  // ============================================================================
  const getMetricsData = () => {
    const active = sessions.filter(s => s.status !== 'completed').length
    const completed = sessions.filter(s => s.status === 'completed').length

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

  // ============================================================================
  // SECTION 8: NAVIGATION FUNCTIONS
  // ============================================================================
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
      ? `?session_id=${session.sessionId}&provider=${providerId}`
      : `?session_id=${session.sessionId}`

    switch (phase) {
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

  // ============================================================================
  // SECTION 9: UI HELPER FUNCTIONS
  // ============================================================================
  function getStatusBadgeClass(status: string) {
    const statusClasses: Record<string, string> = {
      'created': 'bg-yellow-50 text-yellow-700',
      'initiated': 'bg-yellow-50 text-yellow-700',
      'customer_intake_complete': 'bg-blue-50 text-blue-700',
      'customer_onboarding_complete': 'bg-indigo-50 text-indigo-700',
      'providers_invited': 'bg-purple-50 text-purple-700',
      'assessment_complete': 'bg-slate-100 text-slate-700',
      'completed': 'bg-green-50 text-green-700',
      'provider_matched': 'bg-purple-50 text-purple-700',
      'mediation_pending': 'bg-orange-50 text-orange-700',
      'negotiation_active': 'bg-indigo-50 text-indigo-700',
      'in_progress': 'bg-indigo-50 text-indigo-700'
    }
    return statusClasses[status] || 'bg-slate-100 text-slate-700'
  }

  function getStatusDisplayText(status: string) {
    const statusTexts: Record<string, string> = {
      'created': 'Draft',
      'initiated': 'Draft',
      'customer_intake_complete': 'Intake Complete',
      'customer_onboarding_complete': 'Ready to Invite',
      'providers_invited': 'Awaiting Providers',
      'assessment_complete': 'Assessment Complete',
      'completed': 'Completed',
      'provider_matched': 'Provider Matched',
      'mediation_pending': 'Mediation Pending',
      'negotiation_active': 'Negotiating',
      'in_progress': 'In Progress'
    }
    return statusTexts[status] || status.replace(/_/g, ' ')
  }

  function getPhaseActionButton(session: Session) {
    const phase = session.phase || 1
    const status = session.status

    if (status === 'completed') {
      return {
        text: '✓ Contract Completed',
        className: 'bg-slate-400 cursor-not-allowed text-white',
        disabled: true,
        action: () => { }
      }
    }

    // Handle onboarding statuses
    if (status === 'created' || status === 'initiated') {
      return {
        text: 'Continue Setup →',
        className: 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white',
        disabled: false,
        action: () => router.push(`/auth/customerRequirements?session_id=${session.sessionId}`)
      }
    }

    if (status === 'customer_intake_complete') {
      return {
        text: 'Complete Questionnaire →',
        className: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white',
        disabled: false,
        action: () => router.push(`/auth/questionnaire?session_id=${session.sessionId}`)
      }
    }

    if (status === 'customer_onboarding_complete') {
      return {
        text: 'Invite Providers →',
        className: 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white',
        disabled: false,
        action: () => router.push(`/auth/invite-providers?session_id=${session.sessionId}`)
      }
    }

    if (status === 'providers_invited') {
      return {
        text: 'View Provider Status',
        className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
        disabled: false,
        action: () => router.push(`/auth/provider-status?session_id=${session.sessionId}`)
      }
    }

    // Standard phase-based buttons
    switch (phase) {
      case 1:
        return {
          text: status === 'assessment_complete'
            ? 'Review Assessment'
            : 'Start Phase 1: Assessment',
          className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
          disabled: false,
          action: () => navigateToPhase(session)
        }
      case 2:
        return {
          text: 'Continue Phase 2: Foundation',
          className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
          disabled: false,
          action: () => navigateToPhase(session)
        }
      default:
        return {
          text: 'Open Contract Studio',
          className: 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white',
          disabled: false,
          action: () => router.push(`/auth/contract-studio?session_id=${session.sessionId}`)
        }
    }
  }

  // ============================================================================
  // SECTION 10: CHAT FUNCTIONS
  // ============================================================================
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

      const response = await fetch(`${API_BASE}/clarence-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: 'dashboard',
          dashboardData: dashboardContext,
          sessionId: null,
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

  // ============================================================================
  // SECTION 11: EFFECTS
  // ============================================================================
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    loadUserInfo()
    loadSessions()
  }, [loadUserInfo])

  // ============================================================================
  // SECTION 12: METRICS DATA
  // ============================================================================
  const metrics = getMetricsData()

  // ============================================================================
  // SECTION 13: RENDER - NAVIGATION BAR
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-50">
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

      {/* ============================================================================ */}
      {/* SECTION 14: MAIN CONTENT */}
      {/* ============================================================================ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Banner with Create Button */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-2">
                Welcome back, {userInfo?.firstName || 'User'}
              </h1>
              <p className="text-slate-300 text-sm">
                {userInfo?.company || 'Your Company'} | {userInfo?.role === 'admin' ? 'Administrator' : 'Customer Portal'}
              </p>
            </div>
            <button
              onClick={createNewContract}
              disabled={isCreatingContract}
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-5 py-3 rounded-lg flex items-center gap-2 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingContract ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Contract
                </>
              )}
            </button>
          </div>
        </div>

        {/* ============================================================================ */}
        {/* SECTION 15: COLLAPSIBLE METRICS */}
        {/* ============================================================================ */}
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
                  {/* Active vs Closed */}
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

                  {/* Contract Types */}
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

                  {/* Deal Size Distribution */}
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

        {/* ============================================================================ */}
        {/* SECTION 16: QUICK STATS CARDS */}
        {/* ============================================================================ */}
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

        {/* ============================================================================ */}
        {/* SECTION 17: SESSIONS LIST */}
        {/* ============================================================================ */}
        <div>
          <h2 className="text-xl font-medium mb-4 text-slate-800">Your Contracts</h2>

          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center border border-slate-200">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading contracts...</p>
            </div>
          ) : sessions.length === 0 ? (
            /* Empty State with Create Button */
            <div className="bg-white p-12 rounded-xl text-center border border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2 text-slate-800">Welcome to CLARENCE!</h3>
              <p className="text-slate-600 mb-6 text-sm max-w-md mx-auto">
                {`You don't have any contracts yet. Create your first contract to begin the intelligent negotiation process with CLARENCE.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={createNewContract}
                  disabled={isCreatingContract}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-6 py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingContract ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create New Contract
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowChatOverlay(true)}
                  className="border border-slate-300 text-slate-700 px-6 py-3 rounded-lg text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  💬 Ask CLARENCE First
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map(session => {
                const phase = session.phase || 1
                const actionButton = getPhaseActionButton(session)

                return (
                  <div key={session.sessionId} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-medium text-slate-800">
                          {session.sessionNumber || `Contract ${session.sessionId.substring(0, 8)}`}
                        </h3>
                        <p className="text-slate-600 text-sm">{session.serviceRequired || 'Service type pending'}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(session.status)}`}>
                        {getStatusDisplayText(session.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">Customer:</span>
                        <p className="font-medium text-slate-700">{session.customerCompany}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Provider:</span>
                        <p className="font-medium text-slate-700">{session.providerCompany || 'Pending'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Value:</span>
                        <p className="font-medium text-slate-700">
                          {session.dealValue ? `£${parseInt(session.dealValue).toLocaleString()}` : 'TBD'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Phase:</span>
                        <p className="font-medium text-slate-700">{phases[phase]?.name || 'Setup'}</p>
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
                        onClick={actionButton.action}
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
                        onClick={() => router.push(`/auth/contract-studio?session_id=${session.sessionId}`)}
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

      {/* ============================================================================ */}
      {/* SECTION 18: CHAT OVERLAY */}
      {/* ============================================================================ */}
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
                      <div className={`inline-block max-w-[80%] ${message.type === 'user'
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

      {/* ============================================================================ */}
      {/* SECTION 19: FLOATING CHAT BUTTON */}
      {/* ============================================================================ */}
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