'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { PartyChatPanel } from '@/app/auth/contract-studio/components/party-chat-component'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface Session {
    sessionId: string
    sessionNumber: string
    contractName: string
    contractType: string
    customerCompany: string
    providerCompany: string
    customerContactName: string | null
    providerContactName: string | null
    customerUserId: string | null
    providerId: string | null
    status: string
    phase: number
    createdAt: string
    // Quick Contract specific
    mediationType: string | null
    uploadedContractId: string | null
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

interface UserInfo {
    odooPartyId: string | null
    odooUserId: string | null
    odooCompanyId: string | null
    userId: string
    email: string
    firstName: string
    lastName: string
    fullName: string
    company: string
    companyId: string
    role: 'customer' | 'provider'
    isAdmin: boolean
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

function QuickContractStudioLoading() {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-slate-700">Loading Contract...</h2>
                <p className="text-slate-500 mt-2">Please wait while we prepare your contract</p>
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
    const sessionId = params?.sessionId as string

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    // Core state
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

    // UI state
    const [selectedClauseIndex, setSelectedClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')
    const [showPartyChat, setShowPartyChat] = useState(false)

    // Action state
    const [accepting, setAccepting] = useState(false)
    const [acceptComplete, setAcceptComplete] = useState(false)

    // Derived state
    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null

    // Refs
    const clauseListRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 4B: AUTH & SESSION LOADING
    // ========================================================================

    useEffect(() => {
        async function loadSessionAndClauses() {
            if (!sessionId) {
                setError('No session ID provided')
                setLoading(false)
                return
            }

            try {
                // Get current user
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                if (authError || !user) {
                    router.push('/login')
                    return
                }

                // Get user profile
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (profileError) {
                    console.error('Profile error:', profileError)
                    setError('Failed to load user profile')
                    setLoading(false)
                    return
                }

                // Load session
                const { data: sessionData, error: sessionError } = await supabase
                    .from('sessions')
                    .select(`
                        session_id,
                        session_number,
                        contract_name,
                        contract_type,
                        customer_company,
                        provider_company,
                        customer_contact_name,
                        provider_contact_name,
                        customer_user_id,
                        provider_id,
                        status,
                        phase,
                        created_at,
                        mediation_type,
                        uploaded_contract_id
                    `)
                    .eq('session_id', sessionId)
                    .single()

                if (sessionError || !sessionData) {
                    console.error('Session error:', sessionError)
                    setError('Session not found')
                    setLoading(false)
                    return
                }

                // Determine user role
                const isCustomer = sessionData.customer_user_id === user.id
                const isProvider = sessionData.provider_id === user.id ||
                    profile.company_id === sessionData.provider_id

                if (!isCustomer && !isProvider) {
                    setError('You do not have access to this contract')
                    setLoading(false)
                    return
                }

                // Set user info
                setUserInfo({
                    odooPartyId: profile.odoo_party_id,
                    odooUserId: profile.odoo_user_id,
                    odooCompanyId: profile.odoo_company_id,
                    userId: user.id,
                    email: user.email || '',
                    firstName: profile.first_name || '',
                    lastName: profile.last_name || '',
                    fullName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                    company: profile.company_name || '',
                    companyId: profile.company_id || '',
                    role: isCustomer ? 'customer' : 'provider',
                    isAdmin: profile.is_admin || false
                })

                // Set session
                setSession({
                    sessionId: sessionData.session_id,
                    sessionNumber: sessionData.session_number,
                    contractName: sessionData.contract_name,
                    contractType: sessionData.contract_type,
                    customerCompany: sessionData.customer_company,
                    providerCompany: sessionData.provider_company || 'Provider',
                    customerContactName: sessionData.customer_contact_name,
                    providerContactName: sessionData.provider_contact_name,
                    customerUserId: sessionData.customer_user_id,
                    providerId: sessionData.provider_id,
                    status: sessionData.status,
                    phase: sessionData.phase,
                    createdAt: sessionData.created_at,
                    mediationType: sessionData.mediation_type,
                    uploadedContractId: sessionData.uploaded_contract_id
                })

                // Load clauses from uploaded_contract_clauses
                if (sessionData.uploaded_contract_id) {
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
                        .eq('contract_id', sessionData.uploaded_contract_id)
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
                }

                setLoading(false)

            } catch (err) {
                console.error('Load error:', err)
                setError('An unexpected error occurred')
                setLoading(false)
            }
        }

        loadSessionAndClauses()
    }, [sessionId, router])

    // ========================================================================
    // SECTION 4C: EVENT HANDLERS
    // ========================================================================

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const handleAcceptAll = async () => {
        if (!session || !userInfo) return

        setAccepting(true)

        try {
            // Update session status
            const { error: updateError } = await supabase
                .from('sessions')
                .update({
                    status: userInfo.role === 'customer' ? 'customer_accepted' : 'provider_accepted',
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', session.sessionId)

            if (updateError) {
                throw updateError
            }

            // Log event
            await supabase.from('system_events').insert({
                event_type: 'contract_accepted',
                source_system: 'quick_contract_studio',
                context: {
                    session_id: session.sessionId,
                    user_id: userInfo.userId,
                    role: userInfo.role,
                    clause_count: clauses.length
                }
            })

            setAcceptComplete(true)

        } catch (err) {
            console.error('Accept error:', err)
            setError('Failed to accept contract. Please try again.')
        } finally {
            setAccepting(false)
        }
    }

    const handleRequestChanges = () => {
        // Open party chat for discussion
        setShowPartyChat(true)
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
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Error</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/auth/quick-contract')}
                        className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Back to Contracts
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: ACCEPT COMPLETE STATE
    // ========================================================================

    if (acceptComplete) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Contract Accepted!</h2>
                    <p className="text-slate-600 mb-6">
                        {userInfo?.role === 'customer'
                            ? 'You have accepted the contract. The other party will be notified.'
                            : 'You have accepted the contract. The contract is now complete.'}
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => router.push('/auth/quick-contract')}
                            className="w-full px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Back to Contracts
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="w-full px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                        >
                            Download PDF
                        </button>
                    </div>
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
                                <h1 className="font-semibold text-slate-800">Quick Contract</h1>
                                <p className="text-xs text-slate-500">{session?.sessionNumber}</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div>
                            <h2 className="font-medium text-slate-700">{session?.contractName}</h2>
                            <p className="text-xs text-slate-500">
                                {session?.customerCompany} ↔ {session?.providerCompany}
                            </p>
                        </div>
                    </div>

                    {/* Right: User & Actions */}
                    <div className="flex items-center gap-4">
                        {/* Party Chat Toggle */}
                        <button
                            onClick={() => setShowPartyChat(!showPartyChat)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${showPartyChat
                                    ? 'bg-teal-100 text-teal-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Party Chat
                        </button>

                        {/* User Info */}
                        <div className="text-right">
                            <p className="text-sm font-medium text-slate-700">{userInfo?.fullName}</p>
                            <p className="text-xs text-slate-500">
                                {userInfo?.role === 'customer' ? 'Customer' : 'Provider'}
                            </p>
                        </div>

                        {/* Sign Out */}
                        <button
                            onClick={handleSignOut}
                            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Sign Out"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
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
                                            {/* Read-only indicator */}
                                            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                Read-only
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
                                    <div className="mt-3 text-sm text-slate-400 text-right">
                                        {selectedClause.clauseText?.length || 0} characters
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

                                        {/* Certification Date */}
                                        {selectedClause.clarenceCertifiedAt && (
                                            <div className="pt-4 border-t border-slate-200">
                                                <p className="text-xs text-slate-400">
                                                    Certified: {new Date(selectedClause.clarenceCertifiedAt).toLocaleDateString()}
                                                </p>
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
                                    onClick={handleAcceptAll}
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
                                    onClick={handleRequestChanges}
                                    className="w-full py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Request Changes
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
            {/* SECTION 8C: PARTY CHAT PANEL (Slide-out) */}
            {/* ============================================================ */}
            {session && userInfo && (
                <PartyChatPanel
                    sessionId={session.sessionId}
                    providerId={session.providerId || ''}
                    providerName={userInfo.role === 'customer' ? session.providerCompany : session.customerCompany}
                    currentUserType={userInfo.role === 'customer' ? 'customer' : 'provider'}
                    currentUserName={userInfo.firstName || 'User'}
                    isProviderOnline={false}
                    isOpen={showPartyChat}
                    onClose={() => setShowPartyChat(false)}
                    onUnreadCountChange={() => { }}
                />
            )}
        </div>
    )
}

// ============================================================================
// SECTION 9: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function QuickContractStudioPage() {
    return (
        <Suspense fallback={<QuickContractStudioLoading />}>
            <QuickContractStudioContent />
        </Suspense>
    )
}