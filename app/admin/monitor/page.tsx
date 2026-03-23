'use client'

// ============================================================================
// CLARENCE — Admin Monitor / Command Centre
// Path: app/admin/monitor/page.tsx
//
// Tabs:
//   1. Escalations  — AI triage queue + detail panel (v_escalation_dashboard)
//   2. Trends       — Weekly feedback themes chart (v_triage_theme_trend)
//   3. Data Journey — Animated world map of data flows (v_data_journey_map)
//   4. System Health — Event log, failures, sessions (existing observability)
//
// Database views are queried directly via Supabase client (no Edge Functions).
// Real-time subscription on feedback_escalations for live escalation updates.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { DataJourneyMap, ServiceNode, JourneyHop, NODE_COLORS, SENSITIVITY_LINE_COLORS, JOURNEY_LABELS } from '@/app/components/DataJourneyMap'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

type TabType = 'escalations' | 'trends' | 'journey' | 'health'
type SourceFilter = 'all' | 'frontend' | 'n8n' | 'database' | 'ai'

interface TriageSummary {
    pending_count: number
    classified_count: number
    responded_count: number
    escalated_count: number
    resolved_count: number
    closed_count: number
    open_escalations: number
    active_escalations: number
    position_issues_30d: number
    party_issues_30d: number
    playbook_issues_30d: number
    ai_issues_30d: number
    feedback_7d: number
    feedback_30d: number
    feedback_total: number
}

interface EscalationItem {
    escalation_id: string
    feedback_id: string
    escalated_to: string
    escalation_status: string
    priority_override: string | null
    escalation_reason: string
    resolution_notes: string | null
    notification_sent: boolean
    created_at: string
    updated_at: string
    feedback_title: string
    feedback_description: string
    feedback_type: string
    user_id: string
    company_id: string | null
    theme: string | null
    severity: string | null
    confidence_score: number | null
    classification_reasoning: string | null
    suggested_action: string | null
    user_response: string | null
    seen_by_user: boolean
}

interface ThemeTrend {
    week: string
    theme: string
    severity: string
    count: number
    avg_confidence: number
    likely_resolved_count: number
}


interface RecentEvent {
    event_id: string
    session_id: string | null
    journey_type: string
    step_name: string
    status: string
    source_system: string
    duration_ms: number | null
    error_message: string | null
    created_at: string
    time_ago: string
}

interface FailedEvent {
    event_id: string
    session_id: string | null
    journey_type: string
    step_name: string
    error_message: string | null
    error_code: string | null
    source_system: string
    created_at: string
    time_ago: string
}

