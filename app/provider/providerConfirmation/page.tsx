'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface ProviderSession {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    contractType: string
    dealValue: string
    bidStatus: string
    intakeComplete: boolean
    questionnaireComplete: boolean
    invitedAt: string
    providerId: string
    mediationType?: string
}

// ============================================================================
// SECTION 3: SHARED HEADER COMPONENT
// ============================================================================

function ProviderHeader() {
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    <Link href="/provider/providerConfirmation" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">Provider Portal</div>
                        </div>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/auth/login"
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Customer Portal &rarr;
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    )
}

// ============================================================================
// SECTION 4: SHARED FOOTER COMPONENT
// ============================================================================

function ProviderFooter() {
    return (
        <footer className="bg-slate-900 text-slate-400 py-8">
            <div className="container mx-auto px-6">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center gap-3 mb-4 md:mb-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <span className="text-white font-medium">CLARENCE</span>
                        <span className="text-slate-500 text-sm">Provider Portal</span>
                    </div>
                    <div className="text-sm">
                        &copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.
                    </div>
                </div>
            </div>
        </footer>
    )
}

// ============================================================================
// SECTION 5: STATUS HELPERS
// ============================================================================

function getStatusConfig(session: ProviderSession): {
    colour: string
    bgColour: string
    badge: string
    actionLabel: string
    actionRoute: string | null
    actionDisabled: boolean
    description: string
} {
    const { bidStatus, intakeComplete, questionnaireComplete, sessionId, providerId, mediationType } = session
    const isCoCreate = mediationType === 'co_create'
    const studioRoute = isCoCreate
        ? `/auth/co-create-studio?session_id=${sessionId}&provider_id=${providerId}`
        : `/auth/contract-studio?session_id=${sessionId}&provider_id=${providerId}`
    const studioLabel = isCoCreate ? 'Enter Co-Create Studio' : 'Enter Contract Studio'

    // Questionnaire complete - awaiting CLARENCE calculation
    // Only show this if status is EXACTLY questionnaire_complete — not if already ready/active
    if (
        (questionnaireComplete || bidStatus === 'questionnaire_complete') &&
        bidStatus !== 'ready' && bidStatus !== 'active' && bidStatus !== 'negotiation_active'
    ) {
        return {
            colour: 'text-amber-600',
            bgColour: 'bg-amber-50 border-amber-200',
            badge: 'Calculating',
            actionLabel: 'Awaiting Activation',
            actionRoute: null,
            actionDisabled: true,
            description: 'CLARENCE is analysing both parties to calculate leverage positions. You will be notified when the studio is ready.'
        }
    }

    // Ready or active - can enter studio
    if (bidStatus === 'ready' || bidStatus === 'active' || bidStatus === 'negotiation_active') {
        return {
            colour: 'text-emerald-600',
            bgColour: 'bg-emerald-50 border-emerald-200',
            badge: 'Ready',
            actionLabel: studioLabel,
            actionRoute: studioRoute,
            actionDisabled: false,
            description: 'Both parties have completed their assessments. The studio is ready.'
        }
    }

    // Intake complete - needs questionnaire
    if (intakeComplete || bidStatus === 'intake_complete') {
        return {
            colour: 'text-blue-600',
            bgColour: 'bg-blue-50 border-blue-200',
            badge: 'In Progress',
            actionLabel: 'Complete Assessment',
            actionRoute: `/provider/questionnaire?session_id=${sessionId}&provider_id=${providerId}`,
            actionDisabled: false,
            description: 'Your company details have been submitted. Complete the strategic assessment to proceed.'
        }
    }

    // Registered but no intake yet
    if (bidStatus === 'registered') {
        return {
            colour: 'text-blue-600',
            bgColour: 'bg-blue-50 border-blue-200',
            badge: 'In Progress',
            actionLabel: 'Continue Intake',
            actionRoute: `/provider/intake?session_id=${sessionId}&provider_id=${providerId}`,
            actionDisabled: false,
            description: 'Continue completing your company information and capabilities.'
        }
    }

    // Completed
    if (bidStatus === 'completed' || bidStatus === 'agreed') {
        return {
            colour: 'text-slate-500',
            bgColour: 'bg-slate-50 border-slate-200',
            badge: 'Complete',
            actionLabel: 'View Summary',
            actionRoute: `/auth/contract-studio?session_id=${sessionId}&provider_id=${providerId}`,
            actionDisabled: false,
            description: 'This negotiation has been completed.'
        }
    }

    // Default: invited but not started
    return {
        colour: 'text-purple-600',
        bgColour: 'bg-purple-50 border-purple-200',
        badge: 'Invited',
        actionLabel: 'Begin Onboarding',
        actionRoute: `/provider/welcome?session_id=${sessionId}&provider_id=${providerId}`,
        actionDisabled: false,
        description: 'You have been invited to negotiate. Begin onboarding to review the opportunity.'
    }
}

