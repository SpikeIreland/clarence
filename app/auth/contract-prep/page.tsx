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
    // Position scales for negotiation stance (1-10)
    customerPosition?: number
    providerPosition?: number
    importance?: 'low' | 'medium' | 'high' | 'critical'
}

interface DetectedEntity {
    id: string
    type: 'company' | 'person' | 'date' | 'amount' | 'other'
    value: string
    suggestedPlaceholder: string
    confirmed: boolean
    customPlaceholder?: string
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
// SECTION 1A: NEW TYPE DEFINITIONS FOR CLAUSE RANGES
// ============================================================================

type RangeType = 'duration' | 'percentage' | 'currency' | 'count' | 'boolean' | 'text' | 'custom'

interface ClauseRange {
    rangeType: RangeType
    unit: string
    minValue: string
    maxValue: string
    targetValue: string
    walkawayValue: string
    rationale: string
    importance: 'low' | 'medium' | 'high' | 'critical'
}

// Range type configuration - defines available units for each type
const RANGE_TYPE_CONFIG: Record<RangeType, {
    label: string
    description: string
    units: { value: string; label: string }[]
    placeholder: { min: string; max: string; target: string; walkaway: string }
}> = {
    duration: {
        label: 'Duration',
        description: 'Time-based ranges (hours, days, months, etc.)',
        units: [
            { value: 'hours', label: 'Hours' },
            { value: 'days', label: 'Days' },
            { value: 'weeks', label: 'Weeks' },
            { value: 'months', label: 'Months' },
            { value: 'years', label: 'Years' }
        ],
        placeholder: { min: '24', max: '72', target: '24', walkaway: '48' }
    },
    percentage: {
        label: 'Percentage',
        description: 'Percentage of contract value, fees, etc.',
        units: [
            { value: 'percent_contract', label: '% of Contract Value' },
            { value: 'percent_annual', label: '% of Annual Fees' },
            { value: 'percent_monthly', label: '% of Monthly Fees' },
            { value: 'percent_affected', label: '% of Affected Services' }
        ],
        placeholder: { min: '50', max: '150', target: '100', walkaway: '125' }
    },
    currency: {
        label: 'Currency',
        description: 'Monetary amounts with currency',
        units: [
            { value: 'GBP', label: '£ GBP' },
            { value: 'USD', label: '$ USD' },
            { value: 'EUR', label: '€ EUR' }
        ],
        placeholder: { min: '10000', max: '100000', target: '25000', walkaway: '50000' }
    },
    count: {
        label: 'Count',
        description: 'Number of occurrences or instances',
        units: [
            { value: 'per_year', label: 'Per Year' },
            { value: 'per_month', label: 'Per Month' },
            { value: 'per_contract', label: 'Per Contract Term' },
            { value: 'total', label: 'Total' }
        ],
        placeholder: { min: '1', max: '4', target: '2', walkaway: '3' }
    },
    boolean: {
        label: 'Yes/No',
        description: 'Binary choice with conditions',
        units: [
            { value: 'yes_no', label: 'Yes / No' },
            { value: 'allowed_prohibited', label: 'Allowed / Prohibited' },
            { value: 'required_optional', label: 'Required / Optional' }
        ],
        placeholder: { min: '', max: '', target: 'Yes', walkaway: 'No' }
    },
    text: {
        label: 'Text Options',
        description: 'Predefined text choices',
        units: [
            { value: 'jurisdiction', label: 'Jurisdiction' },
            { value: 'dispute_resolution', label: 'Dispute Resolution' },
            { value: 'governing_law', label: 'Governing Law' }
        ],
        placeholder: { min: '', max: '', target: 'England & Wales', walkaway: '' }
    },
    custom: {
        label: 'Custom',
        description: 'Define your own range parameters',
        units: [
            { value: 'custom', label: 'Custom Unit' }
        ],
        placeholder: { min: '', max: '', target: '', walkaway: '' }
    }
}

// Common clause type to range type mappings (for smart defaults)
const CLAUSE_RANGE_SUGGESTIONS: Record<string, { rangeType: RangeType; unit: string; typical: string }> = {
    'SLA': { rangeType: 'duration', unit: 'hours', typical: '24-72 hours' },
    'Response Time': { rangeType: 'duration', unit: 'hours', typical: '4-48 hours' },
    'Notice Period': { rangeType: 'duration', unit: 'days', typical: '30-90 days' },
    'Termination': { rangeType: 'duration', unit: 'months', typical: '3-6 months' },
    'Confidentiality': { rangeType: 'duration', unit: 'years', typical: '2-5 years' },
    'Liability': { rangeType: 'percentage', unit: 'percent_annual', typical: '100-150% of annual fees' },
    'Liability Cap': { rangeType: 'percentage', unit: 'percent_contract', typical: '50-150% of contract value' },
    'Indemnity': { rangeType: 'currency', unit: 'GBP', typical: 'Capped amount' },
    'Service Credits': { rangeType: 'percentage', unit: 'percent_monthly', typical: '5-15% of monthly fees' },
    'Audit': { rangeType: 'count', unit: 'per_year', typical: '1-2 per year' },
    'Renewal': { rangeType: 'count', unit: 'per_contract', typical: '1-3 renewals' },
    'Data Processing': { rangeType: 'boolean', unit: 'allowed_prohibited', typical: '' },
    'Subcontracting': { rangeType: 'boolean', unit: 'allowed_prohibited', typical: '' },
    'Governing Law': { rangeType: 'text', unit: 'governing_law', typical: '' },
    'Dispute Resolution': { rangeType: 'text', unit: 'dispute_resolution', typical: '' }
}

// ============================================================================
// CLAUSE STATUS CONFIGURATION
// ============================================================================

const CLAUSE_STATUS = {
    NOT_CONFIGURED: 'pending',      // Maps to existing DB value
    CONFIGURED: 'verified',         // Maps to existing DB value  
    EXCLUDED: 'rejected'            // Maps to existing DB value
} as const

const CLAUSE_STATUS_DISPLAY = {
    pending: { label: 'Not Configured', icon: '○', color: 'text-slate-400', bg: 'bg-slate-100' },
    verified: { label: 'Configured', icon: '✓', color: 'text-green-600', bg: 'bg-green-100' },
    rejected: { label: 'Excluded', icon: '✗', color: 'text-red-500', bg: 'bg-red-100' }
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

const ENTITY_PLACEHOLDERS = {
    company: ['[PROVIDER]', '[CUSTOMER]', '[PARTY A]', '[PARTY B]', '[COMPANY]'],
    person: ['[REPRESENTATIVE]', '[SIGNATORY]', '[CONTACT]', '[PERSON]'],
    date: ['[EFFECTIVE DATE]', '[COMMENCEMENT DATE]', '[END DATE]', '[DATE]'],
    amount: ['[CONTRACT VALUE]', '[FEE AMOUNT]', '[PENALTY AMOUNT]', '[AMOUNT]'],
    other: ['[REDACTED]', '[PLACEHOLDER]']
}

const CLARENCE_MESSAGES = {
    welcome_new: `Welcome to **Contract Studio**! This is your workspace for preparing contracts before negotiations.

Upload a contract and I'll analyze it to identify clauses, categories, and any entities that should be redacted.`,

    welcome_loading: `Loading your contract... Just a moment while I fetch the details.`,

    contract_loaded: (name: string, clauseCount: number, entityCount: number) =>
        `I've loaded **${name}** with **${clauseCount} clauses** identified across multiple categories.

${entityCount > 0 ? `I've also detected **${entityCount} entities** (company names, people, etc.) that you may want to redact before sharing.` : ''}

Click on any clause in the left panel to review its details. Use the checkboxes to select multiple clauses for bulk actions.`,

    processing: `Your contract is being analyzed. I'm identifying clause boundaries, categories, and extracting entities.

This typically takes 1-2 minutes for larger documents.`,

    entity_detected: (count: number) =>
        `I've detected **${count} entities** in your contract that may need redaction:

• Company names → Replace with [PROVIDER], [CUSTOMER]
• Person names → Replace with [REPRESENTATIVE]
• Specific dates → Replace with [EFFECTIVE DATE]

Review and confirm the redactions in the Entities panel.`,

    clause_verified: (name: string) => `✓ Verified: **${name}**`,

    clause_rejected: (name: string) => `✕ Rejected: **${name}**`,

    clause_deleted: (name: string) => `🗑️ Deleted: **${name}**`,

    clauses_deleted: (count: number) => `🗑️ Deleted **${count} clauses**`,

    clauses_reordered: `↕️ Clauses reordered successfully`,

    all_verified: `Excellent! All clauses have been verified. You can now commit them to use in negotiations.`,

    committed: (count: number) => `Successfully committed **${count} clauses**. Your contract template is ready for negotiations!`
}

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

    // ========================================================================
    // SECTION 5A: STATE
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<UploadedContract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
    const [detectedEntities, setDetectedEntities] = useState<DetectedEntity[]>([])

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
    const [showEntitiesPanel, setShowEntitiesPanel] = useState(false)
    const [viewMode, setViewMode] = useState<'category' | 'document'>('document')
    const [expandedParentClauses, setExpandedParentClauses] = useState<Set<string>>(new Set())

    // Bulk Selection State
    const [selectedClauseIds, setSelectedClauseIds] = useState<Set<string>>(new Set())
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isReordering, setIsReordering] = useState(false)

    // Position Scales State
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
    // Clause ranges state - stores range configuration for each clause
    const [clauseRanges, setClauseRanges] = useState<Record<string, ClauseRange>>({})

    // Editing state for ranges
    const [isEditingRange, setIsEditingRange] = useState(false)

    const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
    const [suggestionError, setSuggestionError] = useState<string | null>(null)
    const [lastSuggestedClauseId, setLastSuggestedClauseId] = useState<string | null>(null)

    // Bulk AI Configuration State
    const [isBulkAIProcessing, setIsBulkAIProcessing] = useState(false)
    const [bulkAIProgress, setBulkAIProgress] = useState<{
        current: number
        total: number
        currentClauseName: string | null
    } | null>(null)
    const [showBulkAIModal, setShowBulkAIModal] = useState(false)

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

    // Also get pathway_id from URL params (add near line 401-402):
    const pathwayId = searchParams.get('pathway_id')

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
            console.log('[loadContract] Raw API response:', data)

            const contractData = data.contract || data
            const hasContractId = contractData && (contractData.contract_id || contractData.contractId)

            if (hasContractId) {
                const get = (snake: string, camel: string) => contractData[snake] ?? contractData[camel]
                const status = get('status', 'status')
                console.log('[loadContract] Found contract data, status:', status)

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

                const parsingNotes = get('parsing_notes', 'parsingNotes')
                if (parsingNotes) {
                    try {
                        const notes = JSON.parse(parsingNotes)
                        if (notes.entities && Array.isArray(notes.entities)) {
                            setDetectedEntities(notes.entities.map((e: any, idx: number) => ({
                                id: `entity-${idx}`,
                                type: e.type || 'other',
                                value: e.value,
                                suggestedPlaceholder: e.suggested_placeholder || '[REDACTED]',
                                confirmed: false
                            })))
                        }
                    } catch (e) {
                        // parsing_notes might not be JSON
                    }
                }

                return status
            } else {
                console.log('[loadContract] No contract data found in response')
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
            console.log('[loadClauses] Raw API response:', data)

            const clausesArray = data.clauses || (Array.isArray(data) ? data : null)

            if (clausesArray && Array.isArray(clausesArray)) {
                console.log('[loadClauses] Found', clausesArray.length, 'clauses')

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
            } else {
                console.log('[loadClauses] No clauses array found in response')
            }
        } catch (err) {
            console.error('Error loading clauses:', err)
        }
    }, [selectedClause])

    const buildCategoryGroups = (clauseList: ContractClause[]) => {
        const groups: { [key: string]: ContractClause[] } = {}

        clauseList.forEach(clause => {
            const cat = clause.category || 'Other'
            if (!groups[cat]) {
                groups[cat] = []
            }
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
                categoryList.push({
                    category: cat,
                    clauses: groups[cat],
                    isExpanded: true
                })
            }
        })

        setCategoryGroups(categoryList)
    }

    const toggleParentClauseExpansion = (clauseNumber: string) => {
        setExpandedParentClauses(prev => {
            const newSet = new Set(prev)
            if (newSet.has(clauseNumber)) {
                newSet.delete(clauseNumber)
            } else {
                newSet.add(clauseNumber)
            }
            return newSet
        })
    }

    useEffect(() => {
        if (clauses.length > 0 && expandedParentClauses.size === 0) {
            const parentNumbers = clauses
                .filter(c => c.clauseLevel === 1)
                .map(c => c.clauseNumber)
            setExpandedParentClauses(new Set(parentNumbers))
        }
    }, [clauses])

    const loadSession = useCallback(async (sid: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-session?session_id=${sid}`)
            if (!response.ok) {
                console.log('[loadSession] Failed to load session')
                return
            }

            const data = await response.json()
            console.log('[loadSession] Raw API response:', data)

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
                console.log('[loadSession] Session loaded, mediation_type:', get('mediation_type', 'mediationType'))
            }
        } catch (err) {
            console.error('Error loading session:', err)
        }
    }, [])

    // ========================================================================
    // SECTION 5D: POLLING FOR PROCESSING STATUS
    // ========================================================================

    const hasLoadedRef = useRef<string | null>(null)

    useEffect(() => {
        console.log('[Polling] useEffect triggered, contractId:', contractId, 'hasLoadedRef:', hasLoadedRef.current)

        if (!contractId) {
            setIsLoading(false)
            addChatMessage('clarence', CLARENCE_MESSAGES.welcome_new)
            return
        }

        if (hasLoadedRef.current === contractId) {
            console.log('[Polling] Already loaded this contract, skipping')
            return
        }

        setIsUploading(false)
        setUploadProgress(null)
        setIsLoading(true)

        let pollCount = 0
        let pollInterval: NodeJS.Timeout | null = null
        let isActive = true

        const poll = async () => {
            if (!isActive) {
                console.log('[Polling] Effect no longer active, stopping')
                return
            }

            console.log('[Polling] Fetching contract status, pollCount:', pollCount)
            const status = await loadContract(contractId)
            console.log('[Polling] Got status:', status, 'type:', typeof status)

            if (!isActive) {
                console.log('[Polling] Effect cleaned up during fetch, stopping')
                return
            }

            if (status === 'ready') {
                console.log('[Polling] Status is ready, clearing interval and loading clauses')
                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
                hasLoadedRef.current = contractId
                await loadClauses(contractId)
                setIsLoading(false)
                console.log('[Polling] Clauses loaded, polling complete')
            } else if (status === 'failed') {
                console.log('[Polling] Status is failed')
                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
                setIsLoading(false)
                setError('Contract processing failed')
            } else if (status === 'processing') {
                console.log('[Polling] Status is processing, continuing to poll')
                setIsLoading(false)
                pollCount++
                if (pollCount >= MAX_POLLING_ATTEMPTS) {
                    if (pollInterval) {
                        clearInterval(pollInterval)
                        pollInterval = null
                    }
                    setError('Processing timeout - please try again')
                }
            } else if (status === null) {
                console.log('[Polling] Status is null (error loading)')
                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
                setIsLoading(false)
            } else {
                console.log('[Polling] Unknown status:', status)
                setIsLoading(false)
            }
        }

        poll()
        pollInterval = setInterval(poll, POLLING_INTERVAL)
        console.log('[Polling] Started interval')

        return () => {
            console.log('[Polling] Cleanup called')
            isActive = false
            if (pollInterval) {
                clearInterval(pollInterval)
                pollInterval = null
            }
        }
    }, [contractId])

    useEffect(() => {
        // Load session data from URL param or from contract's linked session
        const effectiveSessionId = sessionId || contract?.linkedSessionId
        if (effectiveSessionId) {
            loadSession(effectiveSessionId)
        }
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
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [chatMessages])

    useEffect(() => {
        if (contract && contract.status === 'ready' && clauses.length > 0 && chatMessages.length <= 1) {
            addChatMessage('clarence', CLARENCE_MESSAGES.contract_loaded(
                contract.contractName,
                clauses.length,
                detectedEntities.length
            ))

            if (detectedEntities.length > 0) {
                setTimeout(() => {
                    addChatMessage('clarence', CLARENCE_MESSAGES.entity_detected(detectedEntities.length))
                }, 2000)
            }
        }
    }, [contract, clauses, detectedEntities, chatMessages.length, addChatMessage])

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

            if (documentText.length < 100) {
                throw new Error('Document appears to be empty or could not be read')
            }

            setUploadProgress('Uploading for analysis...')

            console.log('Upload payload:', {
                user_id: userInfo.userId,
                company_id: userInfo.companyId,
                session_id: sessionId || null,
                file_name: file.name
            })

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
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'verified', verified: true }
                    : c
            ))

            const updatedClauses = clauses.map(c =>
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'verified' as const, verified: true }
                    : c
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
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'rejected', rejectionReason: reason }
                    : c
            ))

            const updatedClauses = clauses.map(c =>
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'rejected' as const, rejectionReason: reason }
                    : c
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
                    ? {
                        ...c,
                        clauseName: editName,
                        category: editCategory,
                        content: editContent,
                        status: 'verified',
                        verified: true
                    }
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
                    ? {
                        ...c,
                        clauseName: editName,
                        category: editCategory,
                        content: editContent,
                        status: 'verified' as const,
                        verified: true
                    }
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
    // CLAUSE SELECTION HANDLER (with AI Suggestion)
    // ========================================================================

    const handleClauseSelect = (clause: ContractClause) => {
        setSelectedClause(clause)

        // Fetch AI range suggestion when clause is selected
        // Only if we don't already have values for this clause
        const existingRange = clauseRanges[clause.clauseId]
        const hasExistingValues = existingRange && (existingRange.minValue || existingRange.targetValue)

        if (!hasExistingValues && lastSuggestedClauseId !== clause.clauseId) {
            fetchRangeSuggestion(clause)
        }
    }

    // ========================================================================
    // SECTION 5H: BULK SELECTION HANDLERS
    // ========================================================================

    const toggleClauseSelection = (clauseId: string, event?: React.MouseEvent) => {
        if (event) {
            event.stopPropagation()
        }
        setSelectedClauseIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(clauseId)) {
                newSet.delete(clauseId)
            } else {
                newSet.add(clauseId)
            }
            return newSet
        })
    }

    const selectAllClauses = () => {
        const allIds = clauses.map(c => c.clauseId)
        setSelectedClauseIds(new Set(allIds))
    }

    const selectAllPendingClauses = () => {
        const pendingIds = clauses
            .filter(c => c.status === 'pending')
            .map(c => c.clauseId)
        setSelectedClauseIds(new Set(pendingIds))
    }

    const selectAllInCategory = (category: string) => {
        const categoryClauseIds = clauses
            .filter(c => c.category === category)
            .map(c => c.clauseId)
        setSelectedClauseIds(prev => {
            const newSet = new Set(prev)
            categoryClauseIds.forEach(id => newSet.add(id))
            return newSet
        })
    }

    const clearSelection = () => {
        setSelectedClauseIds(new Set())
    }

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
                        status: 'verified',
                        customer_position: clausePositions[clause.clauseId]?.customerPosition,
                        provider_position: clausePositions[clause.clauseId]?.providerPosition,
                        importance: clausePositions[clause.clauseId]?.importance
                    })
                })
            }

            setClauses(prev => prev.map(c =>
                selectedClauseIds.has(c.clauseId) && c.status === 'pending'
                    ? { ...c, status: 'verified', verified: true }
                    : c
            ))

            const updatedClauses = clauses.map(c =>
                selectedClauseIds.has(c.clauseId) && c.status === 'pending'
                    ? { ...c, status: 'verified' as const, verified: true }
                    : c
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

    const handleBulkReject = async () => {
        if (!userInfo || selectedClauseIds.size === 0) return

        setIsBulkProcessing(true)
        const clausesToReject = clauses.filter(c => selectedClauseIds.has(c.clauseId) && c.status === 'pending')

        try {
            for (const clause of clausesToReject) {
                await fetch(`${API_BASE}/update-parsed-clause`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contract_id: clause.contractId,
                        clause_id: clause.clauseId,
                        user_id: userInfo.userId,
                        status: 'rejected',
                        rejection_reason: 'Bulk rejected'
                    })
                })
            }

            setClauses(prev => prev.map(c =>
                selectedClauseIds.has(c.clauseId) && c.status === 'pending'
                    ? { ...c, status: 'rejected', rejectionReason: 'Bulk rejected' }
                    : c
            ))

            const updatedClauses = clauses.map(c =>
                selectedClauseIds.has(c.clauseId) && c.status === 'pending'
                    ? { ...c, status: 'rejected' as const, rejectionReason: 'Bulk rejected' }
                    : c
            )
            buildCategoryGroups(updatedClauses)

            addChatMessage('system', `❌ Rejected ${clausesToReject.length} clauses`)
            clearSelection()

        } catch (err) {
            console.error('Error bulk rejecting:', err)
            setError('Failed to reject some clauses')
        } finally {
            setIsBulkProcessing(false)
        }
    }

    // ========================================================================
    // BULK AI CONFIGURE - Process multiple clauses with AI suggestions
    // ========================================================================

    const handleBulkAIConfigure = async () => {
        if (!userInfo || selectedClauseIds.size === 0) return

        const clausesToProcess = clauses.filter(
            c => selectedClauseIds.has(c.clauseId) && c.status === 'pending'
        )

        if (clausesToProcess.length === 0) {
            addChatMessage('system', 'All selected clauses are already configured or excluded.')
            setShowBulkAIModal(false)
            return
        }

        setIsBulkAIProcessing(true)
        setBulkAIProgress({ current: 0, total: clausesToProcess.length, currentClauseName: null })

        try {
            for (let i = 0; i < clausesToProcess.length; i++) {
                const clause = clausesToProcess[i]

                setBulkAIProgress({
                    current: i + 1,
                    total: clausesToProcess.length,
                    currentClauseName: clause.clauseName
                })

                // Fetch AI suggestion for this clause
                await fetchRangeSuggestionForBulk(clause)

                // Small delay to avoid rate limiting
                if (i < clausesToProcess.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                }
            }

            addChatMessage('clarence',
                `I've analyzed ${clausesToProcess.length} clauses and suggested ranges for each. ` +
                `Please review the suggestions and adjust as needed before finalizing.`
            )

        } catch (err) {
            console.error('Error in bulk AI configure:', err)
            setError('Some clauses could not be processed')
        } finally {
            setIsBulkAIProcessing(false)
            setBulkAIProgress(null)
            setShowBulkAIModal(false)
        }
    }

    // Separate function for bulk processing (doesn't add individual chat messages)
    const fetchRangeSuggestionForBulk = async (clause: ContractClause) => {
        try {
            const payload: Record<string, any> = {
                clause_id: clause.clauseId,
                clause_name: clause.clauseName,
                clause_content: clause.content,
                clause_category: clause.category,
                clause_number: clause.clauseNumber,
                contract_id: contract?.contractId,
                contract_name: contract?.contractName,
                contract_type: sessionData?.contractType || contract?.detectedContractType || 'general',
                session_id: sessionData?.sessionId || sessionId,
                mediation_type: sessionData?.mediationType,
                user_id: userInfo?.userId
            }

            const response = await fetch(`${API_BASE}/clarence-suggest-range`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const data = await response.json()

            if (data.success && data.suggestion) {
                const suggestion = data.suggestion

                // Pre-fill the range fields with CLARENCE's suggestion
                updateClauseRange(clause.clauseId, {
                    rangeType: suggestion.range_type,
                    unit: suggestion.unit,
                    minValue: suggestion.industry_min,
                    maxValue: suggestion.industry_max,
                    targetValue: suggestion.suggested_target,
                    walkawayValue: suggestion.suggested_walkaway,
                    importance: suggestion.suggested_importance,
                    rationale: suggestion.rationale
                })
            }
        } catch (err) {
            console.error(`Error fetching suggestion for ${clause.clauseName}:`, err)
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
                selectedClauseIds.has(c.clauseId)
                    ? { ...c, status: 'rejected', rejectionReason: 'Bulk excluded' }
                    : c
            ))

            const updatedClauses = clauses.map(c =>
                selectedClauseIds.has(c.clauseId)
                    ? { ...c, status: 'rejected' as const, rejectionReason: 'Bulk excluded' }
                    : c
            )
            buildCategoryGroups(updatedClauses)

            addChatMessage('system', `✗ Excluded ${clausesToExclude.length} clauses from negotiation`)
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
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    clause_id: clause.clauseId,
                    user_id: userInfo.userId
                })
            })

            if (!response.ok) throw new Error('Failed to delete clause')

            // Remove from local state
            const updatedClauses = clauses.filter(c => c.clauseId !== clause.clauseId)
            setClauses(updatedClauses)
            buildCategoryGroups(updatedClauses)

            // Clear selection if deleted clause was selected
            if (selectedClause?.clauseId === clause.clauseId) {
                setSelectedClause(updatedClauses.length > 0 ? updatedClauses[0] : null)
            }

            // Remove from bulk selection
            setSelectedClauseIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(clause.clauseId)
                return newSet
            })

            // Update contract clause count
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
                    body: JSON.stringify({
                        contract_id: contract.contractId,
                        clause_id: clause.clauseId,
                        user_id: userInfo.userId
                    })
                })
            }

            // Remove from local state
            const updatedClauses = clauses.filter(c => !selectedClauseIds.has(c.clauseId))
            setClauses(updatedClauses)
            buildCategoryGroups(updatedClauses)

            // Clear selection if deleted clause was selected
            if (selectedClause && selectedClauseIds.has(selectedClause.clauseId)) {
                setSelectedClause(updatedClauses.length > 0 ? updatedClauses[0] : null)
            }

            // Update contract clause count
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

        // Swap display orders
        const newOrder1 = targetClause.displayOrder
        const newOrder2 = clause.displayOrder

        setIsReordering(true)
        try {
            // Update first clause
            await fetch(`${API_BASE}/update-clause-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    clause_id: clause.clauseId,
                    display_order: newOrder1,
                    user_id: userInfo.userId
                })
            })

            // Update second clause
            await fetch(`${API_BASE}/update-clause-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    clause_id: targetClause.clauseId,
                    display_order: newOrder2,
                    user_id: userInfo.userId
                })
            })

            // Update local state
            const updatedClauses = clauses.map(c => {
                if (c.clauseId === clause.clauseId) {
                    return { ...c, displayOrder: newOrder1 }
                }
                if (c.clauseId === targetClause.clauseId) {
                    return { ...c, displayOrder: newOrder2 }
                }
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
    // SECTION 5K: POSITION SCALE HANDLERS
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

    const getPositionLabel = (value: number): string => {
        if (value <= 2) return 'Very Flexible'
        if (value <= 4) return 'Flexible'
        if (value <= 6) return 'Moderate'
        if (value <= 8) return 'Firm'
        return 'Non-Negotiable'
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

                const categories = new Set(mapped.map(c => c.category))
                setLibraryExpandedCategories(categories)
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
            const newSet = new Set(prev)
            if (newSet.has(clauseId)) {
                newSet.delete(clauseId)
            } else {
                newSet.add(clauseId)
            }
            return newSet
        })
    }

    const toggleLibraryCategory = (category: string) => {
        setLibraryExpandedCategories(prev => {
            const newSet = new Set(prev)
            if (newSet.has(category)) {
                newSet.delete(category)
            } else {
                newSet.add(category)
            }
            return newSet
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

            setContract(prev => prev ? {
                ...prev,
                clauseCount: (prev.clauseCount || 0) + selectedMasterClauseIds.size
            } : null)

            setSelectedMasterClauseIds(new Set())
            setShowClauseLibrary(false)

            addChatMessage('clarence', `I've added ${selectedMasterClauseIds.size} clause${selectedMasterClauseIds.size > 1 ? 's' : ''} to your contract. You can now review and verify each one, or adjust positions as needed.`)

        } catch (err) {
            console.error('Error adding clauses:', err)
            setError('Failed to add clauses to contract')
        } finally {
            setIsAddingClauses(false)
        }
    }

    const openClauseLibrary = () => {
        setShowClauseLibrary(true)
        if (masterClauses.length === 0) {
            loadMasterClauses()
        }
    }

    const getFilteredLibraryClauses = () => {
        let filtered = masterClauses

        if (librarySearchQuery.trim()) {
            const query = librarySearchQuery.toLowerCase()
            filtered = masterClauses.filter(c =>
                c.clauseName.toLowerCase().includes(query) ||
                c.category.toLowerCase().includes(query) ||
                c.description.toLowerCase().includes(query)
            )
        }

        const groups: { [key: string]: MasterClause[] } = {}
        filtered.forEach(clause => {
            const cat = clause.category || 'Other'
            if (!groups[cat]) {
                groups[cat] = []
            }
            groups[cat].push(clause)
        })

        return groups
    }

    const handleCommitClauses = async () => {
        if (!userInfo || !contract) return

        const verifiedClauses = clauses.filter(c => c.status === 'verified')
        if (verifiedClauses.length === 0) return

        setIsCommitting(true)

        // Use session_id from URL params, or fall back to contract's linked session
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
                    clause_positions: verifiedClauses.map(c => ({
                        clause_id: c.clauseId,
                        customer_position: clausePositions[c.clauseId]?.customerPosition || null,
                        provider_position: clausePositions[c.clauseId]?.providerPosition || null,
                        importance: clausePositions[c.clauseId]?.importance || null
                    }))
                })
            })

            if (!response.ok) throw new Error('Failed to commit clauses')

            const result = await response.json()

            addChatMessage('clarence', CLARENCE_MESSAGES.committed(verifiedClauses.length))

            const targetSessionId = result.sessionId || effectiveSessionId
            const targetContractId = contract.contractId

            // Build redirect URL - after Contract Prep, ALL paths go to invite-provider
            const params = new URLSearchParams()
            params.set('session_id', targetSessionId)
            if (targetContractId) params.set('contract_id', targetContractId)
            if (pathwayId) params.set('pathway_id', pathwayId)

            const redirectUrl = `/auth/invite-providers?${params.toString()}`

            // Create transition config
            const transition: TransitionConfig = {
                id: 'transition_to_invite',
                fromStage: 'contract_prep',
                toStage: 'invite_providers',
                title: 'Positions Locked In',
                message: "Your contract positions are locked in. Now it's time to invite your provider(s) to the negotiation. They'll receive an email with a secure link to:",
                bulletPoints: [
                    'Enter their company details',
                    'Set their own clause positions',
                    'Submit their negotiation parameters'
                ],
                buttonText: 'Continue to Invite'
            }

            // Show transition modal instead of immediate redirect
            setTimeout(() => {
                setTransitionState({
                    isOpen: true,
                    transition,
                    redirectUrl
                })
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

        if (redirectUrl) {
            router.push(redirectUrl)
        }
    }

    // ========================================================================
    // SECTION 5M: ENTITY HANDLERS
    // ========================================================================

    const handleConfirmEntity = (entityId: string, placeholder: string) => {
        setDetectedEntities(prev => prev.map(e =>
            e.id === entityId
                ? { ...e, confirmed: true, customPlaceholder: placeholder }
                : e
        ))
    }

    const handleApplyRedactions = () => {
        const confirmedEntities = detectedEntities.filter(e => e.confirmed)
        if (confirmedEntities.length === 0) return

        setClauses(prev => prev.map(clause => {
            let redactedContent = clause.content
            confirmedEntities.forEach(entity => {
                const placeholder = entity.customPlaceholder || entity.suggestedPlaceholder
                redactedContent = redactedContent.replace(
                    new RegExp(entity.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                    placeholder
                )
            })
            return { ...clause, content: redactedContent }
        }))

        addChatMessage('system', `Applied ${confirmedEntities.length} redactions to contract clauses.`)
        setShowEntitiesPanel(false)
    }

    // ========================================================================
    // SECTION 5N: UTILITY FUNCTIONS
    // ========================================================================

    const toggleCategoryExpansion = (category: string) => {
        setCategoryGroups(prev => prev.map(g =>
            g.category === category
                ? { ...g, isExpanded: !g.isExpanded }
                : g
        ))
    }

    const getFilteredClauses = () => {
        if (!searchQuery) return clauses

        const query = searchQuery.toLowerCase()
        return clauses.filter(c =>
            c.clauseName.toLowerCase().includes(query) ||
            c.category.toLowerCase().includes(query) ||
            c.content.toLowerCase().includes(query) ||
            c.clauseNumber.toLowerCase().includes(query)
        )
    }

    const stats = {
        total: clauses.length,
        pending: clauses.filter(c => c.status === 'pending').length,
        verified: clauses.filter(c => c.status === 'verified').length,
        rejected: clauses.filter(c => c.status === 'rejected').length
    }

    // ========================================================================
    // CLAUSE STATUS HELPERS
    // ========================================================================

    const getClauseStatusDisplay = (status: string) => {
        return CLAUSE_STATUS_DISPLAY[status as keyof typeof CLAUSE_STATUS_DISPLAY]
            || CLAUSE_STATUS_DISPLAY.pending
    }

    const getConfiguredCount = () => clauses.filter(c => c.status === 'verified').length
    const getExcludedCount = () => clauses.filter(c => c.status === 'rejected').length
    const getNotConfiguredCount = () => clauses.filter(c => c.status === 'pending').length

    const selectAllUnconfigured = () => {
        const unconfiguredIds = clauses
            .filter(c => c.status === 'pending')
            .map(c => c.clauseId)
        setSelectedClauseIds(new Set(unconfiguredIds))
    }

    // ============================================================================
    // SECTION 5P: RANGE MANAGEMENT FUNCTIONS
    // ============================================================================

    // Initialize default range for a clause based on its name/category
    const getDefaultRangeForClause = (clause: ContractClause): ClauseRange => {
        // Try to match clause name to suggested range type
        const clauseNameLower = clause.clauseName.toLowerCase()
        let matchedSuggestion = null

        for (const [keyword, suggestion] of Object.entries(CLAUSE_RANGE_SUGGESTIONS)) {
            if (clauseNameLower.includes(keyword.toLowerCase())) {
                matchedSuggestion = suggestion
                break
            }
        }

        if (matchedSuggestion) {
            return {
                rangeType: matchedSuggestion.rangeType,
                unit: matchedSuggestion.unit,
                minValue: '',
                maxValue: '',
                targetValue: '',
                walkawayValue: '',
                rationale: '',
                importance: 'medium'
            }
        }

        // Default to custom if no match
        return {
            rangeType: 'custom',
            unit: 'custom',
            minValue: '',
            maxValue: '',
            targetValue: '',
            walkawayValue: '',
            rationale: '',
            importance: 'medium'
        }
    }

    // Get or initialize range for a clause
    const getClauseRange = (clauseId: string, clause: ContractClause): ClauseRange => {
        if (clauseRanges[clauseId]) {
            return clauseRanges[clauseId]
        }
        return getDefaultRangeForClause(clause)
    }

    // Update range for a clause
    const updateClauseRange = (clauseId: string, updates: Partial<ClauseRange>) => {
        setClauseRanges(prev => ({
            ...prev,
            [clauseId]: {
                ...(prev[clauseId] || getDefaultRangeForClause(selectedClause!)),
                ...updates
            }
        }))
    }

    // ========================================================================
    // SAVE & CONFIGURE - Unified action that saves range AND marks as configured
    // ========================================================================

    const saveAndConfigureClause = async (clauseId: string) => {
        if (!userInfo || !contract) return

        const range = clauseRanges[clauseId]
        const clause = clauses.find(c => c.clauseId === clauseId)
        if (!clause) return

        try {
            // Step 1: Save the range (if we have range data)
            if (range) {
                const rangeResponse = await fetch(`${API_BASE}/update-clause-range`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contract_id: contract.contractId,
                        clause_id: clauseId,
                        user_id: userInfo.userId,
                        range_type: range.rangeType,
                        range_unit: range.unit,
                        range_min: range.minValue,
                        range_max: range.maxValue,
                        target_value: range.targetValue,
                        walkaway_value: range.walkawayValue,
                        rationale: range.rationale,
                        importance: range.importance
                    })
                })

                const rangeData = await rangeResponse.json()
                if (!rangeData.success) {
                    throw new Error(rangeData.error || 'Failed to save range')
                }
            }

            // Step 2: Mark clause as configured (verified)
            const statusResponse = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    clause_id: clauseId,
                    user_id: userInfo.userId,
                    status: 'verified'
                })
            })

            if (!statusResponse.ok) throw new Error('Failed to update clause status')

            // Step 3: Update local state
            setClauses(prev => prev.map(c =>
                c.clauseId === clauseId
                    ? { ...c, status: 'verified', verified: true }
                    : c
            ))

            // Step 4: Auto-tick the checkbox
            setSelectedClauseIds(prev => {
                const newSet = new Set(prev)
                newSet.add(clauseId)
                return newSet
            })

            // Step 5: Rebuild category groups
            const updatedClauses = clauses.map(c =>
                c.clauseId === clauseId
                    ? { ...c, status: 'verified' as const, verified: true }
                    : c
            )
            buildCategoryGroups(updatedClauses)

            // Step 6: Success message
            addChatMessage('system', `✓ **${clause.clauseName}** configured and ready for negotiation`)
            setIsEditingRange(false)

        } catch (err) {
            console.error('Error saving and configuring clause:', err)
            setError('Failed to save clause configuration')
        }
    }

    // ========================================================================
    // EXCLUDE CLAUSE - Marks clause as excluded from negotiation
    // ========================================================================

    const excludeClause = async (clause: ContractClause) => {
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
                    rejection_reason: 'User excluded from negotiation'
                })
            })

            if (!response.ok) throw new Error('Failed to exclude clause')

            setClauses(prev => prev.map(c =>
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'rejected', rejectionReason: 'User excluded from negotiation' }
                    : c
            ))

            const updatedClauses = clauses.map(c =>
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'rejected' as const, rejectionReason: 'User excluded from negotiation' }
                    : c
            )
            buildCategoryGroups(updatedClauses)

            addChatMessage('system', `✗ **${clause.clauseName}** excluded from negotiation`)

            // Move to next clause if this was selected
            if (selectedClause?.clauseId === clause.clauseId) {
                const nextClause = clauses.find(c => c.clauseId !== clause.clauseId && c.status === 'pending')
                if (nextClause) {
                    handleClauseSelect(nextClause)
                }
            }

        } catch (err) {
            console.error('Error excluding clause:', err)
            setError('Failed to exclude clause')
        }
    }

    // Format value with unit for display
    const formatRangeValue = (value: string, rangeType: RangeType, unit: string): string => {
        if (!value) return '—'

        switch (rangeType) {
            case 'duration':
                return `${value} ${unit}`
            case 'percentage':
                return `${value}%`
            case 'currency':
                const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
                return `${symbols[unit] || ''}${Number(value).toLocaleString()}`
            case 'count':
                return `${value} ${unit.replace('_', ' ')}`
            case 'boolean':
            case 'text':
                return value
            default:
                return value
        }
    }

    // ============================================================================
    // SECTION 5Q: RANGE SUGGESTION FUNCTION
    // Fetches AI-powered range suggestions from CLARENCE when clause is selected
    // ============================================================================

    interface RangeSuggestion {
        range_type: 'duration' | 'percentage' | 'currency' | 'count' | 'boolean' | 'text' | 'custom'
        unit: string
        industry_min: string
        industry_max: string
        suggested_target: string
        suggested_walkaway: string
        suggested_importance: 'low' | 'medium' | 'high' | 'critical'
        rationale: string
        chat_message: string
    }

    const fetchRangeSuggestion = async (clause: ContractClause) => {
        // Don't re-fetch if we already have a suggestion for this clause
        if (lastSuggestedClauseId === clause.clauseId) {
            return
        }

        // Don't fetch if we already have user-configured values
        const existingRange = clauseRanges[clause.clauseId]
        if (existingRange && (existingRange.minValue || existingRange.targetValue)) {
            return
        }

        setIsLoadingSuggestion(true)
        setSuggestionError(null)

        try {
            // Build the request payload with all available context
            const payload: Record<string, any> = {
                clause_id: clause.clauseId,
                clause_name: clause.clauseName,
                clause_content: clause.content,
                clause_category: clause.category,
                clause_number: clause.clauseNumber,
                contract_id: contract?.contractId,
                contract_name: contract?.contractName,
                contract_type: sessionData?.contractType || contract?.detectedContractType || 'general',
                session_id: sessionData?.sessionId || sessionId,
                mediation_type: sessionData?.mediationType,
                user_id: userInfo?.userId
            }

            const response = await fetch(`${API_BASE}/clarence-suggest-range`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const data = await response.json()

            if (data.success && data.suggestion) {
                const suggestion: RangeSuggestion = data.suggestion

                // Pre-fill the range fields with CLARENCE's suggestion
                updateClauseRange(clause.clauseId, {
                    rangeType: suggestion.range_type,
                    unit: suggestion.unit,
                    minValue: suggestion.industry_min,
                    maxValue: suggestion.industry_max,
                    targetValue: suggestion.suggested_target,
                    walkawayValue: suggestion.suggested_walkaway,
                    importance: suggestion.suggested_importance,
                    rationale: suggestion.rationale
                })

                // Add CLARENCE's message to the chat panel
                addChatMessage('clarence', suggestion.chat_message)

                // Track that we've suggested for this clause
                setLastSuggestedClauseId(clause.clauseId)

            } else if (data.suggestion) {
                // We got a fallback suggestion (API had issues but gave us something)
                addChatMessage('clarence', data.suggestion.chat_message)
                setSuggestionError(data.error || null)
            } else {
                throw new Error(data.error || 'Failed to get suggestion')
            }

        } catch (err) {
            console.error('Error fetching range suggestion:', err)
            setSuggestionError('Unable to get AI suggestion')

            // Add a helpful message to chat
            addChatMessage('clarence',
                `I'm having trouble analyzing the **${clause.clauseName}** clause right now. ` +
                `Please configure the range manually based on your requirements.`
            )
        } finally {
            setIsLoadingSuggestion(false)
        }
    }

    // ========================================================================
    // SECTION 6: RENDER - BULK ACTION TOOLBAR
    // ========================================================================

    const renderBulkActionToolbar = () => {
        if (selectedClauseIds.size === 0) return null

        const selectedCount = selectedClauseIds.size
        const unconfiguredSelectedCount = clauses.filter(
            c => selectedClauseIds.has(c.clauseId) && c.status === 'pending'
        ).length

        return (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
                <div className="bg-slate-800 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
                    <span className="text-sm font-medium">
                        {selectedCount} clause{selectedCount !== 1 ? 's' : ''} selected
                    </span>

                    <div className="w-px h-6 bg-slate-600" />

                    <div className="flex items-center gap-2">
                        {unconfiguredSelectedCount > 0 && (
                            <button
                                onClick={() => setShowBulkAIModal(true)}
                                disabled={isBulkProcessing || isBulkAIProcessing}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <span>🤖</span> AI Configure ({unconfiguredSelectedCount})
                            </button>
                        )}
                        <button
                            onClick={handleBulkExclude}
                            disabled={isBulkProcessing || isBulkAIProcessing}
                            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <span>✗</span> Exclude
                        </button>
                        <button
                            onClick={confirmBulkDelete}
                            disabled={isDeleting || isBulkAIProcessing}
                            className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <span>🗑️</span> Delete
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-600" />

                    <button
                        onClick={clearSelection}
                        className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 6B: RENDER - BULK AI MODAL
    // ========================================================================

    const renderBulkAIModal = () => {
        if (!showBulkAIModal) return null

        const clausesToProcess = clauses.filter(
            c => selectedClauseIds.has(c.clauseId) && c.status === 'pending'
        )

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                            <span>🤖</span> AI Batch Configuration
                        </h2>
                    </div>

                    <div className="p-6">
                        {isBulkAIProcessing ? (
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-800 mb-1">
                                        Analyzing clause {bulkAIProgress?.current} of {bulkAIProgress?.total}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {bulkAIProgress?.currentClauseName || 'Processing...'}
                                    </p>
                                </div>

                                <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${((bulkAIProgress?.current || 0) / (bulkAIProgress?.total || 1)) * 100}%` }}
                                    />
                                </div>

                                <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                                    {clausesToProcess.map((clause, idx) => (
                                        <div
                                            key={clause.clauseId}
                                            className={`px-4 py-2 flex items-center gap-3 text-sm ${idx < (bulkAIProgress?.current || 0) - 1
                                                ? 'bg-green-50 text-green-700'
                                                : idx === (bulkAIProgress?.current || 0) - 1
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-slate-500'
                                                }`}
                                        >
                                            <span>
                                                {idx < (bulkAIProgress?.current || 0) - 1
                                                    ? '✓'
                                                    : idx === (bulkAIProgress?.current || 0) - 1
                                                        ? '⟳'
                                                        : '○'}
                                            </span>
                                            <span>{clause.clauseNumber}</span>
                                            <span className="truncate">{clause.clauseName}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-600 mb-4">
                                    CLARENCE will analyze <strong>{clausesToProcess.length} clauses</strong> and suggest appropriate ranges for each one based on industry standards.
                                </p>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-amber-800">
                                        <strong>⚠️ Note:</strong> You'll be able to review and adjust each suggestion before finalizing.
                                    </p>
                                </div>

                                <div className="text-sm text-slate-500 mb-4">
                                    Estimated time: ~{Math.ceil(clausesToProcess.length * 3 / 60)} minute{Math.ceil(clausesToProcess.length * 3 / 60) !== 1 ? 's' : ''}
                                </div>

                                <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                                    {clausesToProcess.map(clause => (
                                        <div
                                            key={clause.clauseId}
                                            className="px-4 py-2 flex items-center gap-3 text-sm text-slate-600 border-b border-slate-100 last:border-0"
                                        >
                                            <span className="text-slate-400">○</span>
                                            <span className="text-slate-400 font-mono">{clause.clauseNumber}</span>
                                            <span className="truncate">{clause.clauseName}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                        {!isBulkAIProcessing && (
                            <>
                                <button
                                    onClick={() => setShowBulkAIModal(false)}
                                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkAIConfigure}
                                    className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    <span>🤖</span> Start Processing
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: RENDER - LEFT PANEL (Clause Navigation)
    // ========================================================================

    const renderLeftPanel = () => {
        const filteredClauses = getFilteredClauses()
        const documentOrderClauses = [...filteredClauses].sort((a, b) => a.displayOrder - b.displayOrder)
        const filteredCategories = categoryGroups.filter(g =>
            g.clauses.some(c => filteredClauses.find(fc => fc.clauseId === c.clauseId))
        )

        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href="/auth/contracts-dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
                        ← Back to Dashboard
                    </Link>
                    <h2 className="text-lg font-semibold text-slate-800">Contract Prep</h2>
                    {contract && (
                        <p className="text-sm text-slate-500 truncate" title={contract.contractName}>
                            {contract.contractName}
                        </p>
                    )}

                    {/* Progress Bar */}
                    {clauses.length > 0 && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <span>{getConfiguredCount()} of {clauses.length} configured</span>
                                <span>{Math.round((getConfiguredCount() / clauses.length) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(getConfiguredCount() / clauses.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="p-3 border-b border-slate-200">
                    <input
                        type="text"
                        placeholder="Search clauses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                {/* View Mode Toggle */}
                <div className="px-4 py-2 border-b border-slate-200 bg-slate-100">
                    <div className="flex items-center gap-1 p-1 bg-slate-200 rounded-lg">
                        <button
                            onClick={() => setViewMode('document')}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'document'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            📄 Document Order
                        </button>
                        <button
                            onClick={() => setViewMode('category')}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'category'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-600 hover:text-slate-800'
                                }`}
                        >
                            📁 By Category
                        </button>
                    </div>
                </div>

                {/* Selection Controls */}
                {clauses.length > 0 && (
                    <div className="px-4 py-2 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600">✓ {getConfiguredCount()}</span>
                            <span className="text-slate-400">○ {getNotConfiguredCount()}</span>
                            <span className="text-red-500">✗ {getExcludedCount()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={selectAllClauses}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                                title="Select all"
                            >
                                All
                            </button>
                            <button
                                onClick={selectAllUnconfigured}
                                className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
                                title="Select unconfigured"
                            >
                                Unconfigured
                            </button>
                            {selectedClauseIds.size > 0 && (
                                <button
                                    onClick={clearSelection}
                                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-200"
                                    title="Clear selection"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Clause Navigation */}
                <div className="flex-1 overflow-auto">
                    {viewMode === 'document' ? (
                        documentOrderClauses.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                {searchQuery ? 'No clauses match your search' : 'No clauses found'}
                            </div>
                        ) : (
                            <div className="bg-white">
                                {(() => {
                                    const parentClauses = documentOrderClauses.filter(c => c.clauseLevel === 1)

                                    const getChildClauses = (parentNumber: string) => {
                                        return documentOrderClauses.filter(c => {
                                            if (c.clauseLevel === 1) return false
                                            return c.clauseNumber.startsWith(parentNumber + '.')
                                        })
                                    }

                                    return parentClauses.map(parent => {
                                        const children = getChildClauses(parent.clauseNumber)
                                        const isExpanded = expandedParentClauses.has(parent.clauseNumber)
                                        const hasChildren = children.length > 0
                                        const isSelected = selectedClauseIds.has(parent.clauseId)

                                        return (
                                            <div key={parent.clauseId} className="border-b border-slate-200">
                                                {/* Parent Clause Header */}
                                                <div
                                                    className={`w-full px-2 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${selectedClause?.clauseId === parent.clauseId
                                                        ? 'bg-blue-100 border-l-2 border-l-blue-500'
                                                        : ''
                                                        }`}
                                                >
                                                    {/* Checkbox */}
                                                    <button
                                                        onClick={(e) => toggleClauseSelection(parent.clauseId, e)}
                                                        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected
                                                            ? 'bg-blue-600 border-blue-600'
                                                            : 'border-slate-300 hover:border-blue-400'
                                                            }`}
                                                    >
                                                        {isSelected && (
                                                            <span className="text-white text-xs">✓</span>
                                                        )}
                                                    </button>

                                                    {/* Expand/Collapse Arrow */}
                                                    {hasChildren ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleParentClauseExpansion(parent.clauseNumber)
                                                            }}
                                                            className={`transform transition-transform text-slate-400 hover:text-slate-600 ${isExpanded ? 'rotate-90' : ''}`}
                                                        >
                                                            ▶
                                                        </button>
                                                    ) : (
                                                        <span className="w-3" />
                                                    )}

                                                    {/* Status Indicator */}
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${parent.status === 'verified'
                                                        ? 'bg-green-500'
                                                        : parent.status === 'rejected'
                                                            ? 'bg-red-500'
                                                            : 'bg-amber-400'
                                                        }`} />

                                                    {/* Clause Info - Clickable */}
                                                    <button
                                                        onClick={() => handleClauseSelect(parent)}
                                                        className="flex-1 min-w-0 text-left"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500 text-xs font-mono font-medium">
                                                                {parent.clauseNumber}
                                                            </span>
                                                            <span className="font-medium text-slate-700 truncate">
                                                                {parent.clauseName}
                                                            </span>
                                                        </div>
                                                    </button>

                                                    {/* Child count badge */}
                                                    {hasChildren && (
                                                        <span className="text-xs text-slate-400">
                                                            {children.length}
                                                        </span>
                                                    )}

                                                    {/* Confidence indicator */}
                                                    {parent.aiConfidence && parent.aiConfidence < 0.8 && (
                                                        <span className="text-amber-500 text-xs" title="Low AI confidence">
                                                            ⚠
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Child Clauses */}
                                                {isExpanded && hasChildren && (
                                                    <div className="bg-slate-50">
                                                        {children.map(child => {
                                                            const indentClass = child.clauseLevel === 2 ? 'pl-10'
                                                                : child.clauseLevel === 3 ? 'pl-14'
                                                                    : 'pl-18'
                                                            const isChildSelected = selectedClauseIds.has(child.clauseId)

                                                            return (
                                                                <div
                                                                    key={child.clauseId}
                                                                    className={`w-full px-2 py-2 ${indentClass} text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 border-t border-slate-100 ${selectedClause?.clauseId === child.clauseId
                                                                        ? 'bg-blue-100 border-l-2 border-l-blue-500'
                                                                        : ''
                                                                        }`}
                                                                >
                                                                    {/* Checkbox */}
                                                                    <button
                                                                        onClick={(e) => toggleClauseSelection(child.clauseId, e)}
                                                                        className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isChildSelected
                                                                            ? 'bg-blue-600 border-blue-600'
                                                                            : 'border-slate-300 hover:border-blue-400'
                                                                            }`}
                                                                    >
                                                                        {isChildSelected && (
                                                                            <span className="text-white text-xs">✓</span>
                                                                        )}
                                                                    </button>

                                                                    {/* Status Indicator */}
                                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${child.status === 'verified'
                                                                        ? 'bg-green-500'
                                                                        : child.status === 'rejected'
                                                                            ? 'bg-red-500'
                                                                            : 'bg-amber-400'
                                                                        }`} />

                                                                    {/* Clause Info - Clickable */}
                                                                    <button
                                                                        onClick={() => handleClauseSelect(child)}
                                                                        className="flex-1 min-w-0 text-left"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-slate-400 text-xs font-mono">
                                                                                {child.clauseNumber}
                                                                            </span>
                                                                            <span className="truncate text-slate-600">
                                                                                {child.clauseName}
                                                                            </span>
                                                                        </div>
                                                                    </button>

                                                                    {/* Confidence indicator */}
                                                                    {child.aiConfidence && child.aiConfidence < 0.8 && (
                                                                        <span className="text-amber-500 text-xs" title="Low AI confidence">
                                                                            ⚠
                                                                        </span>
                                                                    )}
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
                            <div className="p-4 text-center text-slate-500 text-sm">
                                {searchQuery ? 'No clauses match your search' : 'No clauses found'}
                            </div>
                        ) : (
                            filteredCategories.map(group => {
                                const groupFilteredClauses = group.clauses.filter(c =>
                                    filteredClauses.find(fc => fc.clauseId === c.clauseId)
                                )

                                return (
                                    <div key={group.category} className="border-b border-slate-200">
                                        {/* Category Header */}
                                        <button
                                            onClick={() => toggleCategoryExpansion(group.category)}
                                            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`transform transition-transform ${group.isExpanded ? 'rotate-90' : ''}`}>
                                                    ▶
                                                </span>
                                                <span className="font-medium text-sm text-slate-700">
                                                    {group.category}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        selectAllInCategory(group.category)
                                                    }}
                                                    className="text-xs text-blue-500 hover:text-blue-700 ml-2"
                                                    title="Select all in category"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {groupFilteredClauses.length}
                                            </span>
                                        </button>

                                        {/* Clauses in Category */}
                                        {group.isExpanded && (
                                            <div className="bg-white">
                                                {groupFilteredClauses.map(clause => {
                                                    const isSelected = selectedClauseIds.has(clause.clauseId)

                                                    return (
                                                        <div
                                                            key={clause.clauseId}
                                                            className={`w-full px-4 py-2 pl-6 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${selectedClause?.clauseId === clause.clauseId
                                                                ? 'bg-blue-100 border-l-2 border-blue-500'
                                                                : ''
                                                                }`}
                                                        >
                                                            {/* Checkbox */}
                                                            <button
                                                                onClick={(e) => toggleClauseSelection(clause.clauseId, e)}
                                                                className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected
                                                                    ? 'bg-blue-600 border-blue-600'
                                                                    : 'border-slate-300 hover:border-blue-400'
                                                                    }`}
                                                            >
                                                                {isSelected && (
                                                                    <span className="text-white text-xs">✓</span>
                                                                )}
                                                            </button>

                                                            {/* Status Indicator */}
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clause.status === 'verified'
                                                                ? 'bg-green-500'
                                                                : clause.status === 'rejected'
                                                                    ? 'bg-red-500'
                                                                    : 'bg-amber-400'
                                                                }`} />

                                                            {/* Clause Info */}
                                                            <button
                                                                onClick={() => handleClauseSelect(clause)}
                                                                className="flex-1 min-w-0 text-left"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    {clause.clauseNumber && (
                                                                        <span className="text-slate-400 text-xs">
                                                                            {clause.clauseNumber}
                                                                        </span>
                                                                    )}
                                                                    <span className="truncate text-slate-700">
                                                                        {clause.clauseName}
                                                                    </span>
                                                                </div>
                                                            </button>

                                                            {/* Confidence indicator */}
                                                            {clause.aiConfidence && clause.aiConfidence < 0.8 && (
                                                                <span className="text-amber-500 text-xs" title="Low AI confidence">
                                                                    ⚠
                                                                </span>
                                                            )}
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
                <div className="p-4 border-t border-slate-200 bg-white space-y-2">
                    {/* Add Clause Button */}
                    <button
                        onClick={openClauseLibrary}
                        className="w-full px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                        ➕ Add Clause from Library
                    </button>

                    {detectedEntities.length > 0 && (
                        <button
                            onClick={() => setShowEntitiesPanel(!showEntitiesPanel)}
                            className="w-full px-4 py-2 rounded-lg bg-amber-100 text-amber-800 font-medium text-sm hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                        >
                            🔒 Review Entities ({detectedEntities.length})
                        </button>
                    )}

                    {stats.verified > 0 && (
                        <button
                            onClick={handleCommitClauses}
                            disabled={isCommitting}
                            className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isCommitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Committing...
                                </>
                            ) : (
                                <>
                                    Commit {stats.verified} Clauses
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 8: RENDER - CENTER PANEL (COMPLETE REPLACEMENT)
    // ============================================================================

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

        // ====================================================================
        // LOADING OVERLAY FOR AI SUGGESTIONS
        // ====================================================================
        const renderSuggestionLoadingOverlay = () => {
            if (!isLoadingSuggestion) return null

            return (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                    <div className="text-center p-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            Clarence is analyzing...
                        </h3>
                        <p className="text-sm text-slate-500 max-w-xs">
                            Reviewing clause context and suggesting appropriate ranges based on industry standards
                        </p>
                        {suggestionError && (
                            <p className="text-sm text-amber-600 mt-3">
                                {suggestionError}
                            </p>
                        )}
                    </div>
                </div>
            )
        }

        // Loading state
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

        // No contract - show upload
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
                                    <p className="text-sm text-slate-500">
                                        Please wait while we analyze your document
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-3xl">📤</span>
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-800 mb-2">
                                        Upload Your Contract
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Drag and drop or click to upload a PDF, DOCX, or TXT file
                                    </p>
                                    <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium inline-block">
                                        Choose File
                                    </span>
                                    <p className="text-xs text-slate-400 mt-4">
                                        Maximum file size: 10MB
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )
        }

        // Processing state
        if (contract.status === 'processing') {
            return (
                <div className="h-full flex items-center justify-center bg-white">
                    {fileInput}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">
                            Analyzing Contract
                        </h3>
                        <p className="text-sm text-slate-500 mb-2">
                            Identifying clauses, categories, and entities...
                        </p>
                        <p className="text-xs text-slate-400">
                            This typically takes 1-2 minutes
                        </p>
                    </div>
                </div>
            )
        }

        // No clause selected
        if (!selectedClause) {
            return (
                <div className="h-full flex items-center justify-center bg-white">
                    {fileInput}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📋</span>
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">
                            Select a Clause
                        </h3>
                        <p className="text-sm text-slate-500">
                            Click on a clause in the left panel to view and configure its range
                        </p>
                    </div>
                </div>
            )
        }

        // Get current range for selected clause
        const currentRange = getClauseRange(selectedClause.clauseId, selectedClause)
        const rangeConfig = RANGE_TYPE_CONFIG[currentRange.rangeType]

        // Find clause index for move buttons
        const sortedClauses = [...clauses].sort((a, b) => a.displayOrder - b.displayOrder)
        const currentIndex = sortedClauses.findIndex(c => c.clauseId === selectedClause.clauseId)
        const canMoveUp = currentIndex > 0
        const canMoveDown = currentIndex < sortedClauses.length - 1

        // Check if range is complete
        const isRangeComplete = currentRange.rangeType === 'boolean' || currentRange.rangeType === 'text'
            ? currentRange.targetValue !== ''
            : currentRange.minValue !== '' && currentRange.maxValue !== ''

        // Clause details with range configuration
        return (
            <div className="h-full flex flex-col bg-white">
                {fileInput}

                {/* Clause Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {selectedClause.clauseNumber && (
                                    <span className="text-sm text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                        {selectedClause.clauseNumber}
                                    </span>
                                )}
                                <h1 className="text-xl font-semibold text-slate-800">
                                    {selectedClause.clauseName}
                                </h1>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-600">
                                    {selectedClause.category}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedClause.status === 'verified'
                                    ? 'bg-green-100 text-green-700'
                                    : selectedClause.status === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {selectedClause.status.charAt(0).toUpperCase() + selectedClause.status.slice(1)}
                                </span>
                                {isRangeComplete && (
                                    <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700">
                                        ✓ Range Configured
                                    </span>
                                )}
                                {selectedClause.aiConfidence && (
                                    <span className={`text-sm ${selectedClause.aiConfidence >= 0.9
                                        ? 'text-green-600'
                                        : selectedClause.aiConfidence >= 0.7
                                            ? 'text-amber-600'
                                            : 'text-red-600'
                                        }`}>
                                        {Math.round(selectedClause.aiConfidence * 100)}% confidence
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Move Buttons */}
                            <div className="flex items-center gap-1 mr-3 bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => handleMoveClause(selectedClause, 'up')}
                                    disabled={!canMoveUp || isReordering}
                                    className="px-3 py-1.5 rounded-md bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium shadow-sm flex items-center gap-1"
                                    title="Move up"
                                >
                                    <span>↑</span> Up
                                </button>
                                <button
                                    onClick={() => handleMoveClause(selectedClause, 'down')}
                                    disabled={!canMoveDown || isReordering}
                                    className="px-3 py-1.5 rounded-md bg-white text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium shadow-sm flex items-center gap-1"
                                    title="Move down"
                                >
                                    <span>↓</span> Down
                                </button>
                            </div>

                            {/* Edit Button - Always Available */}
                            <button
                                onClick={() => {
                                    setEditingClause(selectedClause)
                                    setEditName(selectedClause.clauseName)
                                    setEditCategory(selectedClause.category)
                                    setEditContent(selectedClause.content)
                                }}
                                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition-colors flex items-center gap-2"
                            >
                                ✏️ Edit
                            </button>

                            {/* Exclude Button - Only for non-excluded clauses */}
                            {selectedClause.status !== 'rejected' && (
                                <button
                                    onClick={() => excludeClause(selectedClause)}
                                    className="px-4 py-2 rounded-lg bg-amber-100 text-amber-700 font-medium hover:bg-amber-200 transition-colors flex items-center gap-2"
                                >
                                    ✗ Exclude
                                </button>
                            )}

                            {/* Delete Button */}
                            <button
                                onClick={() => confirmDeleteClause(selectedClause)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                                title="Delete clause"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content - Scrollable */}
                <div className="flex-1 overflow-auto">
                    {/* Clause Content Preview */}
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Clause Text</h3>
                            <button
                                onClick={() => {
                                    setEditingClause(selectedClause)
                                    setEditName(selectedClause.clauseName)
                                    setEditCategory(selectedClause.category)
                                    setEditContent(selectedClause.content)
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                            >
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

                    {/* Range Configuration Section */}
                    <div className="p-6 relative">
                        {/* AI Suggestion Loading Overlay */}
                        {renderSuggestionLoadingOverlay()}

                        <div className={`transition-opacity duration-200 ${isLoadingSuggestion ? 'opacity-30 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">Range Configuration</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Define the acceptable range for this clause in your negotiation
                                    </p>
                                </div>
                                {!isEditingRange && isRangeComplete && (
                                    <button
                                        onClick={() => setIsEditingRange(true)}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        Edit Range
                                    </button>
                                )}
                            </div>

                            {/* Range Type Selector */}
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                                {/* Range Type */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Range Type
                                    </label>
                                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                        {(Object.keys(RANGE_TYPE_CONFIG) as RangeType[]).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => updateClauseRange(selectedClause.clauseId, {
                                                    rangeType: type,
                                                    unit: RANGE_TYPE_CONFIG[type].units[0].value
                                                })}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentRange.rangeType === type
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                                                    }`}
                                            >
                                                {RANGE_TYPE_CONFIG[type].label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {rangeConfig.description}
                                    </p>
                                </div>

                                {/* Unit Selector */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Unit
                                    </label>
                                    <select
                                        value={currentRange.unit}
                                        onChange={(e) => updateClauseRange(selectedClause.clauseId, { unit: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    >
                                        {rangeConfig.units.map((unit) => (
                                            <option key={unit.value} value={unit.value}>
                                                {unit.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Value Inputs - Conditional based on range type */}
                                {currentRange.rangeType === 'boolean' ? (
                                    /* Boolean Range */
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-emerald-700 mb-2">
                                                🎯 Our Preferred Position
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateClauseRange(selectedClause.clauseId, { targetValue: 'Yes' })}
                                                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${currentRange.targetValue === 'Yes'
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                                                        }`}
                                                >
                                                    Yes / Allowed
                                                </button>
                                                <button
                                                    onClick={() => updateClauseRange(selectedClause.clauseId, { targetValue: 'No' })}
                                                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${currentRange.targetValue === 'No'
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                                                        }`}
                                                >
                                                    No / Prohibited
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-amber-700 mb-2">
                                                ⚠️ Would Accept (Walkaway)
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateClauseRange(selectedClause.clauseId, { walkawayValue: 'Yes' })}
                                                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${currentRange.walkawayValue === 'Yes'
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
                                                        }`}
                                                >
                                                    Yes / Allowed
                                                </button>
                                                <button
                                                    onClick={() => updateClauseRange(selectedClause.clauseId, { walkawayValue: 'No' })}
                                                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${currentRange.walkawayValue === 'No'
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'
                                                        }`}
                                                >
                                                    No / Prohibited
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : currentRange.rangeType === 'text' ? (
                                    /* Text Range */
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-emerald-700 mb-2">
                                                🎯 Our Preferred Position
                                            </label>
                                            <input
                                                type="text"
                                                value={currentRange.targetValue}
                                                onChange={(e) => updateClauseRange(selectedClause.clauseId, { targetValue: e.target.value })}
                                                placeholder="e.g., England & Wales"
                                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-amber-700 mb-2">
                                                ⚠️ Would Accept (Walkaway)
                                            </label>
                                            <input
                                                type="text"
                                                value={currentRange.walkawayValue}
                                                onChange={(e) => updateClauseRange(selectedClause.clauseId, { walkawayValue: e.target.value })}
                                                placeholder="e.g., Any EU jurisdiction"
                                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Numeric Ranges (Duration, Percentage, Currency, Count) */
                                    <>
                                        {/* Industry Range */}
                                        <div className="mb-6">
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                📊 Typical Industry Range
                                            </label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Minimum</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={currentRange.minValue}
                                                            onChange={(e) => updateClauseRange(selectedClause.clauseId, { minValue: e.target.value })}
                                                            placeholder={rangeConfig.placeholder.min}
                                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-16"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                                            {currentRange.rangeType === 'percentage' ? '%' :
                                                                currentRange.rangeType === 'currency' ? currentRange.unit :
                                                                    currentRange.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Maximum</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={currentRange.maxValue}
                                                            onChange={(e) => updateClauseRange(selectedClause.clauseId, { maxValue: e.target.value })}
                                                            placeholder={rangeConfig.placeholder.max}
                                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-16"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                                            {currentRange.rangeType === 'percentage' ? '%' :
                                                                currentRange.rangeType === 'currency' ? currentRange.unit :
                                                                    currentRange.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Target and Walkaway */}
                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                                                <label className="block text-sm font-semibold text-emerald-700 mb-2">
                                                    🎯 Our Target
                                                </label>
                                                <p className="text-xs text-emerald-600 mb-2">What we're aiming for</p>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={currentRange.targetValue}
                                                        onChange={(e) => updateClauseRange(selectedClause.clauseId, { targetValue: e.target.value })}
                                                        placeholder={rangeConfig.placeholder.target}
                                                        className="w-full px-4 py-2.5 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>
                                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                                <label className="block text-sm font-semibold text-amber-700 mb-2">
                                                    ⚠️ Our Walkaway
                                                </label>
                                                <p className="text-xs text-amber-600 mb-2">Bottom line we'd accept</p>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={currentRange.walkawayValue}
                                                        onChange={(e) => updateClauseRange(selectedClause.clauseId, { walkawayValue: e.target.value })}
                                                        placeholder={rangeConfig.placeholder.walkaway}
                                                        className="w-full px-4 py-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Importance Level */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Clause Importance
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                                            <button
                                                key={level}
                                                onClick={() => updateClauseRange(selectedClause.clauseId, { importance: level })}
                                                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${currentRange.importance === level
                                                    ? level === 'critical'
                                                        ? 'bg-red-600 text-white shadow-md'
                                                        : level === 'high'
                                                            ? 'bg-amber-500 text-white shadow-md'
                                                            : level === 'medium'
                                                                ? 'bg-blue-500 text-white shadow-md'
                                                                : 'bg-slate-500 text-white shadow-md'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {level.charAt(0).toUpperCase() + level.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Rationale */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Rationale / Notes
                                    </label>
                                    <textarea
                                        value={currentRange.rationale}
                                        onChange={(e) => updateClauseRange(selectedClause.clauseId, { rationale: e.target.value })}
                                        placeholder="Why is this range important? Any context for the negotiation..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                                    />
                                </div>

                                {/* Save & Configure Button */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                    <div className="text-sm text-slate-500">
                                        {selectedClause.status === 'verified' ? (
                                            <span className="text-green-600 flex items-center gap-1">
                                                <span>✓</span> Clause configured and ready
                                            </span>
                                        ) : selectedClause.status === 'rejected' ? (
                                            <span className="text-red-500 flex items-center gap-1">
                                                <span>✗</span> Clause excluded from negotiation
                                            </span>
                                        ) : isRangeComplete ? (
                                            <span className="text-blue-600 flex items-center gap-1">
                                                <span>●</span> Range complete - ready to configure
                                            </span>
                                        ) : (
                                            <span className="text-amber-600 flex items-center gap-1">
                                                <span>⚠</span> Please complete the range values
                                            </span>
                                        )}
                                    </div>
                                    {selectedClause.status !== 'rejected' && (
                                        <button
                                            onClick={() => saveAndConfigureClause(selectedClause.clauseId)}
                                            disabled={!isRangeComplete || selectedClause.status === 'verified'}
                                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                        >
                                            {selectedClause.status === 'verified' ? (
                                                <>✓ Configured</>
                                            ) : (
                                                <>✓ Save & Configure</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Range Summary Card (shows when complete) */}
                            {isRangeComplete && (
                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h4 className="text-sm font-semibold text-blue-800 mb-3">Range Summary</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        {currentRange.rangeType !== 'boolean' && currentRange.rangeType !== 'text' && (
                                            <>
                                                <div>
                                                    <span className="text-blue-600 text-xs uppercase tracking-wide">Industry Min</span>
                                                    <p className="font-medium text-blue-900">
                                                        {formatRangeValue(currentRange.minValue, currentRange.rangeType, currentRange.unit)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-blue-600 text-xs uppercase tracking-wide">Industry Max</span>
                                                    <p className="font-medium text-blue-900">
                                                        {formatRangeValue(currentRange.maxValue, currentRange.rangeType, currentRange.unit)}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <span className="text-emerald-600 text-xs uppercase tracking-wide">Our Target</span>
                                            <p className="font-medium text-emerald-700">
                                                {formatRangeValue(currentRange.targetValue, currentRange.rangeType, currentRange.unit)}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-amber-600 text-xs uppercase tracking-wide">Walkaway</span>
                                            <p className="font-medium text-amber-700">
                                                {formatRangeValue(currentRange.walkawayValue, currentRange.rangeType, currentRange.unit)}
                                            </p>
                                        </div>
                                    </div>
                                    {currentRange.rationale && (
                                        <div className="mt-3 pt-3 border-t border-blue-200">
                                            <span className="text-blue-600 text-xs uppercase tracking-wide">Rationale</span>
                                            <p className="text-sm text-blue-800 mt-1">{currentRange.rationale}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AI Suggestions */}
                            {selectedClause.aiSuggestion && (
                                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <h4 className="text-sm font-medium text-purple-800 mb-2 flex items-center gap-2">
                                        <span>🤖</span> AI Suggestion
                                    </h4>
                                    <p className="text-sm text-purple-700">{selectedClause.aiSuggestion}</p>
                                </div>
                            )}
                        </div>{/* End of opacity wrapper */}
                    </div>
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
    // SECTION 9: RENDER - RIGHT PANEL (Chat + Entities)
    // ========================================================================

    const renderRightPanel = () => {
        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white border-l border-slate-200">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white">
                    <button
                        onClick={() => setShowEntitiesPanel(false)}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${!showEntitiesPanel
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        💬 Clarence
                    </button>
                    <button
                        onClick={() => setShowEntitiesPanel(true)}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${showEntitiesPanel
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        🔒 Entities {detectedEntities.length > 0 && `(${detectedEntities.length})`}
                    </button>
                </div>

                {showEntitiesPanel ? (
                    <div className="flex-1 overflow-auto p-4">
                        {detectedEntities.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-2xl">🔍</span>
                                </div>
                                <p className="text-slate-500 text-sm">No entities detected</p>
                                <p className="text-slate-400 text-xs mt-1">
                                    Company names and other identifiers will appear here
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600 mb-4">
                                    Review detected entities and confirm their placeholders for redaction:
                                </p>
                                <div className="space-y-3">
                                    {detectedEntities.map(entity => (
                                        <div
                                            key={entity.id}
                                            className={`p-3 rounded-lg border ${entity.confirmed
                                                ? 'bg-green-50 border-green-200'
                                                : 'bg-white border-slate-200'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <span className="text-xs text-slate-400 uppercase">{entity.type}</span>
                                                    <p className="font-medium text-slate-800">{entity.value}</p>
                                                </div>
                                                {entity.confirmed && (
                                                    <span className="text-green-600 text-sm">✓</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={entity.customPlaceholder || entity.suggestedPlaceholder}
                                                    onChange={(e) => handleConfirmEntity(entity.id, e.target.value)}
                                                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:border-blue-500"
                                                >
                                                    {ENTITY_PLACEHOLDERS[entity.type]?.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleConfirmEntity(entity.id, entity.customPlaceholder || entity.suggestedPlaceholder)}
                                                    className={`px-3 py-1 rounded text-sm font-medium ${entity.confirmed
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                        }`}
                                                >
                                                    {entity.confirmed ? 'Confirmed' : 'Confirm'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <button
                                        onClick={handleApplyRedactions}
                                        disabled={!detectedEntities.some(e => e.confirmed)}
                                        className="w-full px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Apply Redactions
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
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
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-md'
                                            : message.role === 'system'
                                                ? 'bg-slate-100 text-slate-600 rounded-bl-md text-sm'
                                                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                                            }`}
                                    >
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
                        <button
                            onClick={() => setEditingClause(null)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-4 space-y-4 overflow-auto max-h-[calc(90vh-140px)]">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Clause Name
                            </label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            {editingClause.aiSuggestedName && editingClause.aiSuggestedName !== editName && (
                                <p className="text-xs text-slate-400 mt-1">
                                    AI suggested: {editingClause.aiSuggestedName}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Category
                            </label>
                            <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                                {CLAUSE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Content
                            </label>
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={10}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            onClick={() => setEditingClause(null)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveEdit}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                        >
                            Save & Verify
                        </button>
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
                                : `Are you sure you want to delete "${clauseName}"? This action cannot be undone.`
                            }
                        </p>
                    </div>

                    <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowDeleteConfirm(false)
                                setClauseToDelete(null)
                                setDeleteTarget(null)
                            }}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (isBulk) {
                                    handleBulkDelete()
                                } else if (clauseToDelete) {
                                    handleDeleteClause(clauseToDelete)
                                }
                            }}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const renderClauseLibraryModal = () => {
        if (!showClauseLibrary) return null

        const groupedClauses = getFilteredLibraryClauses()
        const categoryOrder = ['Liability', 'Payment', 'Service Levels', 'Termination', 'Data Protection',
            'Intellectual Property', 'Confidentiality', 'Governance', 'General', 'Other']
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
                        <button
                            onClick={() => setShowClauseLibrary(false)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-4 border-b border-slate-200 flex-shrink-0">
                        <div className="relative">
                            <input
                                type="text"
                                value={librarySearchQuery}
                                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                                placeholder="Search clauses by name, category, or description..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
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
                                        <button
                                            onClick={() => toggleLibraryCategory(category)}
                                            className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`transform transition-transform ${libraryExpandedCategories.has(category) ? 'rotate-90' : ''}`}>
                                                    ▶
                                                </span>
                                                <span className="font-medium text-slate-700">{category}</span>
                                                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                                    {groupedClauses[category].length}
                                                </span>
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
                                                        <div
                                                            key={clause.clauseId}
                                                            className={`px-4 py-3 flex items-start gap-3 ${isAlreadyInContract
                                                                ? 'bg-slate-50 opacity-60'
                                                                : isSelected
                                                                    ? 'bg-blue-50'
                                                                    : 'hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <button
                                                                onClick={() => !isAlreadyInContract && toggleMasterClauseSelection(clause.clauseId)}
                                                                disabled={isAlreadyInContract}
                                                                className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isAlreadyInContract
                                                                    ? 'bg-slate-200 border-slate-300 cursor-not-allowed'
                                                                    : isSelected
                                                                        ? 'bg-blue-600 border-blue-600'
                                                                        : 'border-slate-300 hover:border-blue-400'
                                                                    }`}
                                                            >
                                                                {(isSelected || isAlreadyInContract) && (
                                                                    <span className="text-white text-xs">✓</span>
                                                                )}
                                                            </button>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-slate-800">{clause.clauseName}</span>
                                                                    {clause.isRequired && (
                                                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>
                                                                    )}
                                                                    {isAlreadyInContract && (
                                                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Already added</span>
                                                                    )}
                                                                </div>
                                                                {clause.description && (
                                                                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{clause.description}</p>
                                                                )}
                                                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                                    <span title="Default customer position">
                                                                        Customer: {clause.defaultCustomerPosition}/10
                                                                    </span>
                                                                    <span title="Default provider position">
                                                                        Provider: {clause.defaultProviderPosition}/10
                                                                    </span>
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
                            {selectedMasterClauseIds.size > 0 ? (
                                <span className="font-medium text-blue-600">
                                    {selectedMasterClauseIds.size} clause{selectedMasterClauseIds.size > 1 ? 's' : ''} selected
                                </span>
                            ) : (
                                <span>Select clauses to add</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowClauseLibrary(false)}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addSelectedClausesToContract}
                                disabled={selectedMasterClauseIds.size === 0 || isAddingClauses}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isAddingClauses ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        Add {selectedMasterClauseIds.size > 0 ? selectedMasterClauseIds.size : ''} Clause{selectedMasterClauseIds.size !== 1 ? 's' : ''}
                                    </>
                                )}
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
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Processing Your Contract
                        </h3>
                        <p className="text-slate-600 mb-4">
                            {uploadProgress || 'Preparing document...'}
                        </p>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-4">
                            This may take 1-2 minutes for larger documents
                        </p>
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
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Loading Contract
                        </h3>
                        <p className="text-slate-600">
                            Fetching contract details...
                        </p>
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
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Analyzing Contract
                        </h3>
                        <p className="text-slate-600 mb-2">
                            CLARENCE is identifying clauses, categories, and entities...
                        </p>
                        <p className="text-sm text-slate-500 mb-4">
                            {contract.fileName}
                        </p>
                        <div className="flex items-center justify-center gap-2 text-blue-600">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <p className="text-xs text-slate-400 mt-4">
                            This typically takes 1-2 minutes
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="h-14 bg-slate-800 flex items-center justify-between px-6 flex-shrink-0">
                {/* Left: CLARENCE Create branding */}
                <div className="flex items-center gap-3">
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
                        <span className="text-white text-sm">
                            {userInfo.firstName?.[0]}{userInfo.lastName?.[0]}
                        </span>
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

            {/* Bulk Action Toolbar */}
            {renderBulkActionToolbar()}
            {renderBulkAIModal()}

            {/* Edit Modal */}
            {renderEditModal()}

            {/* Clause Library Modal */}
            {renderClauseLibraryModal()}

            {/* Delete Confirmation Modal */}
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