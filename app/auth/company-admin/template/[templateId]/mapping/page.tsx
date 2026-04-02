'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
// INLINE ICONS
// ============================================================================

const SearchIcon = () => (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
)
const CheckIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
)

// ============================================================================
// CATEGORY COLOURS
// ============================================================================

const catColors: Record<string, { bg: string; badge: string; border: string; headerBg: string }> = {
    data_protection:          { bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700',   border: 'border-purple-200',  headerBg: 'bg-purple-50' },
    dispute_resolution:       { bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',       border: 'border-blue-200',    headerBg: 'bg-blue-50' },
    employment:               { bg: 'bg-indigo-50',  badge: 'bg-indigo-100 text-indigo-700',   border: 'border-indigo-200',  headerBg: 'bg-indigo-50' },
    exit_transition:          { bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700',     border: 'border-amber-200',   headerBg: 'bg-amber-50' },
    governance:               { bg: 'bg-teal-50',    badge: 'bg-teal-100 text-teal-700',       border: 'border-teal-200',    headerBg: 'bg-teal-50' },
    liability:                { bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',         border: 'border-red-200',     headerBg: 'bg-red-50' },
    scope:                    { bg: 'bg-green-50',   badge: 'bg-green-100 text-green-700',     border: 'border-green-200',   headerBg: 'bg-green-50' },
    service_levels:           { bg: 'bg-cyan-50',    badge: 'bg-cyan-100 text-cyan-700',       border: 'border-cyan-200',    headerBg: 'bg-cyan-50' },
    subcontracting:           { bg: 'bg-lime-50',    badge: 'bg-lime-100 text-lime-700',       border: 'border-lime-200',    headerBg: 'bg-lime-50' },
    termination:              { bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700',   border: 'border-orange-200',  headerBg: 'bg-orange-50' },
    insurance:                { bg: 'bg-pink-50',    badge: 'bg-pink-100 text-pink-700',       border: 'border-pink-200',    headerBg: 'bg-pink-50' },
    compliance_and_regulatory:{ bg: 'bg-slate-50',   badge: 'bg-slate-100 text-slate-700',     border: 'border-slate-200',   headerBg: 'bg-slate-50' },
    general_provisions:       { bg: 'bg-stone-50',   badge: 'bg-stone-100 text-stone-700',     border: 'border-stone-200',   headerBg: 'bg-stone-50' },
    change_management:        { bg: 'bg-sky-50',     badge: 'bg-sky-100 text-sky-700',         border: 'border-sky-200',     headerBg: 'bg-sky-50' },
    audit_rights:             { bg: 'bg-violet-50',  badge: 'bg-violet-100 text-violet-700',   border: 'border-violet-200',  headerBg: 'bg-violet-50' },
    payment_terms:            { bg: 'bg-fuchsia-50', badge: 'bg-fuchsia-100 text-fuchsia-700', border: 'border-fuchsia-200', headerBg: 'bg-fuchsia-50' },
    representations:          { bg: 'bg-rose-50',    badge: 'bg-rose-100 text-rose-700',       border: 'border-rose-200',    headerBg: 'bg-rose-50' },
    liability_and_indemnity:  { bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',         border: 'border-red-200',     headerBg: 'bg-red-50' },
    intellectual_property:    { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', headerBg: 'bg-emerald-50' },
    confidentiality:          { bg: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-700',       border: 'border-gray-200',    headerBg: 'bg-gray-50' },
    scope_of_services:        { bg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-700',   border: 'border-yellow-200',  headerBg: 'bg-yellow-50' },
    force_majeure:            { bg: 'bg-neutral-50', badge: 'bg-neutral-200 text-neutral-700', border: 'border-neutral-200', headerBg: 'bg-neutral-50' },
}

const getColor = (cat: string | null) =>
    catColors[cat || ''] || { bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600', border: 'border-slate-200', headerBg: 'bg-slate-50' }

const getLineColor = (confidence: number) => {
    if (confidence >= 80) return '#22c55e'
    if (confidence >= 60) return '#eab308'
    if (confidence >= 40) return '#ef4444'
    return '#1f2937'
}

const toPercent = (v: number) => ((v - 1) / 9) * 100

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
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
    const [showAllLines, setShowAllLines] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [linkingMode, setLinkingMode] = useState(false) // true when user wants to link a clause to a rule

    // SVG state
    const [svgPaths, setSvgPaths] = useState<Array<{ mapping: MappingRow; path: string }>>([])

    // Refs
    const clauseCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const ruleCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const leftColRef = useRef<HTMLDivElement>(null)
    const rightColRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)

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
            const ok = window.confirm(
                `You have ${unconfirmedCount} unconfirmed mapping${unconfirmedCount === 1 ? '' : 's'}.\n\nLeave anyway?`
            )
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

    // Build lookup maps
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

    // Mapping lookups
    const mappingByClauseId = useMemo(() => {
        const map = new Map<string, MappingRow>()
        mappings.forEach(m => map.set(m.template_clause_id, m))
        return map
    }, [mappings])

    const mappedClauseIds = useMemo(() => new Set(mappings.map(m => m.template_clause_id)), [mappings])
    const confirmedCount = useMemo(() => mappings.filter(m => m.status === 'confirmed').length, [mappings])

    // Group clauses by category
    const clausesByCategory = useMemo(() => {
        const groups = new Map<string, TemplateClause[]>()
        const filtered = clauses.filter(c => {
            if (!searchQuery) return true
            return c.clause_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.clause_number || '').toLowerCase().includes(searchQuery.toLowerCase())
        })
        filtered.forEach(c => {
            const cat = c.category || 'uncategorised'
            if (!groups.has(cat)) groups.set(cat, [])
            groups.get(cat)!.push(c)
        })
        return groups
    }, [clauses, searchQuery])

    // Sorted category keys
    const sortedCategories = useMemo(() =>
        Array.from(clausesByCategory.keys()).sort((a, b) => {
            // Put uncategorised last
            if (a === 'uncategorised') return 1
            if (b === 'uncategorised') return -1
            return a.localeCompare(b)
        }),
    [clausesByCategory])

    // Category stats
    const categoryStats = useMemo(() => {
        const stats = new Map<string, { total: number; mapped: number; confirmed: number; unconfirmed: number }>()
        sortedCategories.forEach(cat => {
            const catClauses = clausesByCategory.get(cat) || []
            let mapped = 0, confirmed = 0, unconfirmed = 0
            catClauses.forEach(c => {
                const m = mappingByClauseId.get(c.template_clause_id)
                if (m) {
                    mapped++
                    if (m.status === 'confirmed') confirmed++
                    else unconfirmed++
                }
            })
            stats.set(cat, { total: catClauses.length, mapped, confirmed, unconfirmed })
        })
        return stats
    }, [sortedCategories, clausesByCategory, mappingByClauseId])

    // The selected clause's mapping + matched rule
    const selectedMapping = selectedClauseId ? mappingByClauseId.get(selectedClauseId) : null
    const selectedRule = selectedMapping ? ruleById.get(selectedMapping.playbook_rule_id) : null

    // Rules for the right panel — either the matched rule or candidate rules for linking
    const candidateRules = useMemo(() => {
        if (!selectedClauseId || !linkingMode) return []
        const clause = clauseById.get(selectedClauseId)
        if (!clause) return []
        // Show rules in the same category first, then all others
        const sameCategory = rules.filter(r => r.category === clause.category)
        const others = rules.filter(r => r.category !== clause.category)
        return [...sameCategory, ...others]
    }, [selectedClauseId, linkingMode, clauseById, rules])

    // ---- SVG path calculation ---------------------------------------------------

    const updatePaths = useCallback(() => {
        if (!svgRef.current) return
        const svgRect = svgRef.current.getBoundingClientRect()

        const visibleMappings = showAllLines
            ? mappings
            : selectedClauseId
                ? mappings.filter(m => m.template_clause_id === selectedClauseId)
                : []

        const paths = visibleMappings
            .map(mapping => {
                const clauseEl = clauseCardRefs.current[mapping.template_clause_id]
                const ruleEl = ruleCardRefs.current[mapping.playbook_rule_id]
                if (!clauseEl || !ruleEl) return null
                const cr = clauseEl.getBoundingClientRect()
                const rr = ruleEl.getBoundingClientRect()
                const x1 = cr.right - svgRect.left
                const y1 = cr.top - svgRect.top + cr.height / 2
                const x2 = rr.left - svgRect.left
                const y2 = rr.top - svgRect.top + rr.height / 2
                const cpX = (x2 - x1) * 0.4
                return { mapping, path: `M ${x1} ${y1} C ${x1 + cpX} ${y1}, ${x2 - cpX} ${y2}, ${x2} ${y2}` }
            })
            .filter(Boolean) as Array<{ mapping: MappingRow; path: string }>
        setSvgPaths(paths)
    }, [mappings, showAllLines, selectedClauseId])

    useEffect(() => {
        updatePaths()
        const timer = setTimeout(updatePaths, 150)
        const onScroll = () => updatePaths()
        const leftCol = leftColRef.current
        const rightCol = rightColRef.current
        leftCol?.addEventListener('scroll', onScroll)
        rightCol?.addEventListener('scroll', onScroll)
        window.addEventListener('resize', onScroll)
        return () => {
            clearTimeout(timer)
            leftCol?.removeEventListener('scroll', onScroll)
            rightCol?.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
        }
    }, [updatePaths, expandedCategories, selectedClauseId, showAllLines])

    // ---- Actions ----------------------------------------------------------------

    const handleClauseClick = (clauseId: string) => {
        if (selectedClauseId === clauseId) {
            setSelectedClauseId(null)
            setLinkingMode(false)
        } else {
            setSelectedClauseId(clauseId)
            setLinkingMode(false)
            // Scroll right panel to the matched rule if it exists
            const mapping = mappingByClauseId.get(clauseId)
            if (mapping) {
                setTimeout(() => {
                    ruleCardRefs.current[mapping.playbook_rule_id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 100)
            }
        }
        setTimeout(updatePaths, 100)
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
            setTimeout(updatePaths, 50)
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
            setTimeout(updatePaths, 50)
        }
    }

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(cat)) next.delete(cat)
            else next.add(cat)
            return next
        })
    }

    const expandAll = () => setExpandedCategories(new Set(sortedCategories))
    const collapseAll = () => { setExpandedCategories(new Set()); setSelectedClauseId(null); setLinkingMode(false) }

    // ---- Render: loading / error / no playbook states ---------------------------

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
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

    // ---- Main render ------------------------------------------------------------

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header */}
            <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex justify-between items-center mb-3">
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
                    {/* View toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAllLines(!showAllLines)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                showAllLines
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {showAllLines ? 'All Connectors' : 'Focus Mode'}
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-3 mb-3">
                    {[
                        { label: 'Clauses', value: clauses.length, color: 'text-slate-900' },
                        { label: 'Mapped', value: mappedClauseIds.size, color: 'text-indigo-600' },
                        { label: 'Unmapped', value: clauses.length - mappedClauseIds.size, color: clauses.length - mappedClauseIds.size > 0 ? 'text-amber-600' : 'text-slate-400' },
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

                {/* Search + expand/collapse */}
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
                    <button onClick={expandAll} className="px-2.5 py-1.5 rounded text-xs font-medium bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                        Expand All
                    </button>
                    <button onClick={collapseAll} className="px-2.5 py-1.5 rounded text-xs font-medium bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                        Collapse All
                    </button>
                    <div className="text-[10px] text-slate-400">{sortedCategories.length} categories</div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 relative overflow-hidden">
                {/* SVG connector layer */}
                <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                    {svgPaths.map((p) => (
                        <g key={p.mapping.mapping_id}>
                            <path
                                d={p.path}
                                stroke={getLineColor(p.mapping.match_confidence)}
                                strokeWidth={2}
                                fill="none"
                                strokeDasharray={p.mapping.status === 'confirmed' ? '0' : '6,4'}
                                opacity={0.8}
                            />
                            {/* Confidence badge at midpoint */}
                            {(() => {
                                const parts = p.path.split(' ')
                                const mx = parseFloat(parts[1])
                                const my = parseFloat(parts[2])
                                const endX = parseFloat(parts[parts.length - 2])
                                const endY = parseFloat(parts[parts.length - 1])
                                const midX = (mx + endX) / 2
                                const midY = (my + endY) / 2
                                return (
                                    <g>
                                        <rect x={midX - 18} y={midY - 10} width="36" height="20" rx="4" fill="white" stroke={getLineColor(p.mapping.match_confidence)} strokeWidth="1" />
                                        <text x={midX} y={midY + 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill={getLineColor(p.mapping.match_confidence)}>{p.mapping.match_confidence}%</text>
                                    </g>
                                )
                            })()}
                        </g>
                    ))}
                </svg>

                <div className="flex h-full">
                    {/* ===== LEFT COLUMN: Clauses grouped by category ===== */}
                    <div ref={leftColRef} className="w-[45%] overflow-y-auto p-4 space-y-2">
                        {sortedCategories.map(cat => {
                            const catClauses = clausesByCategory.get(cat) || []
                            const stats = categoryStats.get(cat)!
                            const isOpen = expandedCategories.has(cat)
                            const c = getColor(cat)

                            return (
                                <div key={cat} className={`rounded-lg border ${c.border} overflow-hidden`}>
                                    {/* Category header */}
                                    <button
                                        onClick={() => toggleCategory(cat)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${c.headerBg} hover:brightness-95 transition-all text-left`}
                                    >
                                        <ChevronIcon open={isOpen} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800 capitalize">
                                                    {cat.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-[10px] text-slate-500">{stats.total} clause{stats.total !== 1 ? 's' : ''}</span>
                                            </div>
                                            {/* Mini stats */}
                                            <div className="flex items-center gap-2 mt-1">
                                                {stats.confirmed > 0 && (
                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{stats.confirmed} confirmed</span>
                                                )}
                                                {stats.unconfirmed > 0 && (
                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{stats.unconfirmed} unconfirmed</span>
                                                )}
                                                {stats.total - stats.mapped > 0 && (
                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{stats.total - stats.mapped} unmapped</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Progress ring */}
                                        <div className="flex-shrink-0 relative w-8 h-8">
                                            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                                                <circle cx="16" cy="16" r="12" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                                <circle cx="16" cy="16" r="12" fill="none"
                                                    stroke={stats.mapped === stats.total ? '#22c55e' : stats.mapped > 0 ? '#6366f1' : '#cbd5e1'}
                                                    strokeWidth="3"
                                                    strokeDasharray={`${(stats.mapped / Math.max(stats.total, 1)) * 75.4} 75.4`}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                {stats.mapped}/{stats.total}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Clause list (expanded) */}
                                    {isOpen && (
                                        <div className="border-t border-slate-100 bg-white divide-y divide-slate-50">
                                            {catClauses.map(clause => {
                                                const mapping = mappingByClauseId.get(clause.template_clause_id)
                                                const isSelected = selectedClauseId === clause.template_clause_id
                                                const isMapped = !!mapping
                                                return (
                                                    <div
                                                        key={clause.template_clause_id}
                                                        ref={el => { clauseCardRefs.current[clause.template_clause_id] = el }}
                                                        onClick={() => handleClauseClick(clause.template_clause_id)}
                                                        className={`px-3 py-2.5 cursor-pointer transition-all ${
                                                            isSelected
                                                                ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400'
                                                                : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {/* Status dot */}
                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                                mapping?.status === 'confirmed' ? 'bg-emerald-500' :
                                                                mapping?.status === 'unconfirmed' ? 'bg-amber-400' :
                                                                'bg-slate-300'
                                                            }`} />
                                                            <span className="inline-block bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                                                                {clause.clause_number || '—'}
                                                            </span>
                                                            <span className="text-xs text-slate-800 font-medium truncate">{clause.clause_name}</span>
                                                            {isMapped && mapping && (
                                                                <span className="ml-auto text-[9px] font-bold flex-shrink-0" style={{ color: getLineColor(mapping.match_confidence) }}>
                                                                    {mapping.match_confidence}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Center gap for connectors */}
                    <div className="w-[10%] flex-shrink-0" />

                    {/* ===== RIGHT COLUMN: Rule detail panel ===== */}
                    <div ref={rightColRef} className="w-[45%] overflow-y-auto p-4">
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
                                    Expand a category on the left and click a clause to see its mapped playbook rule and details.
                                </p>
                            </div>
                        ) : linkingMode ? (
                            /* Linking mode: show candidate rules */
                            <div>
                                <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <p className="text-xs text-indigo-800 font-medium">
                                        Linking: <strong>{clauseById.get(selectedClauseId)?.clause_number}</strong> {clauseById.get(selectedClauseId)?.clause_name}
                                    </p>
                                    <p className="text-[10px] text-indigo-600 mt-0.5">Click a rule below to create the mapping.</p>
                                    <button
                                        onClick={() => setLinkingMode(false)}
                                        className="mt-2 text-[10px] text-indigo-500 hover:text-indigo-700 underline"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {candidateRules.map(rule => {
                                        const c = getColor(rule.category)
                                        return (
                                            <div
                                                key={rule.rule_id}
                                                ref={el => { ruleCardRefs.current[rule.rule_id] = el }}
                                                onClick={() => handleRuleClick(rule.rule_id)}
                                                className={`p-3 rounded-lg border border-slate-200 ${c.bg} cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:shadow-md transition-all`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h3 className="text-xs font-semibold text-slate-800 leading-tight">{rule.clause_name}</h3>
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        {rule.is_deal_breaker && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">DB</span>}
                                                        {rule.is_non_negotiable && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">NN</span>}
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.badge}`}>
                                                    {(rule.category || '').replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Detail view for selected clause */
                            <div>
                                {/* Selected clause header */}
                                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-start gap-2 mb-2">
                                        <span className="inline-block bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                                            {clauseById.get(selectedClauseId)?.clause_number || '—'}
                                        </span>
                                        <h2 className="text-sm font-bold text-slate-900 leading-tight">
                                            {clauseById.get(selectedClauseId)?.clause_name}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${getColor(clauseById.get(selectedClauseId)?.category || null).badge}`}>
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
                                    /* Matched rule detail card */
                                    <div
                                        ref={el => { ruleCardRefs.current[selectedMapping.playbook_rule_id] = el }}
                                        className="space-y-4"
                                    >
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Mapped Rule</div>

                                        <div className={`p-4 rounded-lg border ${getColor(selectedRule.category).border} ${getColor(selectedRule.category).bg}`}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="text-sm font-bold text-slate-900 leading-tight">{selectedRule.clause_name}</h3>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    {selectedRule.is_deal_breaker && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Deal Breaker</span>}
                                                    {selectedRule.is_non_negotiable && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Non-Negotiable</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mb-3">
                                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${getColor(selectedRule.category).badge}`}>
                                                    {(selectedRule.category || '').replace(/_/g, ' ')}
                                                </span>
                                                {selectedRule.importance_level && (
                                                    <span className="text-[9px] text-slate-500">Importance: {selectedRule.importance_level}/10</span>
                                                )}
                                            </div>

                                            {/* Position bar */}
                                            <div className="mb-3">
                                                <div className="text-[10px] font-medium text-slate-500 mb-1">Negotiation Position Range</div>
                                                <div className="relative h-5 bg-slate-100 rounded-full overflow-visible">
                                                    <div
                                                        className="absolute top-1 h-3 bg-amber-100 rounded-full border border-amber-200"
                                                        style={{ left: `${toPercent(selectedRule.minimum_position)}%`, width: `${Math.max(2, toPercent(selectedRule.maximum_position) - toPercent(selectedRule.minimum_position))}%` }}
                                                    />
                                                    <div
                                                        className="absolute top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                                                        style={{ left: `${toPercent(selectedRule.ideal_position)}%`, transform: 'translateX(-50%)' }}
                                                        title={`Ideal: ${selectedRule.ideal_position}`}
                                                    />
                                                    <div
                                                        className="absolute top-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm"
                                                        style={{ left: `${toPercent(selectedRule.fallback_position)}%`, transform: 'translateX(-50%)' }}
                                                        title={`Fallback: ${selectedRule.fallback_position}`}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1">
                                                    <span>1 (Strong)</span>
                                                    <span>5</span>
                                                    <span>10 (Weak)</span>
                                                </div>
                                                <div className="flex gap-4 mt-1 text-[9px]">
                                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Ideal: {selectedRule.ideal_position}</span>
                                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Fallback: {selectedRule.fallback_position}</span>
                                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block"></span> Range: {selectedRule.minimum_position}–{selectedRule.maximum_position}</span>
                                                </div>
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
                                                            <div className="h-full rounded-full" style={{ width: `${selectedMapping.match_confidence}%`, backgroundColor: getLineColor(selectedMapping.match_confidence) }} />
                                                        </div>
                                                        <span className="text-xs font-bold" style={{ color: getLineColor(selectedMapping.match_confidence) }}>
                                                            {selectedMapping.match_confidence}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-600">Match Method</span>
                                                    <span className="text-xs font-medium text-slate-800 capitalize">{selectedMapping.match_method.replace(/_/g, ' ')}</span>
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
            </div>

            {/* Bottom hint bar */}
            {linkingMode && selectedClauseId && (
                <div className="flex-shrink-0 bg-indigo-600 text-white px-6 py-2 text-sm text-center">
                    Linking mode: click a rule on the right to map it to <strong>{clauseById.get(selectedClauseId)?.clause_number} {clauseById.get(selectedClauseId)?.clause_name}</strong>
                </div>
            )}
        </div>
    )
}
