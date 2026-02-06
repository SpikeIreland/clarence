'use client'
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface UserInfo {
    userId: string
    email: string
    firstName?: string
    lastName?: string
    company?: string
    companyId?: string
    role?: string
}

interface CompanyUser {
    id: string
    userId?: string
    email: string
    fullName: string
    role: 'admin' | 'manager' | 'user' | 'viewer'
    status: 'invited' | 'active' | 'suspended' | 'removed'
    invitedAt: string
    lastActiveAt?: string
}

interface TrainingUser {
    id: string
    userId?: string
    email: string
    fullName: string
    approvalType: 'training_partner' | 'training_admin' | 'ai_enabled'
    status: 'pending' | 'active' | 'suspended' | 'expired'
    invitedAt: string
    approvedAt?: string
    sessionsCompleted: number
    invitationSent: boolean
}

interface Playbook {
    playbookId: string
    playbookName: string
    playbookVersion?: string
    playbookDescription?: string
    playbookSummary?: string
    status: 'pending_parse' | 'parsing' | 'parsed' | 'review_required' | 'active' | 'inactive' | 'superseded' | 'parse_failed'
    isActive: boolean
    sourceFileName?: string
    sourceFilePath?: string
    rulesExtracted: number
    aiConfidenceScore?: number
    effectiveDate?: string
    expiryDate?: string
    createdAt: string
    createdBy?: string
    parsingError?: string
}

// NEW: Company Template interface
interface CompanyTemplate {
    templateId: string
    templateCode: string
    templateName: string
    description: string
    contractType: string
    industry: string | null
    clauseCount: number
    version: number
    timesUsed: number
    isActive: boolean
    status: 'processing' | 'ready' | 'failed'
    createdAt: string
    createdBy?: string
    sourceFileName?: string
}

// UPDATED: Added 'templates' to AdminTab
type AdminTab = 'playbooks' | 'templates' | 'training' | 'users' | 'audit'

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_OPTIONS = [
    { value: 'bpo', label: 'BPO / Outsourcing' },
    { value: 'saas', label: 'SaaS Agreement' },
    { value: 'nda', label: 'NDA' },
    { value: 'msa', label: 'Master Service Agreement' },
    { value: 'employment', label: 'Employment Contract' },
    { value: 'it_services', label: 'IT Services' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'custom', label: 'Custom / Other' },
]

const CONTRACT_TYPE_ICONS: Record<string, string> = {
    'bpo': '🏢', 'saas': '☁️', 'nda': '🔒', 'msa': '📋',
    'employment': '👔', 'it_services': '💻', 'consulting': '💼', 'custom': '📄',
}

// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function CompanyAdminLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Company Admin...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: TAB NAVIGATION COMPONENT (UPDATED)
// ============================================================================

interface TabNavigationProps {
    activeTab: AdminTab
    onTabChange: (tab: AdminTab) => void
    pendingCount: { training: number; users: number }
}

