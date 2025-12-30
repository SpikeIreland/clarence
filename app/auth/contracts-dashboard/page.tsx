'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { eventLogger } from '@/lib/eventLogger'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface UserInfo {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  role?: string
  userId?: string
}

interface ProviderBid {
  bidId: string
  providerId: string
  providerCompany: string
  providerContactName: string
  providerContactEmail: string
  status: 'invited' | 'intake_pending' | 'intake_complete' | 'questionnaire_pending' | 'questionnaire_complete' | 'negotiation_ready' | 'negotiating' | 'accepted' | 'rejected' | 'withdrawn'
  intakeComplete: boolean
  questionnaireComplete: boolean
  invitedAt: string
  submittedAt?: string
}

interface Session {
  sessionId: string
  sessionNumber?: string
  customerCompany: string
  serviceRequired: string
  dealValue: string
  currency: string
  status: string
  phase?: number
  phaseAlignment?: number
  createdAt?: string
  lastUpdated?: string
  industry?: string
  // NEW: Template tracking
  templateName?: string
  clausesSelected?: boolean
  clauseCount?: number
  // Provider bids for this session
  providerBids?: ProviderBid[]
}

interface ChatMessage {
  id: string
  type: 'user' | 'clarence'
  content: string
  timestamp: Date
}

