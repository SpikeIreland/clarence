'use client'

// ============================================================================
// CLARENCE CONTRACT LIBRARY PAGE - WP6 + TEMPLATE UPLOAD
// ============================================================================
// File: /app/auth/contracts/page.tsx
// Purpose: Template library for reusable contract configurations
// 
// WP6 CHANGES:
// 1. Renamed from "Contract Studio" to "Contract Library"
// 2. Three sections: System Templates, Company Templates, My Templates
// 3. Data source changed from uploaded_contracts to contract_templates
// 4. "Use Template" now pre-fills Create Contract flow
// 5. Proper empty states for each section
// 6. Upload moved to "My Templates" section
//
// TEMPLATE UPLOAD ADDITIONS (Feb 2026):
// 7. "Add Template" button in My Templates section header
// 8. Upload modal with file picker (PDF, DOCX, TXT)
// 9. Client-side text extraction (PDF.js, Mammoth, FileReader)
// 10. Sends extracted text to N8N Parse Workflow (1.5) with create_as_template
// 11. Progress feedback and auto-refresh on success
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'

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
    emptyMessage: string
    emptySubMessage: string
}

// Upload progress stages
type UploadStage = 'idle' | 'selecting' | 'extracting' | 'parsing' | 'complete' | 'error'

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_ICONS: Record<string, string> = {
    'bpo': 'B',
    'saas': 'S',
    'nda': 'N',
    'msa': 'M',
    'employment': 'E',
    'it_services': 'IT',
    'consulting': 'C',
    'custom': 'D',
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
    { value: 'bpo', label: 'BPO / Outsourcing' },
    { value: 'saas', label: 'SaaS Agreement' },
    { value: 'nda', label: 'Non-Disclosure Agreement' },
    { value: 'msa', label: 'Master Service Agreement' },
    { value: 'employment', label: 'Employment Contract' },
    { value: 'it_services', label: 'IT Services' },
    { value: 'consulting', label: 'Consulting Agreement' },
    { value: 'custom', label: 'Other / Custom' },
]

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.doc,.txt'
const MAX_FILE_SIZE_MB = 25

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
            icon: 'SYS',
            description: 'Standard templates provided by CLARENCE',
            templates: [],
            isCollapsed: false,
            canEdit: false,
            canDelete: false,
            emptyMessage: 'No system templates available',
            emptySubMessage: 'System templates will appear here when added by CLARENCE'
        },
        {
            id: 'company',
            title: 'Company Templates',
            icon: 'CO',
            description: 'Managed by your Company Administrator',
            templates: [],
            isCollapsed: false,
            canEdit: false,
            canDelete: false,
            emptyMessage: 'No company templates yet',
            emptySubMessage: 'Your administrator can add company-wide templates from the Admin Panel'
        },
        {
            id: 'user',
            title: 'My Templates',
            icon: 'MY',
            description: 'Created from your negotiations or uploaded documents',
            templates: [],
            isCollapsed: false,
            canEdit: true,
            canDelete: true,
            emptyMessage: 'No templates yet',
            emptySubMessage: 'Upload a contract document or save a completed negotiation as a template'
        }
    ])

    // View state
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')

    // ==========================================================================
    // SECTION 4B: UPLOAD STATE
    // ==========================================================================

    const [showUploadModal, setShowUploadModal] = useState(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [uploadTemplateName, setUploadTemplateName] = useState('')
    const [uploadContractType, setUploadContractType] = useState('custom')
    const [uploadStage, setUploadStage] = useState<UploadStage>('idle')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadResult, setUploadResult] = useState<{ clauseCount?: number; templateName?: string } | null>(null)

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

        // Navigate to Quick Contract Create with pre-filled template data
        const params = new URLSearchParams({
            source: 'template',
            source_template_id: template.templateId,
            contract_type: template.contractType,
            template_name: template.templateName
        })

        router.push(`/auth/quick-contract/create?${params.toString()}`)
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
    // SECTION 7B: UPLOAD FUNCTIONS
    // ==========================================================================

    /** Reset upload state to initial values */
    const resetUpload = () => {
        setUploadFile(null)
        setUploadTemplateName('')
        setUploadContractType('custom')
        setUploadStage('idle')
        setUploadError(null)
        setUploadResult(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    /** Open the upload modal */
    const openUploadModal = () => {
        resetUpload()
        setShowUploadModal(true)
        setUploadStage('selecting')
    }

    /** Close the upload modal */
    const closeUploadModal = () => {
        setShowUploadModal(false)
        resetUpload()
    }

    /** Handle file selection from the file picker */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file size
        const fileSizeMB = file.size / (1024 * 1024)
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
            setUploadError(`File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
            return
        }

        // Validate file type
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['pdf', 'docx', 'doc', 'txt'].includes(ext || '')) {
            setUploadError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
            return
        }

        setUploadFile(file)
        setUploadError(null)

        // Auto-fill template name from filename (strip extension)
        if (!uploadTemplateName) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
            setUploadTemplateName(nameWithoutExt)
        }
    }

    /** Handle file drop on the drop zone */
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const file = e.dataTransfer.files?.[0]
        if (!file) return

        // Create a synthetic event to reuse validation logic
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (!['pdf', 'docx', 'doc', 'txt'].includes(ext || '')) {
            setUploadError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.')
            return
        }

        const fileSizeMB = file.size / (1024 * 1024)
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
            setUploadError(`File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`)
            return
        }

        setUploadFile(file)
        setUploadError(null)

        if (!uploadTemplateName) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
            setUploadTemplateName(nameWithoutExt)
        }
    }

    /** Extract text content from the selected file */
    const extractTextFromFile = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()?.toLowerCase()

        // ----- TXT files -----
        if (ext === 'txt') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = () => reject(new Error('Failed to read text file'))
                reader.readAsText(file)
            })
        }

        // ----- PDF files -----
        if (ext === 'pdf') {
            const pdfjsLib = await import('pdfjs-dist')

            // Set up worker - use CDN matching installed version
            if (typeof window !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
            }

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

            let fullText = ''
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const textContent = await page.getTextContent()
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                fullText += pageText + '\n'
            }

            return fullText.trim()
        }

        // ----- DOCX files -----
        if (ext === 'docx' || ext === 'doc') {
            const mammoth = await import('mammoth')
            const arrayBuffer = await file.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer })
            return result.value.trim()
        }

        throw new Error(`Unsupported file type: .${ext}`)
    }

    /** Submit the upload: extract text, then send to N8N parse workflow */
    const handleUploadSubmit = async () => {
        if (!uploadFile || !uploadTemplateName.trim()) {
            setUploadError('Please select a file and enter a template name.')
            return
        }

        if (!userInfo?.userId) {
            setUploadError('Not authenticated. Please sign in again.')
            return
        }

        try {
            // Stage 1: Extract text
            setUploadStage('extracting')
            setUploadError(null)

            console.log('Extracting text from:', uploadFile.name)
            const extractedText = await extractTextFromFile(uploadFile)

            if (!extractedText || extractedText.length < 100) {
                setUploadError('Could not extract sufficient text from the document. Please ensure the file contains readable text (not just scanned images).')
                setUploadStage('error')
                return
            }

            console.log(`Extracted ${extractedText.length} characters from document`)

            // Stage 2: Send to N8N Parse Workflow
            setUploadStage('parsing')

            const payload = {
                // Document data
                document_text: extractedText,
                file_name: uploadFile.name,
                file_type: uploadFile.name.split('.').pop()?.toLowerCase() || 'pdf',
                file_size: uploadFile.size,

                // Template configuration
                create_as_template: true,
                template_name: uploadTemplateName.trim(),
                contract_type: uploadContractType,
                is_company_template: false,

                // User context
                user_id: userInfo.userId,
                company_id: userInfo.companyId || null,

                // No session context (this is a standalone template upload)
                session_id: null,
                contract_id: null,
            }

            console.log('Sending to parse workflow:', {
                fileName: payload.file_name,
                textLength: payload.document_text.length,
                templateName: payload.template_name,
                contractType: payload.contract_type,
            })

            eventLogger.started('contract_library', 'upload_template', {
                fileName: uploadFile.name,
                templateName: uploadTemplateName.trim(),
                contractType: uploadContractType,
                fileSize: uploadFile.size
            })

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const result = await response.json()

            if (!response.ok || result.success === false) {
                throw new Error(result.error || result.message || 'Failed to parse contract document')
            }

            console.log('Parse result:', result)

            // Stage 3: Wait for parsing to complete, then redirect
            const returnedContractId = result.contractId || result.contract_id

            if (returnedContractId) {
                // If status is 'processing', poll until ready
                if (result.status === 'processing') {
                    console.log('Contract processing, polling for completion...')
                    setUploadStage('parsing')  // Keep showing "Parsing Contract..." during polling

                    const maxAttempts = 60  // 2 minutes max
                    let attempts = 0

                    const pollForReady = async (): Promise<boolean> => {
                        const { data, error } = await supabase
                            .from('uploaded_contracts')
                            .select('status, clause_count')
                            .eq('contract_id', returnedContractId)
                            .single()

                        if (error) {
                            console.error('Polling error:', error)
                            return false
                        }

                        console.log(`Poll attempt ${attempts + 1}: status=${data.status}, clauses=${data.clause_count}`)

                        if (data.status === 'ready' && data.clause_count > 0) {
                            return true
                        }
                        if (data.status === 'failed') {
                            throw new Error('Document parsing failed')
                        }
                        return false
                    }

                    while (attempts < maxAttempts) {
                        const isReady = await pollForReady()
                        if (isReady) {
                            console.log('Contract ready, redirecting to Studio...')
                            router.push(`/auth/quick-contract/studio/${returnedContractId}?mode=template`)
                            return
                        }
                        attempts++
                        await new Promise(resolve => setTimeout(resolve, 2000))  // Wait 2 seconds
                    }

                    // Timeout - redirect anyway, Studio will handle it
                    console.warn('Polling timeout, redirecting anyway...')
                    router.push(`/auth/quick-contract/studio/${returnedContractId}?mode=template`)
                    return
                }

                // Already ready, redirect immediately
                router.push(`/auth/quick-contract/studio/${returnedContractId}?mode=template`)
                return
            }

            // Fallback: if no contractId returned, show old complete state
            setUploadStage('complete')
            setUploadResult({
                clauseCount: result.clauseCount || result.clause_count || 0,
                templateName: uploadTemplateName.trim()
            })

            eventLogger.completed('contract_library', 'upload_template', {
                templateName: uploadTemplateName.trim(),
                clauseCount: result.clauseCount || result.clause_count || 0,
                contractType: uploadContractType
            })

            // Refresh templates list
            if (userInfo) {
                await loadTemplates(userInfo)
            }

        } catch (error) {
            console.error('Upload error:', error)
            setUploadStage('error')
            setUploadError(
                error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred. Please try again.'
            )

            eventLogger.failed('contract_library', 'upload_template',
                error instanceof Error ? error.message : 'Unknown error',
                'UPLOAD_FAILED'
            )
        }
    }

    // ==========================================================================
    // SECTION 8: HELPER FUNCTIONS
    // ==========================================================================

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const getContractTypeIcon = (type: string) => {
        return CONTRACT_TYPE_ICONS[type?.toLowerCase()] || 'D'
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

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // ==========================================================================
    // SECTION 9: RENDER - TEMPLATE CARD
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
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-emerald-700">{getContractTypeIcon(template.contractType)}</span>
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
                    <div className="text-lg font-semibold text-slate-800">{template.clauseCount || '-'}</div>
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
    // SECTION 10: RENDER - SECTION COMPONENT
    // ==========================================================================

    const renderSection = (section: TemplateSection) => {
        const filteredTemplates = filterTemplates(section.templates)
        const isEmpty = filteredTemplates.length === 0

        return (
            <div key={section.id} className="mb-8">
                {/* Section Header */}
                <div className="flex items-center gap-2">
                    {/* Collapsible header button - takes most of the width */}
                    <button
                        onClick={() => toggleSectionCollapse(section.id)}
                        className="flex-1 flex items-center justify-between p-4 bg-white rounded-t-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <span className="text-xs font-bold text-emerald-700">{section.icon}</span>
                            </div>
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

                    {/* ADD TEMPLATE button - only for My Templates section */}
                    {section.id === 'user' && (
                        <button
                            onClick={openUploadModal}
                            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap self-stretch"
                            title="Upload a contract to create a template"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Template
                        </button>
                    )}
                </div>

                {/* Section Content */}
                {!section.isCollapsed && (
                    <div className={`border border-t-0 border-slate-200 rounded-b-xl bg-slate-50/50 p-6 ${section.id === 'user' ? '' : ''}`}>
                        {isEmpty ? (
                            /* Empty State */
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xs font-bold text-slate-400">{section.icon}</span>
                                </div>
                                <p className="text-slate-600 font-medium mb-1">{section.emptyMessage}</p>
                                <p className="text-sm text-slate-400 mb-4">{section.emptySubMessage}</p>
                                {section.id === 'user' && (
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button
                                            onClick={openUploadModal}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload Contract
                                        </button>
                                        <Link
                                            href="/auth/contracts-dashboard"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Or start from a System Template                                         </Link>
                                    </div>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            /* Grid View */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTemplates.map(template => renderTemplateCard(template, section))}
                            </div>
                        ) : (
                            /* List View */
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
                                                        <span className="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center text-xs font-bold text-emerald-700">{getContractTypeIcon(template.contractType)}</span>
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
                                                <td className="px-6 py-4 text-center text-sm text-slate-600">{template.clauseCount || '-'}</td>
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
                    </div>
                )}
            </div>
        )
    }

    // ==========================================================================
    // SECTION 11: RENDER - TEMPLATE PREVIEW MODAL
    // ==========================================================================

    const renderTemplateModal = () => {
        if (!showTemplateModal || !selectedTemplate) return null

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-sm font-bold text-emerald-700">{getContractTypeIcon(selectedTemplate.contractType)}</span>
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
                                <div className="text-2xl font-bold text-emerald-600">{selectedTemplate.clauseCount || '-'}</div>
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
                            Use This Template                         </button>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 11B: RENDER - UPLOAD MODAL
    // ==========================================================================

    const renderUploadModal = () => {
        if (!showUploadModal) return null

        const isProcessing = uploadStage === 'extracting' || uploadStage === 'parsing'
        const isComplete = uploadStage === 'complete'
        const isError = uploadStage === 'error'

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">

                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">Add Template</h2>
                                <p className="text-sm text-slate-500">Upload a contract document to create a reusable template</p>
                            </div>
                        </div>
                        {!isProcessing && (
                            <button
                                onClick={closeUploadModal}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">

                        {/* ---- SUCCESS STATE ---- */}
                        {isComplete && uploadResult && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Template Created!</h3>
                                <p className="text-slate-600 mb-1">
                                    <strong>{uploadResult.templateName}</strong>
                                </p>
                                <p className="text-sm text-slate-500 mb-6">
                                    {uploadResult.clauseCount} clause{uploadResult.clauseCount !== 1 ? 's' : ''} extracted and saved
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={closeUploadModal}
                                        className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        Done
                                    </button>
                                    <button
                                        onClick={() => {
                                            closeUploadModal()
                                            openUploadModal()
                                        }}
                                        className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                                    >
                                        Upload Another
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ---- PROCESSING STATE ---- */}
                        {isProcessing && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto mb-4 relative">
                                    <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                    {uploadStage === 'extracting' ? 'Extracting Text...' : 'Parsing Contract...'}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {uploadStage === 'extracting'
                                        ? 'Reading the document and extracting text content'
                                        : 'CLARENCE is analysing the contract and identifying clauses'
                                    }
                                </p>

                                {/* Progress Steps */}
                                <div className="mt-6 flex justify-center gap-2">
                                    <div className={`flex items-center gap-1.5 text-xs font-medium ${uploadStage === 'extracting' ? 'text-emerald-600' : 'text-emerald-600'}`}>
                                        <div className={`w-2 h-2 rounded-full ${uploadStage === 'extracting' ? 'bg-emerald-600 animate-pulse' : 'bg-emerald-600'}`}></div>
                                        Extract
                                    </div>
                                    <div className="w-6 h-px bg-slate-300 self-center"></div>
                                    <div className={`flex items-center gap-1.5 text-xs font-medium ${uploadStage === 'parsing' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        <div className={`w-2 h-2 rounded-full ${uploadStage === 'parsing' ? 'bg-emerald-600 animate-pulse' : 'bg-slate-300'}`}></div>
                                        Parse
                                    </div>
                                    <div className="w-6 h-px bg-slate-300 self-center"></div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                        Save
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ---- INPUT STATE (selecting file & details) ---- */}
                        {(uploadStage === 'selecting' || uploadStage === 'idle') && (
                            <>
                                {/* File Drop Zone */}
                                <div
                                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${uploadFile
                                        ? 'border-emerald-300 bg-emerald-50'
                                        : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                                        }`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                                    onDrop={handleFileDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ACCEPTED_FILE_TYPES}
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    {uploadFile ? (
                                        /* File Selected */
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium text-slate-800 text-sm">{uploadFile.name}</p>
                                                <p className="text-xs text-slate-500">{formatFileSize(uploadFile.size)}</p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setUploadFile(null)
                                                    if (fileInputRef.current) fileInputRef.current.value = ''
                                                }}
                                                className="ml-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        /* No File Yet */
                                        <>
                                            <svg className="w-10 h-10 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <p className="text-sm font-medium text-slate-700 mb-1">
                                                Click to upload or drag and drop
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                PDF, DOCX, or TXT (max {MAX_FILE_SIZE_MB}MB)
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Template Name */}
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Template Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadTemplateName}
                                        onChange={(e) => setUploadTemplateName(e.target.value)}
                                        placeholder="e.g. Master Services Agreement - Acme Corp"
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Contract Type */}
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Contract Type
                                    </label>
                                    <select
                                        value={uploadContractType}
                                        onChange={(e) => setUploadContractType(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                                    >
                                        {CONTRACT_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400 mt-1">
                                        CLARENCE will also attempt to detect the contract type automatically
                                    </p>
                                </div>

                                {/* Error Message */}
                                {(uploadError || isError) && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-sm text-red-700">{uploadError}</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ---- ERROR STATE (after failed processing) ---- */}
                        {isError && uploadStage === 'error' && !uploadError && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload Failed</h3>
                                <p className="text-sm text-slate-500 mb-6">Something went wrong. Please try again.</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer - only show for input/error states */}
                    {(uploadStage === 'selecting' || uploadStage === 'idle' || uploadStage === 'error') && !isComplete && (
                        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={closeUploadModal}
                                className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadSubmit}
                                disabled={!uploadFile || !uploadTemplateName.trim()}
                                className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploadStage === 'error' ? 'Try Again' : 'Upload & Parse'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 12: MAIN RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 13: HEADER */}
            {/* ================================================================== */}
            <AuthenticatedHeader
                activePage="contracts"
                userInfo={userInfo}
                onSignOut={handleSignOut}
            />

            {/* ================================================================== */}
            {/* SECTION 14: MAIN CONTENT */}
            {/* ================================================================== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Contract Library</h1>
                        <p className="text-slate-500 text-sm">
                            Browse and use templates to start new negotiations
                        </p>
                    </div>
                    <Link
                        href="/auth/create-contract"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Contract
                    </Link>
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

            {/* ================================================================== */}
            {/* SECTION 15: MODALS */}
            {/* ================================================================== */}

            {/* Template Preview Modal */}
            {renderTemplateModal()}

            {/* Upload Template Modal */}
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