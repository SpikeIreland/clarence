'use client'
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
    PlaybookRule,
    PlaybookRangeContext,
    normaliseCategory,
    getCategoryDisplayName,
    getEffectiveRangeContext,
    translateRulePosition,
    getCategoryFallbackContext,
    filterRulesByScope,
    groupRulesByScheduleType,
} from '@/lib/playbook-compliance'
import { getScheduleTypeLabel } from '@/lib/schedule-types'

// ============================================================================
// TYPES
// ============================================================================

interface PlaybookMeta {
    playbook_id: string
    playbook_name: string
    playbook_description: string | null
    playbook_summary: string | null
    status: string
    is_active: boolean
    contract_type_key: string | null
    playbook_perspective: 'customer' | 'provider'
    rules_extracted: number | null
    ai_confidence_score: number | null
    created_at: string
}

interface RuleGroup {
    category: string
    displayName: string
    rules: PlaybookRule[]
}

// ============================================================================
// LOADING
// ============================================================================

function PlaybookIQLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading PlaybookIQ...</p>
            </div>
        </div>
    )
}

// ============================================================================
// EDITABLE POSITION BAR
// ============================================================================

function EditablePositionBar({ rule, onPositionChange }: {
    rule: PlaybookRule
    onPositionChange: (field: string, value: number) => void
}) {
    const toPercent = (val: number) => ((val - 1) / 9) * 100
    const rangeCtx = getEffectiveRangeContext(rule)
    const label = (pos: number) => translateRulePosition(rule, pos)

    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>, field: string) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const pct = x / rect.width
        const pos = Math.round(pct * 9 + 1)
        const clamped = Math.max(1, Math.min(10, pos))
        onPositionChange(field, clamped)
    }

    return (
        <div className="mt-2 mb-1">
            {/* Unit badge + info icon */}
            <div className="flex items-center gap-1.5 mb-1">
                {rangeCtx && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        {rangeCtx.range_unit || rangeCtx.value_type}
                    </span>
                )}
                {rangeCtx?.source === 'inferred' && (
                    <span className="text-[9px] text-slate-400 italic">typical range</span>
                )}
                {/* Info tooltip */}
                <div className="relative group/info ml-auto">
                    <div className="w-4 h-4 rounded-full bg-slate-200 hover:bg-indigo-100 flex items-center justify-center cursor-help transition-colors">
                        <span className="text-[9px] font-bold text-slate-500 group-hover/info:text-indigo-600">i</span>
                    </div>
                    <div className="absolute right-0 top-5 w-64 p-3 bg-white rounded-lg shadow-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed z-50 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-150">
                        <p className="font-semibold text-slate-800 mb-1">Click the bar to set positions</p>
                        <div className="space-y-1">
                            <p><span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-600 align-middle mr-1"></span><b>Purple</b> — Ideal position</p>
                            <p><span className="inline-block w-5 h-1.5 rounded bg-blue-100 border border-blue-200 align-middle mr-1"></span><b>Blue band</b> — Acceptable range</p>
                            <p><span className="inline-block w-1.5 h-2 rounded-full bg-slate-400 align-middle mr-1"></span><b>Grey</b> — Fallback</p>
                        </div>
                        {rangeCtx && (
                            <p className="mt-1.5 pt-1.5 border-t border-slate-100 text-slate-500">
                                Scale: {label(1) || '1'} (provider) → {label(10) || '10'} (customer)
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Position bar */}
            <div className="relative h-7 w-full cursor-pointer" onClick={(e) => handleBarClick(e, 'ideal_position')}>
                <div className="absolute top-3 left-0 right-0 h-1.5 bg-slate-100 rounded-full" />
                <div className="absolute top-2.5 h-2.5 bg-blue-100 rounded-full border border-blue-200"
                    style={{
                        left: `${toPercent(rule.minimum_position)}%`,
                        width: `${toPercent(rule.maximum_position) - toPercent(rule.minimum_position)}%`
                    }} />
                {rule.requires_approval_below != null && (
                    <div className="absolute top-1.5 w-px h-4 border-l-2 border-dashed border-red-400"
                        style={{ left: `${toPercent(rule.requires_approval_below)}%`, transform: 'translateX(-50%)' }} />
                )}
                <div className="absolute top-2.5 w-1 h-2.5 bg-slate-400 rounded-full"
                    style={{ left: `${toPercent(rule.fallback_position)}%`, transform: 'translateX(-50%)' }} />
                <div className="absolute top-1 w-5 h-5 rounded-full bg-purple-600 border-2 border-white shadow-sm flex items-center justify-center"
                    style={{ left: `${toPercent(rule.ideal_position)}%`, transform: 'translateX(-50%)' }}>
                    <span className="text-[8px] font-bold text-white">{rule.ideal_position}</span>
                </div>
            </div>

            {/* Scale labels */}
            {rangeCtx?.scale_points?.length ? (
                <div className="flex justify-between text-[9px] px-0.5 -mt-0.5">
                    <span className="text-indigo-500 font-medium">{label(1) || '1'}</span>
                    <span className="text-indigo-500 font-medium">{label(5) || '5'}</span>
                    <span className="text-indigo-500 font-medium">{label(10) || '10'}</span>
                </div>
            ) : (
                <div className="flex justify-between text-[9px] text-slate-300 px-0.5 -mt-0.5">
                    <span>1</span><span>5</span><span>10</span>
                </div>
            )}

            {/* Editable position chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                    { key: 'ideal_position', label: 'Ideal', value: rule.ideal_position, bg: 'bg-purple-100 text-purple-700' },
                    { key: 'minimum_position', label: 'Min', value: rule.minimum_position, bg: 'bg-red-50 text-red-600' },
                    { key: 'maximum_position', label: 'Max', value: rule.maximum_position, bg: 'bg-emerald-50 text-emerald-600' },
                    { key: 'fallback_position', label: 'Fallback', value: rule.fallback_position, bg: 'bg-slate-100 text-slate-600' },
                ].map(p => (
                    <div key={p.key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${p.bg}`}>
                        <span>{p.label}:</span>
                        <select
                            value={p.value}
                            onChange={(e) => onPositionChange(p.key, parseInt(e.target.value))}
                            className="bg-transparent border-none text-[10px] font-bold cursor-pointer focus:outline-none appearance-none pr-2"
                        >
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <option key={n} value={n}>{n}{label(n) ? ` (${label(n)})` : ''}</option>
                            ))}
                        </select>
                    </div>
                ))}
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded">
                    Importance: {rule.importance_level}/10
                </span>
            </div>
        </div>
    )
}

// ============================================================================
// RULE CARD
// ============================================================================

function RuleCard({ rule, isDirty, onFieldChange, onPositionChange, onSave, saving }: {
    rule: PlaybookRule
    isDirty: boolean
    onFieldChange: (field: string, value: unknown) => void
    onPositionChange: (field: string, value: number) => void
    onSave: () => void
    saving: boolean
}) {
    const [editingField, setEditingField] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

    useEffect(() => {
        if (editingField && inputRef.current) inputRef.current.focus()
    }, [editingField])

    const allSamePosition = rule.ideal_position === rule.minimum_position &&
        rule.ideal_position === rule.maximum_position &&
        rule.ideal_position === rule.fallback_position

    return (
        <div className={`rounded-lg border p-4 transition-all ${isDirty ? 'border-amber-300 bg-amber-50/30 shadow-sm' : 'border-slate-200 bg-white'}`}>
            {/* Header row */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {rule.clause_code && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-slate-100 text-slate-500 rounded">{rule.clause_code}</span>
                    )}
                    <h4 className="text-sm font-semibold text-slate-800">{rule.clause_name}</h4>
                    {rule.is_deal_breaker && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded uppercase">Deal Breaker</span>
                    )}
                    {rule.is_non_negotiable && !rule.is_deal_breaker && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-700 rounded uppercase">Non-Negotiable</span>
                    )}
                    {allSamePosition && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-50 text-red-600 rounded border border-red-200">Needs Review</span>
                    )}
                    {rule.quality_flags && rule.quality_flags.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-100 text-amber-700 rounded" title={rule.quality_flags.join(', ')}>
                            ⚠ {rule.quality_flags.length} flag{rule.quality_flags.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                {isDirty && (
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-2.5 py-1 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                )}
            </div>

            {/* Source quote */}
            {rule.source_quote ? (
                <div className="mb-3 px-3 py-2 bg-slate-50 border-l-2 border-indigo-200 rounded-r text-[11px] text-slate-600 italic leading-relaxed">
                    &ldquo;{rule.source_quote}&rdquo;
                </div>
            ) : (
                <div className="mb-3 px-3 py-1.5 bg-amber-50 border-l-2 border-amber-300 rounded-r text-[11px] text-amber-700">
                    No source quote — rule inferred by AI
                </div>
            )}

            {/* Position bar */}
            <EditablePositionBar rule={rule} onPositionChange={onPositionChange} />

            {/* Editable fields */}
            <div className="mt-3 space-y-2">
                {/* Rationale */}
                <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Rationale</label>
                    {editingField === 'rationale' ? (
                        <textarea
                            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                            value={rule.rationale || ''}
                            onChange={(e) => onFieldChange('rationale', e.target.value)}
                            onBlur={() => setEditingField(null)}
                            rows={2}
                            className="w-full mt-0.5 px-2 py-1 text-xs border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                        />
                    ) : (
                        <p
                            onClick={() => setEditingField('rationale')}
                            className="mt-0.5 text-xs text-slate-600 cursor-pointer hover:bg-indigo-50 rounded px-2 py-1 transition-colors min-h-[24px]"
                        >
                            {rule.rationale || <span className="text-slate-400 italic">Click to add rationale...</span>}
                        </p>
                    )}
                </div>

                {/* Escalation row */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-medium text-slate-500">Escalate below:</label>
                        <select
                            value={rule.requires_approval_below ?? ''}
                            onChange={(e) => onFieldChange('requires_approval_below', e.target.value ? parseInt(e.target.value) : null)}
                            className="px-1.5 py-0.5 text-[11px] border border-slate-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="">None</option>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    {rule.requires_approval_below != null && (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-500">→</span>
                                {editingField === 'escalation_contact' ? (
                                    <input
                                        ref={inputRef as React.RefObject<HTMLInputElement>}
                                        value={rule.escalation_contact || ''}
                                        onChange={(e) => onFieldChange('escalation_contact', e.target.value)}
                                        onBlur={() => setEditingField(null)}
                                        placeholder="Contact name"
                                        className="px-1.5 py-0.5 text-[11px] border border-indigo-300 rounded w-32 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    />
                                ) : (
                                    <span
                                        onClick={() => setEditingField('escalation_contact')}
                                        className="text-[11px] text-indigo-600 cursor-pointer hover:underline"
                                    >
                                        {rule.escalation_contact || 'Set contact'}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {editingField === 'escalation_contact_email' ? (
                                    <input
                                        ref={inputRef as React.RefObject<HTMLInputElement>}
                                        value={rule.escalation_contact_email || ''}
                                        onChange={(e) => onFieldChange('escalation_contact_email', e.target.value)}
                                        onBlur={() => setEditingField(null)}
                                        placeholder="Email"
                                        className="px-1.5 py-0.5 text-[11px] border border-indigo-300 rounded w-40 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    />
                                ) : (
                                    <span
                                        onClick={() => setEditingField('escalation_contact_email')}
                                        className="text-[11px] text-slate-500 cursor-pointer hover:underline"
                                    >
                                        {rule.escalation_contact_email || 'Set email'}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Importance slider */}
                <div className="flex items-center gap-2">
                    <label className="text-[10px] font-medium text-slate-500">Importance:</label>
                    <div className="flex gap-0.5">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <button
                                key={n}
                                onClick={() => onFieldChange('importance_level', n)}
                                className={`w-3 h-3 rounded-full transition-colors ${n <= rule.importance_level ? 'bg-amber-500' : 'bg-slate-200'} hover:bg-amber-400`}
                                title={`${n}/10`}
                            />
                        ))}
                    </div>
                    <span className="text-[10px] text-slate-500">{rule.importance_level}/10</span>
                </div>

                {/* Deal breaker / Non-negotiable toggles */}
                <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rule.is_deal_breaker}
                            onChange={(e) => onFieldChange('is_deal_breaker', e.target.checked)}
                            className="w-3 h-3 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[10px] text-slate-600">Deal Breaker</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={rule.is_non_negotiable}
                            onChange={(e) => onFieldChange('is_non_negotiable', e.target.checked)}
                            className="w-3 h-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-[10px] text-slate-600">Non-Negotiable</span>
                    </label>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// MAIN CONTENT
// ============================================================================

function PlaybookReviewContent() {
    const router = useRouter()
    const params = useParams()
    const playbookId = params.playbookId as string

    const [loading, setLoading] = useState(true)
    const [playbook, setPlaybook] = useState<PlaybookMeta | null>(null)
    const [rules, setRules] = useState<PlaybookRule[]>([])
    const [dirtyRules, setDirtyRules] = useState<Map<string, Partial<PlaybookRule>>>(new Map())
    const [savingRules, setSavingRules] = useState<Set<string>>(new Set())
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
    const [filterCategory, setFilterCategory] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [ruleViewMode, setRuleViewMode] = useState<'main_body' | 'schedule'>('main_body')
    const [saveAllStatus, setSaveAllStatus] = useState<string | null>(null)

    // Auth + data loading
    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) { router.push('/auth/login'); return }

            // Admin check
            let companyId = user.user_metadata?.company_id
            if (!companyId) {
                const { data } = await supabase.from('company_users').select('company_id').eq('email', user.email).eq('status', 'active').single()
                companyId = data?.company_id
            }
            if (!companyId) {
                const { data } = await supabase.from('companies').select('company_id').limit(1).single()
                companyId = data?.company_id
            }
            const isHardcoded = ['paul.lyons67@icloud.com'].includes((user.email || '').toLowerCase())
            if (!isHardcoded && companyId) {
                const { data } = await supabase.from('company_users').select('role').eq('email', user.email).eq('company_id', companyId).eq('status', 'active').single()
                if (data?.role !== 'admin') { router.push('/auth/contracts-dashboard'); return }
            } else if (!isHardcoded) { router.push('/auth/contracts-dashboard'); return }

            // Load playbook metadata
            const { data: pb } = await supabase
                .from('company_playbooks')
                .select('*')
                .eq('playbook_id', playbookId)
                .single()
            if (!pb) { router.push('/auth/company-admin?tab=playbooks'); return }
            setPlaybook(pb as PlaybookMeta)

            // Load rules
            const { data: rulesData } = await supabase
                .from('playbook_rules')
                .select('*')
                .eq('playbook_id', playbookId)
                .eq('is_active', true)
                .order('category')
                .order('display_order', { ascending: true })

            const loadedRules = (rulesData || []) as PlaybookRule[]
            setRules(loadedRules)

            // Expand all categories by default
            const cats = new Set(loadedRules.map(r => normaliseCategory(r.category)))
            setExpandedCategories(cats)
            setLoading(false)
        }
        init()
    }, [playbookId, router])

    // Count schedule rules for toggle badge
    const scheduleRuleCount = rules.filter(r => !!r.schedule_type).length
    const mainBodyRuleCount = rules.filter(r => !r.schedule_type).length

    // Group rules by category (or by schedule_type in schedule view)
    const ruleGroups: RuleGroup[] = (() => {
        const scopedRules = filterRulesByScope(rules, ruleViewMode)
        if (ruleViewMode === 'schedule') {
            // Group by schedule_type instead of category
            const scheduleGroups = groupRulesByScheduleType(scopedRules)
            return Object.entries(scheduleGroups)
                .map(([schedType, schedRules]) => ({
                    category: schedType,
                    displayName: getScheduleTypeLabel(schedType),
                    rules: schedRules,
                }))
                .sort((a, b) => a.displayName.localeCompare(b.displayName))
        }
        // Default: group by category (main body rules)
        const grouped = new Map<string, PlaybookRule[]>()
        for (const rule of scopedRules) {
            const cat = normaliseCategory(rule.category)
            if (!grouped.has(cat)) grouped.set(cat, [])
            grouped.get(cat)!.push(rule)
        }
        return Array.from(grouped.entries())
            .map(([category, catRules]) => ({
                category,
                displayName: getCategoryDisplayName(category),
                rules: catRules,
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
    })()

    // Get the effective (possibly dirty) version of a rule
    const getEffectiveRule = (rule: PlaybookRule): PlaybookRule => {
        const dirty = dirtyRules.get(rule.rule_id)
        if (!dirty) return rule
        return { ...rule, ...dirty }
    }

    // Field change handler
    const handleFieldChange = (ruleId: string, field: string, value: unknown) => {
        setDirtyRules(prev => {
            const next = new Map(prev)
            const existing = next.get(ruleId) || {}
            next.set(ruleId, { ...existing, [field]: value })
            return next
        })
        // Also update the rules state for immediate UI feedback
        setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, [field]: value } : r))
    }

    // Position change with ordering validation
    const handlePositionChange = (ruleId: string, field: string, value: number) => {
        const rule = getEffectiveRule(rules.find(r => r.rule_id === ruleId)!)
        const updated = { ...rule, [field]: value }

        // Auto-adjust to maintain min <= fallback <= ideal <= max
        if (field === 'minimum_position') {
            if (value > updated.fallback_position) updated.fallback_position = value
            if (value > updated.ideal_position) updated.ideal_position = value
            if (value > updated.maximum_position) updated.maximum_position = value
        } else if (field === 'fallback_position') {
            if (value < updated.minimum_position) updated.minimum_position = value
            if (value > updated.ideal_position) updated.ideal_position = value
            if (value > updated.maximum_position) updated.maximum_position = value
        } else if (field === 'ideal_position') {
            if (value < updated.minimum_position) updated.minimum_position = value
            if (value < updated.fallback_position) updated.fallback_position = value
            if (value > updated.maximum_position) updated.maximum_position = value
        } else if (field === 'maximum_position') {
            if (value < updated.minimum_position) updated.minimum_position = value
            if (value < updated.fallback_position) updated.fallback_position = value
            if (value < updated.ideal_position) updated.ideal_position = value
        }

        // Batch all position updates
        const positionUpdates: Partial<PlaybookRule> = {
            minimum_position: updated.minimum_position,
            fallback_position: updated.fallback_position,
            ideal_position: updated.ideal_position,
            maximum_position: updated.maximum_position,
        }

        setDirtyRules(prev => {
            const next = new Map(prev)
            const existing = next.get(ruleId) || {}
            next.set(ruleId, { ...existing, ...positionUpdates })
            return next
        })
        setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, ...positionUpdates } : r))
    }

    // Save a single rule
    const saveRule = async (ruleId: string) => {
        const dirty = dirtyRules.get(ruleId)
        if (!dirty) return

        setSavingRules(prev => new Set(prev).add(ruleId))
        try {
            const res = await fetch(`/api/playbooks/${playbookId}/rules/${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dirty),
            })
            if (!res.ok) {
                const err = await res.json()
                console.error('Save failed:', err)
                return
            }
            const { rule: updated } = await res.json()
            setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, ...updated } : r))
            setDirtyRules(prev => {
                const next = new Map(prev)
                next.delete(ruleId)
                return next
            })
        } catch (e) {
            console.error('Save error:', e)
        } finally {
            setSavingRules(prev => { const next = new Set(prev); next.delete(ruleId); return next })
        }
    }

    // Save all dirty rules
    const saveAll = async () => {
        const dirtyIds = Array.from(dirtyRules.keys())
        if (dirtyIds.length === 0) return
        setSaveAllStatus(`Saving ${dirtyIds.length} rule${dirtyIds.length > 1 ? 's' : ''}...`)
        for (const ruleId of dirtyIds) {
            await saveRule(ruleId)
        }
        setSaveAllStatus('All changes saved')
        setTimeout(() => setSaveAllStatus(null), 2000)
    }

    // Filter and search
    const filteredGroups = ruleGroups
        .filter(g => !filterCategory || g.category === filterCategory)
        .map(g => ({
            ...g,
            rules: g.rules.filter(r =>
                !searchTerm || r.clause_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.clause_code && r.clause_code.toLowerCase().includes(searchTerm.toLowerCase()))
            ),
        }))
        .filter(g => g.rules.length > 0)

    const dirtyCount = dirtyRules.size
    const categories = ruleGroups.map(g => ({ key: g.category, name: g.displayName, count: g.rules.length }))
    const needsReviewCount = rules.filter(r =>
        r.ideal_position === r.minimum_position && r.ideal_position === r.maximum_position && r.ideal_position === r.fallback_position
    ).length

    if (loading) return <PlaybookIQLoading />
    if (!playbook) return null

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/auth/company-admin?tab=playbooks')} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-bold text-slate-800">PlaybookIQ</h1>
                                    <span className="text-lg text-slate-300">|</span>
                                    <span className="text-lg font-medium text-slate-600">{playbook.playbook_name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                    <span>{rules.length} rules</span>
                                    <span>{categories.length} categories</span>
                                    {playbook.ai_confidence_score != null && (
                                        <span>{Math.round(playbook.ai_confidence_score * 100)}% confidence</span>
                                    )}
                                    {needsReviewCount > 0 && (
                                        <span className="text-red-600 font-medium">{needsReviewCount} need review</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a href={`/auth/company-admin/playbook/${playbookId}/cross-check`}
                                className="px-2.5 py-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors">
                                Cross-check Templates
                            </a>
                            {playbook.contract_type_key && (
                                <span className="px-2 py-1 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                    {playbook.contract_type_key.toUpperCase()}
                                </span>
                            )}
                            <span className={`px-2 py-1 text-[10px] font-medium rounded-full border ${playbook.playbook_perspective === 'provider' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {playbook.playbook_perspective === 'provider' ? 'Provider' : 'Customer'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white border-b border-slate-100 sticky top-[65px] z-30">
                <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
                    {/* Main Body / Schedule toggle */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setRuleViewMode('main_body')}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${ruleViewMode === 'main_body' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Main Body{mainBodyRuleCount > 0 && ` (${mainBodyRuleCount})`}
                        </button>
                        <button
                            onClick={() => setRuleViewMode('schedule')}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${ruleViewMode === 'schedule' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Schedules{scheduleRuleCount > 0 && ` (${scheduleRuleCount})`}
                        </button>
                    </div>

                    <div className="w-px h-5 bg-slate-200" />

                    {/* Category filter */}
                    <select
                        value={filterCategory || ''}
                        onChange={(e) => setFilterCategory(e.target.value || null)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="">All categories ({rules.length})</option>
                        {categories.map(c => (
                            <option key={c.key} value={c.key}>{c.name} ({c.count})</option>
                        ))}
                    </select>

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search rules..."
                            className="w-full px-3 py-1.5 pl-8 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                        <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Expand/Collapse */}
                    <button
                        onClick={() => {
                            if (expandedCategories.size === categories.length) setExpandedCategories(new Set())
                            else setExpandedCategories(new Set(categories.map(c => c.key)))
                        }}
                        className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        {expandedCategories.size === categories.length ? 'Collapse All' : 'Expand All'}
                    </button>

                    <div className="flex-1" />

                    {/* Save all */}
                    {saveAllStatus && (
                        <span className="text-xs text-emerald-600 font-medium">{saveAllStatus}</span>
                    )}
                    {dirtyCount > 0 && (
                        <button
                            onClick={saveAll}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            Save All Changes
                            <span className="px-1.5 py-0.5 text-[9px] bg-white/20 rounded">{dirtyCount}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Rules list */}
            <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
                {filteredGroups.length === 0 && ruleViewMode === 'schedule' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <p className="text-sm text-slate-500">No schedule-specific rules found in this playbook.</p>
                        <p className="text-xs text-slate-400 mt-1">Schedule rules are automatically detected when a playbook is parsed, or can be tagged manually.</p>
                    </div>
                )}
                {filteredGroups.map(group => (
                    <div key={group.category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Category header */}
                        <button
                            onClick={() => setExpandedCategories(prev => {
                                const next = new Set(prev)
                                next.has(group.category) ? next.delete(group.category) : next.add(group.category)
                                return next
                            })}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedCategories.has(group.category) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">{group.displayName}</h3>
                                <span className="text-xs text-slate-400">{group.rules.length} rule{group.rules.length !== 1 ? 's' : ''}</span>
                            </div>
                            {group.rules.some(r => dirtyRules.has(r.rule_id)) && (
                                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-amber-100 text-amber-700 rounded">Unsaved</span>
                            )}
                        </button>

                        {/* Rules */}
                        {expandedCategories.has(group.category) && (
                            <div className="px-4 pb-4 space-y-3">
                                {group.rules.map(rule => (
                                    <RuleCard
                                        key={rule.rule_id}
                                        rule={getEffectiveRule(rule)}
                                        isDirty={dirtyRules.has(rule.rule_id)}
                                        onFieldChange={(field, value) => handleFieldChange(rule.rule_id, field, value)}
                                        onPositionChange={(field, value) => handlePositionChange(rule.rule_id, field, value)}
                                        onSave={() => saveRule(rule.rule_id)}
                                        saving={savingRules.has(rule.rule_id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {filteredGroups.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        {searchTerm ? 'No rules match your search' : 'No rules found for this playbook'}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// PAGE WRAPPER
// ============================================================================

export default function PlaybookReviewPage() {
    return (
        <Suspense fallback={<PlaybookIQLoading />}>
            <PlaybookReviewContent />
        </Suspense>
    )
}
