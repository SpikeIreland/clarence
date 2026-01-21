'use client'

// ============================================================================
// CLARENCE Create Contract Page - V2 WITH TRANSITION MODAL
// ============================================================================
// File: /app/auth/create-contract/page.tsx
// Purpose: Contract creation assessment wizard with training mode support
// Training Mode: Activated via ?mode=training URL parameter
// Stage: CREATE (Emerald) - Training overrides to Amber
// 
// V2 CHANGES:
// 1. Added TransitionModal integration for stage transitions
// 2. Fixed redirect flow: FM/PM paths → strategic-assessment first
// 3. STC paths: STC-EXISTING → invite, others → contract-prep
// 4. Pathway state initialization
// ============================================================================

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FeedbackButton from '@/app/components/FeedbackButton'

// NEW: Import TransitionModal and pathway utilities
import { TransitionModal } from '@/app/components/create-phase/TransitionModal'
import {
    getPathwayId as getPathwayIdFromUtils,
    TRANSITION_CONFIGS,
    isStraightToContract,
    isTrueFastTrack,
    type PathwayId,
    type TransitionConfig
} from '@/lib/pathway-utils'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

type MediationType = 'straight_to_contract' | 'partial_mediation' | 'full_mediation' | null
type ContractType = 'nda' | 'saas' | 'bpo' | 'msa' | 'employment' | 'custom' | null
type TemplateSource = 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch' | null
type AssessmentStep = 'welcome' | 'mediation_type' | 'contract_type' | 'quick_intake' | 'template_source' | 'template_selection' | 'upload_processing' | 'summary' | 'creating'

type DealValueRange = 'under_50k' | '50k_250k' | '250k_1m' | 'over_1m' | null
type ServiceCriticality = 'low' | 'medium' | 'high' | 'critical' | null
type TimelinePressure = 'flexible' | 'normal' | 'tight' | 'urgent' | null
type BidderCount = 'single' | 'few' | 'many' | null
type BatnaStatus = 'strong' | 'weak' | 'uncertain' | null

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    role: string
    userId: string
    companyId: string | null
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
    quickIntake: {
        dealValue: DealValueRange
        serviceCriticality: ServiceCriticality
        timelinePressure: TimelinePressure
        bidderCount: BidderCount
        batnaStatus: BatnaStatus
        topPriorities: string[]
    }
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

// NEW: Transition state for modal
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
    { id: 'nda', label: 'Non-Disclosure Agreement (NDA)', description: 'Confidentiality and information protection agreement', value: 'nda', icon: '🔒' },
    { id: 'saas', label: 'SaaS Agreement', description: 'Software as a Service subscription terms', value: 'saas', icon: '☁️' },
    { id: 'bpo', label: 'BPO / Outsourcing Agreement', description: 'Business process outsourcing and managed services', value: 'bpo', icon: '🏢' },
    { id: 'msa', label: 'Master Services Agreement', description: 'Umbrella agreement for ongoing service relationships', value: 'msa', icon: '📋' },
    { id: 'employment', label: 'Employment Contract', description: 'Employment terms and conditions', value: 'employment', icon: '👤' },
    { id: 'custom', label: 'Custom / Other', description: 'Build a custom contract type', value: 'custom', icon: '✏️' }
]

const TEMPLATE_SOURCE_OPTIONS: AssessmentOption[] = [
    { id: 'existing', label: 'Use Existing Template', description: 'Start with a pre-built template from the library', value: 'existing_template', icon: '📄' },
    { id: 'modify', label: 'Modify Existing Template', description: 'Start with a template and customize it', value: 'modified_template', icon: '✏️' },
    { id: 'upload', label: 'Upload a Contract', description: 'Upload an existing contract document (PDF/DOCX) and convert it', value: 'uploaded', icon: '📤' },
    { id: 'scratch', label: 'Build from Scratch', description: 'Create a new contract clause by clause', value: 'from_scratch', icon: '🔨' }
]

const POLLING_INTERVAL = 5000
const MAX_POLLING_ATTEMPTS = 60

// ============================================================================
// SECTION 3: CLARENCE MESSAGES
// ============================================================================

