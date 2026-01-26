'use client'

// ============================================================================
// CLARENCE CONTRACT LIBRARY PAGE - WP6 v2
// ============================================================================
// File: /app/auth/contracts/page.tsx
// Purpose: Template library for reusable contract configurations
// 
// WP6 v2 CHANGES:
// 1. Removed "New Contract" button (page is for templates only)
// 2. Added "Upload Contract" card in My Templates section
// 3. Added drag & drop upload modal
// 4. Processes uploaded contracts into user templates
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: string
    userId?: string
    companyId?: string
}

interface ContractTemplate {
    templateId: string
    templateCode: string
    templateName: string
    description: string
    industry: string | null
    contractType: string
    clauseCount: number
    version: number
    timesUsed: number
    lastUsedAt: string | null
    createdAt: string
    updatedAt: string
    // Scope indicators
    isSystem: boolean
    isPublic: boolean
    isActive: boolean
    companyId: string | null
    createdByUserId: string | null
    sourceSessionId: string | null
}

interface TemplateSection {
    id: 'system' | 'company' | 'user'
    title: string
    icon: string
    description: string
    templates: ContractTemplate[]
    isCollapsed: boolean
    canEdit: boolean
    canDelete: boolean
    canUpload: boolean
    emptyMessage: string
    emptySubMessage: string
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
]

const FILE_TYPE_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/plain': 'TXT'
}

const CONTRACT_TYPE_ICONS: Record<string, string> = {
    'bpo': '🏢',
    'saas': '☁️',
    'nda': '🔒',
    'msa': '📋',
    'employment': '👔',
    'it_services': '💻',
    'consulting': '💼',
    'custom': '📄',
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    'bpo': 'BPO Agreement',
    'saas': 'SaaS Agreement',
    'nda': 'Non-Disclosure Agreement',
    'msa': 'Master Service Agreement',
    'employment': 'Employment Contract',
    'it_services': 'IT Services Agreement',
    'consulting': 'Consulting Agreement',
    'custom': 'Custom Contract',
}

