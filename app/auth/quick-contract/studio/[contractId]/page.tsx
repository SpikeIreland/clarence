'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
    // Position options (from clause library)
    positionOptions: PositionOption[]
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
    const contractId = params?.contractId as string

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])

    // UI state
    const [selectedClauseIndex, setSelectedClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'tradeoffs' | 'draft'>('overview')
    const [showClauseText, setShowClauseText] = useState(false)

    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    // Action state
    const [accepting, setAccepting] = useState(false)

    // Derived state
    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null

    // Refs
    const clauseListRef = useRef<HTMLDivElement>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)

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
                    positionOptions: DEFAULT_POSITION_OPTIONS
                }))

                setClauses(mappedClauses)

                // Auto-select first clause
                if (mappedClauses.length > 0) {
                    setSelectedClauseIndex(0)
                }

                // Initialize chat with welcome message
                setChatMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: `Welcome to the Quick Contract Studio! I'm CLARENCE, your contract analysis assistant.\n\nI've reviewed "${contractData.contract_name}" and certified ${mappedClauses.filter(c => c.clarenceCertified).length} of ${mappedClauses.length} clauses.\n\nSelect any clause to see my recommended position and analysis. Feel free to ask me questions about specific clauses or the contract as a whole.`,
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
    // SECTION 4C: CHAT FUNCTIONS
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
    // SECTION 4D: ACTION HANDLERS
    // ========================================================================

    const handleAcceptContract = async () => {
        if (!contract) return

        setAccepting(true)

        try {
            const { error: updateError } = await supabase
                .from('uploaded_contracts')
                .update({
                    status: 'accepted',
                    updated_at: new Date().toISOString()
                })
                .eq('contract_id', contract.contractId)

            if (updateError) throw updateError

            // Log event
            await supabase.from('system_events').insert({
                event_type: 'quick_contract_accepted',
                source_system: 'quick_contract_studio',
                context: {
                    contract_id: contract.contractId,
                    user_id: userInfo?.userId,
                    clause_count: clauses.length,
                    certified_count: clauses.filter(c => c.clarenceCertified).length
                }
            })

            // Redirect to success or dashboard
            router.push('/auth/quick-contract?accepted=true')

        } catch (err) {
            console.error('Accept error:', err)
            setError('Failed to accept contract. Please try again.')
        } finally {
            setAccepting(false)
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

    const getPositionLabel = (position: number | null): string => {
        if (position === null) return 'Not set'
        const option = DEFAULT_POSITION_OPTIONS.find(o => o.value === Math.round(position))
        return option?.label || `Position ${position}`
    }

    const getPositionColor = (position: number | null): string => {
        if (position === null) return 'bg-slate-200'
        if (position <= 3) return 'bg-emerald-500'
        if (position <= 5) return 'bg-teal-500'
        if (position <= 7) return 'bg-blue-500'
        return 'bg-indigo-500'
    }

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
                                <p className="text-xs text-slate-500">CLARENCE Certified Review</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-medium text-slate-700 truncate" title={contract?.contractName}>
                                {contract?.contractName}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {contract?.contractType} · {clauses.length} clauses · {clauses.filter(c => c.clarenceCertified).length} certified
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/auth/quick-contract')}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleAcceptContract}
                            disabled={accepting}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            {accepting ? (
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

            {/* ============================================================ */}
            {/* SECTION 7B: 3-PANEL LAYOUT */}
            {/* ============================================================ */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* ======================================================== */}
                {/* LEFT PANEL: Clause List */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-slate-200">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search clauses..."
                                value={clauseSearchTerm}
                                onChange={(e) => setClauseSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Clause List */}
                    <div ref={clauseListRef} className="flex-1 overflow-y-auto min-h-0">
                        {filteredClauses.map((clause) => {
                            const actualIndex = clauses.findIndex(c => c.clauseId === clause.clauseId)
                            const isSelected = selectedClauseIndex === actualIndex
                            const isCertified = clause.clarenceCertified
                            const hasFlags = clause.clarenceFlags && clause.clarenceFlags.length > 0 && !clause.clarenceFlags.includes('none')

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
                                        {/* Certification Icon */}
                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${!isCertified
                                                ? 'bg-slate-200 text-slate-400'
                                                : hasFlags
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : clause.clarenceFairness === 'balanced'
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : 'bg-purple-100 text-purple-600'
                                            }`}>
                                            {!isCertified ? '○' : hasFlags ? '!' : '✓'}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {clause.clauseNumber}
                                                </span>
                                                {clause.clarencePosition && (
                                                    <span className="text-xs font-medium text-purple-600">
                                                        {clause.clarencePosition.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm leading-snug truncate ${isSelected ? 'text-purple-700 font-medium' : 'text-slate-700'}`}>
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

                    {/* Stats Footer */}
                    <div className="p-3 border-t border-slate-200 bg-slate-50">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">
                                {clauses.length} clauses
                            </span>
                            <span className="text-purple-600 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                {clauses.filter(c => c.clarenceCertified).length} certified
                            </span>
                        </div>
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
                                                                {selectedClause.clarencePosition?.toFixed(1) ?? '—'}
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
                                                            {selectedClause.clarenceFairness === 'balanced' ? '✓ Balanced' : '⚠ Review Recommended'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">Fairness Assessment</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

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
                                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-medium text-slate-700 mb-2">No History Yet</h3>
                                            <p className="text-slate-500 text-sm">
                                                This is a Quick Contract review. Position history is available in full negotiation mode.
                                            </p>
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
                                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                                        <h3 className="text-sm font-semibold text-slate-700 mb-4">Draft Clause Language</h3>
                                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                                                {selectedClause.clauseText || 'Clause text not available for drafting.'}
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-3 italic">
                                            This shows the current clause text. In full negotiation mode, CLARENCE can generate draft language based on agreed positions.
                                        </p>
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
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                                onClick={sendChatMessage}
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