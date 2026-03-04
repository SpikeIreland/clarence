'use client'

// ============================================================================
// CLARENCE HOME PAGE - Unified Contract Landing
// Version: 1.1
// Date: 27 February 2026
// Path: /app/auth/home/page.tsx
//
// PURPOSE:
// Universal landing page after login. Shows ALL contracts a user is involved
// in — regardless of pathway (Quick Create / Contract Create / Co-Create)
// and regardless of whether they initiated or were invited.
//
// Replaces the old role-based routing where customers went to
// contracts-dashboard and providers went to providerConfirmation.
//
// PRINCIPLE: One sign-in. One home. Role derived per contract.
//
// CHANGES v1.1:
// - Fixed: Pathway filter tabs now show contract counts
// - Fixed: Stats bar dynamically responds to active filter
// - Added: Delete contract functionality with database cascade
// - Added: Delete confirmation modal with pathway-aware cleanup
//
// DEPLOY: Copy this file to /app/auth/home/page.tsx
// ============================================================================


// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import { getRoleContext } from '@/lib/role-matrix'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'


// ============================================================================
// SECTION 2: INTERFACES & TYPES
// ============================================================================

interface UserInfo {
    userId: string
    email: string
    firstName: string
    lastName: string
    company: string
    companyId: string
    role: string
}

/** Unified contract card — aggregated across all pathways */
interface UnifiedContract {
    id: string
    name: string
    contractType: string
    contractTypeKey: string | null
    initiatorPartyRole: string | null
    pathway: 'quick_create' | 'contract_create' | 'co_create' | 'training'
    relationship: 'initiator' | 'respondent'
    status: string
    statusLabel: string
    progressSummary: string
    userRoleLabel: string
    counterpartyName: string
    counterpartyCompany: string
    lastActivity: string
    createdAt: string
    clauseStats?: { agreed: number; total: number }
    isInviteHighlight: boolean
    studioUrl: string
}

interface HomeStats {
    activeNegotiations: number
    completed: number
    awaitingResponse: number
    averageResolutionDays: number | null
}

/** Delete modal state */
interface DeleteModalState {
    isOpen: boolean
    contract: UnifiedContract | null
    isDeleting: boolean
    error: string | null
}


// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

