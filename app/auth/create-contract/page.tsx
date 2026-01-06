'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

type MediationType = 'straight_to_contract' | 'partial_mediation' | 'full_mediation' | null
type ContractType = 'nda' | 'saas' | 'bpo' | 'msa' | 'employment' | 'custom' | null
type TemplateSource = 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch' | null
type AssessmentStep = 'welcome' | 'mediation_type' | 'contract_type' | 'template_source' | 'template_selection' | 'summary' | 'creating'

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    role: string
    userId: string
}

interface AssessmentState {
    step: AssessmentStep
    mediationType: MediationType
    contractType: ContractType
    templateSource: TemplateSource
    contractName: string
    contractDescription: string
    selectedTemplateId: string | null
    selectedTemplateName: string | null
}

interface ChatMessage {
    id: string
    role: 'clarence' | 'user' | 'system'
    content: string
    timestamp: Date
    options?: AssessmentOption[]
}

interface AssessmentOption {
    id: string
    label: string
    description: string
    value: string
    icon?: string
}

interface Template {
    templateId: string
    templateCode: string
    templateName: string
    contractType: string
    industry: string
    description: string
    isDefault: boolean
    clauseCount: number
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const MEDIATION_OPTIONS: AssessmentOption[] = [
    {
        id: 'straight',
        label: 'Straight to Contract',
        description: 'Standard template with minimal or no negotiation. Perfect for routine agreements like NDAs or standard service terms.',
        value: 'straight_to_contract',
        icon: '⚡'
    },
    {
        id: 'partial',
        label: 'Partial Mediation',
        description: 'Most terms are fixed (~85%) with specific clauses open for negotiation. Ideal when you have standard terms but need flexibility on key points.',
        value: 'partial_mediation',
        icon: '⚖️'
    },
    {
        id: 'full',
        label: 'Full Mediation',
        description: 'All contract terms are negotiable. Best for complex deals, strategic partnerships, or bespoke agreements.',
        value: 'full_mediation',
        icon: '🤝'
    }
]

const CONTRACT_TYPE_OPTIONS: AssessmentOption[] = [
    {
        id: 'nda',
        label: 'Non-Disclosure Agreement (NDA)',
        description: 'Confidentiality and information protection agreement',
        value: 'nda',
        icon: '🔒'
    },
    {
        id: 'saas',
        label: 'SaaS Agreement',
        description: 'Software as a Service subscription terms',
        value: 'saas',
        icon: '☁️'
    },
    {
        id: 'bpo',
        label: 'BPO / Outsourcing Agreement',
        description: 'Business process outsourcing and managed services',
        value: 'bpo',
        icon: '🏢'
    },
    {
        id: 'msa',
        label: 'Master Services Agreement',
        description: 'Umbrella agreement for ongoing service relationships',
        value: 'msa',
        icon: '📋'
    },
    {
        id: 'employment',
        label: 'Employment Contract',
        description: 'Employment terms and conditions',
        value: 'employment',
        icon: '👤'
    },
    {
        id: 'custom',
        label: 'Custom / Other',
        description: 'Build a custom contract type',
        value: 'custom',
        icon: '✏️'
    }
]

const TEMPLATE_SOURCE_OPTIONS: AssessmentOption[] = [
    {
        id: 'existing',
        label: 'Use Existing Template',
        description: 'Start with a pre-built template from the library',
        value: 'existing_template',
        icon: '📁'
    },
    {
        id: 'modify',
        label: 'Modify Existing Template',
        description: 'Start with a template and customize it',
        value: 'modified_template',
        icon: '✏️'
    },
    {
        id: 'upload',
        label: 'Upload a Contract',
        description: 'Upload an existing contract document (PDF/DOCX) and convert it',
        value: 'uploaded',
        icon: '📤'
    },
    {
        id: 'scratch',
        label: 'Build from Scratch',
        description: 'Create a new contract clause by clause',
        value: 'from_scratch',
        icon: '🔨'
    }
]

// ============================================================================
// SECTION 3: CLARENCE MESSAGES
// ============================================================================

const CLARENCE_MESSAGES = {
    welcome: `Hello! I'm Clarence, your contract negotiation assistant. 

I'll help you set up your new contract in just a few steps. First, I need to understand what type of negotiation process you're looking for.

**Let's get started!**`,

    mediation_type: `**How much negotiation do you expect for this contract?**

This helps me understand whether we should use a streamlined process or a more comprehensive mediation approach.`,

    mediation_straight_selected: `**Straight to Contract** - excellent choice for standard agreements.

With this approach:
• The contract will be generated automatically once provider details are submitted
• All terms are fixed - no negotiation required
• Fastest path to a signed agreement

Now, what type of contract are you creating?`,

    mediation_partial_selected: `**Partial Mediation** - a balanced approach.

With this approach:
• Most clauses (~85%) will be locked and auto-drafted
• Specific clauses remain negotiable
• You'll have control over which terms are open for discussion

Now, what type of contract are you creating?`,

    mediation_full_selected: `**Full Mediation** - comprehensive negotiation.

With this approach:
• All contract terms are open for discussion
• Both parties work through each clause together
• Best for complex or high-value agreements

Now, what type of contract are you creating?`,

    contract_type: `**What type of contract are you creating?**

Select the category that best matches your needs. This helps me suggest the right template and structure.`,

    template_source: `**How would you like to start building your contract?**

You can use an existing template, upload your own document, or build from scratch.`,

    template_selection: `**Select a template to start with:**

These templates contain pre-configured clauses that you can customize. Each includes industry-standard terms and positions.`,

    template_selection_modify: `**Select a template to customize:**

You'll be able to modify any clause, add new ones, or remove those you don't need.`,

    no_templates: `I couldn't find any templates matching your criteria. You can either:
• Try a different contract type
• Build your contract from scratch
• Upload an existing document`,

    summary: `**Great! Here's a summary of your contract setup:**

I'll create your contract with these settings. Once you confirm, you'll enter the Contract Studio where you can review and customize everything before inviting providers.`,

    creating: `**Creating your contract...**

Setting up your contract workspace. This will just take a moment.`
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function ContractCreationAssessment() {
    const router = useRouter()
    const chatEndRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [assessment, setAssessment] = useState<AssessmentState>({
        step: 'welcome',
        mediationType: null,
        contractType: null,
        templateSource: null,
        contractName: '',
        contractDescription: '',
        selectedTemplateId: null,
        selectedTemplateName: null
    })

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ========================================================================
    // SECTION 4B: LOAD USER INFO
    // ========================================================================

    const loadUserInfo = useCallback(() => {
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) {
            router.push('/auth/login')
            return null
        }

        try {
            const parsed = JSON.parse(authData)
            return {
                firstName: parsed.userInfo?.firstName || 'User',
                lastName: parsed.userInfo?.lastName || '',
                email: parsed.userInfo?.email || '',
                company: parsed.userInfo?.company || '',
                role: parsed.userInfo?.role || 'customer',
                userId: parsed.userInfo?.userId || ''
            } as UserInfo
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    // ========================================================================
    // SECTION 4C: EFFECTS
    // ========================================================================

    // Load user info on mount
    useEffect(() => {
        const user = loadUserInfo()
        if (user) {
            setUserInfo(user)
        }
    }, [loadUserInfo])

    // Initialize chat with welcome message
    useEffect(() => {
        setChatMessages([
            {
                id: 'welcome-1',
                role: 'clarence',
                content: CLARENCE_MESSAGES.welcome,
                timestamp: new Date()
            }
        ])

        // Auto-advance to first question after a brief pause
        const timer = setTimeout(() => {
            setAssessment(prev => ({ ...prev, step: 'mediation_type' }))
            addClarenceMessage(CLARENCE_MESSAGES.mediation_type, MEDIATION_OPTIONS)
        }, 1500)

        return () => clearTimeout(timer)
    }, [])

    // Scroll chat to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // Load templates when entering template_selection step
    useEffect(() => {
        if (assessment.step === 'template_selection') {
            loadTemplates()
        }
    }, [assessment.step])

    // ========================================================================
    // SECTION 4D: HELPER FUNCTIONS
    // ========================================================================

    const addClarenceMessage = (content: string, options?: AssessmentOption[]) => {
        setChatMessages(prev => [...prev, {
            id: `clarence-${Date.now()}`,
            role: 'clarence',
            content,
            timestamp: new Date(),
            options
        }])
    }

    const addUserMessage = (content: string) => {
        setChatMessages(prev => [...prev, {
            id: `user-${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date()
        }])
    }

    const loadTemplates = async () => {
        setIsLoadingTemplates(true)
        try {
            const response = await fetch(`${API_BASE}/get-contract-templates`)
            if (response.ok) {
                const data = await response.json()
                const templateList = data.templates || []
                setTemplates(templateList)

                // Add appropriate Clarence message
                if (templateList.length === 0) {
                    addClarenceMessage(CLARENCE_MESSAGES.no_templates)
                } else {
                    const message = assessment.templateSource === 'modified_template'
                        ? CLARENCE_MESSAGES.template_selection_modify
                        : CLARENCE_MESSAGES.template_selection
                    addClarenceMessage(message)
                }
            } else {
                console.error('Failed to load templates:', response.status)
                setTemplates([])
                addClarenceMessage(CLARENCE_MESSAGES.no_templates)
            }
        } catch (err) {
            console.error('Failed to load templates:', err)
            setTemplates([])
            addClarenceMessage(CLARENCE_MESSAGES.no_templates)
        } finally {
            setIsLoadingTemplates(false)
        }
    }

    // ========================================================================
    // SECTION 4E: SELECTION HANDLERS
    // ========================================================================

    const handleMediationSelect = (option: AssessmentOption) => {
        const mediationType = option.value as MediationType

        // Add user's selection as a message
        addUserMessage(`${option.icon} ${option.label}`)

        // Update state
        setAssessment(prev => ({
            ...prev,
            mediationType,
            step: 'contract_type'
        }))

        // Add Clarence's response
        setTimeout(() => {
            let response = CLARENCE_MESSAGES.contract_type
            if (mediationType === 'straight_to_contract') {
                response = CLARENCE_MESSAGES.mediation_straight_selected
            } else if (mediationType === 'partial_mediation') {
                response = CLARENCE_MESSAGES.mediation_partial_selected
            } else if (mediationType === 'full_mediation') {
                response = CLARENCE_MESSAGES.mediation_full_selected
            }
            addClarenceMessage(response, CONTRACT_TYPE_OPTIONS)
        }, 500)
    }

    const handleContractTypeSelect = (option: AssessmentOption) => {
        const contractType = option.value as ContractType

        addUserMessage(`${option.icon} ${option.label}`)

        setAssessment(prev => ({
            ...prev,
            contractType,
            step: 'template_source'
        }))

        setTimeout(() => {
            addClarenceMessage(CLARENCE_MESSAGES.template_source, TEMPLATE_SOURCE_OPTIONS)
        }, 500)
    }

    const handleTemplateSourceSelect = (option: AssessmentOption) => {
        const templateSource = option.value as TemplateSource

        addUserMessage(`${option.icon} ${option.label}`)

        // If they want to use or modify a template, show template selection
        if (templateSource === 'existing_template' || templateSource === 'modified_template') {
            setAssessment(prev => ({
                ...prev,
                templateSource,
                step: 'template_selection'
            }))
            // Templates will be loaded by the useEffect
        } else {
            // For upload or from_scratch, go directly to summary
            setAssessment(prev => ({
                ...prev,
                templateSource,
                step: 'summary'
            }))

            setTimeout(() => {
                addClarenceMessage(CLARENCE_MESSAGES.summary)
            }, 500)
        }
    }

    const handleTemplateSelect = (template: Template) => {
        addUserMessage(`📋 ${template.templateName}`)

        setAssessment(prev => ({
            ...prev,
            selectedTemplateId: template.templateId,
            selectedTemplateName: template.templateName,
            step: 'summary'
        }))

        setTimeout(() => {
            addClarenceMessage(CLARENCE_MESSAGES.summary)
        }, 500)
    }

    const handleOptionSelect = (option: AssessmentOption) => {
        switch (assessment.step) {
            case 'mediation_type':
                handleMediationSelect(option)
                break
            case 'contract_type':
                handleContractTypeSelect(option)
                break
            case 'template_source':
                handleTemplateSourceSelect(option)
                break
        }
    }

    // ========================================================================
    // SECTION 4F: CONTRACT CREATION
    // ========================================================================

    const createContract = async () => {
        if (!userInfo) {
            setError('User not authenticated')
            return
        }

        setIsCreating(true)
        setError(null)

        setAssessment(prev => ({ ...prev, step: 'creating' }))
        addClarenceMessage(CLARENCE_MESSAGES.creating)

        try {
            const response = await fetch(`${API_BASE}/session-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: userInfo.email,
                    companyName: userInfo.company,
                    userName: `${userInfo.firstName} ${userInfo.lastName}`,
                    // Assessment fields
                    mediation_type: assessment.mediationType,
                    contract_type: assessment.contractType,
                    template_source: assessment.templateSource,
                    source_template_id: assessment.selectedTemplateId,
                    assessment_completed: true
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create contract session')
            }

            const result = await response.json()

            if (result.success && result.sessionId) {
                router.push(`/auth/contract-studio?session_id=${result.sessionId}`)
            } else {
                throw new Error(result.error || 'No session ID returned')
            }

        } catch (err) {
            console.error('Error creating contract:', err)
            setError(err instanceof Error ? err.message : 'Failed to create contract')
            setIsCreating(false)
            setAssessment(prev => ({ ...prev, step: 'summary' }))
        }
    }

    const getContractTypeLabel = (type: ContractType): string => {
        const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type)
        return option?.label || 'Contract'
    }

    const getMediationTypeLabel = (type: MediationType): string => {
        const option = MEDIATION_OPTIONS.find(o => o.value === type)
        return option?.label || 'Mediation'
    }

    const getTemplateSourceLabel = (source: TemplateSource): string => {
        const option = TEMPLATE_SOURCE_OPTIONS.find(o => o.value === source)
        return option?.label || 'Template'
    }

    // ========================================================================
    // SECTION 5: RENDER - PANEL 1 (PROGRESS)
    // ========================================================================

    const renderProgressPanel = () => {
        const steps = [
            { id: 'mediation_type', label: 'Mediation Type', icon: '⚖️' },
            { id: 'contract_type', label: 'Contract Type', icon: '📋' },
            { id: 'template_source', label: 'Template Source', icon: '📁' },
            { id: 'template_selection', label: 'Select Template', icon: '✓', conditional: true },
            { id: 'summary', label: 'Review & Create', icon: '✅' }
        ]

        // Filter out conditional steps if not applicable
        const visibleSteps = steps.filter(step => {
            if (step.id === 'template_selection') {
                return assessment.templateSource === 'existing_template' ||
                    assessment.templateSource === 'modified_template'
            }
            return true
        })

        const getCurrentStepIndex = () => {
            const stepOrder = ['welcome', 'mediation_type', 'contract_type', 'template_source', 'template_selection', 'summary', 'creating']
            return stepOrder.indexOf(assessment.step)
        }

        const currentIndex = getCurrentStepIndex()

        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href="/auth/dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        ← Back to Dashboard
                    </Link>
                    <h2 className="text-lg font-semibold text-slate-800 mt-2">New Contract</h2>
                    <p className="text-sm text-slate-500">Setup Assessment</p>
                </div>

                {/* Progress Steps */}
                <div className="flex-1 p-4">
                    <div className="space-y-2">
                        {visibleSteps.map((step) => {
                            const stepOrder = ['welcome', 'mediation_type', 'contract_type', 'template_source', 'template_selection', 'summary', 'creating']
                            const stepIndex = stepOrder.indexOf(step.id)
                            const isComplete = currentIndex > stepIndex
                            const isCurrent = assessment.step === step.id
                            const isUpcoming = currentIndex < stepIndex

                            return (
                                <div
                                    key={step.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isCurrent
                                            ? 'bg-blue-50 border border-blue-200'
                                            : isComplete
                                                ? 'bg-green-50 border border-green-200'
                                                : 'bg-white border border-slate-200 opacity-50'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${isComplete
                                            ? 'bg-green-500 text-white'
                                            : isCurrent
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-200 text-slate-500'
                                        }`}>
                                        {isComplete ? '✓' : step.icon}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${isCurrent ? 'text-blue-800' : isComplete ? 'text-green-800' : 'text-slate-600'
                                            }`}>
                                            {step.label}
                                        </p>
                                        {isComplete && (
                                            <p className="text-xs text-slate-500 truncate">
                                                {step.id === 'mediation_type' && getMediationTypeLabel(assessment.mediationType)}
                                                {step.id === 'contract_type' && getContractTypeLabel(assessment.contractType)}
                                                {step.id === 'template_source' && getTemplateSourceLabel(assessment.templateSource)}
                                                {step.id === 'template_selection' && assessment.selectedTemplateName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="text-xs text-slate-500 text-center">
                        Powered by CLARENCE AI
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 6: RENDER - PANEL 2 (MAIN CONTENT)
    // ========================================================================

    const renderMainPanel = () => {
        return (
            <div className="h-full flex flex-col bg-white">
                {/* Header */}
                <div className="p-4 border-b border-slate-200">
                    <h1 className="text-xl font-semibold text-slate-800">Create New Contract</h1>
                    <p className="text-sm text-slate-500">
                        {assessment.step === 'summary'
                            ? 'Review your selections and create your contract'
                            : assessment.step === 'template_selection'
                                ? 'Choose a template to start with'
                                : 'Answer a few questions to set up your contract'
                        }
                    </p>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    {assessment.step === 'summary'
                        ? renderSummary()
                        : assessment.step === 'template_selection'
                            ? renderTemplateSelection()
                            : renderCurrentOptions()
                    }
                </div>
            </div>
        )
    }

    const renderCurrentOptions = () => {
        let options: AssessmentOption[] = []
        let title = ''

        switch (assessment.step) {
            case 'mediation_type':
                options = MEDIATION_OPTIONS
                title = 'Select Mediation Type'
                break
            case 'contract_type':
                options = CONTRACT_TYPE_OPTIONS
                title = 'Select Contract Type'
                break
            case 'template_source':
                options = TEMPLATE_SOURCE_OPTIONS
                title = 'Choose How to Start'
                break
            default:
                return (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">👋</span>
                            </div>
                            <h3 className="text-lg font-medium text-slate-800">Welcome!</h3>
                            <p className="text-sm text-slate-500 mt-1">Clarence is ready to help you set up your contract.</p>
                        </div>
                    </div>
                )
        }

        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-4">{title}</h3>
                <div className="grid gap-4">
                    {options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleOptionSelect(option)}
                            className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                        >
                            <div className="w-12 h-12 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                                {option.icon}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-800 group-hover:text-blue-800">
                                    {option.label}
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    {option.description}
                                </p>
                            </div>
                            <div className="text-slate-400 group-hover:text-blue-500 self-center">
                                →
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 6A: RENDER - TEMPLATE SELECTION
    // ========================================================================

    const renderTemplateSelection = () => {
        if (isLoadingTemplates) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading templates...</p>
                    </div>
                </div>
            )
        }

        if (templates.length === 0) {
            return (
                <div className="max-w-2xl mx-auto">
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📭</span>
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">No Templates Available</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            There are no templates matching your criteria yet.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => {
                                    setAssessment(prev => ({
                                        ...prev,
                                        templateSource: 'from_scratch',
                                        step: 'summary'
                                    }))
                                    addUserMessage('🔨 Build from Scratch')
                                    setTimeout(() => {
                                        addClarenceMessage(CLARENCE_MESSAGES.summary)
                                    }, 500)
                                }}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                Build from Scratch
                            </button>
                            <button
                                onClick={() => {
                                    setAssessment(prev => ({ ...prev, step: 'template_source' }))
                                }}
                                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                            >
                                ← Go Back
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-medium text-slate-800">
                            {assessment.templateSource === 'modified_template'
                                ? 'Select a Template to Customize'
                                : 'Select a Template'
                            }
                        </h3>
                        <p className="text-sm text-slate-500">
                            {templates.length} template{templates.length !== 1 ? 's' : ''} available
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setAssessment(prev => ({ ...prev, step: 'template_source' }))
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                        ← Back
                    </button>
                </div>

                <div className="grid gap-4">
                    {templates.map((template) => (
                        <button
                            key={template.templateId}
                            onClick={() => handleTemplateSelect(template)}
                            className="flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                        >
                            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-2xl">📋</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-slate-800 group-hover:text-blue-800">
                                        {template.templateName}
                                    </h4>
                                    {template.isDefault && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                            Recommended
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500 mb-2">
                                    {template.description || `Standard ${template.contractType} template for ${template.industry} industry`}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <span>📄</span>
                                        {template.clauseCount} clauses
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span>🏢</span>
                                        {template.industry}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span>📝</span>
                                        {template.contractType}
                                    </span>
                                </div>
                            </div>
                            <div className="text-slate-400 group-hover:text-blue-500 self-center text-xl">
                                →
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 6B: RENDER - SUMMARY
    // ========================================================================

    const renderSummary = () => {
        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">Contract Setup Summary</h3>

                {/* Summary Cards */}
                <div className="space-y-4 mb-8">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚖️</span>
                            <div>
                                <p className="text-sm text-slate-500">Mediation Type</p>
                                <p className="font-medium text-slate-800">{getMediationTypeLabel(assessment.mediationType)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📋</span>
                            <div>
                                <p className="text-sm text-slate-500">Contract Type</p>
                                <p className="font-medium text-slate-800">{getContractTypeLabel(assessment.contractType)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📁</span>
                            <div>
                                <p className="text-sm text-slate-500">Starting Point</p>
                                <p className="font-medium text-slate-800">{getTemplateSourceLabel(assessment.templateSource)}</p>
                            </div>
                        </div>
                    </div>

                    {assessment.selectedTemplateName && (
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✓</span>
                                <div>
                                    <p className="text-sm text-blue-600">Selected Template</p>
                                    <p className="font-medium text-blue-800">{assessment.selectedTemplateName}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Contract Name Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Contract Name (Optional)
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder={`e.g., ${getContractTypeLabel(assessment.contractType)} with Acme Corp`}
                        value={assessment.contractName}
                        onChange={(e) => setAssessment(prev => ({ ...prev, contractName: e.target.value }))}
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        {error}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            // Go back to appropriate step
                            if (assessment.selectedTemplateId) {
                                setAssessment(prev => ({ ...prev, step: 'template_selection' }))
                            } else {
                                setAssessment(prev => ({ ...prev, step: 'template_source' }))
                            }
                        }}
                        className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={createContract}
                        disabled={isCreating}
                        className="flex-1 px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Creating Contract...
                            </>
                        ) : (
                            <>
                                Create Contract
                                <span>→</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: RENDER - PANEL 3 (CLARENCE CHAT)
    // ========================================================================

    const renderChatPanel = () => {
        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-blue-50 to-white border-l border-slate-200">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-lg">C</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Clarence</h3>
                            <p className="text-xs text-green-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Online
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {chatMessages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                                }`}>
                                <div className="text-sm whitespace-pre-wrap">
                                    {message.content.split('**').map((part, i) =>
                                        i % 2 === 1
                                            ? <strong key={i}>{part}</strong>
                                            : <span key={i}>{part}</span>
                                    )}
                                </div>
                                <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                {/* Chat Footer */}
                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="text-xs text-slate-500 text-center">
                        Clarence is guiding you through contract setup
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: MAIN RENDER
    // ========================================================================

    return (
        <div className="h-screen flex bg-slate-100">
            {/* Panel 1: Progress Sidebar */}
            <div className="w-64 flex-shrink-0">
                {renderProgressPanel()}
            </div>

            {/* Panel 2: Main Content */}
            <div className="flex-1 min-w-0">
                {renderMainPanel()}
            </div>

            {/* Panel 3: Clarence Chat */}
            <div className="w-96 flex-shrink-0">
                {renderChatPanel()}
            </div>
        </div>
    )
}