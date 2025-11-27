'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ============================================================================
// SECTION 1: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function ProviderWelcomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        }>
            <ProviderWelcomeContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 2: MAIN CONTENT COMPONENT
// ============================================================================

function ProviderWelcomeContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 3: STATE
    // ========================================================================

    const [currentStep, setCurrentStep] = useState(0)
    const [showAllSteps, setShowAllSteps] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [sessionNumber, setSessionNumber] = useState<string | null>(null)

    // ========================================================================
    // SECTION 4: INITIALIZATION
    // ========================================================================

    useEffect(() => {
        // Get session_id from URL
        const sid = searchParams.get('session_id')
        setSessionId(sid)

        // Get token and session number from localStorage (set during registration)
        try {
            const storedSession = localStorage.getItem('clarence_provider_session')
            if (storedSession) {
                const sessionData = JSON.parse(storedSession)
                console.log('Welcome page - loaded session data:', sessionData)
                setToken(sessionData.token || null)
                setSessionNumber(sessionData.sessionNumber || null)

                // If no session_id in URL, use from localStorage
                if (!sid && sessionData.sessionId) {
                    setSessionId(sessionData.sessionId)
                }
            }
        } catch (e) {
            console.error('Error reading localStorage:', e)
        }

        // Auto-advance through steps with animation
        const timers: NodeJS.Timeout[] = []

        timers.push(setTimeout(() => setCurrentStep(1), 500))
        timers.push(setTimeout(() => setCurrentStep(2), 1500))
        timers.push(setTimeout(() => setCurrentStep(3), 2500))
        timers.push(setTimeout(() => setShowAllSteps(true), 3500))

        return () => timers.forEach(t => clearTimeout(t))
    }, [searchParams])

    // ========================================================================
    // SECTION 5: NAVIGATION
    // ========================================================================

    const handleContinue = () => {
        // Build URL with both session_id and token
        const params = new URLSearchParams()
        if (sessionId) params.set('session_id', sessionId)
        if (token) params.set('token', token)

        const queryString = params.toString()
        const url = queryString ? `/provider/intake?${queryString}` : '/provider/intake'

        console.log('Navigating to:', url)
        router.push(url)
    }

    const handleSkip = () => {
        setCurrentStep(3)
        setShowAllSteps(true)
    }

    // ========================================================================
    // SECTION 6: STEP DATA
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
    // SECTION 7: RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-light text-white mb-2 tracking-wide">
                        CLARENCE
                    </h1>
                    <p className="text-emerald-400 text-sm tracking-widest uppercase">
                        The Honest Broker
                    </p>
                </div>

                {/* Welcome Card */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
                    {/* Session Reference */}
                    {sessionNumber && (
                        <div className="text-center mb-6">
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Session Reference</span>
                            <p className="text-slate-300 font-mono">{sessionNumber}</p>
                        </div>
                    )}

                    {/* CLARENCE Introduction */}
                    <div className="mb-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-lg font-medium">C</span>
                            </div>
                            <div className="bg-slate-700/50 rounded-2xl rounded-tl-none p-4 flex-1">
                                <p className="text-slate-200 leading-relaxed">
                                    Welcome! I&apos;m <span className="text-emerald-400 font-medium">CLARENCE</span>, your neutral mediator for this contract negotiation.
                                </p>
                                <p className="text-slate-400 text-sm mt-2">
                                    I&apos;ll guide you through a quick onboarding process before we begin. Everything you share is confidential and used only to facilitate fair negotiations.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-4 mb-8">
                        {steps.map((step, index) => (
                            <div
                                key={step.number}
                                className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-500 ${currentStep >= step.number || showAllSteps
                                        ? 'bg-slate-700/30 opacity-100 translate-x-0'
                                        : 'opacity-0 -translate-x-4'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${currentStep >= step.number || showAllSteps
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-slate-700 text-slate-500'
                                    }`}>
                                    {step.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-white font-medium">{step.title}</h3>
                                        <span className="text-xs text-slate-500">{step.duration}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-1">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CLARENCE Promise */}
                    <div className={`border-t border-slate-700 pt-6 mb-6 transition-all duration-500 ${showAllSteps ? 'opacity-100' : 'opacity-0'
                        }`}>
                        <h4 className="text-emerald-400 text-sm font-medium mb-3">CLARENCE&apos;s Promise</h4>
                        <ul className="space-y-2 text-sm text-slate-400">
                            <li className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Neutral mediation based on market data and factual analysis
                            </li>
                            <li className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Equal visibility into negotiation dynamics for both parties
                            </li>
                            <li className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confidential handling of your strategic information
                            </li>
                        </ul>
                    </div>

                    {/* Continue Button */}
                    <div className={`transition-all duration-500 ${showAllSteps ? 'opacity-100' : 'opacity-0'}`}>
                        <button
                            onClick={handleContinue}
                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2"
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
                            className="w-full mt-4 text-slate-500 hover:text-slate-400 text-sm transition-colors"
                        >
                            Skip animation →
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}