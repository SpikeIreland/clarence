'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ============================================================================
// SECTION 1: CONSTANTS & TYPES
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

interface Question {
    id: string
    category: string
    question: string
    helpText?: string
    inputType: 'textarea' | 'scale' | 'select'
    options?: string[]
    placeholder?: string
}

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
}

// ============================================================================
// SECTION 2: STRATEGIC QUESTIONS (Provider Version)
// ============================================================================

const STRATEGIC_QUESTIONS: Question[] = [
    {
        id: 'batna_specifics',
        category: 'BATNA Assessment',
        question: "What other opportunities are you currently pursuing? If this deal doesn't happen, what's your Plan B?",
        helpText: "Be specific about alternatives - this helps me understand your true position",
        inputType: 'textarea',
        placeholder: "We have several other opportunities in the pipeline including..."
    },
    {
        id: 'batna_timeline',
        category: 'BATNA Assessment',
        question: "How quickly could you pivot to those alternative opportunities if this negotiation doesn't work out?",
        helpText: "Understanding your timeline flexibility helps calibrate recommendations",
        inputType: 'textarea',
        placeholder: "We could redirect resources within..."
    },
    {
        id: 'batna_confidence',
        category: 'BATNA Assessment',
        question: "On a scale of 1-10, how confident are you that your alternative opportunities would be as valuable as this one?",
        inputType: 'scale',
        helpText: "1 = Not confident at all, 10 = Equally or more valuable alternatives"
    },
    {
        id: 'red_lines',
        category: 'Negotiation Boundaries',
        question: "What are your absolute red lines - the terms where you'd walk away from this deal entirely?",
        helpText: "This stays confidential - I need to know your limits to negotiate effectively",
        inputType: 'textarea',
        placeholder: "We cannot accept terms that..."
    },
    {
        id: 'flexibility_areas',
        category: 'Negotiation Boundaries',
        question: "Where do you have genuine flexibility? What could you concede without significant pain?",
        helpText: "Knowing where you can bend helps me find creative compromises",
        inputType: 'textarea',
        placeholder: "We have flexibility on..."
    },
    {
        id: 'deal_criticality',
        category: 'Strategic Importance',
        question: "How critical is winning this particular contract for your business right now?",
        inputType: 'select',
        options: [
            "Critical - we need this deal",
            "Very Important - strong preference to win",
            "Important - want it but have options",
            "Nice to Have - would be good but not essential",
            "Opportunistic - exploring but not committed"
        ]
    },
    {
        id: 'worst_case',
        category: 'Strategic Importance',
        question: "Paint me the scenario if you don't win this contract. What's the actual business impact?",
        helpText: "Be honest - understanding the stakes helps me negotiate appropriately",
        inputType: 'textarea',
        placeholder: "If we don't win this, the impact would be..."
    },
    {
        id: 'stakeholder_pressure',
        category: 'Internal Dynamics',
        question: "Who in your organization is most invested in winning this deal, and why?",
        helpText: "Understanding internal dynamics helps me manage the process",
        inputType: 'textarea',
        placeholder: "The key stakeholders are..."
    },
    {
        id: 'internal_factors',
        category: 'Internal Dynamics',
        question: "Is there anything happening internally that affects your negotiating position? (Restructuring, targets, capacity constraints, etc.)",
        helpText: "Confidential context that helps me understand your situation",
        inputType: 'textarea',
        placeholder: "Relevant internal factors include..."
    },
    {
        id: 'margin_vs_relationship',
        category: 'Strategic Priorities',
        question: "If you had to choose: would you accept lower margins for a strategic, long-term client relationship, or maximize short-term profitability?",
        inputType: 'select',
        options: [
            "Strategic relationship - willing to invest for long-term partnership",
            "Balanced - want fair margins but value the relationship",
            "Profitability focused - need strong margins regardless",
            "Depends on the specific terms offered"
        ]
    },
    {
        id: 'long_term_vision',
        category: 'Future Outlook',
        question: "Where do you see this client relationship in 3-5 years if this deal succeeds?",
        helpText: "Your vision affects how I frame the negotiation",
        inputType: 'textarea',
        placeholder: "In 3-5 years, we envision..."
    },
    {
        id: 'customer_concerns',
        category: 'Risk Assessment',
        question: "What worries you most about this customer or this engagement?",
        helpText: "Understanding concerns helps me address them proactively",
        inputType: 'textarea',
        placeholder: "My main concerns are..."
    },
    {
        id: 'partnership_confidence',
        category: 'Risk Assessment',
        question: "Based on your interactions so far, how confident are you that this customer will be a good partner to work with?",
        inputType: 'scale',
        helpText: "1 = Significant concerns, 10 = Very confident in the partnership"
    }
]

// ============================================================================
// SECTION 3: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================

export default function ProviderQuestionnairePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-3 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading questionnaire...</p>
                </div>
            </div>
        }>
            <ProviderQuestionnaireContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 4: MAIN CONTENT COMPONENT