/** Pathway badge colours matching CLARENCE branding */
const PATHWAY_BADGES: Record<string, { label: string; bg: string; text: string }> = {
    quick_create: { label: 'Quick Create', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    contract_create: { label: 'Contract Create', bg: 'bg-blue-100', text: 'text-blue-700' },
    co_create: { label: 'Co-Create', bg: 'bg-violet-100', text: 'text-violet-700' },
    tendering: { label: 'Tendering', bg: 'bg-orange-100', text: 'text-orange-700' },
    training: { label: 'Training', bg: 'bg-amber-100', text: 'text-amber-700' },
}


/** Status colours for progress indicators */
const STATUS_COLOURS: Record<string, string> = {
    active: 'bg-emerald-500',
    awaiting: 'bg-amber-500',
    calculating: 'bg-blue-500',
    completed: 'bg-slate-400',
    draft: 'bg-slate-300',
}

/** Filter tab definitions with keys */
const FILTER_TABS = [
    { key: 'all', label: 'All' },
    { key: 'quick_create', label: 'Quick Create' },
    { key: 'contract_create', label: 'Contract Create' },
    { key: 'co_create', label: 'Co-Create' },
    { key: 'tendering', label: 'Tendering' },
    { key: 'training', label: 'Training' },
] as const


// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

/**
 * Derive the user's role label for a contract using the role-matrix system.
 * Falls back to "Initiator" / "Respondent" for older contracts without role data.
 */
function deriveRoleLabel(
    contractTypeKey: string | null,
    initiatorPartyRole: string | null,
    isInitiator: boolean
): string {
    if (contractTypeKey && initiatorPartyRole) {
        try {
            const ctx = getRoleContext(
                contractTypeKey,
                initiatorPartyRole as 'protected' | 'providing',
                isInitiator
            )
            return ctx.userRoleLabel
        } catch {
            // Fallback for unknown contract types
        }
    }
    return isInitiator ? 'Initiator' : 'Respondent'
}

/**
 * Format a date string into a human-readable relative time.
 * e.g. "2 hours ago", "Yesterday", "3 days ago"
 */
function formatRelativeTime(dateString: string): string {
    if (!dateString) return ''
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Format a date string as a readable date.
 */
function formatDate(dateString: string): string {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

/**
 * Build the studio URL for a contract based on its pathway.
 */
function buildStudioUrl(pathway: string, id: string, isTraining?: boolean): string {
    switch (pathway) {
        case 'quick_create':
            return `/auth/quick-contract/studio/${id}`
        case 'contract_create':
            return `/auth/contract-studio?session_id=${id}`
        case 'training':
            return `/auth/contract-studio?session_id=${id}`
        case 'co_create':
            return `/auth/co-create-studio?session_id=${id}`
        default:
            return `/auth/home`
    }
}

/**
 * Calculate stats from a given set of contracts.
 * Used by both initial load and dynamic filter updates.
 */
function calculateStats(contractList: UnifiedContract[]): HomeStats {
    const active = contractList.filter(c =>
        c.statusLabel === 'Active' || c.statusLabel === 'Setup'
    ).length
    const completed = contractList.filter(c =>
        c.statusLabel === 'Completed'
    ).length
    const awaiting = contractList.filter(c =>
        c.statusLabel === 'Awaiting Response' || c.statusLabel === 'Invited'
    ).length

    return {
        activeNegotiations: active,
        completed,
        awaitingResponse: awaiting,
        averageResolutionDays: null,
    }
}

/**
 * Count contracts per pathway for filter tab badges.
 */
function countByPathway(contractList: UnifiedContract[]): Record<string, number> {
    const counts: Record<string, number> = {
        all: contractList.length,
        quick_create: 0,
        contract_create: 0,
        co_create: 0,
        tendering: 0,
        training: 0,
    }
    contractList.forEach(c => {
        if (counts[c.pathway] !== undefined) {
            counts[c.pathway]++
        }
    })
    return counts
}


// ============================================================================
// SECTION 5: INNER COMPONENT (Wrapped in Suspense)
// ============================================================================

function HomePageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // ========================================================================
    // SECTION 5A: STATE
    // ========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contracts, setContracts] = useState<UnifiedContract[]>([])
    const [stats, setStats] = useState<HomeStats>({
        activeNegotiations: 0,
        completed: 0,
        awaitingResponse: 0,
        averageResolutionDays: null,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeFilter, setActiveFilter] = useState<'all' | 'quick_create' | 'contract_create' | 'co_create' | 'tendering' | 'training'>('all')
    const [showWelcome, setShowWelcome] = useState(false)

    /** Delete modal state */
    const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
        isOpen: false,
        contract: null,
        isDeleting: false,
        error: null,
    })

    // ========================================================================
    // SECTION 5B: LOAD USER INFO
    // ========================================================================

    const loadUserInfo = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/auth/login')
                return null
            }

            const { data: profile } = await supabase
                .from('users')
                .select('first_name, last_name, company_name, company_id, role')
                .eq('user_id', user.id)
                .single()

            const info: UserInfo = {
                userId: user.id,
                email: user.email || '',
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
                company: profile?.company_name || '',
                companyId: profile?.company_id || '',
                role: profile?.role || '',
            }

            setUserInfo(info)

            // Check if this is first login (show welcome state)
            const hasVisitedHome = localStorage.getItem('clarence_home_visited')
            if (!hasVisitedHome) {
                setShowWelcome(true)
                localStorage.setItem('clarence_home_visited', 'true')
            }

            return info
        } catch (err) {
            console.error('Error loading user info:', err)
            setError('Failed to load user information')
            return null
        }
    }, [supabase, router])

    // ========================================================================
    // SECTION 5C: FETCH QUICK CREATE CONTRACTS (Initiator)
    // ========================================================================

    const fetchQuickCreateInitiated = useCallback(async (userId: string): Promise<UnifiedContract[]> => {
        try {
            const { data, error } = await supabase
                .from('uploaded_contracts')
                .select(`
                    contract_id,
                    contract_name,
                    contract_type_key,
                    initiator_party_role,
                    status,
                    created_at,
                    updated_at,
                    uploaded_by_user_id
                `)
                .eq('uploaded_by_user_id', userId)
                .order('updated_at', { ascending: false })

            if (error) {
                console.error('Error fetching QC initiated:', error)
                return []
            }

            if (!data) return []

            // For each contract, fetch recipient info and clause count
            const contractsWithRecipients = await Promise.all(
                data.map(async (contract) => {
                    const { data: recipients } = await supabase
                        .from('qc_recipients')
                        .select('recipient_name, recipient_company, status, recipient_email')
                        .eq('quick_contract_id', contract.contract_id)
                        .limit(1)

                    const recipient = recipients?.[0]

                    // Get clause count from uploaded_contract_clauses
                    const { count: clauseCount } = await supabase
                        .from('uploaded_contract_clauses')
                        .select('clause_id', { count: 'exact', head: true })
                        .eq('contract_id', contract.contract_id)

                    const totalClauses = clauseCount || 0

                    // Fetch clause agreement stats
                    let clauseStats = undefined
                    if (totalClauses > 0) {
                        const { data: events } = await supabase
                            .from('qc_clause_events')
                            .select('clause_id, event_type, party_role')
                            .eq('contract_id', contract.contract_id)
                            .in('event_type', ['agreed', 'agreement_withdrawn'])

                        if (events) {
                            const initiatorAgreed = new Set<string>()
                            const respondentAgreed = new Set<string>()
                            events.forEach(e => {
                                if (e.event_type === 'agreed') {
                                    if (e.party_role === 'initiator') initiatorAgreed.add(e.clause_id)
                                    else respondentAgreed.add(e.clause_id)
                                } else if (e.event_type === 'agreement_withdrawn') {
                                    if (e.party_role === 'initiator') initiatorAgreed.delete(e.clause_id)
                                    else respondentAgreed.delete(e.clause_id)
                                }
                            })
                            let bothAgreed = 0
                            initiatorAgreed.forEach(id => {
                                if (respondentAgreed.has(id)) bothAgreed++
                            })
                            clauseStats = { agreed: bothAgreed, total: totalClauses }
                        }
                    }

                    // Determine status label
                    let statusLabel = 'Draft'
                    let progressSummary = 'Setting up contract'
                    if (contract.status === 'completed' || contract.status === 'committed') {
                        statusLabel = 'Completed'
                        progressSummary = 'Contract agreed'
                    } else if (recipient && recipient.status === 'accepted') {
                        statusLabel = 'Active'
                        progressSummary = clauseStats
                            ? `${clauseStats.agreed} of ${clauseStats.total} clauses agreed`
                            : 'Negotiation in progress'
                    } else if (recipient && (recipient.status === 'invited' || recipient.status === 'sent' || recipient.status === 'pending')) {
                        statusLabel = 'Awaiting Response'
                        progressSummary = `Waiting for ${recipient.recipient_name || recipient.recipient_email || 'provider'} to respond`
                    } else if (!recipient) {
                        statusLabel = 'Draft'
                        progressSummary = 'No provider invited yet'
                    }

                    return {
                        id: contract.contract_id,
                        name: contract.contract_name,
                        contractType: '',
                        contractTypeKey: contract.contract_type_key || null,
                        initiatorPartyRole: contract.initiator_party_role || null,
                        pathway: 'quick_create' as const,
                        relationship: 'initiator' as const,
                        status: contract.status || 'draft',
                        statusLabel,
                        progressSummary,
                        userRoleLabel: deriveRoleLabel(
                            contract.contract_type_key,
                            contract.initiator_party_role,
                            true
                        ),
                        counterpartyName: recipient?.recipient_name || '',
                        counterpartyCompany: recipient?.recipient_company || '',
                        lastActivity: contract.updated_at || contract.created_at,
                        createdAt: contract.created_at,
                        clauseStats,
                        isInviteHighlight: false,
                        studioUrl: buildStudioUrl('quick_create', contract.contract_id),
                    }
                })
            )

            return contractsWithRecipients
        } catch (err) {
            console.error('Error in fetchQuickCreateInitiated:', err)
            return []
        }
    }, [supabase])

    // ========================================================================
    // SECTION 5D: FETCH QUICK CREATE CONTRACTS (Respondent / Invited)
    // ========================================================================

    const fetchQuickCreateInvited = useCallback(async (userId: string, email: string): Promise<UnifiedContract[]> => {
        try {
            // Find contracts where this user is a recipient (by user_id or email)
            let recipientData: any[] = []

            // First try by user_id (if linked)
            const { data: byUserId } = await supabase
                .from('qc_recipients')
                .select(`
                    recipient_id,
                    quick_contract_id,
                    recipient_name,
                    recipient_company,
                    status,
                    responded_at,
                    created_at
                `)
                .eq('user_id', userId)

            if (byUserId) recipientData = [...byUserId]

            // Also try by email (for recipients not yet linked)
            const { data: byEmail } = await supabase
                .from('qc_recipients')
                .select(`
                    recipient_id,
                    quick_contract_id,
                    recipient_name,
                    recipient_company,
                    status,
                    responded_at,
                    created_at
                `)
                .eq('recipient_email', email)

            if (byEmail) {
                const existingIds = new Set(recipientData.map(r => r.quick_contract_id))
                byEmail.forEach(r => {
                    if (!existingIds.has(r.quick_contract_id)) {
                        recipientData.push(r)
                    }
                })
            }

            if (recipientData.length === 0) return []

            // Fetch the contract details for each
            const contracts = await Promise.all(
                recipientData.map(async (recipient) => {
                    const { data: contract } = await supabase
                        .from('uploaded_contracts')
                        .select(`
                            contract_id,
                            contract_name,
                            contract_type_key,
                            initiator_party_role,
                            status,
                            created_at,
                            updated_at,
                            uploaded_by_user_id
                        `)
                        .eq('contract_id', recipient.quick_contract_id)
                        .single()

                    if (!contract) return null

                    // Don't show contracts the user also initiated (avoid duplicates)
                    if (contract.uploaded_by_user_id === userId) return null

                    // Get initiator info for counterparty display
                    const { data: initiator } = await supabase
                        .from('users')
                        .select('first_name, last_name, company_name')
                        .eq('user_id', contract.uploaded_by_user_id)
                        .single()

                    // Get clause count
                    const { count: clauseCount } = await supabase
                        .from('uploaded_contract_clauses')
                        .select('clause_id', { count: 'exact', head: true })
                        .eq('contract_id', contract.contract_id)

                    const totalClauses = clauseCount || 0

                    // Clause stats
                    let clauseStats = undefined
                    if (totalClauses > 0) {
                        const { data: events } = await supabase
                            .from('qc_clause_events')
                            .select('clause_id, event_type, party_role')
                            .eq('contract_id', contract.contract_id)
                            .in('event_type', ['agreed', 'agreement_withdrawn'])

                        if (events) {
                            const initiatorAgreed = new Set<string>()
                            const respondentAgreed = new Set<string>()
                            events.forEach(e => {
                                if (e.event_type === 'agreed') {
                                    if (e.party_role === 'initiator') initiatorAgreed.add(e.clause_id)
                                    else respondentAgreed.add(e.clause_id)
                                } else if (e.event_type === 'agreement_withdrawn') {
                                    if (e.party_role === 'initiator') initiatorAgreed.delete(e.clause_id)
                                    else respondentAgreed.delete(e.clause_id)
                                }
                            })
                            let bothAgreed = 0
                            initiatorAgreed.forEach(id => {
                                if (respondentAgreed.has(id)) bothAgreed++
                            })
                            clauseStats = { agreed: bothAgreed, total: totalClauses }
                        }
                    }

                    // Determine status
                    let statusLabel = 'Invited'
                    let progressSummary = 'You have been invited to negotiate'
                    if (contract.status === 'completed' || contract.status === 'committed') {
                        statusLabel = 'Completed'
                        progressSummary = 'Contract agreed'
                    } else if (recipient.status === 'accepted') {
                        statusLabel = 'Active'
                        progressSummary = clauseStats
                            ? `${clauseStats.agreed} of ${clauseStats.total} clauses agreed`
                            : 'Negotiation in progress'
                    }

                    // Check if this contract should be highlighted
                    const pendingInvite = typeof window !== 'undefined'
                        ? sessionStorage.getItem('pending_invite_contract')
                        : null

                    return {
                        id: contract.contract_id,
                        name: contract.contract_name,
                        contractType: '',
                        contractTypeKey: contract.contract_type_key || null,
                        initiatorPartyRole: contract.initiator_party_role || null,
                        pathway: 'quick_create' as const,
                        relationship: 'respondent' as const,
                        status: contract.status || 'draft',
                        statusLabel,
                        progressSummary,
                        userRoleLabel: deriveRoleLabel(
                            contract.contract_type_key,
                            contract.initiator_party_role,
                            false
                        ),
                        counterpartyName: initiator
                            ? `${initiator.first_name || ''} ${initiator.last_name || ''}`.trim()
                            : '',
                        counterpartyCompany: initiator?.company_name || '',
                        lastActivity: contract.updated_at || contract.created_at,
                        createdAt: contract.created_at,
                        clauseStats,
                        isInviteHighlight: pendingInvite === contract.contract_id,
                        studioUrl: buildStudioUrl('quick_create', contract.contract_id),
                    }
                })
            )

            return contracts.filter(Boolean) as UnifiedContract[]
        } catch (err) {
            console.error('Error in fetchQuickCreateInvited:', err)
            return []
        }
    }, [supabase])

    // ========================================================================
    // SECTION 5E: FETCH CONTRACT CREATE / CO-CREATE SESSIONS
    // ========================================================================

    const fetchContractCreateSessions = useCallback(async (userId: string, companyId: string): Promise<UnifiedContract[]> => {
        try {
            // Fetch sessions where user is customer (initiator) or provider (respondent)
            const { data: sessions, error: sessionsError } = await supabase
                .from('sessions')
                .select(`
                    session_id,
                    session_number,
                    customer_company,
                    provider_company,
                    customer_contact_name,
                    provider_contact_name,
                    contract_type_key,
                    initiator_party_role,
                    phase,
                    status,
                    alignment_percentage,
                    is_training,
                    created_at,
                    updated_at,
                    customer_id,
                    provider_id
                `)
                .or(`customer_id.eq.${userId},provider_id.eq.${userId}`)
                .order('updated_at', { ascending: false })

            if (sessionsError) {
                console.error('Error fetching sessions:', sessionsError)
                return []
            }

            if (!sessions || sessions.length === 0) return []

            return sessions.map(session => {
                const isTraining = session.is_training === true
                const isInitiator = session.customer_id === userId

                // Determine counterparty
                const counterpartyName = isInitiator
                    ? session.provider_contact_name || ''
                    : session.customer_contact_name || ''
                const counterpartyCompany = isInitiator
                    ? session.provider_company || ''
                    : session.customer_company || ''

                // Determine status
                let statusLabel = 'Draft'
                let progressSummary = 'Setting up contract'
                const phase = session.phase || 1

                if (session.status === 'completed' || session.status === 'agreed') {
                    statusLabel = 'Completed'
                    progressSummary = 'Contract agreed'
                } else if (session.status === 'active' || phase >= 3) {
                    statusLabel = 'Active'
                    const alignment = session.alignment_percentage
                    progressSummary = alignment
                        ? `Phase ${phase} · ${alignment}% aligned`
                        : `Phase ${phase} · Negotiation in progress`
                } else if (session.status === 'providers_invited' || session.status === 'provider_invited') {
                    statusLabel = 'Awaiting Response'
                    progressSummary = 'Waiting for provider to complete onboarding'
                } else if (phase <= 2) {
                    statusLabel = 'Setup'
                    progressSummary = 'Completing contract preparation'
                }

                const pathway = isTraining ? 'training' : 'contract_create'

                return {
                    id: session.session_id,
                    name: `${session.customer_company || 'Contract'} — ${session.session_number || ''}`,
                    contractType: '',
                    contractTypeKey: session.contract_type_key || null,
                    initiatorPartyRole: session.initiator_party_role || null,
                    pathway: pathway as 'contract_create' | 'training',
                    relationship: isInitiator ? 'initiator' as const : 'respondent' as const,
                    status: session.status || 'draft',
                    statusLabel,
                    progressSummary,
                    userRoleLabel: deriveRoleLabel(
                        session.contract_type_key,
                        session.initiator_party_role,
                        isInitiator
                    ),
                    counterpartyName,
                    counterpartyCompany,
                    lastActivity: session.updated_at || session.created_at,
                    createdAt: session.created_at,
                    clauseStats: undefined,
                    isInviteHighlight: false,
                    studioUrl: buildStudioUrl(pathway, session.session_id, isTraining),
                }
            })
        } catch (err) {
            console.error('Error in fetchContractCreateSessions:', err)
            return []
        }
    }, [supabase])

    // ========================================================================
    // SECTION 5F: MAIN DATA LOADER (Aggregates all pathways)
    // ========================================================================

    const loadAllContracts = useCallback(async () => {
        setLoading(true)
        setError(null)

        const info = await loadUserInfo()
        if (!info) {
            setLoading(false)
            return
        }

        try {
            // Fetch from all pathways in parallel
            const [qcInitiated, qcInvited, ccSessions] = await Promise.all([
                fetchQuickCreateInitiated(info.userId),
                fetchQuickCreateInvited(info.userId, info.email),
                fetchContractCreateSessions(info.userId, info.companyId),
            ])

            // Merge and sort by last activity (most recent first)
            const allContracts = [...qcInitiated, ...qcInvited, ...ccSessions]
                .sort((a, b) => {
                    // Invite highlights always go first
                    if (a.isInviteHighlight && !b.isInviteHighlight) return -1
                    if (!a.isInviteHighlight && b.isInviteHighlight) return 1
                    // Then sort by last activity
                    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
                })

            setContracts(allContracts)

            // Calculate stats from full dataset (will be recalculated on filter change)
            setStats(calculateStats(allContracts))

            // Clear invite highlight from sessionStorage after loading
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('pending_invite_contract')
            }

            // Log page view
            eventLogger.completed('home', 'home_page_loaded', {
                totalContracts: allContracts.length,
                activeCount: calculateStats(allContracts).activeNegotiations,
                completedCount: calculateStats(allContracts).completed,
            })

        } catch (err) {
            console.error('Error loading contracts:', err)
            setError('Failed to load contracts. Please try refreshing the page.')
        } finally {
            setLoading(false)
        }
    }, [loadUserInfo, fetchQuickCreateInitiated, fetchQuickCreateInvited, fetchContractCreateSessions])

    // ========================================================================
    // SECTION 5G: USE EFFECTS
    // ========================================================================

    useEffect(() => {
        loadAllContracts()
    }, [loadAllContracts])

    // ========================================================================
    // SECTION 5H: COMPUTED VALUES
    // ========================================================================

    /** All contracts — sorted by most recent activity, invite highlights pinned to top */
    const sortedContracts = [...contracts].sort((a, b) => {
        // Invite highlights always first
        if (a.isInviteHighlight && !b.isInviteHighlight) return -1
        if (!a.isInviteHighlight && b.isInviteHighlight) return 1
        // Then sort by last activity (most recent first)
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    })

    /** Apply pathway filter */
    const filteredContracts = activeFilter === 'all'
        ? sortedContracts
        : sortedContracts.filter(c => c.pathway === activeFilter)

    /** Dynamic stats that respond to the active filter */
    const filteredStats = calculateStats(filteredContracts)

    /** Count of contracts per pathway (for filter tab badges) */
    const pathwayCounts = countByPathway(contracts)

    // ========================================================================
    // SECTION 5I: EVENT HANDLERS
    // ========================================================================

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/')
    }

    const handleEnterContract = (contract: UnifiedContract) => {
        eventLogger.completed('home', 'enter_contract_clicked', {
            contractId: contract.id,
            pathway: contract.pathway,
            relationship: contract.relationship,
        })
        router.push(contract.studioUrl)
    }

    const dismissWelcome = () => {
        setShowWelcome(false)
    }

    // ========================================================================
    // SECTION 5J: DELETE CONTRACT HANDLER
    // ========================================================================

    /**
     * Open the delete confirmation modal for a contract.
     * Only the initiator should be able to delete.
     */
    const handleDeleteRequest = (contract: UnifiedContract) => {
        setDeleteModal({
            isOpen: true,
            contract,
            isDeleting: false,
            error: null,
        })
    }

    /**
     * Close the delete modal without deleting.
     */
    const handleDeleteCancel = () => {
        setDeleteModal({
            isOpen: false,
            contract: null,
            isDeleting: false,
            error: null,
        })
    }

    /**
     * Execute the delete with proper database cascade.
     * Different pathways require different table cleanup.
     */
    const handleDeleteConfirm = async () => {
        const contract = deleteModal.contract
        if (!contract) return

        setDeleteModal(prev => ({ ...prev, isDeleting: true, error: null }))

        try {
            if (contract.pathway === 'quick_create') {
                // ============================================================
                // Quick Create pathway: cascade delete across QC tables
                // Order: child tables first, then parent
                // ============================================================

                // 1. Delete generated documents from storage (if any)
                const { data: docs } = await supabase
                    .from('generated_documents')
                    .select('storage_path')
                    .eq('contract_id', contract.id)

                if (docs && docs.length > 0) {
                    const paths = docs.map(d => d.storage_path).filter(Boolean)
                    if (paths.length > 0) {
                        await supabase.storage.from('documents').remove(paths)
                    }
                }

                // 2. Delete generated documents records
                await supabase
                    .from('generated_documents')
                    .delete()
                    .eq('contract_id', contract.id)

                // 3. Delete party messages
                await supabase
                    .from('qc_party_messages')
                    .delete()
                    .eq('contract_id', contract.id)

                // 4. Delete clause events
                await supabase
                    .from('qc_clause_events')
                    .delete()
                    .eq('contract_id', contract.id)

                // 5. Delete clause chat messages
                await supabase
                    .from('clause_chat_messages')
                    .delete()
                    .eq('contract_id', contract.id)

                // 6. Delete clause range mappings
                await supabase
                    .from('clause_range_mappings')
                    .delete()
                    .eq('contract_id', contract.id)

                // 7. Delete uploaded contract clauses
                await supabase
                    .from('uploaded_contract_clauses')
                    .delete()
                    .eq('contract_id', contract.id)

                // 8. Delete recipients
                await supabase
                    .from('qc_recipients')
                    .delete()
                    .eq('quick_contract_id', contract.id)

                // 9. Delete the parent contract record
                const { error: deleteError } = await supabase
                    .from('uploaded_contracts')
                    .delete()
                    .eq('contract_id', contract.id)

                if (deleteError) {
                    throw new Error(`Failed to delete contract: ${deleteError.message}`)
                }

            } else if (contract.pathway === 'contract_create' || contract.pathway === 'training') {
                // ============================================================
                // Contract Create / Training pathway: cascade delete session
                // Order: child tables first, then parent
                // ============================================================

                // 1. Delete generated documents
                await supabase
                    .from('generated_documents')
                    .delete()
                    .eq('session_id', contract.id)

                // 2. Delete party messages
                await supabase
                    .from('party_messages')
                    .delete()
                    .eq('session_id', contract.id)

                // 3. Delete clause chat messages
                await supabase
                    .from('clause_chat_messages')
                    .delete()
                    .eq('session_id', contract.id)

                // 4. Delete session clause positions
                await supabase
                    .from('session_clause_positions')
                    .delete()
                    .eq('session_id', contract.id)

                // 5. Delete leverage calculations
                await supabase
                    .from('leverage_calculations')
                    .delete()
                    .eq('session_id', contract.id)

                // 6. Delete negotiation actions / interactions
                await supabase
                    .from('negotiation_actions')
                    .delete()
                    .eq('session_id', contract.id)

                // 7. Delete phase inputs
                await supabase
                    .from('phase_inputs')
                    .delete()
                    .eq('session_id', contract.id)

                // 8. Delete uploaded contract clauses (linked via session)
                const { data: linkedContracts } = await supabase
                    .from('uploaded_contracts')
                    .select('contract_id')
                    .eq('session_id', contract.id)

                if (linkedContracts) {
                    for (const lc of linkedContracts) {
                        await supabase
                            .from('uploaded_contract_clauses')
                            .delete()
                            .eq('contract_id', lc.contract_id)
                    }
                    // Delete the uploaded_contracts records themselves
                    await supabase
                        .from('uploaded_contracts')
                        .delete()
                        .eq('session_id', contract.id)
                }

                // 9. Delete audit log entries
                await supabase
                    .from('audit_log')
                    .delete()
                    .eq('session_id', contract.id)

                // 10. Delete the session itself
                const { error: deleteError } = await supabase
                    .from('sessions')
                    .delete()
                    .eq('session_id', contract.id)

                if (deleteError) {
                    throw new Error(`Failed to delete session: ${deleteError.message}`)
                }
            }

            // Log the deletion
            eventLogger.completed('home', 'contract_deleted', {
                contractId: contract.id,
                pathway: contract.pathway,
                contractName: contract.name,
            })

            // Remove from local state (no need to refetch)
            setContracts(prev => prev.filter(c => c.id !== contract.id))

            // Close the modal
            setDeleteModal({
                isOpen: false,
                contract: null,
                isDeleting: false,
                error: null,
            })

        } catch (err: any) {
            console.error('Error deleting contract:', err)
            setDeleteModal(prev => ({
                ...prev,
                isDeleting: false,
                error: err.message || 'Failed to delete contract. Please try again.',
            }))
        }
    }

    // ========================================================================
    // SECTION 6: LOADING STATE RENDER
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
                {/* Header skeleton */}
                <header className="h-14 bg-slate-800" />
                {/* Content skeleton */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Stats skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                                <div className="h-3 bg-slate-200 rounded w-24 mb-3" />
                                <div className="h-8 bg-slate-200 rounded w-12" />
                            </div>
                        ))}
                    </div>
                    {/* Cards skeleton */}
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="h-4 bg-slate-200 rounded w-48 mb-3" />
                                        <div className="h-3 bg-slate-200 rounded w-64 mb-2" />
                                        <div className="h-3 bg-slate-200 rounded w-32" />
                                    </div>
                                    <div className="h-9 bg-slate-200 rounded w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: ERROR STATE RENDER
    // ========================================================================

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
                <header className="h-14 bg-slate-800" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">Something went wrong</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <button
                            onClick={loadAllContracts}
                            className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 8: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">

            {/* ============================================================ */}
            {/* SECTION 8A: HEADER / NAVIGATION                              */}
            {/* ============================================================ */}
            <AuthenticatedHeader
                activePage="home"
                userInfo={userInfo}
                onSignOut={handleSignOut}
            />

            {/* ============================================================ */}
            {/* SECTION 8B: MAIN CONTENT AREA                                */}
            {/* ============================================================ */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ======================================================== */}
                {/* SECTION 8C: WELCOME BANNER (First visit or invite)        */}
                {/* ======================================================== */}
                {showWelcome && (
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 mb-8 text-white relative">
                        <button
                            onClick={dismissWelcome}
                            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-xl font-bold mb-2">
                            Welcome to CLARENCE, {userInfo?.firstName || 'there'}
                        </h2>
                        <p className="text-emerald-100 text-sm max-w-2xl">
                            This is your Home page — a single view of every contract you&apos;re involved in,
                            whether you started it or were invited. Your role on each contract is shown on the card.
                            Click &ldquo;Enter&rdquo; to go directly to the negotiation studio.
                        </p>
                    </div>
                )}

                {/* ======================================================== */}
                {/* SECTION 8D: STATS BAR (Responds to active filter)         */}
                {/* ======================================================== */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {/* Active Negotiations */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                            Active Negotiations
                        </p>
                        <p className="text-2xl font-bold text-slate-800">{filteredStats.activeNegotiations}</p>
                    </div>
                    {/* Completed */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                            Completed
                        </p>
                        <p className="text-2xl font-bold text-emerald-600">{filteredStats.completed}</p>
                    </div>
                    {/* Awaiting Response */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                            Awaiting Response
                        </p>
                        <p className="text-2xl font-bold text-amber-600">{filteredStats.awaitingResponse}</p>
                    </div>
                    {/* Total Contracts (filtered count) */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                            {activeFilter === 'all' ? 'Total Contracts' : `${PATHWAY_BADGES[activeFilter]?.label || ''} Contracts`}
                        </p>
                        <p className="text-2xl font-bold text-slate-800">{filteredContracts.length}</p>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* SECTION 8E: QUICK ACTIONS BAR                             */}
                {/* ======================================================== */}
                <div className="flex flex-wrap items-center gap-3 mb-8">
                    <Link
                        href="/auth/quick-contract/create"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Quick Create
                    </Link>
                    <Link
                        href="/auth/contracts-dashboard"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Contract Create
                    </Link>
                    <Link
                        href="/auth/training"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Practice (Training)
                    </Link>
                </div>

                {/* ======================================================== */}
                {/* SECTION 8F: PATHWAY FILTER TABS (with counts)             */}
                {/* ======================================================== */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto">
                    <span className="text-sm font-medium text-slate-500 mr-2 flex-shrink-0">Filter:</span>
                    {FILTER_TABS.map(filter => {
                        const count = pathwayCounts[filter.key] ?? 0
                        // Hide tabs with zero contracts (except 'All')
                        if (filter.key !== 'all' && count === 0) return null

                        return (
                            <button
                                key={filter.key}
                                onClick={() => setActiveFilter(filter.key as typeof activeFilter)}
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors flex-shrink-0 flex items-center gap-1.5 ${activeFilter === filter.key
                                    ? 'bg-slate-800 text-white font-medium'
                                    : 'text-slate-600 hover:bg-slate-200 bg-slate-100'
                                    }`}
                            >
                                {filter.label}
                                <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${activeFilter === filter.key
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-500'
                                    }`}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* ======================================================== */}
                {/* SECTION 8G: CONTRACT CARDS LIST                           */}
                {/* ======================================================== */}
                <div className="mb-12">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">
                        Your Contracts
                        {filteredContracts.length > 0 && (
                            <span className="text-sm font-normal text-slate-400 ml-2">
                                ({filteredContracts.length})
                            </span>
                        )}
                    </h2>

                    {filteredContracts.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-medium text-slate-700 mb-1">
                                {activeFilter === 'all'
                                    ? 'No contracts yet'
                                    : `No ${PATHWAY_BADGES[activeFilter]?.label || ''} contracts`
                                }
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Start a new negotiation to get going.
                            </p>
                            <Link
                                href="/auth/quick-contract/create"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create Your First Contract
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredContracts.map(contract => (
                                <div
                                    key={`${contract.pathway}-${contract.id}`}
                                    className={`bg-white rounded-xl border shadow-sm p-5 transition-all hover:shadow-md group ${contract.isInviteHighlight
                                        ? 'border-emerald-400 ring-2 ring-emerald-100'
                                        : contract.statusLabel === 'Completed'
                                            ? 'border-slate-200 bg-slate-50/50'
                                            : 'border-slate-200'
                                        }`}
                                >
                                    {/* ---- Invite highlight banner ---- */}
                                    {contract.isInviteHighlight && (
                                        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 text-xs font-medium mb-3 -mt-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                            You&apos;ve been invited to this negotiation
                                        </div>
                                    )}

                                    <div className="flex items-start justify-between gap-4">
                                        {/* ---- Left: Contract info ---- */}
                                        <div className="flex-1 min-w-0">
                                            {/* Row 1: Name + badges */}
                                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                <h3 className="text-base font-semibold text-slate-800 truncate">
                                                    {contract.name}
                                                </h3>
                                                {/* Pathway badge */}
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PATHWAY_BADGES[contract.pathway]?.bg || 'bg-slate-100'
                                                    } ${PATHWAY_BADGES[contract.pathway]?.text || 'text-slate-700'}`}>
                                                    {PATHWAY_BADGES[contract.pathway]?.label || contract.pathway}
                                                </span>
                                                {/* Role badge */}
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                                    {contract.userRoleLabel}
                                                </span>
                                                {/* Completed badge */}
                                                {contract.statusLabel === 'Completed' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Completed
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 2: Progress summary */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${contract.statusLabel === 'Active' ? STATUS_COLOURS.active
                                                    : contract.statusLabel === 'Awaiting Response' || contract.statusLabel === 'Invited' ? STATUS_COLOURS.awaiting
                                                        : contract.statusLabel === 'Completed' ? STATUS_COLOURS.completed
                                                            : STATUS_COLOURS.draft
                                                    }`} />
                                                <span className="text-sm text-slate-600">
                                                    {contract.progressSummary}
                                                </span>
                                            </div>

                                            {/* Row 3: Counterparty + last activity */}
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                {(contract.counterpartyName || contract.counterpartyCompany) && (
                                                    <span>
                                                        {contract.relationship === 'initiator' ? 'With' : 'From'}:{' '}
                                                        <span className="text-slate-500">
                                                            {contract.counterpartyName}
                                                            {contract.counterpartyCompany && ` (${contract.counterpartyCompany})`}
                                                        </span>
                                                    </span>
                                                )}
                                                <span>{formatRelativeTime(contract.lastActivity)}</span>
                                            </div>

                                            {/* Row 4: Clause progress bar (shows 0/N when clauses exist) */}
                                            {contract.clauseStats && contract.clauseStats.total > 0 && (
                                                <div className="mt-3 flex items-center gap-3">
                                                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-xs">
                                                        <div
                                                            className={`h-1.5 rounded-full transition-all ${contract.clauseStats.agreed === contract.clauseStats.total
                                                                ? 'bg-emerald-500'
                                                                : contract.clauseStats.agreed > 0
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-slate-200'
                                                                }`}
                                                            style={{
                                                                width: contract.clauseStats.agreed > 0
                                                                    ? `${Math.max(Math.round((contract.clauseStats.agreed / contract.clauseStats.total) * 100), 4)}%`
                                                                    : '0%'
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-400 flex-shrink-0">
                                                        {contract.clauseStats.agreed}/{contract.clauseStats.total} agreed
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* ---- Right: Action buttons ---- */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {/* Delete button — only for initiators */}
                                            {contract.relationship === 'initiator' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteRequest(contract)
                                                    }}
                                                    className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete contract"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                            {/* Enter / View button */}
                                            <button
                                                onClick={() => handleEnterContract(contract)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${contract.statusLabel === 'Completed'
                                                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                                                    }`}
                                            >
                                                {contract.statusLabel === 'Completed' ? 'View' : 'Enter'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 8H: DELETE CONFIRMATION MODAL                         */}
            {/* ============================================================ */}
            {deleteModal.isOpen && deleteModal.contract && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
                        {/* Modal header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Delete Contract</h3>
                                <p className="text-sm text-slate-500">This action cannot be undone</p>
                            </div>
                        </div>

                        {/* Contract details */}
                        <div className="bg-slate-50 rounded-lg p-3 mb-4">
                            <p className="text-sm font-medium text-slate-800 mb-1">
                                {deleteModal.contract.name}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PATHWAY_BADGES[deleteModal.contract.pathway]?.bg || 'bg-slate-100'
                                    } ${PATHWAY_BADGES[deleteModal.contract.pathway]?.text || 'text-slate-700'}`}>
                                    {PATHWAY_BADGES[deleteModal.contract.pathway]?.label}
                                </span>
                                <span className="text-xs text-slate-500">
                                    Created {formatDate(deleteModal.contract.createdAt)}
                                </span>
                            </div>
                        </div>

                        {/* Warning text */}
                        <p className="text-sm text-slate-600 mb-4">
                            This will permanently remove this contract and all associated data including
                            clauses, messages, events, and any generated documents. Any invited parties
                            will no longer have access.
                        </p>

                        {/* Error message */}
                        {deleteModal.error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-red-700">{deleteModal.error}</p>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteCancel}
                                disabled={deleteModal.isDeleting}
                                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteModal.isDeleting}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleteModal.isDeleting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Permanently'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


// ============================================================================
// SECTION 9: PAGE EXPORT (Suspense wrapper for useSearchParams)
// ============================================================================

export default function HomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
                <header className="h-14 bg-slate-800" />
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                </div>
            </div>
        }>
            <HomePageInner />
        </Suspense>
    )
}