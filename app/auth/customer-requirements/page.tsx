'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger';

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

    // Contract Type & Template (NEW)
    contractTypeId: string
    contractTypeCode: string
    serviceRequired: string
    templatePackId: string
    templateName: string

    // Market Dynamics (for leverage - Algorithm 25% weight)
    numberOfBidders: string
    marketPosition: string
    decisionTimeline: string
    incumbentStatus: string

    // Service Requirements
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

// ============================================================================
// SECTION 1A: CONTRACT TYPE & TEMPLATE INTERFACES (NEW)
// ============================================================================
interface ContractTemplate {
    packId: string
    packName: string
    version: string
    isDefault: boolean
    isCustom: boolean
    isPublic: boolean
    clauseCount: number
    createdAt: string
}

interface ContractType {
    typeId: string
    typeName: string
    typeCode: string
    description: string
    icon: string
    displayOrder: number
    isActive: boolean
    templateCount: number
    defaultTemplate: {
        packId: string
        packName: string
        version: string
        clauseCount: number
    } | null
    templates: ContractTemplate[]
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

// NEW: Service Requirements Step Props with contract types
interface ServiceRequirementsStepProps extends StepComponentProps {
    contractTypes: ContractType[]
    contractTypesLoading: boolean
    selectedContractType: ContractType | null
    onContractTypeChange: (typeId: string) => void
}

// NEW: Template Selection Step Props
interface TemplateSelectionStepProps {
    formData: Partial<CustomerRequirements>
    selectedContractType: ContractType | null
    selectedTemplate: ContractTemplate | null
    onTemplateSelect: (template: ContractTemplate) => void
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================
const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// ENHANCED TRUST BANNER COMPONENT
// Location: Replace SECTION 2A in customer-requirements.tsx
// 
// This updated component addresses John's data protection feedback:
// - Minimal personal data collection (name + work email only)
// - Data sovereignty messaging
// - AI training data assurance
// - Third-party platform security
// ============================================================================

function TrustBanner({ onLearnMore }: { onLearnMore: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl shadow-lg mb-8 overflow-hidden">
            {/* Main Banner */}
            <div className="p-6">
                <div className="flex items-start gap-4">
                    {/* Shield Icon */}
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">
                            Your Information is Protected
                        </h3>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            CLARENCE uses the information you provide to calculate leverage, identify fair positions, and broker effective compromises.
                            <span className="text-emerald-400 font-medium"> Your sensitive details—like budget limits, walk-away points, and BATNA—are never shared directly with the other party.</span>
                        </p>

                        {/* Expand/Collapse */}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="mt-3 text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                            {isExpanded ? 'Hide details' : 'How does CLARENCE protect my data?'}
                            <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="bg-slate-900/50 border-t border-slate-700 p-6">
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* What CLARENCE Does */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h4 className="font-medium text-emerald-400">What CLARENCE Does</h4>
                            </div>
                            <ul className="space-y-2 text-sm text-slate-300">
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-1">•</span>
                                    Calculates your leverage position
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-1">•</span>
                                    Identifies fair compromise zones
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-1">•</span>
                                    Suggests strategic trade-offs
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-1">•</span>
                                    Recommends optimal positions
                                </li>
                            </ul>
                        </div>

                        {/* What CLARENCE Never Shares */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                </div>
                                <h4 className="font-medium text-red-400">Never Shared with Other Party</h4>
                            </div>
                            <ul className="space-y-2 text-sm text-slate-300">
                                <li className="flex items-start gap-2">
                                    <span className="text-red-400 mt-1">•</span>
                                    Your budget limits or ranges
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-400 mt-1">•</span>
                                    Walk-away points or BATNA
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-400 mt-1">•</span>
                                    Internal constraints or pressures
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-400 mt-1">•</span>
                                    Priority weightings or flexibility
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Data Protection Section - NEW */}
                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h4 className="font-medium text-blue-400">Data Protection & Privacy</h4>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">Minimal Personal Data</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            We only collect your name and work email address. No phone numbers or personal identifiers.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">Secure Data Storage</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Your data is stored securely with enterprise-grade encryption. Multi-tenant architecture ensures complete isolation.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">No AI Training on Your Data</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Your business data is never used to train CLARENCE or any AI models. We use only anonymised, generic data for improvements.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-200">The Honest Broker Principle</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            CLARENCE works equally with both parties, finding genuine common ground without advantaging either side.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Link */}
                        <div className="mt-4 text-center">
                            <a
                                href="/security"
                                className="text-xs text-slate-400 hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                            >
                                View our Security & Privacy Policy
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 2B: CONFIDENTIALITY NOTICE COMPONENT (for sensitive sections)
// ============================================================================
function ConfidentialityNotice({ type }: { type: 'batna' | 'budget' | 'priority' | 'context' }) {
    const notices = {
        batna: {
            icon: '🔐',
            title: 'Confidential Information',
            message: 'Your alternatives and walk-away points are never revealed to the other party. CLARENCE uses this to understand your true negotiating flexibility and recommend positions accordingly.',
            color: 'amber'
        },
        budget: {
            icon: '💰',
            title: 'Budget Confidentiality',
            message: 'Your budget range remains strictly confidential. CLARENCE uses this to ensure recommendations fall within your means, not to inform the other party of your limits.',
            color: 'green'
        },
        priority: {
            icon: '⚖️',
            title: 'Strategic Priorities Protected',
            message: 'Your priority allocation reveals what you value most. CLARENCE uses this internally to identify trade-off opportunities—your weightings are never disclosed.',
            color: 'purple'
        },
        context: {
            icon: '📋',
            title: 'Context for Better Mediation',
            message: 'This additional context helps CLARENCE understand the full picture. Sensitive details about your situation, constraints, or alternatives remain confidential.',
            color: 'blue'
        }
    }

    const notice = notices[type]
    const colorClasses = {
        amber: 'bg-amber-50 border-amber-200 text-amber-800',
        green: 'bg-green-50 border-green-200 text-green-800',
        purple: 'bg-purple-50 border-purple-200 text-purple-800',
        blue: 'bg-blue-50 border-blue-200 text-blue-800'
    }

    return (
        <div className={`border rounded-lg p-4 mb-6 ${colorClasses[notice.color as keyof typeof colorClasses]}`}>
            <div className="flex items-start gap-3">
                <span className="text-xl">{notice.icon}</span>
                <div>
                    <p className="font-medium text-sm">{notice.title}</p>
                    <p className="text-sm mt-1 opacity-90">{notice.message}</p>
                </div>
            </div>
        </div>
    )
}

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
    const [totalSteps] = useState(10) // UPDATED: Now 10 steps
    const [priorityPoints, setPriorityPoints] = useState(25)

    // Session state
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [sessionNumber, setSessionNumber] = useState<string | null>(null)

    // Chat state
    const [chatOpen, setChatOpen] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    // NEW: Contract Types & Template State
    const [contractTypes, setContractTypes] = useState<ContractType[]>([])
    const [contractTypesLoading, setContractTypesLoading] = useState(true)
    const [selectedContractType, setSelectedContractType] = useState<ContractType | null>(null)
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)

