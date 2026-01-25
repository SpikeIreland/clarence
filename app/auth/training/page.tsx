'use client'

// ============================================================================
// CLARENCE Training Studio - Lobby Page (Updated with Character Integration)
// ============================================================================
// File: /app/auth/training/page.tsx
// Purpose: Training mode lobby with authorization, character selection, and scenarios
// Version: 3.0 - Database-driven characters + authorization checks
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
import FeedbackButton from '@/app/components/FeedbackButton'


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

// NEW: Training Approval interface
interface TrainingApproval {
    approvalId: string
    companyId: string
    userId: string
    status: 'pending' | 'approved' | 'rejected' | 'expired'
    approvedUntil: string | null
    maxTrainingSessions: number | null
    sessionsCompleted: number
    allowedContractTypes: string[] | null
    trainingLevel: 'beginner' | 'intermediate' | 'advanced'
    requestedAt: string
    reviewedAt: string | null
}

// NEW: Training Character interface (from database)
interface TrainingCharacter {
    characterId: string
    characterName: string
    characterTitle: string
    companyName: string
    companyTagline: string
    companyDescription: string
    industry: string
    companySize: string
    yearsInBusiness: number
    headquartersLocation: string
    avatarUrl: string | null
    avatarInitials: string
    companyLogoUrl: string | null
    themeColor: string
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
    difficultyOrder: number
    difficultyLabel: string
    personalityType: 'cooperative' | 'balanced' | 'aggressive'
    negotiationStyle: string
    strengths: string[]
    weaknesses: string[]
    baseLeverageCustomer: number
    baseLeverageProvider: number
    personalityPrompt: string
    sampleQuotes: string[]
    greetingMessage: string
    victoryMessage: string
    defeatMessage: string
    agreementMessage: string
    backstory: string
    negotiationPhilosophy: string
    funFact: string
    isActive: boolean
    displayOrder: number
}

// NEW: Training Scenario interface (from database)
interface TrainingScenario {
    scenarioId: string
    scenarioName: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    industry: string
    contractType: string
    estimatedDuration: number
    clauseCount: number
    learningObjectives: string[]
    scenarioData: Record<string, unknown>
    isActive: boolean
    isFeatured: boolean
    isNew: boolean
    displayOrder: number
    timesStarted: number
    timesCompleted: number
    avgCompletionTime: number | null
}

interface TrainingSession {
    sessionId: string
    sessionNumber: string
    scenarioName: string
    counterpartyType: 'ai' | 'partner'
    counterpartyName: string
    characterId?: string
    characterName?: string
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

const DIFFICULTY_CONFIG = {
    beginner: {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        gradient: 'from-emerald-500 to-emerald-600',
        label: 'Beginner',
        icon: '🟢'
    },
    intermediate: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        gradient: 'from-amber-500 to-amber-600',
        label: 'Intermediate',
        icon: '🟡'
    },
    advanced: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        gradient: 'from-red-500 to-red-600',
        label: 'Advanced',
        icon: '🔴'
    }
}

const PERSONALITY_CONFIG = {
    cooperative: {
        label: 'Cooperative',
        icon: '🤝',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100'
    },
    balanced: {
        label: 'Balanced',
        icon: '⚖️',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100'
    },
    aggressive: {
        label: 'Aggressive',
        icon: '🔥',
        color: 'text-red-600',
        bgColor: 'bg-red-100'
    }
}

