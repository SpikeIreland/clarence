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

Click on any clause in the left panel to review its details. Use the checkboxes to verify clauses as you go.`,

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
                // TextItem has 'str' property, TextMarkedContent does not
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
            const response = await fetch(`${API_BASE}/get-uploaded-contract?contract_id=${id}`)
            if (!response.ok) throw new Error('Failed to load contract')

            const data = await response.json()
            if (data.contract) {
                setContract({
                    contractId: data.contract.contract_id,
                    companyId: data.contract.company_id,
                    uploadedByUserId: data.contract.uploaded_by_user_id,
                    linkedSessionId: data.contract.linked_session_id,
                    contractName: data.contract.contract_name,
                    description: data.contract.description,
                    fileName: data.contract.file_name,
                    fileType: data.contract.file_type,
                    fileSize: data.contract.file_size,
                    status: data.contract.status,
                    processingError: data.contract.processing_error,
                    clauseCount: data.contract.clause_count,
                    detectedStyle: data.contract.detected_style,
                    detectedJurisdiction: data.contract.detected_jurisdiction,
                    detectedContractType: data.contract.detected_contract_type,
                    parsingNotes: data.contract.parsing_notes,
                    usageCount: data.contract.usage_count || 0,
                    lastUsedAt: data.contract.last_used_at,
                    createdAt: data.contract.created_at,
                    updatedAt: data.contract.updated_at,
                    processedAt: data.contract.processed_at
                })

                // Parse detected entities from parsing_notes if available
                if (data.contract.parsing_notes) {
                    try {
                        const notes = JSON.parse(data.contract.parsing_notes)
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

                return data.contract.status
            }
        } catch (err) {
            console.error('Error loading contract:', err)
            setError('Failed to load contract')
        }
        return null
    }, [])

    const loadClauses = useCallback(async (id: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-uploaded-contract-clauses?contract_id=${id}`)
            if (!response.ok) throw new Error('Failed to load clauses')

            const data = await response.json()
            if (data.clauses && Array.isArray(data.clauses)) {
                const mappedClauses: ContractClause[] = data.clauses.map((c: any) => ({
                    clauseId: c.clause_id,
                    contractId: c.contract_id,
                    clauseNumber: c.clause_number || '',
                    clauseName: c.clause_name,
                    category: c.category || 'Other',
                    content: c.content,
                    originalText: c.original_text,
                    parentClauseId: c.parent_clause_id,
                    clauseLevel: c.clause_level || 1,
                    displayOrder: c.display_order || 0,
                    aiSuggestedName: c.ai_suggested_name,
                    aiSuggestedCategory: c.ai_suggested_category,
                    aiConfidence: c.ai_confidence,
                    aiSuggestion: c.ai_suggestion,
                    mapsToMasterClauseId: c.maps_to_master_clause_id,
                    mappingConfidence: c.mapping_confidence,
                    verified: c.verified || false,
                    verifiedByUserId: c.verified_by_user_id,
                    verifiedAt: c.verified_at,
                    status: c.status || 'pending',
                    rejectionReason: c.rejection_reason,
                    committedAt: c.committed_at,
                    committedPositionId: c.committed_position_id,
                    createdAt: c.created_at,
                    updatedAt: c.updated_at
                }))

                setClauses(mappedClauses)
                buildCategoryGroups(mappedClauses)

                // Auto-select first clause
                if (mappedClauses.length > 0 && !selectedClause) {
                    setSelectedClause(mappedClauses[0])
                }
            }
        } catch (err) {
            console.error('Error loading clauses:', err)
        }
    }, [selectedClause])

    // Build category groups for nested navigation
    const buildCategoryGroups = (clauseList: ContractClause[]) => {
        const groups: { [key: string]: ContractClause[] } = {}

        // Group clauses by category
        clauseList.forEach(clause => {
            const cat = clause.category || 'Other'
            if (!groups[cat]) {
                groups[cat] = []
            }
            groups[cat].push(clause)
        })

        // Sort clauses within each group by display order
        Object.keys(groups).forEach(cat => {
            groups[cat].sort((a, b) => a.displayOrder - b.displayOrder)
        })

        // Convert to array with expansion state
        const categoryList: CategoryGroup[] = CLAUSE_CATEGORIES
            .filter(cat => groups[cat] && groups[cat].length > 0)
            .map(cat => ({
                category: cat,
                clauses: groups[cat],
                isExpanded: true // Start expanded
            }))

        // Add any categories not in our predefined list
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

    // ========================================================================
    // SECTION 5D: POLLING FOR PROCESSING STATUS
    // ========================================================================

    useEffect(() => {
        if (!contractId) {
            setIsLoading(false)
            addChatMessage('clarence', CLARENCE_MESSAGES.welcome_new)
            return
        }

        // If we have a contract_id, we're either loading or processing
        // Clear isUploading since the upload phase is complete
        setIsUploading(false)
        setUploadProgress(null)
        setIsLoading(true)

        let pollCount = 0
        let pollInterval: NodeJS.Timeout | null = null

        const poll = async () => {
            const status = await loadContract(contractId)

            if (status === 'ready') {
                if (pollInterval) clearInterval(pollInterval)
                await loadClauses(contractId)
                setIsLoading(false)
            } else if (status === 'failed') {
                if (pollInterval) clearInterval(pollInterval)
                setIsLoading(false)
                setError('Contract processing failed')
            } else if (status === 'processing') {
                // Contract is processing - keep polling
                // isLoading will be set to false once we have the contract object
                // but the processing overlay will show based on contract.status
                setIsLoading(false) // Allow the processing overlay to show
                pollCount++
                if (pollCount >= MAX_POLLING_ATTEMPTS) {
                    if (pollInterval) clearInterval(pollInterval)
                    setError('Processing timeout - please try again')
                }
            } else if (status === null) {
                // Error loading contract
                setIsLoading(false)
            } else {
                setIsLoading(false)
            }
        }

        poll()
        pollInterval = setInterval(poll, POLLING_INTERVAL)

        return () => {
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [contractId, loadContract, loadClauses])

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

    // Update chat when contract loads
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

        // Validate file
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

            // Debug: Log what we're sending
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

            if (result.contractId) {
                // Update progress to show we're transitioning
                setUploadProgress('Contract uploaded! Starting analysis...')

                // Update URL with contract_id - DON'T reset isUploading here
                // The page will reload and pick up the processing state
                const newUrl = sessionId
                    ? `/auth/contract-prep?contract_id=${result.contractId}&session_id=${sessionId}`
                    : `/auth/contract-prep?contract_id=${result.contractId}`
                router.push(newUrl)

                // Keep the overlay showing - the new page load will handle the transition
                // Don't call setIsUploading(false) on success
                return
            } else {
                throw new Error('No contract ID returned from upload')
            }

        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Upload failed')
            // Only reset on error
            setIsUploading(false)
            setUploadProgress(null)
        }
        // Removed the finally block - we handle cleanup explicitly above
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

            // Update local state
            setClauses(prev => prev.map(c =>
                c.clauseId === clause.clauseId
                    ? { ...c, status: 'verified', verified: true }
                    : c
            ))

            // Rebuild category groups
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

            // Update selected clause if it was the one being edited
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
                    clause_ids: verifiedClauses.map(c => c.clauseId)
                })
            })

            if (!response.ok) throw new Error('Failed to commit clauses')

            const result = await response.json()

            addChatMessage('clarence', CLARENCE_MESSAGES.committed(verifiedClauses.length))

            // Navigate to appropriate next step
            if (result.sessionId || sessionId) {
                setTimeout(() => {
                    router.push(`/auth/contract-studio?session_id=${result.sessionId || sessionId}`)
                }, 2000)
            }

        } catch (err) {
            console.error('Error committing clauses:', err)
            setError('Failed to commit clauses')
        } finally {
            setIsCommitting(false)
        }
    }

    // ========================================================================
    // SECTION 5H: ENTITY HANDLERS
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

        // Apply redactions to all clause content
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
    // SECTION 5I: TOGGLE CATEGORY EXPANSION
    // ========================================================================

    const toggleCategoryExpansion = (category: string) => {
        setCategoryGroups(prev => prev.map(g =>
            g.category === category
                ? { ...g, isExpanded: !g.isExpanded }
                : g
        ))
    }

    // ========================================================================
    // SECTION 5J: FILTERED CLAUSES
    // ========================================================================

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

    // ========================================================================
    // SECTION 5K: STATS
    // ========================================================================

    const stats = {
        total: clauses.length,
        pending: clauses.filter(c => c.status === 'pending').length,
        verified: clauses.filter(c => c.status === 'verified').length,
        rejected: clauses.filter(c => c.status === 'rejected').length
    }

    // ========================================================================
    // SECTION 6: RENDER - LEFT PANEL (Clause Navigation)
    // ========================================================================

    const renderLeftPanel = () => {
        const filteredClauses = getFilteredClauses()
        const filteredCategories = categoryGroups.filter(g =>
            g.clauses.some(c => filteredClauses.find(fc => fc.clauseId === c.clauseId))
        )

        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href="/auth/dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
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

                {/* Stats Bar */}
                {clauses.length > 0 && (
                    <div className="px-4 py-2 border-b border-slate-200 bg-slate-100 flex items-center gap-3 text-xs">
                        <span className="text-slate-600">{stats.total} clauses</span>
                        <span className="text-amber-600">⏳ {stats.pending}</span>
                        <span className="text-green-600">✓ {stats.verified}</span>
                        <span className="text-red-600">✕ {stats.rejected}</span>
                    </div>
                )}

                {/* Category Navigation */}
                <div className="flex-1 overflow-auto">
                    {filteredCategories.length === 0 ? (
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
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {groupFilteredClauses.length}
                                        </span>
                                    </button>

                                    {/* Clauses in Category */}
                                    {group.isExpanded && (
                                        <div className="bg-white">
                                            {groupFilteredClauses.map(clause => (
                                                <button
                                                    key={clause.clauseId}
                                                    onClick={() => setSelectedClause(clause)}
                                                    className={`w-full px-4 py-2 pl-8 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${selectedClause?.clauseId === clause.clauseId
                                                        ? 'bg-blue-100 border-l-2 border-blue-500'
                                                        : ''
                                                        }`}
                                                >
                                                    {/* Status Indicator */}
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${clause.status === 'verified'
                                                        ? 'bg-green-500'
                                                        : clause.status === 'rejected'
                                                            ? 'bg-red-500'
                                                            : 'bg-amber-400'
                                                        }`} />

                                                    {/* Clause Info */}
                                                    <div className="flex-1 min-w-0">
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
                                                    </div>

                                                    {/* Confidence indicator */}
                                                    {clause.aiConfidence && clause.aiConfidence < 0.8 && (
                                                        <span className="text-amber-500 text-xs" title="Low AI confidence">
                                                            ⚠
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-200 bg-white space-y-2">
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
    // SECTION 7: RENDER - CENTER PANEL (Clause Details)
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
                        {selectedClause.status === 'pending' && (
                            <div className="flex items-center gap-2">
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
                                    className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                                >
                                    ✕ Reject
                                </button>
                            </div>
                        )}
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
    // SECTION 8: RENDER - RIGHT PANEL (Chat + Entities)
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
                    // Entities Panel
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
                    // Chat Panel
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
    // SECTION 9: RENDER - EDIT MODAL
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

    // ========================================================================
    // SECTION 10: MAIN RENDER
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

            {/* Initial Loading Overlay (when page loads with contract_id) */}
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

            {/* Contract Processing Overlay (when polling) */}
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
                {/* Left Panel - Clause Navigation */}
                <div className="w-72 flex-shrink-0">
                    {renderLeftPanel()}
                </div>

                {/* Center Panel - Clause Details */}
                <div className="flex-1 min-w-0">
                    {renderCenterPanel()}
                </div>

                {/* Right Panel - Chat + Entities */}
                <div className="w-80 flex-shrink-0">
                    {renderRightPanel()}
                </div>
            </div>

            {/* Edit Modal */}
            {renderEditModal()}
        </div>
    )
}

// ============================================================================
// SECTION 11: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function ContractPrepPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ContractPrepContent />
        </Suspense>
    )
}