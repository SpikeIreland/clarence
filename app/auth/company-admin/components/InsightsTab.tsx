'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { normaliseCategory, getCategoryDisplayName } from '@/lib/playbook-compliance'
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    PieChart, Pie, Cell,
    AreaChart, Area,
    XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface Playbook {
    playbookId: string
    playbookName: string
    status: string
    isActive: boolean
    contractTypeKey: string | null
    playbookPerspective: 'customer' | 'provider'
    rulesExtracted: number
    aiConfidenceScore?: number
    createdAt: string
}

interface CompanyTemplate {
    templateId: string
    templateName: string
    contractType: string
    clauseCount: number
    timesUsed: number
    isActive: boolean
    status: string
    createdAt: string
}

interface TrainingUser {
    id: string
    fullName: string
    status: 'pending' | 'active' | 'suspended' | 'expired'
    sessionsCompleted: number
    invitedAt: string
}

interface CompanyUser {
    id: string
    fullName: string
    role: string
    status: string
    approvalRole: string
    lastActiveAt?: string
}

interface InsightsTabProps {
    playbooks: Playbook[]
    templates: CompanyTemplate[]
    trainingUsers: TrainingUser[]
    companyUsers: CompanyUser[]
    companyId: string
}

interface HeroCard {
    label: string
    value: number
    total: number | null
    sparklineData: number[]
    gradient: string
    sparkColor: string
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    bpo: 'BPO / Outsourcing', saas: 'SaaS Agreement', nda: 'NDA',
    msa: 'Master Service Agreement', employment: 'Employment Contract',
    it_services: 'IT Services', consulting: 'Consulting', custom: 'Custom / Other',
}

const CONTRACT_TYPE_COLORS: Record<string, string> = {
    bpo: '#6366f1', saas: '#06b6d4', nda: '#f59e0b', msa: '#10b981',
    employment: '#8b5cf6', it_services: '#3b82f6', consulting: '#ec4899', custom: '#64748b',
}

// ============================================================================
// SECTION 2: HELPER FUNCTIONS
// ============================================================================

function computeWeeklyTimeSeries<T>(items: T[], getDate: (item: T) => string, weeks: number): number[] {
    const now = new Date()
    const buckets = Array(weeks).fill(0)
    items.forEach(item => {
        const d = new Date(getDate(item))
        const weekDiff = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000))
        if (weekDiff >= 0 && weekDiff < weeks) buckets[weeks - 1 - weekDiff]++
    })
    return buckets
}

// ============================================================================
// SECTION 3: ANIMATED NUMBER
// ============================================================================

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
    const [display, setDisplay] = useState(0)
    const frameRef = useRef<number>(0)

    useEffect(() => {
        let startTime: number | null = null
        const easeOutExpo = (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            setDisplay(Math.round(easeOutExpo(progress) * value))
            if (progress < 1) frameRef.current = requestAnimationFrame(animate)
        }

        frameRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frameRef.current)
    }, [value, duration])

    return <span>{display.toLocaleString()}</span>
}

// ============================================================================
// SECTION 4: CUSTOM TOOLTIP
// ============================================================================

function InsightTooltip({ active, payload, label }: any) {
    if (!active || !payload || payload.length === 0) return null
    return (
        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl px-4 py-3 shadow-2xl">
            {label && <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>}
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
                    <span className="text-sm font-semibold text-white">{typeof p.value === 'number' ? Math.round(p.value) : p.value}</span>
                    {p.name && p.name !== 'value' && <span className="text-xs text-slate-500">{p.name}</span>}
                </div>
            ))}
        </div>
    )
}

// ============================================================================
// SECTION 5: MINI SPARKLINE
// ============================================================================

function MiniSparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
    if (data.length < 2) return null
    const chartData = data.map((value, index) => ({ index, value }))
    const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`

    return (
        <div className="w-24">
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ============================================================================
// SECTION 6: HERO METRICS STRIP
// ============================================================================

function HeroMetricsStrip({ cards }: { cards: HeroCard[] }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
                <div
                    key={card.label}
                    className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${card.gradient} text-white animate-insights-fade-in`}
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 animate-insights-gradient-sweep opacity-20"
                        style={{ background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)', backgroundSize: '200% 200%' }}
                    />
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium text-white/70 uppercase tracking-wider">{card.label}</p>
                            <div className="text-3xl font-bold mt-1">
                                <AnimatedNumber value={card.value} />
                            </div>
                            {card.total !== null && (
                                <p className="text-xs text-white/50 mt-1">of {card.total} total</p>
                            )}
                        </div>
                        <MiniSparkline data={card.sparklineData} color="rgba(255,255,255,0.6)" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ============================================================================
// SECTION 7: PLAYBOOK HEALTH RADAR
// ============================================================================

function PlaybookHealthRadar({ radarData }: { radarData: { category: string; coverage: number }[] }) {
    if (radarData.length === 0) {
        return (
            <div className="relative bg-slate-900 rounded-2xl p-6 flex items-center justify-center h-[380px] animate-insights-fade-in" style={{ animationDelay: '200ms' }}>
                <div className="text-center">
                    <p className="text-slate-400 text-sm font-medium">No playbook rules yet</p>
                    <p className="text-slate-600 text-xs mt-1">Create a playbook to see coverage</p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative bg-slate-900 rounded-2xl p-6 overflow-hidden animate-insights-fade-in" style={{ animationDelay: '200ms' }}>
            {/* Radial glow background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />

            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2 relative z-10">
                Playbook Coverage Shield
            </h3>
            <p className="text-xs text-slate-500 mb-4 relative z-10">Category coverage across active playbooks</p>

            <div className="relative z-10">
                <ResponsiveContainer width="100%" height={280}>
                    <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                        <PolarGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                            name="Coverage"
                            dataKey="coverage"
                            stroke="#818cf8"
                            fill="url(#radarGradient)"
                            fillOpacity={0.5}
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#818cf8', stroke: '#c7d2fe', strokeWidth: 1 }}
                        />
                        <defs>
                            <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.1} />
                            </radialGradient>
                        </defs>
                        <Tooltip content={<InsightTooltip />} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Pulsing ring overlay */}
            <div className="absolute inset-8 rounded-full border border-indigo-500/10 animate-insights-pulse-glow pointer-events-none" />
        </div>
    )
}

// ============================================================================
// SECTION 8: CONTRACT ECOSYSTEM RING
// ============================================================================

function ContractEcosystemRing({ ringData, totalCount }: { ringData: { name: string; value: number; fill: string }[]; totalCount: number }) {
    if (ringData.length === 0) {
        return (
            <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-center h-[380px] animate-insights-fade-in" style={{ animationDelay: '300ms' }}>
                <div className="text-center">
                    <p className="text-slate-400 text-sm font-medium">No contracts yet</p>
                    <p className="text-slate-500 text-xs mt-1">Templates and playbooks will appear here</p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-insights-fade-in" style={{ animationDelay: '300ms' }}>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Contract Ecosystem
            </h3>
            <p className="text-xs text-slate-400 mb-4">Distribution by contract type</p>

            <div className="relative">
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie
                            data={ringData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={105}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {ringData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.fill}
                                    className="transition-all duration-300 hover:opacity-80"
                                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))' }}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<InsightTooltip />} />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center stat overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-slate-800">
                            <AnimatedNumber value={totalCount} />
                        </div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Assets</div>
                        <div className="w-8 h-0.5 bg-indigo-400 mx-auto mt-2 rounded-full animate-insights-pulse-glow" />
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {ringData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-xs text-slate-500">{d.name} ({d.value})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 9: TEMPLATE VITALITY GRID
// ============================================================================

function TemplateVitalityGrid({ templates }: { templates: CompanyTemplate[] }) {
    const maxUsage = Math.max(...templates.map(t => t.timesUsed), 1)
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    const getIntensityClass = (timesUsed: number) => {
        const ratio = timesUsed / maxUsage
        if (ratio === 0) return 'bg-slate-800 border-slate-700'
        if (ratio < 0.25) return 'bg-emerald-900/50 border-emerald-800'
        if (ratio < 0.5) return 'bg-emerald-700/50 border-emerald-600'
        if (ratio < 0.75) return 'bg-emerald-500/50 border-emerald-400'
        return 'bg-emerald-400/50 border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
    }

    if (templates.length === 0) {
        return (
            <div className="bg-slate-900 rounded-2xl p-6 text-center animate-insights-fade-in" style={{ animationDelay: '400ms' }}>
                <p className="text-slate-500 text-sm">No templates yet</p>
            </div>
        )
    }

    return (
        <div className="bg-slate-900 rounded-2xl p-6 animate-insights-fade-in" style={{ animationDelay: '400ms' }}>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Template Vitality
            </h3>
            <p className="text-xs text-slate-500 mb-4">Brighter cells = more frequently used</p>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {templates.map((t) => (
                    <div
                        key={t.templateId}
                        className={`relative aspect-square rounded-lg border transition-all duration-300 cursor-pointer ${getIntensityClass(t.timesUsed)} ${hoveredId === t.templateId ? 'scale-110 z-10' : ''}`}
                        onMouseEnter={() => setHoveredId(t.templateId)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-mono text-white/60">{t.timesUsed}</span>
                        </div>

                        {hoveredId === t.templateId && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 whitespace-nowrap">
                                <p className="text-xs font-medium text-white">{t.templateName}</p>
                                <p className="text-[10px] text-slate-400">{t.clauseCount} clauses &middot; Used {t.timesUsed}x</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 justify-center">
                <span className="text-[10px] text-slate-500 uppercase">Cold</span>
                <div className="flex gap-1">
                    {['bg-slate-800', 'bg-emerald-900/50', 'bg-emerald-700/50', 'bg-emerald-500/50', 'bg-emerald-400/50'].map((c, i) => (
                        <div key={i} className={`w-4 h-4 rounded ${c} border border-slate-700`} />
                    ))}
                </div>
                <span className="text-[10px] text-slate-500 uppercase">Hot</span>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 10: TRAINING MOMENTUM FLOW
// ============================================================================

function TrainingMomentumFlow({ trainingUsers }: { trainingUsers: TrainingUser[] }) {
    const funnel = useMemo(() => {
        const invited = trainingUsers.length
        const active = trainingUsers.filter(u => u.status === 'active').length
        const practising = trainingUsers.filter(u => u.sessionsCompleted > 0).length
        const mastery = trainingUsers.filter(u => u.sessionsCompleted >= 5).length
        const max = Math.max(invited, 1)

        return [
            { stage: 'Invited', count: invited, width: 100, color: '#c7d2fe' },
            { stage: 'Active', count: active, width: (active / max) * 100, color: '#818cf8' },
            { stage: 'Practising', count: practising, width: (practising / max) * 100, color: '#6366f1' },
            { stage: 'Mastery', count: mastery, width: (mastery / max) * 100, color: '#4338ca' },
        ]
    }, [trainingUsers])

    if (trainingUsers.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center animate-insights-fade-in" style={{ animationDelay: '500ms' }}>
                <p className="text-slate-400 text-sm font-medium">No training users yet</p>
                <p className="text-slate-500 text-xs mt-1">Add training users to see momentum</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-insights-fade-in" style={{ animationDelay: '500ms' }}>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Training Momentum
            </h3>
            <p className="text-xs text-slate-400 mb-6">User journey from invitation to mastery</p>

            <div className="space-y-3">
                {funnel.map((stage, i) => (
                    <div key={stage.stage} className="flex items-center gap-4">
                        <div className="w-20 text-right">
                            <span className="text-xs font-medium text-slate-500">{stage.stage}</span>
                        </div>
                        <div className="flex-1 relative h-10 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-3"
                                style={{
                                    width: `${Math.max(stage.width, 8)}%`,
                                    backgroundColor: stage.color,
                                    transitionDelay: `${i * 150}ms`
                                }}
                            >
                                <span className="text-xs font-bold text-white drop-shadow-sm">{stage.count}</span>
                            </div>
                            {/* Flow particle sweep */}
                            <div
                                className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-insights-flow-particles"
                                style={{ animationDelay: `${i * 500}ms`, animationDuration: `${3 + i}s` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 11: COMPLIANCE PULSE
// ============================================================================

interface ComplianceSnapshot {
    overall_score: number
    severity: string
    created_at: string
    score_delta: number | null
}

function CompliancePulse({ snapshots }: { snapshots: ComplianceSnapshot[] }) {
    const pulseData = useMemo(() => {
        return snapshots.map((s, i) => ({
            index: i,
            score: s.overall_score,
            timestamp: new Date(s.created_at).toLocaleDateString(),
        }))
    }, [snapshots])

    if (pulseData.length < 2) {
        return (
            <div className="bg-slate-900 rounded-2xl p-6 flex items-center justify-center h-full animate-insights-fade-in" style={{ animationDelay: '600ms' }}>
                <div className="text-center">
                    <p className="text-slate-400 text-sm font-medium">Compliance pulse building...</p>
                    <p className="text-slate-600 text-xs mt-1">More contract reviews will populate this</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-900 rounded-2xl p-6 overflow-hidden animate-insights-fade-in" style={{ animationDelay: '600ms' }}>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Compliance Pulse
            </h3>
            <p className="text-xs text-slate-500 mb-4">Health trend across contract reviews</p>

            <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={pulseData}>
                    <defs>
                        <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="timestamp" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#334155' }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip content={<InsightTooltip />} />
                    <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fill="url(#pulseGradient)" dot={false} activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#0f172a' }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ============================================================================
// SECTION 12: MAIN INSIGHTS TAB
// ============================================================================

export default function InsightsTab({ playbooks, templates, trainingUsers, companyUsers, companyId }: InsightsTabProps) {
    const [playbookRules, setPlaybookRules] = useState<{ category: string; count: number }[]>([])
    const [complianceSnapshots, setComplianceSnapshots] = useState<ComplianceSnapshot[]>([])
    const [loading, setLoading] = useState(true)

    // Load additional data on mount
    const loadInsightData = useCallback(async () => {
        if (!companyId) { setLoading(false); return }
        const supabase = createClient()

        try {
            // Playbook rules by category (for radar)
            const activeIds = playbooks.filter(p => p.isActive).map(p => p.playbookId)
            if (activeIds.length > 0) {
                const { data: rulesData } = await supabase
                    .from('playbook_rules')
                    .select('category')
                    .in('playbook_id', activeIds)

                if (rulesData) {
                    const categoryMap: Record<string, number> = {}
                    rulesData.forEach((r: { category: string }) => {
                        const key = normaliseCategory(r.category)
                        categoryMap[key] = (categoryMap[key] || 0) + 1
                    })
                    setPlaybookRules(Object.entries(categoryMap).map(([category, count]) => ({ category, count })))
                }
            }

            // Compliance snapshots (for pulse — best effort)
            try {
                const { data: snapData } = await supabase
                    .from('compliance_snapshots')
                    .select('overall_score, severity, created_at, score_delta')
                    .order('created_at', { ascending: true })
                    .limit(50)

                if (snapData) setComplianceSnapshots(snapData)
            } catch {
                // compliance_snapshots table may not exist yet — that's fine
            }
        } catch (e) {
            console.error('Insights data load error:', e)
        } finally {
            setLoading(false)
        }
    }, [companyId, playbooks])

    useEffect(() => { loadInsightData() }, [loadInsightData])

    // --- Derived metrics ---

    const heroCards: HeroCard[] = useMemo(() => {
        const playbooksByWeek = computeWeeklyTimeSeries(playbooks, p => p.createdAt, 8)
        const templatesByWeek = computeWeeklyTimeSeries(templates, t => t.createdAt, 8)

        return [
            {
                label: 'Active Playbooks',
                value: playbooks.filter(p => p.isActive).length,
                total: playbooks.length,
                sparklineData: playbooksByWeek,
                gradient: 'from-indigo-500 to-indigo-700',
                sparkColor: '#818cf8',
            },
            {
                label: 'Templates in Use',
                value: templates.filter(t => t.isActive).length,
                total: templates.length,
                sparklineData: templatesByWeek,
                gradient: 'from-emerald-500 to-emerald-700',
                sparkColor: '#34d399',
            },
            {
                label: 'Rules Enforced',
                value: playbooks.reduce((sum, p) => sum + p.rulesExtracted, 0),
                total: null,
                sparklineData: [],
                gradient: 'from-amber-500 to-amber-700',
                sparkColor: '#fbbf24',
            },
            {
                label: 'Active Negotiators',
                value: companyUsers.filter(u => u.status === 'active').length,
                total: companyUsers.length,
                sparklineData: [],
                gradient: 'from-purple-500 to-purple-700',
                sparkColor: '#a78bfa',
            },
        ]
    }, [playbooks, templates, companyUsers])

    const radarData = useMemo(() => {
        const RADAR_CATEGORIES = [
            'liability', 'payment', 'termination', 'confidentiality',
            'intellectual_property', 'data_protection', 'insurance', 'service_levels'
        ]
        const maxCount = Math.max(...playbookRules.map(r => r.count), 1)

        return RADAR_CATEGORIES.map(cat => ({
            category: getCategoryDisplayName(cat),
            coverage: ((playbookRules.find(r => r.category === cat)?.count || 0) / maxCount) * 100,
        }))
    }, [playbookRules])

    const ringData = useMemo(() => {
        const typeCounts: Record<string, number> = {}
        templates.forEach(t => {
            const type = t.contractType || 'custom'
            typeCounts[type] = (typeCounts[type] || 0) + 1
        })
        playbooks.forEach(p => {
            if (p.contractTypeKey) {
                typeCounts[p.contractTypeKey] = (typeCounts[p.contractTypeKey] || 0) + 1
            }
        })
        return Object.entries(typeCounts).map(([type, count]) => ({
            name: CONTRACT_TYPE_LABELS[type] || type,
            value: count,
            fill: CONTRACT_TYPE_COLORS[type] || '#94a3b8',
        }))
    }, [templates, playbooks])

    // --- Loading skeleton ---
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-80 rounded-2xl bg-slate-200 animate-pulse" />
                    <div className="h-80 rounded-2xl bg-slate-200 animate-pulse" />
                </div>
                <div className="h-40 rounded-2xl bg-slate-200 animate-pulse" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Row 1: Hero Metrics */}
            <HeroMetricsStrip cards={heroCards} />

            {/* Row 2: Radar + Ecosystem Ring */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PlaybookHealthRadar radarData={radarData} />
                <ContractEcosystemRing ringData={ringData} totalCount={templates.length + playbooks.length} />
            </div>

            {/* Row 3: Template Vitality Grid */}
            <TemplateVitalityGrid templates={templates} />

            {/* Row 4: Training Momentum + Compliance Pulse */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrainingMomentumFlow trainingUsers={trainingUsers} />
                <CompliancePulse snapshots={complianceSnapshots} />
            </div>

            {/* Footer */}
            <div className="text-center pb-4">
                <p className="text-xs text-slate-400">
                    Insights refreshed {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    )
}
