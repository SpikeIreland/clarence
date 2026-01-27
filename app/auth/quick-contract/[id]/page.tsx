'use client'

// ============================================================================
// QUICK CONTRACT - VIEW/EDIT PAGE
// Version: 1.0
// Date: 27 January 2026
// Path: /app/auth/quick-contract/[id]/page.tsx
// Description: View and edit a specific Quick Contract
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import FeedbackButton from '@/app/components/FeedbackButton'

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

interface Recipient {
    recipientId: string
    recipientName: string
    recipientEmail: string
    recipientCompany: string | null
    recipientRole: string | null
    status: string
    firstViewedAt: string | null
    lastViewedAt: string | null
    viewCount: number
    respondedAt: string | null
    responseType: string | null
    responseMessage: string | null
    declineReason: string | null
    reminderCount: number
    lastReminderAt: string | null
    createdAt: string
}

interface QuickContract {
    quickContractId: string
    companyId: string
    createdByUserId: string
    contractName: string
    contractType: string | null
    description: string | null
    referenceNumber: string | null
    documentContent: string | null
    documentFormat: string
    originalFileName: string | null
    originalFileUrl: string | null
    sourceTemplateId: string | null
    variables: Record<string, string>
    status: string
    createdAt: string
    updatedAt: string
    sentAt: string | null
    expiresAt: string | null
    completedAt: string | null
    allowRecipientComments: boolean
    requireFullScroll: boolean
    sendReminderAfterDays: number
    autoExpireAfterDays: number
    createdByName?: string
    createdByEmail?: string
    recipients?: Recipient[]
}

type EditMode = 'view' | 'edit'
type ContractType = 'nda' | 'service_agreement' | 'lease' | 'employment' | 'contractor' | 'vendor' | 'other' | null

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const CONTRACT_TYPE_OPTIONS = [
    { value: 'nda', label: 'Non-Disclosure Agreement', icon: '🔒' },
    { value: 'service_agreement', label: 'Service Agreement', icon: '📋' },
    { value: 'lease', label: 'Lease Agreement', icon: '🏠' },
    { value: 'employment', label: 'Employment Contract', icon: '👤' },
    { value: 'contractor', label: 'Contractor Agreement', icon: '🔧' },
    { value: 'vendor', label: 'Vendor Agreement', icon: '🤝' },
    { value: 'other', label: 'Other', icon: '📄' }
]

const STATUS_CONFIG: Record<string, { label: string; className: string; description: string }> = {
    'draft': {
        label: 'Draft',
        className: 'bg-slate-100 text-slate-600',
        description: 'This contract has not been sent yet'
    },
    'ready': {
        label: 'Ready to Send',
        className: 'bg-blue-100 text-blue-700',
        description: 'This contract is ready to be sent to recipients'
    },
    'sent': {
        label: 'Sent',
        className: 'bg-purple-100 text-purple-700',
        description: 'Awaiting recipient response'
    },
    'viewed': {
        label: 'Viewed',
        className: 'bg-amber-100 text-amber-700',
        description: 'Recipient has viewed the contract'
    },
    'accepted': {
        label: 'Accepted',
        className: 'bg-emerald-100 text-emerald-700',
        description: 'Contract has been accepted'
    },
    'declined': {
        label: 'Declined',
        className: 'bg-red-100 text-red-700',
        description: 'Contract has been declined'
    },
    'expired': {
        label: 'Expired',
        className: 'bg-slate-100 text-slate-500',
        description: 'Contract has expired without response'
    },
    'cancelled': {
        label: 'Cancelled',
        className: 'bg-slate-100 text-slate-400',
        description: 'Contract has been cancelled'
    }
}

const RECIPIENT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    'pending': { label: 'Pending', className: 'bg-slate-100 text-slate-600' },
    'sent': { label: 'Sent', className: 'bg-purple-100 text-purple-700' },
    'delivered': { label: 'Delivered', className: 'bg-blue-100 text-blue-700' },
    'viewed': { label: 'Viewed', className: 'bg-amber-100 text-amber-700' },
    'accepted': { label: 'Accepted', className: 'bg-emerald-100 text-emerald-700' },
    'declined': { label: 'Declined', className: 'bg-red-100 text-red-700' },
    'expired': { label: 'Expired', className: 'bg-slate-100 text-slate-500' }
}

