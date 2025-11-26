'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================
interface CustomerRequirements {
    // Session & Company
    sessionId: string
    sessionNumber: string
    companyName: string
    companySize: string
    contactName: string
    contactEmail: string
    industry: string
    annualRevenue: string

    // Market Dynamics (for leverage - Algorithm 25% weight)
    numberOfBidders: string
    marketPosition: string
    decisionTimeline: string
    incumbentStatus: string

    // Service Requirements
    serviceRequired: string
    serviceCriticality: string
    businessChallenge: string
    desiredOutcome: string

    // BATNA (for leverage - Algorithm 25% weight)
    alternativeOptions: string
    inHouseCapability: string
    walkAwayPoint: string

    // Economic Factors (for leverage - Algorithm 25% weight)
    dealValue: string
    switchingCosts: string
    budgetFlexibility: string

    // Commercial Terms
    budgetMin: number
    budgetMax: number
    paymentTermsPreference: string
    contractDuration: string

    // Contract Positions (Customer's starting positions)
    contractPositions: {
        liabilityCap: number
        paymentTerms: number
        slaTarget: number
        dataRetention: number
        terminationNotice: number
    }

    // Priorities (point allocation per algorithm)
    priorities: {
        cost: number
        quality: number
        speed: number
        innovation: number
        riskMitigation: number
    }

    // Technical & Compliance Requirements
    securityRequirements: string[]
    integrationNeeds: string
    dataLocation: string
    auditRequirements: string

    // Additional Context
    previousSimilarProjects: string
    internalResourcesAvailable: string
    competitiveSituation: string
    additionalContext: string
}

interface ChatMessage {
    id: string
    type: 'user' | 'clarence'
    content: string
    timestamp: Date
}

type NestedKeyOf<T> = keyof T | 'contractPositions' | 'priorities'

interface StepComponentProps {
    formData: Partial<CustomerRequirements>
    updateFormData: (field: keyof CustomerRequirements, value: string | number | string[]) => void
}

interface NestedStepComponentProps {
    formData: Partial<CustomerRequirements>
    updateNestedData: (section: NestedKeyOf<CustomerRequirements>, field: string, value: string | number) => void
}

interface PrioritiesStepProps extends NestedStepComponentProps {
    priorityPoints: number
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================
const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 3: MAIN COMPONENT WRAPPER (for Suspense)
// ============================================================================
export default function CustomerRequirementsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading form...</p>
                </div>
            </div>
        }>
            <CustomerRequirementsForm />
        </Suspense>
    )
}

