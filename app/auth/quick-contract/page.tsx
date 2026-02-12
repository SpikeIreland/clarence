'use client'

// ============================================================================
// QUICK CONTRACT DASHBOARD
// Version: 1.0
// Date: 27 January 2026
// Path: /app/auth/quick-contract/page.tsx
// Description: Dashboard for managing Quick Contracts (send and sign)
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger'
import { createClient } from '@/lib/supabase'
import FeedbackButton from '@/app/components/FeedbackButton'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'

// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    companyId?: string
    role?: string
    userId?: string
}

interface QuickContractRecipient {
    recipientId: string
    recipientName: string
    recipientEmail: string
    recipientCompany?: string
    status: 'pending' | 'sent' | 'delivered' | 'viewed' | 'accepted' | 'declined' | 'expired'
    firstViewedAt?: string
    respondedAt?: string
    responseType?: 'accepted' | 'declined' | 'negotiation_requested'
    declineReason?: string
}

interface QuickContract {
    quickContractId: string
    contractName: string
    contractType?: string
    description?: string
    referenceNumber?: string
    status: 'draft' | 'ready' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'cancelled'
    createdAt: string
    updatedAt: string
    sentAt?: string
    expiresAt?: string
    completedAt?: string
    // Recipient summary
    totalRecipients: number
    acceptedCount: number
    declinedCount: number
    viewedCount: number
    pendingCount: number
    // Primary recipient (for display)
    primaryRecipientName?: string
    primaryRecipientEmail?: string
    primaryRecipientCompany?: string
    // Detailed recipients (when expanded)
    recipients?: QuickContractRecipient[]
}

