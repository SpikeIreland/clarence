'use client'

// ============================================================================
// CLARENCE Co-Create Studio
// ============================================================================
// File: /app/auth/co-create-studio/page.tsx
// Purpose: Collaborative contract creation — both parties build a contract
//          from scratch with Clarence facilitating clause generation and
//          position-setting.
// Stage: CREATE (Emerald)
// Journey: create-contract → invite-providers → strategic-assessment → HERE → contract-studio
//
// Three-panel layout:
//   LEFT:   Clause list (builds up as clauses are accepted)
//   CENTRE: Chat/discussion (scope conversation, clause proposals, position discussion)
//   RIGHT:  Clause detail (range mappings, position options when a clause is selected)
// ============================================================================

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CreateProgressBar } from '@/app/components/create-phase/CreateProgressHeader'
import { TransitionModal } from '@/app/components/create-phase/TransitionModal'
import type { TransitionConfig } from '@/lib/pathway-utils'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

type CoCreateStep = 'scope' | 'clause_generation' | 'clause_discussion' | 'draft_review'

type ClauseStatus = 'proposed' | 'accepted' | 'rejected' | 'discussing' | 'position_set'

type MessageSender = 'clarence' | 'customer' | 'provider'

type MessageType = 'discussion' | 'proposal' | 'position_change' | 'system' | 'clause_proposal'

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    role: string
    userId: string
    companyId?: string
}

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    providerCompany: string | null
    customerContactName: string | null
    providerContactName: string | null
    contractType: string
    dealValue: string
    mediationType: string
    status: string
    isTraining: boolean
}

interface CoCreateClause {
    clauseId: string
    clauseName: string
    category: string
    description: string
    legalContext: string | null
    status: ClauseStatus
    proposedBy: 'clarence' | 'customer' | 'provider'
    customerPosition: number | null
    providerPosition: number | null
    customerWeight: number
    providerWeight: number
    clarenceRecommendation: number | null
    positionOptions: PositionOption[] | null
    displayOrder: number
}

interface PositionOption {
    value: number
    label: string
    description: string
}

interface CoCreateMessage {
    id: string
    sender: MessageSender
    senderName: string
    content: string
    timestamp: Date
    messageType: MessageType
    relatedClauseId?: string
    clauseProposals?: MasterClause[]
}

interface MasterClause {
    clauseId: string
    clauseName: string
    category: string
    description: string
    legalContext: string | null
    defaultCustomerPosition: number
    defaultProviderPosition: number
    isRequired: boolean
    applicableContractTypes: string[]
}

interface ScopeData {
    serviceDescription: string
    partiesContext: string
    duration: string
    priorities: string
    concerns: string
}

interface TransitionState {
    isOpen: boolean
    transition: TransitionConfig | null
    redirectUrl: string | null
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    'nda': 'Non-Disclosure Agreement',
    'saas': 'SaaS Agreement',
    'bpo': 'BPO Agreement',
    'msa': 'Master Services Agreement',
    'employment': 'Employment Contract',
    'custom': 'Custom Contract',
    'service_agreement': 'Service Agreement',
    'it_outsourcing': 'IT Outsourcing',
    'managed_services': 'Managed Services',
    'consultancy': 'Consultancy Agreement'
}

const SCOPE_QUESTIONS = [
    { key: 'serviceDescription', question: "Let's start by understanding the agreement. What service or product does this contract cover? Give me a brief description of what's being provided." },
    { key: 'partiesContext', question: "Tell me about the two parties — what does each organisation do, and what's the nature of this relationship?" },
    { key: 'duration', question: "What's the expected duration of this agreement? Is it a fixed term, ongoing, or project-based?" },
    { key: 'priorities', question: "What are the most important things you want this contract to cover? Think about what matters most to your side." },
    { key: 'concerns', question: "Are there any specific risks, concerns, or areas where you expect the parties might disagree?" }
]

const STEP_CONFIG: Record<CoCreateStep, { label: string; description: string; number: number }> = {
    scope: { label: 'Scope', description: 'Define the agreement', number: 1 },
    clause_generation: { label: 'Clauses', description: 'Build the clause set', number: 2 },
    clause_discussion: { label: 'Positions', description: 'Set initial positions', number: 3 },
    draft_review: { label: 'Review', description: 'Review & transition', number: 4 }
}

// ============================================================================
// SECTION 3: MAIN COMPONENT (Suspense wrapper)
// ============================================================================

export default function CoCreateStudioPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <CoCreateStudioContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 4: LOADING FALLBACK
// ============================================================================

