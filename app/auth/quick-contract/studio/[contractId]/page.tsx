'use client'

// ============================================================================
// QUICK CONTRACT STUDIO - Clause Review & Agreement
// Version: 3.3 - Activity Notifications & QC Event Tracking
// Date: 9 February 2026
// Path: /app/auth/quick-contract/studio/[id]/page.tsx
// 
// CHANGES in v3.3:
// - NEW: Separated QC event tracking from Mediation Studio (qc_clause_events table)
// - NEW: Activity notification layer with unread tracking per party
// - NEW: Auto-generated activity summaries for all clause events
// - NEW: Realtime subscription for live notification push between parties
// - NEW: History tab rebuilt as contract-wide Activity Feed with unread badges
// - NEW: Click-to-navigate from activity items to specific clauses
// - NEW: Mark-as-read when History tab is viewed
// - NEW: Unread badge on History tab button
// - Added 'draft_created', 'draft_modified', 'clause_deleted' event types
//
// CHANGES in v3.2:
// - Added Delete Clause feature with 3-dot kebab menu on each clause
// - Delete confirmation modal with parent/child warning
// - Query resolution: Pending flag clears when both parties agree to queried clause
// - Merged from deployed code to preserve Delete feature after v3.0/v3.1 changes
//
// CHANGES in v3.1:
// - CRITICAL FIX: Position scale now matches Contract Studio (legally verified)
//   * Position 1 = Provider-Favoring (maximum provider flexibility)
//   * Position 10 = Customer-Favoring (maximum customer protection)
// - Fixed DEFAULT_POSITION_OPTIONS labels
// - Fixed position bar scale labels (Provider left, Customer right)
// - Fixed position badge colors (high=emerald/customer, low=blue/provider)
// - Fixed balanced draft generation prompts and logic
//
// CHANGES in v3.0:
// - Implemented dual-party agreement tracking (initiator + respondent must both agree)
// - New agreement states: none, you_only, other_only, both
// - Updated all UI indicators to show partial vs full agreement
// - Commit button now shows waiting state when one party has committed
// - Progress bar shows amber for partial, green for full agreement
// - Modal states include 'waiting_other_party' for async commit flow
// ============================================================================

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import FeedbackButton from '@/app/components/FeedbackButton'
import QCPartyChatPanel from '@/app/auth/quick-contract/components/qc-party-chat-panel'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface Contract {
    contractId: string
    contractName: string
    contractType: string
    description: string | null
    status: string
    clauseCount: number
    companyId: string | null
    uploadedByUserId: string | null
    createdAt: string
    extractedText: string | null
}


interface ContractClause {
    clauseId: string
    positionId: string
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
    originalText: string | null
    clauseLevel: number
    displayOrder: number
    parentClauseId: string | null
    // CLARENCE Certification fields (AI assessment - never overwrite)
    clarenceCertified: boolean
    clarencePosition: number | null
    clarenceFairness: string | null
    clarenceSummary: string | null
    clarenceAssessment: string | null
    clarenceFlags: string[]
    clarenceCertifiedAt: string | null
    // Party position fields (user adjustments during negotiation)
    initiatorPosition: number | null
    respondentPosition: number | null
    // Value extraction fields (from document)
    extractedValue: string | null
    extractedUnit: string | null
    valueType: string | null
    documentPosition: number | null
    // Draft editing fields
    draftText: string | null
    draftModified: boolean
    // Position options (from clause library)
    positionOptions: PositionOption[]
    isHeader: boolean
    processingStatus: 'pending' | 'processing' | 'certified' | 'failed'
}

interface PositionOption {
    value: number
    label: string
    description: string
}

interface UserInfo {
    userId: string
    email: string
    fullName: string
    companyId: string | null
    companyName: string | null
}

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface ClauseEvent {
    eventId: string
    contractId: string
    clauseId: string | null
    eventType: 'agreed' | 'queried' | 'query_resolved' | 'position_changed' | 'redrafted' | 'committed' | 'agreement_withdrawn' | 'draft_created' | 'draft_modified' | 'clause_deleted'
    userId: string
    partyRole: 'initiator' | 'respondent'
    userName: string
    message: string | null
    eventData: Record<string, unknown>
    // Notification layer fields
    activitySummary: string | null
    readByInitiator: boolean
    readByRespondent: boolean
    createdAt: string
}

type CommitModalState = 'closed' | 'confirm' | 'processing' | 'success' | 'waiting_other_party'

// Party Chat message interface
interface PartyMessage {
    messageId: string
    contractId: string
    senderUserId: string
    senderName: string
    senderRole: 'initiator' | 'respondent'
    messageText: string
    relatedClauseId: string | null
    relatedClauseNumber: string | null
    relatedClauseName: string | null
    isSystemMessage: boolean
    isRead: boolean
    createdAt: string
}

// ============================================================================
// SECTION 2: CONSTANTS & CONFIGURATION
// ============================================================================

const supabase = createClient()

const CATEGORY_COLORS: Record<string, string> = {
    'Service Delivery': 'bg-blue-100 text-blue-700 border-blue-200',
    'Service Levels': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Charges and Payment': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Liability': 'bg-red-100 text-red-700 border-red-200',
    'Intellectual Property': 'bg-purple-100 text-purple-700 border-purple-200',
    'Term and Termination': 'bg-orange-100 text-orange-700 border-orange-200',
    'Data Protection': 'bg-pink-100 text-pink-700 border-pink-200',
    'Governance': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Employment': 'bg-amber-100 text-amber-700 border-amber-200',
    'Confidentiality': 'bg-violet-100 text-violet-700 border-violet-200',
    'Insurance': 'bg-teal-100 text-teal-700 border-teal-200',
    'Audit': 'bg-sky-100 text-sky-700 border-sky-200',
    'Dispute Resolution': 'bg-rose-100 text-rose-700 border-rose-200',
    'General': 'bg-slate-100 text-slate-700 border-slate-200',
    'Definitions': 'bg-gray-100 text-gray-600 border-gray-200',
    'Other': 'bg-slate-100 text-slate-600 border-slate-200'
}

function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
}

// Default position options when none specified
// SCALE: 1 = Maximum Provider Flexibility, 10 = Maximum Customer Protection
const DEFAULT_POSITION_OPTIONS: PositionOption[] = [
    { value: 1, label: 'Maximum Flexibility', description: 'Strongest provider-favoring terms' },
    { value: 2, label: 'Strong Provider Terms', description: 'Significant provider advantages' },
    { value: 3, label: 'Provider Advantage', description: 'Provider-leaning but reasonable' },
    { value: 4, label: 'Slight Provider Favor', description: 'Marginally provider-favoring' },
    { value: 5, label: 'Balanced', description: 'Neutral, industry standard' },
    { value: 6, label: 'Slight Customer Favor', description: 'Marginally customer-favoring' },
    { value: 7, label: 'Moderate Protection', description: 'Customer-leaning but reasonable' },
    { value: 8, label: 'Strong Protection', description: 'Significant customer advantages' },
    { value: 9, label: 'High Protection', description: 'Customer-favoring terms' },
    { value: 10, label: 'Maximum Protection', description: 'Strongest customer-favoring terms' }
]

// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function QuickContractStudioLoading() {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-purple-600">C</span>
                    </div>
                </div>
                <h2 className="text-xl font-semibold text-slate-700">Loading Contract Studio...</h2>
                <p className="text-slate-500 mt-2">Preparing your Quick Contract review</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

