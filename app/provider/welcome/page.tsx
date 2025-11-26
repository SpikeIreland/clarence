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

    // ========================================================================
    // SECTION 4: INITIALIZATION
    // ========================================================================

    useEffect(() => {
        const sid = searchParams.get('session_id')
        setSessionId(sid)

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
        if (sessionId) {
            router.push(`/provider/intake?session_id=${sessionId}`)
        } else {
            router.push('/provider/intake')
        }
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
            duration: '5-8 minutes'
        },
        {
            number: 3,
            title: 'Contract Studio',
            description: 'Negotiate terms with guidance from CLARENCE as your neutral mediator',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            duration: 'Varies'
        }
    ]

    // ========================================================================
    // SECTION 7: RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-block">
                        <div className="text-5xl font-light text-white mb-2 tracking-wide">CLARENCE</div>
                        <div className="text-xs text-emerald-400 tracking-[0.3em] font-light">THE HONEST BROKER</div>
                    </div>
                </div>

                {/* Welcome Message */}
                <div className="text-center mb-10">
                    <h1 className="text-2xl font-light text-white mb-4">
                        Welcome to Your Negotiation
                    </h1>
                    <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                        I&apos;m CLARENCE, your AI-powered contract mediator. I&apos;ll guide you through
                        a fair, transparent negotiation process designed to find mutually beneficial terms.
                    </p>
                </div>

                {/* Steps */}
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8 mb-6">
                    <h2 className="text-lg font-medium text-white mb-6 text-center">Your Journey</h2>

                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div
                                key={step.number}
                                className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-500 ${currentStep >= step.number
                                        ? 'bg-slate-700/50 border border-slate-600/50 opacity-100 translate-x-0'
                                        : 'opacity-0 translate-x-4'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${currentStep >= step.number
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-slate-600/30 text-slate-500'
                                    }`}>
                                    {step.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-emerald-500 font-medium">STEP {step.number}</span>
                                        <span className="text-xs text-slate-500">• {step.duration}</span>
                                    </div>
                                    <h3 className="text-white font-medium mt-1">{step.title}</h3>
                                    <p className="text-sm text-slate-400 mt-1">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CLARENCE Promise */}
                <div className="bg-gradient-to-r from-emerald-600/10 to-blue-600/10 border border-emerald-500/20 rounded-xl p-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-medium mb-2">My Promise to You</h3>
                            <ul className="text-sm text-slate-400 space-y-1.5">
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>I represent <strong className="text-slate-300">neither party</strong> — I&apos;m here to find fair outcomes</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>All recommendations are based on <strong className="text-slate-300">market data and facts</strong></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Both parties see the <strong className="text-slate-300">same leverage analysis</strong></span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={handleContinue}
                        disabled={!showAllSteps}
                        className={`px-8 py-3 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${showAllSteps
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        Let&apos;s Begin
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>

                    {!showAllSteps && (
                        <button
                            onClick={handleSkip}
                            className="text-slate-500 hover:text-slate-400 text-sm cursor-pointer transition"
                        >
                            Skip animation →
                        </button>
                    )}

                    <p className="text-xs text-slate-500 mt-2">
                        Estimated time: 10-15 minutes
                    </p>
                </div>

                {/* Footer */}
                <div className="text-center mt-10 text-xs text-slate-500">
                    © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                </div>
            </div>
        </div>
    )
}