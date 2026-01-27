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

type CreateStep = 'source' | 'details' | 'template_select' | 'variables' | 'content' | 'review'
type SourceType = 'template' | 'upload' | 'blank' | null
type ContractType = 'nda' | 'service_agreement' | 'lease' | 'employment' | 'contractor' | 'vendor' | 'other' | null

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
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const CONTRACT_TYPE_OPTIONS = [
    { value: 'nda', label: 'Non-Disclosure Agreement', icon: '🔒', description: 'Protect confidential information' },
    { value: 'service_agreement', label: 'Service Agreement', icon: '📋', description: 'Define service terms and deliverables' },
    { value: 'lease', label: 'Lease Agreement', icon: '🏠', description: 'Property or equipment rental terms' },
    { value: 'employment', label: 'Employment Contract', icon: '👤', description: 'Employment terms and conditions' },
    { value: 'contractor', label: 'Contractor Agreement', icon: '🔧', description: 'Independent contractor terms' },
    { value: 'vendor', label: 'Vendor Agreement', icon: '🤝', description: 'Supplier and vendor terms' },
    { value: 'other', label: 'Other', icon: '📄', description: 'Custom contract type' }
]

const SOURCE_OPTIONS = [
    {
        value: 'template',
        label: 'Start from Template',
        icon: '📑',
        description: 'Choose from pre-built templates with variable placeholders'
    },
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
    { id: 'review', label: 'Review', number: 4 }
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
    uploadedFileUrl: null
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

    // Duplicate mode
    const duplicateId = searchParams.get('duplicate')

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
        setState(prev => ({ ...prev, step: 'review' }))
    }

    function handleBack() {
        const stepOrder: CreateStep[] = ['source', 'template_select', 'variables', 'details', 'content', 'review']
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
    // SECTION 13: SAVE HANDLERS
    // ==========================================================================

    async function handleSaveDraft() {
        if (!userInfo) return

        setSaving(true)
        setError(null)

        try {
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
                    source_template_id: state.selectedTemplate?.templateId || null,
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

            // Redirect to the contract view
            router.push(`/auth/quick-contract/${data.quick_contract_id}`)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save contract')
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveAndSend() {
        if (!userInfo) return

        setSaving(true)
        setError(null)

        try {
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
                    source_template_id: state.selectedTemplate?.templateId || null,
                    variables: state.variableValues,
                    status: 'ready'
                })
                .select('quick_contract_id')
                .single()

            if (error) {
                throw new Error('Failed to save contract')
            }

            eventLogger.completed('quick_contract_create', 'contract_created', {
                contractId: data.quick_contract_id,
                contractName: state.contractName
            })

            // Redirect to send page
            router.push(`/auth/quick-contract/${data.quick_contract_id}/send`)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save contract')
        } finally {
            setSaving(false)
        }
    }

    // ==========================================================================
    // SECTION 14: HELPER FUNCTIONS
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
            case 'review':
                return 4
            default:
                return 1
        }
    }

    function getContractTypeLabel(type: ContractType): string {
        const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type)
        return option?.label || 'Other'
    }

    // ==========================================================================
    // SECTION 15: RENDER - LOADING STATE
    // ==========================================================================

    if (loading) {
        return <LoadingFallback />
    }

    // ==========================================================================
    // SECTION 16: RENDER - MAIN LAYOUT
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 17: HEADER */}
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
            {/* SECTION 18: PROGRESS BAR */}
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
            {/* SECTION 19: MAIN CONTENT */}
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
                {/* SECTION 20: STEP - SOURCE SELECTION */}
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
                {/* SECTION 21: STEP - TEMPLATE SELECTION */}
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
                {/* SECTION 22: STEP - VARIABLES (TEMPLATE FIELDS) */}
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
                {/* SECTION 23: STEP - CONTRACT DETAILS */}
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
                {/* SECTION 24: STEP - CONTENT EDITOR */}
                {/* ============================================================== */}
                {state.step === 'content' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Contract Content</h2>
                                <p className="text-slate-500 text-sm">Review and edit your contract content</p>
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

                        {/* Simple Text Editor */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            {/* Toolbar */}
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2">
                                <span className="text-xs text-slate-500">Basic editor - formatting will be preserved</span>
                            </div>

                            {/* Editor Area */}
                            <textarea
                                value={state.documentContent}
                                onChange={(e) => setState(prev => ({ ...prev, documentContent: e.target.value }))}
                                className="w-full h-96 p-4 text-sm font-mono focus:outline-none resize-none"
                                placeholder={`Enter your contract content here...

You can use HTML formatting:
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<p>Paragraph text</p>
<ul><li>List item</li></ul>
<strong>Bold text</strong>
<em>Italic text</em>`}
                            />
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleContentComplete}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                Continue to Review
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 25: STEP - REVIEW */}
                {/* ============================================================== */}
                {state.step === 'review' && (
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                            <h2 className="text-xl font-bold text-slate-800 mb-6">Review Your Contract</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Contract Name</span>
                                    <p className="font-medium text-slate-800 mt-1">{state.contractName}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Type</span>
                                    <p className="font-medium text-slate-800 mt-1">
                                        {state.contractType ? getContractTypeLabel(state.contractType) : 'Not specified'}
                                    </p>
                                </div>
                                {state.description && (
                                    <div className="md:col-span-2">
                                        <span className="text-xs text-slate-400 uppercase tracking-wider">Description</span>
                                        <p className="text-slate-600 mt-1">{state.description}</p>
                                    </div>
                                )}
                                {state.referenceNumber && (
                                    <div>
                                        <span className="text-xs text-slate-400 uppercase tracking-wider">Reference</span>
                                        <p className="font-medium text-slate-800 mt-1">{state.referenceNumber}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider">Source</span>
                                    <p className="font-medium text-slate-800 mt-1">
                                        {state.selectedTemplate ? `Template: ${state.selectedTemplate.templateName}` :
                                            state.uploadedFileName ? `Upload: ${state.uploadedFileName}` :
                                                'Created from scratch'}
                                    </p>
                                </div>
                            </div>

                            {/* Content Preview */}
                            <div>
                                <span className="text-xs text-slate-400 uppercase tracking-wider">Content Preview</span>
                                <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
                                    <div
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: state.documentContent }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                                <button
                                    onClick={handleBack}
                                    className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back to Edit
                                </button>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSaveDraft}
                                        disabled={saving}
                                        className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save as Draft'}
                                    </button>
                                    <button
                                        onClick={handleSaveAndSend}
                                        disabled={saving}
                                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                Save &amp; Send
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    )
}