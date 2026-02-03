'use client'

// ============================================================================
// QUICK CONTRACT - CREATE PAGE
// Version: 1.2
// Date: 27 January 2026
// Path: /app/auth/quick-contract/create/page.tsx
// Description: Create a new Quick Contract from template or upload
// Fixes: 
//   - Added Suspense boundary for useSearchParams()
//   - Memoized Supabase client to prevent infinite re-renders
//   - Improved useEffect with proper cleanup
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import FeedbackButton from '@/app/components/FeedbackButton'
import mammoth from 'mammoth'

// Note: pdfjs-dist is imported dynamically in extractTextFromPDF to avoid SSR issues

// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    companyId: string
    role: string
    userId: string
}

interface QCTemplate {
    templateId: string
    templateName: string
    templateCategory: string
    description: string
    documentContent: string
    documentFormat: string
    variableSchema: VariableField[]
    isSystemTemplate: boolean
}

interface VariableField {
    key: string
    label: string
    type: 'text' | 'textarea' | 'number' | 'date' | 'currency'
    required: boolean
    default?: string
}

interface ParsedClause {
    clauseId?: string  // Add this line
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
    level: number
    parentClauseNumber: string | null
    displayOrder: number
    isExpanded?: boolean
    // Clarence Certification fields
    clarenceCertified?: boolean
    clarencePosition?: number | null
    clarenceFairness?: 'balanced' | 'slightly_customer_favoring' | 'customer_favoring' | 'heavily_customer_favoring' | 'slightly_provider_favoring' | 'provider_favoring' | 'heavily_provider_favoring' | 'review_recommended' | null
    clarenceSummary?: string | null
    clarenceAssessment?: string | null
    clarenceFlags?: string[]
    clarenceCertifiedAt?: string | null
}

type CreateStep = 'source' | 'details' | 'template_select' | 'variables' | 'content' | 'parsing' | 'invite'
type SourceType = 'template' | 'upload' | 'blank' | null
type ContractType = 'nda' | 'service_agreement' | 'lease' | 'employment' | 'contractor' | 'vendor' | 'other' | null
type ParsingStatus = 'idle' | 'parsing' | 'certifying' | 'complete' | 'error'

