'use client'

// ============================================================================
// QUICK CONTRACT - CONTRACT OVERVIEW & INTELLIGENCE DASHBOARD
// Version: 2.0
// Date: 5 February 2026
// Path: /app/auth/quick-contract/[id]/page.tsx
// Description: Rich contract intelligence summary with CLARENCE certification
//   stats, position analysis, category breakdown, agreement tracking,
//   activity timeline, and contextual navigation actions.
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

interface QuickContractMeta {
    quickContractId: string
    contractId: string | null
    contractName: string
    contractType: string | null
    description: string | null
    referenceNumber: string | null
    status: string
    createdByUserId: string
    createdAt: string
    updatedAt: string
    sentAt: string | null
    completedAt: string | null
}

interface UploadedContract {
    contractId: string
    contractName: string
    contractType: string | null
    status: string
    clauseCount: number
    createdAt: string
    updatedAt: string
}

interface ClauseData {
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    isHeader: boolean
    status: string
    clarenceCertified: boolean
    clarencePosition: number | null
    clarenceFairness: number | null
    clarenceSummary: string | null
    valueType: string | null
    extractedValue: string | null
    extractedUnit: string | null
}

interface ClauseEvent {
    eventId: string
    clauseId: string | null
    eventType: string
    userId: string
    partyRole: string | null
    userName: string
    message: string | null
    eventData: Record<string, unknown>
    createdAt: string
}

interface Recipient {
    recipientId: string
    recipientName: string
    recipientEmail: string
    recipientCompany: string | null
    status: string
    viewCount: number
    respondedAt: string | null
}

interface CategoryStats {
    category: string
    clauseCount: number
    certifiedCount: number
    avgPosition: number | null
    avgFairness: number | null
    agreedCount: number
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
    'pending': { label: 'Pending', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: '\u23F3' },
    'processing': { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: '\u2699\uFE0F' },
    'certifying': { label: 'Certifying', className: 'bg-purple-100 text-purple-700 border-purple-200', icon: '\u{1F50D}' },
    'certified': { label: 'Certified', className: 'bg-teal-100 text-teal-700 border-teal-200', icon: '\u2705' },
    'committed': { label: 'Committed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '\u{1F91D}' },
    'draft': { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: '\u{1F4DD}' },
    'sent': { label: 'Sent', className: 'bg-purple-100 text-purple-700 border-purple-200', icon: '\u{1F4E8}' },
    'cancelled': { label: 'Cancelled', className: 'bg-red-100 text-red-600 border-red-200', icon: '\u274C' }
}

const POSITION_LABELS: Record<number, string> = {
    1: 'Maximum Protection',
    2: 'Strong Protection',
    3: 'Moderate Protection',
    4: 'Slight Customer Favor',
    5: 'Balanced',
    6: 'Slight Provider Favor',
    7: 'Moderate Flexibility',
    8: 'Provider Advantage',
    9: 'Strong Provider Terms',
    10: 'Maximum Flexibility'
}

const POSITION_COLORS: Record<number, string> = {
    1: 'bg-emerald-600', 2: 'bg-emerald-500', 3: 'bg-teal-500',
    4: 'bg-teal-400', 5: 'bg-sky-500', 6: 'bg-blue-400',
    7: 'bg-blue-500', 8: 'bg-indigo-500', 9: 'bg-indigo-600',
    10: 'bg-violet-600'
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    'certified': { label: 'Clause Certified', color: 'bg-teal-500' },
    'agreed': { label: 'Agreed', color: 'bg-emerald-500' },
    'agreement_withdrawn': { label: 'Agreement Withdrawn', color: 'bg-amber-500' },
    'queried': { label: 'Query Raised', color: 'bg-orange-500' },
    'query_resolved': { label: 'Query Resolved', color: 'bg-sky-500' },
    'position_changed': { label: 'Position Changed', color: 'bg-purple-500' },
    'redrafted': { label: 'Clause Redrafted', color: 'bg-indigo-500' },
    'committed': { label: 'Contract Committed', color: 'bg-emerald-600' },
    'draft_edited': { label: 'Draft Edited', color: 'bg-slate-500' }
}

const CATEGORY_COLORS: Record<string, string> = {
    'Charges and Payment': 'bg-emerald-100 text-emerald-700',
    'Liability': 'bg-red-100 text-red-700',
    'Term and Termination': 'bg-amber-100 text-amber-700',
    'Service Levels': 'bg-blue-100 text-blue-700',
    'Confidentiality': 'bg-purple-100 text-purple-700',
    'Data Protection': 'bg-cyan-100 text-cyan-700',
    'Intellectual Property': 'bg-indigo-100 text-indigo-700',
    'Insurance': 'bg-orange-100 text-orange-700',
    'Employment': 'bg-pink-100 text-pink-700',
    'Dispute Resolution': 'bg-rose-100 text-rose-700',
    'Governance': 'bg-teal-100 text-teal-700',
    'General': 'bg-slate-100 text-slate-700',
    'Definitions': 'bg-gray-100 text-gray-600',
    'Audit': 'bg-lime-100 text-lime-700'
}

// ============================================================================
// SECTION 4: LOADING COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-teal-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-teal-600 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-teal-600">C</span>
                    </div>
                </div>
                <p className="text-slate-600 font-medium">Loading Contract Intelligence...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function ViewQuickContractPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ContractOverviewContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 6: MAIN CONTENT COMPONENT
// ============================================================================

function ContractOverviewContent() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const quickContractId = params.id as string

