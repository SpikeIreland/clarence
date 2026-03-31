'use client'
import React, { useState, useEffect, useCallback } from 'react'
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
    // flattened from joins
    rule_clause_code: string | null
    rule_name: string
    rule_ideal_position: number | null
    rule_minimum_position: number | null
    rule_importance_level: number | null
    rule_is_deal_breaker: boolean
    rule_is_non_negotiable: boolean
    clause_name: string
    clause_number: string | null
    clause_category: string | null
    clause_display_order: number
}

interface TemplateClause {
    template_clause_id: string
    clause_name: string
    clause_number: string | null
    category: string | null
    display_order: number
}

interface PlaybookRuleOption {
    rule_id: string
    clause_code: string | null
    clause_name: string
    importance_level: number | null
}

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_DOT: Record<string, string> = {
    unconfirmed: 'bg-amber-400',
    confirmed: 'bg-emerald-500',
    rejected: 'bg-red-500',
    remapped: 'bg-blue-500',
}

const STATUS_LABEL: Record<string, string> = {
    unconfirmed: 'Unconfirmed',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    remapped: 'Remapped',
}

const METHOD_LABEL: Record<string, string> = {
    auto_exact: 'Exact match',
    auto_containment: 'Name containment',
    auto_category: 'Category match',
    auto_ai: 'AI match',
    manual: 'Manual',
}