    // ========================================================================
    // SECTION 6: FORM STATE
    // ========================================================================
    const [formData, setFormData] = useState<Partial<CustomerRequirements>>({
        // Contract type & template (NEW)
        contractTypeId: '',
        contractTypeCode: '',
        serviceRequired: '',
        templatePackId: '',
        templateName: '',
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
    // SECTION 7: FETCH CONTRACT TYPES ON MOUNT
    // ========================================================================
    useEffect(() => {
        const fetchContractTypes = async () => {
            try {
                setContractTypesLoading(true)
                const response = await fetch(`${API_BASE}/contract-types-api`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.contractTypes) {
                        setContractTypes(data.contractTypes)
                        console.log('Contract types loaded:', data.contractTypes.length)
                    }
                }
            } catch (error) {
                console.error('Error fetching contract types:', error)
            } finally {
                setContractTypesLoading(false)
            }
        }

        fetchContractTypes()
    }, [])

    // ========================================================================
    // SECTION 8: INITIALIZE FROM URL PARAMS
    // ========================================================================
    useEffect(() => {
        const urlSessionId = searchParams.get('session_id')
        const urlSessionNumber = searchParams.get('session_number')

        if (urlSessionId) {
            setSessionId(urlSessionId)
            setFormData(prev => ({ ...prev, sessionId: urlSessionId }))
            eventLogger.setSession(urlSessionId)
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
                if (authData.userInfo?.userId) {
                    eventLogger.setUser(authData.userInfo.userId)
                }
            } catch (e) {
                console.error('Error parsing auth data:', e)
            }
        }

        // Welcome message
        setChatMessages([{
            id: '1',
            type: 'clarence',
            content: `Welcome! I'm CLARENCE, your contract negotiation mediator.

**Important:** I work as a neutral broker between you and your provider. While I'll use the information you share to calculate leverage and find fair positions, I will never share your sensitive details—like budget limits, walk-away points, or priorities—directly with the other party.

Think of me as a trusted advisor who understands both sides but keeps confidences.

I'm here to help you complete your requirements. Feel free to ask about:
• What information to provide
• How your answers affect leverage
• How I protect your confidentiality

How can I help you today?`,
            timestamp: new Date()
        }])

        eventLogger.completed('customer_requirements', 'requirements_form_loaded', {
            sessionId: urlSessionId,
            sessionNumber: urlSessionNumber
        })

        setInitialLoading(false)
    }, [searchParams])

