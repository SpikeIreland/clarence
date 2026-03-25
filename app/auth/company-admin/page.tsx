'use client'
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import { normaliseCategory, getCategoryDisplayName, PlaybookRule, getEffectiveRangeContext, translateRulePosition } from '@/lib/playbook-compliance'
import jsPDF from 'jspdf'
import FeedbackButton from '@/app/components/FeedbackButton'
import InsightsTab from './components/InsightsTab'
import { DataJourneyMapContainer } from '@/app/components/DataJourneyMap'


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

type ClarenceRole = 'admin' | 'template_manager' | 'hr_manager' | 'senior_negotiator' | 'negotiator' | 'trainee'

interface CompanyUser {
    id: string
    userId?: string
    email: string
    fullName: string
    role: ClarenceRole
    status: 'invited' | 'active' | 'suspended' | 'removed'
    approvalRole: string    // Legacy — kept for DB backward compat; use role instead
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
    contractTypeKey: string | null
    playbookPerspective: 'customer' | 'provider'
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
    linkedPlaybookId: string | null
}

type AdminTab = 'insights' | 'templates' | 'playbooks' | 'people' | 'datamap' | 'audit'

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_OPTIONS = [
    { value: 'bpo', label: 'BPO / Outsourcing', protectedPartyLabel: 'Customer', providingPartyLabel: 'Provider' },
    { value: 'saas', label: 'SaaS Agreement', protectedPartyLabel: 'Subscriber', providingPartyLabel: 'Provider' },
    { value: 'nda', label: 'NDA', protectedPartyLabel: 'Disclosing Party', providingPartyLabel: 'Receiving Party' },
    { value: 'msa', label: 'Master Service Agreement', protectedPartyLabel: 'Customer', providingPartyLabel: 'Provider' },
    { value: 'employment', label: 'Employment Contract', protectedPartyLabel: 'Employee', providingPartyLabel: 'Employer' },
    { value: 'it_services', label: 'IT Services', protectedPartyLabel: 'Customer', providingPartyLabel: 'Provider' },
    { value: 'consulting', label: 'Consulting', protectedPartyLabel: 'Client', providingPartyLabel: 'Consultant' },
    { value: 'custom', label: 'Custom / Other', protectedPartyLabel: 'Customer', providingPartyLabel: 'Provider' },
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
// SECTION 4: TAB NAVIGATION COMPONENT (REORDERED - Templates first, Playbooks last)
// ============================================================================

interface TabNavigationProps {
    activeTab: AdminTab
    onTabChange: (tab: AdminTab) => void
    peoplePendingCount: number
}

function TabNavigation({ activeTab, onTabChange, peoplePendingCount }: TabNavigationProps) {
    const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'templates', label: 'Templates', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { id: 'people', label: 'People', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, badge: peoplePendingCount > 0 ? peoplePendingCount : undefined },
        { id: 'audit', label: 'Audit Log', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
        { id: 'playbooks', label: 'Playbooks', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> }
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
// SECTION 5: PLAYBOOKS TAB COMPONENT (with Observability Instrumentation)
// ============================================================================

interface PlaybooksTabProps {
    playbooks: Playbook[]
    isLoading: boolean
    onUpload: (file: File, contractTypeKey: string | null, perspective: 'customer' | 'provider') => Promise<void>
    onActivate: (playbookId: string) => Promise<void>
    onDeactivate: (playbookId: string) => Promise<void>
    onParse: (playbookId: string, sourceFilePath: string, sourceFileName: string) => Promise<void>
    onDelete: (playbookId: string, sourceFilePath?: string) => Promise<void>
    onDownload: (sourceFilePath: string, fileName: string) => Promise<void>
    onRename: (playbookId: string, newName: string) => Promise<void>
    onTypeChange: (playbookId: string, contractTypeKey: string | null) => Promise<void>
    onRefresh: () => void
}

function PlaybooksTab({ playbooks, isLoading, onUpload, onActivate, onDeactivate, onParse, onDelete, onDownload, onRename, onTypeChange, onRefresh }: PlaybooksTabProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploadContractType, setUploadContractType] = useState<string | null>(null)
    const [uploadPerspective, setUploadPerspective] = useState<'customer' | 'provider'>('customer')
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
    const [editTypeValue, setEditTypeValue] = useState<string | null>(null)
    const [parsingIds, setParsingIds] = useState<Set<string>>(new Set())
    const [parseError, setParseError] = useState<string | null>(null)
    const [parseProgress, setParseProgress] = useState<Record<string, string>>({})
    const [parseStartTimes, setParseStartTimes] = useState<Record<string, number>>({})
    const [elapsedDisplay, setElapsedDisplay] = useState<Record<string, string>>({})
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renameError, setRenameError] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const renameInputRef = useRef<HTMLInputElement>(null)


    // --- Observability: Log tab loaded ---
    useEffect(() => {
        eventLogger.completed('playbook_upload', 'playbook_tab_loaded', { companyId: playbooks?.[0]?.createdBy || null })
    }, [])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Focus rename input when it appears
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus()
            renameInputRef.current.select()
        }
    }, [renamingId])

    // Auto-detect playbooks already in 'parsing' status on mount/refresh
    // so progress shows even if user navigated away and came back
    useEffect(() => {
        const currentlyParsing = playbooks.filter(p => p.status === 'parsing')
        if (currentlyParsing.length === 0) return
        const now = Date.now()
        setParseProgress(prev => {
            const next = { ...prev }
            let changed = false
            for (const p of currentlyParsing) {
                if (!next[p.playbookId]) {
                    next[p.playbookId] = 'Parsing in progress — this may take a few minutes...'
                    changed = true
                }
            }
            return changed ? next : prev
        })
        setParseStartTimes(prev => {
            const next = { ...prev }
            let changed = false
            for (const p of currentlyParsing) {
                if (!next[p.playbookId]) {
                    // Use createdAt as rough start estimate, else now
                    next[p.playbookId] = p.createdAt ? new Date(p.createdAt).getTime() : now
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [playbooks])

    const [parseSimProgress, setParseSimProgress] = useState<Record<string, number>>({})

    // Elapsed time ticker — updates every 2s for actively parsing playbooks
    useEffect(() => {
        const parsingPlaybooks = playbooks.filter(p => p.status === 'parsing' || parsingIds.has(p.playbookId))
        if (parsingPlaybooks.length === 0) {
            if (Object.keys(elapsedDisplay).length > 0) setElapsedDisplay({})
            if (Object.keys(parseSimProgress).length > 0) setParseSimProgress({})
            return
        }
        const tick = () => {
            const now = Date.now()
            const display: Record<string, string> = {}
            const simProgress: Record<string, number> = {}
            for (const p of parsingPlaybooks) {
                const start = parseStartTimes[p.playbookId] || now
                const elapsed = Math.floor((now - start) / 1000)
                if (elapsed < 60) {
                    display[p.playbookId] = 'Just started...'
                } else {
                    const mins = Math.floor(elapsed / 60)
                    display[p.playbookId] = `${mins} min${mins !== 1 ? 's' : ''} elapsed`
                }
                // Asymptotic progress: approaches ~92% over ~90s, never reaches 100%
                simProgress[p.playbookId] = Math.round(92 * (1 - Math.exp(-elapsed / 90)))
            }
            setElapsedDisplay(display)
            setParseSimProgress(simProgress)
        }
        tick()
        const interval = setInterval(tick, 2000)
        return () => clearInterval(interval)
    }, [playbooks, parsingIds, parseStartTimes])

    // Clear progress messages when playbooks finish parsing
    useEffect(() => {
        if (Object.keys(parseProgress).length === 0 && parsingIds.size === 0) return
        const stillParsing = new Set(playbooks.filter(p => p.status === 'parsing').map(p => p.playbookId))
        // Clear progress messages for playbooks that finished parsing
        const updatedProgress = { ...parseProgress }
        const updatedStartTimes = { ...parseStartTimes }
        const updatedElapsed = { ...elapsedDisplay }
        let progressChanged = false
        for (const id of Object.keys(updatedProgress)) {
            if (!stillParsing.has(id) && !parsingIds.has(id)) {
                delete updatedProgress[id]
                delete updatedStartTimes[id]
                delete updatedElapsed[id]
                progressChanged = true
            }
        }
        if (progressChanged) {
            setParseProgress(updatedProgress)
            setParseStartTimes(updatedStartTimes)
            setElapsedDisplay(updatedElapsed)
        }
        // Clear parsingIds for playbooks whose status is no longer 'parsing'
        // (i.e. the parent refreshed and status changed to 'parsed' or 'parse_failed')
        if (parsingIds.size > 0) {
            let idsChanged = false
            const nextIds = new Set(parsingIds)
            for (const id of parsingIds) {
                if (!stillParsing.has(id)) {
                    const pb = playbooks.find(p => p.playbookId === id)
                    if (pb && pb.status !== 'pending_parse') {
                        nextIds.delete(id)
                        idsChanged = true
                    }
                }
            }
            if (idsChanged) setParsingIds(nextIds)
        }
    }, [playbooks, parseProgress, parsingIds])

    const handleFileUpload = async (file: File) => {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        if (!allowedTypes.includes(file.type)) { setUploadError('Please upload a PDF or Word document'); return }
        if (file.size > 10 * 1024 * 1024) { setUploadError('File size must be less than 10MB'); return }

        // --- Observability: Log file selected ---
        eventLogger.completed('playbook_upload', 'playbook_file_selected', {
            fileName: file.name,
            fileType: file.type,
            fileSizeMb: Math.round(file.size / 1024 / 1024 * 100) / 100
        })

        setIsUploading(true)
        setUploadError(null)
        try {
            await onUpload(file, uploadContractType, uploadPerspective)
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : 'Failed to upload')
        } finally {
            setIsUploading(false)
        }
    }

    const handleParseClick = async (playbookId: string, sourceFilePath: string, sourceFileName: string) => {
        console.log('=== PARSE BUTTON CLICKED ===', playbookId, sourceFilePath)
        setParsingIds(prev => new Set(prev).add(playbookId))
        setParseError(null)
        setParseProgress(prev => ({ ...prev, [playbookId]: 'Downloading document...' }))
        setParseStartTimes(prev => ({ ...prev, [playbookId]: Date.now() }))
        try {
            await onParse(playbookId, sourceFilePath, sourceFileName)
            // Parse request sent — N8N processes in background.
            // Keep in parsingIds so button stays disabled/shows "Processing..."
            // until the parent refreshes playbooks (polling detects status change).
            setParseProgress(prev => ({ ...prev, [playbookId]: 'Parsing in progress — this may take a few minutes...' }))
        } catch (e) {
            console.error('Parse error:', e)
            setParseError(e instanceof Error ? e.message : 'Failed to parse')
            setParsingIds(prev => { const next = new Set(prev); next.delete(playbookId); return next })
            setParseProgress(prev => { const next = { ...prev }; delete next[playbookId]; return next })
        }
    }

    const handleRenameStart = (playbook: Playbook) => {
        setRenamingId(playbook.playbookId)
        setRenameValue(playbook.playbookName)
        setRenameError(null)
        setOpenMenuId(null)
    }

    const handleRenameSubmit = async (playbookId: string) => {
        const trimmedName = renameValue.trim()
        if (!trimmedName) {
            setRenameError('Name cannot be empty')
            return
        }
        if (trimmedName.length > 255) {
            setRenameError('Name is too long (max 255 characters)')
            return
        }
        try {
            await onRename(playbookId, trimmedName)
            setRenamingId(null)
            setRenameValue('')
        } catch (e) {
            setRenameError(e instanceof Error ? e.message : 'Failed to rename')
        }
    }

    const handleRenameCancel = () => {
        setRenamingId(null)
        setRenameValue('')
        setRenameError(null)
    }

    const handleRenameKeyDown = (e: React.KeyboardEvent, playbookId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleRenameSubmit(playbookId)
        } else if (e.key === 'Escape') {
            handleRenameCancel()
        }
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
                {/* Contract Type Selector */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contract Type</label>
                    <select
                        value={uploadContractType || ''}
                        onChange={(e) => setUploadContractType(e.target.value || null)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                    >
                        <option value="">General (applies to all contract types)</option>
                        {CONTRACT_TYPE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{CONTRACT_TYPE_ICONS[opt.value] || ''} {opt.label}</option>
                        ))}
                    </select>
                </div>
                {/* Playbook Perspective Selector */}
                {(() => {
                    const selectedType = CONTRACT_TYPE_OPTIONS.find(o => o.value === uploadContractType)
                    const protectedLabel = selectedType?.protectedPartyLabel || 'Customer / Buyer'
                    const providingLabel = selectedType?.providingPartyLabel || 'Provider / Supplier'
                    return (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Playbook Perspective</label>
                    <div className="flex gap-3">
                        <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-all ${uploadPerspective === 'customer' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-300 hover:border-slate-400'}`}>
                            <input type="radio" name="perspective" value="customer" checked={uploadPerspective === 'customer'} onChange={() => setUploadPerspective('customer')} className="sr-only" />
                            <span className="text-lg">🛡️</span>
                            <div>
                                <div className="text-sm font-medium text-slate-800">{protectedLabel}</div>
                                <div className="text-[11px] text-slate-500">Higher positions = more {protectedLabel.toLowerCase()} protection</div>
                            </div>
                        </label>
                        <label className={`flex-1 flex items-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-all ${uploadPerspective === 'provider' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-300 hover:border-slate-400'}`}>
                            <input type="radio" name="perspective" value="provider" checked={uploadPerspective === 'provider'} onChange={() => setUploadPerspective('provider')} className="sr-only" />
                            <span className="text-lg">🏢</span>
                            <div>
                                <div className="text-sm font-medium text-slate-800">{providingLabel}</div>
                                <div className="text-[11px] text-slate-500">Higher positions = more {providingLabel.toLowerCase()} protection</div>
                            </div>
                        </label>
                    </div>
                </div>
                    )
                })()}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'} ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
                >
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                    {isUploading ? (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-600">Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <p className="text-slate-700 font-medium mb-1">Drag and drop your playbook here</p>
                            <p className="text-sm text-slate-500">PDF, DOC, DOCX - max 10MB</p>
                        </>
                    )}
                </div>
                {uploadError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{uploadError}</div>}
                {parseError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{parseError}</div>}
                {Object.entries(parseProgress).map(([id, msg]) => {
                    const pb = playbooks.find(p => p.playbookId === id)
                    return (
                    <div key={id} className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                        <div className="flex-1">
                            <span className="font-medium">{pb?.playbookName || 'Playbook'}</span>: {msg}
                            {elapsedDisplay[id] && <span className="ml-2 text-blue-500">({elapsedDisplay[id]})</span>}
                        </div>
                    </div>
                    )
                })}
            </div>

            {/* Playbooks List */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Your Playbooks ({playbooks.length})</h3>
                <div className="flex items-center gap-2">
                    <a href="/auth/company-admin/playbook/create" className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Playbook
                    </a>
                    <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading playbooks...</p>
                </div>
            ) : playbooks.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-slate-600 font-medium">No playbooks uploaded yet</p>
                    <p className="text-sm text-slate-500 mt-1">Upload your negotiation playbook to get started</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {playbooks.map((p) => (
                        <div key={p.playbookId} className={`p-4 rounded-xl border ${p.isActive ? 'bg-emerald-50 border-emerald-200' : deletingId === p.playbookId ? 'bg-red-50 border-red-200 opacity-50' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        {/* Inline Rename or Display Name */}
                                        {renamingId === p.playbookId ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={renameInputRef}
                                                    type="text"
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onKeyDown={(e) => handleRenameKeyDown(e, p.playbookId)}
                                                    className="px-2 py-1 text-sm font-semibold border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                                                    placeholder="Enter playbook name"
                                                />
                                                <button
                                                    onClick={() => handleRenameSubmit(p.playbookId)}
                                                    className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                                                    title="Save"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={handleRenameCancel}
                                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                    title="Cancel"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <h4 className="font-semibold text-slate-800">{p.playbookName}</h4>
                                        )}
                                        {getStatusBadge(p.status, p.isActive)}
                                        {p.contractTypeKey ? (
                                            <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                                {CONTRACT_TYPE_ICONS[p.contractTypeKey] || ''} {CONTRACT_TYPE_OPTIONS.find(o => o.value === p.contractTypeKey)?.label || p.contractTypeKey}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">General</span>
                                        )}
                                        {(() => {
                                            const ct = CONTRACT_TYPE_OPTIONS.find(o => o.value === p.contractTypeKey)
                                            const perspLabel = p.playbookPerspective === 'provider'
                                                ? (ct?.providingPartyLabel || 'Provider')
                                                : (ct?.protectedPartyLabel || 'Customer')
                                            return (
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${p.playbookPerspective === 'provider' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                                    {perspLabel}
                                                </span>
                                            )
                                        })()}
                                    </div>
                                    {/* Inline Change Type editor */}
                                    {editingTypeId === p.playbookId && (
                                        <div className="flex items-center gap-2 mb-2 mt-1">
                                            <select
                                                value={editTypeValue || ''}
                                                onChange={(e) => setEditTypeValue(e.target.value || null)}
                                                className="px-2 py-1 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">General (all types)</option>
                                                {CONTRACT_TYPE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <button onClick={async () => { await onTypeChange(p.playbookId, editTypeValue); setEditingTypeId(null) }} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded" title="Save">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                            <button onClick={() => setEditingTypeId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Cancel">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    )}
                                    {renameError && renamingId === p.playbookId && (
                                        <p className="text-sm text-red-600 mb-2">{renameError}</p>
                                    )}
                                    {p.playbookSummary && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{p.playbookSummary}</p>}
                                    {(p.status === 'parsing' || parsingIds.has(p.playbookId)) && (
                                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-blue-800">
                                                        {parseProgress[p.playbookId] || 'Parsing in progress — this may take a few minutes...'}
                                                    </p>
                                                    <p className="text-xs text-blue-600 mt-0.5">
                                                        {elapsedDisplay[p.playbookId] ? `${elapsedDisplay[p.playbookId]} — ` : ''}Please keep this page open. Large documents may take 2-5 minutes.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${parseSimProgress[p.playbookId] ?? 3}%`, transition: 'width 2s ease-out' }}></div>
                                            </div>
                                        </div>
                                    )}
                                    {p.parsingError && <p className="text-sm text-red-600 mb-3">Error: {p.parsingError}</p>}
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                        {p.sourceFileName && <span>{p.sourceFileName}</span>}
                                        {(p.status === 'parsing' || parsingIds.has(p.playbookId))
                                            ? <span className="animate-pulse text-blue-500">Extracting rules...</span>
                                            : <span>{p.rulesExtracted} rules</span>
                                        }
                                        {['parsed', 'active', 'inactive', 'review_required'].includes(p.status) && p.rulesExtracted > 0 && (
                                            <a
                                                href={`/auth/company-admin/playbook/${p.playbookId}`}
                                                className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                            >
                                                PlaybookIQ
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </a>
                                        )}
                                        {p.aiConfidenceScore != null && <span>{Math.round(p.aiConfidenceScore * 100)}% confidence</span>}
                                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    {(p.status === 'pending_parse' || p.status === 'parse_failed') && !parsingIds.has(p.playbookId) && (
                                        <button
                                            onClick={() => handleParseClick(p.playbookId, p.sourceFilePath || '', p.sourceFileName || 'playbook')}
                                            disabled={!p.sourceFilePath}
                                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                                        >
                                            {p.status === 'parse_failed' ? 'Retry Parse' : 'Parse Playbook'}
                                        </button>
                                    )}
                                    {(p.status === 'parsing' || parsingIds.has(p.playbookId)) && (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg flex items-center gap-2">
                                                <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                                                Parsing...
                                            </span>
                                            {elapsedDisplay[p.playbookId] && (
                                                <span className="text-xs text-blue-500">{elapsedDisplay[p.playbookId]}</span>
                                            )}
                                        </div>
                                    )}
                                    {p.isActive ? (
                                        <button onClick={() => onDeactivate(p.playbookId)} className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg">Deactivate</button>
                                    ) : (p.status === 'parsed' || p.status === 'inactive') && (
                                        <button onClick={() => {
                                            onActivate(p.playbookId)
                                            // --- Observability: Log playbook activation ---
                                            eventLogger.completed('playbook_upload', 'playbook_activated', { playbookId: p.playbookId, ruleCount: p.rulesExtracted })
                                        }} className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Activate</button>
                                    )}
                                    <div className="relative" ref={openMenuId === p.playbookId ? menuRef : null}>
                                        <button onClick={() => setOpenMenuId(openMenuId === p.playbookId ? null : p.playbookId)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
                                        </button>
                                        {openMenuId === p.playbookId && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                                                {/* Rename Option */}
                                                <button
                                                    onClick={() => handleRenameStart(p)}
                                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Rename
                                                </button>
                                                {/* Change Type Option */}
                                                <button
                                                    onClick={() => { setEditingTypeId(p.playbookId); setEditTypeValue(p.contractTypeKey); setOpenMenuId(null) }}
                                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                    Change Type
                                                </button>
                                                {/* Download Option */}
                                                {p.sourceFilePath && (
                                                    <button onClick={() => { onDownload(p.sourceFilePath!, p.sourceFileName || 'playbook'); setOpenMenuId(null) }} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                        Download
                                                    </button>
                                                )}
                                                <div className="border-t border-slate-100 my-1"></div>
                                                {/* Delete Option */}
                                                {showDeleteConfirm === p.playbookId ? (
                                                    <div className="px-4 py-2">
                                                        <p className="text-xs text-red-600 mb-2">Delete this playbook?</p>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => { setDeletingId(p.playbookId); onDelete(p.playbookId, p.sourceFilePath).finally(() => { setDeletingId(null); setShowDeleteConfirm(null); setOpenMenuId(null) }) }} className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded">Yes</button>
                                                            <button onClick={() => setShowDeleteConfirm(null)} className="px-2 py-1 text-xs text-slate-600 bg-slate-100 rounded">Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setShowDeleteConfirm(p.playbookId)} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Delete
                                                    </button>
                                                )}
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
// PLAYBOOK ALIGNMENT TAB — shown inside template clause cards
// ============================================================================

function PlaybookAlignmentTab({ rule, clausePosition }: {
    rule: PlaybookRule
    clausePosition: number | null
}) {
    const toPercent = (val: number) => ((val - 1) / 9) * 100
    const rangeCtx = getEffectiveRangeContext(rule)

    const idealPct    = toPercent(rule.ideal_position)
    const minPct      = toPercent(rule.minimum_position)
    const maxPct      = toPercent(rule.maximum_position)
    const fallbackPct = toPercent(rule.fallback_position)

    let statusLabel = 'No position'
    let statusColor = 'bg-slate-100 text-slate-500 border-slate-200'
    if (clausePosition != null) {
        if (clausePosition < rule.minimum_position) {
            statusLabel = 'Breach'
            statusColor = 'bg-red-50 text-red-600 border-red-200'
        } else if (clausePosition === rule.ideal_position) {
            statusLabel = 'Exact match'
            statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
        } else if (clausePosition >= rule.minimum_position && clausePosition <= rule.maximum_position) {
            statusLabel = clausePosition > rule.ideal_position ? 'Above ideal' : 'Below ideal'
            statusColor = 'bg-amber-50 text-amber-700 border-amber-200'
        } else {
            statusLabel = 'Outside range'
            statusColor = 'bg-amber-50 text-amber-600 border-amber-200'
        }
    }

    const templatePct = clausePosition != null ? toPercent(clausePosition) : null
    const posLabel = clausePosition != null ? translateRulePosition(rule, clausePosition) : null

    return (
        <div className="pt-2">
            {/* Rule name + status */}
            <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700">{rule.clause_name}</div>
                    {rule.rationale && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{rule.rationale}</p>
                    )}
                </div>
                <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${statusColor}`}>
                    {statusLabel}
                </span>
            </div>

            {/* Position bar */}
            <div className="relative h-12 mt-3">
                {/* Track */}
                <div className="absolute inset-x-0 top-[22px] h-1.5 bg-slate-100 rounded-full" />
                {/* Amber market band */}
                <div className="absolute top-[19px] h-2.5 bg-amber-100 rounded-full border border-amber-300"
                    style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }} />
                {/* Ideal badge — above track, line crosses bar */}
                <div className="absolute top-0" style={{ left: `${idealPct}%`, transform: 'translateX(-50%)' }}>
                    <div className="flex flex-col items-center">
                        <span className="px-1.5 py-px text-[8px] font-bold bg-emerald-500 text-white rounded whitespace-nowrap leading-tight shadow-sm">
                            Ideal · {rule.ideal_position}
                        </span>
                        <div className="w-0 border-l-2 border-emerald-400" style={{ height: '26px' }} />
                    </div>
                </div>
                {/* Fallback badge — below track, line crosses bar */}
                <div className="absolute top-[12px]" style={{ left: `${fallbackPct}%`, transform: 'translateX(-50%)' }}>
                    <div className="flex flex-col items-center">
                        <div className="w-0 border-l-2 border-red-400" style={{ height: '18px' }} />
                        <span className="px-1.5 py-px text-[8px] font-bold bg-red-500 text-white rounded whitespace-nowrap leading-tight shadow-sm">
                            Fallback · {rule.fallback_position}
                        </span>
                    </div>
                </div>
                {/* Template clause position — indigo diamond */}
                {templatePct != null && (
                    <div className="absolute z-20"
                        style={{ left: `${templatePct}%`, top: '16px', transform: 'translateX(-50%) rotate(45deg)' }}>
                        <div className={`w-4 h-4 rounded-sm border-2 border-white shadow-md ${
                            clausePosition! >= rule.minimum_position ? 'bg-indigo-500' : 'bg-red-500'
                        }`} />
                    </div>
                )}
            </div>

            {/* Scale labels */}
            {rangeCtx && rangeCtx.scale_points.length > 0 && (
                <div className="relative h-4 text-[8px] text-slate-400 mt-0.5">
                    {rangeCtx.scale_points
                        .filter((_, i, arr) => i === 0 || i === arr.length - 1)
                        .map((sp, idx) => (
                            <span key={sp.position} className="absolute"
                                style={{ left: `${toPercent(sp.position)}%`, transform: idx === 0 ? 'none' : 'translateX(-100%)' }}>
                                {sp.label}
                            </span>
                        ))}
                </div>
            )}

            {/* Positions row */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1.5 flex-wrap">
                <span>Playbook: min {rule.minimum_position} · ideal {rule.ideal_position} · max {rule.maximum_position}</span>
                {clausePosition != null && (
                    <>
                        <span className="text-slate-300">|</span>
                        <span className={clausePosition >= rule.minimum_position ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                            Template: {clausePosition}{posLabel && posLabel !== String(clausePosition) ? ` · ${posLabel}` : ''}
                        </span>
                    </>
                )}
            </div>

            {/* Escalation callout */}
            {clausePosition != null && clausePosition < rule.minimum_position && rule.escalation_contact && (
                <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
                    Escalate to: {rule.escalation_contact}
                    {rule.escalation_contact_email && ` (${rule.escalation_contact_email})`}
                </div>
            )}
        </div>
    )
}

interface TemplatesTabProps {
    templates: CompanyTemplate[]
    isLoading: boolean
    userInfo: UserInfo | null
    playbooks: Playbook[]
    onUpload: (file: File, templateName: string, contractType: string) => Promise<string>
    onDelete: (templateId: string) => Promise<void>
    onToggleActive: (templateId: string, isActive: boolean) => Promise<void>
    onRefresh: () => void
}

function TemplatesTab({ templates, isLoading, userInfo, playbooks, onUpload, onDelete, onToggleActive, onRefresh }: TemplatesTabProps) {
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
    const [uploadLinkedPlaybookId, setUploadLinkedPlaybookId] = useState<string>('')
    const [linkingTemplateId, setLinkingTemplateId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // --- Observability: Log tab loaded ---
    useEffect(() => {
        eventLogger.completed('template_upload', 'upload_page_loaded', {
            surface: 'company_admin',
            upload_source: 'company_admin'
        })
    }, [])

    const handleEditTemplate = async (template: CompanyTemplate) => {
        if (!userInfo?.userId || !userInfo?.companyId) return
        setEditingTemplateId(template.templateId)

        try {
            const supabase = createClient()

            // Load template clauses
            const { data: templateClauses, error: tcError } = await supabase
                .from('template_clauses')
                .select('*')
                .eq('template_id', template.templateId)
                .order('display_order', { ascending: true })

            if (tcError || !templateClauses || templateClauses.length === 0) {
                throw new Error('No clauses found for this template')
            }

            // Create temporary uploaded_contracts record
            const { data: newContract, error: createError } = await supabase
                .from('uploaded_contracts')
                .insert({
                    company_id: userInfo.companyId,
                    uploaded_by_user_id: userInfo.userId,
                    contract_name: template.templateName,
                    file_name: `${template.templateName}.template`,
                    file_type: 'template',
                    file_size: 0,
                    status: 'ready',
                    clause_count: templateClauses.length,
                    contract_type_key: template.contractType,
                    detected_contract_type: template.contractType
                })
                .select('contract_id')
                .single()

            if (createError || !newContract) throw new Error('Failed to create editing session')

            // Map template_clauses → uploaded_contract_clauses (Strategy E mapping)
            const clauseCopies = templateClauses.map((tc: any, index: number) => ({
                contract_id: newContract.contract_id,
                clause_number: tc.clause_number || tc.display_number || String(index + 1),
                clause_name: tc.clause_name || 'Untitled Clause',
                category: tc.category || tc.category_name || 'Other',
                content: tc.default_text || tc.clause_content || '',
                original_text: tc.default_text || tc.clause_content || '',
                clause_level: tc.clause_level || 1,
                display_order: tc.display_order || (tc.category_order || 0) * 100 + (tc.clause_order || index),
                is_header: tc.is_header || false,
                parent_clause_id: null,
                status: tc.clarence_certified ? 'certified' : (tc.status || 'pending'),
                clarence_certified: tc.clarence_certified || false,
                clarence_position: tc.clarence_position,
                clarence_fairness: tc.clarence_fairness,
                clarence_summary: tc.clarence_summary,
                clarence_assessment: tc.clarence_assessment,
                clarence_flags: tc.clarence_flags || [],
                clarence_certified_at: tc.clarence_certified_at,
                initiator_position: tc.default_customer_position_override ?? null,
                respondent_position: tc.default_provider_position_override ?? null,
            }))

            const { error: copyError } = await supabase
                .from('uploaded_contract_clauses')
                .insert(clauseCopies)

            if (copyError) throw new Error('Failed to copy template clauses')

            // Restore range mappings from template_clauses → clause_range_mappings
            // Template clauses with range_mapping data need to be linked to the new clause IDs
            const clausesWithRangeData = templateClauses.filter((tc: any) => tc.range_mapping)
            if (clausesWithRangeData.length > 0) {
                // Fetch the newly created clause IDs so we can link range mappings
                const { data: newClauses } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('clause_id, clause_number')
                    .eq('contract_id', newContract.contract_id)

                if (newClauses && newClauses.length > 0) {
                    // Build a clause_number → new clause_id lookup
                    const clauseNumberToId = new Map<string, string>()
                    for (const nc of newClauses) {
                        clauseNumberToId.set(nc.clause_number, nc.clause_id)
                    }

                    const rangeMappingInserts = clausesWithRangeData
                        .map((tc: any) => {
                            const newClauseId = clauseNumberToId.get(tc.clause_number || tc.display_number)
                            if (!newClauseId || !tc.range_mapping) return null
                            return {
                                clause_id: newClauseId,
                                contract_id: newContract.contract_id,
                                is_displayable: tc.range_mapping.is_displayable ?? true,
                                value_type: tc.range_mapping.value_type,
                                range_unit: tc.range_mapping.range_unit,
                                industry_standard_min: tc.range_mapping.industry_standard_min,
                                industry_standard_max: tc.range_mapping.industry_standard_max,
                                range_data: tc.range_mapping.range_data
                            }
                        })
                        .filter(Boolean)

                    if (rangeMappingInserts.length > 0) {
                        await supabase
                            .from('clause_range_mappings')
                            .insert(rangeMappingInserts)
                    }
                }
            }

            router.push(`/auth/quick-contract/studio/${newContract.contract_id}?mode=template&company=true&edit_template_id=${template.templateId}`)
        } catch (e) {
            console.error('Failed to open template for editing:', e)
            setEditingTemplateId(null)
        }
    }

    // --- View / Download state ---
    const [viewingTemplate, setViewingTemplate] = useState<CompanyTemplate | null>(null)
    const [templateClauses, setTemplateClauses] = useState<Record<string, any[]>>({})
    const [clausesLoading, setClausesLoading] = useState<string | null>(null)
    const [playbookRulesCache, setPlaybookRulesCache] = useState<Record<string, PlaybookRule[]>>({})
    const [clauseActiveTab, setClauseActiveTab] = useState<Record<string, 'content' | 'playbook'>>({})

    const fetchTemplateClauses = async (templateId: string): Promise<any[]> => {
        if (templateClauses[templateId]) return templateClauses[templateId]

        setClausesLoading(templateId)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('template_clauses')
                .select('*')
                .eq('template_id', templateId)
                .order('display_order', { ascending: true })

            if (error) throw error
            const clauses = data || []
            setTemplateClauses(prev => ({ ...prev, [templateId]: clauses }))
            return clauses
        } catch (e) {
            console.error('Failed to fetch template clauses:', e)
            return []
        } finally {
            setClausesLoading(null)
        }
    }

    const fetchPlaybookRulesForType = async (contractType: string): Promise<PlaybookRule[]> => {
        if (playbookRulesCache[contractType]) return playbookRulesCache[contractType]
        if (!userInfo?.companyId) return []
        try {
            const supabase = createClient()
            const { data: pb } = await supabase
                .from('company_playbooks')
                .select('playbook_id')
                .eq('company_id', userInfo.companyId)
                .eq('is_active', true)
                .eq('contract_type_key', contractType)
                .limit(1)
                .maybeSingle()
            if (!pb?.playbook_id) return []
            const { data: rules } = await supabase
                .from('playbook_rules')
                .select('*')
                .eq('playbook_id', pb.playbook_id)
                .eq('is_active', true)
                .order('display_order', { ascending: true })
            const loadedRules = ((rules || []) as PlaybookRule[]).map(r => ({
                ...r,
                range_context: typeof r.range_context === 'string'
                    ? (() => { try { return JSON.parse(r.range_context as unknown as string) } catch { return null } })()
                    : r.range_context,
            }))
            setPlaybookRulesCache(prev => ({ ...prev, [contractType]: loadedRules }))
            return loadedRules
        } catch { return [] }
    }

    const handleViewTemplate = async (template: CompanyTemplate) => {
        await Promise.all([
            fetchTemplateClauses(template.templateId),
            fetchPlaybookRulesForType(template.contractType),
        ])
        setViewingTemplate(template)
    }

    const groupClausesByCategory = (clauses: any[]) => {
        const groups = new Map<string, { displayName: string; clauses: any[] }>()
        for (const clause of clauses) {
            const cat = clause.category || clause.category_name || 'Other'
            const normCat = normaliseCategory(cat)
            if (!groups.has(normCat)) {
                groups.set(normCat, { displayName: getCategoryDisplayName(normCat), clauses: [] })
            }
            groups.get(normCat)!.clauses.push(clause)
        }
        return Array.from(groups.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
    }

    const handleDownloadPDF = async (template: CompanyTemplate) => {
        const clauses = await fetchTemplateClauses(template.templateId)
        if (clauses.length === 0) return

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()
        const margin = 20
        const contentWidth = pageWidth - margin * 2
        let y = margin

        const checkPageBreak = (needed: number) => {
            if (y + needed > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage()
                y = margin
            }
        }

        // Header
        doc.setFontSize(20)
        doc.setFont('helvetica', 'bold')
        doc.text(template.templateName, margin, y)
        y += 10

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        const contractTypeLabel = CONTRACT_TYPE_OPTIONS.find(o => o.value === template.contractType)?.label || template.contractType
        doc.text(`${contractTypeLabel}  ·  ${template.clauseCount} clauses  ·  ${new Date(template.createdAt).toLocaleDateString()}`, margin, y)
        y += 4

        doc.setDrawColor(200, 200, 200)
        doc.line(margin, y, pageWidth - margin, y)
        y += 10
        doc.setTextColor(0, 0, 0)

        // Clauses in document order (display_order from DB)
        for (const clause of clauses) {
            const clauseText = clause.default_text || clause.clause_content || ''
            const clauseNumber = clause.clause_number || clause.display_number || ''
            const clauseName = clause.clause_name || 'Untitled'

            // Clause name
            checkPageBreak(15)
            doc.setFontSize(11)
            doc.setFont('helvetica', 'bold')
            doc.text(`${clauseNumber}${clauseNumber ? '. ' : ''}${clauseName}`, margin, y)
            y += 6

            // Clause text
            if (clauseText) {
                doc.setFontSize(9.5)
                doc.setFont('helvetica', 'normal')
                const lines = doc.splitTextToSize(clauseText, contentWidth)
                for (const line of lines) {
                    checkPageBreak(5)
                    doc.text(line, margin, y)
                    y += 4.5
                }
            }
            y += 6
        }

        doc.save(`${template.templateName}.pdf`)
    }

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

        // --- Observability: Log file selected ---
        eventLogger.completed('template_upload', 'file_selected', {
            fileName: file.name,
            fileType: file.type,
            fileSizeMb: Math.round(file.size / 1024 / 1024 * 100) / 100,
            upload_source: 'company_admin'
        })

        setSelectedFile(file)
        setTemplateName(file.name.replace(/\.[^/.]+$/, ''))
        setShowUploadForm(true)
        setUploadError(null)
    }

    // Helper: Extract text from file (FIXED - uses CDN for PDF worker)
    const extractTextFromFile = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    if (file.type === 'text/plain') {
                        resolve(event.target?.result as string)
                    } else if (file.type === 'application/pdf') {
                        const pdfjsLib = await import('pdfjs-dist')
                        // FIX: Use CDN for worker instead of local file
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
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
                } catch (err) {
                    reject(err)
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

    const handleUploadSubmit = async () => {
        if (!selectedFile || !templateName.trim()) return
        if (!userInfo?.userId || !userInfo?.companyId) {
            setUploadError('User not authenticated')
            return
        }

        setIsUploading(true)
        setUploadError(null)
        setUploadProgress('Extracting text from document...')

        try {
            // --- Observability: Log text extraction started ---
            const extractionMethod = selectedFile.type === 'application/pdf'
                ? 'pdfjs'
                : selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ? 'mammoth'
                    : 'text'
            eventLogger.started('template_upload', 'text_extraction_started', {
                fileType: selectedFile.type,
                method: extractionMethod,
                upload_source: 'company_admin'
            })

            const extractedText = await extractTextFromFile(selectedFile)

            if (!extractedText || extractedText.length < 100) {
                // --- Observability: Log extraction failed ---
                eventLogger.failed('template_upload', 'text_extraction_completed',
                    `Insufficient text: ${extractedText?.length || 0} chars`, 'EXTRACTION_INSUFFICIENT')
                throw new Error('Could not extract sufficient text from the document')
            }

            // --- Observability: Log text extraction completed ---
            eventLogger.completed('template_upload', 'text_extraction_completed', {
                charCount: extractedText.length,
                upload_source: 'company_admin'
            })

            console.log(`Extracted ${extractedText.length} characters`)
            setUploadProgress('Sending to CLARENCE for analysis...')

            // --- Observability: Log parse workflow triggered ---
            eventLogger.started('template_upload', 'parse_workflow_triggered', {
                webhookUrl: `${API_BASE}/parse-contract-document`,
                upload_source: 'company_admin'
            })

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo?.userId,
                    company_id: userInfo?.companyId,
                    document_text: extractedText,
                    file_name: selectedFile.name,
                    file_type: selectedFile.type || 'application/octet-stream',
                    file_size: selectedFile.size,
                    contract_type: contractType,
                    template_name: templateName,
                    create_as_template: true,
                    is_company_template: true
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                // --- Observability: Log parse workflow failed ---
                eventLogger.failed('template_upload', 'parse_workflow_triggered',
                    `Upload failed: ${errorText}`, `HTTP_${response.status}`)
                throw new Error(`Upload failed: ${errorText}`)
            }

            const result = await response.json()
            const contractId = result.contract_id || result.contractId

            if (!contractId) {
                // --- Observability: Log parse workflow failed ---
                eventLogger.failed('template_upload', 'parse_workflow_triggered',
                    'No contract ID returned', 'NO_CONTRACT_ID')
                throw new Error('No contract ID returned')
            }

            // --- Observability: Log parse workflow completed ---
            eventLogger.completed('template_upload', 'parse_workflow_triggered', {
                contractId,
                upload_source: 'company_admin'
            })

            setIsProcessing(true)
            setUploadProgress('Processing clauses...')

            // --- Observability: Log polling started ---
            eventLogger.started('template_upload', 'parse_polling_started', {
                contractId,
                upload_source: 'company_admin'
            })

            const supabase = createClient()
            let attempts = 0
            const maxAttempts = 30

            while (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 2000))
                const { data } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('clause_id')
                    .eq('contract_id', contractId)

                const clauseCount = data?.length || 0
                setUploadProgress(`Processing clauses... ${clauseCount} found`)

                if (clauseCount >= 3) {
                    // --- Observability: Log parse completed (success) ---
                    eventLogger.completed('template_upload', 'parse_completed', {
                        clauseCount,
                        contractId,
                        upload_source: 'company_admin'
                    })
                    break
                }
                attempts++
            }

            if (attempts >= maxAttempts) {
                // --- Observability: Log parse completed (timeout) ---
                eventLogger.failed('template_upload', 'parse_completed',
                    `Polling timed out after ${maxAttempts} attempts`, 'POLLING_TIMEOUT')
            }

            setUploadProgress('Redirecting to certification studio...')
            const studioUrl = uploadLinkedPlaybookId
                ? `/auth/quick-contract/studio/${contractId}?mode=template&company=true&linked_playbook_id=${uploadLinkedPlaybookId}`
                : `/auth/quick-contract/studio/${contractId}?mode=template&company=true`
            router.push(studioUrl)

        } catch (e) {
            console.error('Upload error:', e)
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
                                <p className="text-sm text-slate-500">{((selectedFile?.size || 0) / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., Standard MSA v2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contract Type</label>
                                <select
                                    value={contractType}
                                    onChange={(e) => setContractType(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {CONTRACT_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Link to Playbook
                                    <span className="ml-1.5 text-xs font-normal text-slate-400">(optional — sets compliance benchmark)</span>
                                </label>
                                <select
                                    value={uploadLinkedPlaybookId}
                                    onChange={(e) => setUploadLinkedPlaybookId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">— No playbook —</option>
                                    {playbooks.filter(p => p.isActive && p.rulesExtracted > 0).map(p => (
                                        <option key={p.playbookId} value={p.playbookId}>
                                            {p.playbookName}{p.contractTypeKey ? ` (${CONTRACT_TYPE_OPTIONS.find(o => o.value === p.contractTypeKey)?.label || p.contractTypeKey})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {uploadProgress && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm text-blue-700">{uploadProgress}</span>
                                </div>
                            </div>
                        )}

                        {uploadError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {uploadError}
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleUploadSubmit}
                                disabled={isUploading || !templateName.trim()}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? 'Processing...' : 'Upload & Certify'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowUploadForm(false)
                                    setSelectedFile(null)
                                    setTemplateName('')
                                    setUploadError(null)
                                    setUploadProgress('')
                                    setUploadLinkedPlaybookId('')
                                }}
                                disabled={isUploading}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Templates List */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Company Templates ({templates.length})</h3>
                <button onClick={onRefresh} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="font-medium">No company templates yet</p>
                    <p className="text-sm mt-1">Upload your first template above</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {templates.map((template) => (
                        <div key={template.templateId} className={`p-4 rounded-xl border ${template.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xl ${template.isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                        {CONTRACT_TYPE_ICONS[template.contractType] || '📄'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 truncate">{template.templateName}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {getStatusBadge(template)}
                                            <span className="text-xs text-slate-500">{template.clauseCount} clauses</span>
                                            {template.timesUsed > 0 && <span className="text-xs text-slate-500">Used {template.timesUsed}x</span>}
                                            {/* Playbook link indicator / editor */}
                                            {linkingTemplateId === template.templateId ? (
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        className="text-xs border border-indigo-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                                                        defaultValue={template.linkedPlaybookId || ''}
                                                        autoFocus
                                                        onChange={async (e) => {
                                                            const val = e.target.value || null
                                                            const supabase = createClient()
                                                            await supabase.from('contract_templates').update({ linked_playbook_id: val }).eq('template_id', template.templateId)
                                                            setLinkingTemplateId(null)
                                                            onRefresh()
                                                        }}
                                                        onBlur={() => setLinkingTemplateId(null)}
                                                    >
                                                        <option value="">— No playbook —</option>
                                                        {playbooks.filter(p => p.isActive && p.rulesExtracted > 0).map(p => (
                                                            <option key={p.playbookId} value={p.playbookId}>
                                                                {p.playbookName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setLinkingTemplateId(template.templateId)}
                                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                                                    title="Link this template to a playbook for compliance checking"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                    {template.linkedPlaybookId
                                                        ? (playbooks.find(p => p.playbookId === template.linkedPlaybookId)?.playbookName || 'Linked playbook')
                                                        : 'Link playbook'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {template.status === 'ready' && template.clauseCount > 0 && (
                                        <button
                                            onClick={() => handleEditTemplate(template)}
                                            disabled={editingTemplateId === template.templateId}
                                            className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {editingTemplateId === template.templateId ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                    Opening...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    Edit
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {template.status === 'ready' && template.clauseCount > 0 && (
                                        <>
                                            <button
                                                onClick={() => handleViewTemplate(template)}
                                                disabled={clausesLoading === template.templateId}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {clausesLoading === template.templateId ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                )}
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleDownloadPDF(template)}
                                                disabled={clausesLoading === template.templateId}
                                                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                                                title="Download as PDF"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                PDF
                                            </button>
                                        </>
                                    )}
                                    {template.isActive ? (
                                        <button onClick={() => onToggleActive(template.templateId, false)} className="px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Deactivate</button>
                                    ) : (
                                        <button onClick={() => onToggleActive(template.templateId, true)} className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Activate</button>
                                    )}
                                    {showDeleteConfirm === template.templateId ? (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { onDelete(template.templateId); setShowDeleteConfirm(null) }} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Delete</button>
                                            <button onClick={() => setShowDeleteConfirm(null)} className="px-2 py-1 text-xs bg-slate-200 rounded">Cancel</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowDeleteConfirm(template.templateId)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* View Template Modal */}
            {viewingTemplate && templateClauses[viewingTemplate.templateId] && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">{viewingTemplate.templateName}</h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                                    <span>{CONTRACT_TYPE_OPTIONS.find(o => o.value === viewingTemplate.contractType)?.label || viewingTemplate.contractType}</span>
                                    <span>&middot;</span>
                                    <span>{viewingTemplate.clauseCount} clauses</span>
                                    <span>&middot;</span>
                                    <span>{new Date(viewingTemplate.createdAt).toLocaleDateString()}</span>
                                    {(playbookRulesCache[viewingTemplate.contractType]?.length ?? 0) > 0 && (
                                        <>
                                            <span>&middot;</span>
                                            <span className="flex items-center gap-1 text-indigo-600 font-medium text-xs">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                                Playbook active · {playbookRulesCache[viewingTemplate.contractType].length} rules
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingTemplate(null)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                            >
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body - clauses in document order */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {(() => {
                                const rules = playbookRulesCache[viewingTemplate.contractType] || []
                                return templateClauses[viewingTemplate.templateId].map((clause: any, idx: number) => {
                                    const clauseId = clause.template_clause_id || String(idx)
                                    const activeTab = clauseActiveTab[clauseId] || 'content'
                                    const clauseCat = normaliseCategory(clause.category_name || clause.category || '')
                                    const matchedRule = rules.find(r => normaliseCategory(r.category) === clauseCat)

                                    return (
                                        <div key={clauseId} className="rounded-lg border border-slate-200 overflow-hidden">
                                            {/* Clause header */}
                                            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {clause.clause_number || clause.display_number || ''}{(clause.clause_number || clause.display_number) ? '. ' : ''}{clause.clause_name || 'Untitled'}
                                                    </span>
                                                    {clause.clarence_position != null && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded">
                                                            Position {clause.clarence_position}
                                                        </span>
                                                    )}
                                                    {clause.category_name && (
                                                        <span className="px-1.5 py-0.5 text-[10px] text-slate-400 bg-slate-50 rounded border border-slate-200">
                                                            {getCategoryDisplayName(clauseCat)}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Tab switcher — always visible */}
                                                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 flex-shrink-0 ml-2">
                                                    <button
                                                        onClick={() => setClauseActiveTab(prev => ({ ...prev, [clauseId]: 'content' }))}
                                                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                                            activeTab === 'content'
                                                                ? 'bg-white text-slate-800 shadow-sm'
                                                                : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                    >
                                                        Content
                                                    </button>
                                                    <button
                                                        onClick={() => setClauseActiveTab(prev => ({ ...prev, [clauseId]: 'playbook' }))}
                                                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1 ${
                                                            activeTab === 'playbook'
                                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                                : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                        </svg>
                                                        Playbook
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tab content */}
                                            <div className="px-4 pb-4">
                                                {activeTab === 'content' ? (
                                                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                        {clause.default_text || clause.clause_content || 'No content available'}
                                                    </p>
                                                ) : matchedRule ? (
                                                    <PlaybookAlignmentTab
                                                        rule={matchedRule}
                                                        clausePosition={clause.clarence_position ?? null}
                                                    />
                                                ) : (
                                                    <div className="py-3 text-center text-[11px] text-slate-400">
                                                        {rules.length === 0
                                                            ? 'No active playbook found for this contract type'
                                                            : `No playbook rule for "${getCategoryDisplayName(clauseCat) || clause.category_name || 'this category'}"`}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 flex-shrink-0">
                            <button
                                onClick={() => { handleDownloadPDF(viewingTemplate); }}
                                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download PDF
                            </button>
                            <button
                                onClick={() => setViewingTemplate(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 6: PEOPLE TAB COMPONENT (consolidates Users + Training Access)
// ============================================================================

const CLARENCE_ROLES: Array<{
    value: ClarenceRole
    label: string
    color: string
    bgColor: string
    description: string
    canApprove: boolean
    accessSummary: string
}> = [
    { value: 'admin', label: 'Admin', color: 'text-purple-700', bgColor: 'bg-purple-100',
      description: 'Full platform control — manage users, templates, playbooks, and all company settings.',
      canApprove: true, accessSummary: 'All access + user management' },
    { value: 'template_manager', label: 'Legal Operations Manager', color: 'text-blue-700', bgColor: 'bg-blue-100',
      description: 'Oversees contract and playbook governance — uploads, maintains and activates templates and playbooks across the organisation.',
      canApprove: true, accessSummary: 'Templates, playbooks, contracts + approval authority' },
    { value: 'hr_manager', label: 'HR Manager', color: 'text-teal-700', bgColor: 'bg-teal-100',
      description: 'Manages user onboarding, training access and team compliance visibility.',
      canApprove: false, accessSummary: 'People, training, compliance reports' },
    { value: 'senior_negotiator', label: 'Senior Negotiator', color: 'text-indigo-700', bgColor: 'bg-indigo-100',
      description: 'Leads contract negotiations, reviews junior work, and gives final approvals.',
      canApprove: true, accessSummary: 'All contracts + approval authority' },
    { value: 'negotiator', label: 'Negotiator', color: 'text-emerald-700', bgColor: 'bg-emerald-100',
      description: 'Negotiates and manages contracts end-to-end within the platform.',
      canApprove: false, accessSummary: 'Contracts, quick contracts, analysis' },
    { value: 'trainee', label: 'Trainee', color: 'text-amber-700', bgColor: 'bg-amber-100',
      description: 'Training-track access. Can observe contracts and complete training modules.',
      canApprove: false, accessSummary: 'Training studio, read-only contracts' },
]

const DEMO_STATS = {
    totalSessions: 47,
    complianceRate: 94,
    avgPositionScore: 8.2,
    clausesReviewed: 312,
    monthlyActivity: [
        { month: 'Oct', sessions: 6 },
        { month: 'Nov', sessions: 9 },
        { month: 'Dec', sessions: 5 },
        { month: 'Jan', sessions: 11 },
        { month: 'Feb', sessions: 8 },
        { month: 'Mar', sessions: 8 },
    ],
    categoryBreakdown: [
        { category: 'Liability', compliance: 96 },
        { category: 'IP & Data', compliance: 91 },
        { category: 'Payment', compliance: 98 },
        { category: 'Termination', compliance: 89 },
        { category: 'Dispute Resolution', compliance: 95 },
    ],
    areasToWatch: [
        'Limitation of liability caps — occasionally accepting positions below fallback threshold',
        'IP ownership provisions — sub-contractor clauses may need tightening',
    ],
}

type TrainingType = 'training_partner' | 'training_admin' | 'ai_enabled'

const TRAINING_OPTIONS: Array<{ value: TrainingType; label: string; description: string }> = [
    { value: 'training_partner', label: 'Training Partner',
      description: 'Can join training sessions as a participant and access shared learning materials.' },
    { value: 'training_admin', label: 'Training Admin',
      description: 'Can create training sessions and invite other participants.' },
    { value: 'ai_enabled', label: 'AI Enabled',
      description: 'Can use AI-assisted features including AI roleplay scenarios and automated feedback.' },
]

interface Person {
    email: string
    fullName: string
    // From company_users
    systemUserId?: string
    userId?: string
    role?: ClarenceRole
    systemStatus?: 'invited' | 'active' | 'suspended' | 'removed'
    systemInvitedAt?: string
    lastActiveAt?: string
    // From approved_training_users (one row per type — multiple allowed)
    trainingTypes: TrainingType[]
    trainingIds: Partial<Record<TrainingType, string>>   // type → DB row ID
    trainingStatus?: 'pending' | 'active' | 'suspended' | 'expired'
    sessionsCompleted?: number
    trainingInvitationSent?: boolean
    // Derived
    healthSignal: 'green' | 'amber' | 'red'
    isDemo?: boolean
}

const DEMO_PERSON: Person = {
    email: 'alex.morgan@acme-corp.com',
    fullName: 'Alex Morgan',
    role: 'senior_negotiator',
    systemStatus: 'active',
    healthSignal: 'green',
    sessionsCompleted: 47,
    trainingTypes: [],
    trainingIds: {},
    isDemo: true,
}

function deriveHealthSignal(p: Omit<Person, 'healthSignal'>): 'green' | 'amber' | 'red' {
    if (p.systemStatus === 'suspended') return 'red'
    if (p.systemStatus === 'active') return 'green'
    if (p.systemStatus === 'invited') return 'amber'
    if (p.trainingStatus === 'active') return 'green'
    return 'amber'
}

function mergePeople(companyUsers: CompanyUser[], trainingUsers: TrainingUser[]): Person[] {
    const map = new Map<string, Person>()
    companyUsers.forEach(u => {
        if (!u.email) return
        const key = u.email.toLowerCase()
        const base: Omit<Person, 'healthSignal'> = {
            email: u.email, fullName: u.fullName,
            systemUserId: u.id, userId: u.userId,
            role: u.role, systemStatus: u.status,
            systemInvitedAt: u.invitedAt, lastActiveAt: u.lastActiveAt,
            trainingTypes: [], trainingIds: {},
        }
        map.set(key, { ...base, healthSignal: deriveHealthSignal(base) })
    })
    trainingUsers.forEach(u => {
        if (!u.email) return
        const key = u.email.toLowerCase()
        const type = u.approvalType as TrainingType
        const existing = map.get(key)
        if (existing) {
            if (!existing.trainingTypes.includes(type)) existing.trainingTypes.push(type)
            existing.trainingIds[type] = u.id
            existing.trainingStatus = u.status
            existing.sessionsCompleted = u.sessionsCompleted
            existing.trainingInvitationSent = u.invitationSent
            existing.healthSignal = deriveHealthSignal(existing)
        } else {
            const base: Omit<Person, 'healthSignal'> = {
                email: u.email, fullName: u.fullName,
                trainingTypes: [type], trainingIds: { [type]: u.id },
                trainingStatus: u.status, sessionsCompleted: u.sessionsCompleted,
                trainingInvitationSent: u.invitationSent,
            }
            map.set(key, { ...base, healthSignal: deriveHealthSignal(base) })
        }
    })
    return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))
}

function getRoleDef(role?: ClarenceRole) {
    return CLARENCE_ROLES.find(r => r.value === role)
}

// ============================================================================
// USER PROFILE MODAL
// ============================================================================

interface UserProfileModalProps {
    person: Person
    onClose: () => void
}

function UserProfileModal({ person, onClose }: UserProfileModalProps) {
    const roleDef = getRoleDef(person.role)
    const stats = person.isDemo ? DEMO_STATS : null
    const maxActivity = stats ? Math.max(...stats.monthlyActivity.map(m => m.sessions)) : 1
    const initials = person.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md flex-shrink-0">
                            <span className="text-white font-bold text-xl">{initials}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-800">{person.fullName}</h2>
                                {person.isDemo && <span className="text-xs text-slate-400 font-normal">(Demo)</span>}
                            </div>
                            <p className="text-sm text-slate-500">{person.email}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                {roleDef && (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleDef.bgColor} ${roleDef.color}`}>
                                        {roleDef.label}
                                    </span>
                                )}
                                <span className={`inline-flex items-center gap-1 text-xs ${person.healthSignal === 'green' ? 'text-emerald-600' : person.healthSignal === 'amber' ? 'text-amber-600' : 'text-red-600'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${person.healthSignal === 'green' ? 'bg-emerald-400' : person.healthSignal === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                    {person.systemStatus === 'active' ? 'Active' : person.systemStatus === 'invited' ? 'Invite pending' : person.systemStatus || 'No access'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Role Description */}
                    {roleDef && (
                        <div className={`p-4 rounded-xl border ${roleDef.bgColor}`}>
                            <p className="text-sm font-medium text-slate-700">{roleDef.description}</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Access: {roleDef.accessSummary}
                                {roleDef.canApprove && <span className="ml-2 text-indigo-600">· Can approve contracts</span>}
                            </p>
                        </div>
                    )}

                    {stats ? (
                        <>
                            {/* Stat Cards */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                    { label: 'Sessions', value: stats.totalSessions, sub: 'total' },
                                    { label: 'Compliance', value: `${stats.complianceRate}%`, sub: 'avg rate' },
                                    { label: 'Avg Score', value: stats.avgPositionScore, sub: 'position' },
                                    { label: 'Clauses', value: stats.clausesReviewed, sub: 'reviewed' },
                                ].map(s => (
                                    <div key={s.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                                        <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                                        <p className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</p>
                                        <p className="text-xs text-slate-400">{s.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Activity Chart */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Monthly Activity</h4>
                                <div className="flex items-end gap-2 h-28 px-2">
                                    {stats.monthlyActivity.map(m => (
                                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-xs text-slate-500 font-medium">{m.sessions}</span>
                                            <div
                                                className="w-full bg-indigo-500 rounded-t-md transition-all"
                                                style={{ height: `${Math.round((m.sessions / maxActivity) * 64)}px` }}
                                            />
                                            <span className="text-xs text-slate-400">{m.month}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Category Compliance */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Compliance by Category</h4>
                                <div className="space-y-2.5">
                                    {stats.categoryBreakdown.map(c => (
                                        <div key={c.category} className="flex items-center gap-3">
                                            <span className="text-xs text-slate-600 w-28 flex-shrink-0">{c.category}</span>
                                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${c.compliance >= 90 ? 'bg-emerald-500' : c.compliance >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${c.compliance}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600 w-8 text-right">{c.compliance}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Areas to Watch */}
                            {stats.areasToWatch.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Areas to Watch</h4>
                                    <ul className="space-y-2">
                                        {stats.areasToWatch.map((a, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                                {a}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            {person.sessionsCompleted !== undefined && person.sessionsCompleted > 0 && (
                                <div className="mb-4">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 mb-2">
                                        <span className="text-2xl font-bold text-indigo-600">{person.sessionsCompleted}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium">Training sessions completed</p>
                                </div>
                            )}
                            <p className="text-sm">Detailed activity analytics coming soon</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// PERSON FORM MODAL (shared by Add and Edit)
// ============================================================================

interface PersonFormModalProps {
    editingPerson?: Person
    isCurrentUserAdmin: boolean
    onAdd: (email: string, fullName: string, role: string, trainingTypes: TrainingType[]) => Promise<void>
    onUpdate: (systemUserId: string, fullName: string, role: string, trainingTypes: TrainingType[], trainingIds: Partial<Record<TrainingType, string>>) => Promise<void>
    onClose: () => void
}

function PersonFormModal({ editingPerson, isCurrentUserAdmin, onAdd, onUpdate, onClose }: PersonFormModalProps) {
    const isEditing = !!editingPerson
    const [email, setEmail] = useState(editingPerson?.email ?? '')
    const [fullName, setFullName] = useState(editingPerson?.fullName ?? '')
    const [role, setRole] = useState<ClarenceRole>(editingPerson?.role ?? 'negotiator')
    const [selectedTypes, setSelectedTypes] = useState<Set<TrainingType>>(new Set(editingPerson?.trainingTypes ?? []))
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const roleDef = CLARENCE_ROLES.find(r => r.value === role)

    // Always include the person's current role in the list so it renders correctly when editing
    const baseRoles = isCurrentUserAdmin ? CLARENCE_ROLES : CLARENCE_ROLES.filter(r => r.value !== 'admin')
    const availableRoles = (isEditing && editingPerson.role && !baseRoles.find(r => r.value === editingPerson.role))
        ? [CLARENCE_ROLES.find(r => r.value === editingPerson.role)!, ...baseRoles]
        : baseRoles

    const toggleType = (t: TrainingType) => {
        setSelectedTypes(prev => {
            const next = new Set(prev)
            next.has(t) ? next.delete(t) : next.add(t)
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        setIsSubmitting(true)
        try {
            const types = Array.from(selectedTypes)
            if (isEditing && editingPerson.systemUserId) {
                await onUpdate(editingPerson.systemUserId, fullName, role, types, editingPerson.trainingIds)
            } else {
                await onAdd(email, fullName, role, types)
            }
            onClose()
        } catch (e) {
            setFormError(e instanceof Error ? e.message : 'Failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="text-base font-semibold text-slate-800">{isEditing ? `Edit ${editingPerson.fullName}` : 'New Person'}</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            {isEditing ? (
                                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">{email}</p>
                            ) : (
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="user@company.com" />
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Jane Smith" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value as ClarenceRole)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                            {availableRoles.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                        {roleDef && (
                            <div className={`mt-2 p-3 rounded-lg ${roleDef.bgColor}`}>
                                <p className="text-xs font-medium text-slate-700">{roleDef.description}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Access: {roleDef.accessSummary}
                                    {roleDef.canApprove && <span className="ml-1 text-indigo-600">· Can approve contracts</span>}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Training Studio — multi-select checkboxes */}
                    <div className="border-t border-slate-200 pt-4">
                        <p className="text-sm font-medium text-slate-700 mb-3">Training Studio Access</p>
                        <div className="space-y-2">
                            {TRAINING_OPTIONS.map(opt => (
                                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedTypes.has(opt.value) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedTypes.has(opt.value)}
                                        onChange={() => toggleType(opt.value)}
                                        className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded flex-shrink-0"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {formError && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{formError}</div>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add & Send Invite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ============================================================================
// PEOPLE TAB
// ============================================================================

interface PeopleTabProps {
    companyUsers: CompanyUser[]
    trainingUsers: TrainingUser[]
    isLoading: boolean
    isCurrentUserAdmin: boolean
    onAddPerson: (email: string, fullName: string, role: string, trainingTypes: TrainingType[]) => Promise<void>
    onUpdatePerson: (systemUserId: string, fullName: string, role: string, trainingTypes: TrainingType[], trainingIds: Partial<Record<TrainingType, string>>) => Promise<void>
    onRemoveSystemUser: (id: string) => Promise<void>
    onRemoveTrainingUser: (id: string) => Promise<void>
    onSendSystemInvite: (id: string, email: string) => Promise<void>
    onSendTrainingInvite: (id: string, email: string) => Promise<void>
    onUpdateRole: (id: string, role: string) => Promise<void>
    onRefresh: () => void
}

function PeopleTab({ companyUsers, trainingUsers, isLoading, isCurrentUserAdmin, onAddPerson, onUpdatePerson, onRemoveSystemUser, onRemoveTrainingUser, onSendSystemInvite, onSendTrainingInvite, onUpdateRole, onRefresh }: PeopleTabProps) {
    const [showForm, setShowForm] = useState(false)
    const [editingPerson, setEditingPerson] = useState<Person | undefined>(undefined)
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)

    const people = mergePeople(companyUsers, trainingUsers)
    const allPeople = [DEMO_PERSON, ...people]
    const activeCount = people.filter(p => p.healthSignal === 'green').length
    const pendingCount = people.filter(p => p.healthSignal === 'amber').length

    const openAdd = () => { setEditingPerson(undefined); setShowForm(true) }
    const openEdit = (person: Person) => { setEditingPerson(person); setShowForm(true) }
    const closeForm = () => { setShowForm(false); setEditingPerson(undefined) }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">People</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {people.length} {people.length === 1 ? 'person' : 'people'}
                        {' · '}<span className="text-emerald-600">{activeCount} active</span>
                        {' · '}<span className="text-amber-600">{pendingCount} pending</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onRefresh} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                    <button onClick={openAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                        + Add Person
                    </button>
                </div>
            </div>

            {/* Roster */}
            {isLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <div className="w-3 flex-shrink-0" />
                        <div className="flex-1 min-w-0">Person</div>
                        <div className="w-36 flex-shrink-0">Role</div>
                        <div className="w-28 flex-shrink-0">Training</div>
                        <div className="w-20 flex-shrink-0 text-center">Sessions</div>
                        <div className="w-32 flex-shrink-0 text-right">Actions</div>
                    </div>

                    {allPeople.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <p>No people yet. Add your first team member.</p>
                        </div>
                    ) : allPeople.map((person) => {
                        const roleDef = getRoleDef(person.role)
                        return (
                            <div
                                key={person.email}
                                className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
                                onClick={() => setSelectedPerson(person)}
                            >
                                <div className="w-3 flex-shrink-0">
                                    <span className={`block w-2.5 h-2.5 rounded-full ${person.healthSignal === 'green' ? 'bg-emerald-400' : person.healthSignal === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 text-sm truncate group-hover:text-indigo-700 transition-colors">
                                        {person.fullName}
                                        {person.isDemo && <span className="ml-1.5 text-xs text-slate-400 font-normal">(Demo)</span>}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">{person.email}</p>
                                </div>
                                <div className="w-36 flex-shrink-0">
                                    {roleDef ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleDef.bgColor} ${roleDef.color}`}>
                                            {roleDef.label}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-300">no access</span>
                                    )}
                                </div>
                                <div className="w-28 flex-shrink-0">
                                    {person.trainingTypes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {person.trainingTypes.slice(0, 2).map(t => (
                                                <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                                                    {t === 'training_partner' ? 'Partner' : t === 'training_admin' ? 'Admin' : 'AI'}
                                                </span>
                                            ))}
                                            {person.trainingTypes.length > 2 && (
                                                <span className="text-xs text-slate-400">+{person.trainingTypes.length - 2}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-300">—</span>
                                    )}
                                </div>
                                <div className="w-20 flex-shrink-0 text-center">
                                    {person.sessionsCompleted !== undefined
                                        ? <span className="text-sm font-medium text-slate-700">{person.sessionsCompleted}</span>
                                        : <span className="text-xs text-slate-300">—</span>
                                    }
                                </div>
                                <div className="w-32 flex-shrink-0 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                    {!person.isDemo && (
                                        <>
                                            {person.systemUserId && (
                                                <button onClick={() => openEdit(person)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Edit</button>
                                            )}
                                            {person.systemStatus === 'invited' && person.systemUserId && (
                                                <button onClick={() => onSendSystemInvite(person.systemUserId!, person.email)} className="text-xs text-slate-500 hover:text-slate-700">Resend</button>
                                            )}
                                            {person.trainingTypes.length > 0 && !person.trainingInvitationSent && (
                                                <button onClick={() => { const firstId = Object.values(person.trainingIds)[0]; if (firstId) onSendTrainingInvite(firstId, person.email) }} className="text-xs text-slate-500 hover:text-slate-700">Invite</button>
                                            )}
                                            {(person.systemUserId || person.trainingTypes.length > 0) && (
                                                <button
                                                    onClick={() => person.systemUserId ? onRemoveSystemUser(person.systemUserId) : Object.values(person.trainingIds).forEach(id => id && onRemoveTrainingUser(id))}
                                                    className="text-xs text-red-500 hover:text-red-700"
                                                >Remove</button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {showForm && (
                <PersonFormModal
                    editingPerson={editingPerson}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    onAdd={onAddPerson}
                    onUpdate={onUpdatePerson}
                    onClose={closeForm}
                />
            )}

            {selectedPerson && (
                <UserProfileModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
            )}
        </div>
    )
}

// ============================================================================
// SECTION 8: AUDIT LOG TAB COMPONENT
// ============================================================================

interface AuditEntry {
    log_id: string
    event_type: string
    event_description: string
    actor_email?: string
    actor_name?: string
    resource_name?: string
    created_at: string
}

function getEventStyle(eventType: string): { color: string; bgColor: string; label: string } {
    if (eventType === 'playbook_breach')     return { color: 'text-red-700',     bgColor: 'bg-red-100',     label: 'Breach'    }
    if (eventType.startsWith('playbook_'))   return { color: 'text-blue-700',    bgColor: 'bg-blue-100',    label: 'Playbook'  }
    if (eventType.startsWith('template_'))   return { color: 'text-emerald-700', bgColor: 'bg-emerald-100', label: 'Template'  }
    if (eventType.startsWith('user_'))       return { color: 'text-purple-700',  bgColor: 'bg-purple-100',  label: 'People'    }
    return                                          { color: 'text-slate-700',   bgColor: 'bg-slate-100',   label: 'System'    }
}

function formatRelativeTime(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7)  return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AuditEventIcon({ eventType }: { eventType: string }) {
    if (eventType === 'playbook_breach')
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    if (eventType.startsWith('playbook_'))
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    if (eventType.startsWith('template_'))
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    if (eventType.startsWith('user_'))
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

interface AuditLogTabProps { companyId: string }

function AuditLogTab({ companyId }: AuditLogTabProps) {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('all')

    const loadEntries = useCallback(async () => {
        if (!companyId) { setIsLoading(false); return }
        setIsLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('company_audit_log')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(200)
        setEntries(data || [])
        setIsLoading(false)
    }, [companyId])

    useEffect(() => { loadEntries() }, [loadEntries])

    const FILTERS = [
        { value: 'all',             label: 'All'       },
        { value: 'playbook_',       label: 'Playbooks' },
        { value: 'template_',       label: 'Templates' },
        { value: 'user_',           label: 'People'    },
        { value: 'playbook_breach', label: 'Breaches'  },
    ]

    const filtered = activeFilter === 'all'
        ? entries
        : entries.filter(e => e.event_type.startsWith(activeFilter))

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Audit Log</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {entries.length} {entries.length === 1 ? 'event' : 'events'} recorded
                    </p>
                </div>
                <button onClick={loadEntries} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            <div className="flex gap-2 mb-5 flex-wrap">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => setActiveFilter(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >{f.label}</button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="font-medium">No events yet</p>
                    <p className="text-sm mt-1">Admin actions will appear here as they happen.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(entry => {
                        const style = getEventStyle(entry.event_type)
                        return (
                            <div key={entry.log_id} className="flex items-start gap-3 px-4 py-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${style.bgColor} ${style.color}`}>
                                    <AuditEventIcon eventType={entry.event_type} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800">{entry.event_description}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {entry.actor_name || entry.actor_email || 'System'}
                                        {' · '}{formatRelativeTime(entry.created_at)}
                                    </p>
                                </div>
                                <span className={`flex-shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${style.bgColor} ${style.color}`}>
                                    {style.label}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 9: MAIN COMPANY ADMIN CONTENT
// ============================================================================

function CompanyAdminContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [companyName, setCompanyName] = useState('')
    const initialTab = (searchParams.get('tab') as AdminTab) || 'insights'
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
    const [isAdmin, setIsAdmin] = useState(false)
    const [playbooks, setPlaybooks] = useState<Playbook[]>([])
    const [playbooksLoading, setPlaybooksLoading] = useState(false)
    const [companyTemplates, setCompanyTemplates] = useState<CompanyTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [trainingUsers, setTrainingUsers] = useState<TrainingUser[]>([])
    const [trainingLoading, setTrainingLoading] = useState(false)
    const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
    const [usersLoading, setUsersLoading] = useState(false)

    // Chat panel state
    const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }[]>([
        { id: 'welcome', role: 'assistant', content: 'Welcome to Company Admin. I can help you with template management, playbook configuration, user access, and training setup. What would you like to know?', timestamp: new Date() }
    ])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

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
            setPlaybooks((data || []).map(p => ({ playbookId: p.playbook_id, playbookName: p.playbook_name, playbookVersion: p.playbook_version, playbookDescription: p.playbook_description, playbookSummary: p.playbook_summary, status: p.status, isActive: p.is_active || false, contractTypeKey: p.contract_type_key || null, playbookPerspective: p.playbook_perspective || 'customer', sourceFileName: p.source_file_name, sourceFilePath: p.source_file_path, rulesExtracted: p.rules_extracted || 0, aiConfidenceScore: p.ai_confidence_score, effectiveDate: p.effective_date, expiryDate: p.expiry_date, createdAt: p.created_at, createdBy: p.created_by, parsingError: p.parsing_error })))
        } catch (e) { console.error('Load playbooks error:', e); setPlaybooks([]) } finally { setPlaybooksLoading(false) }
    }, [])

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
                sourceFileName: t.source_file_name,
                linkedPlaybookId: t.linked_playbook_id || null,
            })))
        } catch (e) { console.error('Load templates error:', e); setCompanyTemplates([]) } finally { setTemplatesLoading(false) }
    }, [])

    const loadTrainingUsers = useCallback(async (companyId: string) => {
        setTrainingLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('approved_training_users').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
            if (error) { if (error.code === '42P01') { setTrainingUsers([]); return }; throw error }
            setTrainingUsers((data || []).map(u => ({ id: u.id, userId: u.user_id, email: u.user_email, fullName: u.user_full_name, approvalType: u.approval_type, status: u.status, invitedAt: u.created_at, approvedAt: u.approved_at, sessionsCompleted: u.sessions_completed || 0, invitationSent: u.invitation_sent || false })))
        } catch (e) { console.error('Load training users error:', e); setTrainingUsers([]) } finally { setTrainingLoading(false) }
    }, [])

    const loadCompanyUsers = useCallback(async (companyId: string) => {
        setUsersLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('company_users').select('*').eq('company_id', companyId).neq('status', 'removed').order('created_at', { ascending: false })
            if (error) { if (error.code === '42P01') { setCompanyUsers([]); return }; throw error }
            setCompanyUsers((data || []).map(u => ({ id: u.company_user_id, userId: u.user_id, email: u.email, fullName: u.full_name, role: u.role, status: u.status, approvalRole: u.approval_role || 'negotiator', invitedAt: u.invited_at || u.created_at, lastActiveAt: u.last_active_at })))
        } catch (e) { console.error('Load company users error:', e); setCompanyUsers([]) } finally { setUsersLoading(false) }
    }, [])


    // -------------------------------------------------------------------------
    // AUDIT LOGGING HELPER
    // -------------------------------------------------------------------------
    const logAdminAction = async (eventType: string, description: string, resourceName?: string) => {
        if (!userInfo?.companyId) return
        try {
            const supabase = createClient()
            const actorName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email
            await supabase.from('company_audit_log').insert({
                company_id: userInfo.companyId,
                event_type: eventType,
                event_description: description,
                actor_email: userInfo.email,
                actor_name: actorName,
                resource_name: resourceName ?? null,
            })
        } catch { /* never let audit logging block the primary action */ }
    }

    const handlePlaybookUpload = async (file: File, contractTypeKey: string | null = null, perspective: 'customer' | 'provider' = 'customer') => {
        if (!userInfo?.companyId) return
        const supabase = createClient()
        let companyId = userInfo.companyId
        if (!companyId) { const { data } = await supabase.from('companies').select('company_id').limit(1).single(); companyId = data?.company_id }
        if (!companyId) { const { data, error } = await supabase.from('companies').insert({ company_name: userInfo?.company || 'My Company' }).select('company_id').single(); if (error) throw new Error(error.message); companyId = data?.company_id }
        const fileName = `${companyId}/${Date.now()}.${file.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage.from('playbooks').upload(fileName, file)
        if (uploadError) throw new Error(uploadError.message)
        const playbookName = file.name.replace(/\.[^/.]+$/, '')
        const { error: insertError } = await supabase.from('company_playbooks').insert({
            company_id: companyId,
            playbook_name: playbookName,
            source_file_name: file.name,
            source_file_path: fileName,
            status: 'pending_parse',
            created_by_user_id: userInfo?.userId,
            contract_type_key: contractTypeKey,
            playbook_perspective: perspective,
        })
        if (insertError) throw new Error(insertError.message)
        await logAdminAction('playbook_added', `Playbook uploaded: "${playbookName}"`, playbookName)
        await loadPlaybooks(companyId!)
    }

    const handlePlaybookParse = async (playbookId: string, sourceFilePath: string, sourceFileName: string) => {
        console.log('=== handlePlaybookParse (CLIENT-SIDE EXTRACTION) ===', playbookId, sourceFilePath)

        if (!sourceFilePath) {
            throw new Error('No source file path available for this playbook')
        }

        const supabase = createClient()

        // Step 1: Update status to parsing
        await supabase.from('company_playbooks').update({
            status: 'parsing',
            parsing_started_at: new Date().toISOString()
        }).eq('playbook_id', playbookId)

        try {
            // Step 2: Download the file from Supabase Storage (client-side)
            console.log('Downloading playbook file:', sourceFilePath)
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('playbooks')
                .download(sourceFilePath)

            if (downloadError || !fileData) {
                throw new Error(`Failed to download playbook file: ${downloadError?.message || 'No data returned'}`)
            }

            // Step 3: Determine file type from extension
            const fileExtension = sourceFileName.split('.').pop()?.toLowerCase() || ''
            let fileType = 'application/octet-stream'
            if (fileExtension === 'pdf') fileType = 'application/pdf'
            else if (fileExtension === 'docx') fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            else if (fileExtension === 'doc') fileType = 'application/msword'
            else if (fileExtension === 'txt') fileType = 'text/plain'

            // Step 4: Extract text client-side (matching template upload pattern)
            console.log('Extracting text client-side, file type:', fileType)

            // --- Observability: Log text extraction started ---
            eventLogger.started('playbook_upload', 'playbook_text_extraction_started', { fileType })

            const extractedText = await extractTextFromPlaybook(fileData, fileType)

            if (!extractedText || extractedText.length < 100) {
                // --- Observability: Log extraction failed ---
                eventLogger.failed('playbook_upload', 'playbook_text_extraction_completed',
                    `Insufficient text: ${extractedText?.length || 0} chars`, 'EXTRACTION_INSUFFICIENT')
                throw new Error(`Could not extract sufficient text from the document (got ${extractedText?.length || 0} chars). The file may be image-based or corrupted.`)
            }

            // --- Observability: Log text extraction completed ---
            eventLogger.completed('playbook_upload', 'playbook_text_extraction_completed', {
                charCount: extractedText.length
            })

            console.log(`Text extracted successfully: ${extractedText.length} characters`)

            // Step 5: Send extracted text to N8N webhook
            // --- Observability: Log parse workflow triggered ---
            eventLogger.started('playbook_upload', 'playbook_parse_triggered', {
                webhookUrl: `${API_BASE}/parse-playbook`
            })

            const response = await fetch(`${API_BASE}/parse-playbook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playbook_id: playbookId,
                    extracted_text: extractedText
                })
            })

            console.log('Parse response:', response.status)
            const text = await response.text()
            console.log('Response:', text)

            if (!response.ok) {
                // --- Observability: Log parse workflow failed ---
                eventLogger.failed('playbook_upload', 'playbook_parse_triggered',
                    `HTTP ${response.status}: ${text.substring(0, 200)}`, `HTTP_${response.status}`)

                await supabase.from('company_playbooks').update({
                    status: 'parse_failed',
                    parsing_error: `HTTP ${response.status}: ${text.substring(0, 200)}`
                }).eq('playbook_id', playbookId)
                throw new Error(`HTTP ${response.status}`)
            }

            // --- Observability: Log parse workflow completed ---
            eventLogger.completed('playbook_upload', 'playbook_parse_triggered', {
                playbookId,
                statusCode: response.status
            })

        } catch (e) {
            console.error('Parse error:', e)
            // Update status to failed if not already done
            await supabase.from('company_playbooks').update({
                status: 'parse_failed',
                parsing_error: e instanceof Error ? e.message.substring(0, 500) : 'Unknown error'
            }).eq('playbook_id', playbookId)
            throw e
        }

        // Poll for completion — the N8N workflow responds immediately (202) but
        // parsing continues in the background for several minutes.
        if (userInfo?.companyId) {
            const companyId = userInfo.companyId
            const pollInterval = setInterval(async () => {
                const { data } = await supabase
                    .from('company_playbooks')
                    .select('status')
                    .eq('playbook_id', playbookId)
                    .single()
                if (data && data.status !== 'parsing') {
                    clearInterval(pollInterval)
                    await loadPlaybooks(companyId)
                }
            }, 10000) // Check every 10 seconds
            // Safety: stop polling after 10 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                loadPlaybooks(companyId)
            }, 600000)
        }
    }

    // --- Helper: Extract text from playbook file (client-side) ---
    // This mirrors the extractTextFromFile function used by TemplatesTab
    const extractTextFromPlaybook = async (fileBlob: Blob, fileType: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    if (fileType === 'text/plain') {
                        resolve(event.target?.result as string)
                    } else if (fileType === 'application/pdf') {
                        const pdfjsLib = await import('pdfjs-dist')
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
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
                    } else if (
                        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                        fileType === 'application/msword'
                    ) {
                        const mammoth = await import('mammoth')
                        const arrayBuffer = event.target?.result as ArrayBuffer
                        const result = await mammoth.extractRawText({ arrayBuffer })
                        resolve(result.value)
                    } else {
                        reject(new Error(`Unsupported file type: ${fileType}`))
                    }
                } catch (error) {
                    reject(error)
                }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            if (fileType === 'text/plain') {
                reader.readAsText(fileBlob)
            } else {
                reader.readAsArrayBuffer(fileBlob)
            }
        })
    }

    const handlePlaybookActivate = async (playbookId: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('company_playbooks').update({ is_active: true, activated_at: new Date().toISOString(), status: 'active' }).eq('playbook_id', playbookId)
        const name = playbooks.find(p => p.playbookId === playbookId)?.playbookName
        await logAdminAction('playbook_activated', `Playbook activated: "${name || playbookId}"`, name)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDeactivate = async (playbookId: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        await supabase.from('company_playbooks').update({ is_active: false, status: 'inactive' }).eq('playbook_id', playbookId)
        const name = playbooks.find(p => p.playbookId === playbookId)?.playbookName
        await logAdminAction('playbook_deactivated', `Playbook deactivated: "${name || playbookId}"`, name)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookTypeChange = async (playbookId: string, contractTypeKey: string | null) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('company_playbooks').update({ contract_type_key: contractTypeKey || null, updated_at: new Date().toISOString() }).eq('playbook_id', playbookId)
        if (error) {
            if (error.code === '23505') { alert('A playbook with this name already exists. Please rename it before changing the type.'); return }
            console.error('Failed to update playbook type:', error); return
        }
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDelete = async (playbookId: string, sourceFilePath?: string) => {
        console.log('=== DELETE CLICKED ===', playbookId, sourceFilePath)
        if (!userInfo?.companyId) {
            console.log('No company ID, aborting')
            return
        }
        const playbookName = playbooks.find(p => p.playbookId === playbookId)?.playbookName

        const supabase = createClient()

        // 1. Delete playbook rules first (foreign key dependency)
        const { error: rulesError } = await supabase
            .from('playbook_rules')
            .delete()
            .eq('playbook_id', playbookId)

        console.log('Delete rules result:', { rulesError })
        if (rulesError) {
            console.error('Failed to delete playbook rules:', rulesError)
        }

        // 2. Delete training sessions referencing this playbook (foreign key dependency)
        const { error: trainingError } = await supabase
            .from('playbook_training_sessions')
            .delete()
            .eq('playbook_id', playbookId)

        console.log('Delete training sessions result:', { trainingError })
        if (trainingError) {
            console.error('Failed to delete training sessions:', trainingError)
        }

        // 3. Delete the playbook record
        const { error: playbookError } = await supabase
            .from('company_playbooks')
            .delete()
            .eq('playbook_id', playbookId)

        console.log('Delete playbook result:', { playbookError })
        if (playbookError) {
            console.error('Failed to delete playbook:', playbookError)
            alert('Failed to delete playbook: ' + playbookError.message)
            return
        }

        // 4. Delete the file from storage
        if (sourceFilePath) {
            const { error: storageError } = await supabase.storage
                .from('playbooks')
                .remove([sourceFilePath])

            console.log('Delete storage result:', { storageError })
            if (storageError) {
                console.error('Failed to delete file from storage:', storageError)
            }
        }

        // 5. Reload playbooks
        await logAdminAction('playbook_deleted', `Playbook deleted: "${playbookName || playbookId}"`, playbookName)
        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDownload = async (sourceFilePath: string, fileName: string) => {
        const supabase = createClient()
        const { data, error } = await supabase.storage.from('playbooks').download(sourceFilePath)
        if (error) throw new Error(error.message)
        const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    }

    // ADD THIS NEW HANDLER HERE:
    const handlePlaybookRename = async (playbookId: string, newName: string) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()
        const oldName = playbooks.find(p => p.playbookId === playbookId)?.playbookName
        const { error } = await supabase
            .from('company_playbooks')
            .update({ playbook_name: newName, updated_at: new Date().toISOString() })
            .eq('playbook_id', playbookId)
        if (error) throw new Error(error.message)
        await logAdminAction('playbook_edited', `Playbook renamed: "${oldName || playbookId}" → "${newName}"`, newName)
        await loadPlaybooks(userInfo.companyId)
    }

    const handleTemplateUpload = async (file: File, templateName: string, contractType: string): Promise<string> => {
        if (!userInfo?.companyId || !userInfo?.userId) throw new Error('Not authenticated')

        const extractTextFromFile = async (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = async (event) => {
                    try {
                        if (file.type === 'text/plain') {
                            resolve(event.target?.result as string)
                        } else if (file.type === 'application/pdf') {
                            const pdfjsLib = await import('pdfjs-dist')
                            // FIX: Use CDN for worker
                            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
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

        const extractedText = await extractTextFromFile(file)
        if (!extractedText || extractedText.length < 100) {
            throw new Error('Could not extract sufficient text from the document')
        }

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
            const errorText = await response.text()
            throw new Error(`Upload failed: ${errorText}`)
        }

        const result = await response.json()
        const returnedContractId = result.contract_id || result.contractId
        if (!returnedContractId) {
            throw new Error('No contract ID returned from parse workflow')
        }
        await logAdminAction('template_added', `Template uploaded: "${templateName}"`, templateName)
        return returnedContractId
    }

    const handleTemplateDelete = async (templateId: string) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()
        const templateName = companyTemplates.find(t => t.templateId === templateId)?.templateName

        try {
            const { error: clausesError } = await supabase
                .from('template_clauses')
                .delete()
                .eq('template_id', templateId)

            if (clausesError) {
                console.error('Error deleting template clauses:', clausesError)
            }

            const { error: templateError } = await supabase
                .from('contract_templates')
                .delete()
                .eq('template_id', templateId)
                .eq('company_id', userInfo.companyId)
                .eq('is_system', false)

            if (templateError) throw new Error(templateError.message)

            console.log('Template permanently deleted:', templateId)
            await logAdminAction('template_deleted', `Template deleted: "${templateName || templateId}"`, templateName)
            await loadCompanyTemplates(userInfo.companyId)

        } catch (error) {
            console.error('Delete template error:', error)
            throw error
        }
    }

    const handleTemplateToggleActive = async (templateId: string, isActive: boolean) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()
        const name = companyTemplates.find(t => t.templateId === templateId)?.templateName

        const { error } = await supabase
            .from('contract_templates')
            .update({ is_active: isActive })
            .eq('template_id', templateId)
            .eq('company_id', userInfo.companyId)

        if (error) throw new Error(error.message)
        await logAdminAction(
            isActive ? 'template_activated' : 'template_deactivated',
            `Template ${isActive ? 'activated' : 'deactivated'}: "${name || templateId}"`,
            name
        )
        await loadCompanyTemplates(userInfo.companyId)
    }

    const handleAddTrainingUser = async (email: string, fullName: string, approvalType: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('approved_training_users').insert({ company_id: userInfo.companyId, user_email: email, user_full_name: fullName, approval_type: approvalType, status: 'active' })
        if (error) { if (error.code === '23505') throw new Error('User already exists'); throw new Error(error.message) }
        await handleSendTrainingInvite('', email); await loadTrainingUsers(userInfo.companyId)
    }

    const handleRemoveTrainingUser = async (id: string) => { if (!userInfo?.companyId) return; const supabase = createClient(); await supabase.from('approved_training_users').delete().eq('id', id); await loadTrainingUsers(userInfo.companyId) }

    const handleSendTrainingInvite = async (id: string, email: string) => {
        try { await fetch(`${API_BASE}/send-user-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company_name: companyName, inviter_name: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || userInfo?.email, inviter_email: userInfo?.email, invite_type: 'training' }) }) } catch (e) { console.log('Invite error:', e) }
        if (id && userInfo?.companyId) { const supabase = createClient(); await supabase.from('approved_training_users').update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq('id', id); await loadTrainingUsers(userInfo.companyId) }
    }

    const handleAddCompanyUser = async (email: string, fullName: string, role: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error } = await supabase.from('company_users').insert({ company_id: userInfo.companyId, email, full_name: fullName, role, status: 'invited', invited_by: userInfo.userId, invited_at: new Date().toISOString() })
        if (error) { if (error.code === '23505') throw new Error('User already exists'); throw new Error(error.message) }
        await handleSendCompanyInvite('', email); await loadCompanyUsers(userInfo.companyId)
    }

    const handleAddPerson = async (email: string, fullName: string, role: string, trainingTypes: TrainingType[]) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const { error: sysError } = await supabase.from('company_users').insert({ company_id: userInfo.companyId, email, full_name: fullName, role, status: 'invited', invited_by: userInfo.userId, invited_at: new Date().toISOString() })
        if (sysError) { if (sysError.code === '23505') throw new Error('User already exists'); throw new Error(sysError.message) }
        await handleSendCompanyInvite('', email)
        if (trainingTypes.length > 0) {
            await Promise.all(trainingTypes.map(t =>
                supabase.from('approved_training_users').insert({ company_id: userInfo.companyId, user_email: email, user_full_name: fullName, approval_type: t, status: 'active' })
            ))
        }
        await logAdminAction('user_added', `User invited: ${fullName} (${email}) as ${role}`, fullName)
        await Promise.all([loadCompanyUsers(userInfo.companyId), loadTrainingUsers(userInfo.companyId)])
    }

    const handleRemoveCompanyUser = async (id: string) => {
        if (!userInfo?.companyId) return; const supabase = createClient()
        const user = companyUsers.find(u => u.id === id)
        await supabase.from('company_users').update({ status: 'removed' }).eq('company_user_id', id)
        await logAdminAction('user_removed', `User removed: ${user?.fullName || user?.email || id}`, user?.fullName)
        await loadCompanyUsers(userInfo.companyId)
    }

    const handleUpdateRole = async (id: string, role: string) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()
        await supabase.from('company_users').update({ role }).eq('company_user_id', id)
        await loadCompanyUsers(userInfo.companyId)
    }

    const handleUpdatePerson = async (systemUserId: string, fullName: string, role: string, trainingTypes: TrainingType[], trainingIds: Partial<Record<TrainingType, string>>) => {
        if (!userInfo?.companyId) return
        const supabase = createClient()
        const { error } = await supabase.from('company_users').update({ full_name: fullName, role }).eq('company_user_id', systemUserId)
        if (error) throw new Error(error.message)
        // Get email for training inserts
        const { data: cu } = await supabase.from('company_users').select('email').eq('company_user_id', systemUserId).single()
        if (cu?.email) {
            const allTypes: TrainingType[] = ['training_partner', 'training_admin', 'ai_enabled']
            await Promise.all(allTypes.map(async t => {
                const existingId = trainingIds[t]
                const shouldHave = trainingTypes.includes(t)
                if (shouldHave && !existingId) {
                    // Add new training type
                    await supabase.from('approved_training_users').insert({ company_id: userInfo.companyId, user_email: cu.email, user_full_name: fullName, approval_type: t, status: 'active' })
                } else if (!shouldHave && existingId) {
                    // Remove revoked training type
                    await supabase.from('approved_training_users').delete().eq('id', existingId)
                }
            }))
        }
        await logAdminAction('user_edited', `User updated: ${fullName} — role set to ${role}`, fullName)
        await Promise.all([loadCompanyUsers(userInfo.companyId), loadTrainingUsers(userInfo.companyId)])
    }

    const handleSendCompanyInvite = async (id: string, email: string) => {
        try { await fetch(`${API_BASE}/send-user-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, company_name: companyName, inviter_name: `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim() || userInfo?.email, inviter_email: userInfo?.email, invite_type: 'platform' }) }) } catch (e) { console.log('Invite error:', e) }
        if (id && userInfo?.companyId) { const supabase = createClient(); await supabase.from('company_users').update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq('company_user_id', id); await loadCompanyUsers(userInfo.companyId) }
    }

    const sendAdminChatMessage = useCallback(async () => {
        const msg = chatInput.trim()
        if (!msg || chatLoading) return
        setChatMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() }])
        setChatInput('')
        setChatLoading(true)
        try {
            const res = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    context: 'company_admin',
                    viewerUserId: userInfo?.userId,
                    viewerCompanyId: userInfo?.companyId,
                    dashboardData: { activeTab, templateCount: companyTemplates.length, playbookCount: playbooks.length, userCount: companyUsers.length, trainingUserCount: trainingUsers.length }
                })
            })
            const data = res.ok ? await res.json() : null
            setChatMessages(prev => [...prev, { id: `asst-${Date.now()}`, role: 'assistant', content: data?.response || data?.message || "I'm here to help with company administration. Could you rephrase your question?", timestamp: new Date() }])
        } catch {
            setChatMessages(prev => [...prev, { id: `asst-${Date.now()}`, role: 'assistant', content: "I'm having trouble connecting right now. Please try again.", timestamp: new Date() }])
        } finally { setChatLoading(false) }
    }, [chatInput, chatLoading, activeTab, userInfo, companyTemplates.length, playbooks.length, companyUsers.length, trainingUsers.length])

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

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
                    loadCompanyTemplates(user.companyId),
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

    const peoplePendingCount = companyUsers.filter(u => u.status === 'invited').length + trainingUsers.filter(u => u.status === 'pending').length

    const navTabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'insights',  label: 'Insights',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
        { id: 'templates', label: 'Templates', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { id: 'playbooks', label: 'Playbooks', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
        { id: 'people',    label: 'People',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, badge: peoplePendingCount > 0 ? peoplePendingCount : undefined },
        { id: 'datamap',   label: 'Data Map',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'audit',     label: 'Audit Log', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
    ]

    return (
        <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
            {/* Indigo Banner */}
            <header className="bg-indigo-600 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/auth/contracts-dashboard')} className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-700 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div className="h-6 w-px bg-indigo-400"></div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Control Room</h1>
                        <p className="text-sm text-indigo-200">{companyName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <FeedbackButton position="header" />
                    <div className="text-right">
                        <p className="text-sm font-medium text-white">{userInfo?.firstName} {userInfo?.lastName}</p>
                        <p className="text-xs text-indigo-200">{userInfo?.email}</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-800 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">{userInfo?.firstName?.[0] || 'A'}</span>
                    </div>
                </div>
            </header>

            {/* Three-Panel Body */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* LEFT PANEL: Navigation */}
                <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-indigo-50 to-white">
                        <h2 className="text-sm font-semibold text-indigo-800 uppercase tracking-wider">Control Room</h2>
                        <p className="text-xs text-slate-500 mt-1">Manage your company settings</p>
                    </div>
                    <nav className="flex-1 py-2">
                        {navTabs.map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-l-[3px] ${
                                    activeTab === tab.id
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border-transparent'
                                }`}>
                                <span className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}>{tab.icon}</span>
                                <span className="flex-1 text-left">{tab.label}</span>
                                {tab.badge && tab.badge > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">{tab.badge}</span>
                                )}
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <p className="text-xs text-slate-400">{companyName}</p>
                    </div>
                </div>

                {/* CENTER PANEL: Tab Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50">
                    <div className="max-w-5xl mx-auto py-6 px-6">
                        {activeTab === 'insights' ? (
                            <InsightsTab playbooks={playbooks} templates={companyTemplates} trainingUsers={trainingUsers} companyUsers={companyUsers} companyId={userInfo?.companyId || ''} />
                        ) : activeTab === 'datamap' ? (
                            <DataJourneyMapContainer />
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                                {activeTab === 'playbooks' && <PlaybooksTab playbooks={playbooks} isLoading={playbooksLoading} onUpload={handlePlaybookUpload} onActivate={handlePlaybookActivate} onDeactivate={handlePlaybookDeactivate} onParse={handlePlaybookParse} onDelete={handlePlaybookDelete} onDownload={handlePlaybookDownload} onRename={handlePlaybookRename} onTypeChange={handlePlaybookTypeChange} onRefresh={() => userInfo?.companyId && loadPlaybooks(userInfo.companyId)} />}
                                {activeTab === 'templates' && <TemplatesTab templates={companyTemplates} isLoading={templatesLoading} userInfo={userInfo} playbooks={playbooks} onUpload={handleTemplateUpload} onDelete={handleTemplateDelete} onToggleActive={handleTemplateToggleActive} onRefresh={() => userInfo?.companyId && loadCompanyTemplates(userInfo.companyId)} />}
                                {activeTab === 'people' && <PeopleTab companyUsers={companyUsers} trainingUsers={trainingUsers} isLoading={usersLoading || trainingLoading} isCurrentUserAdmin={isAdmin} onAddPerson={handleAddPerson} onUpdatePerson={handleUpdatePerson} onRemoveSystemUser={handleRemoveCompanyUser} onRemoveTrainingUser={handleRemoveTrainingUser} onSendSystemInvite={handleSendCompanyInvite} onSendTrainingInvite={handleSendTrainingInvite} onUpdateRole={handleUpdateRole} onRefresh={() => { if (userInfo?.companyId) { loadCompanyUsers(userInfo.companyId); loadTrainingUsers(userInfo.companyId) } }} />}
                                {activeTab === 'audit' && <AuditLogTab companyId={userInfo?.companyId || ''} />}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Clarence Chat */}
                <div className="w-80 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden min-h-0">
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">CLARENCE</h3>
                                <p className="text-xs text-slate-500">Admin Assistant</p>
                            </div>
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                        {chatMessages.map((message) => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                    message.role === 'user'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-700'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    <p className={`text-xs mt-1.5 ${message.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-slate-200 flex-shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendAdminChatMessage()}
                                placeholder="Ask about admin tasks..."
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <button
                                onClick={sendAdminChatMessage}
                                disabled={!chatInput.trim() || chatLoading}
                                className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">Press Enter to send</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 10: PAGE EXPORT
// ============================================================================

export default function CompanyAdminPage() { return <Suspense fallback={<CompanyAdminLoading />}><CompanyAdminContent /></Suspense> }