'use client'

// ============================================================================
// PROVIDER CONFIRMATION PAGE - FIXED
// Location: app/provider/providerConfirmation/page.tsx
//
// This page is shown after the provider completes the strategic questionnaire.
// It confirms onboarding is complete and provides a clear path forward:
//
// 1. Checks bid/session status via API polling
// 2. Shows "Processing" state while leverage calculation runs
// 3. Shows "Ready" state with Contract Studio CTA when negotiation_ready
// 4. Falls back to "We'll notify you" if polling times out
//
// FIX (05-Feb-2026): Status check now examines BOTH 'status' (bid status)
// AND 'sessionStatus' (session status) fields from provider-sessions-api.
// Previously only checked 'status' which returns 'questionnaire_complete'
// (a non-ready bid status), missing 'sessionStatus: negotiation_ready'.
// This caused infinite polling as the page never detected readiness.
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger'
import FeedbackButton from '@/app/components/FeedbackButton'

// ============================================================================
// SECTION 2: CONSTANTS & TYPES
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// Poll every 10 seconds, timeout after 5 minutes (30 attempts)
const POLL_INTERVAL_MS = 10000
const MAX_POLL_ATTEMPTS = 30

type ReadinessStatus = 'checking' | 'processing' | 'ready' | 'timeout' | 'error'

interface SessionStatus {
    sessionId: string
    sessionNumber: string
    providerId: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    status: string
    sessionStatus?: string
    intakeComplete: boolean
    questionnaireComplete: boolean
}

// ============================================================================
// SECTION 3: PROVIDER HEADER COMPONENT
// ============================================================================

function ProviderHeader() {
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">Provider Portal</div>
                        </div>
                    </Link>

                    <span className="text-sm text-slate-400">
                        Provider Portal
                    </span>
                </nav>
            </div>
        </header>
    )
}

// ============================================================================
// SECTION 4: PROVIDER FOOTER COMPONENT
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
// SECTION 5: LOADING SPINNER COMPONENT
// ============================================================================

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />
            <main className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </main>
            <ProviderFooter />
        </div>
    )
}

// ============================================================================
// SECTION 6: ANIMATED PROCESSING INDICATOR
// ============================================================================

