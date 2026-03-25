'use client'

// ============================================================================
// CLARENCE Training Studio — Conversational Session Setup
// ============================================================================
// File: /app/auth/training/new/page.tsx
// Purpose: Clarence-driven training session creation through chat interface
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'
import { Suspense } from 'react'

// ============================================================================
// SECTION 1: INTERFACES
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

interface CompanyPlaybook {
    playbookId: string
    playbookName: string
    playbookDescription: string | null
    contractType: string | null
    rulesCount: number
}

interface ContractTemplate {
    templateId: string
    templateName: string
    contractType: string
    clauseCount: number
    description: string
    isSystem: boolean
    isPublic: boolean
    companyId: string | null
    createdByUserId: string | null
}

interface OptionButton {
    label: string
    value: string
    icon: string
    description: string
}

interface ScenarioBrief {
    counterpartyName: string
    counterpartyTitle: string
    counterpartyCompany: string
    contractType: string
    contractContext: string
    dealValue: number
    dealCurrency: string
    dealDurationMonths: number
    keyDynamics: string[]
    leverageCustomer: number
    leverageProvider: number
    agentStyle: string
    greetingMessage: string
}

interface ChatMessage {
    id: string
    type: 'clarence' | 'user' | 'system'
    content: string
    timestamp: Date
    options?: OptionButton[]
    scenarioBrief?: ScenarioBrief
    actionButton?: {
        label: string
        actionId: string
    }
}

type SetupPhase = 'loading' | 'greeting' | 'preferences' | 'generating' | 'ready' | 'launching' | 'error'

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_OPTIONS: OptionButton[] = [
    { label: 'IT Services', value: 'it_services', icon: '💻', description: 'Software development, managed services, consulting' },
    { label: 'SaaS Agreement', value: 'saas', icon: '☁️', description: 'Software-as-a-Service subscription agreements' },
    { label: 'BPO', value: 'bpo', icon: '🏢', description: 'Business process outsourcing contracts' },
    { label: 'Any Type', value: 'any', icon: '🎲', description: 'Let Clarence choose the best contract type for you' },
]

const DIFFICULTY_OPTIONS: OptionButton[] = [
    { label: 'Cooperative', value: 'beginner', icon: '🌱', description: 'Friendly counterpart, willing to find common ground' },
    { label: 'Balanced', value: 'intermediate', icon: '⚖️', description: 'Professional and pragmatic, pushes back fairly' },
    { label: 'Assertive', value: 'advanced', icon: '🔥', description: 'Experienced negotiator who drives a hard bargain' },
]

const ROLE_OPTIONS: OptionButton[] = [
    { label: 'Customer', value: 'protected', icon: '🛡️', description: 'You are buying — negotiate protections and value' },
    { label: 'Provider', value: 'providing', icon: '🏗️', description: 'You are selling — negotiate terms and flexibility' },
]

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

function TrainingStudioPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const chatEndRef = useRef<HTMLDivElement>(null)
    const preselectedPlaybookId = searchParams.get('playbook_id')

    // State
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [phase, setPhase] = useState<SetupPhase>('loading')
    const [chatInput, setChatInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Playbooks & Templates
    const [companyPlaybooks, setCompanyPlaybooks] = useState<CompanyPlaybook[]>([])
    const [templates, setTemplates] = useState<ContractTemplate[]>([])

    // Collected preferences
    const [selectedPath, setSelectedPath] = useState<'dynamic' | 'playbook' | 'quick' | 'colleague' | null>(null)
    const [selectedRole, setSelectedRole] = useState<'protected' | 'providing' | null>(null)
    const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(preselectedPlaybookId)
    const [selectedContractType, setSelectedContractType] = useState<string | null>(null)
    const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

    // Colleague mode
    const [colleagueEmail, setColleagueEmail] = useState('')
    const [colleagueName, setColleagueName] = useState('')
    const [colleagueCompany, setColleagueCompany] = useState('')
    const [showColleagueInput, setShowColleagueInput] = useState(false)
    const [inviteLink, setInviteLink] = useState<string | null>(null)

    // Generated data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [scenario, setScenario] = useState<any>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [agentConfig, setAgentConfig] = useState<any>(null)

    // ========================================================================
    // SECTION 4: HELPERS
    // ========================================================================

    const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        setMessages(prev => [...prev, {
            ...msg,
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            timestamp: new Date(),
        }])
    }, [])

    // Scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ========================================================================
    // SECTION 5: AUTH & DATA LOADING
    // ========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) { router.push('/auth/login'); return null }
        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        return authData.userInfo as UserInfo
    }, [router])

    const loadPlaybooks = useCallback(async (companyId: string) => {
        try {
            const { data: playbooksData } = await supabase
                .from('company_playbooks')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('playbook_name')

            if (!playbooksData) return []

            const playbooksWithCounts: CompanyPlaybook[] = await Promise.all(
                playbooksData.map(async (pb) => {
                    const { count } = await supabase
                        .from('playbook_rules')
                        .select('*', { count: 'exact', head: true })
                        .eq('playbook_id', pb.playbook_id)
                        .eq('is_active', true)

                    return {
                        playbookId: pb.playbook_id,
                        playbookName: pb.playbook_name,
                        playbookDescription: pb.playbook_description,
                        contractType: pb.contract_type_key,
                        rulesCount: count || 0,
                    }
                })
            )

            setCompanyPlaybooks(playbooksWithCounts)
            return playbooksWithCounts
        } catch {
            return []
        }
    }, [supabase])

    const loadTemplates = useCallback(async (companyId?: string, userId?: string) => {
        try {
            const { data, error } = await supabase
                .from('contract_templates')
                .select('template_id, template_name, contract_type, clause_count, description, is_system, is_public, company_id, created_by_user_id')
                .eq('is_active', true)
                .order('template_name', { ascending: true })

            if (error || !data) return []

            const allTemplates: ContractTemplate[] = data.map((t: Record<string, unknown>) => ({
                templateId: t.template_id as string,
                templateName: t.template_name as string,
                contractType: (t.contract_type as string) || 'custom',
                clauseCount: (t.clause_count as number) || 0,
                description: (t.description as string) || '',
                isSystem: (t.is_system as boolean) || false,
                isPublic: (t.is_public as boolean) || false,
                companyId: (t.company_id as string) || null,
                createdByUserId: (t.created_by_user_id as string) || null,
            }))

            // Filter: system templates (visible to all) + company templates + user's own
            const owned = allTemplates.filter(t =>
                t.isSystem ||
                (t.isPublic && companyId && t.companyId === companyId) ||
                (userId && t.createdByUserId === userId)
            )

            setTemplates(owned)
            return owned
        } catch {
            return []
        }
    }, [supabase])

    // ========================================================================
    // SECTION 6: ASSESS USER (on page load)
    // ========================================================================

    const startConversation = useCallback(async (user: UserInfo, playbooks: CompanyPlaybook[]) => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/agents/training-orchestrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assess',
                    userId: user.userId,
                    companyId: user.companyId,
                }),
            })

            const result = await response.json()

            if (result.success && result.assessment) {
                const assessment = result.assessment

                // Clarence greeting
                addMessage({
                    type: 'clarence',
                    content: assessment.greeting,
                })

                // Recommendation message
                addMessage({
                    type: 'clarence',
                    content: assessment.recommendation + '\n\nWhat would you like to do?',
                    options: buildPathOptions(playbooks),
                })

                setPhase('greeting')
            } else {
                // Fallback greeting if assessment fails
                addMessage({
                    type: 'clarence',
                    content: `Welcome to the Training Studio, ${user.firstName || 'there'}! I'm Clarence, and I'll help you set up a training session.\n\nWhat would you like to do?`,
                    options: buildPathOptions(playbooks),
                })
                setPhase('greeting')
            }
        } catch {
            // Fallback greeting on error
            addMessage({
                type: 'clarence',
                content: `Welcome, ${user.firstName || 'there'}! Let's set up a training session.\n\nChoose how you'd like to practise:`,
                options: buildPathOptions(playbooks),
            })
            setPhase('greeting')
        } finally {
            setIsLoading(false)
        }
    }, [addMessage])

    function buildPathOptions(playbooks: CompanyPlaybook[]): OptionButton[] {
        const options: OptionButton[] = []

        if (playbooks.length > 0) {
            options.push({
                label: 'Playbook Training',
                value: 'playbook',
                icon: '📋',
                description: `Train against your company playbook (${playbooks.length} available)`,
            })
        }

        options.push({
            label: 'Dynamic Scenario',
            value: 'dynamic',
            icon: '🎯',
            description: 'I\'ll design a scenario tailored to your skill level',
        })

        options.push({
            label: 'Play Against a Colleague',
            value: 'colleague',
            icon: '👥',
            description: 'Negotiate live with someone you know',
        })

        options.push({
            label: 'Quick Practice',
            value: 'quick',
            icon: '⚡',
            description: 'Jump straight into a session with default settings',
        })

        return options
    }

    // ========================================================================
    // SECTION 7: INITIALISATION
    // ========================================================================

    useEffect(() => {
        let mounted = true

        async function init() {
            const user = await loadUserInfo()
            if (!user || !mounted) return

            const [playbooks] = await Promise.all([
                user.companyId ? loadPlaybooks(user.companyId) : Promise.resolve([]),
                loadTemplates(user.companyId, user.userId),
            ])

            // If playbook pre-selected via URL, skip to playbook path but ask role first
            if (preselectedPlaybookId && playbooks.find(p => p.playbookId === preselectedPlaybookId)) {
                setSelectedPath('playbook')
                setSelectedPlaybookId(preselectedPlaybookId)
                addMessage({
                    type: 'clarence',
                    content: `Training on your company playbook. Which role do you want to take?`,
                    options: ROLE_OPTIONS,
                })
                setPhase('preferences')
                return
            }

            if (mounted) {
                await startConversation(user, playbooks)
            }
        }

        init()
        return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ========================================================================
    // SECTION 8: OPTION CLICK HANDLERS
    // ========================================================================

    const handleOptionClick = useCallback(async (value: string, label: string) => {
        // Add user selection as a message
        addMessage({ type: 'user', content: label })

        // Phase: Path Selection → always ask role next
        if (phase === 'greeting') {
            setSelectedPath(value as 'dynamic' | 'playbook' | 'quick' | 'colleague')

            addMessage({
                type: 'clarence',
                content: 'Which side of the negotiation do you want to train on?',
                options: ROLE_OPTIONS,
            })
            setPhase('preferences')
            return
        }

        // Phase: Template selection (after scenario generated)
        if (phase === 'ready' && value.startsWith('template:')) {
            const templateId = value.replace('template:', '')
            const template = templates.find(t => t.templateId === templateId)
            setSelectedTemplateId(templateId)

            if (selectedPath === 'colleague') {
                // Colleague path: after template, ask for colleague details
                addMessage({
                    type: 'clarence',
                    content: `**${template?.templateName}** selected. Now, who will you be negotiating with?\n\nEnter their details below.`,
                })
                setShowColleagueInput(true)
                return
            }

            if (template) {
                addMessage({
                    type: 'clarence',
                    content: `**${template.templateName}** — ${template.clauseCount} clauses. Ready to begin?`,
                    actionButton: { label: 'Start Session', actionId: 'start-session' },
                })
            }
            return
        }

        // Phase: Preferences gathering
        if (phase === 'preferences') {
            // Role selection (all paths) — fires first before other preferences
            if (!selectedRole) {
                setSelectedRole(value as 'protected' | 'providing')
                const roleLabel = value === 'protected' ? 'Customer' : 'Provider'

                if (selectedPath === 'quick') {
                    setPhase('generating')
                    addMessage({
                        type: 'clarence',
                        content: `Training as **${roleLabel}**. Setting up a quick session now...`,
                    })
                    await generateSession({})
                    return
                }

                if (selectedPath === 'playbook') {
                    if (companyPlaybooks.length === 1) {
                        setSelectedPlaybookId(companyPlaybooks[0].playbookId)
                        addMessage({
                            type: 'clarence',
                            content: `Training as **${roleLabel}** with your **${companyPlaybooks[0].playbookName}** playbook. How tough do you want the counterpart to be?`,
                            options: DIFFICULTY_OPTIONS,
                        })
                    } else {
                        addMessage({
                            type: 'clarence',
                            content: `Training as **${roleLabel}**. Which playbook would you like to use?`,
                            options: companyPlaybooks.map(pb => ({
                                label: pb.playbookName,
                                value: pb.playbookId,
                                icon: '📋',
                                description: `${pb.rulesCount} rules${pb.contractType ? ` | ${pb.contractType}` : ''}`,
                            })),
                        })
                    }
                    return
                }

                if (selectedPath === 'dynamic') {
                    addMessage({
                        type: 'clarence',
                        content: `Training as **${roleLabel}**. What type of contract would you like to negotiate?`,
                        options: CONTRACT_TYPE_OPTIONS,
                    })
                    return
                }

                if (selectedPath === 'colleague') {
                    addMessage({
                        type: 'clarence',
                        content: `Training as **${roleLabel}** against a colleague. What type of contract?`,
                        options: CONTRACT_TYPE_OPTIONS,
                    })
                    return
                }

                return
            }

            // Playbook selection (from multi-playbook list)
            if (selectedPath === 'playbook' && !selectedPlaybookId) {
                const pb = companyPlaybooks.find(p => p.playbookId === value)
                if (pb) {
                    setSelectedPlaybookId(value)
                    addMessage({
                        type: 'clarence',
                        content: `**${pb.playbookName}** — good choice. How tough do you want the counterpart to be?`,
                        options: DIFFICULTY_OPTIONS,
                    })
                }
                return
            }

            // Contract type selection (dynamic path)
            if (selectedPath === 'dynamic' && !selectedContractType) {
                setSelectedContractType(value)
                addMessage({
                    type: 'clarence',
                    content: 'And how challenging would you like this to be?',
                    options: DIFFICULTY_OPTIONS,
                })
                return
            }

            // Contract type selection (colleague path) — skip difficulty, go to template
            if (selectedPath === 'colleague' && !selectedContractType) {
                setSelectedContractType(value)
                const matchingTemplates = templates.filter(t => {
                    if (value === 'any') return true
                    const typeMatch = t.contractType?.toLowerCase() === value.toLowerCase()
                    const nameMatch = t.templateName?.toLowerCase().includes(value.toLowerCase().replace(/_/g, ' '))
                    return typeMatch || nameMatch
                })
                const templatesToShow = matchingTemplates.length > 0 ? matchingTemplates : templates

                if (templatesToShow.length === 0) {
                    addMessage({
                        type: 'clarence',
                        content: 'You need a contract template first. Create one in Templates, then come back.',
                        options: [
                            { label: 'Go to Templates', value: 'goto-templates', icon: '📄', description: 'Create a template' },
                            { label: 'Back', value: 'back', icon: '←', description: 'Return to dashboard' },
                        ],
                    })
                    setPhase('error')
                    return
                }

                if (templatesToShow.length === 1) {
                    setSelectedTemplateId(templatesToShow[0].templateId)
                    addMessage({
                        type: 'clarence',
                        content: `Using **${templatesToShow[0].templateName}** (${templatesToShow[0].clauseCount} clauses). Now, who will you be negotiating with?\n\nEnter their details below.`,
                    })
                    setShowColleagueInput(true)
                } else {
                    addMessage({
                        type: 'clarence',
                        content: 'Which template should we use for this negotiation?',
                        options: templatesToShow.map(t => ({
                            label: t.templateName,
                            value: `template:${t.templateId}`,
                            icon: '📄',
                            description: `${t.clauseCount} clauses`,
                        })),
                    })
                    setPhase('ready')
                }
                return
            }

            // Difficulty selection (final preference for both paths)
            if (!selectedDifficulty) {
                setSelectedDifficulty(value)
                setPhase('generating')
                addMessage({
                    type: 'clarence',
                    content: 'I\'m designing your scenario and creating a counterpart. This takes a moment...',
                })

                const preferences: Record<string, string> = { difficulty: value }
                if (selectedContractType && selectedContractType !== 'any') {
                    preferences.contractType = selectedContractType
                }

                await generateSession(preferences)
                return
            }
        }

        // Navigation options (available from error/ready states)
        if (value === 'goto-templates') {
            router.push('/auth/contracts')
            return
        }
        if (value === 'back') {
            router.push('/auth/training')
            return
        }
    }, [phase, selectedPath, selectedRole, selectedPlaybookId, selectedContractType, selectedDifficulty, companyPlaybooks, templates, addMessage, router])

    // ========================================================================
    // SECTION 9: GENERATE SESSION
    // ========================================================================

    const generateSession = useCallback(async (preferences: Record<string, string>) => {
        if (!userInfo) return
        setIsLoading(true)

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const requestBody: any = {
                action: 'generate',
                userId: userInfo.userId,
                companyId: userInfo.companyId,
                preferences: {
                    difficulty: preferences.difficulty || 'intermediate',
                    contractType: preferences.contractType,
                },
            }

            if (selectedPlaybookId) {
                requestBody.playbookId = selectedPlaybookId
            }

            const response = await fetch('/api/agents/training-orchestrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            })

            const result = await response.json()

            if (!result.success || !result.scenario || !result.agentConfig) {
                throw new Error(result.error || 'Failed to generate scenario')
            }

            setScenario(result.scenario)
            setAgentConfig(result.agentConfig)

            // Clarence introduces the counterparty
            const agent = result.agentConfig
            const sc = result.scenario
            const leverage = agent.leverageResult

            const scenarioBrief: ScenarioBrief = {
                counterpartyName: agent.persona.name,
                counterpartyTitle: agent.persona.title,
                counterpartyCompany: agent.persona.company,
                contractType: sc.contractType,
                contractContext: sc.contractContext,
                dealValue: sc.dealValue,
                dealCurrency: sc.dealCurrency || 'GBP',
                dealDurationMonths: sc.dealDurationMonths,
                keyDynamics: sc.keyDynamics || [],
                leverageCustomer: leverage?.customerLeverage || 50,
                leverageProvider: leverage?.providerLeverage || 50,
                agentStyle: agent.personalityTraits.style,
                greetingMessage: agent.greetingMessage,
            }

            addMessage({
                type: 'clarence',
                content: `Your scenario is ready. Here's the briefing:`,
                scenarioBrief,
            })

            addMessage({
                type: 'clarence',
                content: sc.userBrief || `You'll be negotiating with **${agent.persona.name}**, ${agent.persona.title} at **${agent.persona.company}**. ${sc.narrative}`,
            })

            // Find matching templates for the contract type
            const contractType = sc.contractType || ''
            const matchingTemplates = templates.filter(t => {
                const typeMatch = t.contractType?.toLowerCase() === contractType.toLowerCase()
                const nameMatch = t.templateName?.toLowerCase().includes(contractType.toLowerCase().replace(/_/g, ' '))
                return typeMatch || nameMatch
            })

            // Use all templates if no matches found
            const templatesToShow = matchingTemplates.length > 0 ? matchingTemplates : templates

            if (templatesToShow.length === 1) {
                // Only one template — auto-select and go straight to Start
                setSelectedTemplateId(templatesToShow[0].templateId)
                addMessage({
                    type: 'clarence',
                    content: `I'll use the **${templatesToShow[0].templateName}** template (${templatesToShow[0].clauseCount} clauses) for the contract structure. Ready to begin?`,
                    actionButton: { label: 'Start Session', actionId: 'start-session' },
                })
            } else if (templatesToShow.length > 0) {
                // Multiple templates — let user choose
                addMessage({
                    type: 'clarence',
                    content: 'Which contract template would you like to use for the clause structure?',
                    options: templatesToShow.map(t => ({
                        label: t.templateName,
                        value: `template:${t.templateId}`,
                        icon: '📄',
                        description: `${t.clauseCount} clauses | ${t.contractType.replace(/_/g, ' ')}`,
                    })),
                })
            } else {
                // No templates — direct user to create one first
                addMessage({
                    type: 'clarence',
                    content: 'You don\'t have any contract templates yet. Templates provide the clause structure for your training sessions.\n\nHead over to your **Templates** page to create or import one, then come back here to start training.',
                    options: [
                        { label: 'Go to Templates', value: 'goto-templates', icon: '📄', description: 'Create a contract template first' },
                        { label: 'Back to Dashboard', value: 'back', icon: '←', description: 'Return to training dashboard' },
                    ],
                })
                setPhase('error')
                return
            }

            setPhase('ready')
        } catch (err) {
            console.error('Error generating session:', err)
            addMessage({
                type: 'clarence',
                content: `I ran into an issue setting up the scenario: ${err instanceof Error ? err.message : 'Unknown error'}. Would you like to try again?`,
                options: [
                    { label: 'Try Again', value: 'retry', icon: '🔄', description: 'Regenerate the scenario' },
                    { label: 'Back to Dashboard', value: 'back', icon: '←', description: 'Return to training dashboard' },
                ],
            })
            setPhase('error')
        } finally {
            setIsLoading(false)
        }
    }, [userInfo, selectedPlaybookId, templates, addMessage])

    // ========================================================================
    // SECTION 10: ACTION BUTTON HANDLER (Start Session)
    // ========================================================================

    const handleActionClick = useCallback(async (actionId: string) => {
        if (actionId === 'start-session' && scenario && agentConfig && userInfo && selectedTemplateId) {
            setPhase('launching')
            setIsLoading(true)

            addMessage({
                type: 'system',
                content: 'Creating your training session...',
            })

            try {
                // Create session via n8n webhook WITH template so clauses are populated
                const sessionResponse = await fetch(`${API_BASE}/session-create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userInfo.userId,
                        userEmail: userInfo.email,
                        userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
                        companyName: userInfo.company,
                        companyId: userInfo.companyId,
                        contractType: scenario.contractType,
                        contract_type: scenario.contractType,
                        contractName: `Training: ${agentConfig.persona.company} — ${scenario.contractContext}`,
                        contract_name: `Training: ${agentConfig.persona.company} — ${scenario.contractContext}`,
                        dealValue: scenario.dealValue,
                        dealCurrency: scenario.dealCurrency || 'GBP',
                        dealDuration: scenario.dealDurationMonths,
                        isTraining: true,
                        // Role Matrix fields — ensures training sessions get proper party labels
                        contract_type_key: scenario.contractType,
                        initiator_party_role: selectedRole || 'protected',
                        // Template — this tells session-create to load clauses from the template
                        template_source: 'existing_template',
                        source_template_id: selectedTemplateId,
                        assessment_completed: true,
                        // AI counterpart info
                        deal_context: {
                            training_mode: selectedPath === 'colleague' ? 'colleague' : 'dynamic',
                            training_role: selectedRole || 'protected',
                            ai_character_name: agentConfig.persona.name,
                            ai_company_name: agentConfig.persona.company,
                            ai_personality: agentConfig.personalityTraits.style,
                        },
                        aiCompanyName: agentConfig.persona.company,
                        aiPersonality: agentConfig.personalityTraits.style,
                        characterName: agentConfig.persona.name,
                        notes: `Dynamic Training | AI: ${agentConfig.personalityTraits.style} | Opponent: ${agentConfig.persona.name} | Company: ${agentConfig.persona.company}`,
                    }),
                })

                const sessionResult = await sessionResponse.json()

                if (!sessionResult.sessionId) {
                    throw new Error('No session ID returned')
                }

                // Link agent + diverge positions + write leverage (server-side with service role + retry)
                await fetch('/api/agents/training-orchestrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'link',
                        userId: userInfo.userId,
                        agentId: agentConfig.agentId || null,
                        sessionId: sessionResult.sessionId,
                        leverageResult: agentConfig.leverageResult || null,
                        difficulty: selectedDifficulty || 'intermediate',
                    }),
                })

                // Position divergence + weights now handled server-side in the link action
                // (with retry to wait for n8n to finish populating clause positions)

                // Navigate to contract studio
                router.push(`/auth/contract-studio?session_id=${sessionResult.sessionId}`)
            } catch (err) {
                console.error('Error creating session:', err)
                setPhase('ready')
                setIsLoading(false)
                addMessage({
                    type: 'clarence',
                    content: `There was an issue creating the session: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
                    actionButton: { label: 'Try Again', actionId: 'start-session' },
                })
            }
        }

        // Colleague session — navigate to studio
        if (actionId === 'start-colleague-session' && scenario?.sessionId) {
            router.push(`/auth/contract-studio?session_id=${scenario.sessionId}`)
            return
        }

        // Error recovery
        if (actionId === 'retry') {
            setPhase('generating')
            setMessages([])
            setSelectedPath(null)
            setSelectedRole(null)
            setSelectedPlaybookId(null)
            setSelectedContractType(null)
            setSelectedDifficulty(null)
            setColleagueEmail('')
            setColleagueName('')
            setColleagueCompany('')
            setShowColleagueInput(false)
            setInviteLink(null)

            if (userInfo) {
                await startConversation(userInfo, companyPlaybooks)
            }
        }

        if (actionId === 'back') {
            router.push('/auth/training')
        }
    }, [scenario, agentConfig, userInfo, selectedTemplateId, selectedRole, selectedPath, selectedDifficulty, supabase, router, startConversation, companyPlaybooks, addMessage])

    // ========================================================================
    // SECTION 10B: COLLEAGUE SESSION CREATION
    // ========================================================================

    const handleColleagueSubmit = useCallback(async () => {
        if (!colleagueEmail.trim() || !userInfo || !selectedTemplateId) return
        setIsLoading(true)
        setShowColleagueInput(false)
        setPhase('launching')

        addMessage({ type: 'user', content: `Invite ${colleagueName || colleagueEmail} (${colleagueEmail})` })
        addMessage({ type: 'system', content: 'Creating session and sending invitation...' })

        try {
            const userIsProvider = selectedRole === 'providing'
            const contractType = selectedContractType || 'service_agreement'

            // Create session via n8n webhook
            const sessionResponse = await fetch(`${API_BASE}/session-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userInfo.userId,
                    userEmail: userInfo.email,
                    userName: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
                    companyName: userInfo.company,
                    companyId: userInfo.companyId,
                    contractType,
                    contract_type: contractType,
                    contractName: `Training: ${userInfo.company} vs ${colleagueCompany || 'Colleague'}`,
                    contract_name: `Training: ${userInfo.company} vs ${colleagueCompany || 'Colleague'}`,
                    dealValue: 100000,
                    dealCurrency: 'GBP',
                    isTraining: true,
                    contract_type_key: contractType,
                    initiator_party_role: selectedRole || 'protected',
                    template_source: 'existing_template',
                    source_template_id: selectedTemplateId,
                    assessment_completed: true,
                    deal_context: {
                        training_mode: 'colleague',
                        training_role: selectedRole || 'protected',
                        colleague_email: colleagueEmail,
                        colleague_name: colleagueName || null,
                        colleague_company: colleagueCompany || null,
                    },
                    notes: `Colleague Training | ${userIsProvider ? 'Provider' : 'Customer'} vs ${colleagueName || colleagueEmail}`,
                }),
            })

            const sessionResult = await sessionResponse.json()
            if (!sessionResult.sessionId) throw new Error('No session ID returned')

            // Run position divergence (no AI agent)
            await fetch('/api/agents/training-orchestrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'link',
                    userId: userInfo.userId,
                    agentId: null,
                    sessionId: sessionResult.sessionId,
                    leverageResult: null,
                    difficulty: 'balanced',
                }),
            })

            // Send invitation via n8n invite-provider webhook
            await fetch(`${API_BASE}/invite-provider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionResult.sessionId,
                    session_number: sessionResult.sessionNumber || sessionResult.sessionId.substring(0, 8),
                    customer_company: userIsProvider ? (colleagueCompany || 'Colleague') : userInfo.company,
                    contract_type: contractType,
                    deal_value: 100000,
                    invited_by_user_id: userInfo.userId,
                    provider: {
                        company_name: userIsProvider ? userInfo.company : (colleagueCompany || 'Colleague'),
                        contact_name: colleagueName || colleagueEmail,
                        contact_email: colleagueEmail,
                    },
                }),
            })

            // Generate shareable link
            const baseUrl = window.location.origin
            const shareLink = `${baseUrl}/provider?session_id=${sessionResult.sessionId}`
            setInviteLink(shareLink)

            setScenario({ sessionId: sessionResult.sessionId, contractType })

            addMessage({
                type: 'clarence',
                content: `Invitation sent to **${colleagueName || colleagueEmail}**! They'll receive an email with a link to join.\n\nYou can also share the link below directly.`,
            })
            addMessage({
                type: 'clarence',
                content: 'Ready to enter the contract studio? Your colleague can join at any time.',
                actionButton: { label: 'Enter Contract Studio', actionId: 'start-colleague-session' },
            })
        } catch (err) {
            console.error('Error creating colleague session:', err)
            setPhase('ready')
            setShowColleagueInput(true)
            addMessage({
                type: 'clarence',
                content: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
            })
        } finally {
            setIsLoading(false)
        }
    }, [colleagueEmail, colleagueName, colleagueCompany, userInfo, selectedTemplateId, selectedRole, selectedContractType, addMessage])

    // ========================================================================
    // SECTION 11: CHAT INPUT (free-form messages to Clarence)
    // ========================================================================

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isLoading) return

        const message = chatInput.trim()
        setChatInput('')

        addMessage({ type: 'user', content: message })

        // For now, route free-form messages through the n8n clarence-chat
        try {
            setIsLoading(true)
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    context: 'training-setup',
                    viewerUserId: userInfo?.userId,
                    dashboardData: {
                        userInfo,
                        totalContracts: 0,
                    },
                }),
            })

            const data = await response.json()
            addMessage({
                type: 'clarence',
                content: data.response || data.message || 'I\'m not sure how to help with that. Please use the options above to set up your training session.',
            })
        } catch {
            addMessage({
                type: 'clarence',
                content: 'I\'m having trouble connecting right now. Please use the option buttons to continue setting up your session.',
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    // ========================================================================
    // SECTION 12: SIGN OUT
    // ========================================================================

    async function handleSignOut() {
        try {
            await supabase.auth.signOut()
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        } catch {
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        }
    }

    // ========================================================================
    // SECTION 13: RENDER - CLARENCE AVATAR
    // ========================================================================

    function ClarenceAvatar() {
        return (
            <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">C</span>
            </div>
        )
    }

    // ========================================================================
    // SECTION 14: RENDER - OPTION BUTTONS
    // ========================================================================

    function OptionButtons({ options, disabled }: { options: OptionButton[]; disabled: boolean }) {
        return (
            <div className="flex flex-wrap gap-2 mt-3">
                {options.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => !disabled && handleOptionClick(opt.value, opt.label)}
                        disabled={disabled}
                        className="group flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-base">{opt.icon}</span>
                        <div className="text-left">
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-slate-400 group-hover:text-amber-600 font-normal">{opt.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        )
    }

    // ========================================================================
    // SECTION 15: RENDER - SCENARIO BRIEF CARD
    // ========================================================================

    function ScenarioBriefCard({ brief }: { brief: ScenarioBrief }) {
        const currencySymbol = brief.dealCurrency === 'GBP' ? '£' : brief.dealCurrency === 'USD' ? '$' : '€'
        return (
            <div className="mt-3 bg-white border-2 border-amber-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <span className="text-white text-lg">🎯</span>
                        </div>
                        <div>
                            <h4 className="text-white font-bold">{brief.counterpartyName}</h4>
                            <p className="text-amber-100 text-sm">{brief.counterpartyTitle} at {brief.counterpartyCompany}</p>
                        </div>
                        <div className="ml-auto">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                brief.agentStyle === 'cooperative' ? 'bg-emerald-100 text-emerald-700' :
                                brief.agentStyle === 'aggressive' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {brief.agentStyle}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-slate-400 text-xs mb-1">Contract</div>
                            <div className="font-medium text-slate-800">{brief.contractContext}</div>
                        </div>
                        <div>
                            <div className="text-slate-400 text-xs mb-1">Deal Value</div>
                            <div className="font-medium text-slate-800">{currencySymbol}{brief.dealValue.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Leverage Bar */}
                    <div>
                        <div className="text-slate-400 text-xs mb-2">Leverage Balance</div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-blue-600 w-14 text-right">You {brief.leverageCustomer}%</span>
                            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                                    style={{ width: `${brief.leverageCustomer}%` }}
                                />
                            </div>
                            <span className="text-xs font-medium text-red-600 w-14">They {brief.leverageProvider}%</span>
                        </div>
                    </div>

                    {/* Key Dynamics */}
                    {brief.keyDynamics.length > 0 && (
                        <div>
                            <div className="text-slate-400 text-xs mb-2">Key Dynamics</div>
                            <div className="flex flex-wrap gap-1.5">
                                {brief.keyDynamics.slice(0, 4).map((d, i) => (
                                    <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                                        {d}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 15B: RENDER - COLLEAGUE INPUT FORM
    // ========================================================================

    function ColleagueInputForm() {
        return (
            <div className="flex gap-3 mb-4">
                <ClarenceAvatar />
                <div className="max-w-[85%] w-full">
                    <div className="bg-white border-2 border-amber-200 rounded-xl p-5 space-y-4">
                        <h4 className="font-semibold text-slate-800 text-sm">Colleague Details</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Email Address *</label>
                                <input
                                    type="email"
                                    value={colleagueEmail}
                                    onChange={e => setColleagueEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Contact Name</label>
                                <input
                                    type="text"
                                    value={colleagueName}
                                    onChange={e => setColleagueName(e.target.value)}
                                    placeholder="Jane Smith"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Company Name</label>
                                <input
                                    type="text"
                                    value={colleagueCompany}
                                    onChange={e => setColleagueCompany(e.target.value)}
                                    placeholder="Acme Corp"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleColleagueSubmit}
                            disabled={!colleagueEmail.trim() || isLoading}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                        >
                            Send Invitation & Start Session
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 15C: RENDER - COPY LINK CARD
    // ========================================================================

    function CopyLinkCard({ link }: { link: string }) {
        const [copied, setCopied] = useState(false)
        const handleCopy = () => {
            navigator.clipboard.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
        return (
            <div className="flex gap-3 mb-4">
                <ClarenceAvatar />
                <div className="max-w-[85%]">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-2">Share this link with your colleague:</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-slate-50 px-3 py-2 rounded-lg text-slate-600 truncate">{link}</code>
                            <button
                                onClick={handleCopy}
                                className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium rounded-lg transition flex-shrink-0"
                            >
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 16: RENDER - ACTION BUTTON
    // ========================================================================

    function ActionButton({ label, actionId, disabled }: { label: string; actionId: string; disabled: boolean }) {
        return (
            <button
                onClick={() => !disabled && handleActionClick(actionId)}
                disabled={disabled}
                className="mt-3 w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base shadow-lg shadow-amber-200/50"
            >
                {disabled ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {phase === 'launching' ? 'Creating session...' : 'Please wait...'}
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {label}
                    </>
                )}
            </button>
        )
    }

    // ========================================================================
    // SECTION 17: RENDER - CHAT MESSAGE
    // ========================================================================

    function MessageBubble({ msg }: { msg: ChatMessage }) {
        const isUser = msg.type === 'user'
        const isSystem = msg.type === 'system'

        if (isSystem) {
            return (
                <div className="flex justify-center my-3">
                    <div className="px-4 py-2 bg-slate-100 rounded-full text-xs text-slate-500 flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                        {msg.content}
                    </div>
                </div>
            )
        }

        if (isUser) {
            return (
                <div className="flex justify-end mb-4">
                    <div className="max-w-[80%] bg-amber-500 text-white px-4 py-3 rounded-2xl rounded-br-md text-sm">
                        {msg.content}
                    </div>
                </div>
            )
        }

        // Clarence message
        const optionsDisabled = isLoading || phase === 'generating' || phase === 'launching'
        const lastMessageWithOptions = [...messages].reverse().find(m => m.options && m.options.length > 0)
        const isLatestOptions = lastMessageWithOptions?.id === msg.id

        return (
            <div className="flex gap-3 mb-4">
                <ClarenceAvatar />
                <div className="max-w-[85%] space-y-0">
                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-md text-sm text-slate-700 whitespace-pre-line">
                        {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={i}>{part.slice(2, -2)}</strong>
                            }
                            return part
                        })}
                    </div>
                    {msg.scenarioBrief && <ScenarioBriefCard brief={msg.scenarioBrief} />}
                    {msg.options && isLatestOptions && (
                        <OptionButtons options={msg.options} disabled={optionsDisabled} />
                    )}
                    {msg.actionButton && (
                        <ActionButton
                            label={msg.actionButton.label}
                            actionId={msg.actionButton.actionId}
                            disabled={isLoading || phase === 'launching'}
                        />
                    )}
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 18: RENDER - MAIN
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <AuthenticatedHeader
                activePage="training"
                userInfo={userInfo}
                onSignOut={handleSignOut}
            />

            <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/auth/training')}
                            className="p-2 hover:bg-slate-200 rounded-lg transition text-slate-500"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">New Training Session</h1>
                            <p className="text-xs text-slate-400">Clarence will design your scenario</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-xs text-slate-400">Clarence is online</span>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 bg-slate-100/50 rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-1">
                        {phase === 'loading' && messages.length === 0 && (
                            <div className="flex items-center gap-3 text-slate-400 text-sm">
                                <ClarenceAvatar />
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span>Clarence is getting ready...</span>
                                </div>
                            </div>
                        )}

                        {messages.map(msg => (
                            <MessageBubble key={msg.id} msg={msg} />
                        ))}

                        {showColleagueInput && !isLoading && <ColleagueInputForm />}
                        {inviteLink && <CopyLinkCard link={inviteLink} />}

                        {isLoading && phase === 'generating' && messages.length > 0 && (
                            <div className="flex gap-3 mb-4">
                                <ClarenceAvatar />
                                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-md">
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span>Designing your scenario...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={phase === 'ready' ? 'Ask Clarence about the scenario...' : 'Type a message to Clarence...'}
                                disabled={isLoading || phase === 'launching'}
                                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 disabled:opacity-50"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim() || isLoading || phase === 'launching'}
                                className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 19: SUSPENSE WRAPPER
// ============================================================================

export default function TrainingStudioWrapper() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">Loading Training Studio...</p>
                </div>
            </div>
        }>
            <TrainingStudioPage />
        </Suspense>
    )
}
