'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface Recipient {
    recipientId: string
    contractId: string
    recipientName: string
    recipientEmail: string
    recipientCompany: string | null
    status: string
    firstViewedAt: string | null
    viewCount: number
}

interface Contract {
    contractId: string
    contractName: string
    contractType: string
    description: string | null
    senderCompany: string | null
    senderName: string | null
    createdAt: string
}

interface ContractClause {
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
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
}

// ============================================================================
// SECTION 2: CONSTANTS & CONFIGURATION
// ============================================================================

const supabase = createClient()

const CATEGORY_COLORS: Record<string, string> = {
    'Service Delivery': 'bg-blue-100 text-blue-700',
    'Service Levels': 'bg-cyan-100 text-cyan-700',
    'Charges & Payment': 'bg-emerald-100 text-emerald-700',
    'Liability': 'bg-red-100 text-red-700',
    'Intellectual Property': 'bg-purple-100 text-purple-700',
    'Term & Termination': 'bg-orange-100 text-orange-700',
    'Data Protection': 'bg-pink-100 text-pink-700',
    'Governance': 'bg-indigo-100 text-indigo-700',
    'Employment': 'bg-amber-100 text-amber-700',
    'General': 'bg-slate-100 text-slate-700',
    'Definitions': 'bg-gray-100 text-gray-700',
    'Other': 'bg-slate-100 text-slate-600'
}

function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
}

// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function ReviewLoading() {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-slate-700">Loading Contract...</h2>
                <p className="text-slate-500 mt-2">Please wait while we prepare your contract for review</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