const CONTRACT_TYPE_OPTIONS = [
    { value: 'bpo', label: 'BPO / Outsourcing Agreement' },
    { value: 'saas', label: 'SaaS Agreement' },
    { value: 'nda', label: 'Non-Disclosure Agreement' },
    { value: 'msa', label: 'Master Service Agreement' },
    { value: 'employment', label: 'Employment Contract' },
    { value: 'it_services', label: 'IT Services Agreement' },
    { value: 'consulting', label: 'Consulting Agreement' },
    { value: 'custom', label: 'Custom / Other' },
]

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function ContractLibraryPage() {
    const router = useRouter()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ==========================================================================
    // SECTION 4: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)

    // Template sections
    const [sections, setSections] = useState<TemplateSection[]>([
        {
            id: 'system',
            title: 'System Templates',
            icon: '🌐',
            description: 'Standard templates provided by CLARENCE',
            templates: [],
            isCollapsed: false,
            canEdit: false,
            canDelete: false,
            canUpload: false,
            emptyMessage: 'No system templates available',
            emptySubMessage: 'System templates will appear here when added by CLARENCE'
        },
        {
            id: 'company',
            title: 'Company Templates',
            icon: '🏢',
            description: 'Managed by your Company Administrator',
            templates: [],
            isCollapsed: false,
            canEdit: false,
            canDelete: false,
            canUpload: false,
            emptyMessage: 'No company templates yet',
            emptySubMessage: 'Your administrator can add company-wide templates from the Admin Panel'
        },
        {
            id: 'user',
            title: 'My Templates',
            icon: '👤',
            description: 'Your personal templates from uploads and completed negotiations',
            templates: [],
            isCollapsed: false,
            canEdit: true,
            canDelete: true,
            canUpload: true,
            emptyMessage: 'No templates yet',
            emptySubMessage: 'Upload a contract or save from a completed negotiation'
        }
    ])

    // View state
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')

    // Upload state
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)  // NEW: Background processing state
    const [processingTemplateId, setProcessingTemplateId] = useState<string | null>(null)  // NEW
    const [uploadProgress, setUploadProgress] = useState<string>('')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const [uploadTemplateName, setUploadTemplateName] = useState('')
    const [uploadContractType, setUploadContractType] = useState('custom')

    // Polling ref
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const pollingCountRef = useRef<number>(0)

    // ==========================================================================
    // SECTION 5: AUTHENTICATION & DATA LOADING
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

    const loadTemplates = useCallback(async (user: UserInfo) => {
        try {
            // Fetch all templates in one query, then filter client-side
            const { data, error } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('is_active', true)
                .order('template_name', { ascending: true })

            if (error) {
                console.error('Error loading templates:', error)
                return
            }

            const allTemplates: ContractTemplate[] = (data || []).map(t => ({
                templateId: t.template_id,
                templateCode: t.template_code || '',
                templateName: t.template_name,
                description: t.description || '',
                industry: t.industry,
                contractType: t.contract_type || 'custom',
                clauseCount: t.clause_count || 0,
                version: t.version || 1,
                timesUsed: t.times_used || 0,
                lastUsedAt: t.last_used_at,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
                isSystem: t.is_system || false,
                isPublic: t.is_public || false,
                isActive: t.is_active,
                companyId: t.company_id,
                createdByUserId: t.created_by_user_id,
                sourceSessionId: t.source_session_id
            }))

            // Categorize templates
            const systemTemplates = allTemplates.filter(t => t.isSystem)
            const companyTemplates = allTemplates.filter(t =>
                !t.isSystem &&
                t.isPublic &&
                t.companyId === user.companyId
            )
            const userTemplates = allTemplates.filter(t =>
                !t.isSystem &&
                !t.isPublic &&
                t.createdByUserId === user.userId
            )

            setSections(prev => prev.map(section => {
                if (section.id === 'system') return { ...section, templates: systemTemplates }
                if (section.id === 'company') return { ...section, templates: companyTemplates }
                if (section.id === 'user') return { ...section, templates: userTemplates }
                return section
            }))

        } catch (error) {
            console.error('Error loading templates:', error)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        const init = async () => {
            const user = await loadUserInfo()
            if (user) {
                await loadTemplates(user)
            }
        }
        init()
    }, [loadUserInfo, loadTemplates])

    // ==========================================================================
    // SECTION 6: SIGN OUT
    // ==========================================================================

    async function handleSignOut() {
        try {
            await supabase.auth.signOut()
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        } catch (error) {
            console.error('Sign out error:', error)
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        }
    }

    // ==========================================================================
    // SECTION 7: TEMPLATE ACTIONS
    // ==========================================================================

    const handleUseTemplate = (template: ContractTemplate) => {
        eventLogger.started('contract_library', 'use_template', {
            templateId: template.templateId,
            templateName: template.templateName,
            contractType: template.contractType
        })

        // Navigate to create-contract with pre-filled template data
        const params = new URLSearchParams({
            template_source: 'existing_template',
            source_template_id: template.templateId,
            contract_type: template.contractType,
            template_name: template.templateName
        })

        router.push(`/auth/create-contract?${params.toString()}`)
    }

    const handleViewTemplate = (template: ContractTemplate) => {
        setSelectedTemplate(template)
        setShowTemplateModal(true)
    }

    const handleEditTemplate = (template: ContractTemplate) => {
        // Navigate to template editor (contract-prep in edit mode)
        router.push(`/auth/contract-prep?template_id=${template.templateId}&mode=edit`)
    }

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('contract_templates')
                .update({ is_active: false })
                .eq('template_id', templateId)

            if (error) throw error

            // Refresh templates
            if (userInfo) {
                await loadTemplates(userInfo)
            }

            eventLogger.completed('contract_library', 'delete_template', { templateId })
        } catch (error) {
            console.error('Error deleting template:', error)
            alert('Failed to delete template. Please try again.')
        }
    }

    const toggleSectionCollapse = (sectionId: string) => {
        setSections(prev => prev.map(section =>
            section.id === sectionId
                ? { ...section, isCollapsed: !section.isCollapsed }
                : section
        ))
    }

    // ==========================================================================
    // SECTION 8: FILE UPLOAD HANDLERS
    // ==========================================================================

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0])
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0])
        }
    }

    const handleFileSelect = async (file: File) => {
        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            setUploadError('Please upload a PDF, DOCX, or TXT file')
            return
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File size must be less than 10MB')
            return
        }

        // Set default template name from filename
        const defaultName = file.name.replace(/\.[^/.]+$/, '')
        setUploadTemplateName(defaultName)

        setUploadError(null)
        setIsUploading(true)
        setUploadProgress('Extracting text from document...')

        eventLogger.started('contract_library', 'file_upload_started', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
        })

        try {
            // Step 1: Extract text client-side
            const extractedText = await extractTextFromFile(file)
            setUploadProgress('Processing contract...')

            if (!extractedText || extractedText.length < 100) {
                throw new Error('Could not extract sufficient text from the document')
            }

            // Step 2: Upload to API for processing
            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo?.userId,
                    company_id: userInfo?.companyId,
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    document_text: extractedText,
                    contract_type: uploadContractType,
                    template_name: uploadTemplateName || defaultName,
                    create_as_template: true  // Flag to create as user template
                })
            })

            if (!response.ok) {
                throw new Error('Failed to process contract')
            }

            const result = await response.json()

            if (result.success && result.contractId) {
                setIsUploading(false)

                eventLogger.completed('contract_library', 'file_upload_started', {
                    contractId: result.contractId
                })

                // Start polling for the template to be created
                // The N8N workflow creates it after parsing completes
                startPollingForTemplate(result.contractId)

            } else {
                throw new Error(result.error || 'Upload failed')
            }

        } catch (error) {
            console.error('Upload error:', error)
            setUploadError(error instanceof Error ? error.message : 'Upload failed')
            eventLogger.failed('contract_library', 'file_upload_failed',
                error instanceof Error ? error.message : 'Unknown error'
            )
        } finally {
            setIsUploading(false)
        }
    }

    const extractTextFromFile = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    if (file.type === 'text/plain') {
                        resolve(event.target?.result as string)
                    } else if (file.type === 'application/pdf') {
                        const pdfjsLib = await import('pdfjs-dist')
                        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
                        const arrayBuffer = event.target?.result as ArrayBuffer
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
                        let fullText = ''
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i)
                            const textContent = await page.getTextContent()
                            const pageText = textContent.items.map((item: any) => item.str).join(' ')
                            fullText += pageText + '\n'
                        }
                        resolve(fullText)
                    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                        const mammoth = await import('mammoth')
                        const arrayBuffer = event.target?.result as ArrayBuffer
                        const result = await mammoth.extractRawText({ arrayBuffer })
                        resolve(result.value)
                    } else {
                        reject(new Error('Unsupported file type'))
                    }
                } catch (error) {
                    reject(error)
                }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            if (file.type === 'text/plain') {
                reader.readAsText(file)
            } else {
                reader.readAsArrayBuffer(file)
            }
        })
    }

    // ==========================================================================
    // SECTION 8B: POLL FOR UPLOAD COMPLETION
    // ==========================================================================

    const startPollingForTemplate = (contractId: string) => {
        console.log('Starting to poll for contract completion:', contractId)
        pollingCountRef.current = 0
        setIsProcessing(true)
        setProcessingTemplateId(contractId)
        setUploadProgress('Processing contract clauses... This may take up to a minute.')

        pollingRef.current = setInterval(async () => {
            pollingCountRef.current++
            console.log(`Polling attempt ${pollingCountRef.current} for contract ${contractId}`)

            // Timeout after 2 minutes (40 attempts at 3 second intervals)
            if (pollingCountRef.current > 40) {
                clearInterval(pollingRef.current!)
                pollingRef.current = null
                setIsProcessing(false)
                setUploadError('Processing is taking longer than expected. Please refresh the page in a moment.')
                return
            }

            try {
                // Poll the uploaded_contracts table for status
                const { data: uploadData, error: uploadError } = await supabase
                    .from('uploaded_contracts')
                    .select('contract_id, status, contract_name')
                    .eq('contract_id', contractId)
                    .single()

                if (uploadError) {
                    console.log('Upload record not found:', uploadError.message)
                    return
                }

                console.log('Upload status:', uploadData?.status)

                if (uploadData?.status === 'completed' || uploadData?.status === 'ready') {
                    // Parsing complete! Now check for the template
                    console.log('Upload processing complete, checking for template...')

                    // Give the workflow a moment to create the template record
                    await new Promise(resolve => setTimeout(resolve, 1000))

                    // Refresh templates list
                    if (userInfo) {
                        await loadTemplates(userInfo)
                    }

                    clearInterval(pollingRef.current!)
                    pollingRef.current = null
                    setIsProcessing(false)
                    setUploadProgress('✅ Template created successfully!')

                    // Close modal after brief success message
                    setTimeout(() => {
                        setShowUploadModal(false)
                        // Reset state inline
                        setUploadTemplateName('')
                        setUploadContractType('custom')
                        setUploadProgress('')
                        setUploadError(null)
                        setIsUploading(false)
                        setIsProcessing(false)
                        setProcessingTemplateId(null)
                        setDragActive(false)
                        if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                        }
                        pollingCountRef.current = 0
                    }, 1500)

                } else if (uploadData?.status === 'failed' || uploadData?.status === 'error') {
                    // Processing failed
                    clearInterval(pollingRef.current!)
                    pollingRef.current = null
                    setIsProcessing(false)
                    setUploadError('Failed to process contract. Please try again.')

                } else {
                    // Still processing - update progress message
                    const elapsed = pollingCountRef.current * 3
                    if (elapsed < 15) {
                        setUploadProgress('Extracting text from document...')
                    } else if (elapsed < 30) {
                        setUploadProgress('Analyzing contract structure...')
                    } else if (elapsed < 45) {
                        setUploadProgress('Extracting and categorizing clauses...')
                    } else {
                        setUploadProgress(`Almost done... (${elapsed}s)`)
                    }
                }

            } catch (err) {
                console.error('Polling error:', err)
            }
        }, 3000) // Poll every 3 seconds
    }

    // ==========================================================================
    // SECTION 9: HELPER FUNCTIONS
    // ==========================================================================

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const getContractTypeIcon = (type: string) => {
        return CONTRACT_TYPE_ICONS[type?.toLowerCase()] || '📄'
    }

    const getContractTypeLabel = (type: string) => {
        return CONTRACT_TYPE_LABELS[type?.toLowerCase()] || type || 'Contract'
    }

    const getTotalTemplateCount = () => {
        return sections.reduce((sum, section) => sum + section.templates.length, 0)
    }

    const filterTemplates = (templates: ContractTemplate[]) => {
        if (!searchQuery.trim()) return templates
        const query = searchQuery.toLowerCase()
        return templates.filter(t =>
            t.templateName.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query) ||
            t.contractType?.toLowerCase().includes(query)
        )
    }

    // ==========================================================================
    // SECTION 10: RENDER - UPLOAD CARD
    // ==========================================================================

    const renderUploadCard = () => (
        <div
            onClick={() => setShowUploadModal(true)}
            className="bg-white rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-400 hover:shadow-md transition-all overflow-hidden cursor-pointer group"
        >
            <div className="p-8 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-200 transition-colors">
                    <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                </div>
                <h3 className="font-semibold text-emerald-700 mb-1">Upload Contract</h3>
                <p className="text-sm text-slate-500">
                    PDF, DOCX, or TXT
                </p>
            </div>
        </div>
    )

    // ==========================================================================
    // SECTION 11: RENDER - TEMPLATE CARD
    // ==========================================================================

    const renderTemplateCard = (template: ContractTemplate, section: TemplateSection) => (
        <div
            key={template.templateId}
            className="bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden group"
        >
            {/* Card Header */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-xl">
                            {getContractTypeIcon(template.contractType)}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                                {template.templateName}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {getContractTypeLabel(template.contractType)}
                            </p>
                        </div>
                    </div>
                    {template.isSystem && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Official
                        </span>
                    )}
                </div>
                {template.description && (
                    <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
                )}
            </div>

            {/* Card Stats */}
            <div className="px-5 py-3 bg-slate-50 grid grid-cols-3 gap-2 text-center">
                <div>
                    <div className="text-lg font-semibold text-slate-800">{template.clauseCount || '—'}</div>
                    <div className="text-xs text-slate-500">Clauses</div>
                </div>
                <div>
                    <div className="text-lg font-semibold text-slate-800">{template.timesUsed}</div>
                    <div className="text-xs text-slate-500">Uses</div>
                </div>
                <div>
                    <div className="text-xs font-medium text-slate-600">v{template.version}</div>
                    <div className="text-xs text-slate-500">Version</div>
                </div>
            </div>

            {/* Card Actions */}
            <div className="p-4 flex gap-2">
                <button
                    onClick={() => handleViewTemplate(template)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    Preview
                </button>
                <button
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                    Use Template
                </button>
                {section.canEdit && (
                    <button
                        onClick={() => handleEditTemplate(template)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Edit template"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                )}
                {section.canDelete && (
                    <button
                        onClick={() => handleDeleteTemplate(template.templateId)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete template"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )

    // ==========================================================================
    // SECTION 12: RENDER - SECTION COMPONENT
    // ==========================================================================

    const renderSection = (section: TemplateSection) => {
        const filteredTemplates = filterTemplates(section.templates)
        const isEmpty = filteredTemplates.length === 0 && !section.canUpload

        return (
            <div key={section.id} className="mb-8">
                {/* Section Header */}
                <button
                    onClick={() => toggleSectionCollapse(section.id)}
                    className="w-full flex items-center justify-between p-4 bg-white rounded-t-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{section.icon}</span>
                        <div className="text-left">
                            <h2 className="font-semibold text-slate-800">{section.title}</h2>
                            <p className="text-sm text-slate-500">{section.description}</p>
                        </div>
                        <span className="ml-3 px-2.5 py-0.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                            {section.templates.length}
                        </span>
                    </div>
                    <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${section.isCollapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Section Content */}
                {!section.isCollapsed && (
                    <div className="border border-t-0 border-slate-200 rounded-b-xl bg-slate-50/50 p-6">
                        {isEmpty && !section.canUpload ? (
                            /* Empty State (non-uploadable sections) */
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xl opacity-50">{section.icon}</span>
                                </div>
                                <p className="text-slate-600 font-medium mb-1">{section.emptyMessage}</p>
                                <p className="text-sm text-slate-400 mb-4">{section.emptySubMessage}</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            /* Grid View */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Upload Card for User section */}
                                {section.canUpload && renderUploadCard()}
                                {/* Template Cards */}
                                {filteredTemplates.map(template => renderTemplateCard(template, section))}
                            </div>
                        ) : (
                            /* List View */
                            <>
                                {section.canUpload && (
                                    <button
                                        onClick={() => setShowUploadModal(true)}
                                        className="mb-4 w-full py-3 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-400 rounded-lg text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Upload Contract
                                    </button>
                                )}
                                {filteredTemplates.length > 0 && (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Template</th>
                                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Clauses</th>
                                                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Uses</th>
                                                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredTemplates.map(template => (
                                                    <tr key={template.templateId} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xl">{getContractTypeIcon(template.contractType)}</span>
                                                                <div>
                                                                    <div className="font-medium text-slate-800 text-sm">{template.templateName}</div>
                                                                    {template.description && (
                                                                        <div className="text-xs text-slate-400 truncate max-w-xs">{template.description}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-600">
                                                            {getContractTypeLabel(template.contractType)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-sm text-slate-600">{template.clauseCount || '—'}</td>
                                                        <td className="px-6 py-4 text-center text-sm text-slate-600">{template.timesUsed}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleViewTemplate(template)}
                                                                    className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                                                                >
                                                                    Preview
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUseTemplate(template)}
                                                                    className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                                                                >
                                                                    Use
                                                                </button>
                                                                {section.canEdit && (
                                                                    <button
                                                                        onClick={() => handleEditTemplate(template)}
                                                                        className="text-slate-400 hover:text-emerald-600"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                                {section.canDelete && (
                                                                    <button
                                                                        onClick={() => handleDeleteTemplate(template.templateId)}
                                                                        className="text-slate-400 hover:text-red-600"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {filteredTemplates.length === 0 && section.canUpload && (
                                    <p className="text-center text-slate-400 text-sm py-4">
                                        No templates yet. Upload your first contract above.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // ==========================================================================
    // SECTION 13: RENDER - TEMPLATE PREVIEW MODAL
    // ==========================================================================

    const renderTemplateModal = () => {
        if (!showTemplateModal || !selectedTemplate) return null

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{getContractTypeIcon(selectedTemplate.contractType)}</span>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">{selectedTemplate.templateName}</h2>
                                <p className="text-sm text-slate-500">{getContractTypeLabel(selectedTemplate.contractType)}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-auto p-6">
                        {/* Description */}
                        {selectedTemplate.description && (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">Description</h3>
                                <p className="text-slate-600">{selectedTemplate.description}</p>
                            </div>
                        )}

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-emerald-600">{selectedTemplate.clauseCount || '—'}</div>
                                <div className="text-sm text-slate-500">Clauses included</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-slate-700">{selectedTemplate.timesUsed}</div>
                                <div className="text-sm text-slate-500">Times used</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-slate-700">{formatDate(selectedTemplate.createdAt)}</div>
                                <div className="text-sm text-slate-500">Created</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-slate-700">v{selectedTemplate.version}</div>
                                <div className="text-sm text-slate-500">Version</div>
                            </div>
                        </div>

                        {/* Industry */}
                        {selectedTemplate.industry && (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">Industry</h3>
                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                                    {selectedTemplate.industry}
                                </span>
                            </div>
                        )}

                        {/* System Template Badge */}
                        {selectedTemplate.isSystem && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 text-blue-700">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <span className="font-medium">Official CLARENCE Template</span>
                                </div>
                                <p className="text-sm text-blue-600 mt-1">
                                    This template is maintained by CLARENCE and represents industry best practices.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                setShowTemplateModal(false)
                                handleUseTemplate(selectedTemplate)
                            }}
                            className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                            Use This Template →
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 14: RENDER - UPLOAD MODAL
    // ==========================================================================

    const renderUploadModal = () => {
        if (!showUploadModal) return null

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">Upload Contract</h2>
                        <button
                            onClick={() => {
                                if (!isProcessing) {
                                    setShowUploadModal(false)
                                    setUploadTemplateName('')
                                    setUploadContractType('custom')
                                    setUploadProgress('')
                                    setUploadError(null)
                                    setIsUploading(false)
                                    setIsProcessing(false)
                                    setProcessingTemplateId(null)
                                    setDragActive(false)
                                    pollingCountRef.current = 0
                                }
                            }}
                            disabled={isProcessing}
                            className={`text-slate-400 hover:text-slate-600 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                        {/* Template Name Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Template Name
                            </label>
                            <input
                                type="text"
                                value={uploadTemplateName}
                                onChange={(e) => setUploadTemplateName(e.target.value)}
                                placeholder="e.g., Standard NDA Template"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>

                        {/* Contract Type Select */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Contract Type
                            </label>
                            <select
                                value={uploadContractType}
                                onChange={(e) => setUploadContractType(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            >
                                {CONTRACT_TYPE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Drag & Drop Zone */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => !isUploading && !isProcessing && fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                                ${dragActive
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                                }
                                ${(isUploading || isProcessing) ? 'cursor-not-allowed' : ''}
                            `}
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-emerald-600 font-medium">{uploadProgress}</p>
                                </>
                            ) : isProcessing ? (
                                <>
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                    <p className="text-emerald-700 font-semibold mb-2">Processing Your Contract</p>
                                    <p className="text-emerald-600 text-sm">{uploadProgress}</p>
                                    <p className="text-slate-400 text-xs mt-3">Extracting and categorizing clauses...</p>
                                </>
                            ) : (
                                <>
                                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-600 font-medium mb-1">
                                        {dragActive ? 'Drop your file here' : 'Click to upload or drag and drop'}
                                    </p>
                                    <p className="text-sm text-slate-400">PDF, DOCX, or TXT (max 10MB)</p>
                                </>
                            )}
                        </div>

                        {/* Error Message */}
                        {uploadError && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {uploadError}
                            </div>
                        )}
                    </div>

                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileInputChange}
                        className="hidden"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    />
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 15: MAIN RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 16: HEADER */}
            {/* ================================================================== */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center justify-between h-16">
                        {/* Left side - Logo */}
                        <div className="flex items-center gap-8">
                            <Link href="/auth/contracts-dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">C</span>
                                </div>
                                <span className="font-semibold text-slate-800">CLARENCE</span>
                            </Link>
                            {/* Navigation Links */}
                            <div className="hidden md:flex items-center gap-1">
                                <Link
                                    href="/auth/contracts-dashboard"
                                    className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/auth/contracts"
                                    className="px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg"
                                >
                                    Contract Library
                                </Link>
                                <Link
                                    href="/auth/training"
                                    className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Training
                                </Link>
                            </div>
                        </div>

                        {/* Right side - User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <span className="text-emerald-700 font-medium text-sm">
                                        {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                    </span>
                                </div>
                                <span className="hidden sm:block text-sm">{userInfo?.firstName}</span>
                                <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <div className="font-medium text-slate-800">{userInfo?.firstName} {userInfo?.lastName}</div>
                                        <div className="text-sm text-slate-500">{userInfo?.email}</div>
                                        <div className="text-xs text-slate-400 mt-1">{userInfo?.company}</div>
                                    </div>
                                    <div className="py-2">
                                        <Link
                                            href="/auth/contracts-dashboard"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                            Dashboard
                                        </Link>
                                    </div>
                                    <div className="border-t border-slate-100 pt-2">
                                        <button
                                            onClick={handleSignOut}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 17: MAIN CONTENT */}
            {/* ================================================================== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Page Header - NO New Contract button */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-1">📚 Contract Library</h1>
                    <p className="text-slate-500 text-sm">
                        Browse templates or upload your own contracts
                    </p>
                </div>

                {/* Search & View Toggle */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-64"
                            />
                        </div>
                        <span className="text-sm text-slate-500">
                            {getTotalTemplateCount()} template{getTotalTemplateCount() !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    /* Template Sections */
                    <div>
                        {sections.map(section => renderSection(section))}
                    </div>
                )}
            </div>

            {/* Template Preview Modal */}
            {renderTemplateModal()}

            {/* Upload Modal */}
            {renderUploadModal()}

            {/* Click outside to close user menu */}
            {showUserMenu && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowUserMenu(false)}
                />
            )}
        </div>
    )
}