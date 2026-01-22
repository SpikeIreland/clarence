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
import FeedbackButton from '@/app/components/FeedbackButton'

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
  progress?: number
  createdAt?: string
  lastUpdated?: string
  industry?: string
  // Template tracking
  templateName?: string
  clausesSelected?: boolean
  clauseCount?: number
  // Provider bids for this session
  providerBids?: ProviderBid[]
  // NEW: Training flag
  isTraining?: boolean
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


// ============================================================================
// SECTION 4: DEAL VALUE MAPPING
// ============================================================================

const dealValueMap: Record<string, number> = {
  // New format (from Create Contract page)
  'under_50k': 25000,
  '50k_250k': 150000,
  '250k_1m': 625000,
  'over_1m': 1500000,
  // Legacy format (backwards compatibility)
  'under_100k': 50000,
  '100k_250k': 175000,
  '250k_500k': 375000,
  '500k_1m': 750000,
}

function parseDealValue(dealValue: string | number | null | undefined): number {
  if (!dealValue) return 0
  if (typeof dealValue === 'number') return dealValue
  if (dealValueMap[dealValue]) return dealValueMap[dealValue]
  const parsed = parseInt(String(dealValue).replace(/[£$€,]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

function formatDealValueDisplay(dealValue: string | number | null | undefined, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'

  const categoryLabels: Record<string, string> = {
    // New format (from Create Contract page)
    'under_50k': `Under ${symbol}50k`,
    '50k_250k': `${symbol}50k - ${symbol}250k`,
    '250k_1m': `${symbol}250k - ${symbol}1M`,
    'over_1m': `Over ${symbol}1M`,
    // Legacy format (backwards compatibility)
    'under_100k': `Under ${symbol}100k`,
    '100k_250k': `${symbol}100k - ${symbol}250k`,
    '250k_500k': `${symbol}250k - ${symbol}500k`,
    '500k_1m': `${symbol}500k - ${symbol}1M`,
  }

  if (typeof dealValue === 'string' && categoryLabels[dealValue]) {
    return categoryLabels[dealValue]
  }

  const numValue = parseDealValue(dealValue)
  if (numValue === 0) return 'Not specified'

  return `${symbol}${numValue.toLocaleString()}`
}

const dealSizeCategories = [
  { min: 0, max: 250000, label: '0-250k', color: '#94a3b8' },
  { min: 250000, max: 500000, label: '250-500k', color: '#64748b' },
  { min: 500000, max: 1000000, label: '500k-1m', color: '#475569' },
  { min: 1000000, max: 2000000, label: '1-2m', color: '#334155' },
  { min: 2000000, max: 5000000, label: '2-5m', color: '#0f172a' },
  { min: 5000000, max: Infinity, label: '5m+', color: '#0f172a' }
]

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

export default function ContractsDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ==========================================================================
  // SECTION 6: STATE DECLARATIONS
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

  // Active tab state for Live/Training
  const [activeTab, setActiveTab] = useState<'live' | 'training'>('live')

  // ==========================================================================
  // SECTION 7: DATA LOADING FUNCTIONS
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
      const apiUrl = `${API_BASE}/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}&customer_id=${authData.userInfo?.userId}`

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
  // SECTION 8: FILTERED SESSIONS BY TAB
  // ==========================================================================

  const filteredSessions = sessions.filter(session => {
    if (activeTab === 'training') {
      return session.isTraining === true
    }
    return session.isTraining !== true
  })

  // ==========================================================================
  // SECTION 9: SIGN OUT FUNCTION
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
  // SECTION 10: CREATE NEW CONTRACT/TRAINING FUNCTION
  // ==========================================================================

  async function createNewSession() {
    if (isCreatingContract) return

    // For LIVE mode, redirect to the new assessment flow
    if (activeTab === 'live') {
      router.push('/auth/create-contract')
      return
    }

    // For TRAINING mode, continue with direct session creation
    setIsCreatingContract(true)

    eventLogger.started('training_session_creation', 'create_session_clicked');

    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) {
        eventLogger.failed('training_session_creation', 'create_session_clicked', 'Not authenticated', 'AUTH_REQUIRED');
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
          userName: `${authData.userInfo?.firstName || ''} ${authData.userInfo?.lastName || ''}`.trim(),
          isTraining: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('New training session created:', data)

        eventLogger.completed('training_session_creation', 'session_record_created', {
          sessionId: data.sessionId,
          sessionNumber: data.sessionNumber,
          isTraining: true
        });

        localStorage.setItem('currentSessionId', data.sessionId)
        localStorage.setItem('newSessionNumber', data.sessionNumber)

        router.push('/auth/training')

      } else {
        const errorData = await response.json()
        console.error('Failed to create training session:', errorData)
        eventLogger.failed('training_session_creation', 'session_record_created', 'Failed to create session', 'API_ERROR');
        alert('Failed to create new training session. Please try again.')
      }
    } catch (error) {
      console.error('Error creating training session:', error)
      eventLogger.failed('training_session_creation', 'create_session_clicked', error instanceof Error ? error.message : 'Unknown error', 'EXCEPTION');
      alert('Failed to create new training session. Please try again.')
    } finally {
      setIsCreatingContract(false)
    }
  }

  // ==========================================================================
  // SECTION 11: METRICS CALCULATION
  // ==========================================================================

  const getMetricsData = () => {
    const sessionsToAnalyze = filteredSessions

    const active = sessionsToAnalyze.filter(s => s.status !== 'completed').length
    const completed = sessionsToAnalyze.filter(s => s.status === 'completed').length

    const typeDistribution: Record<string, number> = {}
    sessionsToAnalyze.forEach(session => {
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
    sessionsToAnalyze.forEach(session => {
      const dealValue = parseDealValue(session.dealValue)
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

    const totalValue = sessionsToAnalyze.reduce((sum, s) => sum + parseDealValue(s.dealValue), 0)

    return {
      statusData: [
        { name: 'Active', value: active || 0, color: activeTab === 'training' ? '#f59e0b' : '#475569' },
        { name: 'Closed', value: completed || 0, color: '#94a3b8' }
      ],
      contractTypeData,
      dealSizeData,
      totalValue,
      avgProgress: sessionsToAnalyze.length > 0
        ? Math.round(sessionsToAnalyze.reduce((sum, s) => sum + (s.progress || 0), 0) / sessionsToAnalyze.length)
        : 0
    }
  }

  // ==========================================================================
  // SECTION 12: NAVIGATION FUNCTIONS
  // ==========================================================================

  function continueWithClarence(sessionId?: string) {
    if (sessionId) {
      eventLogger.completed('mediation_studio', 'clarence_chat_opened', {
        sessionId: sessionId,
        source: 'dashboard'
      });
      localStorage.setItem('currentSessionId', sessionId)
      router.push(`/auth/chat?sessionId=${sessionId}`)
    } else {
      router.push('/auth/chat')
    }
  }

  function openMediationStudio(sessionId: string, providerId: string) {
    eventLogger.completed('mediation_studio', 'studio_opened', {
      sessionId: sessionId,
      providerId: providerId,
      source: 'dashboard'
    });
    localStorage.setItem('currentSessionId', sessionId)
    localStorage.setItem('selectedProviderId', providerId)

    const session = sessions.find(s => s.sessionId === sessionId)
    if (session?.isTraining) {
      router.push(`/training/${sessionId}?provider_id=${providerId}`)
    } else {
      router.push(`/auth/contract-studio?session_id=${sessionId}&provider_id=${providerId}`)
    }
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
  // SECTION 13: UI HELPER FUNCTIONS
  // ==========================================================================

  function getStatusBadgeClass(status: string, isTraining: boolean = false) {
    if (isTraining) {
      const trainingClasses: Record<string, string> = {
        'created': 'bg-amber-100 text-amber-700',
        'initiated': 'bg-amber-100 text-amber-700',
        'in_progress': 'bg-amber-200 text-amber-800',
        'completed': 'bg-amber-100 text-amber-600',
      }
      return trainingClasses[status] || 'bg-amber-100 text-amber-700'
    }

    const statusClasses: Record<string, string> = {
      'created': 'bg-slate-100 text-slate-600',
      'initiated': 'bg-slate-100 text-slate-600',
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
    if (bid.status === 'rejected' || bid.status === 'withdrawn') {
      return { text: 'Closed', className: 'bg-slate-100 text-slate-500' }
    }
    if (bid.status === 'accepted') {
      return { text: 'Accepted', className: 'bg-emerald-100 text-emerald-700' }
    }
    if (bid.status === 'negotiating' || bid.status === 'negotiation_ready') {
      return { text: 'Negotiating', className: 'bg-blue-100 text-blue-700' }
    }
    if (bid.questionnaireComplete) {
      return { text: 'Ready', className: 'bg-emerald-100 text-emerald-700' }
    }
    if (bid.intakeComplete) {
      return { text: 'Questionnaire Pending', className: 'bg-amber-100 text-amber-700' }
    }
    if (bid.status === 'invited' || (!bid.intakeComplete && !bid.questionnaireComplete)) {
      return { text: 'Awaiting Response', className: 'bg-purple-100 text-purple-700' }
    }
    return { text: 'Pending', className: 'bg-slate-100 text-slate-500' }
  }

  function canNegotiateWithProvider(bid: ProviderBid): boolean {
    return bid.questionnaireComplete &&
      !['rejected', 'withdrawn', 'accepted'].includes(bid.status)
  }

  function getSessionActionButton(session: Session) {
    const status = session.status
    const isTraining = session.isTraining || false

    if (status === 'completed') {
      return {
        text: '✓ Completed',
        className: 'bg-slate-300 cursor-not-allowed text-slate-500',
        disabled: true,
        action: () => { }
      }
    }

    if (status === 'created' || status === 'initiated') {
      return {
        text: 'Continue Setup →',
        className: isTraining
          ? 'bg-amber-500 hover:bg-amber-600 text-white'
          : 'bg-emerald-600 hover:bg-emerald-700 text-white',
        disabled: false,
        action: () => router.push(`/auth/customer-requirements?session_id=${session.sessionId}`)
      }
    }

    if (status === 'customer_intake_complete') {
      return {
        text: 'Complete Questionnaire →',
        className: isTraining
          ? 'bg-amber-500 hover:bg-amber-600 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white',
        disabled: false,
        action: () => router.push(`/auth/questionnaire?session_id=${session.sessionId}`)
      }
    }

    if (status === 'customer_onboarding_complete') {
      return {
        text: isTraining ? 'Select Training Partner →' : 'Invite Providers →',
        className: isTraining
          ? 'bg-amber-500 hover:bg-amber-600 text-white'
          : 'bg-purple-600 hover:bg-purple-700 text-white',
        disabled: false,
        action: () => router.push(`/auth/invite-providers?session_id=${session.sessionId}`)
      }
    }

    return null
  }

  // ==========================================================================
  // SECTION 14: CHAT FUNCTIONS
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
        totalContracts: filteredSessions.length,
        activeContracts: filteredSessions.filter(s => s.status !== 'completed').length,
        completedContracts: filteredSessions.filter(s => s.status === 'completed').length,
        totalValue: filteredSessions.reduce((sum, s) => sum + parseDealValue(s.dealValue), 0),
        contractTypes: [...new Set(filteredSessions.map(s => s.serviceRequired))],
        isTrainingMode: activeTab === 'training'
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
  // SECTION 15: EFFECTS
  // ==========================================================================

  useEffect(() => {
    if (showChatOverlay && chatMessages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: '1',
        type: 'clarence',
        content: `Hello ${userInfo?.firstName || 'there'}! I'm CLARENCE, your contract mediation assistant. ${activeTab === 'training' ? 'I see you\'re in Training Mode - great for practicing without any real-world consequences!' : ''} I can help you understand contracts, explain the mediation process, or guide you to start a new session. What would you like to explore today?`,
        timestamp: new Date()
      }
      setChatMessages([welcomeMessage])
    }
  }, [showChatOverlay, chatMessages.length, userInfo, activeTab])

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
  // SECTION 16: EVENT LOGGING
  // ==========================================================================

  useEffect(() => {
    if (userInfo?.userId) {
      eventLogger.setUser(userInfo.userId);
    }
    eventLogger.completed('dashboard', 'dashboard_loaded', {
      userEmail: userInfo?.email,
      company: userInfo?.company
    });
  }, [userInfo]);

  useEffect(() => {
    if (!loading && sessions !== null) {
      eventLogger.completed('dashboard', 'dashboard_data_fetched', {
        totalSessions: sessions.length,
        liveSessions: sessions.filter(s => !s.isTraining).length,
        trainingSessions: sessions.filter(s => s.isTraining).length
      });
    }
  }, [loading, sessions]);

  // ==========================================================================
  // SECTION 17: COMPUTED VALUES
  // ==========================================================================

  const metrics = getMetricsData()

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
  // SECTION 18: RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 19: NAVIGATION HEADER */}
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

            {/* Center: Brand Tagline + Navigation */}
            <div className="hidden md:flex items-center gap-8">

              {/* Navigation Divider */}
              <div className="h-4 w-px bg-slate-600"></div>

              {/* Navigation Links */}
              <div className="flex items-center gap-6">
                <Link
                  href="/auth/contracts-dashboard"
                  className="text-white font-medium text-sm border-b-2 border-emerald-500 pb-1"
                >
                  Dashboard
                </Link>
                <Link
                  href="/auth/contract-prep"
                  className="text-slate-400 hover:text-white font-medium text-sm transition-colors"
                >
                  Contract Prep
                </Link>
              </div>
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-4">
              {/* Feedback Button */}
              <FeedbackButton position="header" />

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

              {/* Notifications */}
              <button className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
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
      {/* SECTION 20: MAIN CONTENT */}
      {/* ================================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome Banner */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">
              Welcome back, {userInfo?.firstName || 'User'}
            </h1>
            <p className="text-slate-500 text-sm">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 21: LIVE / TRAINING TABS */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
          {/* Tab Headers */}
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('live')}
                className={`px-6 py-4 font-medium text-sm transition-colors ${activeTab === 'live'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Live
              </button>
              <button
                onClick={() => setActiveTab('training')}
                className={`px-6 py-4 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'training'
                  ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <span>Training</span>
                <span>🎓</span>
              </button>
            </div>
          </div>

          {/* Training Mode Banner */}
          {activeTab === 'training' && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
              <div className="flex items-center gap-2 text-amber-800">
                <span>⚠️</span>
                <span className="text-sm">
                  <strong>TRAINING MODE</strong> - Sessions here are for practice only.
                  Outcomes are non-binding. Invitations restricted to approved users.
                </span>
              </div>
            </div>
          )}

          {/* Tab Content Header */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">
                {activeTab === 'live' ? 'Your Mediation Sessions' : 'Your Training Sessions'}
              </h2>
              <button
                onClick={createNewSession}
                disabled={isCreatingContract}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'live'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
              >
                {isCreatingContract ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {activeTab === 'live' ? 'Create' : 'Create'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 22: QUICK STATS CARDS */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50/50">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-800">{filteredSessions.length}</div>
                  <div className="text-slate-500 text-xs">Total Sessions</div>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === 'training' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  <svg className={`w-5 h-5 ${activeTab === 'training' ? 'text-amber-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${activeTab === 'training' ? 'text-amber-600' : 'text-blue-600'}`}>
                    {filteredSessions.filter(s => s.status !== 'completed').length}
                  </div>
                  <div className="text-slate-500 text-xs">Active</div>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === 'training' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  <svg className={`w-5 h-5 ${activeTab === 'training' ? 'text-amber-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {filteredSessions.filter(s => s.status === 'completed').length}
                  </div>
                  <div className="text-slate-500 text-xs">Completed</div>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {filteredSessions.reduce((sum, s) => sum + (s.providerBids?.length || 0), 0)}
                  </div>
                  <div className="text-slate-500 text-xs">{activeTab === 'training' ? 'Training Partners' : 'Provider Bids'}</div>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SECTION 23: SESSIONS LIST */}
          {/* ============================================================== */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading sessions...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              /* Empty State */
              <div className="text-center py-12">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${activeTab === 'training' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                  {activeTab === 'training' ? (
                    <span className="text-3xl">🎓</span>
                  ) : (
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2 text-slate-800">
                  {activeTab === 'training' ? 'No training sessions yet' : 'No mediation sessions yet'}
                </h3>
                <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">
                  {activeTab === 'training'
                    ? 'Start a training session to practice negotiations in a risk-free environment.'
                    : 'Create your first contract to begin the intelligent mediation process with CLARENCE.'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={createNewSession}
                    disabled={isCreatingContract}
                    className={`px-6 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'training'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
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
                        {activeTab === 'training' ? 'Start Training' : 'Create New Contract'}
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
                {filteredSessions.map(session => {
                  const actionButton = getSessionActionButton(session)
                  const providerBids = session.providerBids || []
                  const isExpanded = expandedSessions.has(session.sessionId)
                  const hasProviders = providerBids.length > 0
                  const readyProviders = providerBids.filter(b => canNegotiateWithProvider(b))
                  const isTraining = session.isTraining || false

                  return (
                    <div
                      key={session.sessionId}
                      className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all ${isTraining ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      {/* Session Header */}
                      <div className={`p-5 border-b ${isTraining ? 'border-amber-100' : 'border-slate-100'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                {isTraining && <span>🎓</span>}
                                <h3 className="text-lg font-semibold text-slate-800">
                                  {session.sessionNumber || session.sessionId.substring(0, 8)}
                                </h3>
                              </div>
                              <p className="text-slate-500 text-sm">{session.serviceRequired || 'Service type pending'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(session.status, isTraining)}`}>
                              {getStatusDisplayText(session.status)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Split Content Area */}
                      <div className="flex flex-col md:flex-row">
                        {/* Left Side: Contract Details */}
                        <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            {isTraining ? 'Training Details' : 'Contract Details'}
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-slate-400">Customer</span>
                              <p className="font-medium text-slate-700">{session.customerCompany}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400">Deal Value</span>
                              <p className="font-medium text-slate-700">
                                {formatDealValueDisplay(session.dealValue)}
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
                              <span className="text-xs text-slate-400">Industry</span>
                              <p className="font-medium text-slate-700">{session.industry || 'General'}</p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400">Created</span>
                              <p className="font-medium text-slate-700">
                                {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-4">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Progress</span>
                              <span>{session.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${isTraining ? 'bg-amber-500' : 'bg-emerald-600'}`}
                                style={{ width: `${session.progress || 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-4 flex gap-2">
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

                        {/* Right Side: Provider Bids / Training Partners */}
                        <div className="flex-1 p-5 bg-slate-50/50">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                              {isTraining ? `Training Partners (${providerBids.length})` : `Provider Bids (${providerBids.length})`}
                            </h4>
                            {!['created', 'initiated', 'customer_intake_complete', 'completed'].includes(session.status) && (
                              <button
                                onClick={() => router.push(`/auth/invite-providers?session_id=${session.sessionId}&session_number=${session.sessionNumber || ''}`)}
                                className={`text-xs font-medium flex items-center gap-1 cursor-pointer ${isTraining ? 'text-amber-600 hover:text-amber-700' : 'text-purple-600 hover:text-purple-700'
                                  }`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {isTraining ? 'Add Partner' : 'Invite Provider'}
                              </button>
                            )}
                          </div>

                          {!hasProviders ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                              <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {isTraining ? 'No training partners added yet' : 'No providers invited yet'}
                            </div>
                          ) : (
                            <div className="space-y-2">
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
                                          onClick={() => openMediationStudio(session.sessionId, bid.providerId)}
                                          className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${isTraining
                                            ? 'bg-amber-500 hover:bg-amber-600'
                                            : 'bg-slate-700 hover:bg-slate-600'
                                            }`}
                                        >
                                          {isTraining ? 'Practice' : 'Negotiate'}
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

                              {providerBids.length > 2 && (
                                <button
                                  onClick={() => toggleSessionExpand(session.sessionId)}
                                  className="w-full text-center text-xs text-slate-500 hover:text-slate-700 py-2 transition-colors"
                                >
                                  {isExpanded ? (
                                    <>Show less ↑</>
                                  ) : (
                                    <>Show {providerBids.length - 2} more ↓</>
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          {readyProviders.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <p className={`text-xs font-medium ${isTraining ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ✓ {readyProviders.length} {isTraining ? 'partner' : 'provider'}{readyProviders.length > 1 ? 's' : ''} ready to negotiate
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className={`px-5 py-3 border-t flex justify-end gap-2 ${isTraining ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
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

            {/* Footer */}
            {filteredSessions.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
                <span>Showing {filteredSessions.length} {activeTab === 'training' ? 'training' : ''} session{filteredSessions.length !== 1 ? 's' : ''}</span>
                {activeTab === 'live' && (
                  <button className="text-emerald-600 hover:text-emerald-700 font-medium">
                    View Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 24: COLLAPSIBLE METRICS */}
        {/* ================================================================ */}
        {filteredSessions.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeTab === 'training' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <svg className={`w-4 h-4 ${activeTab === 'training' ? 'text-amber-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {activeTab === 'training' ? 'Training Analytics' : 'Session Analytics'}
                  </h3>
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
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-semibold mb-4 text-slate-800">Active vs Completed</h3>
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
                        <Bar dataKey="count" fill={activeTab === 'training' ? '#f59e0b' : '#3b82f6'} radius={[4, 4, 0, 0]} />
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
      </div>

      {/* ================================================================== */}
      {/* SECTION 25: CHAT OVERLAY */}
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
                  <div className="text-xs text-slate-400">Your mediation assistant</div>
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
      {/* SECTION 26: FLOATING CHAT BUTTON */}
      {/* ================================================================== */}
      {!showChatOverlay && (
        <button
          onClick={() => setShowChatOverlay(true)}
          className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg hover:shadow-xl transition-all ${activeTab === 'training'
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
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