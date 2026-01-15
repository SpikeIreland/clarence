'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger';
import FeedbackButton from '@/app/components/FeedbackButton';

// ============================================================================
// SECTION 2: SHARED HEADER COMPONENT
// ============================================================================

function ProviderHeader() {
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    {/* Logo & Brand - Blue gradient for Provider */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">Provider Portal</div>
                        </div>
                    </Link>

                    {/* Right: Customer Portal Link */}
                    <div className="flex items-center gap-4">
                        <Link
                            href="/auth/login"
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Customer Portal →
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    )
}

// ============================================================================
// SECTION 3: SHARED FOOTER COMPONENT
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
                        © {new Date().getFullYear()} CLARENCE. The Honest Broker.
                    </div>
                </div>
            </div>
        </footer>
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function ProviderWelcomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ProviderHeader />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500">Loading...</p>
                    </div>
                </main>
                <ProviderFooter />

                {/* Beta Feedback Button */}
                <FeedbackButton position="bottom-left" />
            </div>
        }>
            <ProviderWelcomeContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 5: MAIN CONTENT COMPONENT
// ============================================================================

function ProviderWelcomeContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 6: STATE
    // ========================================================================

    const [currentStep, setCurrentStep] = useState(0)
    const [showAllSteps, setShowAllSteps] = useState(false)
    const [showTrustDetails, setShowTrustDetails] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [providerId, setProviderId] = useState<string | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [sessionNumber, setSessionNumber] = useState<string | null>(null)

    // ========================================================================
    // SECTION 7: INITIALIZATION
    // ========================================================================

    useEffect(() => {
        // Get params from URL first
        const sid = searchParams.get('session_id')
        const pid = searchParams.get('provider_id')
        const tkn = searchParams.get('token')

        setSessionId(sid)
        setProviderId(pid)
        setToken(tkn)

        // Set event logger context
        if (sid) {
            eventLogger.setSession(sid)
        }

        // Then try localStorage for any missing values
        try {
            const storedSession = localStorage.getItem('clarence_provider_session') ||
                localStorage.getItem('providerSession')
            if (storedSession) {
                const sessionData = JSON.parse(storedSession)
                console.log('Welcome page - loaded session data:', sessionData)

                // Fill in missing values from localStorage
                if (!sid && sessionData.sessionId) {
                    setSessionId(sessionData.sessionId)
                    eventLogger.setSession(sessionData.sessionId)
                }
                if (!pid && sessionData.providerId) {
                    setProviderId(sessionData.providerId)
                }
                if (!tkn && sessionData.token) {
                    setToken(sessionData.token)
                }
                if (sessionData.sessionNumber) {
                    setSessionNumber(sessionData.sessionNumber)
                }
            }
        } catch (e) {
            console.error('Error reading localStorage:', e)
        }

        // LOG: Welcome page loaded
        eventLogger.completed('provider_onboarding', 'provider_welcome_page_loaded', {
            sessionId: sid,
            providerId: pid,
            hasToken: !!tkn
        })

        // Animation timers
        const timers: NodeJS.Timeout[] = []
        timers.push(setTimeout(() => setCurrentStep(1), 500))
        timers.push(setTimeout(() => setCurrentStep(2), 1500))
        timers.push(setTimeout(() => setCurrentStep(3), 2500))
        timers.push(setTimeout(() => setShowAllSteps(true), 3500))

        return () => timers.forEach(t => clearTimeout(t))
    }, [searchParams])

    // ========================================================================
    // SECTION 8: NAVIGATION
    // ========================================================================

    const handleContinue = () => {
        // LOG: Provider clicked continue
        eventLogger.completed('provider_onboarding', 'provider_continue_clicked', {
            sessionId: sessionId,
            providerId: providerId
        })

        const params = new URLSearchParams()

        // Always include session_id
        if (sessionId) params.set('session_id', sessionId)

        // PRIORITY: Use provider_id if available (post-registration)
        // Fall back to token only if no provider_id (pre-registration)
        if (providerId) {
            params.set('provider_id', providerId)
        } else if (token) {
            params.set('token', token)
        }

        const queryString = params.toString()
        const url = queryString ? `/provider/intake?${queryString}` : '/provider/intake'

        // LOG: Redirect to intake
        eventLogger.completed('provider_onboarding', 'redirect_to_provider_intake', {
            sessionId: sessionId,
            providerId: providerId,
            destination: url
        })

        console.log('Navigating to:', url)
        router.push(url)
    }

    const handleSkip = () => {
        setCurrentStep(3)
        setShowAllSteps(true)
    }

    // ========================================================================
    // SECTION 9: STEP DATA
    // ========================================================================

    const steps = [
        {
            number: 1,
            title: 'Share Your Capabilities',
            description: 'Tell us about your company, services, and commercial terms',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            duration: '5-7 minutes'
        },
        {
            number: 2,
            title: 'Strategic Assessment',
            description: 'Answer questions that help CLARENCE understand your negotiation position',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
            ),
            duration: '3-5 minutes'
        },
        {
            number: 3,
            title: 'Enter Contract Studio',
            description: 'Begin the mediated negotiation with full visibility and AI guidance',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            duration: 'Your negotiation begins'
        }
    ]

    // ========================================================================
    // SECTION 10: RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <ProviderHeader />

            <main className="flex-1 flex items-center justify-center p-6 py-12">
                <div className="max-w-2xl w-full">
                    {/* Welcome Card */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
                        {/* Session Reference */}
                        {sessionNumber && (
                            <div className="text-center mb-6">
                                <span className="text-xs text-slate-500 uppercase tracking-wider">Session Reference</span>
                                <p className="text-slate-700 font-mono font-medium">{sessionNumber}</p>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* SECTION 10A: CLARENCE INTRODUCTION - ENHANCED TRUST MESSAGE */}
                        {/* ============================================================ */}
                        <div className="mb-8">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-lg font-medium">C</span>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tl-none p-4 flex-1">
                                    <p className="text-slate-700 leading-relaxed">
                                        Welcome! I&apos;m <span className="text-blue-600 font-medium">CLARENCE</span>, your neutral mediator for this contract negotiation.
                                    </p>
                                    <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                                        I work equally with both you and the customer. While I&apos;ll use the information you share to calculate leverage and find fair positions,
                                        <span className="text-blue-600 font-medium"> I will never share your sensitive details directly with the other party</span>—things like your minimum acceptable terms, walk-away points, or strategic priorities remain confidential.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4 mb-8">
                            {steps.map((step) => (
                                <div
                                    key={step.number}
                                    className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-500 ${currentStep >= step.number || showAllSteps
                                        ? 'bg-slate-50 border border-slate-200 opacity-100 translate-x-0'
                                        : 'opacity-0 -translate-x-4'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${currentStep >= step.number || showAllSteps
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        {step.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-slate-800 font-medium">{step.title}</h3>
                                            <span className="text-xs text-slate-500">{step.duration}</span>
                                        </div>
                                        <p className="text-slate-500 text-sm mt-1">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ============================================================ */}
                        {/* SECTION 10B: THE HONEST BROKER - EXPANDED TRUST SECTION */}
                        {/* ============================================================ */}
                        <div className={`border-t border-slate-200 pt-6 mb-6 transition-all duration-500 ${showAllSteps ? 'opacity-100' : 'opacity-0'}`}>
                            {/* Header with expand toggle */}
                            <button
                                onClick={() => setShowTrustDetails(!showTrustDetails)}
                                className="w-full flex items-center justify-between mb-4 group cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <h4 className="text-emerald-700 font-medium">The Honest Broker Promise</h4>
                                </div>
                                <svg
                                    className={`w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-transform ${showTrustDetails ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Core promises - always visible */}
                            <ul className="space-y-2 text-sm text-slate-600 mb-4">
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Neutral mediation based on market data and factual analysis
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Equal visibility into negotiation dynamics for both parties
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Your strategic information is used to find fair positions—never disclosed directly
                                </li>
                            </ul>

                            {/* Expanded details */}
                            {showTrustDetails && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-4 space-y-4">
                                    {/* What CLARENCE Does */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                            </div>
                                            <h5 className="font-medium text-slate-700 text-sm">How CLARENCE Uses Your Information</h5>
                                        </div>
                                        <ul className="space-y-1.5 text-sm text-slate-600 ml-8">
                                            <li>• Calculates your negotiation leverage</li>
                                            <li>• Identifies realistic compromise zones</li>
                                            <li>• Suggests strategic trade-offs that benefit you</li>
                                            <li>• Recommends positions based on market benchmarks</li>
                                        </ul>
                                    </div>

                                    {/* What CLARENCE Never Shares */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 bg-red-100 rounded-md flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                </svg>
                                            </div>
                                            <h5 className="font-medium text-slate-700 text-sm">Never Shared with the Customer</h5>
                                        </div>
                                        <ul className="space-y-1.5 text-sm text-slate-600 ml-8">
                                            <li>• Your minimum acceptable terms or pricing floors</li>
                                            <li>• Walk-away points or deal-breakers</li>
                                            <li>• Internal constraints (capacity, costs, margins)</li>
                                            <li>• Priority weightings or where you&apos;re flexible</li>
                                            <li>• Pipeline pressures or urgency factors</li>
                                        </ul>
                                    </div>

                                    {/* The Honest Broker Principle */}
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-3">
                                        <p className="text-sm text-blue-800 leading-relaxed">
                                            <span className="font-medium">Think of CLARENCE as a skilled mediator</span> who understands both parties&apos; positions deeply but maintains strict confidentiality.
                                            I use information to find genuine common ground—not to advantage one party over the other.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Continue Button */}
                        <div className={`transition-all duration-500 ${showAllSteps ? 'opacity-100' : 'opacity-0'}`}>
                            <button
                                onClick={handleContinue}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                Let&apos;s Begin
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                            <p className="text-center text-slate-500 text-xs mt-3">
                                Estimated time: 10-15 minutes
                            </p>
                        </div>

                        {/* Skip Animation */}
                        {!showAllSteps && (
                            <button
                                onClick={handleSkip}
                                className="w-full mt-4 text-slate-400 hover:text-slate-600 text-sm transition-colors cursor-pointer"
                            >
                                Skip animation →
                            </button>
                        )}
                    </div>
                </div>
            </main>

            <ProviderFooter />

            {/* Beta Feedback Button */}
            <FeedbackButton position="bottom-left" />
        </div>
    )
}