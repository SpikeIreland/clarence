'use client'

// ============================================================================
// CLARENCE Training Studio - Character-Based Lobby Page + Free Practice
// ============================================================================
// File: /app/auth/training/page.tsx
// Purpose: Training mode lobby with AI characters, scenarios, session management,
//          and Free Practice mode using templates from the Contract Library
// Version: 3.0 - Added Free Practice with Template Picker (Phase 5)
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

interface TrainingCharacter {
    characterId: string
    characterName: string
    characterTitle: string
    companyName: string
    companyTagline: string
    companyDescription: string
    industry: string
    avatarUrl: string | null
    avatarInitials: string
    themeColor: string
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
    difficultyOrder: number
    difficultyLabel: string
    personalityType: 'cooperative' | 'balanced' | 'aggressive'
    negotiationStyle: string
    baseLeverageCustomer: number
    baseLeverageProvider: number
    signatureQuote: string
    greetingMessage: string
    isActive: boolean
}

interface CharacterScenario {
    scenarioId: string
    characterId: string
    scenarioName: string
    scenarioDescription: string
    scenarioBrief: string
    contractType: string
    contractTypeLabel: string
    dealValueMin: number
    dealValueMax: number
    dealCurrency: string
    dealDurationMonths: number
    customerCompanyName: string
    customerIndustry: string
    customerSituation: string
    scenarioDifficulty: number
    estimatedDurationMinutes: number
    clauseCategories: string[]
    clauseCount: number
    learningObjectives: string[]
    isActive: boolean
}

interface TrainingSession {
    sessionId: string
    sessionNumber: string
    characterName: string
    scenarioName: string
    status: string
    progress: number
    createdAt: string
    lastActivityAt: string
}

interface ContractTemplate {
    templateId: string
    templateCode: string
    templateName: string
    description: string
    industry: string | null
    contractType: string
    clauseCount: number
    version: number
    timesUsed: number
    lastUsedAt: string | null
    createdAt: string
    updatedAt: string
    isSystem: boolean
    isPublic: boolean
    isActive: boolean
    companyId: string | null
    createdByUserId: string | null
    sourceSessionId: string | null
}

type DifficultyMode = 'cooperative' | 'balanced' | 'aggressive'

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
        icon: '🟢',
        label: 'Beginner'
    },
    intermediate: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        gradient: 'from-amber-500 to-amber-600',
        icon: '🟡',
        label: 'Intermediate'
    },
    advanced: {
        bg: 'bg-rose-100',
        text: 'text-rose-700',
        border: 'border-rose-200',
        gradient: 'from-rose-500 to-rose-600',
        icon: '🔴',
        label: 'Advanced'
    }
}

const THEME_COLORS = {
    emerald: {
        bg: 'bg-emerald-500',
        bgLight: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        hover: 'hover:border-emerald-400'
    },
    amber: {
        bg: 'bg-amber-500',
        bgLight: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        hover: 'hover:border-amber-400'
    },
    rose: {
        bg: 'bg-rose-500',
        bgLight: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
        hover: 'hover:border-rose-400'
    }
}

const PRACTICE_DIFFICULTY_OPTIONS: { value: DifficultyMode; label: string; description: string; icon: string; color: string; bgColor: string; borderColor: string }[] = [
    {
        value: 'cooperative',
        label: 'Cooperative',
        description: 'Smaller gaps between positions. Good for learning the basics.',
        icon: '🟢',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-300'
    },
    {
        value: 'balanced',
        label: 'Balanced',
        description: 'Realistic starting positions. Template defaults as-is.',
        icon: '🟡',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-300'
    },
    {
        value: 'aggressive',
        label: 'Aggressive',
        description: 'Wider gaps, tougher opponent. For experienced negotiators.',
        icon: '🔴',
        color: 'text-rose-700',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-300'
    }
]

const CONTRACT_TYPE_ICONS: Record<string, string> = {
    bpo: '🏢',
    saas: '☁️',
    nda: '🔒',
    msa: '📋',
    consulting: '💼',
    employment: '👤',
    custom: '📄'
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatCurrency(value: number, currency: string = 'GBP'): string {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value)
}