// ============================================================================
// SECTION 3: CONSTANTS
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
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function ContractsDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ==========================================================================
  // SECTION 5: STATE DECLARATIONS
  // ==========================================================================

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
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  // ==========================================================================
  // SECTION 6: DATA LOADING FUNCTIONS
  // ==========================================================================

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
      const apiUrl = `${API_BASE}/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}&includeProviderBids=true`

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

  // ==========================================================================
  // SECTION 7: SIGN OUT FUNCTION
  // ==========================================================================

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('clarence_auth');
      localStorage.removeItem('clarence_provider_session');
      localStorage.removeItem('providerSession');
      localStorage.removeItem('currentSessionId');
      localStorage.removeItem('currentSession');
      router.push('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
      localStorage.removeItem('clarence_auth');
      router.push('/auth/login');
    }
  }

  // ==========================================================================
  // SECTION 8: CREATE NEW CONTRACT FUNCTION
  // ==========================================================================

  async function createNewContract() {
    if (isCreatingContract) return

    setIsCreatingContract(true)
    eventLogger.started('contract_session_creation', 'create_contract_clicked');

    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) {
        eventLogger.failed('contract_session_creation', 'create_contract_clicked', 'Not authenticated', 'AUTH_REQUIRED');
        router.push('/auth/login')
        return
      }

      const authData = JSON.parse(auth)

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
        eventLogger.completed('contract_session_creation', 'session_record_created', {
          sessionId: data.sessionId,
          sessionNumber: data.sessionNumber
        });
        localStorage.setItem('currentSessionId', data.sessionId)
        localStorage.setItem('newSessionNumber', data.sessionNumber)
        eventLogger.completed('contract_session_creation', 'redirect_to_requirements', {
          sessionId: data.sessionId
        });
        router.push(`/auth/customer-requirements?session_id=${data.sessionId}&session_number=${data.sessionNumber}`)
      } else {
        const errorData = await response.json()
        console.error('Failed to create session:', errorData)
        eventLogger.failed('contract_session_creation', 'session_record_created', 'Failed to create session', 'API_ERROR');
        alert('Failed to create new contract. Please try again.')
      }
    } catch (error) {
      console.error('Error creating contract:', error)
      eventLogger.failed('contract_session_creation', 'create_contract_clicked', error instanceof Error ? error.message : 'Unknown error', 'EXCEPTION');
      alert('Failed to create new contract. Please try again.')
    } finally {
      setIsCreatingContract(false)
    }
  }

  // ==========================================================================
  // SECTION 9: METRICS CALCULATION
  // ==========================================================================

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

  // ==========================================================================
  // SECTION 10: NAVIGATION FUNCTIONS
  // ==========================================================================

  function continueWithClarence(sessionId?: string) {
    if (sessionId) {
      eventLogger.completed('contract_studio', 'clarence_chat_opened', {
        sessionId: sessionId,
        source: 'dashboard'
      });
      localStorage.setItem('currentSessionId', sessionId)
      router.push(`/auth/chat?sessionId=${sessionId}`)
    } else {
      router.push('/auth/chat')
    }
  }

  function openContractStudio(sessionId: string, providerId: string) {
    eventLogger.completed('contract_studio', 'studio_opened', {
      sessionId: sessionId,
      providerId: providerId,
      source: 'dashboard'
    });
    localStorage.setItem('currentSessionId', sessionId)
    localStorage.setItem('selectedProviderId', providerId)
    router.push(`/auth/contract-studio?session_id=${sessionId}&provider_id=${providerId}`)
  }

  function toggleSessionExpand(sessionId: string) {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  // ==========================================================================
  // SECTION 11: UI HELPER FUNCTIONS
  // ==========================================================================

  function getStatusBadgeClass(status: string) {
    const statusClasses: Record<string, string> = {
      'created': 'bg-amber-100 text-amber-700',
      'initiated': 'bg-amber-100 text-amber-700',
      'customer_intake_complete': 'bg-blue-100 text-blue-700',
      'customer_onboarding_complete': 'bg-indigo-100 text-indigo-700',
      'providers_invited': 'bg-purple-100 text-purple-700',
      'assessment_complete': 'bg-slate-100 text-slate-700',
      'negotiation_ready': 'bg-emerald-100 text-emerald-700',
      'completed': 'bg-emerald-100 text-emerald-700',
      'provider_matched': 'bg-purple-100 text-purple-700',
      'mediation_pending': 'bg-orange-100 text-orange-700',
      'negotiation_active': 'bg-blue-100 text-blue-700',
      'in_progress': 'bg-blue-100 text-blue-700'
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
      'negotiation_ready': 'Ready to Negotiate',
      'completed': 'Completed',
      'provider_matched': 'Provider Matched',
      'mediation_pending': 'Mediation Pending',
      'negotiation_active': 'Negotiating',
      'in_progress': 'In Progress'
    }
    return statusTexts[status] || status.replace(/_/g, ' ')
  }

  function getProviderBidStatusBadge(bid: ProviderBid) {
    // Closed states
    if (bid.status === 'rejected' || bid.status === 'withdrawn') {
      return { text: 'Closed', className: 'bg-slate-100 text-slate-500' }
    }
    if (bid.status === 'accepted') {
      return { text: 'Accepted', className: 'bg-emerald-100 text-emerald-700' }
    }

    // Active negotiation states
    if (bid.status === 'negotiating' || bid.status === 'negotiation_ready') {
      return { text: 'Negotiating', className: 'bg-blue-100 text-blue-700' }
    }

    // Completion states based on flags
    if (bid.questionnaireComplete) {
      return { text: 'Ready', className: 'bg-emerald-100 text-emerald-700' }
    }
    if (bid.intakeComplete) {
      return { text: 'Questionnaire Pending', className: 'bg-amber-100 text-amber-700' }
    }

    // Newly invited - hasn't started intake yet
    if (bid.status === 'invited' || (!bid.intakeComplete && !bid.questionnaireComplete)) {
      return { text: 'Awaiting Response', className: 'bg-purple-100 text-purple-700' }
    }

    // Default fallback
    return { text: 'Pending', className: 'bg-slate-100 text-slate-500' }
  }

  function canNegotiateWithProvider(bid: ProviderBid): boolean {
    return bid.questionnaireComplete &&
      !['rejected', 'withdrawn', 'accepted'].includes(bid.status)
  }

  function getSessionActionButton(session: Session) {
    const status = session.status

    if (status === 'completed') {
      return {
        text: '✓ Contract Completed',
        className: 'bg-slate-300 cursor-not-allowed text-slate-500',
        disabled: true,
        action: () => { }
      }
    }

    if (status === 'created' || status === 'initiated') {
      return {
        text: 'Continue Setup →',
        className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        disabled: false,
        action: () => router.push(`/auth/customer-requirements?session_id=${session.sessionId}`)
      }
    }

    if (status === 'customer_intake_complete') {
      return {
        text: 'Complete Questionnaire →',
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
        disabled: false,
        action: () => router.push(`/auth/questionnaire?session_id=${session.sessionId}`)
      }
    }

    if (status === 'customer_onboarding_complete') {
      return {
        text: 'Invite Providers →',
        className: 'bg-purple-600 hover:bg-purple-700 text-white',
        disabled: false,
        action: () => router.push(`/auth/invite-providers?session_id=${session.sessionId}`)
      }
    }

    // For sessions with providers invited or beyond
    return null // No main action button - actions are per-provider now
  }

  // ==========================================================================
  // SECTION 12: CHAT FUNCTIONS
  // ==========================================================================

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

  // ==========================================================================
  // SECTION 13: EFFECTS
  // ==========================================================================

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  // ==========================================================================
  // SECTION 13B: EVENT LOGGING
  // ==========================================================================

  useEffect(() => {
    if (userInfo?.userId) {
      eventLogger.setUser(userInfo.userId);
    }
    eventLogger.completed('contract_session_creation', 'dashboard_loaded', {
      userEmail: userInfo?.email,
      company: userInfo?.company
    });
  }, [userInfo]);

  useEffect(() => {
    if (!loading && sessions !== null) {
      eventLogger.completed('contract_session_creation', 'dashboard_data_fetched', {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status !== 'completed').length
      });
    }
  }, [loading, sessions]);

  // ==========================================================================
  // SECTION 14: METRICS DATA
  // ==========================================================================

  const metrics = getMetricsData()

  // ==========================================================================
  // SECTION 15: CURRENCY HELPER
  // ==========================================================================

  function formatCurrency(value: string | number, currency: string = 'GBP') {
    const numValue = typeof value === 'string' ? parseInt(value) : value
    const symbols: Record<string, string> = {
      'GBP': '£',
      'USD': '$',
      'EUR': '€',
      'AUD': 'A$'
    }
    const symbol = symbols[currency] || currency + ' '
    return `${symbol}${numValue.toLocaleString()}`
  }

  // ==========================================================================
  // SECTION 16: RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 17: NAVIGATION HEADER */}
      {/* ================================================================== */}
      <header className="bg-slate-800 text-white">
        <div className="container mx-auto px-6">
          <nav className="flex justify-between items-center h-16">
            {/* Logo & Brand */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                <div className="text-xs text-slate-400">The Honest Broker</div>
              </div>
            </Link>

            {/* Center: Current Location */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-slate-400 text-sm">Dashboard</span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 text-sm font-medium">{userInfo?.company || 'Your Company'}</span>
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-4">
              {/* CLARENCE Chat Button */}
              <button
                onClick={() => setShowChatOverlay(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                </svg>
                Ask CLARENCE
              </button>

              {/* User Dropdown */}
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                  </div>
                  <span className="hidden sm:block text-sm">{userInfo?.firstName}</span>
                  <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="font-medium text-slate-800">{userInfo?.firstName} {userInfo?.lastName}</div>
                      <div className="text-sm text-slate-500">{userInfo?.email}</div>
                      <div className="text-xs text-slate-400 mt-1">{userInfo?.company}</div>
                    </div>
                    <div className="py-2">
                      <Link
                        href="/how-it-works"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        How It Works
                      </Link>
                      <Link
                        href="/phases"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        The 6 Phases
                      </Link>
                    </div>
                    <div className="border-t border-slate-100 pt-2">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* ================================================================== */}
      {/* SECTION 18: MAIN CONTENT */}
      {/* ================================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome Banner with Create Button */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">
                Welcome back, {userInfo?.firstName || 'User'}
              </h1>
              <p className="text-slate-500 text-sm">
                Manage your contract negotiations and track provider bids
              </p>
            </div>
            <button
              onClick={createNewContract}
              disabled={isCreatingContract}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                  New Contract
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 19: QUICK STATS CARDS */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-800">{sessions.length}</div>
                <div className="text-slate-500 text-sm">Total Contracts</div>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {sessions.filter(s => s.status !== 'completed').length}
                </div>
                <div className="text-slate-500 text-sm">Active Negotiations</div>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(metrics.totalValue)}
                </div>
                <div className="text-slate-500 text-sm">Total Deal Value</div>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {sessions.reduce((sum, s) => sum + (s.providerBids?.length || 0), 0)}
                </div>
                <div className="text-slate-500 text-sm">Total Provider Bids</div>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 20: COLLAPSIBLE METRICS */}
        {/* ================================================================ */}
        {sessions.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Contract Analytics</h3>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-500 transition-transform ${showMetrics ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {showMetrics && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Charts - same as before */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-semibold mb-4 text-slate-800">Active vs Closed</h3>
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

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-semibold mb-4 text-slate-800">By Type</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={metrics.contractTypeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-semibold mb-4 text-slate-800">Deal Size Distribution</h3>
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

        {/* ================================================================ */}
        {/* SECTION 21: SESSIONS LIST - REDESIGNED WITH SPLIT LAYOUT */}
        {/* ================================================================ */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-slate-800">Your Contracts</h2>

          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center border border-slate-200">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-slate-600">Loading contracts...</p>
            </div>
          ) : sessions.length === 0 ? (
            /* Empty State */
            <div className="bg-white p-12 rounded-xl text-center border border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-800">No contracts yet</h3>
              <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">
                Create your first contract to begin the intelligent negotiation process with CLARENCE.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={createNewContract}
                  disabled={isCreatingContract}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="border border-slate-300 text-slate-700 px-6 py-3 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                  </svg>
                  Ask CLARENCE First
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(session => {
                const phase = session.phase || 1
                const actionButton = getSessionActionButton(session)
                const providerBids = session.providerBids || []
                const isExpanded = expandedSessions.has(session.sessionId)
                const hasProviders = providerBids.length > 0
                const readyProviders = providerBids.filter(b => canNegotiateWithProvider(b))

                return (
                  <div
                    key={session.sessionId}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    {/* Session Header */}
                    <div className="p-5 border-b border-slate-100">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-800">
                              {session.sessionNumber || session.sessionId.substring(0, 8)}
                            </h3>
                            <p className="text-slate-500 text-sm">{session.serviceRequired || 'Service type pending'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(session.status)}`}>
                            {getStatusDisplayText(session.status)}
                          </span>
                          {/* Phase indicator */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6].map(p => (
                              <div
                                key={p}
                                className={`w-2 h-2 rounded-full ${p <= phase ? 'bg-blue-500' : 'bg-slate-200'}`}
                                title={`Phase ${p}: ${phases[p]?.name}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Split Content Area */}
                    <div className="flex flex-col md:flex-row">
                      {/* Left Side: Contract Details */}
                      <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contract Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs text-slate-400">Customer</span>
                            <p className="font-medium text-slate-700">{session.customerCompany}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Deal Value</span>
                            <p className="font-medium text-slate-700">
                              {session.dealValue ? formatCurrency(session.dealValue, session.currency) : 'TBD'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Template</span>
                            <p className="font-medium text-slate-700">{session.templateName || 'Not selected'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Clauses</span>
                            <p className="font-medium text-slate-700">
                              {session.clauseCount ? `${session.clauseCount} selected` : 'Not configured'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Phase</span>
                            <p className="font-medium text-slate-700">{phases[phase]?.name || 'Setup'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400">Industry</span>
                            <p className="font-medium text-slate-700">{session.industry || 'General'}</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Progress</span>
                            <span>{session.phaseAlignment || 0}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${session.phaseAlignment || 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex gap-2">
                          {/* Clause Builder Button - show after intake, before completion */}
                          {!['created', 'initiated', 'customer_intake_complete', 'completed'].includes(session.status) && (
                            <button
                              onClick={() => router.push(`/auth/clause-builder?session_id=${session.sessionId}`)}
                              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              Clause Builder
                              {!session.clausesSelected && (
                                <span className="w-2 h-2 bg-amber-500 rounded-full" title="Not configured"></span>
                              )}
                            </button>
                          )}

                          {/* Setup action button for early stages */}
                          {actionButton && (
                            <button
                              onClick={actionButton.action}
                              disabled={actionButton.disabled}
                              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${actionButton.className}`}
                            >
                              {actionButton.text}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Provider Bids */}
                      <div className="flex-1 p-5 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Provider Bids ({providerBids.length})
                          </h4>
                          {!['created', 'initiated', 'customer_intake_complete', 'completed'].includes(session.status) && (
                            <button
                              onClick={() => router.push(`/auth/invite-providers?session_id=${session.sessionId}&session_number=${session.sessionNumber || ''}`)}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Invite Provider
                            </button>
                          )}
                        </div>

                        {!hasProviders ? (
                          <div className="text-center py-6 text-slate-400 text-sm">
                            <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            No providers invited yet
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Show first 2 providers, expandable */}
                            {(isExpanded ? providerBids : providerBids.slice(0, 2)).map(bid => {
                              const bidStatus = getProviderBidStatusBadge(bid)
                              const canNegotiate = canNegotiateWithProvider(bid)

                              return (
                                <div
                                  key={bid.bidId}
                                  className="bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-slate-700 text-sm truncate">
                                        {bid.providerCompany}
                                      </p>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bidStatus.className}`}>
                                        {bidStatus.text}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 truncate">
                                      {bid.providerContactName || bid.providerContactEmail}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 ml-3">
                                    {canNegotiate ? (
                                      <button
                                        onClick={() => openContractStudio(session.sessionId, bid.providerId)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        Open Studio
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-400">Awaiting completion</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}

                            {/* Show more / less toggle */}
                            {providerBids.length > 2 && (
                              <button
                                onClick={() => toggleSessionExpand(session.sessionId)}
                                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 py-2 transition-colors"
                              >
                                {isExpanded ? (
                                  <>Show less ↑</>
                                ) : (
                                  <>Show {providerBids.length - 2} more provider{providerBids.length - 2 > 1 ? 's' : ''} ↓</>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Summary for providers ready to negotiate */}
                        {readyProviders.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs text-emerald-600 font-medium">
                              ✓ {readyProviders.length} provider{readyProviders.length > 1 ? 's' : ''} ready to negotiate
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                      <button
                        onClick={() => continueWithClarence(session.sessionId)}
                        className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-medium transition-colors flex items-center gap-1"
                        title="Chat with CLARENCE"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                        </svg>
                        Ask CLARENCE
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 22: CHAT OVERLAY */}
      {/* ================================================================== */}
      {showChatOverlay && (
        <div className={`fixed ${chatMinimized ? 'bottom-4 right-4' : 'inset-0'} z-50 ${chatMinimized ? '' : 'bg-black/50'}`}>
          <div className={`${chatMinimized ? 'w-80' : 'absolute right-0 top-0 h-full w-full md:w-96'} bg-white ${chatMinimized ? 'rounded-xl shadow-xl' : ''} flex flex-col`}>
            {/* Chat Header */}
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-sm">C</span>
                </div>
                <div>
                  <div className="font-semibold text-sm">CLARENCE</div>
                  <div className="text-xs text-slate-400">Your negotiation assistant</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChatMinimized(!chatMinimized)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={chatMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>
                <button
                  onClick={() => setShowChatOverlay(false)}
                  className="text-slate-400 hover:text-white transition-colors"
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
                      <div className={`inline-block max-w-[85%] ${message.type === 'user'
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2'
                        : 'bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200'
                        }`}>
                        {message.type === 'clarence' && (
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded flex items-center justify-center">
                              <span className="text-white text-xs font-bold">C</span>
                            </div>
                            <span className="text-xs font-medium text-emerald-600">CLARENCE</span>
                          </div>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="mb-4">
                      <div className="inline-block bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                      className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 23: FLOATING CHAT BUTTON */}
      {/* ================================================================== */}
      {!showChatOverlay && (
        <button
          onClick={() => setShowChatOverlay(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
          title="Chat with CLARENCE"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
          </svg>
        </button>
      )}
    </div>
  )
}