function LoadingFallback() {
    return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Co-Create Studio...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: INNER CONTENT COMPONENT
// ============================================================================

function CoCreateStudioContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const sessionId = searchParams.get('session_id')
    const pathwayId = searchParams.get('pathway_id') || 'CO'

    // ========================================================================
    // SECTION 5A: STATE
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [session, setSession] = useState<SessionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Co-Create step state machine
    const [currentStep, setCurrentStep] = useState<CoCreateStep>('scope')

    // Scope conversation
    const [scopeData, setScopeData] = useState<ScopeData>({
        serviceDescription: '',
        partiesContext: '',
        duration: '',
        priorities: '',
        concerns: ''
    })
    const [scopeQuestionIndex, setScopeQuestionIndex] = useState(0)

    // Messages (centre panel chat)
    const [messages, setMessages] = useState<CoCreateMessage[]>([])
    const [inputMessage, setInputMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Clauses
    const [clauses, setClauses] = useState<CoCreateClause[]>([])
    const [masterClauses, setMasterClauses] = useState<MasterClause[]>([])
    const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null)

    // Transition
    const [transitionState, setTransitionState] = useState<TransitionState>({
        isOpen: false,
        transition: null,
        redirectUrl: null
    })

    // ========================================================================
    // SECTION 5B: DERIVED STATE
    // ========================================================================

    const acceptedClauses = useMemo(() => clauses.filter(c => c.status === 'accepted' || c.status === 'position_set'), [clauses])
    const proposedClauses = useMemo(() => clauses.filter(c => c.status === 'proposed'), [clauses])
    const selectedClause = useMemo(() => clauses.find(c => c.clauseId === selectedClauseId) || null, [clauses, selectedClauseId])

    const isCustomer = useMemo(() => {
        if (!userInfo || !session) return true
        return userInfo.company === session.customerCompany
    }, [userInfo, session])

    const alignmentPercentage = useMemo(() => {
        const withPositions = clauses.filter(c => c.customerPosition !== null && c.providerPosition !== null)
        if (withPositions.length === 0) return 0
        const totalAlignment = withPositions.reduce((sum, c) => {
            const gap = Math.abs((c.customerPosition || 5) - (c.providerPosition || 5))
            return sum + Math.max(0, 100 - (gap / 9) * 100)
        }, 0)
        return Math.round(totalAlignment / withPositions.length)
    }, [clauses])

    // ========================================================================
    // SECTION 5C: AUTH VALIDATION & SESSION LOADING
    // ========================================================================

    const loadUserInfo = useCallback((): UserInfo | null => {
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) {
            router.push('/auth/login')
            return null
        }
        try {
            const parsed = JSON.parse(authData)
            return {
                firstName: parsed.userInfo?.firstName || 'User',
                lastName: parsed.userInfo?.lastName || '',
                email: parsed.userInfo?.email || '',
                company: parsed.userInfo?.company || '',
                role: parsed.userInfo?.role || 'customer',
                userId: parsed.userInfo?.userId || '',
                companyId: parsed.userInfo?.companyId || undefined
            }
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    const loadSessionData = useCallback(async (sid: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-session?session_id=${sid}`)
            if (!response.ok) throw new Error('Failed to load session')
            const data = await response.json()

            const mapped: SessionData = {
                sessionId: sid,
                sessionNumber: data.session_number || data.sessionNumber || '',
                customerCompany: data.customer_company || data.customerCompany || '',
                providerCompany: data.provider_company || data.providerCompany || null,
                customerContactName: data.customer_contact_name || data.customerContactName || null,
                providerContactName: data.provider_contact_name || data.providerContactName || null,
                contractType: data.contract_type || data.contractType || '',
                dealValue: data.deal_value || data.dealValue || '',
                mediationType: data.mediation_type || data.mediationType || 'co_create',
                status: data.status || 'initiated',
                isTraining: data.is_training || data.isTraining || false
            }

            setSession(mapped)
            return mapped
        } catch (err) {
            console.error('Error loading session:', err)
            setError('Failed to load session data. Please try again.')
            return null
        }
    }, [])

    const loadMasterClauses = useCallback(async (contractType: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-master-clauses`)
            if (!response.ok) throw new Error('Failed to load clause library')
            const data = await response.json()
            const clausesArray = data.clauses || data

            if (Array.isArray(clausesArray)) {
                const mapped: MasterClause[] = clausesArray.map((c: Record<string, unknown>) => ({
                    clauseId: (c.clause_id || c.clauseId || '') as string,
                    clauseName: (c.clause_name || c.clauseName || '') as string,
                    category: (c.category || c.clause_category || 'Other') as string,
                    description: (c.description || '') as string,
                    legalContext: (c.legal_context || c.legalContext || null) as string | null,
                    defaultCustomerPosition: (c.default_customer_position || c.defaultCustomerPosition || 5) as number,
                    defaultProviderPosition: (c.default_provider_position || c.defaultProviderPosition || 5) as number,
                    isRequired: (c.is_required || c.isRequired || false) as boolean,
                    applicableContractTypes: (c.applicable_contract_types || c.applicableContractTypes || []) as string[]
                }))

                // Filter by contract type if applicable
                const filtered = mapped.filter(c =>
                    c.applicableContractTypes.length === 0 ||
                    c.applicableContractTypes.includes(contractType)
                )
                setMasterClauses(filtered)
                return filtered
            }
            return []
        } catch (err) {
            console.error('Error loading master clauses:', err)
            return []
        }
    }, [])

    // ========================================================================
    // SECTION 5D: INITIALISATION
    // ========================================================================

    useEffect(() => {
        const init = async () => {
            if (!sessionId) {
                setError('No session ID provided.')
                setLoading(false)
                return
            }

            const user = loadUserInfo()
            if (!user) return
            setUserInfo(user)

            const sessionData = await loadSessionData(sessionId)
            if (!sessionData) {
                setLoading(false)
                return
            }

            // Load master clause library
            await loadMasterClauses(sessionData.contractType)

            // Log studio loaded event
            eventLogger.setSession(sessionId)
            eventLogger.setUser(user.userId)
            await eventLogger.completed('co_create_studio', 'studio_loaded', {
                session_id: sessionId,
                contract_type: sessionData.contractType,
                parties_present: !!sessionData.providerCompany
            })

            // Add Clarence welcome message
            const contractLabel = CONTRACT_TYPE_LABELS[sessionData.contractType] || sessionData.contractType
            addMessage({
                sender: 'clarence',
                senderName: 'CLARENCE',
                content: `Welcome to the Co-Create Studio! I'm here to help both parties build a **${contractLabel}** from scratch.\n\nWe'll work through this together in four steps:\n1. **Scope** — Define what the agreement covers\n2. **Clauses** — I'll propose a clause set based on the contract type\n3. **Positions** — Both parties set initial positions on each clause\n4. **Review** — Review the draft and transition to the Contract Studio\n\nLet's begin with the scope.`,
                messageType: 'system'
            })

            // Start first scope question
            setTimeout(() => {
                addMessage({
                    sender: 'clarence',
                    senderName: 'CLARENCE',
                    content: SCOPE_QUESTIONS[0].question,
                    messageType: 'discussion'
                })
            }, 1000)

            setLoading(false)
        }

        init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId])

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ========================================================================
    // SECTION 6: MESSAGE HANDLERS
    // ========================================================================

    const addMessage = useCallback((msg: Omit<CoCreateMessage, 'id' | 'timestamp'>) => {
        const newMessage: CoCreateMessage = {
            ...msg,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date()
        }
        setMessages(prev => [...prev, newMessage])
    }, [])

    const handleSendMessage = useCallback(async () => {
        if (!inputMessage.trim() || !sessionId || isSending) return

        setIsSending(true)
        const messageText = inputMessage.trim()
        setInputMessage('')

        // Add user message
        addMessage({
            sender: isCustomer ? 'customer' : 'provider',
            senderName: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'User',
            content: messageText,
            messageType: 'discussion'
        })

        // Handle scope conversation
        if (currentStep === 'scope') {
            const currentQuestion = SCOPE_QUESTIONS[scopeQuestionIndex]
            if (currentQuestion) {
                // Store the answer
                setScopeData(prev => ({
                    ...prev,
                    [currentQuestion.key]: messageText
                }))

                const nextIndex = scopeQuestionIndex + 1
                if (nextIndex < SCOPE_QUESTIONS.length) {
                    // Move to next question
                    setScopeQuestionIndex(nextIndex)
                    setTimeout(() => {
                        addMessage({
                            sender: 'clarence',
                            senderName: 'CLARENCE',
                            content: SCOPE_QUESTIONS[nextIndex].question,
                            messageType: 'discussion'
                        })
                    }, 800)
                } else {
                    // Scope complete — transition to clause generation
                    await handleScopeComplete(messageText)
                }
            }
        } else if (currentStep === 'clause_generation' || currentStep === 'clause_discussion') {
            // Send to Clarence for AI response
            await sendToClarence(messageText)
        }

        setIsSending(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputMessage, sessionId, isSending, currentStep, scopeQuestionIndex, isCustomer, userInfo])

    const handleScopeComplete = useCallback(async (lastAnswer: string) => {
        // Update scope data with last answer
        const finalScopeData = {
            ...scopeData,
            [SCOPE_QUESTIONS[SCOPE_QUESTIONS.length - 1].key]: lastAnswer
        }

        // Log scope completion
        await eventLogger.completed('co_create_studio', 'scope_conversation_completed', {
            session_id: sessionId,
            topics_discussed: SCOPE_QUESTIONS.map(q => q.key)
        })

        // Clarence acknowledges and transitions to clause generation
        setTimeout(() => {
            addMessage({
                sender: 'clarence',
                senderName: 'CLARENCE',
                content: "Thank you — I now have a clear picture of what this agreement needs to cover. Let me propose a set of clauses based on the contract type and what you've told me.\n\nI'll recommend clauses that are standard for this type of agreement, and both parties can **accept**, **remove**, or **discuss** each one.",
                messageType: 'system'
            })
        }, 800)

        // Generate clause proposals
        setTimeout(() => {
            setCurrentStep('clause_generation')
            generateClauseProposals(finalScopeData)
        }, 2000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeData, sessionId])

    const generateClauseProposals = useCallback(async (scope: ScopeData) => {
        if (masterClauses.length === 0) {
            addMessage({
                sender: 'clarence',
                senderName: 'CLARENCE',
                content: "I wasn't able to load the clause library for this contract type. Please try refreshing the page.",
                messageType: 'system'
            })
            return
        }

        // Group master clauses by category
        const categories = [...new Set(masterClauses.map(c => c.category))]

        // Create clause proposals from master library
        const proposed: CoCreateClause[] = masterClauses.map((mc, idx) => ({
            clauseId: mc.clauseId,
            clauseName: mc.clauseName,
            category: mc.category,
            description: mc.description,
            legalContext: mc.legalContext,
            status: 'proposed' as ClauseStatus,
            proposedBy: 'clarence',
            customerPosition: null,
            providerPosition: null,
            customerWeight: 3,
            providerWeight: 3,
            clarenceRecommendation: Math.round((mc.defaultCustomerPosition + mc.defaultProviderPosition) / 2),
            positionOptions: null,
            displayOrder: idx + 1
        }))

        setClauses(proposed)

        // Log clause proposals
        for (const clause of proposed) {
            await eventLogger.completed('co_create_studio', 'clause_proposed', {
                clause_id: clause.clauseId,
                clause_name: clause.clauseName,
                proposed_by: 'clarence'
            })
        }

        // Clarence presents the proposals
        addMessage({
            sender: 'clarence',
            senderName: 'CLARENCE',
            content: `Based on the contract type and your scope discussion, I'm proposing **${proposed.length} clauses** across **${categories.length} categories**: ${categories.join(', ')}.\n\nYou can see them in the panel on the left. For each clause, you can:\n- **Accept** — include it in the contract\n- **Remove** — exclude it from the contract\n- **Discuss** — ask me about it before deciding\n\nReview the proposals and let me know when you're ready to move on to setting positions.`,
            messageType: 'clause_proposal',
            clauseProposals: masterClauses
        })
    }, [masterClauses, addMessage])

    const sendToClarence = useCallback(async (message: string) => {
        // Show thinking indicator
        const thinkingId = `thinking-${Date.now()}`
        addMessage({
            sender: 'clarence',
            senderName: 'CLARENCE',
            content: '...',
            messageType: 'discussion'
        })

        try {
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    sessionId,
                    context: 'co_create_studio',
                    viewerRole: isCustomer ? 'initiator' : 'respondent',
                    contractTypeKey: session?.contractType,
                    negotiationContext: {
                        coCreateStep: currentStep,
                        scopeData,
                        acceptedClauses: acceptedClauses.map(c => c.clauseName),
                        proposedClauses: proposedClauses.map(c => c.clauseName),
                        selectedClause: selectedClause?.clauseName
                    }
                })
            })

            // Remove thinking message
            setMessages(prev => prev.slice(0, -1))

            if (response.ok) {
                const data = await response.json()
                addMessage({
                    sender: 'clarence',
                    senderName: 'CLARENCE',
                    content: data.response || data.message || "I understand. Let me think about that.",
                    messageType: 'discussion'
                })
            } else {
                addMessage({
                    sender: 'clarence',
                    senderName: 'CLARENCE',
                    content: "I'm having trouble processing that right now. Please try again.",
                    messageType: 'discussion'
                })
            }
        } catch (err) {
            console.error('Error sending to Clarence:', err)
            setMessages(prev => prev.slice(0, -1))
            addMessage({
                sender: 'clarence',
                senderName: 'CLARENCE',
                content: "I encountered an error. Please try again.",
                messageType: 'discussion'
            })
        }
    }, [sessionId, isCustomer, session, currentStep, scopeData, acceptedClauses, proposedClauses, selectedClause, addMessage])

    // ========================================================================
    // SECTION 7: CLAUSE ACTIONS
    // ========================================================================

    const handleAcceptClause = useCallback(async (clauseId: string) => {
        setClauses(prev => prev.map(c =>
            c.clauseId === clauseId ? { ...c, status: 'accepted' as ClauseStatus } : c
        ))
        const clause = clauses.find(c => c.clauseId === clauseId)
        if (clause) {
            await eventLogger.completed('co_create_studio', 'clause_accepted', {
                clause_id: clauseId,
                clause_name: clause.clauseName,
                accepted_by_both: true
            })
        }
    }, [clauses])

    const handleRejectClause = useCallback(async (clauseId: string) => {
        setClauses(prev => prev.map(c =>
            c.clauseId === clauseId ? { ...c, status: 'rejected' as ClauseStatus } : c
        ))
        const clause = clauses.find(c => c.clauseId === clauseId)
        if (clause) {
            await eventLogger.completed('co_create_studio', 'clause_rejected', {
                clause_id: clauseId,
                clause_name: clause.clauseName,
                rejected_by: isCustomer ? 'customer' : 'provider'
            })
        }
    }, [clauses, isCustomer])

    const handleDiscussClause = useCallback((clauseId: string) => {
        setSelectedClauseId(clauseId)
        const clause = clauses.find(c => c.clauseId === clauseId)
        if (clause) {
            setClauses(prev => prev.map(c =>
                c.clauseId === clauseId ? { ...c, status: 'discussing' as ClauseStatus } : c
            ))
            addMessage({
                sender: 'clarence',
                senderName: 'CLARENCE',
                content: `Let's discuss **${clause.clauseName}**.\n\n${clause.description}${clause.legalContext ? `\n\n*Legal context:* ${clause.legalContext}` : ''}\n\nWhat would you like to know about this clause?`,
                messageType: 'discussion',
                relatedClauseId: clauseId
            })
        }
    }, [clauses, addMessage])

    const handleSetPosition = useCallback(async (clauseId: string, position: number) => {
        setClauses(prev => prev.map(c => {
            if (c.clauseId !== clauseId) return c
            if (isCustomer) {
                return { ...c, customerPosition: position }
            } else {
                return { ...c, providerPosition: position }
            }
        }))

        // Check if both parties have set positions
        const clause = clauses.find(c => c.clauseId === clauseId)
        if (clause) {
            const hasCustomer = isCustomer ? true : clause.customerPosition !== null
            const hasProvider = isCustomer ? clause.providerPosition !== null : true
            if (hasCustomer && hasProvider) {
                setClauses(prev => prev.map(c =>
                    c.clauseId === clauseId ? { ...c, status: 'position_set' as ClauseStatus } : c
                ))
                await eventLogger.completed('co_create_studio', 'positions_set', {
                    clause_id: clauseId,
                    customer_position: isCustomer ? position : clause.customerPosition,
                    provider_position: isCustomer ? clause.providerPosition : position
                })
            }
        }
    }, [clauses, isCustomer])

    const handleMoveToPositionSetting = useCallback(() => {
        if (acceptedClauses.length === 0) {
            addMessage({
                sender: 'clarence',
                senderName: 'CLARENCE',
                content: "You need to accept at least one clause before we can set positions. Review the proposed clauses in the left panel.",
                messageType: 'system'
            })
            return
        }

        setCurrentStep('clause_discussion')
        addMessage({
            sender: 'clarence',
            senderName: 'CLARENCE',
            content: `Excellent! You've accepted **${acceptedClauses.length} clauses**. Now let's set initial positions.\n\nSelect a clause from the left panel to see the position options. Both parties should set their preferred starting position for each clause. I'll provide guidance based on market norms.\n\nWhen you're done with all clauses, we'll review the draft.`,
            messageType: 'system'
        })
    }, [acceptedClauses.length, addMessage])

    const handleMoveToDraftReview = useCallback(() => {
        setCurrentStep('draft_review')
        addMessage({
            sender: 'clarence',
            senderName: 'CLARENCE',
            content: `Here's a summary of what we've built together:\n\n- **${acceptedClauses.length}** clauses in the contract\n- **${alignmentPercentage}%** initial alignment\n- **${acceptedClauses.filter(c => c.status === 'position_set').length}** clauses with positions set by both parties\n\nWhen you're ready, we'll transition to the Contract Studio for formal negotiation.`,
            messageType: 'system'
        })

        eventLogger.completed('co_create_studio', 'draft_review_completed', {
            session_id: sessionId,
            total_clauses: acceptedClauses.length,
            initial_alignment: alignmentPercentage
        })
    }, [acceptedClauses, alignmentPercentage, sessionId])

    // ========================================================================
    // SECTION 8: TRANSITION TO CONTRACT STUDIO
    // ========================================================================

    const handleTransitionToContractStudio = useCallback(async () => {
        if (!sessionId) return

        eventLogger.started('co_create_studio', 'transition_to_contract_studio')

        try {
            // Commit accepted clauses with positions to session_clause_positions
            const clausePayload = acceptedClauses.map((clause, idx) => ({
                clause_id: clause.clauseId,
                clause_name: clause.clauseName,
                category: clause.category,
                description: clause.description,
                customer_position: clause.customerPosition || clause.clarenceRecommendation || 5,
                provider_position: clause.providerPosition || clause.clarenceRecommendation || 5,
                customer_weight: clause.customerWeight,
                provider_weight: clause.providerWeight,
                clarence_recommendation: clause.clarenceRecommendation,
                display_order: idx + 1,
                source_type: 'master',
                source_master_clause_id: clause.clauseId,
                status: 'negotiating'
            }))

            const response = await fetch(`${API_BASE}/co-create-commit-positions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    user_id: userInfo?.userId,
                    clause_positions: clausePayload
                })
            })

            if (!response.ok) {
                throw new Error('Failed to commit clause positions')
            }

            await eventLogger.completed('co_create_studio', 'transition_to_contract_studio', {
                session_id: sessionId,
                clause_count: acceptedClauses.length,
                initial_alignment: alignmentPercentage
            })

            // Show transition modal
            const redirectUrl = `/auth/contract-studio?session_id=${sessionId}`
            const transition: TransitionConfig = {
                id: 'transition_to_invite' as TransitionConfig['id'],
                fromStage: 'strategic_assessment' as TransitionConfig['fromStage'],
                toStage: 'invite_providers' as TransitionConfig['toStage'],
                title: 'Co-Create Complete',
                message: `Both parties have built the contract structure together — ${acceptedClauses.length} clauses with ${alignmentPercentage}% initial alignment. The Contract Studio will now handle formal negotiation on each clause.`,
                bulletPoints: [
                    'Review and refine positions on each clause',
                    'Use CLARENCE for mediation and trade-off suggestions',
                    'Generate the final contract when aligned'
                ],
                buttonText: 'Enter Contract Studio'
            }

            setTransitionState({ isOpen: true, transition, redirectUrl })
        } catch (err) {
            console.error('Error transitioning:', err)
            await eventLogger.failed('co_create_studio', 'transition_to_contract_studio', (err as Error).message)
            setError('Failed to save clause positions. Please try again.')
        }
    }, [sessionId, acceptedClauses, alignmentPercentage, userInfo])

    const handleTransitionContinue = useCallback(() => {
        const { redirectUrl } = transitionState
        setTransitionState({ isOpen: false, transition: null, redirectUrl: null })
        if (redirectUrl) {
            router.push(redirectUrl)
        }
    }, [transitionState, router])

    // ========================================================================
    // SECTION 9: KEY HANDLER
    // ========================================================================

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }, [handleSendMessage])

    // ========================================================================
    // SECTION 10: RENDER — LOADING & ERROR STATES
    // ========================================================================

    if (loading) {
        return <LoadingFallback />
    }

    if (error) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 11: RENDER — MAIN LAYOUT
    // ========================================================================

    return (
        <div className="h-screen flex flex-col bg-slate-50">
            {/* ============================================================ */}
            {/* HEADER */}
            {/* ============================================================ */}
            <header className="bg-slate-800 flex-shrink-0">
                {/* Row 1: Navigation */}
                <div className="h-14 flex items-center justify-between px-6">
                    {/* Left: CLARENCE Co-Create branding */}
                    <div className="flex items-center gap-3">
                        <Link href="/auth/contracts-dashboard" className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white" title="Dashboard">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </Link>
                        <div className="h-6 w-px bg-slate-600"></div>
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-semibold tracking-wide">CLARENCE</span>
                                <span className="text-emerald-400 font-semibold">Co-Create</span>
                            </div>
                            <span className="text-slate-500 text-xs">The Honest Broker</span>
                        </div>
                    </div>

                    {/* Centre: Step indicator */}
                    <div className="flex items-center gap-1">
                        {(Object.keys(STEP_CONFIG) as CoCreateStep[]).map((step, idx) => {
                            const config = STEP_CONFIG[step]
                            const isCurrent = step === currentStep
                            const isPast = (Object.keys(STEP_CONFIG) as CoCreateStep[]).indexOf(currentStep) > idx
                            return (
                                <React.Fragment key={step}>
                                    {idx > 0 && (
                                        <div className={`w-8 h-px ${isPast ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                                    )}
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                                        isCurrent ? 'bg-emerald-500/20 text-emerald-400' :
                                        isPast ? 'text-emerald-500' : 'text-slate-500'
                                    }`}>
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                            isCurrent ? 'bg-emerald-500 text-white' :
                                            isPast ? 'bg-emerald-500/30 text-emerald-400' : 'bg-slate-700 text-slate-500'
                                        }`}>
                                            {isPast ? '✓' : config.number}
                                        </span>
                                        <span className="hidden lg:inline">{config.label}</span>
                                    </div>
                                </React.Fragment>
                            )
                        })}
                    </div>

                    {/* Right: Session info */}
                    <div className="flex items-center gap-4">
                        {session?.sessionNumber && (
                            <span className="text-sm text-slate-400 bg-slate-700 px-3 py-1 rounded-full font-mono">
                                {session.sessionNumber}
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 2: Party context */}
                {session && (
                    <div className="px-6 py-2 border-t border-slate-700">
                        <div className="flex items-center justify-between">
                            {/* Customer */}
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <div>
                                    <div className="text-xs text-slate-400">Customer</div>
                                    <div className="text-sm font-medium text-emerald-400">{session.customerCompany}</div>
                                </div>
                                {isCustomer && (
                                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">You</span>
                                )}
                            </div>

                            {/* Centre: Contract info */}
                            <div className="flex items-center gap-6">
                                <div className="text-center">
                                    <div className="text-xs text-slate-400">Contract Type</div>
                                    <div className="text-sm text-white">{CONTRACT_TYPE_LABELS[session.contractType] || session.contractType}</div>
                                </div>
                                {currentStep !== 'scope' && (
                                    <div className="text-center">
                                        <div className="text-xs text-slate-400">Clauses</div>
                                        <div className="text-sm text-white">{acceptedClauses.length} accepted</div>
                                    </div>
                                )}
                                {currentStep === 'clause_discussion' || currentStep === 'draft_review' ? (
                                    <div className="text-center">
                                        <div className="text-xs text-slate-400">Alignment</div>
                                        <div className={`text-sm font-semibold ${
                                            alignmentPercentage >= 70 ? 'text-emerald-400' :
                                            alignmentPercentage >= 40 ? 'text-amber-400' : 'text-red-400'
                                        }`}>{alignmentPercentage}%</div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Provider */}
                            <div className="flex items-center gap-3">
                                <div>
                                    <div className="text-xs text-slate-400 text-right">Provider</div>
                                    <div className="text-sm font-medium text-blue-400 text-right">{session.providerCompany || 'Awaiting provider'}</div>
                                </div>
                                {!isCustomer && (
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">You</span>
                                )}
                                <div className={`w-2.5 h-2.5 rounded-full ${session.providerCompany ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <CreateProgressBar currentStage="contract_prep" />

            {/* ============================================================ */}
            {/* THREE-PANEL LAYOUT */}
            {/* ============================================================ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ======================================================== */}
                {/* LEFT PANEL: Clause List */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
                    {/* Panel header */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        <h2 className="font-semibold text-slate-800 mb-2">Contract Clauses</h2>
                        {clauses.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                                    {acceptedClauses.length} accepted
                                </span>
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                    {proposedClauses.length} proposed
                                </span>
                                {clauses.filter(c => c.status === 'position_set').length > 0 && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                        {clauses.filter(c => c.status === 'position_set').length} positioned
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Clause list */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {clauses.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-sm">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                Complete the scope conversation to generate clause proposals.
                            </div>
                        ) : (
                            <>
                                {/* Group by category */}
                                {[...new Set(clauses.filter(c => c.status !== 'rejected').map(c => c.category))].map(category => (
                                    <div key={category} className="mb-3">
                                        <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {category}
                                        </div>
                                        {clauses
                                            .filter(c => c.category === category && c.status !== 'rejected')
                                            .map(clause => (
                                                <button
                                                    key={clause.clauseId}
                                                    onClick={() => setSelectedClauseId(clause.clauseId)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                                                        selectedClauseId === clause.clauseId
                                                            ? 'bg-emerald-50 border border-emerald-200'
                                                            : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-slate-700 truncate">
                                                            {clause.clauseName}
                                                        </span>
                                                        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${
                                                            clause.status === 'position_set' ? 'bg-blue-500' :
                                                            clause.status === 'accepted' ? 'bg-emerald-500' :
                                                            clause.status === 'discussing' ? 'bg-amber-500' :
                                                            'bg-slate-300'
                                                        }`} />
                                                    </div>
                                                    {clause.status === 'proposed' && currentStep === 'clause_generation' && (
                                                        <div className="flex gap-1 mt-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleAcceptClause(clause.clauseId) }}
                                                                className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRejectClause(clause.clauseId) }}
                                                                className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                                            >
                                                                Remove
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDiscussClause(clause.clauseId) }}
                                                                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                            >
                                                                Discuss
                                                            </button>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                ))}

                                {/* Action buttons at bottom of clause list */}
                                {currentStep === 'clause_generation' && acceptedClauses.length > 0 && (
                                    <div className="p-3 border-t border-slate-200 mt-2">
                                        <button
                                            onClick={handleMoveToPositionSetting}
                                            className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                                        >
                                            Set Positions ({acceptedClauses.length} clauses)
                                        </button>
                                    </div>
                                )}
                                {currentStep === 'clause_discussion' && (
                                    <div className="p-3 border-t border-slate-200 mt-2">
                                        <button
                                            onClick={handleMoveToDraftReview}
                                            className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                                        >
                                            Review Draft
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* CENTRE PANEL: Chat / Discussion */}
                {/* ======================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* Chat messages */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-2xl mx-auto space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.sender === 'clarence' ? '' : 'justify-end'}`}
                                >
                                    {msg.sender === 'clarence' && (
                                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                            <span className="text-white font-bold text-xs">C</span>
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] ${
                                        msg.sender === 'clarence'
                                            ? 'bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm'
                                            : msg.sender === 'customer'
                                            ? 'bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tr-sm'
                                            : 'bg-blue-50 border border-blue-200 rounded-2xl rounded-tr-sm'
                                    } px-4 py-3`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-semibold ${
                                                msg.sender === 'clarence' ? 'text-emerald-600' :
                                                msg.sender === 'customer' ? 'text-emerald-700' : 'text-blue-700'
                                            }`}>
                                                {msg.senderName}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                            {msg.content === '...' ? (
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                </div>
                                            ) : (
                                                msg.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={i}>{part.slice(2, -2)}</strong>
                                                    }
                                                    return <span key={i}>{part}</span>
                                                })
                                            )}
                                        </div>
                                    </div>
                                    {msg.sender !== 'clarence' && (
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                                            msg.sender === 'customer' ? 'bg-emerald-500' : 'bg-blue-500'
                                        }`}>
                                            {msg.senderName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    {/* Draft review panel (replaces chat when in draft_review step) */}
                    {currentStep === 'draft_review' && (
                        <div className="flex-shrink-0 p-6 border-t border-slate-200 bg-slate-50">
                            <div className="max-w-2xl mx-auto">
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white rounded-lg p-4 text-center border border-slate-200">
                                        <div className="text-3xl font-bold text-emerald-600">{acceptedClauses.length}</div>
                                        <div className="text-sm text-slate-500">Clauses</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 text-center border border-slate-200">
                                        <div className={`text-3xl font-bold ${
                                            alignmentPercentage >= 70 ? 'text-emerald-600' :
                                            alignmentPercentage >= 40 ? 'text-amber-600' : 'text-red-600'
                                        }`}>{alignmentPercentage}%</div>
                                        <div className="text-sm text-slate-500">Alignment</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-4 text-center border border-slate-200">
                                        <div className="text-3xl font-bold text-blue-600">
                                            {acceptedClauses.filter(c => c.customerPosition !== null && c.providerPosition !== null).length}
                                        </div>
                                        <div className="text-sm text-slate-500">Positioned</div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleTransitionToContractStudio}
                                    className="w-full py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200"
                                >
                                    Proceed to Contract Studio
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Chat input */}
                    {currentStep !== 'draft_review' && (
                        <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white">
                            <div className="max-w-2xl mx-auto flex gap-3">
                                <textarea
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        currentStep === 'scope' ? 'Type your answer...' :
                                        currentStep === 'clause_generation' ? 'Ask about a clause or type a message...' :
                                        'Discuss positions or ask CLARENCE for guidance...'
                                    }
                                    className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    rows={1}
                                    disabled={isSending}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputMessage.trim() || isSending}
                                    className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* RIGHT PANEL: Clause Detail / Position Setting */}
                {/* ======================================================== */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
                    {selectedClause ? (
                        <>
                            {/* Clause header */}
                            <div className="flex-shrink-0 p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        selectedClause.status === 'position_set' ? 'bg-blue-100 text-blue-700' :
                                        selectedClause.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                        selectedClause.status === 'discussing' ? 'bg-amber-100 text-amber-700' :
                                        selectedClause.status === 'proposed' ? 'bg-slate-100 text-slate-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {selectedClause.status === 'position_set' ? 'Positions Set' :
                                         selectedClause.status === 'accepted' ? 'Accepted' :
                                         selectedClause.status === 'discussing' ? 'Discussing' :
                                         selectedClause.status === 'proposed' ? 'Proposed' : 'Rejected'}
                                    </span>
                                    <button
                                        onClick={() => setSelectedClauseId(null)}
                                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">{selectedClause.clauseName}</h3>
                                <p className="text-xs text-slate-400 mt-1">{selectedClause.category}</p>
                            </div>

                            {/* Clause description */}
                            <div className="p-4 border-b border-slate-200">
                                <p className="text-sm text-slate-600 leading-relaxed">{selectedClause.description}</p>
                                {selectedClause.legalContext && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs font-medium text-slate-500 mb-1">Legal Context</p>
                                        <p className="text-xs text-slate-600">{selectedClause.legalContext}</p>
                                    </div>
                                )}
                            </div>

                            {/* Position setting (only during clause_discussion step) */}
                            {(currentStep === 'clause_discussion' || currentStep === 'draft_review') &&
                             (selectedClause.status === 'accepted' || selectedClause.status === 'position_set') && (
                                <div className="flex-1 overflow-y-auto p-4">
                                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Set Your Position</h4>

                                    {/* Position bar */}
                                    <div className="mb-4">
                                        <div className="relative h-10 bg-gradient-to-r from-blue-200 via-slate-100 to-emerald-200 rounded-lg border border-slate-300">
                                            {/* Grid lines */}
                                            {Array.from({ length: 9 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute top-0 bottom-0 w-px bg-slate-300/50"
                                                    style={{ left: `${((i + 1) / 10) * 100}%` }}
                                                />
                                            ))}

                                            {/* Clarence recommendation */}
                                            {selectedClause.clarenceRecommendation !== null && (
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white z-10 shadow"
                                                    style={{ left: `${((selectedClause.clarenceRecommendation - 1) / 9) * 100}%`, transform: 'translate(-50%, -50%)' }}
                                                    title={`CLARENCE suggests: ${selectedClause.clarenceRecommendation}`}
                                                >
                                                    C
                                                </div>
                                            )}

                                            {/* Provider position */}
                                            {selectedClause.providerPosition !== null && (
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white z-10 shadow"
                                                    style={{ left: `${((selectedClause.providerPosition - 1) / 9) * 100}%`, transform: 'translate(-50%, -50%)' }}
                                                    title={`Provider: ${selectedClause.providerPosition}`}
                                                >
                                                    P
                                                </div>
                                            )}

                                            {/* Customer position */}
                                            {selectedClause.customerPosition !== null && (
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white z-20 shadow"
                                                    style={{ left: `${((selectedClause.customerPosition - 1) / 9) * 100}%`, transform: 'translate(-50%, -50%)' }}
                                                    title={`Customer: ${selectedClause.customerPosition}`}
                                                >
                                                    C
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                                Provider-Friendly
                                            </span>
                                            <span className="flex items-center gap-1">
                                                Customer-Friendly
                                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Position buttons (1-10) */}
                                    <div className="grid grid-cols-5 gap-2">
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(pos => {
                                            const myPosition = isCustomer ? selectedClause.customerPosition : selectedClause.providerPosition
                                            const isSelected = myPosition === pos
                                            return (
                                                <button
                                                    key={pos}
                                                    onClick={() => handleSetPosition(selectedClause.clauseId, pos)}
                                                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        isSelected
                                                            ? isCustomer ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {pos}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Current positions summary */}
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                                            <span className="text-xs text-emerald-700">Customer Position</span>
                                            <span className="text-sm font-semibold text-emerald-700">
                                                {selectedClause.customerPosition ?? 'Not set'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                                            <span className="text-xs text-blue-700">Provider Position</span>
                                            <span className="text-sm font-semibold text-blue-700">
                                                {selectedClause.providerPosition ?? 'Not set'}
                                            </span>
                                        </div>
                                        {selectedClause.clarenceRecommendation !== null && (
                                            <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                                <span className="text-xs text-purple-700">CLARENCE Suggests</span>
                                                <span className="text-sm font-semibold text-purple-700">
                                                    {selectedClause.clarenceRecommendation}
                                                </span>
                                            </div>
                                        )}
                                        {selectedClause.customerPosition !== null && selectedClause.providerPosition !== null && (
                                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                <span className="text-xs text-slate-700">Gap</span>
                                                <span className={`text-sm font-semibold ${
                                                    Math.abs(selectedClause.customerPosition - selectedClause.providerPosition) <= 2
                                                        ? 'text-emerald-600'
                                                        : Math.abs(selectedClause.customerPosition - selectedClause.providerPosition) <= 4
                                                        ? 'text-amber-600'
                                                        : 'text-red-600'
                                                }`}>
                                                    {Math.abs(selectedClause.customerPosition - selectedClause.providerPosition)} positions
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}

                            {/* Show clause actions when not in position setting mode */}
                            {currentStep === 'clause_generation' && selectedClause.status === 'proposed' && (
                                <div className="p-4 border-t border-slate-200">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAcceptClause(selectedClause.clauseId)}
                                            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                                        >
                                            Accept Clause
                                        </button>
                                        <button
                                            onClick={() => handleRejectClause(selectedClause.clauseId)}
                                            className="flex-1 py-2.5 border border-red-300 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleDiscussClause(selectedClause.clauseId)}
                                        className="w-full mt-2 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                                    >
                                        Discuss with CLARENCE
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Empty state for right panel */
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="text-center text-slate-400">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium">Select a clause</p>
                                <p className="text-xs mt-1">Click a clause from the left panel to view details and set positions</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ============================================================ */}
            {/* TRANSITION MODAL */}
            {/* ============================================================ */}
            {transitionState.isOpen && transitionState.transition && (
                <TransitionModal
                    isOpen={transitionState.isOpen}
                    transition={transitionState.transition}
                    onContinue={handleTransitionContinue}
                />
            )}
        </div>
    )
}