// ============================================================================
// SECTION 4: MAIN FORM COMPONENT
// ============================================================================
function CustomerRequirementsForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chatEndRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 5: STATE DECLARATIONS
    // ========================================================================
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [currentStep, setCurrentStep] = useState(1)
    const [totalSteps] = useState(9) // UPDATED: Now 9 steps
    const [priorityPoints, setPriorityPoints] = useState(25)

    // Session state
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [sessionNumber, setSessionNumber] = useState<string | null>(null)

    // Chat state
    const [chatOpen, setChatOpen] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    // ========================================================================
    // SECTION 6: FORM STATE
    // ========================================================================
    const [formData, setFormData] = useState<Partial<CustomerRequirements>>({
        // Contract positions defaults
        contractPositions: {
            liabilityCap: 200,
            paymentTerms: 45,
            slaTarget: 99.5,
            dataRetention: 5,
            terminationNotice: 60
        },
        // Priority defaults
        priorities: {
            cost: 5,
            quality: 5,
            speed: 5,
            innovation: 5,
            riskMitigation: 5
        },
        // Commercial defaults
        budgetMin: 0,
        budgetMax: 0,
        paymentTermsPreference: '',
        contractDuration: '',
        // Technical defaults
        securityRequirements: [],
        integrationNeeds: '',
        dataLocation: '',
        auditRequirements: ''
    })

    // ========================================================================
    // SECTION 7: INITIALIZE FROM URL PARAMS
    // ========================================================================
    useEffect(() => {
        const urlSessionId = searchParams.get('session_id')
        const urlSessionNumber = searchParams.get('session_number')

        if (urlSessionId) {
            setSessionId(urlSessionId)
            setFormData(prev => ({ ...prev, sessionId: urlSessionId }))
        }

        if (urlSessionNumber) {
            setSessionNumber(urlSessionNumber)
            setFormData(prev => ({ ...prev, sessionNumber: urlSessionNumber }))
        }

        // Load user info from localStorage
        const auth = localStorage.getItem('clarence_auth')
        if (auth) {
            try {
                const authData = JSON.parse(auth)
                setFormData(prev => ({
                    ...prev,
                    companyName: authData.userInfo?.company || '',
                    contactName: `${authData.userInfo?.firstName || ''} ${authData.userInfo?.lastName || ''}`.trim(),
                    contactEmail: authData.userInfo?.email || ''
                }))
            } catch (e) {
                console.error('Error parsing auth data:', e)
            }
        }

        // Add welcome message to chat
        setChatMessages([{
            id: '1',
            type: 'clarence',
            content: `Welcome! I'm CLARENCE, your contract negotiation assistant. I'm here to help you complete your requirements form.\n\nFeel free to ask me about:\n• What information to provide\n• How your answers affect leverage\n• Best practices for contract terms\n\nHow can I help you today?`,
            timestamp: new Date()
        }])

        setInitialLoading(false)
    }, [searchParams])

    // ========================================================================
    // SECTION 8: VALIDATION FUNCTIONS
    // ========================================================================
    const validatePriorityPoints = useCallback(() => {
        const total = Object.values(formData.priorities || {}).reduce((sum, val) => sum + val, 0)
        const remaining = 25 - total
        setPriorityPoints(remaining)
        return remaining >= 0
    }, [formData.priorities])

    useEffect(() => {
        validatePriorityPoints()
    }, [validatePriorityPoints])

    // ========================================================================
    // SECTION 9: FORM HANDLERS
    // ========================================================================
    const updateFormData = (field: keyof CustomerRequirements, value: string | number | string[]) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const updateNestedData = (section: NestedKeyOf<CustomerRequirements>, field: string, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...(prev[section as keyof CustomerRequirements] as Record<string, unknown>),
                [field]: value
            }
        }))
    }

    // ========================================================================
    // SECTION 10: FORM SUBMISSION (UPDATE, not INSERT)
    // ========================================================================
    const handleSubmit = async () => {
        if (!validatePriorityPoints()) {
            alert('Please adjust priority points to not exceed 25')
            return
        }

        if (!sessionId) {
            alert('Session ID is missing. Please go back to dashboard and create a new contract.')
            return
        }

        setLoading(true)
        try {
            const submissionData = {
                ...formData,
                sessionId: sessionId,
                sessionNumber: sessionNumber,
                timestamp: new Date().toISOString(),
                formVersion: '7.0',
                formSource: 'customer-requirements-form'
            }

            // Call the N8N webhook to UPDATE the session (not create)
            const response = await fetch(`${API_BASE}/customer-requirements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            })

            if (response.ok) {
                // Handle empty or non-JSON responses gracefully
                let result = null
                const responseText = await response.text()

                if (responseText && responseText.trim()) {
                    try {
                        result = JSON.parse(responseText)
                        console.log('Requirements submitted:', result)
                    } catch (parseError) {
                        // Response was not JSON, but that's okay if status was OK
                        console.log('Requirements submitted (no JSON response)')
                    }
                } else {
                    console.log('Requirements submitted (empty response)')
                }

                // Redirect to strategic assessment (next phase)
                router.push(`/auth/strategic-assessment?session_id=${sessionId}&session_number=${sessionNumber}`)
            } else {
                // Try to get error message from response
                let errorMessage = 'Submission failed'
                try {
                    const errorText = await response.text()
                    if (errorText) {
                        const errorData = JSON.parse(errorText)
                        errorMessage = errorData.error || errorData.message || errorMessage
                    }
                } catch {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`
                }
                throw new Error(errorMessage)
            }
        } catch (error) {
            console.error('Submission error:', error)
            alert('Failed to submit requirements. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 11: CHAT FUNCTIONS
    // ========================================================================
    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: chatInput.trim(),
            timestamp: new Date()
        }

        setChatMessages(prev => [...prev, userMessage])
        setChatInput('')
        setChatLoading(true)

        try {
            // Build context from current form state
            const context = {
                currentStep,
                stepName: getStepName(currentStep),
                formData: formData,
                sessionId,
                sessionNumber
            }

            const response = await fetch(`${API_BASE}/clarence-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    context: context,
                    chatHistory: chatMessages.slice(-10)
                })
            })

            if (response.ok) {
                const data = await response.json()
                const clarenceMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    type: 'clarence',
                    content: data.response || data.message || 'I apologize, I could not process that request.',
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, clarenceMessage])
            } else {
                throw new Error('Chat request failed')
            }
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'clarence',
                content: 'I apologize, I encountered an issue. Please try again or continue with the form.',
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setChatLoading(false)
        }
    }

    // UPDATED: Step names for 9 steps
    const getStepName = (step: number): string => {
        const stepNames: Record<number, string> = {
            1: 'Company Information',
            2: 'Market Context & Leverage',
            3: 'Service Requirements',
            4: 'Alternative Options (BATNA)',
            5: 'Commercial Terms',
            6: 'Priority Allocation',
            7: 'Contract Positions',
            8: 'Technical & Compliance',
            9: 'Additional Context'
        }
        return stepNames[step] || 'Unknown Step'
    }

    // Scroll chat to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 12: STEP NAVIGATION
    // ========================================================================
    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    // ========================================================================
    // SECTION 13: RENDER STEPS - UPDATED FOR 9 STEPS
    // ========================================================================
    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <CompanyInfoStep formData={formData} updateFormData={updateFormData} />
            case 2:
                return <MarketContextStep formData={formData} updateFormData={updateFormData} />
            case 3:
                return <ServiceRequirementsStep formData={formData} updateFormData={updateFormData} />
            case 4:
                return <BATNAStep formData={formData} updateFormData={updateFormData} />
            case 5:
                return <CommercialTermsStep formData={formData} updateFormData={updateFormData} />
            case 6:
                return <PrioritiesStep formData={formData} updateNestedData={updateNestedData} priorityPoints={priorityPoints} />
            case 7:
                return <ContractPositionsStep formData={formData} updateNestedData={updateNestedData} />
            case 8:
                return <TechnicalRequirementsStep formData={formData} updateFormData={updateFormData} />
            case 9:
                return <AdditionalContextStep formData={formData} updateFormData={updateFormData} />
            default:
                return null
        }
    }

    // ========================================================================
    // SECTION 14: LOADING STATE
    // ========================================================================
    if (initialLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading form...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 15: MAIN RENDER
    // ========================================================================
    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* ================================================================ */}
            {/* SECTION 16: MAIN CONTENT AREA */}
            {/* ================================================================ */}
            <div className={`flex-1 transition-all duration-300 ${chatOpen ? 'mr-96' : ''}`}>
                {/* Navigation */}
                <nav className="bg-white shadow-sm border-b border-slate-200">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex items-center">
                                <Link href="/auth/contract-dashboard" className="flex items-center">
                                    <div>
                                        <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                                        <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                                    </div>
                                </Link>
                                <span className="ml-4 text-slate-600 text-sm">Customer Requirements</span>
                            </div>
                            <div className="flex items-center gap-4">
                                {sessionNumber && (
                                    <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                        {sessionNumber}
                                    </span>
                                )}
                                <button
                                    onClick={() => setChatOpen(!chatOpen)}
                                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all ${chatOpen
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white'
                                        }`}
                                >
                                    💬 {chatOpen ? 'Close Chat' : 'Ask CLARENCE'}
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Session Info Banner */}
                {sessionNumber && (
                    <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white py-3">
                        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-slate-300 text-xs">Session</span>
                                    <div className="font-mono text-sm">{sessionNumber}</div>
                                </div>
                                <div>
                                    <span className="text-slate-300 text-xs">Status</span>
                                    <div className="text-sm">
                                        <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded text-xs">
                                            Requirements In Progress
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-slate-300 text-xs">Phase</span>
                                    <div className="text-sm">1 - Deal Profile</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-3xl mx-auto px-4 py-8">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-slate-600">Step {currentStep} of {totalSteps}: {getStepName(currentStep)}</span>
                            <span className="text-sm text-slate-600">
                                {Math.round((currentStep / totalSteps) * 100)}% Complete
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-slate-600 to-slate-700 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                            />
                        </div>

                        {/* Step Indicators - Updated for 9 steps */}
                        <div className="flex justify-between mt-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => (
                                <button
                                    key={step}
                                    onClick={() => setCurrentStep(step)}
                                    className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${step === currentStep
                                        ? 'bg-slate-700 text-white'
                                        : step < currentStep
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-200 text-slate-500'
                                        }`}
                                    title={getStepName(step)}
                                >
                                    {step < currentStep ? '✓' : step}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Form Content */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        {renderStep()}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="mt-6 flex justify-between">
                        <button
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className={`px-6 py-2 rounded-lg transition-all ${currentStep === 1
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-600 text-white hover:bg-slate-700'
                                }`}
                        >
                            ← Previous
                        </button>

                        {currentStep < totalSteps ? (
                            <button
                                onClick={nextStep}
                                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all"
                            >
                                Next →
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading || priorityPoints < 0}
                                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>Submit & Continue to Strategic Assessment →</>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Save & Exit Option */}
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => router.push('/auth/contract-dashboard')}
                            className="text-sm text-slate-500 hover:text-slate-700 underline"
                        >
                            Save & Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 17: CLARENCE CHAT PANEL */}
            {/* ================================================================ */}
            <div className={`fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-xl transform transition-transform duration-300 z-50 ${chatOpen ? 'translate-x-0' : 'translate-x-full'
                }`}>
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                            🎓
                        </div>
                        <div>
                            <div className="font-medium">CLARENCE</div>
                            <div className="text-xs text-slate-300">Your Contract Assistant</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setChatOpen(false)}
                        className="text-white/70 hover:text-white p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Chat Context */}
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <div className="text-xs text-slate-500">
                        Currently on: <span className="font-medium text-slate-700">{getStepName(currentStep)}</span>
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100vh - 200px)' }}>
                    {chatMessages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 ${msg.type === 'user'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-100 text-slate-800'
                                    }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.type === 'user' ? 'text-slate-300' : 'text-slate-400'
                                    }`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}
                    {chatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Ask CLARENCE anything..."
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                        />
                        <button
                            onClick={sendChatMessage}
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all"
                        >
                            Send
                        </button>
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                        <button
                            onClick={() => setChatInput('What information should I provide here?')}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                        >
                            What info needed?
                        </button>
                        <button
                            onClick={() => setChatInput('How does this affect my leverage?')}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                        >
                            Leverage impact?
                        </button>
                        <button
                            onClick={() => setChatInput('What are best practices here?')}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                        >
                            Best practices?
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 18: STEP COMPONENTS
// ============================================================================

// STEP 1 - COMPANY INFO
function CompanyInfoStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Company Information</h2>

            {/* Session ID - Read Only if pre-populated */}
            {formData.sessionId && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Session ID:</span>
                        <span className="font-mono text-sm text-slate-800">{formData.sessionNumber || formData.sessionId}</span>
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded">Auto-assigned</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.companyName || ''}
                        onChange={(e) => updateFormData('companyName', e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.companySize || ''}
                        onChange={(e) => updateFormData('companySize', e.target.value)}
                    >
                        <option value="">Select Size</option>
                        <option value="1-50">Small (1-50)</option>
                        <option value="51-200">Medium (51-200)</option>
                        <option value="201-1000">Large (201-1000)</option>
                        <option value="1000+">Enterprise (1000+)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Annual Revenue
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.annualRevenue || ''}
                        onChange={(e) => updateFormData('annualRevenue', e.target.value)}
                    >
                        <option value="">Select Revenue</option>
                        <option value="<1M">Less than £1M</option>
                        <option value="1M-10M">£1M - £10M</option>
                        <option value="10M-50M">£10M - £50M</option>
                        <option value="50M-100M">£50M - £100M</option>
                        <option value="100M+">More than £100M</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.industry || ''}
                        onChange={(e) => updateFormData('industry', e.target.value)}
                        placeholder="e.g., Financial Services, Healthcare, Technology"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.contactName || ''}
                        onChange={(e) => updateFormData('contactName', e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.contactEmail || ''}
                        onChange={(e) => updateFormData('contactEmail', e.target.value)}
                    />
                </div>
            </div>
        </div>
    )
}

// STEP 2: Market Context & Leverage
function MarketContextStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Market Context & Leverage</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    💡 This information is critical for CLARENCE&apos;s leverage calculation algorithm, which determines negotiation dynamics.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Number of Competing Providers
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.numberOfBidders || ''}
                        onChange={(e) => updateFormData('numberOfBidders', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="1">Sole source (no competition)</option>
                        <option value="2-3">2-3 providers</option>
                        <option value="4-6">4-6 providers</option>
                        <option value="7+">7+ providers</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Your Market Position
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.marketPosition || ''}
                        onChange={(e) => updateFormData('marketPosition', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Dominant">Dominant buyer</option>
                        <option value="Strong">Strong position</option>
                        <option value="Neutral">Neutral position</option>
                        <option value="Weak">Limited options</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Deal Value (£)
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.dealValue || ''}
                        onChange={(e) => updateFormData('dealValue', e.target.value)}
                        placeholder="e.g., 1800000"
                    />
                    <p className="text-xs text-slate-500 mt-1">Annual contract value</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Decision Timeline
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.decisionTimeline || ''}
                        onChange={(e) => updateFormData('decisionTimeline', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Immediate">Immediate (this week)</option>
                        <option value="Fast">Fast (2 weeks)</option>
                        <option value="Normal">Normal (1 month)</option>
                        <option value="Extended">Extended (2-3 months)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Incumbent Status
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.incumbentStatus || ''}
                        onChange={(e) => updateFormData('incumbentStatus', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="no-incumbent">No current provider</option>
                        <option value="replacing-poor">Replacing poor performer</option>
                        <option value="replacing-good">Replacing good performer</option>
                        <option value="expanding">Expanding current provider</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Estimated Switching Costs
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.switchingCosts || ''}
                        onChange={(e) => updateFormData('switchingCosts', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="minimal">Minimal (&lt;£10k)</option>
                        <option value="moderate">Moderate (£10-50k)</option>
                        <option value="high">High (£50-200k)</option>
                        <option value="prohibitive">Prohibitive (&gt;£200k)</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

// STEP 3: Service Requirements
function ServiceRequirementsStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Service Requirements</h2>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Service Category <span className="text-red-500">*</span>
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.serviceRequired || ''}
                        onChange={(e) => updateFormData('serviceRequired', e.target.value)}
                    >
                        <option value="">Select Service</option>
                        <option value="Back Office Operations">Back Office Operations</option>
                        <option value="Customer Support">Customer Support</option>
                        <option value="Technical Support">Technical Support</option>
                        <option value="Data Processing">Data Processing</option>
                        <option value="IT Services">IT Services</option>
                        <option value="Finance & Accounting">Finance & Accounting</option>
                        <option value="HR Services">HR Services</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Service Criticality
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.serviceCriticality || ''}
                        onChange={(e) => updateFormData('serviceCriticality', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="mission-critical">Mission Critical</option>
                        <option value="business-critical">Business Critical</option>
                        <option value="important">Important</option>
                        <option value="standard">Standard</option>
                        <option value="non-core">Non-core</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Challenge <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={4}
                    value={formData.businessChallenge || ''}
                    onChange={(e) => updateFormData('businessChallenge', e.target.value)}
                    placeholder="Describe the specific business challenge you're trying to solve..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Desired Outcome <span className="text-red-500">*</span>
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={4}
                    value={formData.desiredOutcome || ''}
                    onChange={(e) => updateFormData('desiredOutcome', e.target.value)}
                    placeholder="What does success look like for this engagement?"
                />
            </div>
        </div>
    )
}

// STEP 4: BATNA Assessment
function BATNAStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Alternative Options (BATNA)</h2>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                    ⚖️ Your Best Alternative to a Negotiated Agreement (BATNA) significantly impacts your leverage.
                    Be honest - this information helps CLARENCE negotiate effectively on your behalf.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    What are your alternatives if this negotiation fails?
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    value={formData.alternativeOptions || ''}
                    onChange={(e) => updateFormData('alternativeOptions', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="strong-alternatives">Multiple strong alternatives available</option>
                    <option value="some-alternatives">Some viable alternatives exist</option>
                    <option value="limited-alternatives">Limited alternatives</option>
                    <option value="no-alternatives">No real alternatives</option>
                    <option value="in-house">Could bring in-house (with investment)</option>
                    <option value="delay">Could delay/defer the requirement</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    In-house capability to deliver this service?
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    value={formData.inHouseCapability || ''}
                    onChange={(e) => updateFormData('inHouseCapability', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="full">Full capability exists</option>
                    <option value="partial">Partial capability (would need investment)</option>
                    <option value="buildable">Could build capability over time</option>
                    <option value="none">No in-house capability</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Walk-away Point / Exit Strategy
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    value={formData.walkAwayPoint || ''}
                    onChange={(e) => updateFormData('walkAwayPoint', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="can-delay">Can delay decision if necessary</option>
                    <option value="hard-deadline">Hard deadline - must decide by specific date</option>
                    <option value="in-house-fallback">Could bring in-house as fallback</option>
                    <option value="alternative-provider">Have alternative provider ready</option>
                    <option value="status-quo">Can continue with current situation</option>
                    <option value="no-alternative">No viable alternative - must reach agreement</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">This remains confidential and helps CLARENCE understand your negotiating flexibility</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Budget Flexibility
                </label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    value={formData.budgetFlexibility || ''}
                    onChange={(e) => updateFormData('budgetFlexibility', e.target.value)}
                >
                    <option value="">Select</option>
                    <option value="fixed">Fixed budget - no flexibility</option>
                    <option value="limited">Limited flexibility (up to 10%)</option>
                    <option value="moderate">Moderate flexibility (10-15%)</option>
                    <option value="flexible">Flexible (15-25%)</option>
                    <option value="very-flexible">Very flexible (25%+)</option>
                </select>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 19: NEW STEP - COMMERCIAL TERMS
// ============================================================================
function CommercialTermsStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Commercial Terms</h2>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800">
                    💰 Define your budget range and commercial preferences. This helps CLARENCE understand your financial boundaries.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Budget Minimum (£)
                    </label>
                    <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.budgetMin || ''}
                        onChange={(e) => updateFormData('budgetMin', parseInt(e.target.value) || 0)}
                        placeholder="e.g., 1500000"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Budget Maximum (£)
                    </label>
                    <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.budgetMax || ''}
                        onChange={(e) => updateFormData('budgetMax', parseInt(e.target.value) || 0)}
                        placeholder="e.g., 2000000"
                    />
                </div>
            </div>

            {formData.budgetMin && formData.budgetMax && formData.budgetMin > 0 && formData.budgetMax > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700">
                        <span className="font-medium">Budget Range:</span> £{formData.budgetMin.toLocaleString()} - £{formData.budgetMax.toLocaleString()}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Payment Terms Preference
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.paymentTermsPreference || ''}
                        onChange={(e) => updateFormData('paymentTermsPreference', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="NET-15">NET 15 days</option>
                        <option value="NET-30">NET 30 days</option>
                        <option value="NET-45">NET 45 days</option>
                        <option value="NET-60">NET 60 days</option>
                        <option value="NET-90">NET 90 days</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Contract Duration
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.contractDuration || ''}
                        onChange={(e) => updateFormData('contractDuration', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="12">12 months</option>
                        <option value="24">24 months</option>
                        <option value="36">36 months</option>
                        <option value="48">48 months</option>
                        <option value="60">60 months</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

// STEP 6: Contract Positions (was Step 5)
function ContractPositionsStep({ formData, updateNestedData }: NestedStepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Initial Contract Positions</h2>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-purple-800">
                    📋 Set your starting positions on key contract terms. CLARENCE will use these as the basis for negotiation.
                </p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Liability Cap (% of annual contract value): <span className="font-bold text-slate-800">{formData.contractPositions?.liabilityCap}%</span>
                    </label>
                    <input
                        type="range"
                        min="100"
                        max="500"
                        step="25"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        value={formData.contractPositions?.liabilityCap || 200}
                        onChange={(e) => updateNestedData('contractPositions', 'liabilityCap', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>100% (Provider-friendly)</span>
                        <span>300% (Standard)</span>
                        <span>500% (Customer-friendly)</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Terms: <span className="font-bold text-slate-800">{formData.contractPositions?.paymentTerms} days</span>
                    </label>
                    <input
                        type="range"
                        min="15"
                        max="90"
                        step="15"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        value={formData.contractPositions?.paymentTerms || 45}
                        onChange={(e) => updateNestedData('contractPositions', 'paymentTerms', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>15 days (Provider-friendly)</span>
                        <span>45 days</span>
                        <span>90 days (Customer-friendly)</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        SLA Target: <span className="font-bold text-slate-800">{formData.contractPositions?.slaTarget}%</span>
                    </label>
                    <input
                        type="range"
                        min="95"
                        max="99.9"
                        step="0.1"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        value={formData.contractPositions?.slaTarget || 99.5}
                        onChange={(e) => updateNestedData('contractPositions', 'slaTarget', parseFloat(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>95% (Basic)</span>
                        <span>99% (Standard)</span>
                        <span>99.9% (Premium)</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Data Retention: <span className="font-bold text-slate-800">{formData.contractPositions?.dataRetention} years</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        value={formData.contractPositions?.dataRetention || 5}
                        onChange={(e) => updateNestedData('contractPositions', 'dataRetention', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>1 year</span>
                        <span>5 years</span>
                        <span>10 years</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Termination Notice: <span className="font-bold text-slate-800">{formData.contractPositions?.terminationNotice} days</span>
                    </label>
                    <input
                        type="range"
                        min="30"
                        max="180"
                        step="30"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        value={formData.contractPositions?.terminationNotice || 60}
                        onChange={(e) => updateNestedData('contractPositions', 'terminationNotice', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>30 days (Customer-friendly)</span>
                        <span>90 days</span>
                        <span>180 days (Provider-friendly)</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// STEP 7: Priorities with Point System (was Step 6)
function PrioritiesStep({ formData, updateNestedData, priorityPoints }: PrioritiesStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Priority Allocation</h2>

            <div className={`border rounded-lg p-4 mb-6 ${priorityPoints >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            Priority Points Remaining: <span className={`text-lg ${priorityPoints >= 0 ? 'text-green-700' : 'text-red-700'}`}>{priorityPoints}</span> / 25
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                            Allocate 25 points total across priorities. This forces realistic trade-offs and informs CLARENCE&apos;s negotiation strategy.
                        </p>
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${priorityPoints >= 0 ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'
                        }`}>
                        {priorityPoints}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {Object.entries({
                    cost: 'Cost Optimization',
                    quality: 'Quality Standards',
                    speed: 'Speed of Delivery',
                    innovation: 'Innovation & Technology',
                    riskMitigation: 'Risk Mitigation'
                }).map(([key, label]) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {label}: <span className="font-bold text-slate-800">{(formData.priorities as Record<string, number>)?.[key]} points</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="1"
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            value={(formData.priorities as Record<string, number>)?.[key] || 5}
                            onChange={(e) => updateNestedData('priorities', key, parseInt(e.target.value))}
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>0 (Not important)</span>
                            <span>5 (Moderate)</span>
                            <span>10 (Critical)</span>
                        </div>
                    </div>
                ))}
            </div>

            {priorityPoints < 0 && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                    <p className="font-medium">Points exceeded!</p>
                    <p className="text-sm">Please reduce point allocations to stay within 25 total points.</p>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 20: NEW STEP - TECHNICAL & COMPLIANCE REQUIREMENTS
// ============================================================================
function TechnicalRequirementsStep({ formData, updateFormData }: StepComponentProps) {
    const securityOptions = [
        'ISO 27001',
        'SOC2 Type II',
        'GDPR Compliance',
        'PCI-DSS',
        'Cyber Essentials',
        'Cyber Essentials Plus',
        'HIPAA'
    ]

    const handleSecurityChange = (option: string, checked: boolean) => {
        const current = formData.securityRequirements || []
        if (checked) {
            updateFormData('securityRequirements', [...current, option])
        } else {
            updateFormData('securityRequirements', current.filter(s => s !== option))
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Technical & Compliance Requirements</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    🔒 Define your security, compliance, and integration requirements. These often become non-negotiable contract terms.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                    Security & Compliance Certifications Required
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {securityOptions.map((option) => (
                        <label key={option} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={(formData.securityRequirements || []).includes(option)}
                                onChange={(e) => handleSecurityChange(option, e.target.checked)}
                                className="w-4 h-4 text-slate-600 rounded focus:ring-slate-500"
                            />
                            <span className="text-sm text-slate-700">{option}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Integration Requirements
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={3}
                    value={formData.integrationNeeds || ''}
                    onChange={(e) => updateFormData('integrationNeeds', e.target.value)}
                    placeholder="e.g., SAP integration, Oracle Financials, Salesforce CRM, REST API access..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Data Location Requirements
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.dataLocation || ''}
                        onChange={(e) => updateFormData('dataLocation', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="uk-only">UK only</option>
                        <option value="uk-eu">UK or EU</option>
                        <option value="eu-only">EU only</option>
                        <option value="eea">EEA (European Economic Area)</option>
                        <option value="global">No restrictions</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Audit Requirements
                    </label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.auditRequirements || ''}
                        onChange={(e) => updateFormData('auditRequirements', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="full">Full audit rights (annual on-site)</option>
                        <option value="limited">Limited audit rights (with notice)</option>
                        <option value="third-party">Third-party audit reports only</option>
                        <option value="none">No specific requirements</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 21: NEW STEP - ADDITIONAL CONTEXT
// ============================================================================
function AdditionalContextStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Additional Context</h2>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800">
                    📝 This information helps CLARENCE understand the full picture and negotiate more effectively on your behalf.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Previous Similar Projects
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={3}
                    value={formData.previousSimilarProjects || ''}
                    onChange={(e) => updateFormData('previousSimilarProjects', e.target.value)}
                    placeholder="Describe any previous similar engagements, what worked, what didn't..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Internal Resources Available
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={3}
                    value={formData.internalResourcesAvailable || ''}
                    onChange={(e) => updateFormData('internalResourcesAvailable', e.target.value)}
                    placeholder="e.g., Project manager available, IT team for integration, dedicated budget for change management..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Competitive Situation
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={3}
                    value={formData.competitiveSituation || ''}
                    onChange={(e) => updateFormData('competitiveSituation', e.target.value)}
                    placeholder="Describe your evaluation criteria, decision-making process, other providers being considered..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Any Other Relevant Information
                </label>
                <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    rows={3}
                    value={formData.additionalContext || ''}
                    onChange={(e) => updateFormData('additionalContext', e.target.value)}
                    placeholder="Anything else CLARENCE should know about this engagement..."
                />
            </div>

            {/* Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mt-8">
                <h3 className="text-lg font-medium text-slate-800 mb-4">📋 Ready to Submit</h3>
                <p className="text-sm text-slate-600 mb-4">
                    After submitting, you&apos;ll proceed to the Strategic Assessment where CLARENCE will ask probing questions
                    to calculate your leverage position and prepare for negotiation.
                </p>
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>All information is confidential and only used to improve your negotiation position</span>
                </div>
            </div>
        </div>
    )
}