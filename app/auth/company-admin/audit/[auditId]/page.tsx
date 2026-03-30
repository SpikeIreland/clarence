'use client'
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
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
    CategoryResult,
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
import type {
    AlignmentReportResult,
    CategoryNarrative,
    AlignmentTier,
    ClauseNarrative,
    ClauseCentricAlignmentResult,
} from '@/lib/alignment-engine'
import type {
    ClauseAuditResult,
    ClauseAuditSummary,
} from '@/lib/playbook-compliance'

// ============================================================================
// TYPES
// ============================================================================

/** Combined results shape saved by the new API route */
interface CombinedAuditResults {
    clauseCentric?: ClauseCentricAlignmentResult
    legacy?: AlignmentReportResult
    overallScore?: number
}

interface AuditData {
    audit_id: string
    company_id: string
    playbook_id: string
    template_id: string
    audit_name: string
    focus_categories: string[]
    status: 'pending' | 'running' | 'complete' | 'failed'
    overall_score: number | null
    results: AlignmentReportResult | CombinedAuditResults | null
    error_message: string | null
    created_at: string
    started_at: string | null
    completed_at: string | null
    // Enriched fields
    playbook_name: string
    playbook_perspective: 'customer' | 'provider'
    rules_extracted: number
    template_name: string
    contract_type: string
    clause_count: number
}

/** Helper: extract clause-centric data from results (if available) */
function getClauseCentricData(results: AuditData['results']): ClauseCentricAlignmentResult | null {
    if (!results) return null
    // New combined format
    if ('clauseCentric' in results && results.clauseCentric) {
        return results.clauseCentric as ClauseCentricAlignmentResult
    }
    return null
}

/** Helper: extract legacy compliance data from results */
function getLegacyData(results: AuditData['results']): AlignmentReportResult | null {
    if (!results) return null
    // New combined format
    if ('legacy' in results && results.legacy) {
        return results.legacy as AlignmentReportResult
    }
    // Old format — the results IS the AlignmentReportResult
    if ('compliance' in results && 'narratives' in results) {
        return results as AlignmentReportResult
    }
    return null
}

interface TemplateClauseRow {
    template_clause_id: string
    clause_name: string
    category_name: string
    default_customer_position_override: number | null
    default_provider_position_override: number | null
    clarence_position: number | null
}

// ============================================================================
// HELPERS
// ============================================================================

function templateClausesToComplianceClauses(clauses: TemplateClauseRow[]): ContractClause[] {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseClauseRow(raw: Record<string, any>): TemplateClauseRow {
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
// STATUS ICON
// ============================================================================

function StatusIcon({ status }: { status: string }) {
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
// THREE-TIER ALIGNMENT BADGE
// ============================================================================

function AlignmentTierBadge({ score }: { score: number }) {
    if (score >= 80) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Aligned
            </span>
        )
    }
    if (score >= 60) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Partially Aligned
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            Material Gap
        </span>
    )
}

// ============================================================================
// ALIGNMENT BAR — Centred on playbook ideal; bar extends toward template position
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

    let barLeft  = idealPct
    let barWidth = 0
    let barColor = 'bg-slate-300'
    let gapLabel: string | null = null
    let gapColor = 'text-slate-400'

    if (templatePosition != null) {
        const tPct = toPercent(templatePosition)
        const diff = templatePosition - rule.ideal_position

        if (diff < 0) {
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
            {rangeCtx && (
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        {rangeCtx.range_unit || rangeCtx.value_type}
                    </span>
                </div>
            )}
            <div className="relative h-8">
                <div className="absolute top-3 left-0 right-0 h-2 bg-slate-100 rounded-full" />
                <div className="absolute top-3 h-2 bg-blue-50 border border-blue-100 rounded-full"
                    style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }} />
                {barWidth > 0 && (
                    <div className={`absolute top-3 h-2 rounded-full ${barColor} opacity-80`}
                        style={{ left: `${barLeft}%`, width: `${barWidth}%` }} />
                )}
                <div className="absolute top-1.5 w-0.5 h-5 bg-purple-500 rounded-full z-10"
                    style={{ left: `${idealPct}%`, transform: 'translateX(-50%)' }} />
                {templatePosition != null && (
                    <div className={`absolute top-1.5 w-4 h-4 rounded-sm ${diamondColor} border-2 border-white shadow-md z-20`}
                        style={{ left: `${toPercent(templatePosition)}%`, transform: 'translateX(-50%) rotate(45deg)' }} />
                )}
            </div>
            {gapLabel && (
                <div className={`text-[9px] mt-0.5 font-medium ${gapColor}`}>{gapLabel}</div>
            )}
        </div>
    )
}

// ============================================================================
// ALIGNMENT CARD — One rule's alignment with template
// ============================================================================

