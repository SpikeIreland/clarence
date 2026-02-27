// ============================================================================
// FILE: components/PlaybookComplianceIndicator.tsx
// PURPOSE: Collapsible banner showing playbook compliance at top of Document Centre
// VISIBILITY: Initiator only — hidden if no active playbook or user is respondent
// ============================================================================

'use client'
import { useState, useEffect } from 'react'
import type {
    ComplianceResult,
    RedLineResult,
    CategoryResult,
    FlexibilityResult,
    ScoredRule,
    RuleStatus,
} from '@/lib/playbook-compliance'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface PlaybookComplianceIndicatorProps {
    compliance: ComplianceResult
    playbookName: string
    companyName: string
}

// ============================================================================
// SECTION 2: ICON COMPONENTS
// ============================================================================

function ShieldCheckIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    )
}

function ShieldAlertIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    )
}

function ChevronDownIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

function CheckCircleIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    )
}

function XCircleIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    )
}

function AlertTriangleIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
}

function LockIcon({ size = 10, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}

// ============================================================================
// SECTION 3: SCORE RING COMPONENT
// ============================================================================

function ScoreRing({ score, size = 48, strokeWidth = 4 }: {
    score: number; size?: number; strokeWidth?: number
}) {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (score / 100) * circumference

    const color = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'
    const trackColor = score >= 80 ? 'text-emerald-100' : score >= 60 ? 'text-amber-100' : 'text-red-100'
    const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
    const strokeTrack = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2'

    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={strokeTrack} strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={strokeColor} strokeWidth={strokeWidth}
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out" />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center font-mono text-xs font-bold ${color}`}>
                {score}%
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: STATUS ICON HELPER
// ============================================================================

function StatusIcon({ status }: { status: RuleStatus | 'clear' | 'breach' }) {
    switch (status) {
        case 'pass':
        case 'clear':
            return <CheckCircleIcon className="text-emerald-500" />
        case 'fail':
        case 'breach':
        case 'escalation':
            return <XCircleIcon className="text-red-500" />
        case 'warning':
        case 'acceptable':
            return <AlertTriangleIcon className="text-amber-500" />
        default:
            return <span className="w-3.5 h-3.5 rounded-full bg-slate-200 inline-block" />
    }
}

// ============================================================================
// SECTION 5: CATEGORY BAR COMPONENT
// ============================================================================

function CategoryBar({ score }: { score: number }) {
    const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
    const track = score >= 80 ? 'bg-emerald-100' : score >= 60 ? 'bg-amber-100' : 'bg-red-100'

    return (
        <div className={`w-full h-1.5 rounded-full ${track} overflow-hidden`}>
            <div className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
                style={{ width: `${score}%` }} />
        </div>
    )
}

// ============================================================================
// SECTION 6: FLEXIBILITY BAR COMPONENT
// ============================================================================

function FlexibilityBar({ item }: { item: FlexibilityResult }) {
    const toPercent = (val: number) => (val / 10) * 100

    return (
        <div className="relative h-7 w-full">
            {/* Full 1-10 track */}
            <div className="absolute top-2.5 left-0 right-0 h-2 bg-slate-100 rounded" />
            {/* Acceptable range band */}
            <div className="absolute top-2.5 h-2 bg-blue-100 rounded"
                style={{
                    left: `${toPercent(item.acceptableMin)}%`,
                    width: `${toPercent(item.acceptableMax - item.acceptableMin)}%`
                }} />
            {/* Opening position marker */}
            <div className="absolute top-2 w-0.5 h-3 bg-slate-400 rounded"
                style={{ left: `${toPercent(item.playbookOpening)}%`, transform: 'translateX(-50%)' }} />
            {/* Agreed position dot */}
            {item.agreedPosition != null && (
                <div className="absolute top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                    style={{
                        left: `${toPercent(item.agreedPosition)}%`,
                        transform: 'translateX(-50%)',
                        backgroundColor: item.agreedPosition >= item.acceptableMin ? '#10b981' : '#ef4444'
                    }} />
            )}
        </div>
    )
}

// ============================================================================
// SECTION 7: RED LINES TAB
// ============================================================================