function TabNavigation({ activeTab, onTabChange, pendingCount }: TabNavigationProps) {
    const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'playbooks', label: 'Playbooks', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
        { id: 'templates', label: 'Templates', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { id: 'training', label: 'Training Access', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>, badge: pendingCount.training > 0 ? pendingCount.training : undefined },
        { id: 'users', label: 'Users', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>, badge: pendingCount.users > 0 ? pendingCount.users : undefined },
        { id: 'audit', label: 'Audit Log', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> }
    ]

    return (
        <div className="border-b border-slate-200 bg-white">
            <nav className="flex space-x-1 px-6" aria-label="Tabs">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => onTabChange(tab.id)}
                        className={`relative flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all ${activeTab === tab.id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                        {tab.icon}
                        {tab.label}
                        {tab.badge && <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">{tab.badge}</span>}
                    </button>
                ))}
            </nav>
        </div>
    )
}

// ============================================================================
// SECTION 5: PLAYBOOKS TAB COMPONENT
// ============================================================================

interface PlaybooksTabProps {
    playbooks: Playbook[]
    isLoading: boolean
    onUpload: (file: File) => Promise<void>
    onActivate: (playbookId: string) => Promise<void>
    onDeactivate: (playbookId: string) => Promise<void>
    onParse: (playbookId: string) => Promise<void>
    onDelete: (playbookId: string, sourceFilePath?: string) => Promise<void>
    onDownload: (sourceFilePath: string, fileName: string) => Promise<void>
    onRefresh: () => void
}

function PlaybooksTab({ playbooks, isLoading, onUpload, onActivate, onDeactivate, onParse, onDelete, onDownload, onRefresh }: PlaybooksTabProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [parsingId, setParsingId] = useState<string | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleFileUpload = async (file: File) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        if (!allowedTypes.includes(file.type)) { setUploadError('Please upload a PDF or Word document'); return }
        if (file.size > 10 * 1024 * 1024) { setUploadError('File size must be less than 10MB'); return }
        setIsUploading(true); setUploadError(null)
        try { await onUpload(file) } catch (e) { setUploadError(e instanceof Error ? e.message : 'Failed to upload') } finally { setIsUploading(false) }
    }

    const handleParseClick = async (playbookId: string) => {
        console.log('=== PARSE BUTTON CLICKED ===', playbookId)
        setParsingId(playbookId); setParseError(null)
        try { await onParse(playbookId) } catch (e) { console.error('Parse error:', e); setParseError(e instanceof Error ? e.message : 'Failed to parse') } finally { setParsingId(null) }
    }

    const getStatusBadge = (status: Playbook['status'], isActive: boolean) => {
        if (isActive) return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>
        const c: Record<string, { bg: string; text: string; label: string }> = {
            pending_parse: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pending Processing' },
            parsing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing...' },
            parsed: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Ready to Activate' },
            review_required: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Review Required' },
            inactive: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Inactive' },
            parse_failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Parse Failed' }
        }
        const cfg = c[status] || { bg: 'bg-slate-100', text: 'text-slate-500', label: status }
        return <span className={`px-2 py-1 text-xs font-medium ${cfg.bg} ${cfg.text} rounded-full`}>{cfg.label}</span>
    }

    return (
        <div className="p-6">
            {/* Upload Section */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Upload Playbook</h3>
                <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'} ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                    {isUploading ? (<div className="flex flex-col items-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-slate-600">Uploading...</p></div>
                    ) : (<><div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center"><svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg></div><p className="text-slate-700 font-medium mb-1">Drag and drop your playbook here</p><p className="text-sm text-slate-500">PDF, DOC, DOCX - max 10MB</p></>)}
                </div>
                {uploadError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{uploadError}</div>}
                {parseError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{parseError}</div>}
            </div>

            {/* Playbooks List */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Your Playbooks ({playbooks.length})</h3>
                <button onClick={onRefresh} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
            ) : playbooks.length === 0 ? (
                <div className="text-center py-12 text-slate-500"><p>No playbooks uploaded yet</p></div>
            ) : (
                <div className="space-y-3">
                    {playbooks.map((pb) => (
                        <div key={pb.playbookId} className={`p-4 rounded-xl border ${pb.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${pb.isActive ? 'bg-emerald-200' : 'bg-slate-100'}`}>
                                        <svg className={`w-5 h-5 ${pb.isActive ? 'text-emerald-700' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-800">{pb.playbookName}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            {getStatusBadge(pb.status, pb.isActive)}
                                            {pb.rulesExtracted > 0 && <span className="text-xs text-slate-500">{pb.rulesExtracted} rules</span>}
                                            <span className="text-xs text-slate-400">{new Date(pb.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {pb.parsingError && <p className="text-xs text-red-600 mt-1">{pb.parsingError}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2" ref={openMenuId === pb.playbookId ? menuRef : null}>
                                    {pb.status === 'pending_parse' && <button onClick={() => handleParseClick(pb.playbookId)} disabled={parsingId === pb.playbookId} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{parsingId === pb.playbookId ? 'Processing...' : 'Process'}</button>}
                                    {pb.status === 'parse_failed' && <button onClick={() => handleParseClick(pb.playbookId)} disabled={parsingId === pb.playbookId} className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">{parsingId === pb.playbookId ? 'Retrying...' : 'Retry'}</button>}
                                    {(pb.status === 'parsed' || pb.status === 'inactive') && !pb.isActive && <button onClick={() => onActivate(pb.playbookId)} className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Activate</button>}
                                    {pb.isActive && <button onClick={() => onDeactivate(pb.playbookId)} className="px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Deactivate</button>}
                                    <div className="relative">
                                        <button onClick={() => setOpenMenuId(openMenuId === pb.playbookId ? null : pb.playbookId)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
                                        {openMenuId === pb.playbookId && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                                                {pb.sourceFilePath && <button onClick={() => { onDownload(pb.sourceFilePath!, pb.sourceFileName || 'playbook'); setOpenMenuId(null) }} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Download Original</button>}
                                                {showDeleteConfirm === pb.playbookId ? (
                                                    <div className="px-4 py-2"><p className="text-sm text-red-600 mb-2">Are you sure?</p><div className="flex gap-2"><button onClick={() => { onDelete(pb.playbookId, pb.sourceFilePath); setShowDeleteConfirm(null); setOpenMenuId(null) }} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Yes</button><button onClick={() => setShowDeleteConfirm(null)} className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded">No</button></div></div>
                                                ) : (<button onClick={() => setShowDeleteConfirm(pb.playbookId)} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete</button>)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 5B: COMPANY TEMPLATES TAB COMPONENT (NEW)
// ============================================================================

interface TemplatesTabProps {
    templates: CompanyTemplate[]
    isLoading: boolean
    onUpload: (file: File, templateName: string, contractType: string) => Promise<string>
    onDelete: (templateId: string) => Promise<void>
    onToggleActive: (templateId: string, isActive: boolean) => Promise<void>
    onRefresh: () => void
}

function TemplatesTab({ templates, isLoading, onUpload, onDelete, onToggleActive, onRefresh }: TemplatesTabProps) {
    const router = useRouter()
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [templateName, setTemplateName] = useState('')
    const [contractType, setContractType] = useState('custom')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileDrop = (file: File) => {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
        if (!allowedTypes.includes(file.type)) {
            setUploadError('Please upload a PDF, DOCX, or TXT file')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File size must be less than 10MB')
            return
        }
        setSelectedFile(file)
        setTemplateName(file.name.replace(/\.[^/.]+$/, ''))
        setShowUploadForm(true)
        setUploadError(null)
    }

    const handleUploadSubmit = async () => {
        if (!selectedFile || !templateName.trim()) return
        setIsUploading(true)
        setUploadError(null)
        setUploadProgress('Uploading and parsing document...')

        try {
            const contractId = await onUpload(selectedFile, templateName.trim(), contractType)
            setIsProcessing(true)
            setUploadProgress('Processing contract clauses...')

            // Poll Supabase directly for actual clause count
            const supabase = createClient()
            const MAX_POLLS = 60  // 3 minutes max (60 * 3 seconds)
            const POLL_INTERVAL = 3000
            let pollCount = 0

            const pollForCompletion = (): Promise<boolean> => {
                return new Promise((resolve) => {
                    const interval = setInterval(async () => {
                        pollCount++
                        if (pollCount > MAX_POLLS) {
                            clearInterval(interval)
                            resolve(false)
                            return
                        }
                        try {
                            // Get contract status
                            const { data: contractData, error: contractError } = await supabase
                                .from('uploaded_contracts')
                                .select('status')
                                .eq('contract_id', contractId)
                                .single()

                            if (contractError) {
                                console.error('Contract polling error:', contractError)
                                return
                            }

                            // Count actual clauses inserted (updates incrementally)
                            const { count: actualClauseCount } = await supabase
                                .from('uploaded_contract_clauses')
                                .select('*', { count: 'exact', head: true })
                                .eq('contract_id', contractId)

                            const clauseCount = actualClauseCount || 0

                            if (clauseCount > 0) {
                                setUploadProgress(`Processing clauses... ${clauseCount} found`)
                            } else {
                                setUploadProgress('Analysing document structure...')
                            }

                            console.log(`Poll ${pollCount}: status=${contractData.status}, clauses=${clauseCount}`)

                            // Check for completion
                            if (contractData.status === 'ready' && clauseCount > 0) {
                                clearInterval(interval)
                                resolve(true)
                                return
                            }
                            if (contractData.status === 'failed' || contractData.status === 'error') {
                                clearInterval(interval)
                                resolve(false)
                                return
                            }
                        } catch (err) {
                            console.error('Polling error:', err)
                        }
                    }, POLL_INTERVAL)
                })
            }

            const parseComplete = await pollForCompletion()

            if (!parseComplete) {
                throw new Error('Document parsing timed out or failed. Please try again.')
            }

            // Parse complete - redirect to Studio for certification
            setUploadProgress('Redirecting to certification studio...')
            router.push(`/auth/quick-contract/studio/${contractId}?mode=template&company=true`)

        } catch (e) {
            setUploadError(e instanceof Error ? e.message : 'Failed to upload')
            setIsUploading(false)
            setIsProcessing(false)
        }
    }

    const getStatusBadge = (template: CompanyTemplate) => {
        if (!template.isActive) {
            return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">Inactive</span>
        }
        if (template.status === 'processing') {
            return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Processing...</span>
        }
        if (template.status === 'failed') {
            return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Failed</span>
        }
        return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>
    }

    return (
        <div className="p-6">
            {/* Upload Section */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload Company Template</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Templates uploaded here will be available to all users in your company from the Contract Library.
                </p>

                {!showUploadForm ? (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f) }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                            ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".pdf,.docx,.txt"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }}
                            className="hidden"
                        />
                        <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>
                        <p className="text-slate-700 font-medium mb-1">Drag and drop your contract template here</p>
                        <p className="text-sm text-slate-500">PDF, DOCX, or TXT - max 10MB</p>
                    </div>
                ) : (
                    <div className="border border-slate-200 rounded-xl p-6 bg-white">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-medium text-slate-800">{selectedFile?.name}</p>
                                <p className="text-sm text-slate-500">{(selectedFile?.size || 0 / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Template Name</label>
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="e.g., Standard BPO Agreement"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={isUploading || isProcessing}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Contract Type</label>
                                <select
                                    value={contractType}
                                    onChange={(e) => setContractType(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={isUploading || isProcessing}
                                >
                                    {CONTRACT_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {(isUploading || isProcessing) && (
                            <div className="mt-6 text-center">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-indigo-600 font-medium">{uploadProgress}</p>
                            </div>
                        )}

                        {uploadError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {uploadError}
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => { setShowUploadForm(false); setSelectedFile(null); setUploadError(null) }}
                                disabled={isUploading || isProcessing}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadSubmit}
                                disabled={isUploading || isProcessing || !templateName.trim()}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                            >
                                {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Upload Template'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Templates List */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Company Templates ({templates.length})</h3>
                <button onClick={onRefresh} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <p className="font-medium text-slate-600 mb-1">No company templates yet</p>
                    <p className="text-sm">Upload your first template above</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {templates.map((template) => (
                        <div key={template.templateId} className={`p-4 rounded-xl border ${template.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${template.isActive ? 'bg-indigo-100' : 'bg-slate-200'}`}>
                                        <span className="text-xl">{CONTRACT_TYPE_ICONS[template.contractType] || '📄'}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-800">{template.templateName}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            {getStatusBadge(template)}
                                            {template.clauseCount > 0 && <span className="text-xs text-slate-500">{template.clauseCount} clauses</span>}
                                            <span className="text-xs text-slate-400">{new Date(template.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {template.isActive ? (
                                        <button
                                            onClick={() => onToggleActive(template.templateId, false)}
                                            className="px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => onToggleActive(template.templateId, true)}
                                            className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    {showDeleteConfirm === template.templateId ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => { onDelete(template.templateId); setShowDeleteConfirm(null) }}
                                                className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(null)}
                                                className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowDeleteConfirm(template.templateId)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 6: TRAINING ACCESS TAB COMPONENT
// ============================================================================

interface TrainingAccessTabProps {
    users: TrainingUser[]
    isLoading: boolean
    onAddUser: (email: string, fullName: string, approvalType: string) => Promise<void>
    onRemoveUser: (id: string) => Promise<void>
    onSendInvite: (id: string, email: string) => Promise<void>
    onRefresh: () => void
}

function TrainingAccessTab({ users, isLoading, onAddUser, onRemoveUser, onSendInvite, onRefresh }: TrainingAccessTabProps) {
    const [showAddForm, setShowAddForm] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newFullName, setNewFullName] = useState('')
    const [newApprovalType, setNewApprovalType] = useState<string>('training_partner')
    const [isAdding, setIsAdding] = useState(false)
    const [addError, setAddError] = useState<string | null>(null)

    const handleAdd = async () => {
        if (!newEmail.trim() || !newFullName.trim()) { setAddError('Please fill in all fields'); return }
        setIsAdding(true); setAddError(null)
        try { await onAddUser(newEmail.trim(), newFullName.trim(), newApprovalType); setShowAddForm(false); setNewEmail(''); setNewFullName(''); setNewApprovalType('training_partner') } catch (e) { setAddError(e instanceof Error ? e.message : 'Failed to add user') } finally { setIsAdding(false) }
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div><h3 className="text-lg font-semibold text-slate-800">Training Access ({users.length})</h3><p className="text-sm text-slate-500 mt-1">Manage who can access training features</p></div>
                <div className="flex items-center gap-3">
                    <button onClick={onRefresh} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh</button>
                    <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add User</button>
                </div>
            </div>
            {showAddForm && (<div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"><h4 className="font-medium text-slate-800 mb-4">Add Training User</h4><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="user@company.com" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input type="text" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="John Smith" /></div></div><div className="mb-4"><label className="block text-sm font-medium text-slate-700 mb-1">Access Type</label><select value={newApprovalType} onChange={(e) => setNewApprovalType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="training_partner">Training Partner</option><option value="training_admin">Training Admin</option><option value="ai_enabled">AI Enabled</option></select></div>{addError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{addError}</div>}<div className="flex gap-3"><button onClick={() => { setShowAddForm(false); setAddError(null) }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button><button onClick={handleAdd} disabled={isAdding} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">{isAdding ? 'Adding...' : 'Add & Send Invite'}</button></div></div>)}
            {isLoading ? (<div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>) : users.length === 0 ? (<div className="text-center py-12 text-slate-500"><p>No training users configured</p></div>) : (<div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">User</th><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Type</th><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Added</th><th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Actions</th></tr></thead><tbody>{users.map((user) => (<tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center"><span className="text-amber-700 font-medium text-sm">{user.fullName?.[0] || user.email[0].toUpperCase()}</span></div><div><p className="font-medium text-slate-800 text-sm">{user.fullName || 'Unnamed'}</p><p className="text-xs text-slate-500">{user.email}</p></div></div></td><td className="py-3 px-4"><span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">{user.approvalType?.replace('_', ' ')}</span></td><td className="py-3 px-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : user.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{user.status}</span></td><td className="py-3 px-4 text-sm text-slate-500">{new Date(user.invitedAt).toLocaleDateString()}</td><td className="py-3 px-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => onSendInvite(user.id, user.email)} className="text-xs text-indigo-600 hover:text-indigo-700">Resend Invite</button><button onClick={() => onRemoveUser(user.id)} className="text-xs text-red-600 hover:text-red-700">Remove</button></div></td></tr>))}</tbody></table></div>)}
        </div>
    )
}

// ============================================================================
// SECTION 7: USERS TAB COMPONENT
// ============================================================================

interface UsersTabProps {
    users: CompanyUser[]
    isLoading: boolean
    onAddUser: (email: string, fullName: string, role: string) => Promise<void>
    onRemoveUser: (id: string) => Promise<void>
    onSendInvite: (id: string, email: string) => Promise<void>
    onRefresh: () => void
}

function UsersTab({ users, isLoading, onAddUser, onRemoveUser, onSendInvite, onRefresh }: UsersTabProps) {
    const [showAddForm, setShowAddForm] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newFullName, setNewFullName] = useState('')
    const [newRole, setNewRole] = useState<string>('user')
    const [isAdding, setIsAdding] = useState(false)
    const [addError, setAddError] = useState<string | null>(null)

    const handleAdd = async () => {
        if (!newEmail.trim() || !newFullName.trim()) { setAddError('Please fill in all fields'); return }
        setIsAdding(true); setAddError(null)
        try { await onAddUser(newEmail.trim(), newFullName.trim(), newRole); setShowAddForm(false); setNewEmail(''); setNewFullName(''); setNewRole('user') } catch (e) { setAddError(e instanceof Error ? e.message : 'Failed to add user') } finally { setIsAdding(false) }
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div><h3 className="text-lg font-semibold text-slate-800">Company Users ({users.length})</h3><p className="text-sm text-slate-500 mt-1">Manage who can access the platform</p></div>
                <div className="flex items-center gap-3">
                    <button onClick={onRefresh} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh</button>
                    <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add User</button>
                </div>
            </div>
            {showAddForm && (<div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200"><h4 className="font-medium text-slate-800 mb-4">Add Company User</h4><div className="grid grid-cols-2 gap-4 mb-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="user@company.com" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input type="text" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="John Smith" /></div></div><div className="mb-4"><label className="block text-sm font-medium text-slate-700 mb-1">Role</label><select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></div>{addError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{addError}</div>}<div className="flex gap-3"><button onClick={() => { setShowAddForm(false); setAddError(null) }} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button><button onClick={handleAdd} disabled={isAdding} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">{isAdding ? 'Adding...' : 'Add & Send Invite'}</button></div></div>)}
            {isLoading ? (<div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>) : users.length === 0 ? (<div className="text-center py-12 text-slate-500"><p>No users configured</p></div>) : (<div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">User</th><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Role</th><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th><th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Added</th><th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Actions</th></tr></thead><tbody>{users.map((user) => (<tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center"><span className="text-indigo-700 font-medium text-sm">{user.fullName?.[0] || user.email[0].toUpperCase()}</span></div><div><p className="font-medium text-slate-800 text-sm">{user.fullName || 'Unnamed'}</p><p className="text-xs text-slate-500">{user.email}</p></div></div></td><td className="py-3 px-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span></td><td className="py-3 px-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : user.status === 'invited' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{user.status}</span></td><td className="py-3 px-4 text-sm text-slate-500">{new Date(user.invitedAt).toLocaleDateString()}</td><td className="py-3 px-4 text-right"><div className="flex items-center justify-end gap-2">{user.status === 'invited' && <button onClick={() => onSendInvite(user.id, user.email)} className="text-xs text-indigo-600 hover:text-indigo-700">Resend Invite</button>}<button onClick={() => onRemoveUser(user.id)} className="text-xs text-red-600 hover:text-red-700">Remove</button></div></td></tr>))}</tbody></table></div>)}
        </div>
    )
}

// ============================================================================
// SECTION 8: AUDIT LOG TAB COMPONENT
// ============================================================================

function AuditLogTab() {
    return (
        <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Audit Log</h3>
            <div className="text-center py-12 text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="font-medium">Audit logging coming soon</p>
                <p className="text-sm mt-1">Track all admin actions and changes</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 9: MAIN COMPANY ADMIN CONTENT
// ============================================================================

function CompanyAdminContent() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [companyName, setCompanyName] = useState('')
    const [activeTab, setActiveTab] = useState<AdminTab>('playbooks')
    const [isAdmin, setIsAdmin] = useState(false)
    const [playbooks, setPlaybooks] = useState<Playbook[]>([])
    const [playbooksLoading, setPlaybooksLoading] = useState(false)
    const [companyTemplates, setCompanyTemplates] = useState<CompanyTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [trainingUsers, setTrainingUsers] = useState<TrainingUser[]>([])
    const [trainingLoading, setTrainingLoading] = useState(false)
    const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
    const [usersLoading, setUsersLoading] = useState(false)

    const checkAuth = useCallback(async (): Promise<UserInfo | null> => {
        try {
            const supabase = createClient()
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) { router.push('/auth/login'); return null }
            let companyId = user.user_metadata?.company_id
            if (!companyId) { const { data } = await supabase.from('company_users').select('company_id').eq('email', user.email).eq('status', 'active').single(); companyId = data?.company_id }
            if (!companyId) { const { data } = await supabase.from('companies').select('company_id').limit(1).single(); companyId = data?.company_id }
            console.log('Auth:', user.email, 'Company:', companyId)
            return { userId: user.id, email: user.email || '', firstName: user.user_metadata?.first_name || '', lastName: user.user_metadata?.last_name || '', company: user.user_metadata?.company || '', companyId: companyId || '', role: 'customer' }
        } catch (e) { console.error('Auth error:', e); router.push('/auth/login'); return null }
    }, [router])

    const checkAdminAccess = useCallback(async (email: string, companyId?: string): Promise<boolean> => {
        if (['paul.lyons67@icloud.com'].includes(email.toLowerCase())) return true
        if (companyId) { const supabase = createClient(); const { data } = await supabase.from('company_users').select('role').eq('email', email).eq('company_id', companyId).eq('status', 'active').single(); if (data?.role === 'admin') return true }
        return false
    }, [])

    const loadPlaybooks = useCallback(async (companyId: string) => {
        console.log('=== loadPlaybooks ===', companyId)
        setPlaybooksLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('company_playbooks').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
            console.log('Playbooks:', { data, error })
            if (error) { if (error.code === '42P01') { setPlaybooks([]); return }; throw error }
            setPlaybooks((data || []).map(p => ({ playbookId: p.playbook_id, playbookName: p.playbook_name, playbookVersion: p.playbook_version, playbookDescription: p.playbook_description, playbookSummary: p.playbook_summary, status: p.status, isActive: p.is_active || false, sourceFileName: p.source_file_name, sourceFilePath: p.source_file_path, rulesExtracted: p.rules_extracted || 0, aiConfidenceScore: p.ai_confidence_score, effectiveDate: p.effective_date, expiryDate: p.expiry_date, createdAt: p.created_at, createdBy: p.created_by, parsingError: p.parsing_error })))
        } catch (e) { console.error('Load playbooks error:', e); setPlaybooks([]) } finally { setPlaybooksLoading(false) }
    }, [])

    // NEW: Load company templates
    const loadCompanyTemplates = useCallback(async (companyId: string) => {
        console.log('=== loadCompanyTemplates ===', companyId)
        setTemplatesLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_public', true)
                .eq('is_system', false)
                .order('created_at', { ascending: false })

            if (error) {
                if (error.code === '42P01') { setCompanyTemplates([]); return }
                throw error
            }

            setCompanyTemplates((data || []).map(t => ({
                templateId: t.template_id,
                templateCode: t.template_code || '',
                templateName: t.template_name,
                description: t.description || '',
                contractType: t.contract_type || 'custom',
                industry: t.industry,
                clauseCount: t.clause_count || 0,
                version: t.version || 1,
                timesUsed: t.times_used || 0,
                isActive: t.is_active,
                status: t.clause_count > 0 ? 'ready' : 'processing',
                createdAt: t.created_at,
                createdBy: t.created_by_user_id,
                sourceFileName: t.source_file_name
            })))
        } catch (e) {
            console.error('Load templates error:', e)
            setCompanyTemplates([])
        } finally {
            setTemplatesLoading(false)
        }
    }, [])

    const loadTrainingUsers = useCallback(async (companyId: string) => {
        setTrainingLoading(true)
        try {
            const supabase = createClient()
            const { data: viewData, error: viewError } = await supabase.from('training_users_with_email').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
            if (!viewError && viewData) {
                const mapped: TrainingUser[] = viewData.map(u => ({ id: u.id, userId: u.user_id, email: u.user_email || '', fullName: u.user_full_name || '', approvalType: u.approval_type || 'training_partner', status: u.status || 'active', invitedAt: u.approved_at || u.created_at, approvedAt: u.approved_at, sessionsCompleted: 0, invitationSent: true }))
                setTrainingUsers(mapped); return
            }
            const { data, error } = await supabase.from('approved_training_users').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
            if (error) { if (error.code === '42P01') { setTrainingUsers([]); return }; throw error }
            const mapped: TrainingUser[] = (data || []).map(u => ({ id: u.id, userId: u.user_id, email: u.user_id ? `User ${u.user_id.slice(0, 8)}...` : 'Unknown', fullName: u.notes || '', approvalType: u.approval_type || 'training_partner', status: u.status || 'active', invitedAt: u.approved_at || u.created_at, approvedAt: u.approved_at, sessionsCompleted: 0, invitationSent: true }))
            setTrainingUsers(mapped)
        } catch (error) { console.error('Error loading training users:', error); setTrainingUsers([]) } finally { setTrainingLoading(false) }
    }, [])

    const loadCompanyUsers = useCallback(async (companyId: string) => {
        setUsersLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('company_users').select('*').eq('company_id', companyId).neq('status', 'removed').order('created_at', { ascending: false })
            if (error) { if (error.code === '42P01') { setCompanyUsers([]); return }; throw error }
            setCompanyUsers((data || []).map(u => ({ id: u.company_user_id, userId: u.user_id, email: u.email || '', fullName: u.full_name || '', role: u.role || 'user', status: u.status || 'invited', invitedAt: u.invited_at || u.created_at, lastActiveAt: u.last_active_at })))
        } catch (e) { console.error('Load company users error:', e); setCompanyUsers([]) } finally { setUsersLoading(false) }
    }, [])

    // Playbook handlers
    const handlePlaybookUpload = async (file: File) => {
        let companyId = userInfo?.companyId; const supabase = createClient()
        if (!companyId) { const { data } = await supabase.from('companies').select('company_id').limit(1).single(); companyId = data?.company_id }
        if (!companyId) { const { data, error } = await supabase.from('companies').insert({ company_name: userInfo?.company || 'My Company' }).select('company_id').single(); if (error) throw new Error(error.message); companyId = data?.company_id }
        const fileName = `${companyId}/${Date.now()}.${file.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage.from('playbooks').upload(fileName, file)
        if (uploadError) throw new Error(uploadError.message)
        const { error: insertError } = await supabase.from('company_playbooks').insert({ company_id: companyId, playbook_name: file.name.replace(/\.[^/.]+$/, ''), source_file_name: file.name, source_file_path: fileName, status: 'pending_parse', created_by: userInfo?.userId })
        if (insertError) throw new Error(insertError.message)
        await loadPlaybooks(companyId!)
    }

    const handlePlaybookParse = async (playbookId: string) => {
        console.log('=== handlePlaybookParse ===', playbookId)
        const supabase = createClient()
        await supabase.from('company_playbooks').update({ status: 'parsing', parsing_started_at: new Date().toISOString() }).eq('playbook_id', playbookId)
        try {
            const response = await fetch(`${API_BASE}/parse-playbook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playbook_id: playbookId }) })
            console.log('Parse response:', response.status)
            const text = await response.text(); console.log('Response:', text)
            if (!response.ok) { await supabase.from('company_playbooks').update({ status: 'parse_failed', parsing_error: `HTTP ${response.status}` }).eq('playbook_id', playbookId); throw new Error(`HTTP ${response.status}`) }
        } catch (e) { console.error('Parse error:', e); throw e }
        setTimeout(() => { if (userInfo?.companyId) loadPlaybooks(userInfo.companyId) }, 2000)
    }

    const handlePlaybookActivate = async (playbookId: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('company_playbooks').update({ is_active: false }).eq('company_id', userInfo.companyId).eq('is_active', true)
        await supabase.from('company_playbooks').update({ is_active: true, activated_at: new Date().toISOString(), status: 'active' }).eq('playbook_id', playbookId)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDeactivate = async (playbookId: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('company_playbooks').update({ is_active: false, status: 'inactive' }).eq('playbook_id', playbookId)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDelete = async (playbookId: string, sourceFilePath?: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('playbook_rules').delete().eq('playbook_id', playbookId)
        await supabase.from('company_playbooks').delete().eq('playbook_id', playbookId)
        if (sourceFilePath) await supabase.storage.from('playbooks').remove([sourceFilePath])
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDownload = async (sourceFilePath: string, fileName: string) => {
        const supabase = createClient()
        const { data, error } = await supabase.storage.from('playbooks').download(sourceFilePath)
        if (error) throw new Error(error.message)
        const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    }

    // NEW: Template handlers
    const handleTemplateUpload = async (file: File, templateName: string, contractType: string): Promise<string> => {
        if (!userInfo?.companyId || !userInfo?.userId) throw new Error('Not authenticated')

        // Extract text from file (client-side)
        const extractedText = await extractTextFromFile(file)
        if (!extractedText || extractedText.length < 100) {
            throw new Error('Could not extract sufficient text from the document')
        }

        // Call the parse-contract-document API with company template flag
        const response = await fetch(`${API_BASE}/parse-contract-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userInfo.userId,
                company_id: userInfo.companyId,
                file_name: file.name,
                file_type: file.type || 'application/octet-stream',
                file_size: file.size,
                document_text: extractedText,
                contract_type: contractType,
                template_name: templateName,
                create_as_template: true,
                is_company_template: true
            })
        })

        if (!response.ok) {
            throw new Error('Failed to process contract')
        }

        const result = await response.json()
        if (!result.success) {
            throw new Error(result.error || 'Processing failed')
        }

        // Return the contractId so TemplatesTab can redirect to Studio
        const returnedContractId = result.contractId || result.contract_id
        if (!returnedContractId) {
            throw new Error('No contract ID returned from parse workflow')
        }
        return returnedContractId
    }

    const handleTemplateDelete = async (templateId: string) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()

        // Soft delete - just mark as inactive
        const { error } = await supabase
            .from('contract_templates')
            .update({ is_active: false })
            .eq('template_id', templateId)
            .eq('company_id', userInfo.companyId)

        if (error) throw new Error(error.message)
        await loadCompanyTemplates(userInfo.companyId)
    }

    const handleTemplateToggleActive = async (templateId: string, isActive: boolean) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()

        const { error } = await supabase
            .from('contract_templates')
            .update({ is_active: isActive })
            .eq('template_id', templateId)
            .eq('company_id', userInfo.companyId)

        if (error) throw new Error(error.message)
        await loadCompanyTemplates(userInfo.companyId)
    }

    // Helper: Extract text from file
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
                } catch (error) { reject(error) }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            if (file.type === 'text/plain') { reader.readAsText(file) } else { reader.readAsArrayBuffer(file) }
        })
    }

    // Training handlers
    const handleAddTrainingUser = async (email: string, fullName: string, approvalType: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('approved_training_users').insert({ company_id: userInfo.companyId, user_email: email, user_full_name: fullName, approval_type: approvalType, status: 'active', approved_by_email: userInfo.email, approved_at: new Date().toISOString() })
        if (error) { if (error.code === '23505') throw new Error('User already exists'); throw new Error(error.message) }
        await handleSendTrainingInvite('', email); await loadTrainingUsers(userInfo.companyId)
    }

    const handleRemoveTrainingUser = async (id: string) => { if (!userInfo?.companyId) return; const supabase = createClient(); await supabase.from('approved_training_users').delete().eq('id', id); await loadTrainingUsers(userInfo.companyId) }

    const handleSendTrainingInvite = async (id: string, email: string) => {
        try { await fetch(`${API_BASE}/send-user-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company_name: companyName, inviter_name: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || userInfo?.email, inviter_email: userInfo?.email, invite_type: 'training' }) }) } catch (e) { console.log('Invite error:', e) }
        if (id && userInfo?.companyId) { const supabase = createClient(); await supabase.from('approved_training_users').update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq('id', id); await loadTrainingUsers(userInfo.companyId) }
    }

    // Company user handlers
    const handleAddCompanyUser = async (email: string, fullName: string, role: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('company_users').insert({ company_id: userInfo.companyId, email, full_name: fullName, role, status: 'invited', invited_by: userInfo.userId, invited_at: new Date().toISOString() })
        if (error) { if (error.code === '23505') throw new Error('User already exists'); throw new Error(error.message) }
        await handleSendCompanyInvite('', email); await loadCompanyUsers(userInfo.companyId)
    }

    const handleRemoveCompanyUser = async (id: string) => { if (!userInfo?.companyId) return; const supabase = createClient(); await supabase.from('company_users').update({ status: 'removed' }).eq('company_user_id', id); await loadCompanyUsers(userInfo.companyId) }

    const handleSendCompanyInvite = async (id: string, email: string) => {
        try { await fetch(`${API_BASE}/send-user-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company_name: companyName, inviter_name: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || userInfo?.email, inviter_email: userInfo?.email, invite_type: 'platform' }) }) } catch (e) { console.log('Invite error:', e) }
        if (id && userInfo?.companyId) { const supabase = createClient(); await supabase.from('company_users').update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq('company_user_id', id); await loadCompanyUsers(userInfo.companyId) }
    }

    useEffect(() => {
        const init = async () => {
            console.log('=== INIT COMPANY ADMIN ===')
            const user = await checkAuth(); if (!user) return
            setUserInfo(user); setCompanyName(user.company || 'Your Company')
            const hasAccess = await checkAdminAccess(user.email, user.companyId); setIsAdmin(hasAccess)
            if (!hasAccess) { router.push('/auth/contracts-dashboard'); return }
            if (user.companyId) {
                await Promise.all([
                    loadPlaybooks(user.companyId),
                    loadCompanyTemplates(user.companyId),  // NEW
                    loadTrainingUsers(user.companyId),
                    loadCompanyUsers(user.companyId)
                ])
            }
            setLoading(false)
        }
        init()
    }, [checkAuth, checkAdminAccess, loadPlaybooks, loadCompanyTemplates, loadTrainingUsers, loadCompanyUsers, router])

    if (loading) return <CompanyAdminLoading />
    if (!isAdmin) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><h2 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h2><button onClick={() => router.push('/auth/contracts-dashboard')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Go to Dashboard</button></div></div>

    const pendingCount = { training: trainingUsers.filter(u => u.status === 'pending').length, users: companyUsers.filter(u => u.status === 'invited').length }

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/auth/contracts-dashboard')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                            <div><h1 className="text-xl font-bold text-slate-800">Company Admin</h1><p className="text-sm text-slate-500">{companyName}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right"><p className="text-sm font-medium text-slate-700">{userInfo?.firstName} {userInfo?.lastName}</p><p className="text-xs text-slate-500">{userInfo?.email}</p></div>
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center"><span className="text-white font-bold">{userInfo?.firstName?.[0] || 'A'}</span></div>
                        </div>
                    </div>
                </div>
            </header>
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} pendingCount={pendingCount} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    {activeTab === 'playbooks' && <PlaybooksTab playbooks={playbooks} isLoading={playbooksLoading} onUpload={handlePlaybookUpload} onActivate={handlePlaybookActivate} onDeactivate={handlePlaybookDeactivate} onParse={handlePlaybookParse} onDelete={handlePlaybookDelete} onDownload={handlePlaybookDownload} onRefresh={() => userInfo?.companyId && loadPlaybooks(userInfo.companyId)} />}
                    {activeTab === 'templates' && <TemplatesTab templates={companyTemplates} isLoading={templatesLoading} onUpload={handleTemplateUpload} onDelete={handleTemplateDelete} onToggleActive={handleTemplateToggleActive} onRefresh={() => userInfo?.companyId && loadCompanyTemplates(userInfo.companyId)} />}
                    {activeTab === 'training' && <TrainingAccessTab users={trainingUsers} isLoading={trainingLoading} onAddUser={handleAddTrainingUser} onRemoveUser={handleRemoveTrainingUser} onSendInvite={handleSendTrainingInvite} onRefresh={() => userInfo?.companyId && loadTrainingUsers(userInfo.companyId)} />}
                    {activeTab === 'users' && <UsersTab users={companyUsers} isLoading={usersLoading} onAddUser={handleAddCompanyUser} onRemoveUser={handleRemoveCompanyUser} onSendInvite={handleSendCompanyInvite} onRefresh={() => userInfo?.companyId && loadCompanyUsers(userInfo.companyId)} />}
                    {activeTab === 'audit' && <AuditLogTab />}
                </div>
            </main>
        </div>
    )
}

// ============================================================================
// SECTION 10: PAGE EXPORT
// ============================================================================

export default function CompanyAdminPage() { return <Suspense fallback={<CompanyAdminLoading />}><CompanyAdminContent /></Suspense> }