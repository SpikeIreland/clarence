'use client'

// ============================================================================
// CLARENCE Create Contract Page - V4 WITH TENDERING SUPPORT
// ============================================================================
// File: /app/auth/create-contract/page.tsx
// Purpose: Contract creation assessment wizard with training mode support
// Training Mode: Activated via ?mode=training URL parameter
// Stage: CREATE (Emerald) - Training overrides to Amber
// 
// V3 CHANGES (WP1):
// 1. Reordered steps: Contract Type now comes BEFORE Mediation Type
// 2. Updated CLARENCE_MESSAGES for new conversational flow
// 3. Updated progress panel step order
// 4. Updated step handlers for new flow
//
// V4 CHANGES (WP3):
// 1. Enhanced Quick Intake with Tendering Configuration
// 2. Added qualificationThreshold and evaluationPriorities fields
// 3. Tendering section appears when bidderCount is 'few' or 'many'
// 4. Updated CLARENCE messages for tendering context
// 5. Pass tendering data to session-create API
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FeedbackButton from '@/app/components/FeedbackButton'

// Import TransitionModal and pathway utilities
import { TransitionModal } from '@/app/components/create-phase/TransitionModal'
import {
    getPathwayId as getPathwayIdFromUtils,
    TRANSITION_CONFIGS,
    isStraightToContract,
    isTrueFastTrack,
    type PathwayId,
    type TransitionConfig
} from '@/lib/pathway-utils'
import { CreateProgressBar } from '@/app/components/create-phase/CreateProgressHeader';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

type MediationType = 'straight_to_contract' | 'partial_mediation' | 'full_mediation' | null
type ContractType = 'nda' | 'saas' | 'bpo' | 'msa' | 'employment' | 'custom' | null
type TemplateSource = 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch' | null

// WP1 CHANGE: Reordered steps - contract_type now comes before mediation_type
type AssessmentStep = 'welcome' | 'contract_type' | 'mediation_type' | 'quick_intake' | 'template_source' | 'template_selection' | 'upload_processing' | 'summary' | 'creating'

type DealValueRange = 'under_50k' | '50k_250k' | '250k_1m' | 'over_1m' | null
type ServiceCriticality = 'low' | 'medium' | 'high' | 'critical' | null
type TimelinePressure = 'flexible' | 'normal' | 'tight' | 'urgent' | null
type BidderCount = 'single' | 'few' | 'many' | null
type BatnaStatus = 'strong' | 'weak' | 'uncertain' | null

// WP3: Evaluation priority type for tendering
type EvaluationPriority = 'cost' | 'quality' | 'speed' | 'innovation' | 'risk_mitigation' | 'relationship'

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    role: string
    userId: string
    companyId: string | null
}

// WP3: Enhanced Quick Intake interface with tendering fields
interface QuickIntakeData {
    dealValue: DealValueRange
    serviceCriticality: ServiceCriticality
    timelinePressure: TimelinePressure
    bidderCount: BidderCount
    batnaStatus: BatnaStatus
    topPriorities: string[]
    // WP3: Tendering configuration
    qualificationThreshold: number  // 50-100, default 65
    evaluationPriorities: EvaluationPriority[]  // Ordered list of priorities
    mustHaveCapabilities: string  // Free text for minimum requirements
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
    uploadedContractId: string | null
    uploadedContractStatus: 'processing' | 'ready' | 'failed' | null
    uploadedFileName: string | null
    quickIntake: QuickIntakeData
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

// Transition state for modal
interface TransitionState {
    isOpen: boolean
    transition: TransitionConfig | null
    redirectUrl: string | null
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
        icon: '*'
    },
    {
        id: 'partial',
        label: 'Partial Mediation',
        description: 'Most terms are fixed (~85%) with specific clauses open for negotiation. Ideal when you have standard terms but need flexibility on key points.',
        value: 'partial_mediation',
        icon: '*'
    },
    {
        id: 'full',
        label: 'Full Mediation',
        description: 'All contract terms are negotiable. Best for complex deals, strategic partnerships, or bespoke agreements.',
        value: 'full_mediation',
        icon: '*'
    }
]

const CONTRACT_TYPE_OPTIONS: AssessmentOption[] = [
    { id: 'nda', label: 'Non-Disclosure Agreement (NDA)', description: 'Confidentiality and information protection agreement', value: 'nda', icon: '*' },
    { id: 'saas', label: 'SaaS Agreement', description: 'Software as a Service subscription terms', value: 'saas', icon: '*' },
    { id: 'bpo', label: 'BPO / Outsourcing Agreement', description: 'Business process outsourcing and managed services', value: 'bpo', icon: '*' },
    { id: 'msa', label: 'Master Services Agreement', description: 'Umbrella agreement for ongoing service relationships', value: 'msa', icon: '*' },
    { id: 'employment', label: 'Employment Contract', description: 'Employment terms and conditions', value: 'employment', icon: '*' },
    { id: 'custom', label: 'Custom / Other', description: 'Build a custom contract type', value: 'custom', icon: '*' }
]

const TEMPLATE_SOURCE_OPTIONS: AssessmentOption[] = [
    { id: 'existing', label: 'Use Existing Template', description: 'Start with a pre-built template from the library', value: 'existing_template', icon: '*' },
    { id: 'modify', label: 'Modify Existing Template', description: 'Start with a template and customize it', value: 'modified_template', icon: '*' },
    { id: 'upload', label: 'Upload a Contract', description: 'Upload an existing contract document (PDF/DOCX) and convert it', value: 'uploaded', icon: '*' },
    { id: 'scratch', label: 'Build from Scratch', description: 'Create a new contract clause by clause', value: 'from_scratch', icon: '*' }
]

// WP3: Evaluation priority options for tendering
const EVALUATION_PRIORITY_OPTIONS: { value: EvaluationPriority; label: string; icon: string }[] = [
    { value: 'cost', label: 'Cost Optimization', icon: '*' },
    { value: 'quality', label: 'Quality & Standards', icon: '*' },
    { value: 'speed', label: 'Speed of Delivery', icon: '*' },
    { value: 'innovation', label: 'Innovation & Technology', icon: '*' },
    { value: 'risk_mitigation', label: 'Risk Mitigation', icon: '*' },
    { value: 'relationship', label: 'Partnership Potential', icon: '*' }
]

const POLLING_INTERVAL = 5000
const MAX_POLLING_ATTEMPTS = 60

// ============================================================================
// SECTION 3: CLARENCE MESSAGES (WP1 + WP3 UPDATED)
// ============================================================================

