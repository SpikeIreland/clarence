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
}

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    status: string
    mediationType: 'straight_to_contract' | 'partial_mediation' | 'full_mediation'
    contractType: string
    templateSource: 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch'
    sourceTemplateId: string | null
    templateAccepted: boolean
    assessmentCompleted: boolean
}

interface TemplateClause {
    clauseId: string
    clauseName: string
    clauseNumber: string
    category: string
    description: string
    clauseLevel: number
    displayOrder: number
    parentClauseId: string | null
    isRequired: boolean
    isLocked: boolean
    defaultCustomerPosition: number
    defaultProviderPosition: number
    defaultWeight: number
    positionOptions: PositionOption[] | null
}

interface PositionOption {
    value: number
    label: string
    description: string
}

interface ChatMessage {
    id: string
    role: 'clarence' | 'user' | 'system'
    content: string
    timestamp: Date
}

interface CategoryGroup {
    category: string
    clauses: TemplateClause[]
    isExpanded: boolean
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const MEDIATION_TYPE_LABELS: Record<string, string> = {
    'straight_to_contract': 'Straight to Contract',
    'partial_mediation': 'Partial Mediation',
    'full_mediation': 'Full Mediation'
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    'nda': 'Non-Disclosure Agreement',
    'saas': 'SaaS Agreement',
    'bpo': 'BPO / Outsourcing Agreement',
    'msa': 'Master Services Agreement',
    'employment': 'Employment Contract',
    'custom': 'Custom Contract'
}

const TEMPLATE_SOURCE_LABELS: Record<string, string> = {
    'existing_template': 'Using Template',
    'modified_template': 'Customizing Template',
    'uploaded': 'From Uploaded Document',
    'from_scratch': 'Building from Scratch'
}

// ============================================================================
// SECTION 3: CLARENCE MESSAGES
// ============================================================================

const CLARENCE_MESSAGES = {
    welcome_template: (templateName: string, clauseCount: number) =>
        `Welcome to Contract Prep! I've loaded the **${templateName}** template with **${clauseCount} clauses** for you.\n\nYou can review each clause, adjust positions if needed, and lock clauses you don't want to negotiate.`,

    welcome_modify: (templateName: string) =>
        `I've loaded the **${templateName}** template as your starting point.\n\nFeel free to add, remove, or modify any clauses. This is your customized version.`,

    welcome_upload:
        `Ready to process your uploaded contract!\n\nUpload a PDF or DOCX file and I'll extract the clauses for you to review and configure.`,

    welcome_scratch:
        `Let's build your contract from scratch!\n\nYou can add clauses from the library or create custom ones. I'll help you structure everything properly.`,

    welcome_generic:
        `Welcome to Contract Prep! Let's get your contract configured and ready for negotiation.`,

    accept_ready:
        `Your contract is ready! Click **Accept Contract** when you're satisfied with the configuration. You'll then be able to invite providers.`,

    straight_to_contract:
        `Since you've chosen **Straight to Contract**, all clauses will be locked at their default positions. The contract will be generated automatically once a provider submits their details.`,

    partial_mediation:
        `With **Partial Mediation**, most clauses are locked but you can mark specific ones as negotiable. Look for the lock icons to toggle negotiability.`,

    full_mediation:
        `**Full Mediation** means all clauses are open for negotiation. Both parties will work through each one together.`
}

// ============================================================================
// SECTION 4: MAIN COMPONENT WRAPPER (for Suspense)
// ============================================================================

export default function ContractPrepPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <ContractPrepContent />
        </Suspense>
    )
}

