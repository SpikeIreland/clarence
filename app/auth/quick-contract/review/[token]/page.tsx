'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface Recipient {
    recipientId: string
    recipientName: string
    recipientEmail: string
    recipientCompany: string | null
    status: string
    quickContractId: string
}

interface Contract {
    contractId: string
    quickContractId: string
    contractName: string
    contractType: string
    description: string | null
    status: string
    clauseCount: number
    senderName: string | null
    senderCompany: string | null
}

interface ContractClause {
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
    clauseLevel: number
    displayOrder: number
    clarenceCertified: boolean
    clarencePosition: number | null
    clarenceFairness: string | null
    clarenceSummary: string | null
    clarenceAssessment: string | null
    clarenceFlags: string[]
}

interface PositionOption {
    value: number
    label: string
    description: string
}

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

// ============================================================================
// SECTION 2: CONSTANTS
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
    'Confidentiality': 'bg-violet-100 text-violet-700 border-violet-200',
    'General': 'bg-slate-100 text-slate-700 border-slate-200',
    'Definitions': 'bg-gray-100 text-gray-600 border-gray-200',
    'Other': 'bg-slate-100 text-slate-600 border-slate-200'
}

function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
}

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

function ReviewLoading() {
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
                <h2 className="text-xl font-semibold text-slate-700">Loading Contract...</h2>
                <p className="text-slate-500 mt-2">Preparing your review</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

function QuickContractReviewContent() {
    const params = useParams()
    const accessToken = params?.token as string

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [recipient, setRecipient] = useState<Recipient | null>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])

    const [selectedClauseIndex, setSelectedClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState<'overview' | 'draft'>('overview')
    const [showClauseText, setShowClauseText] = useState(false)

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    const [responding, setResponding] = useState(false)
    const [showDeclineModal, setShowDeclineModal] = useState(false)
    const [declineReason, setDeclineReason] = useState('')
    const [responseComplete, setResponseComplete] = useState(false)
    const [responseType, setResponseType] = useState<'accepted' | 'declined' | null>(null)

    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null
    const clauseListRef = useRef<HTMLDivElement>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 4B: DATA LOADING
    // ========================================================================

    useEffect(() => {
        async function loadData() {
            if (!accessToken) {
                setError('Invalid access link')
                setLoading(false)
                return
            }

            try {
                const { data: recipientData, error: recipientError } = await supabase
                    .from('qc_recipients')
                    .select(`
                        recipient_id,
                        recipient_name,
                        recipient_email,
                        recipient_company,
                        status,
                        quick_contract_id,
                        first_viewed_at,
                        view_count,
                        quick_contracts (
                            quick_contract_id,
                            contract_name,
                            contract_type,
                            description,
                            status,
                            source_contract_id,
                            created_by_user_id,
                            company_id
                        )
                    `)
                    .eq('access_token', accessToken)
                    .single()

                if (recipientError || !recipientData) {
                    console.error('Recipient error:', recipientError)
                    setError('Contract not found or link has expired')
                    setLoading(false)
                    return
                }

                if (recipientData.status === 'accepted' || recipientData.status === 'declined') {
                    setResponseComplete(true)
                    setResponseType(recipientData.status as 'accepted' | 'declined')
                }

                const qc = recipientData.quick_contracts as any

                setRecipient({
                    recipientId: recipientData.recipient_id,
                    recipientName: recipientData.recipient_name,
                    recipientEmail: recipientData.recipient_email,
                    recipientCompany: recipientData.recipient_company,
                    status: recipientData.status,
                    quickContractId: recipientData.quick_contract_id
                })

                let senderName = null
                let senderCompany = null

                if (qc.created_by_user_id) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('first_name, last_name')
                        .eq('user_id', qc.created_by_user_id)
                        .single()

                    if (userData) {
                        senderName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
                    }
                }

                if (qc.company_id) {
                    const { data: companyData } = await supabase
                        .from('companies')
                        .select('company_name')
                        .eq('company_id', qc.company_id)
                        .single()

                    if (companyData) {
                        senderCompany = companyData.company_name
                    }
                }

                let clausesData: any[] = []

                if (qc.source_contract_id) {
                    const { data: clauseRows, error: clausesError } = await supabase
                        .from('uploaded_contract_clauses')
                        .select('*')
                        .eq('contract_id', qc.source_contract_id)
                        .order('display_order', { ascending: true })

                    if (!clausesError && clauseRows) {
                        clausesData = clauseRows
                    }
                }

                setContract({
                    contractId: qc.source_contract_id || qc.quick_contract_id,
                    quickContractId: qc.quick_contract_id,
                    contractName: qc.contract_name,
                    contractType: qc.contract_type || 'Contract',
                    description: qc.description,
                    status: qc.status,
                    clauseCount: clausesData.length,
                    senderName,
                    senderCompany
                })

                const mappedClauses: ContractClause[] = clausesData.map(c => ({
                    clauseId: c.clause_id,
                    clauseNumber: c.clause_number,
                    clauseName: c.clause_name,
                    category: c.category || 'Other',
                    clauseText: c.content || '',
                    clauseLevel: c.clause_level || 1,
                    displayOrder: c.display_order,
                    clarenceCertified: c.clarence_certified || false,
                    clarencePosition: c.clarence_position,
                    clarenceFairness: c.clarence_fairness,
                    clarenceSummary: c.clarence_summary,
                    clarenceAssessment: c.clarence_assessment,
                    clarenceFlags: c.clarence_flags || []
                }))

                setClauses(mappedClauses)

                if (mappedClauses.length > 0) {
                    setSelectedClauseIndex(0)
                }

                const updates: any = {
                    view_count: (recipientData.view_count || 0) + 1,
                    last_viewed_at: new Date().toISOString()
                }

                if (!recipientData.first_viewed_at) {
                    updates.first_viewed_at = new Date().toISOString()
                    updates.status = 'viewed'
                }

                await supabase
                    .from('qc_recipients')
                    .update(updates)
                    .eq('recipient_id', recipientData.recipient_id)

                // Truncate very long contract names for display
                const displayName = qc.contract_name.length > 50
                    ? qc.contract_name.substring(0, 47) + '...'
                    : qc.contract_name

                setChatMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: `Welcome${recipientData.recipient_name ? `, ${recipientData.recipient_name.split(' ')[0]}` : ''}! I'm CLARENCE, your contract review assistant.\n\n${senderName ? `${senderName}${senderCompany ? ` from ${senderCompany}` : ''} has sent you ` : 'You have received '}"${displayName}" for your review.\n\nI've analyzed ${mappedClauses.length} clauses and can help you understand any terms.`,
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
    }, [accessToken])

    // ========================================================================
    // SECTION 4C: CHAT FUNCTION
    // ========================================================================

    const sendChatMessage = useCallback(async () => {
        if (!chatInput.trim() || chatLoading) return

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: chatInput.trim(),
            timestamp: new Date()
        }

        setChatMessages(prev => [...prev, userMessage])
        setChatInput('')
        setChatLoading(true)

        setTimeout(() => {
            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: selectedClause
                    ? `Regarding "${selectedClause.clauseName}": ${selectedClause.clarenceAssessment || selectedClause.clarenceSummary || 'This clause has been reviewed and certified.'}`
                    : "I'm here to help you understand this contract. Please select a clause or ask me a specific question.",
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, assistantMessage])
            setChatLoading(false)
        }, 1000)
    }, [chatInput, chatLoading, selectedClause])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 4D: RESPONSE HANDLERS
    // ========================================================================

    const handleAccept = async () => {
        if (!recipient) return
        setResponding(true)

        try {
            await supabase
                .from('qc_recipients')
                .update({
                    status: 'accepted',
                    responded_at: new Date().toISOString(),
                    response_type: 'accepted'
                })
                .eq('recipient_id', recipient.recipientId)

            setResponseComplete(true)
            setResponseType('accepted')
        } catch (err) {
            console.error('Accept error:', err)
            setError('Failed to accept. Please try again.')
        } finally {
            setResponding(false)
        }
    }

    const handleDecline = async () => {
        if (!recipient) return
        setResponding(true)

        try {
            await supabase
                .from('qc_recipients')
                .update({
                    status: 'declined',
                    responded_at: new Date().toISOString(),
                    response_type: 'declined',
                    decline_reason: declineReason || null
                })
                .eq('recipient_id', recipient.recipientId)

            setShowDeclineModal(false)
            setResponseComplete(true)
            setResponseType('declined')
        } catch (err) {
            console.error('Decline error:', err)
            setError('Failed to decline. Please try again.')
        } finally {
            setResponding(false)
        }
    }

    // ========================================================================
    // SECTION 4E: HELPERS
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

    const getPositionLabel = (position: number | null): string => {
        if (position === null) return 'Not set'
        const option = DEFAULT_POSITION_OPTIONS.find(o => o.value === Math.round(position))
        return option?.label || `Position ${position}`
    }

    // ========================================================================
    // SECTION 5: LOADING STATE
    // ========================================================================

    if (loading) {
        return <ReviewLoading />
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
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: RESPONSE COMPLETE STATE
    // ========================================================================

    if (responseComplete) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${responseType === 'accepted' ? 'bg-emerald-100' : 'bg-slate-100'
                        }`}>
                        {responseType === 'accepted' ? (
                            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                        {responseType === 'accepted' ? 'Contract Accepted' : 'Contract Declined'}
                    </h2>
                    <p className="text-slate-600 mb-6">
                        {responseType === 'accepted'
                            ? `Thank you for accepting "${contract?.contractName}". The sender has been notified.`
                            : `You have declined "${contract?.contractName}". The sender has been notified.`
                        }
                    </p>
                    <p className="text-sm text-slate-400">You can close this window.</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: MAIN LAYOUT
    // ========================================================================

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">

            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-md">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <h1 className="font-semibold text-slate-800">Contract Review</h1>
                                <p className="text-xs text-slate-500">CLARENCE Certified</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-medium text-slate-700 truncate" title={contract?.contractName}>
                                {contract?.contractName}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {contract?.senderName && `From ${contract.senderName}`}
                                {contract?.senderCompany && ` · ${contract.senderCompany}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={() => setShowDeclineModal(true)}
                            disabled={responding}
                            className="px-4 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                        >
                            Decline
                        </button>
                        <button
                            onClick={handleAccept}
                            disabled={responding}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            {responding ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Accept Contract
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* 3-PANEL LAYOUT */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* LEFT PANEL: Clause List */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 flex-shrink-0">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search clauses..."
                                value={clauseSearchTerm}
                                onChange={(e) => setClauseSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    <div ref={clauseListRef} className="flex-1 overflow-y-auto min-h-0">
                        {filteredClauses.map((clause) => {
                            const actualIndex = clauses.findIndex(c => c.clauseId === clause.clauseId)
                            const isSelected = selectedClauseIndex === actualIndex

                            return (
                                <div
                                    key={clause.clauseId}
                                    onClick={() => setSelectedClauseIndex(actualIndex)}
                                    className={`px-3 py-2.5 border-b border-slate-100 cursor-pointer transition-all ${isSelected
                                            ? 'bg-purple-50 border-l-4 border-l-purple-500'
                                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                        }`}
                                    style={{ paddingLeft: `${12 + (clause.clauseLevel - 1) * 12}px` }}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${clause.clarenceCertified
                                                ? 'bg-purple-100 text-purple-600'
                                                : 'bg-slate-200 text-slate-400'
                                            }`}>
                                            {clause.clarenceCertified ? '✓' : '○'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-mono text-slate-400">{clause.clauseNumber}</span>
                                                {clause.clarencePosition && (
                                                    <span className="text-xs font-medium text-purple-600">
                                                        {clause.clarencePosition.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm truncate ${isSelected ? 'text-purple-700 font-medium' : 'text-slate-700'}`}>
                                                {clause.clauseName}
                                            </p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${getCategoryColor(clause.category)}`}>
                                                {clause.category}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="p-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">{clauses.length} clauses</span>
                            <span className="text-purple-600">
                                {clauses.filter(c => c.clarenceCertified).length} certified
                            </span>
                        </div>
                    </div>
                </div>

                {/* CENTER PANEL: Workspace */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {selectedClause ? (
                        <>
                            {/* Clause Header */}
                            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-mono text-slate-400">{selectedClause.clauseNumber}</span>
                                            <span className={`px-2 py-0.5 text-xs rounded-full border ${getCategoryColor(selectedClause.category)}`}>
                                                {selectedClause.category}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-semibold text-slate-800">{selectedClause.clauseName}</h2>
                                    </div>
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                        {(['overview', 'draft'] as const).map(tab => (
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

                            {/* Workspace Content */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">
                                        {/* Position Bar */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-4">CLARENCE Position</h3>
                                            <div className="relative mb-6 pt-6 pb-2">
                                                <div className="relative h-4 bg-gradient-to-r from-emerald-200 via-teal-200 via-50% to-blue-200 rounded-full">
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                        <div
                                                            key={n}
                                                            className="absolute top-0 bottom-0 w-px bg-white/50"
                                                            style={{ left: `${((n - 1) / 9) * 100}%` }}
                                                        />
                                                    ))}
                                                    {selectedClause.clarencePosition !== null && (
                                                        <div
                                                            className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 border-4 border-white flex items-center justify-center text-lg font-bold text-white z-20 shadow-xl"
                                                            style={{
                                                                left: `${((selectedClause.clarencePosition - 1) / 9) * 100}%`,
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%)'
                                                            }}
                                                        >
                                                            C
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-between mt-4 text-xs text-slate-500">
                                                    <span>Customer-Favoring</span>
                                                    <span>Balanced</span>
                                                    <span>Provider-Favoring</span>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                                                        <span className="text-white text-xl font-bold">C</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-2xl font-bold text-purple-700">
                                                            {selectedClause.clarencePosition?.toFixed(1) ?? '—'}
                                                        </div>
                                                        <div className="text-sm text-purple-600">
                                                            {getPositionLabel(selectedClause.clarencePosition)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Analysis */}
                                        {(selectedClause.clarenceSummary || selectedClause.clarenceAssessment) && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-5">
                                                <h3 className="text-sm font-semibold text-slate-700 mb-3">CLARENCE Analysis</h3>
                                                {selectedClause.clarenceSummary && (
                                                    <p className="text-slate-700 mb-3">{selectedClause.clarenceSummary}</p>
                                                )}
                                                {selectedClause.clarenceAssessment && (
                                                    <p className="text-slate-600 text-sm">{selectedClause.clarenceAssessment}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Clause Text Toggle */}
                                        <div className="bg-white rounded-xl border border-slate-200">
                                            <button
                                                onClick={() => setShowClauseText(!showClauseText)}
                                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
                                            >
                                                <span className="text-sm font-medium text-slate-700">View Full Clause Text</span>
                                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${showClauseText ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showClauseText && (
                                                <div className="px-5 pb-5 border-t border-slate-100">
                                                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                            {selectedClause.clauseText || 'Clause text not available.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'draft' && (
                                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                                        <h3 className="text-sm font-semibold text-slate-700 mb-4">Clause Text</h3>
                                        <div className="p-4 bg-slate-50 rounded-lg">
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                                                {selectedClause.clauseText || 'Clause text not available.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Navigation Footer */}
                            <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                                <button
                                    onClick={() => setSelectedClauseIndex(Math.max(0, (selectedClauseIndex || 0) - 1))}
                                    disabled={selectedClauseIndex === 0}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 flex items-center gap-2"
                                >
                                    ← Previous
                                </button>
                                <span className="text-sm text-slate-500">
                                    Clause {(selectedClauseIndex || 0) + 1} of {clauses.length}
                                </span>
                                <button
                                    onClick={() => setSelectedClauseIndex(Math.min(clauses.length - 1, (selectedClauseIndex || 0) + 1))}
                                    disabled={selectedClauseIndex === clauses.length - 1}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 flex items-center gap-2"
                                >
                                    Next →
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-slate-500">Select a clause to view details</p>
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: Chat */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden min-h-0">
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">CLARENCE</h3>
                                <p className="text-xs text-slate-500">Contract Assistant</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                        {chatMessages.map((message) => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-slate-200 flex-shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                placeholder="Ask about this contract..."
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={!chatInput.trim() || chatLoading}
                                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* DECLINE MODAL */}
            {showDeclineModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Decline Contract</h3>
                        <p className="text-slate-600 text-sm mb-4">
                            Are you sure you want to decline this contract? You can optionally provide a reason.
                        </p>
                        <textarea
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Reason for declining (optional)"
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm mb-4 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeclineModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDecline}
                                disabled={responding}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                            >
                                {responding ? 'Processing...' : 'Decline Contract'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 9: EXPORT
// ============================================================================

export default function QuickContractReviewPage() {
    return (
        <Suspense fallback={<ReviewLoading />}>
            <QuickContractReviewContent />
        </Suspense>
    )
}