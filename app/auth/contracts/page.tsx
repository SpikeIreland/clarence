'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: string
    userId?: string
}

interface ContractTemplate {
    templateId: string
    templateName: string
    description: string
    fileName: string
    fileType: string
    fileSize: number
    status: 'uploading' | 'processing' | 'ready' | 'failed'
    clauseCount: number
    uploadedAt: string
    processedAt: string | null
    lastUsedAt: string | null
    usageCount: number
    // Parsing details
    detectedStyle: string | null
    parsingNotes: string | null
}

interface ParsedClause {
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    content: string
    verified: boolean
    aiSuggestion: string | null
}

// ============================================================================
// SECTION 3: CONSTANTS
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

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function ContractStudioPage() {
    const router = useRouter()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ==========================================================================
    // SECTION 5: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [templates, setTemplates] = useState<ContractTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [showUserMenu, setShowUserMenu] = useState(false)

    // Upload state
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)

    // View state
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
    const [parsedClauses, setParsedClauses] = useState<ParsedClause[]>([])
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    // ==========================================================================
    // SECTION 6: AUTHENTICATION & DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return
        }

        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
    }, [router])

    const loadTemplates = useCallback(async () => {
        try {
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) return

            const authData = JSON.parse(auth)

            // Fetch from uploaded_contracts table (separate from clause template packs)
            const { data, error } = await supabase
                .from('uploaded_contracts')
                .select('*')
                .eq('company_id', authData.userInfo?.companyId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error loading uploaded contracts:', error)
                // If table doesn't exist yet, just set empty array
                setTemplates([])
            } else {
                const mappedTemplates: ContractTemplate[] = (data || []).map(t => ({
                    templateId: t.contract_id,
                    templateName: t.contract_name,
                    description: t.description || '',
                    fileName: t.file_name,
                    fileType: t.file_type,
                    fileSize: t.file_size,
                    status: t.status,
                    clauseCount: t.clause_count || 0,
                    uploadedAt: t.created_at,
                    processedAt: t.processed_at,
                    lastUsedAt: t.last_used_at,
                    usageCount: t.usage_count || 0,
                    detectedStyle: t.detected_style,
                    parsingNotes: t.parsing_notes
                }))
                setTemplates(mappedTemplates)
            }
        } catch (error) {
            console.error('Error loading templates:', error)
            setTemplates([])
        } finally {
            setLoading(false)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 7: SIGN OUT
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

        setUploadError(null)
        setIsUploading(true)
        setUploadProgress(10)

        eventLogger.started('contract_studio', 'file_upload_started', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
        })

        try {
            // Step 1: Extract text client-side
            setUploadProgress(20)
            const extractedText = await extractTextFromFile(file)
            setUploadProgress(40)

            // Step 2: Upload to API for processing
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) throw new Error('Not authenticated')

            const authData = JSON.parse(auth)

            const formData = new FormData()
            formData.append('file', file)
            formData.append('extractedText', extractedText)
            formData.append('userId', authData.userInfo?.userId || '')
            formData.append('companyId', authData.userInfo?.companyId || '')
            formData.append('templateName', file.name.replace(/\.[^/.]+$/, ''))

            setUploadProgress(60)

            // TODO: Replace with actual API endpoint
            const response = await fetch(`${API_BASE}/contract-template-upload`, {
                method: 'POST',
                body: formData
            })

            setUploadProgress(80)

            if (!response.ok) {
                throw new Error('Upload failed')
            }

            const result = await response.json()
            setUploadProgress(100)

            eventLogger.completed('contract_studio', 'file_upload_completed', {
                templateId: result.templateId
            })

            // Refresh templates list
            await loadTemplates()
            setShowUploadModal(false)

        } catch (error) {
            console.error('Upload error:', error)
            setUploadError('Failed to upload file. Please try again.')
            eventLogger.failed('contract_studio', 'file_upload_failed',
                error instanceof Error ? error.message : 'Unknown error',
                'UPLOAD_ERROR'
            )
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
        }
    }

    // ==========================================================================
    // SECTION 9: TEXT EXTRACTION (Client-side)
    // ==========================================================================

    async function extractTextFromFile(file: File): Promise<string> {
        if (file.type === 'text/plain') {
            return await file.text()
        }

        if (file.type === 'application/pdf') {
            // Use pdf.js for PDF extraction
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = ''

            const arrayBuffer = await file.arrayBuffer()
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
            const pdf = await loadingTask.promise

            let fullText = ''
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum)
                const textContent = await page.getTextContent()
                const pageText = textContent.items
                    .map((item: unknown) => ('str' in (item as Record<string, unknown>) ? (item as Record<string, string>).str : ''))
                    .join(' ')
                fullText += pageText + '\n\n'
            }
            return fullText.trim()
        }

        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Use mammoth for DOCX extraction
            const mammoth = await import('mammoth')
            const arrayBuffer = await file.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer })
            return result.value
        }

        throw new Error('Unsupported file type')
    }

    // ==========================================================================
    // SECTION 10: TEMPLATE ACTIONS
    // ==========================================================================

    const handleViewTemplate = async (template: ContractTemplate) => {
        setSelectedTemplate(template)

        // Load parsed clauses for this uploaded contract
        try {
            const { data, error } = await supabase
                .from('uploaded_contract_clauses')
                .select('*')
                .eq('contract_id', template.templateId)
                .order('display_order', { ascending: true })

            if (error) {
                console.error('Error loading clauses:', error)
                setParsedClauses([])
            } else {
                const mapped: ParsedClause[] = (data || []).map(c => ({
                    clauseId: c.clause_id,
                    clauseNumber: c.clause_number,
                    clauseName: c.clause_name,
                    category: c.category,
                    content: c.content,
                    verified: c.verified,
                    aiSuggestion: c.ai_suggestion
                }))
                setParsedClauses(mapped)
            }
        } catch (error) {
            console.error('Error loading clauses:', error)
            setParsedClauses([])
        }
    }

    const handleUseTemplate = (template: ContractTemplate) => {
        // Navigate to create new session with this template
        router.push(`/auth/clause-builder?template_id=${template.templateId}`)
    }

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return

        try {
            const { error } = await supabase
                .from('uploaded_contracts')
                .delete()
                .eq('contract_id', templateId)

            if (error) throw error

            // Refresh list
            await loadTemplates()

            if (selectedTemplate?.templateId === templateId) {
                setSelectedTemplate(null)
                setParsedClauses([])
            }
        } catch (error) {
            console.error('Delete error:', error)
            alert('Failed to delete template')
        }
    }

    // ==========================================================================
    // SECTION 11: EFFECTS
    // ==========================================================================

    useEffect(() => {
        loadUserInfo()
        loadTemplates()
    }, [loadUserInfo, loadTemplates])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Element
            if (showUserMenu && !target.closest('.user-menu-container')) {
                setShowUserMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showUserMenu])

    // ==========================================================================
    // SECTION 12: HELPER FUNCTIONS
    // ==========================================================================

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    function getStatusBadge(status: string) {
        const badges: Record<string, { text: string; className: string }> = {
            'uploading': { text: 'Uploading', className: 'bg-blue-100 text-blue-700' },
            'processing': { text: 'Processing', className: 'bg-amber-100 text-amber-700' },
            'ready': { text: 'Ready', className: 'bg-emerald-100 text-emerald-700' },
            'failed': { text: 'Failed', className: 'bg-red-100 text-red-700' }
        }
        return badges[status] || { text: status, className: 'bg-slate-100 text-slate-700' }
    }

    // ==========================================================================
    // SECTION 13: RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 14: NAVIGATION HEADER */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo & Brand */}
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">The Honest Broker</div>
                            </div>
                        </Link>

                        {/* Center: Navigation Links */}
                        <div className="hidden md:flex items-center gap-6">
                            <Link
                                href="/contracts-dashboard"
                                className="text-slate-400 hover:text-white font-medium text-sm transition-colors"
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/contracts"
                                className="text-white font-medium text-sm border-b-2 border-blue-500 pb-1"
                            >
                                Contract Studio
                            </Link>
                        </div>

                        {/* Right: User Menu */}
                        <div className="flex items-center gap-4">
                            {/* Notifications */}
                            <button className="p-2 text-slate-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </button>

                            {/* User Dropdown */}
                            <div className="relative user-menu-container">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                >
                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                        {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
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
                                                href="/contracts-dashboard"
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
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 15: MAIN CONTENT */}
            {/* ================================================================== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Contract Studio</h1>
                        <p className="text-slate-500 text-sm">
                            Upload and prepare your contracts for negotiation
                        </p>
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload Contract
                    </button>
                </div>

                {/* ================================================================ */}
                {/* SECTION 16: VIEW TOGGLE & FILTERS */}
                {/* ================================================================ */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">
                            {templates.length} template{templates.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ================================================================ */}
                {/* SECTION 17: TEMPLATES DISPLAY */}
                {/* ================================================================ */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : templates.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-slate-800">No contract templates yet</h3>
                        <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">
                            Upload your first contract to get started. CLARENCE will help you parse and categorize the clauses for use in negotiations.
                        </p>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium text-sm flex items-center gap-2 mx-auto transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload Your First Contract
                        </button>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(template => {
                            const status = getStatusBadge(template.status)
                            return (
                                <div
                                    key={template.templateId}
                                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden"
                                >
                                    {/* Card Header */}
                                    <div className="p-5 border-b border-slate-100">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800 text-sm">{template.templateName}</h3>
                                                    <p className="text-xs text-slate-400">{FILE_TYPE_LABELS[template.fileType] || 'Document'} • {formatFileSize(template.fileSize)}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                                                {status.text}
                                            </span>
                                        </div>
                                        {template.description && (
                                            <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
                                        )}
                                    </div>

                                    {/* Card Stats */}
                                    <div className="px-5 py-3 bg-slate-50 grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <div className="text-lg font-semibold text-slate-800">{template.clauseCount}</div>
                                            <div className="text-xs text-slate-500">Clauses</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold text-slate-800">{template.usageCount}</div>
                                            <div className="text-xs text-slate-500">Uses</div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-medium text-slate-600">{formatDate(template.uploadedAt)}</div>
                                            <div className="text-xs text-slate-500">Uploaded</div>
                                        </div>
                                    </div>

                                    {/* Card Actions */}
                                    <div className="p-4 flex gap-2">
                                        <button
                                            onClick={() => handleViewTemplate(template)}
                                            className="flex-1 py-2 px-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleUseTemplate(template)}
                                            disabled={template.status !== 'ready'}
                                            className="flex-1 py-2 px-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Use Template
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTemplate(template.templateId)}
                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    /* List View */
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Template</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Clauses</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Uses</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Uploaded</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {templates.map(template => {
                                    const status = getStatusBadge(template.status)
                                    return (
                                        <tr key={template.templateId} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-800 text-sm">{template.templateName}</div>
                                                        <div className="text-xs text-slate-400">{FILE_TYPE_LABELS[template.fileType]} • {formatFileSize(template.fileSize)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                                                    {status.text}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-slate-600">{template.clauseCount}</td>
                                            <td className="px-6 py-4 text-center text-sm text-slate-600">{template.usageCount}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{formatDate(template.uploadedAt)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewTemplate(template)}
                                                        className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => handleUseTemplate(template)}
                                                        disabled={template.status !== 'ready'}
                                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                                                    >
                                                        Use
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTemplate(template.templateId)}
                                                        className="text-slate-400 hover:text-red-600"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ================================================================== */}
            {/* SECTION 18: UPLOAD MODAL */}
            {/* ================================================================== */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-800">Upload Contract</h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false)
                                    setUploadError(null)
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {/* Drop Zone */}
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-300 hover:border-slate-400'
                                    } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                                onClick={() => !isUploading && fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />

                                {isUploading ? (
                                    <div>
                                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-slate-600 mb-2">Processing contract...</p>
                                        <div className="w-full bg-slate-200 rounded-full h-2 max-w-xs mx-auto">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </div>
                                        <p className="text-slate-700 font-medium mb-1">
                                            Drop your contract here, or click to browse
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Supports PDF, DOCX, and TXT files up to 10MB
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Error Message */}
                            {uploadError && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {uploadError}
                                </div>
                            )}

                            {/* Info */}
                            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                <h4 className="font-medium text-slate-700 text-sm mb-2">What happens next?</h4>
                                <ul className="text-sm text-slate-500 space-y-1">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">1.</span>
                                        CLARENCE extracts the text from your document
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">2.</span>
                                        AI identifies and categorizes each clause
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">3.</span>
                                        You review and verify the parsed clauses
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">4.</span>
                                        Template is ready for use in negotiations
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================== */}
            {/* SECTION 19: TEMPLATE DETAIL MODAL */}
            {/* ================================================================== */}
            {selectedTemplate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">{selectedTemplate.templateName}</h2>
                                <p className="text-sm text-slate-500">{selectedTemplate.clauseCount} clauses • {FILE_TYPE_LABELS[selectedTemplate.fileType]}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedTemplate(null)
                                    setParsedClauses([])
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {parsedClauses.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <p>No clauses found for this template.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {parsedClauses.map((clause, index) => (
                                        <div
                                            key={clause.clauseId}
                                            className={`border rounded-lg p-4 ${clause.verified ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <span className="text-sm font-medium text-slate-400 mr-2">{clause.clauseNumber}</span>
                                                    <span className="font-semibold text-slate-800">{clause.clauseName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                                                        {clause.category}
                                                    </span>
                                                    {clause.verified && (
                                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Verified
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 line-clamp-3">{clause.content}</p>
                                            {clause.aiSuggestion && (
                                                <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                                                    💡 {clause.aiSuggestion}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setSelectedTemplate(null)
                                    setParsedClauses([])
                                }}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium text-sm transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleUseTemplate(selectedTemplate)}
                                disabled={selectedTemplate.status !== 'ready'}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                            >
                                Use This Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}