interface SystemStats {
    total_events_1h: number
    total_events_24h: number
    failures_1h: number
    failures_24h: number
    active_sessions_1h: number
    active_users_1h: number
    avg_duration_ms: number | null
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const THEME_COLORS: Record<string, string> = {
    position_accuracy: '#ef4444',
    party_context: '#f97316',
    playbook_clause: '#8b5cf6',
    ai_response: '#6366f1',
    ui_display: '#3b82f6',
    performance: '#10b981',
    training: '#06b6d4',
    infrastructure: '#64748b',
    other: '#9ca3af',
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    high:     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    medium:   { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    low:      { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    open:          { bg: 'bg-red-100',    text: 'text-red-700' },
    acknowledged:  { bg: 'bg-amber-100',  text: 'text-amber-700' },
    investigating: { bg: 'bg-blue-100',   text: 'text-blue-700' },
    resolved:      { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    deferred:      { bg: 'bg-slate-100',  text: 'text-slate-600' },
    closed:        { bg: 'bg-slate-100',  text: 'text-slate-500' },
}


// ============================================================================
// SECTION 3: HELPERS
// ============================================================================

function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return 'Never'
    const diffMs = Date.now() - new Date(dateString).getTime()
    const m = Math.floor(diffMs / 60000)
    const h = Math.floor(diffMs / 3600000)
    const d = Math.floor(diffMs / 86400000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    return `${d}d ago`
}

function formatDuration(ms: number | null): string {
    if (ms === null) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

function formatJourneyName(t: string): string {
    return t.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function pivotTrendData(rows: ThemeTrend[]): Record<string, number | string>[] {
    const weeks = [...new Set(rows.map(r => r.week))].sort()
    return weeks.map(week => {
        const entry: Record<string, number | string> = {
            week: new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        }
        rows.filter(r => r.week === week).forEach(r => {
            entry[r.theme] = (Number(entry[r.theme]) || 0) + r.count
        })
        return entry
    })
}


// ============================================================================
// SECTION 4: KPI CARDS
// ============================================================================

function KpiCard({ label, value, sub, variant = 'default' }: {
    label: string
    value: string | number
    sub?: string
    variant?: 'default' | 'warning' | 'danger' | 'success'
}) {
    const accent = {
        default: 'border-indigo-400',
        warning: 'border-amber-400',
        danger:  'border-red-400',
        success: 'border-emerald-400',
    }[variant]

    const valueColor = {
        default: 'text-slate-800',
        warning: 'text-amber-700',
        danger:  'text-red-700',
        success: 'text-emerald-700',
    }[variant]

    return (
        <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${accent} px-4 py-3 shadow-sm`}>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${valueColor}`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    )
}

// ============================================================================
// SECTION 5: ESCALATION QUEUE
// ============================================================================

function EscalationQueue({ escalations, onRefresh }: {
    escalations: EscalationItem[]
    onRefresh: () => void
}) {
    const [selected, setSelected] = useState<EscalationItem | null>(null)
    const [statusFilter, setStatusFilter] = useState('open')
    const [newStatus, setNewStatus] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    const filtered = statusFilter === 'all'
        ? escalations
        : escalations.filter(e => e.escalation_status === statusFilter)

    const handleSelect = (item: EscalationItem) => {
        setSelected(item)
        setNewStatus(item.escalation_status)
        setNotes(item.resolution_notes || '')
    }

    const handleSave = async () => {
        if (!selected) return
        setSaving(true)
        try {
            const supabase = createClient()
            await supabase
                .from('feedback_escalations')
                .update({ escalation_status: newStatus, resolution_notes: notes, updated_at: new Date().toISOString() })
                .eq('escalation_id', selected.escalation_id)
            onRefresh()
            setSelected(prev => prev ? { ...prev, escalation_status: newStatus, resolution_notes: notes } : prev)
        } finally {
            setSaving(false)
        }
    }

    const sev = (item: EscalationItem) => item.priority_override || item.severity || 'low'
    const sevStyle = (item: EscalationItem) => SEVERITY_COLORS[sev(item)] || SEVERITY_COLORS.low
    const statStyle = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.closed

    return (
        <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
            {/* Queue list */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Escalation Queue</h3>
                    <div className="flex gap-1.5">
                        {['open', 'investigating', 'all'].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${statusFilter === s
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                            >
                                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm">No {statusFilter === 'all' ? '' : statusFilter} escalations</p>
                        </div>
                    ) : filtered.map(item => (
                        <button
                            key={item.escalation_id}
                            onClick={() => handleSelect(item)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.escalation_id === item.escalation_id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{item.feedback_title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{item.escalation_reason}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${sevStyle(item).bg} ${sevStyle(item).text}`}>
                                        {sev(item)}
                                    </span>
                                    <span className={`px-1.5 py-0.5 text-[9px] rounded ${statStyle(item.escalation_status).bg} ${statStyle(item.escalation_status).text}`}>
                                        {item.escalation_status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                                {item.theme && (
                                    <span className="text-[10px] text-slate-400">{item.theme.replace(/_/g, ' ')}</span>
                                )}
                                <span className="text-[10px] text-slate-400">{formatTimeAgo(item.created_at)}</span>
                                {!item.seen_by_user && item.user_response && (
                                    <span className="text-[10px] text-indigo-500 font-medium">Unseen response</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail panel */}
            <div className="w-[420px] bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                {!selected ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-slate-400 px-6">
                        <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-center">Select an escalation to view details and update its status</p>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">Escalation Detail</h3>
                            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Title + badges */}
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{selected.feedback_title}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {selected.severity && (
                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${sevStyle(selected).bg} ${sevStyle(selected).text} border ${sevStyle(selected).border}`}>
                                            {selected.priority_override ? `${selected.priority_override} (override)` : selected.severity}
                                        </span>
                                    )}
                                    {selected.theme && (
                                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            {selected.theme.replace(/_/g, ' ')}
                                        </span>
                                    )}
                                    {selected.confidence_score != null && (
                                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-slate-50 text-slate-500 border border-slate-200">
                                            {Math.round(selected.confidence_score * 100)}% confidence
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* User description */}
                            <div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">User Description</p>
                                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-lg px-3 py-2">{selected.feedback_description}</p>
                            </div>

                            {/* AI classification reasoning */}
                            {selected.classification_reasoning && (
                                <div>
                                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">AI Classification</p>
                                    <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">{selected.classification_reasoning}</p>
                                </div>
                            )}

                            {/* Escalation reason */}
                            <div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">Escalation Reason</p>
                                <p className="text-xs text-slate-600 leading-relaxed">{selected.escalation_reason}</p>
                            </div>

                            {/* Automated response */}
                            {selected.user_response && (
                                <div>
                                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                                        Automated Response
                                        {!selected.seen_by_user && <span className="ml-1.5 text-indigo-500">• Not seen</span>}
                                    </p>
                                    <p className="text-xs text-slate-600 leading-relaxed bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">{selected.user_response}</p>
                                </div>
                            )}

                            {/* Status update */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Update Status</label>
                                    <select
                                        value={newStatus}
                                        onChange={e => setNewStatus(e.target.value)}
                                        className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        {['open', 'acknowledged', 'investigating', 'resolved', 'deferred', 'closed'].map(s => (
                                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Resolution Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        rows={3}
                                        placeholder="What was done, or why deferred..."
                                        className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400">{formatTimeAgo(selected.created_at)}</span>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: FEEDBACK TRENDS
// ============================================================================

function FeedbackTrends({ data }: { data: ThemeTrend[] }) {
    const [severityFilter, setSeverityFilter] = useState('all')

    const filtered = severityFilter === 'all' ? data : data.filter(r => r.severity === severityFilter)
    const chartData = pivotTrendData(filtered)
    const themes = [...new Set(data.map(r => r.theme))]

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Feedback Themes — 90 Day Trend</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Weekly volume by classification theme</p>
                    </div>
                    <div className="flex gap-1.5">
                        {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                            <button
                                key={s}
                                onClick={() => setSeverityFilter(s)}
                                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${severityFilter === s
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                            >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                        No trend data available yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                            <defs>
                                {themes.map(theme => (
                                    <linearGradient key={theme} id={`grad-${theme}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={THEME_COLORS[theme] || '#94a3b8'} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={THEME_COLORS[theme] || '#94a3b8'} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                            {themes.map(theme => (
                                <Area
                                    key={theme}
                                    type="monotone"
                                    dataKey={theme}
                                    name={theme.replace(/_/g, ' ')}
                                    stroke={THEME_COLORS[theme] || '#94a3b8'}
                                    fill={`url(#grad-${theme})`}
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Theme breakdown table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800">Theme Breakdown — Last 30 Days</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    {themes.map(theme => {
                        const rows = data.filter(r => r.theme === theme)
                        const total = rows.reduce((s, r) => s + r.count, 0)
                        const avgConf = rows.length ? rows.reduce((s, r) => s + r.avg_confidence, 0) / rows.length : 0
                        const resolved = rows.reduce((s, r) => s + r.likely_resolved_count, 0)
                        return (
                            <div key={theme} className="px-4 py-3 flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: THEME_COLORS[theme] || '#94a3b8' }} />
                                <span className="text-xs font-medium text-slate-700 w-40 shrink-0 capitalize">{theme.replace(/_/g, ' ')}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (total / 20) * 100)}%`, backgroundColor: THEME_COLORS[theme] || '#94a3b8' }} />
                                </div>
                                <span className="text-xs font-bold text-slate-800 w-8 text-right">{total}</span>
                                <span className="text-[10px] text-slate-400 w-24 text-right">{Math.round(avgConf * 100)}% conf · {resolved} resolved</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 7: DATA JOURNEY MAP — imported from @/app/components/DataJourneyMap
// ============================================================================
// ============================================================================
// SECTION 8: SYSTEM HEALTH (existing observability content)
// ============================================================================

function SystemHealth() {
    const [events, setEvents] = useState<RecentEvent[]>([])
    const [failures, setFailures] = useState<FailedEvent[]>([])
    const [stats, setStats] = useState<SystemStats | null>(null)
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
    const [healthTab, setHealthTab] = useState<'events' | 'failures'>('events')
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [evRes, failRes] = await Promise.all([
                fetch('/api/system-events/recent?limit=100'),
                fetch('/api/system-events/failures?hours=24'),
            ])
            const [evData, failData] = await Promise.all([evRes.json(), failRes.json()])
            if (evData.success) { setEvents(evData.events); setStats(evData.stats) }
            if (failData.success) { setFailures(failData.failures) }
        } catch { /* non-fatal */ }
        setLoading(false)
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const filtered = sourceFilter === 'all' ? events : events.filter(e => e.source_system === sourceFilter)

    const statusColor = (s: string) => ({ completed: 'text-emerald-600', failed: 'text-red-600', started: 'text-amber-600' })[s] || 'text-slate-500'
    const statusDot = (s: string) => ({ completed: 'bg-emerald-500', failed: 'bg-red-500', started: 'bg-amber-500' })[s] || 'bg-slate-300'

    return (
        <div className="space-y-4">
            {/* Mini stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Events (1h)" value={stats?.total_events_1h || 0} />
                <KpiCard label="Events (24h)" value={stats?.total_events_24h || 0} />
                <KpiCard label="Failures (1h)" value={stats?.failures_1h || 0} variant={(stats?.failures_1h || 0) > 0 ? 'danger' : 'success'} />
                <KpiCard label="Avg Duration" value={formatDuration(stats?.avg_duration_ms || null)} />
            </div>

            {/* Sub-tabs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex gap-1.5">
                        {(['events', 'failures'] as const).map(t => (
                            <button key={t} onClick={() => setHealthTab(t)}
                                className={`px-3 py-1 text-xs rounded-lg transition-colors ${healthTab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                            >
                                {t === 'events' ? 'Recent Events' : `Failures${failures.length > 0 ? ` (${failures.length})` : ''}`}
                            </button>
                        ))}
                    </div>
                    {healthTab === 'events' && (
                        <div className="flex gap-1">
                            {(['all', 'frontend', 'n8n', 'database', 'ai'] as SourceFilter[]).map(f => (
                                <button key={f} onClick={() => setSourceFilter(f)}
                                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${sourceFilter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                                >{f === 'all' ? 'All' : f.toUpperCase()}</button>
                            ))}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading...</div>
                ) : healthTab === 'events' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                                <tr>
                                    {['Time', 'Status', 'Journey', 'Step', 'Source', 'Session', 'Duration'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No events found</td></tr>
                                ) : filtered.map(ev => (
                                    <tr key={ev.event_id} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-slate-500">{ev.time_ago}</td>
                                        <td className="px-3 py-2">
                                            <span className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot(ev.status)}`} />
                                                <span className={statusColor(ev.status)}>{ev.status}</span>
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-700">{formatJourneyName(ev.journey_type)}</td>
                                        <td className="px-3 py-2 font-mono text-slate-500 max-w-[160px] truncate" title={ev.step_name}>{ev.step_name}</td>
                                        <td className="px-3 py-2">
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{ev.source_system}</span>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-slate-400">
                                            {ev.session_id ? ev.session_id.substring(0, 8) + '…' : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">{formatDuration(ev.duration_ms)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                                <tr>
                                    {['Time', 'Journey', 'Step', 'Error', 'Source'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {failures.length === 0 ? (
                                    <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No failures in the last 24h</td></tr>
                                ) : failures.map(f => (
                                    <tr key={f.event_id} className="hover:bg-red-50">
                                        <td className="px-3 py-2 text-slate-500">{f.time_ago}</td>
                                        <td className="px-3 py-2 text-slate-700">{formatJourneyName(f.journey_type)}</td>
                                        <td className="px-3 py-2 font-mono text-slate-500 max-w-[140px] truncate">{f.step_name}</td>
                                        <td className="px-3 py-2 text-red-600 max-w-[200px] truncate" title={f.error_message || ''}>{f.error_message || '—'}</td>
                                        <td className="px-3 py-2">
                                            <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]">{f.source_system}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 9: MAIN DASHBOARD
// ============================================================================

export default function MonitorDashboard() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabType>('escalations')
    const [triageSummary, setTriageSummary] = useState<TriageSummary | null>(null)
    const [escalations, setEscalations] = useState<EscalationItem[]>([])
    const [trendData, setTrendData] = useState<ThemeTrend[]>([])
    const [serviceNodes, setServiceNodes] = useState<ServiceNode[]>([])
    const [journeyHops, setJourneyHops] = useState<JourneyHop[]>([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [journeyError, setJourneyError] = useState<string | null>(null)

    // ── Auth ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }
            const { data: profile } = await supabase
                .from('users').select('role').eq('auth_id', user.id).single()
            if (profile?.role !== 'admin') { router.push('/auth/contracts-dashboard') }
        }
        checkAuth()
    }, [router])

    // ── Data fetch ────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        const supabase = createClient()
        const [summaryRes, escalationsRes, trendsRes, nodesRes, hopsRes] = await Promise.all([
            supabase.from('v_triage_summary').select('*').single(),
            supabase.from('v_escalation_dashboard').select('*'),
            supabase.from('v_triage_theme_trend').select('*'),
            supabase.from('service_topology').select('*'),
            supabase.from('v_data_journey_map').select('*'),
        ])
        if (summaryRes.data) setTriageSummary(summaryRes.data as TriageSummary)
        if (escalationsRes.data) setEscalations(escalationsRes.data as EscalationItem[])
        if (trendsRes.data) setTrendData(trendsRes.data as ThemeTrend[])
        if (nodesRes.data) setServiceNodes(nodesRes.data as ServiceNode[])
        if (hopsRes.data) {
            // v_data_journey_map uses shortened column aliases — map to JourneyHop interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: JourneyHop[] = hopsRes.data.map((h: any) => ({
                journey_type:      h.journey_type,
                hop_sequence:      h.hop_sequence,
                hop_label:         h.hop_label,
                data_description:  h.data_description,
                data_sensitivity:  h.data_sensitivity,
                typical_latency_ms: h.typical_latency_ms,
                from_service_id:   h.from_id,
                from_service_name: h.from_name,
                from_latitude:     h.from_lat,
                from_longitude:    h.from_lng,
                from_region_label: h.from_region,
                from_icon_name:    h.from_icon,
                from_data_at_rest: h.from_stores_data,
                to_service_id:     h.to_id,
                to_service_name:   h.to_name,
                to_latitude:       h.to_lat,
                to_longitude:      h.to_lng,
                to_region_label:   h.to_region,
                to_icon_name:      h.to_icon,
                to_data_at_rest:   h.to_stores_data,
            }))
            setJourneyHops(mapped)
        }
        if (nodesRes.error || hopsRes.error) {
            setJourneyError([nodesRes.error?.message, hopsRes.error?.message].filter(Boolean).join(' | '))
        } else {
            setJourneyError(null)
        }
        setLastRefresh(new Date())
        setLoading(false)
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    // Auto-refresh every 60s
    useEffect(() => {
        if (!autoRefresh) return
        const t = setInterval(fetchAll, 60000)
        return () => clearInterval(t)
    }, [autoRefresh, fetchAll])

    // Real-time subscription on escalations
    useEffect(() => {
        const supabase = createClient()
        const sub = supabase
            .channel('monitor-escalations')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback_escalations' }, fetchAll)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [fetchAll])

    const openEscalations = escalations.filter(e => e.escalation_status === 'open').length

    const TABS: { id: TabType; label: string; badge?: string | number }[] = [
        { id: 'escalations', label: 'Escalations', badge: openEscalations > 0 ? openEscalations : undefined },
        { id: 'trends', label: 'Feedback Trends' },
        { id: 'journey', label: 'Data Journey' },
        { id: 'health', label: 'System Health' },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Loading monitor...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-800">Clarence — Command Centre</h1>
                            <p className="text-[11px] text-slate-500">Triage · Trends · Data Journey · System Health</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded border-slate-300" />
                            Auto-refresh
                        </label>
                        <button onClick={fetchAll} className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                            Refresh
                        </button>
                        <span className="text-[11px] text-slate-400">Updated {lastRefresh.toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard
                        label="Pending Triage"
                        value={triageSummary?.pending_count ?? '—'}
                        sub="awaiting AI classification"
                        variant={(triageSummary?.pending_count || 0) > 5 ? 'warning' : 'default'}
                    />
                    <KpiCard
                        label="Open Escalations"
                        value={triageSummary?.open_escalations ?? '—'}
                        sub="require your attention"
                        variant={(triageSummary?.open_escalations || 0) > 0 ? 'danger' : 'success'}
                    />
                    <KpiCard
                        label="Position Issues (30d)"
                        value={triageSummary?.position_issues_30d ?? '—'}
                        sub="position accuracy flags"
                        variant={(triageSummary?.position_issues_30d || 0) > 3 ? 'warning' : 'default'}
                    />
                    <KpiCard
                        label="Feedback This Week"
                        value={triageSummary?.feedback_7d ?? '—'}
                        sub={`${triageSummary?.feedback_30d ?? '—'} last 30 days`}
                    />
                    <KpiCard
                        label="Total Resolved"
                        value={triageSummary?.resolved_count ?? '—'}
                        sub={`${triageSummary?.closed_count ?? 0} closed`}
                        variant="success"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5 flex-wrap">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50'}`}
                        >
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {activeTab === 'escalations' && (
                    <EscalationQueue escalations={escalations} onRefresh={fetchAll} />
                )}
                {activeTab === 'trends' && (
                    <FeedbackTrends data={trendData} />
                )}
                {activeTab === 'journey' && (
                    <DataJourneyMap nodes={serviceNodes} hops={journeyHops} error={journeyError} />
                )}
                {activeTab === 'health' && (
                    <SystemHealth />
                )}
            </div>
        </div>
    )
}
