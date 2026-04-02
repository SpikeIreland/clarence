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
const LinkIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
)

// ============================================================================
// CATEGORY COLOURS
// ============================================================================

const catColors: Record<string, { bg: string; badge: string }> = {
    data_protection: { bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
    dispute_resolution: { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
    employment: { bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
    exit_transition: { bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
    governance: { bg: 'bg-teal-50', badge: 'bg-teal-100 text-teal-700' },
    liability: { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
    scope: { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
    service_levels: { bg: 'bg-cyan-50', badge: 'bg-cyan-100 text-cyan-700' },
    subcontracting: { bg: 'bg-lime-50', badge: 'bg-lime-100 text-lime-700' },
    termination: { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
    insurance: { bg: 'bg-pink-50', badge: 'bg-pink-100 text-pink-700' },
    compliance_and_regulatory: { bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-700' },
    general_provisions: { bg: 'bg-stone-50', badge: 'bg-stone-100 text-stone-700' },
    change_management: { bg: 'bg-sky-50', badge: 'bg-sky-100 text-sky-700' },
    audit_rights: { bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700' },
    payment_terms: { bg: 'bg-fuchsia-50', badge: 'bg-fuchsia-100 text-fuchsia-700' },
    representations: { bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700' },
    liability_and_indemnity: { bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
    intellectual_property: { bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
    confidentiality: { bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-700' },
    scope_of_services: { bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
    force_majeure: { bg: 'bg-neutral-50', badge: 'bg-neutral-200 text-neutral-700' },
}

const getColor = (cat: string | null) => catColors[cat || ''] || { bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600' }

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
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [hoveredMapping, setHoveredMapping] = useState<number | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
    const [svgPaths, setSvgPaths] = useState<Array<{ mapping: MappingRow; path: string }>>([])
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Refs
    const ruleCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const clauseCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const leftColRef = useRef<HTMLDivElement>(null)
    const rightColRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    // ---- Navigation guard: warn if unconfirmed mappings --------------------

    const unconfirmedCount = mappings.filter(m => m.status === 'unconfirmed').length

    useEffect(() => {
        if (unconfirmedCount === 0) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [unconfirmedCount])

    const navigateBack = () => {
        if (unconfirmedCount > 0) {
            const confirmed = window.confirm(
                `You have ${unconfirmedCount} unconfirmed mapping${unconfirmedCount === 1 ? '' : 's'}. ` +
                `These should be reviewed before the template can be used reliably in compliance checks.\n\n` +
                `Leave anyway?`
            )
            if (!confirmed) return
        }
        router.push('/auth/company-admin?tab=templates')
    }

    // ---- Data loading -------------------------------------------------------

    const loadData = useCallback(async () => {
        if (!templateId) return
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()

            // 1. Template metadata
            const { data: tmpl, error: tmplErr } = await supabase
                .from('contract_templates')
                .select('template_id, template_name, linked_playbook_id, clause_count')
                .eq('template_id', templateId)
                .single()

            if (tmplErr || !tmpl) throw new Error(tmplErr?.message || 'Template not found')
            setTemplate(tmpl as TemplateMeta)

            const playbookId = tmpl.linked_playbook_id
            if (!playbookId) {
                setLoading(false)
                return
            }

            // 2. Playbook metadata
            const { data: pb } = await supabase
                .from('company_playbooks')
                .select('playbook_id, playbook_name')
                .eq('playbook_id', playbookId)
                .single()
            if (pb) setPlaybook(pb as PlaybookMeta)

            // 3. Load ALL playbook rules (for the left column)
            const { data: pbRules } = await supabase
                .from('playbook_rules')
                .select('rule_id, clause_code, clause_name, category, ideal_position, minimum_position, maximum_position, fallback_position, importance_level, is_deal_breaker, is_non_negotiable')
                .eq('playbook_id', playbookId)
                .eq('is_active', true)
                .order('clause_name')

            setRules((pbRules || []) as PlaybookRule[])

            // 4. Load ALL template clauses (for the right column)
            const { data: allClauses } = await supabase
                .from('template_clauses')
                .select('template_clause_id, clause_name, clause_number, category, display_order, is_header')
                .eq('template_id', templateId)
                .order('display_order')

            setClauses((allClauses || []).filter((c: any) => !c.is_header) as TemplateClause[])

            // 5. Load mappings (non-rejected)
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

    // Auto-run mapping on first load if playbook linked but no mappings exist
    const autoMappingTriggered = useRef(false)
    useEffect(() => {
        if (autoMappingTriggered.current) return
        if (loading) return
        if (!template?.linked_playbook_id) return
        if (mappings.length > 0) return

        autoMappingTriggered.current = true
        const autoRun = async () => {
            try {
                const supabase = createClient()
                await supabase.rpc('map_playbook_rules_to_template_clauses', {
                    template_id: templateId,
                    playbook_id: template.linked_playbook_id,
                    replace_existing: false,
                })
                await loadData()
            } catch (e: any) {
                console.error('Auto-mapping failed:', e.message)
            }
        }
        autoRun()
    }, [loading, template, mappings.length, templateId, loadData])

    // ---- Derived data -------------------------------------------------------

    const allCategories = useMemo(() => {
        const cats = new Set([...(rules || []).map(r => r.category), ...(clauses || []).map(c => c.category)])
        cats.delete(null)
        return Array.from(cats).sort() as string[]
    }, [rules, clauses])

    const filteredRules = useMemo(() => {
        return rules.filter(rule => {
            const matchesCat = selectedCategory === 'all' || rule.category === selectedCategory
            const matchesSearch = !searchQuery || rule.clause_name.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCat && matchesSearch
        })
    }, [rules, selectedCategory, searchQuery])

    const filteredClauses = useMemo(() => {
        return clauses.filter(clause => {
            const matchesCat = selectedCategory === 'all' || clause.category === selectedCategory
            const matchesSearch = !searchQuery ||
                clause.clause_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (clause.clause_number || '').includes(searchQuery)
            return matchesCat && matchesSearch
        })
    }, [clauses, selectedCategory, searchQuery])

    const mappedRuleIds = useMemo(() => new Set(mappings.map(m => m.playbook_rule_id)), [mappings])
    const mappedClauseIds = useMemo(() => new Set(mappings.map(m => m.template_clause_id)), [mappings])
    const confirmedCount = useMemo(() => mappings.filter(m => m.status === 'confirmed').length, [mappings])

    // Build lookup maps for quick access
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

    // ---- SVG path calculation -----------------------------------------------

    const updatePaths = useCallback(() => {
        if (!svgRef.current) return
        const svgRect = svgRef.current.getBoundingClientRect()
        const paths = mappings
            .map(mapping => {
                const ruleEl = ruleCardRefs.current[mapping.playbook_rule_id]
                const clauseEl = clauseCardRefs.current[mapping.template_clause_id]
                if (!ruleEl || !clauseEl) return null
                const rr = ruleEl.getBoundingClientRect()
                const cr = clauseEl.getBoundingClientRect()
                const x1 = rr.right - svgRect.left
                const y1 = rr.top - svgRect.top + rr.height / 2
                const x2 = cr.left - svgRect.left
                const y2 = cr.top - svgRect.top + cr.height / 2
                const cpX = (x2 - x1) * 0.4
                return { mapping, path: `M ${x1} ${y1} C ${x1 + cpX} ${y1}, ${x2 - cpX} ${y2}, ${x2} ${y2}` }
            })
            .filter(Boolean) as Array<{ mapping: MappingRow; path: string }>
        setSvgPaths(paths)
    }, [mappings])

    useEffect(() => {
        updatePaths()
        const timer = setTimeout(updatePaths, 100)
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
    }, [updatePaths, filteredRules, filteredClauses])

    // ---- Actions: click-to-link, confirm, reject ----------------------------

    const handleRuleClick = (ruleId: string) => {
        setSelectedRuleId(prev => prev === ruleId ? null : ruleId)
    }

    const handleClauseClick = async (clauseId: string) => {
        if (!selectedRuleId || !template?.linked_playbook_id) return

        // Check if mapping already exists between this rule and clause
        const existing = mappings.find(m => m.playbook_rule_id === selectedRuleId && m.template_clause_id === clauseId)
        if (existing) {
            // Remove the mapping
            await rejectMapping(existing.mapping_id, false)
        } else {
            // Create a new manual mapping
            setActionLoading('new')
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                await supabase
                    .from('playbook_rule_clause_map')
                    .insert({
                        playbook_rule_id: selectedRuleId,
                        template_clause_id: clauseId,
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
            } finally {
                setActionLoading(null)
            }
        }
        setSelectedRuleId(null)
        setTimeout(updatePaths, 50)
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
                m.mapping_id === mappingId
                    ? { ...m, status: 'confirmed' as const, confirmed_at: new Date().toISOString() }
                    : m
            ))
        } finally {
            setActionLoading(null)
        }
    }

    const rejectMapping = async (mappingId: string, requireConfirm = true) => {
        if (requireConfirm && !window.confirm('Remove this mapping?')) return
        setActionLoading(mappingId)
        try {
            const supabase = createClient()
            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'rejected' })
                .eq('mapping_id', mappingId)
            setMappings(prev => prev.filter(m => m.mapping_id !== mappingId))
            setHoveredMapping(null)
            setHoverPos(null)
        } finally {
            setActionLoading(null)
            setTimeout(updatePaths, 50)
        }
    }

    // ---- Render: loading / error / no playbook states -----------------------

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-slate-600 text-sm">Loading clause mappings…</p>
            </div>
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <button onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 hover:underline">← Go back</button>
            </div>
        </div>
    )

    if (!template?.linked_playbook_id) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center max-w-sm">
                <div className="text-4xl mb-3">🔗</div>
                <h2 className="text-lg font-semibold text-slate-800 mb-2">No playbook linked</h2>
                <p className="text-sm text-slate-500 mb-4">This template doesn&apos;t have a playbook linked yet. Link a playbook from the Templates tab first.</p>
                <button onClick={() => router.push('/auth/company-admin?tab=templates')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    Go to Templates
                </button>
            </div>
        </div>
    )

    // ---- Main render --------------------------------------------------------

    return (
        <div className="flex flex-col h-screen bg-white">
            {/* Header */}
            <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={navigateBack}
                            className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 flex-shrink-0"
                            title="Back to Templates"
                        >
                            <BackIcon />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-slate-900 truncate">{template.template_name}</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Mapping workspace
                                {playbook && <> · <span className="text-indigo-600">{playbook.playbook_name}</span></>}
                                {' · '}Click a rule, then click a clause to link them
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-3 mb-4">
                    {[
                        { label: 'Total Rules', value: rules.length, color: 'text-slate-900' },
                        { label: 'Mapped', value: mappedRuleIds.size, color: 'text-indigo-600' },
                        { label: 'Unmapped', value: rules.length - mappedRuleIds.size, color: 'text-slate-500' },
                        { label: 'Confirmed', value: confirmedCount, color: 'text-emerald-600' },
                        { label: 'Unconfirmed', value: unconfirmedCount, color: unconfirmedCount > 0 ? 'text-amber-600' : 'text-slate-400' },
                        { label: 'Mappings', value: mappings.length, color: 'text-slate-900' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-lg px-4 py-2 border border-slate-200 flex-1">
                            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{s.label}</div>
                            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Search & Filter */}
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 max-w-xs">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2"><SearchIcon /></div>
                        <input
                            type="text"
                            placeholder="Search rules or clauses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                        >
                            All
                        </button>
                        {allCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                            >
                                {cat.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main content with SVG overlay */}
            <div className="flex-1 relative overflow-hidden">
                {/* SVG layer */}
                <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                    {svgPaths.map((p, idx) => (
                        <g key={p.mapping.mapping_id}>
                            {/* Invisible wide hit target */}
                            <path
                                d={p.path}
                                stroke="transparent"
                                strokeWidth="14"
                                fill="none"
                                className="pointer-events-auto cursor-pointer"
                                onMouseEnter={(e) => {
                                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
                                    setHoveredMapping(idx)
                                    setHoverPos({ x: e.clientX, y: e.clientY })
                                }}
                                onMouseMove={(e) => {
                                    setHoverPos({ x: e.clientX, y: e.clientY })
                                }}
                                onMouseLeave={() => {
                                    hoverTimeout.current = setTimeout(() => {
                                        setHoveredMapping(null)
                                        setHoverPos(null)
                                    }, 300)
                                }}
                            />
                            {/* Visible line */}
                            <path
                                d={p.path}
                                stroke={getLineColor(p.mapping.match_confidence)}
                                strokeWidth={hoveredMapping === idx ? 3 : 1.5}
                                fill="none"
                                strokeDasharray={p.mapping.status === 'confirmed' ? '0' : '6,4'}
                                opacity={hoveredMapping === null || hoveredMapping === idx ? 1 : 0.15}
                                className="transition-opacity duration-200"
                            />
                            {/* Confidence label on hover */}
                            {hoveredMapping === idx && (() => {
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
                    {/* Left: Rules */}
                    <div ref={leftColRef} className="w-[45%] overflow-y-auto p-4 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Playbook Rules ({filteredRules.length})</div>
                        {filteredRules.map(rule => {
                            const isMapped = mappedRuleIds.has(rule.rule_id)
                            const isSelected = selectedRuleId === rule.rule_id
                            const c = getColor(rule.category)
                            return (
                                <div
                                    key={rule.rule_id}
                                    ref={el => { ruleCardRefs.current[rule.rule_id] = el }}
                                    onClick={() => handleRuleClick(rule.rule_id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                        isSelected ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50 scale-[1.02] shadow-md' :
                                        isMapped ? `border-slate-200 ${c.bg} hover:shadow-sm` :
                                        'border-dashed border-slate-300 bg-white opacity-60 hover:opacity-80'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h3 className="text-xs font-semibold text-slate-800 leading-tight">{rule.clause_name}</h3>
                                        <div className="flex gap-1 flex-shrink-0">
                                            {rule.is_deal_breaker && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">DB</span>}
                                            {rule.is_non_negotiable && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">NN</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.badge}`}>{(rule.category || '').replace(/_/g, ' ')}</span>
                                        {!isMapped && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">unmapped</span>}
                                    </div>
                                    {/* Mini position bar */}
                                    <div className="relative h-3 bg-slate-100 rounded-full overflow-visible">
                                        <div
                                            className="absolute top-0.5 h-2 bg-amber-100 rounded-full border border-amber-200"
                                            style={{ left: `${toPercent(rule.minimum_position)}%`, width: `${Math.max(1, toPercent(rule.maximum_position) - toPercent(rule.minimum_position))}%` }}
                                        />
                                        <div
                                            className="absolute top-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                                            style={{ left: `${toPercent(rule.ideal_position)}%`, transform: 'translateX(-50%)' }}
                                            title={`Ideal: ${rule.ideal_position}`}
                                        />
                                        <div
                                            className="absolute top-0 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm"
                                            style={{ left: `${toPercent(rule.fallback_position)}%`, transform: 'translateX(-50%)' }}
                                            title={`Fallback: ${rule.fallback_position}`}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[8px] text-slate-400 mt-0.5 px-0.5">
                                        <span>1</span>
                                        <span>5</span>
                                        <span>10</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Center gap for connector lines */}
                    <div className="w-[10%] flex-shrink-0" />

                    {/* Right: Clauses */}
                    <div ref={rightColRef} className="w-[45%] overflow-y-auto p-4 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Template Clauses ({filteredClauses.length})</div>
                        {filteredClauses.map(clause => {
                            const isMapped = mappedClauseIds.has(clause.template_clause_id)
                            const c = getColor(clause.category)
                            return (
                                <div
                                    key={clause.template_clause_id}
                                    ref={el => { clauseCardRefs.current[clause.template_clause_id] = el }}
                                    onClick={() => handleClauseClick(clause.template_clause_id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                        selectedRuleId ? 'hover:ring-2 hover:ring-indigo-500 hover:shadow-md' : ''
                                    } ${
                                        isMapped ? `border-slate-200 ${c.bg} hover:shadow-sm` :
                                        'border-dashed border-slate-300 bg-white opacity-60 hover:opacity-80'
                                    }`}
                                >
                                    <div className="flex items-start gap-2 mb-1.5">
                                        <span className="inline-block bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">
                                            {clause.clause_number || '—'}
                                        </span>
                                        <h3 className="text-xs font-semibold text-slate-800 leading-tight">{clause.clause_name}</h3>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.badge}`}>{(clause.category || '').replace(/_/g, ' ')}</span>
                                        {!isMapped && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">unmapped</span>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Floating popover on connector hover */}
            {hoveredMapping !== null && svgPaths[hoveredMapping] && hoverPos && (
                <div
                    ref={popoverRef}
                    onMouseEnter={() => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current) }}
                    onMouseLeave={() => {
                        hoverTimeout.current = setTimeout(() => {
                            setHoveredMapping(null)
                            setHoverPos(null)
                        }, 200)
                    }}
                    className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 min-w-[280px]"
                    style={{
                        left: Math.min(hoverPos.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320),
                        top: Math.max(8, Math.min(hoverPos.y - 60, (typeof window !== 'undefined' ? window.innerHeight : 800) - 180)),
                    }}
                >
                    {(() => {
                        const m = svgPaths[hoveredMapping].mapping
                        const rule = ruleById.get(m.playbook_rule_id)
                        const clause = clauseById.get(m.template_clause_id)
                        return (
                            <>
                                <div className="mb-2">
                                    <p className="text-xs font-semibold text-slate-900 leading-snug">
                                        {rule?.clause_name || 'Unknown rule'}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-slate-400 text-[10px]">maps to</span>
                                        <span className="bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            {clause?.clause_number || '—'}
                                        </span>
                                        <span className="text-xs text-slate-700">
                                            {clause?.clause_name || 'Unknown clause'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${m.match_confidence}%`,
                                                backgroundColor: getLineColor(m.match_confidence),
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold" style={{ color: getLineColor(m.match_confidence) }}>
                                        {m.match_confidence}%
                                    </span>
                                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                                        m.status === 'confirmed'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {m.status === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}
                                    </span>
                                </div>
                                <div className="flex gap-1.5">
                                    {m.status === 'unconfirmed' && (
                                        <button
                                            onClick={() => confirmMapping(m.mapping_id)}
                                            disabled={actionLoading === m.mapping_id}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex-1 justify-center disabled:opacity-50"
                                        >
                                            <CheckIcon /> Confirm
                                        </button>
                                    )}
                                    <button
                                        onClick={() => rejectMapping(m.mapping_id)}
                                        disabled={actionLoading === m.mapping_id}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex-1 justify-center disabled:opacity-50"
                                    >
                                        <XIcon /> Reject
                                    </button>
                                </div>
                            </>
                        )
                    })()}
                </div>
            )}

            {/* Selection hint bar */}
            {selectedRuleId && (
                <div className="flex-shrink-0 bg-indigo-600 text-white px-6 py-2 text-sm text-center">
                    Rule selected: <strong>{ruleById.get(selectedRuleId)?.clause_name}</strong> — now click a clause on the right to create a mapping, or click the rule again to deselect
                </div>
            )}
        </div>
    )
}
