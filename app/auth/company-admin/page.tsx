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
    companyUserId: string
    userId: string
    email: string
    fullName: string
    role: 'admin' | 'negotiator' | 'trainee' | 'viewer'
    status: 'active' | 'pending' | 'suspended' | 'removed'
    jobTitle?: string
    department?: string
    createdAt: string
}

interface TrainingApproval {
    approvalId: string
    userId: string
    email: string
    fullName: string
    status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'expired'
    requestedAt: string
    requestedReason?: string
    reviewedAt?: string
    reviewedBy?: string
    trainingLevel: 'beginner' | 'intermediate' | 'advanced'
    sessionsCompleted: number
    maxTrainingSessions?: number
}

interface Playbook {
    playbookId: string
    playbookName: string
    playbookVersion?: string
    playbookDescription?: string
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
}

interface AuditLogEntry {
    auditId: string
    actionType: string
    actionCategory: string
    targetType?: string
    targetId?: string
    performedAt: string
    performedByEmail?: string
    previousValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
}

type AdminTab = 'playbooks' | 'training' | 'users' | 'audit'

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

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
// SECTION 4: TAB NAVIGATION COMPONENT
// ============================================================================

interface TabNavigationProps {
    activeTab: AdminTab
    onTabChange: (tab: AdminTab) => void
    pendingTrainingCount: number
}

