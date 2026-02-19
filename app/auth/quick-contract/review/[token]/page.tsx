'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// PROVIDER LOBBY - /auth/quick-contract/review/[token]/page.tsx
// ============================================================================
// This page serves as the transitional lobby for providers arriving via
// invite email. It validates their access token, shows the contract summary,
// explains the CLARENCE mediation process, and routes them into the QC Studio.
//
// Replaces the original QC Review page (911 lines, 3-panel clause reviewer)
// with a focused lobby experience per Decision 1 (19 Feb 2026).
//
// Data flow:
//   Email link → /auth/quick-contract/review/[token]
//   Token validates against qc_recipients table
//   Lobby shows contract card + process explainer
//   "Enter Studio" routes to /auth/quick-contract/studio/[contractId]
//
// States: loading | error | declined | lobby (with accepted variant)
// ============================================================================


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

interface ContractSummary {
    contractId: string
    quickContractId: string
    contractName: string
    contractType: string
    description: string | null
    status: string
    clauseCount: number
    certifiedCount: number
    senderName: string | null
    senderCompany: string | null
    createdAt: string | null
}


// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const supabase = createClient()

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    nda: 'Non-Disclosure Agreement',
    service_agreement: 'Service Agreement',
    lease: 'Lease Agreement',
    employment: 'Employment Contract',
    contractor: 'Contractor Agreement',
    vendor: 'Vendor Agreement',
    partnership: 'Partnership Agreement',
    licensing: 'Licensing Agreement',
    consulting: 'Consulting Agreement',
    supply: 'Supply Agreement',
    other: 'Contract'
}

const PROCESS_STEPS = [
    {
        number: '1',
        title: 'Review the Contract',
        description: 'Browse each clause and see CLARENCE\'s independent assessment of the contractual position. Every clause has been certified and scored on a 1-10 scale.'
    },
    {
        number: '2',
        title: 'Set Your Positions',
        description: 'For each clause, indicate where you\'d like the terms to land. Your positions are private to you until you choose to share them.'
    },
    {
        number: '3',
        title: 'Negotiate via Party Chat',
        description: 'Discuss specific clauses with the other party through the built-in chat. CLARENCE remains available to explain terms or suggest compromises.'
    },
    {
        number: '4',
        title: 'Agree & Commit',
        description: 'Once both parties are aligned, commit the contract. CLARENCE generates the final documentation package for both sides.'
    }
]


// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function LobbyLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-violet-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-violet-600">C</span>
                    </div>
                </div>
                <h2 className="text-xl font-semibold text-slate-700">Verifying Access...</h2>
                <p className="text-slate-500 mt-2">Preparing your contract lobby</p>
            </div>
        </div>
    )
}


// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