const CLARENCE_MESSAGES = {
    // WP1 CHANGE: Updated welcome to ask about contract type first
    welcome: `Hello! I'm Clarence, your contract negotiation assistant. 

I'll help you set up your new contract in just a few steps. Let's start with the basics.

**What type of contract are you creating today?**`,

    welcome_training: `Hello! I'm Clarence, your training assistant. 

I'll help you set up a **practice contract** for your training session. This works exactly like the real thing, but with no real-world consequences.

**What type of contract would you like to practice with?**`,

    // WP1 CHANGE: Contract type is now first, update message accordingly
    contract_type: `**What type of contract are you creating?**

Select the type that best matches your needs. This helps me suggest appropriate templates and clauses.`,

    // WP1 NEW: Messages for after contract type selection (before mediation)
    contract_type_nda_selected: `**Non-Disclosure Agreement** - great choice for protecting confidential information.

Now let's talk about how much negotiation you expect...`,

    contract_type_saas_selected: `**SaaS Agreement** - perfect for software service subscriptions.

Now let's discuss the negotiation approach...`,

    contract_type_bpo_selected: `**BPO / Outsourcing Agreement** - ideal for managed service relationships.

Let's determine how flexible the negotiation needs to be...`,

    contract_type_msa_selected: `**Master Services Agreement** - a strong foundation for ongoing partnerships.

How much negotiation are you expecting?`,

    contract_type_employment_selected: `**Employment Contract** - essential for formalizing the employment relationship.

Let's discuss how the terms will be finalized...`,

    contract_type_custom_selected: `**Custom Contract** - I'll help you build exactly what you need.

First, let's understand the negotiation requirements...`,

    // WP1 CHANGE: Mediation selection now comes after contract type
    mediation_selection: `**How much negotiation do you expect?**

This determines how CLARENCE will facilitate the process:`,

    mediation_stc_selected: `**Straight to Contract** - efficient and streamlined.

Since there's minimal negotiation, we'll use standard positions. Let's choose how to start building your contract.`,

    mediation_pm_selected: `**Partial Mediation** - a balanced approach.

Most terms will use standard positions, with key clauses open for negotiation. Before we continue, I need a bit more context about this deal.`,

    mediation_fm_selected: `**Full Mediation** - comprehensive negotiation support.

All terms are on the table. To help you negotiate effectively, I need to understand more about this deal.`,

    // WP3: Updated quick_intake message for tendering context
    quick_intake: `**Let me understand your deal context.**

This helps me calculate your negotiating leverage and recommend appropriate positions.`,

    // WP3: New message for tendering configuration
    quick_intake_tendering: `**You're evaluating multiple providers** - excellent! This gives you strong negotiating leverage.

Let me help you configure the provider evaluation criteria. This will help filter providers who meet your minimum requirements.`,

    // WP3: Updated completion message for tendering
    quick_intake_complete: `**Thanks! I now have a clearer picture of your deal.**

I'll use this context to calculate leverage and recommend initial positions. Now let's decide how you want to start building the contract.`,

    quick_intake_complete_tendering: `**Perfect! Your tendering configuration is set.**

I'll use your qualification threshold and priorities to help evaluate provider alignment once they submit their positions. Now let's decide how to build the contract.`,

    template_source: `**How would you like to start building your contract?**

Choose the approach that best fits your situation:`,

    template_selection: `**Select a template from the library:**

These are pre-configured with industry-standard clauses. You can modify any clause once we begin.`,

    template_selection_modify: `**Select a template to customize:**

You'll be able to modify any clause, add new ones, or remove those you don't need.`,

    no_templates: `I couldn't find any templates matching your criteria. You can either:
- Try a different contract type
- Build your contract from scratch
- Upload an existing document`,

    upload_started: `**Uploading your contract...**

I'm extracting the text from your document. This will just take a moment.`,

    upload_processing: `**Processing your contract...**

I'm analyzing the document structure and identifying clauses. This typically takes 1-2 minutes for larger contracts.

You can wait here, or I'll let you know when it's ready.`,

    upload_ready: `**Your contract is ready!**

I've successfully parsed your document and identified the clauses. Click on it below to review your setup and continue.`,

    upload_failed: `**There was an issue processing your contract.**

Please try uploading again or choose a different source option.`,

    summary: `**Great! Here's a summary of your contract setup:**

I'll create your contract with these settings. Once you confirm, you'll proceed to review and configure the clauses before inviting providers.`,

    summary_training: `**Great! Here's a summary of your training contract setup:** 

I'll create your practice contract with these settings. Once you confirm, you'll be ready to start your training session.`,

    creating: `**Creating your contract...**

Setting up your contract workspace. This will just take a moment.`,

    creating_training: `**Creating your training session...** 

Setting up your practice contract. This will just take a moment.`,

    training_complete: `**Your training session is ready!** 

Your practice contract has been created. You can now start negotiating against the AI opponent or continue with your training partner.`,

    // WP6: Pre-fill message from Contract Library
    prefill_detected: ` **Template pre-selected from your library!**

I've loaded your chosen template. Let's continue with the setup.`
}

// ============================================================================
// SECTION 4: TEXT EXTRACTION UTILITIES
// ============================================================================

const loadPdfJs = async () => {
    const pdfjsLib = await import('pdfjs-dist')
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    }
    return pdfjsLib
}

const extractTextFromPdf = async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n\n'
    }
    return fullText.trim()
}

const extractTextFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
}

const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return extractTextFromPdf(file)
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
        return extractTextFromDocx(file)
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return file.text()
    } else {
        throw new Error(`Unsupported file type: ${fileType}`)
    }
}

// ============================================================================
// SECTION 5: INNER COMPONENT
// ============================================================================

function ContractCreationContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chatEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const pollingCountRef = useRef<number>(0)

    // ========================================================================
    // SECTION 5A: TRAINING MODE & COLORS
    // ========================================================================

    const isTrainingMode = searchParams.get('mode') === 'training'

    // WP6: Check for pre-fill params from Contract Library
    const prefillTemplateSource = searchParams.get('template_source') as TemplateSource
    const prefillTemplateId = searchParams.get('source_template_id')
    const prefillContractType = searchParams.get('contract_type') as ContractType
    const prefillTemplateName = searchParams.get('template_name')
    const hasPrefill = !!(prefillTemplateSource && prefillTemplateId)

    const colors = {
        primary: isTrainingMode ? 'amber' : 'emerald',
        bgLight: isTrainingMode ? 'bg-amber-50' : 'bg-emerald-50',
        bgMedium: isTrainingMode ? 'bg-amber-100' : 'bg-emerald-100',
        bgSolid: isTrainingMode ? 'bg-amber-500' : 'bg-emerald-500',
        bgGradient: isTrainingMode ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600',
        textPrimary: isTrainingMode ? 'text-amber-600' : 'text-emerald-600',
        textDark: isTrainingMode ? 'text-amber-800' : 'text-emerald-800',
        textLight: isTrainingMode ? 'text-amber-200' : 'text-emerald-200',
        borderPrimary: isTrainingMode ? 'border-amber-500' : 'border-emerald-500',
        borderLight: isTrainingMode ? 'border-amber-200' : 'border-emerald-200',
        borderHover: isTrainingMode ? 'hover:border-amber-400' : 'hover:border-emerald-400',
        btnPrimary: isTrainingMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700',
        chatBubble: isTrainingMode ? 'bg-amber-600' : 'bg-emerald-600',
    }

    // ========================================================================
    // SECTION 5B: STATE (WP3 UPDATED)
    // ========================================================================

    const [assessment, setAssessment] = useState<AssessmentState>({
        step: 'welcome',
        mediationType: null,
        contractType: prefillContractType || null,  // WP6: Pre-fill from URL
        templateSource: prefillTemplateSource || null,  // WP6: Pre-fill from URL
        contractName: '',
        contractDescription: '',
        selectedTemplateId: prefillTemplateId || null,  // WP6: Pre-fill from URL
        selectedTemplateName: prefillTemplateName || null,  // WP6: Pre-fill from URL
        uploadedContractId: null,
        uploadedContractStatus: null,
        uploadedFileName: null,
        // WP3: Enhanced quickIntake with tendering defaults
        quickIntake: {
            dealValue: null,
            serviceCriticality: null,
            timelinePressure: null,
            bidderCount: null,
            batnaStatus: null,
            topPriorities: [],
            // WP3: Tendering fields with sensible defaults
            qualificationThreshold: 65,
            evaluationPriorities: ['quality', 'cost', 'risk_mitigation'],
            mustHaveCapabilities: ''
        }
    })

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [templates, setTemplates] = useState<Template[]>([])
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [trainingSessionCreated, setTrainingSessionCreated] = useState<string | null>(null)

    // WP3: Track if tendering section is expanded
    const [showTenderingSection, setShowTenderingSection] = useState(false)

    // WP6: Track if pre-fill has been processed
    const [prefillProcessed, setPrefillProcessed] = useState(false)

    // Transition modal state
    const [transitionState, setTransitionState] = useState<TransitionState>({
        isOpen: false,
        transition: null,
        redirectUrl: null
    })

    // ========================================================================
    // SECTION 5C: LOAD USER INFO
    // ========================================================================

    const loadUserInfo = useCallback(() => {
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) { router.push('/auth/login'); return null }
        try {
            const parsed = JSON.parse(authData)
            return {
                firstName: parsed.userInfo?.firstName || 'User',
                lastName: parsed.userInfo?.lastName || '',
                email: parsed.userInfo?.email || '',
                company: parsed.userInfo?.company || '',
                role: parsed.userInfo?.role || 'customer',
                userId: parsed.userInfo?.userId || '',
                companyId: parsed.userInfo?.companyId || null
            } as UserInfo
        } catch { router.push('/auth/login'); return null }
    }, [router])

    // ========================================================================
    // SECTION 5D: EFFECTS (WP1 UPDATED)
    // ========================================================================

    useEffect(() => { const user = loadUserInfo(); if (user) setUserInfo(user) }, [loadUserInfo])

    // WP6: Handle pre-fill from Contract Library
    useEffect(() => {
        if (hasPrefill && !prefillProcessed) {
            setPrefillProcessed(true)

            // Set welcome message with pre-fill notification
            const welcomeMessage = isTrainingMode ? CLARENCE_MESSAGES.welcome_training : CLARENCE_MESSAGES.welcome
            setChatMessages([
                { id: 'welcome-1', role: 'clarence', content: welcomeMessage, timestamp: new Date() },
                { id: 'prefill-1', role: 'clarence', content: CLARENCE_MESSAGES.prefill_detected, timestamp: new Date() }
            ])

            // Skip to mediation type since contract type and template are pre-selected
            const timer = setTimeout(() => {
                setAssessment(prev => ({ ...prev, step: 'mediation_type' }))
                addClarenceMessage(CLARENCE_MESSAGES.mediation_selection, MEDIATION_OPTIONS)
            }, 1500)

            return () => clearTimeout(timer)
        }
    }, [hasPrefill, prefillProcessed, isTrainingMode])

    // WP1 CHANGE: After welcome, go to contract_type first (not mediation_type)
    // WP6: Skip if we have pre-fill
    useEffect(() => {
        if (hasPrefill) return // Skip standard flow if pre-filled

        const welcomeMessage = isTrainingMode ? CLARENCE_MESSAGES.welcome_training : CLARENCE_MESSAGES.welcome
        setChatMessages([{ id: 'welcome-1', role: 'clarence', content: welcomeMessage, timestamp: new Date() }])
        const timer = setTimeout(() => {
            // WP1: Now go to contract_type first
            setAssessment(prev => ({ ...prev, step: 'contract_type' }))
            addClarenceMessage(CLARENCE_MESSAGES.contract_type, CONTRACT_TYPE_OPTIONS)
        }, 1500)
        return () => clearTimeout(timer)
    }, [isTrainingMode, hasPrefill])

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
    useEffect(() => { if (assessment.step === 'template_selection') loadTemplates() }, [assessment.step])
    useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current) } }, [])

    // Generate suggested contract name (moved from renderSummary to fix React hooks rule)
    const suggestedContractName = useMemo(() => {
        const typeLabels: Record<string, string> = {
            saas: 'SaaS Agreement', it_services: 'IT Services', consulting: 'Consulting Agreement',
            nda: 'NDA', licensing: 'Licensing Agreement', bpo: 'BPO Agreement',
            msa: 'Master Services Agreement', employment: 'Employment Contract', custom: 'Custom Contract'
        };
        const contractType = assessment.contractType || '';
        const typeName = contractType && typeLabels[contractType] ? typeLabels[contractType] : 'Contract';
        const date = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        return typeName + ' - ' + date;
    }, [assessment.contractType])

    // Set default contract name when reaching summary (moved from renderSummary)
    useEffect(() => {
        if (assessment.step === 'summary' && !assessment.contractName) {
            setAssessment(prev => ({ ...prev, contractName: suggestedContractName }))
        }
    }, [assessment.step, assessment.contractName, suggestedContractName])

    // WP3: Auto-expand tendering section when multi-provider selected
    useEffect(() => {
        const isMultiProvider = assessment.quickIntake.bidderCount === 'few' || assessment.quickIntake.bidderCount === 'many'
        if (isMultiProvider && !showTenderingSection) {
            setShowTenderingSection(true)
        }
    }, [assessment.quickIntake.bidderCount])

    // ========================================================================
    // SECTION 5E: HELPER FUNCTIONS
    // ========================================================================

    const addClarenceMessage = (content: string, options?: AssessmentOption[]) => {
        setChatMessages(prev => [...prev, { id: `clarence-${Date.now()}`, role: 'clarence', content, timestamp: new Date(), options }])
    }

    const addUserMessage = (content: string) => {
        setChatMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content, timestamp: new Date() }])
    }

    const getMatchingContractTypes = (selectedType: ContractType): string[] => {
        const typeMapping: Record<string, string[]> = {
            'nda': ['NDA', 'nda', 'Non-Disclosure', 'Confidentiality'],
            'saas': ['SaaS', 'saas', 'Software', 'Software as a Service'],
            'bpo': ['BPO', 'bpo', 'Outsourcing', 'Business Process'],
            'msa': ['MSA', 'msa', 'Master Services', 'Master Service Agreement'],
            'employment': ['Employment', 'employment', 'Employee', 'Staff'],
            'custom': []
        }
        return typeMapping[selectedType || ''] || []
    }

    const loadTemplates = async () => {
        setIsLoadingTemplates(true)
        try {
            const response = await fetch(`${API_BASE}/get-contract-templates`)
            if (response.ok) {
                const data = await response.json()
                const allTemplates: Template[] = data.templates || []
                const matchingTypes = getMatchingContractTypes(assessment.contractType)
                let filteredTemplates = matchingTypes.length === 0 ? allTemplates : allTemplates.filter(t => matchingTypes.some(type => (t.contractType || '').toLowerCase().includes(type.toLowerCase()) || (t.industry || '').toLowerCase().includes(type.toLowerCase())))
                setTemplates(filteredTemplates)
                if (filteredTemplates.length === 0) {
                    addClarenceMessage(`I don't have any **${getContractTypeLabel(assessment.contractType)}** templates available yet.\n\nYou have a few options to proceed:`)
                } else {
                    addClarenceMessage(assessment.templateSource === 'modified_template' ? CLARENCE_MESSAGES.template_selection_modify : CLARENCE_MESSAGES.template_selection)
                }
            } else { setTemplates([]); addClarenceMessage(CLARENCE_MESSAGES.no_templates) }
        } catch { setTemplates([]); addClarenceMessage(CLARENCE_MESSAGES.no_templates) }
        finally { setIsLoadingTemplates(false) }
    }

    // ========================================================================
    // SECTION 5E-2: PATHWAY HELPER FUNCTIONS
    // ========================================================================

    const determinePathwayId = (
        mediationType: MediationType,
        templateSource: TemplateSource
    ): PathwayId | 'UNKNOWN' => {
        const mediationPrefix: Record<NonNullable<MediationType>, string> = {
            'straight_to_contract': 'STC',
            'partial_mediation': 'PM',
            'full_mediation': 'FM'
        }

        const sourceSuffix: Record<NonNullable<TemplateSource>, string> = {
            'existing_template': 'EXISTING',
            'modified_template': 'MODIFIED',
            'uploaded': 'UPLOADED',
            'from_scratch': 'SCRATCH'
        }

        if (!mediationType || !templateSource) {
            return 'UNKNOWN'
        }

        return `${mediationPrefix[mediationType]}-${sourceSuffix[templateSource]}` as PathwayId
    }

    /**
     * Build redirect URL based on pathway
     * - STC-EXISTING: -> invite-provider (true fast-track)
     * - Other STC: -> contract-prep (need to configure positions)
     * - FM/PM: -> strategic-assessment (assessment first, THEN prep)
     */
    const buildRedirectUrl = (
        pathwayId: PathwayId | string,
        sessionId: string,
        contractId?: string | null
    ): string => {
        const params = new URLSearchParams()
        params.set('session_id', sessionId)
        params.set('pathway_id', pathwayId)

        if (contractId) {
            params.set('contract_id', contractId)
        }

        // STC-EXISTING: True fast-track - skip assessment AND prep
        if (pathwayId === 'STC-EXISTING') {
            return `/auth/invite-providers?${params.toString()}`
        }

        // Other STC paths: Skip assessment, go to contract-prep
        if (pathwayId.startsWith('STC-')) {
            return `/auth/contract-prep?${params.toString()}`
        }

        // FM/PM paths: Go to strategic-assessment FIRST
        return `/auth/strategic-assessment?${params.toString()}`
    }

    /**
     * Get the appropriate transition based on pathway
     */
    const getTransitionForPathway = (pathwayId: PathwayId | string): TransitionConfig | null => {
        // STC-EXISTING skips all transitions (goes directly to invite)
        if (pathwayId === 'STC-EXISTING') {
            // Use a custom quick transition
            return {
                id: 'transition_to_invite',
                fromStage: 'pathway_review',
                toStage: 'invite_providers',
                title: 'Session Created',
                message: "Your contract session is ready! Since you're using a pre-configured template, we can skip straight to inviting providers.",
                bulletPoints: [
                    'Template positions are pre-configured',
                    'Invite your provider to begin',
                    'Contract will be generated automatically'
                ],
                buttonText: 'Invite Provider'
            }
        }

        // Other STC paths: Skip assessment, go to prep
        if (pathwayId.startsWith('STC-')) {
            return {
                id: 'transition_to_prep',
                fromStage: 'pathway_review',
                toStage: 'contract_prep',
                title: 'Quick Contract Ready',
                message: "Your Quick Contract session is ready! Review your clauses before inviting the other party to accept.",
                bulletPoints: [
                    'Review your standard contract clauses',
                    'Verify party details and dates',
                    'Proceed to invite when ready'
                ],
                buttonText: 'Continue to Review'
            }
        }

        // FM/PM paths: Go to strategic assessment
        return TRANSITION_CONFIGS.find(t => t.id === 'transition_to_assessment') || null
    }

    const shouldSkipQuickIntake = (mediationType: MediationType): boolean => {
        return mediationType === 'straight_to_contract'
    }

    // WP3: Check if this is a multi-provider (tendering) scenario
    const isMultiProviderScenario = (): boolean => {
        return assessment.quickIntake.bidderCount === 'few' || assessment.quickIntake.bidderCount === 'many'
    }

    // ========================================================================
    // SECTION 5F: UPLOAD FUNCTIONS
    // ========================================================================

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
        const validExtensions = ['.pdf', '.docx', '.txt']
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
        if (!validTypes.includes(file.type) && !hasValidExtension) { setError('Please upload a PDF, DOCX, or TXT file'); return }
        if (file.size > 10 * 1024 * 1024) { setError('File size must be less than 10MB'); return }
        await processUpload(file)
    }

    const processUpload = async (file: File) => {
        if (!userInfo) { setError('User not authenticated'); return }
        setIsUploading(true)
        setError(null)
        setUploadProgress('Extracting text from document...')
        addClarenceMessage(CLARENCE_MESSAGES.upload_started)

        try {
            const extractedText = await extractTextFromFile(file)
            if (!extractedText || extractedText.length < 100) throw new Error('Could not extract sufficient text')
            setUploadProgress('Uploading to CLARENCE...')

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo.userId,
                    company_id: userInfo.companyId,
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    raw_text: extractedText,
                    contract_type: assessment.contractType,
                    mediation_type: assessment.mediationType,
                    template_source: assessment.templateSource
                })
            })

            if (!response.ok) throw new Error('Upload failed')

            const result = await response.json()

            if (result.success && result.contractId) {
                setAssessment(prev => ({ ...prev, step: 'upload_processing', uploadedContractId: result.contractId, uploadedContractStatus: 'processing', uploadedFileName: file.name }))
                addClarenceMessage(CLARENCE_MESSAGES.upload_processing)
                startPollingForStatus(result.contractId)
            } else {
                throw new Error(result.error || 'Upload failed')
            }
        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Upload failed')
            addClarenceMessage(CLARENCE_MESSAGES.upload_failed)
        } finally {
            setIsUploading(false)
            setUploadProgress('')
        }
    }

    const startPollingForStatus = (contractId: string) => {
        pollingCountRef.current = 0
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = setInterval(async () => {
            pollingCountRef.current++
            if (pollingCountRef.current > MAX_POLLING_ATTEMPTS) {
                if (pollingRef.current) clearInterval(pollingRef.current)
                setAssessment(prev => ({ ...prev, uploadedContractStatus: 'failed' }))
                addClarenceMessage(CLARENCE_MESSAGES.upload_failed)
                return
            }
            try {
                const res = await fetch(`${API_BASE}/get-uploaded-contract?contract_id=${contractId}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.status === 'ready' || data.status === 'complete' || data.clauseCount > 0) {
                        if (pollingRef.current) clearInterval(pollingRef.current)
                        setAssessment(prev => ({ ...prev, uploadedContractStatus: 'ready' }))
                        addClarenceMessage(CLARENCE_MESSAGES.upload_ready)
                    } else if (data.status === 'failed' || data.status === 'error') {
                        if (pollingRef.current) clearInterval(pollingRef.current)
                        setAssessment(prev => ({ ...prev, uploadedContractStatus: 'failed' }))
                        addClarenceMessage(CLARENCE_MESSAGES.upload_failed)
                    }
                }
            } catch (err) { console.error('Polling error:', err) }
        }, POLLING_INTERVAL)
    }

    // ========================================================================
    // SECTION 5G: SELECTION HANDLERS (WP1 REORDERED + WP3 ENHANCED)
    // ========================================================================

    // WP1: Contract type is now selected FIRST
    const handleContractTypeSelect = (contractType: ContractType) => {
        setAssessment(prev => ({ ...prev, contractType }))
        const label = CONTRACT_TYPE_OPTIONS.find(o => o.value === contractType)?.label || 'Contract'
        addUserMessage(`I'm creating a ${label}`)

        // Get the appropriate follow-up message
        const messageKey = `contract_type_${contractType}_selected` as keyof typeof CLARENCE_MESSAGES
        const followUpMessage = CLARENCE_MESSAGES[messageKey] || CLARENCE_MESSAGES.mediation_selection

        setTimeout(() => {
            addClarenceMessage(followUpMessage)
            // WP1: Now proceed to mediation type selection
            setAssessment(prev => ({ ...prev, step: 'mediation_type' }))
            setTimeout(() => {
                addClarenceMessage(CLARENCE_MESSAGES.mediation_selection, MEDIATION_OPTIONS)
            }, 500)
        }, 300)
    }

    // WP1: Mediation is now selected SECOND
    const handleMediationSelect = (mediationType: MediationType) => {
        // Quick Contract redirect - STC now has its own dedicated product
        if (mediationType === 'straight_to_contract') {
            const label = MEDIATION_OPTIONS.find(o => o.value === mediationType)?.label || 'Quick Contract'
            addUserMessage(`I'd like ${label}`)
            setTimeout(() => {
                addClarenceMessage("Great choice! Quick Contract is perfect for standard agreements. Let me take you to the Quick Contract studio...")
                setTimeout(() => {
                    router.push('/auth/quick-contract/create')
                }, 1000)
            }, 300)
            return
        }

        setAssessment(prev => ({ ...prev, mediationType }))
        const label = MEDIATION_OPTIONS.find(o => o.value === mediationType)?.label || 'Mediation'
        addUserMessage(`I'd like ${label}`)

        const skipQuickIntake = shouldSkipQuickIntake(mediationType)
        const messageKey = `mediation_${mediationType?.replace('_', '')?.substring(0, 3).toLowerCase()}_selected` as keyof typeof CLARENCE_MESSAGES
        const selectedMessage = CLARENCE_MESSAGES[messageKey] || CLARENCE_MESSAGES.template_source

        setTimeout(() => {
            addClarenceMessage(selectedMessage)
            if (skipQuickIntake) {
                setAssessment(prev => ({ ...prev, step: 'template_source' }))
                setTimeout(() => { addClarenceMessage(CLARENCE_MESSAGES.template_source, TEMPLATE_SOURCE_OPTIONS) }, 500)
            } else {
                setAssessment(prev => ({ ...prev, step: 'quick_intake' }))
                setTimeout(() => {
                    addClarenceMessage(CLARENCE_MESSAGES.quick_intake)
                }, 500)
            }
        }, 300)
    }

    const handleTemplateSourceSelect = (templateSource: TemplateSource) => {
        setAssessment(prev => ({ ...prev, templateSource }))
        const label = TEMPLATE_SOURCE_OPTIONS.find(o => o.value === templateSource)?.label || 'Template'
        addUserMessage(`I'll ${label.toLowerCase()}`)
        if (templateSource === 'existing_template' || templateSource === 'modified_template') {
            setAssessment(prev => ({ ...prev, step: 'template_selection' }))
        } else if (templateSource === 'uploaded') {
            fileInputRef.current?.click()
        } else if (templateSource === 'from_scratch') {
            setAssessment(prev => ({ ...prev, step: 'summary' }))
            addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.summary_training : CLARENCE_MESSAGES.summary)
        }
    }

    const handleTemplateSelect = (template: Template) => {
        setAssessment(prev => ({ ...prev, selectedTemplateId: template.templateId, selectedTemplateName: template.templateName, step: 'summary' }))
        addUserMessage(`I'll use "${template.templateName}"`)
        addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.summary_training : CLARENCE_MESSAGES.summary)
    }

    const handleUploadedContractClick = () => {
        setAssessment(prev => ({ ...prev, step: 'summary' }))
        addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.summary_training : CLARENCE_MESSAGES.summary)
    }

    const handleOptionSelect = (option: AssessmentOption) => {
        switch (assessment.step) {
            case 'contract_type': handleContractTypeSelect(option.value as ContractType); break
            case 'mediation_type': handleMediationSelect(option.value as MediationType); break
            case 'template_source': handleTemplateSourceSelect(option.value as TemplateSource); break
        }
    }

    // WP3: Enhanced Quick Intake completion with tendering acknowledgment
    const handleQuickIntakeComplete = () => {
        const isMultiProvider = isMultiProviderScenario()
        addUserMessage('Deal context complete')

        // WP3: Use appropriate completion message based on tendering
        const completionMessage = isMultiProvider
            ? CLARENCE_MESSAGES.quick_intake_complete_tendering
            : CLARENCE_MESSAGES.quick_intake_complete

        setTimeout(() => {
            addClarenceMessage(completionMessage, TEMPLATE_SOURCE_OPTIONS)
            setAssessment(prev => ({ ...prev, step: 'template_source' }))
        }, 300)
    }

    // ========================================================================
    // SECTION 5H: CREATE CONTRACT (WP3 UPDATED)
    // ========================================================================

    const createContract = async () => {
        if (!userInfo) {
            setError('User not authenticated')
            return
        }

        setIsCreating(true)
        setError(null)
        setAssessment(prev => ({ ...prev, step: 'creating' }))
        addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.creating_training : CLARENCE_MESSAGES.creating)

        try {
            const pathwayId = determinePathwayId(assessment.mediationType, assessment.templateSource)
            console.log('[CreateContract] Pathway ID:', pathwayId)

            // WP3: Enhanced deal_context with tendering data
            const dealContext = {
                deal_value: assessment.quickIntake.dealValue,
                service_criticality: assessment.quickIntake.serviceCriticality,
                timeline_pressure: assessment.quickIntake.timelinePressure,
                bidder_count: assessment.quickIntake.bidderCount,
                batna_status: assessment.quickIntake.batnaStatus,
                top_priorities: assessment.quickIntake.topPriorities,
                // WP3: Add tendering configuration
                tendering_config: isMultiProviderScenario() ? {
                    qualification_threshold: assessment.quickIntake.qualificationThreshold,
                    evaluation_priorities: assessment.quickIntake.evaluationPriorities,
                    must_have_capabilities: assessment.quickIntake.mustHaveCapabilities
                } : null
            }

            const response = await fetch(`${API_BASE}/session-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: userInfo.email,
                    companyName: userInfo.company,
                    userName: `${userInfo.firstName} ${userInfo.lastName}`,
                    isTraining: isTrainingMode,
                    mediation_type: assessment.mediationType,
                    contract_type: assessment.contractType,
                    contract_name: assessment.contractName,  // ADD THIS LINE
                    template_source: assessment.templateSource,
                    source_template_id: assessment.selectedTemplateId,
                    uploaded_contract_id: assessment.uploadedContractId,
                    pathway_id: pathwayId,
                    assessment_completed: true,
                    deal_context: dealContext  // WP3: Enhanced with tendering
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create contract session')
            }

            const result = await response.json()

            if (!result.success || !result.sessionId) {
                throw new Error(result.error || 'No session ID returned')
            }

            // Handle Training Mode (separate flow - no transition modal)
            if (isTrainingMode) {
                setTrainingSessionCreated(result.sessionId)
                addClarenceMessage(CLARENCE_MESSAGES.training_complete)
                setIsCreating(false)
                return
            }

            // Build redirect URL
            const contractId = result.contractId || result.contract_id || assessment.uploadedContractId
            const redirectUrl = buildRedirectUrl(pathwayId, result.sessionId, contractId)

            // Get appropriate transition
            const transition = getTransitionForPathway(pathwayId)

            console.log('[CreateContract] Redirecting to:', redirectUrl)
            console.log('[CreateContract] Showing transition:', transition?.id)

            // Show transition modal instead of immediate redirect
            if (transition) {
                setTransitionState({
                    isOpen: true,
                    transition,
                    redirectUrl
                })
                setIsCreating(false)
            } else {
                // No transition configured, redirect immediately
                router.push(redirectUrl)
            }

        } catch (err) {
            console.error('[CreateContract] Error:', err)
            setError(err instanceof Error ? err.message : 'Failed to create contract')
            setIsCreating(false)
            setAssessment(prev => ({ ...prev, step: 'summary' }))
        }
    }

    // Handle transition modal continue
    const handleTransitionContinue = () => {
        const { redirectUrl } = transitionState
        setTransitionState({ isOpen: false, transition: null, redirectUrl: null })

        if (redirectUrl) {
            router.push(redirectUrl)
        }
    }

    const getContractTypeLabel = (type: ContractType): string => CONTRACT_TYPE_OPTIONS.find(o => o.value === type)?.label || 'Contract'
    const getMediationTypeLabel = (type: MediationType): string => MEDIATION_OPTIONS.find(o => o.value === type)?.label || 'Mediation'
    const getTemplateSourceLabel = (source: TemplateSource): string => TEMPLATE_SOURCE_OPTIONS.find(o => o.value === source)?.label || 'Template'

    // ========================================================================
    // SECTION 6: RENDER - PROGRESS PANEL (WP1 UPDATED)
    // ========================================================================

    const renderProgressPanel = () => {
        // WP1 CHANGE: Reordered steps - contract_type now comes before mediation_type
        const baseSteps = [
            { id: 'contract_type', label: 'Contract Type', icon: '*' },
            { id: 'mediation_type', label: 'Mediation Type', icon: '*' },
        ]

        const quickIntakeStep = !shouldSkipQuickIntake(assessment.mediationType)
            ? [{ id: 'quick_intake', label: 'Deal Context', icon: '*' }]
            : []

        const remainingSteps = [
            { id: 'template_source', label: 'Starting Point', icon: '*' },
            { id: 'summary', label: 'Review & Create', icon: '*' }
        ]

        const steps = [...baseSteps, ...quickIntakeStep, ...remainingSteps]

        // WP1: Updated step order for comparison
        const stepOrder = ['welcome', 'contract_type', 'mediation_type', 'quick_intake', 'template_source', 'template_selection', 'upload_processing', 'summary', 'creating']
        const currentIndex = stepOrder.indexOf(assessment.step)

        return (
            <div className={`h-full ${isTrainingMode ? 'bg-amber-50/30' : 'bg-emerald-50/30'} border-r border-slate-200 flex flex-col`}>
                <div className="p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-3">
                        <Link
                            href="/auth/contracts-dashboard"
                            className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
                            title="Back to Negotiations"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </Link>
                        <span className="text-slate-300">|</span>
                        <Link href={isTrainingMode ? '/auth/training' : '/auth/contracts'} className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1">← {isTrainingMode ? 'Back to Training' : 'Back to Library'}</Link>
                    </div>
                    <h2 className={`font-semibold ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'} text-lg`}>{isTrainingMode ? 'Training Setup' : 'Create Contract'}</h2>
                </div>
                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {steps.map((step, index) => {
                            const stepIndex = stepOrder.indexOf(step.id)
                            const isComplete = currentIndex > stepIndex || assessment.step === 'creating'
                            const isCurrent = currentIndex === stepIndex || (step.id === 'summary' && (assessment.step === 'summary' || assessment.step === 'creating'))
                            const canNavigate = isComplete && assessment.step !== 'creating'

                            const handleStepClick = () => {
                                if (canNavigate) {
                                    setAssessment(prev => ({ ...prev, step: step.id as AssessmentStep }))
                                }
                            }

                            return (
                                <li key={step.id}>
                                    <button
                                        onClick={handleStepClick}
                                        disabled={!canNavigate}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                            ${isCurrent
                                                ? `${colors.bgLight} ${colors.borderPrimary} border`
                                                : isComplete
                                                    ? 'bg-slate-50 hover:bg-slate-100 hover:shadow-sm cursor-pointer'
                                                    : 'cursor-default'
                                            }
                        `}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isComplete ? `${colors.bgSolid} text-white` : isCurrent ? colors.bgMedium : 'bg-slate-100 text-slate-400'}`}>
                                            {isComplete ? '' : step.icon}
                                        </div>
                                        <div className="flex-1">
                                            <span className={`text-sm font-medium ${isCurrent ? colors.textDark : isComplete ? 'text-slate-700' : 'text-slate-400'}`}>
                                                {step.label}
                                            </span>
                                            {canNavigate && (
                                                <span className="text-xs text-slate-400 ml-2">&larr; edit</span>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </nav>
                {isTrainingMode && (
                    <div className="p-4 border-t border-slate-200 bg-amber-50">
                        <div className="flex items-center gap-2 text-amber-700"><span className="text-lg"></span><span className="text-sm font-medium">Training Mode</span></div>
                        <p className="text-xs text-amber-600 mt-1">Practice with AI opponents</p>
                    </div>
                )}
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: RENDER - MAIN PANEL
    // ========================================================================

    const renderMainPanel = () => {
        if (trainingSessionCreated) return renderTrainingComplete()
        return (
            <div className="h-full flex flex-col">
                <div className={`h-14 ${isTrainingMode ? 'bg-amber-600' : 'bg-emerald-600'} flex items-center px-6`}>
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><span className="text-lg">C</span></div>
                        <div><h1 className="font-semibold">{isTrainingMode ? 'Training Contract Setup' : 'New Contract'}</h1><p className="text-xs text-white/70">CLARENCE will guide you through the process</p></div>
                    </div>
                </div>
                <CreateProgressBar currentStage="create_contract" />
                <div className="flex-1 overflow-auto p-6">
                    {assessment.step === 'contract_type' && renderContractType()}
                    {assessment.step === 'mediation_type' && renderMediationType()}
                    {assessment.step === 'quick_intake' && renderQuickIntake()}
                    {assessment.step === 'template_source' && renderTemplateSource()}
                    {assessment.step === 'template_selection' && renderTemplateSelection()}
                    {assessment.step === 'upload_processing' && renderUploadProcessing()}
                    {assessment.step === 'summary' && renderSummary()}
                    {assessment.step === 'creating' && renderCreating()}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" />
            </div>
        )
    }

    // ========================================================================
    // SECTION 7A: RENDER STEPS (WP1 REORDERED)
    // ========================================================================

    // WP1: Contract type renders first now
    const renderContractType = () => (
        <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-slate-800 mb-6">What type of contract are you creating?</h3>
            <div className="grid gap-4">
                {CONTRACT_TYPE_OPTIONS.map((option) => (
                    <button key={option.id} onClick={() => handleOptionSelect(option)} className={`flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 ${colors.borderHover} ${isTrainingMode ? 'hover:bg-amber-50' : 'hover:bg-emerald-50'} transition-all text-left group`}>
                        <div className={`w-12 h-12 rounded-lg ${colors.bgGradient} flex items-center justify-center flex-shrink-0`}><span className="text-white text-2xl">{option.icon}</span></div>
                        <div className="flex-1"><h4 className={`font-semibold text-slate-800 ${isTrainingMode ? 'group-hover:text-amber-800' : 'group-hover:text-emerald-800'}`}>{option.label}</h4><p className="text-sm text-slate-500 mt-1">{option.description}</p></div>
                    </button>
                ))}
            </div>
        </div>
    )

    // WP1: Mediation type renders second now
    const renderMediationType = () => (
        <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-slate-800 mb-6">How much negotiation do you expect?</h3>
            {/* WP6: Show pre-filled info if applicable */}
            {hasPrefill && (
                <div className={`mb-6 p-4 rounded-xl ${colors.bgLight} border ${colors.borderLight}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl"></span>
                        <div>
                            <p className={`text-sm font-medium ${colors.textDark}`}>Template Pre-selected</p>
                            <p className="text-sm text-slate-600">{prefillTemplateName || 'From Contract Library'}</p>
                            <p className="text-xs text-slate-500 mt-1">Contract Type: {getContractTypeLabel(prefillContractType)}</p>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid gap-4">
                {MEDIATION_OPTIONS.map((option) => (
                    <button key={option.id} onClick={() => handleOptionSelect(option)} className={`flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 ${colors.borderHover} ${isTrainingMode ? 'hover:bg-amber-50' : 'hover:bg-emerald-50'} transition-all text-left group`}>
                        <div className={`w-12 h-12 rounded-lg ${colors.bgGradient} flex items-center justify-center flex-shrink-0`}><span className="text-white text-2xl">{option.icon}</span></div>
                        <div className="flex-1"><h4 className={`font-semibold text-slate-800 ${isTrainingMode ? 'group-hover:text-amber-800' : 'group-hover:text-emerald-800'}`}>{option.label}</h4><p className="text-sm text-slate-500 mt-1">{option.description}</p></div>
                    </button>
                ))}
            </div>
        </div>
    )

    // ========================================================================
    // SECTION 7B: RENDER QUICK INTAKE (WP3 ENHANCED WITH TENDERING)
    // ========================================================================

    const renderQuickIntake = () => {
        const { quickIntake } = assessment

        const dealValueOptions = [
            { value: 'under_50k', label: 'Under 50,000' },
            { value: '50k_250k', label: '50,000 - 250,000' },
            { value: '250k_1m', label: '250,000 - 1,000,000' },
            { value: 'over_1m', label: 'Over 1,000,000' }
        ]

        const criticalityOptions = [
            { value: 'low', label: 'Low', description: 'Nice to have' },
            { value: 'medium', label: 'Medium', description: 'Important but not critical' },
            { value: 'high', label: 'High', description: 'Critical to operations' },
            { value: 'critical', label: 'Critical', description: 'Business depends on it' }
        ]

        const timelineOptions = [
            { value: 'flexible', label: 'Flexible', description: 'No rush' },
            { value: 'normal', label: 'Normal', description: '2-4 weeks' },
            { value: 'tight', label: 'Tight', description: '1-2 weeks' },
            { value: 'urgent', label: 'Urgent', description: 'ASAP' }
        ]

        const bidderOptions = [
            { value: 'single', label: 'Single', description: 'Only one option' },
            { value: 'few', label: 'Few', description: '2-3 alternatives' },
            { value: 'many', label: 'Many', description: '4+ alternatives' }
        ]

        // WP3: Check if tendering section should be shown
        const isMultiProvider = quickIntake.bidderCount === 'few' || quickIntake.bidderCount === 'many'

        // WP3: Basic validation - tendering fields optional but recommended
        const isComplete = quickIntake.dealValue && quickIntake.serviceCriticality && quickIntake.timelinePressure && quickIntake.bidderCount

        // WP3: Handler for evaluation priority reordering
        const handlePriorityToggle = (priority: EvaluationPriority) => {
            setAssessment(prev => {
                const current = prev.quickIntake.evaluationPriorities
                if (current.includes(priority)) {
                    // Remove priority
                    return {
                        ...prev,
                        quickIntake: {
                            ...prev.quickIntake,
                            evaluationPriorities: current.filter(p => p !== priority)
                        }
                    }
                } else {
                    // Add priority
                    return {
                        ...prev,
                        quickIntake: {
                            ...prev.quickIntake,
                            evaluationPriorities: [...current, priority]
                        }
                    }
                }
            })
        }

        // WP3: Handler for moving priorities up/down
        const movePriority = (priority: EvaluationPriority, direction: 'up' | 'down') => {
            setAssessment((prev): AssessmentState => {
                const current = [...prev.quickIntake.evaluationPriorities]
                const index = current.indexOf(priority)
                if (index === -1) return prev

                const newIndex = direction === 'up' ? index - 1 : index + 1
                if (newIndex < 0 || newIndex >= current.length) return prev

                // Swap using temp variable (avoids TypeScript inference issues)
                const temp = current[index]
                current[index] = current[newIndex]
                current[newIndex] = temp

                return {
                    ...prev,
                    quickIntake: {
                        ...prev.quickIntake,
                        evaluationPriorities: current
                    }
                }
            })
        }

        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">Deal Context</h3>
                <div className="space-y-6">
                    {/* Estimated Deal Value */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Estimated Deal Value</label>
                        <div className="grid grid-cols-2 gap-2">
                            {dealValueOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, dealValue: opt.value as DealValueRange } }))}
                                    className={`p-3 rounded-lg border-2 text-sm ${quickIntake.dealValue === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Service Criticality */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Service Criticality</label>
                        <div className="grid grid-cols-2 gap-2">
                            {criticalityOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, serviceCriticality: opt.value as ServiceCriticality } }))}
                                    className={`p-3 rounded-lg border-2 text-left ${quickIntake.serviceCriticality === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="font-medium text-sm">{opt.label}</div>
                                    <div className="text-xs text-slate-500">{opt.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Pressure */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Timeline Pressure</label>
                        <div className="grid grid-cols-2 gap-2">
                            {timelineOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, timelinePressure: opt.value as TimelinePressure } }))}
                                    className={`p-3 rounded-lg border-2 text-left ${quickIntake.timelinePressure === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="font-medium text-sm">{opt.label}</div>
                                    <div className="text-xs text-slate-500">{opt.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Number of Potential Providers */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Number of Potential Providers</label>
                        <div className="grid grid-cols-3 gap-2">
                            {bidderOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, bidderCount: opt.value as BidderCount } }))}
                                    className={`p-3 rounded-lg border-2 text-left ${quickIntake.bidderCount === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="font-medium text-sm">{opt.label}</div>
                                    <div className="text-xs text-slate-500">{opt.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ============================================================
                        WP3: TENDERING CONFIGURATION SECTION
                        Only shown when multiple providers are selected
                    ============================================================ */}
                    {isMultiProvider && (
                        <div className={`mt-8 p-5 rounded-xl border-2 ${colors.borderLight} ${colors.bgLight}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-lg ${colors.bgGradient} flex items-center justify-center`}>
                                    <span className="text-white text-xl"></span>
                                </div>
                                <div>
                                    <h4 className={`font-semibold ${colors.textDark}`}>Provider Evaluation</h4>
                                    <p className="text-xs text-slate-500">Configure how CLARENCE evaluates provider alignment</p>
                                </div>
                            </div>

                            {/* Qualification Threshold Slider */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium text-slate-700">Minimum Qualification Threshold</label>
                                    <span className={`text-lg font-bold ${colors.textPrimary}`}>{quickIntake.qualificationThreshold}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="95"
                                    step="5"
                                    value={quickIntake.qualificationThreshold}
                                    onChange={(e) => setAssessment(prev => ({
                                        ...prev,
                                        quickIntake: { ...prev.quickIntake, qualificationThreshold: parseInt(e.target.value) }
                                    }))}
                                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isTrainingMode ? 'accent-amber-500' : 'accent-emerald-500'}`}
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>50% (More inclusive)</span>
                                    <span>95% (Highly selective)</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    Providers scoring below this threshold will be flagged as "Below Minimum Requirements"
                                </p>
                            </div>

                            {/* Evaluation Priorities */}
                            <div className="mb-4">
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Evaluation Priorities</label>
                                <p className="text-xs text-slate-500 mb-3">
                                    Select and order what matters most. Top priorities carry more weight in alignment scoring.
                                </p>

                                {/* Selected priorities (ordered) */}
                                {quickIntake.evaluationPriorities.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                        <div className="text-xs font-medium text-slate-500 mb-1">Your priorities (drag to reorder):</div>
                                        {quickIntake.evaluationPriorities.map((priority, index) => {
                                            const option = EVALUATION_PRIORITY_OPTIONS.find(o => o.value === priority)
                                            if (!option) return null
                                            return (
                                                <div
                                                    key={priority}
                                                    className={`flex items-center gap-2 p-2 rounded-lg ${colors.bgMedium} border ${colors.borderPrimary}`}
                                                >
                                                    <span className={`w-6 h-6 rounded-full ${colors.bgSolid} text-white text-xs flex items-center justify-center font-bold`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-lg">{option.icon}</span>
                                                    <span className="flex-1 text-sm font-medium">{option.label}</span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => movePriority(priority, 'up')}
                                                            disabled={index === 0}
                                                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                        >
                                                            &uarr;
                                                        </button>
                                                        <button
                                                            onClick={() => movePriority(priority, 'down')}
                                                            disabled={index === quickIntake.evaluationPriorities.length - 1}
                                                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                        >
                                                            &darr;
                                                        </button>
                                                        <button
                                                            onClick={() => handlePriorityToggle(priority)}
                                                            className="p-1 text-red-400 hover:text-red-600"
                                                        >
                                                            x
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Available priorities to add */}
                                <div className="grid grid-cols-2 gap-2">
                                    {EVALUATION_PRIORITY_OPTIONS.filter(opt => !quickIntake.evaluationPriorities.includes(opt.value)).map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handlePriorityToggle(opt.value)}
                                            className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:border-slate-300 text-left"
                                        >
                                            <span className="text-lg">{opt.icon}</span>
                                            <span className="text-sm">{opt.label}</span>
                                            <span className="ml-auto text-slate-400">+</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Must-Have Capabilities (optional) */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    Must-Have Requirements <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={quickIntake.mustHaveCapabilities}
                                    onChange={(e) => setAssessment(prev => ({
                                        ...prev,
                                        quickIntake: { ...prev.quickIntake, mustHaveCapabilities: e.target.value }
                                    }))}
                                    placeholder="E.g., ISO 27001 certification, 24/7 support, UK data residency..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                    rows={2}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    CLARENCE will highlight providers who don't meet these requirements
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Continue Button */}
                    <button
                        onClick={handleQuickIntakeComplete}
                        disabled={!isComplete}
                        className={`w-full py-3 rounded-lg ${colors.btnPrimary} text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        Continue &rarr;
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7C: REMAINING RENDER FUNCTIONS
    // ========================================================================

    const renderTemplateSource = () => (
        <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-slate-800 mb-6">How would you like to start?</h3>
            <div className="grid gap-4">
                {TEMPLATE_SOURCE_OPTIONS.map((option) => (
                    <button key={option.id} onClick={() => handleOptionSelect(option)} className={`flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 ${colors.borderHover} ${isTrainingMode ? 'hover:bg-amber-50' : 'hover:bg-emerald-50'} transition-all text-left group`}>
                        <div className={`w-12 h-12 rounded-lg ${colors.bgGradient} flex items-center justify-center flex-shrink-0`}><span className="text-white text-2xl">{option.icon}</span></div>
                        <div className="flex-1">
                            <h4 className={`font-semibold text-slate-800 ${isTrainingMode ? 'group-hover:text-amber-800' : 'group-hover:text-emerald-800'}`}>{option.label}</h4>
                            <p className="text-sm text-slate-500 mt-1">{option.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )

    const renderUploadProcessing = () => {
        const status = assessment.uploadedContractStatus
        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">Processing Your Contract</h3>
                <div className={`p-6 rounded-xl border-2 ${status === 'ready' ? `${colors.borderPrimary} ${colors.bgLight}` : status === 'failed' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-4">
                        {status === 'processing' && <div className={`w-10 h-10 border-4 ${isTrainingMode ? 'border-amber-600' : 'border-emerald-600'} border-t-transparent rounded-full animate-spin`}></div>}
                        {status === 'ready' && <div className={`w-10 h-10 rounded-full ${colors.bgSolid} flex items-center justify-center`}><span className="text-white text-xl"></span></div>}
                        {status === 'failed' && <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center"><span className="text-white text-xl">X</span></div>}
                        <div className="flex-1">
                            <p className="font-medium text-slate-800">{assessment.uploadedFileName}</p>
                            <p className="text-sm text-slate-500">{status === 'processing' ? 'Analyzing document structure...' : status === 'ready' ? 'Ready to review' : 'Processing failed'}</p>
                        </div>
                        {status === 'ready' && <button onClick={handleUploadedContractClick} className={`px-4 py-2 rounded-lg ${colors.btnPrimary} text-white text-sm`}>Continue &rarr;</button>}
                    </div>
                </div>
                {error && <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>}
            </div>
        )
    }

    const renderTemplateSelection = () => {
        if (isLoadingTemplates) return <div className="flex items-center justify-center h-64"><div className={`w-12 h-12 border-4 ${isTrainingMode ? 'border-amber-600' : 'border-emerald-600'} border-t-transparent rounded-full animate-spin`}></div></div>
        if (templates.length === 0) return <div className="max-w-2xl mx-auto text-center py-8"><h3 className="text-lg font-medium text-slate-800 mb-2">No templates available</h3><p className="text-sm text-slate-500">Try building from scratch or uploading a contract.</p></div>

        return (
            <div className="max-w-3xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">{assessment.templateSource === 'modified_template' ? 'Select a Template to Customize' : 'Select a Template'}</h3>
                <div className="grid gap-4">
                    {templates.map((template) => (
                        <button key={template.templateId} onClick={() => handleTemplateSelect(template)} className={`flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 ${colors.borderHover} ${isTrainingMode ? 'hover:bg-amber-50' : 'hover:bg-emerald-50'} transition-all text-left group`}>
                            <div className={`w-14 h-14 rounded-lg ${colors.bgGradient} flex items-center justify-center flex-shrink-0`}><span className="text-white text-2xl"></span></div>
                            <div className="flex-1 min-w-0">
                                <h4 className={`font-semibold text-slate-800 ${isTrainingMode ? 'group-hover:text-amber-800' : 'group-hover:text-emerald-800'}`}>{template.templateName}</h4>
                                <p className="text-sm text-slate-500 mb-2">{template.description || `Standard ${template.contractType} template`}</p>
                                <div className="flex items-center gap-4 text-xs text-slate-400"><span> {template.clauseCount} clauses</span><span> {template.industry}</span></div>
                            </div>
                            <div className={`text-slate-400 ${isTrainingMode ? 'group-hover:text-amber-500' : 'group-hover:text-emerald-500'} self-center text-xl`}>&rarr;</div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // WP1 + WP3: Summary now shows Contract Type before Mediation Type and includes tendering
    const renderSummary = () => {
        const isMultiProvider = isMultiProviderScenario()

        // Note: suggestedName logic moved to component level (suggestedContractName) to fix React hooks rules

        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">{isTrainingMode ? ' Training Contract Summary' : 'Contract Setup Summary'}</h3>

                {/* Contract Name Input - Prominent at top */}
                <div className={`p-5 rounded-xl mb-6 ${isTrainingMode ? 'bg-amber-50 border-2 border-amber-300' : 'bg-emerald-50 border-2 border-emerald-300'}`}>
                    <label className={`block text-sm font-medium mb-2 ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'}`}>
                        Name Your Contract
                    </label>
                    <input
                        type="text"
                        value={assessment.contractName}
                        onChange={(e) => setAssessment(prev => ({ ...prev, contractName: e.target.value }))}
                        placeholder="e.g., SaaS Contract for XYZ Company"
                        className={`w-full px-4 py-3 rounded-lg border-2 text-lg font-medium focus:outline-none transition-colors
                        ${isTrainingMode
                                ? 'border-amber-200 focus:border-amber-400 bg-white'
                                : 'border-emerald-200 focus:border-emerald-400 bg-white'
                            }`}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        This name will appear on your dashboard and help you identify this contract
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    {/* WP1: Show Contract Type first */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl"></span>
                            <div>
                                <p className="text-sm text-slate-500">Contract Type</p>
                                <p className="font-medium text-slate-800">{getContractTypeLabel(assessment.contractType)}</p>
                            </div>
                        </div>
                    </div>
                    {/* WP1: Show Mediation Type second */}
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl"></span>
                            <div>
                                <p className="text-sm text-slate-500">Mediation Type</p>
                                <p className="font-medium text-slate-800">{getMediationTypeLabel(assessment.mediationType)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl"></span>
                            <div>
                                <p className="text-sm text-slate-500">Starting Point</p>
                                <p className="font-medium text-slate-800">{getTemplateSourceLabel(assessment.templateSource)}</p>
                            </div>
                        </div>
                    </div>
                    {assessment.selectedTemplateName && (
                        <div className={`p-4 rounded-lg ${isTrainingMode ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl"></span>
                                <div>
                                    <p className={`text-sm ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'}`}>Selected Template</p>
                                    <p className={`font-medium ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'}`}>{assessment.selectedTemplateName}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {assessment.uploadedFileName && (
                        <div className={`p-4 rounded-lg ${isTrainingMode ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl"></span>
                                <div>
                                    <p className={`text-sm ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'}`}>Uploaded Contract</p>
                                    <p className={`font-medium ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'}`}>{assessment.uploadedFileName}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WP3: Tendering configuration summary */}
                    {isMultiProvider && (
                        <div className={`p-4 rounded-lg ${isTrainingMode ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border`}>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl"></span>
                                <div>
                                    <p className={`text-sm ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'}`}>Provider Evaluation</p>
                                    <p className={`font-medium ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'}`}>
                                        Minimum {assessment.quickIntake.qualificationThreshold}% alignment required
                                    </p>
                                </div>
                            </div>
                            {assessment.quickIntake.evaluationPriorities.length > 0 && (
                                <div className="ml-11 flex flex-wrap gap-2">
                                    {assessment.quickIntake.evaluationPriorities.slice(0, 3).map((priority, index) => {
                                        const option = EVALUATION_PRIORITY_OPTIONS.find(o => o.value === priority)
                                        return (
                                            <span key={priority} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${isTrainingMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                <span className="font-bold">#{index + 1}</span> {option?.icon} {option?.label}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {isTrainingMode && (
                        <div className="p-4 rounded-lg bg-amber-100 border border-amber-300">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl"></span>
                                <div>
                                    <p className="text-sm text-amber-700 font-medium">Training Mode Active</p>
                                    <p className="text-sm text-amber-600">This is for practice only.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {error && <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>}
                <div className="flex gap-4">
                    <button onClick={() => setAssessment(prev => ({ ...prev, step: assessment.uploadedContractId ? 'upload_processing' : assessment.selectedTemplateId ? 'template_selection' : 'template_source' }))} className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">&larr; Back</button>
                    <button onClick={createContract} disabled={isCreating} className={`flex-1 px-6 py-3 rounded-lg ${colors.btnPrimary} text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2`}>
                        {isCreating ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating...</> : <>{isTrainingMode ? 'Create Training Session' : 'Create Contract'} &rarr;</>}
                    </button>
                </div>
            </div>
        )
    }

    const renderCreating = () => (
        <div className="max-w-2xl mx-auto text-center">
            <div className={`w-20 h-20 ${colors.bgGradient} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{isTrainingMode ? 'Creating Training Session...' : 'Creating Your Contract...'}</h2>
            <p className="text-slate-500">Setting up your workspace. This will just take a moment.</p>
        </div>
    )

    const renderTrainingComplete = () => (
        <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl"></span></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Training Session Created!</h2>
            <p className="text-slate-500 mb-8">Your practice contract is ready.</p>
            <div className="flex gap-4">
                <button onClick={() => router.push('/auth/training')} className="flex-1 px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">Back to Training</button>
                <button onClick={() => router.push(`/auth/training/${trainingSessionCreated}`)} className="flex-1 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium">Start Training &rarr;</button>
            </div>
        </div>
    )

    // ========================================================================
    // SECTION 8: CHAT PANEL
    // ========================================================================

    const renderChatPanel = () => (
        <div className={`h-full flex flex-col ${isTrainingMode ? 'bg-gradient-to-b from-amber-50 to-white' : 'bg-gradient-to-b from-emerald-50 to-white'} border-l border-slate-200`}>
            <div className="p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${colors.bgGradient} flex items-center justify-center`}><span className="text-white text-lg">C</span></div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-800">Clarence</h3>
                        <p className={`text-xs ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'} flex items-center gap-1`}>
                            <span className={`w-2 h-2 rounded-full ${isTrainingMode ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            {isTrainingMode ? 'Training Assistant' : 'Online'}
                        </p>
                    </div>
                    <FeedbackButton position="header" />
                </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {chatMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user' ? `${colors.chatBubble} text-white rounded-br-md` : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'}`}>
                            <div className="text-sm whitespace-pre-wrap">{message.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>)}</div>
                            <div className={`text-xs mt-2 ${message.role === 'user' ? colors.textLight : 'text-slate-400'}`}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-slate-200 bg-white"><div className="text-xs text-slate-500 text-center">{isTrainingMode ? ' Guiding your training setup' : 'Guiding you through contract setup'}</div></div>
        </div>
    )

    // ========================================================================
    // SECTION 9: MAIN RENDER
    // ========================================================================

    return (
        <div className="h-screen flex bg-slate-100">
            <div className="w-64 flex-shrink-0">{renderProgressPanel()}</div>
            <div className="flex-1 min-w-0">{renderMainPanel()}</div>
            <div className="w-96 flex-shrink-0">{renderChatPanel()}</div>

            {/* Transition Modal */}
            <TransitionModal
                isOpen={transitionState.isOpen}
                transition={transitionState.transition}
                onContinue={handleTransitionContinue}
            />
        </div>
    )
}

// ============================================================================
// SECTION 10: LOADING FALLBACK & EXPORT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="h-screen flex bg-slate-100">
            <div className="w-64 flex-shrink-0 bg-emerald-50/30 border-r border-slate-200"><div className="p-4 border-b bg-white"><div className="h-4 bg-slate-200 rounded w-24 mb-2"></div><div className="h-6 bg-slate-200 rounded w-32"></div></div></div>
            <div className="flex-1 min-w-0 bg-white flex items-center justify-center"><div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div></div>
            <div className="w-96 flex-shrink-0 bg-gradient-to-b from-emerald-50 to-white border-l border-slate-200"></div>
        </div>
    )
}

export default function ContractCreationAssessment() {
    return <Suspense fallback={<LoadingFallback />}><ContractCreationContent /></Suspense>
}