const CLARENCE_MESSAGES = {
    welcome: `Hello! I'm Clarence, your contract negotiation assistant. 

I'll help you set up your new contract in just a few steps. First, I need to understand what type of negotiation process you're looking for.

**Let's get started!**`,

    welcome_training: `Hello! I'm Clarence, your training assistant. 🎓

I'll help you set up a **practice contract** for your training session. This works exactly like the real thing, but with no real-world consequences.

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

    contract_type_stc_selected: `**Great choice!**

Since you're going Straight to Contract, let's get you to the template selection quickly.

**How would you like to start building your contract?**`,

    quick_intake: `**Let me understand your deal context.**

A few quick questions will help me provide better guidance during clause review and negotiation. This only takes about 30 seconds.`,

    quick_intake_complete: `**Thanks! I now have a clearer picture of your deal.**

This context will help me provide relevant suggestions during contract preparation and negotiation. Now let's choose how you'd like to build your contract.`,

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

    summary_training: `**Great! Here's a summary of your training contract setup:** 🎓

I'll create your practice contract with these settings. Once you confirm, you'll be ready to start your training session.`,

    creating: `**Creating your contract...**

Setting up your contract workspace. This will just take a moment.`,

    creating_training: `**Creating your training session...** 🎓

Setting up your practice contract. This will just take a moment.`,

    training_complete: `**Your training session is ready!** 🎓

Your practice contract has been created. You can now start negotiating against the AI opponent or continue with your training partner.`
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
    // SECTION 5B: STATE
    // ========================================================================

    const [assessment, setAssessment] = useState<AssessmentState>({
        step: 'welcome',
        mediationType: null,
        contractType: null,
        templateSource: null,
        contractName: '',
        contractDescription: '',
        selectedTemplateId: null,
        selectedTemplateName: null,
        uploadedContractId: null,
        uploadedContractStatus: null,
        uploadedFileName: null,
        quickIntake: { dealValue: null, serviceCriticality: null, timelinePressure: null, bidderCount: null, batnaStatus: null, topPriorities: [] }
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

    // NEW: Transition modal state
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
    // SECTION 5D: EFFECTS
    // ========================================================================

    useEffect(() => { const user = loadUserInfo(); if (user) setUserInfo(user) }, [loadUserInfo])

    useEffect(() => {
        const welcomeMessage = isTrainingMode ? CLARENCE_MESSAGES.welcome_training : CLARENCE_MESSAGES.welcome
        setChatMessages([{ id: 'welcome-1', role: 'clarence', content: welcomeMessage, timestamp: new Date() }])
        const timer = setTimeout(() => {
            setAssessment(prev => ({ ...prev, step: 'mediation_type' }))
            addClarenceMessage(CLARENCE_MESSAGES.mediation_type, MEDIATION_OPTIONS)
        }, 1500)
        return () => clearTimeout(timer)
    }, [isTrainingMode])

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
    useEffect(() => { if (assessment.step === 'template_selection') loadTemplates() }, [assessment.step])
    useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current) } }, [])

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
                let filteredTemplates = matchingTypes.length === 0 ? allTemplates : allTemplates.filter(t => matchingTypes.some(type => t.contractType.toLowerCase().includes(type.toLowerCase()) || t.industry.toLowerCase().includes(type.toLowerCase())))
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
    // SECTION 5E-2: PATHWAY HELPER FUNCTIONS (UPDATED)
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
     * UPDATED: Build redirect URL based on pathway
     * - STC-EXISTING: → invite-provider (true fast-track)
     * - Other STC: → contract-prep (need to configure positions)
     * - FM/PM: → strategic-assessment (assessment first, THEN prep)
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
            return `/auth/invite-provider?${params.toString()}`
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
                title: 'Session Created',
                message: "Your contract session is ready! Let's prepare your contract positions before inviting providers.",
                bulletPoints: [
                    'Review and configure each clause',
                    'Set your ideal positions and ranges',
                    'Weight clauses by importance'
                ],
                buttonText: 'Continue to Contract Prep'
            }
        }

        // FM/PM paths: Go to strategic assessment
        return TRANSITION_CONFIGS.find(t => t.id === 'transition_to_assessment') || null
    }

    const shouldSkipQuickIntake = (mediationType: MediationType): boolean => {
        return mediationType === 'straight_to_contract'
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

            const response = await fetch(`${API_BASE}/parse-contract-v2`, {
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
                    if (data.contract?.status === 'ready') {
                        if (pollingRef.current) clearInterval(pollingRef.current)
                        setAssessment(prev => ({ ...prev, uploadedContractStatus: 'ready' }))
                        addClarenceMessage(CLARENCE_MESSAGES.upload_ready)
                    } else if (data.contract?.status === 'failed') {
                        if (pollingRef.current) clearInterval(pollingRef.current)
                        setAssessment(prev => ({ ...prev, uploadedContractStatus: 'failed' }))
                        addClarenceMessage(CLARENCE_MESSAGES.upload_failed)
                    }
                }
            } catch (e) { console.error('Polling error:', e) }
        }, POLLING_INTERVAL)
    }

    // ========================================================================
    // SECTION 5G: SELECTION HANDLERS
    // ========================================================================

    const handleMediationSelect = (option: AssessmentOption) => {
        const mediationType = option.value as MediationType
        setAssessment(prev => ({ ...prev, mediationType }))
        addUserMessage(option.label)

        const messageKey = `mediation_${option.value}_selected` as keyof typeof CLARENCE_MESSAGES
        const message = CLARENCE_MESSAGES[messageKey] || CLARENCE_MESSAGES.contract_type

        setTimeout(() => {
            setAssessment(prev => ({ ...prev, step: 'contract_type' }))
            addClarenceMessage(message, CONTRACT_TYPE_OPTIONS)
        }, 500)
    }

    const handleContractTypeSelect = (option: AssessmentOption) => {
        const contractType = option.value as ContractType
        setAssessment(prev => ({ ...prev, contractType }))
        addUserMessage(option.label)

        const skipQuickIntake = shouldSkipQuickIntake(assessment.mediationType)

        setTimeout(() => {
            if (skipQuickIntake) {
                setAssessment(prev => ({ ...prev, step: 'template_source' }))
                addClarenceMessage(CLARENCE_MESSAGES.contract_type_stc_selected, TEMPLATE_SOURCE_OPTIONS)
            } else {
                setAssessment(prev => ({ ...prev, step: 'quick_intake' }))
                addClarenceMessage(CLARENCE_MESSAGES.quick_intake)
            }
        }, 500)
    }

    const handleQuickIntakeComplete = () => {
        addUserMessage('Deal context completed')
        setTimeout(() => {
            setAssessment(prev => ({ ...prev, step: 'template_source' }))
            addClarenceMessage(CLARENCE_MESSAGES.quick_intake_complete, TEMPLATE_SOURCE_OPTIONS)
        }, 500)
    }

    const handleTemplateSourceSelect = (option: AssessmentOption) => {
        const templateSource = option.value as TemplateSource
        setAssessment(prev => ({ ...prev, templateSource }))
        addUserMessage(option.label)

        setTimeout(() => {
            if (templateSource === 'existing_template' || templateSource === 'modified_template') {
                setAssessment(prev => ({ ...prev, step: 'template_selection' }))
            } else if (templateSource === 'uploaded') {
                fileInputRef.current?.click()
            } else {
                setAssessment(prev => ({ ...prev, step: 'summary' }))
                addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.summary_training : CLARENCE_MESSAGES.summary)
            }
        }, 500)
    }

    const handleTemplateSelect = (template: Template) => {
        setAssessment(prev => ({ ...prev, selectedTemplateId: template.templateId, selectedTemplateName: template.templateName, step: 'summary' }))
        addUserMessage(`Selected: ${template.templateName}`)
        setTimeout(() => addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.summary_training : CLARENCE_MESSAGES.summary), 500)
    }

    const handleUploadedContractClick = () => {
        if (assessment.uploadedContractStatus !== 'ready' || !assessment.uploadedContractId) {
            console.warn('[handleUploadedContractClick] Contract not ready or no ID')
            return
        }
        setAssessment(prev => ({ ...prev, step: 'summary' }))
        setTimeout(() => addClarenceMessage(isTrainingMode ? CLARENCE_MESSAGES.summary_training : CLARENCE_MESSAGES.summary), 500)
    }

    const handleOptionSelect = (option: AssessmentOption) => {
        switch (assessment.step) {
            case 'mediation_type': handleMediationSelect(option); break
            case 'contract_type': handleContractTypeSelect(option); break
            case 'template_source': handleTemplateSourceSelect(option); break
        }
    }

    // ========================================================================
    // SECTION 5H: CONTRACT CREATION (UPDATED WITH TRANSITION MODAL)
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
                    template_source: assessment.templateSource,
                    source_template_id: assessment.selectedTemplateId,
                    uploaded_contract_id: assessment.uploadedContractId,
                    pathway_id: pathwayId,
                    assessment_completed: true,
                    deal_context: {
                        deal_value: assessment.quickIntake.dealValue,
                        service_criticality: assessment.quickIntake.serviceCriticality,
                        timeline_pressure: assessment.quickIntake.timelinePressure,
                        bidder_count: assessment.quickIntake.bidderCount,
                        batna_status: assessment.quickIntake.batnaStatus,
                        top_priorities: assessment.quickIntake.topPriorities
                    }
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

            // NEW: Show transition modal instead of immediate redirect
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

    // NEW: Handle transition modal continue
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
    // SECTION 6: RENDER - PROGRESS PANEL
    // ========================================================================

    const renderProgressPanel = () => {
        const baseSteps = [
            { id: 'mediation_type', label: 'Mediation Type', icon: '⚖️' },
            { id: 'contract_type', label: 'Contract Type', icon: '📋' },
        ]

        const quickIntakeStep = !shouldSkipQuickIntake(assessment.mediationType)
            ? [{ id: 'quick_intake', label: 'Deal Context', icon: '📊' }]
            : []

        const remainingSteps = [
            { id: 'template_source', label: 'Template Source', icon: '📄' },
            { id: 'template_selection', label: 'Select Template', icon: '✔', conditional: true },
            { id: 'upload_processing', label: 'Upload Contract', icon: '📤', conditional: true },
            { id: 'summary', label: 'Review & Create', icon: '✅' }
        ]

        const steps = [...baseSteps, ...quickIntakeStep, ...remainingSteps]

        const visibleSteps = steps.filter(step => {
            if (step.id === 'template_selection') return assessment.templateSource === 'existing_template' || assessment.templateSource === 'modified_template'
            if (step.id === 'upload_processing') return assessment.templateSource === 'uploaded'
            return true
        })

        const stepOrder = ['welcome', 'mediation_type', 'contract_type', 'quick_intake', 'template_source', 'template_selection', 'upload_processing', 'summary', 'creating']
        const currentIndex = stepOrder.indexOf(assessment.step)

        return (
            <div className={`h-full flex flex-col ${isTrainingMode ? 'bg-amber-50/50' : 'bg-emerald-50/30'} border-r border-slate-200`}>
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href={isTrainingMode ? "/auth/training" : "/auth/contracts-dashboard"} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-3">
                        ← {isTrainingMode ? 'Back to Training' : 'Back to Dashboard'}
                    </Link>

                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 ${colors.bgGradient} rounded-lg flex items-center justify-center`}>
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">CLARENCE</span>
                                <span className={`font-semibold ${isTrainingMode ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {isTrainingMode ? 'Training' : 'Create'}
                                </span>
                            </div>
                            <div className="text-xs text-slate-400">The Honest Broker</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${isTrainingMode ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                            <span className={`text-xs ${isTrainingMode ? 'text-slate-400' : 'text-emerald-600 font-medium'}`}>Create</span>
                        </div>
                        <div className="w-3 h-px bg-slate-300" />
                        <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${isTrainingMode ? 'bg-amber-500' : 'bg-slate-300'}`} />
                            <span className={`text-xs ${isTrainingMode ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>Negotiate</span>
                        </div>
                        <div className="w-3 h-px bg-slate-300" />
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                            <span className="text-xs text-slate-400">Agree</span>
                        </div>
                    </div>
                </div>

                <div className="px-4 py-3 bg-white border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">{isTrainingMode ? '🎓 Training Contract' : 'Contract Creation'}</h2>
                    <p className="text-xs text-slate-500">Setup Assessment</p>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    <div className="space-y-2">
                        {visibleSteps.map((step, index) => {
                            const stepIndex = stepOrder.indexOf(step.id)
                            const isComplete = currentIndex > stepIndex
                            const isCurrent = currentIndex === stepIndex || (assessment.step === 'creating' && step.id === 'summary')
                            const isPending = !isComplete && !isCurrent

                            return (
                                <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isCurrent ? (isTrainingMode ? 'bg-amber-100 border border-amber-300' : 'bg-emerald-100 border border-emerald-300') : isComplete ? 'bg-white border border-slate-200' : 'bg-slate-50/50 border border-transparent'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isComplete ? (isTrainingMode ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white') : isCurrent ? (isTrainingMode ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800') : 'bg-slate-200 text-slate-400'}`}>
                                        {isComplete ? '✓' : step.icon}
                                    </div>
                                    <span className={`text-sm ${isCurrent ? (isTrainingMode ? 'text-amber-800 font-semibold' : 'text-emerald-800 font-semibold') : isComplete ? 'text-slate-700' : 'text-slate-400'}`}>{step.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {assessment.mediationType && (
                    <div className={`p-4 border-t ${isTrainingMode ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                        <div className="text-xs text-slate-500 mb-1">Pathway</div>
                        <div className={`text-sm font-medium ${isTrainingMode ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {determinePathwayId(assessment.mediationType, assessment.templateSource)}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: RENDER - MAIN PANEL CONTENT
    // ========================================================================

    const renderMainPanel = () => {
        if (trainingSessionCreated) return renderTrainingComplete()

        return (
            <div className="h-full flex flex-col bg-white">
                <div className="flex-1 overflow-auto">
                    <div className="p-8">
                        {assessment.step === 'welcome' && renderWelcome()}
                        {assessment.step === 'mediation_type' && renderMediationType()}
                        {assessment.step === 'contract_type' && renderContractType()}
                        {assessment.step === 'quick_intake' && renderQuickIntake()}
                        {assessment.step === 'template_source' && renderTemplateSource()}
                        {assessment.step === 'template_selection' && renderTemplateSelection()}
                        {assessment.step === 'upload_processing' && renderUploadProcessing()}
                        {assessment.step === 'summary' && renderSummary()}
                        {assessment.step === 'creating' && renderCreating()}
                    </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileSelect} className="hidden" />
            </div>
        )
    }

    const renderWelcome = () => (
        <div className="max-w-2xl mx-auto text-center">
            <div className={`w-20 h-20 ${colors.bgGradient} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                <span className="text-white font-bold text-3xl">C</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{isTrainingMode ? '🎓 Training Session' : 'Create a New Contract'}</h2>
            <p className="text-slate-500">Just a moment while I prepare your assessment...</p>
            <div className={`w-12 h-12 border-4 ${isTrainingMode ? 'border-amber-600' : 'border-emerald-600'} border-t-transparent rounded-full animate-spin mx-auto mt-8`}></div>
        </div>
    )

    const renderMediationType = () => (
        <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-slate-800 mb-6">How much negotiation do you expect?</h3>
            <div className="grid gap-4">
                {MEDIATION_OPTIONS.map((option) => (
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

    const renderContractType = () => (
        <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-slate-800 mb-6">What type of contract are you creating?</h3>
            <div className="grid grid-cols-2 gap-4">
                {CONTRACT_TYPE_OPTIONS.map((option) => (
                    <button key={option.id} onClick={() => handleOptionSelect(option)} className={`flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 ${colors.borderHover} ${isTrainingMode ? 'hover:bg-amber-50' : 'hover:bg-emerald-50'} transition-all text-left group`}>
                        <div className={`w-10 h-10 rounded-lg ${colors.bgLight} flex items-center justify-center flex-shrink-0`}><span className="text-xl">{option.icon}</span></div>
                        <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-slate-800 text-sm ${isTrainingMode ? 'group-hover:text-amber-800' : 'group-hover:text-emerald-800'}`}>{option.label}</h4>
                            <p className="text-xs text-slate-500 truncate">{option.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )

    const renderQuickIntake = () => {
        const { quickIntake } = assessment

        const dealValueOptions = [
            { value: 'under_50k', label: 'Under £50,000' },
            { value: '50k_250k', label: '£50,000 - £250,000' },
            { value: '250k_1m', label: '£250,000 - £1,000,000' },
            { value: 'over_1m', label: 'Over £1,000,000' }
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

        const isComplete = quickIntake.dealValue && quickIntake.serviceCriticality && quickIntake.timelinePressure && quickIntake.bidderCount

        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">Deal Context</h3>
                <div className="space-y-6">
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Estimated Deal Value</label><div className="grid grid-cols-2 gap-2">{dealValueOptions.map(opt => (<button key={opt.value} onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, dealValue: opt.value as DealValueRange } }))} className={`p-3 rounded-lg border-2 text-sm ${quickIntake.dealValue === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}>{opt.label}</button>))}</div></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Service Criticality</label><div className="grid grid-cols-2 gap-2">{criticalityOptions.map(opt => (<button key={opt.value} onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, serviceCriticality: opt.value as ServiceCriticality } }))} className={`p-3 rounded-lg border-2 text-left ${quickIntake.serviceCriticality === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}><div className="font-medium text-sm">{opt.label}</div><div className="text-xs text-slate-500">{opt.description}</div></button>))}</div></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Timeline Pressure</label><div className="grid grid-cols-2 gap-2">{timelineOptions.map(opt => (<button key={opt.value} onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, timelinePressure: opt.value as TimelinePressure } }))} className={`p-3 rounded-lg border-2 text-left ${quickIntake.timelinePressure === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}><div className="font-medium text-sm">{opt.label}</div><div className="text-xs text-slate-500">{opt.description}</div></button>))}</div></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Number of Potential Providers</label><div className="grid grid-cols-3 gap-2">{bidderOptions.map(opt => (<button key={opt.value} onClick={() => setAssessment(prev => ({ ...prev, quickIntake: { ...prev.quickIntake, bidderCount: opt.value as BidderCount } }))} className={`p-3 rounded-lg border-2 text-left ${quickIntake.bidderCount === opt.value ? `${colors.borderPrimary} ${colors.bgLight}` : 'border-slate-200 hover:border-slate-300'}`}><div className="font-medium text-sm">{opt.label}</div><div className="text-xs text-slate-500">{opt.description}</div></button>))}</div></div>
                    <button onClick={handleQuickIntakeComplete} disabled={!isComplete} className={`w-full py-3 rounded-lg ${colors.btnPrimary} text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed`}>Continue →</button>
                </div>
            </div>
        )
    }

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
                        {status === 'ready' && <div className={`w-10 h-10 rounded-full ${colors.bgSolid} flex items-center justify-center`}><span className="text-white text-xl">✓</span></div>}
                        {status === 'failed' && <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center"><span className="text-white text-xl">✗</span></div>}
                        <div className="flex-1">
                            <p className="font-medium text-slate-800">{assessment.uploadedFileName}</p>
                            <p className="text-sm text-slate-500">{status === 'processing' ? 'Analyzing document structure...' : status === 'ready' ? 'Ready to review' : 'Processing failed'}</p>
                        </div>
                        {status === 'ready' && <button onClick={handleUploadedContractClick} className={`px-4 py-2 rounded-lg ${colors.btnPrimary} text-white text-sm`}>Continue →</button>}
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
                            <div className={`w-14 h-14 rounded-lg ${colors.bgGradient} flex items-center justify-center flex-shrink-0`}><span className="text-white text-2xl">📋</span></div>
                            <div className="flex-1 min-w-0">
                                <h4 className={`font-semibold text-slate-800 ${isTrainingMode ? 'group-hover:text-amber-800' : 'group-hover:text-emerald-800'}`}>{template.templateName}</h4>
                                <p className="text-sm text-slate-500 mb-2">{template.description || `Standard ${template.contractType} template`}</p>
                                <div className="flex items-center gap-4 text-xs text-slate-400"><span>📄 {template.clauseCount} clauses</span><span>🏢 {template.industry}</span></div>
                            </div>
                            <div className={`text-slate-400 ${isTrainingMode ? 'group-hover:text-amber-500' : 'group-hover:text-emerald-500'} self-center text-xl`}>→</div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    const renderSummary = () => (
        <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-slate-800 mb-6">{isTrainingMode ? '🎓 Training Contract Summary' : 'Contract Setup Summary'}</h3>
            <div className="space-y-4 mb-8">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-3"><span className="text-2xl">⚖️</span><div><p className="text-sm text-slate-500">Mediation Type</p><p className="font-medium text-slate-800">{getMediationTypeLabel(assessment.mediationType)}</p></div></div></div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-3"><span className="text-2xl">📋</span><div><p className="text-sm text-slate-500">Contract Type</p><p className="font-medium text-slate-800">{getContractTypeLabel(assessment.contractType)}</p></div></div></div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200"><div className="flex items-center gap-3"><span className="text-2xl">📄</span><div><p className="text-sm text-slate-500">Starting Point</p><p className="font-medium text-slate-800">{getTemplateSourceLabel(assessment.templateSource)}</p></div></div></div>
                {assessment.selectedTemplateName && <div className={`p-4 rounded-lg ${isTrainingMode ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border`}><div className="flex items-center gap-3"><span className="text-2xl">✔</span><div><p className={`text-sm ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'}`}>Selected Template</p><p className={`font-medium ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'}`}>{assessment.selectedTemplateName}</p></div></div></div>}
                {assessment.uploadedFileName && <div className={`p-4 rounded-lg ${isTrainingMode ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border`}><div className="flex items-center gap-3"><span className="text-2xl">📄</span><div><p className={`text-sm ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'}`}>Uploaded Contract</p><p className={`font-medium ${isTrainingMode ? 'text-amber-800' : 'text-emerald-800'}`}>{assessment.uploadedFileName}</p></div></div></div>}
                {isTrainingMode && <div className="p-4 rounded-lg bg-amber-100 border border-amber-300"><div className="flex items-center gap-3"><span className="text-2xl">🎓</span><div><p className="text-sm text-amber-700 font-medium">Training Mode Active</p><p className="text-sm text-amber-600">This is for practice only.</p></div></div></div>}
            </div>
            {error && <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>}
            <div className="flex gap-4">
                <button onClick={() => setAssessment(prev => ({ ...prev, step: assessment.uploadedContractId ? 'upload_processing' : assessment.selectedTemplateId ? 'template_selection' : 'template_source' }))} className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">← Back</button>
                <button onClick={createContract} disabled={isCreating} className={`flex-1 px-6 py-3 rounded-lg ${colors.btnPrimary} text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2`}>
                    {isCreating ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating...</> : <>{isTrainingMode ? 'Create Training Session' : 'Create Contract'} →</>}
                </button>
            </div>
        </div>
    )

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
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">🎉</span></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Training Session Created!</h2>
            <p className="text-slate-500 mb-8">Your practice contract is ready.</p>
            <div className="flex gap-4">
                <button onClick={() => router.push('/auth/training')} className="flex-1 px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">Back to Training</button>
                <button onClick={() => router.push(`/auth/training/${trainingSessionCreated}`)} className="flex-1 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium">Start Training →</button>
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
                    <div>
                        <h3 className="font-semibold text-slate-800">Clarence</h3>
                        <p className={`text-xs ${isTrainingMode ? 'text-amber-600' : 'text-emerald-600'} flex items-center gap-1`}>
                            <span className={`w-2 h-2 rounded-full ${isTrainingMode ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            {isTrainingMode ? 'Training Assistant' : 'Online'}
                        </p>
                    </div>
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
            <div className="p-4 border-t border-slate-200 bg-white"><div className="text-xs text-slate-500 text-center">{isTrainingMode ? '🎓 Guiding your training setup' : 'Guiding you through contract setup'}</div></div>
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
            <FeedbackButton position="bottom-left" />

            {/* NEW: Transition Modal */}
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