function LoadingScreen() {
    return (
        <div className="h-screen flex items-center justify-center bg-slate-100">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Contract Prep...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: MAIN CONTENT COMPONENT
// ============================================================================

function ContractPrepContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chatEndRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 5A: STATE
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [session, setSession] = useState<SessionData | null>(null)
    const [clauses, setClauses] = useState<TemplateClause[]>([])
    const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
    const [selectedClause, setSelectedClause] = useState<TemplateClause | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingClauses, setIsLoadingClauses] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isAccepting, setIsAccepting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Upload state
    const [uploadedFile, setUploadedFile] = useState<File | null>(null)
    const [isProcessingUpload, setIsProcessingUpload] = useState(false)

    // ========================================================================
    // SECTION 5B: LOAD USER INFO
    // ========================================================================

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
                userId: parsed.userInfo?.userId || ''
            } as UserInfo
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    // ========================================================================
    // SECTION 5C: LOAD SESSION DATA
    // ========================================================================

    const loadSession = useCallback(async (sessionId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-session?session_id=${sessionId}`)
            if (!response.ok) {
                throw new Error('Failed to load session')
            }

            const data = await response.json()

            const sessionData: SessionData = {
                sessionId: data.session_id || data.sessionId,
                sessionNumber: data.session_number || data.sessionNumber,
                customerCompany: data.customer_company || data.customerCompany,
                status: data.status,
                mediationType: data.mediation_type || data.mediationType || 'full_mediation',
                contractType: data.contract_type || data.contractType,
                templateSource: data.template_source || data.templateSource || 'from_scratch',
                sourceTemplateId: data.source_template_id || data.sourceTemplateId,
                templateAccepted: data.template_accepted || data.templateAccepted || false,
                assessmentCompleted: data.assessment_completed || data.assessmentCompleted || false
            }

            setSession(sessionData)
            return sessionData
        } catch (err) {
            console.error('Error loading session:', err)
            setError('Failed to load session data')
            return null
        }
    }, [])

    // ========================================================================
    // SECTION 5D: LOAD TEMPLATE CLAUSES
    // ========================================================================

    const loadTemplateClauses = useCallback(async (templateId: string) => {
        setIsLoadingClauses(true)
        try {
            const response = await fetch(`${API_BASE}/get-template-clauses?template_id=${templateId}`)
            if (!response.ok) {
                throw new Error('Failed to load template clauses')
            }

            const data = await response.json()
            const clauseList: TemplateClause[] = data.clauses || []

            setClauses(clauseList)

            // Group by category
            const groups = groupClausesByCategory(clauseList)
            setCategoryGroups(groups)

            return clauseList
        } catch (err) {
            console.error('Error loading template clauses:', err)
            setError('Failed to load template clauses')
            return []
        } finally {
            setIsLoadingClauses(false)
        }
    }, [])

    // ========================================================================
    // SECTION 5E: HELPER FUNCTIONS
    // ========================================================================

    const groupClausesByCategory = (clauseList: TemplateClause[]): CategoryGroup[] => {
        const categoryMap = new Map<string, TemplateClause[]>()

        clauseList.forEach(clause => {
            const category = clause.category || 'General'
            if (!categoryMap.has(category)) {
                categoryMap.set(category, [])
            }
            categoryMap.get(category)!.push(clause)
        })

        return Array.from(categoryMap.entries()).map(([category, clauses]) => ({
            category,
            clauses: clauses.sort((a, b) => a.displayOrder - b.displayOrder),
            isExpanded: true
        }))
    }

    const addClarenceMessage = (content: string) => {
        setChatMessages(prev => [...prev, {
            id: `clarence-${Date.now()}`,
            role: 'clarence',
            content,
            timestamp: new Date()
        }])
    }

    const toggleCategory = (category: string) => {
        setCategoryGroups(prev => prev.map(group =>
            group.category === category
                ? { ...group, isExpanded: !group.isExpanded }
                : group
        ))
    }

    // ========================================================================
    // SECTION 5F: EFFECTS
    // ========================================================================

    // Load user and session on mount
    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (!user) return
            setUserInfo(user)

            const sessionId = searchParams.get('session_id')
            if (!sessionId) {
                setError('No session ID provided')
                setIsLoading(false)
                return
            }

            const sessionData = await loadSession(sessionId)
            if (!sessionData) {
                setIsLoading(false)
                return
            }

            // Load clauses based on template source
            if (sessionData.sourceTemplateId &&
                (sessionData.templateSource === 'existing_template' ||
                    sessionData.templateSource === 'modified_template')) {
                const loadedClauses = await loadTemplateClauses(sessionData.sourceTemplateId)

                // Add welcome message based on template source
                if (loadedClauses.length > 0) {
                    if (sessionData.templateSource === 'existing_template') {
                        addClarenceMessage(CLARENCE_MESSAGES.welcome_template('Template', loadedClauses.length))
                    } else {
                        addClarenceMessage(CLARENCE_MESSAGES.welcome_modify('Template'))
                    }
                }
            } else if (sessionData.templateSource === 'uploaded') {
                addClarenceMessage(CLARENCE_MESSAGES.welcome_upload)
            } else if (sessionData.templateSource === 'from_scratch') {
                addClarenceMessage(CLARENCE_MESSAGES.welcome_scratch)
            } else {
                addClarenceMessage(CLARENCE_MESSAGES.welcome_generic)
            }

            // Add mediation type context
            setTimeout(() => {
                if (sessionData.mediationType === 'straight_to_contract') {
                    addClarenceMessage(CLARENCE_MESSAGES.straight_to_contract)
                } else if (sessionData.mediationType === 'partial_mediation') {
                    addClarenceMessage(CLARENCE_MESSAGES.partial_mediation)
                } else if (sessionData.mediationType === 'full_mediation') {
                    addClarenceMessage(CLARENCE_MESSAGES.full_mediation)
                }
            }, 1000)

            setIsLoading(false)
        }

        init()
    }, [searchParams, loadUserInfo, loadSession, loadTemplateClauses])

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 5G: ACTION HANDLERS
    // ========================================================================

    const handleAcceptContract = async () => {
        if (!session) return

        setIsAccepting(true)
        try {
            const response = await fetch(`${API_BASE}/accept-contract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    clauses: clauses.map(c => ({
                        clause_id: c.clauseId,
                        is_locked: c.isLocked,
                        customer_position: c.defaultCustomerPosition,
                        customer_weight: c.defaultWeight
                    }))
                })
            })

            if (!response.ok) {
                throw new Error('Failed to accept contract')
            }

            addClarenceMessage('**Contract accepted!** You can now invite providers to begin the negotiation process.')

            // Redirect to invite providers page
            setTimeout(() => {
                router.push(`/auth/invite-providers?session_id=${session.sessionId}`)
            }, 2000)

        } catch (err) {
            console.error('Error accepting contract:', err)
            setError('Failed to accept contract. Please try again.')
        } finally {
            setIsAccepting(false)
        }
    }

    const handleFileUpload = async (file: File) => {
        setUploadedFile(file)
        setIsProcessingUpload(true)
        addClarenceMessage(`Processing **${file.name}**... This may take a moment.`)

        try {
            // TODO: Implement file upload and parsing
            // For now, show a placeholder message
            setTimeout(() => {
                addClarenceMessage('File upload processing is coming soon. For now, please use a template or build from scratch.')
                setIsProcessingUpload(false)
            }, 2000)
        } catch (err) {
            console.error('Error processing file:', err)
            setError('Failed to process uploaded file')
            setIsProcessingUpload(false)
        }
    }

    const handleClauseSelect = (clause: TemplateClause) => {
        setSelectedClause(clause)
    }

    const handleToggleLock = (clauseId: string) => {
        setClauses(prev => prev.map(c =>
            c.clauseId === clauseId
                ? { ...c, isLocked: !c.isLocked }
                : c
        ))

        // Update category groups too
        setCategoryGroups(prev => prev.map(group => ({
            ...group,
            clauses: group.clauses.map(c =>
                c.clauseId === clauseId
                    ? { ...c, isLocked: !c.isLocked }
                    : c
            )
        })))
    }

    // ========================================================================
    // SECTION 6: RENDER - PANEL 1 (CONTRACT STRUCTURE)
    // ========================================================================

    const renderStructurePanel = () => {
        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href="/auth/contracts-dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2">
                        ← Dashboard
                    </Link>
                    <h2 className="text-lg font-semibold text-slate-800">Contract Prep</h2>
                    <p className="text-xs text-slate-500">{session?.sessionNumber || 'Loading...'}</p>
                </div>

                {/* Session Info */}
                {session && (
                    <div className="p-3 bg-blue-50 border-b border-blue-100">
                        <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-blue-600">Type:</span>
                                <span className="font-medium text-blue-800">
                                    {CONTRACT_TYPE_LABELS[session.contractType] || session.contractType}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-blue-600">Mode:</span>
                                <span className="font-medium text-blue-800">
                                    {MEDIATION_TYPE_LABELS[session.mediationType]}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-blue-600">Source:</span>
                                <span className="font-medium text-blue-800">
                                    {TEMPLATE_SOURCE_LABELS[session.templateSource]}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clause Navigation */}
                <div className="flex-1 overflow-auto">
                    {isLoadingClauses ? (
                        <div className="p-4 text-center">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-sm text-slate-500">Loading clauses...</p>
                        </div>
                    ) : categoryGroups.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                            {session?.templateSource === 'uploaded'
                                ? 'Upload a document to see clauses'
                                : session?.templateSource === 'from_scratch'
                                    ? 'Add clauses to get started'
                                    : 'No clauses loaded'
                            }
                        </div>
                    ) : (
                        <div className="p-2">
                            {categoryGroups.map((group) => (
                                <div key={group.category} className="mb-2">
                                    <button
                                        onClick={() => toggleCategory(group.category)}
                                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                        <span className="text-sm font-medium text-slate-700">
                                            {group.category}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {group.clauses.length}
                                            </span>
                                            <svg
                                                className={`w-4 h-4 text-slate-400 transition-transform ${group.isExpanded ? 'rotate-180' : ''}`}
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {group.isExpanded && (
                                        <div className="ml-2 mt-1 space-y-1">
                                            {group.clauses.map((clause) => (
                                                <button
                                                    key={clause.clauseId}
                                                    onClick={() => handleClauseSelect(clause)}
                                                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${selectedClause?.clauseId === clause.clauseId
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'hover:bg-slate-100 text-slate-600'
                                                        }`}
                                                >
                                                    {clause.isLocked ? (
                                                        <span className="text-amber-500">🔒</span>
                                                    ) : (
                                                        <span className="text-slate-400">📄</span>
                                                    )}
                                                    <span className="flex-1 truncate">{clause.clauseName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stats Footer */}
                <div className="p-3 border-t border-slate-200 bg-white">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>{clauses.length} clauses</span>
                        <span>{clauses.filter(c => c.isLocked).length} locked</span>
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: RENDER - PANEL 2 (MAIN WORKSPACE)
    // ========================================================================

    const renderMainPanel = () => {
        return (
            <div className="h-full flex flex-col bg-white">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-800">
                            {session?.templateSource === 'uploaded'
                                ? 'Upload & Configure'
                                : session?.templateSource === 'from_scratch'
                                    ? 'Build Your Contract'
                                    : 'Review & Configure'
                            }
                        </h1>
                        <p className="text-sm text-slate-500">
                            {session?.customerCompany || 'Your Company'}
                        </p>
                    </div>
                    <button
                        onClick={handleAcceptContract}
                        disabled={isAccepting || clauses.length === 0}
                        className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isAccepting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Accepting...
                            </>
                        ) : (
                            <>
                                Accept Contract
                                <span>→</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-slate-600">Loading contract...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center max-w-md">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">⚠️</span>
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Something went wrong</h3>
                                <p className="text-sm text-slate-500 mb-4">{error}</p>
                                <Link
                                    href="/auth/contracts-dashboard"
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors inline-block"
                                >
                                    Return to Dashboard
                                </Link>
                            </div>
                        </div>
                    ) : session?.templateSource === 'uploaded' ? (
                        renderUploadWorkspace()
                    ) : session?.templateSource === 'from_scratch' ? (
                        renderScratchWorkspace()
                    ) : selectedClause ? (
                        renderClauseDetail()
                    ) : (
                        renderClauseOverview()
                    )}
                </div>
            </div>
        )
    }

    const renderUploadWorkspace = () => {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <input
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        className="hidden"
                        id="file-upload"
                        disabled={isProcessingUpload}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            {isProcessingUpload ? (
                                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="text-3xl">📤</span>
                            )}
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">
                            {isProcessingUpload ? 'Processing...' : 'Upload Your Contract'}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Drag and drop or click to upload a PDF or Word document
                        </p>
                        <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium inline-block">
                            Choose File
                        </span>
                    </label>
                </div>

                {uploadedFile && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg flex items-center gap-3">
                        <span className="text-2xl">📄</span>
                        <div className="flex-1">
                            <p className="font-medium text-slate-800">{uploadedFile.name}</p>
                            <p className="text-sm text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        {isProcessingUpload && (
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const renderScratchWorkspace = () => {
        return (
            <div className="max-w-2xl mx-auto text-center py-12">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🔨</span>
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">Build from Scratch</h3>
                <p className="text-sm text-slate-500 mb-6">
                    Start adding clauses from the library or create custom ones.
                </p>
                <button
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    onClick={() => {
                        addClarenceMessage('The clause library will be available soon. For now, please use a template.')
                    }}
                >
                    Open Clause Library
                </button>
            </div>
        )
    }

    const renderClauseOverview = () => {
        if (clauses.length === 0) {
            return (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📋</span>
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 mb-2">No Clauses Yet</h3>
                    <p className="text-sm text-slate-500">
                        Select a clause from the left panel to view details.
                    </p>
                </div>
            )
        }

        return (
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h3 className="text-lg font-medium text-slate-800 mb-2">Contract Overview</h3>
                    <p className="text-sm text-slate-500">
                        {clauses.length} clauses across {categoryGroups.length} categories.
                        Click on a clause to view and edit details.
                    </p>
                </div>

                <div className="grid gap-4">
                    {categoryGroups.map((group) => (
                        <div key={group.category} className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                {group.category}
                                <span className="text-sm text-slate-400 font-normal">
                                    ({group.clauses.length} clauses)
                                </span>
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {group.clauses.map((clause) => (
                                    <button
                                        key={clause.clauseId}
                                        onClick={() => handleClauseSelect(clause)}
                                        className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                                    >
                                        <span>{clause.isLocked ? '🔒' : '📄'}</span>
                                        <span className="text-sm text-slate-700 truncate">{clause.clauseName}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const renderClauseDetail = () => {
        if (!selectedClause) return null

        return (
            <div className="max-w-3xl mx-auto">
                {/* Back button */}
                <button
                    onClick={() => setSelectedClause(null)}
                    className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1"
                >
                    ← Back to overview
                </button>

                {/* Clause Header */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-sm text-blue-600 font-medium mb-1">
                                {selectedClause.category}
                            </p>
                            <h2 className="text-xl font-semibold text-slate-800">
                                {selectedClause.clauseName}
                            </h2>
                        </div>
                        <button
                            onClick={() => handleToggleLock(selectedClause.clauseId)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${selectedClause.isLocked
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {selectedClause.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                        </button>
                    </div>

                    <p className="text-slate-600 mb-6">
                        {selectedClause.description}
                    </p>

                    {/* Position & Weight */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Default Position
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={selectedClause.defaultCustomerPosition}
                                    disabled={session?.mediationType === 'straight_to_contract'}
                                    className="flex-1"
                                    onChange={() => { }}
                                />
                                <span className="w-8 text-center font-medium text-slate-800">
                                    {selectedClause.defaultCustomerPosition}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                1 = Provider-friendly, 10 = Customer-friendly
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Importance Weight
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={selectedClause.defaultWeight}
                                    disabled={session?.mediationType === 'straight_to_contract'}
                                    className="flex-1"
                                    onChange={() => { }}
                                />
                                <span className="w-8 text-center font-medium text-slate-800">
                                    {selectedClause.defaultWeight}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                1 = Nice to have, 10 = Critical
                            </p>
                        </div>
                    </div>
                </div>

                {/* Position Options */}
                {selectedClause.positionOptions && selectedClause.positionOptions.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-6">
                        <h3 className="font-medium text-slate-800 mb-4">Position Options</h3>
                        <div className="space-y-2">
                            {selectedClause.positionOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className={`p-3 rounded-lg border transition-colors ${option.value === selectedClause.defaultCustomerPosition
                                            ? 'border-blue-300 bg-blue-50'
                                            : 'border-slate-200 bg-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium">
                                            {option.value}
                                        </span>
                                        <div>
                                            <p className="font-medium text-slate-800">{option.label}</p>
                                            <p className="text-sm text-slate-500">{option.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: RENDER - PANEL 3 (CLARENCE CHAT)
    // ========================================================================

    const renderChatPanel = () => {
        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white border-l border-slate-200">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-lg">C</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Clarence</h3>
                            <p className="text-xs text-green-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Online
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {chatMessages.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm py-8">
                            Clarence will guide you through contract preparation...
                        </div>
                    ) : (
                        chatMessages.map((message) => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-md'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                                    }`}>
                                    <div className="text-sm whitespace-pre-wrap">
                                        {message.content.split('**').map((part, i) =>
                                            i % 2 === 1
                                                ? <strong key={i}>{part}</strong>
                                                : <span key={i}>{part}</span>
                                        )}
                                    </div>
                                    <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Quick Actions */}
                <div className="p-4 border-t border-slate-200 bg-white">
                    <p className="text-xs text-slate-500 mb-2">Quick actions:</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => addClarenceMessage(CLARENCE_MESSAGES.accept_ready)}
                            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                        >
                            What's next?
                        </button>
                        <button
                            onClick={() => addClarenceMessage('You can lock any clause by clicking the lock icon. Locked clauses won\'t be open for negotiation with the provider.')}
                            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                        >
                            How do I lock clauses?
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 9: MAIN RENDER
    // ========================================================================

    return (
        <div className="h-screen flex bg-slate-100">
            {/* Panel 1: Contract Structure */}
            <div className="w-72 flex-shrink-0">
                {renderStructurePanel()}
            </div>

            {/* Panel 2: Main Workspace */}
            <div className="flex-1 min-w-0">
                {renderMainPanel()}
            </div>

            {/* Panel 3: Clarence Chat */}
            <div className="w-96 flex-shrink-0">
                {renderChatPanel()}
            </div>
        </div>
    )
}