'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface ProviderInvite {
    id: string
    companyName: string
    contactName: string
    contactEmail: string
    status: 'pending' | 'sending' | 'sent' | 'error'
    errorMessage?: string
}

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    mediationType: 'straight_to_contract' | 'partial_mediation' | 'full_mediation'
    contractType: string
    templateSource: string
    status: string
}

interface ContractData {
    contractId: string
    contractName: string
    clauseCount: number
    status: string
}

interface DealContext {
    dealValue: string | null
    serviceCriticality: string | null
    timelinePressure: string | null
    bidderCount: string | null
    batnaStatus: string | null
    topPriorities: string[]
}

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    userId: string
    companyId: string | null
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const MEDIATION_LABELS: Record<string, string> = {
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

const DEAL_VALUE_LABELS: Record<string, string> = {
    'under_50k': 'Under £50,000',
    '50k_250k': '£50,000 - £250,000',
    '250k_1m': '£250,000 - £1 million',
    'over_1m': 'Over £1 million'
}

// ============================================================================
// SECTION 3: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function InviteProvidersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        }>
            <InviteProvidersContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 4: MAIN CONTENT COMPONENT
// ============================================================================

function InviteProvidersContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 5: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [session, setSession] = useState<SessionData | null>(null)
    const [contract, setContract] = useState<ContractData | null>(null)
    const [dealContext, setDealContext] = useState<DealContext | null>(null)
    const [providers, setProviders] = useState<ProviderInvite[]>([])
    const [existingBids, setExistingBids] = useState<any[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [allSent, setAllSent] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // New provider form
    const [newProvider, setNewProvider] = useState({
        companyName: '',
        contactName: '',
        contactEmail: ''
    })

    // ========================================================================
    // SECTION 6: INITIALIZATION
    // ========================================================================

    useEffect(() => {
        const initializePage = async () => {
            // Check auth
            const authData = localStorage.getItem('clarence_auth')
            if (!authData) {
                router.push('/auth/login')
                return
            }

            try {
                const parsed = JSON.parse(authData)
                setUserInfo(parsed.userInfo)
            } catch (e) {
                router.push('/auth/login')
                return
            }

            const sessionId = searchParams.get('session_id')
            const contractId = searchParams.get('contract_id')

            if (!sessionId) {
                router.push('/auth/contracts-dashboard')
                return
            }

            // Load session data
            await loadSessionData(sessionId)

            // Load contract data if we have a contract_id
            if (contractId) {
                await loadContractData(contractId)
            }

            // Load existing provider bids for this session
            await loadExistingBids(sessionId)

            setLoading(false)
        }

        initializePage()
    }, [searchParams, router])

    const loadSessionData = async (sessionId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-session?session_id=${sessionId}`)
            if (response.ok) {
                const data = await response.json()
                setSession({
                    sessionId,
                    sessionNumber: data.session_number || data.sessionNumber || '',
                    customerCompany: data.customer_company || data.customerCompany || '',
                    mediationType: data.mediation_type || data.mediationType || 'full_mediation',
                    contractType: data.contract_type || data.contractType || '',
                    templateSource: data.template_source || data.templateSource || '',
                    status: data.status || 'initiated'
                })

                // Extract deal context if available
                // Note: Full quick intake data requires adding deal_context column to sessions table
                // For now, use dealValue from customer_requirements
                if (data.deal_context || data.dealContext) {
                    const ctx = data.deal_context || data.dealContext
                    setDealContext({
                        dealValue: ctx.deal_value || ctx.dealValue || null,
                        serviceCriticality: ctx.service_criticality || ctx.serviceCriticality || null,
                        timelinePressure: ctx.timeline_pressure || ctx.timelinePressure || null,
                        bidderCount: ctx.bidder_count || ctx.bidderCount || null,
                        batnaStatus: ctx.batna_status || ctx.batnaStatus || null,
                        topPriorities: ctx.top_priorities || ctx.topPriorities || []
                    })
                } else if (data.dealValue || data.deal_value) {
                    // Fallback: use dealValue from customer_requirements
                    setDealContext({
                        dealValue: data.dealValue || data.deal_value || null,
                        serviceCriticality: null,
                        timelinePressure: null,
                        bidderCount: null,
                        batnaStatus: null,
                        topPriorities: []
                    })
                }
            } else {
                setError('Failed to load session data')
            }
        } catch (err) {
            console.error('Error loading session:', err)
            setError('Failed to load session data')
        }
    }

    const loadContractData = async (contractId: string) => {
        try {
            const response = await fetch(`/api/contracts/${contractId}`)
            if (response.ok) {
                const data = await response.json()
                const contractData = data.contract || data
                setContract({
                    contractId: contractData.contract_id || contractData.contractId || contractId,
                    contractName: contractData.contract_name || contractData.contractName || 'Unnamed Contract',
                    clauseCount: contractData.clause_count || contractData.clauseCount || 0,
                    status: contractData.status || 'ready'
                })
            }
        } catch (err) {
            console.error('Error loading contract:', err)
            // Non-fatal - continue without contract data
        }
    }

    const loadExistingBids = async (sessionId: string) => {
        try {
            const response = await fetch(`${API_BASE}/get-session-providers?session_id=${sessionId}`)
            if (response.ok) {
                const data = await response.json()
                if (data.providers && Array.isArray(data.providers)) {
                    setExistingBids(data.providers)
                }
            }
        } catch (err) {
            console.error('Error loading existing bids:', err)
            // Non-fatal - continue without existing bids
        }
    }

    // ========================================================================
    // SECTION 7: PROVIDER MANAGEMENT
    // ========================================================================

    const addProvider = () => {
        if (!newProvider.companyName || !newProvider.contactEmail) {
            alert('Please enter at least company name and email')
            return
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(newProvider.contactEmail)) {
            alert('Please enter a valid email address')
            return
        }

        // Check for duplicate email in new providers
        if (providers.some(p => p.contactEmail.toLowerCase() === newProvider.contactEmail.toLowerCase())) {
            alert('This email has already been added')
            return
        }

        // Check for duplicate in existing bids
        if (existingBids.some(b => b.provider_contact_email?.toLowerCase() === newProvider.contactEmail.toLowerCase())) {
            alert('This provider has already been invited to this session')
            return
        }

        const provider: ProviderInvite = {
            id: Date.now().toString(),
            companyName: newProvider.companyName,
            contactName: newProvider.contactName || newProvider.companyName,
            contactEmail: newProvider.contactEmail,
            status: 'pending'
        }

        setProviders(prev => [...prev, provider])
        setNewProvider({ companyName: '', contactName: '', contactEmail: '' })
    }

    const removeProvider = (id: string) => {
        if (window.confirm('Remove this provider from the invite list?')) {
            setProviders(prev => prev.filter(p => p.id !== id))
        }
    }

    const resetProviderStatus = (id: string) => {
        setProviders(prev => prev.map(p =>
            p.id === id ? { ...p, status: 'pending' as const, errorMessage: undefined } : p
        ))
    }

    // ========================================================================
    // SECTION 8: SEND INVITATIONS
    // ========================================================================

    const sendInvitations = async () => {
        const pendingProviders = providers.filter(p => p.status === 'pending')

        if (pendingProviders.length === 0) {
            alert('No pending invitations to send')
            return
        }

        if (!session?.sessionId || !userInfo) return

        setIsSubmitting(true)
        setError(null)

        let successCount = 0
        let failCount = 0

        for (const provider of pendingProviders) {
            // Update status to sending
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'sending' as const } : p
            ))

            try {
                const response = await fetch(`${API_BASE}/invite-provider`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: session.sessionId,
                        session_number: session.sessionNumber,
                        customer_company: session.customerCompany || userInfo.company,
                        mediation_type: session.mediationType,
                        contract_type: session.contractType,
                        contract_id: contract?.contractId || null,
                        contract_name: contract?.contractName || null,
                        clause_count: contract?.clauseCount || null,
                        deal_value: dealContext?.dealValue || null,
                        invited_by_user_id: userInfo.userId,
                        provider: {
                            company_name: provider.companyName,
                            contact_name: provider.contactName,
                            contact_email: provider.contactEmail
                        }
                    })
                })

                if (response.ok) {
                    setProviders(prev => prev.map(p =>
                        p.id === provider.id ? { ...p, status: 'sent' as const } : p
                    ))
                    successCount++
                } else {
                    const errorData = await response.json().catch(() => ({}))
                    setProviders(prev => prev.map(p =>
                        p.id === provider.id ? {
                            ...p,
                            status: 'error' as const,
                            errorMessage: errorData.message || errorData.error || 'Failed to send'
                        } : p
                    ))
                    failCount++
                }
            } catch (err) {
                console.error('Error sending invitation:', err)
                setProviders(prev => prev.map(p =>
                    p.id === provider.id ? { ...p, status: 'error' as const, errorMessage: 'Network error' } : p
                ))
                failCount++
            }

            // Small delay between sends
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        setIsSubmitting(false)

        // Check if at least one was sent successfully
        const anySuccessful = providers.some(p => p.status === 'sent')
        if (anySuccessful) {
            setAllSent(true)
            // Reload existing bids to show the newly invited providers
            await loadExistingBids(session.sessionId)
        }

        // Show summary
        if (failCount > 0 && successCount > 0) {
            alert(`${successCount} invitation(s) sent successfully. ${failCount} failed - you can retry or remove them.`)
        } else if (failCount > 0 && successCount === 0) {
            alert(`Failed to send invitations. Please check the errors and retry.`)
        } else if (successCount > 0) {
            // All successful - no alert needed, UI shows status
        }
    }

    const proceedToDashboard = () => {
        router.push(`/auth/contracts-dashboard`)
    }

    // ========================================================================
    // SECTION 9: LOADING STATE
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading session details...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 10: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================ */}
            {/* SECTION 11: NAVIGATION */}
            {/* ================================================================ */}
            <nav className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/auth/contracts-dashboard" className="flex items-center">
                                <div>
                                    <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                                    <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                                </div>
                            </Link>
                            <span className="ml-4 text-slate-400">|</span>
                            <span className="ml-4 text-slate-600 text-sm font-medium">Invite Providers</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {session?.sessionNumber && (
                                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-mono">
                                    {session.sessionNumber}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Session Banner */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white py-3">
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-slate-400 text-xs">Mediation Type</span>
                            <div className="text-sm font-medium">
                                {MEDIATION_LABELS[session?.mediationType || ''] || session?.mediationType}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 text-xs">Contract Type</span>
                            <div className="text-sm">
                                {CONTRACT_TYPE_LABELS[session?.contractType || ''] || session?.contractType || '—'}
                            </div>
                        </div>
                        {contract && (
                            <div>
                                <span className="text-slate-400 text-xs">Clauses</span>
                                <div className="text-sm">{contract.clauseCount} clauses prepared</div>
                            </div>
                        )}
                        <div>
                            <span className="text-slate-400 text-xs">Status</span>
                            <div className="text-sm">
                                <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-xs">
                                    Ready to Invite
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 12: MAIN CONTENT */}
            {/* ================================================================ */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                )}

                {/* Contract Summary Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-medium text-slate-800 mb-4">Contract Summary</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Customer</span>
                            <div className="text-sm font-medium text-slate-800">
                                {session?.customerCompany || userInfo?.company || '—'}
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Contract</span>
                            <div className="text-sm font-medium text-slate-800">
                                {contract?.contractName || CONTRACT_TYPE_LABELS[session?.contractType || ''] || '—'}
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Clauses Prepared</span>
                            <div className="text-sm font-medium text-slate-800">
                                {contract?.clauseCount || '—'}
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Deal Value</span>
                            <div className="text-sm font-medium text-slate-800">
                                {dealContext?.dealValue ? DEAL_VALUE_LABELS[dealContext.dealValue] : '—'}
                            </div>
                        </div>
                    </div>

                    {/* Deal Context - Top Priorities */}
                    {dealContext?.topPriorities && dealContext.topPriorities.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <span className="text-xs text-slate-500">Your Priorities</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {dealContext.topPriorities.map((priority, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                                        {priority}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Existing Invited Providers */}
                {existingBids.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-medium text-slate-800 mb-4">Already Invited</h2>
                        <div className="space-y-3">
                            {existingBids.map((bid, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                                            {(bid.provider_company || bid.providerCompany || 'P').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-800">
                                                {bid.provider_company || bid.providerCompany}
                                            </div>
                                            <div className="text-sm text-slate-500">
                                                {bid.provider_contact_email || bid.providerContactEmail}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${bid.status === 'submitted' || bid.intake_complete
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {bid.status === 'submitted' || bid.intake_complete ? 'Submitted' : 'Awaiting Response'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Provider Form */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-medium text-slate-800 mb-4">
                        {existingBids.length > 0 ? 'Invite More Providers' : 'Add Providers to Invite'}
                    </h2>
                    <p className="text-sm text-slate-600 mb-4">
                        Enter the details of providers you want to invite. They will receive an email
                        with instructions to review the contract and submit their positions.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Company Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Provider Corp"
                                value={newProvider.companyName}
                                onChange={(e) => setNewProvider(prev => ({ ...prev, companyName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Contact Name
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="John Smith"
                                value={newProvider.contactName}
                                onChange={(e) => setNewProvider(prev => ({ ...prev, contactName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="john@provider.com"
                                value={newProvider.contactEmail}
                                onChange={(e) => setNewProvider(prev => ({ ...prev, contactEmail: e.target.value }))}
                                onKeyPress={(e) => e.key === 'Enter' && addProvider()}
                            />
                        </div>
                    </div>

                    <button
                        onClick={addProvider}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
                    >
                        + Add Provider
                    </button>
                </div>

                {/* Provider List - New Invites */}
                {providers.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-medium text-slate-800">New Invitations</h2>
                            <span className="text-sm text-slate-500">
                                {providers.length} provider{providers.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className={`flex items-center justify-between p-4 rounded-lg border ${provider.status === 'sent'
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : provider.status === 'error'
                                                ? 'bg-red-50 border-red-200'
                                                : provider.status === 'sending'
                                                    ? 'bg-blue-50 border-blue-200'
                                                    : 'bg-slate-50 border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${provider.status === 'sent'
                                                ? 'bg-emerald-500'
                                                : provider.status === 'error'
                                                    ? 'bg-red-500'
                                                    : provider.status === 'sending'
                                                        ? 'bg-blue-500'
                                                        : 'bg-slate-400'
                                            }`}>
                                            {provider.status === 'sent' ? '✓' :
                                                provider.status === 'error' ? '!' :
                                                    provider.status === 'sending' ? '...' :
                                                        provider.companyName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-800">{provider.companyName}</div>
                                            <div className="text-sm text-slate-500">
                                                {provider.contactName} • {provider.contactEmail}
                                            </div>
                                            {provider.errorMessage && (
                                                <div className="text-xs text-red-600 mt-1">{provider.errorMessage}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-1 rounded ${provider.status === 'sent'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : provider.status === 'error'
                                                    ? 'bg-red-100 text-red-700'
                                                    : provider.status === 'sending'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {provider.status === 'sent' ? 'Invitation Sent' :
                                                provider.status === 'error' ? 'Failed' :
                                                    provider.status === 'sending' ? 'Sending...' :
                                                        'Ready to Send'}
                                        </span>

                                        {/* Action buttons */}
                                        {provider.status === 'pending' && (
                                            <button
                                                onClick={() => removeProvider(provider.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                title="Remove"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}

                                        {provider.status === 'error' && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => resetProviderStatus(provider.id)}
                                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all"
                                                    title="Retry"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => removeProvider(provider.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                    title="Remove"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}

                                        {provider.status === 'sent' && (
                                            <span className="text-emerald-500">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State - No providers yet */}
                {providers.length === 0 && existingBids.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-6 text-center">
                        <div className="text-4xl mb-3">📧</div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">No providers added yet</h3>
                        <p className="text-sm text-slate-500">
                            Add providers using the form above to send them invitations
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-3 text-slate-600 hover:text-slate-800 transition-all"
                    >
                        ← Back
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Show "Continue" button once any invitations have been sent */}
                        {(allSent || existingBids.length > 0) && (
                            <button
                                onClick={proceedToDashboard}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 font-medium transition-all"
                            >
                                Continue to Dashboard →
                            </button>
                        )}

                        {/* Always show send button if there are pending providers */}
                        {providers.some(p => p.status === 'pending') && (
                            <button
                                onClick={sendInvitations}
                                disabled={isSubmitting}
                                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send {providers.filter(p => p.status === 'pending').length} Invitation{providers.filter(p => p.status === 'pending').length !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Help Text */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">What happens next?</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Each provider will receive an email invitation with a unique link</li>
                        <li>• They&apos;ll review the contract clauses and set their positions</li>
                        <li>• CLARENCE will analyze both parties and identify gaps</li>
                        <li>• Once a provider submits, you&apos;ll be notified and can begin negotiation</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}