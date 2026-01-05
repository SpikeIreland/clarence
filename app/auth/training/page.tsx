'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    companyId?: string
    role?: string
    userId?: string
}

interface TrainingScenario {
    scenarioId: string
    scenarioName: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    industry: string
    contractType: string
    estimatedDuration: number // minutes
    clauseCount: number
    learningObjectives: string[]
    isNew?: boolean
    completedByUser?: boolean
}

interface ApprovedTrainingUser {
    id: string
    userId: string
    userName: string
    userEmail: string
    company: string
    approvalType: 'training_partner' | 'training_admin' | 'ai_enabled'
    status: 'active' | 'inactive' | 'expired'
}

interface TrainingSession {
    sessionId: string
    sessionNumber: string
    scenarioName: string
    counterpartyType: 'ai' | 'partner'
    counterpartyName: string
    aiMode?: 'cooperative' | 'balanced' | 'aggressive'
    status: string
    progress: number
    createdAt: string
    lastActivityAt: string
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

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const DIFFICULTY_COLORS = {
    beginner: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Beginner' },
    intermediate: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Intermediate' },
    advanced: { bg: 'bg-red-100', text: 'text-red-700', label: 'Advanced' }
}

const AI_MODES = [
    {
        value: 'cooperative',
        label: 'Cooperative',
        description: 'AI accepts reasonable proposals quickly',
        icon: '😊',
        recommended: true
    },
    {
        value: 'balanced',
        label: 'Balanced',
        description: 'AI negotiates fairly with some pushback',
        icon: '🤝',
        recommended: false
    },
    {
        value: 'aggressive',
        label: 'Aggressive',
        description: 'AI pushes hard and rarely concedes',
        icon: '😤',
        recommended: false
    }
]

// Sample scenarios (will be replaced with database data)
const SAMPLE_SCENARIOS: TrainingScenario[] = [
    {
        scenarioId: 'scenario-1',
        scenarioName: 'BPO Services Agreement - Basics',
        description: 'Learn the fundamentals of negotiating a Business Process Outsourcing contract. Perfect for beginners.',
        difficulty: 'beginner',
        industry: 'Business Services',
        contractType: 'BPO Agreement',
        estimatedDuration: 20,
        clauseCount: 12,
        learningObjectives: [
            'Understand liability cap structures',
            'Navigate service level agreements',
            'Handle payment terms negotiation'
        ],
        isNew: true
    },
    {
        scenarioId: 'scenario-2',
        scenarioName: 'IT Services Contract - Data Protection Focus',
        description: 'Practice negotiating data protection and security clauses in an IT services context.',
        difficulty: 'intermediate',
        industry: 'Technology',
        contractType: 'IT Services',
        estimatedDuration: 35,
        clauseCount: 18,
        learningObjectives: [
            'Master data protection clause negotiation',
            'Understand GDPR compliance requirements',
            'Balance security with operational flexibility'
        ]
    },
    {
        scenarioId: 'scenario-3',
        scenarioName: 'Complex Multi-Party SaaS Deal',
        description: 'Advanced scenario with multiple stakeholders and competing interests. Tests your strategic thinking.',
        difficulty: 'advanced',
        industry: 'Technology',
        contractType: 'SaaS Agreement',
        estimatedDuration: 60,
        clauseCount: 28,
        learningObjectives: [
            'Manage multi-party negotiations',
            'Strategic trade-off decisions',
            'Complex termination scenarios'
        ]
    }
]

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function TrainingStudioPage() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Get session ID from URL if present (for active training sessions)
    const activeSessionId = params?.sessionId as string | undefined

    // ==========================================================================
    // SECTION 5: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)

    // Scenarios & Partners
    const [scenarios, setScenarios] = useState<TrainingScenario[]>(SAMPLE_SCENARIOS)
    const [approvedPartners, setApprovedPartners] = useState<ApprovedTrainingUser[]>([])
    const [pastSessions, setPastSessions] = useState<TrainingSession[]>([])

