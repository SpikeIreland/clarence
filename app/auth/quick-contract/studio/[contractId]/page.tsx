'use client'

// ============================================================================
// QUICK CONTRACT STUDIO - Clause Review & Agreement
// Version: 3.7 - Loading Spinner Fix
// Date: 24 February 2026
// Path: /app/auth/quick-contract/studio/[contractId]/page.tsx
// 
// CHANGES in v3.7:
// - FIX: Loading spinner hung forever due to premature return in loadData
//   Root cause: setResolvedContractId() is async (React state), but the
//   next line checked the OLD value (still null) and returned early,
//   never reaching setLoading(false)
// - Added setLoading(false) to clause arrival polling as safety net
//
// CHANGES in v3.5:
// - FIX: Added clause arrival polling when page loads before workflow completes
// - NEW: "Processing Document" UI state when clauses haven't arrived yet
// - NEW: "No Clauses Found" UI state when processing finished without clauses
// - Polling every 3 seconds for clauses to appear, auto-loads when ready
//
// CHANGES in v3.4:
// - FIX: After committing, button now shows "Agree" instead of greyed-out
// - "Agree" button navigates user to Document Centre (no longer trapped)
// - Button states: "Commit Contract" â†’ "Agree" (after commit) â†’ "Both Agreed - Commit"
//
// CHANGES in v3.3:
// - NEW: Separated QC event tracking from Mediation Studio (qc_clause_events table)
// - NEW: Activity notification layer with unread tracking per party
// - NEW: Auto-generated activity summaries for all clause events
// - NEW: Realtime subscription for live notification push between parties
// - NEW: History tab rebuilt as contract-wide Activity Feed with unread badges
// - NEW: Click-to-navigate from activity items to specific clauses
// - NEW: Mark-as-read when History tab is viewed
// - NEW: Unread badge on History tab button
// - Added 'draft_created', 'draft_modified', 'clause_deleted' event types
//
// CHANGES in v3.2:
// - Added Delete Clause feature with 3-dot kebab menu on each clause
// - Delete confirmation modal with parent/child warning
// - Query resolution: Pending flag clears when both parties agree to queried clause
// - Merged from deployed code to preserve Delete feature after v3.0/v3.1 changes
//
// CHANGES in v3.1:
// - CRITICAL FIX: Position scale now matches Contract Studio (legally verified)
//   * Position 1 = Provider-Favouring (maximum provider flexibility)
//   * Position 10 = Customer-Favouring (maximum customer protection)
// - Fixed DEFAULT_POSITION_OPTIONS labels
// - Fixed position bar scale labels (Provider left, Customer right)
// - Fixed position badge colors (high=emerald/customer, low=blue/provider)
// - Fixed balanced draft generation prompts and logic
//
// CHANGES in v3.0:
// - Implemented dual-party agreement tracking (initiator + respondent must both agree)
// - New agreement states: none, you_only, other_only, both
// - Updated all UI indicators to show partial vs full agreement
// - Commit button now shows waiting state when one party has committed
// - Progress bar shows amber for partial, green for full agreement
// - Modal states include 'waiting_other_party' for async commit flow
// ============================================================================

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import FeedbackButton from '@/app/components/FeedbackButton'
import QCPartyChatPanel from '@/app/auth/quick-contract/components/qc-party-chat-panel'

// ROLE MATRIX Phase 2: Dynamic position labels
import { useRoleContext, getScaleLabels } from '@/lib/useRoleContext'
import { getPositionDescription } from '@/lib/role-matrix'

// Playbook compliance engine + indicator component
import { calculatePlaybookCompliance, normaliseCategory, getEffectiveRangeContext, translateRulePosition, type PlaybookRule, type ComplianceResult, type ContractClause as ComplianceClause } from '@/lib/playbook-compliance'
// Schedule detection types
import { getExpectedSchedules, getRequiredSchedules, getScheduleTypeLabel, buildScheduleExpectations } from '@/lib/schedule-types'
import PlaybookComplianceIndicator from '@/app/components/PlaybookComplianceIndicator'
import ComplianceWarningModal from '@/app/components/ComplianceWarningModal'
import ComplianceGuidanceBanner from '@/app/components/ComplianceGuidanceBanner'
import type { ComplianceCheckResult, GuidanceTip } from '@/lib/agents/compliance-checker'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface Contract {
    contractId: string
    contractName: string
    contractType: string
    contractTypeKey: string | null
    initiatorPartyRole: string | null
    description: string | null
    status: string
    clauseCount: number
    companyId: string | null
    uploadedByUserId: string | null
    createdAt: string
    extractedText: string | null
}


interface ContractClause {
    clauseId: string
    positionId: string
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
    originalText: string | null
    clauseLevel: number
    displayOrder: number
    parentClauseId: string | null
    // CLARENCE Certification fields (AI assessment - never overwrite)
    clarenceCertified: boolean
    clarencePosition: number | null
    clarenceFairness: string | null
    clarenceSummary: string | null
    clarenceAssessment: string | null
    clarenceFlags: string[]
    clarenceCertifiedAt: string | null
    // Party position fields (user adjustments during negotiation)
    initiatorPosition: number | null
    respondentPosition: number | null
    // Value extraction fields (from document)
    extractedValue: string | null
    extractedUnit: string | null
    valueType: string | null
    documentPosition: number | null
    // Draft editing fields
    draftText: string | null
    draftModified: boolean
    // Position options (from clause library)
    positionOptions: PositionOption[]
    isHeader: boolean
    processingStatus: 'pending' | 'processing' | 'certified' | 'failed'
}

interface PositionOption {
    value: number
    label: string
    description: string
}

interface RangeMappingData {
    scale_points: {
        position: number
        value: number
        label: string
        description: string
    }[]
    interpolation: 'linear' | 'logarithmic' | 'stepped'
    format_pattern: string
    display_precision: number
}

interface RangeMapping {
    clauseId: string
    contractId: string
    isDisplayable: boolean
    valueType: string | null
    rangeUnit: string | null
    industryStandardMin: number | null
    industryStandardMax: number | null
    rangeData: RangeMappingData
}

interface UserInfo {
    userId: string
    email: string
    fullName: string
    companyId: string | null
    companyName: string | null
}

interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface ClauseEvent {
    eventId: string
    contractId: string
    clauseId: string | null
    eventType: 'agreed' | 'queried' | 'query_resolved' | 'position_changed' | 'redrafted' | 'committed' | 'agreement_withdrawn' | 'draft_created' | 'draft_modified' | 'clause_deleted'
    userId: string
    partyRole: 'initiator' | 'respondent'
    userName: string
    message: string | null
    eventData: Record<string, unknown>
    // Notification layer fields
    activitySummary: string | null
    readByInitiator: boolean
    readByRespondent: boolean
    createdAt: string
}

type CommitModalState = 'closed' | 'confirm' | 'processing' | 'success' | 'waiting_other_party'

// Party Chat message interface
interface PartyMessage {
    messageId: string
    contractId: string
    senderUserId: string
    senderName: string
    senderRole: 'initiator' | 'respondent'
    messageText: string
    relatedClauseId: string | null
    relatedClauseNumber: string | null
    relatedClauseName: string | null
    isSystemMessage: boolean
    isRead: boolean
    createdAt: string
}

// ============================================================================
// SECTION 2: CONSTANTS & CONFIGURATION
// ============================================================================

const supabase = createClient()

const CATEGORY_COLORS: Record<string, string> = {
    'Service Delivery': 'bg-blue-100 text-blue-700 border-blue-200',
    'Service Levels': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Charges and Payment': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Liability': 'bg-red-100 text-red-700 border-red-200',
    'Intellectual Property': 'bg-purple-100 text-purple-700 border-purple-200',
    'Term and Termination': 'bg-orange-100 text-orange-700 border-orange-200',
    'Data Protection': 'bg-pink-100 text-pink-700 border-pink-200',
    'Governance': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Employment': 'bg-amber-100 text-amber-700 border-amber-200',
    'Confidentiality': 'bg-violet-100 text-violet-700 border-violet-200',
    'Insurance': 'bg-teal-100 text-teal-700 border-teal-200',
    'Audit': 'bg-sky-100 text-sky-700 border-sky-200',
    'Dispute Resolution': 'bg-rose-100 text-rose-700 border-rose-200',
    'General': 'bg-slate-100 text-slate-700 border-slate-200',
    'Definitions': 'bg-gray-100 text-gray-600 border-gray-200',
    'Other': 'bg-slate-100 text-slate-600 border-slate-200'
}

function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
}

// Default position options when none specified
// SCALE: 1 = Maximum Flexibility (providing party), 10 = Maximum Protection (protected party)
// Labels stay neutral; inline orientation labels show which end favours whom
const DEFAULT_POSITION_OPTIONS: PositionOption[] = [
    { value: 1, label: 'Maximum Flexibility', description: 'Most flexible terms possible' },
    { value: 2, label: 'Strong Flexibility', description: 'Significantly flexible terms' },
    { value: 3, label: 'Flexible Terms', description: 'Flexibility-leaning but reasonable' },
    { value: 4, label: 'Slightly Flexible', description: 'Marginally flexibility-favoring' },
    { value: 5, label: 'Balanced', description: 'Neutral, industry standard' },
    { value: 6, label: 'Slight Protection', description: 'Marginally protective' },
    { value: 7, label: 'Moderate Protection', description: 'Protection-leaning but reasonable' },
    { value: 8, label: 'Strong Protection', description: 'Significantly protective terms' },
    { value: 9, label: 'High Protection', description: 'Highly protective terms' },
    { value: 10, label: 'Maximum Protection', description: 'Most protective terms possible' }
]

// Adapter: convert studio camelCase clauses to compliance engine snake_case format
function toComplianceClauses(studioClauses: ContractClause[]): ComplianceClause[] {
    return studioClauses.map(c => ({
        clause_id: c.clauseId,
        clause_name: c.clauseName,
        category: c.category,
        clarence_position: c.clarencePosition,
        initiator_position: c.initiatorPosition,
        respondent_position: c.respondentPosition,
        customer_position: null,
        is_header: c.isHeader,
    }))
}

// ============================================================================
// SECTION 3: LOADING COMPONENT
// ============================================================================

