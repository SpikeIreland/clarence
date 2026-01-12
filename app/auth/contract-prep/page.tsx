'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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

    // Session Data State
    const [sessionData, setSessionData] = useState<SessionData | null>(null)

    // Delete Confirmation Modal
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null)
    const [clauseToDelete, setClauseToDelete] = useState<ContractClause | null>(null)

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
        if (sessionId) {
            loadSession(sessionId)
        }
    }, [sessionId, loadSession])

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

        try {
            const response = await fetch(`${API_BASE}/commit-parsed-clauses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    session_id: sessionId,
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

            const targetSessionId = result.sessionId || sessionId
            const targetContractId = contract.contractId
            const mediationType = sessionData?.mediationType

            setTimeout(() => {
                if (mediationType === 'straight_to_contract') {
                    addChatMessage('clarence', 'Your clauses are committed. Next step: invite providers to begin the contract process.')
                    router.push(`/auth/invite-providers?session_id=${targetSessionId}&contract_id=${targetContractId}`)
                } else {
                    let nextUrl = `/auth/strategic-assessment?session_id=${targetSessionId}`
                    if (targetContractId) {
                        nextUrl += `&contract_id=${targetContractId}`
                    }
                    router.push(nextUrl)
                }
            }, 2000)

        } catch (err) {
            console.error('Error committing clauses:', err)
            setError('Failed to commit clauses')
        } finally {
            setIsCommitting(false)
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
    // SECTION 6: RENDER - BULK ACTION TOOLBAR
    // ========================================================================

    const renderBulkActionToolbar = () => {
        if (selectedClauseIds.size === 0) return null

        const selectedCount = selectedClauseIds.size
        const pendingSelectedCount = clauses.filter(c => selectedClauseIds.has(c.clauseId) && c.status === 'pending').length

        return (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
                <div className="bg-slate-800 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
                    <span className="text-sm font-medium">
                        {selectedCount} clause{selectedCount !== 1 ? 's' : ''} selected
                    </span>

                    <div className="w-px h-6 bg-slate-600" />

                    <div className="flex items-center gap-2">
                        {pendingSelectedCount > 0 && (
                            <>
                                <button
                                    onClick={handleBulkVerify}
                                    disabled={isBulkProcessing}
                                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    <span>✓</span> Verify ({pendingSelectedCount})
                                </button>
                                <button
                                    onClick={handleBulkReject}
                                    disabled={isBulkProcessing}
                                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    <span>✕</span> Reject
                                </button>
                            </>
                        )}
                        <button
                            onClick={confirmBulkDelete}
                            disabled={isDeleting}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
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
                    <h2 className="text-lg font-semibold text-slate-800">Contract Studio</h2>
                    {contract && (
                        <p className="text-sm text-slate-500 truncate" title={contract.contractName}>
                            {contract.contractName}
                        </p>
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
                            <span className="text-slate-600">{stats.total} clauses</span>
                            <span className="text-amber-600">⏳ {stats.pending}</span>
                            <span className="text-green-600">✓ {stats.verified}</span>
                            <span className="text-red-600">✕ {stats.rejected}</span>
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
                                onClick={selectAllPendingClauses}
                                className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50"
                                title="Select pending"
                            >
                                Pending
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
                                                        onClick={() => setSelectedClause(parent)}
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
                                                                        onClick={() => setSelectedClause(child)}
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
                                                                onClick={() => setSelectedClause(clause)}
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

    // ========================================================================
    // SECTION 8: RENDER - CENTER PANEL (Clause Details)
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
                            Click on a clause in the left panel to view its details
                        </p>
                    </div>
                </div>
            )
        }

        // Find clause index for move buttons
        const sortedClauses = [...clauses].sort((a, b) => a.displayOrder - b.displayOrder)
        const currentIndex = sortedClauses.findIndex(c => c.clauseId === selectedClause.clauseId)
        const canMoveUp = currentIndex > 0
        const canMoveDown = currentIndex < sortedClauses.length - 1

        // Clause details
        return (
            <div className="h-full flex flex-col bg-white">
                {fileInput}

                {/* Clause Header */}
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {selectedClause.clauseNumber && (
                                    <span className="text-sm text-slate-400 font-mono">
                                        {selectedClause.clauseNumber}
                                    </span>
                                )}
                                <h1 className="text-xl font-semibold text-slate-800">
                                    {selectedClause.clauseName}
                                </h1>
                            </div>
                            <div className="flex items-center gap-3">
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
                            <div className="flex flex-col gap-1 mr-2">
                                <button
                                    onClick={() => handleMoveClause(selectedClause, 'up')}
                                    disabled={!canMoveUp || isReordering}
                                    className="px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                                    title="Move up"
                                >
                                    ↑
                                </button>
                                <button
                                    onClick={() => handleMoveClause(selectedClause, 'down')}
                                    disabled={!canMoveDown || isReordering}
                                    className="px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                                    title="Move down"
                                >
                                    ↓
                                </button>
                            </div>

                            {selectedClause.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => handleVerifyClause(selectedClause)}
                                        className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                                    >
                                        ✓ Verify
                                    </button>
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
                                    <button
                                        onClick={() => handleRejectClause(selectedClause, 'User rejected')}
                                        className="px-4 py-2 rounded-lg bg-amber-100 text-amber-700 font-medium hover:bg-amber-200 transition-colors flex items-center gap-2"
                                    >
                                        ✕ Reject
                                    </button>
                                </>
                            )}

                            {/* Delete Button - Always shown */}
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

                {/* Clause Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="prose prose-slate max-w-none">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {selectedClause.content}
                            </p>
                        </div>
                    </div>

                    {/* AI Suggestions */}
                    {selectedClause.aiSuggestion && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                                <span>🤖</span> AI Suggestion
                            </h3>
                            <p className="text-sm text-blue-700">{selectedClause.aiSuggestion}</p>
                        </div>
                    )}

                    {/* Position Scales */}
                    {selectedClause.status === 'pending' && (
                        <div className="mt-6 p-5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                ⚖️ Initial Negotiation Stance
                            </h3>

                            {/* Customer Position */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                        Your Position (Customer)
                                    </label>
                                    <span className="text-sm text-emerald-600 font-medium">
                                        {clausePositions[selectedClause.clauseId]?.customerPosition ?? 5} - {getPositionLabel(clausePositions[selectedClause.clauseId]?.customerPosition ?? 5)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={clausePositions[selectedClause.clauseId]?.customerPosition ?? 5}
                                    onChange={(e) => updateClausePosition(selectedClause.clauseId, 'customerPosition', parseInt(e.target.value))}
                                    className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Very Flexible</span>
                                    <span>Non-Negotiable</span>
                                </div>
                            </div>

                            {/* Provider Position */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-blue-700 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                        Expected Provider Position
                                    </label>
                                    <span className="text-sm text-blue-600 font-medium">
                                        {clausePositions[selectedClause.clauseId]?.providerPosition ?? 5} - {getPositionLabel(clausePositions[selectedClause.clauseId]?.providerPosition ?? 5)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={clausePositions[selectedClause.clauseId]?.providerPosition ?? 5}
                                    onChange={(e) => updateClausePosition(selectedClause.clauseId, 'providerPosition', parseInt(e.target.value))}
                                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Very Flexible</span>
                                    <span>Non-Negotiable</span>
                                </div>
                            </div>

                            {/* Importance Level */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Clause Importance
                                </label>
                                <div className="flex gap-2">
                                    {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => updateClausePosition(selectedClause.clauseId, 'importance', level)}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${(clausePositions[selectedClause.clauseId]?.importance ?? 'medium') === level
                                                ? level === 'critical'
                                                    ? 'bg-red-600 text-white'
                                                    : level === 'high'
                                                        ? 'bg-amber-500 text-white'
                                                        : level === 'medium'
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-slate-500 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Gap Analysis Preview */}
                            {clausePositions[selectedClause.clauseId] && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Potential Gap:</span>
                                        <span className={`font-medium ${Math.abs((clausePositions[selectedClause.clauseId]?.customerPosition ?? 5) - (clausePositions[selectedClause.clauseId]?.providerPosition ?? 5)) >= 4
                                            ? 'text-red-600'
                                            : Math.abs((clausePositions[selectedClause.clauseId]?.customerPosition ?? 5) - (clausePositions[selectedClause.clauseId]?.providerPosition ?? 5)) >= 2
                                                ? 'text-amber-600'
                                                : 'text-green-600'
                                            }`}>
                                            {Math.abs((clausePositions[selectedClause.clauseId]?.customerPosition ?? 5) - (clausePositions[selectedClause.clauseId]?.providerPosition ?? 5))} points
                                            {Math.abs((clausePositions[selectedClause.clauseId]?.customerPosition ?? 5) - (clausePositions[selectedClause.clauseId]?.providerPosition ?? 5)) >= 4
                                                ? ' (High gap - expect negotiation)'
                                                : Math.abs((clausePositions[selectedClause.clauseId]?.customerPosition ?? 5) - (clausePositions[selectedClause.clauseId]?.providerPosition ?? 5)) >= 2
                                                    ? ' (Moderate gap)'
                                                    : ' (Aligned)'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mapping to Master Clause */}
                    {selectedClause.mapsToMasterClauseId && (
                        <div className="mt-4 p-4 bg-slate-100 rounded-lg">
                            <p className="text-sm text-slate-600">
                                Maps to standard clause template
                                {selectedClause.mappingConfidence && (
                                    <span className="ml-2 text-slate-400">
                                        ({Math.round(selectedClause.mappingConfidence * 100)}% match)
                                    </span>
                                )}
                            </p>
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
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">C</span>
                    </div>
                    <div>
                        <span className="text-white font-semibold">CLARENCE</span>
                        <span className="text-slate-400 text-sm ml-2">Contract Studio</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm">{userInfo.email}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                        <span className="text-white text-sm">
                            {userInfo.firstName?.[0]}{userInfo.lastName?.[0]}
                        </span>
                    </div>
                </div>
            </header>

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

            {/* Modals */}
            {renderEditModal()}
            {renderDeleteConfirmModal()}
            {renderClauseLibraryModal()}
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