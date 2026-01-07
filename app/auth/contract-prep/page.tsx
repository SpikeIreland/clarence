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

interface ChatMessage {
    id: string
    role: 'clarence' | 'user' | 'system'
    content: string
    timestamp: Date
}

type ViewMode = 'list' | 'detail'

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
    welcome_new: `Welcome to Contract Prep! This is your workspace for preparing and reviewing contracts.

You can **upload a contract** to have CLARENCE parse it into individual clauses, or browse your existing templates.`,

    welcome_loading: `Loading your contract... Just a moment while I fetch the details.`,

    contract_loaded: (name: string, clauseCount: number) =>
        `I've loaded **${name}** with **${clauseCount} clauses** identified.

Review each clause to verify it's been correctly categorized. You can:
• ✓ **Verify** - Confirm the clause is correct
• ✏️ **Edit** - Change the name or category
• ✕ **Reject** - Mark for removal

Once you've reviewed the clauses, you can commit them to use in negotiations.`,

    processing: `Your contract is still being processed. I'm analyzing the document structure and identifying clauses.

This typically takes 1-2 minutes for larger documents.`,

    upload_started: `I'm extracting text from your document and sending it for analysis...`,

    upload_complete: `Your contract has been uploaded and is now being processed. I'll update you when it's ready.`,

    clause_verified: (name: string) => `✓ Verified: **${name}**`,

    clause_rejected: (name: string) => `✕ Rejected: **${name}**`,

    all_verified: `All clauses have been verified! You can now commit them to use in negotiations.`,

    committed: (count: number) => `Successfully committed **${count} clauses**. These are now ready for use in your contract negotiations.`
}

// ============================================================================
// SECTION 3: TEXT EXTRACTION UTILITIES
// ============================================================================

const loadPdfJs = async () => {
    const pdfjsLib = await import('pdfjs-dist')
    // Use local worker file for better performance with large PDFs
    // Worker file must be copied to public folder:
    // cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
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
            .map((item: any) => item.str)
            .join(' ')
        fullText += pageText + '\n\n'
    }

    return fullText.trim()
}

const extractTextFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
}

const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return extractTextFromPdf(file)
    } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
    ) {
        return extractTextFromDocx(file)
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return file.text()
    } else {
        throw new Error(`Unsupported file type: ${fileType}`)
    }
}

// ============================================================================
// SECTION 4: LOADING FALLBACK
// ============================================================================

