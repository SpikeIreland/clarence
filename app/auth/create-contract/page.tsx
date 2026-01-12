'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FeedbackButton from '@/app/components/FeedbackButton'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

type MediationType = 'straight_to_contract' | 'partial_mediation' | 'full_mediation' | null
type ContractType = 'nda' | 'saas' | 'bpo' | 'msa' | 'employment' | 'custom' | null
type TemplateSource = 'existing_template' | 'modified_template' | 'uploaded' | 'from_scratch' | null
type AssessmentStep = 'welcome' | 'mediation_type' | 'contract_type' | 'quick_intake' | 'template_source' | 'template_selection' | 'upload_processing' | 'summary' | 'creating'

// Quick Intake types for deal context
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
    // Quick Intake fields for deal context
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

interface UploadedContract {
    contractId: string
    contractName: string
    fileName: string
    status: string
    clauseCount: number | null
    detectedContractType: string | null
    createdAt: string
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

const POLLING_INTERVAL = 5000 // 5 seconds
const MAX_POLLING_ATTEMPTS = 60 // 5 minutes max

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

I've successfully parsed your document and identified the clauses. Click on it below to proceed to Contract Prep where you can review and configure the clauses.`,

    upload_failed: `**There was an issue processing your contract.**

Please try uploading again or choose a different source option.`,

    summary: `**Great! Here's a summary of your contract setup:**

I'll create your contract with these settings. Once you confirm, you'll enter the Contract Studio where you can review and customize everything before inviting providers.`,

    creating: `**Creating your contract...**

Setting up your contract workspace. This will just take a moment.`
}

// ============================================================================
// SECTION 4: TEXT EXTRACTION UTILITIES
// ============================================================================

// Dynamic import for PDF.js
const loadPdfJs = async () => {
    const pdfjsLib = await import('pdfjs-dist')
    // Use local worker file for better performance with large PDFs
    // Worker file must be copied to public folder:
    // cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
    if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    }
    return pdfjsLib
}

// Extract text from PDF
const extractTextFromPdf = async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
        fullText += pageText + '\n\n'
    }

    return fullText.trim()
}

// Extract text from DOCX using Mammoth
const extractTextFromDocx = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
}

// Main extraction function
const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return extractTextFromPdf(file)
    } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
    ) {
        return extractTextFromDocx(file)
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return file.text()
    } else {
        throw new Error(`Unsupported file type: ${fileType}`)
    }
}

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