    // ========================================================================
    // SECTION 9: CONTRACT TYPE CHANGE HANDLER (NEW)
    // ========================================================================
    const handleContractTypeChange = (typeId: string) => {
        const contractType = contractTypes.find(ct => ct.typeId === typeId)
        setSelectedContractType(contractType || null)

        if (contractType) {
            // Update form data with contract type info
            setFormData(prev => ({
                ...prev,
                contractTypeId: contractType.typeId,
                contractTypeCode: contractType.typeCode,
                serviceRequired: contractType.typeName
            }))

            // Auto-select default template if available
            if (contractType.defaultTemplate) {
                const defaultTpl = contractType.templates.find(t => t.isDefault) || contractType.templates[0]
                if (defaultTpl) {
                    handleTemplateSelect(defaultTpl)
                }
            } else {
                // Clear template selection if no templates available
                setSelectedTemplate(null)
                setFormData(prev => ({
                    ...prev,
                    templatePackId: '',
                    templateName: ''
                }))
            }
        } else {
            // Clear selections
            setSelectedTemplate(null)
            setFormData(prev => ({
                ...prev,
                contractTypeId: '',
                contractTypeCode: '',
                serviceRequired: '',
                templatePackId: '',
                templateName: ''
            }))
        }
    }

    // ========================================================================
    // SECTION 10: TEMPLATE SELECTION HANDLER (NEW)
    // ========================================================================
    const handleTemplateSelect = (template: ContractTemplate) => {
        setSelectedTemplate(template)
        setFormData(prev => ({
            ...prev,
            templatePackId: template.packId,
            templateName: template.packName
        }))
    }