function RedLinesTab({ redLines }: { redLines: RedLineResult[] }) {
    const hasBreaches = redLines.some(rl => rl.status === 'breach')

    return (
        <div>
            {/* Status banner */}
            {!hasBreaches ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 mb-4">
                    <ShieldCheckIcon size={22} className="text-emerald-600 flex-shrink-0" />
                    <div>
                        <div className="text-sm font-semibold text-emerald-700">All Clear</div>
                        <div className="text-xs text-emerald-600">
                            No red line breaches detected across {redLines.length} monitored rules
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200 mb-4">
                    <ShieldAlertIcon size={22} className="text-red-600 flex-shrink-0" />
                    <div>
                        <div className="text-sm font-semibold text-red-700">
                            {redLines.filter(rl => rl.status === 'breach').length} Red Line
                            Breach{redLines.filter(rl => rl.status === 'breach').length > 1 ? 'es' : ''} Detected
                        </div>
                        <div className="text-xs text-red-600">Review breached items below</div>
                    </div>
                </div>
            )}

            {/* Red line items */}
            <div className="space-y-2">
                {redLines.map((rl) => (
                    <div key={rl.rule.rule_id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border ${rl.status === 'breach'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                            }`}>
                        <div className="mt-0.5 flex-shrink-0">
                            <StatusIcon status={rl.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-slate-800">
                                    {rl.rule.clause_name}
                                </span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                    {rl.normalisedCategory.replace(/_/g, ' ')}
                                </span>
                                {rl.status === 'breach' && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                                        BREACH
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-slate-500 mb-0.5">
                                {rl.rule.is_deal_breaker ? 'Deal Breaker' : 'Non-Negotiable'}
                                {' — '}min position: {rl.rule.minimum_position}, ideal: {rl.rule.ideal_position}
                            </div>
                            <div className={`text-[11px] ${rl.status === 'breach' ? 'text-amber-800' : 'text-slate-600'}`}>
                                {rl.detail}
                            </div>
                            {rl.escalationTriggered && rl.escalationContact && (
                                <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${rl.status === 'breach'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                    Escalation: {rl.escalationContact}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 8: CATEGORIES TAB
// ============================================================================

function CategoriesTab({ categories }: { categories: CategoryResult[] }) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

    return (
        <div className="space-y-1.5">
            {categories.map((cat) => {
                const isOpen = expandedCategory === cat.normalisedKey

                return (
                    <div key={cat.normalisedKey} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                        {/* Category header */}
                        <button
                            onClick={() => setExpandedCategory(isOpen ? null : cat.normalisedKey)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'
                                }`}
                        >
                            <ScoreRing score={cat.score} size={36} strokeWidth={3.5} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-800">{cat.name}</div>
                                <div className="text-[10px] text-slate-400">
                                    {cat.rulesPassed} passed · {cat.rulesWarning} warning{cat.rulesWarning !== 1 ? 's' : ''} · {cat.rulesFailed} failed of {cat.rulesTotal}
                                </div>
                            </div>
                            <div className="w-24 flex-shrink-0">
                                <CategoryBar score={cat.score} />
                            </div>
                            <ChevronDownIcon size={14}
                                className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Expanded rules */}
                        {isOpen && (
                            <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50">
                                {cat.rules.map((sr, idx) => (
                                    <div key={sr.rule.rule_id || idx}
                                        className={`flex items-start gap-2 py-1.5 ${idx < cat.rules.length - 1 ? 'border-b border-slate-100' : ''
                                            }`}>
                                        <div className="mt-0.5 flex-shrink-0">
                                            <StatusIcon status={sr.status} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[11px] font-medium text-slate-700">
                                                {sr.rule.clause_name}
                                            </div>
                                            <div className={`text-[10px] ${sr.status === 'fail' || sr.status === 'breach'
                                                ? 'text-red-600'
                                                : sr.status === 'warning' || sr.status === 'acceptable'
                                                    ? 'text-amber-700'
                                                    : 'text-slate-500'
                                                }`}>
                                                {sr.detail}
                                            </div>
                                        </div>
                                    </div>
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
// SECTION 9: FLEXIBILITY TAB
// ============================================================================

function FlexibilityTab({ flexibility }: { flexibility: FlexibilityResult[] }) {
    return (
        <div>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 inline-block" />
                    Acceptable range
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 rounded bg-slate-400 inline-block" />
                    Opening position
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Agreed position
                </span>
            </div>

            {/* Flexibility items */}
            <div className="space-y-3">
                {flexibility.map((item) => (
                    <div key={item.rule.rule_id}
                        className="p-3 rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800">
                                    {item.rule.clause_name}
                                </span>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase ${item.flexibilityLevel === 'high'
                                    ? 'bg-blue-100 text-blue-700'
                                    : item.flexibilityLevel === 'medium'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {item.flexibilityLevel} flex
                                </span>
                            </div>
                            <span className={`text-xs font-semibold font-mono ${item.consumedPct === 0
                                ? 'text-emerald-500'
                                : item.consumedPct >= 80
                                    ? 'text-amber-500'
                                    : 'text-slate-600'
                                }`}>
                                {item.consumedPct}% used
                            </span>
                        </div>

                        <FlexibilityBar item={item} />

                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                            <span>1</span>
                            <span>
                                {item.agreedPosition != null
                                    ? `Agreed: ${item.agreedPosition}/10 (opened at ${item.playbookOpening}/10)`
                                    : `Opening: ${item.playbookOpening}/10 — no agreed position yet`
                                }
                            </span>
                            <span>10</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 10: MAIN INDICATOR COMPONENT
// ============================================================================

export default function PlaybookComplianceIndicator({
    compliance,
    playbookName,
    companyName,
}: PlaybookComplianceIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [activeTab, setActiveTab] = useState<'redlines' | 'categories' | 'flexibility'>('redlines')

    const hasBreaches = compliance.redLineBreaches > 0

    const tabs = [
        {
            key: 'redlines' as const,
            label: `Red Lines (${compliance.redLines.length})`,
        },
        {
            key: 'categories' as const,
            label: `Compliance by Category (${compliance.categories.length})`,
        },
        {
            key: 'flexibility' as const,
            label: `Flexibility Usage (${compliance.flexibility.length})`,
        },
    ]

    return (
        <div className="bg-white border-b border-slate-200 shadow-sm">
            {/* ============================================================ */}
            {/* COLLAPSED BAR                                                */}
            {/* ============================================================ */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${hasBreaches
                    ? 'bg-gradient-to-r from-amber-50 to-yellow-50'
                    : 'bg-gradient-to-r from-emerald-50 to-teal-50'
                    }`}
            >
                {/* Shield icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${hasBreaches
                    ? 'bg-amber-100 border border-amber-200'
                    : 'bg-emerald-100 border border-emerald-200'
                    }`}>
                    {hasBreaches
                        ? <ShieldAlertIcon size={20} className="text-amber-600" />
                        : <ShieldCheckIcon size={20} className="text-emerald-600" />
                    }
                </div>

                {/* Summary text */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">Playbook Compliance</span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                            <LockIcon size={8} /> Initiator Only
                        </span>
                        {hasBreaches && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                {compliance.redLineBreaches} breach{compliance.redLineBreaches > 1 ? 'es' : ''}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                        {compliance.rulesPassed} of {compliance.rulesChecked} rules satisfied
                        {' · '}
                        {playbookName}
                    </div>
                </div>

                {/* Metric pills */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center px-3 py-1 bg-white/70 rounded-lg min-w-[52px]">
                        <span className={`text-base font-bold font-mono leading-tight ${compliance.overallScore >= 80 ? 'text-emerald-600'
                            : compliance.overallScore >= 60 ? 'text-amber-600'
                                : 'text-red-600'
                            }`}>
                            {compliance.overallScore}%
                        </span>
                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                            Score
                        </span>
                    </div>
                    <div className="flex flex-col items-center px-3 py-1 bg-white/70 rounded-lg min-w-[40px]">
                        <span className={`text-base font-bold font-mono leading-tight ${compliance.redLineBreaches > 0 ? 'text-red-600' : 'text-emerald-600'
                            }`}>
                            {compliance.redLineBreaches}
                        </span>
                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                            Red Lines
                        </span>
                    </div>
                    <div className="flex flex-col items-center px-3 py-1 bg-white/70 rounded-lg min-w-[40px]">
                        <span className="text-base font-bold font-mono leading-tight text-slate-600">
                            {compliance.rulesWarning}
                        </span>
                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">
                            Warnings
                        </span>
                    </div>
                </div>

                {/* Score ring */}
                <ScoreRing score={compliance.overallScore} />

                {/* Chevron */}
                <div className={`flex items-center justify-center w-7 h-7 rounded-md bg-white/60 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''
                    }`}>
                    <ChevronDownIcon size={14} className="text-slate-500" />
                </div>
            </button>

            {/* ============================================================ */}
            {/* EXPANDED BODY                                                */}
            {/* ============================================================ */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                {/* Tab bar */}
                <div className="flex border-b border-slate-200 bg-slate-50/80 px-5">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key) }}
                            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.key
                                ? 'text-slate-800 font-semibold border-emerald-500'
                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="px-5 py-4 max-h-[460px] overflow-y-auto">
                    {/* Privacy notice */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md border border-slate-100 text-[10px] text-slate-400 mb-4">
                        <LockIcon size={10} className="flex-shrink-0" />
                        This analysis is private to {companyName} and compares negotiation outcomes
                        against your active playbook. The other party cannot see this information.
                    </div>

                    {activeTab === 'redlines' && <RedLinesTab redLines={compliance.redLines} />}
                    {activeTab === 'categories' && <CategoriesTab categories={compliance.categories} />}
                    {activeTab === 'flexibility' && <FlexibilityTab flexibility={compliance.flexibility} />}
                </div>
            </div>
        </div>
    )
}