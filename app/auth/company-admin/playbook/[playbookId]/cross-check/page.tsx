'use client'
import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    ResponsiveContainer,
} from 'recharts'
import {
    PlaybookRule,
    ContractClause,
    ComplianceResult,
    ScoredRule,
    RuleStatus,
    normaliseCategory,
    getCategoryDisplayName,
    calculatePlaybookCompliance,
    getEffectiveRangeContext,
    translateRulePosition,
} from '@/lib/playbook-compliance'
import {
    ScoreRing,
    RedLinesTab,
    FlexibilityTab,
} from '@/app/components/PlaybookComplianceIndicator'

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

interface TemplateSummary {
    template_id: string
    template_name: string
    contract_type: string
    clause_count: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawTemplateClause = Record<string, any>

interface TemplateClauseRow {
    template_clause_id: string
    clause_name: string
    category_name: string
    default_customer_position_override: number | null
    default_provider_position_override: number | null
    clarence_position: number | null
}

function normaliseClauseRow(raw: RawTemplateClause): TemplateClauseRow {
    return {
        template_clause_id: raw.template_clause_id || raw.id || '',
        clause_name: raw.clause_name || 'Untitled',
        category_name: raw.category_name || raw.category || 'Other',
        default_customer_position_override: raw.default_customer_position_override ?? null,
        default_provider_position_override: raw.default_provider_position_override ?? null,
        clarence_position: raw.clarence_position ?? null,
    }
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
// TEMPLATE CLAUSE ADAPTER
// ============================================================================

function templateClausesToComplianceClauses(
    clauses: TemplateClauseRow[]
): ContractClause[] {
    return clauses.map(tc => ({
        clause_id: tc.template_clause_id,
        clause_name: tc.clause_name || 'Untitled',
        category: tc.category_name || 'Other',
        clarence_position: tc.clarence_position ?? null,
        initiator_position: tc.default_customer_position_override ?? null,
        respondent_position: tc.default_provider_position_override ?? null,
        customer_position: tc.default_customer_position_override ?? null,
        is_header: false,
    }))
}

// ============================================================================
// STATUS ICON
// ============================================================================

function StatusIcon({ status }: { status: RuleStatus | string }) {
    if (status === 'pass' || status === 'clear') {
        return (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
            </svg>
        )
    }
    if (status === 'fail' || status === 'breach' || status === 'escalation') {
        return (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
        )
    }
    if (status === 'warning' || status === 'acceptable') {
        return (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        )
    }
    return <span className="w-3.5 h-3.5 rounded-full bg-slate-200 inline-block" />
}

// ============================================================================
// DIVERGING BAR — Centred on playbook ideal; bar extends toward template position
// ============================================================================

function AlignmentBar({ rule, templatePosition }: {
    rule: PlaybookRule
    templatePosition: number | null
}) {
    const toPercent = (val: number) => ((val - 1) / 9) * 100
    const rangeCtx = getEffectiveRangeContext(rule)

    const idealPct  = toPercent(rule.ideal_position)
    const minPct    = toPercent(rule.minimum_position)
    const maxPct    = toPercent(rule.maximum_position)

    // Diverging bar: from ideal toward template
    let barLeft  = idealPct
    let barWidth = 0
    let barColor = 'bg-slate-300'
    let gapLabel: string | null = null
    let gapColor = 'text-slate-400'

    if (templatePosition != null) {
        const tPct = toPercent(templatePosition)
        const diff = templatePosition - rule.ideal_position

        if (diff < 0) {
            // Template is below ideal → bar extends left
            barLeft  = tPct
            barWidth = idealPct - tPct
            if (templatePosition < rule.minimum_position) {
                barColor  = 'bg-red-400'
                gapColor  = 'text-red-500'
                gapLabel  = `${Math.abs(diff)} below ideal · breaches minimum`
            } else {
                barColor  = 'bg-amber-400'
                gapColor  = 'text-amber-500'
                gapLabel  = `${Math.abs(diff)} below ideal`
            }
        } else if (diff > 0) {
            // Template is above ideal → bar extends right
            barLeft  = idealPct
            barWidth = tPct - idealPct
            barColor  = 'bg-emerald-400'
            gapColor  = 'text-emerald-600'
            gapLabel  = `${diff} above ideal`
        } else {
            gapLabel = 'Exact match'
            gapColor = 'text-emerald-600'
        }
    }

    const diamondColor = templatePosition == null
        ? 'bg-slate-300'
        : templatePosition >= rule.minimum_position ? 'bg-emerald-500' : 'bg-red-500'

    return (
        <div className="mt-1.5 mb-1">
            {/* Unit badge */}
            {rangeCtx && (
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        {rangeCtx.range_unit || rangeCtx.value_type}
                    </span>
                    {rangeCtx.source === 'inferred' && (
                        <span className="text-[9px] text-slate-400 italic">typical range</span>
                    )}
                </div>
            )}

            {/* Bar */}
            <div className="relative h-8">
                {/* Track */}
                <div className="absolute top-3 left-0 right-0 h-2 bg-slate-100 rounded-full" />
                {/* Acceptable range band */}
                <div className="absolute top-3 h-2 bg-blue-50 border border-blue-100 rounded-full"
                    style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
                {/* Diverging bar */}
                {barWidth > 0 && (
                    <div className={`absolute top-3 h-2 rounded-full ${barColor} opacity-80`}
                        style={{ left: `${barLeft}%`, width: `${barWidth}%` }} />
                )}
                {/* Ideal centre line */}
                <div className="absolute top-1.5 w-0.5 h-5 bg-purple-500 rounded-full z-10"
                    style={{ left: `${idealPct}%`, transform: 'translateX(-50%)' }} />
                {/* Template position diamond */}
                {templatePosition != null && (
                    <div className={`absolute top-1.5 w-4 h-4 rounded-sm ${diamondColor} border-2 border-white shadow-md z-20`}
                        style={{ left: `${toPercent(templatePosition)}%`, transform: 'translateX(-50%) rotate(45deg)' }} />
                )}
            </div>

            {/* Scale labels */}
            {rangeCtx && rangeCtx.scale_points.length > 0 && (
                <div className="relative h-4 text-[8px] text-slate-400 mt-0.5">
                    {rangeCtx.scale_points
                        .filter((_, i, arr) => i === 0 || i === arr.length - 1 || arr.length <= 5)
                        .map((sp, idx, arr) => {
                            const pct = toPercent(sp.position)
                            const isFirst = idx === 0
                            const isLast  = idx === arr.length - 1
                            const transform = isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)'
                            return (
                                <span key={sp.position}
                                    className="absolute"
                                    style={{ left: `${pct}%`, transform }}>
                                    {sp.label}
                                </span>
                            )
                        })}
                </div>
            )}

            {/* Gap label */}
            {gapLabel && (
                <div className={`text-[9px] mt-0.5 font-medium ${gapColor}`}>{gapLabel}</div>
            )}
        </div>
    )
}

// ============================================================================
// SNAPSHOT PANEL — Radar overview + aligned/partial/misaligned counts
// ============================================================================

function SnapshotPanel({ compliance }: { compliance: ComplianceResult }) {
    const radarData = compliance.categories.map(cat => ({
        subject: cat.name.length > 14 ? cat.name.slice(0, 12) + '…' : cat.name,
        score: cat.score,
        fullMark: 100,
    }))

    const aligned    = compliance.categories.filter(c => c.score >= 80).length
    const partial    = compliance.categories.filter(c => c.score >= 60 && c.score < 80).length
    const misaligned = compliance.categories.filter(c => c.score < 60).length

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex items-center gap-6">
            {/* Radar chart */}
            <div className="w-52 h-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 8, fill: '#94a3b8' }}
                        />
                        <Radar
                            name="Alignment"
                            dataKey="score"
                            stroke="#6366f1"
                            fill="#6366f1"
                            fillOpacity={0.18}
                            strokeWidth={1.5}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-slate-100" />

            {/* Counters + legend */}
            <div className="flex-1 space-y-3">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    Alignment Snapshot
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <div className="text-2xl font-bold text-emerald-600">{aligned}</div>
                        <div className="text-[10px] text-slate-500">Aligned <span className="text-slate-300">(≥80%)</span></div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-amber-500">{partial}</div>
                        <div className="text-[10px] text-slate-500">Partial <span className="text-slate-300">(60–79%)</span></div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-red-500">{misaligned}</div>
                        <div className="text-[10px] text-slate-500">Misaligned <span className="text-slate-300">(&lt;60%)</span></div>
                    </div>
                </div>
                {/* Bar legend */}
                <div className="flex items-center gap-4 text-[9px] text-slate-400 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> Ideal position
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-1.5 bg-emerald-400 inline-block rounded opacity-80" /> Above ideal
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-1.5 bg-amber-400 inline-block rounded opacity-80" /> Below ideal
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-1.5 bg-red-400 inline-block rounded opacity-80" /> Breach
                    </span>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// ALIGNMENT CARD — Shows one rule's alignment with template
// ============================================================================

function AlignmentCard({ scored, templateClauses }: {
    scored: ScoredRule
    templateClauses: TemplateClauseRow[]
}) {
    const { rule, status, score, effectivePosition } = scored
    const normCat = normaliseCategory(rule.category)

    // Find the template clause(s) that matched this rule's category
    const matchedClauses = templateClauses.filter(tc =>
        normaliseCategory(tc.category_name || '') === normCat
    )

    const statusLabel = status === 'pass' ? 'Aligned' :
        status === 'fail' || status === 'breach' ? 'Misaligned' :
            status === 'warning' || status === 'acceptable' ? 'Partial' :
                status === 'excluded' ? 'No position' : status

    const statusColor = status === 'pass' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
        status === 'fail' || status === 'breach' ? 'text-red-600 bg-red-50 border-red-200' :
            status === 'warning' || status === 'acceptable' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                'text-slate-500 bg-slate-50 border-slate-200'

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-2">
            <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <div>
                        <div className="flex items-center gap-1.5">
                            {rule.clause_code && (
                                <span className="text-[10px] font-mono text-slate-400">{rule.clause_code}</span>
                            )}
                            <span className="text-xs font-semibold text-slate-800">{rule.clause_name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {rule.is_deal_breaker && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded">Deal Breaker</span>
                    )}
                    {rule.is_non_negotiable && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">Non-Negotiable</span>
                    )}
                    <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border ${statusColor}`}>
                        {statusLabel}
                    </span>
                </div>
            </div>

            <AlignmentBar rule={rule} templatePosition={effectivePosition} />

            {/* Position details */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                <span>Playbook: min {rule.minimum_position} / ideal {rule.ideal_position} / max {rule.maximum_position}</span>
                {effectivePosition != null && (
                    <>
                        <span className="text-slate-300">|</span>
                        <span className={effectivePosition >= rule.minimum_position ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                            Template position: {effectivePosition}
                        </span>
                    </>
                )}
            </div>

            {/* Matched template clause names */}
            {matchedClauses.length > 0 && (
                <div className="mt-1.5 text-[10px] text-slate-400">
                    Template clause{matchedClauses.length > 1 ? 's' : ''}: {matchedClauses.map(tc => tc.clause_name).join(', ')}
                </div>
            )}

            {/* Escalation info if breached */}
            {(status === 'breach' || status === 'fail') && rule.escalation_contact && (
                <div className="mt-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
                    Escalate to: {rule.escalation_contact}
                    {rule.escalation_contact_email && ` (${rule.escalation_contact_email})`}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// GAP ANALYSIS SECTION
// ============================================================================

function GapAnalysis({ compliance, rules, templateClauses }: {
    compliance: ComplianceResult
    rules: PlaybookRule[]
    templateClauses: TemplateClauseRow[]
}) {
    // Uncovered rules: playbook rules in categories with no template match
    const uncoveredRules = rules.filter(r =>
        compliance.unmatchedCategories.includes(normaliseCategory(r.category))
    )

    // Unguided clauses: template clauses whose category has no playbook rule
    const playbookCategories = new Set(rules.map(r => normaliseCategory(r.category)))
    const unguidedClauses = templateClauses.filter(tc =>
        !playbookCategories.has(normaliseCategory(tc.category_name || ''))
    )

    // Group unguided by category
    const unguidedByCategory = new Map<string, TemplateClauseRow[]>()
    for (const tc of unguidedClauses) {
        const cat = getCategoryDisplayName(normaliseCategory(tc.category_name || ''))
        if (!unguidedByCategory.has(cat)) unguidedByCategory.set(cat, [])
        unguidedByCategory.get(cat)!.push(tc)
    }

    if (uncoveredRules.length === 0 && unguidedClauses.length === 0) {
        return (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
                </svg>
                <div>
                    <div className="text-sm font-semibold text-emerald-700">Full Coverage</div>
                    <div className="text-xs text-emerald-600">
                        All playbook categories have matching template clauses and vice versa
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Uncovered Rules */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                        {uncoveredRules.length}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800">Uncovered Rules</h3>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                    Playbook rules with no matching template clause. These rules cannot be enforced by this template.
                </p>
                {uncoveredRules.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">None — all playbook categories are covered</p>
                ) : (
                    <div className="space-y-1.5">
                        {uncoveredRules.map(rule => (
                            <div key={rule.rule_id} className="flex items-start gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                                <div className="mt-0.5">
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        {rule.clause_code && (
                                            <span className="text-[9px] font-mono text-slate-400">{rule.clause_code}</span>
                                        )}
                                        <span className="text-[11px] font-medium text-slate-700">{rule.clause_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-slate-400">
                                            {getCategoryDisplayName(normaliseCategory(rule.category))}
                                        </span>
                                        {rule.is_deal_breaker && (
                                            <span className="text-[9px] font-bold text-red-600">Deal Breaker</span>
                                        )}
                                        <span className="text-[9px] text-slate-400">
                                            Importance: {rule.importance_level}/10
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Unguided Clauses */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                        {unguidedClauses.length}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800">Unguided Clauses</h3>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                    Template clauses with no matching playbook rule. These clauses have no negotiation guidance.
                </p>
                {unguidedClauses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">None — all template categories are guided by the playbook</p>
                ) : (
                    <div className="space-y-1.5">
                        {Array.from(unguidedByCategory.entries()).map(([catName, clauses]) => (
                            <div key={catName} className="p-2 bg-slate-50 rounded border border-slate-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <span className="text-[11px] font-semibold text-slate-700">{catName}</span>
                                    <span className="text-[9px] text-slate-400">{clauses.length} clause{clauses.length > 1 ? 's' : ''}</span>
                                </div>
                                <div className="pl-5 space-y-0.5">
                                    {clauses.map(tc => (
                                        <div key={tc.template_clause_id} className="text-[10px] text-slate-500">
                                            {tc.clause_name}
                                            {tc.default_customer_position_override != null && (
                                                <span className="ml-1 text-slate-400">(pos: {tc.default_customer_position_override})</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// CATEGORIES TAB — Custom version with AlignmentCards
// ============================================================================

function CrossCheckCategoriesTab({ compliance, templateClauses, expandedCategories, toggleCategory }: {
    compliance: ComplianceResult
    templateClauses: TemplateClauseRow[]
    expandedCategories: Set<string>
    toggleCategory: (key: string) => void
}) {
    return (
        <div className="space-y-1.5">
            {compliance.categories.map(cat => {
                const isOpen = expandedCategories.has(cat.normalisedKey)
                const barColor = cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                const barTrack = cat.score >= 80 ? 'bg-emerald-100' : cat.score >= 60 ? 'bg-amber-100' : 'bg-red-100'

                return (
                    <div key={cat.normalisedKey} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                        <button
                            onClick={() => toggleCategory(cat.normalisedKey)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                        >
                            <ScoreRing score={cat.score} size={36} strokeWidth={3.5} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-800">{cat.name}</div>
                                <div className="text-[10px] text-slate-400">
                                    {cat.rulesPassed} aligned · {cat.rulesWarning} partial · {cat.rulesFailed} misaligned of {cat.rulesTotal}
                                </div>
                            </div>
                            <div className="w-24 flex-shrink-0">
                                <div className={`w-full h-1.5 rounded-full ${barTrack} overflow-hidden`}>
                                    <div className={`h-full rounded-full ${barColor} transition-all duration-700`}
                                        style={{ width: `${cat.score}%` }} />
                                </div>
                            </div>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {isOpen && (
                            <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50">
                                {cat.rules.map(scored => (
                                    <AlignmentCard key={scored.rule.rule_id} scored={scored} templateClauses={templateClauses} />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ============================================================================
// MAIN CONTENT
// ============================================================================

function CrossCheckContent() {
    const router = useRouter()
    const params = useParams()
    const playbookId = params.playbookId as string

    const [loading, setLoading] = useState(true)
    const [playbook, setPlaybook] = useState<PlaybookMeta | null>(null)
    const [rules, setRules] = useState<PlaybookRule[]>([])
    const [templates, setTemplates] = useState<TemplateSummary[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [templateClauses, setTemplateClauses] = useState<TemplateClauseRow[]>([])
    const [loadingClauses, setLoadingClauses] = useState(false)
    const [activeTab, setActiveTab] = useState<'categories' | 'gaps' | 'redlines' | 'flexibility'>('categories')
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

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
            setRules((rulesData || []) as PlaybookRule[])

            // Load company templates (match company-admin filters)
            const { data: tmplData } = await supabase
                .from('contract_templates')
                .select('template_id, template_name, contract_type, clause_count')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .eq('is_system', false)
                .order('template_name')
            setTemplates((tmplData || []).map((t: Record<string, unknown>) => ({
                template_id: t.template_id as string,
                template_name: t.template_name as string,
                contract_type: (t.contract_type as string) || 'custom',
                clause_count: (t.clause_count as number) || 0,
            })))

            setLoading(false)
        }
        init()
    }, [playbookId, router])

    // Load template clauses on selection
    useEffect(() => {
        if (!selectedTemplateId) {
            setTemplateClauses([])
            return
        }
        const loadClauses = async () => {
            setLoadingClauses(true)
            const supabase = createClient()
            const { data } = await supabase
                .from('template_clauses')
                .select('*')
                .eq('template_id', selectedTemplateId)
                .order('display_order', { ascending: true })
            setTemplateClauses((data || []).map(normaliseClauseRow))
            setLoadingClauses(false)
            // Expand all categories by default when template loads
            if (data && data.length > 0) {
                const cats = new Set([
                    ...rules.map(r => normaliseCategory(r.category)),
                ])
                setExpandedCategories(cats)
            }
        }
        loadClauses()
    }, [selectedTemplateId, rules])

    // Calculate compliance
    const compliance: ComplianceResult | null = useMemo(() => {
        if (!rules.length || !templateClauses.length) return null
        const adapted = templateClausesToComplianceClauses(templateClauses)
        return calculatePlaybookCompliance(
            rules,
            adapted,
            playbook?.playbook_perspective || 'customer'
        )
    }, [rules, templateClauses, playbook?.playbook_perspective])

    const toggleCategory = (key: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const categories = useMemo(() => {
        const grouped = new Map<string, PlaybookRule[]>()
        for (const rule of rules) {
            const cat = normaliseCategory(rule.category)
            if (!grouped.has(cat)) grouped.set(cat, [])
            grouped.get(cat)!.push(rule)
        }
        return Array.from(grouped.entries()).map(([key, catRules]) => ({
            key,
            name: getCategoryDisplayName(key),
            count: catRules.length,
        }))
    }, [rules])

    // Compute gap counts to match what GapAnalysis displays
    const gapCount = useMemo(() => {
        if (!compliance) return 0
        const uncoveredRules = rules.filter(r =>
            compliance.unmatchedCategories.includes(normaliseCategory(r.category))
        ).length
        const playbookCategories = new Set(rules.map(r => normaliseCategory(r.category)))
        const unguidedClauses = templateClauses.filter(tc =>
            !playbookCategories.has(normaliseCategory(tc.category_name || ''))
        ).length
        return uncoveredRules + unguidedClauses
    }, [compliance, rules, templateClauses])

    if (loading) return <PlaybookIQLoading />
    if (!playbook) return null

    const tabs = [
        { id: 'categories' as const, label: 'Categories', count: compliance?.categories.length },
        { id: 'gaps' as const, label: 'Gaps', count: gapCount },
        { id: 'redlines' as const, label: 'Red Lines', count: compliance?.redLineBreaches },
        { id: 'flexibility' as const, label: 'Flexibility', count: compliance?.flexibility.length },
    ]

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
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Navigation tabs */}
                            <a href={`/auth/company-admin/playbook/${playbookId}`}
                                className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors">
                                Review
                            </a>
                            <span className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-200">
                                Cross-check
                            </span>
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

            {/* Template selector bar */}
            <div className="bg-white border-b border-slate-100 sticky top-[65px] z-30">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 flex-1">
                            <label className="text-xs font-medium text-slate-600">Template:</label>
                            <select
                                value={selectedTemplateId || ''}
                                onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none max-w-sm flex-1"
                            >
                                <option value="">Select a template to cross-check...</option>
                                {templates.map(t => (
                                    <option key={t.template_id} value={t.template_id}>
                                        {t.template_name} ({t.contract_type.toUpperCase()}, {t.clause_count} clauses)
                                    </option>
                                ))}
                            </select>
                            {loadingClauses && (
                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            )}
                        </div>
                        {compliance && (
                            <div className="flex items-center gap-4">
                                <ScoreRing score={compliance.overallScore} size={40} strokeWidth={3.5} />
                                <div className="text-[11px] text-slate-500 space-y-0.5">
                                    <div><span className="font-semibold text-slate-700">{compliance.categories.length}</span> categories matched</div>
                                    <div>
                                        {compliance.unmatchedCategories.length > 0 && (
                                            <span className="text-red-600 font-medium">{compliance.unmatchedCategories.length} gaps</span>
                                        )}
                                        {compliance.redLineBreaches > 0 && (
                                            <span className="text-red-600 font-medium ml-2">{compliance.redLineBreaches} red line{compliance.redLineBreaches > 1 ? 's' : ''}</span>
                                        )}
                                        {compliance.unmatchedCategories.length === 0 && compliance.redLineBreaches === 0 && (
                                            <span className="text-emerald-600 font-medium">All clear</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="max-w-6xl mx-auto px-4 py-4">
                {!selectedTemplateId ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-slate-700 mb-1">Select a Template</h2>
                        <p className="text-sm text-slate-500 max-w-md">
                            Choose a contract template from the dropdown above to cross-check its clause positions against this playbook&apos;s rules.
                        </p>
                        {templates.length === 0 && (
                            <p className="text-xs text-amber-600 mt-3 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                No active templates found for your company. Create a template first.
                            </p>
                        )}
                    </div>
                ) : loadingClauses ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !compliance ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-sm text-slate-500">No compliance data available. The template may have no clauses with position data.</p>
                    </div>
                ) : (
                    <>
                        {/* Snapshot panel */}
                        <SnapshotPanel compliance={compliance} />

                        {/* Tabs */}
                        <div className="flex items-center gap-1 mb-4 bg-white rounded-lg border border-slate-200 p-1 w-fit">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
                                    }`}
                                >
                                    {tab.label}
                                    {tab.count != null && tab.count > 0 && (
                                        <span className={`ml-1 px-1 py-0.5 text-[9px] rounded-full ${
                                            activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' :
                                                tab.id === 'redlines' && tab.count > 0 ? 'bg-red-100 text-red-600' :
                                                    tab.id === 'gaps' && tab.count > 0 ? 'bg-amber-100 text-amber-600' :
                                                        'bg-slate-100 text-slate-500'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        {activeTab === 'categories' && (
                            <CrossCheckCategoriesTab
                                compliance={compliance}
                                templateClauses={templateClauses}
                                expandedCategories={expandedCategories}
                                toggleCategory={toggleCategory}
                            />
                        )}

                        {activeTab === 'gaps' && (
                            <GapAnalysis
                                compliance={compliance}
                                rules={rules}
                                templateClauses={templateClauses}
                            />
                        )}

                        {activeTab === 'redlines' && (
                            <RedLinesTab redLines={compliance.redLines} />
                        )}

                        {activeTab === 'flexibility' && (
                            <FlexibilityTab flexibility={compliance.flexibility} />
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// PAGE EXPORT
// ============================================================================

export default function CrossCheckPage() {
    return (
        <Suspense fallback={<PlaybookIQLoading />}>
            <CrossCheckContent />
        </Suspense>
    )
}
