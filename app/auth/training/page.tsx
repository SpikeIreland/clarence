'use client'

// ============================================================================
// CLARENCE Training Studio - Merged Lobby Page v4.0
// ============================================================================
// File: /app/auth/training/page.tsx
// Purpose: Training mode lobby with AI characters, scenarios, session management,
//          Choose Your Contract mode with templates, Videos tab, and History
// Version: 4.0 - Merged best of v2 + v3, language updates, restored features
// ============================================================================
// CHANGES FROM v3.0:
// - Renamed "Free Practice" -> "Choose Your Contract"
// - Replaced all "Opponent" -> "Counterpart" language
// - Restored Videos tab from v2
// - Restored full History tab from v2
// - Uses AuthenticatedHeader for consistent navigation
// - Fixed "Go to Dashboard" -> "Go to Contract Library" (/auth/contracts)
// - "Challenge X" -> "Negotiate with X" on character cards
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'

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

interface TrainingVideo {
    videoId: string
    videoCode: string
    title: string
    description: string
    category: string
    youtubeId: string | null
    duration: number
    priority: 'high' | 'medium' | 'low'
    isPublished: boolean
    sortOrder: number
}

type DifficultyMode = 'cooperative' | 'balanced' | 'aggressive'

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; gradient: string; icon: string; description: string }> = {
    beginner: {
        label: 'Cooperative',
        color: 'text-emerald-600',
        gradient: 'from-emerald-500 to-emerald-600',
        icon: '🌱',
        description: 'Friendly and willing to find common ground'
    },
    intermediate: {
        label: 'Balanced',
        color: 'text-amber-600',
        gradient: 'from-amber-500 to-amber-600',
        icon: '⚖️',
        description: 'Professional and pragmatic'
    },
    advanced: {
        label: 'Assertive',
        color: 'text-red-600',
        gradient: 'from-red-500 to-red-600',
        icon: '🔥',
        description: 'Experienced and drives a hard bargain'
    }
}

const THEME_COLORS: Record<string, { bg: string; bgLight: string; border: string; hover: string; text: string }> = {
    emerald: { bg: 'bg-emerald-600', bgLight: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:border-emerald-400', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-600', bgLight: 'bg-amber-50', border: 'border-amber-200', hover: 'hover:border-amber-400', text: 'text-amber-600' },
    red: { bg: 'bg-red-600', bgLight: 'bg-red-50', border: 'border-red-200', hover: 'hover:border-red-400', text: 'text-red-600' },
    blue: { bg: 'bg-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-200', hover: 'hover:border-blue-400', text: 'text-blue-600' },
    slate: { bg: 'bg-slate-600', bgLight: 'bg-slate-50', border: 'border-slate-200', hover: 'hover:border-slate-400', text: 'text-slate-600' },
    purple: { bg: 'bg-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200', hover: 'hover:border-purple-400', text: 'text-purple-600' }
}

const CONTRACT_TYPE_ICONS: Record<string, string> = {
    bpo: '🏢', saas: '☁️', nda: '🔒', it_services: '💻',
    consulting: '📊', employment: '👔', lease: '🏠', custom: '📄'
}

const VIDEO_CATEGORIES: Record<string, { label: string; icon: string }> = {
    'getting-started': { label: 'Getting Started', icon: '👋' },
    'contract-creation': { label: 'Contract Creation', icon: '📝' },
    'contract-preparation': { label: 'Contract Preparation', icon: '📋' },
    'negotiation': { label: 'Negotiation', icon: '🤝' },
    'training': { label: 'Training Mode', icon: '🎓' },
    'documents': { label: 'Documents', icon: '📄' },
    'admin': { label: 'Administration', icon: '⚙️' }
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatCurrency(value: number, currency: string = 'GBP'): string {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value)
}

