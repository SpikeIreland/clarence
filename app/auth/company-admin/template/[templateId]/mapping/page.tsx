'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PositionBar from '@/app/components/PositionBar'

// ============================================================================
// TYPES
// ============================================================================

interface TemplateMeta {
    template_id: string
    template_name: string
    linked_playbook_id: string | null
    clause_count: number
}

interface PlaybookMeta {
    playbook_id: string
    playbook_name: string
}

interface PlaybookRule {
    rule_id: string
    clause_code: string | null
    clause_name: string
    category: string | null
    ideal_position: number
    minimum_position: number
    maximum_position: number
    fallback_position: number
    importance_level: number | null
    is_deal_breaker: boolean
    is_non_negotiable: boolean
}

interface TemplateClause {
    template_clause_id: string
    clause_name: string
    clause_number: string | null
    category: string | null
    display_order: number
    is_header: boolean
}

interface MappingRow {
    mapping_id: string
    playbook_rule_id: string
    template_clause_id: string
    match_method: string
    match_confidence: number
    match_reason: string | null
    status: 'unconfirmed' | 'confirmed' | 'rejected' | 'remapped'
    confirmed_by: string | null
    confirmed_at: string | null
}

// ============================================================================
// ICONS
// ============================================================================

const SearchIcon = () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
)
const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
)
const XIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
)
const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
)

// ============================================================================
// HELPERS
// ============================================================================

type StatusFilter = 'all' | 'unconfirmed' | 'unmapped' | 'confirmed'
type SortMode = 'clause_order' | 'category'

const confidenceColor = (score: number) =>
    score === 100 ? '#22c55e' : score >= 80 ? '#eab308' : score >= 50 ? '#f97316' : '#94a3b8'