// ============================================================================
// SECTION 4: LOADING FALLBACK COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading contract...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: MAIN PAGE WRAPPER (with Suspense)
// ============================================================================

export default function ViewQuickContractPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ViewQuickContractContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 6: MAIN CONTENT COMPONENT
// ============================================================================

function ViewQuickContractContent() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const contractId = params.id as string

    // ==========================================================================
    // SECTION 7: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<QuickContract | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<EditMode>('view')

    // Edit state
    const [editedName, setEditedName] = useState('')
    const [editedType, setEditedType] = useState<ContractType>(null)
    const [editedDescription, setEditedDescription] = useState('')
    const [editedReference, setEditedReference] = useState('')
    const [editedContent, setEditedContent] = useState('')

    // Action states
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // ==========================================================================
    // SECTION 8: DATA LOADING
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

    const loadContract = useCallback(async () => {
        if (!contractId) return

        try {
            // Load contract with creator info
            const { data: contractData, error: contractError } = await supabase
                .from('quick_contracts')
                .select('*')
                .eq('quick_contract_id', contractId)
                .single()

            if (contractError || !contractData) {
                console.error('Error loading contract:', contractError)
                setError('Contract not found')
                return
            }

            // Load creator user info
            const { data: userData } = await supabase
                .from('users')
                .select('contact_person, email')
                .eq('user_id', contractData.created_by_user_id)
                .single()

            // Load recipients
            const { data: recipientsData } = await supabase
                .from('qc_recipients')
                .select('*')
                .eq('quick_contract_id', contractId)
                .order('created_at', { ascending: false })

            // Transform contract data
            const transformedContract: QuickContract = {
                quickContractId: contractData.quick_contract_id,
                companyId: contractData.company_id,
                createdByUserId: contractData.created_by_user_id,
                contractName: contractData.contract_name,
                contractType: contractData.contract_type,
                description: contractData.description,
                referenceNumber: contractData.reference_number,
                documentContent: contractData.document_content,
                documentFormat: contractData.document_format || 'html',
                originalFileName: contractData.original_file_name,
                originalFileUrl: contractData.original_file_url,
                sourceTemplateId: contractData.source_template_id,
                variables: contractData.variables || {},
                status: contractData.status,
                createdAt: contractData.created_at,
                updatedAt: contractData.updated_at,
                sentAt: contractData.sent_at,
                expiresAt: contractData.expires_at,
                completedAt: contractData.completed_at,
                allowRecipientComments: contractData.allow_recipient_comments ?? true,
                requireFullScroll: contractData.require_full_scroll ?? false,
                sendReminderAfterDays: contractData.send_reminder_after_days ?? 3,
                autoExpireAfterDays: contractData.auto_expire_after_days ?? 30,
                createdByName: userData?.contact_person,
                createdByEmail: userData?.email,
                recipients: (recipientsData || []).map(r => ({
                    recipientId: r.recipient_id,
                    recipientName: r.recipient_name,
                    recipientEmail: r.recipient_email,
                    recipientCompany: r.recipient_company,
                    recipientRole: r.recipient_role,
                    status: r.status,
                    firstViewedAt: r.first_viewed_at,
                    lastViewedAt: r.last_viewed_at,
                    viewCount: r.view_count || 0,
                    respondedAt: r.responded_at,
                    responseType: r.response_type,
                    responseMessage: r.response_message,
                    declineReason: r.decline_reason,
                    reminderCount: r.reminder_count || 0,
                    lastReminderAt: r.last_reminder_at,
                    createdAt: r.created_at
                }))
            }

            setContract(transformedContract)

            // Initialize edit fields
            setEditedName(transformedContract.contractName)
            setEditedType(transformedContract.contractType as ContractType)
            setEditedDescription(transformedContract.description || '')
            setEditedReference(transformedContract.referenceNumber || '')
            setEditedContent(transformedContract.documentContent || '')

            eventLogger.completed('quick_contract', 'contract_viewed', {
                contractId: contractId,
                status: transformedContract.status
            })

        } catch (err) {
            console.error('Error loading contract:', err)
            setError('Failed to load contract')
        } finally {
            setLoading(false)
        }
    }, [contractId, supabase])

    // ==========================================================================
    // SECTION 9: EFFECTS
    // ==========================================================================

    useEffect(() => {
        const init = async () => {
            const user = await loadUserInfo()
            if (user) {
                await loadContract()
            }
        }
        init()
    }, [loadUserInfo, loadContract])

    // ==========================================================================
    // SECTION 10: ACTION HANDLERS
    // ==========================================================================

    async function handleSaveChanges() {
        if (!contract) return

        setSaving(true)
        setError(null)

        try {
            const { error: updateError } = await supabase
                .from('quick_contracts')
                .update({
                    contract_name: editedName,
                    contract_type: editedType,
                    description: editedDescription || null,
                    reference_number: editedReference || null,
                    document_content: editedContent,
                    updated_at: new Date().toISOString()
                })
                .eq('quick_contract_id', contractId)

            if (updateError) {
                throw new Error('Failed to save changes')
            }

            // Reload contract
            await loadContract()
            setMode('view')

            eventLogger.completed('quick_contract', 'contract_updated', {
                contractId: contractId
            })

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    function handleCancelEdit() {
        // Reset to original values
        if (contract) {
            setEditedName(contract.contractName)
            setEditedType(contract.contractType as ContractType)
            setEditedDescription(contract.description || '')
            setEditedReference(contract.referenceNumber || '')
            setEditedContent(contract.documentContent || '')
        }
        setMode('view')
    }

    async function handleCancelContract() {
        if (!contract) return

        setActionLoading('cancel')

        try {
            const { error: updateError } = await supabase
                .from('quick_contracts')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('quick_contract_id', contractId)

            if (updateError) {
                throw new Error('Failed to cancel contract')
            }

            eventLogger.completed('quick_contract', 'contract_cancelled', {
                contractId: contractId
            })

            // Reload contract
            await loadContract()
            setShowCancelConfirm(false)

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to cancel contract')
        } finally {
            setActionLoading(null)
        }
    }

    async function handleSendReminder(recipientId: string) {
        setActionLoading(`reminder-${recipientId}`)

        try {
            // Get current reminder count
            const { data: recipient } = await supabase
                .from('qc_recipients')
                .select('reminder_count')
                .eq('recipient_id', recipientId)
                .single()

            const currentCount = recipient?.reminder_count || 0

            // Update reminder count
            const { error: updateError } = await supabase
                .from('qc_recipients')
                .update({
                    reminder_count: currentCount + 1,
                    last_reminder_at: new Date().toISOString()
                })
                .eq('recipient_id', recipientId)

            if (updateError) {
                console.error('Error updating reminder:', updateError)
            }

            eventLogger.completed('quick_contract', 'reminder_sent', {
                contractId: contractId,
                recipientId: recipientId
            })

            // Reload to show updated data
            await loadContract()

        } catch (err) {
            console.error('Error sending reminder:', err)
        } finally {
            setActionLoading(null)
        }
    }

    function handleDuplicate() {
        router.push(`/auth/quick-contract/create?duplicate=${contractId}`)
    }

    // ==========================================================================
    // SECTION 11: HELPER FUNCTIONS
    // ==========================================================================

    function getContractTypeLabel(type: string | null): string {
        if (!type) return 'Not specified'
        const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type)
        return option?.label || type
    }

    function getContractTypeIcon(type: string | null): string {
        if (!type) return '📄'
        const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type)
        return option?.icon || '📄'
    }

    function formatDate(dateString: string | null): string {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    function formatShortDate(dateString: string | null): string {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    function canEdit(): boolean {
        return contract?.status === 'draft' || contract?.status === 'ready'
    }

    function canSend(): boolean {
        return contract?.status === 'draft' || contract?.status === 'ready'
    }

    function canCancel(): boolean {
        return !['accepted', 'declined', 'expired', 'cancelled'].includes(contract?.status || '')
    }

    // ==========================================================================
    // SECTION 12: RENDER - LOADING STATE
    // ==========================================================================

    if (loading) {
        return <LoadingFallback />
    }

    // ==========================================================================
    // SECTION 13: RENDER - ERROR STATE
    // ==========================================================================

    if (error && !contract) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Contract Not Found</h2>
                    <p className="text-slate-500 mb-4">{error}</p>
                    <Link
                        href="/auth/quick-contract"
                        className="text-teal-600 hover:text-teal-700 font-medium"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    if (!contract) return null

    const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG['draft']

    // ==========================================================================
    // SECTION 14: RENDER - MAIN LAYOUT
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 15: HEADER */}
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
                                className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Dashboard
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 16: MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="max-w-5xl mx-auto px-6 py-8">

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
                {/* SECTION 17: CONTRACT HEADER */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                                {getContractTypeIcon(contract.contractType)}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-xl font-bold text-slate-800">{contract.contractName}</h1>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                        {statusConfig.label}
                                    </span>
                                </div>
                                <p className="text-slate-500 text-sm">{statusConfig.description}</p>
                                {contract.referenceNumber && (
                                    <p className="text-slate-400 text-xs mt-1">Ref: {contract.referenceNumber}</p>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {mode === 'view' ? (
                                <>
                                    {canEdit() && (
                                        <button
                                            onClick={() => setMode('edit')}
                                            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </button>
                                    )}
                                    {canSend() && (
                                        <Link
                                            href={`/auth/quick-contract/${contractId}/send`}
                                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Send
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleDuplicate}
                                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Duplicate
                                    </button>
                                    {canCancel() && (
                                        <button
                                            onClick={() => setShowCancelConfirm(true)}
                                            className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Discard Changes
                                    </button>
                                    <button
                                        onClick={handleSaveChanges}
                                        disabled={saving}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ============================================================== */}
                    {/* SECTION 18: LEFT COLUMN - CONTRACT DETAILS */}
                    {/* ============================================================== */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Contract Details Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">Contract Details</h2>

                            {mode === 'view' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-slate-400 uppercase tracking-wider">Type</span>
                                            <p className="font-medium text-slate-800 mt-1">{getContractTypeLabel(contract.contractType)}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-400 uppercase tracking-wider">Created</span>
                                            <p className="font-medium text-slate-800 mt-1">{formatShortDate(contract.createdAt)}</p>
                                        </div>
                                        {contract.sentAt && (
                                            <div>
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">Sent</span>
                                                <p className="font-medium text-slate-800 mt-1">{formatShortDate(contract.sentAt)}</p>
                                            </div>
                                        )}
                                        {contract.expiresAt && (
                                            <div>
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">Expires</span>
                                                <p className="font-medium text-slate-800 mt-1">{formatShortDate(contract.expiresAt)}</p>
                                            </div>
                                        )}
                                        {contract.completedAt && (
                                            <div>
                                                <span className="text-xs text-slate-400 uppercase tracking-wider">Completed</span>
                                                <p className="font-medium text-slate-800 mt-1">{formatShortDate(contract.completedAt)}</p>
                                            </div>
                                        )}
                                    </div>
                                    {contract.description && (
                                        <div>
                                            <span className="text-xs text-slate-400 uppercase tracking-wider">Description</span>
                                            <p className="text-slate-600 mt-1">{contract.description}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {/* Contract Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Contract Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editedName}
                                            onChange={(e) => setEditedName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        />
                                    </div>

                                    {/* Contract Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Contract Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {CONTRACT_TYPE_OPTIONS.map(option => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setEditedType(option.value as ContractType)}
                                                    className={`p-3 rounded-lg border-2 text-left transition-colors ${editedType === option.value
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
                                            value={editedDescription}
                                            onChange={(e) => setEditedDescription(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        />
                                    </div>

                                    {/* Reference Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Reference Number <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editedReference}
                                            onChange={(e) => setEditedReference(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Contract Content Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">Contract Content</h2>

                            {mode === 'view' ? (
                                <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                                    {contract.documentContent ? (
                                        <div dangerouslySetInnerHTML={{ __html: contract.documentContent }} />
                                    ) : (
                                        <p className="text-slate-400 italic">No content</p>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    rows={16}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-mono"
                                    placeholder="Enter contract content (HTML supported)"
                                />
                            )}

                            {contract.originalFileName && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    Original file: {contract.originalFileName}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ============================================================== */}
                    {/* SECTION 19: RIGHT COLUMN - RECIPIENTS & ACTIVITY */}
                    {/* ============================================================== */}
                    <div className="space-y-6">

                        {/* Recipients Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-800">Recipients</h2>
                                {canSend() && (
                                    <Link
                                        href={`/auth/quick-contract/${contractId}/send`}
                                        className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                                    >
                                        + Add
                                    </Link>
                                )}
                            </div>

                            {(!contract.recipients || contract.recipients.length === 0) ? (
                                <div className="text-center py-6">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-500 text-sm mb-3">No recipients yet</p>
                                    {canSend() && (
                                        <Link
                                            href={`/auth/quick-contract/${contractId}/send`}
                                            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                                        >
                                            Send this contract →
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {contract.recipients.map(recipient => {
                                        const recipientStatus = RECIPIENT_STATUS_CONFIG[recipient.status] || RECIPIENT_STATUS_CONFIG['pending']
                                        const isLoading = actionLoading === `reminder-${recipient.recipientId}`

                                        return (
                                            <div
                                                key={recipient.recipientId}
                                                className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <p className="font-medium text-slate-800 text-sm">{recipient.recipientName}</p>
                                                        <p className="text-xs text-slate-500">{recipient.recipientEmail}</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${recipientStatus.className}`}>
                                                        {recipientStatus.label}
                                                    </span>
                                                </div>

                                                {/* Recipient Details */}
                                                <div className="text-xs text-slate-400 space-y-1">
                                                    {recipient.viewCount > 0 && (
                                                        <p>Viewed {recipient.viewCount} time{recipient.viewCount > 1 ? 's' : ''}</p>
                                                    )}
                                                    {recipient.respondedAt && (
                                                        <p>Responded: {formatShortDate(recipient.respondedAt)}</p>
                                                    )}
                                                    {recipient.declineReason && (
                                                        <p className="text-red-500">Reason: {recipient.declineReason}</p>
                                                    )}
                                                </div>

                                                {/* Reminder Button */}
                                                {['sent', 'viewed'].includes(recipient.status) && (
                                                    <button
                                                        onClick={() => handleSendReminder(recipient.recipientId)}
                                                        disabled={isLoading}
                                                        className="mt-2 w-full py-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
                                                    >
                                                        {isLoading ? 'Sending...' : `Send Reminder ${recipient.reminderCount > 0 ? `(${recipient.reminderCount} sent)` : ''}`}
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Activity Timeline Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">Activity</h2>

                            <div className="space-y-3">
                                {contract.completedAt && (
                                    <div className="flex items-start gap-3">
                                        <div className={`w-2 h-2 rounded-full mt-1.5 ${contract.status === 'accepted' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                        <div>
                                            <p className="text-sm text-slate-800">
                                                {contract.status === 'accepted' ? 'Contract accepted' : 'Contract declined'}
                                            </p>
                                            <p className="text-xs text-slate-400">{formatDate(contract.completedAt)}</p>
                                        </div>
                                    </div>
                                )}
                                {contract.sentAt && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5"></div>
                                        <div>
                                            <p className="text-sm text-slate-800">Contract sent</p>
                                            <p className="text-xs text-slate-400">{formatDate(contract.sentAt)}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5"></div>
                                    <div>
                                        <p className="text-sm text-slate-800">Contract created</p>
                                        <p className="text-xs text-slate-400">{formatDate(contract.createdAt)}</p>
                                        {contract.createdByName && (
                                            <p className="text-xs text-slate-400">by {contract.createdByName}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Settings Card (for draft/ready contracts) */}
                        {canEdit() && mode === 'view' && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">Settings</h2>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Auto-expire after</span>
                                        <span className="text-slate-800">{contract.autoExpireAfterDays} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Reminder after</span>
                                        <span className="text-slate-800">{contract.sendReminderAfterDays} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Allow comments</span>
                                        <span className="text-slate-800">{contract.allowRecipientComments ? 'Yes' : 'No'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ================================================================== */}
            {/* SECTION 20: CANCEL CONFIRMATION MODAL */}
            {/* ================================================================== */}
            {showCancelConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Cancel Contract?</h3>
                        </div>
                        <p className="text-slate-600 text-sm mb-6">
                            Are you sure you want to cancel this contract? This action cannot be undone.
                            {contract.recipients && contract.recipients.length > 0 && (
                                <span className="block mt-2 text-amber-600">
                                    Note: Recipients who have already received this contract will no longer be able to accept it.
                                </span>
                            )}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                            >
                                Keep Contract
                            </button>
                            <button
                                onClick={handleCancelContract}
                                disabled={actionLoading === 'cancel'}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {actionLoading === 'cancel' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Cancelling...
                                    </>
                                ) : (
                                    'Yes, Cancel Contract'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}