    // ========================================================================
    // SECTION 6A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

    // Data
    const [qcMeta, setQcMeta] = useState<QuickContractMeta | null>(null)
    const [uploadedContract, setUploadedContract] = useState<UploadedContract | null>(null)
    const [clauses, setClauses] = useState<ClauseData[]>([])
    const [events, setEvents] = useState<ClauseEvent[]>([])
    const [recipients, setRecipients] = useState<Recipient[]>([])
    const [partyMessageCount, setPartyMessageCount] = useState(0)

    // Derived
    const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])
    const [agreedClauseIds, setAgreedClauseIds] = useState<Set<string>>(new Set())
    const [queriedClauseIds, setQueriedClauseIds] = useState<Set<string>>(new Set())

    // Cancel modal
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // ========================================================================
    // SECTION 6B: DATA LOADING
    // ========================================================================

    const loadAllData = useCallback(async () => {
        if (!quickContractId) {
            setError('No contract ID provided')
            setLoading(false)
            return
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(quickContractId)) {
            setError('Invalid contract ID format')
            setLoading(false)
            return
        }

        try {
            // Auth check
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) {
                router.push('/auth/login')
                return
            }
            const authData = JSON.parse(auth)
            const user = authData.userInfo || authData
            if (!user?.userId) {
                router.push('/auth/login')
                return
            }
            setUserInfo(user)

            // 1. Load quick_contracts metadata
            const { data: qcData, error: qcError } = await supabase
                .from('quick_contracts')
                .select('*')
                .eq('quick_contract_id', quickContractId)
                .single()

            if (qcError || !qcData) {
                setError('Contract not found')
                setLoading(false)
                return
            }

            const meta: QuickContractMeta = {
                quickContractId: qcData.quick_contract_id,
                contractId: qcData.contract_id,
                contractName: qcData.contract_name,
                contractType: qcData.contract_type,
                description: qcData.description,
                referenceNumber: qcData.reference_number,
                status: qcData.status,
                createdByUserId: qcData.created_by_user_id,
                createdAt: qcData.created_at,
                updatedAt: qcData.updated_at,
                sentAt: qcData.sent_at,
                completedAt: qcData.completed_at
            }
            setQcMeta(meta)

            // 2. Load recipients
            const { data: recipData } = await supabase
                .from('qc_recipients')
                .select('recipient_id, recipient_name, recipient_email, recipient_company, status, view_count, responded_at')
                .eq('quick_contract_id', quickContractId)

            if (recipData) {
                setRecipients(recipData.map(r => ({
                    recipientId: r.recipient_id,
                    recipientName: r.recipient_name,
                    recipientEmail: r.recipient_email,
                    recipientCompany: r.recipient_company,
                    status: r.status,
                    viewCount: r.view_count || 0,
                    respondedAt: r.responded_at
                })))
            }

            // 3. If we have a linked contract_id, load the CLARENCE data
            if (meta.contractId) {
                // uploaded_contracts
                const { data: ucData } = await supabase
                    .from('uploaded_contracts')
                    .select('contract_id, contract_name, detected_contract_type, status, clause_count, created_at, updated_at')
                    .eq('contract_id', meta.contractId)
                    .single()

                if (ucData) {
                    setUploadedContract({
                        contractId: ucData.contract_id,
                        contractName: ucData.contract_name,
                        contractType: ucData.detected_contract_type,
                        status: ucData.status,
                        clauseCount: ucData.clause_count || 0,
                        createdAt: ucData.created_at,
                        updatedAt: ucData.updated_at
                    })
                }

                // uploaded_contract_clauses
                const { data: clauseData } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('clause_id, clause_number, clause_name, category, is_header, status, clarence_certified, clarence_position, clarence_fairness, clarence_summary, value_type, extracted_value, extracted_unit')
                    .eq('contract_id', meta.contractId)
                    .order('display_order', { ascending: true })

                if (clauseData) {
                    const mapped: ClauseData[] = clauseData.map(c => ({
                        clauseId: c.clause_id,
                        clauseNumber: c.clause_number,
                        clauseName: c.clause_name,
                        category: c.category || 'General',
                        isHeader: c.is_header || false,
                        status: c.status || 'pending',
                        clarenceCertified: c.clarence_certified || false,
                        clarencePosition: c.clarence_position,
                        clarenceFairness: c.clarence_fairness,
                        clarenceSummary: c.clarence_summary,
                        valueType: c.value_type,
                        extractedValue: c.extracted_value,
                        extractedUnit: c.extracted_unit
                    }))
                    setClauses(mapped)
                }

                // clause_events
                const { data: eventsData } = await supabase
                    .from('clause_events')
                    .select('event_id, clause_id, event_type, user_id, party_role, user_name, message, event_data, created_at')
                    .eq('contract_id', meta.contractId)
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (eventsData) {
                    setEvents(eventsData.map(e => ({
                        eventId: e.event_id,
                        clauseId: e.clause_id,
                        eventType: e.event_type,
                        userId: e.user_id,
                        partyRole: e.party_role,
                        userName: e.user_name || 'System',
                        message: e.message,
                        eventData: e.event_data || {},
                        createdAt: e.created_at
                    })))
                }

                // qc_party_messages count
                const { count } = await supabase
                    .from('qc_party_messages')
                    .select('message_id', { count: 'exact', head: true })
                    .eq('contract_id', meta.contractId)

                setPartyMessageCount(count || 0)
            }

            eventLogger.completed('quick_contract', 'overview_viewed', {
                quickContractId,
                contractId: meta.contractId
            })

        } catch (err) {
            console.error('Error loading contract overview:', err)
            setError('Failed to load contract data')
        } finally {
            setLoading(false)
        }
    }, [quickContractId, router, supabase])

    // ========================================================================
    // SECTION 6C: EFFECTS
    // ========================================================================

    useEffect(() => {
        loadAllData()
    }, [loadAllData])

    // Build agreement/query sets from events
    useEffect(() => {
        if (!events.length) return
        const agreed = new Set<string>()
        const queried = new Set<string>()

        // Events are loaded newest-first, so reverse for chronological processing
        const chronological = [...events].reverse()
        chronological.forEach(evt => {
            if (evt.eventType === 'agreed' && evt.clauseId) agreed.add(evt.clauseId)
            if (evt.eventType === 'agreement_withdrawn' && evt.clauseId) agreed.delete(evt.clauseId)
            if (evt.eventType === 'queried' && evt.clauseId) queried.add(evt.clauseId)
            if (evt.eventType === 'query_resolved' && evt.clauseId) queried.delete(evt.clauseId)
        })
        setAgreedClauseIds(agreed)
        setQueriedClauseIds(queried)
    }, [events])

    // Build category stats
    useEffect(() => {
        if (!clauses.length) return
        const leafCl = clauses.filter(c => !c.isHeader)
        const catMap = new Map<string, ClauseData[]>()

        leafCl.forEach(c => {
            const cat = c.category || 'General'
            if (!catMap.has(cat)) catMap.set(cat, [])
            catMap.get(cat)!.push(c)
        })

        const stats: CategoryStats[] = Array.from(catMap.entries()).map(([category, catClauses]) => {
            const certified = catClauses.filter(c => c.clarenceCertified)
            const positions = certified.filter(c => c.clarencePosition !== null).map(c => c.clarencePosition!)
            const fairness = certified.filter(c => c.clarenceFairness !== null).map(c => c.clarenceFairness!)
            const agreed = catClauses.filter(c => agreedClauseIds.has(c.clauseId))

            return {
                category,
                clauseCount: catClauses.length,
                certifiedCount: certified.length,
                avgPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
                avgFairness: fairness.length > 0 ? fairness.reduce((a, b) => a + b, 0) / fairness.length : null,
                agreedCount: agreed.length
            }
        }).sort((a, b) => b.clauseCount - a.clauseCount)

        setCategoryStats(stats)
    }, [clauses, agreedClauseIds])

    // ========================================================================
    // SECTION 6D: ACTION HANDLERS
    // ========================================================================

    async function handleCancelContract() {
        if (!qcMeta) return
        setActionLoading('cancel')
        try {
            await supabase
                .from('quick_contracts')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('quick_contract_id', quickContractId)

            eventLogger.completed('quick_contract', 'contract_cancelled', { quickContractId })
            await loadAllData()
            setShowCancelConfirm(false)
        } catch (err) {
            console.error('Cancel error:', err)
            setError('Failed to cancel contract')
        } finally {
            setActionLoading(null)
        }
    }

    // ========================================================================
    // SECTION 6E: HELPER FUNCTIONS
    // ========================================================================

    function formatShortDate(dateString: string | null): string {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        })
    }

    function timeAgo(dateString: string): string {
        const now = new Date()
        const then = new Date(dateString)
        const diffMs = now.getTime() - then.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        const diffHrs = Math.floor(diffMins / 60)
        if (diffHrs < 24) return `${diffHrs}h ago`
        const diffDays = Math.floor(diffHrs / 24)
        if (diffDays < 7) return `${diffDays}d ago`
        return formatShortDate(dateString)
    }

    function getPositionLabel(pos: number | null): string {
        if (pos === null) return 'Not assessed'
        return POSITION_LABELS[Math.round(pos)] || `Position ${pos}`
    }

    function getCategoryColor(category: string): string {
        return CATEGORY_COLORS[category] || 'bg-slate-100 text-slate-600'
    }

    function getEffectiveStatus(): string {
        if (uploadedContract?.status === 'committed') return 'committed'
        if (uploadedContract?.status) return uploadedContract.status
        if (qcMeta?.status) return qcMeta.status
        return 'pending'
    }

    // ========================================================================
    // SECTION 6F: DERIVED COMPUTATIONS
    // ========================================================================

    const leafClauses = clauses.filter(c => !c.isHeader)
    const certifiedClauses = leafClauses.filter(c => c.clarenceCertified)
    const isCertificationComplete = leafClauses.length > 0 && certifiedClauses.length === leafClauses.length
    const certPercent = leafClauses.length > 0 ? Math.round((certifiedClauses.length / leafClauses.length) * 100) : 0

    const positionsWithValues = certifiedClauses.filter(c => c.clarencePosition !== null)
    const avgPosition = positionsWithValues.length > 0
        ? positionsWithValues.reduce((sum, c) => sum + c.clarencePosition!, 0) / positionsWithValues.length
        : null

    const fairnessWithValues = certifiedClauses.filter(c => c.clarenceFairness !== null)
    const avgFairness = fairnessWithValues.length > 0
        ? fairnessWithValues.reduce((sum, c) => sum + c.clarenceFairness!, 0) / fairnessWithValues.length
        : null

    const agreedPercent = certifiedClauses.length > 0
        ? Math.round((agreedClauseIds.size / certifiedClauses.length) * 100) : 0

    const effectiveStatus = getEffectiveStatus()
    const statusCfg = CONTRACT_STATUS_CONFIG[effectiveStatus] || CONTRACT_STATUS_CONFIG['pending']

    // Position distribution for bar chart
    const positionDistribution: Record<number, number> = {}
    certifiedClauses.forEach(c => {
        if (c.clarencePosition !== null) {
            const rounded = Math.round(c.clarencePosition)
            positionDistribution[rounded] = (positionDistribution[rounded] || 0) + 1
        }
    })
    const maxPositionCount = Math.max(1, ...Object.values(positionDistribution))

    // ========================================================================
    // SECTION 7: LOADING STATE
    // ========================================================================

    if (loading) return <LoadingFallback />

    // ========================================================================
    // SECTION 8: ERROR STATE
    // ========================================================================

    if (error && !qcMeta) {
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
                    <Link href="/auth/quick-contract" className="text-teal-600 hover:text-teal-700 font-medium">
                        {'\u2190'} Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    if (!qcMeta) return null

    // ========================================================================
    // SECTION 9: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ============================================================ */}
            {/* SECTION 9A: HEADER */}
            {/* ============================================================ */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">Contract Intelligence</div>
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

            {/* ============================================================ */}
            {/* SECTION 9B: CONTRACT TITLE BAR */}
            {/* ============================================================ */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                                <span className="text-white font-bold text-xl">C</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1 flex-wrap">
                                    <h1 className="text-xl font-bold text-slate-800">{qcMeta.contractName}</h1>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.className}`}>
                                        {statusCfg.icon} {statusCfg.label}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500">
                                    {qcMeta.contractType || 'Contract'}
                                    {qcMeta.referenceNumber && <> &middot; Ref: {qcMeta.referenceNumber}</>}
                                    {' '}&middot; Created {formatShortDate(qcMeta.createdAt)}
                                    {' '}&middot; {leafClauses.length} clauses
                                </p>
                                {qcMeta.description && (
                                    <p className="text-xs text-slate-400 mt-1 max-w-xl">{qcMeta.description}</p>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            {qcMeta.contractId && effectiveStatus !== 'cancelled' && (
                                <button
                                    onClick={() => router.push(`/auth/quick-contract/studio/${qcMeta.contractId}`)}
                                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    {isCertificationComplete ? 'Open in Studio' : 'Continue Certification'}
                                </button>
                            )}
                            {effectiveStatus === 'committed' && qcMeta.contractId && (
                                <button
                                    onClick={() => router.push(`/auth/document-centre?contract_id=${qcMeta.contractId}`)}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    View Documents
                                </button>
                            )}
                            {!['committed', 'cancelled'].includes(effectiveStatus) && (
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    className="px-4 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 9C: MAIN CONTENT */}
            {/* ============================================================ */}
            <main className="max-w-6xl mx-auto px-6 py-8">

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* ======================================================== */}
                {/* SECTION 10: HERO STATS ROW */}
                {/* ======================================================== */}
                {leafClauses.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {/* Certification */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Certification</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCertificationComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isCertificationComplete ? 'Complete' : 'In Progress'}
                                </span>
                            </div>
                            <div className="text-3xl font-bold text-slate-800 mb-1">{certPercent}%</div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${isCertificationComplete ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                    style={{ width: `${certPercent}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">{certifiedClauses.length} of {leafClauses.length} clauses</p>
                        </div>

                        {/* Average Position */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Position</span>
                            </div>
                            <div className="text-3xl font-bold text-slate-800 mb-1">
                                {avgPosition !== null ? avgPosition.toFixed(1) : '\u2014'}
                            </div>
                            <p className="text-xs text-slate-500">{avgPosition !== null ? getPositionLabel(Math.round(avgPosition)) : 'Awaiting certification'}</p>
                            {avgPosition !== null && (
                                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-sky-500 rounded-full transition-all duration-700" style={{ width: `${(avgPosition / 10) * 100}%` }} />
                                </div>
                            )}
                        </div>

                        {/* Fairness Score */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fairness</span>
                            </div>
                            <div className="text-3xl font-bold text-slate-800 mb-1">
                                {avgFairness !== null ? `${Math.round(avgFairness)}%` : '\u2014'}
                            </div>
                            <p className="text-xs text-slate-500">
                                {avgFairness !== null
                                    ? (avgFairness >= 70 ? 'Well balanced' : avgFairness >= 50 ? 'Moderately fair' : 'Needs review')
                                    : 'Awaiting certification'}
                            </p>
                            {avgFairness !== null && (
                                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${avgFairness >= 70 ? 'bg-emerald-500' : avgFairness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                        style={{ width: `${avgFairness}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Agreement */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agreement</span>
                            </div>
                            <div className="text-3xl font-bold text-slate-800 mb-1">{agreedPercent}%</div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    {agreedClauseIds.size} agreed
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                    {queriedClauseIds.size} queried
                                </span>
                            </div>
                            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${agreedPercent}%` }} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 mb-8 text-center shadow-sm">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">No Clause Data Available</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            This contract hasn{'\u0027'}t been processed through CLARENCE certification yet.
                        </p>
                        {qcMeta.contractId && (
                            <button
                                onClick={() => router.push(`/auth/quick-contract/studio/${qcMeta.contractId}`)}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                            >
                                Open in Studio to Begin
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ======================================================== */}
                    {/* SECTION 11: LEFT COLUMN (2/3 width) */}
                    {/* ======================================================== */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* SECTION 11A: POSITION DISTRIBUTION */}
                        {certifiedClauses.length > 0 && Object.keys(positionDistribution).length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Position Distribution</h2>
                                <div className="space-y-2">
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map(pos => {
                                        const count = positionDistribution[pos] || 0
                                        const widthPercent = (count / maxPositionCount) * 100
                                        return (
                                            <div key={pos} className="flex items-center gap-3">
                                                <div className="w-6 text-right text-xs font-bold text-slate-500">{pos}</div>
                                                <div className="flex-1 h-6 bg-slate-50 rounded overflow-hidden relative">
                                                    {count > 0 && (
                                                        <div
                                                            className={`h-full rounded transition-all duration-500 ${POSITION_COLORS[pos] || 'bg-slate-400'}`}
                                                            style={{ width: `${widthPercent}%` }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="w-20 text-xs text-slate-500 truncate" title={POSITION_LABELS[pos]}>
                                                    {count > 0 ? `${count} clause${count > 1 ? 's' : ''}` : '\u2014'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-between mt-3 text-[10px] text-slate-400 uppercase tracking-wider px-9">
                                    <span>Customer Favour</span>
                                    <span>Balanced</span>
                                    <span>Provider Favour</span>
                                </div>
                            </div>
                        )}

                        {/* SECTION 11B: CATEGORY BREAKDOWN */}
                        {categoryStats.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Category Breakdown</h2>
                                <div className="space-y-3">
                                    {categoryStats.map(cat => (
                                        <div key={cat.category} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex-shrink-0 ${getCategoryColor(cat.category)}`}>
                                                {cat.category}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{cat.clauseCount} clause{cat.clauseCount !== 1 ? 's' : ''}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{cat.certifiedCount} certified</span>
                                                    {cat.agreedCount > 0 && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="text-emerald-600">{cat.agreedCount} agreed</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                {cat.avgPosition !== null && (
                                                    <div className="text-center">
                                                        <div className="text-sm font-bold text-slate-700">{cat.avgPosition.toFixed(1)}</div>
                                                        <div className="text-[10px] text-slate-400">Position</div>
                                                    </div>
                                                )}
                                                {cat.avgFairness !== null && (
                                                    <div className="text-center">
                                                        <div className={`text-sm font-bold ${cat.avgFairness >= 70 ? 'text-emerald-600' : cat.avgFairness >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {Math.round(cat.avgFairness)}%
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">Fairness</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SECTION 11C: ACTIVITY TIMELINE */}
                        {events.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">
                                    Recent Activity
                                    <span className="ml-2 text-xs font-normal text-slate-400 normal-case">({events.length} events)</span>
                                </h2>
                                <div className="space-y-0 relative">
                                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200"></div>
                                    {events.slice(0, 20).map((evt) => {
                                        const config = EVENT_TYPE_CONFIG[evt.eventType] || { label: evt.eventType, color: 'bg-slate-400' }
                                        const clauseName = clauses.find(c => c.clauseId === evt.clauseId)?.clauseName

                                        return (
                                            <div key={evt.eventId} className="flex items-start gap-3 relative py-2.5">
                                                <div className={`w-4 h-4 rounded-full ${config.color} flex-shrink-0 z-10 ring-2 ring-white`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-medium text-slate-700">{config.label}</span>
                                                        <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(evt.createdAt)}</span>
                                                    </div>
                                                    {clauseName && (
                                                        <p className="text-xs text-slate-500 mt-0.5 truncate">{clauseName}</p>
                                                    )}
                                                    {evt.userName && evt.userName !== 'System' && (
                                                        <p className="text-xs text-slate-400">by {evt.userName}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {events.length > 20 && (
                                        <div className="text-center pt-2">
                                            <span className="text-xs text-slate-400">+ {events.length - 20} more events</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ======================================================== */}
                    {/* SECTION 12: RIGHT COLUMN (1/3 width) */}
                    {/* ======================================================== */}
                    <div className="space-y-6">

                        {/* SECTION 12A: QUICK ACTIONS */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Quick Actions</h2>
                            <div className="space-y-2">
                                {qcMeta.contractId && effectiveStatus !== 'cancelled' && (
                                    <button
                                        onClick={() => router.push(`/auth/quick-contract/studio/${qcMeta.contractId}`)}
                                        className="w-full p-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg text-left transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-teal-800 group-hover:text-teal-900">
                                                    {isCertificationComplete ? 'Open in Studio' : 'Continue Certification'}
                                                </div>
                                                <div className="text-xs text-teal-600">
                                                    {isCertificationComplete ? 'Review and manage clauses' : `${certPercent}% certified`}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )}
                                {effectiveStatus === 'committed' && qcMeta.contractId && (
                                    <button
                                        onClick={() => router.push(`/auth/document-centre?contract_id=${qcMeta.contractId}`)}
                                        className="w-full p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-left transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-indigo-800 group-hover:text-indigo-900">Document Centre</div>
                                                <div className="text-xs text-indigo-600">Generate reports and evidence pack</div>
                                            </div>
                                        </div>
                                    </button>
                                )}
                                <button
                                    onClick={() => router.push('/auth/quick-contract')}
                                    className="w-full p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-400 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">Back to Dashboard</div>
                                            <div className="text-xs text-slate-500">View all contracts</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* SECTION 12B: PARTIES & RECIPIENTS */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Parties</h2>

                            {/* Creator */}
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">{userInfo?.firstName?.[0] || 'U'}</span>
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">{userInfo?.firstName} {userInfo?.lastName}</span>
                                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Initiator</span>
                                </div>
                                {userInfo?.company && <p className="text-xs text-slate-500 pl-8">{userInfo.company}</p>}
                            </div>

                            {/* Recipients */}
                            {recipients.length > 0 ? (
                                <div className="space-y-2">
                                    {recipients.map(r => {
                                        const rStatus = r.status === 'accepted' ? 'bg-emerald-100 text-emerald-700'
                                            : r.status === 'declined' ? 'bg-red-100 text-red-700'
                                                : r.status === 'viewed' ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-slate-100 text-slate-600'
                                        return (
                                            <div key={r.recipientId} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">{r.recipientName[0]}</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-800">{r.recipientName}</span>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rStatus}`}>{r.status}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 pl-8">{r.recipientEmail}</p>
                                                {r.recipientCompany && <p className="text-xs text-slate-400 pl-8">{r.recipientCompany}</p>}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">No recipients invited yet</p>
                            )}

                            {partyMessageCount > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {partyMessageCount} party message{partyMessageCount !== 1 ? 's' : ''} exchanged
                                </div>
                            )}
                        </div>

                        {/* SECTION 12C: KEY DATES */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Key Dates</h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Created</span>
                                    <span className="text-slate-800 font-medium">{formatShortDate(qcMeta.createdAt)}</span>
                                </div>
                                {qcMeta.sentAt && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Sent</span>
                                        <span className="text-slate-800 font-medium">{formatShortDate(qcMeta.sentAt)}</span>
                                    </div>
                                )}
                                {uploadedContract && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Last updated</span>
                                        <span className="text-slate-800 font-medium">{formatShortDate(uploadedContract.updatedAt)}</span>
                                    </div>
                                )}
                                {qcMeta.completedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Completed</span>
                                        <span className="text-emerald-700 font-medium">{formatShortDate(qcMeta.completedAt)}</span>
                                    </div>
                                )}
                                {events.length > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Total events</span>
                                        <span className="text-slate-800 font-medium">{events.length}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ============================================================ */}
            {/* SECTION 13: CANCEL CONFIRMATION MODAL */}
            {/* ============================================================ */}
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