function ProviderLobbyContent() {
    const params = useParams()
    const router = useRouter()
    const accessToken = params?.token as string


    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [recipient, setRecipient] = useState<Recipient | null>(null)
    const [contract, setContract] = useState<ContractSummary | null>(null)

    // Response flow
    const [showDeclineModal, setShowDeclineModal] = useState(false)
    const [declineReason, setDeclineReason] = useState('')
    const [responding, setResponding] = useState(false)
    const [hasDeclined, setHasDeclined] = useState(false)


    // ========================================================================
    // SECTION 4B: DATA LOADING
    // ========================================================================

    useEffect(() => {
        async function loadLobbyData() {
            if (!accessToken) {
                setError('Invalid access link. Please check the URL from your invitation email.')
                setLoading(false)
                return
            }

            try {
                // Step 1: Validate token and load recipient + quick_contract
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
                        access_token_expires_at,
                        quick_contracts (
                            quick_contract_id,
                            contract_name,
                            contract_type,
                            description,
                            status,
                            source_contract_id,
                            created_by_user_id,
                            company_id,
                            created_at
                        )
                    `)
                    .eq('access_token', accessToken)
                    .single()

                if (recipientError || !recipientData) {
                    console.error('Recipient lookup error:', recipientError)
                    setError('This contract link is invalid or has expired. Please contact the sender for a new invitation.')
                    setLoading(false)
                    return
                }

                // Check token expiry
                if (recipientData.access_token_expires_at) {
                    const expiresAt = new Date(recipientData.access_token_expires_at)
                    if (expiresAt < new Date()) {
                        setError('This invitation link has expired. Please contact the sender for a new invitation.')
                        setLoading(false)
                        return
                    }
                }

                // Check if already declined
                if (recipientData.status === 'declined') {
                    setHasDeclined(true)
                }

                const qc = recipientData.quick_contracts as any

                // Step 2: Set recipient info
                setRecipient({
                    recipientId: recipientData.recipient_id,
                    recipientName: recipientData.recipient_name,
                    recipientEmail: recipientData.recipient_email,
                    recipientCompany: recipientData.recipient_company,
                    status: recipientData.status,
                    quickContractId: recipientData.quick_contract_id
                })

                // Step 3: Load sender details
                let senderName: string | null = null
                let senderCompany: string | null = null

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

                // Step 4: Get clause stats (count + certified count only, no full clause load)
                let clauseCount = 0
                let certifiedCount = 0

                if (qc.source_contract_id) {
                    const { data: clauseStats, error: clauseError } = await supabase
                        .from('uploaded_contract_clauses')
                        .select('clause_id, clarence_certified, is_header')
                        .eq('contract_id', qc.source_contract_id)

                    if (!clauseError && clauseStats) {
                        const leafClauses = clauseStats.filter(c => !c.is_header)
                        clauseCount = leafClauses.length
                        certifiedCount = leafClauses.filter(c => c.clarence_certified).length
                    }
                }

                // Step 5: Set contract summary
                setContract({
                    contractId: qc.source_contract_id || qc.quick_contract_id,
                    quickContractId: qc.quick_contract_id,
                    contractName: qc.contract_name,
                    contractType: qc.contract_type || 'other',
                    description: qc.description,
                    status: qc.status,
                    clauseCount,
                    certifiedCount,
                    senderName,
                    senderCompany,
                    createdAt: qc.created_at
                })

                // Step 6: Track view (non-blocking)
                const updates: Record<string, any> = {
                    view_count: (recipientData.view_count || 0) + 1,
                    last_viewed_at: new Date().toISOString()
                }

                if (!recipientData.first_viewed_at) {
                    updates.first_viewed_at = new Date().toISOString()
                    if (recipientData.status === 'invited') {
                        updates.status = 'viewed'
                    }
                }

                await supabase
                    .from('qc_recipients')
                    .update(updates)
                    .eq('recipient_id', recipientData.recipient_id)

                setLoading(false)

            } catch (err) {
                console.error('Lobby load error:', err)
                setError('An unexpected error occurred. Please try refreshing the page.')
                setLoading(false)
            }
        }

        loadLobbyData()
    }, [accessToken])


    // ========================================================================
    // SECTION 4C: HANDLERS
    // ========================================================================

    const handleEnterStudio = () => {
        if (!contract) return

        // Mark as accepted if not already
        if (recipient && recipient.status !== 'accepted') {
            supabase
                .from('qc_recipients')
                .update({
                    status: 'accepted',
                    responded_at: new Date().toISOString(),
                    response_type: 'accepted'
                })
                .eq('recipient_id', recipient.recipientId)
                .then(() => {
                    console.log('Recipient status updated to accepted')
                })
        }

        // Navigate to QC Studio
        router.push(`/auth/quick-contract/studio/${contract.contractId}`)
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
            setHasDeclined(true)
        } catch (err) {
            console.error('Decline error:', err)
            setError('Failed to decline. Please try again.')
        } finally {
            setResponding(false)
        }
    }


    // ========================================================================
    // SECTION 4D: HELPERS
    // ========================================================================

    const getContractTypeLabel = (type: string): string => {
        return CONTRACT_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
    }

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    const getSenderInitial = (): string => {
        if (contract?.senderName) return contract.senderName.charAt(0).toUpperCase()
        if (contract?.senderCompany) return contract.senderCompany.charAt(0).toUpperCase()
        return 'S'
    }


    // ========================================================================
    // SECTION 5: LOADING STATE
    // ========================================================================

    if (loading) {
        return <LobbyLoading />
    }


    // ========================================================================
    // SECTION 6: ERROR STATE
    // ========================================================================

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Access Contract</h2>
                    <p className="text-slate-600 text-sm leading-relaxed">{error}</p>
                </div>
            </div>
        )
    }


    // ========================================================================
    // SECTION 7: DECLINED STATE
    // ========================================================================

    if (hasDeclined) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Contract Declined</h2>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">
                        You have declined &ldquo;{contract?.contractName}&rdquo;.
                        {contract?.senderName && ` ${contract.senderName} has been notified.`}
                    </p>
                    <p className="text-xs text-slate-400">You can close this window.</p>
                </div>
            </div>
        )
    }


    // ========================================================================
    // SECTION 8: MAIN LOBBY LAYOUT
    // ========================================================================

    const hasAlreadyEntered = recipient?.status === 'accepted'

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ============================================================ */}
            {/* SECTION 8A: HEADER                                           */}
            {/* ============================================================ */}

            <header className="bg-slate-800 text-white">
                <div className="max-w-4xl mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center shadow-md">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">The Honest Broker</div>
                            </div>
                        </div>
                    </nav>
                </div>
            </header>


            {/* ============================================================ */}
            {/* SECTION 8B: WELCOME BANNER                                   */}
            {/* ============================================================ */}

            <div className="bg-gradient-to-b from-slate-800 to-slate-700 text-white pb-16 pt-8">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <p className="text-violet-300 text-sm font-medium mb-2">Contract Invitation</p>
                    <h1 className="text-2xl font-bold mb-2">
                        {recipient?.recipientName
                            ? `Welcome, ${recipient.recipientName.split(' ')[0]}`
                            : 'Welcome'
                        }
                    </h1>
                    <p className="text-slate-300 text-sm max-w-lg mx-auto">
                        {contract?.senderName
                            ? `${contract.senderName}${contract.senderCompany ? ` from ${contract.senderCompany}` : ''} has invited you to review and negotiate a contract through CLARENCE.`
                            : 'You have been invited to review and negotiate a contract through CLARENCE.'
                        }
                    </p>
                </div>
            </div>


            {/* ============================================================ */}
            {/* SECTION 8C: CONTRACT CARD (overlaps banner)                  */}
            {/* ============================================================ */}

            <div className="max-w-4xl mx-auto px-6 -mt-10">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

                    {/* Contract Header */}
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex items-start gap-4">

                            {/* Sender Avatar */}
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                <span className="text-white font-bold text-lg">{getSenderInitial()}</span>
                            </div>

                            {/* Contract Details */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-semibold text-slate-800 leading-snug">
                                    {contract?.contractName}
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {getContractTypeLabel(contract?.contractType || 'other')}
                                </p>
                            </div>

                            {/* Status Badge */}
                            <div className="flex-shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                                    Awaiting Your Review
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Contract Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                        <div className="p-4 text-center">
                            <p className="text-2xl font-bold text-slate-800">{contract?.clauseCount || 0}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Clauses</p>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-2xl font-bold text-violet-600">{contract?.certifiedCount || 0}</p>
                            <p className="text-xs text-slate-500 mt-0.5">CLARENCE Certified</p>
                        </div>
                        <div className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                                <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-slate-600">{getSenderInitial()}</span>
                                </div>
                                <p className="text-sm font-medium text-slate-700 truncate">
                                    {contract?.senderName || 'Sender'}
                                </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Sent By</p>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-sm font-medium text-slate-700">
                                {contract?.createdAt ? formatDate(contract.createdAt) : 'Recently'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">Date Sent</p>
                        </div>
                    </div>

                    {/* Description (if present) */}
                    {contract?.description && (
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <p className="text-sm text-slate-600 leading-relaxed">{contract.description}</p>
                        </div>
                    )}

                    {/* CTA Section */}
                    <div className="p-6 bg-gradient-to-b from-white to-slate-50">
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <button
                                onClick={handleEnterStudio}
                                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                {hasAlreadyEntered ? 'Continue to Studio' : 'Enter Negotiation Studio'}
                            </button>
                            <button
                                onClick={() => setShowDeclineModal(true)}
                                className="w-full sm:w-auto px-6 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
                            >
                                Decline Invitation
                            </button>
                        </div>
                        {hasAlreadyEntered && (
                            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                You have previously accepted this invitation
                            </p>
                        )}
                    </div>
                </div>
            </div>


            {/* ============================================================ */}
            {/* SECTION 8D: PROCESS EXPLAINER                                */}
            {/* ============================================================ */}

            <div className="max-w-4xl mx-auto px-6 mt-8 mb-12">
                <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-slate-800">How CLARENCE Mediation Works</h3>
                    <p className="text-sm text-slate-500 mt-1">A transparent, data-driven approach to contract negotiation</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PROCESS_STEPS.map((step) => (
                        <div
                            key={step.number}
                            className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4"
                        >
                            <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-violet-600">{step.number}</span>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 mb-1">{step.title}</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Trust Footer */}
                <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
                        <div className="w-5 h-5 bg-gradient-to-br from-violet-500 to-violet-700 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-xs">C</span>
                        </div>
                        <span className="text-xs text-slate-600">
                            CLARENCE acts as a neutral mediator. Neither party receives preferential treatment.
                        </span>
                    </div>
                </div>
            </div>


            {/* ============================================================ */}
            {/* SECTION 9: DECLINE MODAL                                     */}
            {/* ============================================================ */}

            {showDeclineModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Decline Contract</h3>
                                <p className="text-sm text-slate-500">This will notify the sender</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 mb-4">
                            Are you sure you want to decline &ldquo;{contract?.contractName}&rdquo;?
                            You can optionally provide a reason for the sender.
                        </p>

                        <textarea
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Reason for declining (optional)"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm mb-4 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeclineModal(false)}
                                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDecline}
                                disabled={responding}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                {responding ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Processing...
                                    </>
                                ) : (
                                    'Decline Contract'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


// ============================================================================
// SECTION 10: EXPORT
// ============================================================================

export default function ProviderLobbyPage() {
    return (
        <Suspense fallback={<LobbyLoading />}>
            <ProviderLobbyContent />
        </Suspense>
    )
}