function ConfidenceBadge({ score, method }: { score: number; method: string }) {
    if (method === 'manual') return (
        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">Manual</span>
    )
    const colour = score === 100
        ? 'bg-emerald-100 text-emerald-700'
        : score >= 80
            ? 'bg-yellow-100 text-yellow-700'
            : score >= 50
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-600'
    return (
        <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${colour}`}>{score}%</span>
    )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function MappingReviewPage() {
    const router = useRouter()
    const params = useParams()
    const templateId = params.templateId as string

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [template, setTemplate] = useState<TemplateMeta | null>(null)
    const [playbook, setPlaybook] = useState<PlaybookMeta | null>(null)
    const [mappings, setMappings] = useState<MappingRow[]>([])
    const [unmappedClauses, setUnmappedClauses] = useState<TemplateClause[]>([])
    const [allPlaybookRules, setAllPlaybookRules] = useState<PlaybookRuleOption[]>([])

    // UI state
    const [reassigningId, setReassigningId] = useState<string | null>(null)
    const [reassignRuleId, setReassignRuleId] = useState<string>('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [autoMappingRunning, setAutoMappingRunning] = useState(false)
    const [autoMappingResult, setAutoMappingResult] = useState<{
        rules_total: number
        rules_mapped: number
        rules_unmapped: number
        exact_matches: number
        containment_matches: number
        category_matches: number
    } | null>(null)

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
                .from('playbooks')
                .select('playbook_id, playbook_name')
                .eq('playbook_id', playbookId)
                .single()

            if (pb) setPlaybook(pb as PlaybookMeta)

            // 3. Load raw mappings (non-rejected)
            const { data: rawMappings, error: mapErr } = await supabase
                .from('playbook_rule_clause_map')
                .select('mapping_id, playbook_rule_id, template_clause_id, match_method, match_confidence, match_reason, status, confirmed_by, confirmed_at')
                .eq('template_id', templateId)
                .eq('playbook_id', playbookId)
                .neq('status', 'rejected')

            if (mapErr) throw new Error(mapErr.message)

            // 4. Load referenced playbook_rules
            const ruleIds = [...new Set((rawMappings || []).map(m => m.playbook_rule_id))]
            let rulesMap: Record<string, any> = {}
            if (ruleIds.length > 0) {
                const { data: rules } = await supabase
                    .from('playbook_rules')
                    .select('rule_id, clause_code, clause_name, ideal_position, minimum_position, importance_level, is_deal_breaker, is_non_negotiable')
                    .in('rule_id', ruleIds)
                rulesMap = Object.fromEntries((rules || []).map(r => [r.rule_id, r]))
            }

            // 5. Load referenced template_clauses
            const clauseIds = [...new Set((rawMappings || []).map(m => m.template_clause_id))]
            let clausesMap: Record<string, any> = {}
            if (clauseIds.length > 0) {
                const { data: clauses } = await supabase
                    .from('template_clauses')
                    .select('template_clause_id, clause_name, clause_number, category, display_order')
                    .in('template_clause_id', clauseIds)
                clausesMap = Object.fromEntries((clauses || []).map(c => [c.template_clause_id, c]))
            }

            // 6. Flatten mappings
            const flattened: MappingRow[] = (rawMappings || []).map(m => {
                const rule = rulesMap[m.playbook_rule_id] || {}
                const clause = clausesMap[m.template_clause_id] || {}
                return {
                    ...m,
                    rule_clause_code: rule.clause_code ?? null,
                    rule_name: rule.clause_name ?? 'Unknown rule',
                    rule_ideal_position: rule.ideal_position ?? null,
                    rule_minimum_position: rule.minimum_position ?? null,
                    rule_importance_level: rule.importance_level ?? null,
                    rule_is_deal_breaker: rule.is_deal_breaker ?? false,
                    rule_is_non_negotiable: rule.is_non_negotiable ?? false,
                    clause_name: clause.clause_name ?? 'Unknown clause',
                    clause_number: clause.clause_number ?? null,
                    clause_category: clause.category ?? null,
                    clause_display_order: clause.display_order ?? 999,
                }
            }).sort((a, b) => a.clause_display_order - b.clause_display_order)

            setMappings(flattened)

            // 7. Load all template clauses to find unmapped ones
            const { data: allClauses } = await supabase
                .from('template_clauses')
                .select('template_clause_id, clause_name, clause_number, category, display_order')
                .eq('template_id', templateId)
                .order('display_order')

            const mappedClauseIds = new Set(flattened.map(m => m.template_clause_id))
            const unmapped = (allClauses || []).filter(c => !mappedClauseIds.has(c.template_clause_id))
            setUnmappedClauses(unmapped as TemplateClause[])

            // 8. Load all playbook rules for reassign dropdown
            const { data: pbRules } = await supabase
                .from('playbook_rules')
                .select('rule_id, clause_code, clause_name, importance_level')
                .eq('playbook_id', playbookId)
                .eq('is_active', true)
                .order('clause_name')

            setAllPlaybookRules((pbRules || []) as PlaybookRuleOption[])

        } catch (e: any) {
            setError(e.message || 'Failed to load mapping data')
        } finally {
            setLoading(false)
        }
    }, [templateId])

    useEffect(() => { loadData() }, [loadData])

    // Auto-run mapping on first load when a playbook is linked but no mappings exist yet.
    // This avoids the user having to manually click "Run Auto-Mapping" every time.
    const autoMappingTriggered = React.useRef(false)
    useEffect(() => {
        if (autoMappingTriggered.current) return
        if (loading) return // Wait for initial load to finish
        if (!template?.linked_playbook_id) return
        if (mappings.length > 0) return // Already have mappings, nothing to do

        // No mappings yet + playbook linked → auto-map
        autoMappingTriggered.current = true
        const autoRun = async () => {
            setAutoMappingRunning(true)
            setAutoMappingResult(null)
            try {
                const supabase = createClient()
                const { data, error: rpcErr } = await supabase.rpc('map_playbook_rules_to_template_clauses', {
                    template_id: templateId,
                    playbook_id: template.linked_playbook_id,
                    replace_existing: false,
                })
                if (rpcErr) throw new Error(rpcErr.message)
                if (data?.[0]) setAutoMappingResult(data[0])
                await loadData()
            } catch (e: any) {
                console.error('Auto-mapping failed:', e.message)
            } finally {
                setAutoMappingRunning(false)
            }
        }
        autoRun()
    }, [loading, template, mappings.length, templateId, loadData])

    // ---- Actions ------------------------------------------------------------

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
                    ? { ...m, status: 'confirmed', confirmed_at: new Date().toISOString() }
                    : m
            ))
        } finally {
            setActionLoading(null)
        }
    }

    const rejectMapping = async (mappingId: string) => {
        if (!window.confirm('Remove this mapping? The clause will appear in the Unmapped section.')) return
        setActionLoading(mappingId)
        try {
            const supabase = createClient()
            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'rejected' })
                .eq('mapping_id', mappingId)
            // Remove from list; the clause will appear unmapped
            const rejected = mappings.find(m => m.mapping_id === mappingId)
            if (rejected) {
                setMappings(prev => prev.filter(m => m.mapping_id !== mappingId))
                setUnmappedClauses(prev => [...prev, {
                    template_clause_id: rejected.template_clause_id,
                    clause_name: rejected.clause_name,
                    clause_number: rejected.clause_number,
                    category: rejected.clause_category,
                    display_order: rejected.clause_display_order,
                }].sort((a, b) => a.display_order - b.display_order))
            }
        } finally {
            setActionLoading(null)
        }
    }

    const confirmReassign = async (oldMappingId: string, newRuleId: string, clauseId: string) => {
        if (!newRuleId) return
        setActionLoading(oldMappingId)
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const playbookId = template?.linked_playbook_id

            // Mark old as remapped
            await supabase
                .from('playbook_rule_clause_map')
                .update({ status: 'remapped' })
                .eq('mapping_id', oldMappingId)

            // Insert new confirmed mapping
            const { data: newRow } = await supabase
                .from('playbook_rule_clause_map')
                .insert({
                    playbook_rule_id: newRuleId,
                    template_clause_id: clauseId,
                    template_id: templateId,
                    playbook_id: playbookId,
                    match_method: 'manual',
                    match_confidence: 100,
                    match_reason: 'Manually assigned by user',
                    status: 'confirmed',
                    confirmed_by: user?.id,
                    confirmed_at: new Date().toISOString(),
                })
                .select()
                .single()

            setReassigningId(null)
            setReassignRuleId('')
            await loadData()
        } finally {
            setActionLoading(null)
        }
    }

    const assignToUnmapped = async (clauseId: string, ruleId: string) => {
        if (!ruleId) return
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        await supabase
            .from('playbook_rule_clause_map')
            .insert({
                playbook_rule_id: ruleId,
                template_clause_id: clauseId,
                template_id: templateId,
                playbook_id: template?.linked_playbook_id,
                match_method: 'manual',
                match_confidence: 100,
                match_reason: 'Manually assigned by user',
                status: 'confirmed',
                confirmed_by: user?.id,
                confirmed_at: new Date().toISOString(),
            })
        await loadData()
    }

    const runAutoMapping = async () => {
        if (!template?.linked_playbook_id) return
        const existing = mappings.length
        if (existing > 0) {
            if (!window.confirm(`There are already ${existing} existing mappings. Running auto-mapping will add new suggestions for unmapped rules only (confirmed mappings are preserved). Continue?`)) return
        }
        setAutoMappingRunning(true)
        setAutoMappingResult(null)
        try {
            const supabase = createClient()
            const { data, error: rpcErr } = await supabase.rpc('map_playbook_rules_to_template_clauses', {
                template_id: templateId,
                playbook_id: template.linked_playbook_id,
                replace_existing: false,
            })
            if (rpcErr) throw new Error(rpcErr.message)
            if (data?.[0]) setAutoMappingResult(data[0])
            await loadData()
        } catch (e: any) {
            alert('Auto-mapping failed: ' + e.message)
        } finally {
            setAutoMappingRunning(false)
        }
    }

    // ---- Derived stats ------------------------------------------------------

    const totalMapped = mappings.length
    const confirmedCount = mappings.filter(m => m.status === 'confirmed').length
    // unconfirmedCount is already defined above (used by the navigation guard)
    const remappedCount = mappings.filter(m => m.status === 'remapped').length
    const unmappedCount = unmappedClauses.length

    // ---- Render -------------------------------------------------------------

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
                <p className="text-sm text-slate-500 mb-4">This template doesn't have a playbook linked yet. Link a playbook from the Templates tab first.</p>
                <button onClick={() => router.push('/auth/company-admin?tab=templates')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    Go to Templates
                </button>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                onClick={navigateBack}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0"
                                title="Back to Templates"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg font-semibold text-slate-800 truncate">{template.template_name}</h1>
                                <p className="text-sm text-slate-500 truncate">
                                    Clause mapping review
                                    {playbook && <> · <span className="text-indigo-600">{playbook.playbook_name}</span></>}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={runAutoMapping}
                            disabled={autoMappingRunning}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {autoMappingRunning ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            )}
                            {autoMappingRunning ? 'Running…' : 'Run Auto-Mapping'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* Auto-mapping result banner */}
                {autoMappingResult && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-medium text-emerald-800 mb-1">Auto-mapping complete</p>
                                <p className="text-sm text-emerald-700">
                                    {autoMappingResult.rules_mapped} of {autoMappingResult.rules_total} rules mapped —
                                    {autoMappingResult.exact_matches} exact,{' '}
                                    {autoMappingResult.containment_matches} containment,{' '}
                                    {autoMappingResult.category_matches} category.
                                    {autoMappingResult.rules_unmapped > 0 && ` ${autoMappingResult.rules_unmapped} rules unmatched.`}
                                </p>
                            </div>
                            <button onClick={() => setAutoMappingResult(null)} className="text-emerald-600 hover:text-emerald-800 ml-4">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Confirmed', value: confirmedCount, colour: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                        { label: 'Unconfirmed', value: unconfirmedCount, colour: 'text-amber-700 bg-amber-50 border-amber-200' },
                        { label: 'Remapped', value: remappedCount, colour: 'text-blue-700 bg-blue-50 border-blue-200' },
                        { label: 'Unmapped clauses', value: unmappedCount, colour: unmappedCount > 0 ? 'text-slate-700 bg-slate-50 border-slate-200' : 'text-slate-400 bg-slate-50 border-slate-200' },
                    ].map(stat => (
                        <div key={stat.label} className={`rounded-xl border p-3 ${stat.colour}`}>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs font-medium mt-0.5 opacity-80">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Guidance note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                    <strong>Review note:</strong> AI suggested these mappings — you need to verify each one is correct before it drives negotiation guidance.
                    Amber = needs review. Click <strong>Confirm</strong> to approve, <strong>Reassign</strong> to pick a different rule, or <strong>Reject</strong> to remove.
                </div>

                {/* Mapped clauses */}
                {mappings.length > 0 ? (
                    <div>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            Mapped clauses ({totalMapped})
                        </h2>
                        <div className="space-y-2">
                            {mappings.map(m => (
                                <MappingCard
                                    key={m.mapping_id}
                                    mapping={m}
                                    allRules={allPlaybookRules}
                                    isActionLoading={actionLoading === m.mapping_id}
                                    isReassigning={reassigningId === m.mapping_id}
                                    reassignRuleId={reassignRuleId}
                                    onConfirm={() => confirmMapping(m.mapping_id)}
                                    onReject={() => rejectMapping(m.mapping_id)}
                                    onStartReassign={() => { setReassigningId(m.mapping_id); setReassignRuleId('') }}
                                    onCancelReassign={() => setReassigningId(null)}
                                    onReassignRuleChange={setReassignRuleId}
                                    onConfirmReassign={() => confirmReassign(m.mapping_id, reassignRuleId, m.template_clause_id)}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400">
                        {autoMappingRunning ? (
                            <>
                                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="font-medium text-slate-600">Auto-mapping in progress…</p>
                                <p className="text-sm mt-1">Matching playbook rules to template clauses.</p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium">No mappings yet</p>
                                <p className="text-sm mt-1">Click <strong>Run Auto-Mapping</strong> above to generate initial mappings.</p>
                            </>
                        )}
                    </div>
                )}

                {/* Unmapped clauses */}
                {unmappedClauses.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            Unmapped clauses ({unmappedClauses.length})
                        </h2>
                        <p className="text-xs text-slate-400 mb-3">
                            These clauses have no matching rule. Not all clauses need a rule — headers and boilerplate may not have playbook guidance.
                        </p>
                        <div className="space-y-2">
                            {unmappedClauses.map(clause => (
                                <UnmappedClauseCard
                                    key={clause.template_clause_id}
                                    clause={clause}
                                    allRules={allPlaybookRules}
                                    onAssign={(ruleId) => assignToUnmapped(clause.template_clause_id, ruleId)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* All done state */}
                {mappings.length > 0 && unconfirmedCount === 0 && unmappedCount === 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                        <div className="text-3xl mb-2">✓</div>
                        <p className="font-semibold text-emerald-800">All mappings confirmed</p>
                        <p className="text-sm text-emerald-700 mt-1">
                            These mappings are now authoritative and will drive position guidance, breach warnings, and negotiation tips.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// MAPPING CARD
// ============================================================================

function MappingCard({
    mapping,
    allRules,
    isActionLoading,
    isReassigning,
    reassignRuleId,
    onConfirm,
    onReject,
    onStartReassign,
    onCancelReassign,
    onReassignRuleChange,
    onConfirmReassign,
}: {
    mapping: MappingRow
    allRules: PlaybookRuleOption[]
    isActionLoading: boolean
    isReassigning: boolean
    reassignRuleId: string
    onConfirm: () => void
    onReject: () => void
    onStartReassign: () => void
    onCancelReassign: () => void
    onReassignRuleChange: (id: string) => void
    onConfirmReassign: () => void
}) {
    const dotClass = STATUS_DOT[mapping.status] || 'bg-slate-400'
    const isConfirmed = mapping.status === 'confirmed' || mapping.status === 'remapped'

    return (
        <div className={`bg-white border rounded-xl p-4 ${isConfirmed ? 'border-slate-200' : 'border-amber-200'}`}>
            <div className="flex items-start gap-4">
                {/* Status dot */}
                <div className="flex-shrink-0 mt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} title={STATUS_LABEL[mapping.status]}></div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Two-column layout: clause → rule */}
                    <div className="flex items-start gap-2 flex-wrap">
                        {/* Template clause */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Template clause</p>
                            <p className="font-medium text-slate-800 text-sm truncate">
                                {mapping.clause_number && (
                                    <span className="text-slate-400 mr-1.5">{mapping.clause_number}</span>
                                )}
                                {mapping.clause_name}
                            </p>
                            {mapping.clause_category && (
                                <p className="text-xs text-slate-400 mt-0.5">{mapping.clause_category}</p>
                            )}
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0 mt-5 text-slate-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </div>

                        {/* Playbook rule */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Playbook rule</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                {mapping.rule_clause_code && (
                                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{mapping.rule_clause_code}</span>
                                )}
                                <p className="font-medium text-slate-800 text-sm truncate">{mapping.rule_name}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <ConfidenceBadge score={mapping.match_confidence} method={mapping.match_method} />
                                <span className="text-xs text-slate-400">{METHOD_LABEL[mapping.match_method] || mapping.match_method}</span>
                                {mapping.rule_is_deal_breaker && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 font-medium">Deal breaker</span>
                                )}
                                {mapping.rule_is_non_negotiable && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-600 font-medium">Non-negotiable</span>
                                )}
                            </div>
                            {mapping.match_reason && (
                                <p className="text-xs text-slate-400 mt-1 italic truncate">{mapping.match_reason}</p>
                            )}
                        </div>
                    </div>

                    {/* Reassign UI */}
                    {isReassigning && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <select
                                className="flex-1 min-w-0 text-sm border border-indigo-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                value={reassignRuleId}
                                onChange={e => onReassignRuleChange(e.target.value)}
                                autoFocus
                            >
                                <option value="">— Select a rule —</option>
                                {allRules.map(r => (
                                    <option key={r.rule_id} value={r.rule_id}>
                                        {r.clause_code ? `[${r.clause_code}] ` : ''}{r.clause_name}
                                        {r.importance_level ? ` (${r.importance_level}/10)` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={onConfirmReassign}
                                disabled={!reassignRuleId || isActionLoading}
                                className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Apply
                            </button>
                            <button
                                onClick={onCancelReassign}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Action buttons */}
                    {!isReassigning && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {isActionLoading ? (
                                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    {mapping.status === 'unconfirmed' && (
                                        <button
                                            onClick={onConfirm}
                                            className="px-3 py-1 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                        >
                                            Confirm
                                        </button>
                                    )}
                                    <button
                                        onClick={onStartReassign}
                                        className="px-3 py-1 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                                    >
                                        Reassign
                                    </button>
                                    {mapping.status !== 'confirmed' && (
                                        <button
                                            onClick={onReject}
                                            className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            Reject
                                        </button>
                                    )}
                                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                                        mapping.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700'
                                        : mapping.status === 'remapped' ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {STATUS_LABEL[mapping.status]}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// UNMAPPED CLAUSE CARD
// ============================================================================

function UnmappedClauseCard({
    clause,
    allRules,
    onAssign,
}: {
    clause: TemplateClause
    allRules: PlaybookRuleOption[]
    onAssign: (ruleId: string) => void
}) {
    const [assigning, setAssigning] = useState(false)
    const [selectedRuleId, setSelectedRuleId] = useState('')

    return (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Unmapped"></div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 text-sm">
                        {clause.clause_number && (
                            <span className="text-slate-400 mr-1.5">{clause.clause_number}</span>
                        )}
                        {clause.clause_name}
                    </p>
                    {clause.category && (
                        <p className="text-xs text-slate-400 mt-0.5">{clause.category}</p>
                    )}

                    {assigning ? (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <select
                                className="flex-1 min-w-0 text-sm border border-indigo-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                value={selectedRuleId}
                                onChange={e => setSelectedRuleId(e.target.value)}
                                autoFocus
                            >
                                <option value="">— Select a rule —</option>
                                {allRules.map(r => (
                                    <option key={r.rule_id} value={r.rule_id}>
                                        {r.clause_code ? `[${r.clause_code}] ` : ''}{r.clause_name}
                                        {r.importance_level ? ` (${r.importance_level}/10)` : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => { onAssign(selectedRuleId); setAssigning(false) }}
                                disabled={!selectedRuleId}
                                className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Assign
                            </button>
                            <button
                                onClick={() => setAssigning(false)}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="mt-2 flex items-center gap-3">
                            <span className="text-xs text-slate-400">No rule mapped</span>
                            <button
                                onClick={() => setAssigning(true)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                + Assign rule
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