    // ========================================================================
    // SECTION 11: VALIDATION FUNCTIONS
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
    // SECTION 12: FORM HANDLERS
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
    // SECTION 13: FORM SUBMISSION
    // ========================================================================
    const handleSubmit = async () => {
        if (!validatePriorityPoints()) {
            alert('Please adjust priority points to not exceed 25')
            eventLogger.failed('customer_requirements', 'requirements_form_validated', 'Priority points exceed 25', 'VALIDATION_ERROR')
            return
        }

        if (!sessionId) {
            alert('Session ID is missing. Please go back to dashboard and create a new contract.')
            eventLogger.failed('customer_requirements', 'requirements_form_validated', 'Session ID missing', 'SESSION_MISSING')
            return
        }

        // NEW: Validate template selection
        if (!formData.templatePackId) {
            alert('Please select a contract template in Step 10 before submitting.')
            setCurrentStep(10)
            return
        }

        eventLogger.completed('customer_requirements', 'requirements_form_validated', {
            sessionId: sessionId,
            totalSteps: totalSteps
        })

        setLoading(true)
        eventLogger.started('customer_requirements', 'requirements_form_submitted')

        try {
            const submissionData = {
                ...formData,
                sessionId: sessionId,
                sessionNumber: sessionNumber,
                timestamp: new Date().toISOString(),
                formVersion: '8.0', // Updated version
                formSource: 'customer-requirements-form'
            }

            const response = await fetch(`${API_BASE}/customer-requirements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData)
            })

            if (response.ok) {
                let result = null
                const responseText = await response.text()

                if (responseText && responseText.trim()) {
                    try {
                        result = JSON.parse(responseText)
                        console.log('Requirements submitted:', result)
                    } catch (parseError) {
                        console.log('Requirements submitted (no JSON response)')
                    }
                } else {
                    console.log('Requirements submitted (empty response)')
                }

                eventLogger.completed('customer_requirements', 'requirements_form_submitted', {
                    sessionId: sessionId,
                    sessionNumber: sessionNumber,
                    formVersion: '8.0',
                    contractTypeCode: formData.contractTypeCode,
                    templatePackId: formData.templatePackId
                })

                eventLogger.completed('customer_requirements', 'redirect_to_questionnaire', {
                    sessionId: sessionId
                })

                // Redirect to strategic assessment
                router.push(`/auth/strategic-assessment?session_id=${sessionId}&session_number=${sessionNumber}`)
            } else {
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
            eventLogger.failed(
                'customer_requirements',
                'requirements_form_submitted',
                error instanceof Error ? error.message : 'Unknown error',
                'SUBMISSION_ERROR'
            )
            alert('Failed to submit requirements. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ========================================================================
    // SECTION 14: CHAT FUNCTIONS
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

    // UPDATED: Step names for 10 steps
    const getStepName = (step: number): string => {
        const stepNames: Record<number, string> = {
            1: 'Company Information',
            2: 'Market Context & Leverage',
            3: 'Contract Type & Service', // UPDATED
            4: 'Alternative Options (BATNA)',
            5: 'Commercial Terms',
            6: 'Priority Allocation',
            7: 'Contract Positions',
            8: 'Technical & Compliance',
            9: 'Additional Context',
            10: 'Contract Template' // NEW
        }
        return stepNames[step] || 'Unknown Step'
    }

    // Scroll chat to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 15: STEP NAVIGATION
    // ========================================================================
    const nextStep = () => {
        eventLogger.completed('customer_requirements', `requirements_section_${currentStep}_completed`, {
            sectionName: getStepName(currentStep),
            sessionId: sessionId
        })
        setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    }

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    // ========================================================================
    // SECTION 16: RENDER STEPS - UPDATED FOR 10 STEPS
    // ========================================================================
    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <CompanyInfoStep formData={formData} updateFormData={updateFormData} />
            case 2:
                return <MarketContextStep formData={formData} updateFormData={updateFormData} />
            case 3:
                return (
                    <ServiceRequirementsStep
                        formData={formData}
                        updateFormData={updateFormData}
                        contractTypes={contractTypes}
                        contractTypesLoading={contractTypesLoading}
                        selectedContractType={selectedContractType}
                        onContractTypeChange={handleContractTypeChange}
                    />
                )
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
            case 10:
                return (
                    <TemplateSelectionStep
                        formData={formData}
                        selectedContractType={selectedContractType}
                        selectedTemplate={selectedTemplate}
                        onTemplateSelect={handleTemplateSelect}
                    />
                )
            default:
                return null
        }
    }

    // ========================================================================
    // SECTION 17: LOADING STATE
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
    // SECTION 18: MAIN RENDER
    // ========================================================================
    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* ================================================================ */}
            {/* SECTION 19: MAIN CONTENT AREA */}
            {/* ================================================================ */}
            <div className={`flex-1 transition-all duration-300 ${chatOpen ? 'mr-96' : ''}`}>
                {/* Navigation */}
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
                                        ? 'bg-blue-600 text-white'
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
                    {/* TRUST BANNER - Shows on Step 1 */}
                    {currentStep === 1 && (
                        <TrustBanner onLearnMore={() => setChatOpen(true)} />
                    )}

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

                        {/* Step Indicators - Updated for 10 steps */}
                        <div className="flex justify-between mt-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => (
                                <button
                                    key={step}
                                    onClick={() => setCurrentStep(step)}
                                    className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${step === currentStep
                                        ? 'bg-slate-700 text-white'
                                        : step < currentStep
                                            ? 'bg-blue-500 text-white'
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
                                disabled={loading || priorityPoints < 0 || !formData.templatePackId}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
                            onClick={() => router.push('/auth/contracts-dashboard')}
                            className="text-sm text-slate-500 hover:text-slate-700 underline"
                        >
                            Save & Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 20: CLARENCE CHAT PANEL */}
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
                            <div className="text-xs text-slate-300">Your Confidential Advisor</div>
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
                            onClick={() => setChatInput('How do you protect my confidentiality?')}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                        >
                            Confidentiality?
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 21: STEP COMPONENTS
// ============================================================================

// STEP 1 - COMPANY INFO
function CompanyInfoStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Company Information</h2>

            {formData.sessionId && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Session ID:</span>
                        <span className="font-mono text-sm text-slate-800">{formData.sessionNumber || formData.sessionId}</span>
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">Auto-assigned</span>
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
                        Time to Agree Contract
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

// ============================================================================
// STEP 3: SERVICE REQUIREMENTS - UPDATED WITH DYNAMIC CONTRACT TYPES
// ============================================================================
function ServiceRequirementsStep({
    formData,
    updateFormData,
    contractTypes,
    contractTypesLoading,
    selectedContractType,
    onContractTypeChange
}: ServiceRequirementsStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Contract Type & Service Requirements</h2>

            {/* Contract Type Selection */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contract Type <span className="text-red-500">*</span>
                </label>
                {contractTypesLoading ? (
                    <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                        Loading contract types...
                    </div>
                ) : (
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        value={formData.contractTypeId || ''}
                        onChange={(e) => onContractTypeChange(e.target.value)}
                    >
                        <option value="">Select Contract Type</option>
                        {contractTypes.map((ct) => (
                            <option key={ct.typeId} value={ct.typeId}>
                                {ct.icon} {ct.typeName}
                                {ct.templateCount > 0 && ` (${ct.templateCount} template${ct.templateCount > 1 ? 's' : ''})`}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Selected Contract Type Info */}
            {selectedContractType && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">{selectedContractType.icon}</span>
                        <div className="flex-1">
                            <h3 className="font-medium text-slate-800">{selectedContractType.typeName}</h3>
                            <p className="text-sm text-slate-600 mt-1">{selectedContractType.description}</p>

                            {/* Default Template Preview */}
                            {selectedContractType.defaultTemplate ? (
                                <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs text-slate-500">Recommended Template</span>
                                            <div className="font-medium text-slate-700">
                                                {selectedContractType.defaultTemplate.packName}
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                            {selectedContractType.defaultTemplate.clauseCount} clauses
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        ℹ️ You can customize or change the template in Step 10
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                    <p className="text-sm text-amber-800">
                                        ⚠️ No templates available for this contract type. You can build a custom contract in Step 10.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Service Criticality */}
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

            {/* Business Challenge */}
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

            {/* Desired Outcome */}
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

            <ConfidentialityNotice type="batna" />

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

// STEP 5: Commercial Terms
function CommercialTermsStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Commercial Terms</h2>

            <ConfidentialityNotice type="budget" />

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
                        <span className="text-slate-500 ml-2">(kept confidential)</span>
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

// STEP 6: Priorities with Point System
function PrioritiesStep({ formData, updateNestedData, priorityPoints }: PrioritiesStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Priority Allocation</h2>

            <ConfidentialityNotice type="priority" />

            <div className={`border rounded-lg p-4 mb-6 ${priorityPoints >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
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

// STEP 7: Contract Positions
function ContractPositionsStep({ formData, updateNestedData }: NestedStepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Initial Contract Positions</h2>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-purple-800">
                    📋 Set your starting positions on key contract terms. These positions <span className="font-medium">will be visible</span> to the provider during negotiation, as they form the basis for finding common ground.
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
                        max="250"
                        step="25"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        value={formData.contractPositions?.liabilityCap || 150}
                        onChange={(e) => updateNestedData('contractPositions', 'liabilityCap', parseInt(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>100% (Provider-friendly)</span>
                        <span>175%</span>
                        <span>250% (Customer-friendly)</span>
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

// STEP 8: Technical Requirements
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

// STEP 9: Additional Context
function AdditionalContextStep({ formData, updateFormData }: StepComponentProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Additional Context</h2>

            <ConfidentialityNotice type="context" />

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
        </div>
    )
}

// ============================================================================
// STEP 10: TEMPLATE SELECTION (NEW)
// ============================================================================
function TemplateSelectionStep({
    formData,
    selectedContractType,
    selectedTemplate,
    onTemplateSelect
}: TemplateSelectionStepProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium text-slate-800 mb-4">Contract Template</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                    📋 Select and confirm your contract template. This defines the clauses that will be negotiated with providers.
                    You can customize individual clauses in the Clause Builder after completing this form.
                </p>
            </div>

            {/* No Contract Type Selected */}
            {!selectedContractType && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                    <span className="text-3xl mb-3 block">⚠️</span>
                    <h3 className="font-medium text-amber-800 mb-2">No Contract Type Selected</h3>
                    <p className="text-sm text-amber-700">
                        Please go back to Step 3 and select a contract type to see available templates.
                    </p>
                </div>
            )}

            {/* Contract Type Selected but No Templates */}
            {selectedContractType && selectedContractType.templates.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                    <span className="text-3xl mb-3 block">✏️</span>
                    <h3 className="font-medium text-slate-800 mb-2">Custom Contract</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        No pre-built templates are available for {selectedContractType.typeName}.
                        You&apos;ll be able to build a custom contract in the Clause Builder.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg">
                        <span>✓</span>
                        <span>Custom contract will be configured after submission</span>
                    </div>
                </div>
            )}

            {/* Templates Available */}
            {selectedContractType && selectedContractType.templates.length > 0 && (
                <>
                    {/* Selected Contract Type Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{selectedContractType.icon}</span>
                            <div>
                                <h3 className="font-medium text-slate-800">{selectedContractType.typeName}</h3>
                                <p className="text-sm text-slate-600">{selectedContractType.templateCount} template(s) available</p>
                            </div>
                        </div>
                    </div>

                    {/* Template Options */}
                    <div className="space-y-3">
                        {selectedContractType.templates.map((template) => (
                            <div
                                key={template.packId}
                                onClick={() => onTemplateSelect(template)}
                                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedTemplate?.packId === template.packId
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        {/* Selection Indicator */}
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${selectedTemplate?.packId === template.packId
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-slate-300'
                                            }`}>
                                            {selectedTemplate?.packId === template.packId && (
                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-slate-800">{template.packName}</h4>
                                                {template.isDefault && (
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                        Recommended
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">
                                                Version {template.version} • {template.clauseCount} clauses
                                            </p>
                                        </div>
                                    </div>

                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                                        {template.clauseCount} clauses
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Selected Template Confirmation */}
                    {selectedTemplate && (
                        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <span className="text-emerald-600 text-xl">✓</span>
                                <div>
                                    <h4 className="font-medium text-emerald-800">Template Selected</h4>
                                    <p className="text-sm text-emerald-700 mt-1">
                                        <strong>{selectedTemplate.packName}</strong> with {selectedTemplate.clauseCount} clauses will be used as your contract foundation.
                                    </p>
                                    <p className="text-xs text-emerald-600 mt-2">
                                        ℹ️ After completing the Strategic Assessment, you&apos;ll be directed to the Clause Builder where you can customize these clauses before inviting providers.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6 mt-8">
                <h3 className="text-lg font-medium text-slate-800 mb-4">📋 Ready to Submit</h3>
                <p className="text-sm text-slate-600 mb-4">
                    After submitting, you&apos;ll proceed to the Strategic Assessment where CLARENCE will ask probing questions
                    to calculate your leverage position and prepare for negotiation.
                </p>

                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>
                            <span className="font-medium">Confidential information protected:</span> Your budget limits, BATNA, walk-away points, and priority weightings will never be shared with the provider.
                        </span>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                        <span>
                            <span className="font-medium">CLARENCE as honest broker:</span> I use information from both parties to find fair compromises—not to advantage one side over the other.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}