function getContractTypeIcon(contractType: string): string {
    return CONTRACT_TYPE_ICONS[contractType?.toLowerCase()] || '📄'
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

export default function TrainingStudioPage() {
    const router = useRouter()
    const supabase = createClient()

    // ==========================================================================
    // SECTION 6: STATE DECLARATIONS
    // ==========================================================================

    // User state
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)

    // Characters & Scenarios
    const [characters, setCharacters] = useState<TrainingCharacter[]>([])
    const [scenarios, setScenarios] = useState<CharacterScenario[]>([])
    const [loadingCharacters, setLoadingCharacters] = useState(true)

    // Session creation flow (Quick Start / Scenario-based)
    const [selectedCharacter, setSelectedCharacter] = useState<TrainingCharacter | null>(null)
    const [selectedScenario, setSelectedScenario] = useState<CharacterScenario | null>(null)
    const [showScenarioModal, setShowScenarioModal] = useState(false)
    const [isCreatingSession, setIsCreatingSession] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    // Past sessions
    const [pastSessions, setPastSessions] = useState<TrainingSession[]>([])

    // View state
    const [activeTab, setActiveTab] = useState<'opponents' | 'free-practice' | 'history'>('opponents')

    // Free Practice state
    const [templates, setTemplates] = useState<ContractTemplate[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [templateSubTab, setTemplateSubTab] = useState<'system' | 'company' | 'user'>('system')
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
    const [showPracticeModal, setShowPracticeModal] = useState(false)
    const [practiceDifficulty, setPracticeDifficulty] = useState<DifficultyMode>('balanced')
    const [practiceCharacterId, setPracticeCharacterId] = useState<string>('auto')
    const [isCreatingPractice, setIsCreatingPractice] = useState(false)
    const [practiceError, setPracticeError] = useState<string | null>(null)

    // ==========================================================================
    // SECTION 7: AUTHENTICATION & DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return
        }

        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        setLoading(false)
    }, [router])

    const loadCharacters = useCallback(async () => {
        setLoadingCharacters(true)
        try {
            // Fetch characters
            const { data: charactersData, error: charError } = await supabase
                .from('training_characters')
                .select('*')
                .eq('is_active', true)
                .order('difficulty_order', { ascending: true })

            if (charError) {
                console.error('Error loading characters:', charError)
                return
            }

            if (charactersData) {
                const mappedCharacters: TrainingCharacter[] = charactersData.map((c: Record<string, unknown>) => ({
                    characterId: c.character_id as string,
                    characterName: c.character_name as string,
                    characterTitle: c.character_title as string,
                    companyName: c.company_name as string,
                    companyTagline: c.company_tagline as string || '',
                    companyDescription: c.company_description as string || '',
                    industry: c.industry as string || '',
                    avatarUrl: c.avatar_url as string | null,
                    avatarInitials: c.avatar_initials as string || '',
                    themeColor: c.theme_color as string || 'slate',
                    difficultyLevel: c.difficulty_level as 'beginner' | 'intermediate' | 'advanced',
                    difficultyOrder: c.difficulty_order as number,
                    difficultyLabel: c.difficulty_label as string || '',
                    personalityType: c.personality_type as 'cooperative' | 'balanced' | 'aggressive',
                    negotiationStyle: c.negotiation_style as string || '',
                    baseLeverageCustomer: c.base_leverage_customer as number || 50,
                    baseLeverageProvider: c.base_leverage_provider as number || 50,
                    signatureQuote: Array.isArray(c.sample_quotes) && c.sample_quotes.length > 0 ? c.sample_quotes[0] : '',
                    greetingMessage: c.greeting_message as string || '',
                    isActive: c.is_active as boolean
                }))
                setCharacters(mappedCharacters)
            }

            // Fetch all scenarios
            const { data: scenariosData, error: scenError } = await supabase
                .from('character_scenarios')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            if (scenError) {
                console.error('Error loading scenarios:', scenError)
                return
            }

            if (scenariosData) {
                const mappedScenarios: CharacterScenario[] = scenariosData.map((s: Record<string, unknown>) => ({
                    scenarioId: s.scenario_id as string,
                    characterId: s.character_id as string,
                    scenarioName: s.scenario_name as string,
                    scenarioDescription: s.scenario_description as string || '',
                    scenarioBrief: s.scenario_brief as string || '',
                    contractType: s.contract_type as string,
                    contractTypeLabel: s.contract_type_label as string || '',
                    dealValueMin: s.deal_value_min as number || 0,
                    dealValueMax: s.deal_value_max as number || 0,
                    dealCurrency: s.deal_currency as string || 'GBP',
                    dealDurationMonths: s.deal_duration_months as number || 12,
                    customerCompanyName: s.customer_company_name as string || '',
                    customerIndustry: s.customer_industry as string || '',
                    customerSituation: s.customer_situation as string || '',
                    scenarioDifficulty: s.scenario_difficulty as number || 1,
                    estimatedDurationMinutes: s.estimated_duration_minutes as number || 20,
                    clauseCategories: s.clause_categories as string[] || [],
                    clauseCount: s.clause_count as number || 10,
                    learningObjectives: s.learning_objectives as string[] || [],
                    isActive: s.is_active as boolean
                }))
                setScenarios(mappedScenarios)
            }

        } catch (error) {
            console.error('Error loading training data:', error)
        } finally {
            setLoadingCharacters(false)
        }
    }, [supabase])

    const loadPastSessions = useCallback(async () => {
        try {
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) return

            const authData = JSON.parse(auth)

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
                    characterName: (s.provider_company as string) || 'AI Opponent',
                    scenarioName: (s.notes as string)?.split('|')[0]?.replace('Training scenario:', '').trim() || 'Training',
                    status: s.status as string,
                    progress: 0,
                    createdAt: s.created_at as string,
                    lastActivityAt: s.updated_at as string
                }))
                setPastSessions(mapped)
            }
        } catch (error) {
            console.error('Error loading past sessions:', error)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 7B: LOAD TEMPLATES (Free Practice)
    // ==========================================================================

    const loadTemplates = useCallback(async () => {
        setLoadingTemplates(true)
        try {
            const { data, error } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('is_active', true)
                .order('template_name', { ascending: true })

            if (error) {
                console.error('Error loading templates:', error)
                return
            }

            const allTemplates: ContractTemplate[] = (data || []).map((t: Record<string, unknown>) => ({
                templateId: t.template_id as string,
                templateCode: (t.template_code as string) || '',
                templateName: t.template_name as string,
                description: (t.description as string) || '',
                industry: t.industry as string | null,
                contractType: (t.contract_type as string) || 'custom',
                clauseCount: (t.clause_count as number) || 0,
                version: (t.version as number) || 1,
                timesUsed: (t.times_used as number) || 0,
                lastUsedAt: t.last_used_at as string | null,
                createdAt: t.created_at as string,
                updatedAt: t.updated_at as string,
                isSystem: (t.is_system as boolean) || false,
                isPublic: (t.is_public as boolean) || false,
                isActive: t.is_active as boolean,
                companyId: t.company_id as string | null,
                createdByUserId: t.created_by_user_id as string | null,
                sourceSessionId: t.source_session_id as string | null
            }))

            setTemplates(allTemplates)
        } catch (error) {
            console.error('Error loading templates:', error)
        } finally {
            setLoadingTemplates(false)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 8: EFFECTS
    // ==========================================================================

    useEffect(() => {
        loadUserInfo()
        loadCharacters()
        loadPastSessions()
    }, [loadUserInfo, loadCharacters, loadPastSessions])

    // Load templates when Free Practice tab is selected
    useEffect(() => {
        if (activeTab === 'free-practice' && templates.length === 0) {
            loadTemplates()
        }
    }, [activeTab, templates.length, loadTemplates])

    // ==========================================================================
    // SECTION 9: EVENT HANDLERS (Quick Start / Scenario)
    // ==========================================================================

    const handleCharacterClick = (character: TrainingCharacter) => {
        setSelectedCharacter(character)
        setSelectedScenario(null)
        setShowScenarioModal(true)
        setCreateError(null)
    }

    const handleScenarioSelect = (scenario: CharacterScenario) => {
        setSelectedScenario(scenario)
    }

    const handleStartTraining = async () => {
        if (!selectedCharacter || !selectedScenario || !userInfo) return

        setIsCreatingSession(true)
        setCreateError(null)

        try {

            // Call the training-start-scenario workflow
            const response = await fetch(`${API_BASE}/training-start-scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userInfo.userId,
                    characterId: selectedCharacter.characterId,
                    characterName: selectedCharacter.characterName,
                    companyName: selectedCharacter.companyName,
                    scenarioId: selectedScenario.scenarioId,
                    scenarioName: selectedScenario.scenarioName,
                    contractType: selectedScenario.contractType,
                    aiPersonality: selectedCharacter.personalityType,
                    baseLeverageCustomer: selectedCharacter.baseLeverageCustomer,
                    baseLeverageProvider: selectedCharacter.baseLeverageProvider,
                    clauseCategories: selectedScenario.clauseCategories,
                    clauseCount: selectedScenario.clauseCount
                })
            })

            const result = await response.json()

            if (result.success && result.sessionId) {
                // Navigate to Contract Studio with training session
                router.push(`/auth/contract-studio?session_id=${result.sessionId}&provider_id=${result.providerId || ''}`)
            } else {
                setCreateError(result.error || 'Failed to create training session')
            }

        } catch (error) {
            console.error('Error starting training:', error)
            setCreateError('An error occurred. Please try again.')
        } finally {
            setIsCreatingSession(false)
        }
    }

    const handleContinueSession = (sessionId: string) => {
        router.push(`/auth/contract-studio?session_id=${sessionId}`)
    }

    // ==========================================================================
    // SECTION 9B: EVENT HANDLERS (Free Practice)
    // ==========================================================================

    const handleTemplateClick = (template: ContractTemplate) => {
        setSelectedTemplate(template)
        setPracticeDifficulty('balanced')
        setPracticeCharacterId('auto')
        setPracticeError(null)
        setShowPracticeModal(true)
    }

    const handleStartFreePractice = async () => {
        if (!selectedTemplate || !userInfo) return

        setIsCreatingPractice(true)
        setPracticeError(null)

        try {
            // Resolve character: auto-assign based on difficulty or use selected
            let resolvedCharacter: TrainingCharacter | null = null
            if (practiceCharacterId === 'auto') {
                // Map difficulty to personality type
                const personalityMap: Record<DifficultyMode, string> = {
                    cooperative: 'cooperative',
                    balanced: 'balanced',
                    aggressive: 'aggressive'
                }
                const targetPersonality = personalityMap[practiceDifficulty]
                resolvedCharacter = characters.find(c => c.personalityType === targetPersonality) || characters[0] || null
            } else {
                resolvedCharacter = characters.find(c => c.characterId === practiceCharacterId) || null
            }

            // Step 1: Create session via session-create API
            const response = await fetch(`${API_BASE}/session-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: userInfo.email,
                    companyName: userInfo.company,
                    userName: `${userInfo.firstName} ${userInfo.lastName}`,
                    isTraining: true,
                    mediation_type: 'standard',
                    contract_type: selectedTemplate.contractType,
                    contract_name: `Training: ${selectedTemplate.templateName}`,
                    template_source: 'template',
                    source_template_id: selectedTemplate.templateId,
                    assessment_completed: true,
                    deal_context: {
                        training_mode: 'free_practice',
                        ai_difficulty: practiceDifficulty,
                        ai_character_id: resolvedCharacter?.characterId || null,
                        ai_character_name: resolvedCharacter?.characterName || 'AI Opponent',
                        ai_company_name: resolvedCharacter?.companyName || 'Training Corp',
                        source_template_name: selectedTemplate.templateName
                    }
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create training session')
            }

            const result = await response.json()

            if (!result.success || !result.sessionId) {
                throw new Error(result.error || 'No session ID returned')
            }

            const sessionId = result.sessionId

            // Step 2: Update session with training flags and AI character info
            const { error: updateError } = await supabase
                .from('sessions')
                .update({
                    is_training: true,
                    provider_company: resolvedCharacter?.companyName || 'Training Corp',
                    notes: `Free Practice: ${selectedTemplate.templateName} | Difficulty: ${practiceDifficulty} | Character: ${resolvedCharacter?.characterName || 'Auto'}`,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', sessionId)

            if (updateError) {
                console.warn('Warning: Could not update session training flags:', updateError)
            }

            // Step 3: Apply difficulty modifier to provider positions
            if (practiceDifficulty !== 'balanced') {
                const modifier = practiceDifficulty === 'cooperative' ? -1.5 : 1.5

                // Fetch current provider positions
                const { data: positions, error: fetchError } = await supabase
                    .from('session_clause_positions')
                    .select('position_id, provider_position')
                    .eq('session_id', sessionId)
                    .eq('is_applicable', true)

                if (!fetchError && positions) {
                    // Update each position with difficulty modifier
                    for (const pos of positions) {
                        const currentPos = parseFloat(String(pos.provider_position)) || 5
                        const newPos = Math.max(1, Math.min(10, currentPos + modifier))

                        await supabase
                            .from('session_clause_positions')
                            .update({
                                provider_position: newPos,
                                original_provider_position: newPos,
                                updated_at: new Date().toISOString()
                            })
                            .eq('position_id', pos.position_id)
                    }

                    console.log(`[FreePractice] Applied ${practiceDifficulty} modifier (${modifier > 0 ? '+' : ''}${modifier}) to ${positions.length} clauses`)
                }
            }

            // Step 4: Navigate to Contract Studio
            router.push(`/auth/contract-studio?session_id=${sessionId}`)

        } catch (error) {
            console.error('Error starting free practice:', error)
            setPracticeError(error instanceof Error ? error.message : 'An error occurred. Please try again.')
        } finally {
            setIsCreatingPractice(false)
        }
    }

    // ==========================================================================
    // SECTION 10: TEMPLATE CATEGORISATION HELPERS
    // ==========================================================================

    const getScenariosForCharacter = (characterId: string): CharacterScenario[] => {
        return scenarios.filter(s => s.characterId === characterId)
    }

    const getFilteredTemplates = (): ContractTemplate[] => {
        switch (templateSubTab) {
            case 'system':
                return templates.filter(t => t.isSystem)
            case 'company':
                return templates.filter(t =>
                    !t.isSystem &&
                    t.isPublic &&
                    t.companyId === userInfo?.companyId
                )
            case 'user':
                return templates.filter(t =>
                    !t.isSystem &&
                    !t.isPublic &&
                    t.createdByUserId === userInfo?.userId
                )
            default:
                return []
        }
    }

    const getTemplateCounts = () => {
        const system = templates.filter(t => t.isSystem).length
        const company = templates.filter(t => !t.isSystem && t.isPublic && t.companyId === userInfo?.companyId).length
        const user = templates.filter(t => !t.isSystem && !t.isPublic && t.createdByUserId === userInfo?.userId).length
        return { system, company, user }
    }

    // ==========================================================================
    // SECTION 11: RENDER - LOADING STATE
    // ==========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading Training Studio...</p>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 12: RENDER - CHARACTER CARD COMPONENT
    // ==========================================================================

    const CharacterCard = ({ character }: { character: TrainingCharacter }) => {
        const difficulty = DIFFICULTY_CONFIG[character.difficultyLevel]
        const theme = THEME_COLORS[character.themeColor as keyof typeof THEME_COLORS] || THEME_COLORS.amber
        const characterScenarios = getScenariosForCharacter(character.characterId)

        return (
            <div
                onClick={() => handleCharacterClick(character)}
                className={`bg-white rounded-xl border-2 ${theme.border} ${theme.hover} hover:shadow-lg transition-all cursor-pointer overflow-hidden group`}
            >
                {/* Header with Avatar */}
                <div className={`${theme.bgLight} px-6 py-5 border-b ${theme.border}`}>
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`w-16 h-16 ${theme.bg} rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md group-hover:scale-105 transition-transform`}>
                            {character.avatarUrl ? (
                                <img
                                    src={character.avatarUrl}
                                    alt={character.characterName}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            ) : (
                                character.avatarInitials
                            )}
                        </div>

                        {/* Name & Title */}
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-800">{character.characterName}</h3>
                            <p className="text-sm text-slate-600">{character.characterTitle}</p>
                        </div>

                        {/* Difficulty Badge */}
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${difficulty.bg} ${difficulty.text}`}>
                            {difficulty.icon} {difficulty.label}
                        </div>
                    </div>
                </div>

                {/* Company Info */}
                <div className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🏢</span>
                        <span className="font-semibold text-slate-700">{character.companyName}</span>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">{character.industry}</p>

                    {/* Quote */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-slate-600 italic">&ldquo;{character.signatureQuote}&rdquo;</p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                        <span className="flex items-center gap-1">
                            <span>📊</span>
                            Leverage: {character.baseLeverageCustomer}/{character.baseLeverageProvider}
                        </span>
                        <span className="flex items-center gap-1">
                            <span>📋</span>
                            {characterScenarios.length} scenario{characterScenarios.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Negotiation Style */}
                    <p className="text-xs text-slate-500 line-clamp-2">{character.negotiationStyle}</p>
                </div>

                {/* CTA */}
                <div className={`px-6 py-4 ${theme.bgLight} border-t ${theme.border}`}>
                    <button className={`w-full py-2.5 bg-gradient-to-r ${difficulty.gradient} text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity`}>
                        Challenge {character.characterName.split(' ')[0]}
                    </button>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 12B: RENDER - TEMPLATE CARD COMPONENT (Free Practice)
    // ==========================================================================

    const TemplateCard = ({ template }: { template: ContractTemplate }) => {
        const icon = getContractTypeIcon(template.contractType)
        const isFromSession = !!template.sourceSessionId

        return (
            <div
                onClick={() => handleTemplateClick(template)}
                className="bg-white rounded-xl border-2 border-slate-200 hover:border-amber-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                            {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 truncate">{template.templateName}</h4>
                            <p className="text-xs text-slate-500 capitalize">{template.contractType.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 py-3">
                    {template.description && (
                        <p className="text-sm text-slate-600 line-clamp-2 mb-3">{template.description}</p>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            📋 {template.clauseCount} clauses
                        </span>
                        {template.timesUsed > 0 && (
                            <span className="flex items-center gap-1">
                                🔄 Used {template.timesUsed}x
                            </span>
                        )}
                        {isFromSession && (
                            <span className="flex items-center gap-1 text-amber-600">
                                ⭐ From negotiation
                            </span>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                    <button className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors group-hover:bg-amber-600">
                        Practice with this template
                    </button>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 13: RENDER - SCENARIO MODAL (Quick Start)
    // ==========================================================================

    const ScenarioModal = () => {
        if (!showScenarioModal || !selectedCharacter) return null

        const difficulty = DIFFICULTY_CONFIG[selectedCharacter.difficultyLevel]
        const theme = THEME_COLORS[selectedCharacter.themeColor as keyof typeof THEME_COLORS] || THEME_COLORS.amber
        const characterScenarios = getScenariosForCharacter(selectedCharacter.characterId)

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className={`${theme.bgLight} px-6 py-5 border-b ${theme.border} flex-shrink-0`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className={`w-14 h-14 ${theme.bg} rounded-full flex items-center justify-center text-white text-lg font-bold`}>
                                    {selectedCharacter.avatarUrl ? (
                                        <img
                                            src={selectedCharacter.avatarUrl}
                                            alt={selectedCharacter.characterName}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        selectedCharacter.avatarInitials
                                    )}
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedCharacter.characterName}</h2>
                                    <p className="text-sm text-slate-600">{selectedCharacter.characterTitle} &bull; {selectedCharacter.companyName}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setShowScenarioModal(false)
                                    setSelectedCharacter(null)
                                    setSelectedScenario(null)
                                }}
                                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Quote */}
                        <p className="text-sm text-slate-600 italic mt-3">&ldquo;{selectedCharacter.signatureQuote}&rdquo;</p>
                    </div>

                    {/* Modal Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Choose a Scenario</h3>

                        {/* Scenario List */}
                        <div className="space-y-4">
                            {characterScenarios.map((scenario, index) => (
                                <div
                                    key={scenario.scenarioId}
                                    onClick={() => handleScenarioSelect(scenario)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedScenario?.scenarioId === scenario.scenarioId
                                        ? `${theme.border} ${theme.bgLight}`
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-slate-800">{scenario.scenarioName}</h4>
                                                {index === 0 && (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                                        Recommended
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1">{scenario.scenarioDescription}</p>
                                        </div>

                                        {/* Selection Indicator */}
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 ${selectedScenario?.scenarioId === scenario.scenarioId
                                            ? `${theme.bg} border-transparent`
                                            : 'border-slate-300'
                                            }`}>
                                            {selectedScenario?.scenarioId === scenario.scenarioId && (
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scenario Details */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-3">
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            ~{scenario.estimatedDurationMinutes} min
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            {scenario.clauseCount} clauses
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            {scenario.contractTypeLabel}
                                        </span>
                                        {scenario.dealValueMax > 0 && (
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {formatCurrency(scenario.dealValueMin)} - {formatCurrency(scenario.dealValueMax)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Learning Objectives */}
                                    {selectedScenario?.scenarioId === scenario.scenarioId && scenario.learningObjectives.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-slate-200">
                                            <p className="text-xs font-medium text-slate-500 mb-2">You&apos;ll learn:</p>
                                            <ul className="space-y-1">
                                                {scenario.learningObjectives.map((obj, i) => (
                                                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                                                        <span className={theme.text}>✔</span>
                                                        {obj}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Error Message */}
                        {createError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{createError}</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-500">
                                {selectedScenario ? (
                                    <span>Ready to negotiate with <strong>{selectedCharacter.characterName}</strong></span>
                                ) : (
                                    <span>Select a scenario to continue</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowScenarioModal(false)
                                        setSelectedCharacter(null)
                                        setSelectedScenario(null)
                                    }}
                                    className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStartTraining}
                                    disabled={!selectedScenario || isCreatingSession}
                                    className={`px-6 py-2 bg-gradient-to-r ${difficulty.gradient} text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2`}
                                >
                                    {isCreatingSession ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Starting...
                                        </>
                                    ) : (
                                        <>
                                            Start Training
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 13B: RENDER - FREE PRACTICE CONFIG MODAL
    // ==========================================================================

    const FreePracticeModal = () => {
        if (!showPracticeModal || !selectedTemplate) return null

        const icon = getContractTypeIcon(selectedTemplate.contractType)

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="bg-amber-50 px-6 py-5 border-b border-amber-200 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">
                                    {icon}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Configure Practice</h2>
                                    <p className="text-sm text-slate-600">{selectedTemplate.templateName}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setShowPracticeModal(false)
                                    setSelectedTemplate(null)
                                }}
                                className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Template Info */}
                        <div className="bg-slate-50 rounded-lg p-4">
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1">📋 {selectedTemplate.clauseCount} clauses</span>
                                <span className="flex items-center gap-1 capitalize">📁 {selectedTemplate.contractType.replace(/_/g, ' ')}</span>
                                {selectedTemplate.sourceSessionId && (
                                    <span className="flex items-center gap-1 text-amber-600">⭐ From negotiation</span>
                                )}
                            </div>
                            {selectedTemplate.description && (
                                <p className="text-sm text-slate-500 mt-2">{selectedTemplate.description}</p>
                            )}
                        </div>

                        {/* Difficulty Selector */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-3">AI Difficulty</label>
                            <div className="space-y-2">
                                {PRACTICE_DIFFICULTY_OPTIONS.map(option => (
                                    <div
                                        key={option.value}
                                        onClick={() => setPracticeDifficulty(option.value)}
                                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${practiceDifficulty === option.value
                                                ? `${option.borderColor} ${option.bgColor}`
                                                : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${practiceDifficulty === option.value
                                                    ? `${option.borderColor} ${option.bgColor}`
                                                    : 'border-slate-300'
                                                }`}>
                                                {practiceDifficulty === option.value && (
                                                    <div className={`w-2.5 h-2.5 rounded-full ${option.value === 'cooperative' ? 'bg-emerald-500' :
                                                            option.value === 'balanced' ? 'bg-amber-500' : 'bg-rose-500'
                                                        }`}></div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span>{option.icon}</span>
                                                    <span className={`font-medium ${option.color}`}>{option.label}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Character Selector */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-800 mb-3">AI Opponent</label>
                            <div className="space-y-2">
                                {/* Auto-assign option */}
                                <div
                                    onClick={() => setPracticeCharacterId('auto')}
                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${practiceCharacterId === 'auto'
                                            ? 'border-amber-300 bg-amber-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-sm">
                                            🎲
                                        </div>
                                        <div>
                                            <span className="font-medium text-slate-800">Auto-assign</span>
                                            <p className="text-xs text-slate-500">Match opponent to difficulty level</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Character options */}
                                {characters.map(char => {
                                    const charDifficulty = DIFFICULTY_CONFIG[char.difficultyLevel]
                                    return (
                                        <div
                                            key={char.characterId}
                                            onClick={() => setPracticeCharacterId(char.characterId)}
                                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${practiceCharacterId === char.characterId
                                                    ? 'border-amber-300 bg-amber-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 ${THEME_COLORS[char.themeColor as keyof typeof THEME_COLORS]?.bg || 'bg-slate-500'} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                                                    {char.avatarInitials}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="font-medium text-slate-800">{char.characterName}</span>
                                                    <span className="text-xs text-slate-500 ml-2">{char.companyName}</span>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${charDifficulty.bg} ${charDifficulty.text}`}>
                                                    {charDifficulty.icon} {charDifficulty.label}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Error Message */}
                        {practiceError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{practiceError}</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-500">
                                {selectedTemplate.clauseCount} clauses &bull; {practiceDifficulty} difficulty
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowPracticeModal(false)
                                        setSelectedTemplate(null)
                                    }}
                                    className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleStartFreePractice}
                                    disabled={isCreatingPractice}
                                    className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2"
                                >
                                    {isCreatingPractice ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Creating Session...
                                        </>
                                    ) : (
                                        <>
                                            Start Practice
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 14: RENDER - MAIN LAYOUT
    // ==========================================================================

    const templateCounts = getTemplateCounts()

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
            {/* ================================================================ */}
            {/* SECTION 15: HEADER */}
            {/* ================================================================ */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo & Title */}
                        <div className="flex items-center gap-4">
                            <Link href="/auth/contracts-dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">C</span>
                                </div>
                            </Link>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🎯</span>
                                <h1 className="text-lg font-semibold text-slate-800">Training Studio</h1>
                            </div>
                        </div>

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                    <span className="text-amber-700 font-medium text-sm">
                                        {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                    </span>
                                </div>
                                <span className="text-sm text-slate-700 hidden sm:block">
                                    {userInfo?.firstName} {userInfo?.lastName}
                                </span>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                                    <Link
                                        href="/auth/contracts-dashboard"
                                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        Dashboard
                                    </Link>
                                    <Link
                                        href="/auth/settings"
                                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        Settings
                                    </Link>
                                    <hr className="my-1 border-slate-200" />
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem('clarence_auth')
                                            router.push('/auth/login')
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================ */}
            {/* SECTION 16: MAIN CONTENT */}
            {/* ================================================================ */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Hero Section */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 mb-8 text-white">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-bold mb-2">Practice Makes Perfect</h2>
                        <p className="text-amber-100 mb-4">
                            Challenge AI opponents of varying difficulty. CLARENCE will guide you as your neutral mediator —
                            just like in real negotiations.
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                                <span>🎭</span>
                                <span>{characters.length} Opponents</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                                <span>📋</span>
                                <span>{templates.length > 0 ? templates.length : '...'} Templates</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
                                <span>🤖</span>
                                <span>CLARENCE as Mediator</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('opponents')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'opponents'
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        🎯 Quick Start
                    </button>
                    <button
                        onClick={() => setActiveTab('free-practice')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'free-practice'
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        📂 Free Practice
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history'
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        📜 Past Sessions
                    </button>
                </div>

                {/* ================================================================ */}
                {/* SECTION 17: OPPONENTS TAB (Quick Start) */}
                {/* ================================================================ */}
                {activeTab === 'opponents' && (
                    <div>
                        {/* How It Works */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xl">💡</span>
                                <h3 className="text-lg font-semibold text-slate-800">How Training Works</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">Choose an Opponent</p>
                                        <p className="text-sm text-slate-500">Select from AI characters with different negotiation styles.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 font-bold flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">Negotiate Clauses</p>
                                        <p className="text-sm text-slate-500">Adjust positions on contract clauses. CLARENCE guides you as mediator.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 font-bold flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">Learn &amp; Improve</p>
                                        <p className="text-sm text-slate-500">Get feedback on your negotiation strategy and tactics.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Character Cards */}
                        {loadingCharacters ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-16 h-16 bg-slate-200 rounded-full"></div>
                                            <div className="flex-1">
                                                <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                                                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                        <div className="h-20 bg-slate-100 rounded-lg mb-4"></div>
                                        <div className="h-10 bg-slate-200 rounded-lg"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {characters.map(character => (
                                    <CharacterCard key={character.characterId} character={character} />
                                ))}
                            </div>
                        )}

                        {/* Empty State */}
                        {!loadingCharacters && characters.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                <div className="text-4xl mb-4">🎭</div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Characters Available</h3>
                                <p className="text-slate-500">Training characters are being set up. Check back soon!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ================================================================ */}
                {/* SECTION 17B: FREE PRACTICE TAB */}
                {/* ================================================================ */}
                {activeTab === 'free-practice' && (
                    <div>
                        {/* Intro */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">📂</span>
                                <h3 className="text-lg font-semibold text-slate-800">Free Practice</h3>
                            </div>
                            <p className="text-sm text-slate-600">
                                Choose any template from your library and practice negotiating it against an AI opponent.
                                Templates saved from real negotiations start with original positions — giving you
                                the same starting conditions to practice against.
                            </p>
                        </div>

                        {/* Template Sub-tabs */}
                        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1 inline-flex">
                            <button
                                onClick={() => setTemplateSubTab('system')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${templateSubTab === 'system'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                🏛️ System Templates
                                {templateCounts.system > 0 && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${templateSubTab === 'system' ? 'bg-white/30' : 'bg-slate-100'
                                        }`}>
                                        {templateCounts.system}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setTemplateSubTab('company')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${templateSubTab === 'company'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                🏢 Company Templates
                                {templateCounts.company > 0 && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${templateSubTab === 'company' ? 'bg-white/30' : 'bg-slate-100'
                                        }`}>
                                        {templateCounts.company}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setTemplateSubTab('user')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${templateSubTab === 'user'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                👤 My Templates
                                {templateCounts.user > 0 && (
                                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${templateSubTab === 'user' ? 'bg-white/30' : 'bg-slate-100'
                                        }`}>
                                        {templateCounts.user}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Template Grid */}
                        {loadingTemplates ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                                            <div className="flex-1">
                                                <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                                                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                        <div className="h-12 bg-slate-100 rounded-lg mb-3"></div>
                                        <div className="h-10 bg-slate-200 rounded-lg"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {getFilteredTemplates().length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {getFilteredTemplates().map(template => (
                                            <TemplateCard key={template.templateId} template={template} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                        <div className="text-4xl mb-4">
                                            {templateSubTab === 'system' ? '🏛️' : templateSubTab === 'company' ? '🏢' : '👤'}
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                            {templateSubTab === 'system' && 'No System Templates'}
                                            {templateSubTab === 'company' && 'No Company Templates'}
                                            {templateSubTab === 'user' && 'No Personal Templates Yet'}
                                        </h3>
                                        <p className="text-slate-500 max-w-md mx-auto mb-4">
                                            {templateSubTab === 'system' && 'System templates will be available soon.'}
                                            {templateSubTab === 'company' && 'Your company hasn\'t shared any templates yet.'}
                                            {templateSubTab === 'user' && 'Complete a negotiation and save the outcome as a template to practice with it here.'}
                                        </p>
                                        {templateSubTab === 'user' && (
                                            <Link
                                                href="/auth/contracts-dashboard"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Go to Dashboard
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                </svg>
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ================================================================ */}
                {/* SECTION 18: HISTORY TAB */}
                {/* ================================================================ */}
                {activeTab === 'history' && (
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Training Sessions</h2>

                        {pastSessions.length > 0 ? (
                            <div className="space-y-3">
                                {pastSessions.map(session => (
                                    <div
                                        key={session.sessionId}
                                        className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:border-amber-300 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                                <span className="text-xl">🎯</span>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-800">{session.scenarioName}</h4>
                                                <p className="text-sm text-slate-500">
                                                    vs {session.characterName} &bull; {new Date(session.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${session.status === 'completed'
                                                ? 'bg-green-100 text-green-700'
                                                : session.status === 'active' || session.status === 'negotiation_ready'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                {session.status === 'negotiation_ready' ? 'In Progress' : session.status}
                                            </span>
                                            <button
                                                onClick={() => handleContinueSession(session.sessionId)}
                                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {session.status === 'completed' ? 'Review' : 'Continue'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                <div className="text-4xl mb-4">📜</div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Training Sessions Yet</h3>
                                <p className="text-slate-500 mb-4">Start your first training session to see your history here.</p>
                                <button
                                    onClick={() => setActiveTab('opponents')}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Choose an Opponent
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ================================================================ */}
            {/* SECTION 19: MODALS */}
            {/* ================================================================ */}
            <ScenarioModal />
            <FreePracticeModal />
        </div>
    )
}