function formatTimeAgo(dateString: string): string {
    if (!dateString) return ''
    try {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
        return ''
    }
}

// ============================================================================
// SECTION 6: CONTRACT CARD COMPONENT
// ============================================================================

function ContractCard({ session }: { session: ProviderSession }) {
    const router = useRouter()
    const status = getStatusConfig(session)

    return (
        <div className={`rounded-xl border-2 ${status.bgColour} p-6 transition-all hover:shadow-md`}>
            {/* Card Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">
                        {session.customerCompany || 'Customer'}
                    </h3>
                    <p className="text-sm text-slate-500">
                        {session.contractType || 'Service Agreement'}
                        {session.sessionNumber && (
                            <span className="ml-2 text-slate-400">&middot; {session.sessionNumber}</span>
                        )}
                    </p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${status.colour} ${status.bgColour}`}>
                    <span className={`w-2 h-2 rounded-full mr-1.5 ${status.badge === 'Ready' ? 'bg-emerald-500' :
                            status.badge === 'Calculating' ? 'bg-amber-500 animate-pulse' :
                                status.badge === 'In Progress' ? 'bg-blue-500' :
                                    status.badge === 'Complete' ? 'bg-slate-400' :
                                        'bg-purple-500'
                        }`}></span>
                    {status.badge}
                </span>
            </div>

            {/* Status Description */}
            <p className="text-sm text-slate-600 mb-4">{status.description}</p>

            {/* Card Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
                {session.invitedAt && (
                    <span className="text-xs text-slate-400">
                        Invited {formatTimeAgo(session.invitedAt)}
                    </span>
                )}

                {status.actionRoute ? (
                    <button
                        onClick={() => {
                            eventLogger.completed('provider_lobby', 'contract_card_action_clicked', {
                                sessionId: session.sessionId,
                                providerId: session.providerId,
                                bidStatus: session.bidStatus,
                                action: status.actionLabel
                            })
                            router.push(status.actionRoute!)
                        }}
                        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {status.actionLabel} &rarr;
                    </button>
                ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 text-sm font-medium rounded-lg">
                        <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                        {status.actionLabel}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 7: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function ProviderConfirmationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading Provider Portal...</p>
                    </div>
                </main>
                <ProviderFooter />
            </div>
        }>
            <ProviderLobbyContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 8: MAIN LOBBY CONTENT
// ============================================================================

function ProviderLobbyContent() {
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 8A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [sessions, setSessions] = useState<ProviderSession[]>([])
    const [isFirstArrival, setIsFirstArrival] = useState(false)
    const [providerName, setProviderName] = useState<string>('')
    const [providerCompany, setProviderCompany] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [isPolling, setIsPolling] = useState(false)

    // ========================================================================
    // SECTION 8B: INITIALIZATION
    // ========================================================================

    useEffect(() => {
        const initialize = async () => {
            const sessionId = searchParams.get('session_id')
            const providerId = searchParams.get('provider_id')

            // Load provider info from localStorage
            const stored = localStorage.getItem('clarence_provider_session')
            let storedProviderId = providerId || ''
            let storedEmail = ''

            if (stored) {
                try {
                    const parsed = JSON.parse(stored)
                    storedProviderId = storedProviderId || parsed.providerId || ''
                    storedEmail = parsed.contactEmail || parsed.email || ''
                    setProviderName(parsed.contactName || parsed.providerContact || '')
                    setProviderCompany(parsed.companyName || parsed.providerCompany || '')
                } catch (e) {
                    console.error('Error parsing stored provider session:', e)
                }
            }

            // Determine page mode
            if (sessionId && providerId) {
                // FIRST ARRIVAL: came from questionnaire with specific session
                setIsFirstArrival(true)

                // Set session context for event logging
                eventLogger.setSession(sessionId)
                eventLogger.completed('provider_lobby', 'provider_lobby_loaded', {
                    sessionId,
                    providerId,
                    mode: 'first_arrival'
                })

                // Fetch this specific session's data
                try {
                    const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}&provider_id=${providerId}`)
                    if (response.ok) {
                        const data = await response.json()
                        const bidStatus = data.bid?.bidStatus || data.bid?.status || data.bidStatus || data.bid_status || 'questionnaire_complete'
                        const sessionData: ProviderSession = {
                            sessionId,
                            sessionNumber: data.session?.sessionNumber || data.sessionNumber || data.session_number || '',
                            customerCompany: data.session?.customerCompany || data.customerCompany || data.customer_company || 'Customer',
                            contractType: data.session?.contractType || data.contractType || data.contract_type || 'Service Agreement',
                            dealValue: data.session?.dealValue || data.dealValue || data.deal_value || '',
                            bidStatus,
                            intakeComplete: true,
                            questionnaireComplete: true,
                            invitedAt: '',
                            providerId,
                            mediationType: data.session?.mediationType || data.mediationType || data.mediation_type || ''
                        }
                        setSessions([sessionData])
                        // Start polling if still awaiting activation
                        if (bidStatus === 'questionnaire_complete') {
                            setIsPolling(true)
                        }
                    } else {
                        setSessions([{
                            sessionId, sessionNumber: '', customerCompany: 'Customer',
                            contractType: 'Service Agreement', dealValue: '',
                            bidStatus: 'questionnaire_complete', intakeComplete: true,
                            questionnaireComplete: true, invitedAt: '', providerId
                        }])
                        setIsPolling(true)
                    }
                } catch (err) {
                    console.error('Failed to load session data:', err)
                    setSessions([{
                        sessionId, sessionNumber: '', customerCompany: 'Customer',
                        contractType: 'Service Agreement', dealValue: '',
                        bidStatus: 'questionnaire_complete', intakeComplete: true,
                        questionnaireComplete: true, invitedAt: '', providerId
                    }])
                    setIsPolling(true)
                }
            } else {
                // RETURN VISIT: provider logged in, fetch all their sessions
                setIsFirstArrival(false)

                eventLogger.completed('provider_lobby', 'provider_lobby_loaded', {
                    providerId: storedProviderId,
                    mode: 'return_visit'
                })

                if (storedProviderId || storedEmail) {
                    try {
                        const params = new URLSearchParams()
                        if (storedProviderId) params.set('provider_id', storedProviderId)
                        if (storedEmail) params.set('email', storedEmail)

                        const response = await fetch(`${API_BASE}/provider-sessions-api?${params.toString()}`)
                        if (response.ok) {
                            const data = await response.json()
                            const sessionsList = Array.isArray(data) ? data : (data.sessions || [])

                            const mapped: ProviderSession[] = sessionsList.map((s: any) => ({
                                sessionId: s.session_id || s.sessionId || '',
                                sessionNumber: s.session_number || s.sessionNumber || '',
                                customerCompany: s.customer_company || s.customerCompany || 'Customer',
                                contractType: s.contract_type || s.contractType || 'Service Agreement',
                                dealValue: s.deal_value || s.dealValue || '',
                                bidStatus: s.bid_status || s.bidStatus || s.status || 'invited',
                                intakeComplete: s.intake_complete || s.intakeComplete || false,
                                questionnaireComplete: s.questionnaire_complete || s.questionnaireComplete || false,
                                invitedAt: s.invited_at || s.invitedAt || '',
                                providerId: s.provider_id || s.providerId || storedProviderId
                            }))

                            setSessions(mapped)
                        } else {
                            setError('Unable to load your negotiations. Please try refreshing the page.')
                        }
                    } catch (err) {
                        console.error('Failed to load provider sessions:', err)
                        setError('Unable to connect to CLARENCE. Please check your connection and try again.')
                    }
                } else {
                    // No provider identity found - they need to log in
                    setError('no_identity')
                }
            }

            setLoading(false)
        }

        initialize()
    }, [searchParams])

    // Poll every 10 seconds while waiting for leverage calculation to complete
    useEffect(() => {
        if (!isPolling) return

        const sessionId = searchParams.get('session_id')
        const providerId = searchParams.get('provider_id')
        if (!sessionId || !providerId) return

        const poll = async () => {
            try {
                const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}&provider_id=${providerId}`)
                if (!response.ok) return
                const data = await response.json()
                const bidStatus = data.bid?.bidStatus || data.bid?.status || data.bidStatus || data.bid_status || 'questionnaire_complete'

                if (bidStatus === 'ready' || bidStatus === 'active' || bidStatus === 'negotiation_active') {
                    setSessions(prev => prev.map(s =>
                        s.sessionId === sessionId
                            ? { ...s, bidStatus, mediationType: data.session?.mediationType || data.mediationType || data.mediation_type || s.mediationType }
                            : s
                    ))
                    setIsPolling(false)
                }
            } catch (err) {
                console.error('Polling error:', err)
            }
        }

        const interval = setInterval(poll, 10000)
        return () => clearInterval(interval)
    }, [isPolling, searchParams])

    // ========================================================================
    // SECTION 8C: LOADING STATE
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600 font-medium">Loading your negotiations...</p>
                    </div>
                </main>
                <ProviderFooter />
            </div>
        )
    }

    // ========================================================================
    // SECTION 8D: NO IDENTITY STATE
    // ========================================================================

    if (error === 'no_identity') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center px-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">Sign In Required</h2>
                        <p className="text-slate-500 mb-6">
                            Please sign in to view your active negotiations.
                        </p>
                        <Link
                            href="/provider"
                            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Sign In to Provider Portal
                        </Link>
                    </div>
                </main>
                <ProviderFooter />
            </div>
        )
    }

    // ========================================================================
    // SECTION 9: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />

            <main className="flex-1 py-8 px-4">
                <div className="max-w-3xl mx-auto">

                    {/* ============================================================ */}
                    {/* SECTION 9A: FIRST ARRIVAL SUCCESS BANNER */}
                    {/* ============================================================ */}

                    {isFirstArrival && (
                        <div className="mb-8 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border border-emerald-200 p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800 mb-1">
                                        Assessment Complete
                                    </h2>
                                    <p className="text-slate-600 mb-3">
                                        Your strategic assessment has been submitted successfully. CLARENCE is now analysing both parties to calculate leverage positions and generate initial negotiating stances.
                                    </p>
                                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 inline-flex">
                                        <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                        This typically takes a few minutes. You&apos;ll be able to enter the Contract Studio once complete.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* SECTION 9B: PAGE HEADER */}
                    {/* ============================================================ */}

                    {!isFirstArrival && (
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-slate-800 mb-1">
                                {providerName ? `Welcome back, ${providerName}` : 'Provider Portal'}
                            </h1>
                            {providerCompany && (
                                <p className="text-slate-500">{providerCompany}</p>
                            )}
                            <p className="text-sm text-slate-400 mt-2">
                                Your active contract negotiations are shown below.
                            </p>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* SECTION 9C: ERROR STATE */}
                    {/* ============================================================ */}

                    {error && error !== 'no_identity' && (
                        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm text-red-700">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="text-sm text-red-600 font-medium hover:text-red-800 mt-1"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* SECTION 9D: CONTRACT CARDS */}
                    {/* ============================================================ */}

                    {sessions.length > 0 && (
                        <div className="space-y-4">
                            {!isFirstArrival && (
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                        Active Negotiations ({sessions.length})
                                    </h2>
                                </div>
                            )}

                            {sessions.map((session) => (
                                <ContractCard key={session.sessionId} session={session} />
                            ))}
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* SECTION 9E: EMPTY STATE */}
                    {/* ============================================================ */}

                    {sessions.length === 0 && !error && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">No Active Negotiations</h2>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                You don&apos;t have any active contract negotiations at the moment. When a customer invites you to negotiate, it will appear here.
                            </p>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* SECTION 9F: HELP TEXT */}
                    {/* ============================================================ */}

                    <div className="mt-12 text-center">
                        <p className="text-xs text-slate-400">
                            Need help? Contact the customer who invited you or reach out to{' '}
                            <a href="mailto:support@clarencelegal.ai" className="text-blue-500 hover:text-blue-600">
                                support@clarencelegal.ai
                            </a>
                        </p>
                    </div>

                </div>
            </main>

            <ProviderFooter />
        </div>
    )
}