function QuickContractStudioContent() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const contractId = params?.contractId as string

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])

    // Template mode
    const isTemplateMode = searchParams.get('mode') === 'template'
    const isCompanyTemplate = searchParams.get('company') === 'true'
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templateSaved, setTemplateSaved] = useState(false)

    // Clause events & agreement tracking
    const [clauseEvents, setClauseEvents] = useState<ClauseEvent[]>([])
    // Dual-party agreement tracking - both must agree for clause to be fully agreed
    const [initiatorAgreedIds, setInitiatorAgreedIds] = useState<Set<string>>(new Set())
    const [respondentAgreedIds, setRespondentAgreedIds] = useState<Set<string>>(new Set())
    const [queriedClauseIds, setQueriedClauseIds] = useState<Set<string>>(new Set())

    // Activity notification state
    const [unreadActivityCount, setUnreadActivityCount] = useState(0)
    const [activityViewMode, setActivityViewMode] = useState<'all' | 'clause'>('all')

    // Commit modal
    const [commitModalState, setCommitModalState] = useState<CommitModalState>('closed')

    // Query input per clause
    const [queryText, setQueryText] = useState('')

    // UI state
    const [selectedClauseIndex, setSelectedClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'tradeoffs' | 'draft'>('overview')
    const [showClauseText, setShowClauseText] = useState(false)

    // Draft editing state
    const [isDraftEditing, setIsDraftEditing] = useState(false)
    const [editingDraftText, setEditingDraftText] = useState('')
    const [savingDraft, setSavingDraft] = useState(false)
    const [generatingBalancedDraft, setGeneratingBalancedDraft] = useState(false)

    // Chat state (CLARENCE AI chat - right panel)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)
    const clauseMenuRef = useRef<HTMLDivElement>(null)
    const clauseListRef = useRef<HTMLDivElement>(null)

    // Party Chat state (simplified - component handles its own state)
    const [partyChatOpen, setPartyChatOpen] = useState(false)
    const [partyChatUnread, setPartyChatUnread] = useState(0)
    const [respondentInfo, setRespondentInfo] = useState<{
        name: string
        company: string | null
        isOnline: boolean
    } | null>(null)

    // Progressive loading / certification polling state (must be before any early returns)
    const [isPolling, setIsPolling] = useState(false)
    const [certificationProgress, setCertificationProgress] = useState({ certified: 0, total: 0, failed: 0 })
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

    // Delete clause state
    const [deleteClauseTarget, setDeleteClauseTarget] = useState<ContractClause | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deletingClause, setDeletingClause] = useState(false)

    // Clause options menu state (for 3-dot menu)
    const [clauseMenuOpen, setClauseMenuOpen] = useState<string | null>(null)

    // NEW: Auto-save state for position persistence
    const [dirtyPositions, setDirtyPositions] = useState<Map<string, number>>(new Map())
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

    // Draft-Position Sync: Prompt to regenerate draft after position change
    const [showDraftOfferPrompt, setShowDraftOfferPrompt] = useState(false)
    const [pendingDraftPosition, setPendingDraftPosition] = useState<number | null>(null)
    const [generatingPositionDraft, setGeneratingPositionDraft] = useState(false)

    // Derived state
    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null

    // ========================================================================
    // SECTION 4B: AUTHENTICATION & DATA LOADING
    // ========================================================================

    useEffect(() => {
        async function loadData() {
            if (!contractId) {
                setError('No contract ID provided')
                setLoading(false)
                return
            }

            try {
                // Get user from localStorage (matching main Contract Studio pattern)
                const storedAuth = localStorage.getItem('clarence_auth')
                if (!storedAuth) {
                    router.push('/auth/login?redirect=/auth/quick-contract/studio/' + contractId)
                    return
                }

                const authData = JSON.parse(storedAuth)
                // Handle nested userInfo structure
                const user = authData.userInfo || authData

                if (!user.userId) {
                    router.push('/auth/login?redirect=/auth/quick-contract/studio/' + contractId)
                    return
                }

                setUserInfo({
                    userId: user.userId,
                    email: user.email || '',
                    fullName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.email || 'User'),
                    companyId: user.companyId || null,
                    companyName: user.company || null
                })

                // Load contract
                const { data: contractData, error: contractError } = await supabase
                    .from('uploaded_contracts')
                    .select('*')
                    .eq('contract_id', contractId)
                    .single()

                if (contractError || !contractData) {
                    console.error('Contract error:', contractError)
                    setError('Contract not found')
                    setLoading(false)
                    return
                }

                setContract({
                    contractId: contractData.contract_id,
                    contractName: contractData.contract_name,
                    contractType: contractData.detected_contract_type || 'Contract',
                    description: contractData.description,
                    status: contractData.status,
                    clauseCount: contractData.clause_count || 0,
                    companyId: contractData.company_id,
                    uploadedByUserId: contractData.uploaded_by_user_id,
                    createdAt: contractData.created_at,
                    extractedText: contractData.extracted_text
                })

                // In the data loading section, after fetching the contract:
                if (contractData.status === 'processing') {
                    // Still scanning structure - show a brief loading message
                    // (This should only take 10-15 seconds)
                } else if (contractData.status === 'certifying' || contractData.status === 'ready') {
                    // Clauses are available - load them and show progressive UI
                    // Polling will handle the rest
                }

                // Load clauses
                const { data: clausesData, error: clausesError } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('display_order', { ascending: true })

                if (clausesError) {
                    console.error('Clauses error:', clausesError)
                    setError('Failed to load contract clauses')
                    setLoading(false)
                    return
                }

                const mappedClauses: ContractClause[] = (clausesData || []).map(c => ({
                    clauseId: c.clause_id,
                    positionId: c.clause_id, // Use clause_id as position_id for Quick Contract
                    clauseNumber: c.clause_number,
                    clauseName: c.clause_name,
                    category: c.category || 'Other',
                    clauseText: c.content || '',
                    originalText: c.original_text || c.content || null,  // Prefer original_text, fall back to content
                    clauseLevel: c.clause_level || 1,
                    displayOrder: c.display_order,
                    parentClauseId: c.parent_clause_id,
                    clarenceCertified: c.clarence_certified || false,
                    clarencePosition: c.clarence_position,
                    clarenceFairness: c.clarence_fairness,
                    clarenceSummary: c.clarence_summary,
                    clarenceAssessment: c.clarence_assessment,
                    clarenceFlags: c.clarence_flags || [],
                    clarenceCertifiedAt: c.clarence_certified_at,
                    // PERSISTENCE: Load party positions from database
                    // These are null until a party adjusts the slider
                    // clarence_position stays as the untouched AI baseline
                    initiatorPosition: c.initiator_position ?? null,
                    respondentPosition: c.respondent_position ?? null,
                    // Value extraction fields
                    extractedValue: c.extracted_value,
                    extractedUnit: c.extracted_unit,
                    valueType: c.value_type,
                    documentPosition: c.document_position,
                    // Draft fields
                    draftText: c.draft_text || null,
                    draftModified: !!c.draft_text,
                    isHeader: c.is_header || false,
                    processingStatus: c.status || 'pending',
                    positionOptions: DEFAULT_POSITION_OPTIONS
                }))

                setClauses(mappedClauses)

                // PERSISTENCE: Restore selected clause from LocalStorage, or default to first
                const savedClauseIndex = localStorage.getItem(`qc_studio_${contractId}_selectedClause`)
                if (savedClauseIndex !== null && parseInt(savedClauseIndex) < mappedClauses.length) {
                    setSelectedClauseIndex(parseInt(savedClauseIndex))
                } else if (mappedClauses.length > 0) {
                    setSelectedClauseIndex(0)
                }

                // PERSISTENCE: Restore active tab from LocalStorage
                const savedTab = localStorage.getItem(`qc_studio_${contractId}_activeTab`)
                if (savedTab && ['overview', 'history', 'tradeoffs', 'draft'].includes(savedTab)) {
                    setActiveTab(savedTab as 'overview' | 'history' | 'tradeoffs' | 'draft')
                }

                // PERSISTENCE: Restore expanded sections from LocalStorage
                const savedSections = localStorage.getItem(`qc_studio_${contractId}_expandedSections`)
                if (savedSections) {
                    try {
                        setExpandedSections(new Set(JSON.parse(savedSections)))
                    } catch (e) {
                        // Ignore corrupt LocalStorage data
                    }
                }

                // Load clause events for agreement tracking
                const { data: eventsData } = await supabase
                    .from('qc_clause_events')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('created_at', { ascending: true })

                if (eventsData && eventsData.length > 0) {
                    const mappedEvents: ClauseEvent[] = eventsData.map(e => ({
                        eventId: e.event_id,
                        contractId: e.contract_id,
                        clauseId: e.clause_id,
                        eventType: e.event_type,
                        userId: e.user_id,
                        partyRole: e.party_role,
                        userName: e.user_name || 'Unknown',
                        message: e.message,
                        eventData: e.event_data || {},
                        activitySummary: e.activity_summary || null,
                        readByInitiator: e.read_by_initiator ?? false,
                        readByRespondent: e.read_by_respondent ?? false,
                        createdAt: e.created_at
                    }))
                    setClauseEvents(mappedEvents)

                    // Build agreed/queried sets from events - track by party role
                    const initiatorAgreed = new Set<string>()
                    const respondentAgreed = new Set<string>()
                    const queried = new Set<string>()

                    mappedEvents.forEach(evt => {
                        if (evt.eventType === 'agreed' && evt.clauseId) {
                            // Track who agreed based on party_role
                            if (evt.partyRole === 'initiator') {
                                initiatorAgreed.add(evt.clauseId)
                            } else if (evt.partyRole === 'respondent') {
                                respondentAgreed.add(evt.clauseId)
                            }
                        }
                        if (evt.eventType === 'agreement_withdrawn' && evt.clauseId) {
                            // Remove from the correct party's set
                            if (evt.partyRole === 'initiator') {
                                initiatorAgreed.delete(evt.clauseId)
                            } else if (evt.partyRole === 'respondent') {
                                respondentAgreed.delete(evt.clauseId)
                            }
                        }
                        if (evt.eventType === 'queried' && evt.clauseId) {
                            queried.add(evt.clauseId)
                        }
                        if (evt.eventType === 'query_resolved' && evt.clauseId) {
                            queried.delete(evt.clauseId)
                        }
                    })
                    setInitiatorAgreedIds(initiatorAgreed)
                    setRespondentAgreedIds(respondentAgreed)
                    setQueriedClauseIds(queried)

                    // Calculate initial unread count for current user
                    const currentRole = contractData.uploaded_by_user_id === user.userId ? 'initiator' : 'respondent'
                    const unreadCount = mappedEvents.filter(e => {
                        if (currentRole === 'initiator') return !e.readByInitiator
                        return !e.readByRespondent
                    }).length
                    setUnreadActivityCount(unreadCount)
                }

                // Initialize chat with welcome message
                // Truncate very long contract names for display
                const displayName = contractData.contract_name.length > 50
                    ? contractData.contract_name.substring(0, 47) + '...'
                    : contractData.contract_name

                setChatMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: `Welcome to the Quick Contract Studio! I'm CLARENCE, your contract analysis assistant.\n\nI've reviewed "${displayName}" and certified ${mappedClauses.filter(c => c.clarenceCertified).length} of ${mappedClauses.length} clauses.\n\nSelect any clause to see my recommended position and analysis. Feel free to ask me questions about specific clauses or the contract as a whole.`,
                    timestamp: new Date()
                }])

                setLoading(false)

            } catch (err) {
                console.error('Load error:', err)
                setError('An unexpected error occurred')
                setLoading(false)
            }
        }

        loadData()
    }, [contractId, router])

    // ========================================================================
    // SECTION: TRIGGER CERTIFICATION ON STUDIO LOAD
    // When user arrives at studio, kick off sequential certification
    // for any clauses that haven't been certified yet
    // ========================================================================

    const [certificationTriggered, setCertificationTriggered] = useState(false)

    useEffect(() => {
        if (certificationTriggered || !contractId || !clauses.length) return

        // Check if there are uncertified non-header clauses
        // FIX: Also skip clauses that already have clarence_position populated
        // (these came from a pre-certified template and don't need re-certification)
        const pendingClauses = clauses.filter(c =>
            !c.isHeader &&
            (c.processingStatus === 'pending' || c.processingStatus === 'processing') &&
            !c.clarencePosition  // Skip if already has a CLARENCE position (pre-certified from template)
        )

        if (pendingClauses.length === 0) {
            // If all clauses already have positions but status is 'pending', fix them locally
            const preCertifiedClauses = clauses.filter(c =>
                !c.isHeader &&
                (c.processingStatus === 'pending' || c.processingStatus === 'processing') &&
                c.clarencePosition !== null && c.clarencePosition !== undefined
            )
            if (preCertifiedClauses.length > 0) {
                console.log(`Ã¢Å“â€¦ ${preCertifiedClauses.length} clauses already pre-certified from template, skipping certification`)
                // Update local state to reflect certified status
                setClauses(prev => prev.map(c => {
                    if (!c.isHeader && c.clarencePosition !== null && c.clarencePosition !== undefined &&
                        (c.processingStatus === 'pending' || c.processingStatus === 'processing')) {
                        return { ...c, processingStatus: 'certified' as const, clarenceCertified: true }
                    }
                    return c
                }))
            }
            return // All already certified or pre-certified
        }

        console.log(`Triggering certification for ${pendingClauses.length} pending clauses...`)
        setCertificationTriggered(true)
        setIsPolling(true)  // <-- ADD THIS LINE to start the polling

        // Fire and forget - the polling useEffect handles the rest
        fetch('https://spikeislandstudios.app.n8n.cloud/webhook/certify-next-clause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contract_id: contractId })
        }).catch(err => console.error('Failed to trigger certification:', err))

    }, [contractId, clauses.length, certificationTriggered])

    // ========================================================================
    // SECTION 4C: CHAT FUNCTIONS
    // ========================================================================

    const sendChatMessage = useCallback(async (directMessage?: string) => {
        const messageToSend = directMessage || chatInput.trim()
        if (!messageToSend || chatLoading) return

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: messageToSend,
            timestamp: new Date()
        }

        setChatMessages(prev => [...prev, userMessage])
        if (!directMessage) setChatInput('') // Only clear input if using input field
        setChatLoading(true)

        try {
            // Call CLARENCE AI endpoint
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    contractId: contractId,
                    clauseId: selectedClause?.clauseId,
                    clauseName: selectedClause?.clauseName,
                    clauseCategory: selectedClause?.category,
                    context: 'quick_contract_studio'
                })
            })

            if (response.ok) {
                const data = await response.json()
                const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data.response || data.message || "I understand. Let me help you with that.",
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, assistantMessage])
            } else {
                // Fallback response
                const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: selectedClause
                        ? `Regarding "${selectedClause.clauseName}": ${selectedClause.clarenceAssessment || selectedClause.clarenceSummary || 'This clause has been reviewed and certified. The recommended position balances both parties\' interests based on industry standards.'}`
                        : "I'm here to help you understand this contract. Please select a clause or ask me a specific question.",
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, assistantMessage])
            }
        } catch (err) {
            console.error('Chat error:', err)
            const errorMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setChatLoading(false)
        }
    }, [chatInput, chatLoading, contractId, selectedClause])

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 4C-2: HELPER FOR POSITION LABELS
    // ========================================================================

    const getPositionLabel = (position: number | null): string => {
        if (position === null) return 'Not set'
        const option = DEFAULT_POSITION_OPTIONS.find(o => o.value === Math.round(position))
        return option?.label || `Position ${position}`
    }

    // Helper to get typical industry range based on category and value type
    const getTypicalRange = (category: string, valueType: string | null, unit: string | null): string => {
        // Category-specific typical ranges
        const categoryRanges: Record<string, Record<string, string>> = {
            'Charges and Payment': {
                'duration': '14-30 days',
                'percentage': '2-4%',
                'currency': 'Net amount',
                'default': '30 days'
            },
            'Term and Termination': {
                'duration': '30-90 days notice',
                'default': '60-90 days'
            },
            'Liability': {
                'currency': '100-150% annual fees',
                'percentage': '100-200%',
                'default': 'Capped at contract value'
            },
            'Confidentiality': {
                'duration': '2-5 years',
                'default': '3-5 years'
            },
            'Service Levels': {
                'percentage': '99.5-99.9%',
                'duration': '4-24 hours',
                'default': '99.9% uptime'
            },
            'Data Protection': {
                'duration': '72 hours breach notification',
                'default': 'GDPR compliant'
            },
            'Intellectual Property': {
                'default': 'Retained by originator'
            },
            'Insurance': {
                'currency': '\u00A31M-\u00A35M',
                'default': 'Industry standard coverage'
            },
            'Audit': {
                'duration': '30 days notice',
                'count': '1-2 per year',
                'default': 'Annual audit rights'
            },
            'Dispute Resolution': {
                'duration': '30-60 days escalation',
                'default': 'Mediation then arbitration'
            }
        }

        const categoryConfig = categoryRanges[category]
        if (categoryConfig) {
            if (valueType && categoryConfig[valueType]) {
                return categoryConfig[valueType]
            }
            return categoryConfig['default'] || 'Industry standard'
        }

        // Generic fallback based on value type
        if (valueType === 'duration') {
            if (unit === 'days') return '30-60 days'
            if (unit === 'months') return '3-6 months'
            if (unit === 'years') return '2-5 years'
            if (unit === 'hours') return '24-48 hours'
            return '30-90 days'
        }
        if (valueType === 'percentage') return '5-15%'
        if (valueType === 'currency') return 'Market rate'

        return 'Industry standard'
    }

    // ========================================================================
    // SECTION 4C-3: CLAUSE CLICK -> RATIONALE
    // Auto-generate explanation when clause is selected
    // ========================================================================

    const [lastExplainedClauseId, setLastExplainedClauseId] = useState<string | null>(null)
    const [initialLoadComplete, setInitialLoadComplete] = useState(false)

    // Reset draft editing state when clause selection changes
    useEffect(() => {
        setIsDraftEditing(false)
        setEditingDraftText('')
    }, [selectedClauseIndex])

    // Mark initial load complete after first render with clauses
    useEffect(() => {
        if (clauses.length > 0 && selectedClause && !initialLoadComplete) {
            // Set the first clause as "explained" to prevent auto-triggering on load
            setLastExplainedClauseId(selectedClause.clauseId)
            setInitialLoadComplete(true)
        }
    }, [clauses.length, selectedClause, initialLoadComplete])


    // Auto-expand all sections when clauses first load
    const sectionsInitialized = useRef(false)

    useEffect(() => {
        if (clauses.length > 0 && !sectionsInitialized.current) {
            sectionsInitialized.current = true
            const parentIds = new Set<string>()
            clauses.forEach(c => {
                if (c.parentClauseId) parentIds.add(c.parentClauseId)
            })
            const headerIds = clauses
                .filter(c => parentIds.has(c.clauseId))
                .map(c => c.clauseId)
            if (headerIds.length > 0) {
                setExpandedSections(new Set(headerIds))
            }
        }
    }, [clauses.length])

    useEffect(() => {
        // Don't trigger until initial load is complete
        if (!initialLoadComplete) return

        // Only trigger if we have a selected clause and it's different from last explained
        if (!selectedClause || selectedClause.clauseId === lastExplainedClauseId) return

        // Generate rationale message
        const generateRationale = () => {
            const clause = selectedClause
            const posLabel = getPositionLabel(clause.clarencePosition)

            // Build the rationale message
            let rationaleContent = `**${clause.clauseName}** (${clause.clauseNumber})\n\n`

            // Show document position vs CLARENCE position if we have both
            if (clause.documentPosition !== null && clause.clarencePosition !== null) {
                const docPosLabel = getPositionLabel(clause.documentPosition)
                const difference = Math.abs(clause.documentPosition - clause.clarencePosition)

                rationaleContent += `**Your Document:** Position ${clause.documentPosition.toFixed(1)} - ${docPosLabel}`
                if (clause.extractedValue && clause.extractedUnit) {
                    rationaleContent += ` (${clause.extractedValue} ${clause.extractedUnit})`
                }
                rationaleContent += `\n**CLARENCE Recommends:** Position ${clause.clarencePosition.toFixed(1)} - ${posLabel}\n\n`

                // Add comparison insight
                if (difference < 0.5) {
                    rationaleContent += `\u2705 **Assessment:** This clause is well-balanced and aligns with industry standards.\n\n`
                } else if (clause.documentPosition > clause.clarencePosition) {
                    rationaleContent += `\u26A0\uFE0F **Assessment:** This clause is more provider-favoring than typical. Consider whether the terms are justified for your situation.\n\n`
                } else {
                    rationaleContent += `\u{1F4A1} **Assessment:** This clause is more customer-protective than typical, which works in your favor.\n\n`
                }
            } else if (clause.clarencePosition !== null) {
                rationaleContent += `**CLARENCE Position:** ${clause.clarencePosition.toFixed(1)} - ${posLabel}\n\n`
            }

            // Add the summary/assessment
            if (clause.clarenceSummary) {
                rationaleContent += `**Summary:**\n${clause.clarenceSummary}\n\n`
            }

            if (clause.clarenceAssessment) {
                rationaleContent += `**Rationale:**\n${clause.clarenceAssessment}\n\n`
            }

            // Add flags if any
            if (clause.clarenceFlags && clause.clarenceFlags.length > 0) {
                rationaleContent += `**Attention Points:**\n`
                clause.clarenceFlags.forEach(flag => {
                    rationaleContent += `\u2022 ${flag}\n`
                })
                rationaleContent += '\n'
            }

            // Closing prompt
            rationaleContent += `Would you like me to explain any aspect in more detail, or discuss alternatives?`

            const rationaleMessage: ChatMessage = {
                id: `rationale-${clause.clauseId}-${Date.now()}`,
                role: 'assistant',
                content: rationaleContent,
                timestamp: new Date()
            }

            setChatMessages(prev => [...prev, rationaleMessage])
            setLastExplainedClauseId(clause.clauseId)
        }

        // Small delay to make it feel more natural
        const timer = setTimeout(generateRationale, 300)
        return () => clearTimeout(timer)

    }, [selectedClause?.clauseId, lastExplainedClauseId, initialLoadComplete])

    // ========================================================================
    // SECTION 4D: ACTION HANDLERS - AGREE, QUERY, COMMIT
    // ========================================================================

    // Determine party role for current user
    const getPartyRole = (): 'initiator' | 'respondent' => {
        if (contract?.uploadedByUserId === userInfo?.userId) return 'initiator'
        return 'respondent'
    }

    // ========================================================================
    // AGREEMENT STATUS HELPERS - Dual-party tracking
    // ========================================================================

    // Check if CURRENT user has agreed to a clause
    const hasCurrentUserAgreed = (clauseId: string): boolean => {
        const role = getPartyRole()
        return role === 'initiator'
            ? initiatorAgreedIds.has(clauseId)
            : respondentAgreedIds.has(clauseId)
    }

    // Check if OTHER party has agreed to a clause
    const hasOtherPartyAgreed = (clauseId: string): boolean => {
        const role = getPartyRole()
        return role === 'initiator'
            ? respondentAgreedIds.has(clauseId)
            : initiatorAgreedIds.has(clauseId)
    }

    // Check if BOTH parties have agreed (clause is fully agreed)
    const isBothPartiesAgreed = (clauseId: string): boolean => {
        return initiatorAgreedIds.has(clauseId) && respondentAgreedIds.has(clauseId)
    }

    // Check if at least one party has agreed
    const isAnyPartyAgreed = (clauseId: string): boolean => {
        return initiatorAgreedIds.has(clauseId) || respondentAgreedIds.has(clauseId)
    }

    // Get agreement status for display
    type AgreementStatus = 'none' | 'you_only' | 'other_only' | 'both'
    const getAgreementStatus = (clauseId: string): AgreementStatus => {
        const youAgreed = hasCurrentUserAgreed(clauseId)
        const theyAgreed = hasOtherPartyAgreed(clauseId)

        if (youAgreed && theyAgreed) return 'both'
        if (youAgreed) return 'you_only'
        if (theyAgreed) return 'other_only'
        return 'none'
    }

    // Get other party's display name
    const getOtherPartyName = (): string => {
        if (respondentInfo?.name) {
            return getPartyRole() === 'initiator' ? respondentInfo.name : (userInfo?.fullName || 'Initiator')
        }
        return getPartyRole() === 'initiator' ? 'Respondent' : 'Initiator'
    }

    // Count fully agreed clauses (both parties)
    const getFullyAgreedCount = (): number => {
        return clauses.filter(c => !c.isHeader && c.clarenceCertified && isBothPartiesAgreed(c.clauseId)).length
    }

    // Count partially agreed clauses (one party only)
    const getPartiallyAgreedCount = (): number => {
        return clauses.filter(c => !c.isHeader && c.clarenceCertified && isAnyPartyAgreed(c.clauseId) && !isBothPartiesAgreed(c.clauseId)).length
    }

    // Helper: record a clause event to qc_clause_events (unified audit + notification)
    const recordClauseEvent = async (
        eventType: ClauseEvent['eventType'],
        clauseId: string | null,
        message?: string,
        eventData?: Record<string, unknown>
    ): Promise<ClauseEvent | null> => {
        if (!userInfo || !contractId) return null

        const partyRole = getPartyRole()

        // Auto-generate human-readable activity summary
        const clauseName = eventData?.clause_name as string || eventData?.clause_number as string || 'a clause'
        const summaryMap: Record<string, string> = {
            'agreed': `${userInfo.fullName} agreed to ${clauseName}`,
            'agreement_withdrawn': `${userInfo.fullName} withdrew agreement on ${clauseName}`,
            'queried': `${userInfo.fullName} raised a query on ${clauseName}`,
            'query_resolved': `Query resolved on ${clauseName} — both parties agreed`,
            'position_changed': `${userInfo.fullName} adjusted position on ${clauseName}`,
            'redrafted': `${userInfo.fullName} redrafted ${clauseName}`,
            'draft_created': `${userInfo.fullName} created a draft for ${clauseName}`,
            'draft_modified': `${userInfo.fullName} modified the draft for ${clauseName}`,
            'committed': `${userInfo.fullName} committed the contract`,
            'clause_deleted': `${userInfo.fullName} deleted ${clauseName}`,
        }
        const activitySummary = summaryMap[eventType] || `${userInfo.fullName} performed ${eventType}`

        // Set read flags: actor has already "seen" their own action
        const readByInitiator = partyRole === 'initiator'
        const readByRespondent = partyRole === 'respondent'

        const { data, error: insertError } = await supabase
            .from('qc_clause_events')
            .insert({
                contract_id: contractId,
                clause_id: clauseId,
                event_type: eventType,
                user_id: userInfo.userId,
                party_role: partyRole,
                user_name: userInfo.fullName,
                message: message || null,
                event_data: eventData || {},
                activity_summary: activitySummary,
                read_by_initiator: readByInitiator,
                read_by_respondent: readByRespondent
            })
            .select()
            .single()

        if (insertError) {
            console.error('Failed to record event:', insertError)
            return null
        }

        const newEvent: ClauseEvent = {
            eventId: data.event_id,
            contractId: data.contract_id,
            clauseId: data.clause_id,
            eventType: data.event_type,
            userId: data.user_id,
            partyRole: data.party_role,
            userName: data.user_name || userInfo.fullName,
            message: data.message,
            eventData: data.event_data || {},
            activitySummary: data.activity_summary,
            readByInitiator: data.read_by_initiator,
            readByRespondent: data.read_by_respondent,
            createdAt: data.created_at
        }

        setClauseEvents(prev => [...prev, newEvent])
        return newEvent
    }

    // AGREE: Mark a clause as agreed by current user
    const handleAgreeClause = async (clauseId: string) => {
        // Check if current user already agreed (not if anyone agreed)
        if (hasCurrentUserAgreed(clauseId)) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const partyRole = getPartyRole()
        const event = await recordClauseEvent('agreed', clauseId, undefined, {
            clause_name: clause?.clauseName,
            clause_number: clause?.clauseNumber,
            position: clause?.clarencePosition
        })

        if (event) {
            // Update the correct party's agreement set
            if (partyRole === 'initiator') {
                setInitiatorAgreedIds(prev => new Set([...prev, clauseId]))
            } else {
                setRespondentAgreedIds(prev => new Set([...prev, clauseId]))
            }

            // Check if this agreement completes both parties
            const otherAgreed = hasOtherPartyAgreed(clauseId)
            const statusMsg = otherAgreed
                ? `Both parties have now agreed to this clause.`
                : `Awaiting ${getOtherPartyName()} to also agree.`

            // QUERY RESOLUTION: If clause was queried and both parties now agree, resolve the query
            if (otherAgreed && queriedClauseIds.has(clauseId)) {
                // Record query_resolved event
                await recordClauseEvent('query_resolved', clauseId, 'Query resolved - both parties agreed', {
                    clause_name: clause?.clauseName,
                    resolution_method: 'mutual_agreement'
                })

                // Clear from queried set
                setQueriedClauseIds(prev => {
                    const next = new Set(prev)
                    next.delete(clauseId)
                    return next
                })

                const resolveMsg: ChatMessage = {
                    id: `query-resolved-${Date.now()}`,
                    role: 'assistant',
                    content: `âœ… Query on "${clause?.clauseName}" has been resolved - both parties have agreed.`,
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, resolveMsg])
            }

            const msg: ChatMessage = {
                id: `agree-${Date.now()}`,
                role: 'assistant',
                content: `âœ… You agreed to "${clause?.clauseName}" (${clause?.clauseNumber}). ${statusMsg}`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])
        }
    }

    // WITHDRAW AGREEMENT: Un-agree a clause
    const handleWithdrawAgreement = async (clauseId: string) => {
        // Check if current user has agreed (not if anyone agreed)
        if (!hasCurrentUserAgreed(clauseId)) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const partyRole = getPartyRole()
        const event = await recordClauseEvent('agreement_withdrawn', clauseId, undefined, {
            clause_name: clause?.clauseName
        })

        if (event) {
            // Remove from the correct party's agreement set
            if (partyRole === 'initiator') {
                setInitiatorAgreedIds(prev => {
                    const next = new Set(prev)
                    next.delete(clauseId)
                    return next
                })
            } else {
                setRespondentAgreedIds(prev => {
                    const next = new Set(prev)
                    next.delete(clauseId)
                    return next
                })
            }

            const msg: ChatMessage = {
                id: `withdraw-${Date.now()}`,
                role: 'assistant',
                content: `Agreement withdrawn for "${clause?.clauseName}" (${clause?.clauseNumber}).`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])
        }
    }

    // QUERY: Flag a clause with a question
    const handleQueryClause = async (clauseId: string, queryMessage: string) => {
        if (!queryMessage.trim()) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const event = await recordClauseEvent('queried', clauseId, queryMessage, {
            clause_name: clause?.clauseName,
            clause_number: clause?.clauseNumber
        })

        if (event) {
            setQueriedClauseIds(prev => new Set([...prev, clauseId]))
            setQueryText('')

            // Chat notification
            const msg: ChatMessage = {
                id: `query-${Date.now()}`,
                role: 'assistant',
                content: `\u2753 Query raised on "${clause?.clauseName}" (${clause?.clauseNumber}):\n\n"${queryMessage}"\n\nThis has been recorded and the other party will be notified.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])

            // Query is saved to qc_party_messages via the insert above
            // The QCPartyChatPanel component will receive it via Supabase Realtime
        }
    }

    // COMMIT: Current user agrees to all remaining clauses and commits
    const handleCommitContract = async () => {
        if (!contract || !userInfo) return

        // PERSISTENCE: Force-save any unsaved position adjustments before committing
        const saveSuccess = await forceSavePositions()
        if (!saveSuccess) {
            setError('Failed to save position changes. Please try again before committing.')
            return
        }

        setCommitModalState('processing')
        const partyRole = getPartyRole()

        try {
            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)

            // Find clauses this user hasn't agreed to yet
            const unagreedByMe = leafClauses.filter(c => !hasCurrentUserAgreed(c.clauseId))

            // Auto-agree any clauses the current user hasn't agreed to
            for (const clause of unagreedByMe) {
                await recordClauseEvent('agreed', clause.clauseId, undefined, {
                    clause_name: clause.clauseName,
                    auto_agreed_via_commit: true
                })

                // Update the correct party's set
                if (partyRole === 'initiator') {
                    setInitiatorAgreedIds(prev => new Set([...prev, clause.clauseId]))
                } else {
                    setRespondentAgreedIds(prev => new Set([...prev, clause.clauseId]))
                }
            }

            // Check if other party has also committed (all their clauses agreed)
            const otherPartyFullyAgreed = leafClauses.every(c => hasOtherPartyAgreed(c.clauseId))

            // Record the commit event with audit data
            await recordClauseEvent('committed', null, undefined, {
                party_role: partyRole,
                clauses_individually_agreed: leafClauses.length - unagreedByMe.length,
                clauses_auto_agreed: unagreedByMe.length,
                total_clauses: leafClauses.length,
                other_party_committed: otherPartyFullyAgreed,
                ip_address: 'captured_server_side',
                user_agent: navigator.userAgent,
                committed_at: new Date().toISOString()
            })

            // Only update contract status to 'committed' if BOTH parties have now committed
            if (otherPartyFullyAgreed) {
                await supabase
                    .from('uploaded_contracts')
                    .update({
                        status: 'committed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('contract_id', contract.contractId)

                // Log system event for full commit
                await supabase.from('system_events').insert({
                    event_type: 'quick_contract_committed',
                    source_system: 'quick_contract_studio',
                    context: {
                        contract_id: contract.contractId,
                        user_id: userInfo.userId,
                        party_role: partyRole,
                        clause_count: leafClauses.length,
                        both_parties_committed: true
                    }
                })

                setCommitModalState('success')

                // Redirect after showing success
                setTimeout(() => {
                    router.push('/auth/document-centre?contract_id=' + contract.contractId + '&committed=true')
                }, 2000)
            } else {
                // Only current user committed - waiting for other party
                await supabase.from('system_events').insert({
                    event_type: 'quick_contract_party_committed',
                    source_system: 'quick_contract_studio',
                    context: {
                        contract_id: contract.contractId,
                        user_id: userInfo.userId,
                        party_role: partyRole,
                        awaiting_other_party: true
                    }
                })

                setCommitModalState('waiting_other_party')
            }

        } catch (err) {
            console.error('Commit error:', err)
            setCommitModalState('closed')
            setError('Failed to commit contract. Please try again.')
        }
    }

    // SAVE AS TEMPLATE handler (template mode only)
    // FIX: Now includes ALL certification fields so templates are pre-certified
    // and don't trigger re-certification when used to create a new session
    const handleSaveAsTemplate = async () => {
        if (!templateName.trim() || !contractId || !userInfo) return

        setSavingTemplate(true)
        try {
            const certifiedClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
            const templateCode = isCompanyTemplate
                ? `CO-${contractId.substring(0, 8).toUpperCase()}`
                : `USER-${contractId.substring(0, 8).toUpperCase()}`

            const { data: template, error: templateError } = await supabase
                .from('contract_templates')
                .insert({
                    template_code: templateCode,
                    template_name: templateName.trim(),
                    description: `Certified from uploaded contract: ${contract?.contractName || 'Unknown'}`,
                    contract_type: contract?.contractType || 'custom',
                    is_system: false,
                    is_public: isCompanyTemplate,
                    is_active: true,
                    company_id: userInfo.companyId,
                    created_by_user_id: userInfo.userId,
                    clause_count: certifiedClauses.length,
                    version: 1,
                    times_used: 0,
                    certification_status: 'certified',
                })
                .select('template_id')
                .single()

            if (templateError) throw templateError

            // FIX: Include ALL certification fields so clauses are pre-certified
            const templateClauses = certifiedClauses.map(clause => ({
                template_id: template.template_id,
                clause_number: clause.clauseNumber,
                clause_name: clause.clauseName,
                category: clause.category,
                default_text: clause.clauseText || clause.originalText || '',
                clause_level: clause.clauseLevel,
                display_order: clause.displayOrder,
                parent_clause_id: clause.parentClauseId,
                clarence_position: clause.clarencePosition,
                clarence_fairness: clause.clarenceFairness,
                clarence_summary: clause.clarenceSummary,
                clarence_assessment: clause.clarenceAssessment,
                clarence_flags: clause.clarenceFlags || [],
                clarence_certified: true,
                clarence_certified_at: clause.clarenceCertifiedAt || new Date().toISOString(),
                status: 'certified',
            }))

            if (templateClauses.length > 0) {
                await supabase
                    .from('template_clauses')
                    .insert(templateClauses)
            }

            console.log(`Ã¢Å“â€¦ Template saved with ${certifiedClauses.length} pre-certified clauses`)
            setTemplateSaved(true)
            setTimeout(() => router.push(isCompanyTemplate ? '/auth/company-admin' : '/auth/contracts'), 1500)

        } catch (error) {
            console.error('Failed to save template:', error)
            alert('Failed to save template. Please try again.')
        } finally {
            setSavingTemplate(false)
        }
    }

    // ========================================================================
    // SECTION 4D-1A: PARTY CHAT FUNCTIONS
    // ========================================================================

    // Note: getPartyRole() is defined in SECTION 4D above
    // Note: getOtherPartyName() is defined in SECTION 4D above with the agreement helpers

    // Load respondent info from qc_recipients
    const loadRespondentInfo = useCallback(async () => {
        if (!contractId) return
        try {
            // Find the quick_contract record, then get recipient
            const { data: qcData } = await supabase
                .from('quick_contracts')
                .select('quick_contract_id')
                .eq('contract_id', contractId)
                .single()

            if (qcData) {
                const { data: recipientData } = await supabase
                    .from('qc_recipients')
                    .select('recipient_name, recipient_company')
                    .eq('quick_contract_id', qcData.quick_contract_id)
                    .limit(1)
                    .single()

                if (recipientData) {
                    setRespondentInfo({
                        name: recipientData.recipient_name || 'Respondent',
                        company: recipientData.recipient_company || null,
                        isOnline: false // Will be enhanced with presence tracking later
                    })
                }
            }
        } catch (err) {
            console.log('Could not load respondent info:', err)
        }
    }, [contractId])



    // ========================================================================
    // SECTION 4D-2: DRAFT EDITING HANDLERS
    // ========================================================================

    // Start editing draft
    const handleStartEditing = () => {
        if (!selectedClause) return
        // Use existing draft text, or fall back to original clause text
        setEditingDraftText(selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || '')
        setIsDraftEditing(true)
    }

    // Cancel editing
    const handleCancelEditing = () => {
        setIsDraftEditing(false)
        setEditingDraftText('')
    }

    // Save draft to database
    const handleSaveDraft = async () => {
        if (!selectedClause || !userInfo) return

        setSavingDraft(true)
        try {
            const { error: updateError } = await supabase
                .from('uploaded_contract_clauses')
                .update({
                    draft_text: editingDraftText,
                    draft_modified_at: new Date().toISOString(),
                    draft_modified_by: userInfo.userId
                })
                .eq('clause_id', selectedClause.clauseId)

            if (updateError) throw updateError

            // Update local state
            setClauses(prev => prev.map(c =>
                c.clauseId === selectedClause.clauseId
                    ? { ...c, draftText: editingDraftText, draftModified: true }
                    : c
            ))

            setIsDraftEditing(false)
            setEditingDraftText('')

            // ================================================================
            // Log activity event and notify other party
            // ================================================================
            await recordClauseEvent(
                'draft_modified',
                selectedClause.clauseId,
                `Draft updated for ${selectedClause.clauseName}`,
                {
                    clause_name: selectedClause.clauseName,
                    clause_number: selectedClause.clauseNumber,
                    previous_position: selectedClause.clarencePosition,
                    draft_length: editingDraftText.length
                }
            )

            // Add confirmation message to chat
            const confirmMessage: ChatMessage = {
                id: `draft-saved-${Date.now()}`,
                role: 'assistant',
                content: `✅ Draft saved for "${selectedClause.clauseName}".\n\nThis modified text will be used when generating the final contract document.\n\n📬 The other party has been notified of this update in their Activity Feed.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

        } catch (err) {
            console.error('Save draft error:', err)
            const errorMessage: ChatMessage = {
                id: `draft-error-${Date.now()}`,
                role: 'assistant',
                content: `❌ Failed to save draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setSavingDraft(false)
        }
    }

    // ========================================================================
    // SECTION 4C-2B: GENERATE DRAFT FOR SPECIFIC POSITION
    // Called when user changes position and accepts offer to regenerate draft
    // ========================================================================
    const handleGenerateDraftForPosition = async (targetPosition: number) => {
        if (!selectedClause || !userInfo || generatingPositionDraft) return

        const currentText = selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || ''
        if (!currentText.trim()) return

        setGeneratingPositionDraft(true)
        setShowDraftOfferPrompt(false)

        // Add a chat message showing the request
        const requestMessage: ChatMessage = {
            id: `position-draft-request-${Date.now()}`,
            role: 'user',
            content: `Redraft "${selectedClause.clauseName}" to reflect position ${targetPosition.toFixed(1)}`,
            timestamp: new Date()
        }
        setChatMessages(prev => [...prev, requestMessage])

        // Build direction hint based on target position
        let directionHint = ''
        if (targetPosition <= 3) {
            directionHint = `Target position is ${targetPosition.toFixed(1)} (provider-favoring). Draft language that gives the provider more flexibility, shorter timelines, lower liability caps, and fewer obligations.`
        } else if (targetPosition >= 7) {
            directionHint = `Target position is ${targetPosition.toFixed(1)} (customer-favoring). Draft language that protects the customer with stronger warranties, longer timelines, higher liability, and more provider obligations.`
        } else {
            directionHint = `Target position is ${targetPosition.toFixed(1)} (balanced). Draft language that balances both parties' interests with industry-standard terms and mutual obligations.`
        }

        // Truncate very long clause text for the prompt
        const textForPrompt = currentText.length > 3000
            ? currentText.substring(0, 3000) + '\n... [truncated]'
            : currentText

        try {
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `TASK: Rewrite the following clause to reflect position ${targetPosition.toFixed(1)} on a 1-10 scale where 1 is maximum provider flexibility and 10 is maximum customer protection.

CLAUSE: "${selectedClause.clauseName}" (${selectedClause.clauseNumber})
CATEGORY: ${selectedClause.category}
TARGET POSITION: ${targetPosition.toFixed(1)}
CURRENT CLARENCE ASSESSMENT: ${selectedClause.clarencePosition?.toFixed(1) || 'Unknown'}

${directionHint}

CURRENT CLAUSE TEXT:
${textForPrompt}

INSTRUCTIONS:
- Return ONLY the rewritten clause text, no preamble or explanation
- Maintain the same legal structure and clause numbering
- Keep the same subject matter and intent
- Adjust the balance of rights and obligations to match position ${targetPosition.toFixed(1)}
- Use clear, professional legal language
- Do not add new topics or remove existing coverage areas
- Preserve any specific values, dates, or defined terms from the original`,
                    contractId: contractId,
                    clauseId: selectedClause.clauseId,
                    clauseName: selectedClause.clauseName,
                    clauseCategory: selectedClause.category,
                    context: 'position_draft_generation'
                })
            })

            if (response.ok) {
                const data = await response.json()
                const newDraftText = (data.response || data.message || '').trim()

                if (newDraftText && newDraftText.length > 20) {
                    // Put the new draft into the editor for review
                    setEditingDraftText(newDraftText)
                    setIsDraftEditing(true)

                    // Chat confirmation with guidance
                    const confirmMessage: ChatMessage = {
                        id: `position-draft-result-${Date.now()}`,
                        role: 'assistant',
                        content: `I've redrafted "${selectedClause.clauseName}" to reflect your position of ${targetPosition.toFixed(1)}.\n\n` +
                            (targetPosition <= 3
                                ? `This version gives the provider more flexibility with reduced obligations.\n\n`
                                : targetPosition >= 7
                                    ? `This version strengthens customer protections with more provider accountability.\n\n`
                                    : `This version balances both parties' interests.\n\n`) +
                            `The draft is now in the editor. You can:\n` +
                            `• **Save Draft** to keep this version\n` +
                            `• **Edit** the text further before saving\n` +
                            `• **Cancel** to discard`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, confirmMessage])
                } else {
                    const errorMessage: ChatMessage = {
                        id: `position-draft-error-${Date.now()}`,
                        role: 'assistant',
                        content: `I wasn't able to generate a draft for position ${targetPosition.toFixed(1)}. You can edit the draft manually or try again.`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, errorMessage])
                }
            } else {
                const errorMessage: ChatMessage = {
                    id: `position-draft-error-${Date.now()}`,
                    role: 'assistant',
                    content: `I wasn't able to connect to generate the draft. Please try again in a moment.`,
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, errorMessage])
            }
        } catch (err) {
            console.error('Position draft generation error:', err)
            const errorMessage: ChatMessage = {
                id: `position-draft-error-${Date.now()}`,
                role: 'assistant',
                content: `An error occurred while generating the draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setGeneratingPositionDraft(false)
            setPendingDraftPosition(null)
        }
    }

    // Reset draft to original
    const handleResetDraft = async () => {
        if (!selectedClause) return

        setSavingDraft(true)
        try {
            const { error: updateError } = await supabase
                .from('uploaded_contract_clauses')
                .update({
                    draft_text: null,
                    draft_modified_at: null,
                    draft_modified_by: null
                })
                .eq('clause_id', selectedClause.clauseId)

            if (updateError) throw updateError

            // Update local state
            setClauses(prev => prev.map(c =>
                c.clauseId === selectedClause.clauseId
                    ? { ...c, draftText: null, draftModified: false }
                    : c
            ))

            // Add confirmation message
            const confirmMessage: ChatMessage = {
                id: `draft-reset-${Date.now()}`,
                role: 'assistant',
                content: `\u21A9\uFE0F Draft reset to original document text for "${selectedClause.clauseName}".`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

        } catch (err) {
            console.error('Reset draft error:', err)
        } finally {
            setSavingDraft(false)
        }
    }

    // Discuss with CLARENCE - sends clause text to chat for modification suggestions
    const handleDiscussClause = () => {
        if (!selectedClause || chatLoading) return

        // Use the best available text: draft > original > content
        const currentText = selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || ''

        // Build the discussion prompt with full text (up to 2000 chars for very long clauses)
        const textForDiscussion = currentText.length > 2000
            ? currentText.substring(0, 2000) + '...'
            : currentText

        const discussPrompt = `I'd like to discuss modifying this clause:\n\n**${selectedClause.clauseName}** (${selectedClause.clauseNumber})\n\n"${textForDiscussion}"\n\nCan you suggest improvements or alternative wording?`

        // Auto-send the message directly
        sendChatMessage(discussPrompt)
    }

    // --------------------------------------------------------
    // CREATE MORE BALANCED DRAFT
    // Calls CLARENCE to rewrite the clause language toward position 5.0
    // --------------------------------------------------------
    const handleCreateBalancedDraft = async () => {
        if (!selectedClause || !userInfo || generatingBalancedDraft) return

        const currentText = selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || ''
        if (!currentText.trim()) return

        setGeneratingBalancedDraft(true)

        // Add a chat message showing the request
        const requestMessage: ChatMessage = {
            id: `balance-request-${Date.now()}`,
            role: 'user',
            content: `Create a more balanced draft for "${selectedClause.clauseName}" (${selectedClause.clauseNumber})`,
            timestamp: new Date()
        }
        setChatMessages(prev => [...prev, requestMessage])

        // Build the direction hint based on current position
        // SCALE: 1 = Provider-Favoring, 10 = Customer-Favoring
        const currentPosition = selectedClause.clarencePosition
        let directionHint = ''
        if (currentPosition !== null) {
            if (currentPosition < 4) {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (provider-favoring). To create a more balanced version, strengthen customer protections and introduce more equitable terms. Add reasonable safeguards for the customer without being overly aggressive.`
            } else if (currentPosition > 6) {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (customer-favoring). To create a more balanced version, moderate the customer protections while maintaining reasonable safeguards. Introduce fairer mutual obligations where appropriate.`
            } else {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (near balanced). Fine-tune the language to ensure both parties have equitable obligations and protections. Aim for clearer, more neutral phrasing.`
            }
        }

        // Truncate very long clause text for the prompt
        const textForPrompt = currentText.length > 3000
            ? currentText.substring(0, 3000) + '\n... [truncated]'
            : currentText

        try {
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `TASK: Rewrite the following clause to be more balanced (targeting position 5.0 on a 1-10 scale where 1 is maximum provider flexibility and 10 is maximum customer protection).

CLAUSE: "${selectedClause.clauseName}" (${selectedClause.clauseNumber})
CATEGORY: ${selectedClause.category}
CURRENT POSITION: ${currentPosition !== null ? currentPosition.toFixed(1) : 'Unknown'}
FAIRNESS: ${selectedClause.clarenceFairness || 'Not assessed'}

${directionHint}

CURRENT CLAUSE TEXT:
${textForPrompt}

${selectedClause.clarenceAssessment ? `CLARENCE ASSESSMENT: ${selectedClause.clarenceAssessment}` : ''}

INSTRUCTIONS:
- Return ONLY the rewritten clause text, no preamble or explanation
- Maintain the same legal structure and clause numbering
- Keep the same subject matter and intent
- Adjust the balance of rights and obligations toward a more equitable position
- Use clear, professional legal language
- Do not add new topics or remove existing coverage areas
- Preserve any specific values, dates, or defined terms from the original`,
                    contractId: contractId,
                    clauseId: selectedClause.clauseId,
                    clauseName: selectedClause.clauseName,
                    clauseCategory: selectedClause.category,
                    context: 'balanced_draft_generation'
                })
            })

            if (response.ok) {
                const data = await response.json()
                const balancedText = (data.response || data.message || '').trim()

                if (balancedText && balancedText.length > 20) {
                    // Put the balanced text into the editor for review
                    setEditingDraftText(balancedText)
                    setIsDraftEditing(true)

                    // Chat confirmation with guidance
                    const confirmMessage: ChatMessage = {
                        id: `balance-result-${Date.now()}`,
                        role: 'assistant',
                        content: `I've generated a more balanced version of "${selectedClause.clauseName}".\n\n` +
                            (currentPosition !== null && currentPosition < 4
                                ? `The original was at position ${currentPosition.toFixed(1)} (provider-favoring). I've strengthened the customer safeguards to create a fairer balance.\n\n`
                                : currentPosition !== null && currentPosition > 6
                                    ? `The original was at position ${currentPosition.toFixed(1)} (customer-favoring). I've moderated the terms to be more equitable while maintaining reasonable protections.\n\n`
                                    : `I've refined the language for clearer, more neutral phrasing.\n\n`) +
                            `The draft is now in the editor for your review. You can:\n` +
                            `\u2022 **Save Draft** to keep the balanced version\n` +
                            `\u2022 **Edit** the text further before saving\n` +
                            `\u2022 **Cancel** to discard and keep the original`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, confirmMessage])
                } else {
                    // Response was too short or empty - likely an error
                    const errorMessage: ChatMessage = {
                        id: `balance-error-${Date.now()}`,
                        role: 'assistant',
                        content: `I wasn't able to generate a balanced draft for this clause. You can try using "Discuss with CLARENCE" to get specific suggestions, or edit the text manually.`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, errorMessage])
                }
            } else {
                const errorMessage: ChatMessage = {
                    id: `balance-error-${Date.now()}`,
                    role: 'assistant',
                    content: `I wasn't able to connect to generate the balanced draft. Please try again in a moment.`,
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, errorMessage])
            }
        } catch (err) {
            console.error('Balanced draft generation error:', err)
            const errorMessage: ChatMessage = {
                id: `balance-error-${Date.now()}`,
                role: 'assistant',
                content: `An error occurred while generating the balanced draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setGeneratingBalancedDraft(false)
        }
    }

    // ========================================================================
    // SECTION 4D-3: DELETE CLAUSE HANDLER
    // Works in both Template Mode and Contract Mode
    // ========================================================================

    // Close clause menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (clauseMenuRef.current && !clauseMenuRef.current.contains(event.target as Node)) {
                setClauseMenuOpen(null)
            }
        }
        if (clauseMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [clauseMenuOpen])

    // Open delete confirmation
    const handleDeleteClauseClick = (clause: ContractClause) => {
        setDeleteClauseTarget(clause)
        setShowDeleteConfirm(true)
        setClauseMenuOpen(null)
    }

    // Confirm and execute delete
    const handleConfirmDeleteClause = async () => {
        if (!deleteClauseTarget || !userInfo) return

        setDeletingClause(true)
        try {
            // Delete the clause from uploaded_contract_clauses
            const { error: deleteError } = await supabase
                .from('uploaded_contract_clauses')
                .delete()
                .eq('clause_id', deleteClauseTarget.clauseId)

            if (deleteError) throw deleteError

            // If deleting a parent clause, also delete children
            if (deleteClauseTarget.clauseLevel === 0 || deleteClauseTarget.clauseLevel === 1) {
                const childClauses = clauses.filter(c => c.parentClauseId === deleteClauseTarget.clauseId)
                if (childClauses.length > 0) {
                    await supabase
                        .from('uploaded_contract_clauses')
                        .delete()
                        .in('clause_id', childClauses.map(c => c.clauseId))
                }
            }

            // Update contract clause count
            const newClauseCount = clauses.filter(c =>
                c.clauseId !== deleteClauseTarget.clauseId &&
                c.parentClauseId !== deleteClauseTarget.clauseId
            ).length

            await supabase
                .from('uploaded_contracts')
                .update({
                    clause_count: newClauseCount,
                    updated_at: new Date().toISOString()
                })
                .eq('contract_id', contractId)

            // Update local state
            setClauses(prev => prev.filter(c =>
                c.clauseId !== deleteClauseTarget.clauseId &&
                c.parentClauseId !== deleteClauseTarget.clauseId
            ))

            // Clear selection if deleted clause was selected
            if (selectedClause?.clauseId === deleteClauseTarget.clauseId) {
                setSelectedClauseIndex(null)
            }

            // Remove from agreed sets if present (dual-party tracking)
            setInitiatorAgreedIds(prev => {
                const next = new Set(prev)
                next.delete(deleteClauseTarget.clauseId)
                return next
            })
            setRespondentAgreedIds(prev => {
                const next = new Set(prev)
                next.delete(deleteClauseTarget.clauseId)
                return next
            })
            setQueriedClauseIds(prev => {
                const next = new Set(prev)
                next.delete(deleteClauseTarget.clauseId)
                return next
            })

            // Add confirmation message to chat
            const confirmMessage: ChatMessage = {
                id: `clause-deleted-${Date.now()}`,
                role: 'assistant',
                content: `ðŸ—‘ï¸ Clause "${deleteClauseTarget.clauseName}" (${deleteClauseTarget.clauseNumber}) has been removed from the ${isTemplateMode ? 'template' : 'contract'}.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

            // Log system event
            await supabase.from('system_events').insert({
                event_type: 'clause_deleted',
                source_system: 'quick_contract_studio',
                context: {
                    contract_id: contractId,
                    clause_id: deleteClauseTarget.clauseId,
                    clause_name: deleteClauseTarget.clauseName,
                    clause_number: deleteClauseTarget.clauseNumber,
                    user_id: userInfo.userId,
                    is_template_mode: isTemplateMode
                }
            })

        } catch (err) {
            console.error('Delete clause error:', err)
            setError('Failed to delete clause. Please try again.')
        } finally {
            setDeletingClause(false)
            setShowDeleteConfirm(false)
            setDeleteClauseTarget(null)
        }
    }

    // Cancel delete
    const handleCancelDelete = () => {
        setShowDeleteConfirm(false)
        setDeleteClauseTarget(null)
    }

    // ========================================================================
    // SECTION 4E: FILTERED CLAUSES
    // ========================================================================

    const filteredClauses = clauses.filter(c => {
        if (!clauseSearchTerm) return true
        const search = clauseSearchTerm.toLowerCase()
        return (
            c.clauseName.toLowerCase().includes(search) ||
            c.clauseNumber.toLowerCase().includes(search) ||
            c.category.toLowerCase().includes(search)
        )
    })

    // ========================================================================
    // SECTION 4F: HELPER FUNCTIONS
    // ========================================================================

    // Position color: 1=provider (blue) to 10=customer (emerald)
    const getPositionColor = (position: number | null): string => {
        if (position === null) return 'bg-slate-200'
        if (position >= 8) return 'bg-emerald-500'  // Strong customer
        if (position >= 6) return 'bg-teal-500'     // Slight customer
        if (position >= 4) return 'bg-amber-500'    // Balanced
        return 'bg-blue-500'                        // Provider-favoring
    }


    // ========================================================================
    // SECTION 4F-2: REALTIME SUBSCRIPTION FOR ACTIVITY NOTIFICATIONS
    // ========================================================================

    // Subscribe to qc_clause_events for live notification push
    useEffect(() => {
        if (!contractId || !userInfo) return

        const channel = supabase
            .channel(`qc-events-${contractId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'qc_clause_events',
                    filter: `contract_id=eq.${contractId}`
                },
                (payload) => {
                    const e = payload.new as Record<string, unknown>

                    // Don't process events from current user (already in local state)
                    if (e.user_id === userInfo.userId) return

                    const newEvent: ClauseEvent = {
                        eventId: e.event_id as string,
                        contractId: e.contract_id as string,
                        clauseId: (e.clause_id as string) || null,
                        eventType: e.event_type as ClauseEvent['eventType'],
                        userId: e.user_id as string,
                        partyRole: e.party_role as 'initiator' | 'respondent',
                        userName: (e.user_name as string) || 'Unknown',
                        message: (e.message as string) || null,
                        eventData: (e.event_data as Record<string, unknown>) || {},
                        activitySummary: (e.activity_summary as string) || null,
                        readByInitiator: (e.read_by_initiator as boolean) ?? false,
                        readByRespondent: (e.read_by_respondent as boolean) ?? false,
                        createdAt: e.created_at as string
                    }

                    setClauseEvents(prev => [...prev, newEvent])

                    // Increment unread count (this is from the other party)
                    setUnreadActivityCount(prev => prev + 1)

                    // Update agreement/query sets based on event type
                    if (newEvent.clauseId) {
                        if (newEvent.eventType === 'agreed') {
                            if (newEvent.partyRole === 'initiator') {
                                setInitiatorAgreedIds(prev => new Set([...prev, newEvent.clauseId!]))
                            } else {
                                setRespondentAgreedIds(prev => new Set([...prev, newEvent.clauseId!]))
                            }
                        }
                        if (newEvent.eventType === 'agreement_withdrawn') {
                            if (newEvent.partyRole === 'initiator') {
                                setInitiatorAgreedIds(prev => {
                                    const next = new Set(prev)
                                    next.delete(newEvent.clauseId!)
                                    return next
                                })
                            } else {
                                setRespondentAgreedIds(prev => {
                                    const next = new Set(prev)
                                    next.delete(newEvent.clauseId!)
                                    return next
                                })
                            }
                        }
                        if (newEvent.eventType === 'queried') {
                            setQueriedClauseIds(prev => new Set([...prev, newEvent.clauseId!]))
                        }
                        if (newEvent.eventType === 'query_resolved') {
                            setQueriedClauseIds(prev => {
                                const next = new Set(prev)
                                next.delete(newEvent.clauseId!)
                                return next
                            })
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [contractId, userInfo, supabase])

    // Mark all unread events as read for current user
    const markActivityAsRead = useCallback(async () => {
        if (!contractId || !userInfo || unreadActivityCount === 0) return

        const partyRole = getPartyRole()
        const readColumn = partyRole === 'initiator' ? 'read_by_initiator' : 'read_by_respondent'

        // Update database
        const { error } = await supabase
            .from('qc_clause_events')
            .update({ [readColumn]: true })
            .eq('contract_id', contractId)
            .eq(readColumn, false)

        if (error) {
            console.error('Failed to mark events as read:', error)
            return
        }

        // Update local state
        setClauseEvents(prev => prev.map(e => ({
            ...e,
            ...(partyRole === 'initiator' ? { readByInitiator: true } : { readByRespondent: true })
        })))
        setUnreadActivityCount(0)
    }, [contractId, userInfo, unreadActivityCount, supabase])

    // Auto-mark as read when History tab is active
    useEffect(() => {
        if (activeTab === 'history' && unreadActivityCount > 0) {
            markActivityAsRead()
        }
    }, [activeTab, unreadActivityCount, markActivityAsRead])

    // ========================================================================
    // SECTION 4G: AUTO-SAVE TIMER & LOCALSTORAGE PERSISTENCE
    // ========================================================================

    // Helper: Get the current user's position column name
    const getPositionColumn = useCallback((): 'initiator_position' | 'respondent_position' => {
        const role = getPartyRole()
        return role === 'initiator' ? 'initiator_position' : 'respondent_position'
    }, [contract, userInfo])

    // Helper: Get the display position for the current user
    // Falls back: user's adjusted position â†’ CLARENCE assessment â†’ null
    const getUserDisplayPosition = useCallback((clause: ContractClause): number | null => {
        const role = getPartyRole()
        const userPosition = role === 'initiator' ? clause.initiatorPosition : clause.respondentPosition
        return userPosition ?? clause.clarencePosition ?? null
    }, [contract, userInfo])

    // Auto-save dirty positions every 30 seconds
    useEffect(() => {
        if (dirtyPositions.size === 0) return

        const timer = setTimeout(async () => {
            if (dirtyPositions.size === 0 || !userInfo) return

            setAutoSaveStatus('saving')
            const positionColumn = getPositionColumn()
            const timestampColumn = positionColumn === 'initiator_position'
                ? 'initiator_position_updated_at'
                : 'respondent_position_updated_at'

            try {
                // Batch update all dirty positions
                const updates = Array.from(dirtyPositions.entries())
                let failCount = 0

                for (const [clauseId, position] of updates) {
                    const { error } = await supabase
                        .from('uploaded_contract_clauses')
                        .update({
                            [positionColumn]: position,
                            [timestampColumn]: new Date().toISOString()
                        })
                        .eq('clause_id', clauseId)

                    if (error) {
                        console.error(`Auto-save failed for clause ${clauseId}:`, error)
                        failCount++
                    }
                }

                if (failCount === 0) {
                    // All saved successfully â€” clear dirty state
                    setDirtyPositions(new Map())
                    setAutoSaveStatus('saved')
                    setLastSavedAt(new Date())

                    // Reset status indicator after 3 seconds
                    setTimeout(() => setAutoSaveStatus('idle'), 3000)
                } else {
                    setAutoSaveStatus('error')
                    setTimeout(() => setAutoSaveStatus('idle'), 5000)
                }

            } catch (err) {
                console.error('Auto-save error:', err)
                setAutoSaveStatus('error')
                setTimeout(() => setAutoSaveStatus('idle'), 5000)
            }
        }, 30000) // 30-second debounce

        return () => clearTimeout(timer)
    }, [dirtyPositions, userInfo, getPositionColumn, supabase])

    // Save UI state to LocalStorage when it changes
    useEffect(() => {
        if (!contractId) return
        if (selectedClauseIndex !== null) {
            localStorage.setItem(`qc_studio_${contractId}_selectedClause`, String(selectedClauseIndex))
        }
    }, [selectedClauseIndex, contractId])

    useEffect(() => {
        if (!contractId) return
        localStorage.setItem(`qc_studio_${contractId}_activeTab`, activeTab)
    }, [activeTab, contractId])

    useEffect(() => {
        if (!contractId) return
        localStorage.setItem(`qc_studio_${contractId}_expandedSections`, JSON.stringify([...expandedSections]))
    }, [expandedSections, contractId])

    // Save dirty positions immediately when user navigates away
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (dirtyPositions.size > 0) {
                e.preventDefault()
                e.returnValue = 'You have unsaved position changes. Are you sure you want to leave?'
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [dirtyPositions])

    // Handler for position slider changes (called from render section)
    const handlePositionChange = useCallback((clauseId: string, newPosition: number) => {
        const role = getPartyRole()
        const clause = clauses.find(c => c.clauseId === clauseId)

        // Update local state immediately (responsive UI)
        setClauses(prev => prev.map(c =>
            c.clauseId === clauseId
                ? {
                    ...c,
                    ...(role === 'initiator'
                        ? { initiatorPosition: newPosition }
                        : { respondentPosition: newPosition }
                    )
                }
                : c
        ))

        // Mark as dirty for auto-save
        setDirtyPositions(prev => {
            const next = new Map(prev)
            next.set(clauseId, newPosition)
            return next
        })

        // Reset save indicator to show unsaved state
        setAutoSaveStatus('idle')

        // ================================================================
        // Check if position differs significantly from CLARENCE's
        // assessment and offer to regenerate draft
        // ================================================================
        if (clause && clause.clarencePosition !== null) {
            const positionDelta = Math.abs(newPosition - clause.clarencePosition)

            // If user moved position by more than 1 point from CLARENCE's assessment,
            // offer to regenerate the draft to match their new position
            if (positionDelta >= 1.0) {
                setPendingDraftPosition(newPosition)
                setShowDraftOfferPrompt(true)
            }
        }
    }, [clauses, getPartyRole])

    // Force-save all dirty positions now (for manual "Save" or before commit)
    const forceSavePositions = useCallback(async () => {
        if (dirtyPositions.size === 0 || !userInfo) return true

        setAutoSaveStatus('saving')
        const positionColumn = getPositionColumn()
        const timestampColumn = positionColumn === 'initiator_position'
            ? 'initiator_position_updated_at'
            : 'respondent_position_updated_at'

        try {
            for (const [clauseId, position] of dirtyPositions.entries()) {
                const { error } = await supabase
                    .from('uploaded_contract_clauses')
                    .update({
                        [positionColumn]: position,
                        [timestampColumn]: new Date().toISOString()
                    })
                    .eq('clause_id', clauseId)

                if (error) throw error
            }

            setDirtyPositions(new Map())
            setAutoSaveStatus('saved')
            setLastSavedAt(new Date())
            setTimeout(() => setAutoSaveStatus('idle'), 3000)
            return true
        } catch (err) {
            console.error('Force save error:', err)
            setAutoSaveStatus('error')
            return false
        }
    }, [dirtyPositions, userInfo, getPositionColumn, supabase])



    // ========================================================================
    // SECTION 5A: PROGRESSIVE LOADING - POLL FOR CLAUSE STATUS UPDATES
    // (Placed before early returns to comply with React hooks rules)
    // ========================================================================

    useEffect(() => {
        if (!contractId || !clauses.length) return

        // Check if there are any uncertified non-header clauses
        const uncertified = clauses.filter(c =>
            !c.isHeader && c.processingStatus !== 'certified' && c.processingStatus !== 'failed'
        )

        if (uncertified.length === 0) {
            setIsPolling(false)
            return
        }

        setIsPolling(true)

        const pollInterval = setInterval(async () => {
            try {
                const { data: updatedClauses, error } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('clause_id, status, is_header, clarence_certified, clarence_position, clarence_fairness, clarence_summary, clarence_assessment, clarence_flags, content, original_text, extracted_value, extracted_unit, value_type')
                    .eq('contract_id', contractId)
                    .order('display_order', { ascending: true })

                if (error || !updatedClauses) return

                // Update clause statuses without replacing entire array (preserves selection)
                setClauses(prev => prev.map(clause => {
                    const updated = updatedClauses.find(u => u.clause_id === clause.clauseId)
                    if (!updated) return clause

                    return {
                        ...clause,
                        processingStatus: updated.status || clause.processingStatus,
                        isHeader: updated.is_header || false,
                        clarenceCertified: updated.clarence_certified || false,
                        clarencePosition: updated.clarence_position,
                        clarenceFairness: updated.clarence_fairness,
                        clarenceSummary: updated.clarence_summary,
                        clarenceAssessment: updated.clarence_assessment,
                        clarenceFlags: updated.clarence_flags || [],
                        clauseText: updated.content || clause.clauseText,
                        originalText: updated.original_text || clause.originalText,
                        extractedValue: updated.extracted_value,
                        extractedUnit: updated.extracted_unit,
                        valueType: updated.value_type,
                    }
                }))

                // Update progress
                const certified = updatedClauses.filter(c => c.status === 'certified' && !c.is_header).length
                const total = updatedClauses.filter(c => !c.is_header).length
                const failed = updatedClauses.filter(c => c.status === 'failed' && !c.is_header).length
                setCertificationProgress({ certified, total, failed })

                // Stop polling when done
                const stillProcessing = updatedClauses.some(c =>
                    !c.is_header && (c.status === 'pending' || c.status === 'processing')
                )
                if (!stillProcessing) {
                    setIsPolling(false)
                    clearInterval(pollInterval)
                }

            } catch (err) {
                console.error('Polling error:', err)
            }
        }, 4000) // Poll every 4 seconds

        return () => clearInterval(pollInterval)
    }, [contractId, clauses.length, isPolling])

    // ========================================================================
    // SECTION 5: LOADING STATE
    // ========================================================================

    if (loading) {
        return <QuickContractStudioLoading />
    }


    // ========================================================================
    // SECTION 6: ERROR STATE
    // ========================================================================

    if (error) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Contract</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/auth/quick-contract')}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Back to Quick Contract
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: MAIN LAYOUT RENDER
    // ========================================================================

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">

            {/* ============================================================ */}
            {/* SECTION 7A: HEADER */}
            {/* ============================================================ */}
            <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Left: Logo & Contract Info */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-md">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <h1 className="font-semibold text-slate-800">Quick Contract Studio</h1>
                                <p className="text-xs text-slate-500">
                                    {isTemplateMode
                                        ? (isCompanyTemplate ? 'Company Template Certification' : 'Template Certification')
                                        : 'CLARENCE Certified Review'}
                                </p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-medium text-slate-700 truncate" title={contract?.contractName}>
                                {contract?.contractName}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {contract?.contractType} &middot; {clauses.filter(c => !c.isHeader).length} clauses &middot; {getFullyAgreedCount()} fully agreed
                            </p>
                        </div>

                        {/* Agreement Progress Indicator (non-template mode) */}
                        {!isTemplateMode && clauses.length > 0 && (() => {
                            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                            const fullyAgreedCount = leafClauses.filter(c => isBothPartiesAgreed(c.clauseId)).length
                            const partiallyAgreedCount = leafClauses.filter(c => isAnyPartyAgreed(c.clauseId) && !isBothPartiesAgreed(c.clauseId)).length
                            const totalCount = leafClauses.length
                            const allFullyAgreed = fullyAgreedCount === totalCount && totalCount > 0
                            const progressPercent = totalCount > 0 ? (fullyAgreedCount / totalCount) * 100 : 0
                            const partialPercent = totalCount > 0 ? ((fullyAgreedCount + partiallyAgreedCount) / totalCount) * 100 : 0

                            return (
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="w-40">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className={allFullyAgreed ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                                                {fullyAgreedCount}/{totalCount} agreed
                                                {partiallyAgreedCount > 0 && <span className="text-amber-500 ml-1">({partiallyAgreedCount} pending)</span>}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
                                            {/* Partial agreement (amber background) */}
                                            <div
                                                className="absolute h-full rounded-full bg-amber-300 transition-all duration-500"
                                                style={{ width: `${partialPercent}%` }}
                                            />
                                            {/* Full agreement (green foreground) */}
                                            <div
                                                className={`absolute h-full rounded-full transition-all duration-500 ${allFullyAgreed ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                    {/* Right: Actions */}
                    <div className="flex items-center gap-4">

                        {/* Beta Feedback Button */}
                        <div className="pl-4 border-l border-slate-200">
                            <FeedbackButton position="header" />
                        </div>

                        {/* Party Chat Toggle (non-template mode only) */}
                        {!isTemplateMode && (
                            <button
                                onClick={() => setPartyChatOpen(!partyChatOpen)}
                                className="relative p-2 hover:bg-slate-100 rounded-lg transition group"
                                title={`Chat with ${getOtherPartyName()}`}
                            >
                                <svg
                                    className="w-5 h-5 text-slate-500 group-hover:text-emerald-600 transition"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                </svg>
                                {partyChatUnread > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {partyChatUnread > 9 ? '9+' : partyChatUnread}
                                    </span>
                                )}
                            </button>
                        )}

                        <button
                            onClick={() => router.push(
                                isTemplateMode
                                    ? (isCompanyTemplate ? '/auth/company-admin' : '/auth/contracts')
                                    : '/auth/quick-contract'
                            )}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                        >
                            &larr; Back
                        </button>

                        {isTemplateMode ? (
                            /* ---- TEMPLATE MODE: Save as Template ---- */
                            <button
                                onClick={() => {
                                    setTemplateName(contract?.contractName || '')
                                    setShowSaveTemplateModal(true)
                                }}
                                disabled={clauses.filter(c => !c.isHeader && !c.clarenceCertified).length > 0}
                                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Save as Template
                            </button>
                        ) : (
                            /* ---- NORMAL MODE: Commit Contract ---- */
                            (() => {
                                const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                                const allFullyAgreed = leafClauses.length > 0 && leafClauses.every(c => isBothPartiesAgreed(c.clauseId))
                                const currentUserFullyAgreed = leafClauses.length > 0 && leafClauses.every(c => hasCurrentUserAgreed(c.clauseId))
                                const otherPartyFullyAgreed = leafClauses.length > 0 && leafClauses.every(c => hasOtherPartyAgreed(c.clauseId))

                                // Button state based on agreement status
                                let buttonClass = 'bg-amber-600 hover:bg-amber-700' // Default: not all agreed
                                let buttonText = 'Commit Contract'
                                let buttonIcon = (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                )

                                if (allFullyAgreed) {
                                    buttonClass = 'bg-emerald-600 hover:bg-emerald-700'
                                    buttonText = 'Both Agreed - Commit'
                                } else if (currentUserFullyAgreed) {
                                    buttonClass = 'bg-sky-600 hover:bg-sky-700'
                                    buttonText = `Awaiting ${getOtherPartyName()}`
                                    buttonIcon = (
                                        <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )
                                }

                                return (
                                    <button
                                        onClick={() => setCommitModalState('confirm')}
                                        disabled={leafClauses.length === 0 || currentUserFullyAgreed}
                                        className={`px-5 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${buttonClass} disabled:bg-slate-300 disabled:cursor-not-allowed`}
                                        title={currentUserFullyAgreed && !allFullyAgreed ? `You've committed. Waiting for ${getOtherPartyName()} to commit.` : ''}
                                    >
                                        {buttonIcon}
                                        {buttonText}
                                    </button>
                                )
                            })()
                        )}
                    </div>
                </div>
            </header>


            {/* ============================================================ */}
            {/* SECTION 7B: 3-PANEL LAYOUT */}
            {/* ============================================================ */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* ======================================================== */}
                {/* LEFT PANEL: Clause Navigation */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden min-h-0">

                    {/* ==================== CERTIFICATION PROGRESS ==================== */}
                    {isPolling && (
                        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-emerald-50 flex-shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-teal-700">
                                    Certifying clauses...
                                </span>
                                <span className="text-xs text-teal-600">
                                    {certificationProgress.certified}/{certificationProgress.total}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-teal-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-teal-500 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${certificationProgress.total > 0
                                            ? (certificationProgress.certified / certificationProgress.total) * 100
                                            : 0}%`
                                    }}
                                />
                            </div>
                            {certificationProgress.failed > 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    {certificationProgress.failed} clause(s) failed certification
                                </p>
                            )}
                        </div>
                    )}

                    {/* ==================== CLAUSE TREE ==================== */}
                    <div ref={clauseListRef} className="flex-1 overflow-y-auto">
                        {(() => {
                            // Build parent-child tree
                            const parentMap = new Map<string, ContractClause[]>()
                            const topLevel: ContractClause[] = []

                            filteredClauses.forEach(clause => {
                                if (clause.parentClauseId) {
                                    const siblings = parentMap.get(clause.parentClauseId) || []
                                    siblings.push(clause)
                                    parentMap.set(clause.parentClauseId, siblings)
                                } else {
                                    topLevel.push(clause)
                                }
                            })

                            // Status icon helper
                            const StatusIcon = ({ status }: { status: string }) => {
                                switch (status) {
                                    case 'certified':
                                        return <span className="text-emerald-500 text-xs">{'\u2705'}</span>
                                    case 'processing':
                                        return (
                                            <span className="inline-block w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                        )
                                    case 'failed':
                                        return <span className="text-red-500 text-xs">{'\u26A0\uFE0F'}</span>
                                    default: // pending
                                        return <span className="text-slate-300 text-xs">{'\u{1F552}'}</span>
                                }
                            }

                            return topLevel.map(parent => {
                                const children = parentMap.get(parent.clauseId) || []
                                const isSection = children.length > 0  // Has children = section header
                                const isExpanded = expandedSections.has(parent.clauseId)

                                if (isSection) {
                                    // ---- SECTION HEADER (collapsible) ----
                                    const certifiedChildren = children.filter(c => c.processingStatus === 'certified').length
                                    const processingChild = children.find(c => c.processingStatus === 'processing')

                                    return (
                                        <div key={parent.clauseId}>
                                            {/* Section Header */}
                                            <button
                                                onClick={() => {
                                                    setExpandedSections(prev => {
                                                        const next = new Set(prev)
                                                        if (next.has(parent.clauseId)) {
                                                            next.delete(parent.clauseId)
                                                        } else {
                                                            next.add(parent.clauseId)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                                            >
                                                <svg
                                                    className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    fill="currentColor" viewBox="0 0 20 20"
                                                >
                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1 truncate">
                                                    {parent.clauseNumber}. {parent.clauseName}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {certifiedChildren}/{children.length}
                                                </span>
                                                {processingChild && (
                                                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                                                )}
                                            </button>

                                            {/* Children */}
                                            {isExpanded && children.map(child => {
                                                const isClickable = child.processingStatus === 'certified' || child.processingStatus === 'failed'
                                                const isSelected = selectedClause?.clauseId === child.clauseId
                                                const isMenuOpen = clauseMenuOpen === child.clauseId

                                                return (
                                                    <div key={child.clauseId} className="relative group">
                                                        <button
                                                            onClick={() => isClickable && setSelectedClauseIndex(clauses.findIndex(c => c.clauseId === child.clauseId))}
                                                            disabled={!isClickable}
                                                            className={`w-full flex items-center gap-2 pl-8 pr-8 py-2 text-left transition-colors ${isSelected
                                                                ? 'bg-teal-50 border-l-2 border-teal-500'
                                                                : isClickable
                                                                    ? 'hover:bg-slate-50 border-l-2 border-transparent'
                                                                    : 'opacity-50 cursor-not-allowed border-l-2 border-transparent'
                                                                }`}
                                                        >
                                                            <StatusIcon status={child.processingStatus} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : 'text-slate-500'
                                                                        }`}>
                                                                        {child.clauseNumber}
                                                                    </span>
                                                                    <span className={`text-sm truncate ${isSelected ? 'text-teal-800 font-medium' : 'text-slate-700'
                                                                        }`}>
                                                                        {child.clauseName}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {child.clarenceCertified && child.clarencePosition && (
                                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${child.clarencePosition >= 7 ? 'bg-emerald-100 text-emerald-700' :
                                                                    child.clarencePosition >= 4 ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                    {child.clarencePosition.toFixed(1)}
                                                                </span>
                                                            )}
                                                            {/* Agreement/Query status indicator - Dual party tracking */}
                                                            {(() => {
                                                                const status = getAgreementStatus(child.clauseId)
                                                                if (status === 'both') {
                                                                    return (
                                                                        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Both parties agreed">
                                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        </span>
                                                                    )
                                                                }
                                                                if (status === 'you_only') {
                                                                    return (
                                                                        <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0" title={`You agreed - awaiting ${getOtherPartyName()}`}>
                                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        </span>
                                                                    )
                                                                }
                                                                if (status === 'other_only') {
                                                                    return (
                                                                        <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title={`${getOtherPartyName()} agreed - awaiting you`}>
                                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                                                            </svg>
                                                                        </span>
                                                                    )
                                                                }
                                                                return null
                                                            })()}
                                                            {queriedClauseIds.has(child.clauseId) && (
                                                                <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Query pending">
                                                                    <span className="text-white text-[9px] font-bold">?</span>
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/* 3-dot kebab menu */}
                                                        <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setClauseMenuOpen(isMenuOpen ? null : child.clauseId)
                                                                }}
                                                                className={`p-1 rounded hover:bg-slate-200 transition-colors ${isMenuOpen ? 'bg-slate-200' : 'opacity-0 group-hover:opacity-100'}`}
                                                                title="Clause options"
                                                            >
                                                                <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                                </svg>
                                                            </button>

                                                            {/* Dropdown menu */}
                                                            {isMenuOpen && (
                                                                <div
                                                                    ref={clauseMenuRef}
                                                                    className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
                                                                >
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleDeleteClauseClick(child)
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                        Delete Clause
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                } else {
                                    // ---- STANDALONE CLAUSE (no children) ----
                                    const isClickable = parent.processingStatus === 'certified' || parent.processingStatus === 'failed'
                                    const isSelected = selectedClause?.clauseId === parent.clauseId
                                    const isMenuOpen = clauseMenuOpen === parent.clauseId

                                    return (
                                        <div key={parent.clauseId} className="relative group">
                                            <button
                                                onClick={() => isClickable && setSelectedClauseIndex(clauses.findIndex(c => c.clauseId === parent.clauseId))}
                                                disabled={!isClickable}
                                                className={`w-full flex items-center gap-2 px-3 pr-8 py-2 text-left transition-colors ${isSelected
                                                    ? 'bg-teal-50 border-l-2 border-teal-500'
                                                    : isClickable
                                                        ? 'hover:bg-slate-50 border-l-2 border-transparent'
                                                        : 'opacity-50 cursor-not-allowed border-l-2 border-transparent'
                                                    }`}
                                            >
                                                <StatusIcon status={parent.processingStatus} />
                                                <div className="flex-1 min-w-0">
                                                    <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : 'text-slate-500'}`}>
                                                        {parent.clauseNumber}.
                                                    </span>
                                                    {' '}
                                                    <span className={`text-sm truncate ${isSelected ? 'text-teal-800 font-medium' : 'text-slate-700'}`}>
                                                        {parent.clauseName}
                                                    </span>
                                                </div>
                                                {parent.clarenceCertified && parent.clarencePosition && (
                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${parent.clarencePosition >= 7 ? 'bg-emerald-100 text-emerald-700' :
                                                        parent.clarencePosition >= 4 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {parent.clarencePosition.toFixed(1)}
                                                    </span>
                                                )}
                                                {/* Agreement/Query status indicator - Dual party tracking */}
                                                {(() => {
                                                    const status = getAgreementStatus(parent.clauseId)
                                                    if (status === 'both') {
                                                        return (
                                                            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Both parties agreed">
                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </span>
                                                        )
                                                    }
                                                    if (status === 'you_only') {
                                                        return (
                                                            <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0" title={`You agreed - awaiting ${getOtherPartyName()}`}>
                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </span>
                                                        )
                                                    }
                                                    if (status === 'other_only') {
                                                        return (
                                                            <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title={`${getOtherPartyName()} agreed - awaiting you`}>
                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                                                </svg>
                                                            </span>
                                                        )
                                                    }
                                                    return null
                                                })()}
                                                {queriedClauseIds.has(parent.clauseId) && (
                                                    <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Query pending">
                                                        <span className="text-white text-[9px] font-bold">?</span>
                                                    </span>
                                                )}
                                            </button>

                                            {/* 3-dot kebab menu */}
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setClauseMenuOpen(isMenuOpen ? null : parent.clauseId)
                                                    }}
                                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${isMenuOpen ? 'bg-slate-200' : 'opacity-0 group-hover:opacity-100'}`}
                                                    title="Clause options"
                                                >
                                                    <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                    </svg>
                                                </button>

                                                {/* Dropdown menu */}
                                                {isMenuOpen && (
                                                    <div
                                                        ref={clauseMenuRef}
                                                        className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDeleteClauseClick(parent)
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Delete Clause
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }
                            })
                        })()}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* CENTER PANEL: Main Workspace */}
                {/* ======================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {selectedClause ? (
                        <>
                            {/* Clause Header */}
                            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                {selectedClause.clauseNumber}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(selectedClause.category)}`}>
                                                {selectedClause.category}
                                            </span>
                                            {selectedClause.clarenceCertified && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                    Certified
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-semibold text-slate-800">{selectedClause.clauseName}</h2>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                        {(['overview', 'history', 'tradeoffs', 'draft'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`relative px-3 py-1.5 text-sm rounded-md transition ${activeTab === tab
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab === 'history' ? 'Activity' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                {tab === 'history' && unreadActivityCount > 0 && activeTab !== 'history' && (
                                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm animate-pulse">
                                                        {unreadActivityCount > 99 ? '99+' : unreadActivityCount}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ==================== CLAUSE ACTION BAR ==================== */}
                            {!isTemplateMode && selectedClause.clarenceCertified && (
                                <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex items-center justify-between">
                                        {/* Left: Agreement status - Dual party tracking */}
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const status = getAgreementStatus(selectedClause.clauseId)
                                                const otherPartyName = getOtherPartyName()

                                                // BOTH AGREED - Fully locked
                                                if (status === 'both') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                                </svg>
                                                                Both Parties Agreed
                                                            </span>
                                                            <span className="text-xs text-slate-500">Clause locked</span>
                                                        </div>
                                                    )
                                                }

                                                // YOU AGREED, AWAITING THEM
                                                if (status === 'you_only') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-medium border border-sky-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                You Agreed
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                                                                <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Awaiting {otherPartyName}
                                                            </span>
                                                            <button
                                                                onClick={() => handleWithdrawAgreement(selectedClause.clauseId)}
                                                                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                                                                title="Withdraw agreement"
                                                            >
                                                                Withdraw
                                                            </button>
                                                        </div>
                                                    )
                                                }

                                                // THEY AGREED, AWAITING YOU
                                                if (status === 'other_only') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                {otherPartyName} Agreed
                                                            </span>
                                                            <button
                                                                onClick={() => handleAgreeClause(selectedClause.clauseId)}
                                                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                Agree
                                                            </button>
                                                        </div>
                                                    )
                                                }

                                                // NEITHER AGREED
                                                return (
                                                    <button
                                                        onClick={() => handleAgreeClause(selectedClause.clauseId)}
                                                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Agree
                                                    </button>
                                                )
                                            })()}

                                            {queriedClauseIds.has(selectedClause.clauseId) && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Query Pending
                                                </span>
                                            )}
                                        </div>

                                        {/* Right: Query input */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={queryText}
                                                onChange={(e) => setQueryText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && queryText.trim()) {
                                                        handleQueryClause(selectedClause.clauseId, queryText)
                                                    }
                                                }}
                                                placeholder="Raise a query on this clause..."
                                                className="w-64 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                            />
                                            <button
                                                onClick={() => handleQueryClause(selectedClause.clauseId, queryText)}
                                                disabled={!queryText.trim()}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Query
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Workspace Content */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-0">

                                {/* ==================== OVERVIEW TAB ==================== */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">

                                        {/* CLARENCE Position Bar - THE STAR OF THE SHOW */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-4">CLARENCE Recommended Position</h3>

                                            {/* Position Scale */}
                                            <div className="relative mb-6 pt-6 pb-2">
                                                {/* Scale Background - with extra padding for badge */}
                                                <div className="relative h-4 bg-gradient-to-r from-emerald-200 via-teal-200 via-50% to-blue-200 rounded-full">
                                                    {/* Scale markers */}
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                        <div
                                                            key={n}
                                                            className="absolute top-0 bottom-0 w-px bg-white/50"
                                                            style={{ left: `${((n - 1) / 9) * 100}%` }}
                                                        />
                                                    ))}

                                                    {/* CLARENCE Badge - Only marker shown */}
                                                    {/* POSITION BAR: Left = Provider-Favoring (1), Right = Customer-Favoring (10) */}
                                                    {/* PERSISTENCE: Display user's adjusted position if set, otherwise CLARENCE's */}
                                                    {getUserDisplayPosition(selectedClause) !== null && (
                                                        <div
                                                            className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 border-4 border-white flex items-center justify-center text-lg font-bold text-white z-20 shadow-xl transition-all cursor-grab active:cursor-grabbing hover:scale-110"
                                                            style={{
                                                                left: `${(((getUserDisplayPosition(selectedClause) || 5) - 1) / 9) * 100}%`,
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%)'
                                                            }}
                                                            title={`Position: ${(getUserDisplayPosition(selectedClause) || 5).toFixed(1)} - Drag to adjust`}
                                                            draggable={false}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault()
                                                                const bar = e.currentTarget.parentElement
                                                                if (!bar) return

                                                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                                                    const rect = bar.getBoundingClientRect()
                                                                    const x = moveEvent.clientX - rect.left
                                                                    const percent = Math.max(0, Math.min(1, x / rect.width))
                                                                    const newPosition = 1 + (percent * 9)
                                                                    const roundedPosition = Math.round(newPosition * 2) / 2 // Round to nearest 0.5

                                                                    // PERSISTENCE: Update party position (not clarencePosition)
                                                                    const role = getPartyRole()
                                                                    setClauses(prev => prev.map(c =>
                                                                        c.clauseId === selectedClause.clauseId
                                                                            ? {
                                                                                ...c,
                                                                                ...(role === 'initiator'
                                                                                    ? { initiatorPosition: roundedPosition }
                                                                                    : { respondentPosition: roundedPosition }
                                                                                )
                                                                            }
                                                                            : c
                                                                    ))
                                                                }

                                                                const handleMouseUp = (upEvent: MouseEvent) => {
                                                                    document.removeEventListener('mousemove', handleMouseMove)
                                                                    document.removeEventListener('mouseup', handleMouseUp)

                                                                    // PERSISTENCE: Calculate final position and mark dirty for auto-save
                                                                    const rect = bar.getBoundingClientRect()
                                                                    const x = upEvent.clientX - rect.left
                                                                    const percent = Math.max(0, Math.min(1, x / rect.width))
                                                                    const finalPosition = Math.round((1 + (percent * 9)) * 2) / 2

                                                                    handlePositionChange(selectedClause.clauseId, finalPosition)
                                                                }

                                                                document.addEventListener('mousemove', handleMouseMove)
                                                                document.addEventListener('mouseup', handleMouseUp)
                                                            }}
                                                        >
                                                            C
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Scale Labels - Provider on LEFT (1), Customer on RIGHT (10) */}
                                                <div className="flex justify-between mt-4 text-xs text-slate-500">
                                                    <span>Provider-Favoring</span>
                                                    <span>Balanced</span>
                                                    <span>Customer-Favoring</span>
                                                </div>
                                            </div>

                                            {/* Position Details */}
                                            <div className="flex items-center gap-6">
                                                <div className="flex-1 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
                                                            <span className="text-white text-xl font-bold">C</span>
                                                        </div>
                                                        <div>
                                                            <div className="text-3xl font-bold text-purple-700">
                                                                {selectedClause.clarencePosition?.toFixed(1) ?? '\u2014'}
                                                            </div>
                                                            <div className="text-sm text-purple-600">
                                                                {getPositionLabel(selectedClause.clarencePosition)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {selectedClause.clarenceFairness && (
                                                    <div className={`px-4 py-3 rounded-lg ${selectedClause.clarenceFairness === 'balanced'
                                                        ? 'bg-emerald-50 border border-emerald-200'
                                                        : 'bg-amber-50 border border-amber-200'
                                                        }`}>
                                                        <div className={`text-sm font-medium ${selectedClause.clarenceFairness === 'balanced'
                                                            ? 'text-emerald-700'
                                                            : 'text-amber-700'
                                                            }`}>
                                                            {selectedClause.clarenceFairness === 'balanced' ? '\u2714 Balanced' : '\u26A0 Review Recommended'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">Fairness Assessment</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Document Value & Range Comparison */}
                                        {(selectedClause.extractedValue || selectedClause.documentPosition) && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-5">
                                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Document Analysis</h3>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* What the Document Says */}
                                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Your Document Says</div>
                                                        {selectedClause.extractedValue ? (
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-bold text-slate-800">
                                                                    {selectedClause.valueType === 'currency' && selectedClause.extractedUnit === '\u00A3' && '\u00A3'}
                                                                    {selectedClause.valueType === 'currency' && selectedClause.extractedUnit === '$' && '$'}
                                                                    {selectedClause.extractedValue}
                                                                </span>
                                                                <span className="text-sm text-slate-600">
                                                                    {selectedClause.extractedUnit && !['\u00A3', '$'].includes(selectedClause.extractedUnit) && selectedClause.extractedUnit}
                                                                    {selectedClause.valueType === 'percentage' && '%'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-lg font-medium text-slate-600">
                                                                Position {selectedClause.documentPosition?.toFixed(1)}
                                                            </div>
                                                        )}
                                                        {selectedClause.documentPosition && (
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <div className={`w-3 h-3 rounded-full ${selectedClause.documentPosition <= 3 ? 'bg-emerald-500' :
                                                                    selectedClause.documentPosition <= 5 ? 'bg-teal-500' :
                                                                        selectedClause.documentPosition <= 7 ? 'bg-blue-500' :
                                                                            'bg-indigo-500'
                                                                    }`}></div>
                                                                <span className="text-xs text-slate-500">
                                                                    {getPositionLabel(selectedClause.documentPosition)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Typical Industry Range */}
                                                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                                        <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-2">Industry Standard</div>
                                                        <div className="text-lg font-semibold text-purple-800">
                                                            {getTypicalRange(selectedClause.category, selectedClause.valueType, selectedClause.extractedUnit)}
                                                        </div>
                                                        <div className="mt-2 text-xs text-purple-600">
                                                            Based on {selectedClause.category} best practices
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Comparison Indicator */}
                                                {selectedClause.documentPosition !== null && selectedClause.clarencePosition !== null && (
                                                    <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${Math.abs(selectedClause.documentPosition - selectedClause.clarencePosition) < 0.5
                                                        ? 'bg-emerald-50 border border-emerald-200'
                                                        : selectedClause.documentPosition > selectedClause.clarencePosition
                                                            ? 'bg-amber-50 border border-amber-200'
                                                            : 'bg-blue-50 border border-blue-200'
                                                        }`}>
                                                        {Math.abs(selectedClause.documentPosition - selectedClause.clarencePosition) < 0.5 ? (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-emerald-800">Well Aligned</div>
                                                                    <div className="text-xs text-emerald-600">Document terms match industry standards</div>
                                                                </div>
                                                            </>
                                                        ) : selectedClause.documentPosition > selectedClause.clarencePosition ? (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-amber-800">Provider-Favoring</div>
                                                                    <div className="text-xs text-amber-600">Terms are more favorable to the provider than typical</div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-blue-800">Customer-Protective</div>
                                                                    <div className="text-xs text-blue-600">Terms are more favorable to you than typical</div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* CLARENCE Analysis */}
                                        {(selectedClause.clarenceSummary || selectedClause.clarenceAssessment) && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-5">
                                                <h3 className="text-sm font-semibold text-slate-700 mb-3">CLARENCE Analysis</h3>

                                                {selectedClause.clarenceSummary && (
                                                    <div className="mb-4">
                                                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Summary</h4>
                                                        <p className="text-slate-700 leading-relaxed">{selectedClause.clarenceSummary}</p>
                                                    </div>
                                                )}

                                                {selectedClause.clarenceAssessment && (
                                                    <div>
                                                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Assessment</h4>
                                                        <p className="text-slate-700 leading-relaxed">{selectedClause.clarenceAssessment}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Attention Points */}
                                        {selectedClause.clarenceFlags && selectedClause.clarenceFlags.length > 0 && !selectedClause.clarenceFlags.includes('none') && (
                                            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                                                <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    Attention Points
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedClause.clarenceFlags.filter(f => f !== 'none').map((flag, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded-full"
                                                        >
                                                            {flag.replace(/_/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* View Clause Text Toggle */}
                                        <div className="bg-white rounded-xl border border-slate-200">
                                            <button
                                                onClick={() => setShowClauseText(!showClauseText)}
                                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
                                            >
                                                <span className="text-sm font-medium text-slate-700">View Full Clause Text</span>
                                                <svg
                                                    className={`w-5 h-5 text-slate-400 transition-transform ${showClauseText ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showClauseText && (
                                                <div className="px-5 pb-5 border-t border-slate-100">
                                                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                            {selectedClause.clauseText || 'Clause text not available.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ==================== HISTORY TAB ==================== */}
                                {activeTab === 'history' && (
                                    <div className="space-y-4">
                                        {/* Activity Feed Header with View Toggle */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-semibold text-slate-700">Activity Feed</h3>
                                                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                                                    <button
                                                        onClick={() => setActivityViewMode('all')}
                                                        className={`px-3 py-1 text-xs rounded-md transition ${activityViewMode === 'all'
                                                            ? 'bg-white text-slate-800 shadow-sm font-medium'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        All Activity
                                                    </button>
                                                    <button
                                                        onClick={() => setActivityViewMode('clause')}
                                                        className={`px-3 py-1 text-xs rounded-md transition ${activityViewMode === 'clause'
                                                            ? 'bg-white text-slate-800 shadow-sm font-medium'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        This Clause
                                                    </button>
                                                </div>
                                            </div>

                                            {(() => {
                                                // Filter events based on view mode
                                                const filteredEvents = activityViewMode === 'clause'
                                                    ? clauseEvents.filter(e =>
                                                        e.clauseId === selectedClause.clauseId ||
                                                        (e.eventType === 'committed' && !e.clauseId)
                                                    )
                                                    : [...clauseEvents]

                                                // Show newest first
                                                const sortedEvents = [...filteredEvents].reverse()

                                                if (sortedEvents.length === 0) {
                                                    return (
                                                        <div className="text-center py-8">
                                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-slate-500 text-sm">
                                                                {activityViewMode === 'clause'
                                                                    ? 'No events yet for this clause.'
                                                                    : 'No activity yet on this contract.'
                                                                }
                                                            </p>
                                                            <p className="text-slate-400 text-xs mt-1">Use the Agree or Query buttons to get started.</p>
                                                        </div>
                                                    )
                                                }

                                                // Helper: check if an event is unread by current user
                                                const isUnread = (event: ClauseEvent): boolean => {
                                                    const role = getPartyRole()
                                                    if (role === 'initiator') return !event.readByInitiator
                                                    return !event.readByRespondent
                                                }

                                                // Helper: navigate to a clause when clicking an activity item
                                                const navigateToClause = (clauseId: string | null) => {
                                                    if (!clauseId) return
                                                    const clauseIndex = clauses.findIndex(c => c.clauseId === clauseId)
                                                    if (clauseIndex >= 0) {
                                                        setSelectedClauseIndex(clauseIndex)
                                                        setActivityViewMode('clause')
                                                    }
                                                }

                                                return (
                                                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                                        {sortedEvents.map((event) => {
                                                            const eventConfig: Record<string, { icon: string; color: string; label: string }> = {
                                                                'agreed': { icon: '\u2714', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Agreed' },
                                                                'agreement_withdrawn': { icon: '\u21A9', color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Agreement Withdrawn' },
                                                                'queried': { icon: '?', color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Query Raised' },
                                                                'query_resolved': { icon: '\u2714', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Query Resolved' },
                                                                'position_changed': { icon: '\u2195', color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Position Changed' },
                                                                'redrafted': { icon: '\u270E', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Clause Redrafted' },
                                                                'draft_created': { icon: '\u{1F4DD}', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Draft Created' },
                                                                'draft_modified': { icon: '\u270F\uFE0F', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Draft Modified' },
                                                                'committed': { icon: '\u{1F91D}', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Contract Committed' },
                                                                'clause_deleted': { icon: '\u{1F5D1}', color: 'bg-red-100 text-red-700 border-red-200', label: 'Clause Deleted' },
                                                            }

                                                            const config = eventConfig[event.eventType] || { icon: '\u2022', color: 'bg-slate-100 text-slate-600 border-slate-200', label: event.eventType }
                                                            const eventDate = new Date(event.createdAt)
                                                            const unread = isUnread(event)
                                                            const isClickable = activityViewMode === 'all' && event.clauseId

                                                            return (
                                                                <div
                                                                    key={event.eventId}
                                                                    onClick={() => isClickable && navigateToClause(event.clauseId)}
                                                                    className={`flex items-start gap-3 p-3 rounded-lg border transition ${config.color} ${isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''} ${unread ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                                                                >
                                                                    {/* Unread dot */}
                                                                    {unread && (
                                                                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm" />
                                                                    )}

                                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm border">
                                                                        {config.icon}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm font-medium">{config.label}</span>
                                                                            <span className="text-xs opacity-70">
                                                                                {eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>

                                                                        {/* Activity summary (human-readable) */}
                                                                        {event.activitySummary ? (
                                                                            <p className="text-xs mt-0.5 opacity-80">
                                                                                {event.activitySummary}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-xs mt-0.5 opacity-80">
                                                                                by {event.userName} ({event.partyRole})
                                                                            </p>
                                                                        )}

                                                                        {/* Clause reference badge (in All Activity view) */}
                                                                        {activityViewMode === 'all' && event.clauseId && (
                                                                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded text-[11px] text-slate-500 border border-current/10">
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                </svg>
                                                                                {event.eventData?.clause_number ? `${String(event.eventData.clause_number)} — ` : null}
                                                                                {String(event.eventData?.clause_name || 'Clause')}
                                                                            </div>
                                                                        )}

                                                                        {/* Query message */}
                                                                        {event.message && (
                                                                            <p className="text-sm mt-2 p-2 bg-white/60 rounded border border-current/10 italic">
                                                                                &ldquo;{event.message}&rdquo;
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            })()}
                                        </div>

                                        {/* Contract Summary Stats */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Contract Summary</h3>
                                            <div className="grid grid-cols-4 gap-3 text-center">
                                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                                    <div className="text-2xl font-bold text-emerald-700">{getFullyAgreedCount()}</div>
                                                    <div className="text-xs text-emerald-600">Both Agreed</div>
                                                </div>
                                                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                                                    <div className="text-2xl font-bold text-sky-700">{getPartiallyAgreedCount()}</div>
                                                    <div className="text-xs text-sky-600">Partial</div>
                                                </div>
                                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                    <div className="text-2xl font-bold text-amber-700">{queriedClauseIds.size}</div>
                                                    <div className="text-xs text-amber-600">Queried</div>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                    <div className="text-2xl font-bold text-slate-700">
                                                        {clauses.filter(c => !c.isHeader && c.clarenceCertified).length - getFullyAgreedCount() - getPartiallyAgreedCount()}
                                                    </div>
                                                    <div className="text-xs text-slate-500">Outstanding</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ==================== TRADEOFFS TAB ==================== */}
                                {activeTab === 'tradeoffs' && (
                                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-medium text-slate-700 mb-2">Trade-Offs</h3>
                                            <p className="text-slate-500 text-sm">
                                                Trade-off analysis is available in full negotiation mode where both parties can adjust positions.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ==================== DRAFT TAB ==================== */}
                                {activeTab === 'draft' && (
                                    <div className="space-y-4">
                                        {/* Header with Status and Actions */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-700">Draft Clause Language</h3>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {selectedClause.draftModified
                                                            ? '\u270F\uFE0F Modified - Your edited version will be used in the final document'
                                                            : '\u{1F4C4} Original document text'
                                                        }
                                                    </p>
                                                </div>

                                                {/* Status Badge */}
                                                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${selectedClause.draftModified
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                    {selectedClause.draftModified ? 'Modified' : 'Original'}
                                                </div>
                                            </div>

                                            {/* Clause Text Display / Editor */}
                                            {isDraftEditing ? (
                                                // Editing Mode
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editingDraftText}
                                                        onChange={(e) => setEditingDraftText(e.target.value)}
                                                        className="w-full h-64 p-4 bg-white rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-sm text-slate-700 font-mono leading-relaxed resize-none transition-colors"
                                                        placeholder="Enter your modified clause text..."
                                                    />
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs text-slate-500">
                                                            {editingDraftText.length} characters
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={handleCancelEditing}
                                                                disabled={savingDraft}
                                                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleSaveDraft}
                                                                disabled={savingDraft || !editingDraftText.trim()}
                                                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                            >
                                                                {savingDraft ? (
                                                                    <>
                                                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                        Saving...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                        Save Draft
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Read-Only Mode
                                                <div className="space-y-3">
                                                    {/* Clause Text Display */}
                                                    <div className={`p-4 rounded-lg border ${selectedClause.draftModified
                                                        ? 'bg-purple-50 border-purple-200'
                                                        : 'bg-slate-50 border-slate-200'
                                                        }`}>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                                                            {selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || 'Clause text not available.'}
                                                        </p>
                                                        {/* Character count */}
                                                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                                            <span className="text-xs text-slate-400">
                                                                {(selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || '').length} characters
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {/* Unlock to Edit Button */}
                                                            <button
                                                                onClick={handleStartEditing}
                                                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                                </svg>
                                                                Unlock to Edit
                                                            </button>

                                                            {/* Create More Balanced Draft Button */}
                                                            <button
                                                                onClick={handleCreateBalancedDraft}
                                                                disabled={generatingBalancedDraft || !selectedClause.clarenceCertified}
                                                                className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title={!selectedClause.clarenceCertified ? 'Clause must be certified before generating a balanced draft' : 'Generate a more balanced version of this clause'}
                                                            >
                                                                {generatingBalancedDraft ? (
                                                                    <>
                                                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                        Generating...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                                                        </svg>
                                                                        Create More Balanced Draft
                                                                    </>
                                                                )}
                                                            </button>

                                                            {/* Discuss with CLARENCE Button */}
                                                            <button
                                                                onClick={handleDiscussClause}
                                                                disabled={chatLoading}
                                                                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                </svg>
                                                                Discuss with CLARENCE
                                                            </button>
                                                        </div>

                                                        {/* Reset Button (only show if modified) */}
                                                        {selectedClause.draftModified && (
                                                            <button
                                                                onClick={handleResetDraft}
                                                                disabled={savingDraft}
                                                                className="px-4 py-2 text-sm text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                </svg>
                                                                Reset to Original
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Original Text Reference (shown if modified) */}
                                        {selectedClause.draftModified && !isDraftEditing && (
                                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                                                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Original Document Text</h4>
                                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">
                                                    {selectedClause.clauseText || 'Original text not available.'}
                                                </p>
                                            </div>
                                        )}

                                        {/* Help Text */}
                                        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-blue-800 mb-1">Editing Tips</h4>
                                                    <ul className="text-xs text-blue-700 space-y-1">
                                                        <li>{'\u2022'} Click "Create More Balanced Draft" to have CLARENCE rewrite the clause toward a fairer position</li>
                                                        <li>{'\u2022'} Click "Unlock to Edit" to manually modify the clause language</li>
                                                        <li>{'\u2022'} Use "Discuss with CLARENCE" to get AI suggestions for improvements</li>
                                                        <li>{'\u2022'} Your modified text will be used when generating the final contract</li>
                                                        <li>{'\u2022'} You can always reset to the original document text</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Navigation Footer */}
                            <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                                <button
                                    onClick={() => setSelectedClauseIndex(Math.max(0, (selectedClauseIndex || 0) - 1))}
                                    disabled={selectedClauseIndex === 0}
                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Previous
                                </button>
                                <span className="text-sm text-slate-500">
                                    Clause {(selectedClauseIndex || 0) + 1} of {clauses.length}
                                </span>
                                <button
                                    onClick={() => setSelectedClauseIndex(Math.min(clauses.length - 1, (selectedClauseIndex || 0) + 1))}
                                    disabled={selectedClauseIndex === clauses.length - 1}
                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Next
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-slate-500 text-lg">Select a clause to view details</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* RIGHT PANEL: CLARENCE Chat */}
                {/* ======================================================== */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden min-h-0">
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-md">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">CLARENCE</h3>
                                <p className="text-xs text-slate-500">Contract Analysis Assistant</p>
                            </div>
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                        {chatMessages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                                    <p className={`text-xs mt-1.5 ${message.role === 'user' ? 'text-purple-200' : 'text-slate-400'
                                        }`}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-slate-200">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                                placeholder="Ask CLARENCE about this contract..."
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <button
                                onClick={() => sendChatMessage()}
                                disabled={!chatInput.trim() || chatLoading}
                                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">
                            Press Enter to send
                        </p>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* COMMIT CONFIRMATION MODAL */}
            {/* ============================================================ */}
            {commitModalState !== 'closed' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

                        {commitModalState === 'success' ? (
                            /* ---- Success State - Both parties committed ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Contract Fully Committed</h3>
                                <p className="text-sm text-slate-500">Both parties have agreed. Redirecting to Document Centre...</p>
                            </div>

                        ) : commitModalState === 'waiting_other_party' ? (
                            /* ---- Waiting for Other Party State ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Your Commitment Recorded</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Awaiting {getOtherPartyName()} to commit. You'll be notified when they do.
                                </p>
                                <button
                                    onClick={() => setCommitModalState('closed')}
                                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    Continue Reviewing
                                </button>
                            </div>

                        ) : commitModalState === 'processing' ? (
                            /* ---- Processing State ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Committing Contract...</h3>
                                <p className="text-sm text-slate-500">Recording your agreement to all clauses.</p>
                            </div>

                        ) : (
                            /* ---- Confirmation State ---- */
                            (() => {
                                const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                                const myAgreedCount = leafClauses.filter(c => hasCurrentUserAgreed(c.clauseId)).length
                                const myUnagreedCount = leafClauses.length - myAgreedCount
                                const allMyAgreed = myUnagreedCount === 0
                                const otherFullyAgreed = leafClauses.every(c => hasOtherPartyAgreed(c.clauseId))
                                const bothWillBeFullyAgreed = otherFullyAgreed // After commit, we'll be fully agreed, so check if other party is too

                                return (
                                    <>
                                        <div className="p-6 border-b border-slate-200">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${allMyAgreed ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                                    <svg className={`w-5 h-5 ${allMyAgreed ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-slate-800">Commit Contract</h3>
                                                    <p className="text-sm text-slate-500">{contract?.contractName}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            {/* Your agreement status */}
                                            {allMyAgreed ? (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-emerald-800 font-medium">
                                                        You've agreed to all {leafClauses.length} clauses.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-amber-800 font-medium">
                                                        You haven't individually agreed to {myUnagreedCount} clause{myUnagreedCount !== 1 ? 's' : ''}.
                                                    </p>
                                                    <p className="text-sm text-amber-700 mt-1">
                                                        Committing will agree to all outstanding clauses on your behalf.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Other party status */}
                                            {bothWillBeFullyAgreed ? (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-emerald-800 font-medium">
                                                        âœ“ {getOtherPartyName()} has already committed.
                                                    </p>
                                                    <p className="text-sm text-emerald-700 mt-1">
                                                        Your commit will finalise the agreement for both parties.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-sky-800 font-medium">
                                                        {getOtherPartyName()} hasn't committed yet.
                                                    </p>
                                                    <p className="text-sm text-sky-700 mt-1">
                                                        The contract will be finalised once they also commit.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                                                <p className="font-medium text-slate-600 mb-1">This action will be recorded:</p>
                                                <p>Your commitment, including timestamp and browser details, will be stored as a legally auditable record.</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-3 p-6 pt-0">
                                            <button
                                                onClick={() => setCommitModalState('closed')}
                                                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCommitContract}
                                                className={`px-5 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${allMyAgreed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                                                    }`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                                {allMyAgreed ? 'Commit Contract' : 'Agree All & Commit'}
                                            </button>
                                        </div>
                                    </>
                                )
                            })()
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SAVE AS TEMPLATE MODAL (template mode only) */}
            {/* ============================================================ */}
            {showSaveTemplateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        {templateSaved ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Template Saved!</h3>
                                <p className="text-sm text-slate-500">
                                    {isCompanyTemplate
                                        ? 'Company template created. Redirecting to Company Admin...'
                                        : 'Redirecting to your template library...'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-800">
                                        {isCompanyTemplate ? 'Save as Company Template' : 'Save as Template'}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        This will save {clauses.filter(c => c.clarenceCertified).length} certified clauses as a
                                        {isCompanyTemplate ? ' company-wide template available to all staff.' : ' reusable template.'}
                                    </p>
                                </div>
                                <div className="p-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Template Name</label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="e.g., Standard BPO Agreement"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 p-6 pt-0">
                                    <button
                                        onClick={() => setShowSaveTemplateModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveAsTemplate}
                                        disabled={!templateName.trim() || savingTemplate}
                                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {savingTemplate ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Template'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* DELETE CLAUSE CONFIRMATION MODAL */}
            {/* ============================================================ */}
            {showDeleteConfirm && deleteClauseTarget && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">Delete Clause</h3>
                                    <p className="text-sm text-slate-500">This action cannot be undone</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            <p className="text-slate-600 mb-4">
                                Are you sure you want to delete this clause from the {isTemplateMode ? 'template' : 'contract'}?
                            </p>

                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-start gap-3">
                                    <span className="text-sm font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {deleteClauseTarget.clauseNumber}
                                    </span>
                                    <div>
                                        <p className="font-medium text-slate-800">{deleteClauseTarget.clauseName}</p>
                                        <p className="text-sm text-slate-500 mt-1">{deleteClauseTarget.category}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Warning for parent clauses */}
                            {(deleteClauseTarget.clauseLevel === 0 || deleteClauseTarget.clauseLevel === 1) &&
                                clauses.some(c => c.parentClauseId === deleteClauseTarget.clauseId) && (
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <p className="text-sm text-amber-800">
                                                This clause has sub-clauses. Deleting it will also remove all its child clauses.
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={handleCancelDelete}
                                disabled={deletingClause}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDeleteClause}
                                disabled={deletingClause}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {deletingClause ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete Clause
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 7F: PARTY CHAT PANEL (DETACHABLE COMPONENT) */}
            {/* ============================================================ */}
            {!isTemplateMode && userInfo && (
                <QCPartyChatPanel
                    contractId={contractId}
                    otherPartyName={getOtherPartyName()}
                    otherPartyCompany={respondentInfo?.company}
                    currentUserId={userInfo.userId}
                    currentUserName={userInfo.fullName}
                    partyRole={getPartyRole()}
                    isOpen={partyChatOpen}
                    onClose={() => setPartyChatOpen(false)}
                    onUnreadCountChange={setPartyChatUnread}
                />
            )}

            {/* ================================================================
                DRAFT-POSITION SYNC PROMPT OVERLAY
                Shows when user changes position significantly from CLARENCE's assessment
                ================================================================ */}
            {showDraftOfferPrompt && pendingDraftPosition !== null && selectedClause && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <span className="text-white text-lg">📝</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">Position Changed</h3>
                                    <p className="text-purple-100 text-sm">Draft may need updating</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-slate-700 mb-4">
                                You've moved <strong>{selectedClause.clauseName}</strong> to position{' '}
                                <strong className="text-purple-600">{pendingDraftPosition.toFixed(1)}</strong>
                                {selectedClause.clarencePosition !== null && (
                                    <>, which differs from my assessment of{' '}
                                        <strong className="text-purple-600">{selectedClause.clarencePosition.toFixed(1)}</strong>.</>
                                )}
                            </p>

                            <p className="text-slate-600 text-sm mb-6">
                                The current draft language may not reflect your new position.
                                Would you like me to redraft this clause to match?
                            </p>

                            {/* Position comparison */}
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-6">
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-1">CLARENCE Assessment</div>
                                    <div className="text-lg font-bold text-purple-600">
                                        {selectedClause.clarencePosition?.toFixed(1) ?? '—'}
                                    </div>
                                </div>
                                <div className="text-slate-300">→</div>
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-1">Your Position</div>
                                    <div className="text-lg font-bold text-emerald-600">
                                        {pendingDraftPosition.toFixed(1)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDraftOfferPrompt(false)
                                    setPendingDraftPosition(null)
                                }}
                                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                            >
                                Keep Current Draft
                            </button>
                            <button
                                onClick={() => handleGenerateDraftForPosition(pendingDraftPosition)}
                                disabled={generatingPositionDraft}
                                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {generatingPositionDraft ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <span>✨</span>
                                        Redraft for Position {pendingDraftPosition.toFixed(1)}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

// ============================================================================
// SECTION 8: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function QuickContractStudioPage() {
    return (
        <Suspense fallback={<QuickContractStudioLoading />}>
            <QuickContractStudioContent />
        </Suspense>
    )
}