interface CreateState {
    step: CreateStep
    sourceType: SourceType
    contractType: ContractType
    contractName: string
    description: string
    referenceNumber: string
    selectedTemplate: QCTemplate | null
    variableValues: Record<string, string>
    documentContent: string
    uploadedFileName: string | null
    uploadedFileUrl: string | null
    // Parsing state
    uploadedContractId: string | null
    parsedClauses: ParsedClause[]
    parsingStatus: ParsingStatus
    parsingError: string | null
    certificationProgress?: {
        total: number
        completed: number
    }
    // Session state
    sessionId: string | null
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_OPTIONS = [
    { value: 'nda', label: 'Non-Disclosure Agreement', icon: '🔒', description: 'Protect confidential information' },
    { value: 'service_agreement', label: 'Service Agreement', icon: '📋', description: 'Define service terms and deliverables' },
    { value: 'lease', label: 'Lease Agreement', icon: '🏠', description: 'Property or equipment rental terms' },
    { value: 'contractor', label: 'Contractor Agreement', icon: '🔧', description: 'Independent contractor terms' },
    { value: 'vendor', label: 'Vendor Agreement', icon: '🤝', description: 'Supplier and vendor terms' },
    { value: 'other', label: 'Other', icon: '📄', description: 'Custom contract type' }
]

const SOURCE_OPTIONS = [
    {
        value: 'upload',
        label: 'Upload Document',
        icon: '📤',
        description: 'Upload an existing PDF, DOCX, or text file'
    },
    {
        value: 'blank',
        label: 'Start Blank',
        icon: '✏️',
        description: 'Write your contract from scratch'
    }
]

const STEPS_CONFIG = [
    { id: 'source', label: 'Source', number: 1 },
    { id: 'details', label: 'Details', number: 2 },
    { id: 'content', label: 'Content', number: 3 },
    { id: 'parsing', label: 'Review Clauses', number: 4 },
    { id: 'invite', label: 'Invite', number: 5 }
]

const CLAUSE_CATEGORIES = [
    'Definitions',
    'Scope of Services',
    'Payment Terms',
    'Liability',
    'Indemnification',
    'Intellectual Property',
    'Confidentiality',
    'Term and Termination',
    'Dispute Resolution',
    'General Provisions',
    'Data Protection',
    'Insurance',
    'Warranties',
    'Force Majeure',
    'Other'
]

// ============================================================================
// SECTION 4: INITIAL STATE
// ============================================================================

const initialState: CreateState = {
    step: 'source',
    sourceType: null,
    contractType: null,
    contractName: '',
    description: '',
    referenceNumber: '',
    selectedTemplate: null,
    variableValues: {},
    documentContent: '',
    uploadedFileName: null,
    uploadedFileUrl: null,
    // Parsing state
    uploadedContractId: null,
    parsedClauses: [],
    parsingStatus: 'idle',
    parsingError: null,
    // Session state
    sessionId: null
}

// ============================================================================
// SECTION 5: LOADING FALLBACK COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN PAGE WRAPPER (with Suspense)
// ============================================================================

export default function CreateQuickContractPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <CreateQuickContractContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 7: MAIN CONTENT COMPONENT
// ============================================================================

function CreateQuickContractContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = useMemo(() => createClient(), [])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ==========================================================================
    // SECTION 8: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [state, setState] = useState<CreateState>(initialState)
    const [templates, setTemplates] = useState<QCTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Invite step state
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteName, setInviteName] = useState('')
    const [inviteCompany, setInviteCompany] = useState('')
    const [sendingInvite, setSendingInvite] = useState(false)
    const [inviteMessage, setInviteMessage] = useState('')

    // Duplicate mode
    const duplicateId = searchParams.get('duplicate')

    // Review panel state
    const [selectedReviewClauseIndex, setSelectedReviewClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')

    // Derived: Get the currently selected clause
    const selectedReviewClause = selectedReviewClauseIndex !== null
        ? state.parsedClauses[selectedReviewClauseIndex]
        : null


    // ==========================================================================
    // SECTION 9: DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return null
        }

        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        return authData.userInfo
    }, [router])

    const loadTemplates = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('qc_templates')
                .select('*')
                .eq('is_active', true)
                .order('template_name')

            if (error) {
                console.error('Error loading templates:', error)
                return
            }

            const transformedTemplates: QCTemplate[] = (data || []).map(row => ({
                templateId: row.template_id,
                templateName: row.template_name,
                templateCategory: row.template_category,
                description: row.description,
                documentContent: row.document_content,
                documentFormat: row.document_format,
                variableSchema: row.variable_schema || [],
                isSystemTemplate: row.is_system_template
            }))

            setTemplates(transformedTemplates)
        } catch (err) {
            console.error('Error loading templates:', err)
        }
    }, [supabase])

    const loadDuplicateContract = useCallback(async (contractId: string) => {
        try {
            const { data, error } = await supabase
                .from('quick_contracts')
                .select('*')
                .eq('quick_contract_id', contractId)
                .single()

            if (error || !data) {
                console.error('Error loading contract to duplicate:', error)
                return
            }

            setState(prev => ({
                ...prev,
                contractName: `${data.contract_name} (Copy)`,
                contractType: data.contract_type,
                description: data.description || '',
                referenceNumber: '',
                documentContent: data.document_content || '',
                variableValues: data.variables || {},
                step: 'details'
            }))
        } catch (err) {
            console.error('Error duplicating contract:', err)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 10: EFFECTS
    // ==========================================================================

    useEffect(() => {
        let isMounted = true

        const init = async () => {
            try {
                setLoading(true)

                const user = await loadUserInfo()

                if (!isMounted) return

                if (user) {
                    await loadTemplates()

                    if (!isMounted) return

                    if (duplicateId) {
                        await loadDuplicateContract(duplicateId)
                    }
                }
            } catch (err) {
                console.error('Initialization error:', err)
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        init()

        return () => {
            isMounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duplicateId])

    // ==========================================================================
    // SECTION 11: NAVIGATION HANDLERS
    // ==========================================================================

    function handleSourceSelect(source: SourceType) {
        console.log('📍 Source selected:', source)

        setState(prev => ({
            ...prev,
            sourceType: source,
            step: source === 'template' ? 'template_select' : 'details'
        }))

        // If upload selected, trigger file picker after state updates
        if (source === 'upload') {
            console.log('📂 Upload selected, will show upload area on details step')
        }

        eventLogger.completed('quick_contract_create', 'source_selected', { source })
    }

    function handleTemplateSelect(template: QCTemplate) {
        // Initialize variable values with defaults
        const initialValues: Record<string, string> = {}
        template.variableSchema.forEach(field => {
            initialValues[field.key] = field.default || ''
        })

        setState(prev => ({
            ...prev,
            selectedTemplate: template,
            contractType: template.templateCategory as ContractType,
            contractName: template.templateName,
            variableValues: initialValues,
            documentContent: template.documentContent,
            step: template.variableSchema.length > 0 ? 'variables' : 'details'
        }))

        eventLogger.completed('quick_contract_create', 'template_selected', {
            templateId: template.templateId,
            templateName: template.templateName
        })
    }

    function handleVariablesComplete() {
        // Substitute variables in content
        let content = state.selectedTemplate?.documentContent || ''
        Object.entries(state.variableValues).forEach(([key, value]) => {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`)
        })

        setState(prev => ({
            ...prev,
            documentContent: content,
            step: 'details'
        }))
    }

    function handleDetailsComplete() {
        if (!state.contractName.trim()) {
            setError('Please enter a contract name')
            return
        }

        setError(null)
        setState(prev => ({ ...prev, step: 'content' }))
    }

    function handleContentComplete() {
        if (!state.documentContent.trim()) {
            setError('Please add some content to your contract')
            return
        }

        setError(null)
        setState(prev => ({ ...prev, step: 'invite' }))
    }

    function handleBack() {
        const stepOrder: CreateStep[] = ['source', 'template_select', 'variables', 'details', 'content', 'parsing', 'invite']
        const currentIndex = stepOrder.indexOf(state.step)

        if (currentIndex > 0) {
            let prevStep = stepOrder[currentIndex - 1]

            // Skip template_select if not using template
            if (prevStep === 'template_select' && state.sourceType !== 'template') {
                prevStep = 'source'
            }

            // Skip variables if template has no variables
            if (prevStep === 'variables' && (!state.selectedTemplate?.variableSchema.length)) {
                prevStep = 'template_select'
            }

            // Reset parsing state when going back from parsing
            if (state.step === 'parsing') {
                setState(prev => ({
                    ...prev,
                    step: prevStep,
                    parsingStatus: 'idle',
                    parsingError: null
                }))
                return
            }

            setState(prev => ({ ...prev, step: prevStep }))
        }
    }

    // ==========================================================================
    // SECTION 12: FILE UPLOAD HANDLER
    // ==========================================================================

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        console.log('📄 handleFileUpload triggered')

        const file = event.target.files?.[0]
        if (!file) {
            console.log('❌ No file selected')
            return
        }

        console.log('📄 File selected:', file.name, file.type, file.size)
        setUploading(true)
        setError(null)

        try {
            // Validate file type
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
            const fileExtension = file.name.split('.').pop()?.toLowerCase()
            const allowedExtensions = ['pdf', 'docx', 'txt']

            if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
                throw new Error('Please upload a PDF, DOCX, or TXT file')
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('File size must be less than 10MB')
            }

            if (!userInfo?.companyId) {
                throw new Error('User not authenticated - missing company ID')
            }

            // Extract text based on file type
            console.log('📝 Extracting text from document...')
            let extractedText = ''

            if (file.type === 'application/pdf' || fileExtension === 'pdf') {
                extractedText = await extractTextFromPDF(file)
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === 'docx') {
                extractedText = await extractTextFromDOCX(file)
            } else if (file.type === 'text/plain' || fileExtension === 'txt') {
                extractedText = await file.text()
            }

            console.log('📝 Extracted text length:', extractedText.length)

            if (!extractedText || extractedText.length < 50) {
                throw new Error('Could not extract sufficient text from document. Please try a different file.')
            }

            // Upload original file to Supabase storage
            const fileName = `${Date.now()}-${file.name}`
            const filePath = `quick-contracts/${userInfo.companyId}/${fileName}`

            console.log('📤 Uploading to path:', filePath)

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file)

            if (uploadError) {
                console.error('❌ Supabase upload error:', uploadError)
                throw new Error(`Failed to upload file: ${uploadError.message}`)
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath)

            console.log('🔗 Public URL:', publicUrl)

            // Format extracted text as HTML paragraphs
            const formattedContent = extractedText
                .split('\n\n')
                .filter(para => para.trim())
                .map(para => `<p>${para.trim()}</p>`)
                .join('\n')

            setState(prev => ({
                ...prev,
                uploadedFileName: file.name,
                uploadedFileUrl: publicUrl,
                documentContent: formattedContent,
                contractName: file.name.replace(/\.[^/.]+$/, ''),
                step: 'details'
            }))

            console.log('✅ Upload and extraction complete')

            eventLogger.completed('quick_contract_create', 'file_uploaded', {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                extractedLength: extractedText.length
            })

        } catch (err) {
            console.error('❌ Upload error:', err)
            setError(err instanceof Error ? err.message : 'Failed to upload file')
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // ==========================================================================
    // SECTION 12A: TEXT EXTRACTION FUNCTIONS
    // ==========================================================================

    async function extractTextFromPDF(file: File): Promise<string> {
        try {
            console.log('📄 Starting PDF extraction...')

            // Dynamic import to avoid SSR issues
            const pdfjsLib = await import('pdfjs-dist')

            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

            console.log(`📄 PDF has ${pdf.numPages} pages`)

            let fullText = ''
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const textContent = await page.getTextContent()
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                fullText += pageText + '\n\n'
                console.log(`📄 Extracted page ${i}/${pdf.numPages}`)
            }

            console.log('📄 PDF extraction complete, total length:', fullText.length)
            return fullText.trim()
        } catch (err) {
            console.error('PDF extraction error:', err)
            throw new Error('Failed to extract text from PDF')
        }
    }

    async function extractTextFromDOCX(file: File): Promise<string> {
        try {
            console.log('📄 Starting DOCX extraction...')
            const arrayBuffer = await file.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer })
            console.log('📄 DOCX extraction complete, length:', result.value.length)
            return result.value
        } catch (err) {
            console.error('DOCX extraction error:', err)
            throw new Error('Failed to extract text from DOCX')
        }
    }

    // ==========================================================================
    // SECTION 13: PARSING HANDLERS
    // ==========================================================================

    async function handleStartParsing() {
        if (!userInfo || !state.documentContent) {
            setError('Missing document content')
            return
        }

        setState(prev => ({
            ...prev,
            step: 'parsing',
            parsingStatus: 'parsing',
            parsingError: null
        }))

        try {
            console.log('🔄 Starting document parsing...')

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo.userId,
                    company_id: userInfo.companyId,
                    file_name: state.uploadedFileName || `${state.contractName}.txt`,
                    file_type: 'text/plain',
                    file_size: state.documentContent.length,
                    raw_text: state.documentContent.replace(/<[^>]*>/g, '\n'),
                    contract_type: state.contractType,
                    mediation_type: 'stc',
                    template_source: state.uploadedFileName ? 'uploaded' : 'manual'
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Parsing failed with status ${response.status}`)
            }

            const result = await response.json()
            console.log('📄 Parsing result:', result)

            if (result.success && result.contractId) {
                // Start polling for parsing completion
                await pollForParsingComplete(result.contractId)
            } else {
                throw new Error(result.error || 'Parsing failed')
            }

        } catch (err) {
            console.error('❌ Parsing error:', err)
            setState(prev => ({
                ...prev,
                parsingStatus: 'error',
                parsingError: err instanceof Error ? err.message : 'Failed to parse document'
            }))
        }
    }

    async function pollForParsingComplete(contractId: string) {
        const maxAttempts = 30
        let attempts = 0

        const poll = async () => {
            attempts++
            console.log(`🔄 Polling attempt ${attempts}/${maxAttempts}...`)

            try {
                const { data: contractData, error: contractError } = await supabase
                    .from('uploaded_contracts')
                    .select('status, clause_count')
                    .eq('contract_id', contractId)
                    .single()

                if (contractError) {
                    throw new Error('Failed to check parsing status')
                }

                console.log('📄 Contract status:', contractData.status)

                if (contractData.status === 'ready') {
                    // Fetch the parsed clauses
                    const { data: clausesData, error: clausesError } = await supabase
                        .from('uploaded_contract_clauses')
                        .select(`
                        clause_id,
                        clause_number,
                        clause_name,
                        category,
                        content,
                        clause_level,
                        parent_clause_id,
                        display_order,
                        clarence_certified,
                        clarence_position,
                        clarence_fairness,
                        clarence_summary,
                        clarence_assessment,
                        clarence_flags,
                        clarence_certified_at
                    `)
                        .eq('contract_id', contractId)
                        .order('display_order', { ascending: true })

                    if (clausesError) {
                        console.error('Clauses fetch error:', clausesError)
                        throw new Error('Failed to fetch parsed clauses')
                    }

                    const parsedClauses: ParsedClause[] = (clausesData || []).map(c => ({
                        clauseId: c.clause_id,
                        clauseNumber: c.clause_number,
                        clauseName: c.clause_name,
                        category: c.category || 'Other',
                        clauseText: c.content || '',
                        level: c.clause_level || 1,
                        parentClauseNumber: null,
                        displayOrder: c.display_order,
                        isExpanded: false,
                        clarenceCertified: c.clarence_certified || false,
                        clarencePosition: c.clarence_position,
                        clarenceFairness: c.clarence_fairness,
                        clarenceSummary: c.clarence_summary,
                        clarenceAssessment: c.clarence_assessment,
                        clarenceFlags: c.clarence_flags || [],
                        clarenceCertifiedAt: c.clarence_certified_at
                    }))

                    console.log(`✅ Parsing complete! Found ${parsedClauses.length} clauses`)

                    // Clauses loaded - certification happens later in Studio page
                    setState(prev => ({
                        ...prev,
                        uploadedContractId: contractId,
                        parsedClauses,
                        parsingStatus: 'complete'
                    }))

                    // Auto-select first clause for review
                    if (parsedClauses.length > 0) {
                        setSelectedReviewClauseIndex(0)
                    }

                    return
                }

                if (contractData.status === 'failed') {
                    throw new Error('Document parsing failed. Please try again.')
                }

                // Still processing, continue polling
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000)
                } else {
                    throw new Error('Parsing timed out. Please try again.')
                }

            } catch (err) {
                console.error('❌ Polling error:', err)
                setState(prev => ({
                    ...prev,
                    parsingStatus: 'error',
                    parsingError: err instanceof Error ? err.message : 'Failed to check parsing status'
                }))
            }
        }

        poll()
    }

    async function reloadClauses(contractId: string) {
        try {
            const { data: clausesData, error: clausesError } = await supabase
                .from('uploaded_contract_clauses')
                .select(`
                clause_id,
                clause_number,
                clause_name,
                category,
                content,
                clause_level,
                parent_clause_id,
                display_order,
                clarence_certified,
                clarence_position,
                clarence_fairness,
                clarence_summary,
                clarence_assessment,
                clarence_flags,
                clarence_certified_at
            `)
                .eq('contract_id', contractId)
                .order('display_order', { ascending: true })

            if (clausesError) {
                throw clausesError
            }

            const parsedClauses: ParsedClause[] = (clausesData || []).map(c => ({
                clauseId: c.clause_id,
                clauseNumber: c.clause_number,
                clauseName: c.clause_name,
                category: c.category || 'Other',
                clauseText: c.content || '',
                level: c.clause_level || 1,
                parentClauseNumber: null,
                displayOrder: c.display_order,
                isExpanded: false,
                clarenceCertified: c.clarence_certified || false,
                clarencePosition: c.clarence_position,
                clarenceFairness: c.clarence_fairness,
                clarenceSummary: c.clarence_summary,
                clarenceAssessment: c.clarence_assessment,
                clarenceFlags: c.clarence_flags || [],
                clarenceCertifiedAt: c.clarence_certified_at
            }))

            console.log(`✅ Reloaded ${parsedClauses.length} clauses, ${parsedClauses.filter(c => c.clarenceCertified).length} certified`)

            setState(prev => ({
                ...prev,
                parsedClauses,
                parsingStatus: 'complete'
            }))

        } catch (err) {
            console.error('Error reloading clauses:', err)
            setState(prev => ({
                ...prev,
                parsingStatus: 'complete' // Continue anyway
            }))
        }
    }


    function handleClauseNameChange(index: number, newName: string) {
        setState(prev => ({
            ...prev,
            parsedClauses: prev.parsedClauses.map((clause, i) =>
                i === index ? { ...clause, clauseName: newName } : clause
            )
        }))
    }

    function handleClauseCategoryChange(index: number, newCategory: string) {
        setState(prev => ({
            ...prev,
            parsedClauses: prev.parsedClauses.map((clause, i) =>
                i === index ? { ...clause, category: newCategory } : clause
            )
        }))
    }

    function handleRetryParsing() {
        setState(prev => ({
            ...prev,
            step: 'content',
            parsingStatus: 'idle',
            parsingError: null,
            parsedClauses: []
        }))
    }

    function handleToggleClauseExpanded(index: number) {
        setState(prev => ({
            ...prev,
            parsedClauses: prev.parsedClauses.map((clause, i) =>
                i === index ? { ...clause, isExpanded: !clause.isExpanded } : clause
            )
        }))
    }

    // ==========================================================================
    // SECTION 14: SESSION AND INVITE HANDLERS
    // ==========================================================================

    async function handleCreateSessionAndInvite() {
        if (!userInfo || !state.uploadedContractId) {
            setError('Missing required data')
            return
        }

        if (!inviteEmail.trim() || !inviteName.trim()) {
            setError('Please enter recipient name and email')
            return
        }

        setSendingInvite(true)
        setError(null)

        try {
            console.log('🚀 Creating Quick Contract session and sending invite...')

            // Create session via QC-Send workflow (Quick Contract specific)
            const response = await fetch(`${API_BASE}/qc-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Contract details
                    contract_id: state.uploadedContractId,
                    contract_name: state.contractName,
                    contract_type: state.contractType || 'other',

                    // Initiator (sender) details
                    initiator_user_id: userInfo.userId,
                    initiator_company_id: userInfo.companyId,
                    initiator_email: userInfo.email,
                    initiator_name: `${userInfo.firstName} ${userInfo.lastName}`,
                    initiator_company: userInfo.company,

                    // Recipient details
                    recipient_email: inviteEmail.trim(),
                    recipient_name: inviteName.trim(),
                    recipient_company: inviteCompany?.trim() || '',

                    // Personal message (optional)
                    personal_message: inviteMessage?.trim() || '',

                    // Mode
                    mediation_type: 'stc'
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to send: ${response.status}`)
            }

            const result = await response.json()
            console.log('✅ Quick Contract sent:', result)

            if (result.success) {
                const sessionId = result.sessionId || result.session_id

                if (sessionId) {
                    setState(prev => ({
                        ...prev,
                        sessionId: sessionId
                    }))

                    // Redirect to the contract studio (STC mode)
                    router.push(`/auth/quick-contract/studio/${sessionId}`)
                } else {
                    // New - redirects to studio
                    router.push(`/auth/quick-contract/studio/${state.uploadedContractId}`)
                }
            } else {
                throw new Error(result.error || 'Failed to send contract')
            }

        } catch (err) {
            console.error('❌ Quick Contract send error:', err)
            setError(err instanceof Error ? err.message : 'Failed to send contract')
        } finally {
            setSendingInvite(false)
        }
    }

    async function handleSaveDraft() {
        if (!userInfo) return

        setSaving(true)
        setError(null)

        try {
            if (state.uploadedContractId) {
                // Already saved during parsing - just update name/description
                const { error: updateError } = await supabase
                    .from('uploaded_contracts')
                    .update({
                        contract_name: state.contractName,
                        contract_type: state.contractType
                    })
                    .eq('contract_id', state.uploadedContractId)

                if (updateError) {
                    throw new Error('Failed to update contract')
                }

                eventLogger.completed('quick_contract_create', 'draft_saved', {
                    contractId: state.uploadedContractId,
                    contractName: state.contractName
                })

                // Redirect to contracts list
                router.push('/auth/quick-contract')
            } else {
                // Save as quick_contract draft (pre-parsing)
                const { data, error } = await supabase
                    .from('quick_contracts')
                    .insert({
                        company_id: userInfo.companyId,
                        created_by_user_id: userInfo.userId,
                        contract_name: state.contractName,
                        contract_type: state.contractType,
                        description: state.description,
                        reference_number: state.referenceNumber || null,
                        document_content: state.documentContent,
                        document_format: 'html',
                        original_file_name: state.uploadedFileName,
                        original_file_url: state.uploadedFileUrl,
                        variables: state.variableValues,
                        status: 'draft'
                    })
                    .select('quick_contract_id')
                    .single()

                if (error) {
                    throw new Error('Failed to save contract')
                }

                eventLogger.completed('quick_contract_create', 'draft_saved', {
                    contractId: data.quick_contract_id,
                    contractName: state.contractName
                })

                router.push(`/auth/quick-contract/studio/${data.quick_contract_id}`)
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save contract')
        } finally {
            setSaving(false)
        }
    }

    // ==========================================================================
    // SECTION 15: HELPER FUNCTIONS
    // ==========================================================================

    function getStepNumber(): number {
        switch (state.step) {
            case 'source':
            case 'template_select':
                return 1
            case 'variables':
            case 'details':
                return 2
            case 'content':
                return 3
            case 'parsing':
                return 4
            case 'invite':
                return 5
            default:
                return 1
        }
    }

    function getContractTypeLabel(type: ContractType): string {
        const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type)
        return option?.label || 'Other'
    }

    function getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            'Definitions': 'bg-slate-100 text-slate-700',
            'Scope of Services': 'bg-blue-100 text-blue-700',
            'Payment Terms': 'bg-emerald-100 text-emerald-700',
            'Liability': 'bg-red-100 text-red-700',
            'Indemnification': 'bg-orange-100 text-orange-700',
            'Intellectual Property': 'bg-purple-100 text-purple-700',
            'Confidentiality': 'bg-amber-100 text-amber-700',
            'Term and Termination': 'bg-rose-100 text-rose-700',
            'Dispute Resolution': 'bg-indigo-100 text-indigo-700',
            'General Provisions': 'bg-gray-100 text-gray-700',
            'Data Protection': 'bg-cyan-100 text-cyan-700',
            'Insurance': 'bg-teal-100 text-teal-700',
            'Warranties': 'bg-lime-100 text-lime-700',
            'Force Majeure': 'bg-yellow-100 text-yellow-700'
        }
        return colors[category] || 'bg-slate-100 text-slate-600'
    }

    // ==========================================================================
    // SECTION 16: RENDER - LOADING STATE
    // ==========================================================================

    if (loading) {
        return <LoadingFallback />
    }

    // ==========================================================================
    // SECTION 17: RENDER - MAIN LAYOUT
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 18: HEADER */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">Quick Contract</div>
                            </div>
                        </Link>

                        <div className="flex items-center gap-4">
                            <FeedbackButton position="header" />
                            <Link
                                href="/auth/quick-contract"
                                className="text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Cancel
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 19: PROGRESS BAR */}
            {/* ================================================================== */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {STEPS_CONFIG.map((stepConfig, index) => {
                            const isActive = getStepNumber() === stepConfig.number
                            const isComplete = getStepNumber() > stepConfig.number

                            return (
                                <React.Fragment key={stepConfig.id}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${isComplete ? 'bg-teal-600 text-white' :
                                            isActive ? 'bg-teal-600 text-white' :
                                                'bg-slate-200 text-slate-500'
                                            }`}>
                                            {isComplete ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                stepConfig.number
                                            )}
                                        </div>
                                        <span className={`text-sm font-medium ${isActive || isComplete ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {stepConfig.label}
                                        </span>
                                    </div>
                                    {index < STEPS_CONFIG.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-4 ${isComplete ? 'bg-teal-600' : 'bg-slate-200'}`} />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* SECTION 20: MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="max-w-4xl mx-auto px-6 py-8">

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 21: STEP - SOURCE SELECTION */}
                {/* ============================================================== */}
                {state.step === 'source' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-slate-800 mb-2">Create Quick Contract</h1>
                            <p className="text-slate-500">How would you like to start?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                            {SOURCE_OPTIONS.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleSourceSelect(option.value as SourceType)}
                                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-left group"
                                >
                                    <div className="text-3xl mb-3">{option.icon}</div>
                                    <h3 className="font-semibold text-slate-800 mb-1 group-hover:text-teal-700">
                                        {option.label}
                                    </h3>
                                    <p className="text-sm text-slate-500">{option.description}</p>
                                </button>
                            ))}
                        </div>

                        {/* Hidden file input for upload */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 22: STEP - TEMPLATE SELECTION */}
                {/* ============================================================== */}
                {state.step === 'template_select' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Choose a Template</h2>
                                <p className="text-slate-500 text-sm">Select a pre-built template to get started quickly</p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        {templates.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">No templates available</h3>
                                <p className="text-slate-500 text-sm mb-4">Templates will appear here once they&apos;re configured.</p>
                                <button
                                    onClick={() => setState(prev => ({ ...prev, sourceType: 'blank', step: 'details' }))}
                                    className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                                >
                                    Start with a blank contract instead →
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {templates.map(template => (
                                    <button
                                        key={template.templateId}
                                        onClick={() => handleTemplateSelect(template)}
                                        className="p-5 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-left group"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="font-semibold text-slate-800 group-hover:text-teal-700">
                                                {template.templateName}
                                            </h3>
                                            {template.isSystemTemplate && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                                                    System
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mb-3">{template.description}</p>
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                                {template.templateCategory}
                                            </span>
                                            {template.variableSchema.length > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                                    </svg>
                                                    {template.variableSchema.length} fields
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 23: STEP - VARIABLES (TEMPLATE FIELDS) */}
                {/* ============================================================== */}
                {state.step === 'variables' && state.selectedTemplate && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Fill in the Details</h2>
                                <p className="text-slate-500 text-sm">
                                    Complete the fields below to personalize your {state.selectedTemplate.templateName}
                                </p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        <div className="space-y-5 max-w-xl">
                            {state.selectedTemplate.variableSchema.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={state.variableValues[field.key] || ''}
                                            onChange={(e) => setState(prev => ({
                                                ...prev,
                                                variableValues: { ...prev.variableValues, [field.key]: e.target.value }
                                            }))}
                                            rows={4}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder={`Enter ${field.label.toLowerCase()}`}
                                        />
                                    ) : (
                                        <input
                                            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                            value={state.variableValues[field.key] || ''}
                                            onChange={(e) => setState(prev => ({
                                                ...prev,
                                                variableValues: { ...prev.variableValues, [field.key]: e.target.value }
                                            }))}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder={`Enter ${field.label.toLowerCase()}`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleVariablesComplete}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 24: STEP - CONTRACT DETAILS */}
                {/* ============================================================== */}
                {state.step === 'details' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Contract Details</h2>
                                <p className="text-slate-500 text-sm">Enter the basic information for your contract</p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        {/* Upload trigger for upload source type */}
                        {state.sourceType === 'upload' && !state.uploadedFileName && (
                            <div className="mb-6">
                                <div
                                    onClick={() => {
                                        console.log('🖱️ Dropzone clicked')
                                        console.log('File input ref:', fileInputRef.current)
                                        fileInputRef.current?.click()
                                    }}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-colors"
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                            <p className="text-slate-600">Uploading...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <p className="text-slate-600 mb-1">Click to upload or drag and drop</p>
                                            <p className="text-slate-400 text-sm">PDF, DOCX, or TXT (max 10MB)</p>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </div>
                        )}

                        {/* Uploaded file indicator */}
                        {state.uploadedFileName && (
                            <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">{state.uploadedFileName}</p>
                                        <p className="text-xs text-slate-500">Uploaded successfully</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setState(prev => ({
                                            ...prev,
                                            uploadedFileName: null,
                                            uploadedFileUrl: null,
                                            documentContent: ''
                                        }))
                                        fileInputRef.current?.click()
                                    }}
                                    className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                                >
                                    Replace
                                </button>
                            </div>
                        )}

                        <div className="space-y-5 max-w-xl">
                            {/* Contract Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Contract Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={state.contractName}
                                    onChange={(e) => setState(prev => ({ ...prev, contractName: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="e.g., NDA - Acme Corporation"
                                />
                            </div>

                            {/* Contract Type */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Contract Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CONTRACT_TYPE_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setState(prev => ({ ...prev, contractType: option.value as ContractType }))}
                                            className={`p-3 rounded-lg border-2 text-left transition-colors ${state.contractType === option.value
                                                ? 'border-teal-500 bg-teal-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>{option.icon}</span>
                                                <span className="font-medium text-sm text-slate-800">{option.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Description <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={state.description}
                                    onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="Brief description of this contract..."
                                />
                            </div>

                            {/* Reference Number */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Reference Number <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={state.referenceNumber}
                                    onChange={(e) => setState(prev => ({ ...prev, referenceNumber: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="e.g., CONTRACT-2026-001"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleDetailsComplete}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 25: STEP - CONTENT EDITOR */}
                {/* ============================================================== */}

                {state.step === 'content' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Contract Content</h2>
                                <p className="text-slate-500 text-sm">Review the extracted text, then parse into clauses</p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        {/* Content Preview/Editor */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                                <span className="text-xs text-slate-500">Document content</span>
                                <span className="text-xs text-slate-400">
                                    {state.documentContent.replace(/<[^>]*>/g, '').length.toLocaleString()} characters
                                </span>
                            </div>

                            <textarea
                                value={state.documentContent.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n')}
                                onChange={(e) => setState(prev => ({ ...prev, documentContent: e.target.value }))}
                                className="w-full h-96 p-4 text-sm focus:outline-none resize-none"
                                placeholder="Your contract content will appear here..."
                            />
                        </div>

                        {/* Info Box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="text-sm text-blue-800 font-medium">What happens next?</p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        CLARENCE will analyze this document and extract individual clauses.
                                        You&apos;ll be able to review and adjust the extracted clauses before inviting the other party.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <button
                                onClick={handleSaveDraft}
                                disabled={saving}
                                className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save as Draft'}
                            </button>

                            <button
                                onClick={handleStartParsing}
                                disabled={!state.documentContent.trim()}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                Parse into Clauses
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 25: STEP - PARSING / REVIEW CLAUSES (3-PANEL LAYOUT) */}
                {/* ============================================================== */}
                {state.step === 'parsing' && (
                    <>
                        {/* Parsing In Progress - Keep in container */}
                        {state.parsingStatus === 'parsing' && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">Analyzing Your Contract</h2>
                                    <p className="text-slate-500 mb-2">CLARENCE is identifying and extracting clauses...</p>
                                    <p className="text-sm text-slate-400">This typically takes about a minute or so</p>
                                </div>
                            </div>
                        )}


                        {/* Parsing Error - Keep in container */}
                        {state.parsingStatus === 'error' && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">Processing Failed</h2>
                                    <p className="text-slate-500 mb-6">{state.parsingError || 'Something went wrong.'}</p>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={handleRetryParsing}
                                            className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Go Back & Edit
                                        </button>
                                        <button
                                            onClick={handleStartParsing}
                                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* FULL-WIDTH 3-PANEL REVIEW LAYOUT - Breaks out of container */}
                {state.step === 'parsing' && state.parsingStatus === 'complete' && (
                    <div className="fixed inset-0 z-40 bg-slate-100">
                        <div className="flex flex-col h-full">

                            {/* Header Bar */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center gap-4">
                                    {/* Logo/Brand */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">C</span>
                                        </div>
                                        <span className="font-semibold text-slate-800">CLARENCE</span>
                                    </div>
                                    <div className="h-6 w-px bg-slate-200"></div>
                                    <div>
                                        <h1 className="text-lg font-bold text-slate-800">Review Extracted Clauses</h1>
                                        <p className="text-sm text-slate-500">
                                            {state.contractName || 'Untitled Contract'} • {state.parsedClauses.length} clauses
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleRetryParsing}
                                        className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-sm transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back
                                    </button>
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={saving}
                                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Draft'}
                                    </button>
                                    <button
                                        onClick={() => setState(prev => ({ ...prev, step: 'invite' }))}
                                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        Continue to Invite
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* 3-Panel Content Area */}
                            <div className="flex flex-1 overflow-hidden">

                                {/* LEFT PANEL: Clause List */}
                                <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
                                    {/* Search/Filter */}
                                    <div className="p-4 border-b border-slate-200">
                                        <div className="relative">
                                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="text"
                                                placeholder="Search clauses..."
                                                value={clauseSearchTerm}
                                                onChange={(e) => setClauseSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Clause List */}
                                    <div className="flex-1 overflow-y-auto">
                                        {state.parsedClauses
                                            .filter(c => {
                                                if (!clauseSearchTerm) return true
                                                const search = clauseSearchTerm.toLowerCase()
                                                return (
                                                    c.clauseName.toLowerCase().includes(search) ||
                                                    c.clauseNumber.toLowerCase().includes(search) ||
                                                    c.category.toLowerCase().includes(search)
                                                )
                                            })
                                            .map((clause, index) => {
                                                const actualIndex = state.parsedClauses.findIndex(c => c.clauseId === clause.clauseId)
                                                const isSelected = selectedReviewClauseIndex === actualIndex
                                                const isCertified = clause.clarenceCertified
                                                const hasFlags = clause.clarenceFlags && clause.clarenceFlags.length > 0 && !clause.clarenceFlags.includes('none')

                                                return (
                                                    <div
                                                        key={`clause-nav-${clause.clauseId || index}`}
                                                        onClick={() => setSelectedReviewClauseIndex(actualIndex)}
                                                        className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-all ${isSelected
                                                            ? 'bg-teal-50 border-l-4 border-l-teal-500'
                                                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                                            }`}
                                                        style={{ paddingLeft: `${16 + (clause.level - 1) * 12}px` }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {/* Certification Status Icon */}
                                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${!isCertified
                                                                ? 'bg-slate-200 text-slate-400'
                                                                : hasFlags
                                                                    ? 'bg-amber-100 text-amber-600'
                                                                    : clause.clarenceFairness === 'balanced'
                                                                        ? 'bg-emerald-100 text-emerald-600'
                                                                        : 'bg-blue-100 text-blue-600'
                                                                }`}>
                                                                {!isCertified ? '○' : hasFlags ? '!' : '✓'}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                        {clause.clauseNumber}
                                                                    </span>
                                                                </div>
                                                                <p className={`text-sm leading-snug ${isSelected ? 'text-teal-700 font-medium' : 'text-slate-700'}`}>
                                                                    {clause.clauseName}
                                                                </p>
                                                                <span className={`inline-block mt-1.5 px-2 py-0.5 text-xs rounded-full ${getCategoryColor(clause.category)}`}>
                                                                    {clause.category}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>

                                    {/* Clause Stats Footer */}
                                    <div className="p-4 border-t border-slate-200 bg-slate-50">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Total: <strong className="text-slate-700">{state.parsedClauses.length}</strong></span>
                                            <span className="text-emerald-600 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                                {state.parsedClauses.filter(c => c.clarenceCertified).length} certified
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* MIDDLE PANEL: Clause Detail */}
                                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                                    {selectedReviewClause ? (
                                        <>
                                            {/* Clause Header */}
                                            <div className="px-8 py-5 border-b border-slate-200 bg-white">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                                                                {selectedReviewClause.clauseNumber}
                                                            </span>
                                                            <select
                                                                value={selectedReviewClause.category}
                                                                onChange={(e) => handleClauseCategoryChange(selectedReviewClauseIndex!, e.target.value)}
                                                                className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getCategoryColor(selectedReviewClause.category)}`}
                                                            >
                                                                {CLAUSE_CATEGORIES.map(cat => (
                                                                    <option key={cat} value={cat}>{cat}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={selectedReviewClause.clauseName}
                                                            onChange={(e) => handleClauseNameChange(selectedReviewClauseIndex!, e.target.value)}
                                                            className="text-2xl font-bold text-slate-800 w-full bg-transparent border-0 border-b-2 border-transparent hover:border-slate-200 focus:border-teal-500 focus:outline-none transition-colors px-0 py-1"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(selectedReviewClause.clauseText || '')
                                                        }}
                                                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Copy clause text"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Clause Content */}
                                            <div className="flex-1 overflow-y-auto p-8">
                                                <div className="max-w-4xl mx-auto">
                                                    <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
                                                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-base">
                                                            {selectedReviewClause.clauseText || 'No content available for this clause.'}
                                                        </p>
                                                    </div>
                                                    <div className="mt-3 text-sm text-slate-400 text-right">
                                                        {selectedReviewClause.clauseText?.length || 0} characters
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Navigation Footer */}
                                            <div className="px-8 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
                                                <button
                                                    onClick={() => setSelectedReviewClauseIndex(Math.max(0, (selectedReviewClauseIndex || 0) - 1))}
                                                    disabled={selectedReviewClauseIndex === 0}
                                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                    </svg>
                                                    Previous
                                                </button>
                                                <span className="text-sm text-slate-500 font-medium">
                                                    Clause {(selectedReviewClauseIndex || 0) + 1} of {state.parsedClauses.length}
                                                </span>
                                                <button
                                                    onClick={() => setSelectedReviewClauseIndex(Math.min(state.parsedClauses.length - 1, (selectedReviewClauseIndex || 0) + 1))}
                                                    disabled={selectedReviewClauseIndex === state.parsedClauses.length - 1}
                                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    Next
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        /* No clause selected */
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-slate-500 text-lg">Select a clause from the list to view details</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT PANEL: CLARENCE Advisor */}
                                <div className="w-96 border-l border-slate-200 flex flex-col bg-white">
                                    {selectedReviewClause ? (
                                        <>
                                            {/* Certification Status Header */}
                                            <div className={`px-6 py-4 border-b ${selectedReviewClause.clarenceCertified
                                                ? selectedReviewClause.clarenceFairness === 'balanced'
                                                    ? 'bg-emerald-50 border-emerald-200'
                                                    : selectedReviewClause.clarenceFairness === 'review_recommended'
                                                        ? 'bg-amber-50 border-amber-200'
                                                        : 'bg-blue-50 border-blue-200'
                                                : 'bg-slate-50 border-slate-200'
                                                }`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedReviewClause.clarenceCertified
                                                        ? selectedReviewClause.clarenceFairness === 'balanced'
                                                            ? 'bg-emerald-100'
                                                            : selectedReviewClause.clarenceFairness === 'review_recommended'
                                                                ? 'bg-amber-100'
                                                                : 'bg-blue-100'
                                                        : 'bg-slate-200'
                                                        }`}>
                                                        {selectedReviewClause.clarenceCertified ? (
                                                            <svg className={`w-6 h-6 ${selectedReviewClause.clarenceFairness === 'balanced'
                                                                ? 'text-emerald-600'
                                                                : selectedReviewClause.clarenceFairness === 'review_recommended'
                                                                    ? 'text-amber-600'
                                                                    : 'text-blue-600'
                                                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 text-lg">
                                                            {selectedReviewClause.clarenceCertified ? 'CLARENCE Certified' : 'Pending Certification'}
                                                        </h3>
                                                        {selectedReviewClause.clarenceCertified && (
                                                            <p className={`text-sm font-medium ${selectedReviewClause.clarenceFairness === 'balanced'
                                                                ? 'text-emerald-600'
                                                                : selectedReviewClause.clarenceFairness === 'review_recommended'
                                                                    ? 'text-amber-600'
                                                                    : 'text-blue-600'
                                                                }`}>
                                                                {selectedReviewClause.clarenceFairness?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Certification Details */}
                                            <div className="flex-1 overflow-y-auto p-6">
                                                {selectedReviewClause.clarenceCertified ? (
                                                    <div className="space-y-6">
                                                        {/* Position Score */}
                                                        {selectedReviewClause.clarencePosition && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Position Score</h4>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all ${selectedReviewClause.clarencePosition <= 4
                                                                                ? 'bg-green-500'
                                                                                : selectedReviewClause.clarencePosition <= 6
                                                                                    ? 'bg-emerald-500'
                                                                                    : 'bg-blue-500'
                                                                                }`}
                                                                            style={{ width: `${(selectedReviewClause.clarencePosition / 10) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-2xl font-bold text-slate-800 w-12 text-right">
                                                                        {selectedReviewClause.clarencePosition.toFixed(1)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-xs text-slate-400 mt-2">
                                                                    <span>Customer-Favoring</span>
                                                                    <span>Provider-Favoring</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Summary */}
                                                        {selectedReviewClause.clarenceSummary && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">What This Means</h4>
                                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                                    {selectedReviewClause.clarenceSummary}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Assessment */}
                                                        {selectedReviewClause.clarenceAssessment && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Assessment</h4>
                                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                                    {selectedReviewClause.clarenceAssessment}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Flags */}
                                                        {selectedReviewClause.clarenceFlags && selectedReviewClause.clarenceFlags.length > 0 && !selectedReviewClause.clarenceFlags.includes('none') && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Attention Points</h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {selectedReviewClause.clarenceFlags.filter(f => f !== 'none').map((flag, i) => (
                                                                        <span
                                                                            key={i}
                                                                            className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full"
                                                                        >
                                                                            {flag.replace(/_/g, ' ')}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Certification Date */}
                                                        {selectedReviewClause.clarenceCertifiedAt && (
                                                            <div className="pt-4 border-t border-slate-200">
                                                                <p className="text-xs text-slate-400">
                                                                    Certified: {new Date(selectedReviewClause.clarenceCertifiedAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-12">
                                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        </div>
                                                        <p className="text-sm text-slate-500 mb-6">
                                                            This clause hasn't been certified yet.
                                                        </p>
                                                        <p className="text-xs text-slate-500 italic">Certification will happen automatically in the Studio.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* CLARENCE Chat Section */}
                                            <div className="border-t border-slate-200 p-4 bg-slate-50">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ask CLARENCE</h4>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Ask about this clause..."
                                                        className="w-full px-4 py-3 pr-12 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                                                        disabled
                                                    />
                                                    <button
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-teal-600 transition-colors rounded-lg hover:bg-slate-100"
                                                        disabled
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-2 text-center">
                                                    Chat coming soon
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center px-8">
                                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                </div>
                                                <p className="text-slate-500">
                                                    Select a clause to view CLARENCE's certification assessment
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 27: STEP - REVIEW */}
                {/* ============================================================== */}

                {state.step === 'invite' && (
                    <div className="space-y-6">
                        {/* Contract Summary */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="font-semibold text-slate-800 mb-4">Contract Summary</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Name</span>
                                    <p className="font-medium text-slate-800 mt-1 truncate">{state.contractName}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Type</span>
                                    <p className="font-medium text-slate-800 mt-1">
                                        {state.contractType ? getContractTypeLabel(state.contractType) : 'Not specified'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Clauses</span>
                                    <p className="font-medium text-slate-800 mt-1">{state.parsedClauses.length}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Mode</span>
                                    <p className="font-medium text-teal-600 mt-1">Quick Contract</p>
                                </div>
                            </div>
                        </div>

                        {/* Invite Form */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Invite Counterparty</h2>
                                    <p className="text-slate-500 text-sm">Enter the details of the person you want to review this contract</p>
                                </div>
                                <button
                                    onClick={() => setState(prev => ({ ...prev, step: 'parsing' }))}
                                    className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back
                                </button>
                            </div>

                            <div className="max-w-md space-y-5">
                                {/* Recipient Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Recipient Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        placeholder="e.g., John Smith"
                                    />
                                </div>

                                {/* Recipient Email */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Recipient Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        placeholder="e.g., john@company.com"
                                    />
                                </div>

                                {/* Recipient Company */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Company Name <span className="text-slate-400 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteCompany}
                                        onChange={(e) => setInviteCompany(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        placeholder="e.g., Acme Corporation"
                                    />
                                </div>
                            </div>

                            {/* What They'll See */}
                            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm text-blue-800 font-medium">What the recipient will see</p>
                                        <ul className="text-sm text-blue-700 mt-2 space-y-1">
                                            <li>• Contract clauses in a read-only view</li>
                                            <li>• Ability to discuss via party chat</li>
                                            <li>• Chat with CLARENCE for questions</li>
                                            <li>• Accept or request changes button</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={saving}
                                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save as Draft'}
                                </button>

                                <button
                                    onClick={handleCreateSessionAndInvite}
                                    disabled={sendingInvite || !inviteEmail.trim() || !inviteName.trim()}
                                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {sendingInvite ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Creating Session...
                                        </>
                                    ) : (
                                        <>
                                            Create Session & Send Invite
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    )
}