const THEME_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
    emerald: {
        bg: 'bg-emerald-500',
        border: 'border-emerald-300',
        text: 'text-emerald-700',
        gradient: 'from-emerald-500 to-emerald-600'
    },
    amber: {
        bg: 'bg-amber-500',
        border: 'border-amber-300',
        text: 'text-amber-700',
        gradient: 'from-amber-500 to-amber-600'
    },
    rose: {
        bg: 'bg-rose-500',
        border: 'border-rose-300',
        text: 'text-rose-700',
        gradient: 'from-rose-500 to-rose-600'
    },
    blue: {
        bg: 'bg-blue-500',
        border: 'border-blue-300',
        text: 'text-blue-700',
        gradient: 'from-blue-500 to-blue-600'
    },
    violet: {
        bg: 'bg-violet-500',
        border: 'border-violet-300',
        text: 'text-violet-700',
        gradient: 'from-violet-500 to-violet-600'
    }
}

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

    // User & Auth State
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [showUserMenu, setShowUserMenu] = useState(false)

    // NEW: Authorization State
    const [approval, setApproval] = useState<TrainingApproval | null>(null)
    const [isCheckingApproval, setIsCheckingApproval] = useState(true)
    const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null)

    // Tab & Mode State
    const [activeTab, setActiveTab] = useState<'play' | 'videos' | 'history' | 'progress'>('play')
    const [selectedMode, setSelectedMode] = useState<'single' | 'multi' | null>(null)

    // NEW: Character Selection State
    const [characters, setCharacters] = useState<TrainingCharacter[]>([])
    const [selectedCharacter, setSelectedCharacter] = useState<TrainingCharacter | null>(null)
    const [loadingCharacters, setLoadingCharacters] = useState(false)

    // NEW: Scenario State (database-driven)
    const [scenarios, setScenarios] = useState<TrainingScenario[]>([])
    const [loadingScenarios, setLoadingScenarios] = useState(false)
    const [scenarioFilter, setScenarioFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')

    // Session State
    const [pastSessions, setPastSessions] = useState<TrainingSession[]>([])
    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
    const [isStartingSession, setIsStartingSession] = useState(false)

    // Chat State
    const [showChatPanel, setShowChatPanel] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            type: 'clarence',
            content: "Welcome to Training Studio! 🎓\n\nI'm here to help you practice your negotiation skills. Choose Single Player to face AI opponents, or Multi-Player to practice with a colleague.\n\nWhat would you like to work on today?",
            timestamp: new Date()
        }
    ])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)

    // ========================================================================
    // SECTION 6: AUTHORIZATION CHECK
    // ========================================================================

    const checkAuthorization = useCallback(async (userId: string, companyId: string) => {
        try {
            console.log('[Training] Checking authorization for user:', userId)

            const { data, error } = await supabase
                .from('training_approvals')
                .select('*')
                .eq('user_id', userId)
                .eq('company_id', companyId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    // No record found - user hasn't requested access
                    setAccessDeniedReason('no_request')
                    return null
                }
                throw error
            }

            // Check approval status
            if (data.status !== 'approved') {
                setAccessDeniedReason(data.status) // 'pending', 'rejected'
                return null
            }

            // Check expiry
            if (data.approved_until && new Date(data.approved_until) < new Date()) {
                setAccessDeniedReason('expired')
                return null
            }

            // Check session limit
            if (data.max_training_sessions !== null &&
                data.sessions_completed >= data.max_training_sessions) {
                setAccessDeniedReason('session_limit')
                return null
            }

            // Transform to interface
            const approval: TrainingApproval = {
                approvalId: data.approval_id,
                companyId: data.company_id,
                userId: data.user_id,
                status: data.status,
                approvedUntil: data.approved_until,
                maxTrainingSessions: data.max_training_sessions,
                sessionsCompleted: data.sessions_completed,
                allowedContractTypes: data.allowed_contract_types,
                trainingLevel: data.training_level || 'beginner',
                requestedAt: data.requested_at,
                reviewedAt: data.reviewed_at
            }

            return approval

        } catch (error) {
            console.error('[Training] Authorization check error:', error)
            setAccessDeniedReason('error')
            return null
        }
    }, [supabase])

    // ========================================================================
    // SECTION 6B: SIGN OUT HANDLER
    // ========================================================================

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut()
            router.push('/auth/login')
        } catch (error) {
            console.error('Sign out error:', error)
            router.push('/auth/login')
        }
    }

    // ========================================================================
    // SECTION 7: LOAD CHARACTERS (filtered by training level)
    // ========================================================================

    const loadCharacters = useCallback(async (trainingLevel: string) => {
        setLoadingCharacters(true)
        try {
            console.log('[Training] Loading characters for level:', trainingLevel)

            // Determine which difficulty levels the user can access
            const allowedLevels = trainingLevel === 'advanced'
                ? ['beginner', 'intermediate', 'advanced']
                : trainingLevel === 'intermediate'
                    ? ['beginner', 'intermediate']
                    : ['beginner']

            const { data, error } = await supabase
                .from('training_characters')
                .select('*')
                .eq('is_active', true)
                .in('difficulty_level', allowedLevels)
                .order('difficulty_order', { ascending: true })
                .order('display_order', { ascending: true })

            if (error) throw error

            const mappedCharacters: TrainingCharacter[] = (data || []).map(c => ({
                characterId: c.character_id,
                characterName: c.character_name,
                characterTitle: c.character_title,
                companyName: c.company_name,
                companyTagline: c.company_tagline,
                companyDescription: c.company_description,
                industry: c.industry,
                companySize: c.company_size,
                yearsInBusiness: c.years_in_business,
                headquartersLocation: c.headquarters_location,
                avatarUrl: c.avatar_url,
                avatarInitials: c.avatar_initials,
                companyLogoUrl: c.company_logo_url,
                themeColor: c.theme_color,
                difficultyLevel: c.difficulty_level,
                difficultyOrder: c.difficulty_order,
                difficultyLabel: c.difficulty_label,
                personalityType: c.personality_type,
                negotiationStyle: c.negotiation_style,
                strengths: c.strengths || [],
                weaknesses: c.weaknesses || [],
                baseLeverageCustomer: c.base_leverage_customer,
                baseLeverageProvider: c.base_leverage_provider,
                personalityPrompt: c.personality_prompt,
                sampleQuotes: c.sample_quotes || [],
                greetingMessage: c.greeting_message,
                victoryMessage: c.victory_message,
                defeatMessage: c.defeat_message,
                agreementMessage: c.agreement_message,
                backstory: c.backstory,
                negotiationPhilosophy: c.negotiation_philosophy,
                funFact: c.fun_fact,
                isActive: c.is_active,
                displayOrder: c.display_order
            }))

            console.log('[Training] Loaded characters:', mappedCharacters.length)
            setCharacters(mappedCharacters)

        } catch (error) {
            console.error('[Training] Error loading characters:', error)
        } finally {
            setLoadingCharacters(false)
        }
    }, [supabase])

    // ========================================================================
    // SECTION 8: LOAD SCENARIOS (filtered by contract types)
    // ========================================================================

    const loadScenarios = useCallback(async (allowedContractTypes: string[] | null) => {
        setLoadingScenarios(true)
        try {
            console.log('[Training] Loading scenarios, allowed types:', allowedContractTypes)

            let query = supabase
                .from('training_scenarios')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            // If contract types are restricted, filter
            if (allowedContractTypes && allowedContractTypes.length > 0) {
                query = query.in('contract_type', allowedContractTypes)
            }

            const { data, error } = await query

            if (error) throw error

            const mappedScenarios: TrainingScenario[] = (data || []).map(s => ({
                scenarioId: s.scenario_id,
                scenarioName: s.scenario_name,
                description: s.description,
                difficulty: s.difficulty,
                industry: s.industry,
                contractType: s.contract_type,
                estimatedDuration: s.estimated_duration,
                clauseCount: s.clause_count,
                learningObjectives: s.learning_objectives || [],
                scenarioData: s.scenario_data || {},
                isActive: s.is_active,
                isFeatured: s.is_featured,
                isNew: s.is_new,
                displayOrder: s.display_order,
                timesStarted: s.times_started,
                timesCompleted: s.times_completed,
                avgCompletionTime: s.avg_completion_time
            }))

            console.log('[Training] Loaded scenarios:', mappedScenarios.length)
            setScenarios(mappedScenarios)

        } catch (error) {
            console.error('[Training] Error loading scenarios:', error)
        } finally {
            setLoadingScenarios(false)
        }
    }, [supabase])

    // ========================================================================
    // SECTION 9: LOAD PAST SESSIONS
    // ========================================================================

    const loadPastSessions = useCallback(async (userId: string) => {
        try {
            // Join sessions with training_session_details
            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    session_id,
                    session_number,
                    status,
                    created_at,
                    updated_at,
                    training_session_details (
                        scenario_name,
                        counterparty_type,
                        counterparty_name,
                        character_id,
                        ai_mode,
                        outcome,
                        negotiation_score
                    )
                `)
                .eq('is_training', true)
                .eq('customer_id', userId)
                .order('updated_at', { ascending: false })
                .limit(20)

            if (error) throw error

            const mappedSessions: TrainingSession[] = (data || []).map(s => {
                const details = Array.isArray(s.training_session_details)
                    ? s.training_session_details[0]
                    : s.training_session_details

                return {
                    sessionId: s.session_id,
                    sessionNumber: s.session_number || 'TRN-000',
                    scenarioName: details?.scenario_name || 'Training Session',
                    counterpartyType: details?.counterparty_type || 'ai',
                    counterpartyName: details?.counterparty_name || 'CLARENCE AI',
                    characterId: details?.character_id,
                    aiMode: details?.ai_mode,
                    status: s.status || 'active',
                    progress: details?.negotiation_score || 0,
                    createdAt: s.created_at,
                    lastActivityAt: s.updated_at
                }
            })

            setPastSessions(mappedSessions)

        } catch (error) {
            console.error('[Training] Error loading past sessions:', error)
        }
    }, [supabase])

    // ========================================================================
    // SECTION 10: INITIAL DATA LOAD
    // ========================================================================

    useEffect(() => {
        async function initializePage() {
            try {
                // Get user info from localStorage
                const auth = localStorage.getItem('clarence_auth')
                if (!auth) {
                    router.push('/auth/login')
                    return
                }

                const authData = JSON.parse(auth)
                const user = authData.userInfo
                setUserInfo(user)

                if (!user?.userId || !user?.companyId) {
                    console.error('[Training] Missing userId or companyId')
                    setAccessDeniedReason('error')
                    setIsCheckingApproval(false)
                    return
                }

                // Check authorization
                const userApproval = await checkAuthorization(user.userId, user.companyId)

                if (userApproval) {
                    setApproval(userApproval)

                    // Load data in parallel
                    await Promise.all([
                        loadCharacters(userApproval.trainingLevel),
                        loadScenarios(userApproval.allowedContractTypes),
                        loadPastSessions(user.userId)
                    ])
                }

                // Log page view
                eventLogger.started('training_studio', 'page_load', {
                    hasApproval: !!userApproval,
                    trainingLevel: userApproval?.trainingLevel
                })

            } catch (error) {
                console.error('[Training] Initialization error:', error)
                setAccessDeniedReason('error')
            } finally {
                setIsCheckingApproval(false)
            }
        }

        initializePage()
    }, [router, checkAuthorization, loadCharacters, loadScenarios, loadPastSessions])

    // ========================================================================
    // SECTION 11: START TRAINING SESSION
    // ========================================================================

    const startTrainingSession = async (scenario: TrainingScenario) => {
        if (!selectedCharacter || !userInfo?.userId || isStartingSession) return

        setIsStartingSession(true)

        try {
            console.log('[Training] Starting session:', {
                character: selectedCharacter.characterName,
                scenario: scenario.scenarioName
            })

            // Call API to create training session
            const response = await fetch(`${API_BASE}/training-start-scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userInfo.userId,
                    companyId: userInfo.companyId,
                    characterId: selectedCharacter.characterId,
                    characterName: selectedCharacter.characterName,
                    personalityType: selectedCharacter.personalityType,
                    scenarioId: scenario.scenarioId,
                    scenarioName: scenario.scenarioName,
                    contractType: scenario.contractType,
                    aiMode: selectedCharacter.personalityType
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create training session')
            }

            const result = await response.json()

            if (result.sessionId) {
                // Navigate to Contract Studio with training session
                router.push(`/auth/contract-studio?session=${result.sessionId}`)
            } else {
                throw new Error('No session ID returned')
            }

        } catch (error) {
            console.error('[Training] Error starting session:', error)
            alert('Failed to start training session. Please try again.')
        } finally {
            setIsStartingSession(false)
        }
    }

    // ========================================================================
    // SECTION 12: MULTI-PLAYER FUNCTIONS
    // ========================================================================

    const startMultiPlayerSetup = () => {
        // Navigate to create contract page with training flag
        router.push('/auth/create-contract?mode=training')
    }

    const acceptInvitation = async (invitation: PendingInvitation) => {
        router.push(`/auth/contract-studio?session=${invitation.sessionId}`)
    }

    const resumeSession = (sessionId: string) => {
        router.push(`/auth/contract-studio?session=${sessionId}`)
    }

    // ========================================================================
    // SECTION 13: CHAT FUNCTIONS
    // ========================================================================

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

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 14: HELPER FUNCTIONS
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

    // Filter scenarios by selected difficulty and character's difficulty
    const filteredScenarios = scenarios.filter(s => {
        // If a character is selected, only show scenarios at or below their difficulty
        if (selectedCharacter) {
            const charDiffOrder = selectedCharacter.difficultyOrder
            const scenarioDiffOrder = s.difficulty === 'beginner' ? 1
                : s.difficulty === 'intermediate' ? 2 : 3

            if (scenarioDiffOrder > charDiffOrder) return false
        }

        // Apply manual filter
        if (scenarioFilter !== 'all' && s.difficulty !== scenarioFilter) return false

        return true
    })

    // ========================================================================
    // SECTION 15: LOADING STATE
    // ========================================================================

    if (isCheckingApproval) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Checking access...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 16: ACCESS DENIED STATE
    // ========================================================================

    if (accessDeniedReason) {
        return (
            <div className="min-h-screen bg-slate-50">
                {/* Training Mode Banner */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4">
                    <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
                        <span>🎓</span>
                        <span>TRAINING STUDIO</span>
                    </div>
                </div>

                {/* Header */}
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
                            <Link
                                href="/auth/contracts-dashboard"
                                className="text-slate-500 hover:text-slate-800 text-sm"
                            >
                                ← Back to Dashboard
                            </Link>
                        </nav>
                    </div>
                </header>

                {/* Access Denied Content */}
                <main className="container mx-auto px-6 py-16">
                    <div className="max-w-lg mx-auto text-center">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            {accessDeniedReason === 'pending' ? (
                                <span className="text-4xl">⏳</span>
                            ) : accessDeniedReason === 'no_request' ? (
                                <span className="text-4xl">🔒</span>
                            ) : accessDeniedReason === 'expired' ? (
                                <span className="text-4xl">📅</span>
                            ) : accessDeniedReason === 'session_limit' ? (
                                <span className="text-4xl">🎯</span>
                            ) : accessDeniedReason === 'rejected' ? (
                                <span className="text-4xl">❌</span>
                            ) : (
                                <span className="text-4xl">⚠️</span>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold text-slate-800 mb-3">
                            {accessDeniedReason === 'pending' && 'Access Request Pending'}
                            {accessDeniedReason === 'no_request' && 'Training Access Required'}
                            {accessDeniedReason === 'expired' && 'Access Expired'}
                            {accessDeniedReason === 'session_limit' && 'Session Limit Reached'}
                            {accessDeniedReason === 'rejected' && 'Access Denied'}
                            {accessDeniedReason === 'error' && 'Something Went Wrong'}
                        </h1>

                        <p className="text-slate-500 mb-8">
                            {accessDeniedReason === 'pending' &&
                                'Your request to access Training Studio is being reviewed by your company administrator. You\'ll be notified once approved.'}
                            {accessDeniedReason === 'no_request' &&
                                'Training Studio access must be granted by your company administrator. Would you like to request access?'}
                            {accessDeniedReason === 'expired' &&
                                'Your training access has expired. Please contact your company administrator to renew.'}
                            {accessDeniedReason === 'session_limit' &&
                                'You\'ve completed all your allocated training sessions. Contact your administrator for additional sessions.'}
                            {accessDeniedReason === 'rejected' &&
                                'Your access request was not approved. Please contact your company administrator for more information.'}
                            {accessDeniedReason === 'error' &&
                                'We encountered an error checking your access. Please try again or contact support.'}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            {accessDeniedReason === 'no_request' && (
                                <button
                                    onClick={() => {
                                        // TODO: Implement access request
                                        alert('Access request feature coming soon. Please contact your administrator.')
                                    }}
                                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    Request Access
                                </button>
                            )}
                            <Link
                                href="/auth/contracts-dashboard"
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                Return to Dashboard
                            </Link>
                        </div>

                        {/* Info Box */}
                        <div className="mt-12 bg-white rounded-xl border border-slate-200 p-6 text-left">
                            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <span>ℹ️</span>
                                About Training Studio
                            </h3>
                            <ul className="space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5">✦</span>
                                    Practice negotiations with AI opponents at various difficulty levels
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5">✦</span>
                                    Train with colleagues in multi-player mode
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5">✦</span>
                                    Learn from teaching moments and track your progress
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5">✦</span>
                                    Risk-free environment - no real contracts affected
                                </li>
                            </ul>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    // ========================================================================
    // SECTION 17: MAIN RENDER (Authorized User)
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ============================================================ */}
            {/* SECTION 18: TRAINING MODE BANNER */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4">
                <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
                    <span>🎮</span>
                    <span>TRAINING MODE - Practice negotiations in a risk-free environment</span>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 15: HEADER */}
            {/* ================================================================ */}
            <header className="bg-slate-800 text-white sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="relative flex items-center justify-between h-16">
                        {/* Left: Logo & Brand */}
                        <Link href="/auth/contracts-dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">CLARENCE</span>
                                <span className="text-amber-400 font-semibold">Training</span>
                            </div>
                        </Link>

                        {/* Center: Navigation Links */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:flex items-center gap-1">
                            <Link
                                href="/auth/contracts-dashboard"
                                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/auth/contracts"
                                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                            >
                                Contract Library
                            </Link>
                            <Link
                                href="/auth/training"
                                className="px-3 py-2 text-sm font-medium text-white bg-amber-600/80 rounded-lg"
                            >
                                Training
                            </Link>
                        </div>

                        {/* Right: Feedback & User Menu */}
                        <div className="flex items-center gap-3">
                            {/* Feedback Button */}
                            <FeedbackButton position="header" />

                            {/* User Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                                        <span className="text-amber-400 font-medium text-sm">
                                            {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                        </span>
                                    </div>
                                    <span className="hidden sm:block text-sm text-slate-300">{userInfo?.firstName}</span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {showUserMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                        {/* User Info */}
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <div className="font-medium text-slate-800">
                                                {userInfo?.firstName} {userInfo?.lastName}
                                            </div>
                                            <div className="text-sm text-slate-500">{userInfo?.email}</div>
                                            <div className="text-xs text-slate-400 mt-1">{userInfo?.company}</div>
                                        </div>

                                        {/* Quick Links */}
                                        <div className="py-2">
                                            <Link
                                                href="/auth/contracts-dashboard"
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                </svg>
                                                Dashboard
                                            </Link>
                                            <Link
                                                href="/auth/contracts"
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Contract Library
                                            </Link>
                                            <Link
                                                href="/auth/training"
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                                Training
                                            </Link>
                                        </div>

                                        {/* Sign Out */}
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

            {/* Click outside to close user menu */}
            {showUserMenu && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowUserMenu(false)}
                />
            )}

            {/* ============================================================ */}
            {/* SECTION 20: MAIN CONTENT */}
            {/* ============================================================ */}
            <main className="container mx-auto px-6 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">🎮 Training Studio</h1>
                    <p className="text-slate-500">Master contract negotiation in a risk-free environment</p>
                </div>

                {/* ======================================================== */}
                {/* SECTION 21: TAB NAVIGATION */}
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
                {/* SECTION 22: PLAY TAB */}
                {/* ======================================================== */}
                {activeTab === 'play' && (
                    <div className="space-y-8">
                        {/* Mode Selection Cards */}
                        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                            {/* Single Player Card */}
                            <div
                                onClick={() => {
                                    setSelectedMode('single')
                                    setSelectedCharacter(null) // Reset character when switching modes
                                }}
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
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">{characters.length} AI Opponents</span>
                                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">Teaching Moments</span>
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

                            {/* Multi-Player Card */}
                            <div
                                onClick={() => {
                                    setSelectedMode('multi')
                                    setSelectedCharacter(null)
                                }}
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
                        {/* SECTION 23: SINGLE PLAYER - CHARACTER SELECTION */}
                        {/* ================================================ */}
                        {selectedMode === 'single' && !selectedCharacter && (
                            <div className="mt-8">
                                <div className="text-center mb-6">
                                    <h2 className="text-xl font-bold text-slate-800">Step 1: Choose Your Opponent</h2>
                                    <p className="text-slate-500 text-sm">Select an AI opponent to negotiate against</p>
                                </div>

                                {loadingCharacters ? (
                                    <div className="flex justify-center py-12">
                                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : characters.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                        <p className="text-slate-500">No AI opponents available at your training level.</p>
                                    </div>
                                ) : (
                                    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                                        {characters.map(character => {
                                            const difficulty = DIFFICULTY_CONFIG[character.difficultyLevel]
                                            const personality = PERSONALITY_CONFIG[character.personalityType]
                                            const theme = THEME_COLORS[character.themeColor] || THEME_COLORS.amber

                                            return (
                                                <div
                                                    key={character.characterId}
                                                    onClick={() => setSelectedCharacter(character)}
                                                    className={`bg-white rounded-2xl overflow-hidden border-2 cursor-pointer transition-all hover:shadow-lg ${theme.border} hover:border-opacity-100`}
                                                >
                                                    {/* Difficulty Banner */}
                                                    <div className={`bg-gradient-to-r ${difficulty.gradient} text-white py-2 px-4 text-center`}>
                                                        <span className="text-sm font-medium">{difficulty.icon} {difficulty.label}</span>
                                                    </div>

                                                    <div className="p-6">
                                                        {/* Avatar */}
                                                        <div className="flex justify-center mb-4">
                                                            {character.avatarUrl ? (
                                                                <img
                                                                    src={character.avatarUrl}
                                                                    alt={character.characterName}
                                                                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                                                                />
                                                            ) : (
                                                                <div className={`w-20 h-20 bg-gradient-to-br ${theme.gradient} rounded-full flex items-center justify-center`}>
                                                                    <span className="text-white font-bold text-2xl">
                                                                        {character.avatarInitials}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Name & Title */}
                                                        <div className="text-center mb-4">
                                                            <h3 className="text-lg font-bold text-slate-800">{character.characterName}</h3>
                                                            <p className="text-sm text-slate-500">{character.characterTitle}</p>
                                                            <p className="text-sm text-slate-400">{character.companyName}</p>
                                                        </div>

                                                        {/* Personality Badge */}
                                                        <div className="flex justify-center mb-4">
                                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${personality.bgColor} ${personality.color}`}>
                                                                {personality.icon} {personality.label}
                                                            </span>
                                                        </div>

                                                        {/* Quote */}
                                                        <div className="bg-slate-50 rounded-lg p-3 mb-4">
                                                            <p className="text-sm text-slate-600 italic text-center">
                                                                "{character.sampleQuotes?.[0] || character.negotiationPhilosophy?.slice(0, 80) + '...'}"
                                                            </p>
                                                        </div>

                                                        {/* Select Button */}
                                                        <button className={`w-full py-2.5 bg-gradient-to-r ${theme.gradient} text-white rounded-lg font-medium hover:opacity-90 transition-opacity`}>
                                                            Select Opponent →
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ================================================ */}
                        {/* SECTION 24: SINGLE PLAYER - SCENARIO SELECTION */}
                        {/* ================================================ */}
                        {selectedMode === 'single' && selectedCharacter && (
                            <div className="mt-8">
                                {/* Selected Character Header */}
                                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 max-w-4xl mx-auto">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {selectedCharacter.avatarUrl ? (
                                                <img
                                                    src={selectedCharacter.avatarUrl}
                                                    alt={selectedCharacter.characterName}
                                                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                                                />
                                            ) : (
                                                <div className={`w-12 h-12 bg-gradient-to-br ${THEME_COLORS[selectedCharacter.themeColor]?.gradient || 'from-amber-500 to-orange-500'} rounded-full flex items-center justify-center`}>
                                                    <span className="text-white font-bold">{selectedCharacter.avatarInitials}</span>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm text-slate-500">Training with:</p>
                                                <p className="font-semibold text-slate-800">
                                                    {selectedCharacter.characterName}
                                                    <span className={`ml-2 text-sm ${PERSONALITY_CONFIG[selectedCharacter.personalityType].color}`}>
                                                        ({PERSONALITY_CONFIG[selectedCharacter.personalityType].label})
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCharacter(null)}
                                            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                            </svg>
                                            Change Opponent
                                        </button>
                                    </div>
                                </div>

                                {/* Scenario Selection */}
                                <div className="max-w-4xl mx-auto">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Step 2: Choose Your Scenario</h2>
                                            <p className="text-slate-500 text-sm">Select a practice scenario to begin</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(filter => {
                                                // Only show filters up to the selected character's difficulty
                                                const filterOrder = filter === 'all' ? 99 : filter === 'beginner' ? 1 : filter === 'intermediate' ? 2 : 3
                                                if (filter !== 'all' && filterOrder > selectedCharacter.difficultyOrder) return null

                                                return (
                                                    <button
                                                        key={filter}
                                                        onClick={() => setScenarioFilter(filter)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${scenarioFilter === filter ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'}`}
                                                    >
                                                        {filter === 'all' ? 'All' : DIFFICULTY_CONFIG[filter].label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {loadingScenarios ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : filteredScenarios.length === 0 ? (
                                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                            <p className="text-slate-500">No scenarios available for this filter.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {filteredScenarios.map(scenario => {
                                                const difficulty = DIFFICULTY_CONFIG[scenario.difficulty]

                                                return (
                                                    <div
                                                        key={scenario.scenarioId}
                                                        className="bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-300 hover:shadow-md transition-all"
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <h3 className="font-semibold text-slate-800">{scenario.scenarioName}</h3>
                                                                    {scenario.isNew && (
                                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">NEW</span>
                                                                    )}
                                                                    {scenario.isFeatured && (
                                                                        <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full font-medium">⭐ FEATURED</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-slate-500 mb-3">{scenario.description}</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficulty.bg} ${difficulty.text}`}>
                                                                        {difficulty.label}
                                                                    </span>
                                                                    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">
                                                                        {scenario.contractType}
                                                                    </span>
                                                                    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">
                                                                        {scenario.clauseCount} clauses
                                                                    </span>
                                                                    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">
                                                                        ~{formatDuration(scenario.estimatedDuration)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => startTrainingSession(scenario)}
                                                                disabled={isStartingSession}
                                                                className="ml-4 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                                            >
                                                                {isStartingSession ? (
                                                                    <>
                                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                        Starting...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        Start
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                                        </svg>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ================================================ */}
                        {/* SECTION 25: MULTI-PLAYER */}
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
                {/* SECTION 26: VIDEOS TAB */}
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
                {/* SECTION 27: HISTORY TAB */}
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
                {/* SECTION 28: PROGRESS TAB */}
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
            {/* SECTION 29: CHAT PANEL */}
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
            {/* SECTION 30: FLOATING CHAT BUTTON */}
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