// ============================================================================

function ProviderQuestionnaireContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 5: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [sessionData, setSessionData] = useState<SessionData | null>(null)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string | number>>({})
    const [showIntro, setShowIntro] = useState(true)

    // ========================================================================
    // SECTION 6: INITIALIZATION
    // ========================================================================

    const loadSessionData = useCallback(async () => {
        const sessionId = searchParams.get('session_id')

        if (!sessionId) {
            // Try to get from localStorage
            const stored = localStorage.getItem('clarence_provider_session')
            if (stored) {
                const parsed = JSON.parse(stored)
                setSessionData({
                    sessionId: parsed.sessionId,
                    sessionNumber: parsed.sessionNumber || '',
                    customerCompany: parsed.customerCompany || 'Customer',
                    serviceRequired: parsed.serviceRequired || 'Service Contract',
                    dealValue: parsed.dealValue || ''
                })
            }
            setLoading(false)
            return
        }

        try {
            // Fetch session details
            const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
            if (response.ok) {
                const data = await response.json()
                setSessionData({
                    sessionId: sessionId,
                    sessionNumber: data.sessionNumber || data.session_number || '',
                    customerCompany: data.customerCompany || data.customer_company || 'Customer',
                    serviceRequired: data.serviceRequired || data.service_required || 'Service Contract',
                    dealValue: data.dealValue || data.deal_value || ''
                })
            } else {
                // Fallback to localStorage
                const stored = localStorage.getItem('clarence_provider_session')
                if (stored) {
                    const parsed = JSON.parse(stored)
                    setSessionData({
                        sessionId: sessionId,
                        sessionNumber: parsed.sessionNumber || '',
                        customerCompany: parsed.customerCompany || 'Customer',
                        serviceRequired: parsed.serviceRequired || 'Service Contract',
                        dealValue: parsed.dealValue || ''
                    })
                }
            }
        } catch (error) {
            console.error('Failed to load session:', error)
        }

        setLoading(false)
    }, [searchParams])

    useEffect(() => {
        loadSessionData()
    }, [loadSessionData])

    // ========================================================================
    // SECTION 7: ANSWER HANDLERS
    // ========================================================================

    const handleAnswer = (questionId: string, value: string | number) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
    }

    const nextQuestion = () => {
        if (currentQuestion < STRATEGIC_QUESTIONS.length - 1) {
            setCurrentQuestion(prev => prev + 1)
        }
    }

    const prevQuestion = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(prev => prev - 1)
        }
    }

    const isCurrentAnswered = () => {
        const q = STRATEGIC_QUESTIONS[currentQuestion]
        const answer = answers[q.id]
        if (q.inputType === 'scale') {
            return typeof answer === 'number' && answer > 0
        }
        return typeof answer === 'string' && answer.trim().length > 0
    }

    // ========================================================================
    // SECTION 8: SUBMIT HANDLER
    // ========================================================================

    const handleSubmit = async () => {
        if (!sessionData?.sessionId) return

        setSubmitting(true)

        try {
            const submissionData = {
                sessionId: sessionData.sessionId,
                partyType: 'provider',
                answers: answers,
                submittedAt: new Date().toISOString(),
                questionCount: STRATEGIC_QUESTIONS.length,
                formVersion: '1.0'
            }

            const response = await fetch(`${API_BASE}/provider-questionnaire-submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            })

            if (response.ok) {
                // Update localStorage
                const stored = localStorage.getItem('clarence_provider_session')
                if (stored) {
                    const parsed = JSON.parse(stored)
                    parsed.questionnaireComplete = true
                    localStorage.setItem('clarence_provider_session', JSON.stringify(parsed))
                }

                // Navigate to Contract Studio
                router.push(`/auth/contract-studio?session_id=${sessionData.sessionId}`)
            } else {
                throw new Error('Submission failed')
            }
        } catch (error) {
            console.error('Submission error:', error)
            // For demo, proceed anyway
            router.push(`/auth/contract-studio?session_id=${sessionData.sessionId}`)
        } finally {
            setSubmitting(false)
        }
    }

    // ========================================================================
    // SECTION 9: LOADING STATE
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-3 border-slate-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Preparing your assessment...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 10: INTRO SCREEN
    // ========================================================================

    if (showIntro) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="text-4xl font-light text-white mb-2 tracking-wide">CLARENCE</div>
                        <div className="text-xs text-emerald-400 tracking-[0.3em] font-light">STRATEGIC ASSESSMENT</div>
                    </div>

                    {/* Intro Card */}
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-light text-white mb-3">
                                Let&apos;s Talk Strategy
                            </h1>
                            <p className="text-slate-400 leading-relaxed max-w-md mx-auto">
                                I need to understand your negotiating position to represent your interests effectively.
                                These questions are confidential and help me calculate your leverage accurately.
                            </p>
                        </div>

                        {/* What to Expect */}
                        <div className="bg-slate-700/30 rounded-xl p-6 mb-6">
                            <h3 className="text-white font-medium mb-4">What to Expect</h3>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-emerald-400 text-xs font-medium">13</span>
                                    </div>
                                    <p className="text-sm text-slate-300">Strategic questions about your position and alternatives</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-300">All answers are completely confidential</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-300">Takes approximately 5-8 minutes</p>
                                </div>
                            </div>
                        </div>

                        {/* Opportunity Context */}
                        {sessionData && (
                            <div className="bg-gradient-to-r from-emerald-600/10 to-blue-600/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="text-xs text-emerald-400">Opportunity:</div>
                                    <div className="text-white font-medium">{sessionData.customerCompany}</div>
                                    <div className="text-slate-500">•</div>
                                    <div className="text-slate-300">{sessionData.serviceRequired}</div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setShowIntro(false)}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                            Begin Assessment
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-6 text-xs text-slate-500">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 11: MAIN QUESTIONNAIRE RENDER
    // ========================================================================

    const question = STRATEGIC_QUESTIONS[currentQuestion]
    const progress = ((currentQuestion + 1) / STRATEGIC_QUESTIONS.length) * 100
    const isLastQuestion = currentQuestion === STRATEGIC_QUESTIONS.length - 1

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="bg-slate-800/50 backdrop-blur border-b border-slate-700/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <div>
                                <div className="text-2xl font-light text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-500 tracking-widest font-light">STRATEGIC ASSESSMENT</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-slate-400 text-sm">
                                Question {currentQuestion + 1} of {STRATEGIC_QUESTIONS.length}
                            </span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Progress Bar */}
            <div className="bg-slate-800/30">
                <div className="max-w-4xl mx-auto">
                    <div className="h-1 bg-slate-700/50">
                        <div
                            className="h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-2xl mx-auto px-4 py-12">
                {/* Category Badge */}
                <div className="mb-6">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                        {question.category}
                    </span>
                </div>

                {/* Question Card */}
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8 mb-6">
                    {/* CLARENCE Avatar */}
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white text-lg leading-relaxed">{question.question}</p>
                            {question.helpText && (
                                <p className="text-slate-400 text-sm mt-2">{question.helpText}</p>
                            )}
                        </div>
                    </div>

                    {/* Answer Input */}
                    <div className="mt-6">
                        {question.inputType === 'textarea' && (
                            <textarea
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500 resize-none"
                                rows={4}
                                placeholder={question.placeholder || "Type your answer..."}
                                value={(answers[question.id] as string) || ''}
                                onChange={(e) => handleAnswer(question.id, e.target.value)}
                            />
                        )}

                        {question.inputType === 'scale' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-sm">Not confident</span>
                                    <span className="text-2xl font-light text-white">
                                        {(answers[question.id] as number) || '—'}
                                    </span>
                                    <span className="text-slate-400 text-sm">Very confident</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    className="w-full accent-emerald-500"
                                    value={(answers[question.id] as number) || 5}
                                    onChange={(e) => handleAnswer(question.id, parseInt(e.target.value))}
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <span key={n}>{n}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {question.inputType === 'select' && question.options && (
                            <div className="space-y-2">
                                {question.options.map((option, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(question.id, option)}
                                        className={`w-full p-4 rounded-xl text-left transition-all cursor-pointer ${answers[question.id] === option
                                                ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-white'
                                                : 'bg-slate-700/30 border border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${answers[question.id] === option
                                                    ? 'border-emerald-500 bg-emerald-500'
                                                    : 'border-slate-500'
                                                }`}>
                                                {answers[question.id] === option && (
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="text-sm">{option}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={prevQuestion}
                        disabled={currentQuestion === 0}
                        className={`px-6 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${currentQuestion === 0
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                    </button>

                    {!isLastQuestion ? (
                        <button
                            onClick={nextQuestion}
                            disabled={!isCurrentAnswered()}
                            className={`px-6 py-2.5 rounded-xl font-medium transition flex items-center gap-2 cursor-pointer ${isCurrentAnswered()
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            Next
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!isCurrentAnswered() || submitting}
                            className={`px-8 py-2.5 rounded-xl font-medium transition flex items-center gap-2 cursor-pointer ${isCurrentAnswered() && !submitting
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    Complete Assessment
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Question Navigation Dots */}
                <div className="flex justify-center mt-8 gap-1.5">
                    {STRATEGIC_QUESTIONS.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentQuestion(idx)}
                            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${idx === currentQuestion
                                    ? 'bg-emerald-500 w-6'
                                    : idx < currentQuestion || answers[STRATEGIC_QUESTIONS[idx].id]
                                        ? 'bg-emerald-500/50'
                                        : 'bg-slate-600'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pb-8 text-xs text-slate-500">
                © {new Date().getFullYear()} CLARENCE by Spike Island Studios
            </div>
        </div>
    )
}