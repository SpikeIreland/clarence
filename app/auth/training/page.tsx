'use client'

// ============================================================================
// CLARENCE Training Studio - Lobby Page
// ============================================================================
// File: /app/auth/training/page.tsx
// Purpose: Training mode lobby with clear Single Player vs Multi-Player modes
// Single Player: Pre-built scenarios → Jump straight to negotiation
// Multi-Player: Create contract → Invite training partner (mirrors Live)
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import VideoPlayer, { VideoGrid, useVideos } from '@/lib/video/VideoPlayer'

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
    difficultyLabel: string
    industry: string
    contractType: string
    estimatedDuration: number
    clauseCount: number
    negotiableClauseCount: number
    aiPersonality: 'cooperative' | 'balanced' | 'aggressive'
    learningObjectives: string[]
    isNew?: boolean
    isFeatured?: boolean
    iconEmoji: string
    templateSessionId?: string
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

interface PendingInvitation {
    invitationId: string
    sessionId: string
    contractName: string
    inviterName: string
    inviterEmail: string
    createdAt: string
}

// ============================================================================
// SECTION 3: CONSTANTS & SCENARIO DATA
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const DIFFICULTY_CONFIG = {
    beginner: {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Beginner'
    },
    intermediate: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        label: 'Intermediate'
    },
    advanced: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        label: 'Advanced'
    }
}

const AI_PERSONALITY_CONFIG = {
    cooperative: {
        label: 'Cooperative',
        icon: '🤝',
        color: 'text-emerald-600'
    },
    balanced: {
        label: 'Balanced',
        icon: '⚖️',
        color: 'text-blue-600'
    },
    aggressive: {
        label: 'Aggressive',
        icon: '🔥',
        color: 'text-red-600'
    }
}