function QuickContractStudioLoading() {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-purple-600">C</span>
                    </div>
                </div>
                <h2 className="text-xl font-semibold text-slate-700">Loading Quick Create Studio...</h2>
                <p className="text-slate-500 mt-2">Preparing your contract review</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

function QuickContractStudioContent() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const contractId = params?.contractId as string

    // ROLE MATRIX Phase 2: Dynamic position scale labels
    // Note: userId is populated after auth check, hook handles null gracefully
    const [roleUserId, setRoleUserId] = useState<string | null>(null)
    const { roleContext } = useRoleContext({ contractId, userId: roleUserId })

    // ========================================================================
    // SECTION 4A: STATE
    // ========================================================================

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [rangeMappings, setRangeMappings] = useState<Map<string, RangeMapping>>(new Map())

    // Template mode
    const isTemplateMode = searchParams.get('mode') === 'template'
    const isCompanyTemplate = searchParams.get('company') === 'true'
    const editTemplateId = searchParams.get('edit_template_id')
    const linkedPlaybookIdParam = searchParams.get('linked_playbook_id')
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
    const [templateName, setTemplateName] = useState('')
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templateSaved, setTemplateSaved] = useState(false)
    const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null)
    const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Playbook compliance (initiator only, non-template mode)
    const [playbookRules, setPlaybookRules] = useState<PlaybookRule[]>([])
    const [playbookName, setPlaybookName] = useState('')
    const [playbookCompanyName, setPlaybookCompanyName] = useState('')
    const [playbookLoading, setPlaybookLoading] = useState(false)
    const [showComplianceModal, setShowComplianceModal] = useState(false)

    // Pre-fill template name (and linked playbook id) when editing an existing template
    const [linkedPlaybookId, setLinkedPlaybookId] = useState<string | null>(linkedPlaybookIdParam)
    useEffect(() => {
        if (!editTemplateId) return
        const supabase = createClient()
        supabase
            .from('contract_templates')
            .select('template_name, linked_playbook_id')
            .eq('template_id', editTemplateId)
            .single()
            .then(({ data }) => {
                if (data?.template_name) setTemplateName(data.template_name)
                if (data?.linked_playbook_id) setLinkedPlaybookId(data.linked_playbook_id)
            })
    }, [editTemplateId])

    // Pre-fill template name from contract name for new template uploads (avoids entering name twice)
    useEffect(() => {
        if (editTemplateId) return // Already handled above
        if (!isTemplateMode || !contract?.contractName || templateName) return
        setTemplateName(contract.contractName)
    }, [isTemplateMode, contract?.contractName, editTemplateId, templateName])

    // Fetch playbook rules for compliance checking (initiator only, once)
    useEffect(() => {
        if (!userInfo?.companyId || !contract) return
        if (contract.uploadedByUserId !== userInfo.userId) return

        async function loadPlaybookRules() {
            setPlaybookLoading(true)
            try {
                const supabase = createClient()

                // Priority: explicit linked_playbook_id > type-based lookup
                let playbookData = null
                if (linkedPlaybookId) {
                    const { findPlaybookById } = await import('@/lib/playbook-loader')
                    playbookData = await findPlaybookById(linkedPlaybookId)
                } else {
                    const { findActivePlaybook } = await import('@/lib/playbook-loader')
                    playbookData = await findActivePlaybook(userInfo!.companyId!, contract?.contractTypeKey || null)
                }

                if (!playbookData) return

                const { data: rulesData, error: rulesError } = await supabase
                    .from('playbook_rules')
                    .select('*')
                    .eq('playbook_id', playbookData.playbook_id)
                    .eq('is_active', true)

                if (rulesError || !rulesData || rulesData.length === 0) return

                const { data: companyData } = await supabase
                    .from('companies')
                    .select('company_name')
                    .eq('company_id', userInfo!.companyId!)
                    .single()

                setPlaybookRules(rulesData as PlaybookRule[])
                setPlaybookName(playbookData.playbook_name || 'Company Playbook')
                setPlaybookCompanyName(companyData?.company_name || 'Your Company')
            } catch (err) {
                console.error('Error loading playbook rules:', err)
            } finally {
                setPlaybookLoading(false)
            }
        }

        loadPlaybookRules()
    }, [userInfo?.companyId, userInfo?.userId, contract?.uploadedByUserId, contract?.contractTypeKey, linkedPlaybookId])

    // Clause events & agreement tracking
    const [clauseEvents, setClauseEvents] = useState<ClauseEvent[]>([])
    // Dual-party agreement tracking - both must agree for clause to be fully agreed
    const [initiatorAgreedIds, setInitiatorAgreedIds] = useState<Set<string>>(new Set())
    const [respondentAgreedIds, setRespondentAgreedIds] = useState<Set<string>>(new Set())
    const [queriedClauseIds, setQueriedClauseIds] = useState<Set<string>>(new Set())

    // Activity notification state
    const [unreadActivityCount, setUnreadActivityCount] = useState(0)
    const [activityViewMode, setActivityViewMode] = useState<'all' | 'clause'>('all')

    // Commit modal
    const [commitModalState, setCommitModalState] = useState<CommitModalState>('closed')

    // DoA Approval state
    const [doaContractApprovalStatus, setDoaContractApprovalStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none')
    const [doaApproverName, setDoaApproverName] = useState<string | null>(null)
    const [showContractApprovalModal, setShowContractApprovalModal] = useState(false)
    const [clauseApprovalStatuses, setClauseApprovalStatuses] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({})
    const [clauseApprovalTarget, setClauseApprovalTarget] = useState<{ clauseId: string; clauseName: string } | null>(null)
    const [isRequestingApproval, setIsRequestingApproval] = useState(false)
    const [approvalMessage, setApprovalMessage] = useState('')

    // Query input per clause
    const [queryText, setQueryText] = useState('')

    // UI state
    const [selectedClauseIndex, setSelectedClauseIndex] = useState<number | null>(null)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'tradeoffs' | 'draft' | 'playbook'>('overview')
    const [showClauseText, setShowClauseText] = useState(false)

    // Draft editing state
    const [isDraftEditing, setIsDraftEditing] = useState(false)
    const [editingDraftText, setEditingDraftText] = useState('')
    const [savingDraft, setSavingDraft] = useState(false)
    const [generatingBalancedDraft, setGeneratingBalancedDraft] = useState(false)
    const [bespokeDraftTarget, setBespokeDraftTarget] = useState<number>(5.0)

    // Chat state (CLARENCE AI chat - right panel)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)
    const clauseMenuRef = useRef<HTMLDivElement>(null)
    const clauseListRef = useRef<HTMLDivElement>(null)

    // Party Chat state (simplified - component handles its own state)
    const [partyChatOpen, setPartyChatOpen] = useState(false)
    const [partyChatUnread, setPartyChatUnread] = useState(0)
    const [respondentInfo, setRespondentInfo] = useState<{
        name: string
        company: string | null
        isOnline: boolean
    } | null>(null)

    const [initiatorInfo, setInitiatorInfo] = useState<{
        name: string
        company: string | null
    } | null>(null)

    // Online presence tracking
    const [otherPartyOnline, setOtherPartyOnline] = useState(false)


    // Progressive loading / certification polling state (must be before any early returns)
    const [isPolling, setIsPolling] = useState(false)
    const [certificationProgress, setCertificationProgress] = useState({ certified: 0, total: 0, failed: 0 })
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

    // Delete clause state
    const [deleteClauseTarget, setDeleteClauseTarget] = useState<ContractClause | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deletingClause, setDeletingClause] = useState(false)

    // Clause options menu state (for 3-dot menu)
    const [clauseMenuOpen, setClauseMenuOpen] = useState<string | null>(null)

    // Retry failed certification state
    const [retryingClauses, setRetryingClauses] = useState<Set<string>>(new Set())
    const [retryInProgress, setRetryInProgress] = useState(false)
    const [recertifyInProgress, setRecertifyInProgress] = useState(false)

    // Playbook compliance check state
    const [qcComplianceResult, setQcComplianceResult] = useState<ComplianceCheckResult | null>(null)
    const [showQcComplianceWarning, setShowQcComplianceWarning] = useState(false)
    const [qcComplianceGuidanceTips, setQcComplianceGuidanceTips] = useState<GuidanceTip[]>([])
    const [qcPendingRevertClauseId, setQcPendingRevertClauseId] = useState<string | null>(null)
    const [qcPendingRevertPosition, setQcPendingRevertPosition] = useState<number | null>(null)
    const complianceCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // NEW: Auto-save state for position persistence
    const [dirtyPositions, setDirtyPositions] = useState<Map<string, number>>(new Map())
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

    // Draft-Position Sync: Prompt to regenerate draft after position change
    const [showDraftOfferPrompt, setShowDraftOfferPrompt] = useState(false)
    const [pendingDraftPosition, setPendingDraftPosition] = useState<number | null>(null)
    // Store the position before the drag so we can revert if the user cancels
    const [preChangePosition, setPreChangePosition] = useState<number | null>(null)
    const [isInitiator, setIsInitiator] = useState(true)
    const [generatingPositionDraft, setGeneratingPositionDraft] = useState(false)
    // Track the target position for a generated draft (so we can update clarence_position on save)
    const [draftTargetPosition, setDraftTargetPosition] = useState<number | null>(null)
    const draftTargetPositionRef = useRef<number | null>(null)

    const [resolvedContractId, setResolvedContractId] = useState<string | null>(null)

    // ---- SCHEDULE DETECTION STATE ----
    const [detectedSchedules, setDetectedSchedules] = useState<{ schedule_id: string; schedule_type: string; schedule_label: string; confidence_score: number; summary: string | null; status: string; checklist_status?: string | null; checklist_score?: number | null }[]>([])
    const [scheduleDetectionStatus, setScheduleDetectionStatus] = useState<string | null>(null)
    const [schedulePanelOpen, setSchedulePanelOpen] = useState(false)
    const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)

    // ---- SCHEDULE CHECKLIST STATE ----
    const [checklistResults, setChecklistResults] = useState<{ result_id: string; check_question: string; check_category: string; check_result: string; ai_evidence: string | null; ai_confidence: number | null; manual_override: string | null; notes: string | null }[]>([])
    const [checklistLoading, setChecklistLoading] = useState(false)
    const [checklistScore, setChecklistScore] = useState<number | null>(null)

    // ---- SCHEDULE CHECKLIST FUNCTIONS ----
    const fetchChecklist = async (contractId: string, scheduleId: string) => {
        setChecklistLoading(true)
        try {
            const res = await fetch(`/api/contracts/${contractId}/schedules/${scheduleId}/checklist`)
            if (!res.ok) return
            const data = await res.json()
            setChecklistResults(data.results || [])
            setChecklistScore(data.checklistScore)
        } catch {
            /* non-critical */
        } finally {
            setChecklistLoading(false)
        }
    }

    const triggerChecklist = async (contractId: string, scheduleId: string) => {
        setChecklistLoading(true)
        try {
            const res = await fetch(`/api/contracts/${contractId}/schedules/${scheduleId}/checklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            if (!res.ok) return
            // Refetch results after trigger
            await fetchChecklist(contractId, scheduleId)
            // Update the schedule's checklist_status in local state
            setDetectedSchedules(prev => prev.map(s =>
                s.schedule_id === scheduleId ? { ...s, checklist_status: 'complete' } : s
            ))
        } catch {
            setChecklistLoading(false)
        }
    }

    const handleScheduleClick = (scheduleId: string) => {
        if (selectedScheduleId === scheduleId) {
            setSelectedScheduleId(null)
            setChecklistResults([])
            setChecklistScore(null)
            return
        }
        setSelectedScheduleId(scheduleId)
        const schedule = detectedSchedules.find(s => s.schedule_id === scheduleId)
        if (schedule && resolvedContractId) {
            if (schedule.checklist_status === 'complete') {
                fetchChecklist(resolvedContractId, scheduleId)
            } else {
                setChecklistResults([])
                setChecklistScore(null)
            }
        }
    }

    // ---- BULK SELECT STATE ----
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
    const [bulkAgreeInProgress, setBulkAgreeInProgress] = useState(false)

    // ---- INVITE MODAL STATE ----
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteName, setInviteName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteCompany, setInviteCompany] = useState('')
    const [inviteMessage, setInviteMessage] = useState('')
    const [sendingInvite, setSendingInvite] = useState(false)
    const [inviteSuccess, setInviteSuccess] = useState(false)
    const [inviteSent, setInviteSent] = useState(false)
    const [respondentStatus, setRespondentStatus] = useState<'none' | 'pending' | 'invited' | 'viewed' | 'accepted' | 'declined' | 'in_studio'>('none')

    // Derived state
    const selectedClause = selectedClauseIndex !== null ? clauses[selectedClauseIndex] : null

    // Guard to prevent infinite redirect loop — loadData's useEffect depends
    // on router, which can change reference on push, re-triggering the effect
    const hasRedirected = useRef(false)

    // ========================================================================
    // SECTION 4B: AUTHENTICATION & DATA LOADING
    // ========================================================================

    useEffect(() => {
        async function loadData() {
            if (!contractId) {
                setError('No contract ID provided')
                setLoading(false)
                return
            }

            try {
                // ---------------------------------------------------------
                // UNIFIED AUTH: Check Supabase session first (works for
                // both customers and providers), then supplement with
                // localStorage for additional user info.
                // ---------------------------------------------------------
                const { data: { user: supabaseUser } } = await supabase.auth.getUser()

                if (!supabaseUser) {
                    // Guard: only redirect once
                    if (hasRedirected.current) return
                    hasRedirected.current = true

                    // Store redirect context as JSON (NOT a plain URL string).
                    // The Provider page JSON.parses this and checks for contractId + source.
                    // Matches the format used by /qc/[token] (the public recipient page).
                    const qcRedirect = {
                        contractId: contractId,
                        source: 'qc_token_page'
                    }
                    sessionStorage.setItem('clarence_qc_redirect', JSON.stringify(qcRedirect))
                    console.log('[QC Studio] Stored redirect in sessionStorage:', qcRedirect)
                    window.location.href = '/provider'
                    return
                }

                // Try to get enriched user info from the users table
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('user_id, first_name, last_name, email, company_id, companies(company_name)')
                    .eq('user_id', supabaseUser.id)
                    .single()

                let userId = supabaseUser.id
                let email = supabaseUser.email || ''
                let fullName = email
                let companyId: string | null = null
                let companyName: string | null = null

                if (dbUser) {
                    // Registered user with full profile
                    userId = dbUser.user_id
                    fullName = `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() || email
                    companyId = dbUser.company_id || null
                    companyName = (dbUser.companies as any)?.company_name || null
                } else {
                    // User exists in Supabase auth but not in users table
                    // (could be a provider who registered via /provider/ flow)
                    // Fall back to localStorage for supplementary info
                    const storedAuth = localStorage.getItem('clarence_auth')
                        || localStorage.getItem('clarence_provider_session')

                    if (storedAuth) {
                        try {
                            const parsed = JSON.parse(storedAuth)
                            const info = parsed.userInfo || parsed
                            fullName = info.firstName
                                ? `${info.firstName} ${info.lastName || ''}`.trim()
                                : (info.contactName || info.companyName || email)
                            companyId = info.companyId || null
                            companyName = info.company || info.companyName || null
                        } catch { /* ignore parse errors */ }
                    }
                }

                setUserInfo({
                    userId,
                    email,
                    fullName,
                    companyId,
                    companyName
                })
                setRoleUserId(userId)

                // Load contract
                // Try as uploaded_contracts.contract_id first
                let { data: contractData, error: contractError } = await supabase
                    .from('uploaded_contracts')
                    .select('*')
                    .eq('contract_id', contractId)
                    .single()

                // If not found, contractId might be a quick_contract_id - look up the source
                if (contractError || !contractData) {
                    const { data: qcLookup } = await supabase
                        .from('quick_contracts')
                        .select('source_contract_id')
                        .eq('quick_contract_id', contractId)
                        .single()

                    if (qcLookup?.source_contract_id) {
                        const result = await supabase
                            .from('uploaded_contracts')
                            .select('*')
                            .eq('contract_id', qcLookup.source_contract_id)
                            .single()
                        contractData = result.data
                        contractError = result.error
                    }
                }

                if (contractError || !contractData) {
                    console.error('Contract error:', contractError)
                    setError('Contract not found')
                    setLoading(false)
                    return
                }

                if (contractError || !contractData) {
                    console.error('Contract error:', contractError)
                    setError('Contract not found')
                    setLoading(false)
                    return
                }

                setContract({
                    contractId: contractData.contract_id,
                    contractName: contractData.contract_name,
                    contractType: contractData.detected_contract_type || 'Contract',
                    contractTypeKey: contractData.contract_type_key || null,
                    initiatorPartyRole: contractData.initiator_party_role || null,
                    description: contractData.description,
                    status: contractData.status,
                    clauseCount: contractData.clause_count || 0,
                    companyId: contractData.company_id,
                    uploadedByUserId: contractData.uploaded_by_user_id,
                    createdAt: contractData.created_at,
                    extractedText: contractData.extracted_text
                })

                setResolvedContractId(contractData.contract_id)
                console.log(`[QC Studio] Contract ID resolved: URL param=${contractId}, actual=${contractData.contract_id}, match=${contractId === contractData.contract_id}`)

                // NOTE: Use contractData.contract_id directly below (not resolvedContractId,
                // which is still null until the next React render cycle)

                // Set permission flag based on party role
                const userIsInitiator = contractData.uploaded_by_user_id === userId
                setIsInitiator(userIsInitiator)
                console.log(`Party role: ${userIsInitiator ? 'initiator' : 'respondent'}`)

                // In the data loading section, after fetching the contract:
                if (contractData.status === 'processing') {
                    // Still scanning structure - show a brief loading message
                    // (This should only take 10-15 seconds)
                } else if (contractData.status === 'certifying' || contractData.status === 'ready') {
                    // Clauses are available - load them and show progressive UI
                    // Polling will handle the rest
                }

                // Load clauses
                const { data: clausesData, error: clausesError } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('*')
                    .eq('contract_id', contractData.contract_id)
                    .order('display_order', { ascending: true })

                if (clausesError) {
                    console.error('Clauses error:', clausesError)
                    setError('Failed to load contract clauses')
                    setLoading(false)
                    return
                }

                const mappedClauses: ContractClause[] = (clausesData || []).map(c => ({
                    clauseId: c.clause_id,
                    positionId: c.clause_id, // Use clause_id as position_id for Quick Contract
                    clauseNumber: c.clause_number,
                    clauseName: c.clause_name,
                    category: c.category || 'Other',
                    clauseText: c.content || '',
                    originalText: c.original_text || c.content || null,  // Prefer original_text, fall back to content
                    clauseLevel: c.clause_level || 1,
                    displayOrder: c.display_order,
                    parentClauseId: c.parent_clause_id,
                    clarenceCertified: c.clarence_certified || false,
                    clarencePosition: c.clarence_position,
                    clarenceFairness: c.clarence_fairness,
                    clarenceSummary: c.clarence_summary,
                    clarenceAssessment: c.clarence_assessment,
                    clarenceFlags: c.clarence_flags || [],
                    clarenceCertifiedAt: c.clarence_certified_at,
                    // PERSISTENCE: Load party positions from database
                    // These are null until a party adjusts the slider
                    // clarence_position stays as the untouched AI baseline
                    initiatorPosition: c.initiator_position ?? null,
                    respondentPosition: c.respondent_position ?? null,
                    // Value extraction fields
                    extractedValue: c.extracted_value,
                    extractedUnit: c.extracted_unit,
                    valueType: c.value_type,
                    documentPosition: c.document_position,
                    // Draft fields
                    draftText: c.draft_text || null,
                    draftModified: !!c.draft_text,
                    isHeader: c.is_header || false,
                    processingStatus: c.status || 'pending',
                    positionOptions: DEFAULT_POSITION_OPTIONS
                }))

                setClauses(mappedClauses)

                // DEBUG: Log certification status on initial load
                console.log('=== QC STUDIO INITIAL LOAD DEBUG ===')
                console.log('Contract ID:', contractId)
                console.log('Total clauses loaded:', mappedClauses.length)
                console.log('Non-header clauses:', mappedClauses.filter(c => !c.isHeader).length)
                console.log('Uncertified non-headers:', mappedClauses.filter(c => !c.isHeader && !c.clarenceCertified).length)
                if (mappedClauses.length > 0) {
                    console.log('First 3 clauses:', mappedClauses.slice(0, 3).map(c => ({
                        num: c.clauseNumber,
                        name: c.clauseName,
                        isHeader: c.isHeader,
                        clarenceCertified: c.clarenceCertified,
                        processingStatus: c.processingStatus
                    })))
                }

                // Load range mappings for this contract
                // CRITICAL: Use contractData.contract_id (not URL param contractId)
                // because the URL may contain a quick_contract_id which differs from
                // the uploaded_contracts.contract_id used in clause_range_mappings
                const actualContractId = contractData.contract_id
                const { data: rangeMappingData } = await supabase
                    .from('clause_range_mappings')
                    .select('clause_id, contract_id, is_displayable, value_type, range_unit, industry_standard_min, industry_standard_max, range_data')
                    .eq('contract_id', actualContractId)
                    .eq('is_displayable', true)

                if (rangeMappingData && rangeMappingData.length > 0) {
                    const mappingMap = new Map<string, RangeMapping>()
                    for (const rm of rangeMappingData) {
                        mappingMap.set(rm.clause_id, {
                            clauseId: rm.clause_id,
                            contractId: rm.contract_id,
                            isDisplayable: rm.is_displayable,
                            valueType: rm.value_type,
                            rangeUnit: rm.range_unit,
                            industryStandardMin: rm.industry_standard_min,
                            industryStandardMax: rm.industry_standard_max,
                            rangeData: rm.range_data as RangeMappingData
                        })
                    }
                    setRangeMappings(mappingMap)
                }

                // PERSISTENCE: Restore selected clause from LocalStorage, or default to first
                const savedClauseIndex = localStorage.getItem(`qc_studio_${actualContractId}_selectedClause`)
                if (savedClauseIndex !== null && parseInt(savedClauseIndex) < mappedClauses.length) {
                    setSelectedClauseIndex(parseInt(savedClauseIndex))
                } else if (mappedClauses.length > 0) {
                    setSelectedClauseIndex(0)
                }

                // PERSISTENCE: Restore active tab from LocalStorage
                const savedTab = localStorage.getItem(`qc_studio_${actualContractId}_activeTab`)
                if (savedTab && ['overview', 'history', 'tradeoffs', 'draft', 'playbook'].includes(savedTab)) {
                    setActiveTab(savedTab as 'overview' | 'history' | 'tradeoffs' | 'draft' | 'playbook')
                }

                // PERSISTENCE: Restore expanded sections from LocalStorage
                const savedSections = localStorage.getItem(`qc_studio_${actualContractId}_expandedSections`)
                if (savedSections) {
                    try {
                        setExpandedSections(new Set(JSON.parse(savedSections)))
                    } catch (e) {
                        // Ignore corrupt LocalStorage data
                    }
                }

                // Load clause events for agreement tracking
                const { data: eventsData } = await supabase
                    .from('qc_clause_events')
                    .select('*')
                    .eq('contract_id', actualContractId)
                    .order('created_at', { ascending: true })

                if (eventsData && eventsData.length > 0) {
                    const mappedEvents: ClauseEvent[] = eventsData.map(e => ({
                        eventId: e.event_id,
                        contractId: e.contract_id,
                        clauseId: e.clause_id,
                        eventType: e.event_type,
                        userId: e.user_id,
                        partyRole: e.party_role,
                        userName: e.user_name || 'Unknown',
                        message: e.message,
                        eventData: e.event_data || {},
                        activitySummary: e.activity_summary || null,
                        readByInitiator: e.read_by_initiator ?? false,
                        readByRespondent: e.read_by_respondent ?? false,
                        createdAt: e.created_at
                    }))
                    setClauseEvents(mappedEvents)

                    // Build agreed/queried sets from events - track by party role
                    const initiatorAgreed = new Set<string>()
                    const respondentAgreed = new Set<string>()
                    const queried = new Set<string>()

                    mappedEvents.forEach(evt => {
                        if (evt.eventType === 'agreed' && evt.clauseId) {
                            // Track who agreed based on party_role
                            if (evt.partyRole === 'initiator') {
                                initiatorAgreed.add(evt.clauseId)
                            } else if (evt.partyRole === 'respondent') {
                                respondentAgreed.add(evt.clauseId)
                            }
                        }
                        if (evt.eventType === 'agreement_withdrawn' && evt.clauseId) {
                            // Remove from the correct party's set
                            if (evt.partyRole === 'initiator') {
                                initiatorAgreed.delete(evt.clauseId)
                            } else if (evt.partyRole === 'respondent') {
                                respondentAgreed.delete(evt.clauseId)
                            }
                        }
                        if (evt.eventType === 'queried' && evt.clauseId) {
                            queried.add(evt.clauseId)
                        }
                        if (evt.eventType === 'query_resolved' && evt.clauseId) {
                            queried.delete(evt.clauseId)
                        }
                    })
                    setInitiatorAgreedIds(initiatorAgreed)
                    setRespondentAgreedIds(respondentAgreed)
                    setQueriedClauseIds(queried)

                    // Calculate initial unread count for current user
                    const currentRole = contractData.uploaded_by_user_id === userId ? 'initiator' : 'respondent'
                    const unreadCount = mappedEvents.filter(e => {
                        if (currentRole === 'initiator') return !e.readByInitiator
                        return !e.readByRespondent
                    }).length
                    setUnreadActivityCount(unreadCount)
                }

                // Initialize chat with welcome message
                // Truncate very long contract names for display
                const displayName = contractData.contract_name.length > 50
                    ? contractData.contract_name.substring(0, 47) + '...'
                    : contractData.contract_name

                const nonHeaderClauses = mappedClauses.filter(c => !c.isHeader)
                const certifiedCount = nonHeaderClauses.filter(c => c.clarenceCertified).length
                const totalCount = nonHeaderClauses.length
                const isCertifying = contractData.status === 'certifying' || certifiedCount < totalCount

                setChatMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: isCertifying
                        ? `Welcome to the Quick Create Studio! I'm CLARENCE, your contract analysis assistant.\n\nI'm currently reviewing "${displayName}" — certification is in progress (${certifiedCount} of ${totalCount} clauses done so far).\n\nYou can start exploring certified clauses now, or wait until I've finished reviewing the full contract.`
                        : `Welcome to the Quick Create Studio! I'm CLARENCE, your contract analysis assistant.\n\nI've reviewed "${displayName}" and certified ${certifiedCount} of ${totalCount} clauses.\n\nSelect any clause to see my recommended position and analysis. Feel free to ask me questions about specific clauses or the contract as a whole.`,
                    timestamp: new Date()
                }])

                // Load detected schedules (non-blocking — don't hold up page load)
                fetch(`/api/contracts/${actualContractId}/schedules`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data) {
                            setDetectedSchedules(data.schedules || [])
                            setScheduleDetectionStatus(data.detectionStatus || null)
                        }
                    })
                    .catch(() => { /* schedule fetch is non-critical */ })

                setLoading(false)

            } catch (err) {
                console.error('Load error:', err)
                setError('An unexpected error occurred')
                setLoading(false)
            }
        }

        loadData()
    }, [contractId, router])

    // Load DoA approval status for this contract
    useEffect(() => {
        if (!contractId) return
        async function loadApprovalStatus() {
            try {
                const res = await fetch(`/api/approval/status?contractId=${contractId}`)
                const json = await res.json()
                if (!json.success) return
                if (json.contract?.status) setDoaContractApprovalStatus(json.contract.status)
                if (json.contract?.approverName) setDoaApproverName(json.contract.approverName)
                if (json.clauses) {
                    const mapped: Record<string, 'pending' | 'approved' | 'rejected'> = {}
                    for (const [cid, val] of Object.entries(json.clauses)) {
                        const v = val as { status: string }
                        if (v.status === 'pending' || v.status === 'approved' || v.status === 'rejected') {
                            mapped[cid] = v.status
                        }
                    }
                    setClauseApprovalStatuses(mapped)
                }
            } catch (e) {
                console.error('Failed to load approval status:', e)
            }
        }
        loadApprovalStatus()
    }, [contractId])

    // Load company's designated approver for the modal (initiator only — recipients have no company_users record)
    useEffect(() => {
        if (doaApproverName || !userInfo?.companyId || !isInitiator) return
        async function loadApprover() {
            try {
                const { data } = await supabase
                    .from('company_users')
                    .select('full_name, email')
                    .eq('company_id', userInfo!.companyId!)
                    .in('approval_role', ['approver', 'admin'])
                    .eq('status', 'active')
                    .limit(1)
                    .single()
                if (data) setDoaApproverName(data.full_name || data.email)
            } catch { /* no approver configured */ }
        }
        loadApprover()
    }, [userInfo?.companyId, doaApproverName])

    // ========================================================================
    // SECTION: TRIGGER CERTIFICATION ON STUDIO LOAD
    // When user arrives at studio, kick off sequential certification
    // for any clauses that haven't been certified yet
    // ========================================================================

    const [certificationTriggered, setCertificationTriggered] = useState(false)

    useEffect(() => {
        if (certificationTriggered || !contractId || !clauses.length) return

        // Check if there are uncertified non-header clauses
        // FIX: Also skip clauses that already have clarence_position populated
        // (these came from a pre-certified template and don't need re-certification)
        const pendingClauses = clauses.filter(c =>
            !c.isHeader &&
            (c.processingStatus === 'pending' || c.processingStatus === 'processing') &&
            !c.clarencePosition  // Skip if already has a CLARENCE position (pre-certified from template)
        )

        if (pendingClauses.length === 0) {
            // If all clauses already have positions but status is 'pending', fix them locally
            const preCertifiedClauses = clauses.filter(c =>
                !c.isHeader &&
                (c.processingStatus === 'pending' || c.processingStatus === 'processing') &&
                c.clarencePosition !== null && c.clarencePosition !== undefined
            )
            if (preCertifiedClauses.length > 0) {
                console.log(`✨ ${preCertifiedClauses.length} clauses already pre-certified from template, skipping certification`)
                // Update local state to reflect certified status
                setClauses(prev => prev.map(c => {
                    if (!c.isHeader && c.clarencePosition !== null && c.clarencePosition !== undefined &&
                        (c.processingStatus === 'pending' || c.processingStatus === 'processing')) {
                        return { ...c, processingStatus: 'certified' as const, clarenceCertified: true }
                    }
                    return c
                }))
            }
            return // All already certified or pre-certified
        }

        console.log(`Triggering certification for ${pendingClauses.length} pending clauses...`)
        setCertificationTriggered(true)
        setIsPolling(true)  // <-- ADD THIS LINE to start the polling

        // Fire and forget - the polling useEffect handles the rest
        fetch('https://spikeislandstudios.app.n8n.cloud/webhook/certify-next-clause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contract_id: resolvedContractId || contractId,
                contract_type_key: contract?.contractTypeKey || null,
                initiator_party_role: contract?.initiatorPartyRole || null,
                roleContext: roleContext || null,
            })
        }).catch(err => console.error('Failed to trigger certification:', err))

    }, [contractId, resolvedContractId, clauses.length, certificationTriggered])

    // ========================================================================
    // SECTION 4C: CHAT FUNCTIONS
    // ========================================================================

    const sendChatMessage = useCallback(async (directMessage?: string) => {
        const messageToSend = directMessage || chatInput.trim()
        if (!messageToSend || chatLoading) return

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: messageToSend,
            timestamp: new Date()
        }

        setChatMessages(prev => [...prev, userMessage])
        if (!directMessage) setChatInput('') // Only clear input if using input field
        setChatLoading(true)

        try {
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    contractId: resolvedContractId || contractId,
                    clauseId: selectedClause?.clauseId,
                    clauseName: selectedClause?.clauseName,
                    clauseCategory: selectedClause?.category,
                    context: 'quick_contract_studio',
                    // Context builder fields
                    viewerRole: getPartyRole(),
                    viewerUserId: userInfo?.userId,
                    viewerCompanyId: userInfo?.companyId,
                    // Role matrix fields — enables contract-type-specific party labels
                    contractTypeKey: contract?.contractTypeKey || null,
                    initiatorPartyRole: contract?.initiatorPartyRole || null,
                })
            })

            if (response.ok) {
                const data = await response.json()
                const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: data.response || data.message || "I understand. Let me help you with that.",
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, assistantMessage])
            } else {
                // Fallback response
                const assistantMessage: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: selectedClause
                        ? `Regarding "${selectedClause.clauseName}": ${selectedClause.clarenceAssessment || selectedClause.clarenceSummary || 'This clause has been reviewed and certified. The recommended position balances both parties\' interests based on industry standards.'}`
                        : "I'm here to help you understand this contract. Please select a clause or ask me a specific question.",
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, assistantMessage])
            }
        } catch (err) {
            console.error('Chat error:', err)
            const errorMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setChatLoading(false)
        }
    }, [chatInput, chatLoading, contractId, selectedClause])

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ========================================================================
    // SECTION 4C-2: HELPER FOR POSITION LABELS
    // ========================================================================

    const getPositionLabel = (position: number | null): string => {
        if (position === null) return 'Not set'
        const option = DEFAULT_POSITION_OPTIONS.find(o => o.value === Math.round(position))
        return option?.label || `Position ${position}`
    }

    // Helper to get typical industry range based on category and value type
    const getTypicalRange = (category: string, valueType: string | null, unit: string | null): string => {
        // Category-specific typical ranges
        const categoryRanges: Record<string, Record<string, string>> = {
            'Charges and Payment': {
                'duration': '14-30 days',
                'percentage': '2-4%',
                'currency': 'Net amount',
                'default': '30 days'
            },
            'Term and Termination': {
                'duration': '30-90 days notice',
                'default': '60-90 days'
            },
            'Liability': {
                'currency': '100-150% annual fees',
                'percentage': '100-200%',
                'default': 'Capped at contract value'
            },
            'Confidentiality': {
                'duration': '2-5 years',
                'default': '3-5 years'
            },
            'Service Levels': {
                'percentage': '99.5-99.9%',
                'duration': '4-24 hours',
                'default': '99.9% uptime'
            },
            'Data Protection': {
                'duration': '72 hours breach notification',
                'default': 'GDPR compliant'
            },
            'Intellectual Property': {
                'default': 'Retained by originator'
            },
            'Insurance': {
                'currency': '\u00A31M-\u00A35M',
                'default': 'Industry standard coverage'
            },
            'Audit': {
                'duration': '30 days notice',
                'count': '1-2 per year',
                'default': 'Annual audit rights'
            },
            'Dispute Resolution': {
                'duration': '30-60 days escalation',
                'default': 'Mediation then arbitration'
            }
        }

        const categoryConfig = categoryRanges[category]
        if (categoryConfig) {
            if (valueType && categoryConfig[valueType]) {
                return categoryConfig[valueType]
            }
            return categoryConfig['default'] || 'Industry standard'
        }

        // Generic fallback based on value type
        if (valueType === 'duration') {
            if (unit === 'days') return '30-60 days'
            if (unit === 'months') return '3-6 months'
            if (unit === 'years') return '2-5 years'
            if (unit === 'hours') return '24-48 hours'
            return '30-90 days'
        }
        if (valueType === 'percentage') return '5-15%'
        if (valueType === 'currency') return 'Market rate'

        return 'Industry standard'
    }

    // RANGE MAPPING: Translate a 1-10 position to a real-world value using range data
    const translatePosition = (position: number | null, clauseId: string): { value: number; label: string; description: string } | null => {
        if (position === null) return null
        const mapping = rangeMappings.get(clauseId)
        if (!mapping || !mapping.isDisplayable || !mapping.rangeData?.scale_points?.length) return null

        const points = mapping.rangeData.scale_points

        // Exact match
        const exact = points.find(p => Math.abs(p.position - position) < 0.1)
        if (exact) return exact

        // Interpolation
        const lower = [...points].filter(p => p.position <= position).pop()
        const upper = points.find(p => p.position > position)

        if (!lower || !upper) {
            return position <= points[0].position ? points[0] : points[points.length - 1]
        }

        const fraction = (position - lower.position) / (upper.position - lower.position)
        let interpolatedValue: number

        if (mapping.rangeData.interpolation === 'logarithmic') {
            const logLower = Math.log(lower.value || 1)
            const logUpper = Math.log(upper.value || 1)
            interpolatedValue = Math.exp(logLower + fraction * (logUpper - logLower))
        } else if (mapping.rangeData.interpolation === 'stepped') {
            return lower
        } else {
            interpolatedValue = lower.value + fraction * (upper.value - lower.value)
        }

        const precision = mapping.rangeData.display_precision ?? 0
        const rounded = Number(interpolatedValue.toFixed(precision))

        const label = mapping.rangeData.format_pattern
            .replace('{value}', rounded.toLocaleString())
            .replace('{unit}', mapping.rangeUnit || '')
            .trim()

        return {
            value: rounded,
            label: label,
            description: `Between ${lower.label} and ${upper.label}`
        }
    }

    // POSITION BAR HELPER: Map position 1-10 to 0%-100% across the bar width
    // Position 1 sits at the left edge (0%), position 10 at the right edge (100%)
    const positionToPercent = (pos: number) => (pos / 10) * 100

    // Enhanced position label: use range data if available, fallback to DEFAULT_POSITION_OPTIONS
    const getRangeAwareLabel = (position: number | null, clauseId: string): string => {
        if (position === null) return 'Not set'
        const translated = translatePosition(position, clauseId)
        if (translated) return translated.label
        return getPositionLabel(position)
    }

    // ========================================================================
    // SECTION 4C-3: CLAUSE CLICK -> RATIONALE
    // Auto-generate explanation when clause is selected
    // ========================================================================

    const [lastExplainedClauseId, setLastExplainedClauseId] = useState<string | null>(null)
    const [initialLoadComplete, setInitialLoadComplete] = useState(false)

    // Reset draft editing state when clause selection changes
    useEffect(() => {
        setIsDraftEditing(false)
        setEditingDraftText('')
    }, [selectedClauseIndex])

    // Mark initial load complete after first render with clauses
    useEffect(() => {
        if (clauses.length > 0 && selectedClause && !initialLoadComplete) {
            // Set the first clause as "explained" to prevent auto-triggering on load
            setLastExplainedClauseId(selectedClause.clauseId)
            setInitialLoadComplete(true)
        }
    }, [clauses.length, selectedClause, initialLoadComplete])


    // Auto-expand all sections when clauses first load
    const sectionsInitialized = useRef(false)

    useEffect(() => {
        if (clauses.length > 0 && !sectionsInitialized.current) {
            sectionsInitialized.current = true
            const parentIds = new Set<string>()
            clauses.forEach(c => {
                if (c.parentClauseId) parentIds.add(c.parentClauseId)
            })
            const headerIds = clauses
                .filter(c => parentIds.has(c.clauseId))
                .map(c => c.clauseId)
            if (headerIds.length > 0) {
                setExpandedSections(new Set(headerIds))
            }
        }
    }, [clauses.length])

    useEffect(() => {
        // Don't trigger until initial load is complete
        if (!initialLoadComplete) return

        // Only trigger if we have a selected clause and it's different from last explained
        if (!selectedClause || selectedClause.clauseId === lastExplainedClauseId) return

        // Generate rationale message
        const generateRationale = () => {
            const clause = selectedClause
            const posLabel = getPositionLabel(clause.clarencePosition)

            // Build the rationale message
            let rationaleContent = `**${clause.clauseName}** (${clause.clauseNumber})\n\n`

            // Show document position vs CLARENCE position if we have both
            if (clause.documentPosition !== null && clause.clarencePosition !== null) {
                const docPosLabel = getPositionLabel(clause.documentPosition)
                const difference = Math.abs(clause.documentPosition - clause.clarencePosition)

                rationaleContent += `**Your Document:** Position ${clause.documentPosition.toFixed(1)} - ${docPosLabel}`
                if (clause.extractedValue && clause.extractedUnit) {
                    rationaleContent += ` (${clause.extractedValue} ${clause.extractedUnit})`
                }
                rationaleContent += `\n**CLARENCE Recommends:** Position ${clause.clarencePosition.toFixed(1)} - ${posLabel}\n\n`

                // Add comparison insight using role-aware labels
                const protLabel = roleContext?.protectedPartyLabel || 'the protected party'
                const provLabel = roleContext?.providingPartyLabel || 'the providing party'
                // docPosition > clarencePosition = document is HIGHER on scale = MORE protective
                // docPosition < clarencePosition = document is LOWER on scale = MORE flexible
                const docFavoursProtected = clause.documentPosition > clause.clarencePosition
                // Determine if "works in your favour" based on which end favours the user
                const userFavoursHigh = (roleContext?.positionFavorEnd ?? 10) === 10

                if (difference < 0.5) {
                    rationaleContent += `\u2705 **Assessment:** This clause is well-balanced and aligns with industry standards.\n\n`
                } else if (docFavoursProtected) {
                    const inYourFavour = userFavoursHigh
                    rationaleContent += inYourFavour
                        ? `\u{1F4A1} **Assessment:** This clause is more protective of ${protLabel} than typical, which works in your favour.\n\n`
                        : `\u26A0\uFE0F **Assessment:** This clause is more protective of ${protLabel} than typical. Consider whether the terms are justified for your situation.\n\n`
                } else {
                    const inYourFavour = !userFavoursHigh
                    rationaleContent += inYourFavour
                        ? `\u{1F4A1} **Assessment:** This clause is more flexible towards ${provLabel} than typical, which works in your favour.\n\n`
                        : `\u26A0\uFE0F **Assessment:** This clause is more flexible towards ${provLabel} than typical. Consider whether the terms are justified for your situation.\n\n`
                }
            } else if (clause.clarencePosition !== null) {
                rationaleContent += `**CLARENCE Position:** ${clause.clarencePosition.toFixed(1)} - ${posLabel}\n\n`
            }

            // Add scale context grounding before stored assessment
            if (clause.clarencePosition !== null && roleContext) {
                const scaleDesc = getPositionDescription(
                    Math.round(clause.clarencePosition),
                    roleContext.protectedPartyLabel,
                    roleContext.providingPartyLabel
                )
                rationaleContent += `**Scale Position:** ${clause.clarencePosition.toFixed(1)} \u2014 ${scaleDesc}\n\n`
            }

            // Add the summary/assessment
            if (clause.clarenceSummary) {
                rationaleContent += `**Summary:**\n${clause.clarenceSummary}\n\n`
            }

            if (clause.clarenceAssessment) {
                rationaleContent += `**Rationale:**\n${clause.clarenceAssessment}\n\n`
            }

            // Add flags if any
            if (clause.clarenceFlags && clause.clarenceFlags.length > 0) {
                rationaleContent += `**Attention Points:**\n`
                clause.clarenceFlags.forEach(flag => {
                    rationaleContent += `\u2022 ${flag}\n`
                })
                rationaleContent += '\n'
            }

            // Closing prompt
            rationaleContent += `Would you like me to explain any aspect in more detail, or discuss alternatives?`

            const rationaleMessage: ChatMessage = {
                id: `rationale-${clause.clauseId}-${Date.now()}`,
                role: 'assistant',
                content: rationaleContent,
                timestamp: new Date()
            }

            setChatMessages(prev => [...prev, rationaleMessage])
            setLastExplainedClauseId(clause.clauseId)
        }

        // Small delay to make it feel more natural
        const timer = setTimeout(generateRationale, 300)
        return () => clearTimeout(timer)

    }, [selectedClause?.clauseId, lastExplainedClauseId, initialLoadComplete])

    // ========================================================================
    // SECTION 4D: ACTION HANDLERS - AGREE, QUERY, COMMIT
    // ========================================================================

    // Determine party role for current user
    const getPartyRole = (): 'initiator' | 'respondent' => {
        if (contract?.uploadedByUserId === userInfo?.userId) return 'initiator'
        return 'respondent'
    }

    // ========================================================================
    // AGREEMENT STATUS HELPERS - Dual-party tracking
    // ========================================================================

    // Check if CURRENT user has agreed to a clause
    const hasCurrentUserAgreed = (clauseId: string): boolean => {
        const role = getPartyRole()
        return role === 'initiator'
            ? initiatorAgreedIds.has(clauseId)
            : respondentAgreedIds.has(clauseId)
    }

    // Check if OTHER party has agreed to a clause
    const hasOtherPartyAgreed = (clauseId: string): boolean => {
        const role = getPartyRole()
        return role === 'initiator'
            ? respondentAgreedIds.has(clauseId)
            : initiatorAgreedIds.has(clauseId)
    }

    // Check if BOTH parties have agreed (clause is fully agreed)
    const isBothPartiesAgreed = (clauseId: string): boolean => {
        return initiatorAgreedIds.has(clauseId) && respondentAgreedIds.has(clauseId)
    }

    // Check if at least one party has agreed
    const isAnyPartyAgreed = (clauseId: string): boolean => {
        return initiatorAgreedIds.has(clauseId) || respondentAgreedIds.has(clauseId)
    }

    // Get agreement status for display
    type AgreementStatus = 'none' | 'you_only' | 'other_only' | 'both'
    const getAgreementStatus = (clauseId: string): AgreementStatus => {
        const youAgreed = hasCurrentUserAgreed(clauseId)
        const theyAgreed = hasOtherPartyAgreed(clauseId)

        if (youAgreed && theyAgreed) return 'both'
        if (youAgreed) return 'you_only'
        if (theyAgreed) return 'other_only'
        return 'none'
    }

    const getOtherPartyName = (): string => {
        if (getPartyRole() === 'initiator') {
            // Current user is initiator → other party is respondent
            return respondentInfo?.name || 'Respondent'
        } else {
            // Current user is respondent → other party is initiator
            return initiatorInfo?.name || 'Initiator'
        }
    }

    // Also add a helper for the other party's company
    const getOtherPartyCompany = (): string | null => {
        if (getPartyRole() === 'initiator') {
            return respondentInfo?.company || null
        } else {
            return initiatorInfo?.company || null
        }
    }

    // Count fully agreed clauses (both parties)
    const getFullyAgreedCount = (): number => {
        return clauses.filter(c => !c.isHeader && c.clarenceCertified && isBothPartiesAgreed(c.clauseId)).length
    }

    // Count partially agreed clauses (one party only)
    const getPartiallyAgreedCount = (): number => {
        return clauses.filter(c => !c.isHeader && c.clarenceCertified && isAnyPartyAgreed(c.clauseId) && !isBothPartiesAgreed(c.clauseId)).length
    }

    // Helper: record a clause event to qc_clause_events (unified audit + notification)
    const recordClauseEvent = async (
        eventType: ClauseEvent['eventType'],
        clauseId: string | null,
        message?: string,
        eventData?: Record<string, unknown>
    ): Promise<ClauseEvent | null> => {
        const effectiveContractId = resolvedContractId || contractId
        if (!userInfo || !effectiveContractId) return null

        const partyRole = getPartyRole()

        // Auto-generate human-readable activity summary
        const clauseName = eventData?.clause_name as string || eventData?.clause_number as string || 'a clause'
        const summaryMap: Record<string, string> = {
            'agreed': `${userInfo.fullName} agreed to ${clauseName}`,
            'agreement_withdrawn': `${userInfo.fullName} withdrew agreement on ${clauseName}`,
            'queried': `${userInfo.fullName} raised a query on ${clauseName}`,
            'query_resolved': `Query resolved on ${clauseName} — both parties agreed`,
            'position_changed': `${userInfo.fullName} adjusted position on ${clauseName}`,
            'redrafted': `${userInfo.fullName} redrafted ${clauseName}`,
            'draft_created': `${userInfo.fullName} created a draft for ${clauseName}`,
            'draft_modified': `${userInfo.fullName} modified the draft for ${clauseName}`,
            'committed': `${userInfo.fullName} committed the contract`,
            'clause_deleted': `${userInfo.fullName} deleted ${clauseName}`,
        }
        const activitySummary = summaryMap[eventType] || `${userInfo.fullName} performed ${eventType}`

        // Set read flags: actor has already "seen" their own action
        const readByInitiator = partyRole === 'initiator'
        const readByRespondent = partyRole === 'respondent'

        const { data, error: insertError } = await supabase
            .from('qc_clause_events')
            .insert({
                contract_id: effectiveContractId,
                clause_id: clauseId,
                event_type: eventType,
                user_id: userInfo.userId,
                party_role: partyRole,
                user_name: userInfo.fullName,
                message: message || null,
                event_data: eventData || {},
                activity_summary: activitySummary,
                read_by_initiator: readByInitiator,
                read_by_respondent: readByRespondent
            })
            .select()
            .single()

        if (insertError) {
            console.error('Failed to record event:', insertError)
            return null
        }

        const newEvent: ClauseEvent = {
            eventId: data.event_id,
            contractId: data.contract_id,
            clauseId: data.clause_id,
            eventType: data.event_type,
            userId: data.user_id,
            partyRole: data.party_role,
            userName: data.user_name || userInfo.fullName,
            message: data.message,
            eventData: data.event_data || {},
            activitySummary: data.activity_summary,
            readByInitiator: data.read_by_initiator,
            readByRespondent: data.read_by_respondent,
            createdAt: data.created_at
        }

        setClauseEvents(prev => [...prev, newEvent])
        return newEvent
    }

    // AGREE: Mark a clause as agreed by current user
    const handleAgreeClause = async (clauseId: string) => {
        // Check if current user already agreed (not if anyone agreed)
        if (hasCurrentUserAgreed(clauseId)) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const partyRole = getPartyRole()
        const event = await recordClauseEvent('agreed', clauseId, undefined, {
            clause_name: clause?.clauseName,
            clause_number: clause?.clauseNumber,
            position: clause?.clarencePosition
        })

        if (event) {
            // Update the correct party's agreement set
            if (partyRole === 'initiator') {
                setInitiatorAgreedIds(prev => new Set([...prev, clauseId]))
            } else {
                setRespondentAgreedIds(prev => new Set([...prev, clauseId]))
            }

            // Check if this agreement completes both parties
            const otherAgreed = hasOtherPartyAgreed(clauseId)
            const statusMsg = otherAgreed
                ? `Both parties have now agreed to this clause.`
                : `Awaiting ${getOtherPartyName()} to also agree.`

            // QUERY RESOLUTION: If clause was queried and both parties now agree, resolve the query
            if (otherAgreed && queriedClauseIds.has(clauseId)) {
                // Record query_resolved event
                await recordClauseEvent('query_resolved', clauseId, 'Query resolved - both parties agreed', {
                    clause_name: clause?.clauseName,
                    resolution_method: 'mutual_agreement'
                })

                // Clear from queried set
                setQueriedClauseIds(prev => {
                    const next = new Set(prev)
                    next.delete(clauseId)
                    return next
                })

                const resolveMsg: ChatMessage = {
                    id: `query-resolved-${Date.now()}`,
                    role: 'assistant',
                    content: `✓ Query on "${clause?.clauseName}" has been resolved - both parties have agreed.`,
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, resolveMsg])
            }

            const msg: ChatMessage = {
                id: `agree-${Date.now()}`,
                role: 'assistant',
                content: `✓ You agreed to "${clause?.clauseName}" (${clause?.clauseNumber}). ${statusMsg}`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])
        }
    }

    // ========================================================================
    // SECTION 4D-3: BULK SELECT & AGREE HANDLERS
    // ========================================================================

    // Toggle a single clause in/out of bulk selection
    const toggleBulkSelect = (clauseId: string) => {
        setBulkSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(clauseId)) {
                next.delete(clauseId)
            } else {
                next.add(clauseId)
            }
            return next
        })
    }

    // Get all eligible clauses (certified leaf clauses not yet agreed by current user)
    const getEligibleForAgree = (): ContractClause[] => {
        return clauses.filter(c =>
            !c.isHeader &&
            c.clarenceCertified &&
            !hasCurrentUserAgreed(c.clauseId)
        )
    }

    // Smart select: All eligible (not yet agreed by me)
    const selectAllEligible = () => {
        const eligible = getEligibleForAgree()
        setBulkSelectedIds(new Set(eligible.map(c => c.clauseId)))
    }

    // Smart select: All at balanced position (5.0)
    const selectAllBalanced = () => {
        const balanced = clauses.filter(c =>
            !c.isHeader &&
            c.clarenceCertified &&
            !hasCurrentUserAgreed(c.clauseId) &&
            c.clarencePosition !== null &&
            c.clarencePosition >= 4.5 &&
            c.clarencePosition <= 5.5
        )
        setBulkSelectedIds(new Set(balanced.map(c => c.clauseId)))
    }

    // Clear all selections
    const clearBulkSelection = () => {
        setBulkSelectedIds(new Set())
    }

    // Bulk agree: agree to all selected clauses sequentially
    const handleBulkAgree = async () => {
        if (bulkSelectedIds.size === 0) return

        setBulkAgreeInProgress(true)

        // Filter to only clauses we haven't already agreed to
        const toAgree = Array.from(bulkSelectedIds).filter(id => !hasCurrentUserAgreed(id))

        for (const clauseId of toAgree) {
            await handleAgreeClause(clauseId)
        }

        // Clear selection after completion
        setBulkSelectedIds(new Set())
        setBulkAgreeInProgress(false)
    }

    // WITHDRAW AGREEMENT: Un-agree a clause
    const handleWithdrawAgreement = async (clauseId: string) => {
        // Check if current user has agreed (not if anyone agreed)
        if (!hasCurrentUserAgreed(clauseId)) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const partyRole = getPartyRole()
        const event = await recordClauseEvent('agreement_withdrawn', clauseId, undefined, {
            clause_name: clause?.clauseName
        })

        if (event) {
            // Remove from the correct party's agreement set
            if (partyRole === 'initiator') {
                setInitiatorAgreedIds(prev => {
                    const next = new Set(prev)
                    next.delete(clauseId)
                    return next
                })
            } else {
                setRespondentAgreedIds(prev => {
                    const next = new Set(prev)
                    next.delete(clauseId)
                    return next
                })
            }

            const msg: ChatMessage = {
                id: `withdraw-${Date.now()}`,
                role: 'assistant',
                content: `Agreement withdrawn for "${clause?.clauseName}" (${clause?.clauseNumber}).`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])
        }
    }

    // QUERY: Flag a clause with a question
    const handleQueryClause = async (clauseId: string, queryMessage: string) => {
        if (!queryMessage.trim()) return

        const clause = clauses.find(c => c.clauseId === clauseId)
        const event = await recordClauseEvent('queried', clauseId, queryMessage, {
            clause_name: clause?.clauseName,
            clause_number: clause?.clauseNumber
        })

        if (event) {
            setQueriedClauseIds(prev => new Set([...prev, clauseId]))
            setQueryText('')

            // Chat notification
            const msg: ChatMessage = {
                id: `query-${Date.now()}`,
                role: 'assistant',
                content: `\u2753 Query raised on "${clause?.clauseName}" (${clause?.clauseNumber}):\n\n"${queryMessage}"\n\nThis has been recorded and the other party will be notified.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, msg])

            // Query is saved to qc_party_messages via the insert above
            // The QCPartyChatPanel component will receive it via Supabase Realtime
        }
    }

    // REQUEST CONTRACT SIGN-OFF
    const handleRequestContractApproval = async () => {
        if (!contract || !userInfo || isRequestingApproval) return
        setIsRequestingApproval(true)
        try {
            const res = await fetch('/api/approval/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: userInfo.companyId,
                    requesterUserId: userInfo.userId,
                    requesterName: userInfo.fullName || userInfo.email,
                    requesterEmail: userInfo.email,
                    requesterCompany: userInfo.companyName,
                    documentName: contract.contractName,
                    requestCategory: 'contract',
                    contractId: contract.contractId,
                    message: approvalMessage || null,
                }),
            })
            const json = await res.json()
            if (!json.success) { setError(json.error || 'Failed to request sign-off'); return }
            setDoaContractApprovalStatus('pending')
            setShowContractApprovalModal(false)
            setApprovalMessage('')
        } catch (e) {
            console.error('Contract approval request error:', e)
            setError('Failed to send sign-off request')
        } finally {
            setIsRequestingApproval(false)
        }
    }

    // REQUEST CLAUSE APPROVAL
    const handleRequestClauseApproval = async () => {
        if (!contract || !userInfo || !clauseApprovalTarget || isRequestingApproval) return
        setIsRequestingApproval(true)
        try {
            const res = await fetch('/api/approval/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: userInfo.companyId,
                    requesterUserId: userInfo.userId,
                    requesterName: userInfo.fullName || userInfo.email,
                    requesterEmail: userInfo.email,
                    requesterCompany: userInfo.companyName,
                    documentName: contract.contractName,
                    requestCategory: 'clause',
                    contractId: contract.contractId,
                    clauseId: clauseApprovalTarget.clauseId,
                    clauseName: clauseApprovalTarget.clauseName,
                    message: approvalMessage || null,
                }),
            })
            const json = await res.json()
            if (!json.success) { setError(json.error || 'Failed to request clause approval'); return }
            setClauseApprovalStatuses(prev => ({ ...prev, [clauseApprovalTarget.clauseId]: 'pending' }))
            setClauseApprovalTarget(null)
            setApprovalMessage('')
        } catch (e) {
            console.error('Clause approval request error:', e)
            setError('Failed to send clause approval request')
        } finally {
            setIsRequestingApproval(false)
        }
    }

    // COMMIT: Current user agrees to all remaining clauses and commits
    const handleCommitContract = async () => {
        if (!contract || !userInfo) return

        // Block commit if contract sign-off is pending
        if (doaContractApprovalStatus === 'pending') {
            setError('Contract sign-off is pending approval. Please wait for the approver to respond before committing.')
            setCommitModalState('closed')
            return
        }

        // PERSISTENCE: Force-save any unsaved position adjustments before committing
        const saveSuccess = await forceSavePositions()
        if (!saveSuccess) {
            setError('Failed to save position changes. Please try again before committing.')
            return
        }

        setCommitModalState('processing')
        const partyRole = getPartyRole()

        try {
            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)

            // Find clauses this user hasn't agreed to yet
            const unagreedByMe = leafClauses.filter(c => !hasCurrentUserAgreed(c.clauseId))

            // Auto-agree any clauses the current user hasn't agreed to
            for (const clause of unagreedByMe) {
                await recordClauseEvent('agreed', clause.clauseId, undefined, {
                    clause_name: clause.clauseName,
                    auto_agreed_via_commit: true
                })

                // Update the correct party's set
                if (partyRole === 'initiator') {
                    setInitiatorAgreedIds(prev => new Set([...prev, clause.clauseId]))
                } else {
                    setRespondentAgreedIds(prev => new Set([...prev, clause.clauseId]))
                }
            }

            // Check if other party has also committed (all their clauses agreed)
            const otherPartyFullyAgreed = leafClauses.every(c => hasOtherPartyAgreed(c.clauseId))

            // Record the commit event with audit data
            await recordClauseEvent('committed', null, undefined, {
                party_role: partyRole,
                clauses_individually_agreed: leafClauses.length - unagreedByMe.length,
                clauses_auto_agreed: unagreedByMe.length,
                total_clauses: leafClauses.length,
                other_party_committed: otherPartyFullyAgreed,
                ip_address: 'captured_server_side',
                user_agent: navigator.userAgent,
                committed_at: new Date().toISOString()
            })

            // Only update contract status to 'committed' if BOTH parties have now committed
            if (otherPartyFullyAgreed) {
                await supabase
                    .from('uploaded_contracts')
                    .update({
                        status: 'committed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('contract_id', contract.contractId)

                // Log system event for full commit
                await supabase.from('system_events').insert({
                    event_type: 'quick_contract_committed',
                    source_system: 'quick_contract_studio',
                    context: {
                        contract_id: contract.contractId,
                        user_id: userInfo.userId,
                        party_role: partyRole,
                        clause_count: leafClauses.length,
                        both_parties_committed: true
                    }
                })

                setCommitModalState('success')

                // Redirect after showing success
                setTimeout(() => {
                    router.push('/auth/document-centre?contract_id=' + contract.contractId + '&committed=true')
                }, 2000)
            } else {
                // Only current user committed - waiting for other party
                await supabase.from('system_events').insert({
                    event_type: 'quick_contract_party_committed',
                    source_system: 'quick_contract_studio',
                    context: {
                        contract_id: contract.contractId,
                        user_id: userInfo.userId,
                        party_role: partyRole,
                        awaiting_other_party: true
                    }
                })

                setCommitModalState('waiting_other_party')
            }

        } catch (err) {
            console.error('Commit error:', err)
            setCommitModalState('closed')
            setError('Failed to commit contract. Please try again.')
        }
    }

    // SAVE AS TEMPLATE handler (template mode only)
    // Supports both creating new templates, updating existing ones, and "Save as New" copies
    const handleSaveAsTemplate = async (saveAsNew = false) => {
        if (!templateName.trim() || !contractId || !userInfo) return

        setSavingTemplate(true)
        try {
            const certifiedClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
            let targetTemplateId: string

            if (editTemplateId && !saveAsNew) {
                // UPDATE existing template
                const { error: updateError } = await supabase
                    .from('contract_templates')
                    .update({
                        template_name: templateName.trim(),
                        clause_count: certifiedClauses.length,
                        contract_type: contract?.contractType || 'custom',
                        linked_playbook_id: linkedPlaybookId || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('template_id', editTemplateId)

                if (updateError) throw updateError
                targetTemplateId = editTemplateId

                // Delete old template clauses
                await supabase
                    .from('template_clauses')
                    .delete()
                    .eq('template_id', editTemplateId)
            } else {
                // CREATE new template
                const templateCode = isCompanyTemplate
                    ? `CO-${contractId.substring(0, 8).toUpperCase()}`
                    : `USER-${contractId.substring(0, 8).toUpperCase()}`

                const { data: template, error: templateError } = await supabase
                    .from('contract_templates')
                    .insert({
                        template_code: templateCode,
                        template_name: templateName.trim(),
                        description: `Certified from uploaded contract: ${contract?.contractName || 'Unknown'}`,
                        contract_type: contract?.contractType || 'custom',
                        industry: null,
                        is_system: false,
                        is_public: isCompanyTemplate,
                        is_active: true,
                        company_id: userInfo.companyId,
                        created_by_user_id: userInfo.userId,
                        clause_count: certifiedClauses.length,
                        linked_playbook_id: linkedPlaybookId || null,
                        version: 1,
                        times_used: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select('template_id')
                    .single()

                if (templateError) throw templateError
                targetTemplateId = template.template_id
            }

            // Insert certification-preserving template clauses (including range mapping data)
            const templateClauses = certifiedClauses.map(clause => {
                const rm = rangeMappings.get(clause.clauseId)
                return {
                    template_id: targetTemplateId,
                    clause_number: clause.clauseNumber,
                    clause_name: clause.clauseName,
                    category: clause.category,
                    default_text: clause.clauseText || clause.originalText || '',
                    clause_level: clause.clauseLevel,
                    display_order: clause.displayOrder,
                    parent_clause_id: clause.parentClauseId,
                    clarence_position: clause.clarencePosition,
                    clarence_fairness: clause.clarenceFairness,
                    clarence_summary: clause.clarenceSummary,
                    clarence_assessment: clause.clarenceAssessment,
                    clarence_flags: clause.clarenceFlags || [],
                    clarence_certified: true,
                    clarence_certified_at: clause.clarenceCertifiedAt || new Date().toISOString(),
                    status: 'certified',
                    range_mapping: rm ? {
                        is_displayable: rm.isDisplayable,
                        value_type: rm.valueType,
                        range_unit: rm.rangeUnit,
                        industry_standard_min: rm.industryStandardMin,
                        industry_standard_max: rm.industryStandardMax,
                        range_data: rm.rangeData
                    } : null,
                }
            })

            if (templateClauses.length > 0) {
                await supabase
                    .from('template_clauses')
                    .insert(templateClauses)
            }

            console.log(`✨ ${certifiedClauses.length} pre-certified clauses ${editTemplateId ? 'updated' : 'saved'}`)
            setTemplateSaved(true)
            setSavedTemplateId(targetTemplateId)
            redirectTimeoutRef.current = setTimeout(() => router.push(isCompanyTemplate ? '/auth/company-admin' : '/auth/contracts'), 1500)

        } catch (error) {
            console.error('Failed to save template:', error)
            const errMsg = error && typeof error === 'object' && 'message' in error
                ? (error as { message: string }).message
                : JSON.stringify(error)
            alert(`Failed to save template: ${errMsg}`)
        } finally {
            setSavingTemplate(false)
        }
    }

    // Navigate to Training Studio with saved template pre-selected
    const handlePracticeWithTemplate = () => {
        if (redirectTimeoutRef.current) {
            clearTimeout(redirectTimeoutRef.current)
            redirectTimeoutRef.current = null
        }
        router.push(`/auth/training?template_id=${savedTemplateId}`)
    }

    // ========================================================================
    // SECTION 4D-1A: LOAD PARTY INFO
    //
    // Strategy:
    //   - INITIATOR viewing: load respondent from qc_recipients (own data, no RLS issue)
    //                        load own info from userInfo (already in state)
    //   - RESPONDENT viewing: load EVERYTHING from qc_recipients row
    //                         (initiator_name/company denormalised there, zero cross-table RLS)
    //
    // This eliminates the old 4-table chain (uploaded_contracts → users → companies → quick_contracts)
    // that was RLS-blocked for the respondent.
    // ========================================================================
    const loadPartyInfo = useCallback(async () => {
        if (!resolvedContractId || !userInfo) return

        const currentRole = getPartyRole()
        console.log(`[loadPartyInfo] Role: ${currentRole}, resolvedContractId: ${resolvedContractId}`)

        // ── Step 1: Find the quick_contract_id ──
        // Strategy: Try multiple paths because quick_contracts may be RLS-blocked
        // for the respondent. The URL contractId itself may BE the quick_contract_id.
        let quickContractId: string | null = null

        // Path A: resolvedContractId is a source_contract_id → look up quick_contracts
        // (Works for initiator who owns the quick_contracts row)
        const { data: qcFromSource } = await supabase
            .from('quick_contracts')
            .select('quick_contract_id')
            .eq('source_contract_id', resolvedContractId)
            .maybeSingle()

        if (qcFromSource) {
            quickContractId = qcFromSource.quick_contract_id
            console.log('[loadPartyInfo] Path A: found via source_contract_id →', quickContractId)
        }

        // Path B: URL contractId might directly be a quick_contract_id
        // (Respondent's URL often uses the quick_contract_id)
        if (!quickContractId && contractId !== resolvedContractId) {
            // contractId (from URL) differs from resolvedContractId (uploaded_contracts)
            // so contractId is likely the quick_contract_id — verify via qc_recipients
            const { data: recipientCheck } = await supabase
                .from('qc_recipients')
                .select('quick_contract_id')
                .eq('quick_contract_id', contractId)
                .limit(1)
                .maybeSingle()

            if (recipientCheck) {
                quickContractId = recipientCheck.quick_contract_id
                console.log('[loadPartyInfo] Path B: URL contractId is quick_contract_id →', quickContractId)
            }
        }

        // Path C: Last resort — find by recipient email (no RLS dependency)
        if (!quickContractId && userInfo.email) {
            const { data: recipientByEmail } = await supabase
                .from('qc_recipients')
                .select('quick_contract_id')
                .eq('recipient_email', userInfo.email)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (recipientByEmail) {
                quickContractId = recipientByEmail.quick_contract_id
                console.log('[loadPartyInfo] Path C: found via recipient email →', quickContractId)
            }
        }

        // ── Step 2: Load qc_recipients row (single query, both roles need this) ──
        let recipientRow: {
            recipient_name: string | null
            recipient_email: string | null
            recipient_company: string | null
            initiator_name: string | null
            initiator_company: string | null
            initiator_email: string | null
            status: string | null
        } | null = null

        if (quickContractId) {
            const { data: recipientData } = await supabase
                .from('qc_recipients')
                .select('recipient_name, recipient_email, recipient_company, initiator_name, initiator_company, initiator_email, status')
                .eq('quick_contract_id', quickContractId)
                .limit(1)
                .maybeSingle()

            recipientRow = recipientData
            console.log('[loadPartyInfo] qc_recipients row:', recipientRow)
        }

        // ── Step 3: Populate initiatorInfo and respondentInfo based on role ──

        if (currentRole === 'initiator') {
            // INITIATOR: own info — prefer contract-specific snapshot from qc_recipients
            setInitiatorInfo({
                name: userInfo.fullName || userInfo.email || 'Initiator',
                company: recipientRow?.initiator_company || userInfo.companyName || null
            })

            // Respondent info from qc_recipients
            if (recipientRow) {
                setRespondentInfo({
                    name: recipientRow.recipient_name || recipientRow.recipient_email || 'Respondent',
                    company: recipientRow.recipient_company || null,
                    isOnline: false
                })
                setInviteSent(true)
                const dbStatus = recipientRow.status || 'pending'
                if (['pending', 'invited', 'viewed', 'accepted', 'declined'].includes(dbStatus)) {
                    setRespondentStatus(dbStatus as typeof respondentStatus)
                } else {
                    setRespondentStatus('pending')
                }
            }

        } else {
            // RESPONDENT: read BOTH parties from the single qc_recipients row
            // This avoids the RLS-blocked chain through uploaded_contracts → users → companies

            if (recipientRow) {
                // Initiator info from denormalised columns
                setInitiatorInfo({
                    name: recipientRow.initiator_name || 'Initiator',
                    company: recipientRow.initiator_company || null
                })

                // Respondent info — prefer DB row, fall back to own userInfo
                setRespondentInfo({
                    name: recipientRow.recipient_name || userInfo.fullName || 'Respondent',
                    company: recipientRow.recipient_company || userInfo.companyName || null,
                    isOnline: true
                })

                setInviteSent(true)
                setRespondentStatus('accepted')

                // Update DB status — respondent is now in the studio
                if (quickContractId && recipientRow.status !== 'accepted') {
                    supabase
                        .from('qc_recipients')
                        .update({ status: 'accepted', viewed_at: new Date().toISOString() })
                        .eq('quick_contract_id', quickContractId)
                        .then(({ error }) => {
                            if (error) console.warn('[loadPartyInfo] Failed to update recipient status:', error)
                            else console.log('[loadPartyInfo] Updated recipient status to accepted')
                        })
                }

            } else {
                // No qc_recipients row found — fallback
                // Still try to set initiator from contract data if available
                console.warn('[loadPartyInfo] No qc_recipients row found for respondent — using fallbacks')

                // Attempt direct lookup (may be RLS-blocked, wrapped in try/catch)
                try {
                    const { data: contractData } = await supabase
                        .from('uploaded_contracts')
                        .select('uploaded_by_user_id')
                        .eq('contract_id', resolvedContractId)
                        .single()

                    if (contractData?.uploaded_by_user_id) {
                        const { data: initiatorUser } = await supabase
                            .from('users')
                            .select('first_name, last_name, email, companies(company_name)')
                            .eq('user_id', contractData.uploaded_by_user_id)
                            .single()

                        if (initiatorUser) {
                            const name = `${initiatorUser.first_name || ''} ${initiatorUser.last_name || ''}`.trim()
                                || initiatorUser.email || 'Initiator'
                            setInitiatorInfo({
                                name,
                                company: (initiatorUser.companies as any)?.company_name || null
                            })
                        }
                    }
                } catch (err) {
                    console.log('[loadPartyInfo] Fallback initiator lookup failed (expected if RLS blocks):', err)
                }

                // Self-fill respondent info from userInfo
                setRespondentInfo({
                    name: userInfo.fullName || 'Respondent',
                    company: userInfo.companyName || null,
                    isOnline: true
                })
            }
        }

    }, [resolvedContractId, contract?.uploadedByUserId, userInfo?.userId, userInfo?.fullName, userInfo?.companyName])

    useEffect(() => {
        loadPartyInfo()
    }, [loadPartyInfo])


    // ========================================================================
    // SECTION 4D-2: DRAFT EDITING HANDLERS
    // ========================================================================

    // Start editing draft
    const handleStartEditing = () => {
        if (!selectedClause) return
        // Use existing draft text, or fall back to original clause text
        setEditingDraftText(selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || '')
        setIsDraftEditing(true)
    }

    // Cancel editing
    const handleCancelEditing = () => {
        setIsDraftEditing(false)
        setEditingDraftText('')
        setDraftTargetPosition(null)  // Clear target position if cancelling
        draftTargetPositionRef.current = null  // Also clear the ref
    }

    // Save draft to database
    const handleSaveDraft = async () => {
        if (!selectedClause || !userInfo) return

        // Use ref value as state may be stale due to React closure issues
        const targetPosition = draftTargetPositionRef.current

        // DEBUG: Log what we're saving
        console.log('=== SAVE DRAFT DEBUG ===')
        console.log('Clause:', selectedClause.clauseName)
        console.log('draftTargetPosition:', draftTargetPosition)
        console.log('targetPosition (captured):', targetPosition)
        console.log('Draft text length:', editingDraftText?.length)

        setSavingDraft(true)
        try {
            // Build update object - include clarence_position if this was a position-targeted draft
            const updateData: Record<string, unknown> = {
                draft_text: editingDraftText,
                draft_modified_at: new Date().toISOString(),
                draft_modified_by: userInfo.userId
            }

            // If this draft was generated for a specific position, update clarence_position too
            if (targetPosition !== null) {
                updateData.clarence_position = targetPosition
                console.log('Adding clarence_position to update:', targetPosition)
            } else {
                console.log('targetPosition is null, NOT updating clarence_position')
            }

            console.log('Update data:', JSON.stringify(updateData))

            const { error: updateError } = await supabase
                .from('uploaded_contract_clauses')
                .update(updateData)
                .eq('clause_id', selectedClause.clauseId)

            if (updateError) {
                console.error('Database update error:', updateError)
                throw updateError
            }

            console.log('Database update successful')

            // Update local state
            setClauses(prev => prev.map(c =>
                c.clauseId === selectedClause.clauseId
                    ? {
                        ...c,
                        draftText: editingDraftText,
                        draftModified: true,
                        // Update clarencePosition if we had a target position
                        ...(targetPosition !== null ? { clarencePosition: targetPosition } : {})
                    }
                    : c
            ))

            setIsDraftEditing(false)
            setEditingDraftText('')
            setDraftTargetPosition(null)  // Clear the target position
            draftTargetPositionRef.current = null  // Also clear the ref

            // Log activity event and notify other party
            await recordClauseEvent(
                'draft_modified',
                selectedClause.clauseId,
                `Draft updated for ${selectedClause.clauseName}${targetPosition !== null ? ` (repositioned to ${targetPosition.toFixed(1)})` : ''}`,
                {
                    clause_name: selectedClause.clauseName,
                    clause_number: selectedClause.clauseNumber,
                    previous_position: selectedClause.clarencePosition,
                    new_position: targetPosition,
                    draft_length: editingDraftText.length
                }
            )

            // Add confirmation message to chat (using safe characters)
            const confirmMessage: ChatMessage = {
                id: `draft-saved-${Date.now()}`,
                role: 'assistant',
                content: targetPosition !== null
                    ? `Draft saved for "${selectedClause.clauseName}" at position ${targetPosition.toFixed(1)}.\n\nThe clause has been repositioned and the other party has been notified.`
                    : `Draft saved for "${selectedClause.clauseName}".\n\nThis modified text will be used when generating the final contract document.\n\nThe other party has been notified of this update in their Activity Feed.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

        } catch (err) {
            console.error('Save draft error:', err)
            const errorMessage: ChatMessage = {
                id: `draft-error-${Date.now()}`,
                role: 'assistant',
                content: `Failed to save draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setSavingDraft(false)
        }
    }

    // ========================================================================
    // SECTION 4C-2B: GENERATE DRAFT FOR SPECIFIC POSITION
    // Called when user changes position and accepts offer to regenerate draft
    // ========================================================================
    const handleGenerateDraftForPosition = async (targetPosition: number) => {
        if (!selectedClause || !userInfo || generatingPositionDraft) return

        const currentText = selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || ''
        if (!currentText.trim()) return

        setGeneratingPositionDraft(true)
        setShowDraftOfferPrompt(false)
        setActiveTab('draft')

        // Add a chat message showing the request
        const requestMessage: ChatMessage = {
            id: `position-draft-request-${Date.now()}`,
            role: 'user',
            content: `Redraft "${selectedClause.clauseName}" to reflect position ${targetPosition.toFixed(1)}`,
            timestamp: new Date()
        }
        setChatMessages(prev => [...prev, requestMessage])

        // Build direction hint based on target position — use role-aware labels
        const providingLabel = roleContext?.providingPartyLabel || 'Provider'
        const protectedLabel = roleContext?.protectedPartyLabel || 'Customer'
        let directionHint = ''
        if (targetPosition <= 3) {
            directionHint = `Target position is ${targetPosition.toFixed(1)} (${providingLabel}-favouring). Draft language that gives the ${providingLabel} more flexibility, shorter timelines, lower liability caps, and fewer obligations.`
        } else if (targetPosition >= 7) {
            directionHint = `Target position is ${targetPosition.toFixed(1)} (${protectedLabel}-favouring). Draft language that protects the ${protectedLabel} with stronger warranties, longer timelines, higher liability, and more ${providingLabel} obligations.`
        } else {
            directionHint = `Target position is ${targetPosition.toFixed(1)} (balanced). Draft language that balances both parties' interests with industry-standard terms and mutual obligations.`
        }

        // Truncate very long clause text for the prompt
        const textForPrompt = currentText.length > 3000
            ? currentText.substring(0, 3000) + '\n... [truncated]'
            : currentText

        try {
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `TASK: Rewrite the following clause to reflect position ${targetPosition.toFixed(1)} on a 1-10 scale where 1 is maximum ${providingLabel} flexibility and 10 is maximum ${protectedLabel} protection.

CLAUSE: "${selectedClause.clauseName}" (${selectedClause.clauseNumber})
CATEGORY: ${selectedClause.category}
TARGET POSITION: ${targetPosition.toFixed(1)}
CURRENT CLARENCE ASSESSMENT: ${selectedClause.clarencePosition?.toFixed(1) || 'Unknown'}

${directionHint}

CURRENT CLAUSE TEXT:
${textForPrompt}

INSTRUCTIONS:
- Return ONLY the rewritten clause text, no preamble or explanation
- Maintain the same legal structure and clause numbering
- Keep the same subject matter and intent
- Adjust the balance of rights and obligations to match position ${targetPosition.toFixed(1)}
- Use clear, professional legal language
- Do not add new topics or remove existing coverage areas
- Preserve any specific values, dates, or defined terms from the original`,
                    contractId: resolvedContractId || contractId,
                    clauseId: selectedClause.clauseId,
                    clauseName: selectedClause.clauseName,
                    clauseCategory: selectedClause.category,
                    context: 'position_draft_generation',
                    // Viewer context — enables role-aware drafting
                    viewerRole: getPartyRole(),
                    viewerUserId: userInfo?.userId,
                    viewerCompanyId: userInfo?.companyId,
                    contractTypeKey: contract?.contractTypeKey || null,
                    initiatorPartyRole: contract?.initiatorPartyRole || null,
                })
            })

            if (response.ok) {
                const data = await response.json()
                const newDraftText = (data.response || data.message || '').trim()

                // Detect error/apology responses that the AI or workflow returned
                // as content (200 OK) rather than as a proper HTTP error
                const looksLikeErrorResponse = (text: string) => {
                    const t = text.toLowerCase()
                    return t.startsWith('i apologize') ||
                        t.startsWith('i\'m sorry') ||
                        t.includes('encountered an issue') ||
                        t.includes('please try again') ||
                        t.includes('unable to process')
                }

                if (newDraftText && newDraftText.length > 20 && !looksLikeErrorResponse(newDraftText)) {
                    // Put the new draft into the editor for review
                    setEditingDraftText(newDraftText)
                    setIsDraftEditing(true)
                    // Track the target position so we can update clarence_position when saved
                    console.log('=== SETTING DRAFT TARGET POSITION ===')
                    console.log('targetPosition being set:', targetPosition)
                    setDraftTargetPosition(targetPosition)
                    draftTargetPositionRef.current = targetPosition  // Also store in ref for reliable access
                    console.log('draftTargetPositionRef.current after setting:', draftTargetPositionRef.current)
                    // Switch to Draft tab so user sees the new draft and can save it
                    setActiveTab('draft')

                    // Chat confirmation with guidance
                    const confirmMessage: ChatMessage = {
                        id: `position-draft-result-${Date.now()}`,
                        role: 'assistant',
                        content: `I've redrafted "${selectedClause.clauseName}" to reflect your position of ${targetPosition.toFixed(1)}.\n\n` +
                            (targetPosition <= 3
                                ? `This version gives ${roleContext?.providingPartyLabel || 'the providing party'} more flexibility with reduced obligations.\n\n`
                                : targetPosition >= 7
                                    ? `This version strengthens protections for ${roleContext?.protectedPartyLabel || 'the protected party'} with more accountability.\n\n`
                                    : `This version balances both parties' interests.\n\n`) +
                            `The draft is now in the editor. You can:\n` +
                            `• **Save Draft** to keep this version\n` +
                            `• **Edit** the text further before saving\n` +
                            `• **Cancel** to discard`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, confirmMessage])
                } else {
                    // Either empty/short response, or the workflow returned an apology
                    const errorMessage: ChatMessage = {
                        id: `position-draft-error-${Date.now()}`,
                        role: 'assistant',
                        content: `I wasn't able to generate a draft for position ${targetPosition.toFixed(1)} right now. You can edit the draft text manually in the Draft tab, or try again in a moment.`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, errorMessage])
                }
            } else {
                const errorMessage: ChatMessage = {
                    id: `position-draft-error-${Date.now()}`,
                    role: 'assistant',
                    content: `I wasn't able to connect to generate the draft. Please try again in a moment.`,
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, errorMessage])
            }
        } catch (err) {
            console.error('Position draft generation error:', err)
            const errorMessage: ChatMessage = {
                id: `position-draft-error-${Date.now()}`,
                role: 'assistant',
                content: `An error occurred while generating the draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setGeneratingPositionDraft(false)
            setPendingDraftPosition(null)
        }
    }

    // Reset draft to original
    const handleResetDraft = async () => {
        if (!selectedClause) return

        setSavingDraft(true)
        try {
            const { error: updateError } = await supabase
                .from('uploaded_contract_clauses')
                .update({
                    draft_text: null,
                    draft_modified_at: null,
                    draft_modified_by: null
                })
                .eq('clause_id', selectedClause.clauseId)

            if (updateError) throw updateError

            // Update local state
            setClauses(prev => prev.map(c =>
                c.clauseId === selectedClause.clauseId
                    ? { ...c, draftText: null, draftModified: false }
                    : c
            ))

            // Add confirmation message
            const confirmMessage: ChatMessage = {
                id: `draft-reset-${Date.now()}`,
                role: 'assistant',
                content: `\u21A9\uFE0F Draft reset to original document text for "${selectedClause.clauseName}".`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

        } catch (err) {
            console.error('Reset draft error:', err)
        } finally {
            setSavingDraft(false)
        }
    }

    // Discuss with CLARENCE - sends clause text to chat for modification suggestions
    const handleDiscussClause = () => {
        if (!selectedClause || chatLoading) return

        // Use the best available text: draft > original > content
        const currentText = selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || ''

        // Build the discussion prompt with full text (up to 2000 chars for very long clauses)
        const textForDiscussion = currentText.length > 2000
            ? currentText.substring(0, 2000) + '...'
            : currentText

        const discussPrompt = `I'd like to discuss modifying this clause:\n\n**${selectedClause.clauseName}** (${selectedClause.clauseNumber})\n\n"${textForDiscussion}"\n\nCan you suggest improvements or alternative wording?`

        // Auto-send the message directly
        sendChatMessage(discussPrompt)
    }

    // --------------------------------------------------------
    // CREATE MORE BALANCED DRAFT
    // Calls CLARENCE to rewrite the clause language toward position 5.0
    // --------------------------------------------------------
    const handleCreateBalancedDraft = async () => {
        if (!selectedClause || !userInfo || generatingBalancedDraft) return

        const currentText = selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || ''
        if (!currentText.trim()) return

        setGeneratingBalancedDraft(true)

        // Add a chat message showing the request
        const requestMessage: ChatMessage = {
            id: `balance-request-${Date.now()}`,
            role: 'user',
            content: `Create a more balanced draft for "${selectedClause.clauseName}" (${selectedClause.clauseNumber})`,
            timestamp: new Date()
        }
        setChatMessages(prev => [...prev, requestMessage])

        // Build the direction hint based on current position — use role-aware labels
        // SCALE: 1 = Providing Party-Favouring, 10 = Protected Party-Favouring
        const currentPosition = selectedClause.clarencePosition
        const balProvidingLabel = roleContext?.providingPartyLabel || 'Provider'
        const balProtectedLabel = roleContext?.protectedPartyLabel || 'Customer'
        let directionHint = ''
        if (currentPosition !== null) {
            if (currentPosition < 4) {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (${balProvidingLabel}-favouring). To create a more balanced version, strengthen ${balProtectedLabel} protections and introduce more equitable terms. Add reasonable safeguards for the ${balProtectedLabel} without being overly aggressive.`
            } else if (currentPosition > 6) {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (${balProtectedLabel}-favouring). To create a more balanced version, moderate the ${balProtectedLabel} protections while maintaining reasonable safeguards. Introduce fairer mutual obligations where appropriate.`
            } else {
                directionHint = `The current draft is at position ${currentPosition.toFixed(1)} (near balanced). Fine-tune the language to ensure both parties have equitable obligations and protections. Aim for clearer, more neutral phrasing.`
            }
        }

        // Truncate very long clause text for the prompt
        const textForPrompt = currentText.length > 3000
            ? currentText.substring(0, 3000) + '\n... [truncated]'
            : currentText

        try {
            const response = await fetch('/api/n8n/clarence-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `TASK: Rewrite the following clause to be more balanced (targeting position 5.0 on a 1-10 scale where 1 is maximum ${balProvidingLabel} flexibility and 10 is maximum ${balProtectedLabel} protection).

CLAUSE: "${selectedClause.clauseName}" (${selectedClause.clauseNumber})
CATEGORY: ${selectedClause.category}
CURRENT POSITION: ${currentPosition !== null ? currentPosition.toFixed(1) : 'Unknown'}
FAIRNESS: ${selectedClause.clarenceFairness || 'Not assessed'}

${directionHint}

CURRENT CLAUSE TEXT:
${textForPrompt}

${selectedClause.clarenceAssessment ? `CLARENCE ASSESSMENT: ${selectedClause.clarenceAssessment}` : ''}

INSTRUCTIONS:
- Return ONLY the rewritten clause text, no preamble or explanation
- Maintain the same legal structure and clause numbering
- Keep the same subject matter and intent
- Adjust the balance of rights and obligations toward a more equitable position
- Use clear, professional legal language
- Do not add new topics or remove existing coverage areas
- Preserve any specific values, dates, or defined terms from the original`,
                    contractId: resolvedContractId || contractId,
                    clauseId: selectedClause.clauseId,
                    clauseName: selectedClause.clauseName,
                    clauseCategory: selectedClause.category,
                    context: 'balanced_draft_generation',
                    // Viewer context — enables role-aware drafting
                    viewerRole: getPartyRole(),
                    viewerUserId: userInfo?.userId,
                    viewerCompanyId: userInfo?.companyId,
                    contractTypeKey: contract?.contractTypeKey || null,
                    initiatorPartyRole: contract?.initiatorPartyRole || null,
                })
            })

            if (response.ok) {
                const data = await response.json()
                const balancedText = (data.response || data.message || '').trim()

                if (balancedText && balancedText.length > 20) {
                    // Put the balanced text into the editor for review
                    setEditingDraftText(balancedText)
                    setIsDraftEditing(true)
                    // Track target position of 5.0 (balanced) so we can update clarence_position when saved
                    setDraftTargetPosition(5.0)
                    draftTargetPositionRef.current = 5.0
                    console.log('=== SET BALANCED DRAFT TARGET POSITION === 5.0')

                    // Chat confirmation with guidance
                    const confirmMessage: ChatMessage = {
                        id: `balance-result-${Date.now()}`,
                        role: 'assistant',
                        content: `I've generated a more balanced version of "${selectedClause.clauseName}".\n\n` +
                            (currentPosition !== null && currentPosition < 4
                                ? `The original was at position ${currentPosition.toFixed(1)} (favouring ${roleContext?.providingPartyLabel || 'the providing party'}). I've strengthened the safeguards to create a fairer balance.\n\n`
                                : currentPosition !== null && currentPosition > 6
                                    ? `The original was at position ${currentPosition.toFixed(1)} (favouring ${roleContext?.protectedPartyLabel || 'the protected party'}). I've moderated the terms to be more equitable while maintaining reasonable protections.\n\n`
                                    : `I've refined the language for clearer, more neutral phrasing.\n\n`) +
                            `The draft is now in the editor for your review. You can:\n` +
                            `\u2022 **Save Draft** to keep the balanced version\n` +
                            `\u2022 **Edit** the text further before saving\n` +
                            `\u2022 **Cancel** to discard and keep the original`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, confirmMessage])
                } else {
                    // Response was too short or empty - likely an error
                    const errorMessage: ChatMessage = {
                        id: `balance-error-${Date.now()}`,
                        role: 'assistant',
                        content: `I wasn't able to generate a balanced draft for this clause. You can try using "Discuss with CLARENCE" to get specific suggestions, or edit the text manually.`,
                        timestamp: new Date()
                    }
                    setChatMessages(prev => [...prev, errorMessage])
                }
            } else {
                const errorMessage: ChatMessage = {
                    id: `balance-error-${Date.now()}`,
                    role: 'assistant',
                    content: `I wasn't able to connect to generate the balanced draft. Please try again in a moment.`,
                    timestamp: new Date()
                }
                setChatMessages(prev => [...prev, errorMessage])
            }
        } catch (err) {
            console.error('Balanced draft generation error:', err)
            const errorMessage: ChatMessage = {
                id: `balance-error-${Date.now()}`,
                role: 'assistant',
                content: `An error occurred while generating the balanced draft. Please try again.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setGeneratingBalancedDraft(false)
        }
    }

    // ========================================================================
    // SECTION 4D-3: DELETE CLAUSE HANDLER
    // Works in both Template Mode and Contract Mode
    // ========================================================================

    // Close clause menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (clauseMenuRef.current && !clauseMenuRef.current.contains(event.target as Node)) {
                setClauseMenuOpen(null)
            }
        }
        if (clauseMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [clauseMenuOpen])

    // Open delete confirmation
    const handleDeleteClauseClick = (clause: ContractClause) => {
        setDeleteClauseTarget(clause)
        setShowDeleteConfirm(true)
        setClauseMenuOpen(null)
    }

    // Confirm and execute delete
    const handleConfirmDeleteClause = async () => {
        if (!deleteClauseTarget || !userInfo) return

        setDeletingClause(true)
        try {
            // Delete the clause from uploaded_contract_clauses
            const { error: deleteError } = await supabase
                .from('uploaded_contract_clauses')
                .delete()
                .eq('clause_id', deleteClauseTarget.clauseId)

            if (deleteError) throw deleteError

            // If deleting a parent clause, also delete children
            if (deleteClauseTarget.clauseLevel === 0 || deleteClauseTarget.clauseLevel === 1) {
                const childClauses = clauses.filter(c => c.parentClauseId === deleteClauseTarget.clauseId)
                if (childClauses.length > 0) {
                    await supabase
                        .from('uploaded_contract_clauses')
                        .delete()
                        .in('clause_id', childClauses.map(c => c.clauseId))
                }
            }

            // Update contract clause count
            const newClauseCount = clauses.filter(c =>
                c.clauseId !== deleteClauseTarget.clauseId &&
                c.parentClauseId !== deleteClauseTarget.clauseId
            ).length

            await supabase
                .from('uploaded_contracts')
                .update({
                    clause_count: newClauseCount,
                    updated_at: new Date().toISOString()
                })
                .eq('contract_id', resolvedContractId || contractId)

            // Update local state
            setClauses(prev => prev.filter(c =>
                c.clauseId !== deleteClauseTarget.clauseId &&
                c.parentClauseId !== deleteClauseTarget.clauseId
            ))

            // Clear selection if deleted clause was selected
            if (selectedClause?.clauseId === deleteClauseTarget.clauseId) {
                setSelectedClauseIndex(null)
            }

            // Remove from agreed sets if present (dual-party tracking)
            setInitiatorAgreedIds(prev => {
                const next = new Set(prev)
                next.delete(deleteClauseTarget.clauseId)
                return next
            })
            setRespondentAgreedIds(prev => {
                const next = new Set(prev)
                next.delete(deleteClauseTarget.clauseId)
                return next
            })
            setQueriedClauseIds(prev => {
                const next = new Set(prev)
                next.delete(deleteClauseTarget.clauseId)
                return next
            })

            // Add confirmation message to chat
            const confirmMessage: ChatMessage = {
                id: `clause-deleted-${Date.now()}`,
                role: 'assistant',
                content: `🗑️ Clause "${deleteClauseTarget.clauseName}" (${deleteClauseTarget.clauseNumber}) has been removed from the ${isTemplateMode ? 'template' : 'contract'}.`,
                timestamp: new Date()
            }
            setChatMessages(prev => [...prev, confirmMessage])

            // Log system event
            await supabase.from('system_events').insert({
                event_type: 'clause_deleted',
                source_system: 'quick_contract_studio',
                context: {
                    contract_id: resolvedContractId || contractId,
                    clause_id: deleteClauseTarget.clauseId,
                    clause_name: deleteClauseTarget.clauseName,
                    clause_number: deleteClauseTarget.clauseNumber,
                    user_id: userInfo.userId,
                    is_template_mode: isTemplateMode
                }
            })

        } catch (err) {
            console.error('Delete clause error:', err)
            setError('Failed to delete clause. Please try again.')
        } finally {
            setDeletingClause(false)
            setShowDeleteConfirm(false)
            setDeleteClauseTarget(null)
        }
    }

    // Retry failed certification — resets failed clauses to 'pending' and re-triggers webhook
    const retryFailedClauses = useCallback(async (clauseIds?: string[]) => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId) return

        const targetIds = clauseIds || clauses
            .filter(c => !c.isHeader && c.processingStatus === 'failed')
            .map(c => c.clauseId)

        if (targetIds.length === 0) return

        setRetryingClauses(new Set(targetIds))
        if (!clauseIds) setRetryInProgress(true)

        try {
            // Reset failed clauses to 'pending' in the database
            const { error } = await supabase
                .from('uploaded_contract_clauses')
                .update({ status: 'pending', clarence_certified: false })
                .in('clause_id', targetIds)

            if (error) {
                console.error('Failed to reset clause statuses:', error)
                return
            }

            // Update local state to reflect pending status
            setClauses(prev => prev.map(c => {
                if (targetIds.includes(c.clauseId)) {
                    return { ...c, processingStatus: 'pending' as const, clarenceCertified: false }
                }
                return c
            }))

            // Adjust certification progress
            setCertificationProgress(prev => ({
                ...prev,
                failed: Math.max(0, prev.failed - targetIds.length),
            }))

            // Start polling before triggering webhook so we catch status changes
            setIsPolling(true)

            // Re-trigger the certification webhook
            await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/certify-next-clause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: effectiveId,
                    contract_type_key: contract?.contractTypeKey || null,
                    initiator_party_role: contract?.initiatorPartyRole || null,
                    roleContext: roleContext || null,
                })
            })
        } catch (err) {
            console.error('Retry certification error:', err)
        } finally {
            setRetryingClauses(new Set())
            setRetryInProgress(false)
        }
    }, [contractId, resolvedContractId, clauses, supabase])

    // Re-analyse all clauses with full position scale context
    const handleRecertifyAll = useCallback(async () => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId) return

        setRecertifyInProgress(true)
        try {
            const response = await fetch('/api/n8n/recertify-contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: effectiveId,
                    contractTypeKey: contract?.contractTypeKey || null,
                    initiatorPartyRole: contract?.initiatorPartyRole || null,
                })
            })

            if (!response.ok) {
                throw new Error('Re-certification failed')
            }

            // Reset local clause state to show pending
            setClauses(prev => prev.map(c => c.isHeader ? c : {
                ...c,
                processingStatus: 'pending',
                clarenceCertified: false,
                clarenceAssessment: null as unknown as string,
                clarenceSummary: null as unknown as string,
                clarenceFlags: [],
            }))

            // Start polling to track progress
            setCertificationTriggered(true)
            setIsPolling(true)
        } catch (err) {
            console.error('Re-certification error:', err)
        } finally {
            setRecertifyInProgress(false)
        }
    }, [contractId, resolvedContractId, contract?.contractTypeKey, contract?.initiatorPartyRole, supabase])

    // Cancel delete
    const handleCancelDelete = () => {
        setShowDeleteConfirm(false)
        setDeleteClauseTarget(null)
    }

    // ========================================================================
    // SECTION 4E: FILTERED CLAUSES
    // ========================================================================

    const filteredClauses = clauses.filter(c => {
        if (!clauseSearchTerm) return true
        const search = clauseSearchTerm.toLowerCase()
        return (
            c.clauseName.toLowerCase().includes(search) ||
            c.clauseNumber.toLowerCase().includes(search) ||
            c.category.toLowerCase().includes(search)
        )
    })

    // ========================================================================
    // SECTION 4F: HELPER FUNCTIONS
    // ========================================================================

    // ROLE MATRIX: Position color based on who it favours
    // If user is protected party (position 10 favours them): high = green (good for you)
    // If user is providing party (position 1 favours them): low = green (good for you)
    const getPositionColor = (position: number | null): string => {
        if (position === null) return 'bg-slate-200'
        if (position >= 4 && position <= 6) return 'bg-amber-500'  // Balanced

        const youFavorEnd = roleContext?.positionFavorEnd ?? 10
        if (youFavorEnd === 10) {
            // Protected party: high positions favour you
            if (position >= 8) return 'bg-emerald-500'
            if (position >= 6) return 'bg-teal-500'
            return 'bg-blue-500'
        } else {
            // Providing party: low positions favour you
            if (position <= 2) return 'bg-emerald-500'
            if (position <= 4) return 'bg-teal-500'
            return 'bg-blue-500'
        }
    }

    // Get color and label for the aggregate balance gauge
    const getBalanceColor = (score: number): { bg: string; text: string } => {
        if (score >= 4.5 && score <= 5.5) return { bg: 'bg-teal-500', text: 'text-teal-700' }
        if (score >= 3.5 && score < 4.5) return { bg: 'bg-sky-500', text: 'text-sky-700' }
        if (score > 5.5 && score <= 6.5) return { bg: 'bg-emerald-400', text: 'text-emerald-700' }
        if (score < 3.5) return { bg: 'bg-blue-500', text: 'text-blue-700' }
        return { bg: 'bg-emerald-500', text: 'text-emerald-700' }
    }

    const getBalanceLabel = (score: number): string => {
        const providerLabel = roleContext?.providingPartyLabel || 'Provider'
        const customerLabel = roleContext?.protectedPartyLabel || 'Customer'
        if (score >= 4.5 && score <= 5.5) return 'Balanced'
        if (score < 4.5) return `Favours ${providerLabel}`
        return `Favours ${customerLabel}`
    }


    // ========================================================================
    // SECTION 4F-2: REALTIME SUBSCRIPTION FOR ACTIVITY NOTIFICATIONS
    // ========================================================================

    // Subscribe to qc_clause_events for live notification push
    useEffect(() => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId || !userInfo) return

        const channel = supabase
            .channel(`qc-events-${effectiveId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'qc_clause_events',
                    filter: `contract_id=eq.${effectiveId}`
                },
                (payload) => {
                    const e = payload.new as Record<string, unknown>

                    // Don't process events from current user (already in local state)
                    if (e.user_id === userInfo.userId) return

                    const newEvent: ClauseEvent = {
                        eventId: e.event_id as string,
                        contractId: e.contract_id as string,
                        clauseId: (e.clause_id as string) || null,
                        eventType: e.event_type as ClauseEvent['eventType'],
                        userId: e.user_id as string,
                        partyRole: e.party_role as 'initiator' | 'respondent',
                        userName: (e.user_name as string) || 'Unknown',
                        message: (e.message as string) || null,
                        eventData: (e.event_data as Record<string, unknown>) || {},
                        activitySummary: (e.activity_summary as string) || null,
                        readByInitiator: (e.read_by_initiator as boolean) ?? false,
                        readByRespondent: (e.read_by_respondent as boolean) ?? false,
                        createdAt: e.created_at as string
                    }

                    setClauseEvents(prev => [...prev, newEvent])

                    // Increment unread count (this is from the other party)
                    setUnreadActivityCount(prev => prev + 1)

                    // Update agreement/query sets based on event type
                    if (newEvent.clauseId) {
                        if (newEvent.eventType === 'agreed') {
                            if (newEvent.partyRole === 'initiator') {
                                setInitiatorAgreedIds(prev => new Set([...prev, newEvent.clauseId!]))
                            } else {
                                setRespondentAgreedIds(prev => new Set([...prev, newEvent.clauseId!]))
                            }
                        }
                        if (newEvent.eventType === 'agreement_withdrawn') {
                            if (newEvent.partyRole === 'initiator') {
                                setInitiatorAgreedIds(prev => {
                                    const next = new Set(prev)
                                    next.delete(newEvent.clauseId!)
                                    return next
                                })
                            } else {
                                setRespondentAgreedIds(prev => {
                                    const next = new Set(prev)
                                    next.delete(newEvent.clauseId!)
                                    return next
                                })
                            }
                        }
                        if (newEvent.eventType === 'queried') {
                            setQueriedClauseIds(prev => new Set([...prev, newEvent.clauseId!]))
                        }
                        if (newEvent.eventType === 'query_resolved') {
                            setQueriedClauseIds(prev => {
                                const next = new Set(prev)
                                next.delete(newEvent.clauseId!)
                                return next
                            })
                        }
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [contractId, resolvedContractId, userInfo, supabase])

    // ========================================================================
    // SECTION 4F-2B: REALTIME SUBSCRIPTION FOR CLAUSE DATA CHANGES
    // When the other party saves a redraft, adjusts position, etc.,
    // this pushes the updated clause data to the other browser in real-time.
    // ========================================================================
    useEffect(() => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId || !userInfo) return

        const clauseChannel = supabase
            .channel(`qc-clauses-${effectiveId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'uploaded_contract_clauses',
                    filter: `contract_id=eq.${effectiveId}`
                },
                (payload) => {
                    const updated = payload.new as Record<string, unknown>
                    const clauseId = updated.clause_id as string
                    if (!clauseId) return

                    console.log('[Realtime] Clause updated:', clauseId, {
                        position: updated.clarence_position,
                        hasDraft: !!updated.draft_text,
                        status: updated.status
                    })

                    // Update the local clause state with fresh data
                    setClauses(prev => prev.map(clause => {
                        if (clause.clauseId !== clauseId) return clause

                        return {
                            ...clause,
                            // Core certification fields
                            clarenceCertified: (updated.clarence_certified as boolean) || clause.clarenceCertified,
                            clarencePosition: (updated.clarence_position as number) ?? clause.clarencePosition,
                            clarenceFairness: (updated.clarence_fairness as string) || clause.clarenceFairness,
                            clarenceSummary: (updated.clarence_summary as string) || clause.clarenceSummary,
                            clarenceAssessment: (updated.clarence_assessment as string) || clause.clarenceAssessment,
                            clarenceFlags: (updated.clarence_flags as string[]) || clause.clarenceFlags,
                            // Draft fields
                            draftText: (updated.draft_text as string) || null,
                            draftModified: !!(updated.draft_text),
                            // Party positions
                            initiatorPosition: (updated.initiator_position as number) ?? clause.initiatorPosition,
                            respondentPosition: (updated.respondent_position as number) ?? clause.respondentPosition,
                            // Value extraction (may update during recertification)
                            extractedValue: (updated.extracted_value as string) ?? clause.extractedValue,
                            extractedUnit: (updated.extracted_unit as string) ?? clause.extractedUnit,
                            valueType: (updated.value_type as string) ?? clause.valueType,
                            // Content
                            clauseText: (updated.content as string) || clause.clauseText,
                            originalText: (updated.original_text as string) || clause.originalText,
                            // Status
                            processingStatus: (updated.status as ContractClause['processingStatus']) || clause.processingStatus,
                        }
                    }))
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Clause update channel subscribed for', effectiveId)
                }
            })

        return () => {
            supabase.removeChannel(clauseChannel)
        }
    }, [contractId, resolvedContractId, userInfo?.userId])

    // Mark all unread events as read for current user
    const markActivityAsRead = useCallback(async () => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId || !userInfo || unreadActivityCount === 0) return

        const partyRole = getPartyRole()
        const readColumn = partyRole === 'initiator' ? 'read_by_initiator' : 'read_by_respondent'

        // Update database
        const { error } = await supabase
            .from('qc_clause_events')
            .update({ [readColumn]: true })
            .eq('contract_id', effectiveId)
            .eq(readColumn, false)

        if (error) {
            console.error('Failed to mark events as read:', error)
            return
        }

        // Update local state
        setClauseEvents(prev => prev.map(e => ({
            ...e,
            ...(partyRole === 'initiator' ? { readByInitiator: true } : { readByRespondent: true })
        })))
        setUnreadActivityCount(0)
    }, [contractId, resolvedContractId, userInfo, unreadActivityCount, supabase])

    // Auto-mark as read when History tab is active
    useEffect(() => {
        if (activeTab === 'history' && unreadActivityCount > 0) {
            markActivityAsRead()
        }
    }, [activeTab, unreadActivityCount, markActivityAsRead])

    // ========================================================================
    // SECTION 4F-3: REALTIME PRESENCE — ONLINE STATUS
    // ========================================================================

    useEffect(() => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId || !userInfo) return

        const presenceChannel = supabase.channel(`qc-presence-${effectiveId}`, {
            config: { presence: { key: userInfo.userId } }
        })

        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState()
                // Check if any user OTHER than current user is present
                const otherUsers = Object.keys(state).filter(key => key !== userInfo.userId)
                setOtherPartyOnline(otherUsers.length > 0)
            })
            .on('presence', { event: 'join' }, ({ key }) => {
                if (key !== userInfo.userId) {
                    setOtherPartyOnline(true)
                    console.log('[Presence] Other party came online')
                }
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                if (key !== userInfo.userId) {
                    // Check remaining presences before marking offline
                    const state = presenceChannel.presenceState()
                    const otherUsers = Object.keys(state).filter(k => k !== userInfo.userId)
                    setOtherPartyOnline(otherUsers.length > 0)
                    console.log('[Presence] Other party went offline')
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        userId: userInfo.userId,
                        role: getPartyRole(),
                        joinedAt: new Date().toISOString()
                    })
                    console.log('[Presence] Tracking started for', getPartyRole())
                }
            })

        return () => {
            presenceChannel.untrack()
            supabase.removeChannel(presenceChannel)
        }
    }, [contractId, resolvedContractId, userInfo?.userId])

    // ========================================================================
    // SECTION 4G: AUTO-SAVE TIMER & LOCALSTORAGE PERSISTENCE
    // ========================================================================

    // Helper: Get the current user's position column name
    const getPositionColumn = useCallback((): 'initiator_position' | 'respondent_position' => {
        const role = getPartyRole()
        return role === 'initiator' ? 'initiator_position' : 'respondent_position'
    }, [contract, userInfo])

    // Helper: Get the display position for the current user
    // Falls back: user's adjusted position → CLARENCE assessment → null
    const getUserDisplayPosition = useCallback((clause: ContractClause): number | null => {
        const role = getPartyRole()
        const userPosition = role === 'initiator' ? clause.initiatorPosition : clause.respondentPosition
        return userPosition ?? clause.clarencePosition ?? null
    }, [contract, userInfo])

    // Aggregate contract balance score — mean of all certified clause positions
    // Uses live negotiation state (user-adjusted positions where set, else CLARENCE)
    const aggregateBalance = useMemo(() => {
        const certifiedLeafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
        if (certifiedLeafClauses.length === 0) return null

        const positions = certifiedLeafClauses
            .map(c => getUserDisplayPosition(c))
            .filter((p): p is number => p !== null)

        if (positions.length === 0) return null

        const sum = positions.reduce((acc, val) => acc + val, 0)
        return {
            score: sum / positions.length,
            clauseCount: positions.length
        }
    }, [clauses, getUserDisplayPosition])

    // Playbook compliance — recalculates live as positions change
    const playbookCompliance = useMemo<ComplianceResult | null>(() => {
        if (playbookRules.length === 0 || clauses.length === 0) return null
        return calculatePlaybookCompliance(playbookRules, toComplianceClauses(clauses))
    }, [playbookRules, clauses])

    // Per-clause playbook compliance status for sidebar dots
    const clausePlaybookStatus = useMemo<Map<string, 'compliant' | 'warning' | 'breach'>>(() => {
        const map = new Map<string, 'compliant' | 'warning' | 'breach'>()
        if (playbookRules.length === 0) return map
        for (const clause of clauses) {
            if (!clause.clarenceCertified || clause.clarencePosition == null) continue
            const rule = playbookRules.find(r => normaliseCategory(r.category) === normaliseCategory(clause.category))
            if (!rule) continue
            const pos = clause.clarencePosition
            if (pos < rule.fallback_position) {
                map.set(clause.clauseId, 'breach')
            } else if (pos < rule.ideal_position) {
                map.set(clause.clauseId, 'warning')
            } else {
                map.set(clause.clauseId, 'compliant')
            }
        }
        return map
    }, [playbookRules, clauses])

    // Auto-save dirty positions every 30 seconds
    useEffect(() => {
        if (dirtyPositions.size === 0) return

        const timer = setTimeout(async () => {
            if (dirtyPositions.size === 0 || !userInfo) return

            setAutoSaveStatus('saving')
            const positionColumn = getPositionColumn()
            const timestampColumn = positionColumn === 'initiator_position'
                ? 'initiator_position_updated_at'
                : 'respondent_position_updated_at'

            try {
                // Batch update all dirty positions
                const updates = Array.from(dirtyPositions.entries())
                let failCount = 0

                for (const [clauseId, position] of updates) {
                    const { error } = await supabase
                        .from('uploaded_contract_clauses')
                        .update({
                            [positionColumn]: position,
                            [timestampColumn]: new Date().toISOString()
                        })
                        .eq('clause_id', clauseId)

                    if (error) {
                        console.error(`Auto-save failed for clause ${clauseId}:`, error)
                        failCount++
                    }
                }

                if (failCount === 0) {
                    // All saved successfully → clear dirty state
                    setDirtyPositions(new Map())
                    setAutoSaveStatus('saved')
                    setLastSavedAt(new Date())

                    // Reset status indicator after 3 seconds
                    setTimeout(() => setAutoSaveStatus('idle'), 3000)
                } else {
                    setAutoSaveStatus('error')
                    setTimeout(() => setAutoSaveStatus('idle'), 5000)
                }

            } catch (err) {
                console.error('Auto-save error:', err)
                setAutoSaveStatus('error')
                setTimeout(() => setAutoSaveStatus('idle'), 5000)
            }
        }, 30000) // 30-second debounce

        return () => clearTimeout(timer)
    }, [dirtyPositions, userInfo, getPositionColumn, supabase])

    // Save UI state to LocalStorage when it changes
    useEffect(() => {
        const key = resolvedContractId || contractId
        if (!key) return
        if (selectedClauseIndex !== null) {
            localStorage.setItem(`qc_studio_${key}_selectedClause`, String(selectedClauseIndex))
        }
    }, [selectedClauseIndex, contractId, resolvedContractId])

    useEffect(() => {
        const key = resolvedContractId || contractId
        if (!key) return
        localStorage.setItem(`qc_studio_${key}_activeTab`, activeTab)
    }, [activeTab, contractId, resolvedContractId])

    useEffect(() => {
        const key = resolvedContractId || contractId
        if (!key) return
        localStorage.setItem(`qc_studio_${key}_expandedSections`, JSON.stringify([...expandedSections]))
    }, [expandedSections, contractId, resolvedContractId])

    // Save dirty positions immediately when user navigates away
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (dirtyPositions.size > 0) {
                e.preventDefault()
                e.returnValue = 'You have unsaved position changes. Are you sure you want to leave?'
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [dirtyPositions])

    // Handler for position slider changes (called from render section)
    const handlePositionChange = useCallback((clauseId: string, newPosition: number) => {
        const role = getPartyRole()
        const clause = clauses.find(c => c.clauseId === clauseId)

        // Update local state immediately (responsive UI)
        setClauses(prev => prev.map(c =>
            c.clauseId === clauseId
                ? {
                    ...c,
                    ...(role === 'initiator'
                        ? { initiatorPosition: newPosition }
                        : { respondentPosition: newPosition }
                    )
                }
                : c
        ))

        // Mark as dirty for auto-save
        setDirtyPositions(prev => {
            const next = new Map(prev)
            next.set(clauseId, newPosition)
            return next
        })

        // Reset save indicator to show unsaved state
        setAutoSaveStatus('idle')

        // ================================================================
        // Check if position differs significantly from CLARENCE's
        // assessment and offer to regenerate draft
        // ================================================================
        if (clause && clause.clarencePosition !== null) {
            const positionDelta = Math.abs(newPosition - clause.clarencePosition)

            // If user moved position by more than 1 point from CLARENCE's assessment,
            // offer to regenerate the draft to match their new position
            if (positionDelta >= 1.0) {
                // Capture old position so cancel can revert
                const role = getPartyRole()
                const oldPosition = role === 'initiator' ? clause.initiatorPosition : clause.respondentPosition
                setPreChangePosition(oldPosition ?? clause.clarencePosition)
                setPendingDraftPosition(newPosition)
                setShowDraftOfferPrompt(true)
            }
        }
        // ================================================================
        // DEBOUNCED PLAYBOOK COMPLIANCE CHECK
        // ================================================================
        if (userInfo?.companyId && clause) {
            if (complianceCheckTimerRef.current) clearTimeout(complianceCheckTimerRef.current)
            complianceCheckTimerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch('/api/agents/compliance-checker', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clauseId,
                            clauseName: clause.clauseName,
                            clauseCategory: clause.category || 'General',
                            proposedPosition: newPosition,
                            currentPosition: role === 'initiator' ? clause.initiatorPosition : clause.respondentPosition,
                            party: role === 'initiator' ? 'customer' : 'provider',
                            companyId: userInfo.companyId,
                            contractTypeKey: null,
                            allClauses: clauses.map(c => ({
                                clauseId: c.clauseId,
                                clauseName: c.clauseName,
                                category: c.category || 'General',
                                initiatorPosition: c.initiatorPosition,
                                respondentPosition: c.respondentPosition,
                                clarencePosition: c.clarencePosition,
                            })),
                        }),
                    })
                    if (res.ok) {
                        const data = await res.json()
                        if (data.success && data.result) {
                            const cr: ComplianceCheckResult = data.result
                            if (cr.severity === 'guidance' && cr.guidanceTips.length > 0) {
                                setQcComplianceGuidanceTips(cr.guidanceTips)
                            } else if (cr.severity === 'warning' || cr.severity === 'breach' || cr.severity === 'deal_breaker') {
                                setQcComplianceResult(cr)
                                setQcPendingRevertClauseId(clauseId)
                                setQcPendingRevertPosition(
                                    role === 'initiator' ? clause.initiatorPosition : clause.respondentPosition
                                )
                                setShowQcComplianceWarning(true)
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[QC ComplianceCheck] Failed:', err)
                }
            }, 500)
        }
    }, [clauses, getPartyRole, userInfo])

    // ================================================================
    // QC COMPLIANCE MODAL CALLBACKS
    // ================================================================
    const handleQcComplianceProceed = () => {
        // User chose to proceed — dirty position stays, auto-save will persist it
        setShowQcComplianceWarning(false)
        setQcComplianceResult(null)
        setQcPendingRevertClauseId(null)
        setQcPendingRevertPosition(null)
    }

    const handleQcComplianceAdjust = () => {
        // Revert the position change
        if (qcPendingRevertClauseId && qcPendingRevertPosition !== null) {
            const revertId = qcPendingRevertClauseId
            const revertPos = qcPendingRevertPosition
            setClauses(prev => prev.map(c =>
                c.clauseId === revertId
                    ? {
                        ...c,
                        ...(getPartyRole() === 'initiator'
                            ? { initiatorPosition: revertPos }
                            : { respondentPosition: revertPos }
                        )
                    }
                    : c
            ))
            // Remove from dirty positions
            setDirtyPositions(prev => {
                const next = new Map(prev)
                next.delete(revertId)
                return next
            })
        }
        setShowQcComplianceWarning(false)
        setQcComplianceResult(null)
        setQcPendingRevertClauseId(null)
        setQcPendingRevertPosition(null)
    }

    const handleQcComplianceSeekApproval = async () => {
        setShowQcComplianceWarning(false)
        if (!qcComplianceResult || !userInfo) return

        try {
            await fetch('/api/approval/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractId: contractId,
                    companyId: userInfo.companyId,
                    requesterUserId: userInfo.userId,
                    requesterName: userInfo.fullName,
                    requesterCompany: userInfo.companyName,
                    requestCategory: 'clause',
                    approvalContext: {
                        clauseId: qcPendingRevertClauseId,
                        complianceSeverity: qcComplianceResult.severity,
                        overallScore: qcComplianceResult.overallScore,
                        scoreDelta: qcComplianceResult.scoreDelta,
                        breachedRules: qcComplianceResult.breachedRules,
                        reasoning: qcComplianceResult.reasoning,
                    }
                })
            })
        } catch (err) {
            console.warn('[QC ComplianceCheck] Approval request failed:', err)
        }

        // Revert the position
        handleQcComplianceAdjust()
    }

    // Force-save all dirty positions now (for manual "Save" or before commit)
    const forceSavePositions = useCallback(async () => {
        if (dirtyPositions.size === 0 || !userInfo) return true

        setAutoSaveStatus('saving')
        const positionColumn = getPositionColumn()
        const timestampColumn = positionColumn === 'initiator_position'
            ? 'initiator_position_updated_at'
            : 'respondent_position_updated_at'

        try {
            for (const [clauseId, position] of dirtyPositions.entries()) {
                const { error } = await supabase
                    .from('uploaded_contract_clauses')
                    .update({
                        [positionColumn]: position,
                        [timestampColumn]: new Date().toISOString()
                    })
                    .eq('clause_id', clauseId)

                if (error) throw error
            }

            setDirtyPositions(new Map())
            setAutoSaveStatus('saved')
            setLastSavedAt(new Date())
            setTimeout(() => setAutoSaveStatus('idle'), 3000)
            return true
        } catch (err) {
            console.error('Force save error:', err)
            setAutoSaveStatus('error')
            return false
        }
    }, [dirtyPositions, userInfo, getPositionColumn, supabase])



    // ========================================================================
    // SECTION 5A: PROGRESSIVE LOADING - POLL FOR CLAUSE STATUS UPDATES
    // (Placed before early returns to comply with React hooks rules)
    // ========================================================================

    // POLL FOR CLAUSES TO ARRIVE (when contract is processing but no clauses yet)
    useEffect(() => {
        // Only poll if we have a contract but no clauses yet
        if (!contractId || !contract || clauses.length > 0) return

        // Only poll if contract is in a processing state
        const processingStates = ['processing', 'certifying', 'uploading', 'pending']
        if (!processingStates.includes(contract.status)) return

        console.log('[QC Studio] No clauses yet, polling for clause arrival...')

        const pollForClauses = setInterval(async () => {
            try {
                // Check for clauses
                const { data: clausesData, error: clausesError } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('*')
                    .eq('contract_id', resolvedContractId)
                    .order('display_order', { ascending: true })

                if (clausesError) {
                    console.error('Clause poll error:', clausesError)
                    return
                }

                if (clausesData && clausesData.length > 0) {
                    console.log(`[QC Studio] Clauses arrived! Found ${clausesData.length} clauses`)

                    // Map the clauses (matching the original mapping logic)
                    const mappedClauses: ContractClause[] = clausesData.map(c => ({
                        clauseId: c.clause_id,
                        positionId: c.clause_id,
                        clauseNumber: c.clause_number,
                        clauseName: c.clause_name,
                        category: c.category || 'Other',
                        clauseText: c.content || '',
                        originalText: c.original_text || c.content || null,
                        clauseLevel: c.clause_level || 1,
                        displayOrder: c.display_order,
                        parentClauseId: c.parent_clause_id,
                        clarenceCertified: c.clarence_certified || false,
                        clarencePosition: c.clarence_position,
                        clarenceFairness: c.clarence_fairness,
                        clarenceSummary: c.clarence_summary,
                        clarenceAssessment: c.clarence_assessment,
                        clarenceFlags: c.clarence_flags || [],
                        clarenceCertifiedAt: c.clarence_certified_at,
                        initiatorPosition: c.initiator_position ?? null,
                        respondentPosition: c.respondent_position ?? null,
                        extractedValue: c.extracted_value,
                        extractedUnit: c.extracted_unit,
                        valueType: c.value_type,
                        documentPosition: c.document_position,
                        draftText: c.draft_text || null,
                        draftModified: !!c.draft_text,
                        isHeader: c.is_header || false,
                        processingStatus: c.status || 'pending',
                        positionOptions: DEFAULT_POSITION_OPTIONS
                    }))

                    setClauses(mappedClauses)

                    // Belt-and-suspenders: ensure loading spinner is cleared
                    setLoading(false)
                    setContract(prev => prev ? { ...prev, clauseCount: clausesData.length } : prev)

                    // Auto-select first non-header clause
                    const firstLeaf = mappedClauses.findIndex(c => !c.isHeader)
                    if (firstLeaf >= 0) {
                        setSelectedClauseIndex(firstLeaf)
                    }

                    // Auto-expand sections
                    const parentIds = new Set<string>()
                    mappedClauses.forEach(c => {
                        if (c.parentClauseId) parentIds.add(c.parentClauseId)
                    })
                    const headerIds = mappedClauses
                        .filter(c => parentIds.has(c.clauseId))
                        .map(c => c.clauseId)
                    if (headerIds.length > 0) {
                        setExpandedSections(new Set(headerIds))
                    }

                    clearInterval(pollForClauses)
                }

                // Also refresh contract status
                const { data: contractData } = await supabase
                    .from('uploaded_contracts')
                    .select('status, clause_count')
                    .eq('contract_id', resolvedContractId || contractId)
                    .single()

                if (contractData) {
                    setContract(prev => prev ? {
                        ...prev,
                        status: contractData.status,
                        clauseCount: contractData.clause_count || 0
                    } : prev)
                }

            } catch (err) {
                console.error('Clause arrival poll error:', err)
            }
        }, 3000) // Poll every 3 seconds

        return () => clearInterval(pollForClauses)
    }, [contractId, contract?.status, clauses.length])

    // POLL FOR CERTIFICATION STATUS (when clauses exist but still being certified)
    // Also refreshes range mappings as they are generated during certification
    useEffect(() => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId || !clauses.length) return

        // Check if there are any uncertified non-header clauses
        // Must check BOTH processingStatus AND clarenceCertified
        // (button requires clarenceCertified, so we must poll until that's true too)
        const uncertified = clauses.filter(c =>
            !c.isHeader && (
                (c.processingStatus !== 'certified' && c.processingStatus !== 'failed') ||
                !c.clarenceCertified
            )
        )

        if (uncertified.length === 0) {
            setIsPolling(false)
            return
        }

        setIsPolling(true)

        const pollInterval = setInterval(async () => {
            try {
                const { data: updatedClauses, error } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('clause_id, status, is_header, clarence_certified, clarence_position, clarence_fairness, clarence_summary, clarence_assessment, clarence_flags, content, original_text, extracted_value, extracted_unit, value_type')
                    .eq('contract_id', effectiveId)
                    .order('display_order', { ascending: true })

                if (error || !updatedClauses) return

                // Update clause statuses without replacing entire array (preserves selection)
                setClauses(prev => prev.map(clause => {
                    const updated = updatedClauses.find(u => u.clause_id === clause.clauseId)
                    if (!updated) return clause

                    return {
                        ...clause,
                        processingStatus: updated.status || clause.processingStatus,
                        isHeader: updated.is_header || false,
                        clarenceCertified: updated.clarence_certified || false,
                        clarencePosition: updated.clarence_position,
                        clarenceFairness: updated.clarence_fairness,
                        clarenceSummary: updated.clarence_summary,
                        clarenceAssessment: updated.clarence_assessment,
                        clarenceFlags: updated.clarence_flags || [],
                        clauseText: updated.content || clause.clauseText,
                        originalText: updated.original_text || clause.originalText,
                        extractedValue: updated.extracted_value,
                        extractedUnit: updated.extracted_unit,
                        valueType: updated.value_type,
                    }
                }))

                // Update progress
                const certified = updatedClauses.filter(c => c.status === 'certified' && !c.is_header).length
                const total = updatedClauses.filter(c => !c.is_header).length
                const failed = updatedClauses.filter(c => c.status === 'failed' && !c.is_header).length
                setCertificationProgress({ certified, total, failed })

                // RANGE MAPPING REFRESH: Re-fetch range mappings as they arrive
                // Range mappings are generated per-clause during certification,
                // so we need to keep loading new ones as they appear
                const nonHeaderCount = updatedClauses.filter(c => !c.is_header).length
                const currentMappingCount = rangeMappings.size
                if (currentMappingCount < nonHeaderCount) {
                    const { data: rangeMappingData } = await supabase
                        .from('clause_range_mappings')
                        .select('clause_id, contract_id, is_displayable, value_type, range_unit, industry_standard_min, industry_standard_max, range_data')
                        .eq('contract_id', effectiveId)
                        .eq('is_displayable', true)

                    if (rangeMappingData && rangeMappingData.length > currentMappingCount) {
                        const mappingMap = new Map<string, RangeMapping>()
                        for (const rm of rangeMappingData) {
                            mappingMap.set(rm.clause_id, {
                                clauseId: rm.clause_id,
                                contractId: rm.contract_id,
                                isDisplayable: rm.is_displayable,
                                valueType: rm.value_type,
                                rangeUnit: rm.range_unit,
                                industryStandardMin: rm.industry_standard_min,
                                industryStandardMax: rm.industry_standard_max,
                                rangeData: rm.range_data as RangeMappingData
                            })
                        }
                        setRangeMappings(mappingMap)
                        console.log(`[QC Studio] Range mappings updated: ${rangeMappingData.length} of ${nonHeaderCount} clauses`)
                    }
                }

                // Stop polling when done - must check BOTH status AND clarence_certified
                const stillProcessing = updatedClauses.some(c =>
                    !c.is_header && (
                        c.status === 'pending' ||
                        c.status === 'processing' ||
                        (c.status === 'certified' && !c.clarence_certified)
                    )
                )
                if (!stillProcessing) {
                    setIsPolling(false)
                    clearInterval(pollInterval)

                    // Update welcome message now that all clauses are certified
                    const nonHeaderUpdated = updatedClauses.filter(c => !c.is_header)
                    const certifiedUpdated = nonHeaderUpdated.filter(c => c.clarence_certified).length
                    const totalUpdated = nonHeaderUpdated.length
                    setChatMessages(prev => prev.map(msg =>
                        msg.id === 'welcome'
                            ? {
                                ...msg,
                                content: `Welcome to the Quick Create Studio! I'm CLARENCE, your contract analysis assistant.\n\nI've reviewed the contract and certified ${certifiedUpdated} of ${totalUpdated} clauses.\n\nSelect any clause to see my recommended position and analysis. Feel free to ask me questions about specific clauses or the contract as a whole.`
                            }
                            : msg
                    ))
                }

            } catch (err) {
                console.error('Polling error:', err)
            }
        }, 4000) // Poll every 4 seconds

        return () => clearInterval(pollInterval)
    }, [contractId, resolvedContractId, clauses.length, isPolling, rangeMappings.size])

    // RANGE MAPPING CATCH-UP: After certification polling stops,
    // do a few final fetches to catch trailing range mappings
    // (range mapping fires in parallel with certification chain,
    // so the last few may still be generating when polling stops)
    useEffect(() => {
        const effectiveId = resolvedContractId || contractId
        if (!effectiveId || !clauses.length) return
        if (isPolling) return // Still polling, main loop handles it

        const nonHeaderCount = clauses.filter(c => !c.isHeader).length
        const currentMappingCount = rangeMappings.size

        // All mappings present — nothing to catch up
        if (currentMappingCount >= nonHeaderCount) return

        console.log(`[QC Studio] Range mapping catch-up: have ${currentMappingCount} of ${nonHeaderCount}, fetching stragglers...`)

        let attempts = 0
        const maxAttempts = 8 // Up to ~40 seconds of catch-up

        const catchUpInterval = setInterval(async () => {
            attempts++
            try {
                const { data: rangeMappingData } = await supabase
                    .from('clause_range_mappings')
                    .select('clause_id, contract_id, is_displayable, value_type, range_unit, industry_standard_min, industry_standard_max, range_data')
                    .eq('contract_id', effectiveId)
                    .eq('is_displayable', true)

                if (rangeMappingData && rangeMappingData.length > rangeMappings.size) {
                    const mappingMap = new Map<string, RangeMapping>()
                    for (const rm of rangeMappingData) {
                        mappingMap.set(rm.clause_id, {
                            clauseId: rm.clause_id,
                            contractId: rm.contract_id,
                            isDisplayable: rm.is_displayable,
                            valueType: rm.value_type,
                            rangeUnit: rm.range_unit,
                            industryStandardMin: rm.industry_standard_min,
                            industryStandardMax: rm.industry_standard_max,
                            rangeData: rm.range_data as RangeMappingData
                        })
                    }
                    setRangeMappings(mappingMap)
                    console.log(`[QC Studio] Catch-up: ${rangeMappingData.length} of ${nonHeaderCount} range mappings loaded`)

                    // All caught up — stop
                    if (rangeMappingData.length >= nonHeaderCount) {
                        console.log('[QC Studio] All range mappings loaded')
                        clearInterval(catchUpInterval)
                    }
                }

                // Give up after max attempts
                if (attempts >= maxAttempts) {
                    console.log(`[QC Studio] Catch-up complete after ${attempts} attempts (${rangeMappings.size} mappings)`)
                    clearInterval(catchUpInterval)
                }

            } catch (err) {
                console.error('Range mapping catch-up error:', err)
                clearInterval(catchUpInterval)
            }
        }, 5000) // Every 5 seconds

        return () => clearInterval(catchUpInterval)
    }, [contractId, resolvedContractId, clauses.length, isPolling, rangeMappings.size])

    // ========================================================================
    // SECTION 5B: INVITE HANDLER
    // ========================================================================

    const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

    async function handleSendInvite() {
        if (!userInfo || !contract) return
        if (!inviteEmail.trim() || !inviteName.trim()) return

        setSendingInvite(true)

        try {
            const response = await fetch(`${API_BASE}/qc-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contract_id: contract.contractId,
                    contract_name: contract.contractName,
                    contract_type: contract.contractType || 'other',
                    initiator_user_id: userInfo.userId,
                    initiator_company_id: userInfo.companyId,
                    initiator_email: userInfo.email,
                    initiator_name: userInfo.fullName,
                    initiator_company: userInfo.companyName || '',
                    recipient_email: inviteEmail.trim(),
                    recipient_name: inviteName.trim(),
                    recipient_company: inviteCompany?.trim() || '',
                    personal_message: inviteMessage?.trim() || '',
                    mediation_type: 'stc'
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to send invite: ${response.status}`)
            }

            const result = await response.json()
            console.log('Invite sent:', result)

            setInviteSuccess(true)
            setInviteSent(true)  // Persists after modal closes

            setRespondentStatus('pending')

            // Also update respondent info from what was just entered
            setRespondentInfo({
                name: inviteName.trim(),
                company: inviteCompany?.trim() || null,
                isOnline: false
            })

            // Reset modal after 3 seconds (but inviteSent stays true)
            setTimeout(() => {
                setShowInviteModal(false)
                setInviteSuccess(false)
                setInviteName('')
                setInviteEmail('')
                setInviteCompany('')
                setInviteMessage('')
            }, 2500)

        } catch (err) {
            console.error('Invite error:', err)
            alert(err instanceof Error ? err.message : 'Failed to send invite')
        } finally {
            setSendingInvite(false)
        }
    }

    // ========================================================================
    // SECTION 5: LOADING STATE
    // ========================================================================

    if (loading) {
        return <QuickContractStudioLoading />
    }


    // ========================================================================
    // SECTION 6: ERROR STATE
    // ========================================================================

    if (error) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Contract</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={() => {
                            // Role-aware routing: providers go to /provider, customers to /auth/quick-contract
                            // At error state, contract may not be loaded so check localStorage
                            let isProvider = false
                            try {
                                const auth = localStorage.getItem('clarence_auth')
                                if (auth) {
                                    const parsed = JSON.parse(auth)
                                    isProvider = parsed?.userInfo?.role === 'provider'
                                }
                            } catch { /* ignore */ }
                            if (isProvider) {
                                window.location.href = '/provider'
                            } else {
                                router.push('/auth/quick-contract')
                            }
                        }}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7: MAIN LAYOUT RENDER
    // ========================================================================

    // Position parties by ROLE, not by initiator/respondent.
    // Provider (blue) always LEFT — matches position 1 on the bar.
    // Customer (emerald) always RIGHT — matches position 10 on the bar.
    const userIsProvider = roleContext?.userPartyRole === 'providing'
    const isUserInitiator = getPartyRole() === 'initiator'

    // When the user's role matches their initiator status, initiatorInfo = provider side
    const initiatorIsProvider = userIsProvider === isUserInitiator
    const providerPartyInfo = initiatorIsProvider ? initiatorInfo : respondentInfo
    const customerPartyInfo = initiatorIsProvider ? respondentInfo : initiatorInfo
    const providerLabel = roleContext?.providingPartyLabel || 'Provider'
    const customerLabel = roleContext?.protectedPartyLabel || 'Customer'

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">


            {/* ============================================================ */}
            {/* SECTION 7A: HEADER */}
            {/* ============================================================ */}
            <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TIER 1: Navigation Bar                                 */}
                {/* Back (left) | Title (centre) | Actions (right)         */}
                {/* ═══════════════════════════════════════════════════════ */}
                <div className="relative flex items-center justify-between px-4 py-2">

                    {/* LEFT: Back + Logo */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => {
                                if (isTemplateMode) {
                                    router.push(isCompanyTemplate ? '/auth/company-admin' : '/auth/contracts')
                                } else if (getPartyRole() === 'respondent') {
                                    window.location.href = '/provider'
                                } else {
                                    router.push('/auth/quick-contract')
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Back"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => {
                                if (getPartyRole() === 'respondent') {
                                    window.location.href = '/provider'
                                } else {
                                    router.push('/auth/contracts-dashboard')
                                }
                            }}
                            className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-md hover:from-purple-600 hover:to-purple-800 transition-all flex-shrink-0"
                            title="Back to dashboard"
                        >
                            <span className="text-white font-bold text-sm">C</span>
                        </button>
                    </div>

                    {/* CENTRE: Document Title — absolutely positioned for true page centre */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center max-w-md pointer-events-none">
                        <h1 className="font-semibold text-slate-800 text-sm truncate" title={contract?.contractName}>
                            {contract?.contractName}
                        </h1>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            {isTemplateMode
                                ? (isCompanyTemplate ? 'Company Template Certification' : 'Template Certification')
                                : 'Quick Create Studio'}
                            {' · '}{contract?.contractType}
                            {' · '}{clauses.filter(c => !c.isHeader).length} clauses
                        </p>
                    </div>

                    {/* RIGHT: Action Buttons (standardised sizing) */}
                    <div className="flex items-center gap-2 flex-shrink-0">

                        <FeedbackButton position="header" />

                        {/* Contract Lifecycle Button (non-template, initiator) */}
                        {!isTemplateMode && isInitiator && (() => {
                            if (contract?.status === 'committed') {
                                return (
                                    <button
                                        onClick={() => router.push('/auth/document-centre?contract_id=' + contract.contractId)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Document Centre
                                    </button>
                                )
                            }

                            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                            const allBothAgreed = leafClauses.length > 0 && leafClauses.every(c => isBothPartiesAgreed(c.clauseId))
                            if (allBothAgreed) {
                                return (
                                    <button
                                        onClick={() => setCommitModalState('confirm')}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 animate-pulse"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Commit Contract
                                    </button>
                                )
                            }

                            if (respondentInfo) {
                                return (
                                    <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-default">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                        Active
                                    </div>
                                )
                            }

                            if (inviteSent) {
                                return (
                                    <div className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-default">
                                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Invite Pending
                                    </div>
                                )
                            }

                            return (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    Invite
                                </button>
                            )
                        })()}

                        {/* Request Sign-off Button (non-template, initiator, not committed) */}
                        {!isTemplateMode && isInitiator && contract?.status !== 'committed' && (
                            doaContractApprovalStatus === 'pending' ? (
                                <span className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                    Sign-off Pending
                                </span>
                            ) : doaContractApprovalStatus === 'approved' ? (
                                <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Signed Off
                                </span>
                            ) : (
                                <button
                                    onClick={() => setShowContractApprovalModal(true)}
                                    className="px-3 py-2 border border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 rounded-lg transition-colors text-sm font-medium"
                                >
                                    Request Sign-off
                                </button>
                            )
                        )}

                        {/* Contract Lifecycle Button (non-template, respondent) */}
                        {!isTemplateMode && !isInitiator && (() => {
                            if (contract?.status === 'committed') {
                                return (
                                    <button
                                        onClick={() => router.push('/auth/document-centre?contract_id=' + contract.contractId)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Document Centre
                                    </button>
                                )
                            }

                            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                            const allBothAgreed = leafClauses.length > 0 && leafClauses.every(c => isBothPartiesAgreed(c.clauseId))
                            if (allBothAgreed) {
                                return (
                                    <button
                                        onClick={() => setCommitModalState('confirm')}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 animate-pulse"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Commit Contract
                                    </button>
                                )
                            }

                            return null
                        })()}

                        {/* Save as Template (template mode only) */}
                        {isTemplateMode && (() => {
                            const leafClauses = clauses.filter(c => !c.isHeader)
                            const certifiedCount = leafClauses.filter(c => c.clarenceCertified).length
                            const failedCount = leafClauses.filter(c => c.processingStatus === 'failed').length
                            const allCertified = leafClauses.length > 0 && certifiedCount === leafClauses.length
                            const allSettled = leafClauses.length > 0 && (certifiedCount + failedCount) === leafClauses.length
                            const isReady = !isPolling && (allCertified || allSettled)

                            return (
                                <button
                                    onClick={() => setShowSaveTemplateModal(true)}
                                    disabled={templateSaved || !isReady}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 ${templateSaved
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                        : isReady
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    title={
                                        templateSaved
                                            ? 'Template already saved'
                                            : isPolling
                                                ? 'Waiting for certification to complete...'
                                                : !isReady
                                                    ? `${certifiedCount}/${leafClauses.length} clauses certified — waiting for all`
                                                    : failedCount > 0
                                                        ? `Save template (${failedCount} failed clause${failedCount !== 1 ? 's' : ''} will be excluded)`
                                                        : 'Save this contract as a reusable template'
                                    }
                                >
                                    {templateSaved ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {editTemplateId ? 'Template Updated' : 'Template Saved'}
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            {editTemplateId ? 'Update Template' : 'Save as Template'}
                                        </>
                                    )}
                                </button>
                            )
                        })()}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TIER 2: Negotiation Bar (non-template only)            */}
                {/* Provider/blue (left) | Chat | Customer/emerald (right) */}
                {/* Matches position bar: blue←provider | customer→emerald */}
                {/* ═══════════════════════════════════════════════════════ */}
                {!isTemplateMode && (
                    <div className="relative flex items-center px-4 py-2 border-t border-slate-100 bg-slate-50/50">

                        {/* LEFT half: Provider (blue) — always matches position 1 on the bar */}
                        <div className="flex-1 flex justify-end pr-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${providerPartyInfo ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                <span className="text-xs font-medium text-blue-800">
                                    {providerPartyInfo?.company || providerPartyInfo?.name || (userIsProvider ? userInfo?.companyName : null) || 'Awaiting Respondent'}
                                </span>
                                <span className="text-xs text-blue-600">· {providerLabel}</span>
                                {userIsProvider && (
                                    <span className="text-[10px] text-blue-400 font-medium">(You)</span>
                                )}
                            </div>
                        </div>

                        {/* CENTRE: Party Chat Toggle — anchored at exact centre */}
                        <div className="flex-shrink-0">
                            <button
                                onClick={() => setPartyChatOpen(!partyChatOpen)}
                                className="relative p-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full transition shadow-sm group"
                                title={`Chat with ${getOtherPartyName()}`}
                            >
                                <svg
                                    className="w-5 h-5 text-slate-500 group-hover:text-emerald-600 transition"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                    />
                                </svg>
                                {partyChatUnread > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {partyChatUnread > 9 ? '9+' : partyChatUnread}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* RIGHT half: Customer (emerald) — always matches position 10 on the bar */}
                        <div className="flex-1 flex justify-start pl-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${customerPartyInfo ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span className="text-xs font-medium text-emerald-800">
                                    {customerPartyInfo?.company || customerPartyInfo?.name || (!userIsProvider ? userInfo?.companyName : null) || 'Awaiting Respondent'}
                                </span>
                                <span className="text-xs text-emerald-600">· {customerLabel}</span>
                                {!userIsProvider && (
                                    <span className="text-[10px] text-emerald-400 font-medium">(You)</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TIER 3: Status Bar (non-template only)                 */}
                {/* Agreement Progress (left) | Contract Balance (right)    */}
                {/* ═══════════════════════════════════════════════════════ */}
                {!isTemplateMode && (
                    <div className="relative flex items-center justify-between px-4 py-1.5 border-t border-slate-100">

                        {/* LEFT: Agreement Progress */}
                        {clauses.length > 0 && (() => {
                            const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                            const fullyAgreedCount = leafClauses.filter(c => isBothPartiesAgreed(c.clauseId)).length
                            const partiallyAgreedCount = leafClauses.filter(c => isAnyPartyAgreed(c.clauseId) && !isBothPartiesAgreed(c.clauseId)).length
                            const totalCount = leafClauses.length
                            const allFullyAgreed = fullyAgreedCount === totalCount && totalCount > 0
                            const progressPercent = totalCount > 0 ? (fullyAgreedCount / totalCount) * 100 : 0
                            const partialPercent = totalCount > 0 ? ((fullyAgreedCount + partiallyAgreedCount) / totalCount) * 100 : 0

                            return (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className={`text-xs font-medium ${allFullyAgreed ? 'text-emerald-600' : 'text-slate-600'}`}>
                                            {fullyAgreedCount}/{totalCount} Agreed
                                        </span>
                                        {partiallyAgreedCount > 0 && (
                                            <span className="text-xs text-amber-500">
                                                ({partiallyAgreedCount} pending)
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-36 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                                        <div
                                            className="absolute h-full rounded-full bg-amber-300 transition-all duration-500"
                                            style={{ width: `${partialPercent}%` }}
                                        />
                                        <div
                                            className={`absolute h-full rounded-full transition-all duration-500 ${allFullyAgreed ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })()}

                        {/* CENTRE: Playbook Compliance Badge (absolutely centred on page) */}
                        {isInitiator && playbookCompliance && !playbookLoading && (
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                            <button
                                onClick={() => setShowComplianceModal(true)}
                                className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                                    playbookCompliance.redLineBreaches > 0
                                        ? 'bg-red-50 border-red-200 hover:bg-red-100'
                                        : playbookCompliance.overallScore >= 80
                                            ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                            : playbookCompliance.overallScore >= 60
                                                ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                                                : 'bg-red-50 border-red-200 hover:bg-red-100'
                                }`}
                                title="View playbook compliance details"
                            >
                                {playbookCompliance.redLineBreaches > 0 ? (
                                    <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                ) : (
                                    <svg className={`w-4 h-4 ${
                                        playbookCompliance.overallScore >= 80 ? 'text-emerald-500'
                                            : playbookCompliance.overallScore >= 60 ? 'text-amber-500'
                                                : 'text-red-500'
                                    }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        <path d="M9 12l2 2 4-4" />
                                    </svg>
                                )}
                                <span className={`text-xs font-bold font-mono ${
                                    playbookCompliance.overallScore >= 80 ? 'text-emerald-600'
                                        : playbookCompliance.overallScore >= 60 ? 'text-amber-600'
                                            : 'text-red-600'
                                }`}>
                                    {playbookCompliance.overallScore}%
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">Playbook</span>
                                {playbookCompliance.redLineBreaches > 0 && (
                                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                        {playbookCompliance.redLineBreaches} breach{playbookCompliance.redLineBreaches !== 1 ? 'es' : ''}
                                    </span>
                                )}
                            </button>
                            </div>
                        )}

                        {/* RIGHT: Aggregate Balance Score */}
                        {aggregateBalance !== null && (() => {
                            const score = aggregateBalance.score
                            const colors = getBalanceColor(score)
                            const gaugePercent = positionToPercent(score)

                            return (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                        </svg>
                                        <span className="text-xs font-medium text-slate-600">
                                            Contract Balance
                                        </span>
                                    </div>
                                    <span className={`text-xs font-bold ${colors.text}`}>
                                        {score.toFixed(1)}
                                    </span>
                                    <div className="relative w-24 h-2 bg-gradient-to-r from-blue-200 via-teal-200 to-emerald-200 rounded-full">
                                        <div
                                            className="absolute top-0 w-px h-full bg-slate-400"
                                            style={{ left: '50%' }}
                                        />
                                        <div
                                            className={`absolute top-1/2 w-3 h-3 rounded-full ${colors.bg} border-2 border-white shadow-sm transition-all duration-500`}
                                            style={{
                                                left: `${gaugePercent}%`,
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        />
                                    </div>
                                    <span className={`text-[10px] ${colors.text}`}>
                                        {getBalanceLabel(score)}
                                    </span>
                                </div>
                            )
                        })()}
                    </div>
                )}
            </header>


            {/* ============================================================ */}
            {/* SECTION 7B: 3-PANEL LAYOUT */}
            {/* ============================================================ */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* ======================================================== */}
                {/* LEFT PANEL: Clause Navigation */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden min-h-0">

                    {/* ==================== CERTIFICATION PROGRESS (during polling) ==================== */}
                    {isPolling && (
                        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-emerald-50 flex-shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-teal-700">
                                    Certifying clauses...
                                </span>
                                <span className="text-xs text-teal-600">
                                    {certificationProgress.certified}/{certificationProgress.total}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-teal-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-teal-500 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${certificationProgress.total > 0
                                            ? (certificationProgress.certified / certificationProgress.total) * 100
                                            : 0}%`
                                    }}
                                />
                            </div>
                            {certificationProgress.failed > 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    {certificationProgress.failed} clause(s) failed — will retry when done
                                </p>
                            )}
                        </div>
                    )}

                    {/* ==================== FAILED CLAUSES BANNER (persistent, after polling) ==================== */}
                    {!isPolling && certificationProgress.failed > 0 && (
                        <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-red-50 flex-shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-red-700">
                                    {certificationProgress.failed} clause{certificationProgress.failed !== 1 ? 's' : ''} failed certification
                                </span>
                                <button
                                    onClick={() => retryFailedClauses()}
                                    disabled={retryInProgress}
                                    className="text-xs font-medium px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-md transition-colors flex items-center gap-1"
                                >
                                    {retryInProgress ? (
                                        <>
                                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Retrying...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Retry All
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                                {clauses
                                    .filter(c => !c.isHeader && c.processingStatus === 'failed')
                                    .map(c => (
                                        <div key={c.clauseId} className="flex items-center gap-1.5 text-xs text-red-600">
                                            <span className="text-red-400">{'\u26A0\uFE0F'}</span>
                                            <span className="truncate">{c.clauseNumber}. {c.clauseName}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* ==================== RE-ANALYSE BUTTON (after certification complete) ==================== */}
                    {!isPolling && certificationProgress.failed === 0 && certificationProgress.certified > 0 && (
                        <div className="px-4 py-2 border-b border-slate-200 flex-shrink-0">
                            <button
                                onClick={handleRecertifyAll}
                                disabled={recertifyInProgress}
                                className="w-full text-xs font-medium px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:text-slate-300 rounded-md transition-colors flex items-center justify-center gap-1.5"
                            >
                                {recertifyInProgress ? (
                                    <>
                                        <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                        Re-analysing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Re-analyse All Clauses
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* ==================== SCHEDULE DETECTION SUMMARY ==================== */}
                    {(detectedSchedules.length > 0 || scheduleDetectionStatus === 'complete') && contract?.contractTypeKey && (
                        <div className="border-b border-slate-200 flex-shrink-0">
                            <button
                                onClick={() => setSchedulePanelOpen(!schedulePanelOpen)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-xs font-medium text-slate-700">
                                        Schedules ({detectedSchedules.length})
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(() => {
                                        const required = getRequiredSchedules(contract.contractTypeKey || '')
                                        const missingRequired = required.filter(r => !detectedSchedules.find(d => d.schedule_type === r.scheduleType))
                                        if (missingRequired.length > 0) {
                                            return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">{missingRequired.length} missing</span>
                                        }
                                        if (detectedSchedules.length > 0) {
                                            return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">All found</span>
                                        }
                                        return null
                                    })()}
                                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${schedulePanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>
                            {schedulePanelOpen && (
                                <div className="px-3 pb-2 space-y-1">
                                    {(() => {
                                        const expectations = buildScheduleExpectations(contract.contractTypeKey || '', detectedSchedules as any)
                                        return expectations.map(exp => {
                                            const isClickable = !!exp.detected && !!exp.detectedSchedule
                                            const isSelected = isClickable && selectedScheduleId === exp.detectedSchedule?.schedule_id
                                            return (
                                                <div
                                                    key={exp.scheduleType}
                                                    onClick={isClickable ? () => handleScheduleClick(exp.detectedSchedule!.schedule_id) : undefined}
                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                                                        isSelected
                                                            ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                                                            : exp.detected
                                                                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                                                                : exp.isRequired
                                                                    ? 'bg-red-50 text-red-700'
                                                                    : 'bg-slate-50 text-slate-500'
                                                    }`}
                                                >
                                                    {exp.detected ? (
                                                        <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className={`w-3.5 h-3.5 ${exp.isRequired ? 'text-red-500' : 'text-slate-400'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    )}
                                                    <span className="flex-1 truncate">{exp.scheduleLabel}</span>
                                                    {exp.isRequired && !exp.detected && (
                                                        <span className="text-[10px] font-medium text-red-600">Required</span>
                                                    )}
                                                    {exp.detectedSchedule?.checklist_score != null && (
                                                        <span className={`text-[10px] font-medium ${exp.detectedSchedule.checklist_score >= 80 ? 'text-emerald-600' : exp.detectedSchedule.checklist_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                            {Math.round(exp.detectedSchedule.checklist_score)}%
                                                        </span>
                                                    )}
                                                    {exp.detectedSchedule && !exp.detectedSchedule.checklist_score && exp.detectedSchedule.confidence_score != null && (
                                                        <span className="text-[10px] text-emerald-600">{Math.round(exp.detectedSchedule.confidence_score * 100)}%</span>
                                                    )}
                                                </div>
                                            )
                                        })
                                    })()}

                                    {/* Schedule Checklist Panel */}
                                    {selectedScheduleId && (() => {
                                        const selectedSchedule = detectedSchedules.find(s => s.schedule_id === selectedScheduleId)
                                        if (!selectedSchedule) return null
                                        return (
                                            <div className="mt-2 border border-indigo-200 rounded-lg bg-white overflow-hidden">
                                                <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[11px] font-bold text-indigo-800">{selectedSchedule.schedule_label}</span>
                                                        {checklistScore != null && (
                                                            <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${checklistScore >= 80 ? 'bg-emerald-100 text-emerald-700' : checklistScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                                {Math.round(checklistScore)}% complete
                                                            </span>
                                                        )}
                                                    </div>
                                                    {resolvedContractId && (
                                                        <button
                                                            onClick={() => triggerChecklist(resolvedContractId, selectedScheduleId)}
                                                            disabled={checklistLoading}
                                                            className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {checklistLoading ? 'Checking...' : checklistResults.length > 0 ? 'Re-check' : 'Run Checklist'}
                                                        </button>
                                                    )}
                                                </div>

                                                {checklistLoading && (
                                                    <div className="px-3 py-4 flex items-center justify-center">
                                                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
                                                        <span className="text-[11px] text-slate-500">Analysing schedule...</span>
                                                    </div>
                                                )}

                                                {!checklistLoading && checklistResults.length > 0 && (
                                                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                                                        {checklistResults.map(item => {
                                                            const effectiveResult = item.manual_override || item.check_result
                                                            return (
                                                                <div key={item.result_id} className="px-3 py-1.5 flex items-start gap-2">
                                                                    {effectiveResult === 'present' ? (
                                                                        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    ) : effectiveResult === 'partial' ? (
                                                                        <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[11px] text-slate-700 leading-tight">{item.check_question}</p>
                                                                        {item.ai_evidence && (
                                                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate italic">{item.ai_evidence}</p>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-[9px] font-medium flex-shrink-0 px-1 py-0.5 rounded ${
                                                                        effectiveResult === 'present' ? 'bg-emerald-50 text-emerald-600'
                                                                        : effectiveResult === 'partial' ? 'bg-amber-50 text-amber-600'
                                                                        : 'bg-red-50 text-red-600'
                                                                    }`}>
                                                                        {item.check_category}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                {!checklistLoading && checklistResults.length === 0 && (
                                                    <div className="px-3 py-3 text-center">
                                                        <p className="text-[11px] text-slate-400">No checklist results yet.</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Click &quot;Run Checklist&quot; to analyse this schedule.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==================== BULK SELECT ACTION BAR ==================== */}
                    {bulkSelectedIds.size > 0 && (
                        <div className="px-3 py-2.5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 flex-shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-emerald-800">
                                    {bulkSelectedIds.size} clause{bulkSelectedIds.size !== 1 ? 's' : ''} selected
                                </span>
                                <button
                                    onClick={clearBulkSelection}
                                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleBulkAgree}
                                    disabled={bulkAgreeInProgress}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors"
                                >
                                    {bulkAgreeInProgress ? (
                                        <>
                                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Agreeing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Agree Selected ({bulkSelectedIds.size})
                                        </>
                                    )}
                                </button>
                            </div>
                            {/* Smart select shortcuts */}
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={selectAllEligible}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={selectAllBalanced}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                                >
                                    Select Balanced (5.0)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Clause tree header — always visible */}
                    {clauses.length > 0 && bulkSelectedIds.size === 0 && (
                        <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">
                                    Clauses ({clauses.filter(c => !c.isHeader).length})
                                </span>
                                {/* Quick select triggers — only when there are unagreed clauses */}
                                {clauses.filter(c => !c.isHeader && c.clarenceCertified && !hasCurrentUserAgreed(c.clauseId)).length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={selectAllEligible}
                                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                        >
                                            All unagreed
                                        </button>
                                        <button
                                            onClick={selectAllBalanced}
                                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                        >
                                            Balanced (5.0)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* ==================== CLAUSE TREE ==================== */}
                    <div ref={clauseListRef} className="flex-1 overflow-y-auto">
                        {/* Waiting for clauses to arrive */}
                        {clauses.length === 0 && contract && ['processing', 'certifying', 'uploading', 'pending'].includes(contract.status) && (
                            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-4">
                                    <div className="w-6 h-6 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                                <h3 className="text-sm font-medium text-slate-700 mb-2">Processing Document</h3>
                                <p className="text-xs text-slate-500 mb-4">
                                    CLARENCE is extracting and analyzing clauses from your document. This may take a few minutes for larger contracts.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                                    Scanning for clause structure...
                                </div>
                            </div>
                        )}

                        {/* No clauses found after processing */}
                        {clauses.length === 0 && contract && !['processing', 'certifying', 'uploading', 'pending'].includes(contract.status) && (
                            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-medium text-slate-700 mb-2">No Clauses Found</h3>
                                <p className="text-xs text-slate-500 mb-4">
                                    Unable to extract clauses from this document. The document may be in an unsupported format or contain no recognizable clause structure.
                                </p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                                >
                                    Refresh Page
                                </button>
                            </div>
                        )}

                        {/* Normal clause tree rendering */}
                        {clauses.length > 0 && (() => {
                            // Build parent-child tree
                            const parentMap = new Map<string, ContractClause[]>()
                            const topLevel: ContractClause[] = []

                            filteredClauses.forEach(clause => {
                                if (clause.parentClauseId) {
                                    const siblings = parentMap.get(clause.parentClauseId) || []
                                    siblings.push(clause)
                                    parentMap.set(clause.parentClauseId, siblings)
                                } else {
                                    topLevel.push(clause)
                                }
                            })

                            // Status icon helper
                            const StatusIcon = ({ status }: { status: string }) => {
                                switch (status) {
                                    case 'certified':
                                        return <span className="text-emerald-500 text-xs">{'\u2705'}</span>
                                    case 'processing':
                                        return (
                                            <span className="inline-block w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                        )
                                    case 'failed':
                                        return <span className="text-red-500 text-xs">{'\u26A0\uFE0F'}</span>
                                    default: // pending
                                        return <span className="text-slate-300 text-xs">{'\u{1F552}'}</span>
                                }
                            }

                            return topLevel.map(parent => {
                                const children = parentMap.get(parent.clauseId) || []
                                const isSection = children.length > 0  // Has children = section header
                                const isExpanded = expandedSections.has(parent.clauseId)

                                if (isSection) {
                                    // ---- SECTION HEADER (collapsible) ----
                                    const certifiedChildren = children.filter(c => c.processingStatus === 'certified').length
                                    const processingChild = children.find(c => c.processingStatus === 'processing')

                                    return (
                                        <div key={parent.clauseId}>
                                            {/* Section Header */}
                                            <button
                                                onClick={() => {
                                                    setExpandedSections(prev => {
                                                        const next = new Set(prev)
                                                        if (next.has(parent.clauseId)) {
                                                            next.delete(parent.clauseId)
                                                        } else {
                                                            next.add(parent.clauseId)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                                            >
                                                <svg
                                                    className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    fill="currentColor" viewBox="0 0 20 20"
                                                >
                                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                </svg>
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1 truncate text-left">
                                                    {parent.clauseNumber}. {parent.clauseName}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {certifiedChildren}/{children.length}
                                                </span>
                                                {processingChild && (
                                                    <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                                                )}
                                            </button>

                                            {/* Children */}
                                            {isExpanded && children.map(child => {
                                                const isClickable = child.processingStatus === 'certified' || child.processingStatus === 'failed'
                                                const isSelected = selectedClause?.clauseId === child.clauseId
                                                const isMenuOpen = clauseMenuOpen === child.clauseId

                                                return (
                                                    <div key={child.clauseId} className="relative group">
                                                        <div className={`w-full flex items-center gap-1 pl-2 pr-8 py-2 text-left transition-colors ${isSelected
                                                            ? 'bg-teal-50 border-l-2 border-teal-500'
                                                            : isClickable
                                                                ? 'hover:bg-slate-50 border-l-2 border-transparent'
                                                                : 'opacity-50 border-l-2 border-transparent'
                                                            }`}
                                                        >
                                                            {/* Bulk select checkbox — only when eligible for agreement */}
                                                            {child.clarenceCertified && !hasCurrentUserAgreed(child.clauseId) && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={bulkSelectedIds.has(child.clauseId)}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation()
                                                                        toggleBulkSelect(child.clauseId)
                                                                    }}
                                                                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-1 cursor-pointer flex-shrink-0"
                                                                />
                                                            )}
                                                            <button
                                                                onClick={() => isClickable && setSelectedClauseIndex(clauses.findIndex(c => c.clauseId === child.clauseId))}
                                                                disabled={!isClickable}
                                                                className="flex items-center gap-1.5 flex-1 min-w-0"
                                                            >
                                                                <StatusIcon status={child.processingStatus} />
                                                                <div className="flex-1 min-w-0 text-left truncate">
                                                                    <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : 'text-slate-500'}`}>
                                                                        {child.clauseNumber}
                                                                    </span>
                                                                    {' '}
                                                                    <span className={`text-sm ${isSelected ? 'text-teal-800 font-medium' : 'text-slate-700'}`}>
                                                                        {child.clauseName}
                                                                    </span>
                                                                </div>
                                                                {child.clarenceCertified && child.clarencePosition && (
                                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${child.clarencePosition > 5.5 ? 'bg-emerald-100 text-emerald-700' :
                                                                        child.clarencePosition >= 4.5 ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-blue-100 text-blue-700'
                                                                        }`}>
                                                                        {child.clarencePosition.toFixed(1)}
                                                                    </span>
                                                                )}
                                                                {/* Playbook compliance dot */}
                                                                {(() => {
                                                                    const s = clausePlaybookStatus.get(child.clauseId)
                                                                    if (!s) return null
                                                                    return (
                                                                        <span
                                                                            className={`w-2 h-2 rounded-full flex-shrink-0 ${s === 'breach' ? 'bg-red-500' : s === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                                            title={s === 'breach' ? 'Playbook breach' : s === 'warning' ? 'Below playbook ideal' : 'Playbook compliant'}
                                                                        />
                                                                    )
                                                                })()}
                                                                {/* Agreement/Query status indicator - Dual party tracking */}
                                                                {(() => {
                                                                    const status = getAgreementStatus(child.clauseId)
                                                                    if (status === 'both') {
                                                                        return (
                                                                            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Both parties agreed">
                                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            </span>
                                                                        )
                                                                    }
                                                                    if (status === 'you_only') {
                                                                        return (
                                                                            <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0" title={`You agreed - awaiting ${getOtherPartyName()}`}>
                                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            </span>
                                                                        )
                                                                    }
                                                                    if (status === 'other_only') {
                                                                        return (
                                                                            <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title={`${getOtherPartyName()} agreed - awaiting you`}>
                                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                                                                </svg>
                                                                            </span>
                                                                        )
                                                                    }
                                                                    return null
                                                                })()}
                                                                {queriedClauseIds.has(child.clauseId) && (
                                                                    <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Query pending">
                                                                        <span className="text-white text-[9px] font-bold">?</span>
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* 3-dot kebab menu - Initiator Only */}
                                                        {isInitiator && (
                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setClauseMenuOpen(isMenuOpen ? null : child.clauseId)
                                                                    }}
                                                                    className={`p-1 rounded hover:bg-slate-200 transition-colors ${isMenuOpen ? 'bg-slate-200' : 'opacity-0 group-hover:opacity-100'}`}
                                                                    title="Clause options"
                                                                >
                                                                    <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                                    </svg>
                                                                </button>

                                                                {/* Dropdown menu */}
                                                                {isMenuOpen && (
                                                                    <div
                                                                        ref={clauseMenuRef}
                                                                        className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
                                                                    >
                                                                        {child.processingStatus === 'failed' && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    setClauseMenuOpen(null)
                                                                                    retryFailedClauses([child.clauseId])
                                                                                }}
                                                                                disabled={retryingClauses.has(child.clauseId)}
                                                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                                                                            >
                                                                                {retryingClauses.has(child.clauseId) ? (
                                                                                    <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                                                ) : (
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                                    </svg>
                                                                                )}
                                                                                Retry Certification
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleDeleteClauseClick(child)
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                            Delete Clause
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                } else {
                                    // ---- STANDALONE CLAUSE (no children) ----
                                    const isClickable = parent.processingStatus === 'certified' || parent.processingStatus === 'failed'
                                    const isSelected = selectedClause?.clauseId === parent.clauseId
                                    const isMenuOpen = clauseMenuOpen === parent.clauseId

                                    return (
                                        <div key={parent.clauseId} className="relative group">
                                            <div className={`w-full flex items-center gap-1 px-2 pr-8 py-2 text-left transition-colors ${isSelected
                                                ? 'bg-teal-50 border-l-2 border-teal-500'
                                                : isClickable
                                                    ? 'hover:bg-slate-50 border-l-2 border-transparent'
                                                    : 'opacity-50 border-l-2 border-transparent'
                                                }`}
                                            >
                                                {/* Bulk select checkbox — only when eligible for agreement */}
                                                {parent.clarenceCertified && !hasCurrentUserAgreed(parent.clauseId) && (
                                                    <input
                                                        type="checkbox"
                                                        checked={bulkSelectedIds.has(parent.clauseId)}
                                                        onChange={(e) => {
                                                            e.stopPropagation()
                                                            toggleBulkSelect(parent.clauseId)
                                                        }}
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-1 cursor-pointer flex-shrink-0"
                                                    />
                                                )}
                                                <button
                                                    onClick={() => isClickable && setSelectedClauseIndex(clauses.findIndex(c => c.clauseId === parent.clauseId))}
                                                    disabled={!isClickable}
                                                    className="flex items-center gap-1.5 flex-1 min-w-0"
                                                >
                                                    <StatusIcon status={parent.processingStatus} />
                                                    <div className="flex-1 min-w-0 text-left truncate">
                                                        <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : 'text-slate-500'}`}>
                                                            {parent.clauseNumber}.
                                                        </span>
                                                        {' '}
                                                        <span className={`text-sm ${isSelected ? 'text-teal-800 font-medium' : 'text-slate-700'}`}>
                                                            {parent.clauseName}
                                                        </span>
                                                    </div>
                                                    {parent.clarenceCertified && parent.clarencePosition && (
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${parent.clarencePosition > 5.5 ? 'bg-emerald-100 text-emerald-700' :
                                                            parent.clarencePosition >= 4.5 ? 'bg-amber-100 text-amber-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {parent.clarencePosition.toFixed(1)}
                                                        </span>
                                                    )}
                                                    {/* Playbook compliance dot */}
                                                    {(() => {
                                                        const s = clausePlaybookStatus.get(parent.clauseId)
                                                        if (!s) return null
                                                        return (
                                                            <span
                                                                className={`w-2 h-2 rounded-full flex-shrink-0 ${s === 'breach' ? 'bg-red-500' : s === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                                title={s === 'breach' ? 'Playbook breach' : s === 'warning' ? 'Below playbook ideal' : 'Playbook compliant'}
                                                            />
                                                        )
                                                    })()}
                                                    {/* Agreement/Query status indicator - Dual party tracking */}
                                                    {(() => {
                                                        const status = getAgreementStatus(parent.clauseId)
                                                        if (status === 'both') {
                                                            return (
                                                                <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0" title="Both parties agreed">
                                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </span>
                                                            )
                                                        }
                                                        if (status === 'you_only') {
                                                            return (
                                                                <span className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0" title={`You agreed - awaiting ${getOtherPartyName()}`}>
                                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </span>
                                                            )
                                                        }
                                                        if (status === 'other_only') {
                                                            return (
                                                                <span className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title={`${getOtherPartyName()} agreed - awaiting you`}>
                                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                                                    </svg>
                                                                </span>
                                                            )
                                                        }
                                                        return null
                                                    })()}
                                                    {queriedClauseIds.has(parent.clauseId) && (
                                                        <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0" title="Query pending">
                                                            <span className="text-white text-[9px] font-bold">?</span>
                                                        </span>
                                                    )}
                                                </button>
                                            </div>

                                            {/* 3-dot kebab menu - Initiator Only */}
                                            {isInitiator && (
                                                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setClauseMenuOpen(isMenuOpen ? null : parent.clauseId)
                                                        }}
                                                        className={`p-1 rounded hover:bg-slate-200 transition-colors ${isMenuOpen ? 'bg-slate-200' : 'opacity-0 group-hover:opacity-100'}`}
                                                        title="Clause options"
                                                    >
                                                        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                        </svg>
                                                    </button>

                                                    {/* Dropdown menu */}
                                                    {isMenuOpen && (
                                                        <div
                                                            ref={clauseMenuRef}
                                                            className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
                                                        >
                                                            {parent.processingStatus === 'failed' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setClauseMenuOpen(null)
                                                                        retryFailedClauses([parent.clauseId])
                                                                    }}
                                                                    disabled={retryingClauses.has(parent.clauseId)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                                                                >
                                                                    {retryingClauses.has(parent.clauseId) ? (
                                                                        <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                        </svg>
                                                                    )}
                                                                    Retry Certification
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDeleteClauseClick(parent)
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                                Delete Clause
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                }
                            })
                        })()}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* CENTER PANEL: Main Workspace */}
                {/* ======================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {selectedClause ? (
                        <>
                            {/* Clause Header */}
                            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                {selectedClause.clauseNumber}
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(selectedClause.category)}`}>
                                                {selectedClause.category}
                                            </span>
                                            {selectedClause.clarenceCertified && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                    Certified
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-semibold text-slate-800">{selectedClause.clauseName}</h2>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                        {(['overview', 'history', 'tradeoffs', 'draft'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`relative px-3 py-1.5 text-sm rounded-md transition ${activeTab === tab
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab === 'history' ? 'Activity' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                {tab === 'history' && unreadActivityCount > 0 && activeTab !== 'history' && (
                                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm animate-pulse">
                                                        {unreadActivityCount > 99 ? '99+' : unreadActivityCount}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                        {/* Playbook tab — shown when playbook rules are loaded */}
                                        {(playbookRules.length > 0 || isTemplateMode) && (
                                            <button
                                                onClick={() => setActiveTab('playbook')}
                                                className={`relative px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${activeTab === 'playbook'
                                                    ? 'bg-white text-indigo-700 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                                Playbook
                                                {(() => {
                                                    const clauseCat = normaliseCategory(selectedClause.category)
                                                    const matched = playbookRules.find(r => normaliseCategory(r.category) === clauseCat)
                                                    if (!matched || selectedClause.clarencePosition == null) return null
                                                    const breach = selectedClause.clarencePosition < matched.fallback_position
                                                    return (
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${breach ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                    )
                                                })()}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ==================== CLAUSE ACTION BAR ==================== */}
                            {!isTemplateMode && selectedClause.clarenceCertified && (
                                <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex items-center justify-between">
                                        {/* Left: Agreement status - Dual party tracking with query awareness */}
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const status = getAgreementStatus(selectedClause.clauseId)
                                                const otherPartyName = getOtherPartyName()
                                                const hasActiveQuery = queriedClauseIds.has(selectedClause.clauseId)
                                                const currentRole = getPartyRole()

                                                // BOTH AGREED - Fully locked
                                                if (status === 'both') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                                </svg>
                                                                Both Parties Agreed
                                                            </span>
                                                            <span className="text-xs text-slate-500">Clause locked</span>
                                                        </div>
                                                    )
                                                }

                                                // YOU AGREED, AWAITING THEM
                                                if (status === 'you_only') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-sm font-medium border border-sky-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                You Agreed
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                                                                <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Awaiting {otherPartyName}
                                                            </span>
                                                            <button
                                                                onClick={() => handleWithdrawAgreement(selectedClause.clauseId)}
                                                                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                                                                title="Withdraw agreement"
                                                            >
                                                                Withdraw
                                                            </button>
                                                        </div>
                                                    )
                                                }

                                                // THEY AGREED, AWAITING YOU
                                                if (status === 'other_only') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                {otherPartyName} Agreed
                                                            </span>
                                                            <button
                                                                onClick={() => handleAgreeClause(selectedClause.clauseId)}
                                                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                Agree
                                                            </button>
                                                        </div>
                                                    )
                                                }

                                                // NEITHER AGREED — query-aware logic
                                                // If there's an active query:
                                                //   - Initiator: CANNOT agree (must address the query first by redrafting)
                                                //   - Respondent: CAN agree (they raised the query, agreeing resolves it)
                                                if (hasActiveQuery && currentRole === 'initiator') {
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Query Pending
                                                            </span>
                                                            <span className="text-xs text-slate-500">
                                                                Address the query before agreeing — consider redrafting this clause
                                                            </span>
                                                        </div>
                                                    )
                                                }

                                                // Default: show Agree button (respondent can always agree, or no query pending)
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleAgreeClause(selectedClause.clauseId)}
                                                            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Agree
                                                        </button>
                                                        {currentRole === 'initiator' && !clauseApprovalStatuses[selectedClause.clauseId] && (
                                                            <button
                                                                onClick={() => setClauseApprovalTarget({ clauseId: selectedClause.clauseId, clauseName: selectedClause.clauseName })}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 rounded-full text-sm font-medium transition-colors"
                                                            >
                                                                Seek Approval
                                                            </button>
                                                        )}
                                                        {currentRole === 'initiator' && clauseApprovalStatuses[selectedClause.clauseId] === 'pending' && (
                                                            <span className="inline-flex items-center px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-full text-sm font-medium">
                                                                Approval Pending
                                                            </span>
                                                        )}
                                                        {currentRole === 'initiator' && clauseApprovalStatuses[selectedClause.clauseId] === 'approved' && (
                                                            <span className="inline-flex items-center px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-sm font-medium">
                                                                ✓ Approved
                                                            </span>
                                                        )}
                                                        {currentRole === 'initiator' && clauseApprovalStatuses[selectedClause.clauseId] === 'rejected' && (
                                                            <span className="inline-flex items-center px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-full text-sm font-medium">
                                                                Approval Rejected
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })()}

                                            {/* Query badge — shown alongside any state except the initiator-blocked state (which already shows it) */}
                                            {queriedClauseIds.has(selectedClause.clauseId) && getPartyRole() !== 'initiator' && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Query Pending
                                                </span>
                                            )}
                                        </div>

                                        {/* Right: Query input (respondent only, and only when no active query on this clause) */}
                                        {getPartyRole() === 'respondent' && !queriedClauseIds.has(selectedClause.clauseId) && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={queryText}
                                                    onChange={(e) => setQueryText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && queryText.trim()) {
                                                            handleQueryClause(selectedClause.clauseId, queryText)
                                                        }
                                                    }}
                                                    placeholder="Raise a query on this clause..."
                                                    className="w-64 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                                />
                                                <button
                                                    onClick={() => handleQueryClause(selectedClause.clauseId, queryText)}
                                                    disabled={!queryText.trim()}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Query
                                                </button>
                                            </div>
                                        )}

                                        {/* Right: Waiting message for respondent when query is active */}
                                        {getPartyRole() === 'respondent' && queriedClauseIds.has(selectedClause.clauseId) && (
                                            <span className="text-xs text-slate-500 italic">
                                                Awaiting response to your query
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Workspace Content */}
                            <div className="flex-1 overflow-y-auto p-6 min-h-0">

                                {/* ==================== OVERVIEW TAB ==================== */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">

                                        {/* CLARENCE Position Bar - THE STAR OF THE SHOW */}
                                        {/* CLARENCE Position Bar - THE STAR OF THE SHOW */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-4">CLARENCE Recommended Position</h3>

                                            {/* Position Scale */}
                                            <div className="relative mb-6 pt-6 pb-2">
                                                {/* Scale Background - BLUE (provider/flexibility) left â†’ EMERALD (customer/protection) right */}
                                                <div className="relative h-4 bg-gradient-to-r from-blue-200 via-teal-200 via-50% to-emerald-200 rounded-full">
                                                    {/* Scale markers (1-10 mapped to full bar width) */}
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                        <div
                                                            key={n}
                                                            className="absolute top-0 bottom-0 w-px bg-white/50"
                                                            style={{ left: `${positionToPercent(n)}%` }}
                                                        />
                                                    ))}

                                                    {/* CLARENCE Badge - Only marker shown */}
                                                    {/* POSITION BAR: Left = Provider-Favouring (1), Right = Customer-Favouring (10) */}
                                                    {/* PERSISTENCE: Display user's adjusted position if set, otherwise CLARENCE's */}
                                                    {getUserDisplayPosition(selectedClause) !== null && (
                                                        <div
                                                            className={`absolute w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 border-4 border-white flex items-center justify-center text-lg font-bold text-white z-20 shadow-xl transition-all ${isInitiator ? 'cursor-grab active:cursor-grabbing hover:scale-110' : 'cursor-default'}`}
                                                            style={{
                                                                left: `${positionToPercent(getUserDisplayPosition(selectedClause) || 5)}%`,
                                                                top: '50%',
                                                                transform: 'translate(-50%, -50%)'
                                                            }}
                                                            title={isInitiator
                                                                ? `Position: ${(getUserDisplayPosition(selectedClause) || 5).toFixed(1)} - Drag to adjust`
                                                                : `Position: ${(getUserDisplayPosition(selectedClause) || 5).toFixed(1)} (view only)`
                                                            }
                                                            draggable={false}
                                                            onMouseDown={isInitiator ? (e) => {
                                                                e.preventDefault()
                                                                const bar = e.currentTarget.parentElement
                                                                if (!bar) return

                                                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                                                    const rect = bar.getBoundingClientRect()
                                                                    const x = moveEvent.clientX - rect.left
                                                                    const percent = Math.max(0, Math.min(1, x / rect.width))
                                                                    const newPosition = Math.max(1, percent * 10)
                                                                    const roundedPosition = Math.round(newPosition * 2) / 2

                                                                    const role = getPartyRole()
                                                                    setClauses(prev => prev.map(c =>
                                                                        c.clauseId === selectedClause.clauseId
                                                                            ? {
                                                                                ...c,
                                                                                ...(role === 'initiator'
                                                                                    ? { initiatorPosition: roundedPosition }
                                                                                    : { respondentPosition: roundedPosition }
                                                                                )
                                                                            }
                                                                            : c
                                                                    ))
                                                                }

                                                                const handleMouseUp = (upEvent: MouseEvent) => {
                                                                    document.removeEventListener('mousemove', handleMouseMove)
                                                                    document.removeEventListener('mouseup', handleMouseUp)

                                                                    const rect = bar.getBoundingClientRect()
                                                                    const x = upEvent.clientX - rect.left
                                                                    const percent = Math.max(0, Math.min(1, x / rect.width))
                                                                    const finalPosition = Math.max(1, Math.round((percent * 10) * 2) / 2)

                                                                    handlePositionChange(selectedClause.clauseId, finalPosition)
                                                                }

                                                                document.addEventListener('mousemove', handleMouseMove)
                                                                document.addEventListener('mouseup', handleMouseUp)
                                                            } : undefined}
                                                        >
                                                            C
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Scale Labels — Real-world values if range mapping exists, otherwise numeric */}
                                                {rangeMappings.has(selectedClause.clauseId) && rangeMappings.get(selectedClause.clauseId)?.isDisplayable ? (
                                                    <>
                                                        <div className="relative mt-4 h-4">
                                                            {[1, 3, 5, 7, 10].map(pos => {
                                                                const point = rangeMappings.get(selectedClause.clauseId)?.rangeData.scale_points.find(p => p.position === pos)
                                                                // Pin edge labels to bar edges; centre the rest
                                                                const leftPercent = pos === 1 ? 0 : pos === 10 ? 100 : positionToPercent(pos)
                                                                const alignment = pos === 1 ? 'translate-x-0' : pos === 10 ? '-translate-x-full' : '-translate-x-1/2'
                                                                return point ? (
                                                                    <span key={pos} className={`absolute text-[10px] text-slate-500 font-medium ${alignment}`} style={{ left: `${leftPercent}%` }}>
                                                                        {point.label}
                                                                    </span>
                                                                ) : (
                                                                    <span key={pos} className={`absolute text-[10px] text-slate-400 font-medium ${alignment}`} style={{ left: `${leftPercent}%` }}>{pos}</span>
                                                                )
                                                            })}
                                                        </div>
                                                        {/* Current position — show real-world value */}
                                                        {getUserDisplayPosition(selectedClause) !== null && (
                                                            <div className="text-center mt-2">
                                                                <span className="text-sm font-semibold text-purple-700">
                                                                    {translatePosition(getUserDisplayPosition(selectedClause), selectedClause.clauseId)?.label}
                                                                </span>
                                                                <span className="text-xs text-slate-400 ml-2">
                                                                    (Position {getUserDisplayPosition(selectedClause)?.toFixed(1)})
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Industry standard band indicator */}
                                                        {rangeMappings.get(selectedClause.clauseId)?.industryStandardMin && (
                                                            <div className="text-center mt-1">
                                                                <span className="text-[10px] text-purple-400">
                                                                    Industry standard: {rangeMappings.get(selectedClause.clauseId)?.rangeData.scale_points.find(p => p.position === rangeMappings.get(selectedClause.clauseId)?.industryStandardMin)?.label || ''} — {rangeMappings.get(selectedClause.clauseId)?.rangeData.scale_points.find(p => p.position === rangeMappings.get(selectedClause.clauseId)?.industryStandardMax)?.label || ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Party role labels */}
                                                        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                                                            <span>← {roleContext ? `Favours ${roleContext.providingPartyLabel}` : 'Favours Party B'}</span>
                                                            <span>{roleContext ? `Favours ${roleContext.protectedPartyLabel}` : 'Favours Party A'} →</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* No range mappings — show simple orientation only */}
                                                        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                                                            <span>← {roleContext ? `Favours ${roleContext.providingPartyLabel}` : 'Favours Party B'}</span>
                                                            <span>{roleContext ? `Favours ${roleContext.protectedPartyLabel}` : 'Favours Party A'} →</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Position Details */}
                                            <div className="flex items-center gap-6">
                                                <div className="flex-1 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
                                                            <span className="text-white text-xl font-bold">C</span>
                                                        </div>
                                                        <div>
                                                            <div className="text-3xl font-bold text-purple-700">
                                                                {(translatePosition(selectedClause.clarencePosition, selectedClause.clauseId)?.label
                                                                    || selectedClause.clarencePosition?.toFixed(1))
                                                                    ?? '\u2014'}
                                                            </div>
                                                            <div className="text-sm text-purple-600">
                                                                {translatePosition(selectedClause.clarencePosition, selectedClause.clauseId)
                                                                    ? `Position ${selectedClause.clarencePosition?.toFixed(1)} \u2014 ${getPositionLabel(selectedClause.clarencePosition)}`
                                                                    : getPositionLabel(selectedClause.clarencePosition)
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {selectedClause.clarenceFairness && (
                                                    <div className={`px-4 py-3 rounded-lg ${selectedClause.clarenceFairness === 'balanced'
                                                        ? 'bg-emerald-50 border border-emerald-200'
                                                        : 'bg-amber-50 border border-amber-200'
                                                        }`}>
                                                        <div className={`text-sm font-medium ${selectedClause.clarenceFairness === 'balanced'
                                                            ? 'text-emerald-700'
                                                            : 'text-amber-700'
                                                            }`}>
                                                            {selectedClause.clarenceFairness === 'balanced' ? '\u2714 Balanced' : '\u26A0 Review Recommended'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5">Fairness Assessment</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Document Value & Range Comparison */}
                                        {(selectedClause.extractedValue || selectedClause.documentPosition) && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-5">
                                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Document Analysis</h3>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* What the Document Says */}
                                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Your Document Says</div>
                                                        {selectedClause.extractedValue ? (
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-2xl font-bold text-slate-800">
                                                                    {selectedClause.valueType === 'currency' && selectedClause.extractedUnit === '\u00A3' && '\u00A3'}
                                                                    {selectedClause.valueType === 'currency' && selectedClause.extractedUnit === '$' && '$'}
                                                                    {selectedClause.extractedValue}
                                                                </span>
                                                                <span className="text-sm text-slate-600">
                                                                    {selectedClause.extractedUnit && !['\u00A3', '$'].includes(selectedClause.extractedUnit) && selectedClause.extractedUnit}
                                                                    {selectedClause.valueType === 'percentage' && '%'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-lg font-medium text-slate-600">
                                                                Position {selectedClause.documentPosition?.toFixed(1)}
                                                            </div>
                                                        )}
                                                        {selectedClause.documentPosition && (
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <div className={`w-3 h-3 rounded-full ${selectedClause.documentPosition <= 3 ? 'bg-blue-500' :
                                                                    selectedClause.documentPosition <= 5 ? 'bg-teal-500' :
                                                                        selectedClause.documentPosition <= 7 ? 'bg-emerald-400' :
                                                                            'bg-emerald-500'
                                                                    }`}></div>
                                                                <span className="text-xs text-slate-500">
                                                                    {getPositionLabel(selectedClause.documentPosition)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Typical Industry Range */}
                                                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                                        <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-2">Industry Standard</div>
                                                        <div className="text-lg font-semibold text-purple-800">
                                                            {getTypicalRange(selectedClause.category, selectedClause.valueType, selectedClause.extractedUnit)}
                                                        </div>
                                                        <div className="mt-2 text-xs text-purple-600">
                                                            Based on {selectedClause.category} best practices
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Comparison Indicator */}
                                                {/* docPosition > clarencePosition = document is HIGHER on scale = MORE protective (favours protected party) */}
                                                {/* docPosition < clarencePosition = document is LOWER on scale = MORE flexible (favours providing party) */}
                                                {selectedClause.documentPosition !== null && selectedClause.clarencePosition !== null && (
                                                    <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${Math.abs(selectedClause.documentPosition - selectedClause.clarencePosition) < 0.5
                                                        ? 'bg-emerald-50 border border-emerald-200'
                                                        : selectedClause.documentPosition > selectedClause.clarencePosition
                                                            ? 'bg-blue-50 border border-blue-200'
                                                            : 'bg-amber-50 border border-amber-200'
                                                        }`}>
                                                        {Math.abs(selectedClause.documentPosition - selectedClause.clarencePosition) < 0.5 ? (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-emerald-800">Well Aligned</div>
                                                                    <div className="text-xs text-emerald-600">Document terms match industry standards</div>
                                                                </div>
                                                            </>
                                                        ) : selectedClause.documentPosition > selectedClause.clarencePosition ? (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-blue-800">
                                                                        {roleContext ? `Favours ${roleContext.protectedPartyLabel}` : 'Favours Party A'}
                                                                    </div>
                                                                    <div className="text-xs text-blue-600">
                                                                        {roleContext?.positionFavorEnd === 10
                                                                            ? 'Terms lean in your favour compared to industry standard'
                                                                            : 'Terms lean towards the other party compared to industry standard'}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                    </svg>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-amber-800">
                                                                        {roleContext ? `Favours ${roleContext.providingPartyLabel}` : 'Favours Party B'}
                                                                    </div>
                                                                    <div className="text-xs text-amber-600">
                                                                        {roleContext?.positionFavorEnd === 1
                                                                            ? 'Terms lean in your favour compared to industry standard'
                                                                            : 'Terms lean towards the other party compared to industry standard'}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* CLARENCE Analysis */}
                                        {(selectedClause.clarenceSummary || selectedClause.clarenceAssessment) && (
                                            <div className="bg-white rounded-xl border border-slate-200 p-5">
                                                <h3 className="text-sm font-semibold text-slate-700 mb-3">CLARENCE Analysis</h3>

                                                {selectedClause.clarenceSummary && (
                                                    <div className="mb-4">
                                                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Summary</h4>
                                                        <p className="text-slate-700 leading-relaxed">{selectedClause.clarenceSummary}</p>
                                                    </div>
                                                )}

                                                {selectedClause.clarenceAssessment && (
                                                    <div>
                                                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Assessment</h4>
                                                        <p className="text-slate-700 leading-relaxed">{selectedClause.clarenceAssessment}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Attention Points */}
                                        {selectedClause.clarenceFlags && selectedClause.clarenceFlags.length > 0 && !selectedClause.clarenceFlags.includes('none') && (
                                            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                                                <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    Attention Points
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedClause.clarenceFlags.filter(f => f !== 'none').map((flag, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded-full"
                                                        >
                                                            {flag.replace(/_/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* View Clause Text Toggle */}
                                        <div className="bg-white rounded-xl border border-slate-200">
                                            <button
                                                onClick={() => setShowClauseText(!showClauseText)}
                                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl"
                                            >
                                                <span className="text-sm font-medium text-slate-700">View Full Clause Text</span>
                                                <svg
                                                    className={`w-5 h-5 text-slate-400 transition-transform ${showClauseText ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {showClauseText && (
                                                <div className="px-5 pb-5 border-t border-slate-100">
                                                    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                            {selectedClause.clauseText || 'Clause text not available.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ==================== HISTORY TAB ==================== */}
                                {activeTab === 'history' && (
                                    <div className="space-y-4">
                                        {/* Activity Feed Header with View Toggle */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-semibold text-slate-700">Activity Feed</h3>
                                                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                                                    <button
                                                        onClick={() => setActivityViewMode('all')}
                                                        className={`px-3 py-1 text-xs rounded-md transition ${activityViewMode === 'all'
                                                            ? 'bg-white text-slate-800 shadow-sm font-medium'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        All Activity
                                                    </button>
                                                    <button
                                                        onClick={() => setActivityViewMode('clause')}
                                                        className={`px-3 py-1 text-xs rounded-md transition ${activityViewMode === 'clause'
                                                            ? 'bg-white text-slate-800 shadow-sm font-medium'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        This Clause
                                                    </button>
                                                </div>
                                            </div>

                                            {(() => {
                                                // Filter events based on view mode
                                                const filteredEvents = activityViewMode === 'clause'
                                                    ? clauseEvents.filter(e =>
                                                        e.clauseId === selectedClause.clauseId ||
                                                        (e.eventType === 'committed' && !e.clauseId)
                                                    )
                                                    : [...clauseEvents]

                                                // Show newest first
                                                const sortedEvents = [...filteredEvents].reverse()

                                                if (sortedEvents.length === 0) {
                                                    return (
                                                        <div className="text-center py-8">
                                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-slate-500 text-sm">
                                                                {activityViewMode === 'clause'
                                                                    ? 'No events yet for this clause.'
                                                                    : 'No activity yet on this contract.'
                                                                }
                                                            </p>
                                                            <p className="text-slate-400 text-xs mt-1">Use the Agree or Query buttons to get started.</p>
                                                        </div>
                                                    )
                                                }

                                                // Helper: check if an event is unread by current user
                                                const isUnread = (event: ClauseEvent): boolean => {
                                                    const role = getPartyRole()
                                                    if (role === 'initiator') return !event.readByInitiator
                                                    return !event.readByRespondent
                                                }

                                                // Helper: navigate to a clause when clicking an activity item
                                                const navigateToClause = (clauseId: string | null) => {
                                                    if (!clauseId) return
                                                    const clauseIndex = clauses.findIndex(c => c.clauseId === clauseId)
                                                    if (clauseIndex >= 0) {
                                                        setSelectedClauseIndex(clauseIndex)
                                                        setActivityViewMode('clause')
                                                    }
                                                }

                                                return (
                                                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                                        {sortedEvents.map((event) => {
                                                            const eventConfig: Record<string, { icon: string; color: string; label: string }> = {
                                                                'agreed': { icon: '\u2714', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Agreed' },
                                                                'agreement_withdrawn': { icon: '\u21A9', color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Agreement Withdrawn' },
                                                                'queried': { icon: '?', color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Query Raised' },
                                                                'query_resolved': { icon: '\u2714', color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Query Resolved' },
                                                                'position_changed': { icon: '\u2195', color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Position Changed' },
                                                                'redrafted': { icon: '\u270E', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Clause Redrafted' },
                                                                'draft_created': { icon: '\u{1F4DD}', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Draft Created' },
                                                                'draft_modified': { icon: '\u270F\uFE0F', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Draft Modified' },
                                                                'committed': { icon: '\u{1F91D}', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Contract Committed' },
                                                                'clause_deleted': { icon: '\u{1F5D1}', color: 'bg-red-100 text-red-700 border-red-200', label: 'Clause Deleted' },
                                                            }

                                                            const config = eventConfig[event.eventType] || { icon: '\u2022', color: 'bg-slate-100 text-slate-600 border-slate-200', label: event.eventType }
                                                            const eventDate = new Date(event.createdAt)
                                                            const unread = isUnread(event)
                                                            const isClickable = activityViewMode === 'all' && event.clauseId

                                                            return (
                                                                <div
                                                                    key={event.eventId}
                                                                    onClick={() => isClickable && navigateToClause(event.clauseId)}
                                                                    className={`flex items-start gap-3 p-3 rounded-lg border transition ${config.color} ${isClickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''} ${unread ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
                                                                >
                                                                    {/* Unread dot */}
                                                                    {unread && (
                                                                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm" />
                                                                    )}

                                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm border">
                                                                        {config.icon}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm font-medium">{config.label}</span>
                                                                            <span className="text-xs opacity-70">
                                                                                {eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>

                                                                        {/* Activity summary (human-readable) */}
                                                                        {event.activitySummary ? (
                                                                            <p className="text-xs mt-0.5 opacity-80">
                                                                                {event.activitySummary}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-xs mt-0.5 opacity-80">
                                                                                by {event.userName} ({event.partyRole})
                                                                            </p>
                                                                        )}

                                                                        {/* Clause reference badge (in All Activity view) */}
                                                                        {activityViewMode === 'all' && event.clauseId && (
                                                                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded text-[11px] text-slate-500 border border-current/10">
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                                </svg>
                                                                                {event.eventData?.clause_number ? `${String(event.eventData.clause_number)} — ` : null}
                                                                                {String(event.eventData?.clause_name || 'Clause')}
                                                                            </div>
                                                                        )}

                                                                        {/* Query message */}
                                                                        {event.message && (
                                                                            <p className="text-sm mt-2 p-2 bg-white/60 rounded border border-current/10 italic">
                                                                                &ldquo;{event.message}&rdquo;
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )
                                            })()}
                                        </div>

                                        {/* Contract Summary Stats */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Contract Summary</h3>
                                            <div className="grid grid-cols-4 gap-3 text-center">
                                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                                    <div className="text-2xl font-bold text-emerald-700">{getFullyAgreedCount()}</div>
                                                    <div className="text-xs text-emerald-600">Both Agreed</div>
                                                </div>
                                                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                                                    <div className="text-2xl font-bold text-sky-700">{getPartiallyAgreedCount()}</div>
                                                    <div className="text-xs text-sky-600">Partial</div>
                                                </div>
                                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                    <div className="text-2xl font-bold text-amber-700">{queriedClauseIds.size}</div>
                                                    <div className="text-xs text-amber-600">Queried</div>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                    <div className="text-2xl font-bold text-slate-700">
                                                        {clauses.filter(c => !c.isHeader && c.clarenceCertified).length - getFullyAgreedCount() - getPartiallyAgreedCount()}
                                                    </div>
                                                    <div className="text-xs text-slate-500">Outstanding</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ==================== TRADEOFFS TAB ==================== */}
                                {activeTab === 'tradeoffs' && (
                                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-medium text-slate-700 mb-2">Trade-Offs</h3>
                                            <p className="text-slate-500 text-sm">
                                                Trade-off analysis is available in full negotiation mode where both parties can adjust positions.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* ==================== DRAFT TAB ==================== */}
                                {activeTab === 'draft' && (
                                    <div className="space-y-4">
                                        {/* Header with Status and Actions */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-700">Draft Clause Language</h3>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {selectedClause.draftModified
                                                            ? '\u270F\uFE0F Modified - Your edited version will be used in the final document'
                                                            : '\u{1F4C4} Original document text'
                                                        }
                                                    </p>
                                                </div>

                                                {/* Status Badge */}
                                                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${selectedClause.draftModified
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                    {selectedClause.draftModified ? 'Modified' : 'Original'}
                                                </div>
                                            </div>

                                            {/* Clause Text Display / Editor */}
                                            {isDraftEditing ? (
                                                // Editing Mode
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editingDraftText}
                                                        onChange={(e) => setEditingDraftText(e.target.value)}
                                                        className="w-full h-64 p-4 bg-white rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-sm text-slate-700 font-mono leading-relaxed resize-none transition-colors"
                                                        placeholder="Enter your modified clause text..."
                                                    />
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs text-slate-500">
                                                            {editingDraftText.length} characters
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={handleCancelEditing}
                                                                disabled={savingDraft}
                                                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleSaveDraft}
                                                                disabled={savingDraft || !editingDraftText.trim()}
                                                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                            >
                                                                {savingDraft ? (
                                                                    <>
                                                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                        Saving...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                        Save Draft
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Read-Only Mode
                                                <div className="space-y-3">
                                                    {/* Clause Text Display */}
                                                    <div className={`p-4 rounded-lg border ${selectedClause.draftModified
                                                        ? 'bg-purple-50 border-purple-200'
                                                        : 'bg-slate-50 border-slate-200'
                                                        }`}>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                                                            {selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || 'Clause text not available.'}
                                                        </p>
                                                        {/* Character count */}
                                                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                                            <span className="text-xs text-slate-400">
                                                                {(selectedClause.draftText || selectedClause.originalText || selectedClause.clauseText || '').length} characters
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons - Initiator Only */}
                                                    {isInitiator && (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                {/* Unlock to Edit Button */}
                                                                <button
                                                                    onClick={handleStartEditing}
                                                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                                    </svg>
                                                                    Unlock to Edit
                                                                </button>

                                                                {/* Bespoke Drafting — Redraft to any position */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                                                        {selectedClause.clarencePosition != null
                                                                            ? `Current: ${selectedClause.clarencePosition.toFixed(1)}`
                                                                            : 'Not certified'}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">|</span>
                                                                    <span className="text-xs text-slate-500 whitespace-nowrap">Redraft to:</span>
                                                                    <button
                                                                        onClick={() => setBespokeDraftTarget(prev => Math.max(1, +(prev - 1).toFixed(0)))}
                                                                        disabled={bespokeDraftTarget <= 1 || generatingPositionDraft || !selectedClause.clarenceCertified}
                                                                        className="w-7 h-7 flex items-center justify-center text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <div className="flex flex-col items-center min-w-[3rem]">
                                                                        <span className="text-sm font-semibold text-slate-800">{bespokeDraftTarget.toFixed(1)}</span>
                                                                        <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[5rem]">
                                                                            {getPositionDescription(
                                                                                Math.round(bespokeDraftTarget),
                                                                                roleContext?.protectedPartyLabel || 'Protected',
                                                                                roleContext?.providingPartyLabel || 'Providing'
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setBespokeDraftTarget(prev => Math.min(10, +(prev + 1).toFixed(0)))}
                                                                        disabled={bespokeDraftTarget >= 10 || generatingPositionDraft || !selectedClause.clarenceCertified}
                                                                        className="w-7 h-7 flex items-center justify-center text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >
                                                                        +
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleGenerateDraftForPosition(bespokeDraftTarget)}
                                                                        disabled={generatingPositionDraft || !selectedClause.clarenceCertified}
                                                                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                                        title={!selectedClause.clarenceCertified ? 'Clause must be certified before generating a draft' : `Redraft this clause to position ${bespokeDraftTarget.toFixed(1)}`}
                                                                    >
                                                                        {generatingPositionDraft ? (
                                                                            <>
                                                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                </svg>
                                                                                Drafting...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                                </svg>
                                                                                Redraft
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>

                                                                {/* Discuss with CLARENCE Button */}
                                                                <button
                                                                    onClick={() => {
                                                                        const chatInput = document.querySelector('textarea[placeholder*="CLARENCE"]') as HTMLTextAreaElement
                                                                        if (chatInput) { chatInput.focus(); chatInput.scrollIntoView({ behavior: 'smooth' }) }
                                                                    }}
                                                                    className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-2"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                    </svg>
                                                                    Discuss with CLARENCE
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Respondent: Show only "Discuss with CLARENCE" */}
                                                    {!isInitiator && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    const chatInput = document.querySelector('textarea[placeholder*="CLARENCE"]') as HTMLTextAreaElement
                                                                    if (chatInput) { chatInput.focus(); chatInput.scrollIntoView({ behavior: 'smooth' }) }
                                                                }}
                                                                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                </svg>
                                                                Discuss with CLARENCE
                                                            </button>
                                                            <span className="text-xs text-slate-400 italic">
                                                                Draft editing is managed by the contract initiator
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Original Text Reference (shown if modified) */}
                                        {selectedClause.draftModified && !isDraftEditing && (
                                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                                                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Original Document Text</h4>
                                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">
                                                    {selectedClause.clauseText || 'Original text not available.'}
                                                </p>
                                            </div>
                                        )}

                                        {/* Help Text */}
                                        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-blue-800 mb-1">Editing Tips</h4>
                                                    <ul className="text-xs text-blue-700 space-y-1">
                                                        <li>{'\u2022'} Click "Create More Balanced Draft" to have CLARENCE rewrite the clause toward a fairer position</li>
                                                        <li>{'\u2022'} Click "Unlock to Edit" to manually modify the clause language</li>
                                                        <li>{'\u2022'} Use "Discuss with CLARENCE" to get AI suggestions for improvements</li>
                                                        <li>{'\u2022'} Your modified text will be used when generating the final contract</li>
                                                        <li>{'\u2022'} You can always reset to the original document text</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ==================== PLAYBOOK TAB ==================== */}
                                {activeTab === 'playbook' && (() => {
                                    const clauseCat = normaliseCategory(selectedClause.category)
                                    const matchedRule = playbookRules.find(r => normaliseCategory(r.category) === clauseCat)
                                    const clausePos = selectedClause.clarencePosition

                                    if (playbookRules.length === 0) {
                                        return (
                                            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                                                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                                <p className="text-sm text-slate-500 font-medium">No active playbook</p>
                                                <p className="text-xs text-slate-400 mt-1">Activate a playbook for this contract type in the Control Room to see alignment guidance here.</p>
                                            </div>
                                        )
                                    }

                                    if (!matchedRule) {
                                        return (
                                            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                                                <p className="text-sm text-slate-500 font-medium">No rule for this clause category</p>
                                                <p className="text-xs text-slate-400 mt-1">The active playbook has no rule covering <span className="font-medium">{selectedClause.category}</span>.</p>
                                            </div>
                                        )
                                    }

                                    const toPercent = (v: number) => ((v - 1) / 9) * 100
                                    const rangeCtx = getEffectiveRangeContext(matchedRule)
                                    const idealPct    = toPercent(matchedRule.ideal_position)
                                    const minPct      = toPercent(matchedRule.minimum_position)
                                    const maxPct      = toPercent(matchedRule.maximum_position)
                                    const fallbackPct = toPercent(matchedRule.fallback_position)
                                    const templatePct = clausePos != null ? toPercent(clausePos) : null

                                    let statusLabel = 'No certified position yet'
                                    let statusColor = 'bg-slate-100 text-slate-500 border-slate-200'
                                    if (clausePos != null) {
                                        if (clausePos < matchedRule.fallback_position) {
                                            statusLabel = 'Breach — below fallback'
                                            statusColor = 'bg-red-50 text-red-600 border-red-200'
                                        } else if (clausePos === matchedRule.ideal_position) {
                                            statusLabel = 'Exact match'
                                            statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        } else {
                                            statusLabel = clausePos > matchedRule.ideal_position ? 'Above ideal' : 'Below ideal'
                                            statusColor = 'bg-amber-50 text-amber-700 border-amber-200'
                                        }
                                    }

                                    return (
                                        <div className="space-y-4">
                                            {/* Rule card */}
                                            <div className="bg-white rounded-xl border border-slate-200 p-5">
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Playbook Rule — {playbookName}</p>
                                                        <h3 className="text-sm font-semibold text-slate-800">{matchedRule.clause_name}</h3>
                                                        {matchedRule.rationale && (
                                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{matchedRule.rationale}</p>
                                                        )}
                                                    </div>
                                                    <span className={`flex-shrink-0 px-2 py-1 text-[10px] font-semibold rounded border ${statusColor}`}>
                                                        {statusLabel}
                                                    </span>
                                                </div>

                                                {/* Position bar */}
                                                <div className="relative h-12 mt-4">
                                                    {/* Track */}
                                                    <div className="absolute inset-x-0 top-[22px] h-1.5 bg-slate-100 rounded-full" />
                                                    {/* Amber market band */}
                                                    <div className="absolute top-[19px] h-2.5 bg-amber-100 rounded-full border border-amber-300"
                                                        style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }} />
                                                    {/* Ideal badge — above track */}
                                                    <div className="absolute top-0" style={{ left: `${idealPct}%`, transform: 'translateX(-50%)' }}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="px-1.5 py-px text-[8px] font-bold bg-emerald-500 text-white rounded whitespace-nowrap leading-tight shadow-sm">
                                                                Ideal · {matchedRule.ideal_position}
                                                            </span>
                                                            <div className="w-0 border-l-2 border-emerald-400" style={{ height: '26px' }} />
                                                        </div>
                                                    </div>
                                                    {/* Fallback badge — below track */}
                                                    <div className="absolute top-[12px]" style={{ left: `${fallbackPct}%`, transform: 'translateX(-50%)' }}>
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-0 border-l-2 border-red-400" style={{ height: '18px' }} />
                                                            <span className="px-1.5 py-px text-[8px] font-bold bg-red-500 text-white rounded whitespace-nowrap leading-tight shadow-sm">
                                                                Fallback · {matchedRule.fallback_position}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Clause certified position — indigo diamond */}
                                                    {templatePct != null && (
                                                        <div className="absolute z-20"
                                                            style={{ left: `${templatePct}%`, top: '16px', transform: 'translateX(-50%) rotate(45deg)' }}>
                                                            <div className={`w-4 h-4 rounded-sm border-2 border-white shadow-md ${
                                                                clausePos! >= matchedRule.fallback_position ? 'bg-indigo-500' : 'bg-red-500'
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

                                                {/* Position summary */}
                                                <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-2 flex-wrap">
                                                    <span>Playbook: min {matchedRule.minimum_position} · ideal {matchedRule.ideal_position} · max {matchedRule.maximum_position}</span>
                                                    {clausePos != null && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <span className={clausePos >= matchedRule.fallback_position ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                                                                Clause: {clausePos}{(() => { const l = translateRulePosition(matchedRule, clausePos); return l && l !== String(clausePos) ? ` · ${l}` : '' })()}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Escalation */}
                                                {clausePos != null && clausePos < matchedRule.fallback_position && matchedRule.escalation_contact && (
                                                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                                        Escalate to: {matchedRule.escalation_contact}
                                                        {matchedRule.escalation_contact_email && ` (${matchedRule.escalation_contact_email})`}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Legend */}
                                            <div className="flex items-center gap-4 text-[9px] text-slate-400 px-1 flex-wrap">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="px-1.5 py-px text-[8px] font-bold bg-emerald-500 text-white rounded">Ideal</span>
                                                    Company sweet spot
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="px-1.5 py-px text-[8px] font-bold bg-red-500 text-white rounded">Fallback</span>
                                                    Backstop — escalate below
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="inline-block w-3 h-2 rounded bg-amber-100 border border-amber-300" />
                                                    Market range
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500 rotate-45" />
                                                    This clause
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })()}

                            </div>

                            {/* Navigation Footer */}
                            <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                                <button
                                    onClick={() => setSelectedClauseIndex(Math.max(0, (selectedClauseIndex || 0) - 1))}
                                    disabled={selectedClauseIndex === 0}
                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Previous
                                </button>
                                <span className="text-sm text-slate-500">
                                    Clause {(selectedClauseIndex || 0) + 1} of {clauses.length}
                                </span>
                                <button
                                    onClick={() => setSelectedClauseIndex(Math.min(clauses.length - 1, (selectedClauseIndex || 0) + 1))}
                                    disabled={selectedClauseIndex === clauses.length - 1}
                                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Next
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-md px-6">
                                {clauses.length === 0 && contract ? (
                                    <>
                                        <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                            {contract.contractName}
                                        </h3>
                                        <p className="text-slate-500 text-sm mb-4">
                                            {['processing', 'certifying', 'uploading', 'pending'].includes(contract.status)
                                                ? 'CLARENCE is processing this contract. Clauses will appear shortly.'
                                                : 'No clauses are available for this contract yet. Please check back shortly or contact the sender.'}
                                        </p>
                                        {!isInitiator && (
                                            <p className="text-xs text-slate-400">
                                                You are the receiving party on this contract.
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-slate-500 text-lg">Select a clause to view details</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ======================================================== */}
                {/* RIGHT PANEL: CLARENCE Chat */}
                {/* ======================================================== */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden min-h-0">
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-md">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">CLARENCE</h3>
                                <p className="text-xs text-slate-500">Contract Analysis Assistant</p>
                            </div>
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                        {chatMessages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
                                    <p className={`text-xs mt-1.5 ${message.role === 'user' ? 'text-purple-200' : 'text-slate-400'
                                        }`}>
                                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-2xl px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-slate-200">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                                placeholder="Ask CLARENCE about this contract..."
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <button
                                onClick={() => sendChatMessage()}
                                disabled={!chatInput.trim() || chatLoading}
                                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">
                            Press Enter to send
                        </p>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* INVITE MODAL */}
            {/* ============================================================ */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        {inviteSuccess ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Invite Sent!</h3>
                                <p className="text-slate-600 text-sm">
                                    {inviteName} will receive an email with a link to review this contract.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800">Invite Counterparty</h3>
                                            <p className="text-sm text-slate-500 mt-1">Send a link to review and negotiate this contract</p>
                                        </div>
                                        <button
                                            onClick={() => setShowInviteModal(false)}
                                            className="p-1 hover:bg-slate-100 rounded-lg transition"
                                        >
                                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={inviteName}
                                            onChange={(e) => setInviteName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder="e.g., John Smith"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder="e.g., john@company.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Company <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={inviteCompany}
                                            onChange={(e) => setInviteCompany(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder="e.g., Acme Corporation"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Message <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <textarea
                                            value={inviteMessage}
                                            onChange={(e) => setInviteMessage(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
                                            placeholder="Add a personal note (optional)"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowInviteModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSendInvite}
                                        disabled={sendingInvite || !inviteEmail.trim() || !inviteName.trim()}
                                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        {sendingInvite ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                                Send Invite
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* COMMIT CONFIRMATION MODAL */}
            {/* ============================================================ */}
            {commitModalState !== 'closed' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

                        {commitModalState === 'success' ? (
                            /* ---- Success State - Both parties committed ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Contract Fully Committed</h3>
                                <p className="text-sm text-slate-500">Both parties have agreed. Redirecting to Document Centre...</p>
                            </div>

                        ) : commitModalState === 'waiting_other_party' ? (
                            /* ---- Waiting for Other Party State ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Your Commitment Recorded</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Awaiting {getOtherPartyName()} to commit. You'll be notified when they do.
                                </p>
                                <button
                                    onClick={() => setCommitModalState('closed')}
                                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    Continue Reviewing
                                </button>
                            </div>

                        ) : commitModalState === 'processing' ? (
                            /* ---- Processing State ---- */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Committing Contract...</h3>
                                <p className="text-sm text-slate-500">Recording your agreement to all clauses.</p>
                            </div>

                        ) : (
                            /* ---- Confirmation State ---- */
                            (() => {
                                const leafClauses = clauses.filter(c => !c.isHeader && c.clarenceCertified)
                                const myAgreedCount = leafClauses.filter(c => hasCurrentUserAgreed(c.clauseId)).length
                                const myUnagreedCount = leafClauses.length - myAgreedCount
                                const allMyAgreed = myUnagreedCount === 0
                                const otherFullyAgreed = leafClauses.every(c => hasOtherPartyAgreed(c.clauseId))
                                const bothWillBeFullyAgreed = otherFullyAgreed // After commit, we'll be fully agreed, so check if other party is too

                                return (
                                    <>
                                        <div className="p-6 border-b border-slate-200">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${allMyAgreed ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                                    <svg className={`w-5 h-5 ${allMyAgreed ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-slate-800">Commit Contract</h3>
                                                    <p className="text-sm text-slate-500">{contract?.contractName}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            {/* Your agreement status */}
                                            {allMyAgreed ? (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-emerald-800 font-medium">
                                                        You've agreed to all {leafClauses.length} clauses.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-amber-800 font-medium">
                                                        You haven't individually agreed to {myUnagreedCount} clause{myUnagreedCount !== 1 ? 's' : ''}.
                                                    </p>
                                                    <p className="text-sm text-amber-700 mt-1">
                                                        Committing will agree to all outstanding clauses on your behalf.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Other party status */}
                                            {bothWillBeFullyAgreed ? (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-emerald-800 font-medium">
                                                        ✓ {getOtherPartyName()} has already committed.
                                                    </p>
                                                    <p className="text-sm text-emerald-700 mt-1">
                                                        Your commit will finalise the agreement for both parties.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-sky-800 font-medium">
                                                        {getOtherPartyName()} hasn't committed yet.
                                                    </p>
                                                    <p className="text-sm text-sky-700 mt-1">
                                                        The contract will be finalised once they also commit.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                                                <p className="font-medium text-slate-600 mb-1">This action will be recorded:</p>
                                                <p>Your commitment, including timestamp and browser details, will be stored as a legally auditable record.</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-3 p-6 pt-0">
                                            <button
                                                onClick={() => setCommitModalState('closed')}
                                                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCommitContract}
                                                className={`px-5 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${allMyAgreed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                                                    }`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                </svg>
                                                {allMyAgreed ? 'Commit Contract' : 'Agree All & Commit'}
                                            </button>
                                        </div>
                                    </>
                                )
                            })()
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* CONTRACT SIGN-OFF MODAL */}
            {/* ============================================================ */}
            {showContractApprovalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">Request Contract Sign-off</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {doaApproverName
                                    ? <>This will be sent to <strong>{doaApproverName}</strong> for review and sign-off before you commit.</>
                                    : 'An approver will be notified to review and sign off on this contract before you commit.'}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Message to approver (optional)</label>
                                <textarea
                                    value={approvalMessage}
                                    onChange={(e) => setApprovalMessage(e.target.value)}
                                    placeholder="Any context or notes for the approver..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 pt-0">
                            <button onClick={() => { setShowContractApprovalModal(false); setApprovalMessage('') }} className="px-4 py-2 text-slate-600 hover:text-slate-800 rounded-lg text-sm font-medium">Cancel</button>
                            <button
                                onClick={handleRequestContractApproval}
                                disabled={isRequestingApproval}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                            >
                                {isRequestingApproval ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</> : 'Send Sign-off Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* CLAUSE APPROVAL MODAL */}
            {/* ============================================================ */}
            {clauseApprovalTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">Seek Clause Approval</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Request internal approval for your position on: <strong>{clauseApprovalTarget.clauseName}</strong>
                            </p>
                            {doaApproverName && (
                                <p className="text-xs text-slate-400 mt-1">This will be sent to <strong className="text-slate-600">{doaApproverName}</strong></p>
                            )}
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Message to approver (optional)</label>
                                <textarea
                                    value={approvalMessage}
                                    onChange={(e) => setApprovalMessage(e.target.value)}
                                    placeholder="Context for the approver..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 pt-0">
                            <button onClick={() => { setClauseApprovalTarget(null); setApprovalMessage('') }} className="px-4 py-2 text-slate-600 hover:text-slate-800 rounded-lg text-sm font-medium">Cancel</button>
                            <button
                                onClick={handleRequestClauseApproval}
                                disabled={isRequestingApproval}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                            >
                                {isRequestingApproval ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</> : 'Send Approval Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SAVE AS TEMPLATE MODAL (template mode only) */}
            {/* ============================================================ */}
            {showSaveTemplateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        {templateSaved ? (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">{editTemplateId ? 'Template Updated!' : 'Template Saved!'}</h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    {editTemplateId
                                        ? 'Your template has been updated successfully.'
                                        : isCompanyTemplate
                                            ? 'Company template created successfully.'
                                            : 'Template saved to your library.'}
                                </p>
                                <div className="flex flex-col gap-3">
                                    {!isCompanyTemplate && (
                                        <button
                                            onClick={handlePracticeWithTemplate}
                                            className="w-full px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Practice with AI
                                        </button>
                                    )}
                                    <p className="text-xs text-slate-400">
                                        Redirecting to {isCompanyTemplate ? 'Company Admin' : 'Contract Library'}...
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-slate-200">
                                    <h3 className="text-lg font-semibold text-slate-800">
                                        {editTemplateId
                                            ? (isCompanyTemplate ? 'Update Company Template' : 'Update Template')
                                            : (isCompanyTemplate ? 'Save as Company Template' : 'Save as Template')}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        This will {editTemplateId ? 'update' : 'save'} {clauses.filter(c => c.clarenceCertified).length} certified clauses
                                        {editTemplateId
                                            ? ' in the existing template.'
                                            : isCompanyTemplate ? ' as a company-wide template available to all staff.' : ' as a reusable template.'}
                                    </p>
                                </div>
                                <div className="p-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Template Name</label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="e.g., Standard BPO Agreement"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 p-6 pt-0">
                                    <button
                                        onClick={() => setShowSaveTemplateModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    {editTemplateId && (
                                        <button
                                            onClick={() => handleSaveAsTemplate(true)}
                                            disabled={!templateName.trim() || savingTemplate}
                                            className="px-5 py-2 bg-white hover:bg-slate-50 disabled:bg-slate-100 text-purple-600 border border-purple-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                                        >
                                            {savingTemplate ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save as New'
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleSaveAsTemplate()}
                                        disabled={!templateName.trim() || savingTemplate}
                                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                                    >
                                        {savingTemplate ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                {editTemplateId ? 'Updating...' : 'Saving...'}
                                            </>
                                        ) : (
                                            editTemplateId ? 'Update Template' : 'Save Template'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* DELETE CLAUSE CONFIRMATION MODAL */}
            {/* ============================================================ */}
            {showDeleteConfirm && deleteClauseTarget && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">Delete Clause</h3>
                                    <p className="text-sm text-slate-500">This action cannot be undone</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4">
                            <p className="text-slate-600 mb-4">
                                Are you sure you want to delete this clause from the {isTemplateMode ? 'template' : 'contract'}?
                            </p>

                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-start gap-3">
                                    <span className="text-sm font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {deleteClauseTarget.clauseNumber}
                                    </span>
                                    <div>
                                        <p className="font-medium text-slate-800">{deleteClauseTarget.clauseName}</p>
                                        <p className="text-sm text-slate-500 mt-1">{deleteClauseTarget.category}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Warning for parent clauses */}
                            {(deleteClauseTarget.clauseLevel === 0 || deleteClauseTarget.clauseLevel === 1) &&
                                clauses.some(c => c.parentClauseId === deleteClauseTarget.clauseId) && (
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <p className="text-sm text-amber-800">
                                                This clause has sub-clauses. Deleting it will also remove all its child clauses.
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={handleCancelDelete}
                                disabled={deletingClause}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDeleteClause}
                                disabled={deletingClause}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {deletingClause ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete Clause
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* PLAYBOOK COMPLIANCE MODAL (initiator only)                    */}
            {/* ============================================================ */}
            {showComplianceModal && playbookCompliance && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Playbook Compliance</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{playbookName} &middot; {playbookCompanyName}</p>
                            </div>
                            <button
                                onClick={() => setShowComplianceModal(false)}
                                className="p-1 hover:bg-slate-100 rounded-lg transition"
                            >
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <PlaybookComplianceIndicator
                                compliance={playbookCompliance}
                                playbookName={playbookName}
                                companyName={playbookCompanyName}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Compliance Guidance Banner (inline, auto-dismisses) */}
            {qcComplianceGuidanceTips.length > 0 && (
                <div className="fixed bottom-20 right-4 z-40 max-w-sm">
                    <ComplianceGuidanceBanner
                        tips={qcComplianceGuidanceTips}
                        onDismiss={() => setQcComplianceGuidanceTips([])}
                    />
                </div>
            )}

            {/* Compliance Warning Modal */}
            {qcComplianceResult && (
                <ComplianceWarningModal
                    isOpen={showQcComplianceWarning}
                    onClose={handleQcComplianceAdjust}
                    onProceed={handleQcComplianceProceed}
                    onSeekApproval={handleQcComplianceSeekApproval}
                    onAdjust={handleQcComplianceAdjust}
                    complianceResult={qcComplianceResult}
                    clauseName={clauses.find(c => c.clauseId === qcPendingRevertClauseId)?.clauseName || ''}
                    proposedPosition={dirtyPositions.get(qcPendingRevertClauseId || '') ?? 0}
                />
            )}

            {/* ============================================================ */}
            {/* SECTION 7F: PARTY CHAT PANEL (DETACHABLE COMPONENT) */}
            {/* ============================================================ */}
            {!isTemplateMode && userInfo && (
                <QCPartyChatPanel
                    contractId={resolvedContractId || contractId}
                    otherPartyName={getOtherPartyName()}
                    otherPartyCompany={getOtherPartyCompany()}
                    currentUserId={userInfo.userId}
                    currentUserName={userInfo.fullName}
                    partyRole={getPartyRole()}
                    isOpen={partyChatOpen}
                    onClose={() => setPartyChatOpen(false)}
                    onUnreadCountChange={setPartyChatUnread}
                />
            )}

            {/* ================================================================
                DRAFT-POSITION SYNC PROMPT OVERLAY
                Shows when user changes position significantly from CLARENCE's assessment
                ================================================================ */}
            {isInitiator && showDraftOfferPrompt && pendingDraftPosition !== null && selectedClause && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <span className="text-white text-lg">📝</span>
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">Position Changed</h3>
                                    <p className="text-purple-100 text-sm">Draft may need updating</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-slate-700 mb-4">
                                You've moved <strong>{selectedClause.clauseName}</strong> to position{' '}
                                <strong className="text-purple-600">{pendingDraftPosition.toFixed(1)}</strong>
                                {selectedClause.clarencePosition !== null && (
                                    <>, which differs from my assessment of{' '}
                                        <strong className="text-purple-600">{selectedClause.clarencePosition.toFixed(1)}</strong>.</>
                                )}
                            </p>

                            <p className="text-slate-600 text-sm mb-6">
                                The current draft language may not reflect your new position.
                                Would you like me to redraft this clause to match?
                            </p>

                            {/* Position comparison */}
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-6">
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-1">CLARENCE Assessment</div>
                                    <div className="text-lg font-bold text-purple-600">
                                        {selectedClause.clarencePosition?.toFixed(1) ?? '—'}
                                    </div>
                                </div>
                                <div className="text-slate-300">→</div>
                                <div className="text-center">
                                    <div className="text-xs text-slate-500 mb-1">Your Position</div>
                                    <div className="text-lg font-bold text-emerald-600">
                                        {pendingDraftPosition.toFixed(1)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => {
                                    // Revert the badge to its position before the drag
                                    if (preChangePosition !== null && selectedClause) {
                                        const role = getPartyRole()
                                        setClauses(prev => prev.map(c =>
                                            c.clauseId === selectedClause.clauseId
                                                ? { ...c, ...(role === 'initiator' ? { initiatorPosition: preChangePosition } : { respondentPosition: preChangePosition }) }
                                                : c
                                        ))
                                        setDirtyPositions(prev => {
                                            const next = new Map(prev)
                                            next.delete(selectedClause.clauseId)
                                            return next
                                        })
                                    }
                                    setShowDraftOfferPrompt(false)
                                    setPendingDraftPosition(null)
                                    setPreChangePosition(null)
                                }}
                                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                            >
                                Keep Current Draft
                            </button>
                            <button
                                onClick={() => handleGenerateDraftForPosition(pendingDraftPosition)}
                                disabled={generatingPositionDraft}
                                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {generatingPositionDraft ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <span>✨</span>
                                        Redraft for Position {pendingDraftPosition.toFixed(1)}
                                    </>
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
// SECTION 8: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function QuickContractStudioPage() {
    return (
        <Suspense fallback={<QuickContractStudioLoading />}>
            <QuickContractStudioContent />
        </Suspense>
    )
}