type FilterStatus = 'all' | 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    'nda': 'NDA',
    'service_agreement': 'Service Agreement',
    'lease': 'Lease Agreement',
    'employment': 'Employment Contract',
    'contractor': 'Contractor Agreement',
    'vendor': 'Vendor Agreement',
    'other': 'Other'
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
    'draft': {
        label: 'Draft',
        className: 'bg-slate-100 text-slate-600',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    },
    'ready': {
        label: 'Ready to Send',
        className: 'bg-blue-100 text-blue-700',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    'sent': {
        label: 'Sent',
        className: 'bg-purple-100 text-purple-700',
        icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
    },
    'viewed': {
        label: 'Viewed',
        className: 'bg-amber-100 text-amber-700',
        icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
    },
    'accepted': {
        label: 'Accepted',
        className: 'bg-emerald-100 text-emerald-700',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    'declined': {
        label: 'Declined',
        className: 'bg-red-100 text-red-700',
        icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    'expired': {
        label: 'Expired',
        className: 'bg-slate-100 text-slate-500',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    'cancelled': {
        label: 'Cancelled',
        className: 'bg-slate-100 text-slate-400',
        icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
    }
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function QuickContractDashboard() {
    const router = useRouter()
    const supabase = createClient()

    // ==========================================================================
    // SECTION 5: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contracts, setContracts] = useState<QuickContract[]>([])
    const [loading, setLoading] = useState(true)

    // Filter and search state
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    // Action states
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set())

    // ==========================================================================
    // SECTION 6: DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return
        }

        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        return authData.userInfo
    }, [router])

    const loadContracts = useCallback(async (user: UserInfo) => {
        try {
            setLoading(true)

            // FIX: Filter by created_by_user_id (not company_id)
            // This ensures each user only sees their own Quick Contracts
            // Previously filtered by company_id which caused:
            //   - Admin seeing ALL contracts across all users
            //   - Other users seeing nothing (null/mismatched companyId)
            const { data, error } = await supabase
                .from('qc_dashboard_summary')
                .select('*')
                .eq('created_by_user_id', user.userId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error loading Quick Contracts:', error)
                setContracts([])
                return
            }

            // Transform data to match our interface
            const transformedContracts: QuickContract[] = (data || []).map(row => ({
                quickContractId: row.quick_contract_id,
                contractName: row.contract_name,
                contractType: row.contract_type,
                description: row.description,
                referenceNumber: row.reference_number,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                sentAt: row.sent_at,
                expiresAt: row.expires_at,
                completedAt: row.completed_at,
                totalRecipients: row.total_recipients || 0,
                acceptedCount: row.accepted_count || 0,
                declinedCount: row.declined_count || 0,
                viewedCount: row.viewed_count || 0,
                pendingCount: row.pending_count || 0,
                primaryRecipientName: row.primary_recipient_name,
                primaryRecipientEmail: row.primary_recipient_email,
                primaryRecipientCompany: row.primary_recipient_company
            }))

            setContracts(transformedContracts)

            eventLogger.completed('quick_contract', 'dashboard_loaded', {
                contractCount: transformedContracts.length
            })

        } catch (error) {
            console.error('Error loading Quick to Contract:', error)
            setContracts([])
        } finally {
            setLoading(false)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 7: EFFECTS
    // ==========================================================================

    useEffect(() => {
        const init = async () => {
            const user = await loadUserInfo()
            if (user) {
                await loadContracts(user)
            }
        }
        init()
    }, [loadUserInfo, loadContracts])


    // ==========================================================================
    // SECTION 8: FILTERING AND SORTING
    // ==========================================================================

    const filteredContracts = contracts
        .filter(contract => {
            // Status filter
            if (filterStatus !== 'all' && contract.status !== filterStatus) {
                return false
            }

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                return (
                    contract.contractName.toLowerCase().includes(query) ||
                    contract.primaryRecipientName?.toLowerCase().includes(query) ||
                    contract.primaryRecipientEmail?.toLowerCase().includes(query) ||
                    contract.referenceNumber?.toLowerCase().includes(query)
                )
            }

            return true
        })
        .sort((a, b) => {
            let comparison = 0

            switch (sortBy) {
                case 'date':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    break
                case 'name':
                    comparison = a.contractName.localeCompare(b.contractName)
                    break
                case 'status':
                    comparison = a.status.localeCompare(b.status)
                    break
            }

            return sortOrder === 'asc' ? comparison : -comparison
        })

    // ==========================================================================
    // SECTION 9: STATISTICS CALCULATION
    // ==========================================================================

    const stats = {
        total: contracts.length,
        draft: contracts.filter(c => c.status === 'draft').length,
        sent: contracts.filter(c => ['sent', 'viewed'].includes(c.status)).length,
        accepted: contracts.filter(c => c.status === 'accepted').length,
        declined: contracts.filter(c => c.status === 'declined').length,
        expired: contracts.filter(c => c.status === 'expired').length
    }

    // ==========================================================================
    // SECTION 10: ACTION HANDLERS
    // ==========================================================================

    async function handleSignOut() {
        try {
            await supabase.auth.signOut()
            localStorage.removeItem('clarence_auth')
            localStorage.removeItem('clarence_provider_session')
            router.push('/auth/login')
        } catch (error) {
            console.error('Sign out error:', error)
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        }
    }

    function handleCreateNew() {
        eventLogger.started('quick_contract', 'create_initiated')
        router.push('/auth/quick-contract/create')
    }

    function handleViewContract(contractId: string) {
        router.push(`/auth/quick-contract/${contractId}`)
    }

    async function handleSendReminder(contractId: string, e: React.MouseEvent) {
        e.stopPropagation()
        setActionLoading(contractId)

        try {
            // TODO: Implement N8N workflow call for sending reminder
            const response = await fetch(`${API_BASE}/qc-reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quickContractId: contractId })
            })

            if (response.ok) {
                eventLogger.completed('quick_contract', 'reminder_sent', { contractId })
                // Refresh the list
                if (userInfo) {
                    await loadContracts(userInfo)
                }
            }
        } catch (error) {
            console.error('Error sending reminder:', error)
        } finally {
            setActionLoading(null)
        }
    }

    async function handleCancelContract(contractId: string, e: React.MouseEvent) {
        e.stopPropagation()

        if (!confirm('Are you sure you want to cancel this contract? This action cannot be undone.')) {
            return
        }

        setActionLoading(contractId)

        try {
            const { error } = await supabase
                .from('quick_contracts')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('quick_contract_id', contractId)

            if (!error) {
                eventLogger.completed('quick_contract', 'contract_cancelled', { contractId })
                if (userInfo) {
                    await loadContracts(userInfo)
                }
            }
        } catch (error) {
            console.error('Error cancelling contract:', error)
        } finally {
            setActionLoading(null)
        }
    }

    async function handleDuplicate(contractId: string, e: React.MouseEvent) {
        e.stopPropagation()
        setActionLoading(contractId)

        try {
            // Get the original contract
            const original = contracts.find(c => c.quickContractId === contractId)
            if (!original) return

            // TODO: Implement full duplication via N8N workflow
            eventLogger.started('quick_contract', 'duplicate_initiated', {
                originalId: contractId,
                contractName: original.contractName
            })

            router.push(`/auth/quick-contract/create?duplicate=${contractId}`)
        } catch (error) {
            console.error('Error duplicating contract:', error)
        } finally {
            setActionLoading(null)
        }
    }

    function toggleExpand(contractId: string) {
        setExpandedContracts(prev => {
            const next = new Set(prev)
            if (next.has(contractId)) {
                next.delete(contractId)
            } else {
                next.add(contractId)
            }
            return next
        })
    }

    // ==========================================================================
    // SECTION 11: HELPER FUNCTIONS
    // ==========================================================================

    function getStatusConfig(status: string) {
        return STATUS_CONFIG[status] || STATUS_CONFIG['draft']
    }

    function formatDate(dateString: string | undefined) {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    function formatRelativeTime(dateString: string | undefined) {
        if (!dateString) return ''

        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
        return formatDate(dateString)
    }

    function getContractTypeLabel(type?: string) {
        if (!type) return 'General'
        return CONTRACT_TYPE_LABELS[type] || type
    }

    function getExpiryWarning(contract: QuickContract) {
        if (!contract.expiresAt || contract.status !== 'sent') return null

        const expiresAt = new Date(contract.expiresAt)
        const now = new Date()
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntilExpiry <= 0) return { text: 'Expired', urgent: true }
        if (daysUntilExpiry <= 3) return { text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`, urgent: true }
        if (daysUntilExpiry <= 7) return { text: `Expires in ${daysUntilExpiry} days`, urgent: false }
        return null
    }

    // ==========================================================================
    // SECTION 12: RENDER - LOADING STATE
    // ==========================================================================

    if (loading && !userInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-600">Loading Quick to Contract...</p>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 13: RENDER - MAIN LAYOUT
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 14: NAVIGATION HEADER */}
            {/* ================================================================== */}
            <AuthenticatedHeader
                activePage="quick-contracts"
                userInfo={userInfo}
                onSignOut={handleSignOut}
            />

            {/* ================================================================== */}
            {/* SECTION 15: MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">
                            Quick to Contract
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Send contracts for simple accept/decline workflows
                        </p>
                    </div>
                    <button
                        onClick={handleCreateNew}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Quick Contract
                    </button>
                </div>

                {/* ============================================================== */}
                {/* SECTION 16: STATS CARDS */}
                {/* ============================================================== */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
                                <div className="text-slate-500 text-xs">Total</div>
                            </div>
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-purple-600">{stats.sent}</div>
                                <div className="text-slate-500 text-xs">Awaiting Response</div>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-emerald-600">{stats.accepted}</div>
                                <div className="text-slate-500 text-xs">Accepted</div>
                            </div>
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
                                <div className="text-slate-500 text-xs">Declined</div>
                            </div>
                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-slate-500">{stats.draft}</div>
                                <div className="text-slate-500 text-xs">Drafts</div>
                            </div>
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 17: FILTERS AND SEARCH */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">

                            {/* Search */}
                            <div className="relative w-full lg:w-80">
                                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search by name, recipient, or reference..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
                                {[
                                    { value: 'all', label: 'All' },
                                    { value: 'draft', label: 'Drafts' },
                                    { value: 'sent', label: 'Sent' },
                                    { value: 'viewed', label: 'Viewed' },
                                    { value: 'accepted', label: 'Accepted' },
                                    { value: 'declined', label: 'Declined' }
                                ].map(filter => (
                                    <button
                                        key={filter.value}
                                        onClick={() => setFilterStatus(filter.value as FilterStatus)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterStatus === filter.value
                                            ? 'bg-teal-100 text-teal-700'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>

                            {/* Sort */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Sort:</span>
                                <select
                                    value={`${sortBy}-${sortOrder}`}
                                    onChange={(e) => {
                                        const [by, order] = e.target.value.split('-')
                                        setSortBy(by as 'date' | 'name' | 'status')
                                        setSortOrder(order as 'asc' | 'desc')
                                    }}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="date-desc">Newest First</option>
                                    <option value="date-asc">Oldest First</option>
                                    <option value="name-asc">Name A-Z</option>
                                    <option value="name-desc">Name Z-A</option>
                                    <option value="status-asc">Status</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ============================================================== */}
                    {/* SECTION 18: CONTRACTS LIST */}
                    {/* ============================================================== */}
                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="mt-4 text-slate-500 text-sm">Loading contracts...</p>
                            </div>
                        ) : filteredContracts.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                    {searchQuery || filterStatus !== 'all'
                                        ? 'No contracts match your filters'
                                        : 'No Quick Contracts yet'}
                                </h3>
                                <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                                    {searchQuery || filterStatus !== 'all'
                                        ? 'Try adjusting your search or filter criteria.'
                                        : 'Create your first Quick Contract to send simple accept/decline agreements.'}
                                </p>
                                {!searchQuery && filterStatus === 'all' && (
                                    <button
                                        onClick={handleCreateNew}
                                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Create Your First Quick Contract
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredContracts.map(contract => {
                                const statusConfig = getStatusConfig(contract.status)
                                const expiryWarning = getExpiryWarning(contract)
                                const isExpanded = expandedContracts.has(contract.quickContractId)
                                const isLoading = actionLoading === contract.quickContractId

                                return (
                                    <div
                                        key={contract.quickContractId}
                                        className="hover:bg-slate-50 transition-colors"
                                    >
                                        {/* Contract Row */}
                                        <div
                                            className="p-4 cursor-pointer"
                                            onClick={() => handleViewContract(contract.quickContractId)}
                                        >
                                            <div className="flex items-center gap-4">

                                                {/* Contract Icon */}
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${contract.status === 'accepted' ? 'bg-emerald-100' :
                                                    contract.status === 'declined' ? 'bg-red-100' :
                                                        contract.status === 'sent' || contract.status === 'viewed' ? 'bg-purple-100' :
                                                            'bg-slate-100'
                                                    }`}>
                                                    <svg
                                                        className={`w-5 h-5 ${contract.status === 'accepted' ? 'text-emerald-600' :
                                                            contract.status === 'declined' ? 'text-red-600' :
                                                                contract.status === 'sent' || contract.status === 'viewed' ? 'text-purple-600' :
                                                                    'text-slate-600'
                                                            }`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={statusConfig.icon} />
                                                    </svg>
                                                </div>

                                                {/* Contract Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-medium text-slate-800 truncate">
                                                            {contract.contractName}
                                                        </h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
                                                            {statusConfig.label}
                                                        </span>
                                                        {expiryWarning && (
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${expiryWarning.urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {expiryWarning.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                                        {contract.primaryRecipientName && (
                                                            <span className="flex items-center gap-1 truncate">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                </svg>
                                                                {contract.primaryRecipientName}
                                                            </span>
                                                        )}
                                                        {contract.contractType && (
                                                            <span className="hidden sm:inline-flex items-center gap-1">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                                </svg>
                                                                {getContractTypeLabel(contract.contractType)}
                                                            </span>
                                                        )}
                                                        <span className="hidden md:inline-flex items-center gap-1">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            {formatRelativeTime(contract.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    {/* Show View button for completed contracts */}
                                                    {['accepted', 'declined', 'expired', 'cancelled'].includes(contract.status) && (
                                                        <button
                                                            onClick={() => handleViewContract(contract.quickContractId)}
                                                            className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-medium transition-colors"
                                                        >
                                                            View
                                                        </button>
                                                    )}

                                                    {/* Show Send Reminder for sent/viewed contracts */}
                                                    {['sent', 'viewed'].includes(contract.status) && (
                                                        <button
                                                            onClick={(e) => handleSendReminder(contract.quickContractId, e)}
                                                            disabled={isLoading}
                                                            className="px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            {isLoading ? 'Sending...' : 'Remind'}
                                                        </button>
                                                    )}

                                                    {/* Show Send button for drafts */}
                                                    {contract.status === 'draft' && (
                                                        <button
                                                            onClick={() => router.push(`/auth/quick-contract/${contract.quickContractId}/send`)}
                                                            className="px-3 py-1.5 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded-lg text-xs font-medium transition-colors"
                                                        >
                                                            Send
                                                        </button>
                                                    )}

                                                    {/* More Actions Dropdown */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleExpand(contract.quickContractId)
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                            </svg>
                                                        </button>

                                                        {isExpanded && (
                                                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                                                                <button
                                                                    onClick={() => handleViewContract(contract.quickContractId)}
                                                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                    </svg>
                                                                    View Details
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDuplicate(contract.quickContractId, e)}
                                                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                    </svg>
                                                                    Duplicate
                                                                </button>
                                                                {!['accepted', 'declined', 'expired', 'cancelled'].includes(contract.status) && (
                                                                    <button
                                                                        onClick={(e) => handleCancelContract(contract.quickContractId, e)}
                                                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                        Cancel
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 19: PAGINATION (Future Enhancement) */}
                {/* ============================================================== */}
                {filteredContracts.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>
                            Showing {filteredContracts.length} of {contracts.length} contracts
                        </span>
                        {/* Pagination controls will go here in future */}
                    </div>
                )}

            </main>

            {/* ================================================================== */}
            {/* SECTION 20: FEATURE CALLOUT */}
            {/* ================================================================== */}
            {contracts.length > 0 && contracts.length < 5 && (
                <div className="fixed bottom-6 right-6 max-w-sm">
                    <div className="bg-teal-600 text-white rounded-xl shadow-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-medium text-sm mb-1">Need to negotiate terms?</h4>
                                <p className="text-teal-100 text-xs">
                                    Use our Pro pathway for clause-by-clause negotiation with AI-powered compromise suggestions.
                                </p>
                                <Link
                                    href="/auth/contracts-dashboard"
                                    className="inline-block mt-2 text-xs font-medium underline hover:no-underline"
                                >
                                    Go to Pro Contracts →
                                </Link>
                            </div>
                            <button className="text-white/70 hover:text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}