const SINGLE_PLAYER_SCENARIOS: TrainingScenario[] = [
    {
        scenarioId: 'bpo-basics-101',
        scenarioName: 'BPO Fundamentals',
        description: 'Learn the core concepts of Business Process Outsourcing negotiations. Focus on liability caps, service levels, and payment terms.',
        difficulty: 'beginner',
        difficultyLabel: 'Beginner',
        industry: 'Business Services',
        contractType: 'BPO Agreement',
        estimatedDuration: 15,
        clauseCount: 8,
        negotiableClauseCount: 5,
        aiPersonality: 'cooperative',
        learningObjectives: [
            'Understand liability cap structures',
            'Navigate service level basics',
            'Practice payment term negotiation'
        ],
        isNew: true,
        isFeatured: true,
        iconEmoji: '🏢'
    },
    {
        scenarioId: 'bpo-service-levels',
        scenarioName: 'BPO Service Level Deep Dive',
        description: 'Master the art of negotiating SLAs, KPIs, and performance credits in an outsourcing context.',
        difficulty: 'intermediate',
        difficultyLabel: 'Intermediate',
        industry: 'Business Services',
        contractType: 'BPO Agreement',
        estimatedDuration: 25,
        clauseCount: 12,
        negotiableClauseCount: 8,
        aiPersonality: 'balanced',
        learningObjectives: [
            'Define meaningful SLA metrics',
            'Structure performance credits',
            'Balance flexibility with accountability'
        ],
        isFeatured: true,
        iconEmoji: '📊'
    },
    {
        scenarioId: 'saas-data-protection',
        scenarioName: 'SaaS Data Protection',
        description: 'Navigate the complexities of data protection, security requirements, and GDPR compliance in software agreements.',
        difficulty: 'intermediate',
        difficultyLabel: 'Intermediate',
        industry: 'Technology',
        contractType: 'SaaS Agreement',
        estimatedDuration: 30,
        clauseCount: 14,
        negotiableClauseCount: 9,
        aiPersonality: 'balanced',
        learningObjectives: [
            'Master data protection clauses',
            'Understand GDPR requirements',
            'Balance security with usability'
        ],
        iconEmoji: '🔐'
    },
    {
        scenarioId: 'saas-liability-battle',
        scenarioName: 'SaaS Liability Showdown',
        description: 'An aggressive provider pushes for minimal liability. Can you protect your interests while keeping the deal alive?',
        difficulty: 'advanced',
        difficultyLabel: 'Advanced',
        industry: 'Technology',
        contractType: 'SaaS Agreement',
        estimatedDuration: 35,
        clauseCount: 10,
        negotiableClauseCount: 6,
        aiPersonality: 'aggressive',
        learningObjectives: [
            'Handle aggressive counterparties',
            'Identify deal breakers',
            'Strategic trade-off decisions'
        ],
        iconEmoji: '⚔️'
    },
    {
        scenarioId: 'msa-complex-terms',
        scenarioName: 'MSA Complex Negotiation',
        description: 'A comprehensive Master Services Agreement with multiple service streams and complex governance structures.',
        difficulty: 'advanced',
        difficultyLabel: 'Advanced',
        industry: 'Professional Services',
        contractType: 'Master Services Agreement',
        estimatedDuration: 45,
        clauseCount: 22,
        negotiableClauseCount: 15,
        aiPersonality: 'balanced',
        learningObjectives: [
            'Manage multi-faceted agreements',
            'Structure governance frameworks',
            'Navigate complex termination rights'
        ],
        iconEmoji: '📋'
    },
    {
        scenarioId: 'nda-quick-fire',
        scenarioName: 'NDA Quick Fire',
        description: 'A fast-paced NDA negotiation. Simple terms, quick decisions. Perfect for warming up.',
        difficulty: 'beginner',
        difficultyLabel: 'Beginner',
        industry: 'General',
        contractType: 'NDA',
        estimatedDuration: 10,
        clauseCount: 5,
        negotiableClauseCount: 4,
        aiPersonality: 'cooperative',
        learningObjectives: [
            'Quick decision making',
            'Core confidentiality concepts',
            'Efficient negotiation flow'
        ],
        iconEmoji: '🔒'
    }
]

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function TrainingStudioPage() {
    const router = useRouter()
    const supabase = createClient()
    const chatEndRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 5: STATE DECLARATIONS
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)

    const [selectedMode, setSelectedMode] = useState<'single' | 'multi' | null>(null)
    const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | null>(null)
    const [isStartingScenario, setIsStartingScenario] = useState(false)
    const [scenarioFilter, setScenarioFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')

    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
    const [pastSessions, setPastSessions] = useState<TrainingSession[]>([])

    const [showChatPanel, setShowChatPanel] = useState(false)
    const [chatMessages, setChatMessages] = useState<{ id: string; type: 'user' | 'clarence'; content: string; timestamp: Date }[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)

    const [activeTab, setActiveTab] = useState<'play' | 'videos' | 'history' | 'progress'>('play')

    // ========================================================================
    // SECTION 6: VIDEO DATA HOOK
    // ========================================================================

    const { videos: featuredVideos } = useVideos({
        category: 'training',
        featuredOnly: true,
        limit: 3
    })

    // ========================================================================
    // SECTION 7: DATA LOADING
    // ========================================================================

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
            const userId = authData.userInfo?.userId

            const { data: sessionsData } = await supabase
                .from('sessions')
                .select('*')
                .eq('is_training', true)
                .eq('customer_id', userId)
                .order('updated_at', { ascending: false })
                .limit(10)

            if (sessionsData) {
                const mapped: TrainingSession[] = sessionsData.map((s: Record<string, unknown>) => ({
                    sessionId: s.session_id as string,
                    sessionNumber: s.session_number as string,
                    scenarioName: (s.contract_name as string) || (s.scenario_name as string) || 'Training Session',
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
        } catch (error) {
            console.error('Error loading training data:', error)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    // ========================================================================
    // SECTION 8: EFFECTS
    // ========================================================================

    useEffect(() => {
        loadUserInfo()
        loadTrainingData()
    }, [loadUserInfo, loadTrainingData])

    useEffect(() => {
        if (showChatPanel && chatMessages.length === 0) {
            setChatMessages([{
                id: '1',
                type: 'clarence',
                content: `Welcome to the Training Studio, ${userInfo?.firstName || 'there'}! 🎓\n\n**Single Player** - Practice against me (CLARENCE AI). Choose a scenario and jump straight into negotiation.\n\n**Multi-Player** - Set up a training contract and invite a colleague to practice together.\n\nWhat would you like to try?`,
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

    // ========================================================================
    // SECTION 9: HANDLERS
    // ========================================================================

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

    async function startSinglePlayerScenario(scenario: TrainingScenario) {
        setIsStartingScenario(true)
        setSelectedScenario(scenario)

        try {
            eventLogger.started('training_session', 'single_player_scenario', {
                scenarioId: scenario.scenarioId,
                difficulty: scenario.difficulty,
                aiPersonality: scenario.aiPersonality
            })

            const response = await fetch(`${API_BASE}/training-start-scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userInfo?.userId,
                    scenarioId: scenario.scenarioId,
                    scenarioName: scenario.scenarioName,
                    aiPersonality: scenario.aiPersonality,
                    contractType: scenario.contractType
                })
            })

            const result = await response.json()

            if (result.success && result.sessionId) {
                router.push(`/auth/training/${result.sessionId}`)
            } else {
                console.error('Failed to start scenario:', result.error)
                alert('Unable to start scenario. Please try again.')
            }
        } catch (error) {
            console.error('Error starting scenario:', error)
            alert('Unable to start scenario. Please try again.')
        } finally {
            setIsStartingScenario(false)
            setSelectedScenario(null)
        }
    }

    function startMultiPlayerSetup() {
        eventLogger.started('training_session', 'multi_player_setup', {})
        router.push('/auth/create-contract?mode=training')
    }

    function resumeSession(sessionId: string) {
        router.push(`/auth/training/${sessionId}`)
    }

    function acceptInvitation(invitation: PendingInvitation) {
        router.push(`/auth/training/${invitation.sessionId}`)
    }

    async function sendChatMessage() {
        if (!chatInput.trim() || isChatLoading) return

        const userMessage = {
            id: Date.now().toString(),
            type: 'user' as const,
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

            setChatMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                type: 'clarence',
                content: data.response || data.message || "I'm here to help! What would you like to practice?",
                timestamp: new Date()
            }])
        } catch (error) {
            console.error('Chat error:', error)
            setChatMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                type: 'clarence',
                content: "I'm having trouble connecting. Please try again.",
                timestamp: new Date()
            }])
        } finally {
            setIsChatLoading(false)
        }
    }

    // ========================================================================
    // SECTION 10: HELPERS
    // ========================================================================

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

    const filteredScenarios = scenarioFilter === 'all'
        ? SINGLE_PLAYER_SCENARIOS
        : SINGLE_PLAYER_SCENARIOS.filter(s => s.difficulty === scenarioFilter)

    // ========================================================================
    // SECTION 11: RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ============================================================ */}
            {/* SECTION 12: TRAINING MODE BANNER */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4">
                <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
                    <span>🎮</span>
                    <span>TRAINING MODE - Practice negotiations in a risk-free environment</span>
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 13: NAVIGATION HEADER */}
            {/* ============================================================ */}
            <header className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-slate-800 tracking-wide">CLARENCE</div>
                                <div className="text-xs text-amber-600">Training Studio</div>
                            </div>
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <Link href="/auth/contracts-dashboard" className="text-slate-500 hover:text-slate-800 text-sm transition-colors">
                                Dashboard
                            </Link>
                            <Link href="/auth/contracts-dashboard" className="text-slate-500 hover:text-slate-800 text-sm transition-colors">
                                Live Contracts
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setShowChatPanel(!showChatPanel)}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                                </svg>
                                Ask CLARENCE
                            </button>

                            <div className="relative user-menu-container">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                        {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                    </div>
                                    <span className="hidden sm:block text-sm text-slate-700">{userInfo?.firstName}</span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                            <Link href="/auth/contracts-dashboard" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
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

            {/* ============================================================ */}
            {/* SECTION 14: MAIN CONTENT */}
            {/* ============================================================ */}
            <main className="container mx-auto px-6 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">🎮 Training Studio</h1>
                    <p className="text-slate-500">Master contract negotiation in a risk-free environment</p>
                </div>

                {/* ======================================================== */}
                {/* SECTION 15: TAB NAVIGATION */}
                {/* ======================================================== */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white border border-slate-200 rounded-xl p-1 inline-flex shadow-sm">
                        <button
                            onClick={() => setActiveTab('play')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'play' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            🎮 Play
                        </button>
                        <button
                            onClick={() => setActiveTab('videos')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'videos' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            📺 Learn
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            📜 History
                            {pastSessions.length > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'history' ? 'bg-amber-600' : 'bg-slate-200 text-slate-600'}`}>
                                    {pastSessions.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('progress')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'progress' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            📊 Progress
                        </button>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* SECTION 16: PLAY TAB */}
                {/* ======================================================== */}
                {activeTab === 'play' && (
                    <div className="space-y-8">
                        {/* Mode Selection Cards */}
                        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                            <div
                                onClick={() => setSelectedMode('single')}
                                className={`relative bg-white rounded-2xl p-6 cursor-pointer transition-all border-2 hover:shadow-lg ${selectedMode === 'single' ? 'border-amber-500 shadow-md' : 'border-slate-200 hover:border-amber-300'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-3xl">
                                        🤖
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-slate-800 mb-1">Single Player</h3>
                                        <p className="text-slate-500 text-sm mb-3">Practice against CLARENCE AI</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Instant Start</span>
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">AI Difficulty Levels</span>
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Pre-built Scenarios</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedMode === 'single' && (
                                    <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <div
                                onClick={() => setSelectedMode('multi')}
                                className={`relative bg-white rounded-2xl p-6 cursor-pointer transition-all border-2 hover:shadow-lg ${selectedMode === 'multi' ? 'border-amber-500 shadow-md' : 'border-slate-200 hover:border-amber-300'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-3xl">
                                        👥
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-slate-800 mb-1">Multi-Player</h3>
                                        <p className="text-slate-500 text-sm mb-3">Practice with a training partner</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Custom Contracts</span>
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Real Counterparty</span>
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Role Swap</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedMode === 'multi' && (
                                    <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ================================================ */}
                        {/* SECTION 17: SINGLE PLAYER SCENARIOS */}
                        {/* ================================================ */}
                        {selectedMode === 'single' && (
                            <div className="mt-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">📚 Scenario Library</h2>
                                        <p className="text-slate-500 text-sm">Select a scenario to start practicing immediately</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(filter => (
                                            <button
                                                key={filter}
                                                onClick={() => setScenarioFilter(filter)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${scenarioFilter === filter ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'}`}
                                            >
                                                {filter === 'all' ? 'All Levels' : DIFFICULTY_CONFIG[filter].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredScenarios.map(scenario => {
                                        const difficulty = DIFFICULTY_CONFIG[scenario.difficulty]
                                        const aiConfig = AI_PERSONALITY_CONFIG[scenario.aiPersonality]

                                        return (
                                            <div key={scenario.scenarioId} className="bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all group">
                                                <div className="p-5">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                                                                {scenario.iconEmoji}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                                                                    {scenario.scenarioName}
                                                                </h3>
                                                                <p className="text-xs text-slate-500">{scenario.contractType}</p>
                                                            </div>
                                                        </div>
                                                        {scenario.isNew && (
                                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">NEW</span>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{scenario.description}</p>

                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>
                                                            {difficulty.label}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-slate-100 ${aiConfig.color}`}>
                                                            {aiConfig.icon} {aiConfig.label} AI
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-xs text-slate-400">
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
                                                            {scenario.negotiableClauseCount} clauses
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                                                    <button
                                                        onClick={() => startSinglePlayerScenario(scenario)}
                                                        disabled={isStartingScenario}
                                                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        {isStartingScenario && selectedScenario?.scenarioId === scenario.scenarioId ? (
                                                            <>
                                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                Starting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                                Play Now
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {filteredScenarios.length === 0 && (
                                    <div className="text-center py-12">
                                        <p className="text-slate-500">No scenarios found for this difficulty level.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ================================================ */}
                        {/* SECTION 18: MULTI-PLAYER */}
                        {/* ================================================ */}
                        {selectedMode === 'multi' && (
                            <div className="mt-8 max-w-2xl mx-auto">
                                <div className="bg-white rounded-xl p-6 mb-6 border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Start a New Training Session</h3>
                                    <p className="text-slate-500 text-sm mb-4">
                                        Create a practice contract and invite a colleague from your organisation to negotiate.
                                    </p>
                                    <button
                                        onClick={startMultiPlayerSetup}
                                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Create Training Contract
                                    </button>
                                </div>

                                <div className="bg-white rounded-xl p-6 border border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Pending Invitations</h3>
                                    {pendingInvitations.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <span className="text-2xl">📬</span>
                                            </div>
                                            <p className="text-slate-500 text-sm">No pending invitations</p>
                                            <p className="text-slate-400 text-xs mt-1">When a colleague invites you to train, it will appear here.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {pendingInvitations.map(inv => (
                                                <div key={inv.invitationId} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                    <div>
                                                        <p className="font-medium text-slate-800">{inv.contractName}</p>
                                                        <p className="text-sm text-slate-500">From {inv.inviterName}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => acceptInvitation(inv)}
                                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium"
                                                    >
                                                        Join Session
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* No Mode Selected */}
                        {!selectedMode && (
                            <div className="text-center py-12">
                                <p className="text-slate-500">👆 Select a mode above to get started</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ======================================================== */}
                {/* SECTION 19: VIDEOS TAB */}
                {/* ======================================================== */}
                {activeTab === 'videos' && (
                    <div className="space-y-8">
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">👋</span>
                                <h2 className="text-lg font-semibold text-slate-800">Getting Started</h2>
                            </div>
                            <VideoGrid category="onboarding" limit={6} />
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">🎓</span>
                                <h2 className="text-lg font-semibold text-slate-800">Training Mode</h2>
                            </div>
                            <VideoGrid category="training" />
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-lg">⚖️</span>
                                <h2 className="text-lg font-semibold text-slate-800">Negotiation Skills</h2>
                            </div>
                            <VideoGrid category="negotiation" limit={6} />
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* SECTION 20: HISTORY TAB */}
                {/* ======================================================== */}
                {activeTab === 'history' && (
                    <div>
                        {pastSessions.length === 0 ? (
                            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">📜</span>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">No training history yet</h3>
                                <p className="text-slate-500 mb-6 text-sm">Complete your first training session to see it here.</p>
                                <button
                                    onClick={() => { setActiveTab('play'); setSelectedMode('single'); }}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-medium"
                                >
                                    Start Training
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pastSessions.map(session => (
                                    <div key={session.sessionId} className="bg-white rounded-xl p-5 border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                                                    {session.counterpartyType === 'ai' ? '🤖' : '👥'}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">{session.scenarioName}</h3>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                        <span>{session.sessionNumber}</span>
                                                        <span>•</span>
                                                        <span>{session.counterpartyType === 'ai' ? `AI (${session.aiMode || 'balanced'})` : session.counterpartyName}</span>
                                                        <span>•</span>
                                                        <span>{formatDate(session.createdAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-slate-700">{session.progress}%</div>
                                                    <div className="w-24 bg-slate-200 rounded-full h-2 mt-1">
                                                        <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${session.progress}%` }} />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => resumeSession(session.sessionId)}
                                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                                                >
                                                    {session.progress === 100 ? 'Review' : 'Continue'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ======================================================== */}
                {/* SECTION 21: PROGRESS TAB */}
                {/* ======================================================== */}
                {activeTab === 'progress' && (
                    <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📊</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Progress Tracking Coming Soon</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                            Track which clauses you negotiate well, see improvement over time, and get personalized recommendations.
                        </p>
                    </div>
                )}
            </main>

            {/* ============================================================ */}
            {/* SECTION 22: CHAT PANEL */}
            {/* ============================================================ */}
            {showChatPanel && (
                <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">
                    <div className="bg-amber-500 text-white p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <span className="font-bold text-sm">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-sm">CLARENCE</div>
                                <div className="text-xs text-amber-100">Training Assistant</div>
                            </div>
                        </div>
                        <button onClick={() => setShowChatPanel(false)} className="text-amber-100 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-amber-50/30">
                        {chatMessages.map(message => (
                            <div key={message.id} className={`mb-4 ${message.type === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block max-w-[85%] ${message.type === 'user' ? 'bg-amber-500 text-white rounded-2xl rounded-br-md px-4 py-2' : 'bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 shadow-sm'}`}>
                                    {message.type === 'clarence' && (
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-amber-600">🎓 CLARENCE</span>
                                        </div>
                                    )}
                                    <p className={`text-sm whitespace-pre-line ${message.type === 'clarence' ? 'text-slate-700' : ''}`}>
                                        {message.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="mb-4">
                                <div className="inline-block bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 shadow-sm">
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
                                placeholder="Ask about training..."
                                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm text-slate-700 placeholder-slate-400"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={isChatLoading || !chatInput.trim()}
                                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 23: FLOATING CHAT BUTTON */}
            {/* ============================================================ */}
            {!showChatPanel && (
                <button
                    onClick={() => setShowChatPanel(true)}
                    className="fixed bottom-6 right-6 bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all border-2 border-white"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                    </svg>
                </button>
            )}
        </div>
    )
}