function AlignmentCard({ scored, templateClauses }: {
    scored: ScoredRule
    templateClauses: TemplateClauseRow[]
}) {
    const { rule, status, effectivePosition } = scored
    const normCat = normaliseCategory(rule.category)

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
                            {rule.clause_code && <span className="text-[10px] font-mono text-slate-400">{rule.clause_code}</span>}
                            <span className="text-xs font-semibold text-slate-800">{rule.clause_name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {rule.is_deal_breaker && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded">Deal Breaker</span>}
                    {rule.is_non_negotiable && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">Non-Negotiable</span>}
                    <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border ${statusColor}`}>{statusLabel}</span>
                </div>
            </div>

            <AlignmentBar rule={rule} templatePosition={effectivePosition} />

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

            {matchedClauses.length > 0 && (
                <div className="mt-1.5 text-[10px] text-slate-400">
                    Template clause{matchedClauses.length > 1 ? 's' : ''}: {matchedClauses.map(tc => tc.clause_name).join(', ')}
                </div>
            )}

            {(status === 'breach' || status === 'fail') && rule.escalation_contact && (
                <div className="mt-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
                    Escalate to: {rule.escalation_contact}
                    {rule.escalation_contact_email && ` (${rule.escalation_contact_email})`}
                </div>
            )}

            {/* Rationale from playbook — rich context for the report */}
            {(status === 'fail' || status === 'breach' || status === 'warning' || status === 'acceptable') && rule.rationale && (
                <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Playbook Rationale</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">{rule.rationale}</div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SNAPSHOT PANEL — Radar overview + three-tier counts
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
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-5">
            <div className="flex items-center gap-6">
                {/* Radar chart */}
                {compliance.categories.length >= 3 && (
                    <>
                        <div className="w-56 h-48 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                    <Radar name="Alignment" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.18} strokeWidth={1.5} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-px self-stretch bg-slate-100" />
                    </>
                )}

                {/* Counters */}
                <div className="flex-1 space-y-3">
                    <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                        Alignment Summary
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-3xl font-bold text-emerald-600">{aligned}</div>
                            <div className="text-[11px] text-slate-500">Aligned <span className="text-slate-300">(≥80%)</span></div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-amber-500">{partial}</div>
                            <div className="text-[11px] text-slate-500">Partially Aligned <span className="text-slate-300">(60–79%)</span></div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-red-500">{misaligned}</div>
                            <div className="text-[11px] text-slate-500">Material Gap <span className="text-slate-300">(&lt;60%)</span></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] text-slate-400 pt-2 border-t border-slate-100">
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
        </div>
    )
}

// ============================================================================
// CATEGORY NARRATIVE PANEL
// ============================================================================

function CategoryNarrativePanel({ narrative }: { narrative: CategoryNarrative }) {
    const tierColors = {
        aligned: 'border-emerald-200 bg-emerald-50/50',
        partially_aligned: 'border-amber-200 bg-amber-50/50',
        material_gap: 'border-red-200 bg-red-50/50',
    }
    const tierTextColors = {
        aligned: 'text-emerald-800',
        partially_aligned: 'text-amber-800',
        material_gap: 'text-red-800',
    }

    return (
        <div className={`rounded-lg border p-4 ${tierColors[narrative.tier]}`}>
            {/* Risk Summary */}
            <div className="mb-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Risk Assessment</div>
                <p className={`text-sm leading-relaxed ${tierTextColors[narrative.tier]}`}>
                    {narrative.riskSummary}
                </p>
            </div>

            {/* Key Findings */}
            {narrative.keyFindings.length > 0 && (
                <div className="mb-3">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Key Findings</div>
                    <ul className="space-y-1">
                        {narrative.keyFindings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                                {finding}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Remediation */}
            <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Recommended Action</div>
                <p className="text-xs text-slate-700 leading-relaxed">{narrative.remediation}</p>
            </div>
        </div>
    )
}

// ============================================================================
// RISK LEVEL BADGE
// ============================================================================

function RiskLevelBadge({ level }: { level: string }) {
    const config = {
        critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Critical' },
        high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'High Risk' },
        medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Medium' },
        low: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Low Risk' },
    }[level] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: level }

    return (
        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${config.bg} ${config.text} ${config.border}`}>
            {config.label}
        </span>
    )
}

// ============================================================================
// CLAUSE AUDIT CARD — Single clause-rule pair with full context
// ============================================================================

function ClauseAuditCard({
    result,
    narrative,
    isExpanded,
    onToggle,
}: {
    result: ClauseAuditResult
    narrative?: ClauseNarrative
    isExpanded: boolean
    onToggle: () => void
}) {
    const scoreColor = result.score >= 80 ? 'text-emerald-600' : result.score >= 60 ? 'text-amber-600' : 'text-red-600'
    const barTrackColor = result.score >= 80 ? 'bg-emerald-100' : result.score >= 60 ? 'bg-amber-100' : 'bg-red-100'
    const barFillColor = result.score >= 80 ? 'bg-emerald-500' : result.score >= 60 ? 'bg-amber-500' : 'bg-red-500'

    // Build a lightweight position bar inline
    const toPercent = (val: number) => Math.min(100, Math.max(0, ((val - 1) / 9) * 100))
    const idealPct = toPercent(result.ruleIdealPosition)
    const minPct = toPercent(result.ruleMinimumPosition)
    const clausePct = result.clausePosition != null ? toPercent(result.clausePosition) : null

    return (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
            {/* Collapsed header row */}
            <button
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
            >
                {/* Status icon */}
                <StatusIcon status={result.status} />

                {/* Clause name + number */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {result.clauseNumber && (
                            <span className="text-[10px] font-mono text-slate-400">{result.clauseNumber}</span>
                        )}
                        <span className="text-xs font-semibold text-slate-800 truncate">{result.clauseName}</span>
                        <AlignmentTierBadge score={result.score} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                        Matched to: <span className="text-slate-500 font-medium">{result.ruleClauseName}</span>
                        <span className="ml-1.5 text-slate-300">({result.matchMethod}, {result.matchConfidence}% confidence)</span>
                    </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {result.ruleIsDealBreaker && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded">Deal Breaker</span>}
                    {result.ruleIsNonNegotiable && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">Non-Negotiable</span>}
                    {narrative && <RiskLevelBadge level={narrative.riskLevel} />}
                </div>

                {/* Score + mini bar */}
                <div className="w-24 flex-shrink-0 text-right">
                    <span className={`text-sm font-bold font-mono ${scoreColor}`}>{result.score}%</span>
                    <div className={`w-full h-1.5 rounded-full ${barTrackColor} overflow-hidden mt-1`}>
                        <div className={`h-full rounded-full ${barFillColor} transition-all duration-700`}
                            style={{ width: `${result.score}%` }} />
                    </div>
                </div>

                {/* Chevron */}
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Expanded detail panel — the full snapshot */}
            {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/50 space-y-4">
                    {/* Two-column layout: Clause on left, Rule on right */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* LEFT: Clause Information */}
                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                            <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                Template Clause
                            </div>
                            {result.clauseText ? (
                                <div className="text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
                                    {result.clauseText.length > 600
                                        ? result.clauseText.substring(0, 600) + '…'
                                        : result.clauseText}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">Clause text not available</div>
                            )}

                            {/* Clause position */}
                            <div className="mt-3 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-500">CLARENCE Position</span>
                                    <span className={`font-bold ${result.clausePosition != null ? scoreColor : 'text-slate-400'}`}>
                                        {result.clausePositionLabel || (result.clausePosition != null ? `${result.clausePosition}/100` : 'Not assessed')}
                                    </span>
                                </div>
                            </div>

                            {/* CLARENCE pre-assessment */}
                            {result.clarenceAssessment && (
                                <div className="mt-2 px-2 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded text-[10px] text-indigo-700 leading-relaxed">
                                    <span className="font-semibold">Assessment:</span> {result.clarenceAssessment}
                                </div>
                            )}
                            {result.clarenceFairness && (
                                <div className="mt-1 text-[10px] text-slate-500">
                                    <span className="font-semibold">Fairness:</span> {result.clarenceFairness}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Playbook Rule */}
                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                            <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                Playbook Rule
                            </div>
                            {result.ruleRationale ? (
                                <div className="text-xs text-slate-700 leading-relaxed max-h-36 overflow-y-auto">
                                    {result.ruleRationale}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">No rationale provided</div>
                            )}

                            {/* Rule positions */}
                            <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-500">Ideal Position</span>
                                    <span className="font-bold text-purple-600">
                                        {result.idealPositionLabel || `${result.ruleIdealPosition}/100`}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-500">Minimum Acceptable</span>
                                    <span className="font-semibold text-slate-600">
                                        {result.minimumPositionLabel || `${result.ruleMinimumPosition}/100`}
                                    </span>
                                </div>
                            </div>

                            {/* Deal breaker / non-negotiable flags */}
                            {(result.ruleIsDealBreaker || result.ruleIsNonNegotiable) && (
                                <div className="mt-2 flex items-center gap-2">
                                    {result.ruleIsDealBreaker && (
                                        <span className="px-2 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded border border-red-200">Deal Breaker</span>
                                    )}
                                    {result.ruleIsNonNegotiable && (
                                        <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded border border-amber-200">Non-Negotiable</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Position comparison bar — full width */}
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Position Comparison</div>
                        <div className="relative h-10">
                            {/* Track */}
                            <div className="absolute top-4 left-0 right-0 h-2 bg-slate-100 rounded-full" />
                            {/* Acceptable range */}
                            <div className="absolute top-4 h-2 bg-blue-50 border border-blue-100 rounded-full"
                                style={{ left: `${minPct}%`, width: `${idealPct - minPct}%` }} />
                            {/* Ideal position marker */}
                            <div className="absolute top-2 w-0.5 h-6 bg-purple-500 rounded-full z-10"
                                style={{ left: `${idealPct}%`, transform: 'translateX(-50%)' }} />
                            {/* Minimum position marker */}
                            <div className="absolute top-3 w-0.5 h-4 bg-slate-400 rounded-full z-10"
                                style={{ left: `${minPct}%`, transform: 'translateX(-50%)' }} />
                            {/* Clause position diamond */}
                            {clausePct != null && (
                                <div className={`absolute top-2 w-4 h-4 rounded-sm border-2 border-white shadow-md z-20 ${
                                    result.score >= 80 ? 'bg-emerald-500' : result.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                    style={{ left: `${clausePct}%`, transform: 'translateX(-50%) rotate(45deg)' }} />
                            )}
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4 text-[9px] text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> Ideal
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-0.5 bg-slate-400 inline-block rounded" /> Minimum
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-blue-50 inline-block rounded border border-blue-100" /> Acceptable range
                            </span>
                            {clausePct != null && (
                                <span className="flex items-center gap-1">
                                    <span className={`w-2.5 h-2.5 rounded-sm inline-block rotate-45 ${
                                        result.score >= 80 ? 'bg-emerald-500' : result.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                    }`} /> Template position
                                </span>
                            )}
                        </div>
                    </div>

                    {/* AI Assessment — from narrative */}
                    {narrative && (
                        <div className={`rounded-lg border p-4 ${
                            narrative.riskLevel === 'critical' ? 'border-red-200 bg-red-50/50' :
                            narrative.riskLevel === 'high' ? 'border-red-200 bg-red-50/30' :
                            narrative.riskLevel === 'medium' ? 'border-amber-200 bg-amber-50/50' :
                            'border-emerald-200 bg-emerald-50/50'
                        }`}>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Alignment Assessment</div>
                                    <p className="text-xs text-slate-700 leading-relaxed">{narrative.alignmentAssessment}</p>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Gap Analysis</div>
                                    <p className="text-xs text-slate-700 leading-relaxed">{narrative.gapAnalysis}</p>
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Recommendation</div>
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{narrative.recommendation}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Market range context */}
                    {result.rangeMapping && (
                        <div className="bg-white rounded-lg border border-slate-200 p-3">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Market Range Context</div>
                            <div className="text-xs text-slate-600">{typeof result.rangeMapping === 'string' ? result.rangeMapping : JSON.stringify(result.rangeMapping)}</div>
                        </div>
                    )}

                    {/* Scoring detail */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
                        <span>Score: <strong className={scoreColor}>{result.score}%</strong></span>
                        <span className="text-slate-300">|</span>
                        <span>{result.detail}</span>
                        <span className="text-slate-300">|</span>
                        <span>Category: {result.clauseCategory}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// CLAUSE SNAPSHOT PANEL — Summary stats for clause-centric view
// ============================================================================

function ClauseSnapshotPanel({ summary }: { summary: ClauseAuditSummary }) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                    <div className="text-3xl font-bold text-slate-800">{summary.clausesAssessed}</div>
                    <div className="text-[11px] text-slate-500">Clauses Assessed</div>
                </div>
                <div>
                    <div className="text-3xl font-bold text-emerald-600">{summary.alignedCount}</div>
                    <div className="text-[11px] text-slate-500">Aligned <span className="text-slate-300">(≥80%)</span></div>
                </div>
                <div>
                    <div className="text-3xl font-bold text-amber-500">{summary.partialCount}</div>
                    <div className="text-[11px] text-slate-500">Partial <span className="text-slate-300">(60–79%)</span></div>
                </div>
                <div>
                    <div className="text-3xl font-bold text-red-500">{summary.materialGapCount}</div>
                    <div className="text-[11px] text-slate-500">Material Gap <span className="text-slate-300">(&lt;60%)</span></div>
                </div>
                <div>
                    <div className="text-3xl font-bold text-red-700">{summary.redLineBreaches}</div>
                    <div className="text-[11px] text-slate-500">Red Line Breaches</div>
                </div>
            </div>
            {(summary.unmatchedClauses.length > 0 || summary.unmatchedRules.length > 0) && (
                <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                    {summary.unmatchedClauses.length > 0 && (
                        <span>{summary.unmatchedClauses.length} clause{summary.unmatchedClauses.length > 1 ? 's' : ''} with no matching rule</span>
                    )}
                    {summary.unmatchedRules.length > 0 && (
                        <span>{summary.unmatchedRules.length} rule{summary.unmatchedRules.length > 1 ? 's' : ''} with no matching clause</span>
                    )}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// EXECUTIVE SUMMARY BANNER
// ============================================================================

function ExecutiveSummaryBanner({ summary }: { summary: string }) {
    return (
        <div className="bg-white rounded-lg border border-indigo-200 p-5 mb-5">
            <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-sm font-semibold text-slate-800">Executive Summary</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
        </div>
    )
}

// ============================================================================
// LOADING
// ============================================================================

function AuditReportLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Alignment Report...</p>
            </div>
        </div>
    )
}

// ============================================================================
// MAIN CONTENT
// ============================================================================

// ============================================================================
// REPORT TAB TYPE
// ============================================================================

type ReportTab = 'summary' | 'clauses' | 'categories' | 'redlines' | 'flexibility'

// ============================================================================
// CATEGORY SORT OPTIONS
// ============================================================================

type CategorySort = 'score_asc' | 'score_desc' | 'alpha' | 'rules_desc'
type ClauseSort = 'score_asc' | 'score_desc' | 'alpha' | 'clause_order' | 'risk_desc'
type TierFilter = 'all' | 'aligned' | 'partially_aligned' | 'material_gap'
type RiskFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

// ============================================================================
// MAIN CONTENT
// ============================================================================

function AuditReportContent() {
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const auditId = params.auditId as string
    const autorun = searchParams.get('autorun') === 'true'

    const [loading, setLoading] = useState(true)
    const [audit, setAudit] = useState<AuditData | null>(null)
    const [reportResult, setReportResult] = useState<AlignmentReportResult | null>(null)
    const [templateClauses, setTemplateClauses] = useState<TemplateClauseRow[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [runProgress, setRunProgress] = useState<string>('')
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

    // Phase 3 enhancements
    const [activeTab, setActiveTab] = useState<ReportTab>('summary')
    const [categorySort, setCategorySort] = useState<CategorySort>('score_asc')
    const [tierFilter, setTierFilter] = useState<TierFilter>('all')
    const autorunTriggered = useRef(false)

    // Phase 4 — clause-centric audit
    const [clauseSort, setClauseSort] = useState<ClauseSort>('score_asc')
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
    const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set())

    // Run audit via server-side API (with AI narrative generation)
    const handleRunAudit = useCallback(async () => {
        if (!audit) return
        setIsRunning(true)
        setRunProgress('Initialising alignment analysis...')

        try {
            // Progressive status updates
            const progressSteps = [
                { delay: 800, msg: 'Loading playbook rules and template clauses...' },
                { delay: 2500, msg: 'Running compliance engine across focus categories...' },
                { delay: 5000, msg: 'Generating AI risk narratives (batching categories)...' },
                { delay: 9000, msg: 'Building executive summary...' },
                { delay: 13000, msg: 'Finalising report and saving results...' },
            ]

            const timers: NodeJS.Timeout[] = []
            progressSteps.forEach(step => {
                timers.push(setTimeout(() => setRunProgress(step.msg), step.delay))
            })

            const res = await fetch(`/api/audits/${auditId}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            // Clear pending timers
            timers.forEach(t => clearTimeout(t))

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Audit run failed')
            }

            setRunProgress('Loading results...')

            // Reload the full audit to get saved results
            const auditRes = await fetch(`/api/audits/${auditId}`)
            if (auditRes.ok) {
                const updatedAudit: AuditData = await auditRes.json()
                setAudit(updatedAudit)
                if (updatedAudit.results) {
                    const legacy = getLegacyData(updatedAudit.results)
                    setReportResult(legacy)
                }
            }

            setRunProgress('')
        } catch (err) {
            console.error('Error running audit:', err)
            setRunProgress('')
            setAudit(prev => prev ? { ...prev, status: 'failed', error_message: err instanceof Error ? err.message : 'Unknown error' } : null)
        } finally {
            setIsRunning(false)
        }
    }, [audit, auditId])

    // Load audit data
    useEffect(() => {
        const init = async () => {
            try {
                const res = await fetch(`/api/audits/${auditId}`)
                if (!res.ok) { router.push('/auth/company-admin?tab=audit'); return }
                const auditData: AuditData = await res.json()
                setAudit(auditData)

                // If results already computed, use them
                if (auditData.status === 'complete' && auditData.results) {
                    const legacy = getLegacyData(auditData.results)
                    setReportResult(legacy)
                    const supabase = createClient()
                    const { data: clausesData } = await supabase
                        .from('template_clauses')
                        .select('*')
                        .eq('template_id', auditData.template_id)
                        .order('display_order', { ascending: true })
                    setTemplateClauses((clausesData || []).map(normaliseClauseRow))
                    setLoading(false)
                    return
                }

                // For pending audits, load template clauses for preview
                const supabase = createClient()
                const { data: clausesData } = await supabase
                    .from('template_clauses')
                    .select('*')
                    .eq('template_id', auditData.template_id)
                    .order('display_order', { ascending: true })
                setTemplateClauses((clausesData || []).map(normaliseClauseRow))

                setLoading(false)
            } catch (err) {
                console.error('Error loading audit:', err)
                router.push('/auth/company-admin?tab=audit')
            }
        }
        init()
    }, [auditId, router])

    // Auto-run when arriving from Control Centre with ?autorun=true
    useEffect(() => {
        if (autorun && audit && audit.status === 'pending' && !autorunTriggered.current && !isRunning && !loading) {
            autorunTriggered.current = true
            handleRunAudit()
        }
    }, [autorun, audit, isRunning, loading, handleRunAudit])

    const toggleCategory = (key: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Derived state — these MUST be computed before any early returns
    // to keep React hooks (useMemo below) in a consistent call order.
    const compliance = reportResult?.compliance || null
    const narratives = reportResult?.narratives || []
    const narrativeMap = new Map(narratives.map(n => [n.normalisedKey, n]))

    // Clause-centric derived state
    const clauseCentricData = audit?.results ? getClauseCentricData(audit.results) : null
    const clauseAuditSummary = clauseCentricData?.auditSummary || null
    const clauseNarratives = clauseCentricData?.clauseNarratives || []
    const clauseNarrativeMap = new Map(clauseNarratives.map(n => [n.clauseId, n]))

    // Sort & filter categories (useMemo hook — must not be after conditional returns)
    const sortedFilteredCategories = useMemo(() => {
        if (!compliance) return []
        let cats = [...compliance.categories]

        // Filter by tier
        if (tierFilter === 'aligned') cats = cats.filter(c => c.score >= 80)
        else if (tierFilter === 'partially_aligned') cats = cats.filter(c => c.score >= 60 && c.score < 80)
        else if (tierFilter === 'material_gap') cats = cats.filter(c => c.score < 60)

        // Sort
        switch (categorySort) {
            case 'score_asc': cats.sort((a, b) => a.score - b.score); break
            case 'score_desc': cats.sort((a, b) => b.score - a.score); break
            case 'alpha': cats.sort((a, b) => a.name.localeCompare(b.name)); break
            case 'rules_desc': cats.sort((a, b) => b.rulesTotal - a.rulesTotal); break
        }
        return cats
    }, [compliance, categorySort, tierFilter])

    // Sort & filter clauses
    const sortedFilteredClauses = useMemo(() => {
        if (!clauseAuditSummary) return []
        let results = [...clauseAuditSummary.clauseResults]

        // Filter by risk level
        if (riskFilter !== 'all') {
            results = results.filter(r => {
                const narrative = clauseNarrativeMap.get(r.clauseId)
                return narrative?.riskLevel === riskFilter
            })
        }

        // Sort
        switch (clauseSort) {
            case 'score_asc': results.sort((a, b) => a.score - b.score); break
            case 'score_desc': results.sort((a, b) => b.score - a.score); break
            case 'alpha': results.sort((a, b) => a.clauseName.localeCompare(b.clauseName)); break
            case 'clause_order': /* already in display_order from engine */ break
            case 'risk_desc': {
                const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
                results.sort((a, b) => {
                    const aN = clauseNarrativeMap.get(a.clauseId)
                    const bN = clauseNarrativeMap.get(b.clauseId)
                    const aR = riskOrder[aN?.riskLevel as keyof typeof riskOrder] ?? 4
                    const bR = riskOrder[bN?.riskLevel as keyof typeof riskOrder] ?? 4
                    return aR - bR
                })
                break
            }
        }
        return results
    }, [clauseAuditSummary, clauseSort, riskFilter, clauseNarrativeMap])

    const toggleClause = (clauseId: string) => {
        setExpandedClauses(prev => {
            const next = new Set(prev)
            if (next.has(clauseId)) next.delete(clauseId)
            else next.add(clauseId)
            return next
        })
    }

    const toggleAllClauses = () => {
        if (!clauseAuditSummary) return
        const allIds = clauseAuditSummary.clauseResults.map(r => r.clauseId)
        const allExpanded = allIds.every(id => expandedClauses.has(id))
        if (allExpanded) {
            setExpandedClauses(new Set())
        } else {
            setExpandedClauses(new Set(allIds))
        }
    }

    const toggleAllCategories = () => {
        if (!compliance) return
        const allKeys = compliance.categories.map(c => c.normalisedKey)
        const allExpanded = allKeys.every(k => expandedCategories.has(k))
        if (allExpanded) {
            setExpandedCategories(new Set())
        } else {
            setExpandedCategories(new Set(allKeys))
        }
    }

    // Early returns — AFTER all hooks
    if (loading) return <AuditReportLoading />
    if (!audit) return null

    // Tab counts for badges
    const redLineCount = compliance?.redLines?.length || 0
    const flexCount = compliance?.flexibility?.length || 0

    // Report metadata
    const completedDate = audit.completed_at ? new Date(audit.completed_at) : null
    const createdDate = new Date(audit.created_at)

    // Helper: format date nicely
    const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/auth/company-admin?tab=audit')} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-bold text-slate-800">{audit.audit_name}</h1>
                                    {audit.status === 'complete' && (compliance || clauseAuditSummary) && (() => {
                                        const score = clauseAuditSummary?.overallScore ?? compliance?.overallScore ?? 0
                                        return (
                                            <span className={`text-lg font-bold font-mono ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {score}%
                                            </span>
                                        )
                                    })()}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                    <span>{audit.playbook_name}</span>
                                    <span className="text-slate-300">vs</span>
                                    <span>{audit.template_name}</span>
                                    <span className="text-slate-300">·</span>
                                    <span>{audit.focus_categories?.length || 0} focus categories</span>
                                    {clauseAuditSummary ? (
                                        <>
                                            <span className="text-slate-300">·</span>
                                            <span>{clauseAuditSummary.clausesAssessed} clauses assessed</span>
                                            <span className="text-slate-300">·</span>
                                            <span>{clauseAuditSummary.totalRules} rules</span>
                                        </>
                                    ) : reportResult ? (
                                        <>
                                            <span className="text-slate-300">·</span>
                                            <span>{reportResult.totalRulesInScope} rules</span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {audit.status === 'pending' && !autorun && !isRunning && (
                                <button
                                    onClick={handleRunAudit}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Run Alignment Audit
                                </button>
                            )}
                            {audit.status === 'complete' && (
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                                        Report Complete
                                    </span>
                                    <button
                                        onClick={() => {
                                            setAudit(prev => prev ? { ...prev, status: 'pending' } : null)
                                            setReportResult(null)
                                            setTimeout(() => handleRunAudit(), 100)
                                        }}
                                        disabled={isRunning}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Re-analyse
                                    </button>
                                    {/* Export buttons */}
                                    <div className="w-px h-5 bg-slate-200" />
                                    <button
                                        onClick={() => window.open(`/api/audits/${auditId}/export?format=docx`, '_blank')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        Word
                                    </button>
                                    <button
                                        onClick={() => window.open(`/api/audits/${auditId}/export?format=pdf`, '_blank')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        PDF
                                    </button>
                                </div>
                            )}
                            {audit.status === 'failed' && (
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg">
                                        Failed
                                    </span>
                                    <button
                                        onClick={handleRunAudit}
                                        disabled={isRunning}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tab navigation — only when report is complete */}
                    {audit.status === 'complete' && compliance && (
                        <div className="flex items-center gap-1 mt-3 -mb-px">
                            {([
                                { key: 'summary' as ReportTab, label: 'Summary', count: null },
                                ...(clauseAuditSummary ? [{ key: 'clauses' as ReportTab, label: 'Clauses', count: clauseAuditSummary.clausesAssessed }] : []),
                                { key: 'categories' as ReportTab, label: 'Categories', count: compliance.categories.length },
                                { key: 'redlines' as ReportTab, label: 'Red Lines', count: redLineCount },
                                { key: 'flexibility' as ReportTab, label: 'Flexibility', count: flexCount },
                            ]).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                                        activeTab === tab.key
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    {tab.label}
                                    {tab.count != null && tab.count > 0 && (
                                        <span className={`ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                                            activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content area */}
            <div className="max-w-6xl mx-auto px-4 py-5">
                {(audit.status === 'pending' && !compliance && !isRunning) ? (
                    /* Pending state — prompt to run */
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h2 className="text-lg font-semibold text-slate-700 mb-1">Ready to Analyse</h2>
                        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
                            This audit will compare {audit.template_name} against {audit.playbook_name} across {audit.focus_categories?.length || 0} categories,
                            and generate AI-powered risk narratives and remediation recommendations.
                        </p>
                        <button
                            onClick={handleRunAudit}
                            disabled={isRunning}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Run Alignment Audit
                        </button>
                        {audit.error_message && (
                            <div className="mt-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 max-w-md mx-auto">
                                {audit.error_message}
                            </div>
                        )}
                    </div>
                ) : isRunning || (audit.status === 'pending' && !compliance) ? (
                    /* Running state — progressive updates */
                    <div className="text-center py-16">
                        <div className="w-16 h-16 relative mx-auto mb-6">
                            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
                            <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <div className="absolute inset-2 border-4 border-purple-100 rounded-full" />
                            <div className="absolute inset-2 border-4 border-purple-400 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-700 mb-2">Analysing Contract Alignment</h2>
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <p className="text-sm text-indigo-600 font-medium">{runProgress || 'Initialising...'}</p>
                        </div>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            The AI engine is comparing {audit.focus_categories?.length || 0} categories across your playbook and template,
                            generating risk narratives and remediation recommendations.
                        </p>
                    </div>
                ) : compliance ? (
                    <>
                        {/* ==================== SUMMARY TAB ==================== */}
                        {activeTab === 'summary' && (
                            <>
                                {/* Report Metadata Header */}
                                <div className="bg-white rounded-lg border border-slate-200 p-4 mb-5">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Template</div>
                                            <div className="text-sm font-medium text-slate-700 mt-0.5">{audit.template_name}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{audit.contract_type}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Playbook</div>
                                            <div className="text-sm font-medium text-slate-700 mt-0.5">{audit.playbook_name}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 capitalize">{audit.playbook_perspective} perspective</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Created</div>
                                            <div className="text-sm font-medium text-slate-700 mt-0.5">{fmtDate(createdDate)}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{fmtTime(createdDate)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Completed</div>
                                            <div className="text-sm font-medium text-slate-700 mt-0.5">{completedDate ? fmtDate(completedDate) : '—'}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{completedDate ? fmtTime(completedDate) : ''}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Executive Summary — prefer clause-centric if available */}
                                {(clauseCentricData?.executiveSummary || reportResult?.executiveSummary) && (
                                    <ExecutiveSummaryBanner summary={clauseCentricData?.executiveSummary || reportResult!.executiveSummary} />
                                )}

                                {/* Clause-level snapshot if available, otherwise legacy radar */}
                                {clauseAuditSummary ? (
                                    <ClauseSnapshotPanel summary={clauseAuditSummary} />
                                ) : (
                                    <SnapshotPanel compliance={compliance} />
                                )}

                                {/* Unmatched categories — shown on summary */}
                                {compliance.unmatchedCategories.length > 0 && (
                                    <div className="mt-5">
                                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Uncovered Categories</h3>
                                        <div className="bg-white rounded-lg border border-amber-200 p-4">
                                            <p className="text-xs text-slate-500 mb-3">
                                                Playbook categories with no matching template clauses — these rules cannot be assessed.
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {compliance.unmatchedCategories.map(cat => (
                                                    <span key={cat} className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                                                        {getCategoryDisplayName(cat)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ==================== CLAUSES TAB ==================== */}
                        {activeTab === 'clauses' && clauseAuditSummary && (
                            <>
                                {/* Clause snapshot stats */}
                                <ClauseSnapshotPanel summary={clauseAuditSummary} />

                                {/* Executive Summary from clause-centric engine */}
                                {clauseCentricData?.executiveSummary && (
                                    <ExecutiveSummaryBanner summary={clauseCentricData.executiveSummary} />
                                )}

                                {/* Sort/filter toolbar */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        {/* Risk filter pills */}
                                        {([
                                            { key: 'all' as RiskFilter, label: 'All', color: 'bg-slate-100 text-slate-600 border-slate-200' },
                                            { key: 'critical' as RiskFilter, label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' },
                                            { key: 'high' as RiskFilter, label: 'High', color: 'bg-red-50 text-red-600 border-red-200' },
                                            { key: 'medium' as RiskFilter, label: 'Medium', color: 'bg-amber-50 text-amber-600 border-amber-200' },
                                            { key: 'low' as RiskFilter, label: 'Low', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                                        ]).map(f => (
                                            <button
                                                key={f.key}
                                                onClick={() => setRiskFilter(f.key)}
                                                className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all ${
                                                    riskFilter === f.key
                                                        ? f.color + ' ring-1 ring-offset-1 ring-current'
                                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {f.label}
                                                {f.key !== 'all' && (
                                                    <span className="ml-1 opacity-60">
                                                        {clauseNarratives.filter(n => n.riskLevel === f.key).length}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={clauseSort}
                                            onChange={e => setClauseSort(e.target.value as ClauseSort)}
                                            className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                        >
                                            <option value="score_asc">Worst first</option>
                                            <option value="score_desc">Best first</option>
                                            <option value="risk_desc">Highest risk first</option>
                                            <option value="alpha">Alphabetical</option>
                                            <option value="clause_order">Clause order</option>
                                        </select>
                                        <button
                                            onClick={toggleAllClauses}
                                            className="text-[10px] text-indigo-600 font-medium hover:text-indigo-800 transition-colors px-2 py-1"
                                        >
                                            {clauseAuditSummary.clauseResults.every(r => expandedClauses.has(r.clauseId))
                                                ? 'Collapse all'
                                                : 'Expand all'}
                                        </button>
                                    </div>
                                </div>

                                {/* Filter count */}
                                {riskFilter !== 'all' && (
                                    <div className="text-[10px] text-slate-400 mb-3">
                                        Showing {sortedFilteredClauses.length} of {clauseAuditSummary.clausesAssessed} clauses
                                    </div>
                                )}

                                {/* Clause-by-clause cards */}
                                <div className="space-y-2">
                                    {sortedFilteredClauses.map(result => (
                                        <ClauseAuditCard
                                            key={result.clauseId}
                                            result={result}
                                            narrative={clauseNarrativeMap.get(result.clauseId)}
                                            isExpanded={expandedClauses.has(result.clauseId)}
                                            onToggle={() => toggleClause(result.clauseId)}
                                        />
                                    ))}
                                </div>

                                {sortedFilteredClauses.length === 0 && (
                                    <div className="text-center py-10 text-sm text-slate-400">
                                        No clauses match the current filter.
                                    </div>
                                )}

                                {/* Unmatched rules — rules with no corresponding clause */}
                                {clauseAuditSummary.unmatchedRules.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Unmatched Playbook Rules</h3>
                                        <div className="bg-white rounded-lg border border-amber-200 p-4">
                                            <p className="text-xs text-slate-500 mb-3">
                                                These playbook rules have no matching clause in the template — potential coverage gaps.
                                            </p>
                                            <div className="space-y-1.5">
                                                {clauseAuditSummary.unmatchedRules.map(rule => (
                                                    <div key={rule.rule_id} className="flex items-center gap-2 text-xs">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                                        <span className="text-slate-700 font-medium">{rule.clause_name}</span>
                                                        <span className="text-slate-400">({getCategoryDisplayName(normaliseCategory(rule.category))})</span>
                                                        {rule.is_deal_breaker && (
                                                            <span className="px-1.5 py-0.5 text-[8px] font-bold bg-red-100 text-red-700 rounded">Deal Breaker</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Unmatched clauses — clauses with no corresponding rule */}
                                {clauseAuditSummary.unmatchedClauses.length > 0 && (
                                    <div className="mt-4">
                                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Unmatched Template Clauses</h3>
                                        <div className="bg-white rounded-lg border border-slate-200 p-4">
                                            <p className="text-xs text-slate-500 mb-3">
                                                These template clauses have no corresponding playbook rule — not assessed.
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {clauseAuditSummary.unmatchedClauses.map(clause => (
                                                    <span key={clause.clause_id} className="px-2.5 py-1 text-xs font-medium bg-slate-50 text-slate-600 rounded-full border border-slate-200">
                                                        {clause.clause_name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ==================== CATEGORIES TAB ==================== */}
                        {activeTab === 'categories' && (
                            <>
                                {/* Sort/filter toolbar */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        {/* Tier filter pills */}
                                        {([
                                            { key: 'all' as TierFilter, label: 'All', color: 'bg-slate-100 text-slate-600 border-slate-200' },
                                            { key: 'material_gap' as TierFilter, label: 'Material Gaps', color: 'bg-red-50 text-red-600 border-red-200' },
                                            { key: 'partially_aligned' as TierFilter, label: 'Partial', color: 'bg-amber-50 text-amber-600 border-amber-200' },
                                            { key: 'aligned' as TierFilter, label: 'Aligned', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                                        ]).map(f => (
                                            <button
                                                key={f.key}
                                                onClick={() => setTierFilter(f.key)}
                                                className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all ${
                                                    tierFilter === f.key
                                                        ? f.color + ' ring-1 ring-offset-1 ring-current'
                                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Sort dropdown */}
                                        <select
                                            value={categorySort}
                                            onChange={e => setCategorySort(e.target.value as CategorySort)}
                                            className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                        >
                                            <option value="score_asc">Worst first</option>
                                            <option value="score_desc">Best first</option>
                                            <option value="alpha">Alphabetical</option>
                                            <option value="rules_desc">Most rules</option>
                                        </select>
                                        {/* Expand all / collapse all */}
                                        <button
                                            onClick={toggleAllCategories}
                                            className="text-[10px] text-indigo-600 font-medium hover:text-indigo-800 transition-colors px-2 py-1"
                                        >
                                            {compliance.categories.every(c => expandedCategories.has(c.normalisedKey))
                                                ? 'Collapse all'
                                                : 'Expand all'}
                                        </button>
                                    </div>
                                </div>

                                {/* Filtered count */}
                                {tierFilter !== 'all' && (
                                    <div className="text-[10px] text-slate-400 mb-3">
                                        Showing {sortedFilteredCategories.length} of {compliance.categories.length} categories
                                    </div>
                                )}

                                {/* Category-by-category breakdown with narratives */}
                                <div className="space-y-2">
                                    {sortedFilteredCategories.map(cat => {
                                        const isOpen = expandedCategories.has(cat.normalisedKey)
                                        const barColor = cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                        const barTrack = cat.score >= 80 ? 'bg-emerald-100' : cat.score >= 60 ? 'bg-amber-100' : 'bg-red-100'
                                        const narrative = narrativeMap.get(cat.normalisedKey)

                                        return (
                                            <div key={cat.normalisedKey} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                                                <button
                                                    onClick={() => toggleCategory(cat.normalisedKey)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <ScoreRing score={cat.score} size={40} strokeWidth={3.5} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-slate-800">{cat.name}</span>
                                                            <AlignmentTierBadge score={cat.score} />
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {cat.rulesPassed} aligned · {cat.rulesWarning} partial · {cat.rulesFailed} misaligned of {cat.rulesTotal} rules
                                                        </div>
                                                    </div>
                                                    <div className="w-28 flex-shrink-0">
                                                        <div className={`w-full h-1.5 rounded-full ${barTrack} overflow-hidden`}>
                                                            <div className={`h-full rounded-full ${barColor} transition-all duration-700`}
                                                                style={{ width: `${cat.score}%` }} />
                                                        </div>
                                                    </div>
                                                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                                        className={`text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
                                                        <polyline points="6 9 12 15 18 9" />
                                                    </svg>
                                                </button>

                                                {isOpen && (
                                                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                                                        {/* AI Narrative Panel */}
                                                        {narrative && (
                                                            <div className="mb-3">
                                                                <CategoryNarrativePanel narrative={narrative} />
                                                            </div>
                                                        )}

                                                        {/* Rule-by-rule cards */}
                                                        {cat.rules.map(scored => (
                                                            <AlignmentCard key={scored.rule.rule_id} scored={scored} templateClauses={templateClauses} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {sortedFilteredCategories.length === 0 && (
                                    <div className="text-center py-10 text-sm text-slate-400">
                                        No categories match the current filter.
                                    </div>
                                )}
                            </>
                        )}

                        {/* ==================== RED LINES TAB ==================== */}
                        {activeTab === 'redlines' && (
                            <>
                                {redLineCount > 0 ? (
                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                        <RedLinesTab redLines={compliance.redLines} />
                                    </div>
                                ) : (
                                    <div className="text-center py-16">
                                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-1">No Red Lines Triggered</h3>
                                        <p className="text-xs text-slate-400">No deal breakers or non-negotiable clauses were breached in this audit.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ==================== FLEXIBILITY TAB ==================== */}
                        {activeTab === 'flexibility' && (
                            <>
                                {flexCount > 0 ? (
                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                        <FlexibilityTab flexibility={compliance.flexibility} />
                                    </div>
                                ) : (
                                    <div className="text-center py-16">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-1">No Flexibility Data</h3>
                                        <p className="text-xs text-slate-400">No negotiation flexibility ranges were identified for the focus categories.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    /* Fallback running/loading state */
                    <div className="text-center py-16">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-slate-700 mb-1">{runProgress || 'Processing...'}</h2>
                        <p className="text-sm text-slate-500">This may take a moment while AI narratives are generated.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// PAGE EXPORT
// ============================================================================

export default function AuditReportPage() {
    return (
        <Suspense fallback={<AuditReportLoading />}>
            <AuditReportContent />
        </Suspense>
    )
}