function ProcessingIndicator() {
    return (
        <div className="flex flex-col items-center gap-4">
            {/* Animated rings */}
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-2 border-4 border-blue-300 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                </div>
            </div>
            <div className="text-center">
                <p className="text-lg font-medium text-slate-800">CLARENCE is Analysing</p>
                <p className="text-sm text-slate-500 mt-1">Calculating leverage positions and preparing the Contract Studio...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 7: SUCCESS/READY INDICATOR
// ============================================================================

function ReadyIndicator() {
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <div className="text-center">
                <p className="text-lg font-medium text-slate-800">Ready to Negotiate!</p>
                <p className="text-sm text-slate-500 mt-1">Your positions have been calculated. The Contract Studio is ready.</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 8: MAIN CONTENT COMPONENT
// ============================================================================

function ProviderConfirmationContent() {
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 8A: STATE MANAGEMENT
    // ========================================================================

    const [sessionId, setSessionId] = useState<string | null>(null)
    const [providerId, setProviderId] = useState<string | null>(null)
    const [customerCompany, setCustomerCompany] = useState<string>('')
    const [readinessStatus, setReadinessStatus] = useState<ReadinessStatus>('checking')
    const [pollCount, setPollCount] = useState(0)

    const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
    const pollCountRef = useRef(0)

    // ========================================================================
    // SECTION 8B: INITIALISATION - READ PARAMS & START POLLING
    // ========================================================================

    useEffect(() => {
        const sid = searchParams.get('session_id')
        const pid = searchParams.get('provider_id')

        // Try URL params first, then localStorage fallback
        let resolvedSessionId = sid
        let resolvedProviderId = pid

        if (!resolvedSessionId || !resolvedProviderId) {
            try {
                const stored = localStorage.getItem('clarence_provider_session')
                if (stored) {
                    const parsed = JSON.parse(stored)
                    resolvedSessionId = resolvedSessionId || parsed.sessionId
                    resolvedProviderId = resolvedProviderId || parsed.providerId
                    if (parsed.customerCompany) {
                        setCustomerCompany(parsed.customerCompany)
                    }
                }
            } catch {
                // localStorage not available or parse error
            }
        }

        setSessionId(resolvedSessionId)
        setProviderId(resolvedProviderId)

        // Set session context for event logging
        if (resolvedSessionId) {
            eventLogger.setSession(resolvedSessionId)
        }

        // LOG: Confirmation page loaded
        eventLogger.completed('provider_onboarding', 'provider_confirmation_page_loaded', {
            sessionId: resolvedSessionId,
            providerId: resolvedProviderId,
            timestamp: new Date().toISOString()
        })

        // LOG: Provider onboarding journey complete
        eventLogger.completed('provider_onboarding', 'provider_onboarding_journey_complete', {
            sessionId: resolvedSessionId,
            providerId: resolvedProviderId,
            completedAt: new Date().toISOString()
        })

        // Start polling if we have enough info
        if (resolvedSessionId) {
            checkReadiness(resolvedSessionId, resolvedProviderId)
        } else {
            // No session ID at all — show ready state as fallback
            setReadinessStatus('ready')
        }

        // Cleanup polling on unmount
        return () => {
            if (pollTimerRef.current) {
                clearTimeout(pollTimerRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    // ========================================================================
    // SECTION 8C: STATUS POLLING LOGIC (FIXED)
    //
    // FIX: The provider-sessions-api returns TWO status fields:
    //   - status: bid status (e.g. "questionnaire_complete", "ready", "active")
    //   - sessionStatus: session status (e.g. "negotiation_ready", "active")
    //
    // Previously only checked 'status', which for a provider who just
    // completed the questionnaire returns "questionnaire_complete" — NOT
    // in the ready list. This caused infinite polling because the page
    // never detected that the session was actually ready.
    //
    // Now checks BOTH fields so either a ready bid status OR a ready
    // session status will correctly stop polling and show the CTA.
    // ========================================================================

    const checkReadiness = useCallback(async (sid: string, pid: string | null) => {
        try {
            // Use provider-sessions-api to check current status
            const email = getStoredEmail()
            if (!email) {
                // Can't poll without email — skip to ready (optimistic)
                setReadinessStatus('ready')
                return
            }

            const response = await fetch(
                `${API_BASE}/provider-sessions-api?email=${encodeURIComponent(email)}`
            )

            if (!response.ok) {
                throw new Error('Status check failed')
            }

            const data = await response.json()
            const sessions: SessionStatus[] = data.sessions || []

            // Find our specific session
            const ourSession = sessions.find(s => s.sessionId === sid)

            if (!ourSession) {
                // Session not found — could be timing, show processing
                scheduleNextPoll(sid, pid)
                setReadinessStatus('processing')
                return
            }

            // Store customer company if available
            if (ourSession.customerCompany) {
                setCustomerCompany(ourSession.customerCompany)
            }

            // ----------------------------------------------------------------
            // FIX: Check BOTH bid status AND session status fields
            // The API returns:
            //   status = bid status (e.g. "questionnaire_complete")
            //   sessionStatus = session status (e.g. "negotiation_ready")
            //
            // Either one indicating "ready" means the Contract Studio is
            // available for this provider.
            // ----------------------------------------------------------------

            const readyBidStatuses = ['ready', 'active', 'selected']
            const readySessionStatuses = ['negotiation_ready', 'active', 'completed']

            const bidStatus = ourSession.status || ''
            const sessStatus = ourSession.sessionStatus || ''

            const isReady =
                readyBidStatuses.includes(bidStatus) ||
                readySessionStatuses.includes(sessStatus) ||
                // Also treat questionnaire_complete as ready if the session
                // is negotiation_ready — the provider has done their part
                (bidStatus === 'questionnaire_complete' && sessStatus === 'negotiation_ready')

            if (isReady) {
                // Leverage calculation is done — Contract Studio is ready
                setReadinessStatus('ready')

                eventLogger.completed('provider_onboarding', 'leverage_calculation_ready', {
                    sessionId: sid,
                    providerId: pid,
                    bidStatus: bidStatus,
                    sessionStatus: sessStatus,
                    pollAttempts: pollCountRef.current
                })

                // Stop polling
                if (pollTimerRef.current) {
                    clearTimeout(pollTimerRef.current)
                }
                return
            }

            // Still processing — schedule next poll
            scheduleNextPoll(sid, pid)
            setReadinessStatus('processing')

        } catch (error) {
            console.error('Readiness check error:', error)
            // On error, be optimistic — show ready state
            // The Contract Studio will handle errors if leverage isn't done
            setReadinessStatus('ready')
        }
    }, [])

    const scheduleNextPoll = useCallback((sid: string, pid: string | null) => {
        pollCountRef.current += 1
        setPollCount(pollCountRef.current)

        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
            // Timed out — show timeout state
            setReadinessStatus('timeout')

            eventLogger.completed('provider_onboarding', 'leverage_poll_timeout', {
                sessionId: sid,
                providerId: pid,
                attempts: pollCountRef.current
            })
            return
        }

        // Schedule next check
        pollTimerRef.current = setTimeout(() => {
            checkReadiness(sid, pid)
        }, POLL_INTERVAL_MS)
    }, [checkReadiness])

    // ========================================================================
    // SECTION 8D: HELPER - GET STORED EMAIL
    // ========================================================================

    const getStoredEmail = (): string | null => {
        try {
            // Try clarence_auth first
            const authStr = localStorage.getItem('clarence_auth')
            if (authStr) {
                const auth = JSON.parse(authStr)
                if (auth?.userInfo?.email) return auth.userInfo.email
            }

            // Try clarence_provider_session as fallback
            const providerStr = localStorage.getItem('clarence_provider_session')
            if (providerStr) {
                const provider = JSON.parse(providerStr)
                if (provider?.email) return provider.email
                if (provider?.providerEmail) return provider.providerEmail
            }

            // Try direct email key
            const directEmail = localStorage.getItem('userEmail')
            if (directEmail) return directEmail
        } catch {
            // localStorage not available
        }
        return null
    }

    // ========================================================================
    // SECTION 8E: CONTRACT STUDIO URL BUILDER
    // ========================================================================

    const getContractStudioUrl = (): string => {
        const params = new URLSearchParams()
        if (sessionId) params.set('session_id', sessionId)
        if (providerId) params.set('provider_id', providerId)
        return `/auth/contract-studio?${params.toString()}`
    }

    // ========================================================================
    // SECTION 8F: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />

            <main className="flex-1">
                <div className="max-w-2xl mx-auto px-4 py-12">

                    {/* ============================================================ */}
                    {/* SECTION 8F1: STATUS INDICATOR (top of page) */}
                    {/* ============================================================ */}

                    <div className="text-center mb-10">
                        {readinessStatus === 'checking' && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                                <p className="text-slate-600">Checking status...</p>
                            </div>
                        )}

                        {readinessStatus === 'processing' && <ProcessingIndicator />}

                        {readinessStatus === 'ready' && <ReadyIndicator />}

                        {readinessStatus === 'timeout' && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-medium text-slate-800">Still Preparing</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        The analysis is taking a little longer than usual.
                                        We&apos;ll send you an email when the Contract Studio is ready.
                                    </p>
                                </div>
                            </div>
                        )}

                        {readinessStatus === 'error' && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-medium text-slate-800">Something Went Wrong</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Please try refreshing the page or contact support.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 8F2: SUBMISSION CONFIRMED CARD */}
                    {/* ============================================================ */}

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">

                        {/* Submission Receipt */}
                        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <div className="font-medium text-slate-800">Capabilities Submitted Successfully</div>
                                <div className="text-sm text-slate-500">
                                    {new Date().toLocaleDateString('en-GB', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Customer Context (if available) */}
                        {customerCompany && (
                            <div className="py-4 border-b border-slate-100">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Contract With</div>
                                <div className="text-sm font-medium text-slate-700">{customerCompany}</div>
                            </div>
                        )}

                        {/* What Happens Next - dynamic based on status */}
                        <div className="pt-6">
                            <h2 className="text-lg font-medium text-slate-800 mb-4">What Happens Next</h2>

                            <div className="space-y-4">
                                {/* Step 1: Analysis - always complete at this point */}
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-700">Your Submission</div>
                                        <p className="text-sm text-slate-500">
                                            Your capabilities and strategic assessment have been received.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2: Leverage Calculation - depends on status */}
                                <div className="flex items-start gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                                        ${readinessStatus === 'ready'
                                            ? 'bg-blue-100'
                                            : readinessStatus === 'processing' || readinessStatus === 'checking'
                                                ? 'bg-blue-100'
                                                : 'bg-amber-100'
                                        }`}
                                    >
                                        {readinessStatus === 'ready' ? (
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : readinessStatus === 'processing' || readinessStatus === 'checking' ? (
                                            <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                                        ) : (
                                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-700">CLARENCE Leverage Calculation</div>
                                        <p className="text-sm text-slate-500">
                                            {readinessStatus === 'ready'
                                                ? 'Fair leverage positions have been calculated for both parties.'
                                                : readinessStatus === 'processing' || readinessStatus === 'checking'
                                                    ? 'Analysing market data, strategic positions, and BATNA to calculate fair leverage...'
                                                    : 'Analysis is still in progress. You\u0027ll be notified when it\u0027s complete.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3: Contract Studio */}
                                <div className="flex items-start gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                                        ${readinessStatus === 'ready' ? 'bg-blue-100' : 'bg-slate-100'}`}
                                    >
                                        <span className={`text-sm font-medium ${readinessStatus === 'ready' ? 'text-blue-600' : 'text-slate-400'}`}>3</span>
                                    </div>
                                    <div>
                                        <div className={`font-medium ${readinessStatus === 'ready' ? 'text-slate-700' : 'text-slate-400'}`}>
                                            Enter the Contract Studio
                                        </div>
                                        <p className={`text-sm ${readinessStatus === 'ready' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Review clause positions, discuss with the customer, and work towards agreement.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 8F3: CALL TO ACTION */}
                    {/* ============================================================ */}

                    {/* Ready State: Primary CTA */}
                    {readinessStatus === 'ready' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-blue-900 mb-1">Contract Studio is Ready</h3>
                                    <p className="text-sm text-blue-700 mb-4">
                                        Your leverage positions have been calculated. You can now enter the Contract Studio
                                        to review clause positions and begin negotiations.
                                    </p>
                                    <Link
                                        href={getContractStudioUrl()}
                                        onClick={() => {
                                            eventLogger.completed('provider_onboarding', 'provider_contract_studio_clicked', {
                                                sessionId: sessionId,
                                                providerId: providerId,
                                                fromStatus: readinessStatus
                                            })
                                        }}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-sm"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Go to Contract Studio
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Processing State: Informational */}
                    {(readinessStatus === 'processing' || readinessStatus === 'checking') && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                                <div>
                                    <h3 className="font-medium text-slate-800 mb-1">Analysis in Progress</h3>
                                    <p className="text-sm text-slate-500">
                                        CLARENCE is calculating fair leverage positions based on your submission and
                                        market data. This usually takes less than a minute. This page will update
                                        automatically when ready.
                                    </p>
                                    {pollCount > 5 && (
                                        <p className="text-xs text-slate-400 mt-2">
                                            Still working... ({Math.round(pollCount * POLL_INTERVAL_MS / 1000)}s elapsed)
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timeout State: Fallback with notification promise */}
                    {readinessStatus === 'timeout' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-amber-900 mb-1">We&apos;ll Notify You</h3>
                                    <p className="text-sm text-amber-700 mb-4">
                                        The analysis is taking longer than expected. You&apos;ll receive an email
                                        when the Contract Studio is ready. You can also try accessing it directly:
                                    </p>
                                    <Link
                                        href={getContractStudioUrl()}
                                        onClick={() => {
                                            eventLogger.completed('provider_onboarding', 'provider_contract_studio_clicked', {
                                                sessionId: sessionId,
                                                providerId: providerId,
                                                fromStatus: 'timeout'
                                            })
                                        }}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all font-medium text-sm"
                                    >
                                        Try Contract Studio Anyway
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* SECTION 8F4: SESSION REFERENCE & SECONDARY ACTIONS */}
                    {/* ============================================================ */}

                    {/* Session Reference */}
                    {sessionId && (
                        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 text-center">
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Session Reference</span>
                            <div className="font-mono text-sm text-slate-600 mt-1">{sessionId}</div>
                        </div>
                    )}

                    {/* Secondary Actions */}
                    <div className="text-center space-y-3">
                        <Link
                            href="/provider"
                            onClick={() => {
                                eventLogger.completed('provider_onboarding', 'provider_return_portal_clicked', {
                                    sessionId: sessionId,
                                    providerId: providerId
                                })
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
                        >
                            Return to Provider Portal
                        </Link>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 8F5: TRUST & SUPPORT */}
                    {/* ============================================================ */}

                    <div className="mt-12 text-center space-y-3">
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>Your data is confidential and only visible to you and the customer.</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Questions?{' '}
                            <a href="mailto:support@spikeisland.ai" className="text-blue-500 hover:text-blue-600 hover:underline">
                                support@spikeisland.ai
                            </a>
                        </p>
                    </div>
                </div>
            </main>

            <ProviderFooter />

            {/* Beta Feedback Button */}
            <FeedbackButton position="bottom-left" />
        </div>
    )
}

// ============================================================================
// SECTION 9: MAIN EXPORT WITH SUSPENSE WRAPPER
// ============================================================================

export default function ProviderConfirmationPage() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <ProviderConfirmationContent />
        </Suspense>
    )
}