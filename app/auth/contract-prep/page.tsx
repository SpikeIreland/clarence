'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FeedbackButton from '@/app/components/FeedbackButton'
import { TransitionModal } from '@/app/components/create-phase/TransitionModal'
import type { TransitionConfig } from '@/lib/pathway-utils'
import { CreateProgressBar } from '@/app/components/create-phase/CreateProgressHeader';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    role: string
    userId: string
    companyId: string | null
}

interface UploadedContract {
    contractId: string
    companyId: string | null
    uploadedByUserId: string
    linkedSessionId: string | null
    contractName: string
    description: string | null
    fileName: string
    fileType: string
    fileSize: number
    status: 'uploading' | 'processing' | 'ready' | 'failed'
    processingError: string | null
    clauseCount: number | null
    detectedStyle: string | null
    detectedJurisdiction: string | null
    detectedContractType: string | null
    parsingNotes: string | null
    usageCount: number
    lastUsedAt: string | null
    createdAt: string
    updatedAt: string
    processedAt: string | null
}

interface ContractClause {
    clauseId: string
    contractId: string
    clauseNumber: string
    clauseName: string
    category: string
    content: string
    originalText: string | null
    parentClauseId: string | null
    clauseLevel: number
    displayOrder: number
    aiSuggestedName: string | null
    aiSuggestedCategory: string | null
    aiConfidence: number | null
    aiSuggestion: string | null
    mapsToMasterClauseId: string | null
    mappingConfidence: number | null
    verified: boolean
    verifiedByUserId: string | null
    verifiedAt: string | null
    status: 'pending' | 'verified' | 'rejected' | 'committed'
    rejectionReason: string | null
    committedAt: string | null
    committedPositionId: string | null
    createdAt: string
    updatedAt: string
    customerPosition?: number
    providerPosition?: number
    importance?: 'low' | 'medium' | 'high' | 'critical'
}

interface ChatMessage {
    id: string
    role: 'clarence' | 'user' | 'system'
    content: string
    timestamp: Date
}

interface CategoryGroup {
    category: string
    clauses: ContractClause[]
    isExpanded: boolean
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

interface SessionData {
    sessionId: string
    sessionNumber: string | null
    mediationType: 'straight_to_contract' | 'partial_mediation' | 'full_mediation' | null
    contractType: string | null
    status: string | null
}

interface TransitionState {
    isOpen: boolean
    transition: TransitionConfig | null
    redirectUrl: string | null
}

// ============================================================================
// SECTION 1A: AI INTELLIGENCE TYPES
// Matches real DB schema: clause_range_mappings + uploaded_contract_clauses
// ============================================================================

interface ScalePoint {
    position: number        // 1-10
    label: string           // "30 days", "£10,000", "99.9%"
    value: number           // The raw numeric value: 30, 10000, 99.9
    description: string     // "Standard one month notice period..."
}

interface RangeData {
    scale_points: ScalePoint[]
    interpolation: 'linear' | 'stepped' | 'logarithmic'
    format_pattern: string  // "{value} {unit}"
    display_precision: number
}

interface AIRangeMapping {
    mappingId: string               // mapping_id uuid
    clauseId: string                // clause_id uuid
    contractId: string              // contract_id uuid
    valueType: string               // value_type: 'duration', 'percentage', 'currency', 'count', 'boolean', 'text'
    rangeUnit: string | null        // range_unit: 'days', 'months', etc. (nullable)
    industryStandardMin: number | null  // industry_standard_min: position number (e.g., 4.0)
    industryStandardMax: number | null  // industry_standard_max: position number (e.g., 6.0)
    isDisplayable: boolean          // is_displayable: whether to show real position bar
    sourceType: string              // source_type: 'ai_generated'
    generatedBy: string             // generated_by: 'clarence-map-clause-ranges'
    rangeData: RangeData            // range_data: JSONB blob
    generatedAt: string             // generated_at: timestamptz
}

interface CertificationResult {
    clauseId: string
    clarencePosition: number        // 1-10 — the AI's recommended position
    confidence: number              // 0-1 (numeric from DB)
    rationale: string               // ai_suggestion text
    fairness: string                // clarence_fairness: 'balanced', 'review_recommended', etc.
    summary: string                 // clarence_summary: one-sentence description
    assessment: string              // clarence_assessment: 2-3 sentence analysis
    status: 'pending' | 'certified' | 'failed'
}

interface CertificationProgress {
    total: number
    completed: number
    currentClauseName: string | null
    status: 'idle' | 'running' | 'complete' | 'error'
    errorMessage?: string
}

interface UserClauseConfig {
    position: number                // 1-10 — user's chosen position
    importance: 'low' | 'medium' | 'high' | 'critical'
    rationale: string               // User's notes/reasoning
    acceptedRecommendation: boolean // Did they accept Clarence's position?
}

// ============================================================================
// CLAUSE STATUS CONFIGURATION
// ============================================================================

const CLAUSE_STATUS = {
    NOT_CONFIGURED: 'pending',
    CONFIGURED: 'verified',
    EXCLUDED: 'rejected'
} as const

const CLAUSE_STATUS_DISPLAY = {
    pending: { label: 'Not Configured', icon: '○', color: 'text-slate-400', bg: 'bg-slate-100' },
    verified: { label: 'Configured', icon: '✓', color: 'text-green-600', bg: 'bg-green-100' },
    rejected: { label: 'Excluded', icon: '✕', color: 'text-red-500', bg: 'bg-red-100' }
} as const

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const POLLING_INTERVAL = 5000
const MAX_POLLING_ATTEMPTS = 60

const CLAUSE_CATEGORIES = [
    'Definitions',
    'Scope of Services',
    'Term and Termination',
    'Payment Terms',
    'Liability and Indemnification',
    'Intellectual Property',
    'Confidentiality',
    'Data Protection',
    'Service Levels',
    'Governance',
    'Dispute Resolution',
    'General Provisions',
    'Other'
]

const CLARENCE_MESSAGES = {
    welcome_new: `Welcome to **Contract Preparation** — your war room for preparing negotiation positions.

Upload a contract and I'll analyze every clause to generate position recommendations and real-world range mappings.`,

    welcome_loading: `Loading your contract... Just a moment while I fetch the details.`,

    contract_loaded: (name: string, clauseCount: number) =>
        `I've loaded **${name}** with **${clauseCount} clauses** identified across multiple categories.

Click on any clause in the left panel to review its details and set your negotiation position.`,

    processing: `Your contract is being analyzed. I'm identifying clause boundaries and categories.

This typically takes 1-2 minutes for larger documents.`,

    clause_verified: (name: string) => `✓ Verified: **${name}**`,

    clause_rejected: (name: string) => `✕ Rejected: **${name}**`,

    clause_deleted: (name: string) => `🗑️ Deleted: **${name}**`,

    clauses_deleted: (count: number) => `🗑️ Deleted **${count} clauses**`,

    clauses_reordered: `→ Clauses reordered successfully`,

    all_verified: `Excellent! All clauses have been verified. You can now commit them to use in negotiations.`,

    committed: (count: number) => `Successfully committed **${count} clauses**. Your contract positions are locked in!`
}

// Certification polling — faster than document parsing poll
const CERTIFICATION_POLL_INTERVAL = 3000
const CERTIFICATION_MAX_POLLS = 120  // 6 minutes max

// Zone derivation from industry_standard_min/max position values
const ZONE_COLORS = {
    providerFavourable: {
        bg: 'bg-rose-100',
        border: 'border-rose-300',
        text: 'text-rose-700',
        label: 'Provider Favourable'
    },
    balanced: {
        bg: 'bg-amber-100',
        border: 'border-amber-300',
        text: 'text-amber-700',
        label: 'Industry Standard'
    },
    customerFavourable: {
        bg: 'bg-emerald-100',
        border: 'border-emerald-300',
        text: 'text-emerald-700',
        label: 'Customer Favourable'
    }
} as const

// Importance level config for display
const IMPORTANCE_CONFIG = {
    low: { label: 'Low', color: 'bg-slate-500', textColor: 'text-slate-700', bgLight: 'bg-slate-100', ring: 'ring-slate-300' },
    medium: { label: 'Medium', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-100', ring: 'ring-blue-300' },
    high: { label: 'High', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-100', ring: 'ring-amber-300' },
    critical: { label: 'Critical', color: 'bg-red-600', textColor: 'text-red-700', bgLight: 'bg-red-100', ring: 'ring-red-300' }
} as const


// ============================================================================
// SECTION 3: TEXT EXTRACTION UTILITIES
// ============================================================================

const loadPdfJs = async () => {
    const pdfjsLib = await import('pdfjs-dist')
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    }
    return pdfjsLib
}

const extractTextFromPdf = async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
            .map((item) => {
                if ('str' in item) {
                    return (item as { str: string }).str
                }
                return ''
            })
            .join(' ')
        fullText += pageText + '\n\n'
    }

    return fullText.trim()
}

const extractTextFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
}

const extractTextFromTxt = async (file: File): Promise<string> => {
    return await file.text()
}

// ============================================================================
// SECTION 4: LOADING FALLBACK COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600">Loading Contract Studio...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: MAIN COMPONENT CONTENT
// ============================================================================

function ContractPrepContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // URL Parameters
    const contractId = searchParams.get('contract_id')
    const sessionId = searchParams.get('session_id')
    const pathwayId = searchParams.get('pathway_id')

    // ========================================================================
    // SECTION 5A: STATE
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<UploadedContract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(false)
    const [isCommitting, setIsCommitting] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [editingClause, setEditingClause] = useState<ContractClause | null>(null)
    const [editName, setEditName] = useState('')
    const [editCategory, setEditCategory] = useState('')
    const [editContent, setEditContent] = useState('')

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'category' | 'document'>('document')
    const [expandedParentClauses, setExpandedParentClauses] = useState<Set<string>>(new Set())

    // Bulk Selection State
    const [selectedClauseIds, setSelectedClauseIds] = useState<Set<string>>(new Set())
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isReordering, setIsReordering] = useState(false)

    // Position Scales State (legacy — kept for bulk verify compatibility)
    const [clausePositions, setClausePositions] = useState<Record<string, {
        customerPosition: number
        providerPosition: number
        importance: 'low' | 'medium' | 'high' | 'critical'
    }>>({})

    // Clause Library State
    const [showClauseLibrary, setShowClauseLibrary] = useState(false)
    const [masterClauses, setMasterClauses] = useState<MasterClause[]>([])
    const [selectedMasterClauseIds, setSelectedMasterClauseIds] = useState<Set<string>>(new Set())
    const [libraryLoading, setLibraryLoading] = useState(false)
    const [librarySearchQuery, setLibrarySearchQuery] = useState('')
    const [libraryExpandedCategories, setLibraryExpandedCategories] = useState<Set<string>>(new Set())
    const [isAddingClauses, setIsAddingClauses] = useState(false)

    // AI Intelligence Pipeline State
    const [rangeMappings, setRangeMappings] = useState<Record<string, AIRangeMapping>>({})
    const [clarenceRecommendations, setClarenceRecommendations] = useState<Record<string, CertificationResult>>({})
    const [certificationProgress, setCertificationProgress] = useState<CertificationProgress>({
        total: 0,
        completed: 0,
        currentClauseName: null,
        status: 'idle'
    })

    // User Position State
    const [userPositions, setUserPositions] = useState<Record<string, UserClauseConfig>>({})

    // Right Panel Tab State
    const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'intelligence'>('intelligence')

    // Certification polling ref
    const certificationPollRef = useRef<NodeJS.Timeout | null>(null)
    const certificationPollCountRef = useRef(0)

    // Session Data State
    const [sessionData, setSessionData] = useState<SessionData | null>(null)

    // Delete Confirmation Modal
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null)
    const [clauseToDelete, setClauseToDelete] = useState<ContractClause | null>(null)

    const [transitionState, setTransitionState] = useState<TransitionState>({
        isOpen: false,
        transition: null,
        redirectUrl: null
    })

    // ========================================================================
    // SECTION 5B: INITIALIZE & LOAD USER
    // ========================================================================

    useEffect(() => {
        const authData = localStorage.getItem('clarence_auth')
        if (authData) {
            try {
                const parsed = JSON.parse(authData)
                setUserInfo(parsed.userInfo)
            } catch (e) {
                console.error('Error parsing auth data:', e)
                router.push('/auth/login')
            }
        } else {
            router.push('/auth/login')
        }
    }, [router])

    // ========================================================================
    // SECTION 5C: LOAD CONTRACT DATA
    // ========================================================================

    const loadContract = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/contracts/${id}`)
            if (!response.ok) throw new Error('Failed to load contract')

            const data = await response.json()
            const contractData = data.contract || data
            const hasContractId = contractData && (contractData.contract_id || contractData.contractId)

            if (hasContractId) {
                const get = (snake: string, camel: string) => contractData[snake] ?? contractData[camel]
                const status = get('status', 'status')

                setContract({
                    contractId: get('contract_id', 'contractId'),
                    companyId: get('company_id', 'companyId'),
                    uploadedByUserId: get('uploaded_by_user_id', 'uploadedByUserId'),
                    linkedSessionId: get('linked_session_id', 'linkedSessionId'),
                    contractName: get('contract_name', 'contractName'),
                    description: get('description', 'description'),
                    fileName: get('file_name', 'fileName'),
                    fileType: get('file_type', 'fileType'),
                    fileSize: get('file_size', 'fileSize'),
                    status: status,
                    processingError: get('processing_error', 'processingError'),
                    clauseCount: get('clause_count', 'clauseCount'),
                    detectedStyle: get('detected_style', 'detectedStyle'),
                    detectedJurisdiction: get('detected_jurisdiction', 'detectedJurisdiction'),
                    detectedContractType: get('detected_contract_type', 'detectedContractType'),
                    parsingNotes: get('parsing_notes', 'parsingNotes'),
                    usageCount: get('usage_count', 'usageCount') || 0,
                    lastUsedAt: get('last_used_at', 'lastUsedAt'),
                    createdAt: get('created_at', 'createdAt'),
                    updatedAt: get('updated_at', 'updatedAt'),
                    processedAt: get('processed_at', 'processedAt')
                })

                return status
            }
        } catch (err) {
            console.error('Error loading contract:', err)
            setError('Failed to load contract')
        }
        return null
    }, [])

    const loadClauses = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/contracts/${id}/clauses`)
            if (!response.ok) throw new Error('Failed to load clauses')

            const data = await response.json()
            const clausesArray = data.clauses || (Array.isArray(data) ? data : null)

            if (clausesArray && Array.isArray(clausesArray)) {
                const get = (obj: any, snake: string, camel: string) => obj[snake] ?? obj[camel]

                const mappedClauses: ContractClause[] = clausesArray.map((c: any) => ({
                    clauseId: get(c, 'clause_id', 'clauseId'),
                    contractId: get(c, 'contract_id', 'contractId'),
                    clauseNumber: get(c, 'clause_number', 'clauseNumber') || '',
                    clauseName: get(c, 'clause_name', 'clauseName'),
                    category: get(c, 'category', 'category') || 'Other',
                    content: get(c, 'content', 'content'),
                    originalText: get(c, 'original_text', 'originalText'),
                    parentClauseId: get(c, 'parent_clause_id', 'parentClauseId'),
                    clauseLevel: get(c, 'clause_level', 'clauseLevel') || 1,
                    displayOrder: get(c, 'display_order', 'displayOrder') || 0,
                    aiSuggestedName: get(c, 'ai_suggested_name', 'aiSuggestedName'),
                    aiSuggestedCategory: get(c, 'ai_suggested_category', 'aiSuggestedCategory'),
                    aiConfidence: get(c, 'ai_confidence', 'aiConfidence'),
                    aiSuggestion: get(c, 'ai_suggestion', 'aiSuggestion'),
                    mapsToMasterClauseId: get(c, 'maps_to_master_clause_id', 'mapsToMasterClauseId'),
                    mappingConfidence: get(c, 'mapping_confidence', 'mappingConfidence'),
                    verified: get(c, 'verified', 'verified') || false,
                    verifiedByUserId: get(c, 'verified_by_user_id', 'verifiedByUserId'),
                    verifiedAt: get(c, 'verified_at', 'verifiedAt'),
                    status: get(c, 'status', 'status') || 'pending',
                    rejectionReason: get(c, 'rejection_reason', 'rejectionReason'),
                    committedAt: get(c, 'committed_at', 'committedAt'),
                    committedPositionId: get(c, 'committed_position_id', 'committedPositionId'),
                    createdAt: get(c, 'created_at', 'createdAt'),
                    updatedAt: get(c, 'updated_at', 'updatedAt')
                }))

                setClauses(mappedClauses)
                buildCategoryGroups(mappedClauses)

                if (mappedClauses.length > 0 && !selectedClause) {
                    setSelectedClause(mappedClauses[0])
                }
            }
        } catch (err) {
            console.error('Error loading clauses:', err)
        }
    }, [selectedClause])

    const buildCategoryGroups = (clauseList: ContractClause[]) => {
        const groups: { [key: string]: ContractClause[] } = {}

        clauseList.forEach(clause => {
            const cat = clause.category || 'Other'
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(clause)
        })

        Object.keys(groups).forEach(cat => {
            groups[cat].sort((a, b) => a.displayOrder - b.displayOrder)
        })

        const categoryList: CategoryGroup[] = CLAUSE_CATEGORIES
            .filter(cat => groups[cat] && groups[cat].length > 0)
            .map(cat => ({
                category: cat,
                clauses: groups[cat],
                isExpanded: true
            }))

        Object.keys(groups).forEach(cat => {
            if (!CLAUSE_CATEGORIES.includes(cat)) {
                categoryList.push({ category: cat, clauses: groups[cat], isExpanded: true })
            }
        })

        setCategoryGroups(categoryList)
    }

    const toggleParentClauseExpansion = (clauseNumber: string) => {
        setExpandedParentClauses(prev => {
            const newSet = new Set(prev)
            if (newSet.has(clauseNumber)) { newSet.delete(clauseNumber) } else { newSet.add(clauseNumber) }
            return newSet
        })
    }

    const toggleCategoryExpansion = (category: string) => {
        setCategoryGroups(prev => prev.map(g =>
            g.category === category ? { ...g, isExpanded: !g.isExpanded } : g
        ))
    }

    useEffect(() => {
        if (clauses.length > 0 && expandedParentClauses.size === 0) {
            const parentNumbers = clauses.filter(c => c.clauseLevel === 1).map(c => c.clauseNumber)
            setExpandedParentClauses(new Set(parentNumbers))
        }
    }, [clauses])

    const loadSession = useCallback(async (sid: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-session?session_id=${sid}`)
            if (!response.ok) return

            const data = await response.json()
            const session = data.session || data

            if (session) {
                const get = (snake: string, camel: string) => session[snake] ?? session[camel]
                setSessionData({
                    sessionId: get('session_id', 'sessionId') || sid,
                    sessionNumber: get('session_number', 'sessionNumber'),
                    mediationType: get('mediation_type', 'mediationType'),
                    contractType: get('contract_type', 'contractType'),
                    status: get('status', 'status')
                })
            }
        } catch (err) {
            console.error('Error loading session:', err)
        }
    }, [])

    // ========================================================================
    // SECTION 5N: HELPER FUNCTIONS
    // ========================================================================

    const getFilteredClauses = () => {
        if (!searchQuery.trim()) return clauses
        const q = searchQuery.toLowerCase()
        return clauses.filter(c =>
            c.clauseName.toLowerCase().includes(q) ||
            c.clauseNumber.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q) ||
            c.content.toLowerCase().includes(q)
        )
    }

    const getConfiguredCount = () => clauses.filter(c => c.status === 'verified').length
    const getNotConfiguredCount = () => clauses.filter(c => c.status === 'pending').length
    const getExcludedCount = () => clauses.filter(c => c.status === 'rejected').length

    const selectAllUnconfigured = () => {
        const pendingIds = clauses.filter(c => c.status === 'pending').map(c => c.clauseId)
        setSelectedClauseIds(new Set(pendingIds))
    }

    const getPositionLabel = (value: number): string => {
        if (value <= 2) return 'Very Flexible'
        if (value <= 4) return 'Flexible'
        if (value <= 6) return 'Moderate'
        if (value <= 8) return 'Firm'
        return 'Non-Negotiable'
    }

    // Clause selection handler (simple — no range fetching)
    const handleClauseSelect = (clause: ContractClause) => {
        setSelectedClause(clause)
    }

    // ========================================================================
    // SECTION 5D: POLLING FOR PROCESSING STATUS
    // ========================================================================

    const hasLoadedRef = useRef<string | null>(null)

    useEffect(() => {
        if (!contractId) {
            setIsLoading(false)
            addChatMessage('clarence', CLARENCE_MESSAGES.welcome_new)
            return
        }

        if (hasLoadedRef.current === contractId) return

        setIsUploading(false)
        setUploadProgress(null)
        setIsLoading(true)

        let pollCount = 0
        let pollInterval: NodeJS.Timeout | null = null
        let isActive = true

        const poll = async () => {
            if (!isActive) return

            const status = await loadContract(contractId)
            if (!isActive) return

            if (status === 'ready') {
                if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
                hasLoadedRef.current = contractId
                await loadClauses(contractId)
                setIsLoading(false)
            } else if (status === 'failed') {
                if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
                setIsLoading(false)
                setError('Contract processing failed')
            } else if (status === 'processing') {
                setIsLoading(false)
                pollCount++
                if (pollCount >= MAX_POLLING_ATTEMPTS) {
                    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
                    setError('Processing timeout - please try again')
                }
            } else {
                if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
                setIsLoading(false)
            }
        }

        poll()
        pollInterval = setInterval(poll, POLLING_INTERVAL)

        return () => {
            isActive = false
            if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
        }
    }, [contractId])

    useEffect(() => {
        const effectiveSessionId = sessionId || contract?.linkedSessionId
        if (effectiveSessionId) loadSession(effectiveSessionId)
    }, [sessionId, contract?.linkedSessionId, loadSession])

    // ========================================================================
    // SECTION 5E: CHAT MESSAGE MANAGEMENT
    // ========================================================================

    const addChatMessage = useCallback((role: 'clarence' | 'user' | 'system', content: string) => {
        setChatMessages(prev => [...prev, {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role,
            content,
            timestamp: new Date()
        }])
    }, [])

    useEffect(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    useEffect(() => {
        if (contract && contract.status === 'ready' && clauses.length > 0 && chatMessages.length <= 1) {
            addChatMessage('clarence', CLARENCE_MESSAGES.contract_loaded(contract.contractName, clauses.length))
        }
    }, [contract, clauses, chatMessages.length, addChatMessage])

    // ========================================================================
    // SECTION 5F: FILE UPLOAD HANDLERS
    // ========================================================================

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !userInfo) return

        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ]
        const validExtensions = ['.pdf', '.docx', '.txt']
        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
            setError('Please upload a PDF, DOCX, or TXT file')
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB')
            return
        }

        setIsUploading(true)
        setError(null)
        addChatMessage('clarence', CLARENCE_MESSAGES.processing)

        try {
            setUploadProgress('Extracting text from document...')

            let documentText = ''
            if (file.type === 'application/pdf' || fileExt === '.pdf') {
                documentText = await extractTextFromPdf(file)
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExt === '.docx') {
                documentText = await extractTextFromDocx(file)
            } else {
                documentText = await extractTextFromTxt(file)
            }

            if (documentText.length < 100) throw new Error('Document appears to be empty or could not be read')

            setUploadProgress('Uploading for analysis...')

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo.userId,
                    company_id: userInfo.companyId,
                    session_id: sessionId || null,
                    file_name: file.name,
                    file_type: fileExt.replace('.', ''),
                    file_size: file.size,
                    document_text: documentText,
                    template_name: file.name.replace(/\.[^/.]+$/, '')
                })
            })

            if (!response.ok) throw new Error('Upload failed')

            const result = await response.json()

            if (result.contractId || result.contract_id) {
                const newContractId = result.contractId || result.contract_id
                setUploadProgress('Contract uploaded! Starting analysis...')

                const newUrl = sessionId
                    ? `/auth/contract-prep?contract_id=${newContractId}&session_id=${sessionId}`
                    : `/auth/contract-prep?contract_id=${newContractId}`
                router.push(newUrl)
                return
            } else {
                throw new Error('No contract ID returned from upload')
            }
        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Upload failed')
            setIsUploading(false)
            setUploadProgress(null)
        }
    }

    // ========================================================================
    // SECTION 5G: CLAUSE ACTION HANDLERS
    // ========================================================================

    const handleVerifyClause = async (clause: ContractClause) => {
        if (!userInfo) return

        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: clause.contractId,
                    clause_id: clause.clauseId,
                    user_id: userInfo.userId,
                    status: 'verified'
                })
            })

            if (!response.ok) throw new Error('Failed to verify clause')

            setClauses(prev => prev.map(c =>
                c.clauseId === clause.clauseId ? { ...c, status: 'verified', verified: true } : c
            ))
            const updatedClauses = clauses.map(c =>
                c.clauseId === clause.clauseId ? { ...c, status: 'verified' as const, verified: true } : c
            )
            buildCategoryGroups(updatedClauses)
            addChatMessage('system', CLARENCE_MESSAGES.clause_verified(clause.clauseName))
        } catch (err) {
            console.error('Error verifying clause:', err)
            setError('Failed to verify clause')
        }
    }

    const handleRejectClause = async (clause: ContractClause, reason: string) => {
        if (!userInfo) return

        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: clause.contractId,
                    clause_id: clause.clauseId,
                    user_id: userInfo.userId,
                    status: 'rejected',
                    rejection_reason: reason
                })
            })

            if (!response.ok) throw new Error('Failed to reject clause')

            setClauses(prev => prev.map(c =>
                c.clauseId === clause.clauseId ? { ...c, status: 'rejected', rejectionReason: reason } : c
            ))
            const updatedClauses = clauses.map(c =>
                c.clauseId === clause.clauseId ? { ...c, status: 'rejected' as const, rejectionReason: reason } : c
            )
            buildCategoryGroups(updatedClauses)
            addChatMessage('system', CLARENCE_MESSAGES.clause_rejected(clause.clauseName))
        } catch (err) {
            console.error('Error rejecting clause:', err)
            setError('Failed to reject clause')
        }
    }

    const handleSaveEdit = async () => {
        if (!editingClause || !userInfo) return

        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: editingClause.contractId,
                    clause_id: editingClause.clauseId,
                    user_id: userInfo.userId,
                    status: 'verified',
                    verified_name: editName,
                    verified_category: editCategory,
                    content: editContent
                })
            })

            if (!response.ok) throw new Error('Failed to save changes')

            setClauses(prev => prev.map(c =>
                c.clauseId === editingClause.clauseId
                    ? { ...c, clauseName: editName, category: editCategory, content: editContent, status: 'verified', verified: true }
                    : c
            ))

            if (selectedClause?.clauseId === editingClause.clauseId) {
                setSelectedClause({
                    ...selectedClause,
                    clauseName: editName,
                    category: editCategory,
                    content: editContent,
                    status: 'verified',
                    verified: true
                })
            }

            const updatedClauses = clauses.map(c =>
                c.clauseId === editingClause.clauseId
                    ? { ...c, clauseName: editName, category: editCategory, content: editContent, status: 'verified' as const, verified: true }
                    : c
            )
            buildCategoryGroups(updatedClauses)
            setEditingClause(null)
            addChatMessage('system', CLARENCE_MESSAGES.clause_verified(editName))
        } catch (err) {
            console.error('Error saving edit:', err)
            setError('Failed to save changes')
        }
    }

    // ========================================================================
    // SECTION 5H: BULK SELECTION HANDLERS
    // ========================================================================

    const toggleClauseSelection = (clauseId: string, event?: React.MouseEvent) => {
        if (event) event.stopPropagation()
        setSelectedClauseIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(clauseId)) { newSet.delete(clauseId) } else { newSet.add(clauseId) }
            return newSet
        })
    }

    const selectAllClauses = () => {
        setSelectedClauseIds(new Set(clauses.map(c => c.clauseId)))
    }

    const selectAllInCategory = (category: string) => {
        const categoryClauseIds = clauses.filter(c => c.category === category).map(c => c.clauseId)
        setSelectedClauseIds(prev => {
            const newSet = new Set(prev)
            categoryClauseIds.forEach(id => newSet.add(id))
            return newSet
        })
    }

    const clearSelection = () => { setSelectedClauseIds(new Set()) }

    const handleBulkVerify = async () => {
        if (!userInfo || selectedClauseIds.size === 0) return
        setIsBulkProcessing(true)
        const clausesToVerify = clauses.filter(c => selectedClauseIds.has(c.clauseId) && c.status === 'pending')

        try {
            for (const clause of clausesToVerify) {
                await fetch(`${API_BASE}/update-parsed-clause`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contract_id: clause.contractId,
                        clause_id: clause.clauseId,
                        user_id: userInfo.userId,
                        status: 'verified'
                    })
                })
            }
            setClauses(prev => prev.map(c =>
                selectedClauseIds.has(c.clauseId) && c.status === 'pending' ? { ...c, status: 'verified', verified: true } : c
            ))
            const updatedClauses = clauses.map(c =>
                selectedClauseIds.has(c.clauseId) && c.status === 'pending' ? { ...c, status: 'verified' as const, verified: true } : c
            )
            buildCategoryGroups(updatedClauses)
            addChatMessage('system', `✅ Verified ${clausesToVerify.length} clauses`)
            clearSelection()
        } catch (err) {
            console.error('Error bulk verifying:', err)
            setError('Failed to verify some clauses')
        } finally {
            setIsBulkProcessing(false)
        }
    }

    const handleBulkExclude = async () => {
        if (!userInfo || selectedClauseIds.size === 0) return
        setIsBulkProcessing(true)
        const clausesToExclude = clauses.filter(c => selectedClauseIds.has(c.clauseId))

        try {
            for (const clause of clausesToExclude) {
                await fetch(`${API_BASE}/update-parsed-clause`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contract_id: clause.contractId,
                        clause_id: clause.clauseId,
                        user_id: userInfo.userId,
                        status: 'rejected',
                        rejection_reason: 'Bulk excluded'
                    })
                })
            }
            setClauses(prev => prev.map(c =>
                selectedClauseIds.has(c.clauseId) ? { ...c, status: 'rejected', rejectionReason: 'Bulk excluded' } : c
            ))
            const updatedClauses = clauses.map(c =>
                selectedClauseIds.has(c.clauseId) ? { ...c, status: 'rejected' as const, rejectionReason: 'Bulk excluded' } : c
            )
            buildCategoryGroups(updatedClauses)
            addChatMessage('system', `✕ Excluded ${clausesToExclude.length} clauses from negotiation`)
            clearSelection()
        } catch (err) {
            console.error('Error bulk excluding:', err)
            setError('Failed to exclude some clauses')
        } finally {
            setIsBulkProcessing(false)
        }
    }

    // ========================================================================
    // SECTION 5I: DELETE CLAUSE HANDLERS
    // ========================================================================

    const confirmDeleteClause = (clause: ContractClause) => {
        setClauseToDelete(clause)
        setDeleteTarget('single')
        setShowDeleteConfirm(true)
    }

    const confirmBulkDelete = () => {
        setDeleteTarget('bulk')
        setShowDeleteConfirm(true)
    }

    const handleDeleteClause = async (clause: ContractClause) => {
        if (!userInfo || !contract) return
        setIsDeleting(true)
        try {
            const response = await fetch(`${API_BASE}/delete-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: contract.contractId, clause_id: clause.clauseId, user_id: userInfo.userId })
            })
            if (!response.ok) throw new Error('Failed to delete clause')

            const updatedClauses = clauses.filter(c => c.clauseId !== clause.clauseId)
            setClauses(updatedClauses)
            buildCategoryGroups(updatedClauses)
            if (selectedClause?.clauseId === clause.clauseId) {
                setSelectedClause(updatedClauses.length > 0 ? updatedClauses[0] : null)
            }
            setSelectedClauseIds(prev => { const s = new Set(prev); s.delete(clause.clauseId); return s })
            setContract(prev => prev ? { ...prev, clauseCount: (prev.clauseCount || 1) - 1 } : null)
            addChatMessage('system', CLARENCE_MESSAGES.clause_deleted(clause.clauseName))
        } catch (err) {
            console.error('Error deleting clause:', err)
            setError('Failed to delete clause')
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
            setClauseToDelete(null)
        }
    }

    const handleBulkDelete = async () => {
        if (!userInfo || !contract || selectedClauseIds.size === 0) return
        setIsDeleting(true)
        const clausesToDelete = clauses.filter(c => selectedClauseIds.has(c.clauseId))

        try {
            for (const clause of clausesToDelete) {
                await fetch(`${API_BASE}/delete-parsed-clause`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contract_id: contract.contractId, clause_id: clause.clauseId, user_id: userInfo.userId })
                })
            }
            const updatedClauses = clauses.filter(c => !selectedClauseIds.has(c.clauseId))
            setClauses(updatedClauses)
            buildCategoryGroups(updatedClauses)
            if (selectedClause && selectedClauseIds.has(selectedClause.clauseId)) {
                setSelectedClause(updatedClauses.length > 0 ? updatedClauses[0] : null)
            }
            setContract(prev => prev ? { ...prev, clauseCount: (prev.clauseCount || clausesToDelete.length) - clausesToDelete.length } : null)
            addChatMessage('system', CLARENCE_MESSAGES.clauses_deleted(clausesToDelete.length))
            clearSelection()
        } catch (err) {
            console.error('Error bulk deleting:', err)
            setError('Failed to delete some clauses')
        } finally {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    // ========================================================================
    // SECTION 5J: REORDER CLAUSE HANDLERS
    // ========================================================================

    const handleMoveClause = async (clause: ContractClause, direction: 'up' | 'down') => {
        if (!userInfo || !contract) return
        const sortedClauses = [...clauses].sort((a, b) => a.displayOrder - b.displayOrder)
        const currentIndex = sortedClauses.findIndex(c => c.clauseId === clause.clauseId)
        if (currentIndex === -1) return
        if (direction === 'up' && currentIndex === 0) return
        if (direction === 'down' && currentIndex === sortedClauses.length - 1) return

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
        const targetClause = sortedClauses[targetIndex]
        const newOrder1 = targetClause.displayOrder
        const newOrder2 = clause.displayOrder

        setIsReordering(true)
        try {
            await fetch(`${API_BASE}/update-clause-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: contract.contractId, clause_id: clause.clauseId, display_order: newOrder1, user_id: userInfo.userId })
            })
            await fetch(`${API_BASE}/update-clause-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: contract.contractId, clause_id: targetClause.clauseId, display_order: newOrder2, user_id: userInfo.userId })
            })
            const updatedClauses = clauses.map(c => {
                if (c.clauseId === clause.clauseId) return { ...c, displayOrder: newOrder1 }
                if (c.clauseId === targetClause.clauseId) return { ...c, displayOrder: newOrder2 }
                return c
            })
            setClauses(updatedClauses)
            buildCategoryGroups(updatedClauses)
        } catch (err) {
            console.error('Error reordering clause:', err)
            setError('Failed to reorder clause')
        } finally {
            setIsReordering(false)
        }
    }

    // ========================================================================
    // SECTION 5K: POSITION SCALE HANDLERS (legacy — for bulk verify compat)
    // ========================================================================

    const updateClausePosition = (clauseId: string, field: 'customerPosition' | 'providerPosition' | 'importance', value: number | string) => {
        setClausePositions(prev => ({
            ...prev,
            [clauseId]: {
                customerPosition: prev[clauseId]?.customerPosition ?? 5,
                providerPosition: prev[clauseId]?.providerPosition ?? 5,
                importance: prev[clauseId]?.importance ?? 'medium',
                [field]: value
            }
        }))
    }

    // ========================================================================
    // SECTION 5L: CLAUSE LIBRARY FUNCTIONS
    // ========================================================================

    const loadMasterClauses = async () => {
        setLibraryLoading(true)
        try {
            const response = await fetch(`${API_BASE}/get-master-clauses`)
            if (!response.ok) throw new Error('Failed to load clause library')
            const data = await response.json()
            const clausesArray = data.clauses || data
            if (Array.isArray(clausesArray)) {
                const mapped: MasterClause[] = clausesArray.map((c: any) => ({
                    clauseId: c.clause_id || c.clauseId,
                    clauseName: c.clause_name || c.clauseName,
                    category: c.category || c.clause_category || 'Other',
                    description: c.description || '',
                    legalContext: c.legal_context || c.legalContext || null,
                    defaultCustomerPosition: c.default_customer_position || c.defaultCustomerPosition || 5,
                    defaultProviderPosition: c.default_provider_position || c.defaultProviderPosition || 5,
                    isRequired: c.is_required || c.isRequired || false,
                    applicableContractTypes: c.applicable_contract_types || c.applicableContractTypes || []
                }))
                setMasterClauses(mapped)
                setLibraryExpandedCategories(new Set(mapped.map(c => c.category)))
            }
        } catch (err) {
            console.error('Error loading master clauses:', err)
            setError('Failed to load clause library')
        } finally {
            setLibraryLoading(false)
        }
    }

    const toggleMasterClauseSelection = (clauseId: string) => {
        setSelectedMasterClauseIds(prev => {
            const s = new Set(prev)
            if (s.has(clauseId)) { s.delete(clauseId) } else { s.add(clauseId) }
            return s
        })
    }

    const toggleLibraryCategory = (category: string) => {
        setLibraryExpandedCategories(prev => {
            const s = new Set(prev)
            if (s.has(category)) { s.delete(category) } else { s.add(category) }
            return s
        })
    }

    const addSelectedClausesToContract = async () => {
        if (selectedMasterClauseIds.size === 0 || !contract || !userInfo) return
        setIsAddingClauses(true)
        try {
            const selectedClauses = masterClauses.filter(c => selectedMasterClauseIds.has(c.clauseId))
            const response = await fetch(`${API_BASE}/add-clauses-to-contract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    user_id: userInfo.userId,
                    clauses: selectedClauses.map((c, idx) => ({
                        master_clause_id: c.clauseId,
                        clause_name: c.clauseName,
                        category: c.category,
                        content: c.description,
                        display_order: clauses.length + idx + 1,
                        default_customer_position: c.defaultCustomerPosition,
                        default_provider_position: c.defaultProviderPosition
                    }))
                })
            })
            if (!response.ok) throw new Error('Failed to add clauses')
            await loadClauses(contract.contractId)
            setContract(prev => prev ? { ...prev, clauseCount: (prev.clauseCount || 0) + selectedMasterClauseIds.size } : null)
            setSelectedMasterClauseIds(new Set())
            setShowClauseLibrary(false)
            addChatMessage('clarence', `I've added ${selectedMasterClauseIds.size} clause${selectedMasterClauseIds.size > 1 ? 's' : ''} to your contract.`)
        } catch (err) {
            console.error('Error adding clauses:', err)
            setError('Failed to add clauses to contract')
        } finally {
            setIsAddingClauses(false)
        }
    }

    const openClauseLibrary = () => {
        setShowClauseLibrary(true)
        if (masterClauses.length === 0) loadMasterClauses()
    }

    const getFilteredLibraryClauses = () => {
        let filtered = masterClauses
        if (librarySearchQuery.trim()) {
            const query = librarySearchQuery.toLowerCase()
            filtered = masterClauses.filter(c =>
                c.clauseName.toLowerCase().includes(query) || c.category.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
            )
        }
        const groups: { [key: string]: MasterClause[] } = {}
        filtered.forEach(clause => {
            const cat = clause.category || 'Other'
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(clause)
        })
        return groups
    }

    // ========================================================================
    // SECTION 5M: COMMIT & TRANSITION HANDLERS
    // ========================================================================

    const handleCommitClauses = async () => {
        if (!userInfo || !contract) return

        const verifiedClauses = clauses.filter(c => c.status === 'verified')
        if (verifiedClauses.length === 0) return

        setIsCommitting(true)
        const effectiveSessionId = sessionId || contract.linkedSessionId

        if (!effectiveSessionId) {
            setError('No session associated with this contract. Please start from the session creation flow.')
            setIsCommitting(false)
            return
        }

        try {
            const response = await fetch(`${API_BASE}/commit-parsed-clauses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    session_id: effectiveSessionId,
                    user_id: userInfo.userId,
                    clause_ids: verifiedClauses.map(c => c.clauseId),
                    clause_positions: verifiedClauses.map(c => {
                        const userConfig = userPositions[c.clauseId]
                        const recommendation = clarenceRecommendations[c.clauseId]
                        const mapping = rangeMappings[c.clauseId]

                        return {
                            clause_id: c.clauseId,
                            customer_position: userConfig?.position || null,
                            provider_position: null,
                            importance: userConfig?.importance || null,
                            clarence_recommendation: recommendation?.clarencePosition || null,
                            accepted_recommendation: userConfig?.acceptedRecommendation || false,
                            range_mapping_id: mapping?.mappingId || null,
                            position_label: userConfig?.position
                                ? translatePosition(c.clauseId, userConfig.position)
                                : null
                        }
                    })
                })
            })

            if (!response.ok) throw new Error('Failed to commit clauses')
            const result = await response.json()
            addChatMessage('clarence', CLARENCE_MESSAGES.committed(verifiedClauses.length))

            const targetSessionId = result.sessionId || effectiveSessionId
            const params = new URLSearchParams()
            params.set('session_id', targetSessionId)
            if (contract.contractId) params.set('contract_id', contract.contractId)
            if (pathwayId) params.set('pathway_id', pathwayId)

            const redirectUrl = `/auth/invite-providers?${params.toString()}`
            const transition: TransitionConfig = {
                id: 'transition_to_invite',
                fromStage: 'contract_prep',
                toStage: 'invite_providers',
                title: 'Positions Locked In',
                message: "Your contract positions are locked in. Now it's time to invite your provider(s) to the negotiation.",
                bulletPoints: ['Enter their company details', 'Set their own clause positions', 'Submit their negotiation parameters'],
                buttonText: 'Continue to Invite'
            }

            setTimeout(() => {
                setTransitionState({ isOpen: true, transition, redirectUrl })
            }, 1500)
        } catch (err) {
            console.error('Error committing clauses:', err)
            setError('Failed to commit clauses')
        } finally {
            setIsCommitting(false)
        }
    }

    const handleTransitionContinue = () => {
        const { redirectUrl } = transitionState
        setTransitionState({ isOpen: false, transition: null, redirectUrl: null })
        if (redirectUrl) router.push(redirectUrl)
    }

    // ========================================================================
    // SECTION 5R: INTELLIGENCE PIPELINE
    // Loads AI range mappings and Clarence recommendations from
    // clause_range_mappings and uploaded_contract_clauses tables.
    // Matches REAL DB schema verified via SQL queries.
    // ========================================================================

    // ── 5R-1: Load Range Mappings ──────────────────────────────────────────
    // Maps real DB columns: mapping_id, value_type, range_unit,
    // industry_standard_min/max, is_displayable, range_data (JSONB)

    const loadRangeMappings = useCallback(async (targetContractId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-clause-range-mappings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: targetContractId })
            })
            if (!response.ok) { console.warn('Range mappings not yet available'); return 0 }
            const data = await response.json()

            if (data.success && data.mappings) {
                const mappingsRecord: Record<string, AIRangeMapping> = {}
                let displayableCount = 0

                for (const row of data.mappings) {
                    const mapping: AIRangeMapping = {
                        mappingId: row.mapping_id,
                        clauseId: row.clause_id,
                        contractId: row.contract_id,
                        valueType: row.value_type,
                        rangeUnit: row.range_unit || null,
                        industryStandardMin: row.industry_standard_min ? parseFloat(row.industry_standard_min) : null,
                        industryStandardMax: row.industry_standard_max ? parseFloat(row.industry_standard_max) : null,
                        isDisplayable: row.is_displayable || false,
                        sourceType: row.source_type || 'ai_generated',
                        generatedBy: row.generated_by || '',
                        rangeData: row.range_data || { scale_points: [], interpolation: 'stepped', format_pattern: '', display_precision: 0 },
                        generatedAt: row.generated_at || ''
                    }
                    mappingsRecord[row.clause_id] = mapping
                    if (mapping.isDisplayable && mapping.rangeData.scale_points?.length > 0) displayableCount++
                }

                setRangeMappings(prev => ({ ...prev, ...mappingsRecord }))
                return displayableCount
            }
            return 0
        } catch (err) {
            console.error('Error loading range mappings:', err)
            return 0
        }
    }, [])

    // ── 5R-2: Load Clarence Recommendations ────────────────────────────────
    // Reads clarence_position (numeric), ai_confidence (numeric), ai_suggestion (text)

    const loadClarenceRecommendations = useCallback(async (targetContractId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-clarence-recommendations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: targetContractId })
            })
            if (!response.ok) { console.warn('Clarence recommendations not yet available'); return 0 }
            const data = await response.json()

            if (data.success && data.recommendations) {
                const recsRecord: Record<string, CertificationResult> = {}
                let certifiedCount = 0

                for (const rec of data.recommendations) {
                    const position = rec.clarence_position !== null && rec.clarence_position !== undefined
                        ? parseFloat(rec.clarence_position) : null

                    if (position !== null && !isNaN(position)) {
                        recsRecord[rec.clause_id] = {
                            clauseId: rec.clause_id,
                            clarencePosition: Math.round(position),
                            confidence: rec.ai_confidence ? parseFloat(rec.ai_confidence) : 0,
                            rationale: rec.ai_suggestion || rec.clarence_assessment || '',
                            fairness: rec.clarence_fairness || 'balanced',
                            summary: rec.clarence_summary || '',
                            assessment: rec.clarence_assessment || '',
                            status: 'certified'
                        }
                        certifiedCount++
                    }
                }

                setClarenceRecommendations(prev => ({ ...prev, ...recsRecord }))
                return certifiedCount
            }
            return 0
        } catch (err) {
            console.error('Error loading Clarence recommendations:', err)
            return 0
        }
    }, [])

    // ── 5R-3: Trigger Certification ────────────────────────────────────────

    const triggerCertification = useCallback(async (targetContractId: string) => {
        try {
            const response = await fetch(`${API_BASE}/trigger-certification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: targetContractId,
                    session_id: sessionId,
                    user_id: userInfo?.userId,
                    source: 'contract_prep'
                })
            })
            const data = await response.json()
            if (data.success) {
                setCertificationProgress({ total: data.total_clauses || clauses.length, completed: 0, currentClauseName: null, status: 'running' })
                startCertificationPolling(targetContractId)
                addChatMessage('clarence',
                    `I'm now analyzing your **${data.total_clauses || clauses.length} clauses** to generate position recommendations and range mappings. This runs in the background — you can start reviewing clauses while I work.`
                )
            }
        } catch (err) {
            console.error('Error triggering certification:', err)
            startCertificationPolling(targetContractId)
        }
    }, [sessionId, userInfo, clauses.length])

    // ── 5R-4: Certification Polling ────────────────────────────────────────

    const startCertificationPolling = useCallback((targetContractId: string) => {
        if (certificationPollRef.current) clearInterval(certificationPollRef.current)
        certificationPollCountRef.current = 0
        setCertificationProgress(prev => ({ ...prev, status: 'running' }))

        certificationPollRef.current = setInterval(async () => {
            certificationPollCountRef.current++
            if (certificationPollCountRef.current >= CERTIFICATION_MAX_POLLS) {
                stopCertificationPolling()
                setCertificationProgress(prev => ({ ...prev, status: 'error', errorMessage: 'Certification timed out.' }))
                return
            }
            try {
                const certifiedCount = await loadClarenceRecommendations(targetContractId) || 0
                await loadRangeMappings(targetContractId)
                const totalClauses = clauses.length
                setCertificationProgress(prev => ({ ...prev, total: totalClauses, completed: certifiedCount }))

                if (certifiedCount >= totalClauses && totalClauses > 0) {
                    stopCertificationPolling()
                    setCertificationProgress({ total: totalClauses, completed: certifiedCount, currentClauseName: null, status: 'complete' })
                    addChatMessage('clarence', `Analysis complete! I've generated recommendations for all **${totalClauses} clauses** with real-world range mappings.`)
                }
            } catch (err) {
                console.error('Certification poll error:', err)
            }
        }, CERTIFICATION_POLL_INTERVAL)
    }, [clauses.length, loadClarenceRecommendations, loadRangeMappings])

    const stopCertificationPolling = useCallback(() => {
        if (certificationPollRef.current) { clearInterval(certificationPollRef.current); certificationPollRef.current = null }
    }, [])

    useEffect(() => { return () => stopCertificationPolling() }, [stopCertificationPolling])

    // ── 5R-5: Auto-load intelligence after clauses load ────────────────────

    useEffect(() => {
        if (clauses.length > 0 && contract?.status === 'ready' && contract?.contractId &&
            Object.keys(clarenceRecommendations).length === 0 && certificationProgress.status === 'idle') {
            const checkAndLoadIntelligence = async () => {
                const existingRecs = await loadClarenceRecommendations(contract.contractId)
                await loadRangeMappings(contract.contractId)

                if (existingRecs && existingRecs >= clauses.length) {
                    setCertificationProgress({ total: clauses.length, completed: existingRecs, currentClauseName: null, status: 'complete' })
                } else if (existingRecs && existingRecs > 0) {
                    setCertificationProgress({ total: clauses.length, completed: existingRecs, currentClauseName: null, status: 'running' })
                    startCertificationPolling(contract.contractId)
                } else {
                    triggerCertification(contract.contractId)
                }
            }
            checkAndLoadIntelligence()
        }
    }, [clauses.length, contract?.status, contract?.contractId])

    // —— 5R-6: Translate Position to Real-World Value (Rich) ————————————————

    const translatePositionRich = (clauseId: string, position: number): { value: number; label: string; description: string } | null => {
        const mapping = rangeMappings[clauseId]
        if (!mapping || !mapping.isDisplayable || !mapping.rangeData?.scale_points?.length) return null

        const points = mapping.rangeData.scale_points

        // Exact match
        const exact = points.find(p => Math.abs(p.position - position) < 0.1)
        if (exact) return exact

        // Interpolation
        const lower = [...points].filter(p => p.position <= position).pop()
        const upper = points.find(p => p.position > position)

        if (!lower || !upper) {
            return position <= points[0].position ? points[0] : points[points.length - 1]
        }

        const fraction = (position - lower.position) / (upper.position - lower.position)
        let interpolatedValue: number

        if (mapping.rangeData.interpolation === 'logarithmic') {
            const logLower = Math.log(lower.value || 1)
            const logUpper = Math.log(upper.value || 1)
            interpolatedValue = Math.exp(logLower + fraction * (logUpper - logLower))
        } else if (mapping.rangeData.interpolation === 'stepped') {
            return lower
        } else {
            interpolatedValue = lower.value + fraction * (upper.value - lower.value)
        }

        const precision = mapping.rangeData.display_precision ?? 0
        const rounded = Number(interpolatedValue.toFixed(precision))

        const label = mapping.rangeData.format_pattern
            .replace('{value}', rounded.toLocaleString())
            .replace('{unit}', mapping.rangeUnit || '')
            .trim()

        return {
            value: rounded,
            label: label,
            description: `Between ${lower.label} and ${upper.label}`
        }
    }

    // String version for backward compatibility
    const translatePosition = (clauseId: string, position: number): string => {
        const rich = translatePositionRich(clauseId, position)
        if (rich) return rich.label
        const mapping = rangeMappings[clauseId]
        if (!mapping || !mapping.isDisplayable || !mapping.rangeData?.scale_points?.length) return `Position ${position}`
        const exact = mapping.rangeData.scale_points.find(sp => sp.position === position)
        if (exact) return exact.label
        const sorted = [...mapping.rangeData.scale_points].sort((a, b) => Math.abs(a.position - position) - Math.abs(b.position - position))
        return sorted[0]?.label || `Position ${position}`
    }

    // —— 5R-7: Get Scale Point Details ——————————————————————————————————————

    const getScalePointForPosition = (clauseId: string, position: number): ScalePoint | null => {
        const mapping = rangeMappings[clauseId]
        if (!mapping || !mapping.isDisplayable || !mapping.rangeData?.scale_points?.length) return null
        // Exact match first
        const exact = mapping.rangeData.scale_points.find(sp => Math.abs(sp.position - position) < 0.1)
        if (exact) return exact
        // Nearest match
        const sorted = [...mapping.rangeData.scale_points].sort((a, b) => Math.abs(a.position - position) - Math.abs(b.position - position))
        return sorted[0] || null
    }

    // ── 5R-8: Get Zone For Position ────────────────────────────────────────

    const getZoneForPosition = (clauseId: string, position: number): { zone: string; colors: typeof ZONE_COLORS[keyof typeof ZONE_COLORS] } => {
        const mapping = rangeMappings[clauseId]
        const min = mapping?.industryStandardMin ?? 4
        const max = mapping?.industryStandardMax ?? 7
        if (position < min) return { zone: 'Provider Favourable', colors: ZONE_COLORS.providerFavourable }
        if (position <= max) return { zone: 'Industry Standard', colors: ZONE_COLORS.balanced }
        return { zone: 'Customer Favourable', colors: ZONE_COLORS.customerFavourable }
    }

    // ── 5R-9: User Position Management ─────────────────────────────────────

    const setUserClausePosition = (clauseId: string, position: number) => {
        const recommendation = clarenceRecommendations[clauseId]
        setUserPositions(prev => ({
            ...prev,
            [clauseId]: {
                ...prev[clauseId],
                position, importance: prev[clauseId]?.importance || 'medium',
                rationale: prev[clauseId]?.rationale || '',
                acceptedRecommendation: recommendation ? position === recommendation.clarencePosition : false
            }
        }))
    }

    const setUserClauseImportance = (clauseId: string, importance: 'low' | 'medium' | 'high' | 'critical') => {
        setUserPositions(prev => ({
            ...prev,
            [clauseId]: { ...prev[clauseId], position: prev[clauseId]?.position || 5, importance, rationale: prev[clauseId]?.rationale || '', acceptedRecommendation: prev[clauseId]?.acceptedRecommendation || false }
        }))
    }

    const setUserClauseRationale = (clauseId: string, rationale: string) => {
        setUserPositions(prev => ({
            ...prev,
            [clauseId]: { ...prev[clauseId], position: prev[clauseId]?.position || 5, importance: prev[clauseId]?.importance || 'medium', rationale, acceptedRecommendation: prev[clauseId]?.acceptedRecommendation || false }
        }))
    }

    // ── 5R-10: Accept Clarence Recommendation ──────────────────────────────

    const acceptClarenceRecommendation = (clauseId: string) => {
        const recommendation = clarenceRecommendations[clauseId]
        if (!recommendation) return
        setUserPositions(prev => ({
            ...prev,
            [clauseId]: { ...prev[clauseId], position: recommendation.clarencePosition, importance: prev[clauseId]?.importance || 'medium', rationale: prev[clauseId]?.rationale || '', acceptedRecommendation: true }
        }))
    }

    // ── 5R-11: Save & Configure Clause ─────────────────────────────────────

    const saveAndConfigureClause = async (clauseId: string) => {
        if (!userInfo || !contract) return
        const clause = clauses.find(c => c.clauseId === clauseId)
        if (!clause) return
        const userConfig = userPositions[clauseId]
        if (!userConfig || !userConfig.position) { setError('Please set a position before configuring this clause'); return }

        try {
            const positionResponse = await fetch(`${API_BASE}/update-clause-position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId, clause_id: clauseId, user_id: userInfo.userId,
                    customer_position: userConfig.position, importance: userConfig.importance,
                    rationale: userConfig.rationale,
                    clarence_recommendation: clarenceRecommendations[clauseId]?.clarencePosition || null,
                    accepted_recommendation: userConfig.acceptedRecommendation
                })
            })
            if (!positionResponse.ok) { const errData = await positionResponse.json().catch(() => ({})); throw new Error(errData.error || 'Failed to save position') }

            const statusResponse = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: contract.contractId, clause_id: clauseId, user_id: userInfo.userId, status: 'verified' })
            })
            if (!statusResponse.ok) throw new Error('Failed to update clause status')

            setClauses(prev => prev.map(c => c.clauseId === clauseId ? { ...c, status: 'verified', verified: true } : c))
            setSelectedClauseIds(prev => { const s = new Set(prev); s.add(clauseId); return s })
            buildCategoryGroups(clauses.map(c => c.clauseId === clauseId ? { ...c, status: 'verified' as const, verified: true } : c))

            const posLabel = translatePosition(clauseId, userConfig.position)
            addChatMessage('system', `✓ **${clause.clauseName}** configured at position ${userConfig.position} (${posLabel})`)
        } catch (err) {
            console.error('Error saving and configuring clause:', err)
            setError('Failed to save clause configuration')
        }
    }

    // ── 5R-12: Exclude Clause ──────────────────────────────────────────────

    const excludeClause = async (clause: ContractClause) => {
        if (!userInfo) return
        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_id: clause.contractId, clause_id: clause.clauseId, user_id: userInfo.userId, status: 'rejected', rejection_reason: 'User excluded from negotiation' })
            })
            if (!response.ok) throw new Error('Failed to exclude clause')
            setClauses(prev => prev.map(c => c.clauseId === clause.clauseId ? { ...c, status: 'rejected', rejectionReason: 'User excluded from negotiation' } : c))
            buildCategoryGroups(clauses.map(c => c.clauseId === clause.clauseId ? { ...c, status: 'rejected' as const } : c))
            addChatMessage('system', `✕ **${clause.clauseName}** excluded from negotiation`)
            if (selectedClause?.clauseId === clause.clauseId) {
                const nextClause = clauses.find(c => c.clauseId !== clause.clauseId && c.status === 'pending')
                if (nextClause) handleClauseSelect(nextClause)
            }
        } catch (err) {
            console.error('Error excluding clause:', err)
            setError('Failed to exclude clause')
        }
    }

    // ── 5R-13: Intelligence Helpers ────────────────────────────────────────

    const hasRangeMapping = (clauseId: string): boolean => {
        const m = rangeMappings[clauseId]
        return !!m && m.isDisplayable && m.rangeData?.scale_points?.length > 0
    }

    const hasRecommendation = (clauseId: string): boolean => {
        const r = clarenceRecommendations[clauseId]
        return !!r && r.status === 'certified' && r.clarencePosition > 0
    }

    const hasUserPosition = (clauseId: string): boolean => {
        return !!userPositions[clauseId] && userPositions[clauseId].position > 0
    }

    const getClauseIntelligenceStatus = (clauseId: string): 'none' | 'partial' | 'full' => {
        const hasRange = hasRangeMapping(clauseId)
        const hasRec = hasRecommendation(clauseId)
        if (hasRange && hasRec) return 'full'
        if (hasRange || hasRec) return 'partial'
        return 'none'
    }

    const getReadinessMetrics = () => {
        const total = clauses.length
        const configured = clauses.filter(c => c.status === 'verified').length
        const excluded = clauses.filter(c => c.status === 'rejected').length
        return {
            total, configured, excluded,
            pending: total - configured - excluded,
            withIntelligence: clauses.filter(c => hasRangeMapping(c.clauseId)).length,
            withRecommendation: clauses.filter(c => hasRecommendation(c.clauseId)).length,
            readinessPercent: total > 0 ? Math.round(((configured + excluded) / total) * 100) : 0
        }
    }

    // ========================================================================
    // SECTION 7: RENDER - LEFT PANEL (Clause Navigation — cleaned)
    // ========================================================================

    const renderLeftPanel = () => {
        const filteredClauses = getFilteredClauses()
        const documentOrderClauses = [...filteredClauses].sort((a, b) => a.displayOrder - b.displayOrder)
        const filteredCategories = categoryGroups.filter(g =>
            g.clauses.some(c => filteredClauses.find(fc => fc.clauseId === c.clauseId))
        )

        const configuredCount = getConfiguredCount()

        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-slate-800 to-slate-700">
                    <Link href="/auth/contracts-dashboard" className="text-sm text-slate-400 hover:text-white flex items-center gap-1 mb-2">
                        ← Back to Dashboard
                    </Link>
                    <h2 className="text-lg font-semibold text-white">Contract Prep</h2>
                    {contract && (
                        <p className="text-sm text-slate-400 truncate" title={contract.contractName}>{contract.contractName}</p>
                    )}

                    {/* Enhanced Progress Section */}
                    {clauses.length > 0 && (
                        <div className="mt-3">
                            {/* Readiness bar */}
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-emerald-400 font-medium">{configuredCount} of {clauses.length} configured</span>
                                <span className="text-white font-bold">{Math.round((configuredCount / clauses.length) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-600 rounded-full h-2.5">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${(configuredCount / clauses.length) * 100}%` }} />
                            </div>

                            {/* Intelligence progress */}
                            <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-purple-400 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                                        {Object.keys(clarenceRecommendations).length} analyzed
                                    </span>
                                    <span className="text-blue-400 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                        {Object.keys(rangeMappings).length} mapped
                                    </span>
                                </div>
                            </div>

                            {/* Certification Progress */}
                            {certificationProgress.status === 'running' && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <span>Analyzing: {certificationProgress.completed}/{certificationProgress.total}</span>
                                </div>
                            )}
                            {certificationProgress.status === 'complete' && (
                                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                                    <span>✔</span> All clauses analyzed
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="p-3 border-b border-slate-200">
                    <input type="text" placeholder="Search clauses..." value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>

                {/* View Mode Toggle */}
                <div className="px-4 py-2 border-b border-slate-200 bg-slate-100">
                    <div className="flex items-center gap-1 p-1 bg-slate-200 rounded-lg">
                        <button onClick={() => setViewMode('document')}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'document' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                            📄 Document Order
                        </button>
                        <button onClick={() => setViewMode('category')}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'category' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                            📁 By Category
                        </button>
                    </div>
                </div>

                {/* Selection Controls */}
                {clauses.length > 0 && (
                    <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                {getConfiguredCount()}
                            </span>
                            <span className="text-slate-500 flex items-center gap-1">
                                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                                {getNotConfiguredCount()}
                            </span>
                            <span className="text-red-500 flex items-center gap-1">
                                <span className="w-2 h-2 bg-red-400 rounded-full" />
                                {getExcludedCount()}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={selectAllClauses} className="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50 font-medium">All</button>
                            <button onClick={selectAllUnconfigured} className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100">Unconfigured</button>
                            {selectedClauseIds.size > 0 && (
                                <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-200">Clear</button>
                            )}
                        </div>
                    </div>
                )}

                {/* Clause Navigation - Document Order */}
                <div className="flex-1 overflow-auto">
                    {viewMode === 'document' ? (
                        documentOrderClauses.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">{searchQuery ? 'No clauses match your search' : 'No clauses found'}</div>
                        ) : (
                            <div className="bg-white">
                                {(() => {
                                    const parentClauses = documentOrderClauses.filter(c => c.clauseLevel === 1)
                                    const getChildClauses = (parentNumber: string) =>
                                        documentOrderClauses.filter(c => c.clauseLevel !== 1 && c.clauseNumber.startsWith(parentNumber + '.'))

                                    return parentClauses.map(parent => {
                                        const children = getChildClauses(parent.clauseNumber)
                                        const isExpanded = expandedParentClauses.has(parent.clauseNumber)
                                        const hasChildren = children.length > 0
                                        const isSelected = selectedClauseIds.has(parent.clauseId)
                                        const intellStatus = getClauseIntelligenceStatus(parent.clauseId)

                                        return (
                                            <div key={parent.clauseId} className="border-b border-slate-200">
                                                <div className={`w-full px-2 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${selectedClause?.clauseId === parent.clauseId ? 'bg-emerald-50 border-l-3 border-l-emerald-500' : 'hover:bg-slate-50'}`}>
                                                    <button onClick={(e) => toggleClauseSelection(parent.clauseId, e)}
                                                        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 hover:border-emerald-400'}`}>
                                                        {isSelected && <span className="text-white text-xs">✓</span>}
                                                    </button>
                                                    {hasChildren ? (
                                                        <button onClick={(e) => { e.stopPropagation(); toggleParentClauseExpansion(parent.clauseNumber) }}
                                                            className={`transform transition-transform text-slate-400 hover:text-slate-600 ${isExpanded ? 'rotate-90' : ''}`}>▶</button>
                                                    ) : <span className="w-3" />}
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${parent.status === 'verified' ? 'bg-emerald-500' : parent.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                                    <button onClick={() => handleClauseSelect(parent)} className="flex-1 min-w-0 text-left">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500 text-xs font-mono font-medium">{parent.clauseNumber}</span>
                                                            <span className="font-medium text-slate-700 truncate">{parent.clauseName}</span>
                                                        </div>
                                                        {/* Mini intelligence summary */}
                                                        {intellStatus !== 'none' && (
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {clarenceRecommendations[parent.clauseId] && (
                                                                    <span className="text-[10px] text-purple-500 font-medium">
                                                                        C:{clarenceRecommendations[parent.clauseId].clarencePosition}
                                                                    </span>
                                                                )}
                                                                {userPositions[parent.clauseId]?.position && (
                                                                    <span className="text-[10px] text-emerald-600 font-medium">
                                                                        You:{userPositions[parent.clauseId].position}
                                                                    </span>
                                                                )}
                                                                {rangeMappings[parent.clauseId]?.isDisplayable && (
                                                                    <span className="text-[10px] text-blue-400">mapped</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </button>
                                                    {intellStatus === 'full' && <span className="text-purple-500 text-xs" title="AI analyzed">⚡</span>}
                                                    {intellStatus === 'partial' && <span className="text-amber-400 text-xs" title="Partially analyzed">◐</span>}
                                                    {hasChildren && <span className="text-xs text-slate-400">{children.length}</span>}
                                                </div>
                                                {isExpanded && hasChildren && (
                                                    <div className="bg-slate-50">
                                                        {children.map(child => {
                                                            const indentClass = child.clauseLevel === 2 ? 'pl-10' : child.clauseLevel === 3 ? 'pl-14' : 'pl-18'
                                                            const isChildSelected = selectedClauseIds.has(child.clauseId)
                                                            return (
                                                                <div key={child.clauseId}
                                                                    className={`w-full px-2 py-2 ${indentClass} text-left text-sm transition-colors flex items-center gap-2 border-t border-slate-100 ${selectedClause?.clauseId === child.clauseId ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50'}`}>
                                                                    <button onClick={(e) => toggleClauseSelection(child.clauseId, e)}
                                                                        className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isChildSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 hover:border-emerald-400'}`}>
                                                                        {isChildSelected && <span className="text-white text-xs">✓</span>}
                                                                    </button>
                                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${child.status === 'verified' ? 'bg-emerald-500' : child.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                                                    <button onClick={() => handleClauseSelect(child)} className="flex-1 min-w-0 text-left">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-slate-400 text-xs font-mono">{child.clauseNumber}</span>
                                                                            <span className="truncate text-slate-600">{child.clauseName}</span>
                                                                        </div>
                                                                        {/* Mini intelligence for child clauses */}
                                                                        {(clarenceRecommendations[child.clauseId] || userPositions[child.clauseId]?.position) && (
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                {clarenceRecommendations[child.clauseId] && (
                                                                                    <span className="text-[10px] text-purple-500">
                                                                                        C:{clarenceRecommendations[child.clauseId].clarencePosition}
                                                                                    </span>
                                                                                )}
                                                                                {userPositions[child.clauseId]?.position && (
                                                                                    <span className="text-[10px] text-emerald-600">
                                                                                        You:{userPositions[child.clauseId].position}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                    {getClauseIntelligenceStatus(child.clauseId) === 'full' && <span className="text-purple-500 text-[10px]">⚡</span>}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        )
                    ) : (
                        /* Category View */
                        filteredCategories.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">{searchQuery ? 'No clauses match your search' : 'No clauses found'}</div>
                        ) : (
                            filteredCategories.map(group => {
                                const groupFilteredClauses = group.clauses.filter(c => filteredClauses.find(fc => fc.clauseId === c.clauseId))
                                return (
                                    <div key={group.category} className="border-b border-slate-200">
                                        <button onClick={() => toggleCategoryExpansion(group.category)}
                                            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span className={`transform transition-transform ${group.isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                <span className="font-medium text-sm text-slate-700">{group.category}</span>
                                                <button onClick={(e) => { e.stopPropagation(); selectAllInCategory(group.category) }}
                                                    className="text-xs text-blue-500 hover:text-blue-700 ml-2" title="Select all in category">+</button>
                                            </div>
                                            <span className="text-xs text-slate-400">{groupFilteredClauses.length}</span>
                                        </button>
                                        {group.isExpanded && (
                                            <div className="bg-white">
                                                {groupFilteredClauses.map(clause => {
                                                    const isSelected = selectedClauseIds.has(clause.clauseId)
                                                    return (
                                                        <div key={clause.clauseId}
                                                            className={`w-full px-4 py-2 pl-6 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${selectedClause?.clauseId === clause.clauseId ? 'bg-blue-100 border-l-2 border-blue-500' : ''}`}>
                                                            <button onClick={(e) => toggleClauseSelection(clause.clauseId, e)}
                                                                className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'}`}>
                                                                {isSelected && <span className="text-white text-xs">✓</span>}
                                                            </button>
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clause.status === 'verified' ? 'bg-green-500' : clause.status === 'rejected' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                                            <button onClick={() => handleClauseSelect(clause)} className="flex-1 min-w-0 text-left">
                                                                <div className="flex items-center gap-1">
                                                                    {clause.clauseNumber && <span className="text-slate-400 text-xs">{clause.clauseNumber}</span>}
                                                                    <span className="truncate text-slate-700">{clause.clauseName}</span>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 space-y-2">
                    <button onClick={openClauseLibrary}
                        className="w-full px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                        ➕ Add Clause from Library
                    </button>

                    {configuredCount > 0 && (
                        <button onClick={handleCommitClauses} disabled={isCommitting}
                            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
                            {isCommitting ? (
                                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Committing...</>
                            ) : (
                                <>Commit {configuredCount} Clauses <span>→</span></>
                            )}
                        </button>
                    )}
                </div>

            </div>
        )
    }

    // ========================================================================
    // SECTION 8: RENDER - CENTER PANEL (AI Intelligence Driven)
    // Replaces old manual range configuration with position bar + Clarence
    // recommendations + zone visualisation from real DB data.
    // ========================================================================

    const renderCenterPanel = () => {
        const fileInput = (
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileSelect}
                className="hidden"
            />
        )

        // ── Loading state ──────────────────────────────────────────────────
        if (isLoading) {
            return (
                <div className="h-full flex items-center justify-center bg-white">
                    {fileInput}
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-600">Loading contract...</p>
                    </div>
                </div>
            )
        }

        // ── No contract — show upload ──────────────────────────────────────
        if (!contract) {
            return (
                <div className="h-full flex flex-col bg-white">
                    {fileInput}
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="max-w-xl w-full border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-800 mb-2">
                                        {uploadProgress || 'Processing...'}
                                    </h3>
                                    <p className="text-sm text-slate-500">Please wait while we analyze your document</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-3xl">📄</span>
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-800 mb-2">Upload Your Contract</h3>
                                    <p className="text-sm text-slate-500 mb-4">Drag and drop or click to upload a PDF, DOCX, or TXT file</p>
                                    <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium inline-block">Choose File</span>
                                    <p className="text-xs text-slate-400 mt-4">Maximum file size: 10MB</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )
        }

        // ── Processing state ───────────────────────────────────────────────
        if (contract.status === 'processing') {
            return (
                <div className="h-full flex items-center justify-center bg-white">
                    {fileInput}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">Analyzing Contract</h3>
                        <p className="text-sm text-slate-500 mb-2">Identifying clauses, categories, and structure...</p>
                        <p className="text-xs text-slate-400">This typically takes 1-2 minutes</p>
                    </div>
                </div>
            )
        }

        // ── No clause selected ─────────────────────────────────────────────
        if (!selectedClause) {
            return (
                <div className="h-full flex items-center justify-center bg-white">
                    {fileInput}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📋</span>
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">Select a Clause</h3>
                        <p className="text-sm text-slate-500">Click on a clause in the left panel to view and configure its position</p>
                    </div>
                </div>
            )
        }

        // ── Clause selected — AI Intelligence View ─────────────────────────
        const recommendation = clarenceRecommendations[selectedClause.clauseId]
        const mapping = rangeMappings[selectedClause.clauseId]
        const userConfig = userPositions[selectedClause.clauseId]
        const hasMapping = hasRangeMapping(selectedClause.clauseId)
        const hasRec = hasRecommendation(selectedClause.clauseId)

        // Move buttons
        const sortedClauses = [...clauses].sort((a, b) => a.displayOrder - b.displayOrder)
        const currentIndex = sortedClauses.findIndex(c => c.clauseId === selectedClause.clauseId)
        const canMoveUp = currentIndex > 0
        const canMoveDown = currentIndex < sortedClauses.length - 1

        // Position bar helpers
        const renderPositionBar = () => {
            const currentPos = userConfig?.position || recommendation?.clarencePosition || 5
            const clarencePos = recommendation?.clarencePosition || null

            return (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Position Configuration</h3>

                    {/* ── THE POSITION BAR ─────────────────────────────────── */}
                    <div className="relative mb-6 pt-8 pb-2">

                        {/* Gradient background bar — Blue (provider) → Teal → Emerald (customer) */}
                        <div className="relative h-4 bg-gradient-to-r from-blue-200 via-teal-200 via-50% to-emerald-200 rounded-full">

                            {/* Scale tick marks */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <div
                                    key={n}
                                    className="absolute top-0 bottom-0 w-px bg-white/50"
                                    style={{ left: `${((n - 1) / 9) * 100}%` }}
                                />
                            ))}

                            {/* Industry Standard band overlay */}
                            {hasMapping && mapping && (
                                <div
                                    className="absolute top-0 bottom-0 border-2 border-purple-300/60 bg-purple-100/20 rounded"
                                    style={{
                                        left: `${(((mapping.industryStandardMin || 4) - 1) / 9) * 100}%`,
                                        width: `${(((mapping.industryStandardMax || 6) - (mapping.industryStandardMin || 4)) / 9) * 100}%`
                                    }}
                                    title={`Industry Standard Range: ${mapping.industryStandardMin} – ${mapping.industryStandardMax}`}
                                />
                            )}

                            {/* CLARENCE Marker — Purple "C" badge (read-only indicator) */}
                            {clarencePos !== null && (
                                <div
                                    className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 border-3 border-white flex items-center justify-center text-xs font-bold text-white z-10 shadow-lg"
                                    style={{
                                        left: `${((clarencePos - 1) / 9) * 100}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    title={`Clarence recommends: Position ${clarencePos} — ${translatePosition(selectedClause.clauseId, clarencePos)}`}
                                >
                                    C
                                </div>
                            )}

                            {/* USER Marker — Emerald draggable badge */}
                            {(userConfig?.position || hasRec) && (
                                <div
                                    className="absolute w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 border-3 border-white flex items-center justify-center text-xs font-bold text-white z-20 shadow-xl cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                                    style={{
                                        left: `${((currentPos - 1) / 9) * 100}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                    title={`Your position: ${userConfig.position} — Drag to adjust`}
                                    draggable={false}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        const bar = e.currentTarget.parentElement
                                        if (!bar) return

                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                            const rect = bar.getBoundingClientRect()
                                            const x = moveEvent.clientX - rect.left
                                            const percent = Math.max(0, Math.min(1, x / rect.width))
                                            const newPosition = Math.round(1 + (percent * 9))
                                            setUserClausePosition(selectedClause.clauseId, newPosition)
                                        }

                                        const handleMouseUp = (upEvent: MouseEvent) => {
                                            document.removeEventListener('mousemove', handleMouseMove)
                                            document.removeEventListener('mouseup', handleMouseUp)
                                            const rect = bar.getBoundingClientRect()
                                            const x = upEvent.clientX - rect.left
                                            const percent = Math.max(0, Math.min(1, x / rect.width))
                                            const finalPosition = Math.round(1 + (percent * 9))
                                            setUserClausePosition(selectedClause.clauseId, finalPosition)
                                        }

                                        document.addEventListener('mousemove', handleMouseMove)
                                        document.addEventListener('mouseup', handleMouseUp)
                                    }}
                                >
                                    You
                                </div>
                            )}
                        </div>

                        {/* ── Scale Labels — real-world values if available ────── */}
                        {hasMapping && mapping?.isDisplayable ? (
                            <>
                                <div className="flex justify-between mt-2 px-0">
                                    {[1, 3, 5, 7, 10].map(pos => {
                                        const point = mapping.rangeData.scale_points.find(p => p.position === pos)
                                        return point ? (
                                            <span key={pos} className="text-[10px] text-slate-500 font-medium max-w-[80px] text-center leading-tight">
                                                {point.label}
                                            </span>
                                        ) : (
                                            <span key={pos} className="text-[10px] text-slate-400 font-medium">{pos}</span>
                                        )
                                    })}
                                </div>

                                {/* Current position — real-world value */}
                                {userConfig?.position && (
                                    <div className="text-center mt-2">
                                        <span className="text-sm font-semibold text-emerald-700">
                                            {translatePositionRich(selectedClause.clauseId, userConfig.position)?.label || `Position ${userConfig.position}`}
                                        </span>
                                        <span className="text-xs text-slate-400 ml-2">
                                            (Position {userConfig.position})
                                        </span>
                                    </div>
                                )}

                                {/* Industry standard band label */}
                                {mapping.industryStandardMin && (
                                    <div className="text-center mt-1">
                                        <span className="text-[10px] text-purple-400">
                                            Industry standard: {mapping.rangeData.scale_points.find(p => p.position === mapping.industryStandardMin)?.label || ''} — {mapping.rangeData.scale_points.find(p => p.position === mapping.industryStandardMax)?.label || ''}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex justify-between mt-2 px-0">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                    <span key={n} className="text-[10px] text-slate-400 font-medium" style={{ width: '11.11%', textAlign: n === 1 ? 'left' : n === 10 ? 'right' : 'center' }}>
                                        {n}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Provider ← → Customer labels */}
                        <div className="flex justify-between mt-1 text-[10px]">
                            <span className="text-blue-500 font-medium">← Provider Favourable</span>
                            <span className="text-slate-400">Balanced</span>
                            <span className="text-emerald-600 font-medium">Customer Favourable →</span>
                        </div>
                    </div>

                    {/* ── Slider for precise positioning ───────────────────── */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500">Fine-tune your position</span>
                            <span className="text-xs font-medium text-emerald-700">{currentPos}/10 — {getPositionLabel(currentPos)}</span>
                        </div>
                        <input
                            type="range" min="1" max="10" step="1"
                            value={currentPos}
                            onChange={(e) => setUserClausePosition(selectedClause.clauseId, parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                    </div>

                    {/* ── Marker Legend ─────────────────────────────────────── */}
                    <div className="flex items-center gap-6 text-xs text-slate-500 border-t border-slate-100 pt-3">
                        {hasRec && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full border border-white shadow-sm" />
                                Clarence Recommendation
                            </span>
                        )}
                        {userConfig?.position && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full border border-white shadow-sm" />
                                Your Position
                            </span>
                        )}
                        {hasMapping && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 h-2 border border-purple-300 bg-purple-100/30 rounded-sm" />
                                Industry Standard
                            </span>
                        )}
                    </div>

                    {/* AI analysis pending indicator */}
                    {!hasMapping && certificationProgress.status === 'running' && (
                        <p className="text-xs text-blue-500 mt-3 flex items-center gap-1">
                            <span className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                            AI analysis in progress — real-world labels coming soon
                        </p>
                    )}
                </div>
            )
        }

        return (
            <div className="h-full flex flex-col bg-white">
                {fileInput}

                {/* ── Clause Header ─────────────────────────────────────────── */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {selectedClause.clauseNumber && (
                                    <span className="text-sm text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                        {selectedClause.clauseNumber}
                                    </span>
                                )}
                                <h1 className="text-xl font-semibold text-slate-800">{selectedClause.clauseName}</h1>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-600">
                                    {selectedClause.category}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedClause.status === 'verified' ? 'bg-green-100 text-green-700'
                                    : selectedClause.status === 'rejected' ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {selectedClause.status.charAt(0).toUpperCase() + selectedClause.status.slice(1)}
                                </span>
                                {hasRec && (
                                    <span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-700">
                                        ⚡ AI Analyzed
                                    </span>
                                )}
                                {(userConfig?.position || hasRec) && (
                                    <span className="px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-700">
                                        ✓ Position Set
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 mr-3 bg-slate-100 rounded-lg p-1">
                                <button onClick={() => handleMoveClause(selectedClause, 'up')}
                                    disabled={!canMoveUp || isReordering}
                                    className="px-3 py-1.5 rounded-md bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium shadow-sm flex items-center gap-1"
                                    title="Move up">
                                    <span>↑</span> Up
                                </button>
                                <button onClick={() => handleMoveClause(selectedClause, 'down')}
                                    disabled={!canMoveDown || isReordering}
                                    className="px-3 py-1.5 rounded-md bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium shadow-sm flex items-center gap-1"
                                    title="Move down">
                                    <span>↓</span> Down
                                </button>
                            </div>
                            <button onClick={() => { setEditingClause(selectedClause); setEditName(selectedClause.clauseName); setEditCategory(selectedClause.category); setEditContent(selectedClause.content) }}
                                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition-colors flex items-center gap-2">
                                ✏️ Edit
                            </button>
                            {selectedClause.status !== 'rejected' && (
                                <button onClick={() => excludeClause(selectedClause)}
                                    className="px-4 py-2 rounded-lg bg-amber-100 text-amber-700 font-medium hover:bg-amber-200 transition-colors flex items-center gap-2">
                                    ✕ Exclude
                                </button>
                            )}
                            <button onClick={() => confirmDeleteClause(selectedClause)} disabled={isDeleting}
                                className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                                title="Delete clause">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Main Content — Scrollable ─────────────────────────────── */}
                <div className="flex-1 overflow-auto">

                    {/* Clause Text Preview */}
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Clause Text</h3>
                            <button onClick={() => { setEditingClause(selectedClause); setEditName(selectedClause.clauseName); setEditCategory(selectedClause.category); setEditContent(selectedClause.content) }}
                                className="text-xs text-blue-600 hover:text-blue-800">
                                Edit text →
                            </button>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-40 overflow-auto">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {selectedClause.content.length > 500
                                    ? selectedClause.content.substring(0, 500) + '...'
                                    : selectedClause.content}
                            </p>
                        </div>
                    </div>

                    {/* Clarence Recommendation Card */}
                    {/* ── Unified Position Bar (includes Clarence recommendation) ── */}
                    <div className="p-6 border-b border-slate-200">
                        {renderPositionBar()}
                    </div>

                    {/* ── Clarence Recommendation Detail Card ── */}
                    {hasRec && recommendation && (
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center gap-6">
                                {/* Clarence Position Card */}
                                <div className="flex-1 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
                                            <span className="text-white text-xl font-bold">C</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-2xl font-bold text-purple-700">
                                                {translatePositionRich(selectedClause.clauseId, recommendation.clarencePosition)?.label
                                                    || `Position ${recommendation.clarencePosition}`}
                                            </div>
                                            <div className="text-sm text-purple-600">
                                                Position {recommendation.clarencePosition}/10 — {getPositionLabel(recommendation.clarencePosition)}
                                                {recommendation.confidence > 0 && (
                                                    <span className="ml-2 text-purple-400">({Math.round(recommendation.confidence * 100)}% confidence)</span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => acceptClarenceRecommendation(selectedClause.clauseId)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${userConfig?.acceptedRecommendation
                                                ? 'bg-purple-200 text-purple-700'
                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                                }`}
                                        >
                                            {userConfig?.acceptedRecommendation ? '✓ Accepted' : 'Accept Position'}
                                        </button>
                                    </div>
                                </div>

                                {/* Fairness Badge */}
                                {recommendation.fairness && (
                                    <div className={`px-4 py-3 rounded-lg ${recommendation.fairness === 'balanced'
                                        ? 'bg-emerald-50 border border-emerald-200'
                                        : recommendation.fairness.includes('customer')
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'bg-amber-50 border border-amber-200'
                                        }`}>
                                        <div className={`text-sm font-medium ${recommendation.fairness === 'balanced'
                                            ? 'text-emerald-700'
                                            : recommendation.fairness.includes('customer')
                                                ? 'text-blue-700'
                                                : 'text-amber-700'
                                            }`}>
                                            {recommendation.fairness === 'balanced' ? '✔ Balanced'
                                                : recommendation.fairness.includes('customer') ? '⬆ Customer-Leaning'
                                                    : recommendation.fairness.includes('provider') ? '⬇ Provider-Leaning'
                                                        : '⚠ Review Recommended'}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">Fairness Assessment</div>
                                    </div>
                                )}
                            </div>

                            {/* Assessment / Rationale */}
                            {(recommendation.assessment || recommendation.rationale) && (
                                <div className="mt-3 p-3 bg-white rounded-lg border border-purple-100">
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                        {recommendation.assessment || recommendation.rationale}
                                    </p>
                                </div>
                            )}

                            {/* Summary */}
                            {recommendation.summary && recommendation.summary !== recommendation.assessment && (
                                <div className="mt-2 text-xs text-purple-500 italic">
                                    {recommendation.summary}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Importance Level */}
                    <div className="p-6 border-b border-slate-200">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">Clause Importance</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['low', 'medium', 'high', 'critical'] as const).map((level) => {
                                const config = IMPORTANCE_CONFIG[level]
                                const isActive = (userConfig?.importance || 'medium') === level
                                return (
                                    <button key={level}
                                        onClick={() => setUserClauseImportance(selectedClause.clauseId, level)}
                                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? `${config.color} text-white shadow-md`
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}>
                                        {config.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Rationale / Notes */}
                    <div className="p-6 border-b border-slate-200">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Rationale / Notes</label>
                        <textarea
                            value={userConfig?.rationale || ''}
                            onChange={(e) => setUserClauseRationale(selectedClause.clauseId, e.target.value)}
                            placeholder="Why is this position important? Any context for the negotiation..."
                            rows={3}
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                        />
                    </div>

                    {/* Save & Configure Footer */}
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-500">
                                {selectedClause.status === 'verified' ? (
                                    <span className="text-green-600 flex items-center gap-1">✓ Clause configured and ready</span>
                                ) : selectedClause.status === 'rejected' ? (
                                    <span className="text-red-500 flex items-center gap-1">✕ Clause excluded from negotiation</span>
                                ) : userConfig?.position ? (
                                    <span className="text-blue-600 flex items-center gap-1">● Position set — ready to configure</span>
                                ) : (
                                    <span className="text-amber-600 flex items-center gap-1">⚠ Set a position above to configure</span>
                                )}
                            </div>
                            {selectedClause.status !== 'rejected' && (
                                <button
                                    onClick={() => saveAndConfigureClause(selectedClause.clauseId)}
                                    disabled={!userConfig?.position || selectedClause.status === 'verified'}
                                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                                    {selectedClause.status === 'verified' ? '✓ Configured' : '✓ Save & Configure'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* AI Suggestion (from parsing — legacy field) */}
                    {selectedClause.aiSuggestion && (
                        <div className="px-6 pb-6">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                                    <span>🤖</span> AI Parsing Note
                                </h4>
                                <p className="text-sm text-blue-700">{selectedClause.aiSuggestion}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="p-4 m-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                )}
            </div>
        )
    }

    // ========================================================================
    // SECTION 9: RENDER - RIGHT PANEL (Chat + Intelligence — no entities)
    // ========================================================================

    const renderRightPanel = () => {
        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white border-l border-slate-200">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white">
                    <button
                        onClick={() => setRightPanelTab('intelligence')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${rightPanelTab === 'intelligence'
                            ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        ⚡ Intelligence
                    </button>
                    <button
                        onClick={() => setRightPanelTab('chat')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${rightPanelTab === 'chat'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        💬 Clarence
                    </button>
                </div>

                {rightPanelTab === 'intelligence' ? (
                    /* —— Intelligence Tab ———————————————————————————————————— */
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {/* Readiness Summary — Richer Design */}
                        {clauses.length > 0 && (() => {
                            const metrics = getReadinessMetrics()
                            return (
                                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-4 text-white">
                                    <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Preparation Readiness</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                                            <span className="text-2xl font-bold text-emerald-400">{metrics.configured}</span>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Configured</p>
                                        </div>
                                        <div className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                                            <span className="text-2xl font-bold text-slate-300">{metrics.pending}</span>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Pending</p>
                                        </div>
                                        <div className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                                            <span className="text-2xl font-bold text-purple-400">{metrics.withRecommendation}</span>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">AI Analyzed</p>
                                        </div>
                                        <div className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                                            <span className="text-2xl font-bold text-red-400">{metrics.excluded}</span>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Excluded</p>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                                            <span>Overall readiness</span>
                                            <span className="text-emerald-400 font-bold">{metrics.readinessPercent}%</span>
                                        </div>
                                        <div className="w-full bg-slate-600 rounded-full h-2">
                                            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${metrics.readinessPercent}%` }} />
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Certification Status */}
                        {certificationProgress.status !== 'idle' && (
                            <div className={`rounded-xl p-4 border ${certificationProgress.status === 'complete'
                                ? 'bg-emerald-50 border-emerald-200'
                                : certificationProgress.status === 'error'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-blue-50 border-blue-200'
                                }`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {certificationProgress.status === 'running' && (
                                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {certificationProgress.status === 'complete' && <span className="text-emerald-600 text-lg">✔</span>}
                                    {certificationProgress.status === 'error' && <span className="text-red-600">⚠</span>}
                                    <h4 className="text-sm font-semibold">
                                        {certificationProgress.status === 'running' ? 'Analyzing Clauses...'
                                            : certificationProgress.status === 'complete' ? 'Analysis Complete'
                                                : 'Analysis Error'}
                                    </h4>
                                </div>
                                <div className="w-full bg-white rounded-full h-2 mb-1">
                                    <div className={`h-2 rounded-full transition-all duration-300 ${certificationProgress.status === 'complete' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                        style={{ width: `${certificationProgress.total > 0 ? (certificationProgress.completed / certificationProgress.total) * 100 : 0}%` }} />
                                </div>
                                <p className="text-xs text-slate-600">
                                    {certificationProgress.completed} of {certificationProgress.total} clauses analyzed
                                </p>
                                {certificationProgress.errorMessage && (
                                    <p className="text-xs text-red-600 mt-1">{certificationProgress.errorMessage}</p>
                                )}
                            </div>
                        )}

                        {/* Selected Clause Intelligence — Rich Detail */}
                        {selectedClause && (() => {
                            const rec = clarenceRecommendations[selectedClause.clauseId]
                            const map = rangeMappings[selectedClause.clauseId]
                            const config = userPositions[selectedClause.clauseId]

                            return (
                                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                                    <h4 className="text-sm font-semibold text-slate-800">
                                        {selectedClause.clauseNumber && (
                                            <span className="text-slate-400 font-mono mr-1">{selectedClause.clauseNumber}</span>
                                        )}
                                        {selectedClause.clauseName}
                                    </h4>

                                    {/* Clarence Position + Confidence */}
                                    {rec && rec.status === 'certified' && (
                                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Clarence Position</span>
                                                {rec.confidence > 0 && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full font-medium">
                                                        {Math.round(rec.confidence * 100)}% confidence
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-lg font-bold text-purple-700">
                                                {translatePositionRich(selectedClause.clauseId, rec.clarencePosition)?.label
                                                    || `Position ${rec.clarencePosition}`}
                                            </p>
                                            <p className="text-xs text-purple-500 mt-0.5">
                                                {rec.clarencePosition}/10 — {getPositionLabel(rec.clarencePosition)}
                                            </p>

                                            {/* Fairness Badge */}
                                            {rec.fairness && (
                                                <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${rec.fairness === 'balanced'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : rec.fairness.includes('customer')
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : rec.fairness.includes('provider')
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {rec.fairness === 'balanced' ? '✔ Balanced'
                                                        : rec.fairness.includes('customer') ? '⬆ Customer-Leaning'
                                                            : rec.fairness.includes('provider') ? '⬇ Provider-Leaning'
                                                                : '⚠ Review Recommended'}
                                                </div>
                                            )}

                                            {/* Assessment */}
                                            {rec.assessment && (
                                                <p className="text-xs text-purple-600 mt-2 leading-relaxed border-t border-purple-100 pt-2">
                                                    {rec.assessment}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* User Position */}
                                    {config?.position && (
                                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                            <span className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Your Position</span>
                                            <p className="text-lg font-bold text-emerald-700">
                                                {translatePositionRich(selectedClause.clauseId, config.position)?.label
                                                    || `Position ${config.position}`}
                                            </p>
                                            <p className="text-xs text-emerald-500">
                                                {config.position}/10 — {getPositionLabel(config.position)}
                                                {config.acceptedRecommendation && (
                                                    <span className="ml-2 text-purple-500">✓ Accepted Clarence</span>
                                                )}
                                            </p>
                                            {config.importance && config.importance !== 'medium' && (
                                                <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${IMPORTANCE_CONFIG[config.importance].bgLight} ${IMPORTANCE_CONFIG[config.importance].textColor}`}>
                                                    {IMPORTANCE_CONFIG[config.importance].label} Importance
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Range Mapping Info */}
                                    {map && map.isDisplayable && (
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <span className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Range Intelligence</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-sm text-blue-700 font-medium capitalize">{map.valueType}</span>
                                                {map.rangeUnit && <span className="text-xs text-blue-500">({map.rangeUnit})</span>}
                                            </div>
                                            {map.rangeData.scale_points.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {map.rangeData.scale_points.slice(0, 5).map((sp, i) => (
                                                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-600">
                                                            {sp.label}
                                                        </span>
                                                    ))}
                                                    {map.rangeData.scale_points.length > 5 && (
                                                        <span className="text-[10px] text-blue-400">+{map.rangeData.scale_points.length - 5} more</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Intelligence Status Footer */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-slate-400">Intelligence:</span>
                                            <span className={`text-xs font-medium ${getClauseIntelligenceStatus(selectedClause.clauseId) === 'full' ? 'text-emerald-600'
                                                : getClauseIntelligenceStatus(selectedClause.clauseId) === 'partial' ? 'text-amber-600'
                                                    : 'text-slate-400'
                                                }`}>
                                                {getClauseIntelligenceStatus(selectedClause.clauseId) === 'full' ? '✔ Full'
                                                    : getClauseIntelligenceStatus(selectedClause.clauseId) === 'partial' ? '◐ Partial'
                                                        : '○ None'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-300">{selectedClause.category}</span>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* No clause selected prompt */}
                        {!selectedClause && (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xl text-slate-400">📋</span>
                                </div>
                                <p className="text-sm text-slate-500">Select a clause to see intelligence details</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Chat Tab ──────────────────────────────────────────────── */
                    <>
                        <div className="p-4 border-b border-slate-200 bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                    <span className="text-white text-lg">C</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">Clarence</h3>
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Online
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {chatMessages.map((message) => (
                                <div key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-md'
                                        : message.role === 'system'
                                            ? 'bg-slate-100 text-slate-600 rounded-bl-md text-sm'
                                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                                        }`}>
                                        <div className="text-sm whitespace-pre-wrap">
                                            {message.content.split('**').map((part, i) =>
                                                i % 2 === 1
                                                    ? <strong key={i}>{part}</strong>
                                                    : <span key={i}>{part}</span>
                                            )}
                                        </div>
                                        <p className="text-xs opacity-60 mt-1">
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white">
                            <p className="text-xs text-slate-400 text-center">
                                Clarence is helping you prepare your contract
                            </p>
                        </div>
                    </>
                )}
            </div>
        )
    }

    // ========================================================================
    // SECTION 10: RENDER - MODALS
    // ========================================================================

    const renderEditModal = () => {
        if (!editingClause) return null

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800">Edit Clause</h3>
                        <button onClick={() => setEditingClause(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <div className="p-4 space-y-4 overflow-auto max-h-[calc(90vh-140px)]">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Clause Name</label>
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                            {editingClause.aiSuggestedName && editingClause.aiSuggestedName !== editName && (
                                <p className="text-xs text-slate-400 mt-1">AI suggested: {editingClause.aiSuggestedName}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                {CLAUSE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                                rows={10}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm" />
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={() => setEditingClause(null)} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
                        <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Save & Verify</button>
                    </div>
                </div>
            </div>
        )
    }

    const renderDeleteConfirmModal = () => {
        if (!showDeleteConfirm) return null
        const isBulk = deleteTarget === 'bulk'
        const deleteCount = isBulk ? selectedClauseIds.size : 1
        const clauseName = clauseToDelete?.clauseName || ''

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                    <div className="p-6">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🗑️</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
                            Delete {isBulk ? `${deleteCount} Clauses` : 'Clause'}?
                        </h3>
                        <p className="text-sm text-slate-600 text-center">
                            {isBulk
                                ? `Are you sure you want to delete ${deleteCount} selected clauses? This action cannot be undone.`
                                : `Are you sure you want to delete "${clauseName}"? This action cannot be undone.`}
                        </p>
                    </div>
                    <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                        <button onClick={() => { setShowDeleteConfirm(false); setClauseToDelete(null); setDeleteTarget(null) }}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
                        <button onClick={() => { if (isBulk) { handleBulkDelete() } else if (clauseToDelete) { handleDeleteClause(clauseToDelete) } }}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                            {isDeleting ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting...</>) : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const renderClauseLibraryModal = () => {
        if (!showClauseLibrary) return null
        const groupedClauses = getFilteredLibraryClauses()
        const categoryOrder = ['Liability', 'Payment', 'Service Levels', 'Termination', 'Data Protection', 'Intellectual Property', 'Confidentiality', 'Governance', 'General', 'Other']
        const sortedCategories = Object.keys(groupedClauses).sort((a, b) => {
            const aIdx = categoryOrder.indexOf(a)
            const bIdx = categoryOrder.indexOf(b)
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
        })

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">CLARENCE Clause Library</h3>
                            <p className="text-sm text-slate-500">Select clauses to add to your contract</p>
                        </div>
                        <button onClick={() => setShowClauseLibrary(false)} className="text-slate-400 hover:text-slate-600 p-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-4 border-b border-slate-200 flex-shrink-0">
                        <div className="relative">
                            <input type="text" value={librarySearchQuery} onChange={(e) => setLibrarySearchQuery(e.target.value)}
                                placeholder="Search clauses by name, category, or description..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📁</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        {libraryLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <span className="ml-3 text-slate-600">Loading clause library...</span>
                            </div>
                        ) : sortedCategories.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <p className="text-4xl mb-2">📋</p>
                                <p>No clauses found matching your search</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sortedCategories.map(category => (
                                    <div key={category} className="border border-slate-200 rounded-lg overflow-hidden">
                                        <button onClick={() => toggleLibraryCategory(category)}
                                            className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span className={`transform transition-transform ${libraryExpandedCategories.has(category) ? 'rotate-90' : ''}`}>▶</span>
                                                <span className="font-medium text-slate-700">{category}</span>
                                                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{groupedClauses[category].length}</span>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {groupedClauses[category].filter(c => selectedMasterClauseIds.has(c.clauseId)).length} selected
                                            </span>
                                        </button>
                                        {libraryExpandedCategories.has(category) && (
                                            <div className="divide-y divide-slate-100">
                                                {groupedClauses[category].map(clause => {
                                                    const isSelected = selectedMasterClauseIds.has(clause.clauseId)
                                                    const isAlreadyInContract = clauses.some(c => c.mapsToMasterClauseId === clause.clauseId)
                                                    return (
                                                        <div key={clause.clauseId}
                                                            className={`px-4 py-3 flex items-start gap-3 ${isAlreadyInContract ? 'bg-slate-50 opacity-60' : isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                                            <button onClick={() => !isAlreadyInContract && toggleMasterClauseSelection(clause.clauseId)}
                                                                disabled={isAlreadyInContract}
                                                                className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isAlreadyInContract ? 'bg-slate-200 border-slate-300 cursor-not-allowed'
                                                                    : isSelected ? 'bg-blue-600 border-blue-600'
                                                                        : 'border-slate-300 hover:border-blue-400'
                                                                    }`}>
                                                                {(isSelected || isAlreadyInContract) && <span className="text-white text-xs">✓</span>}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-slate-800">{clause.clauseName}</span>
                                                                    {clause.isRequired && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>}
                                                                    {isAlreadyInContract && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Already added</span>}
                                                                </div>
                                                                {clause.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{clause.description}</p>}
                                                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                                    <span>Customer: {clause.defaultCustomerPosition}/10</span>
                                                                    <span>Provider: {clause.defaultProviderPosition}/10</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0 bg-slate-50">
                        <div className="text-sm text-slate-600">
                            {selectedMasterClauseIds.size > 0
                                ? <span className="font-medium text-blue-600">{selectedMasterClauseIds.size} clause{selectedMasterClauseIds.size > 1 ? 's' : ''} selected</span>
                                : <span>Select clauses to add</span>}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowClauseLibrary(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800">Cancel</button>
                            <button onClick={addSelectedClausesToContract}
                                disabled={selectedMasterClauseIds.size === 0 || isAddingClauses}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {isAddingClauses
                                    ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>)
                                    : (<>Add {selectedMasterClauseIds.size > 0 ? selectedMasterClauseIds.size : ''} Clause{selectedMasterClauseIds.size !== 1 ? 's' : ''}</>)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 11: MAIN RENDER
    // ========================================================================

    if (!userInfo) {
        return <LoadingFallback />
    }

    return (
        <div className="h-screen flex flex-col bg-slate-100">
            {/* Upload Loading Overlay */}
            {isUploading && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Processing Your Contract</h3>
                        <p className="text-slate-600 mb-4">{uploadProgress || 'Preparing document...'}</p>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-4">This may take 1-2 minutes for larger documents</p>
                    </div>
                </div>
            )}

            {/* Initial Loading Overlay */}
            {isLoading && contractId && !isUploading && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Loading Contract</h3>
                        <p className="text-slate-600">Fetching contract details...</p>
                    </div>
                </div>
            )}

            {/* Contract Processing Overlay */}
            {contract?.status === 'processing' && !isUploading && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Analyzing Contract</h3>
                        <p className="text-slate-600 mb-2">CLARENCE is identifying clauses, categories, and structure...</p>
                        <p className="text-sm text-slate-500 mb-4">{contract.fileName}</p>
                        <div className="flex items-center justify-center gap-2 text-blue-600">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-4">This typically takes 1-2 minutes</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="h-14 bg-slate-800 flex items-center justify-between px-6 flex-shrink-0 relative">
                {/* Left: Home + CLARENCE Create branding */}
                <div className="flex items-center gap-3">
                    <Link href="/auth/contracts-dashboard"
                        className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                        title="Back to Negotiations">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </Link>
                    <div className="h-6 w-px bg-slate-600"></div>
                    <Link href="/auth/contracts-dashboard" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold">C</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-semibold">CLARENCE</span>
                                <span className="text-emerald-400 font-semibold">Create</span>
                            </div>
                            <span className="text-slate-500 text-xs">The Honest Broker</span>
                        </div>
                    </Link>
                </div>

                {/* Centre: Page Title */}
                <div className="absolute left-1/2 transform -translate-x-1/2">
                    <h1 className="text-white font-medium">Contract Preparation</h1>
                </div>

                {/* Right: Feedback & User Info */}
                <div className="flex items-center gap-4">
                    <FeedbackButton position="header" />
                    <span className="text-slate-400 text-sm">{userInfo.email}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                        <span className="text-white text-sm">{userInfo.firstName?.[0]}{userInfo.lastName?.[0]}</span>
                    </div>
                </div>
            </header>
            <CreateProgressBar
                currentStage="contract_prep"
                isStraightToContract={sessionData?.mediationType === 'straight_to_contract'}
            />

            {/* Three-Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
                <div className="w-72 flex-shrink-0">
                    {renderLeftPanel()}
                </div>
                <div className="flex-1 min-w-0">
                    {renderCenterPanel()}
                </div>
                <div className="w-80 flex-shrink-0">
                    {renderRightPanel()}
                </div>
            </div>

            {/* Modals */}
            {renderEditModal()}
            {renderClauseLibraryModal()}
            {renderDeleteConfirmModal()}

            {/* Transition Modal */}
            <TransitionModal
                isOpen={transitionState.isOpen}
                transition={transitionState.transition}
                onContinue={handleTransitionContinue}
            />
        </div>
    )
}

// ============================================================================
// SECTION 12: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function ContractPrepPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ContractPrepContent />
        </Suspense>
    )
}