function TabNavigation({ activeTab, onTabChange, pendingTrainingCount }: TabNavigationProps) {
    const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        {
            id: 'playbooks',
            label: 'Playbooks',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            )
        },
        {
            id: 'training',
            label: 'Training Approvals',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
            ),
            badge: pendingTrainingCount > 0 ? pendingTrainingCount : undefined
        },
        {
            id: 'users',
            label: 'Users',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            )
        },
        {
            id: 'audit',
            label: 'Audit Log',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        }
    ]

    return (
        <div className="border-b border-slate-200 bg-white">
            <nav className="flex space-x-1 px-6" aria-label="Tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            relative flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all
                            ${activeTab === tab.id
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge && (
                            <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                                {tab.badge}
                            </span>
                        )}
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

function PlaybooksTab({ 
    playbooks, 
    isLoading, 
    onUpload, 
    onActivate, 
    onDeactivate, 
    onParse, 
    onDelete,
    onDownload,
    onRefresh 
}: PlaybooksTabProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [parsingId, setParsingId] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) {
            await handleFileUpload(file)
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await handleFileUpload(file)
        }
    }

    const handleFileUpload = async (file: File) => {
        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        if (!allowedTypes.includes(file.type)) {
            setUploadError('Please upload a PDF or Word document (.pdf, .doc, .docx)')
            return
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File size must be less than 10MB')
            return
        }

        setIsUploading(true)
        setUploadError(null)
        try {
            await onUpload(file)
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Failed to upload playbook')
        } finally {
            setIsUploading(false)
        }
    }

    const handleDeleteClick = async (playbookId: string, sourceFilePath?: string) => {
        setDeletingId(playbookId)
        setOpenMenuId(null)
        try {
            await onDelete(playbookId, sourceFilePath)
        } catch (error) {
            console.error('Delete failed:', error)
        } finally {
            setDeletingId(null)
            setShowDeleteConfirm(null)
        }
    }

    const getStatusBadge = (status: Playbook['status'], isActive: boolean) => {
        if (isActive) {
            return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Active</span>
        }
        switch (status) {
            case 'pending_parse':
                return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">Pending Processing</span>
            case 'parsing':
                return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Processing...</span>
            case 'parsed':
                return <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">Ready to Activate</span>
            case 'review_required':
                return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Review Required</span>
            case 'inactive':
                return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">Inactive</span>
            case 'superseded':
                return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-400 rounded-full">Superseded</span>
            case 'parse_failed':
                return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Parse Failed</span>
            default:
                return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">{status}</span>
        }
    }

    return (
        <div className="p-6">
            {/* Upload Section */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Upload Playbook</h3>
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                        relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                        ${isDragging
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                        }
                        ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
                    `}
                >
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isUploading}
                    />

                    {isUploading ? (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-600">Uploading playbook...</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <p className="text-slate-700 font-medium mb-1">
                                Drag and drop your playbook here
                            </p>
                            <p className="text-sm text-slate-500">
                                or click to browse (PDF, DOC, DOCX - max 10MB)
                            </p>
                        </>
                    )}
                </div>

                {uploadError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {uploadError}
                    </div>
                )}
            </div>

            {/* Playbooks List */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Your Playbooks</h3>
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500">Loading playbooks...</p>
                    </div>
                ) : playbooks.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <p className="text-slate-600 font-medium mb-1">No playbooks uploaded yet</p>
                        <p className="text-sm text-slate-500">Upload your company&apos;s negotiation playbook to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {playbooks.map((playbook) => (
                            <div
                                key={playbook.playbookId}
                                className={`
                                    p-4 rounded-xl border transition-all
                                    ${playbook.isActive
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : deletingId === playbook.playbookId
                                        ? 'bg-red-50 border-red-200 opacity-50'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                    }
                                `}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="font-semibold text-slate-800">{playbook.playbookName}</h4>
                                            {getStatusBadge(playbook.status, playbook.isActive)}
                                            {playbook.playbookVersion && (
                                                <span className="text-xs text-slate-400">v{playbook.playbookVersion}</span>
                                            )}
                                        </div>

                                        {playbook.playbookDescription && (
                                            <p className="text-sm text-slate-600 mb-3">{playbook.playbookDescription}</p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                            {playbook.sourceFileName && (
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    {playbook.sourceFileName}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                                {playbook.rulesExtracted} rules extracted
                                            </span>
                                            {playbook.aiConfidenceScore && (
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {Math.round(playbook.aiConfidenceScore * 100)}% confidence
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Uploaded {new Date(playbook.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 ml-4">
                                        {/* Parse button for pending playbooks */}
                                        {playbook.status === 'pending_parse' && (
                                            <button
                                                onClick={async () => {
                                                    setParsingId(playbook.playbookId)
                                                    try {
                                                        await onParse(playbook.playbookId)
                                                    } catch (err) {
                                                        console.error('Parse failed:', err)
                                                    } finally {
                                                        setParsingId(null)
                                                    }
                                                }}
                                                disabled={parsingId === playbook.playbookId}
                                                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {parsingId === playbook.playbookId ? (
                                                    <span className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Processing...
                                                    </span>
                                                ) : 'Parse Playbook'}
                                            </button>
                                        )}

                                        {/* Retry parse for failed */}
                                        {playbook.status === 'parse_failed' && (
                                            <button
                                                onClick={async () => {
                                                    setParsingId(playbook.playbookId)
                                                    try {
                                                        await onParse(playbook.playbookId)
                                                    } catch (err) {
                                                        console.error('Parse failed:', err)
                                                    } finally {
                                                        setParsingId(null)
                                                    }
                                                }}
                                                disabled={parsingId === playbook.playbookId}
                                                className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
                                            >
                                                Retry Parse
                                            </button>
                                        )}

                                        {/* Show "Parsing..." indicator */}
                                        {playbook.status === 'parsing' && (
                                            <span className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg flex items-center gap-2">
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Parsing...
                                            </span>
                                        )}

                                        {/* Activate/Deactivate buttons */}
                                        {playbook.isActive ? (
                                            <button
                                                onClick={() => onDeactivate(playbook.playbookId)}
                                                className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
                                            >
                                                Deactivate
                                            </button>
                                        ) : (playbook.status === 'parsed' || playbook.status === 'inactive') ? (
                                            <button
                                                onClick={() => onActivate(playbook.playbookId)}
                                                className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                                            >
                                                Activate
                                            </button>
                                        ) : null}

                                        {/* Review button for low confidence */}
                                        {playbook.status === 'review_required' && (
                                            <button
                                                onClick={() => {/* TODO: Open review modal */}}
                                                className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
                                            >
                                                Review Rules
                                            </button>
                                        )}

                                        {/* More options menu */}
                                        <div className="relative" ref={openMenuId === playbook.playbookId ? menuRef : null}>
                                            <button 
                                                onClick={() => setOpenMenuId(openMenuId === playbook.playbookId ? null : playbook.playbookId)}
                                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                </svg>
                                            </button>

                                            {/* Dropdown Menu */}
                                            {openMenuId === playbook.playbookId && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                                                    {/* Download/View Document */}
                                                    {playbook.sourceFilePath && (
                                                        <button
                                                            onClick={() => {
                                                                onDownload(playbook.sourceFilePath!, playbook.sourceFileName || 'playbook')
                                                                setOpenMenuId(null)
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                            Download Document
                                                        </button>
                                                    )}

                                                    {/* View Rules (if parsed) */}
                                                    {playbook.rulesExtracted > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                /* TODO: Open rules viewer */
                                                                setOpenMenuId(null)
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                            </svg>
                                                            View Extracted Rules
                                                        </button>
                                                    )}

                                                    {/* Divider */}
                                                    <div className="border-t border-slate-100 my-1"></div>

                                                    {/* Delete */}
                                                    {showDeleteConfirm === playbook.playbookId ? (
                                                        <div className="px-4 py-2">
                                                            <p className="text-xs text-red-600 mb-2">Are you sure? This cannot be undone.</p>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleDeleteClick(playbook.playbookId, playbook.sourceFilePath)}
                                                                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition"
                                                                >
                                                                    Yes, Delete
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowDeleteConfirm(null)}
                                                                    className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(playbook.playbookId)}
                                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Delete Playbook
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
        </div>
    )
}

// ============================================================================
// SECTION 6: TRAINING APPROVALS TAB COMPONENT
// ============================================================================

interface TrainingTabProps {
    approvals: TrainingApproval[]
    isLoading: boolean
    onApprove: (approvalId: string) => Promise<void>
    onReject: (approvalId: string, reason: string) => Promise<void>
    onRefresh: () => void
}

function TrainingApprovalsTab({ approvals, isLoading, onApprove, onReject, onRefresh }: TrainingTabProps) {
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [processingId, setProcessingId] = useState<string | null>(null)

    const pendingApprovals = approvals.filter(a => a.status === 'pending')
    const otherApprovals = approvals.filter(a => a.status !== 'pending')

    const handleApprove = async (approvalId: string) => {
        setProcessingId(approvalId)
        try {
            await onApprove(approvalId)
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (approvalId: string) => {
        if (!rejectReason.trim()) return
        setProcessingId(approvalId)
        try {
            await onReject(approvalId, rejectReason)
            setRejectingId(null)
            setRejectReason('')
        } finally {
            setProcessingId(null)
        }
    }

    const getStatusBadge = (status: TrainingApproval['status']) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Pending</span>
            case 'approved':
                return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">Approved</span>
            case 'rejected':
                return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Rejected</span>
            case 'suspended':
                return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">Suspended</span>
            case 'expired':
                return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-400 rounded-full">Expired</span>
            default:
                return null
        }
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Training Studio Approvals</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Approve or reject employee requests to access the Training Studio
                    </p>
                </div>
                <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading approvals...</p>
                </div>
            ) : (
                <>
                    {/* Pending Approvals */}
                    {pendingApprovals.length > 0 && (
                        <div className="mb-8">
                            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                                Pending Requests ({pendingApprovals.length})
                            </h4>
                            <div className="space-y-3">
                                {pendingApprovals.map((approval) => (
                                    <div key={approval.approvalId} className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-semibold text-slate-800">{approval.fullName}</span>
                                                    {getStatusBadge(approval.status)}
                                                </div>
                                                <p className="text-sm text-slate-600 mb-2">{approval.email}</p>
                                                {approval.requestedReason && (
                                                    <p className="text-sm text-slate-500 italic">&quot;{approval.requestedReason}&quot;</p>
                                                )}
                                                <p className="text-xs text-slate-400 mt-2">
                                                    Requested {new Date(approval.requestedAt).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {rejectingId === approval.approvalId ? (
                                                <div className="flex flex-col gap-2 ml-4">
                                                    <input
                                                        type="text"
                                                        value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        placeholder="Reason for rejection..."
                                                        className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleReject(approval.approvalId)}
                                                            disabled={!rejectReason.trim() || processingId === approval.approvalId}
                                                            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                                                        >
                                                            Confirm Reject
                                                        </button>
                                                        <button
                                                            onClick={() => { setRejectingId(null); setRejectReason('') }}
                                                            className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 ml-4">
                                                    <button
                                                        onClick={() => handleApprove(approval.approvalId)}
                                                        disabled={processingId === approval.approvalId}
                                                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
                                                    >
                                                        {processingId === approval.approvalId ? 'Processing...' : 'Approve'}
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectingId(approval.approvalId)}
                                                        disabled={processingId === approval.approvalId}
                                                        className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other Approvals */}
                    {otherApprovals.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                                All Approvals ({otherApprovals.length})
                            </h4>
                            <div className="space-y-3">
                                {otherApprovals.map((approval) => (
                                    <div key={approval.approvalId} className="p-4 bg-white border border-slate-200 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-medium text-slate-800">{approval.fullName}</span>
                                                    {getStatusBadge(approval.status)}
                                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                        {approval.trainingLevel}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500">{approval.email}</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {approval.sessionsCompleted} sessions completed
                                                    {approval.maxTrainingSessions && ` / ${approval.maxTrainingSessions} max`}
                                                </p>
                                            </div>
                                            {approval.status === 'approved' && (
                                                <button className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition">
                                                    Suspend
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {approvals.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                            </div>
                            <p className="text-slate-600 font-medium mb-1">No training approval requests</p>
                            <p className="text-sm text-slate-500">Employee requests for Training Studio access will appear here</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 7: USERS TAB COMPONENT (PLACEHOLDER)
// ============================================================================

function UsersTab() {
    return (
        <div className="p-6">
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                </div>
                <p className="text-slate-600 font-medium mb-1">User Management</p>
                <p className="text-sm text-slate-500">Coming soon - manage company users and their roles</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 8: AUDIT LOG TAB COMPONENT (PLACEHOLDER)
// ============================================================================

function AuditLogTab() {
    return (
        <div className="p-6">
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                </div>
                <p className="text-slate-600 font-medium mb-1">Audit Log</p>
                <p className="text-sm text-slate-500">Coming soon - view history of all admin actions</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 9: MAIN COMPANY ADMIN CONTENT COMPONENT
// ============================================================================

function CompanyAdminContent() {
    const router = useRouter()

    // State
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [companyName, setCompanyName] = useState<string>('')
    const [activeTab, setActiveTab] = useState<AdminTab>('playbooks')
    const [isAdmin, setIsAdmin] = useState(false)

    // Data states
    const [playbooks, setPlaybooks] = useState<Playbook[]>([])
    const [playbooksLoading, setPlaybooksLoading] = useState(false)
    const [trainingApprovals, setTrainingApprovals] = useState<TrainingApproval[]>([])
    const [trainingLoading, setTrainingLoading] = useState(false)

    // ========================================================================
    // SECTION 9A: AUTHENTICATION & INITIAL LOAD
    // ========================================================================

    const checkAuth = useCallback(async (): Promise<UserInfo | null> => {
        try {
            const supabase = createClient()
            const { data: { user }, error: authError } = await supabase.auth.getUser()

            if (authError) {
                console.error('Auth error:', authError)
                router.push('/auth/login')
                return null
            }

            if (!user) {
                console.log('No authenticated user found')
                router.push('/auth/login')
                return null
            }

            console.log('Authenticated user:', user.id, user.email)

            // Get user info from localStorage (set during login)
            const stored = localStorage.getItem('clarenceAuth')
            if (!stored) {
                console.log('No clarenceAuth in localStorage, but user is authenticated')
                // User is authenticated but no localStorage - create basic info
                return {
                    userId: user.id,
                    email: user.email || '',
                    firstName: user.user_metadata?.first_name || '',
                    lastName: user.user_metadata?.last_name || '',
                    company: user.user_metadata?.company || '',
                    companyId: user.user_metadata?.company_id || '',
                    role: 'customer'
                }
            }

            const parsed = JSON.parse(stored)
            console.log('Parsed clarenceAuth:', parsed)

            return {
                userId: user.id,
                email: user.email || '',
                firstName: parsed.userInfo?.firstName || '',
                lastName: parsed.userInfo?.lastName || '',
                company: parsed.userInfo?.company || '',
                companyId: parsed.userInfo?.companyId || '',
                role: parsed.userInfo?.role || 'customer'
            }
        } catch (error) {
            console.error('checkAuth error:', error)
            router.push('/auth/login')
            return null
        }
    }, [router])

    const checkAdminAccess = useCallback(async (userId: string, companyId?: string): Promise<boolean> => {
        // For now, we'll check if the user has admin role
        // This will be replaced with a proper database check once company_users is populated
        try {
            const supabase = createClient()

            // ============================================================
            // TEMPORARY BOOTSTRAP ADMIN - Remove after company_users is set up
            // ============================================================
            const { data: { user } } = await supabase.auth.getUser()
            const bootstrapAdmins = [
                'paul.lyons67@icloud.com'
            ]
            if (user?.email && bootstrapAdmins.includes(user.email.toLowerCase())) {
                console.log('Admin access granted via bootstrap admin list')
                return true
            }
            // ============================================================

            // Check company_users table for admin role
            if (companyId) {
                const { data, error } = await supabase
                    .from('company_users')
                    .select('role')
                    .eq('user_id', userId)
                    .eq('company_id', companyId)
                    .eq('status', 'active')
                    .single()

                if (!error && data?.role === 'admin') {
                    console.log('Admin access granted via company_users table')
                    return true
                }
            }

            // Fallback: Check if user is marked as admin in users table
            // Try with user_id column first
            let userData = null

            const result1 = await supabase
                .from('users')
                .select('role')
                .eq('user_id', userId)
                .single()

            if (!result1.error && result1.data) {
                userData = result1.data
            } else {
                // Try with id column
                const result2 = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', userId)
                    .single()

                if (!result2.error && result2.data) {
                    userData = result2.data
                } else {
                    // Try with email from auth
                    if (user?.email) {
                        const result3 = await supabase
                            .from('users')
                            .select('role')
                            .eq('email', user.email)
                            .single()

                        if (!result3.error && result3.data) {
                            userData = result3.data
                        }
                    }
                }
            }

            if (userData?.role === 'admin') {
                console.log('Admin access granted via users table')
                return true
            }

            console.log('Admin access denied - user role:', userData?.role)
            return false
        } catch (error) {
            console.error('Error checking admin access:', error)
            return false
        }
    }, [])

    // ========================================================================
    // SECTION 9B: DATA LOADING FUNCTIONS
    // ========================================================================

    const loadPlaybooks = useCallback(async (companyId: string) => {
        setPlaybooksLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('company_playbooks')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })

            if (error) throw error

            const mappedPlaybooks: Playbook[] = (data || []).map(p => ({
                playbookId: p.playbook_id,
                playbookName: p.playbook_name,
                playbookVersion: p.playbook_version,
                playbookDescription: p.playbook_description,
                status: p.status,
                isActive: p.is_active,
                sourceFileName: p.source_file_name,
                sourceFilePath: p.source_file_path,
                rulesExtracted: p.rules_extracted || 0,
                aiConfidenceScore: p.ai_confidence_score,
                effectiveDate: p.effective_date,
                expiryDate: p.expiry_date,
                createdAt: p.created_at,
                createdBy: p.created_by
            }))

            setPlaybooks(mappedPlaybooks)
        } catch (error) {
            console.error('Error loading playbooks:', error)
        } finally {
            setPlaybooksLoading(false)
        }
    }, [])

    const loadTrainingApprovals = useCallback(async (companyId: string) => {
        setTrainingLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('training_approvals')
                .select('*')
                .eq('company_id', companyId)
                .order('requested_at', { ascending: false })

            if (error) throw error

            const mappedApprovals: TrainingApproval[] = (data || []).map(a => ({
                approvalId: a.approval_id,
                userId: a.user_id,
                email: a.user_email || '',
                fullName: a.user_full_name || a.user_email || 'Unknown User',
                status: a.status,
                requestedAt: a.requested_at,
                requestedReason: a.requested_reason,
                reviewedAt: a.reviewed_at,
                reviewedBy: a.reviewed_by,
                trainingLevel: a.training_level || 'beginner',
                sessionsCompleted: a.sessions_completed || 0,
                maxTrainingSessions: a.max_training_sessions
            }))

            setTrainingApprovals(mappedApprovals)
        } catch (error) {
            console.error('Error loading training approvals:', error)
            setTrainingApprovals([])
        } finally {
            setTrainingLoading(false)
        }
    }, [])

    // ========================================================================
    // SECTION 9C: ACTION HANDLERS
    // ========================================================================

    const handlePlaybookUpload = async (file: File) => {
        console.log('handlePlaybookUpload called with:', file.name)
        console.log('userInfo:', userInfo)

        // Bootstrap: If no companyId, we need to create/find one
        let companyId = userInfo?.companyId

        if (!companyId) {
            console.log('No companyId found, attempting to find or create company')
            const supabase = createClient()

            // Try to find existing company for this user
            const { data: existingCompany } = await supabase
                .from('companies')
                .select('company_id')
                .eq('created_by', userInfo?.userId)
                .single()

            if (existingCompany?.company_id) {
                companyId = existingCompany.company_id
                console.log('Found existing company:', companyId)
            } else {
                // Create a bootstrap company
                const { data: newCompany, error: companyError } = await supabase
                    .from('companies')
                    .insert({
                        company_name: userInfo?.company || 'My Company',
                        created_by: userInfo?.userId
                    })
                    .select('company_id')
                    .single()

                if (companyError) {
                    console.error('Failed to create company:', companyError)
                    throw new Error('Failed to create company: ' + companyError.message)
                }

                companyId = newCompany?.company_id
                console.log('Created new company:', companyId)
            }
        }

        if (!companyId || !userInfo?.userId) {
            console.error('Missing companyId or userId:', { companyId, userId: userInfo?.userId })
            throw new Error('Unable to determine company. Please contact support.')
        }

        const supabase = createClient()

        // 1. Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${companyId}/${Date.now()}.${fileExt}`

        console.log('Uploading to storage:', fileName)

        const { error: uploadError } = await supabase.storage
            .from('playbooks')
            .upload(fileName, file)

        if (uploadError) {
            console.error('Storage upload error:', uploadError)
            throw new Error('Failed to upload file: ' + uploadError.message)
        }

        console.log('File uploaded successfully')

        // 2. Create playbook record
        const { error: insertError } = await supabase
            .from('company_playbooks')
            .insert({
                company_id: companyId,
                playbook_name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                source_file_name: file.name,
                source_file_path: fileName,
                status: 'pending_parse',
                created_by: userInfo.userId
            })

        if (insertError) {
            console.error('Playbook record insert error:', insertError)
            throw new Error('Failed to create playbook record: ' + insertError.message)
        }

        console.log('Playbook record created')

        // 3. Refresh playbooks list (user will click Parse button manually)
        await loadPlaybooks(companyId)
    }

    const handlePlaybookActivate = async (playbookId: string) => {
        if (!userInfo?.companyId || !userInfo?.userId) return

        const supabase = createClient()

        // Deactivate any currently active playbook
        await supabase
            .from('company_playbooks')
            .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_by: userInfo.userId })
            .eq('company_id', userInfo.companyId)
            .eq('is_active', true)

        // Activate the selected playbook
        const { error } = await supabase
            .from('company_playbooks')
            .update({
                is_active: true,
                activated_at: new Date().toISOString(),
                activated_by: userInfo.userId,
                status: 'active'
            })
            .eq('playbook_id', playbookId)

        if (error) {
            throw new Error('Failed to activate playbook: ' + error.message)
        }

        await loadPlaybooks(userInfo.companyId)
    }

    const handlePlaybookDeactivate = async (playbookId: string) => {
        if (!userInfo?.companyId || !userInfo?.userId) return

        const supabase = createClient()

        const { error } = await supabase
            .from('company_playbooks')
            .update({
                is_active: false,
                deactivated_at: new Date().toISOString(),
                deactivated_by: userInfo.userId,
                status: 'inactive'
            })
            .eq('playbook_id', playbookId)

        if (error) {
            throw new Error('Failed to deactivate playbook: ' + error.message)
        }

        await loadPlaybooks(userInfo.companyId)
    }

    // ========================================================================
    // PARSE PLAYBOOK - Trigger N8N workflow
    // ========================================================================

    const handlePlaybookParse = async (playbookId: string) => {
        if (!userInfo?.companyId) return

        try {
            // Trigger the N8N parsing workflow
            const response = await fetch(`${API_BASE}/parse-playbook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playbook_id: playbookId
                })
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to parse playbook')
            }

            // Refresh the list to show updated status
            await loadPlaybooks(userInfo.companyId)
        } catch (error) {
            console.error('Error triggering parse:', error)
            throw error
        }
    }

    // ========================================================================
    // DELETE PLAYBOOK - Remove from database and storage
    // ========================================================================

    const handlePlaybookDelete = async (playbookId: string, sourceFilePath?: string) => {
        if (!userInfo?.companyId) return

        const supabase = createClient()

        try {
            // 1. Delete associated rules first (if foreign key doesn't cascade)
            const { error: rulesError } = await supabase
                .from('playbook_rules')
                .delete()
                .eq('playbook_id', playbookId)

            if (rulesError) {
                console.warn('Error deleting rules (may not exist):', rulesError)
                // Continue anyway - rules table might not have any records
            }

            // 2. Delete the playbook record
            const { error: playbookError } = await supabase
                .from('company_playbooks')
                .delete()
                .eq('playbook_id', playbookId)

            if (playbookError) {
                throw new Error('Failed to delete playbook record: ' + playbookError.message)
            }

            // 3. Delete the file from storage (if path exists)
            if (sourceFilePath) {
                const { error: storageError } = await supabase.storage
                    .from('playbooks')
                    .remove([sourceFilePath])

                if (storageError) {
                    console.warn('Failed to delete file from storage:', storageError)
                    // Don't throw - the record is already deleted
                }
            }

            // 4. Refresh the list
            await loadPlaybooks(userInfo.companyId)
        } catch (error) {
            console.error('Error deleting playbook:', error)
            throw error
        }
    }

    // ========================================================================
    // DOWNLOAD PLAYBOOK - Get file from storage
    // ========================================================================

    const handlePlaybookDownload = async (sourceFilePath: string, fileName: string) => {
        const supabase = createClient()

        try {
            const { data, error } = await supabase.storage
                .from('playbooks')
                .download(sourceFilePath)

            if (error) {
                throw new Error('Failed to download file: ' + error.message)
            }

            // Create download link
            const url = URL.createObjectURL(data)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error downloading playbook:', error)
            throw error
        }
    }

    const handleTrainingApprove = async (approvalId: string) => {
        if (!userInfo?.userId) return

        const supabase = createClient()

        const { error } = await supabase
            .from('training_approvals')
            .update({
                status: 'approved',
                reviewed_by: userInfo.userId,
                reviewed_at: new Date().toISOString()
            })
            .eq('approval_id', approvalId)

        if (error) {
            throw new Error('Failed to approve training request: ' + error.message)
        }

        if (userInfo.companyId) {
            await loadTrainingApprovals(userInfo.companyId)
        }
    }

    const handleTrainingReject = async (approvalId: string, reason: string) => {
        if (!userInfo?.userId) return

        const supabase = createClient()

        const { error } = await supabase
            .from('training_approvals')
            .update({
                status: 'rejected',
                reviewed_by: userInfo.userId,
                reviewed_at: new Date().toISOString(),
                review_notes: reason
            })
            .eq('approval_id', approvalId)

        if (error) {
            throw new Error('Failed to reject training request: ' + error.message)
        }

        if (userInfo.companyId) {
            await loadTrainingApprovals(userInfo.companyId)
        }
    }

    // ========================================================================
    // SECTION 9D: INITIAL LOAD EFFECT
    // ========================================================================

    useEffect(() => {
        const initialize = async () => {
            const user = await checkAuth()
            if (!user) return

            setUserInfo(user)
            setCompanyName(user.company || 'Your Company')

            // Check admin access
            const hasAdminAccess = await checkAdminAccess(user.userId, user.companyId)
            setIsAdmin(hasAdminAccess)

            if (!hasAdminAccess) {
                // Redirect non-admins
                console.log('User is not admin, redirecting to contracts-dashboard')
                router.push('/auth/contracts-dashboard')
                return
            }

            // Load data
            if (user.companyId) {
                await Promise.all([
                    loadPlaybooks(user.companyId),
                    loadTrainingApprovals(user.companyId)
                ])
            }

            setLoading(false)
        }

        initialize()
    }, [checkAuth, checkAdminAccess, loadPlaybooks, loadTrainingApprovals, router])

    // ========================================================================
    // SECTION 9E: RENDER
    // ========================================================================

    if (loading) {
        return <CompanyAdminLoading />
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Access Denied</h2>
                    <p className="text-slate-600 mb-4">You don&apos;t have permission to access the Company Admin panel.</p>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const pendingTrainingCount = trainingApprovals.filter(a => a.status === 'pending').length

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/auth/contracts-dashboard')}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Company Admin</h1>
                                <p className="text-sm text-slate-500">{companyName}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-medium text-slate-700">
                                    {userInfo?.firstName} {userInfo?.lastName}
                                </p>
                                <p className="text-xs text-slate-500">{userInfo?.email}</p>
                            </div>
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">
                                    {userInfo?.firstName?.[0] || 'A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <TabNavigation
                activeTab={activeTab}
                onTabChange={setActiveTab}
                pendingTrainingCount={pendingTrainingCount}
            />

            {/* Tab Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    {activeTab === 'playbooks' && (
                        <PlaybooksTab
                            playbooks={playbooks}
                            isLoading={playbooksLoading}
                            onUpload={handlePlaybookUpload}
                            onActivate={handlePlaybookActivate}
                            onDeactivate={handlePlaybookDeactivate}
                            onParse={handlePlaybookParse}
                            onDelete={handlePlaybookDelete}
                            onDownload={handlePlaybookDownload}
                            onRefresh={() => userInfo?.companyId && loadPlaybooks(userInfo.companyId)}
                        />
                    )}

                    {activeTab === 'training' && (
                        <TrainingApprovalsTab
                            approvals={trainingApprovals}
                            isLoading={trainingLoading}
                            onApprove={handleTrainingApprove}
                            onReject={handleTrainingReject}
                            onRefresh={() => userInfo?.companyId && loadTrainingApprovals(userInfo.companyId)}
                        />
                    )}

                    {activeTab === 'users' && <UsersTab />}

                    {activeTab === 'audit' && <AuditLogTab />}
                </div>
            </main>
        </div>
    )
}

// ============================================================================
// SECTION 10: PAGE EXPORT WITH SUSPENSE
// ============================================================================

export default function CompanyAdminPage() {
    return (
        <Suspense fallback={<CompanyAdminLoading />}>
            <CompanyAdminContent />
        </Suspense>
    )
}