const methodLabel: Record<string, string> = {
    auto_exact: 'Exact match',
    auto_containment: 'Name containment',
    auto_category: 'Category match',
    auto_ai: 'AI match',
    manual: 'Manual',
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function MappingReviewPage() {
    const router = useRouter()
    const params = useParams()
    const templateId = params.templateId as string

    // Data state
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [template, setTemplate] = useState<TemplateMeta | null>(null)
    const [playbook, setPlaybook] = useState<PlaybookMeta | null>(null)
    const [rules, setRules] = useState<PlaybookRule[]>([])
    const [clauses, setClauses] = useState<TemplateClause[]>([])
    const [mappings, setMappings] = useState<MappingRow[]>([])

    // UI state
    const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [sortMode, setSortMode] = useState<SortMode>('clause_order')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [linkingMode, setLinkingMode] = useState(false)
    const [bulkConfirmRunning, setBulkConfirmRunning] = useState(false)
    const [bulkConfirmThreshold, setBulkConfirmThreshold] = useState(80)
    const [showBulkConfirmOptions, setShowBulkConfirmOptions] = useState(false)

    // ---- Navigation guard -------------------------------------------------------

    const unconfirmedCount = mappings.filter(m => m.status === 'unconfirmed').length

    useEffect(() => {
        if (unconfirmedCount === 0) return
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [unconfirmedCount])

    const navigateBack = () => {
        if (unconfirmedCount > 0) {
            const ok = window.confirm(`You have ${unconfirmedCount} unconfirmed mapping${unconfirmedCount === 1 ? '' : 's'}.\n\nLeave anyway?`)
            if (!ok) return
        }
        router.push('/auth/company-admin?tab=templates')
    }

    // ---- Data loading -----------------------------------------------------------

    const loadData = useCallback(async () => {
        if (!templateId) return
        setLoading(true)
        setError(null)
        try {
            const supabase = createClient()

            const { data: tmpl, error: tmplErr } = await supabase
                .from('contract_templates')
                .select('template_id, template_name, linked_playbook_id, clause_count')
                .eq('template_id', templateId)
                .single()
            if (tmplErr || !tmpl) throw new Error(tmplErr?.message || 'Template not found')
            setTemplate(tmpl as TemplateMeta)

            const playbookId = tmpl.linked_playbook_id
            if (!playbookId) { setLoading(false); return }

            const { data: pb } = await supabase
                .from('company_playbooks')
                .select('playbook_id, playbook_name')
                .eq('playbook_id', playbookId)
                .single()
            if (pb) setPlaybook(pb as PlaybookMeta)

            const { data: pbRules } = await supabase
                .from('playbook_rules')
                .select('rule_id, clause_code, clause_name, category, ideal_position, minimum_position, maximum_position, fallback_position, importance_level, is_deal_breaker, is_non_negotiable')
                .eq('playbook_id', playbookId)
                .eq('is_active', true)
                .order('clause_name')
            setRules((pbRules || []) as PlaybookRule[])

            const { data: allClauses } = await supabase
                .from('template_clauses')
                .select('template_clause_id, clause_name, clause_number, category, display_order, is_header')
                .eq('template_id', templateId)
                .order('display_order')
            setClauses((allClauses || []).filter((c: any) => !c.is_header) as TemplateClause[])

            const { data: rawMappings, error: mapErr } = await supabase
                .from('playbook_rule_clause_map')
                .select('mapping_id, playbook_rule_id, template_clause_id, match_method, match_confidence, match_reason, status, confirmed_by, confirmed_at')
                .eq('template_id', templateId)
                .eq('playbook_id', playbookId)
                .neq('status', 'rejected')
            if (mapErr) throw new Error(mapErr.message)
            setMappings((rawMappings || []) as MappingRow[])
        } catch (e: any) {
            setError(e.message || 'Failed to load mapping data')
        } finally {
            setLoading(false)
        }
    }, [templateId])

    useEffect(() => { loadData() }, [loadData])

    // Auto-run mapping on first load if playbook linked but no mappings
    const autoMappingTriggered = useRef(false)
    useEffect(() => {
        if (autoMappingTriggered.current || loading || !template?.linked_playbook_id || mappings.length > 0) return
        autoMappingTriggered.current = true
        const autoRun = async () => {
            try {
                const supabase = createClient()
                await supabase.rpc('map_playbook_rules_to_template_clauses', {
                    template_id: templateId, playbook_id: template.linked_playbook_id, replace_existing: false,
                })
                await loadData()
            } catch (e: any) { console.error('Auto-mapping failed:', e.message) }
        }
        autoRun()
    }, [loading, template, mappings.length, templateId, loadData])

    // ---- Derived data -----------------------------------------------------------

    const ruleById = useMemo(() => {
        const map = new Map<string, PlaybookRule>()
        rules.forEach(r => map.set(r.rule_id, r))
        return map
    }, [rules])

    const clauseById = useMemo(() => {
        const map = new Map<string, TemplateClause>()
        clauses.forEach(c => map.set(c.template_clause_id, c))
        return map
    }, [clauses])

    const mappingByClauseId = useMemo(() => {
        const map = new Map<string, MappingRow>()
        mappings.forEach(m => {
            if (m.status !== 'rejected') map.set(m.template_clause_id, m)
        })
        return map
    }, [mappings])

    const mappedClauseIds = useMemo(() => new Set(mappings.map(m => m.template_clause_id)), [mappings])
    const confirmedCount = useMemo(() => mappings.filter(m => m.status === 'confirmed').length, [mappings])
    const unmappedCount = useMemo(() => clauses.filter(c => !mappedClauseIds.has(c.template_clause_id)).length, [clauses, mappedClauseIds])

    // ---- Filtered & sorted clauses ----------------------------------------------

    const filteredClauses = useMemo(() => {
        let result = clauses

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(c =>
                c.clause_name.toLowerCase().includes(q) ||
                (c.clause_number || '').toLowerCase().includes(q) ||
                (c.category || '').toLowerCase().includes(q)
            )
        }

        // Status filter
        if (statusFilter === 'unconfirmed') {
            result = result.filter(c => {
                const m = mappingByClauseId.get(c.template_clause_id)
                return m && m.status === 'unconfirmed'
            })
        } else if (statusFilter === 'unmapped') {
            result = result.filter(c => !mappedClauseIds.has(c.template_clause_id))
        } else if (statusFilter === 'confirmed') {
            result = result.filter(c => {
                const m = mappingByClauseId.get(c.template_clause_id)
                return m && m.status === 'confirmed'
            })
        }

        // Sort
        if (sortMode === 'clause_order') {
            result = [...result].sort((a, b) => a.display_order - b.display_order)
        } else {
            result = [...result].sort((a, b) => {
                const catCmp = (a.category || 'zzz').localeCompare(b.category || 'zzz')
                return catCmp !== 0 ? catCmp : a.display_order - b.display_order
            })
        }

        return result
    }, [clauses, searchQuery, statusFilter, sortMode, mappingByClauseId, mappedClauseIds])

    // The selected clause's mapping + matched rule
    const selectedMapping = selectedClauseId ? mappingByClauseId.get(selectedClauseId) : null
    const selectedRule = selectedMapping ? ruleById.get(selectedMapping.playbook_rule_id) : null

    // Candidate rules for linking mode — sorted by name, exclude already-mapped rules
    const candidateRules = useMemo(() => {
        if (!linkingMode) return []
        return rules.sort((a, b) => a.clause_name.localeCompare(b.clause_name))
    }, [rules, linkingMode])

    // ---- Actions ----------------------------------------------------------------

    const handleClauseClick = (clauseId: string) => {
        if (selectedClauseId === clauseId) {
            setSelectedClauseId(null)
            setLinkingMode(false)
        } else {
            setSelectedClauseId(clauseId)
            setLinkingMode(false)
        }
    }

    const handleRuleClick = async (ruleId: string) => {
        if (!selectedClauseId || !template?.linked_playbook_id || !linkingMode) return
        setActionLoading('new')
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            await supabase
                .from('playbook_rule_clause_map')
                .insert({
                    playbook_rule_id: ruleId,
                    template_clause_id: selectedClauseId,
                    template_id: templateId,
                    playbook_id: template.linked_playbook_id,
                    match_method: 'manual',
                    match_confidence: 100,
                    match_reason: 'Manually linked by user',
                    status: 'confirmed',
                    confirmed_by: user?.id,
                    confirmed_at: new Date().toISOString(),
                })
            await loadData()
            setLinkingMode(false)
        } finally {
            setActionLoading(null)
        }
    }

    const confirmMapping = async (mappingId: string) => {
        setActionLoading(mappingId)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
                .eq('mapping_id', mappingId)
            setMappings(prev => prev.map(m =>
                m.mapping_id === mappingId ? { ...m, status: 'confirmed' as const, confirmed_at: new Date().toISOString() } : m
            ))
        } finally {
            setActionLoading(null)
        }
    }

    const rejectMapping = async (mappingId: string) => {
        if (!window.confirm('Remove this mapping? The clause will become unmapped.')) return
        setActionLoading(mappingId)
        try {
            const supabase = createClient()
            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'rejected' })
                .eq('mapping_id', mappingId)
            setMappings(prev => prev.filter(m => m.mapping_id !== mappingId))
        } finally {
            setActionLoading(null)
        }
    }

    const bulkConfirm = async (threshold: number) => {
        const toConfirm = mappings.filter(m =>
            m.status === 'unconfirmed' && m.match_confidence >= threshold
        )
        if (toConfirm.length === 0) {
            alert('No unconfirmed mappings match that threshold.')
            return
        }
        if (!window.confirm(`Confirm ${toConfirm.length} mapping${toConfirm.length === 1 ? '' : 's'} with confidence ≥ ${threshold}%?`)) return

        setBulkConfirmRunning(true)
        setShowBulkConfirmOptions(false)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const ids = toConfirm.map(m => m.mapping_id)

            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
                .in('mapping_id', ids)

            setMappings(prev => prev.map(m =>
                ids.includes(m.mapping_id) ? { ...m, status: 'confirmed' as const, confirmed_at: new Date().toISOString() } : m
            ))
        } finally {
            setBulkConfirmRunning(false)
        }
    }

    const confirmAllVisible = async () => {
        const visibleUnconfirmed = filteredClauses
            .map(c => mappingByClauseId.get(c.template_clause_id))
            .filter((m): m is MappingRow => !!m && m.status === 'unconfirmed')

        if (visibleUnconfirmed.length === 0) return
        if (!window.confirm(`Confirm ${visibleUnconfirmed.length} visible mapping${visibleUnconfirmed.length === 1 ? '' : 's'}?`)) return

        setBulkConfirmRunning(true)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const ids = visibleUnconfirmed.map(m => m.mapping_id)

            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'confirmed', confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
                .in('mapping_id', ids)

            setMappings(prev => prev.map(m =>
                ids.includes(m.mapping_id) ? { ...m, status: 'confirmed' as const, confirmed_at: new Date().toISOString() } : m
            ))
        } finally {
            setBulkConfirmRunning(false)
        }
    }

    const runAutoMapping = async () => {
        if (!template?.linked_playbook_id) return
        if (mappings.length > 0 && !window.confirm('Run auto-mapping? Existing confirmed mappings are preserved.')) return
        setBulkConfirmRunning(true)
        try {
            const supabase = createClient()
            await supabase.rpc('map_playbook_rules_to_template_clauses', {
                template_id: templateId, playbook_id: template.linked_playbook_id, replace_existing: false,
            })
            await loadData()
        } catch (e: any) {
            alert('Auto-mapping failed: ' + e.message)
        } finally {
            setBulkConfirmRunning(false)
        }
    }

    // ---- Render: loading / error / no playbook ----------------------------------

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-600 text-sm">Loading clause mappings...</p>
            </div>
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <button onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 hover:underline">Go back</button>
            </div>
        </div>
    )

    if (!template?.linked_playbook_id) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center max-w-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-2">No playbook linked</h2>
                <p className="text-sm text-slate-500 mb-4">Link a playbook from the Templates tab first.</p>
                <button onClick={() => router.push('/auth/company-admin?tab=templates')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    Go to Templates
                </button>
            </div>
        </div>
    )

    // ---- Visible unconfirmed count (for bulk confirm button) --------------------
    const visibleUnconfirmedCount = filteredClauses
        .map(c => mappingByClauseId.get(c.template_clause_id))
        .filter(m => m && m.status === 'unconfirmed').length

    // ---- Main render ------------------------------------------------------------

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* ===== HEADER ===== */}
            <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={navigateBack} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 flex-shrink-0" title="Back to Templates">
                            <BackIcon />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-slate-900 truncate">{template.template_name}</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Mapping Workspace
                                {playbook && <> &middot; <span className="text-indigo-600">{playbook.playbook_name}</span></>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={runAutoMapping}
                            disabled={bulkConfirmRunning}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50"
                        >
                            Run Auto-Map
                        </button>
                        {/* Bulk confirm dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowBulkConfirmOptions(!showBulkConfirmOptions)}
                                disabled={bulkConfirmRunning || unconfirmedCount === 0}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {bulkConfirmRunning ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <CheckIcon className="w-3.5 h-3.5" />
                                )}
                                Bulk Confirm
                                {unconfirmedCount > 0 && (
                                    <span className="bg-emerald-500 px-1.5 py-0.5 rounded text-[10px]">{unconfirmedCount}</span>
                                )}
                            </button>
                            {showBulkConfirmOptions && (
                                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-20 p-3">
                                    <div className="text-xs font-medium text-slate-700 mb-2">Confirm by confidence threshold</div>
                                    <div className="flex gap-1.5 mb-3">
                                        {[100, 90, 80, 50].map(t => {
                                            const count = mappings.filter(m => m.status === 'unconfirmed' && m.match_confidence >= t).length
                                            return (
                                                <button
                                                    key={t}
                                                    onClick={() => bulkConfirm(t)}
                                                    disabled={count === 0}
                                                    className="flex-1 px-2 py-1.5 text-[10px] font-medium rounded border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    ≥{t}%
                                                    <br />
                                                    <span className="text-emerald-600">{count}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {visibleUnconfirmedCount > 0 && statusFilter !== 'all' && (
                                        <button
                                            onClick={confirmAllVisible}
                                            className="w-full px-2 py-1.5 text-xs font-medium rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 mb-2"
                                        >
                                            Confirm all {visibleUnconfirmedCount} visible
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowBulkConfirmOptions(false)}
                                        className="w-full text-[10px] text-slate-400 hover:text-slate-600 mt-1"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-3 mb-3">
                    {[
                        { label: 'Clauses', value: clauses.length, color: 'text-slate-900' },
                        { label: 'Mapped', value: mappedClauseIds.size, color: 'text-indigo-600' },
                        { label: 'Unmapped', value: unmappedCount, color: unmappedCount > 0 ? 'text-amber-600' : 'text-slate-400' },
                        { label: 'Confirmed', value: confirmedCount, color: 'text-emerald-600' },
                        { label: 'Unconfirmed', value: unconfirmedCount, color: unconfirmedCount > 0 ? 'text-amber-600' : 'text-slate-400' },
                        { label: 'Rules', value: rules.length, color: 'text-slate-900' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-lg px-4 py-2 border border-slate-200 flex-1">
                            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{s.label}</div>
                            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Filter bar */}
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 max-w-xs">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2"><SearchIcon /></div>
                        <input
                            type="text"
                            placeholder="Search clauses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Status filter tabs */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        {([
                            { key: 'all', label: 'All', count: clauses.length },
                            { key: 'unconfirmed', label: 'Unconfirmed', count: unconfirmedCount },
                            { key: 'unmapped', label: 'Unmapped', count: unmappedCount },
                            { key: 'confirmed', label: 'Confirmed', count: confirmedCount },
                        ] as { key: StatusFilter; label: string; count: number }[]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                    statusFilter === tab.key
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.label}
                                <span className={`ml-1.5 ${statusFilter === tab.key ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Sort toggle */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setSortMode('clause_order')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                sortMode === 'clause_order' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Clause Order
                        </button>
                        <button
                            onClick={() => setSortMode('category')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                sortMode === 'category' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            By Category
                        </button>
                    </div>

                    <div className="text-[10px] text-slate-400">{filteredClauses.length} shown</div>
                </div>
            </div>

            {/* ===== MAIN CONTENT: Left clauses / Right detail ===== */}
            <div className="flex-1 flex overflow-hidden">

                {/* ===== LEFT: Clause list ===== */}
                <div className="w-[45%] overflow-y-auto border-r border-slate-200">
                    {filteredClauses.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-slate-400">
                            No clauses match the current filter
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredClauses.map(clause => {
                                const mapping = mappingByClauseId.get(clause.template_clause_id)
                                const rule = mapping ? ruleById.get(mapping.playbook_rule_id) : null
                                const isSelected = selectedClauseId === clause.template_clause_id
                                const isMapped = !!mapping

                                return (
                                    <div
                                        key={clause.template_clause_id}
                                        onClick={() => handleClauseClick(clause.template_clause_id)}
                                        className={`px-4 py-3 cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            {/* Status indicator */}
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                                mapping?.status === 'confirmed' ? 'bg-emerald-500' :
                                                mapping?.status === 'unconfirmed' ? 'bg-amber-400' :
                                                'bg-slate-300'
                                            }`} />

                                            {/* Clause number */}
                                            <span className="inline-block bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 min-w-[28px] text-center">
                                                {clause.clause_number || '—'}
                                            </span>

                                            {/* Clause name + rule name */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium text-slate-800 truncate">{clause.clause_name}</div>
                                                {rule && (
                                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                        → {rule.clause_name}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Confidence + inline confirm */}
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {isMapped && mapping && (
                                                    <span className="text-[10px] font-bold" style={{ color: confidenceColor(mapping.match_confidence) }}>
                                                        {mapping.match_confidence}%
                                                    </span>
                                                )}
                                                {mapping?.status === 'unconfirmed' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); confirmMapping(mapping.mapping_id) }}
                                                        disabled={actionLoading === mapping.mapping_id}
                                                        className="p-1 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors disabled:opacity-50"
                                                        title="Confirm this mapping"
                                                    >
                                                        <CheckIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {mapping?.status === 'confirmed' && (
                                                    <div className="p-1 rounded-full bg-emerald-100 text-emerald-600">
                                                        <CheckIcon className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* ===== RIGHT: Detail panel ===== */}
                <div className="w-[55%] overflow-y-auto p-6 bg-slate-50">
                    {!selectedClauseId ? (
                        /* Empty state */
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-1">Select a clause</h3>
                            <p className="text-xs text-slate-500 max-w-xs">
                                Click a clause on the left to see its mapped playbook rule and details.
                            </p>
                        </div>

                    ) : linkingMode ? (
                        /* Linking mode: pick a rule */
                        <div>
                            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <p className="text-xs text-indigo-800 font-medium">
                                    Linking: <strong>{clauseById.get(selectedClauseId)?.clause_number}</strong> {clauseById.get(selectedClauseId)?.clause_name}
                                </p>
                                <p className="text-[10px] text-indigo-600 mt-0.5">Click a rule to create the mapping.</p>
                                <button onClick={() => setLinkingMode(false)} className="mt-2 text-[10px] text-indigo-500 hover:text-indigo-700 underline">
                                    Cancel
                                </button>
                            </div>
                            <div className="space-y-2">
                                {candidateRules.map(rule => (
                                    <div
                                        key={rule.rule_id}
                                        onClick={() => handleRuleClick(rule.rule_id)}
                                        className="p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="text-xs font-semibold text-slate-800 leading-tight">{rule.clause_name}</h3>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {rule.is_deal_breaker && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">DB</span>}
                                                {rule.is_non_negotiable && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">NN</span>}
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                            {(rule.category || 'uncategorised').replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    ) : (
                        /* Detail view for selected clause */
                        <div>
                            {/* Selected clause header */}
                            <div className="mb-4 p-4 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-start gap-2 mb-2">
                                    <span className="inline-block bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                                        {clauseById.get(selectedClauseId)?.clause_number || '—'}
                                    </span>
                                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                                        {clauseById.get(selectedClauseId)?.clause_name}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                        {(clauseById.get(selectedClauseId)?.category || 'uncategorised').replace(/_/g, ' ')}
                                    </span>
                                    {selectedMapping ? (
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                                            selectedMapping.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {selectedMapping.status === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Unmapped</span>
                                    )}
                                </div>
                            </div>

                            {selectedMapping && selectedRule ? (
                                /* Matched rule detail */
                                <div className="space-y-4">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Mapped Rule</div>

                                    <div className="p-4 rounded-lg border border-slate-200 bg-white">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h3 className="text-sm font-bold text-slate-900 leading-tight">{selectedRule.clause_name}</h3>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {selectedRule.is_deal_breaker && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Deal Breaker</span>}
                                                {selectedRule.is_non_negotiable && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Non-Negotiable</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                {(selectedRule.category || '').replace(/_/g, ' ')}
                                            </span>
                                            {selectedRule.importance_level && (
                                                <span className="text-[9px] text-slate-500">Importance: {selectedRule.importance_level}/10</span>
                                            )}
                                        </div>

                                        {/* ═══ UNIFIED POSITION BAR ═══ */}
                                        <div className="mb-3">
                                            <div className="text-[10px] font-medium text-slate-500 mb-1">Negotiation Position Range</div>
                                            <PositionBar
                                                playbook={{
                                                    ideal: selectedRule.ideal_position,
                                                    fallback: selectedRule.fallback_position,
                                                    minimum: selectedRule.minimum_position,
                                                    maximum: selectedRule.maximum_position,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Match details */}
                                    <div className="p-4 bg-white rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Match Details</div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-600">Confidence</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${selectedMapping.match_confidence}%`, backgroundColor: confidenceColor(selectedMapping.match_confidence) }} />
                                                    </div>
                                                    <span className="text-xs font-bold" style={{ color: confidenceColor(selectedMapping.match_confidence) }}>
                                                        {selectedMapping.match_confidence}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-600">Method</span>
                                                <span className="text-xs font-medium text-slate-800">{methodLabel[selectedMapping.match_method] || selectedMapping.match_method}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-600">Status</span>
                                                <span className={`text-xs font-medium ${selectedMapping.status === 'confirmed' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                    {selectedMapping.status === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}
                                                </span>
                                            </div>
                                            {selectedMapping.match_reason && (
                                                <div className="mt-2 pt-2 border-t border-slate-100">
                                                    <div className="text-[10px] font-medium text-slate-500 mb-1">AI Rationale</div>
                                                    <p className="text-xs text-slate-700 leading-relaxed">{selectedMapping.match_reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-2">
                                        {selectedMapping.status === 'unconfirmed' && (
                                            <button
                                                onClick={() => confirmMapping(selectedMapping.mapping_id)}
                                                disabled={actionLoading === selectedMapping.mapping_id}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex-1 justify-center disabled:opacity-50"
                                            >
                                                <CheckIcon /> Confirm Mapping
                                            </button>
                                        )}
                                        <button
                                            onClick={() => rejectMapping(selectedMapping.mapping_id)}
                                            disabled={actionLoading === selectedMapping.mapping_id}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors flex-1 justify-center disabled:opacity-50"
                                        >
                                            <XIcon /> Reject
                                        </button>
                                        <button
                                            onClick={() => setLinkingMode(true)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors flex-1 justify-center"
                                        >
                                            Remap
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Unmapped clause — prompt to link */
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-1">No rule mapped</h3>
                                    <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                                        This clause doesn&apos;t have a playbook rule linked to it yet.
                                    </p>
                                    <button
                                        onClick={() => setLinkingMode(true)}
                                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Link a Rule
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom linking mode bar */}
            {linkingMode && selectedClauseId && (
                <div className="flex-shrink-0 bg-indigo-600 text-white px-6 py-2 text-sm text-center">
                    Linking mode: click a rule on the right to map it to <strong>{clauseById.get(selectedClauseId)?.clause_number} {clauseById.get(selectedClauseId)?.clause_name}</strong>
                </div>
            )}
        </div>
    )
}
