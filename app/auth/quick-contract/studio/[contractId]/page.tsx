'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
    originalText: string | null  // Full original text from document
    clauseLevel: number
    displayOrder: number
    parentClauseId: string | null
    // CLARENCE Certification fields
    clarenceCertified: boolean
    clarencePosition: number | null
    clarenceFairness: string | null
    clarenceSummary: string | null
    clarenceAssessment: string | null
    clarenceFlags: string[]
    clarenceCertifiedAt: string | null
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
    // In the interface definition, add:
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
    eventType: 'agreed' | 'queried' | 'query_resolved' | 'position_changed' | 'redrafted' | 'committed' | 'agreement_withdrawn'
    userId: string
    partyRole: 'initiator' | 'respondent'
    userName: string
    message: string | null
    eventData: Record<string, unknown>
    createdAt: string
}

type CommitModalState = 'closed' | 'confirm' | 'processing' | 'success'

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
const DEFAULT_POSITION_OPTIONS: PositionOption[] = [
    { value: 1, label: 'Maximum Protection', description: 'Strongest customer-favoring terms' },
    { value: 2, label: 'Strong Protection', description: 'Significant customer advantages' },
    { value: 3, label: 'Moderate Protection', description: 'Customer-leaning but reasonable' },
    { value: 4, label: 'Slight Customer Favor', description: 'Marginally customer-favoring' },
    { value: 5, label: 'Balanced', description: 'Neutral, industry standard' },
    { value: 6, label: 'Slight Provider Favor', description: 'Marginally provider-favoring' },
    { value: 7, label: 'Moderate Flexibility', description: 'Provider-leaning but reasonable' },
    { value: 8, label: 'Provider Advantage', description: 'Significant provider advantages' },
    { value: 9, label: 'Strong Provider Terms', description: 'Provider-favoring terms' },
    { value: 10, label: 'Maximum Flexibility', description: 'Strongest provider-favoring terms' }
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
    const [agreedClauseIds, setAgreedClauseIds] = useState<Set<string>>(new Set())
    const [queriedClauseIds, setQueriedClauseIds] = useState<Set<string>>(new Set())

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

    // Party Chat state (human-to-human - slide-out panel)
    const [partyChatOpen, setPartyChatOpen] = useState(false)
    const [partyChatMessages, setPartyChatMessages] = useState<PartyMessage[]>([])
    const [partyChatInput, setPartyChatInput] = useState('')
    const [partyChatSending, setPartyChatSending] = useState(false)
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

    // Derived state
    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null

    // Refs
    const clauseListRef = useRef<HTMLDivElement>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)
    const partyChatEndRef = useRef<HTMLDivElement>(null)
    const partyChatInputRef = useRef<HTMLInputElement>(null)

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

                // Auto-select first clause
                if (mappedClauses.length > 0) {
                    setSelectedClauseIndex(0)
                }

                // Load clause events for agreement tracking
                const { data: eventsData } = await supabase
                    .from('clause_events')
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
                        createdAt: e.created_at
                    }))
                    setClauseEvents(mappedEvents)

                    // Build agreed/queried sets from events
                    const agreed = new Set<string>()
                    const queried = new Set<string>()
                    mappedEvents.forEach(evt => {
                        if (evt.eventType === 'agreed' && evt.clauseId) {
                            agreed.add(evt.clauseId)
                        }
                        if (evt.eventType === 'agreement_withdrawn' && evt.clauseId) {
                            agreed.delete(evt.clauseId)
                        }
                        if (evt.eventType === 'queried' && evt.clauseId) {
                            queried.add(evt.clauseId)
                        }
                        if (evt.eventType === 'query_resolved' && evt.clauseId) {
                            queried.delete(evt.clauseId)
                        }
                    })
                    setAgreedClauseIds(agreed)
                    setQueriedClauseIds(queried)
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
                console.log(`✅ ${preCertifiedClauses.length} clauses already pre-certified from template, skipping certification`)
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

    // Helper: record a clause event
    const recordClauseEvent = async (
        eventType: ClauseEvent['eventType'],
        clauseId: string | null,
        message?: string,
        eventData?: Record<string, unknown>
    ): Promise<ClauseEvent | null> => {
        if (!userInfo || !contractId) return null

        const partyRole = getPartyRole()
        const { data, error: insertError } = await supabase
            .from('clause_events')
            .insert({
                contract_id: contractId,
                clause_id: clauseId,
                event_type: eventType,
                user_id: userInfo.userId,
                party_role: partyRole,
                user_name: userInfo.fullName,
                message: message || null,
                event_data: eventData || {}
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
            createdAt: data.created_at
        }

        setClauseEvents(prev => [...prev, newEvent])
        return newEvent
    }

    // AGREE: Mark a clause as agreed by current user
    const handleAgreeClause = async (clauseId: string) => {
        if (agreedClauseIds.has(clauseId)) return // Already agreed

        const clause = clauses.find(c => c.clauseId === clauseId)
        const event = await recordClauseEvent('agreed', clauseId, undefined, {
            clause_name: clause?.clauseName,
            clause_number: clause?.clauseNumber,
            position: clause?.clarencePosition
        })

        if (event) {
            setAgreedClauseIds(prev => new Set([...prev, clauseId]))

            // Chat confirmation
            const msg: ChatMessage = {
                id: `agree-${Date.now()}`,
                role: 'assistant',
                content: `\u2705 You agreed to "${clause?.clauseName}" (${clause?.clauseNumber}). This has been recorded.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])
        }
    }

    // WITHDRAW AGREEMENT: Un-agree a clause
    const handleWithdrawAgreement = async (clauseId: string) => {
        if (!agreedClauseIds.has(clauseId)) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const event = await recordClauseEvent('agreement_withdrawn', clauseId, undefined, {
            clause_name: clause?.clauseName
        })

        if (event) {
            setAgreedClauseIds(prev => {
                const next = new Set(prev)
                next.delete(clauseId)
                return next
            })
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

            // Push query into Party Chat for the other party to see
            if (clause) {
                pushQueryToPartyChat(clause, queryMessage)
            }
        }
    }

    // COMMIT: Agree to all clauses and commit the contract
    const handleCommitContract = async () => {
        if (!contract || !userInfo) return

        setCommitModalState('processing')

        try {
            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
            const unagreedClauses = leafClauses.filter(c => !agreedClauseIds.has(c.clauseId))

            // Auto-agree any outstanding clauses
            for (const clause of unagreedClauses) {
                await recordClauseEvent('agreed', clause.clauseId, undefined, {
                    clause_name: clause.clauseName,
                    auto_agreed_via_commit: true
                })
                setAgreedClauseIds(prev => new Set([...prev, clause.clauseId]))
            }

            // Record the commit event with audit data
            await recordClauseEvent('committed', null, undefined, {
                clauses_individually_agreed: leafClauses.length - unagreedClauses.length,
                clauses_auto_agreed: unagreedClauses.length,
                total_clauses: leafClauses.length,
                ip_address: 'captured_server_side',
                user_agent: navigator.userAgent,
                committed_at: new Date().toISOString()
            })

            // Update contract status
            await supabase
                .from('uploaded_contracts')
                .update({
                    status: 'committed',
                    updated_at: new Date().toISOString()
                })
                .eq('contract_id', contract.contractId)

            // Log system event
            await supabase.from('system_events').insert({
                event_type: 'quick_contract_committed',
                source_system: 'quick_contract_studio',
                context: {
                    contract_id: contract.contractId,
                    user_id: userInfo.userId,
                    party_role: getPartyRole(),
                    clause_count: leafClauses.length,
                    individually_agreed: leafClauses.length - unagreedClauses.length,
                    auto_agreed: unagreedClauses.length
                }
            })

            setCommitModalState('success')

            // Redirect after showing success
            setTimeout(() => {
                router.push('/auth/document-centre?contract_id=' + contract.contractId + '&committed=true')
            }, 2000)

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

            console.log(`✅ Template saved with ${certifiedClauses.length} pre-certified clauses`)
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

    // Get other party's display name
    const getOtherPartyName = (): string => {
        if (respondentInfo?.name) {
            return getPartyRole() === 'initiator' ? respondentInfo.name : (userInfo?.fullName || 'Initiator')
        }
        return 'Other Party'
    }

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

    // Fetch party chat messages from database
    const fetchPartyChatMessages = useCallback(async () => {
        if (!contractId) return
        try {
            const { data, error } = await supabase
                .from('qc_party_messages')
                .select('*')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Failed to fetch party chat messages:', error)
                return
            }

            if (data) {
                const mapped: PartyMessage[] = data.map(m => ({
                    messageId: m.message_id,
                    contractId: m.contract_id,
                    senderUserId: m.sender_user_id,
                    senderName: m.sender_name,
                    senderRole: m.sender_role,
                    messageText: m.message_text,
                    relatedClauseId: m.related_clause_id,
                    relatedClauseNumber: m.related_clause_number,
                    relatedClauseName: m.related_clause_name,
                    isSystemMessage: m.is_system_message || false,
                    isRead: m.is_read || false,
                    createdAt: m.created_at
                }))
                setPartyChatMessages(mapped)

                // Count unread messages from the other party
                if (userInfo) {
                    const unread = mapped.filter(
                        m => m.senderUserId !== userInfo.userId && !m.isRead
                    ).length
                    setPartyChatUnread(unread)
                }
            }
        } catch (err) {
            console.error('Party chat fetch error:', err)
        }
    }, [contractId, userInfo])

    // Send a party chat message
    const sendPartyChatMessage = async (
        text: string,
        relatedClause?: { clauseId: string, clauseNumber: string, clauseName: string }
    ) => {
        if (!text.trim() || !userInfo || !contractId) return

        setPartyChatSending(true)
        try {
            const { data, error } = await supabase
                .from('qc_party_messages')
                .insert({
                    contract_id: contractId,
                    sender_user_id: userInfo.userId,
                    sender_name: userInfo.fullName,
                    sender_role: getPartyRole(),
                    message_text: text.trim(),
                    related_clause_id: relatedClause?.clauseId || null,
                    related_clause_number: relatedClause?.clauseNumber || null,
                    related_clause_name: relatedClause?.clauseName || null,
                    is_system_message: false
                })
                .select()
                .single()

            if (error) throw error

            if (data) {
                const newMsg: PartyMessage = {
                    messageId: data.message_id,
                    contractId: data.contract_id,
                    senderUserId: data.sender_user_id,
                    senderName: data.sender_name,
                    senderRole: data.sender_role,
                    messageText: data.message_text,
                    relatedClauseId: data.related_clause_id,
                    relatedClauseNumber: data.related_clause_number,
                    relatedClauseName: data.related_clause_name,
                    isSystemMessage: false,
                    isRead: false,
                    createdAt: data.created_at
                }
                setPartyChatMessages(prev => [...prev, newMsg])
            }
            setPartyChatInput('')
        } catch (err) {
            console.error('Failed to send party chat message:', err)
        } finally {
            setPartyChatSending(false)
        }
    }

    // Mark messages as read when opening chat
    const markPartyChatRead = async () => {
        if (!contractId || !userInfo) return
        try {
            await supabase
                .from('qc_party_messages')
                .update({ is_read: true })
                .eq('contract_id', contractId)
                .neq('sender_user_id', userInfo.userId)
                .eq('is_read', false)

            setPartyChatUnread(0)
        } catch (err) {
            console.error('Failed to mark messages as read:', err)
        }
    }

    // Push query into party chat automatically
    const pushQueryToPartyChat = async (
        clause: ContractClause,
        queryMessage: string
    ) => {
        if (!userInfo || !contractId) return
        const systemText = `ÃƒÂ¢Ã‚ÂÃ¢â‚¬Å“ Query on "${clause.clauseName}" (${clause.clauseNumber}):\n\n"${queryMessage}"`
        try {
            await supabase
                .from('qc_party_messages')
                .insert({
                    contract_id: contractId,
                    sender_user_id: userInfo.userId,
                    sender_name: userInfo.fullName,
                    sender_role: getPartyRole(),
                    message_text: systemText,
                    related_clause_id: clause.clauseId,
                    related_clause_number: clause.clauseNumber,
                    related_clause_name: clause.clauseName,
                    is_system_message: true
                })
            // Refresh messages
            fetchPartyChatMessages()
        } catch (err) {
            console.error('Failed to push query to party chat:', err)
        }
    }

    // Party Chat Effects: Load respondent info + messages + polling + realtime
    useEffect(() => {
        if (contractId && userInfo && !isTemplateMode) {
            loadRespondentInfo()
            fetchPartyChatMessages()
        }
    }, [contractId, userInfo, isTemplateMode, loadRespondentInfo, fetchPartyChatMessages])

    // Polling for new messages (every 10s when open, 30s when closed)
    useEffect(() => {
        if (isTemplateMode || !contractId || !userInfo) return
        const interval = setInterval(
            fetchPartyChatMessages,
            partyChatOpen ? 10000 : 30000
        )
        return () => clearInterval(interval)
    }, [partyChatOpen, isTemplateMode, contractId, userInfo, fetchPartyChatMessages])

    // Supabase Realtime subscription for instant messages
    useEffect(() => {
        if (isTemplateMode || !contractId) return
        const channel = supabase
            .channel(`qc-party-chat-${contractId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'qc_party_messages',
                filter: `contract_id=eq.${contractId}`
            }, (payload) => {
                const m = payload.new as Record<string, unknown>
                // Only process messages from the OTHER user
                if (m.sender_user_id !== userInfo?.userId) {
                    const newMsg: PartyMessage = {
                        messageId: m.message_id as string,
                        contractId: m.contract_id as string,
                        senderUserId: m.sender_user_id as string,
                        senderName: m.sender_name as string,
                        senderRole: m.sender_role as 'initiator' | 'respondent',
                        messageText: m.message_text as string,
                        relatedClauseId: m.related_clause_id as string | null,
                        relatedClauseNumber: m.related_clause_number as string | null,
                        relatedClauseName: m.related_clause_name as string | null,
                        isSystemMessage: (m.is_system_message as boolean) || false,
                        isRead: false,
                        createdAt: m.created_at as string
                    }
                    setPartyChatMessages(prev => {
                        // Avoid duplicates
                        if (prev.some(p => p.messageId === newMsg.messageId)) return prev
                        return [...prev, newMsg]
                    })
                    if (!partyChatOpen) {
                        setPartyChatUnread(prev => prev + 1)
                    }
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [contractId, userInfo?.userId, isTemplateMode, partyChatOpen])

    // Auto-scroll party chat when new messages arrive
    useEffect(() => {
        if (partyChatOpen) {
            partyChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [partyChatMessages, partyChatOpen])

    // Mark as read + focus input when opening
    useEffect(() => {
        if (partyChatOpen) {
            markPartyChatRead()
            setTimeout(() => partyChatInputRef.current?.focus(), 300)
        }
    }, [partyChatOpen])

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

            // Add confirmation message to chat
            const confirmMessage: ChatMessage = {
                id: `draft-saved-${Date.now()}`,
                role: 'assistant',
                content: `\u2705 Draft saved for "${selectedClause.clauseName}". This modified text will be used when generating the final contract document.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

        } catch (err) {
            console.error('Save draft error:', err)
            const errorMessage: ChatMessage = {
                id: `draft-error-${Date.now()}`,
                role: 'assistant',
                content: `\u274C Failed to save draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setSavingDraft(false)
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
        const currentPosition = selectedClause.clarencePosition
        let directionHint = ''
        if (currentPosition !== null) {
            if (currentPosition < 4) {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (customer-favoring). To create a more balanced version, moderate the customer protections while maintaining reasonable safeguards. Introduce fairer mutual obligations where appropriate.`
            } else if (currentPosition > 6) {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (provider-favoring). To create a more balanced version, strengthen customer protections and introduce more equitable terms. Add reasonable safeguards for the customer without being overly aggressive.`
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
                    message: `TASK: Rewrite the following clause to be more balanced (targeting position 5.0 on a 1-10 scale where 1 is maximum customer protection and 10 is maximum provider flexibility).

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
                                ? `The original was at position ${currentPosition.toFixed(1)} (customer-favoring). I've moderated the terms to be more equitable while maintaining reasonable protections.\n\n`
                                : currentPosition !== null && currentPosition > 6
                                    ? `The original was at position ${currentPosition.toFixed(1)} (provider-favoring). I've strengthened the customer safeguards to create a fairer balance.\n\n`
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

    const getPositionColor = (position: number | null): string => {
        if (position === null) return 'bg-slate-200'
        if (position <= 3) return 'bg-emerald-500'
        if (position <= 5) return 'bg-teal-500'
        if (position <= 7) return 'bg-blue-500'
        return 'bg-indigo-500'
    }

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
                                {contract?.contractType} &middot; {clauses.filter(c => !c.isHeader).length} clauses &middot; {agreedClauseIds.size} agreed
                            </p>
                        </div>

                        {/* Agreement Progress Indicator (non-template mode) */}
                        {!isTemplateMode && clauses.length > 0 && (() => {
                            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                            const agreedCount = leafClauses.filter(c => agreedClauseIds.has(c.clauseId)).length
                            const totalCount = leafClauses.length
                            const allAgreed = agreedCount === totalCount && totalCount > 0
                            const progressPercent = totalCount > 0 ? (agreedCount / totalCount) * 100 : 0

                            return (
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="w-32">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className={allAgreed ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                                                {agreedCount}/{totalCount} agreed
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${allAgreed ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">

                        {/* Party Chat Toggle (non-template mode only) */}
                        {!isTemplateMode && (
                            <button
                                onClick={() => setPartyChatOpen(true)}
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
                                const allAgreed = leafClauses.length > 0 && leafClauses.every(c => agreedClauseIds.has(c.clauseId))

                                return (
                                    <button
                                        onClick={() => setCommitModalState('confirm')}
                                        disabled={leafClauses.length === 0}
                                        className={`px-5 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${allAgreed
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-amber-600 hover:bg-amber-700'
                                            } disabled:bg-slate-300`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Commit Contract
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

                                                return (
                                                    <button
                                                        key={child.clauseId}
                                                        onClick={() => isClickable && setSelectedClauseIndex(clauses.findIndex(c => c.clauseId === child.clauseId))}
                                                        disabled={!isClickable}
                                                        className={`w-full flex items-center gap-2 pl-8 pr-3 py-2 text-left transition-colors ${isSelected
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
                                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${child.clarencePosition <= 3 ? 'bg-emerald-100 text-emerald-700' :
                                                                child.clarencePosition <= 7 ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-red-100 text-red-700'
                                                                }`}>
                                                                {child.clarencePosition.toFixed(1)}
                                                            </span>
                                                        )}
                                                        {/* Agreement/Query status indicator */}
                                                        {agreedClauseIds.has(child.clauseId) && (
                                                            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Agreed">
                                                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                        {queriedClauseIds.has(child.clauseId) && (
                                                            <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Query pending">
                                                                <span className="text-white text-[9px] font-bold">?</span>
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )
                                } else {
                                    // ---- STANDALONE CLAUSE (no children) ----
                                    const isClickable = parent.processingStatus === 'certified' || parent.processingStatus === 'failed'
                                    const isSelected = selectedClause?.clauseId === parent.clauseId

                                    return (
                                        <button
                                            key={parent.clauseId}
                                            onClick={() => isClickable && setSelectedClauseIndex(clauses.findIndex(c => c.clauseId === parent.clauseId))}
                                            disabled={!isClickable}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isSelected
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
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${parent.clarencePosition <= 3 ? 'bg-emerald-100 text-emerald-700' :
                                                    parent.clarencePosition <= 7 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {parent.clarencePosition.toFixed(1)}
                                                </span>
                                            )}
                                            {/* Agreement/Query status indicator */}
                                            {agreedClauseIds.has(parent.clauseId) && (
                                                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Agreed">
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </span>
                                            )}
                                            {queriedClauseIds.has(parent.clauseId) && (
                                                <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Query pending">
                                                    <span className="text-white text-[9px] font-bold">?</span>
                                                </span>
                                            )}
                                        </button>
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
                                                className={`px-3 py-1.5 text-sm rounded-md transition ${activeTab === tab
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ==================== CLAUSE ACTION BAR ==================== */}
                            {!isTemplateMode && selectedClause.clarenceCertified && (
                                <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex items-center justify-between">
                                        {/* Left: Agreement status */}
                                        <div className="flex items-center gap-3">
                                            {agreedClauseIds.has(selectedClause.clauseId) ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Agreed
                                                    </span>
                                                    <button
                                                        onClick={() => handleWithdrawAgreement(selectedClause.clauseId)}
                                                        className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                                                        title="Withdraw agreement"
                                                    >
                                                        Withdraw
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAgreeClause(selectedClause.clauseId)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Agree
                                                </button>
                                            )}

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
                                                    {selectedClause.clarencePosition !== null && (
                                                        <div
                                                            className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 border-4 border-white flex items-center justify-center text-lg font-bold text-white z-20 shadow-xl transition-all cursor-grab active:cursor-grabbing hover:scale-110"
                                                            style={{
                                                                left: `${((selectedClause.clarencePosition - 1) / 9) * 100}%`,
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%)'
                                                            }}
                                                            title={`CLARENCE recommends: ${selectedClause.clarencePosition.toFixed(1)} - Drag to adjust`}
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

                                                                    // Update the clause position
                                                                    setClauses(prev => prev.map(c =>
                                                                        c.clauseId === selectedClause.clauseId
                                                                            ? { ...c, clarencePosition: roundedPosition }
                                                                            : c
                                                                    ))
                                                                }

                                                                const handleMouseUp = () => {
                                                                    document.removeEventListener('mousemove', handleMouseMove)
                                                                    document.removeEventListener('mouseup', handleMouseUp)
                                                                    // TODO: Save to database here
                                                                }

                                                                document.addEventListener('mousemove', handleMouseMove)
                                                                document.addEventListener('mouseup', handleMouseUp)
                                                            }}
                                                        >
                                                            C
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Scale Labels */}
                                                <div className="flex justify-between mt-4 text-xs text-slate-500">
                                                    <span>Customer-Favoring</span>
                                                    <span>Balanced</span>
                                                    <span>Provider-Favoring</span>
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
                                        {/* Event Timeline */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-4">Clause History</h3>

                                            {(() => {
                                                // Filter events for the selected clause + contract-level events
                                                const clauseSpecificEvents = clauseEvents.filter(e =>
                                                    e.clauseId === selectedClause.clauseId ||
                                                    (e.eventType === 'committed' && !e.clauseId)
                                                )

                                                if (clauseSpecificEvents.length === 0) {
                                                    return (
                                                        <div className="text-center py-8">
                                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-slate-500 text-sm">No events yet for this clause.</p>
                                                            <p className="text-slate-400 text-xs mt-1">Use the Agree or Query buttons above to get started.</p>
                                                        </div>
                                                    )
                                                }

                                                return (
                                                    <div className="space-y-3">
                                                        {clauseSpecificEvents.map((event) => {
                                                            const eventConfig: Record<string, { icon: string; color: string; label: string }> = {
                                                                'agreed': { icon: '\u2714', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Agreed' },
                                                                'agreement_withdrawn': { icon: '\u21A9', color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Agreement Withdrawn' },
                                                                'queried': { icon: '?', color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Query Raised' },
                                                                'query_resolved': { icon: '\u2714', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Query Resolved' },
                                                                'position_changed': { icon: '\u2195', color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Position Changed' },
                                                                'redrafted': { icon: '\u270E', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Clause Redrafted' },
                                                                'committed': { icon: '\u{1F91D}', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Contract Committed' },
                                                            }

                                                            const config = eventConfig[event.eventType] || { icon: '\u2022', color: 'bg-slate-100 text-slate-600 border-slate-200', label: event.eventType }
                                                            const eventDate = new Date(event.createdAt)

                                                            return (
                                                                <div key={event.eventId} className={`flex items-start gap-3 p-3 rounded-lg border ${config.color}`}>
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
                                                                        <p className="text-xs mt-0.5 opacity-80">
                                                                            by {event.userName} ({event.partyRole})
                                                                        </p>
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

                                        {/* Full Contract Event Summary */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Contract Summary</h3>
                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                                    <div className="text-2xl font-bold text-emerald-700">{agreedClauseIds.size}</div>
                                                    <div className="text-xs text-emerald-600">Agreed</div>
                                                </div>
                                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                    <div className="text-2xl font-bold text-amber-700">{queriedClauseIds.size}</div>
                                                    <div className="text-xs text-amber-600">Queried</div>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                    <div className="text-2xl font-bold text-slate-700">
                                                        {clauses.filter(c => !c.isHeader && c.clarenceCertified).length - agreedClauseIds.size}
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
                            /* ---- Success State ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Contract Committed</h3>
                                <p className="text-sm text-slate-500">Your commitment has been recorded. Redirecting to Document Centre...</p>
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
                                const agreedCount = leafClauses.filter(c => agreedClauseIds.has(c.clauseId)).length
                                const unagreedCount = leafClauses.length - agreedCount
                                const allAgreed = unagreedCount === 0

                                return (
                                    <>
                                        <div className="p-6 border-b border-slate-200">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${allAgreed ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                                    <svg className={`w-5 h-5 ${allAgreed ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                            {allAgreed ? (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-emerald-800 font-medium">All {leafClauses.length} clauses have been individually agreed.</p>
                                                    <p className="text-sm text-emerald-700 mt-1">Committing will finalise your agreement and move to signing.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-amber-800 font-medium">
                                                        {unagreedCount} of {leafClauses.length} clause{unagreedCount !== 1 ? 's have' : ' has'} not been individually agreed.
                                                    </p>
                                                    <p className="text-sm text-amber-700 mt-1">
                                                        Committing will agree to all outstanding clauses on your behalf. Are you sure you want to proceed?
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
                                                className={`px-5 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${allAgreed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                                                    }`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                                {allAgreed ? 'Commit Contract' : 'Agree All & Commit'}
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
            {/* SECTION 7F: PARTY CHAT SLIDE-OUT PANEL */}
            {/* ============================================================ */}
            {!isTemplateMode && (
                <>
                    {/* Backdrop */}
                    {partyChatOpen && (
                        <div
                            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
                            onClick={() => setPartyChatOpen(false)}
                        />
                    )}

                    {/* Slide-out Panel */}
                    <div
                        className={`fixed top-0 right-0 h-full w-[400px] max-w-[90vw] bg-slate-900 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${partyChatOpen ? 'translate-x-0' : 'translate-x-full'
                            }`}
                    >
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">
                                        {(getOtherPartyName()).charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold text-sm">
                                        {getOtherPartyName()}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {respondentInfo?.company || 'Party Chat'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPartyChatOpen(false)}
                                className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                            {partyChatMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium mb-1">No messages yet</p>
                                    <p className="text-slate-500 text-xs">
                                        Send a message to start discussing this contract.
                                        Queries on clauses will also appear here.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Date Divider */}
                                    <div className="flex items-center gap-3 mb-3 pt-2">
                                        <div className="flex-1 h-px bg-slate-700" />
                                        <span className="text-xs text-slate-500">
                                            {new Date(partyChatMessages[0]?.createdAt).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </span>
                                        <div className="flex-1 h-px bg-slate-700" />
                                    </div>

                                    {partyChatMessages.map(msg => {
                                        const isOwn = msg.senderUserId === userInfo?.userId
                                        const time = new Date(msg.createdAt).toLocaleTimeString('en-GB', {
                                            hour: '2-digit', minute: '2-digit'
                                        })

                                        return (
                                            <div key={msg.messageId} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
                                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.isSystemMessage
                                                    ? 'bg-amber-900/40 border border-amber-700/50'
                                                    : isOwn
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-slate-700 text-white'
                                                    }`}>
                                                    {/* Clause reference badge */}
                                                    {msg.relatedClauseNumber && (
                                                        <div className={`text-xs font-medium mb-1 ${msg.isSystemMessage ? 'text-amber-400' : isOwn ? 'text-emerald-200' : 'text-slate-400'
                                                            }`}>
                                                            Re: {msg.relatedClauseNumber} - {msg.relatedClauseName}
                                                        </div>
                                                    )}
                                                    <p className={`text-sm whitespace-pre-wrap ${msg.isSystemMessage ? 'text-amber-200' : 'text-white'
                                                        }`}>
                                                        {msg.messageText}
                                                    </p>
                                                    <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'
                                                        }`}>
                                                        {!isOwn && (
                                                            <span className="text-xs text-slate-400">{msg.senderName}</span>
                                                        )}
                                                        <span className={`text-xs ${msg.isSystemMessage ? 'text-amber-500' : isOwn ? 'text-emerald-300' : 'text-slate-500'
                                                            }`}>
                                                            {time}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div ref={partyChatEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-slate-700 p-4 bg-slate-900">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={partyChatInputRef}
                                    type="text"
                                    value={partyChatInput}
                                    onChange={(e) => setPartyChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            sendPartyChatMessage(partyChatInput)
                                        }
                                    }}
                                    placeholder={`Message ${getOtherPartyName()}...`}
                                    className="flex-1 bg-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                    onClick={() => sendPartyChatMessage(partyChatInput)}
                                    disabled={!partyChatInput.trim() || partyChatSending}
                                    className={`p-2.5 rounded-lg transition-all ${partyChatInput.trim() && !partyChatSending
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    {partyChatSending ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
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