function LoadingFallback() {
    return (
        <div className="h-screen flex items-center justify-center bg-slate-100">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600">Loading Contract Prep...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: MAIN CONTENT COMPONENT (uses useSearchParams)
// ============================================================================

function ContractPrepContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const pollingCountRef = useRef<number>(0)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // URL Parameters
    const contractIdParam = searchParams.get('contract_id')
    const sessionIdParam = searchParams.get('session_id')

    // ========================================================================
    // SECTION 5A: STATE
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<UploadedContract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('list')
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [editingClause, setEditingClause] = useState<ContractClause | null>(null)
    const [isCommitting, setIsCommitting] = useState(false)
    const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // ========================================================================
    // SECTION 5B: HELPER FUNCTIONS
    // ========================================================================

    const addClarenceMessage = (content: string) => {
        setChatMessages(prev => [...prev, {
            id: `clarence-${Date.now()}`,
            role: 'clarence',
            content,
            timestamp: new Date()
        }])
    }

    const addSystemMessage = (content: string) => {
        setChatMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            role: 'system',
            content,
            timestamp: new Date()
        }])
    }

    const loadUserInfo = useCallback(() => {
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
                companyId: parsed.userInfo?.companyId || null
            } as UserInfo
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    // ========================================================================
    // SECTION 5C: DATA FETCHING
    // ========================================================================

    const fetchContract = async (contractId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-uploaded-contract?contract_id=${contractId}`)
            if (response.ok) {
                const data = await response.json()
                return data as UploadedContract
            }
            return null
        } catch (err) {
            console.error('Failed to fetch contract:', err)
            return null
        }
    }

    const fetchClauses = async (contractId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-uploaded-contract-clauses?contract_id=${contractId}`)
            if (response.ok) {
                const data = await response.json()
                return data as ContractClause[]
            }
            return []
        } catch (err) {
            console.error('Failed to fetch clauses:', err)
            return []
        }
    }

    const loadContractData = useCallback(async (contractId: string) => {
        setIsLoading(true)
        addClarenceMessage(CLARENCE_MESSAGES.welcome_loading)

        const contractData = await fetchContract(contractId)

        if (!contractData) {
            setError('Contract not found')
            setIsLoading(false)
            return
        }

        setContract(contractData)

        if (contractData.status === 'ready') {
            const clauseData = await fetchClauses(contractId)
            setClauses(clauseData)
            addClarenceMessage(CLARENCE_MESSAGES.contract_loaded(
                contractData.contractName,
                clauseData.length
            ))
        } else if (contractData.status === 'processing') {
            addClarenceMessage(CLARENCE_MESSAGES.processing)
            startPolling(contractId)
        } else if (contractData.status === 'failed') {
            setError(contractData.processingError || 'Contract processing failed')
        }

        setIsLoading(false)
    }, [])

    const startPolling = (contractId: string) => {
        pollingCountRef.current = 0

        if (pollingRef.current) {
            clearInterval(pollingRef.current)
        }

        pollingRef.current = setInterval(async () => {
            pollingCountRef.current += 1

            if (pollingCountRef.current >= MAX_POLLING_ATTEMPTS) {
                clearInterval(pollingRef.current!)
                pollingRef.current = null
                setError('Processing is taking longer than expected. Please refresh the page.')
                return
            }

            const contractData = await fetchContract(contractId)

            if (contractData?.status === 'ready') {
                clearInterval(pollingRef.current!)
                pollingRef.current = null

                setContract(contractData)
                const clauseData = await fetchClauses(contractId)
                setClauses(clauseData)
                addClarenceMessage(CLARENCE_MESSAGES.contract_loaded(
                    contractData.contractName,
                    clauseData.length
                ))
            } else if (contractData?.status === 'failed') {
                clearInterval(pollingRef.current!)
                pollingRef.current = null

                setContract(contractData)
                setError(contractData.processingError || 'Contract processing failed')
            }
        }, POLLING_INTERVAL)
    }

    // ========================================================================
    // SECTION 5D: EFFECTS
    // ========================================================================

    useEffect(() => {
        const user = loadUserInfo()
        if (user) {
            setUserInfo(user)
        }
    }, [loadUserInfo])

    useEffect(() => {
        if (contractIdParam) {
            loadContractData(contractIdParam)
        } else {
            setIsLoading(false)
            addClarenceMessage(CLARENCE_MESSAGES.welcome_new)
        }
    }, [contractIdParam, loadContractData])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
            }
        }
    }, [])

    // ========================================================================
    // SECTION 5E: UPLOAD HANDLERS
    // ========================================================================

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ]
        const validExtensions = ['.pdf', '.docx', '.txt']
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            setError('Please upload a PDF, DOCX, or TXT file')
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB')
            return
        }

        await processUpload(file)
    }

    const processUpload = async (file: File) => {
        if (!userInfo) {
            setError('User not authenticated')
            return
        }

        setIsUploading(true)
        setError(null)
        setUploadProgress('Extracting text from document...')
        addClarenceMessage(CLARENCE_MESSAGES.upload_started)

        try {
            const documentText = await extractTextFromFile(file)

            if (documentText.length < 100) {
                throw new Error('Document appears to be empty or too short')
            }

            setUploadProgress('Sending to CLARENCE for analysis...')

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo.userId,
                    company_id: userInfo.companyId,
                    session_id: sessionIdParam || null,
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    document_text: documentText,
                    template_name: file.name.replace(/\.[^/.]+$/, '')
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to upload contract')
            }

            const result = await response.json()

            if (result.success && result.contractId) {
                addClarenceMessage(CLARENCE_MESSAGES.upload_complete)

                // Update URL with new contract_id
                const newUrl = sessionIdParam
                    ? `/auth/contract-prep?session_id=${sessionIdParam}&contract_id=${result.contractId}`
                    : `/auth/contract-prep?contract_id=${result.contractId}`
                router.replace(newUrl)

                // Set contract and start polling
                setContract({
                    contractId: result.contractId,
                    contractName: result.templateName || file.name,
                    fileName: file.name,
                    status: 'processing'
                } as UploadedContract)

                startPolling(result.contractId)
            } else {
                throw new Error(result.error || 'No contract ID returned')
            }

        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Failed to upload contract')
        } finally {
            setIsUploading(false)
            setUploadProgress('')
        }
    }

    // ========================================================================
    // SECTION 5F: CLAUSE HANDLERS
    // ========================================================================

    const handleVerifyClause = async (clause: ContractClause) => {
        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: clause.contractId,
                    clause_id: clause.clauseId,
                    status: 'verified',
                    verified_name: clause.clauseName,
                    verified_category: clause.category
                })
            })

            if (response.ok) {
                setClauses(prev => prev.map(c =>
                    c.clauseId === clause.clauseId
                        ? { ...c, status: 'verified', verified: true, verifiedAt: new Date().toISOString() }
                        : c
                ))
                addSystemMessage(CLARENCE_MESSAGES.clause_verified(clause.clauseName))

                // Check if all verified
                const remaining = clauses.filter(c => c.clauseId !== clause.clauseId && c.status === 'pending')
                if (remaining.length === 0) {
                    addClarenceMessage(CLARENCE_MESSAGES.all_verified)
                }
            }
        } catch (err) {
            console.error('Failed to verify clause:', err)
            setError('Failed to verify clause')
        }
    }

    const handleRejectClause = async (clause: ContractClause, reason: string) => {
        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: clause.contractId,
                    clause_id: clause.clauseId,
                    status: 'rejected',
                    rejection_reason: reason
                })
            })

            if (response.ok) {
                setClauses(prev => prev.map(c =>
                    c.clauseId === clause.clauseId
                        ? { ...c, status: 'rejected', rejectionReason: reason }
                        : c
                ))
                addSystemMessage(CLARENCE_MESSAGES.clause_rejected(clause.clauseName))
            }
        } catch (err) {
            console.error('Failed to reject clause:', err)
            setError('Failed to reject clause')
        }
    }

    const handleUpdateClause = async (clause: ContractClause, updates: Partial<ContractClause>) => {
        try {
            const response = await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: clause.contractId,
                    clause_id: clause.clauseId,
                    status: 'verified',
                    verified_name: updates.clauseName || clause.clauseName,
                    verified_category: updates.category || clause.category
                })
            })

            if (response.ok) {
                setClauses(prev => prev.map(c =>
                    c.clauseId === clause.clauseId
                        ? {
                            ...c,
                            ...updates,
                            status: 'verified',
                            verified: true,
                            verifiedAt: new Date().toISOString()
                        }
                        : c
                ))
                setEditingClause(null)
                addSystemMessage(`✓ Updated and verified: **${updates.clauseName || clause.clauseName}**`)
            }
        } catch (err) {
            console.error('Failed to update clause:', err)
            setError('Failed to update clause')
        }
    }

    const handleCommitClauses = async () => {
        const verifiedClauses = clauses.filter(c => c.status === 'verified')

        if (verifiedClauses.length === 0) {
            setError('No verified clauses to commit')
            return
        }

        setIsCommitting(true)

        try {
            const response = await fetch(`${API_BASE}/commit-parsed-clauses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract?.contractId,
                    session_id: sessionIdParam,
                    clause_ids: verifiedClauses.map(c => c.clauseId)
                })
            })

            if (response.ok) {
                setClauses(prev => prev.map(c =>
                    c.status === 'verified'
                        ? { ...c, status: 'committed', committedAt: new Date().toISOString() }
                        : c
                ))
                addClarenceMessage(CLARENCE_MESSAGES.committed(verifiedClauses.length))

                // If there's a session, navigate back
                if (sessionIdParam) {
                    setTimeout(() => {
                        router.push(`/auth/contract-studio?session_id=${sessionIdParam}`)
                    }, 2000)
                }
            }
        } catch (err) {
            console.error('Failed to commit clauses:', err)
            setError('Failed to commit clauses')
        } finally {
            setIsCommitting(false)
        }
    }

    // ========================================================================
    // SECTION 5G: FILTER & SEARCH
    // ========================================================================

    const filteredClauses = clauses.filter(clause => {
        if (filter !== 'all' && clause.status !== filter) {
            return false
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
                clause.clauseName.toLowerCase().includes(query) ||
                clause.category.toLowerCase().includes(query) ||
                clause.content.toLowerCase().includes(query)
            )
        }

        return true
    })

    const stats = {
        total: clauses.length,
        pending: clauses.filter(c => c.status === 'pending').length,
        verified: clauses.filter(c => c.status === 'verified').length,
        rejected: clauses.filter(c => c.status === 'rejected').length,
        committed: clauses.filter(c => c.status === 'committed').length
    }

    // ========================================================================
    // SECTION 6: RENDER - LEFT PANEL (Contract Info)
    // ========================================================================

    const renderLeftPanel = () => {
        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href="/auth/dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
                        ← Back to Dashboard
                    </Link>
                    <h2 className="text-lg font-semibold text-slate-800">Contract Prep</h2>
                    <p className="text-sm text-slate-500">
                        {contract ? contract.contractName : 'Upload or select a contract'}
                    </p>
                </div>

                {/* Contract Status */}
                {contract && (
                    <div className="p-4 border-b border-slate-200">
                        <div className={`p-3 rounded-lg ${contract.status === 'ready'
                            ? 'bg-green-50 border border-green-200'
                            : contract.status === 'processing'
                                ? 'bg-blue-50 border border-blue-200'
                                : 'bg-red-50 border border-red-200'
                            }`}>
                            <div className="flex items-center gap-2 mb-1">
                                {contract.status === 'ready' && <span className="text-green-600">✓</span>}
                                {contract.status === 'processing' && (
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                )}
                                {contract.status === 'failed' && <span className="text-red-600">✕</span>}
                                <span className={`font-medium text-sm ${contract.status === 'ready'
                                    ? 'text-green-800'
                                    : contract.status === 'processing'
                                        ? 'text-blue-800'
                                        : 'text-red-800'
                                    }`}>
                                    {contract.status === 'ready' ? 'Ready' : contract.status === 'processing' ? 'Processing...' : 'Failed'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600">{contract.fileName}</p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {clauses.length > 0 && (
                    <div className="p-4 border-b border-slate-200">
                        <h3 className="text-sm font-medium text-slate-700 mb-3">Clause Status</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`p-2 rounded-lg text-left transition-colors ${filter === 'all' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                            >
                                <div className="text-lg font-bold text-slate-800">{stats.total}</div>
                                <div className="text-xs text-slate-500">Total</div>
                            </button>
                            <button
                                onClick={() => setFilter('pending')}
                                className={`p-2 rounded-lg text-left transition-colors ${filter === 'pending' ? 'bg-amber-100' : 'hover:bg-slate-100'}`}
                            >
                                <div className="text-lg font-bold text-amber-600">{stats.pending}</div>
                                <div className="text-xs text-slate-500">Pending</div>
                            </button>
                            <button
                                onClick={() => setFilter('verified')}
                                className={`p-2 rounded-lg text-left transition-colors ${filter === 'verified' ? 'bg-green-100' : 'hover:bg-slate-100'}`}
                            >
                                <div className="text-lg font-bold text-green-600">{stats.verified}</div>
                                <div className="text-xs text-slate-500">Verified</div>
                            </button>
                            <button
                                onClick={() => setFilter('rejected')}
                                className={`p-2 rounded-lg text-left transition-colors ${filter === 'rejected' ? 'bg-red-100' : 'hover:bg-slate-100'}`}
                            >
                                <div className="text-lg font-bold text-red-600">{stats.rejected}</div>
                                <div className="text-xs text-slate-500">Rejected</div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="p-4 mt-auto border-t border-slate-200 bg-white">
                    {clauses.length > 0 && stats.verified > 0 && (
                        <button
                            onClick={handleCommitClauses}
                            disabled={isCommitting || stats.verified === 0}
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
    // SECTION 7: RENDER - MAIN PANEL (Clauses)
    // ========================================================================

    const renderMainPanel = () => {
        const fileInput = (
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileSelect}
                className="hidden"
            />
        )

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

        if (!contract) {
            return (
                <div className="h-full flex flex-col bg-white">
                    {fileInput}
                    <div className="p-4 border-b border-slate-200">
                        <h1 className="text-xl font-semibold text-slate-800">Contract Prep</h1>
                        <p className="text-sm text-slate-500">Upload a contract to get started</p>
                    </div>

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
                                        Please wait while we process your document
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

                    {error && (
                        <div className="p-4 m-6 rounded-lg bg-red-50 border border-red-200 text-red-700">
                            {error}
                        </div>
                    )}
                </div>
            )
        }

        if (contract.status === 'processing') {
            return (
                <div className="h-full flex items-center justify-center bg-white">
                    {fileInput}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">
                            Processing Your Contract
                        </h3>
                        <p className="text-sm text-slate-500 mb-2">
                            Analyzing document structure and identifying clauses...
                        </p>
                        <p className="text-xs text-slate-400">
                            This typically takes 1-2 minutes
                        </p>
                    </div>
                </div>
            )
        }

        return (
            <div className="h-full flex flex-col bg-white">
                {fileInput}

                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-xl font-semibold text-slate-800">{contract.contractName}</h1>
                            <p className="text-sm text-slate-500">
                                {clauses.length} clauses identified • {contract.detectedContractType || 'Contract'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('detail')}
                                className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'detail' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Detail
                            </button>
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Search clauses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {filteredClauses.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-500">No clauses match your filter</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredClauses.map((clause) => (
                                <div
                                    key={clause.clauseId}
                                    className={`p-4 rounded-lg border-2 transition-all ${clause.status === 'verified'
                                        ? 'border-green-200 bg-green-50'
                                        : clause.status === 'rejected'
                                            ? 'border-red-200 bg-red-50'
                                            : clause.status === 'committed'
                                                ? 'border-blue-200 bg-blue-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        } ${selectedClause?.clauseId === clause.clauseId ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-slate-400">
                                                    {clause.clauseNumber}
                                                </span>
                                                <h4 className="font-medium text-slate-800 truncate">
                                                    {clause.clauseName}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clause.status === 'verified'
                                                    ? 'bg-green-100 text-green-700'
                                                    : clause.status === 'rejected'
                                                        ? 'bg-red-100 text-red-700'
                                                        : clause.status === 'committed'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {clause.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 mb-2">
                                                {clause.category}
                                            </p>
                                            <p className="text-sm text-slate-600 line-clamp-2">
                                                {clause.content}
                                            </p>
                                            {clause.aiConfidence && (
                                                <div className="mt-2 text-xs text-slate-400">
                                                    AI Confidence: {Math.round(clause.aiConfidence * 100)}%
                                                </div>
                                            )}
                                        </div>

                                        {clause.status === 'pending' && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => handleVerifyClause(clause)}
                                                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                                    title="Verify"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => setEditingClause(clause)}
                                                    className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleRejectClause(clause, 'User rejected')}
                                                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                                    title="Reject"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-4 m-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="ml-2 text-red-500 hover:text-red-700"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: RENDER - RIGHT PANEL (Clarence Chat)
    // ========================================================================

    const renderChatPanel = () => {
        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white border-l border-slate-200">
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
                                <div className={`text-xs mt-2 ${message.role === 'user'
                                    ? 'text-blue-200'
                                    : 'text-slate-400'
                                    }`}>
                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="text-xs text-slate-500 text-center">
                        Clarence is helping you prepare your contract
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 9: RENDER - EDIT MODAL
    // ========================================================================

    const renderEditModal = () => {
        if (!editingClause) return null

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
                    <div className="p-6 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">Edit Clause</h3>
                        <p className="text-sm text-slate-500">Modify the clause details below</p>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Clause Name
                            </label>
                            <input
                                type="text"
                                value={editingClause.clauseName}
                                onChange={(e) => setEditingClause({ ...editingClause, clauseName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Category
                            </label>
                            <select
                                value={editingClause.category}
                                onChange={(e) => setEditingClause({ ...editingClause, category: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                                value={editingClause.content}
                                onChange={(e) => setEditingClause({ ...editingClause, content: e.target.value })}
                                rows={6}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        {editingClause.aiSuggestedName && editingClause.aiSuggestedName !== editingClause.clauseName && (
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                                <p className="text-sm text-amber-800">
                                    <strong>AI Suggestion:</strong> {editingClause.aiSuggestedName}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                        <button
                            onClick={() => setEditingClause(null)}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleUpdateClause(editingClause, {
                                clauseName: editingClause.clauseName,
                                category: editingClause.category,
                                content: editingClause.content
                            })}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
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

    return (
        <div className="h-screen flex bg-slate-100">
            <div className="w-64 flex-shrink-0">
                {renderLeftPanel()}
            </div>

            <div className="flex-1 min-w-0">
                {renderMainPanel()}
            </div>

            <div className="w-96 flex-shrink-0">
                {renderChatPanel()}
            </div>

            {renderEditModal()}
        </div>
    )
}

// ============================================================================
// SECTION 11: PAGE COMPONENT WITH SUSPENSE BOUNDARY
// ============================================================================

export default function ContractPrepPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ContractPrepContent />
        </Suspense>
    )
}