export default function ContractCreationAssessment() {
    const router = useRouter()
    const chatEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const pollingCountRef = useRef<number>(0)

    // ========================================================================
    // SECTION 5A: STATE
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
        quickIntake: {
            dealValue: null,
            serviceCriticality: null,
            timelinePressure: null,
            bidderCount: null,
            batnaStatus: null,
            topPriorities: []
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

    // ========================================================================
    // SECTION 5B: LOAD USER INFO
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
                userId: parsed.userInfo?.userId || '',
                companyId: parsed.userInfo?.companyId || null // May be null for now
            } as UserInfo
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    // ========================================================================
    // SECTION 5C: EFFECTS
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

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
            }
        }
    }, [])

    // ========================================================================
    // SECTION 5D: HELPER FUNCTIONS
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

    // Map user's contract type selection to template contract types
    const getMatchingContractTypes = (selectedType: ContractType): string[] => {
        const typeMapping: Record<string, string[]> = {
            'nda': ['NDA', 'nda', 'Non-Disclosure', 'Confidentiality'],
            'saas': ['SaaS', 'saas', 'Software', 'Software as a Service'],
            'bpo': ['BPO', 'bpo', 'Outsourcing', 'Business Process'],
            'msa': ['MSA', 'msa', 'Master Services', 'Master Service Agreement'],
            'employment': ['Employment', 'employment', 'Employee', 'Staff'],
            'custom': [] // Custom matches nothing - show all
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

                // Filter templates based on selected contract type
                const matchingTypes = getMatchingContractTypes(assessment.contractType)

                let filteredTemplates: Template[]
                if (matchingTypes.length === 0) {
                    // Custom type or no mapping - show all templates
                    filteredTemplates = allTemplates
                } else {
                    // Filter to matching contract types (case-insensitive)
                    filteredTemplates = allTemplates.filter(t =>
                        matchingTypes.some(type =>
                            t.contractType.toLowerCase().includes(type.toLowerCase()) ||
                            t.industry.toLowerCase().includes(type.toLowerCase())
                        )
                    )
                }

                setTemplates(filteredTemplates)

                // Add appropriate Clarence message
                if (filteredTemplates.length === 0) {
                    // No matching templates
                    addClarenceMessage(`I don't have any **${getContractTypeLabel(assessment.contractType)}** templates available yet.\n\nYou have a few options to proceed:`)
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
    // SECTION 5E: UPLOAD FUNCTIONS
    // ========================================================================

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ]
        const validExtensions = ['.pdf', '.docx', '.txt']
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            setError('Please upload a PDF, DOCX, or TXT file')
            return
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB')
            return
        }

        await processUpload(file)
    }

    const processUpload = async (file: File) => {
        if (!userInfo) {
            setError('User not authenticated')
            return
        }

        setIsUploading(true)
        setError(null)
        setUploadProgress('Extracting text from document...')
        addUserMessage(`📤 Uploading: ${file.name}`)
        addClarenceMessage(CLARENCE_MESSAGES.upload_started)

        try {
            // Step 1: Extract text client-side
            const documentText = await extractTextFromFile(file)

            if (documentText.length < 100) {
                throw new Error('Document appears to be empty or too short')
            }

            setUploadProgress('Sending to CLARENCE for analysis...')

            // Step 2: Call the parse workflow
            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo.userId,
                    company_id: userInfo.companyId, // May be null
                    session_id: null, // Will create session later
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    document_text: documentText,
                    template_name: file.name.replace(/\.[^/.]+$/, '') // Remove extension
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to upload contract')
            }

            const result = await response.json()

            if (result.success && result.contractId) {
                // Update state with the contract ID
                setAssessment(prev => ({
                    ...prev,
                    step: 'upload_processing',
                    uploadedContractId: result.contractId,
                    uploadedContractStatus: 'processing',
                    uploadedFileName: file.name
                }))

                addClarenceMessage(CLARENCE_MESSAGES.upload_processing)

                // Start polling for completion
                startPolling(result.contractId)
            } else {
                throw new Error(result.error || 'No contract ID returned')
            }

        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Failed to upload contract')
            addClarenceMessage(CLARENCE_MESSAGES.upload_failed)
        } finally {
            setIsUploading(false)
            setUploadProgress('')
        }
    }

    const startPolling = (contractId: string) => {
        pollingCountRef.current = 0

        // Clear any existing polling
        if (pollingRef.current) {
            clearInterval(pollingRef.current)
        }

        pollingRef.current = setInterval(async () => {
            pollingCountRef.current += 1

            // Check if we've exceeded max attempts
            if (pollingCountRef.current >= MAX_POLLING_ATTEMPTS) {
                clearInterval(pollingRef.current!)
                pollingRef.current = null
                setError('Processing is taking longer than expected. Please refresh the page to check status.')
                return
            }

            try {
                const response = await fetch(`${API_BASE}/get-uploaded-contract?contract_id=${contractId}`)
                if (response.ok) {
                    const contract = await response.json()

                    if (contract.status === 'ready') {
                        // Stop polling
                        clearInterval(pollingRef.current!)
                        pollingRef.current = null

                        // Update state
                        setAssessment(prev => ({
                            ...prev,
                            uploadedContractStatus: 'ready'
                        }))

                        addClarenceMessage(CLARENCE_MESSAGES.upload_ready)
                    } else if (contract.status === 'failed') {
                        // Stop polling
                        clearInterval(pollingRef.current!)
                        pollingRef.current = null

                        // Update state
                        setAssessment(prev => ({
                            ...prev,
                            uploadedContractStatus: 'failed'
                        }))

                        setError(contract.processingError || 'Contract processing failed')
                        addClarenceMessage(CLARENCE_MESSAGES.upload_failed)
                    }
                    // If still 'processing', continue polling
                }
            } catch (err) {
                console.error('Polling error:', err)
                // Don't stop polling on network errors, just log
            }
        }, POLLING_INTERVAL)
    }

    const handleUploadedContractClick = () => {
        if (assessment.uploadedContractStatus === 'ready' && assessment.uploadedContractId) {
            // Navigate to contract-prep with the contract_id
            router.push(`/auth/contract-prep?contract_id=${assessment.uploadedContractId}`)
        }
    }

    // ========================================================================
    // SECTION 5F: SELECTION HANDLERS
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
            step: 'quick_intake'  // Go to quick intake instead of template_source
        }))

        setTimeout(() => {
            addClarenceMessage(CLARENCE_MESSAGES.quick_intake)
        }, 500)
    }

    // ========================================================================
    // QUICK INTAKE HANDLERS
    // ========================================================================

    const updateQuickIntake = (field: keyof AssessmentState['quickIntake'], value: any) => {
        setAssessment(prev => ({
            ...prev,
            quickIntake: {
                ...prev.quickIntake,
                [field]: value
            }
        }))
    }

    const togglePriority = (priority: string) => {
        setAssessment(prev => {
            const currentPriorities = prev.quickIntake.topPriorities
            const newPriorities = currentPriorities.includes(priority)
                ? currentPriorities.filter(p => p !== priority)
                : [...currentPriorities, priority].slice(0, 3) // Max 3 priorities
            return {
                ...prev,
                quickIntake: {
                    ...prev.quickIntake,
                    topPriorities: newPriorities
                }
            }
        })
    }

    const handleQuickIntakeComplete = () => {
        // Summarize what they entered
        const dealValueLabels: Record<string, string> = {
            'under_50k': 'Under £50k',
            '50k_250k': '£50k - £250k',
            '250k_1m': '£250k - £1M',
            'over_1m': 'Over £1M'
        }

        const summary = assessment.quickIntake.dealValue
            ? `📊 Deal context saved: ${dealValueLabels[assessment.quickIntake.dealValue] || 'Not specified'}`
            : '📊 Deal context saved'

        addUserMessage(summary)

        setAssessment(prev => ({
            ...prev,
            step: 'template_source'
        }))

        setTimeout(() => {
            addClarenceMessage(CLARENCE_MESSAGES.quick_intake_complete)
            setTimeout(() => {
                addClarenceMessage(CLARENCE_MESSAGES.template_source, TEMPLATE_SOURCE_OPTIONS)
            }, 800)
        }, 500)
    }

    const handleSkipQuickIntake = () => {
        addUserMessage('⏭️ Skip for now')

        setAssessment(prev => ({
            ...prev,
            step: 'template_source'
        }))

        setTimeout(() => {
            addClarenceMessage(CLARENCE_MESSAGES.template_source, TEMPLATE_SOURCE_OPTIONS)
        }, 500)
    }

    const handleTemplateSourceSelect = (option: AssessmentOption) => {
        const templateSource = option.value as TemplateSource

        addUserMessage(`${option.icon} ${option.label}`)

        // If they want to upload, show the upload UI
        if (templateSource === 'uploaded') {
            setAssessment(prev => ({
                ...prev,
                templateSource,
                step: 'upload_processing' // Use this step for upload UI
            }))
            // Trigger file input
            setTimeout(() => {
                fileInputRef.current?.click()
            }, 100)
            return
        }

        // If they want to use or modify a template, show template selection
        if (templateSource === 'existing_template' || templateSource === 'modified_template') {
            setAssessment(prev => ({
                ...prev,
                templateSource,
                step: 'template_selection'
            }))
            // Templates will be loaded by the useEffect
        } else {
            // For from_scratch, go directly to summary
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
    // SECTION 5G: CONTRACT CREATION
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
                    uploaded_contract_id: assessment.uploadedContractId, // Link uploaded contract if any
                    assessment_completed: true,
                    // Quick Intake context for CLARENCE guidance
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

            if (result.success && result.sessionId) {
                // Build redirect URL with both session_id and contract_id (if available)
                let redirectUrl = `/auth/contract-prep?session_id=${result.sessionId}`

                // If a contractId was returned (from template or uploaded), include it
                if (result.contractId || result.contract_id) {
                    const contractId = result.contractId || result.contract_id
                    redirectUrl = `/auth/contract-prep?contract_id=${contractId}&session_id=${result.sessionId}`
                }
                // If we had an uploaded contract already, include that
                else if (assessment.uploadedContractId) {
                    redirectUrl = `/auth/contract-prep?contract_id=${assessment.uploadedContractId}&session_id=${result.sessionId}`
                }

                router.push(redirectUrl)
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
    // SECTION 6: RENDER - PANEL 1 (PROGRESS)
    // ========================================================================

    const renderProgressPanel = () => {
        const steps = [
            { id: 'mediation_type', label: 'Mediation Type', icon: '⚖️' },
            { id: 'contract_type', label: 'Contract Type', icon: '📋' },
            { id: 'quick_intake', label: 'Deal Context', icon: '📊' },
            { id: 'template_source', label: 'Template Source', icon: '📁' },
            { id: 'template_selection', label: 'Select Template', icon: '✓', conditional: true },
            { id: 'upload_processing', label: 'Upload Contract', icon: '📤', conditional: true },
            { id: 'summary', label: 'Review & Create', icon: '✅' }
        ]

        // Filter out conditional steps if not applicable
        const visibleSteps = steps.filter(step => {
            if (step.id === 'template_selection') {
                return assessment.templateSource === 'existing_template' ||
                    assessment.templateSource === 'modified_template'
            }
            if (step.id === 'upload_processing') {
                return assessment.templateSource === 'uploaded'
            }
            return true
        })

        const getCurrentStepIndex = () => {
            const stepOrder = ['welcome', 'mediation_type', 'contract_type', 'quick_intake', 'template_source', 'template_selection', 'upload_processing', 'summary', 'creating']
            return stepOrder.indexOf(assessment.step)
        }

        const currentIndex = getCurrentStepIndex()

        return (
            <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-white">
                    <Link href="/auth/contracts-dashboard" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        ← Back to Dashboard
                    </Link>
                    <h2 className="text-lg font-semibold text-slate-800 mt-2">New Contract</h2>
                    <p className="text-sm text-slate-500">Setup Assessment</p>
                </div>

                {/* Progress Steps */}
                <div className="flex-1 p-4">
                    <div className="space-y-2">
                        {visibleSteps.map((step) => {
                            const stepOrder = ['welcome', 'mediation_type', 'contract_type', 'quick_intake', 'template_source', 'template_selection', 'upload_processing', 'summary', 'creating']
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
                                                {step.id === 'upload_processing' && assessment.uploadedFileName}
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
    // SECTION 7: RENDER - PANEL 2 (MAIN CONTENT)
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
                                : assessment.step === 'upload_processing'
                                    ? 'Upload your contract document'
                                    : 'Answer a few questions to set up your contract'
                        }
                    </p>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    {assessment.step === 'summary'
                        ? renderSummary()
                        : assessment.step === 'template_selection'
                            ? renderTemplateSelection()
                            : assessment.step === 'upload_processing'
                                ? renderUploadProcessing()
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
            case 'quick_intake':
                return renderQuickIntakeForm()
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
    // SECTION 7-QI: RENDER - QUICK INTAKE FORM
    // ========================================================================

    const renderQuickIntakeForm = () => {
        const dealValueOptions = [
            { value: 'under_50k', label: 'Under £50,000', icon: '💷' },
            { value: '50k_250k', label: '£50,000 - £250,000', icon: '💰' },
            { value: '250k_1m', label: '£250,000 - £1 million', icon: '🏦' },
            { value: 'over_1m', label: 'Over £1 million', icon: '🏆' }
        ]

        const criticalityOptions = [
            { value: 'low', label: 'Low', desc: 'Nice to have, not critical', color: 'bg-slate-500' },
            { value: 'medium', label: 'Medium', desc: 'Important but flexible', color: 'bg-blue-500' },
            { value: 'high', label: 'High', desc: 'Business critical', color: 'bg-amber-500' },
            { value: 'critical', label: 'Critical', desc: 'Must have, no alternatives', color: 'bg-red-500' }
        ]

        const timelineOptions = [
            { value: 'flexible', label: 'Flexible', desc: '3+ months' },
            { value: 'normal', label: 'Normal', desc: '1-3 months' },
            { value: 'tight', label: 'Tight', desc: '2-4 weeks' },
            { value: 'urgent', label: 'Urgent', desc: 'Under 2 weeks' }
        ]

        const bidderOptions = [
            { value: 'single', label: 'Single provider', desc: 'Sole source' },
            { value: 'few', label: '2-3 providers', desc: 'Limited competition' },
            { value: 'many', label: '4+ providers', desc: 'Competitive tender' }
        ]

        const batnaOptions = [
            { value: 'strong', label: 'Yes, strong alternatives', icon: '💪' },
            { value: 'weak', label: 'Limited options', icon: '🤔' },
            { value: 'uncertain', label: 'Not sure yet', icon: '❓' }
        ]

        const priorityOptions = [
            'Price / Cost',
            'Quality of Service',
            'Speed of Delivery',
            'Flexibility',
            'Risk Mitigation',
            'Long-term Partnership',
            'Innovation',
            'Compliance'
        ]

        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <h3 className="text-lg font-medium text-slate-800 mb-2">Quick Deal Context</h3>
                <p className="text-sm text-slate-500 mb-6">Help me understand your position better. All fields are optional.</p>

                {/* Deal Value */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Estimated Deal Value
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {dealValueOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateQuickIntake('dealValue', opt.value as DealValueRange)}
                                className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${assessment.quickIntake.dealValue === opt.value
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                                    }`}
                            >
                                <span className="mr-2">{opt.icon}</span>
                                <span className="font-medium">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Service Criticality */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        How critical is this service to your business?
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {criticalityOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateQuickIntake('serviceCriticality', opt.value as ServiceCriticality)}
                                className={`px-3 py-2 rounded-lg border-2 text-center transition-all ${assessment.quickIntake.serviceCriticality === opt.value
                                    ? `border-current ${opt.color} text-white`
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <span className="font-medium text-sm">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeline Pressure */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Timeline to close this deal
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {timelineOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateQuickIntake('timelinePressure', opt.value as TimelinePressure)}
                                className={`px-3 py-2 rounded-lg border-2 text-center transition-all ${assessment.quickIntake.timelinePressure === opt.value
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                <span className="font-medium text-sm block">{opt.label}</span>
                                <span className="text-xs text-slate-400">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Number of Bidders */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        How many providers are you considering?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {bidderOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateQuickIntake('bidderCount', opt.value as BidderCount)}
                                className={`px-4 py-3 rounded-lg border-2 text-center transition-all ${assessment.quickIntake.bidderCount === opt.value
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-blue-300'
                                    }`}
                            >
                                <span className="font-medium text-sm block">{opt.label}</span>
                                <span className="text-xs text-slate-400">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* BATNA Status */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Do you have alternatives if this negotiation fails?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {batnaOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateQuickIntake('batnaStatus', opt.value as BatnaStatus)}
                                className={`px-4 py-3 rounded-lg border-2 text-center transition-all ${assessment.quickIntake.batnaStatus === opt.value
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 hover:border-emerald-300'
                                    }`}
                            >
                                <span className="text-xl block mb-1">{opt.icon}</span>
                                <span className="font-medium text-sm">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top Priorities */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Top 3 priorities for this deal (select up to 3)
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {priorityOptions.map((priority) => (
                            <button
                                key={priority}
                                onClick={() => togglePriority(priority)}
                                disabled={!assessment.quickIntake.topPriorities.includes(priority) && assessment.quickIntake.topPriorities.length >= 3}
                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${assessment.quickIntake.topPriorities.includes(priority)
                                    ? 'bg-emerald-500 text-white'
                                    : assessment.quickIntake.topPriorities.length >= 3
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                                    }`}
                            >
                                {assessment.quickIntake.topPriorities.includes(priority) && '✓ '}
                                {priority}
                            </button>
                        ))}
                    </div>
                    {assessment.quickIntake.topPriorities.length > 0 && (
                        <p className="text-xs text-slate-400 mt-2">
                            Selected: {assessment.quickIntake.topPriorities.join(', ')}
                        </p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <button
                        onClick={handleQuickIntakeComplete}
                        className="flex-1 px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
                    >
                        Continue →
                    </button>
                    <button
                        onClick={handleSkipQuickIntake}
                        className="px-6 py-3 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7A: RENDER - UPLOAD PROCESSING
    // ========================================================================

    const renderUploadProcessing = () => {
        // If no upload started yet, show upload UI
        if (!assessment.uploadedContractId) {
            return (
                <div className="max-w-2xl mx-auto">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
                    >
                        {isUploading ? (
                            <>
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">
                                    {uploadProgress || 'Processing...'}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    Please wait while we process your document
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">📤</span>
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">
                                    Upload Your Contract
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Drag and drop or click to upload a PDF, DOCX, or TXT file
                                </p>
                                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium inline-block">
                                    Choose File
                                </span>
                                <p className="text-xs text-slate-400 mt-4">
                                    Maximum file size: 10MB
                                </p>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Back button */}
                    <div className="mt-6 pt-4 border-t border-slate-200">
                        <button
                            onClick={() => {
                                setAssessment(prev => ({ ...prev, step: 'template_source', templateSource: null }))
                            }}
                            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                            ← Back to previous step
                        </button>
                    </div>
                </div>
            )
        }

        // Upload in progress or complete - show status
        return (
            <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-medium text-slate-800 mb-6">Your Uploaded Contract</h3>

                <div
                    onClick={handleUploadedContractClick}
                    className={`p-6 rounded-xl border-2 transition-all ${assessment.uploadedContractStatus === 'ready'
                        ? 'border-green-300 bg-green-50 cursor-pointer hover:border-green-400'
                        : assessment.uploadedContractStatus === 'failed'
                            ? 'border-red-300 bg-red-50'
                            : 'border-blue-300 bg-blue-50'
                        }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${assessment.uploadedContractStatus === 'ready'
                            ? 'bg-green-500'
                            : assessment.uploadedContractStatus === 'failed'
                                ? 'bg-red-500'
                                : 'bg-blue-500'
                            }`}>
                            {assessment.uploadedContractStatus === 'ready' ? (
                                <span className="text-white text-2xl">✓</span>
                            ) : assessment.uploadedContractStatus === 'failed' ? (
                                <span className="text-white text-2xl">✕</span>
                            ) : (
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-800">
                                {assessment.uploadedFileName}
                            </h4>
                            <p className={`text-sm ${assessment.uploadedContractStatus === 'ready'
                                ? 'text-green-700'
                                : assessment.uploadedContractStatus === 'failed'
                                    ? 'text-red-700'
                                    : 'text-blue-700'
                                }`}>
                                {assessment.uploadedContractStatus === 'ready'
                                    ? 'Ready - Click to proceed to Contract Prep'
                                    : assessment.uploadedContractStatus === 'failed'
                                        ? 'Processing failed'
                                        : 'Processing... This may take up to 5 minutes'
                                }
                            </p>
                        </div>
                        {assessment.uploadedContractStatus === 'ready' && (
                            <div className="text-green-600 text-xl">
                                →
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        {error}
                    </div>
                )}

                {assessment.uploadedContractStatus === 'failed' && (
                    <div className="mt-4">
                        <button
                            onClick={() => {
                                setAssessment(prev => ({
                                    ...prev,
                                    uploadedContractId: null,
                                    uploadedContractStatus: null,
                                    uploadedFileName: null
                                }))
                                setError(null)
                            }}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Back button */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                    <button
                        onClick={() => {
                            // Stop polling if active
                            if (pollingRef.current) {
                                clearInterval(pollingRef.current)
                                pollingRef.current = null
                            }
                            setAssessment(prev => ({
                                ...prev,
                                step: 'template_source',
                                templateSource: null,
                                uploadedContractId: null,
                                uploadedContractStatus: null,
                                uploadedFileName: null
                            }))
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                        ← Back to previous step
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7B: RENDER - TEMPLATE SELECTION
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

        // No matching templates - show options
        if (templates.length === 0) {
            return (
                <div className="max-w-2xl mx-auto">
                    <div className="text-center py-8 mb-8">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📭</span>
                        </div>
                        <h3 className="text-lg font-medium text-slate-800 mb-2">
                            No {getContractTypeLabel(assessment.contractType)} Templates Available
                        </h3>
                        <p className="text-sm text-slate-500">
                            We don't have a template for this contract type yet, but you have other options.
                        </p>
                    </div>

                    <h4 className="text-sm font-medium text-slate-700 mb-4">How would you like to proceed?</h4>

                    <div className="grid gap-4">
                        {/* Option 1: Build from Scratch */}
                        <button
                            onClick={() => {
                                addUserMessage('🔨 Build from Scratch')
                                setAssessment(prev => ({
                                    ...prev,
                                    templateSource: 'from_scratch',
                                    selectedTemplateId: null,
                                    selectedTemplateName: null,
                                    step: 'summary'
                                }))
                                setTimeout(() => {
                                    addClarenceMessage(CLARENCE_MESSAGES.summary)
                                }, 500)
                            }}
                            className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                        >
                            <div className="w-12 h-12 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                                🔨
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-800 group-hover:text-blue-800">
                                    Build from Scratch
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    Start with a blank contract and add clauses one by one
                                </p>
                            </div>
                            <div className="text-slate-400 group-hover:text-blue-500 self-center">
                                →
                            </div>
                        </button>

                        {/* Option 2: Modify Existing Template */}
                        <button
                            onClick={async () => {
                                addUserMessage('✏️ Modify an Existing Template')
                                // Fetch ALL templates regardless of type
                                setIsLoadingTemplates(true)
                                try {
                                    const response = await fetch(`${API_BASE}/get-contract-templates`)
                                    if (response.ok) {
                                        const data = await response.json()
                                        const allTemplates: Template[] = data.templates || []
                                        setTemplates(allTemplates)
                                        if (allTemplates.length > 0) {
                                            addClarenceMessage(`Here are all available templates. You can select one and customize it for your **${getContractTypeLabel(assessment.contractType)}** needs.`)
                                        } else {
                                            addClarenceMessage('Unfortunately, there are no templates available in the system yet.')
                                        }
                                    }
                                } catch (err) {
                                    console.error('Failed to load templates:', err)
                                } finally {
                                    setIsLoadingTemplates(false)
                                }
                                setAssessment(prev => ({
                                    ...prev,
                                    templateSource: 'modified_template'
                                }))
                            }}
                            className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                        >
                            <div className="w-12 h-12 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                                ✏️
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-800 group-hover:text-blue-800">
                                    Modify an Existing Template
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    Start with another template type and adapt it to your needs
                                </p>
                            </div>
                            <div className="text-slate-400 group-hover:text-blue-500 self-center">
                                →
                            </div>
                        </button>

                        {/* Option 3: Upload a Contract */}
                        <button
                            onClick={() => {
                                addUserMessage('📤 Upload a Contract')
                                setAssessment(prev => ({
                                    ...prev,
                                    templateSource: 'uploaded',
                                    step: 'upload_processing'
                                }))
                                setTimeout(() => {
                                    fileInputRef.current?.click()
                                }, 100)
                            }}
                            className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                        >
                            <div className="w-12 h-12 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                                📤
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-800 group-hover:text-blue-800">
                                    Upload a Contract
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                    Upload an existing document (PDF/DOCX) and convert it
                                </p>
                            </div>
                            <div className="text-slate-400 group-hover:text-blue-500 self-center">
                                →
                            </div>
                        </button>
                    </div>

                    {/* Back button */}
                    <div className="mt-6 pt-4 border-t border-slate-200">
                        <button
                            onClick={() => {
                                setAssessment(prev => ({ ...prev, step: 'template_source' }))
                            }}
                            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                            ← Back to previous step
                        </button>
                    </div>
                </div>
            )
        }

        // Templates found - show the list
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
    // SECTION 7C: RENDER - SUMMARY
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

                    {assessment.uploadedFileName && (
                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📤</span>
                                <div>
                                    <p className="text-sm text-green-600">Uploaded Contract</p>
                                    <p className="font-medium text-green-800">{assessment.uploadedFileName}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Intake Summary */}
                    {(assessment.quickIntake.dealValue || assessment.quickIntake.serviceCriticality || assessment.quickIntake.topPriorities.length > 0) && (
                        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">📊</span>
                                <div className="flex-1">
                                    <p className="text-sm text-emerald-600 font-medium mb-2">Deal Context</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {assessment.quickIntake.dealValue && (
                                            <div>
                                                <span className="text-emerald-600">Value: </span>
                                                <span className="text-emerald-800">
                                                    {assessment.quickIntake.dealValue === 'under_50k' && 'Under £50k'}
                                                    {assessment.quickIntake.dealValue === '50k_250k' && '£50k - £250k'}
                                                    {assessment.quickIntake.dealValue === '250k_1m' && '£250k - £1M'}
                                                    {assessment.quickIntake.dealValue === 'over_1m' && 'Over £1M'}
                                                </span>
                                            </div>
                                        )}
                                        {assessment.quickIntake.serviceCriticality && (
                                            <div>
                                                <span className="text-emerald-600">Criticality: </span>
                                                <span className="text-emerald-800 capitalize">{assessment.quickIntake.serviceCriticality}</span>
                                            </div>
                                        )}
                                        {assessment.quickIntake.timelinePressure && (
                                            <div>
                                                <span className="text-emerald-600">Timeline: </span>
                                                <span className="text-emerald-800 capitalize">{assessment.quickIntake.timelinePressure}</span>
                                            </div>
                                        )}
                                        {assessment.quickIntake.bidderCount && (
                                            <div>
                                                <span className="text-emerald-600">Providers: </span>
                                                <span className="text-emerald-800">
                                                    {assessment.quickIntake.bidderCount === 'single' && 'Single'}
                                                    {assessment.quickIntake.bidderCount === 'few' && '2-3'}
                                                    {assessment.quickIntake.bidderCount === 'many' && '4+'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {assessment.quickIntake.topPriorities.length > 0 && (
                                        <div className="mt-2">
                                            <span className="text-emerald-600 text-sm">Priorities: </span>
                                            <span className="text-emerald-800 text-sm">{assessment.quickIntake.topPriorities.join(', ')}</span>
                                        </div>
                                    )}
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
                            if (assessment.uploadedContractId) {
                                setAssessment(prev => ({ ...prev, step: 'upload_processing' }))
                            } else if (assessment.selectedTemplateId) {
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
    // SECTION 8: RENDER - PANEL 3 (CLARENCE CHAT)
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
    // SECTION 9: MAIN RENDER
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

            {/* Beta Feedback Button */}
            <FeedbackButton position="bottom-left" />
        </div>
    )
}