function getContractTypeIcon(contractType: string): string {
    return CONTRACT_TYPE_ICONS[contractType?.toLowerCase()] || '📄'
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)

    const [characters, setCharacters] = useState<TrainingCharacter[]>([])
    const [scenarios, setScenarios] = useState<CharacterScenario[]>([])
    const [loadingCharacters, setLoadingCharacters] = useState(true)

    const [selectedCharacter, setSelectedCharacter] = useState<TrainingCharacter | null>(null)
    const [selectedScenario, setSelectedScenario] = useState<CharacterScenario | null>(null)
    const [showScenarioModal, setShowScenarioModal] = useState(false)
    const [isCreatingSession, setIsCreatingSession] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    const [pastSessions, setPastSessions] = useState<TrainingSession[]>([])

    const [activeTab, setActiveTab] = useState<'quick-start' | 'choose-contract' | 'videos' | 'history'>('quick-start')

    const [templates, setTemplates] = useState<ContractTemplate[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [templateSubTab, setTemplateSubTab] = useState<'system' | 'company' | 'user'>('system')
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
    const [showPracticeModal, setShowPracticeModal] = useState(false)
    const [practiceDifficulty, setPracticeDifficulty] = useState<DifficultyMode>('balanced')
    const [practiceCharacterId, setPracticeCharacterId] = useState<string>('auto')
    const [isCreatingPractice, setIsCreatingPractice] = useState(false)
    const [practiceError, setPracticeError] = useState<string | null>(null)

    const [videos, setVideos] = useState<TrainingVideo[]>([])
    const [loadingVideos, setLoadingVideos] = useState(false)
    const [videoCategory, setVideoCategory] = useState<string>('all')

    // ==========================================================================
    // SECTION 7: AUTHENTICATION & DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) { router.push('/auth/login'); return }
        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        setLoading(false)
    }, [router])

    const loadCharacters = useCallback(async () => {
        setLoadingCharacters(true)
        try {
            const { data: charactersData, error: charError } = await supabase
                .from('training_characters').select('*').eq('is_active', true).order('difficulty_order', { ascending: true })
            if (charError) { console.error('Error loading characters:', charError); return }
            if (charactersData) {
                const mappedCharacters: TrainingCharacter[] = charactersData.map((c: Record<string, unknown>) => ({
                    characterId: c.character_id as string, characterName: c.character_name as string,
                    characterTitle: c.character_title as string, companyName: c.company_name as string,
                    companyTagline: c.company_tagline as string || '', companyDescription: c.company_description as string || '',
                    industry: c.industry as string || '', avatarUrl: c.avatar_url as string | null,
                    avatarInitials: c.avatar_initials as string || '', themeColor: c.theme_color as string || 'slate',
                    difficultyLevel: c.difficulty_level as 'beginner' | 'intermediate' | 'advanced',
                    difficultyOrder: c.difficulty_order as number, difficultyLabel: c.difficulty_label as string || '',
                    personalityType: c.personality_type as 'cooperative' | 'balanced' | 'aggressive',
                    negotiationStyle: c.negotiation_style as string || '',
                    baseLeverageCustomer: c.base_leverage_customer as number || 50,
                    baseLeverageProvider: c.base_leverage_provider as number || 50,
                    signatureQuote: Array.isArray(c.sample_quotes) && c.sample_quotes.length > 0 ? c.sample_quotes[0] : '',
                    greetingMessage: c.greeting_message as string || '', isActive: c.is_active as boolean
                }))
                setCharacters(mappedCharacters)
            }
            const { data: scenariosData, error: scenError } = await supabase
                .from('character_scenarios').select('*').eq('is_active', true).order('display_order', { ascending: true })
            if (scenError) { console.error('Error loading scenarios:', scenError); return }
            if (scenariosData) {
                const mappedScenarios: CharacterScenario[] = scenariosData.map((s: Record<string, unknown>) => ({
                    scenarioId: s.scenario_id as string, characterId: s.character_id as string,
                    scenarioName: s.scenario_name as string, scenarioDescription: s.scenario_description as string || '',
                    scenarioBrief: s.scenario_brief as string || '', contractType: s.contract_type as string,
                    contractTypeLabel: s.contract_type_label as string || '',
                    dealValueMin: s.deal_value_min as number || 0, dealValueMax: s.deal_value_max as number || 0,
                    dealCurrency: s.deal_currency as string || 'GBP', dealDurationMonths: s.deal_duration_months as number || 12,
                    customerCompanyName: s.customer_company_name as string || '', customerIndustry: s.customer_industry as string || '',
                    customerSituation: s.customer_situation as string || '', scenarioDifficulty: s.scenario_difficulty as number || 1,
                    estimatedDurationMinutes: s.estimated_duration_minutes as number || 20,
                    clauseCategories: s.clause_categories as string[] || [], clauseCount: s.clause_count as number || 10,
                    learningObjectives: s.learning_objectives as string[] || [], isActive: s.is_active as boolean
                }))
                setScenarios(mappedScenarios)
            }
        } catch (error) { console.error('Error loading training data:', error) }
        finally { setLoadingCharacters(false) }
    }, [supabase])

    const loadPastSessions = useCallback(async () => {
        try {
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) return
            const authData = JSON.parse(auth)
            const { data: sessionsData } = await supabase.from('sessions').select('*')
                .eq('is_training', true).eq('customer_id', authData.userInfo?.userId)
                .order('updated_at', { ascending: false }).limit(20)
            if (sessionsData) {
                const mapped: TrainingSession[] = sessionsData.map((s: Record<string, unknown>) => ({
                    sessionId: s.session_id as string, sessionNumber: s.session_number as string,
                    characterName: (s.provider_company as string) || 'AI Counterpart',
                    scenarioName: (s.notes as string)?.split('|')[0]?.replace('Training scenario:', '').trim() || 'Training Session',
                    status: s.status as string, progress: 0,
                    createdAt: s.created_at as string, lastActivityAt: s.updated_at as string
                }))
                setPastSessions(mapped)
            }
        } catch (error) { console.error('Error loading past sessions:', error) }
    }, [supabase])

    // ==========================================================================
    // SECTION 7B: LOAD TEMPLATES (Choose Your Contract)
    // ==========================================================================

    const loadTemplates = useCallback(async () => {
        setLoadingTemplates(true)
        try {
            const { data, error } = await supabase.from('contract_templates').select('*')
                .eq('is_active', true).order('template_name', { ascending: true })
            if (error) { console.error('Error loading templates:', error); return }
            const allTemplates: ContractTemplate[] = (data || []).map((t: Record<string, unknown>) => ({
                templateId: t.template_id as string, templateCode: (t.template_code as string) || '',
                templateName: t.template_name as string, description: (t.description as string) || '',
                industry: t.industry as string | null, contractType: (t.contract_type as string) || 'custom',
                clauseCount: (t.clause_count as number) || 0, version: (t.version as number) || 1,
                timesUsed: (t.times_used as number) || 0, lastUsedAt: t.last_used_at as string | null,
                createdAt: t.created_at as string, updatedAt: t.updated_at as string,
                isSystem: (t.is_system as boolean) || false, isPublic: (t.is_public as boolean) || false,
                isActive: t.is_active as boolean, companyId: t.company_id as string | null,
                createdByUserId: t.created_by_user_id as string | null, sourceSessionId: t.source_session_id as string | null
            }))
            setTemplates(allTemplates)
        } catch (error) { console.error('Error loading templates:', error) }
        finally { setLoadingTemplates(false) }
    }, [supabase])

    // ==========================================================================
    // SECTION 7C: LOAD VIDEOS
    // ==========================================================================

    const loadVideos = useCallback(async () => {
        setLoadingVideos(true)
        try {
            const { data, error } = await supabase.from('training_videos').select('*')
                .eq('is_published', true).order('sort_order', { ascending: true })
            if (data && !error) {
                const mapped: TrainingVideo[] = data.map((v: Record<string, unknown>) => ({
                    videoId: v.video_id as string, videoCode: v.video_code as string || '',
                    title: v.title as string, description: v.description as string || '',
                    category: v.category as string || 'general', youtubeId: v.youtube_id as string | null,
                    duration: v.duration_seconds as number || 60,
                    priority: v.priority as 'high' | 'medium' | 'low' || 'medium',
                    isPublished: v.is_published as boolean, sortOrder: v.sort_order as number || 0
                }))
                setVideos(mapped)
            }
        } catch (error) { console.error('Error loading videos:', error) }
        finally { setLoadingVideos(false) }
    }, [supabase])

    // ==========================================================================
    // SECTION 8: EFFECTS
    // ==========================================================================

    useEffect(() => { loadUserInfo(); loadCharacters(); loadPastSessions() }, [loadUserInfo, loadCharacters, loadPastSessions])
    useEffect(() => { if (activeTab === 'choose-contract' && templates.length === 0) loadTemplates() }, [activeTab, templates.length, loadTemplates])
    useEffect(() => { if (activeTab === 'videos' && videos.length === 0) loadVideos() }, [activeTab, videos.length, loadVideos])

    // ==========================================================================
    // SECTION 9: EVENT HANDLERS (Quick Start / Scenario)
    // ==========================================================================

    const handleCharacterClick = (character: TrainingCharacter) => {
        setSelectedCharacter(character)
        setSelectedScenario(null)
        setCreateError(null)
        setShowScenarioModal(true)
        eventLogger.started('training', 'character_selected', {
            characterId: character.characterId,
            characterName: character.characterName,
            difficultyLevel: character.difficultyLevel
        })
    }

    const handleScenarioSelect = (scenario: CharacterScenario) => {
        setSelectedScenario(scenario)
        setCreateError(null)
    }

    const handleStartSession = async () => {
        if (!selectedCharacter || !selectedScenario || !userInfo) return
        setIsCreatingSession(true)
        setCreateError(null)

        try {
            // ================================================================
            // FIXED: Call training-start-scenario instead of session-create
            // ================================================================
            const response = await fetch(`${API_BASE}/training-start-scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // User context
                    userId: userInfo.userId,
                    userEmail: userInfo.email,
                    userName: `${userInfo.firstName} ${userInfo.lastName}`,
                    companyName: userInfo.company,
                    companyId: userInfo.companyId,

                    // Character & Scenario IDs
                    characterId: selectedCharacter.characterId,
                    scenarioId: selectedScenario.scenarioId,

                    // Contract details from scenario
                    contractType: selectedScenario.contractType,
                    contractName: `Training: ${selectedScenario.scenarioName}`,
                    dealValue: selectedScenario.dealValueMax,
                    dealCurrency: selectedScenario.dealCurrency,
                    dealDuration: selectedScenario.dealDurationMonths,

                    // Character details for provider setup
                    characterName: selectedCharacter.characterName,
                    aiCompanyName: selectedCharacter.companyName,
                    aiPersonality: selectedCharacter.personalityType,
                    difficultyLevel: selectedCharacter.difficultyLevel,
                    baseLeverageCustomer: selectedCharacter.baseLeverageCustomer,
                    baseLeverageProvider: selectedCharacter.baseLeverageProvider,

                    // Scenario context
                    customerCompanyName: selectedScenario.customerCompanyName,
                    customerIndustry: selectedScenario.customerIndustry,
                    customerSituation: selectedScenario.customerSituation,
                    scenarioName: selectedScenario.scenarioName,
                    scenarioBrief: selectedScenario.scenarioBrief
                })
            })

            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to create training session')
            }

            if (!data.sessionId) {
                throw new Error('No session ID returned from training workflow')
            }

            eventLogger.completed('training', 'session_created', {
                sessionId: data.sessionId,
                bidId: data.bidId,
                characterName: selectedCharacter.characterName,
                scenarioName: selectedScenario.scenarioName
            })

            // Navigate to Contract Studio with the new session
            router.push(`/auth/contract-studio?session_id=${data.sessionId}`)

        } catch (error) {
            console.error('Error creating training session:', error)
            setCreateError(error instanceof Error ? error.message : 'An error occurred. Please try again.')
        } finally {
            setIsCreatingSession(false)
        }
    }

    const handleContinueSession = (sessionId: string) => {
        router.push(`/auth/contract-studio?session_id=${sessionId}`)
    }

    // ==========================================================================
    // SECTION 9B: EVENT HANDLERS (Choose Your Contract)
    // ==========================================================================

    const handleTemplateClick = (template: ContractTemplate) => {
        setSelectedTemplate(template); setPracticeDifficulty('balanced'); setPracticeCharacterId('auto'); setPracticeError(null); setShowPracticeModal(true)
    }

    const handleStartChooseContract = async () => {
        if (!selectedTemplate || !userInfo) return
        setIsCreatingPractice(true); setPracticeError(null)
        try {
            let resolvedCharacter: TrainingCharacter | null = null
            if (practiceCharacterId === 'auto') {
                const personalityMap: Record<DifficultyMode, string> = { cooperative: 'cooperative', balanced: 'balanced', aggressive: 'aggressive' }
                resolvedCharacter = characters.find(c => c.personalityType === personalityMap[practiceDifficulty]) || characters[0] || null
            } else {
                resolvedCharacter = characters.find(c => c.characterId === practiceCharacterId) || null
            }

            const response = await fetch(`${API_BASE}/session-create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: userInfo.email, companyName: userInfo.company,
                    userName: `${userInfo.firstName} ${userInfo.lastName}`, isTraining: true,
                    mediation_type: 'standard', contract_type: selectedTemplate.contractType,
                    contract_name: `Training: ${selectedTemplate.templateName}`,
                    template_source: 'template', source_template_id: selectedTemplate.templateId,
                    assessment_completed: true,
                    deal_context: {
                        training_mode: 'choose_contract', ai_difficulty: practiceDifficulty,
                        ai_character_id: resolvedCharacter?.characterId || null,
                        ai_character_name: resolvedCharacter?.characterName || 'AI Counterpart',
                        ai_company_name: resolvedCharacter?.companyName || 'Training Provider',
                        ai_personality: resolvedCharacter?.personalityType || practiceDifficulty,
                        template_id: selectedTemplate.templateId, template_name: selectedTemplate.templateName,
                        difficulty_level: practiceDifficulty
                    }
                })
            })
            const data = await response.json()
            if (!response.ok || !data.sessionId) throw new Error(data.error || 'Failed to create practice session')
            const sessionId = data.sessionId

            // Apply difficulty modifier to provider positions
            const { data: positions } = await supabase.from('session_clause_positions').select('*').eq('session_id', sessionId)
            if (positions) {
                const modifiers: Record<DifficultyMode, number> = { cooperative: -1.5, balanced: 0, aggressive: 1.5 }
                const modifier = modifiers[practiceDifficulty]
                if (modifier !== 0) {
                    for (const pos of positions) {
                        const currentProvider = pos.provider_position ?? 5
                        const newProvider = Math.max(1, Math.min(10, currentProvider + modifier))
                        await supabase.from('session_clause_positions')
                            .update({ provider_position: Math.round(newProvider * 10) / 10 })
                            .eq('position_id', pos.position_id)
                    }
                }
            }
            router.push(`/auth/contract-studio?session_id=${sessionId}`)
        } catch (error) {
            console.error('Error starting practice:', error)
            setPracticeError(error instanceof Error ? error.message : 'An error occurred. Please try again.')
        } finally { setIsCreatingPractice(false) }
    }

    // ==========================================================================
    // SECTION 10: HELPER FUNCTIONS (Template & Scenario)
    // ==========================================================================

    const getScenariosForCharacter = (characterId: string): CharacterScenario[] => scenarios.filter(s => s.characterId === characterId)

    const getFilteredTemplates = (): ContractTemplate[] => {
        switch (templateSubTab) {
            case 'system': return templates.filter(t => t.isSystem)
            case 'company': return templates.filter(t => !t.isSystem && t.isPublic && t.companyId === userInfo?.companyId)
            case 'user': return templates.filter(t => !t.isSystem && !t.isPublic && t.createdByUserId === userInfo?.userId)
            default: return []
        }
    }

    const getTemplateCounts = () => ({
        system: templates.filter(t => t.isSystem).length,
        company: templates.filter(t => !t.isSystem && t.isPublic && t.companyId === userInfo?.companyId).length,
        user: templates.filter(t => !t.isSystem && !t.isPublic && t.createdByUserId === userInfo?.userId).length
    })

    const getFilteredVideos = (): TrainingVideo[] => videoCategory === 'all' ? videos : videos.filter(v => v.category === videoCategory)

    const handleSignOut = async () => { localStorage.removeItem('clarence_auth'); router.push('/auth/login') }

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
            <div onClick={() => handleCharacterClick(character)} className={`bg-white rounded-xl border-2 ${theme.border} ${theme.hover} hover:shadow-lg transition-all cursor-pointer overflow-hidden group`}>
                <div className={`${theme.bgLight} px-6 py-5 border-b ${theme.border}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 ${theme.bg} rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md group-hover:scale-105 transition-transform`}>
                            {character.avatarUrl ? <img src={character.avatarUrl} alt={character.characterName} className="w-full h-full rounded-full object-cover" /> : character.avatarInitials}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 text-lg">{character.characterName}</h3>
                            <p className="text-sm text-slate-600">{character.characterTitle}</p>
                            <p className="text-xs text-slate-500">{character.companyName}</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">{difficulty.icon}</span>
                        <span className={`text-sm font-semibold ${difficulty.color}`}>{difficulty.label}</span>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="text-xs text-slate-500">{difficulty.description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                        <span>📋 {characterScenarios.length} scenario{characterScenarios.length !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{character.negotiationStyle}</p>
                </div>
                <div className={`px-6 py-4 ${theme.bgLight} border-t ${theme.border}`}>
                    <button className={`w-full py-2.5 bg-gradient-to-r ${difficulty.gradient} text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity`}>
                        Negotiate with {character.characterName.split(' ')[0]}
                    </button>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 12B: RENDER - TEMPLATE CARD COMPONENT
    // ==========================================================================

    const TemplateCard = ({ template }: { template: ContractTemplate }) => {
        const icon = getContractTypeIcon(template.contractType)
        const isFromSession = !!template.sourceSessionId
        return (
            <div onClick={() => handleTemplateClick(template)} className="bg-white rounded-xl border-2 border-slate-200 hover:border-amber-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden group">
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{icon}</div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 truncate">{template.templateName}</h4>
                            <p className="text-xs text-slate-500 capitalize">{template.contractType.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                </div>
                <div className="px-5 py-3">
                    {template.description && <p className="text-sm text-slate-600 line-clamp-2 mb-3">{template.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">📋 {template.clauseCount} clauses</span>
                        {template.timesUsed > 0 && <span className="flex items-center gap-1">🔄 Used {template.timesUsed}x</span>}
                        {isFromSession && <span className="flex items-center gap-1 text-amber-600">⭐ From negotiation</span>}
                    </div>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                    <button className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors group-hover:bg-amber-600">Practice with this contract</button>
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
                    <div className={`${theme.bgLight} px-6 py-5 border-b ${theme.border} flex-shrink-0`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 ${theme.bg} rounded-full flex items-center justify-center text-white text-lg font-bold`}>
                                    {selectedCharacter.avatarUrl ? <img src={selectedCharacter.avatarUrl} alt={selectedCharacter.characterName} className="w-full h-full rounded-full object-cover" /> : selectedCharacter.avatarInitials}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedCharacter.characterName}</h2>
                                    <p className="text-sm text-slate-600">{selectedCharacter.characterTitle} &bull; {selectedCharacter.companyName}</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowScenarioModal(false); setSelectedCharacter(null); setSelectedScenario(null) }} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 italic mt-3">&ldquo;{selectedCharacter.signatureQuote}&rdquo;</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Choose a Scenario</h3>
                        <div className="space-y-4">
                            {characterScenarios.map((scenario) => (
                                <div key={scenario.scenarioId} onClick={() => handleScenarioSelect(scenario)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedScenario?.scenarioId === scenario.scenarioId ? `${theme.border} ${theme.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <h4 className="font-semibold text-slate-800">{scenario.scenarioName}</h4>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{scenario.contractTypeLabel || scenario.contractType}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-3">{scenario.scenarioDescription}</p>
                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <span>💰 {formatCurrency(scenario.dealValueMin, scenario.dealCurrency)} - {formatCurrency(scenario.dealValueMax, scenario.dealCurrency)}</span>
                                        <span>📋 {scenario.clauseCount} clauses</span>
                                        <span>⏱️ ~{formatDuration(scenario.estimatedDurationMinutes)}</span>
                                    </div>
                                </div>
                            ))}
                            {characterScenarios.length === 0 && (
                                <div className="text-center py-8 text-slate-500"><p>No scenarios available for this counterpart yet.</p><p className="text-sm mt-2">Check back soon!</p></div>
                            )}
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <button onClick={() => { setShowScenarioModal(false); setSelectedCharacter(null); setSelectedScenario(null) }} className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium">Cancel</button>
                            {createError && <p className="text-sm text-red-600 mx-4">{createError}</p>}
                            <button onClick={handleStartSession} disabled={!selectedScenario || isCreatingSession}
                                className={`px-6 py-2.5 bg-gradient-to-r ${difficulty.gradient} text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}>
                                {isCreatingSession ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Starting...</>) : (<>Start Training<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 13B: RENDER - PRACTICE CONFIG MODAL (Choose Your Contract)
    // ==========================================================================

    const PracticeConfigModal = () => {
        if (!showPracticeModal || !selectedTemplate) return null
        const icon = getContractTypeIcon(selectedTemplate.contractType)
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="bg-amber-50 px-6 py-5 border-b border-amber-200 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm">{icon}</div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{selectedTemplate.templateName}</h2>
                                    <p className="text-sm text-slate-500 capitalize">{selectedTemplate.contractType.replace(/_/g, ' ')} &bull; {selectedTemplate.clauseCount} clauses</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowPracticeModal(false); setSelectedTemplate(null) }} className="p-2 hover:bg-amber-100 rounded-lg transition-colors">
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Counterpart Difficulty</h3>
                            <div className="space-y-2">
                                {(['cooperative', 'balanced', 'aggressive'] as DifficultyMode[]).map(mode => {
                                    const config = DIFFICULTY_CONFIG[mode === 'cooperative' ? 'beginner' : mode === 'aggressive' ? 'advanced' : 'intermediate']
                                    return (
                                        <label key={mode} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${practiceDifficulty === mode ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <input type="radio" name="difficulty" value={mode} checked={practiceDifficulty === mode} onChange={() => setPracticeDifficulty(mode)} className="sr-only" />
                                            <span className="text-lg">{config.icon}</span>
                                            <div className="flex-1"><p className="font-medium text-slate-800">{config.label}</p><p className="text-xs text-slate-500">{config.description}</p></div>
                                            {practiceDifficulty === mode && <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">AI Counterpart</h3>
                            <div className="space-y-2">
                                <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${practiceCharacterId === 'auto' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <input type="radio" name="character" value="auto" checked={practiceCharacterId === 'auto'} onChange={() => setPracticeCharacterId('auto')} className="sr-only" />
                                    <span className="text-lg">🤖</span>
                                    <div className="flex-1"><p className="font-medium text-slate-800">Auto-select</p><p className="text-xs text-slate-500">Match counterpart to difficulty level</p></div>
                                </label>
                                {characters.map(char => (
                                    <label key={char.characterId} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${practiceCharacterId === char.characterId ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input type="radio" name="character" value={char.characterId} checked={practiceCharacterId === char.characterId} onChange={() => setPracticeCharacterId(char.characterId)} className="sr-only" />
                                        <div className={`w-8 h-8 ${THEME_COLORS[char.themeColor as keyof typeof THEME_COLORS]?.bg || 'bg-slate-500'} rounded-full flex items-center justify-center text-white text-xs font-bold`}>{char.avatarInitials}</div>
                                        <div className="flex-1"><p className="font-medium text-slate-800">{char.characterName}</p><p className="text-xs text-slate-500">{char.companyName} &bull; {DIFFICULTY_CONFIG[char.difficultyLevel]?.label}</p></div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <button onClick={() => { setShowPracticeModal(false); setSelectedTemplate(null) }} className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium">Cancel</button>
                            {practiceError && <p className="text-sm text-red-600 mx-4">{practiceError}</p>}
                            <button onClick={handleStartChooseContract} disabled={isCreatingPractice}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {isCreatingPractice ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating Session...</>) : (<>Start Practice<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>)}
                            </button>
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
    const activeSessions = pastSessions.filter(s => s.status !== 'completed').length

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
            {/* ================================================================ */}
            {/* SECTION 15: HEADER (AuthenticatedHeader) */}
            {/* ================================================================ */}
            <AuthenticatedHeader activePage="training" userInfo={userInfo} onSignOut={handleSignOut} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ============================================================ */}
                {/* SECTION 16: HERO BANNER */}
                {/* ============================================================ */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 mb-8 text-white">
                    <div className="max-w-2xl">
                        <h2 className="text-2xl font-bold mb-2">Practice Makes Perfect</h2>
                        <p className="text-amber-100 mb-4">Sharpen your negotiation skills with AI counterparts of varying difficulty. CLARENCE will guide you as your neutral mediator &mdash; just like in real negotiations.</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5"><span>🎭</span><span>{characters.length} Counterparts</span></div>
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5"><span>📋</span><span>{templates.length > 0 ? templates.length : '...'} Templates</span></div>
                            <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5"><span>🤖</span><span>CLARENCE as Mediator</span></div>
                        </div>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* SECTION 16B: TRAINING MODE CARDS */}
                {/* ============================================================ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* Solo vs AI - Default active mode */}
                    <div className="bg-white rounded-xl border-2 border-amber-400 shadow-md p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">ACTIVE</div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">🤖</div>
                            <div>
                                <h3 className="font-bold text-slate-800">Solo vs AI</h3>
                                <p className="text-xs text-amber-600 font-medium">Practice anytime</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">Jump into a pre-built scenario or choose a template. Negotiate against AI counterparts with CLARENCE as your mediator.</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-amber-50 px-2 py-1 rounded">⚡ Instant start</span>
                            <span className="bg-amber-50 px-2 py-1 rounded">🎭 3 AI counterparts</span>
                        </div>
                    </div>

                    {/* Upload Your Own Contract */}
                    <button
                        onClick={() => router.push('/auth/create-contract?mode=training')}
                        className="bg-white rounded-xl border-2 border-slate-200 hover:border-violet-400 hover:shadow-md p-6 text-left transition-all group"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📤</div>
                            <div>
                                <h3 className="font-bold text-slate-800">Upload Your Own</h3>
                                <p className="text-xs text-violet-600 font-medium">Bring your contract</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">Upload a contract document, go through the intake process, then negotiate it against an AI counterpart.</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-violet-50 px-2 py-1 rounded">📄 PDF / DOCX</span>
                            <span className="bg-violet-50 px-2 py-1 rounded">🤖 AI generates positions</span>
                        </div>
                    </button>

                    {/* Practice with a Partner */}
                    <button
                        onClick={() => router.push('/auth/create-contract?mode=training&partner=true')}
                        className="bg-white rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-md p-6 text-left transition-all group"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">👥</div>
                            <div>
                                <h3 className="font-bold text-slate-800">Practice with a Partner</h3>
                                <p className="text-xs text-blue-600 font-medium">Invite a colleague</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">Set up a practice contract and invite a colleague to negotiate with. Both sides get the full CLARENCE experience.</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-blue-50 px-2 py-1 rounded">👤 Real counterpart</span>
                            <span className="bg-blue-50 px-2 py-1 rounded">🔄 Swap roles</span>
                        </div>
                    </button>
                </div>

                {/* ============================================================ */}
                {/* SECTION 16C: TAB NAVIGATION */}
                {/* ============================================================ */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    <button onClick={() => setActiveTab('quick-start')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'quick-start' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>🎯 Quick Start</button>
                    <button onClick={() => setActiveTab('choose-contract')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'choose-contract' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>📑 Choose Your Contract</button>
                    <button onClick={() => setActiveTab('videos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'videos' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>📹 Videos</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${activeTab === 'history' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
                        📜 History
                        {activeSessions > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === 'history' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'}`}>{activeSessions}</span>}
                    </button>
                </div>

                {/* ============================================================ */}
                {/* SECTION 17: QUICK START TAB */}
                {/* ============================================================ */}
                {activeTab === 'quick-start' && (
                    <div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
                            <div className="flex items-center gap-2 mb-4"><span className="text-xl">💡</span><h3 className="text-lg font-semibold text-slate-800">How Training Works</h3></div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">1</div>
                                    <div><p className="font-medium text-slate-800">Choose a Counterpart</p><p className="text-sm text-slate-500">Select from AI characters with different negotiation styles.</p></div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 font-bold flex-shrink-0">2</div>
                                    <div><p className="font-medium text-slate-800">Negotiate Clauses</p><p className="text-sm text-slate-500">Adjust positions on contract clauses. CLARENCE guides you as mediator.</p></div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 font-bold flex-shrink-0">3</div>
                                    <div><p className="font-medium text-slate-800">Learn &amp; Improve</p><p className="text-sm text-slate-500">Get feedback on your negotiation strategy and tactics.</p></div>
                                </div>
                            </div>
                        </div>
                        {loadingCharacters ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{[1, 2, 3].map(i => (<div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"><div className="flex items-center gap-4 mb-4"><div className="w-16 h-16 bg-slate-200 rounded-full"></div><div className="flex-1"><div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div><div className="h-4 bg-slate-200 rounded w-1/2"></div></div></div><div className="h-20 bg-slate-100 rounded-lg mb-4"></div><div className="h-10 bg-slate-200 rounded-lg"></div></div>))}</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{characters.map(character => (<CharacterCard key={character.characterId} character={character} />))}</div>
                        )}
                        {!loadingCharacters && characters.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><div className="text-4xl mb-4">🎭</div><h3 className="text-lg font-semibold text-slate-800 mb-2">No Counterparts Available</h3><p className="text-slate-500">Training counterparts are being set up. Check back soon!</p></div>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* SECTION 17B: CHOOSE YOUR CONTRACT TAB */}
                {/* ============================================================ */}
                {activeTab === 'choose-contract' && (
                    <div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <div className="flex items-center gap-2 mb-3"><span className="text-xl">📑</span><h3 className="text-lg font-semibold text-slate-800">Choose Your Contract</h3></div>
                            <p className="text-sm text-slate-600">Select any contract template from your library and practice negotiating it with an AI counterpart. Templates saved from real negotiations start with original positions &mdash; giving you the same starting conditions to practice with.</p>
                        </div>
                        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-slate-200 p-1 inline-flex">
                            <button onClick={() => setTemplateSubTab('system')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${templateSubTab === 'system' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                                🏛️ System Templates {templateCounts.system > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${templateSubTab === 'system' ? 'bg-white/30' : 'bg-slate-100'}`}>{templateCounts.system}</span>}
                            </button>
                            <button onClick={() => setTemplateSubTab('company')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${templateSubTab === 'company' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                                🏢 Company Templates {templateCounts.company > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${templateSubTab === 'company' ? 'bg-white/30' : 'bg-slate-100'}`}>{templateCounts.company}</span>}
                            </button>
                            <button onClick={() => setTemplateSubTab('user')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${templateSubTab === 'user' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                                👤 My Templates {templateCounts.user > 0 && <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${templateSubTab === 'user' ? 'bg-white/30' : 'bg-slate-100'}`}>{templateCounts.user}</span>}
                            </button>
                        </div>
                        {loadingTemplates ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map(i => (<div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-slate-200 rounded-lg"></div><div className="flex-1"><div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-200 rounded w-1/2"></div></div></div><div className="h-12 bg-slate-100 rounded-lg mb-3"></div><div className="h-10 bg-slate-200 rounded-lg"></div></div>))}</div>
                        ) : (
                            <>{getFilteredTemplates().length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{getFilteredTemplates().map(template => (<TemplateCard key={template.templateId} template={template} />))}</div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                                    <div className="text-4xl mb-4">{templateSubTab === 'system' ? '🏛️' : templateSubTab === 'company' ? '🏢' : '👤'}</div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                        {templateSubTab === 'system' && 'No System Templates'}{templateSubTab === 'company' && 'No Company Templates'}{templateSubTab === 'user' && 'No Personal Templates Yet'}
                                    </h3>
                                    <p className="text-slate-500 max-w-md mx-auto mb-4">
                                        {templateSubTab === 'system' && 'System templates will be available soon.'}
                                        {templateSubTab === 'company' && "Your company hasn't shared any templates yet."}
                                        {templateSubTab === 'user' && 'Complete a negotiation and save the outcome as a template to practice with it here.'}
                                    </p>
                                    {templateSubTab === 'user' && (
                                        <Link href="/auth/contracts" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
                                            Go to Contract Library <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                        </Link>
                                    )}
                                </div>
                            )}</>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* SECTION 17C: VIDEOS TAB */}
                {/* ============================================================ */}
                {activeTab === 'videos' && (
                    <div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                            <div className="flex items-center gap-2 mb-3"><span className="text-xl">📹</span><h3 className="text-lg font-semibold text-slate-800">Training Videos</h3></div>
                            <p className="text-sm text-slate-600">Watch tutorials and guides to get the most out of CLARENCE. Learn negotiation techniques, platform features, and best practices.</p>
                        </div>
                        <div className="flex gap-2 mb-6 flex-wrap">
                            <button onClick={() => setVideoCategory('all')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${videoCategory === 'all' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>All</button>
                            {Object.entries(VIDEO_CATEGORIES).map(([key, cat]) => (
                                <button key={key} onClick={() => setVideoCategory(key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${videoCategory === key ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>{cat.icon} {cat.label}</button>
                            ))}
                        </div>
                        {loadingVideos ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map(i => (<div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"><div className="aspect-video bg-slate-200 rounded-lg mb-4"></div><div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-200 rounded w-full"></div></div>))}</div>
                        ) : getFilteredVideos().length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {getFilteredVideos().map(video => (
                                    <div key={video.videoId} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                                        {video.youtubeId ? (
                                            <div className="aspect-video bg-slate-900 relative cursor-pointer group" onClick={() => window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank')}>
                                                <img src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <svg className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="aspect-video bg-slate-100 flex items-center justify-center"><div className="text-center"><span className="text-3xl">🎬</span><p className="text-xs text-slate-400 mt-1">Coming Soon</p></div></div>
                                        )}
                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h4 className="font-semibold text-slate-800 text-sm line-clamp-2">{video.title}</h4>
                                                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${video.priority === 'high' ? 'bg-red-100 text-red-700' : video.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {video.priority === 'high' ? '🔴' : video.priority === 'medium' ? '🔵' : '⚪'}
                                                </span>
                                            </div>
                                            {video.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{video.description}</p>}
                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span>{Math.round(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
                                                <span className="capitalize">{VIDEO_CATEGORIES[video.category]?.label || video.category}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-xl border border-slate-200"><div className="text-4xl mb-4">📹</div><h3 className="text-lg font-semibold text-slate-800 mb-2">No Videos Available Yet</h3><p className="text-slate-500 max-w-md mx-auto">Training videos are being produced. Check back soon for tutorials on negotiation techniques, platform features, and best practices.</p></div>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* SECTION 17D: HISTORY TAB */}
                {/* ============================================================ */}
                {activeTab === 'history' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-slate-800">Your Training Sessions</h2>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-slate-500">{pastSessions.length} total</span>
                                {activeSessions > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{activeSessions} active</span>}
                            </div>
                        </div>
                        {pastSessions.length > 0 ? (
                            <div className="space-y-3">
                                {pastSessions.map(session => (
                                    <div key={session.sessionId} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:border-amber-300 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center"><span className="text-xl">🎯</span></div>
                                            <div>
                                                <h4 className="font-medium text-slate-800">{session.scenarioName}</h4>
                                                <p className="text-sm text-slate-500">vs {session.characterName} &bull; {formatDate(session.createdAt)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${session.status === 'completed' ? 'bg-green-100 text-green-700' : session.status === 'active' || session.status === 'negotiation_ready' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                                                {session.status === 'negotiation_ready' ? 'In Progress' : session.status}
                                            </span>
                                            <button onClick={() => handleContinueSession(session.sessionId)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
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
                                <button onClick={() => setActiveTab('quick-start')} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">Choose a Counterpart</button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ================================================================ */}
            {/* SECTION 18: MODALS */}
            {/* ================================================================ */}
            <ScenarioModal />
            <PracticeConfigModal />
        </div>
    )
}