function QuickContractReviewContent() {
    const router = useRouter()
    const params = useParams()
    const token = params?.token as string

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [recipient, setRecipient] = useState<Recipient | null>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])

    // UI state
    const [selectedClauseIndex, setSelectedClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')

    // Action state
    const [accepting, setAccepting] = useState(false)
    const [declining, setDeclining] = useState(false)
    const [responseComplete, setResponseComplete] = useState(false)
    const [responseType, setResponseType] = useState<'accepted' | 'declined' | null>(null)
    const [declineReason, setDeclineReason] = useState('')
    const [showDeclineModal, setShowDeclineModal] = useState(false)

    // Derived state
    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null

    // Refs
    const clauseListRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 4B: LOAD CONTRACT BY TOKEN
    // ========================================================================

    useEffect(() => {
        async function loadContractByToken() {
            if (!token) {
                setError('No access token provided')
                setLoading(false)
                return
            }

            try {
                // Look up recipient by access_token
                const { data: recipientData, error: recipientError } = await supabase
                    .from('qc_recipients')
                    .select(`
                        recipient_id,
                        quick_contract_id,
                        recipient_name,
                        recipient_email,
                        recipient_company,
                        status,
                        first_viewed_at,
                        view_count,
                        access_token_expires_at
                    `)
                    .eq('access_token', token)
                    .single()

                if (recipientError || !recipientData) {
                    console.error('Recipient lookup error:', recipientError)
                    setError('Invalid or expired access link. Please contact the sender for a new link.')
                    setLoading(false)
                    return
                }

                // Check if token has expired
                if (recipientData.access_token_expires_at) {
                    const expiresAt = new Date(recipientData.access_token_expires_at)
                    if (expiresAt < new Date()) {
                        setError('This access link has expired. Please contact the sender for a new link.')
                        setLoading(false)
                        return
                    }
                }

                // Check if already responded
                if (recipientData.status === 'accepted' || recipientData.status === 'declined') {
                    setResponseComplete(true)
                    setResponseType(recipientData.status as 'accepted' | 'declined')
                }

                // Update view tracking
                const isFirstView = !recipientData.first_viewed_at
                await supabase
                    .from('qc_recipients')
                    .update({
                        first_viewed_at: isFirstView ? new Date().toISOString() : recipientData.first_viewed_at,
                        last_viewed_at: new Date().toISOString(),
                        view_count: (recipientData.view_count || 0) + 1,
                        status: recipientData.status === 'invited' ? 'viewed' : recipientData.status
                    })
                    .eq('recipient_id', recipientData.recipient_id)

                setRecipient({
                    recipientId: recipientData.recipient_id,
                    contractId: recipientData.quick_contract_id,
                    recipientName: recipientData.recipient_name,
                    recipientEmail: recipientData.recipient_email,
                    recipientCompany: recipientData.recipient_company,
                    status: recipientData.status,
                    firstViewedAt: recipientData.first_viewed_at,
                    viewCount: recipientData.view_count || 0
                })

                // Load contract details
                const { data: contractData, error: contractError } = await supabase
                    .from('uploaded_contracts')
                    .select(`
                        contract_id,
                        contract_name,
                        detected_contract_type,
                        description,
                        company_id,
                        uploaded_by_user_id,
                        created_at
                    `)
                    .eq('contract_id', recipientData.quick_contract_id)
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
                    senderCompany: null, // TODO: Look up from company_id if needed
                    senderName: null,
                    createdAt: contractData.created_at
                })

                // Load clauses
                const { data: clausesData, error: clausesError } = await supabase
                    .from('uploaded_contract_clauses')
                    .select(`
                        clause_id,
                        clause_number,
                        clause_name,
                        category,
                        content,
                        clause_level,
                        display_order,
                        parent_clause_id,
                        clarence_certified,
                        clarence_position,
                        clarence_fairness,
                        clarence_summary,
                        clarence_assessment,
                        clarence_flags,
                        clarence_certified_at
                    `)
                    .eq('contract_id', recipientData.quick_contract_id)
                    .order('display_order', { ascending: true })

                if (clausesError) {
                    console.error('Clauses error:', clausesError)
                    setError('Failed to load contract clauses')
                    setLoading(false)
                    return
                }

                const mappedClauses: ContractClause[] = (clausesData || []).map(c => ({
                    clauseId: c.clause_id,
                    clauseNumber: c.clause_number,
                    clauseName: c.clause_name,
                    category: c.category || 'Other',
                    clauseText: c.content || '',
                    clauseLevel: c.clause_level || 1,
                    displayOrder: c.display_order,
                    parentClauseId: c.parent_clause_id,
                    clarenceCertified: c.clarence_certified || false,
                    clarencePosition: c.clarence_position,
                    clarenceFairness: c.clarence_fairness,
                    clarenceSummary: c.clarence_summary,
                    clarenceAssessment: c.clarence_assessment,
                    clarenceFlags: c.clarence_flags || [],
                    clarenceCertifiedAt: c.clarence_certified_at
                }))

                setClauses(mappedClauses)

                // Auto-select first clause
                if (mappedClauses.length > 0) {
                    setSelectedClauseIndex(0)
                }

                setLoading(false)

            } catch (err) {
                console.error('Load error:', err)
                setError('An unexpected error occurred')
                setLoading(false)
            }
        }

        loadContractByToken()
    }, [token])

    // ========================================================================
    // SECTION 4C: EVENT HANDLERS
    // ========================================================================

    const handleAccept = async () => {
        if (!recipient) return

        setAccepting(true)

        try {
            // Update recipient record
            const { error: updateError } = await supabase
                .from('qc_recipients')
                .update({
                    status: 'accepted',
                    responded_at: new Date().toISOString(),
                    response_type: 'accepted',
                    updated_at: new Date().toISOString()
                })
                .eq('recipient_id', recipient.recipientId)

            if (updateError) {
                throw updateError
            }

            // Log event
            await supabase.from('system_events').insert({
                event_type: 'quick_contract_accepted',
                source_system: 'quick_contract_review',
                context: {
                    recipient_id: recipient.recipientId,
                    contract_id: recipient.contractId,
                    recipient_email: recipient.recipientEmail,
                    clause_count: clauses.length
                }
            })

            setResponseComplete(true)
            setResponseType('accepted')

        } catch (err) {
            console.error('Accept error:', err)
            setError('Failed to accept contract. Please try again.')
        } finally {
            setAccepting(false)
        }
    }

    const handleDecline = async () => {
        if (!recipient) return

        setDeclining(true)

        try {
            // Update recipient record
            const { error: updateError } = await supabase
                .from('qc_recipients')
                .update({
                    status: 'declined',
                    responded_at: new Date().toISOString(),
                    response_type: 'declined',
                    decline_reason: declineReason || null,
                    updated_at: new Date().toISOString()
                })
                .eq('recipient_id', recipient.recipientId)

            if (updateError) {
                throw updateError
            }

            // Log event
            await supabase.from('system_events').insert({
                event_type: 'quick_contract_declined',
                source_system: 'quick_contract_review',
                context: {
                    recipient_id: recipient.recipientId,
                    contract_id: recipient.contractId,
                    recipient_email: recipient.recipientEmail,
                    decline_reason: declineReason
                }
            })

            setResponseComplete(true)
            setResponseType('declined')
            setShowDeclineModal(false)

        } catch (err) {
            console.error('Decline error:', err)
            setError('Failed to decline contract. Please try again.')
        } finally {
            setDeclining(false)
        }
    }

    // ========================================================================
    // SECTION 4D: FILTERED CLAUSES
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
                    <a
                        href="https://www.clarencelegal.ai"
                        className="inline-block px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Go to CLARENCE
                    </a>
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
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${responseType === 'accepted' ? 'bg-emerald-100' : 'bg-amber-100'
                        }`}>
                        {responseType === 'accepted' ? (
                            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        {responseType === 'accepted' ? 'Contract Accepted!' : 'Contract Declined'}
                    </h2>
                    <p className="text-slate-600 mb-6">
                        {responseType === 'accepted'
                            ? 'Thank you for accepting. The sender has been notified.'
                            : 'The sender has been notified of your decision.'}
                    </p>
                    <p className="text-sm text-slate-500">
                        Contract: {contract?.contractName}
                    </p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: MAIN LAYOUT RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">

            {/* ============================================================ */}
            {/* SECTION 8A: HEADER */}
            {/* ============================================================ */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4">
                    {/* Left: Logo & Contract Info */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <h1 className="font-semibold text-slate-800">Contract Review</h1>
                                <p className="text-xs text-slate-500">CLARENCE Quick Contract</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div>
                            <h2 className="font-medium text-slate-700">{contract?.contractName}</h2>
                            <p className="text-xs text-slate-500">
                                {contract?.contractType} · {clauses.length} clauses
                            </p>
                        </div>
                    </div>

                    {/* Right: Recipient Info */}
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-700">{recipient?.recipientName}</p>
                            <p className="text-xs text-slate-500">{recipient?.recipientCompany || recipient?.recipientEmail}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* ============================================================ */}
            {/* SECTION 8B: 3-PANEL LAYOUT */}
            {/* ============================================================ */}
            <div className="flex flex-1 overflow-hidden">

                {/* ======================================================== */}
                {/* LEFT PANEL: Clause List */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                    {/* Search */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search clauses..."
                                value={clauseSearchTerm}
                                onChange={(e) => setClauseSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Clause List */}
                    <div ref={clauseListRef} className="flex-1 overflow-y-auto">
                        {filteredClauses.map((clause, index) => {
                            const actualIndex = clauses.findIndex(c => c.clauseId === clause.clauseId)
                            const isSelected = selectedClauseIndex === actualIndex
                            const isCertified = clause.clarenceCertified
                            const hasFlags = clause.clarenceFlags && clause.clarenceFlags.length > 0 && !clause.clarenceFlags.includes('none')

                            return (
                                <div
                                    key={clause.clauseId}
                                    onClick={() => setSelectedClauseIndex(actualIndex)}
                                    className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-all ${isSelected
                                            ? 'bg-teal-50 border-l-4 border-l-teal-500'
                                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                        }`}
                                    style={{ paddingLeft: `${16 + (clause.clauseLevel - 1) * 12}px` }}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Certification Icon */}
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${!isCertified
                                                ? 'bg-slate-200 text-slate-400'
                                                : hasFlags
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : clause.clarenceFairness === 'balanced'
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            {!isCertified ? '○' : hasFlags ? '!' : '✓'}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {clause.clauseNumber}
                                                </span>
                                            </div>
                                            <p className={`text-sm leading-snug ${isSelected ? 'text-teal-700 font-medium' : 'text-slate-700'}`}>
                                                {clause.clauseName}
                                            </p>
                                            <span className={`inline-block mt-1.5 px-2 py-0.5 text-xs rounded-full ${getCategoryColor(clause.category)}`}>
                                                {clause.category}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Stats Footer */}
                    <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">
                                Total: <strong className="text-slate-700">{clauses.length}</strong>
                            </span>
                            <span className="text-emerald-600 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                {clauses.filter(c => c.clarenceCertified).length} certified
                            </span>
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* MIDDLE PANEL: Clause Content */}
                {/* ======================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                    {selectedClause ? (
                        <>
                            {/* Clause Header */}
                            <div className="px-8 py-5 border-b border-slate-200 bg-white">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                                                {selectedClause.clauseNumber}
                                            </span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(selectedClause.category)}`}>
                                                {selectedClause.category}
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800">
                                            {selectedClause.clauseName}
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(selectedClause.clauseText || '')}
                                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Copy clause text"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Clause Content */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="max-w-4xl mx-auto">
                                    <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
                                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-base">
                                            {selectedClause.clauseText || 'No content available for this clause.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Footer */}
                            <div className="px-8 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
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
                                <span className="text-sm text-slate-500 font-medium">
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
                                <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-slate-500 text-lg">Select a clause to view details</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* RIGHT PANEL: CLARENCE Certification + Actions */}
                {/* ======================================================== */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
                    {selectedClause ? (
                        <>
                            {/* Certification Header */}
                            <div className={`px-6 py-4 border-b ${selectedClause.clarenceCertified
                                    ? selectedClause.clarenceFairness === 'balanced'
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : selectedClause.clarenceFairness === 'review_recommended'
                                            ? 'bg-amber-50 border-amber-200'
                                            : 'bg-blue-50 border-blue-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedClause.clarenceCertified
                                            ? selectedClause.clarenceFairness === 'balanced'
                                                ? 'bg-emerald-100'
                                                : selectedClause.clarenceFairness === 'review_recommended'
                                                    ? 'bg-amber-100'
                                                    : 'bg-blue-100'
                                            : 'bg-slate-200'
                                        }`}>
                                        {selectedClause.clarenceCertified ? (
                                            <svg className={`w-6 h-6 ${selectedClause.clarenceFairness === 'balanced'
                                                    ? 'text-emerald-600'
                                                    : selectedClause.clarenceFairness === 'review_recommended'
                                                        ? 'text-amber-600'
                                                        : 'text-blue-600'
                                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">
                                            {selectedClause.clarenceCertified ? 'CLARENCE Certified' : 'Pending Review'}
                                        </h3>
                                        {selectedClause.clarenceCertified && selectedClause.clarenceFairness && (
                                            <p className={`text-sm font-medium ${selectedClause.clarenceFairness === 'balanced'
                                                    ? 'text-emerald-600'
                                                    : selectedClause.clarenceFairness === 'review_recommended'
                                                        ? 'text-amber-600'
                                                        : 'text-blue-600'
                                                }`}>
                                                {selectedClause.clarenceFairness.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Certification Details */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {selectedClause.clarenceCertified ? (
                                    <div className="space-y-6">
                                        {/* Position Score */}
                                        {selectedClause.clarencePosition && (
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Position Score</h4>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${selectedClause.clarencePosition <= 4
                                                                    ? 'bg-green-500'
                                                                    : selectedClause.clarencePosition <= 6
                                                                        ? 'bg-emerald-500'
                                                                        : 'bg-blue-500'
                                                                }`}
                                                            style={{ width: `${(selectedClause.clarencePosition / 10) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-2xl font-bold text-slate-800 w-12 text-right">
                                                        {selectedClause.clarencePosition.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-400 mt-2">
                                                    <span>Customer-Favoring</span>
                                                    <span>Provider-Favoring</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Summary */}
                                        {selectedClause.clarenceSummary && (
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">What This Means</h4>
                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                    {selectedClause.clarenceSummary}
                                                </p>
                                            </div>
                                        )}

                                        {/* Assessment */}
                                        {selectedClause.clarenceAssessment && (
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Assessment</h4>
                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                    {selectedClause.clarenceAssessment}
                                                </p>
                                            </div>
                                        )}

                                        {/* Flags */}
                                        {selectedClause.clarenceFlags && selectedClause.clarenceFlags.length > 0 && !selectedClause.clarenceFlags.includes('none') && (
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Attention Points</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedClause.clarenceFlags.filter(f => f !== 'none').map((flag, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full"
                                                        >
                                                            {flag.replace(/_/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            This clause is awaiting CLARENCE certification.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                                <button
                                    onClick={handleAccept}
                                    disabled={accepting}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {accepting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Accept Contract
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowDeclineModal(true)}
                                    className="w-full py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Decline
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center px-8">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <p className="text-slate-500">
                                    Select a clause to view CLARENCE certification
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 8C: DECLINE MODAL */}
            {/* ============================================================ */}
            {showDeclineModal && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowDeclineModal(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Decline Contract</h3>
                            <p className="text-slate-600 mb-4">
                                Please provide a reason for declining (optional). The sender will be notified.
                            </p>
                            <textarea
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="Enter your reason..."
                                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                rows={4}
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowDeclineModal(false)}
                                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDecline}
                                    disabled={declining}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                                >
                                    {declining ? 'Declining...' : 'Confirm Decline'}
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
// SECTION 9: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function QuickContractReviewPage() {
    return (
        <Suspense fallback={<ReviewLoading />}>
            <QuickContractReviewContent />
        </Suspense>
    )
}