    // Session creation flow
    const [showNewSessionModal, setShowNewSessionModal] = useState(false)
    const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null)
    const [counterpartyType, setCounterpartyType] = useState<'ai' | 'partner'>('ai')
    const [selectedAiMode, setSelectedAiMode] = useState<'cooperative' | 'balanced' | 'aggressive'>('cooperative')
    const [selectedPartner, setSelectedPartner] = useState<ApprovedTrainingUser | null>(null)
    const [isCreatingSession, setIsCreatingSession] = useState(false)

    // Chat state
    const [showChatPanel, setShowChatPanel] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)

    // View state
    const [activeTab, setActiveTab] = useState<'scenarios' | 'history' | 'progress'>('scenarios')

    // ==========================================================================
    // SECTION 6: AUTHENTICATION & DATA LOADING
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

    const loadTrainingData = useCallback(async () => {
        try {
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) return

            const authData = JSON.parse(auth)
            const companyId = authData.userInfo?.companyId

            // Load approved training partners
            const { data: partnersData } = await supabase
                .from('approved_training_users')
                .select(`
          id,
          user_id,
          approval_type,
          status,
          users:user_id (
            first_name,
            last_name,
            email,
            company_name
          )
        `)
                .eq('company_id', companyId)
                .eq('status', 'active')

            if (partnersData) {
                const mapped: ApprovedTrainingUser[] = partnersData.map((p: Record<string, unknown>) => {
                    const user = p.users as Record<string, string> | null
                    return {
                        id: p.id as string,
                        userId: p.user_id as string,
                        userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                        userEmail: user?.email || '',
                        company: user?.company_name || '',
                        approvalType: p.approval_type as 'training_partner' | 'training_admin' | 'ai_enabled',
                        status: p.status as 'active' | 'inactive' | 'expired'
                    }
                })
                setApprovedPartners(mapped)
            }

            // Load past training sessions
            const { data: sessionsData } = await supabase
                .from('sessions')
                .select('*')
                .eq('is_training', true)
                .eq('customer_id', authData.userInfo?.userId)
                .order('updated_at', { ascending: false })
                .limit(10)

            if (sessionsData) {
                const mapped: TrainingSession[] = sessionsData.map((s: Record<string, unknown>) => ({
                    sessionId: s.session_id as string,
                    sessionNumber: s.session_number as string,
                    scenarioName: (s.scenario_name as string) || 'Custom Training',
                    counterpartyType: (s.counterparty_type as 'ai' | 'partner') || 'ai',
                    counterpartyName: (s.counterparty_name as string) || 'CLARENCE AI',
                    aiMode: s.ai_mode as 'cooperative' | 'balanced' | 'aggressive' | undefined,
                    status: s.status as string,
                    progress: (s.progress as number) || 0,
                    createdAt: s.created_at as string,
                    lastActivityAt: s.updated_at as string
                }))
                setPastSessions(mapped)
            }

            // TODO: Load scenarios from database when available
            // For now, using SAMPLE_SCENARIOS

        } catch (error) {
            console.error('Error loading training data:', error)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 7: SIGN OUT
    // ==========================================================================

    async function handleSignOut() {
        try {
            await supabase.auth.signOut()
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        } catch (error) {
            console.error('Sign out error:', error)
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        }
    }

    // ==========================================================================
    // SECTION 8: SESSION CREATION
    // ==========================================================================

    async function startNewTrainingSession() {
        if (!selectedScenario) {
            alert('Please select a scenario first')
            return
        }

        if (counterpartyType === 'partner' && !selectedPartner) {
            alert('Please select a training partner')
            return
        }

        setIsCreatingSession(true)

        try {
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) {
                router.push('/auth/login')
                return
            }

            const authData = JSON.parse(auth)

            eventLogger.started('training_session', 'create_session', {
                scenarioId: selectedScenario.scenarioId,
                counterpartyType,
                aiMode: selectedAiMode
            })

            const response = await fetch(`${API_BASE}/session-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: authData.userInfo?.userId,
                    userEmail: authData.userInfo?.email,
                    companyName: authData.userInfo?.company,
                    userName: `${authData.userInfo?.firstName || ''} ${authData.userInfo?.lastName || ''}`.trim(),
                    isTraining: true,
                    // Training-specific fields
                    scenarioId: selectedScenario.scenarioId,
                    scenarioName: selectedScenario.scenarioName,
                    counterpartyType,
                    counterpartyUserId: selectedPartner?.userId,
                    counterpartyName: counterpartyType === 'ai'
                        ? `CLARENCE AI (${selectedAiMode})`
                        : selectedPartner?.userName,
                    aiMode: counterpartyType === 'ai' ? selectedAiMode : null
                })
            })

            if (response.ok) {
                const data = await response.json()

                eventLogger.completed('training_session', 'create_session', {
                    sessionId: data.sessionId
                })

                // Close modal and navigate to the training session
                setShowNewSessionModal(false)
                router.push(`/training/${data.sessionId}`)
            } else {
                throw new Error('Failed to create training session')
            }
        } catch (error) {
            console.error('Error creating training session:', error)
            alert('Failed to create training session. Please try again.')
        } finally {
            setIsCreatingSession(false)
        }
    }

    // ==========================================================================
    // SECTION 9: CHAT FUNCTIONS
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
            const response = await fetch(`${API_BASE}/clarence-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: chatInput,
                    context: 'training_studio',
                    userId: userInfo?.userId || 'unknown',
                    isTrainingMode: true
                })
            })

            const data = await response.json()

            const clarenceMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'clarence',
                content: data.response || data.message || "I'm here to help you learn! What would you like to practice today?",
                timestamp: new Date()
            }

            setChatMessages(prev => [...prev, clarenceMessage])
        } catch (error) {
            console.error('Chat error:', error)
            setChatMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                type: 'clarence',
                content: "I'm having trouble connecting right now. Please try again.",
                timestamp: new Date()
            }])
        } finally {
            setIsChatLoading(false)
        }
    }

    // ==========================================================================
    // SECTION 10: EFFECTS
    // ==========================================================================

    useEffect(() => {
        loadUserInfo()
        loadTrainingData()
    }, [loadUserInfo, loadTrainingData])

    useEffect(() => {
        if (showChatPanel && chatMessages.length === 0) {
            setChatMessages([{
                id: '1',
                type: 'clarence',
                content: `Welcome to Training Mode, ${userInfo?.firstName || 'there'}! 🎓\n\nThis is a safe space to practice negotiations without any real-world consequences. I can be your training partner, or you can practice with an approved colleague.\n\nWould you like me to recommend a scenario based on your experience level?`,
                timestamp: new Date()
            }])
        }
    }, [showChatPanel, chatMessages.length, userInfo])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

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
    // SECTION 11: HELPER FUNCTIONS
    // ==========================================================================

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    function formatDuration(minutes: number): string {
        if (minutes < 60) return `${minutes} min`
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }

    // ==========================================================================
    // SECTION 12: RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-amber-50/30">
            {/* ================================================================== */}
            {/* SECTION 13: TRAINING MODE BANNER */}
            {/* ================================================================== */}
            <div className="bg-amber-500 text-white py-2 px-4">
                <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
                    <span>🎓</span>
                    <span>TRAINING MODE - Sessions are for practice only. Outcomes are non-binding.</span>
                </div>
            </div>

            {/* ================================================================== */}
            {/* SECTION 14: NAVIGATION HEADER */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo & Brand */}
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-amber-400">Training Mode</div>
                            </div>
                        </Link>

                        {/* Center: Navigation Links */}
                        <div className="hidden md:flex items-center gap-6">
                            <Link
                                href="/dashboard"
                                className="text-slate-400 hover:text-white font-medium text-sm transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/auth/contracts"
                                className="text-slate-400 hover:text-white font-medium text-sm transition-colors"
                            >
                                Contract Studio
                            </Link>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-4">
                            {/* Ask CLARENCE */}
                            <button
                                onClick={() => setShowChatPanel(!showChatPanel)}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm transition-colors"
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
                                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                        {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                    </div>
                                    <span className="hidden sm:block text-sm">{userInfo?.firstName}</span>
                                    <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {showUserMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <div className="font-medium text-slate-800">{userInfo?.firstName} {userInfo?.lastName}</div>
                                            <div className="text-sm text-slate-500">{userInfo?.email}</div>
                                        </div>
                                        <div className="py-2">
                                            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                </svg>
                                                Exit Training
                                            </Link>
                                        </div>
                                        <div className="border-t border-slate-100 pt-2">
                                            <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
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
            {/* SECTION 15: MAIN CONTENT */}
            {/* ================================================================== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                            <span>🎓</span>
                            Training Studio
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Practice negotiations in a risk-free environment
                        </p>
                    </div>
                    <button
                        onClick={() => setShowNewSessionModal(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Start Training
                    </button>
                </div>

                {/* ================================================================ */}
                {/* SECTION 16: TAB NAVIGATION */}
                {/* ================================================================ */}
                <div className="border-b border-slate-200 mb-6">
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('scenarios')}
                            className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'scenarios'
                                ? 'text-amber-600 border-b-2 border-amber-600'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Scenarios
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'history'
                                ? 'text-amber-600 border-b-2 border-amber-600'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Past Sessions
                        </button>
                        <button
                            onClick={() => setActiveTab('progress')}
                            className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'progress'
                                ? 'text-amber-600 border-b-2 border-amber-600'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            My Progress
                        </button>
                    </div>
                </div>

                {/* ================================================================ */}
                {/* SECTION 17: SCENARIOS TAB */}
                {/* ================================================================ */}
                {activeTab === 'scenarios' && (
                    <div className="space-y-6">
                        {/* Quick Start Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div
                                onClick={() => {
                                    setSelectedScenario(scenarios.find(s => s.difficulty === 'beginner') || null)
                                    setShowNewSessionModal(true)
                                }}
                                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-xl">
                                        🌱
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">Quick Start</h3>
                                        <p className="text-xs text-slate-500">Perfect for beginners</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600">Jump into a simple scenario and learn the basics.</p>
                            </div>

                            <div
                                onClick={() => {
                                    setCounterpartyType('ai')
                                    setSelectedAiMode('cooperative')
                                    setShowNewSessionModal(true)
                                }}
                                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                                        🤖
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">Practice with AI</h3>
                                        <p className="text-xs text-slate-500">CLARENCE as counterparty</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600">Train against our AI with adjustable difficulty.</p>
                            </div>

                            <div
                                onClick={() => {
                                    setCounterpartyType('partner')
                                    setShowNewSessionModal(true)
                                }}
                                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">
                                        👥
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">Train with Colleague</h3>
                                        <p className="text-xs text-slate-500">Approved partners only</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600">Practice with an approved training partner.</p>
                            </div>
                        </div>

                        {/* Scenarios List */}
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">All Scenarios</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {scenarios.map(scenario => {
                                const difficulty = DIFFICULTY_COLORS[scenario.difficulty]
                                return (
                                    <div
                                        key={scenario.scenarioId}
                                        className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all overflow-hidden"
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-slate-800">{scenario.scenarioName}</h3>
                                                        {scenario.isNew && (
                                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">NEW</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{scenario.industry}</span>
                                                        <span>•</span>
                                                        <span>{scenario.contractType}</span>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>
                                                    {difficulty.label}
                                                </span>
                                            </div>

                                            <p className="text-sm text-slate-600 mb-4">{scenario.description}</p>

                                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {formatDuration(scenario.estimatedDuration)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    {scenario.clauseCount} clauses
                                                </span>
                                            </div>

                                            {/* Learning Objectives */}
                                            <div className="border-t border-slate-100 pt-4">
                                                <p className="text-xs font-medium text-slate-500 mb-2">You'll learn:</p>
                                                <ul className="space-y-1">
                                                    {scenario.learningObjectives.slice(0, 2).map((obj, i) => (
                                                        <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                                                            <span className="text-amber-500">✓</span>
                                                            {obj}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                                            <button
                                                onClick={() => {
                                                    setSelectedScenario(scenario)
                                                    setShowNewSessionModal(true)
                                                }}
                                                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Start This Scenario
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ================================================================ */}
                {/* SECTION 18: HISTORY TAB */}
                {/* ================================================================ */}
                {activeTab === 'history' && (
                    <div>
                        {pastSessions.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">🎓</span>
                                </div>
                                <h3 className="text-lg font-semibold mb-2 text-slate-800">No training sessions yet</h3>
                                <p className="text-slate-500 mb-6 text-sm">Start your first training session to begin learning!</p>
                                <button
                                    onClick={() => setShowNewSessionModal(true)}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-medium text-sm"
                                >
                                    Start Training
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pastSessions.map(session => (
                                    <div
                                        key={session.sessionId}
                                        className="bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-300 transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-slate-800">{session.scenarioName}</h3>
                                                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                    <span>{session.sessionNumber}</span>
                                                    <span>•</span>
                                                    <span>{session.counterpartyType === 'ai' ? `AI (${session.aiMode})` : session.counterpartyName}</span>
                                                    <span>•</span>
                                                    <span>{formatDate(session.createdAt)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-slate-700">{session.progress}%</div>
                                                    <div className="w-24 bg-slate-200 rounded-full h-2 mt-1">
                                                        <div
                                                            className="bg-amber-500 h-2 rounded-full"
                                                            style={{ width: `${session.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => router.push(`/training/${session.sessionId}`)}
                                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                                                >
                                                    Continue
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ================================================================ */}
                {/* SECTION 19: PROGRESS TAB */}
                {/* ================================================================ */}
                {activeTab === 'progress' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">Progress Tracking Coming Soon</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                            Soon you'll be able to track which clauses you negotiate well, see your improvement over time, and get personalized learning recommendations.
                        </p>
                    </div>
                )}
            </div>

            {/* ================================================================== */}
            {/* SECTION 20: NEW SESSION MODAL */}
            {/* ================================================================== */}
            {showNewSessionModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-amber-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🎓</span>
                                    <h2 className="text-lg font-semibold text-slate-800">Start Training Session</h2>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowNewSessionModal(false)
                                        setSelectedScenario(null)
                                        setSelectedPartner(null)
                                    }}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Step 1: Select Scenario */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">1. Choose a Scenario</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {scenarios.map(scenario => {
                                        const difficulty = DIFFICULTY_COLORS[scenario.difficulty]
                                        const isSelected = selectedScenario?.scenarioId === scenario.scenarioId
                                        return (
                                            <button
                                                key={scenario.scenarioId}
                                                onClick={() => setSelectedScenario(scenario)}
                                                className={`text-left p-4 rounded-lg border-2 transition-all ${isSelected
                                                    ? 'border-amber-500 bg-amber-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-slate-800">{scenario.scenarioName}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {formatDuration(scenario.estimatedDuration)} • {scenario.clauseCount} clauses
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>
                                                        {difficulty.label}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Step 2: Select Counterparty */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">2. Who will you train with?</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setCounterpartyType('ai')}
                                        className={`p-4 rounded-lg border-2 transition-all ${counterpartyType === 'ai'
                                            ? 'border-amber-500 bg-amber-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="text-2xl mb-2">🤖</div>
                                        <div className="font-medium text-slate-800">CLARENCE AI</div>
                                        <div className="text-xs text-slate-500">Instant feedback</div>
                                    </button>
                                    <button
                                        onClick={() => setCounterpartyType('partner')}
                                        className={`p-4 rounded-lg border-2 transition-all ${counterpartyType === 'partner'
                                            ? 'border-amber-500 bg-amber-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="text-2xl mb-2">👥</div>
                                        <div className="font-medium text-slate-800">Training Partner</div>
                                        <div className="text-xs text-slate-500">Practice together</div>
                                    </button>
                                </div>
                            </div>

                            {/* AI Mode Selection */}
                            {counterpartyType === 'ai' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">3. AI Difficulty</h3>
                                    <div className="space-y-2">
                                        {AI_MODES.map(mode => (
                                            <button
                                                key={mode.value}
                                                onClick={() => setSelectedAiMode(mode.value as typeof selectedAiMode)}
                                                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedAiMode === mode.value
                                                    ? 'border-amber-500 bg-amber-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{mode.icon}</span>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-slate-800 flex items-center gap-2">
                                                            {mode.label}
                                                            {mode.recommended && (
                                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Recommended</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{mode.description}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Partner Selection */}
                            {counterpartyType === 'partner' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">3. Select Training Partner</h3>
                                    {approvedPartners.length === 0 ? (
                                        <div className="p-4 bg-slate-50 rounded-lg text-center">
                                            <p className="text-sm text-slate-600 mb-2">No approved training partners yet.</p>
                                            <p className="text-xs text-slate-500">Contact your administrator to add training partners.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {approvedPartners.map(partner => (
                                                <button
                                                    key={partner.id}
                                                    onClick={() => setSelectedPartner(partner)}
                                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${selectedPartner?.id === partner.id
                                                        ? 'border-amber-500 bg-amber-50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="font-medium text-slate-800">{partner.userName}</div>
                                                    <div className="text-xs text-slate-500">{partner.userEmail}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowNewSessionModal(false)
                                    setSelectedScenario(null)
                                    setSelectedPartner(null)
                                }}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={startNewTrainingSession}
                                disabled={!selectedScenario || isCreatingSession || (counterpartyType === 'partner' && !selectedPartner)}
                                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isCreatingSession ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Creating...
                                    </>
                                ) : (
                                    'Start Training'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================== */}
            {/* SECTION 21: CHAT PANEL */}
            {/* ================================================================== */}
            {showChatPanel && (
                <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col">
                    <div className="bg-amber-600 text-white p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <span className="font-bold text-sm">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-sm">CLARENCE</div>
                                <div className="text-xs text-amber-200">Training Assistant</div>
                            </div>
                        </div>
                        <button onClick={() => setShowChatPanel(false)} className="text-amber-200 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-amber-50/50">
                        {chatMessages.map(message => (
                            <div key={message.id} className={`mb-4 ${message.type === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block max-w-[85%] ${message.type === 'user'
                                    ? 'bg-amber-600 text-white rounded-2xl rounded-br-md px-4 py-2'
                                    : 'bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200'
                                    }`}>
                                    {message.type === 'clarence' && (
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-amber-600">🎓 CLARENCE</span>
                                        </div>
                                    )}
                                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="mb-4">
                                <div className="inline-block bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                placeholder="Ask about training scenarios..."
                                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={isChatLoading || !chatInput.trim()}
                                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================== */}
            {/* SECTION 22: FLOATING CHAT BUTTON */}
            {/* ================================================================== */}
            {!showChatPanel && (
                <button
                    onClick={() => setShowChatPanel(true)}
                    className="fixed bottom-6 right-6 bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                    </svg>
                </button>
            )}
        </div>
    )
}