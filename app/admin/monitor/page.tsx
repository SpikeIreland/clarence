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
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'

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

interface ServiceNode {
    service_id: string
    service_name: string
    service_type: string
    provider: string
    region_label: string
    latitude: number
    longitude: number
    data_at_rest: boolean
    encryption_in_transit: boolean
    encryption_at_rest: boolean
    compliance_notes: string | null
    icon_name: string
}

interface JourneyHop {
    journey_type: string
    hop_sequence: number
    hop_label: string
    data_description: string
    data_sensitivity: string
    typical_latency_ms: number
    from_service_id: string
    from_service_name: string
    from_latitude: number
    from_longitude: number
    from_region_label: string
    from_icon_name: string
    from_data_at_rest: boolean
    to_service_id: string
    to_service_name: string
    to_latitude: number
    to_longitude: number
    to_region_label: string
    to_icon_name: string
    to_data_at_rest: boolean
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

const JOURNEY_LABELS: Record<string, string> = {
    contract_analysis: 'Contract Analysis',
    negotiation: 'Negotiation',
    chat: 'Chat',
    feedback_triage: 'Feedback Triage',
}

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

const SENSITIVITY_LINE_COLORS: Record<string, string> = {
    restricted:   '#ef4444',
    confidential: '#f97316',
    internal:     '#6366f1',
    public:       '#94a3b8',
}

const NODE_COLORS: Record<string, string> = {
    database:      '#6366f1',
    ai_provider:   '#8b5cf6',
    orchestration: '#f59e0b',
    edge_network:  '#10b981',
    serverless:    '#3b82f6',
    auth:          '#06b6d4',
    storage:       '#64748b',
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

function interpolate(a: number, b: number, t: number): number {
    return a + (b - a) * t
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
// SECTION 7: DATA JOURNEY MAP
// ============================================================================

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const MAP_W = 900
const MAP_H = 440
const ANIMATION_TOTAL_MS = 10000
const FRAME_MS = 50

function DataJourneyMap({ nodes, hops }: { nodes: ServiceNode[]; hops: JourneyHop[] }) {
    const [worldPaths, setWorldPaths] = useState<string[]>([])
    const [journeyType, setJourneyType] = useState('contract_analysis')
    const [animating, setAnimating] = useState(false)
    const [currentHopIndex, setCurrentHopIndex] = useState(0)
    const [hopProgress, setHopProgress] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [activeHopInfo, setActiveHopInfo] = useState<JourneyHop | null>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const progressRef = useRef({ hop: 0, progress: 0 })

    // d3-geo projection (Natural Earth — visually balanced for Singapore + US)
    const projection = React.useMemo(() =>
        geoNaturalEarth1().scale(148).translate([MAP_W / 2, MAP_H / 2])
    , [])

    const pathGen = React.useMemo(() => geoPath().projection(projection), [projection])

    // Project [lng, lat] → [svgX, svgY]
    const proj = React.useCallback((lng: number, lat: number): [number, number] =>
        projection([lng, lat]) ?? [0, 0]
    , [projection])

    // Load world boundaries once
    useEffect(() => {
        fetch(GEO_URL)
            .then(r => r.json())
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((topo: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const countries = feature(topo, topo.objects.countries) as any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setWorldPaths(countries.features.map((f: any) => pathGen(f) ?? ''))
            })
            .catch(() => {/* non-fatal — map still usable without background */})
    }, [pathGen])

    const currentHops = hops.filter(h => h.journey_type === journeyType)
        .sort((a, b) => a.hop_sequence - b.hop_sequence)

    const totalLatency = currentHops.reduce((s, h) => s + h.typical_latency_ms, 0)

    const hopDuration = (hop: JourneyHop) =>
        totalLatency > 0 ? (hop.typical_latency_ms / totalLatency) * (ANIMATION_TOTAL_MS / speed) : ANIMATION_TOTAL_MS / speed / currentHops.length

    const startAnimation = () => {
        stopAnimation()
        progressRef.current = { hop: 0, progress: 0 }
        setCurrentHopIndex(0)
        setHopProgress(0)
        setActiveHopInfo(currentHops[0] || null)
        setAnimating(true)

        timerRef.current = setInterval(() => {
            const ref = progressRef.current
            const hop = currentHops[ref.hop]
            if (!hop) { stopAnimation(); return }

            const increment = FRAME_MS / hopDuration(hop)
            const newProgress = ref.progress + increment

            if (newProgress >= 1) {
                const nextHop = ref.hop + 1
                if (nextHop >= currentHops.length) {
                    stopAnimation()
                    return
                }
                progressRef.current = { hop: nextHop, progress: 0 }
                setCurrentHopIndex(nextHop)
                setHopProgress(0)
                setActiveHopInfo(currentHops[nextHop])
            } else {
                progressRef.current = { ...ref, progress: newProgress }
                setHopProgress(newProgress)
            }
        }, FRAME_MS)
    }

    const stopAnimation = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setAnimating(false)
        setActiveHopInfo(null)
    }

    useEffect(() => { return () => stopAnimation() }, [])
    useEffect(() => { stopAnimation() }, [journeyType])

    const currentHop = currentHops[currentHopIndex]
    const dotLng = currentHop ? interpolate(currentHop.from_longitude, currentHop.to_longitude, hopProgress) : null
    const dotLat = currentHop ? interpolate(currentHop.from_latitude, currentHop.to_latitude, hopProgress) : null

    // Deduplicated unique nodes that appear in the selected journey
    const journeyNodeIds = new Set(currentHops.flatMap(h => [h.from_service_id, h.to_service_id]))
    const visibleNodes = nodes.filter(n => journeyNodeIds.has(n.service_id))

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex items-center gap-4 flex-wrap">
                <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Journey Type</label>
                    <select
                        value={journeyType}
                        onChange={e => setJourneyType(e.target.value)}
                        disabled={animating}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
                    >
                        {Object.entries(JOURNEY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v} ({currentHops.length && journeyType === k ? currentHops.length : hops.filter(h => h.journey_type === k).length} hops)</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1">Speed</label>
                    <div className="flex gap-1">
                        {[0.5, 1, 2].map(s => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${speed === s ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >{s}×</button>
                        ))}
                    </div>
                </div>

                <div className="flex items-end gap-2 pb-0.5">
                    {!animating ? (
                        <button
                            onClick={startAnimation}
                            disabled={currentHops.length === 0}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                            Play Journey
                        </button>
                    ) : (
                        <button
                            onClick={stopAnimation}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zm6.5 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                            </svg>
                            Stop
                        </button>
                    )}
                </div>

                {/* Active hop info */}
                {activeHopInfo && (
                    <div className="ml-auto bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 max-w-xs">
                        <p className="text-[10px] font-semibold text-indigo-700">{activeHopInfo.hop_label}</p>
                        <p className="text-[10px] text-indigo-500 mt-0.5">{activeHopInfo.data_description}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1 py-0.5 text-[9px] rounded font-medium ${activeHopInfo.data_sensitivity === 'restricted' ? 'bg-red-100 text-red-700' : activeHopInfo.data_sensitivity === 'confidential' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                {activeHopInfo.data_sensitivity}
                            </span>
                            <span className="text-[9px] text-indigo-400">{activeHopInfo.typical_latency_ms}ms typical</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Map */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                {currentHops.length === 0 ? (
                    <div className="flex items-center justify-center h-80 text-slate-500 text-sm">
                        No journey data available. Check that service_topology and data_journey_hops tables are seeded.
                    </div>
                ) : (
                    <svg
                        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    >
                        {/* World background */}
                        <rect width={MAP_W} height={MAP_H} fill="#0f172a" />
                        {worldPaths.map((d, i) => (
                            <path key={i} d={d} fill="#1e293b" stroke="#334155" strokeWidth={0.3} />
                        ))}

                        {/* Hop lines */}
                        {currentHops.map((hop, i) => {
                            const [x1, y1] = proj(hop.from_longitude, hop.from_latitude)
                            const [x2, y2] = proj(hop.to_longitude, hop.to_latitude)
                            const isActive = animating && currentHopIndex === i
                            return (
                                <line
                                    key={i}
                                    x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={SENSITIVITY_LINE_COLORS[hop.data_sensitivity] || '#64748b'}
                                    strokeWidth={isActive ? 2 : 0.8}
                                    strokeLinecap="round"
                                    strokeDasharray={hop.data_sensitivity === 'internal' ? '4 2' : undefined}
                                    opacity={isActive ? 1 : 0.3}
                                />
                            )
                        })}

                        {/* Service node markers */}
                        {visibleNodes.map(node => {
                            const [x, y] = proj(node.longitude, node.latitude)
                            return (
                                <g key={node.service_id}>
                                    <circle
                                        cx={x} cy={y}
                                        r={node.data_at_rest ? 7 : 5}
                                        fill={NODE_COLORS[node.service_type] || '#64748b'}
                                        stroke={node.data_at_rest ? '#f8fafc' : 'none'}
                                        strokeWidth={node.data_at_rest ? 1.5 : 0}
                                        filter="url(#glow)"
                                    />
                                    <text x={x} y={y - 11} textAnchor="middle"
                                        style={{ fontSize: 8, fill: '#cbd5e1', fontFamily: 'system-ui', pointerEvents: 'none' }}>
                                        {node.service_name}
                                    </text>
                                    {node.data_at_rest && (
                                        <text x={x} y={y + 17} textAnchor="middle"
                                            style={{ fontSize: 7, fill: '#94a3b8', fontFamily: 'system-ui' }}>
                                            stored
                                        </text>
                                    )}
                                </g>
                            )
                        })}

                        {/* Animated dot */}
                        {animating && dotLng !== null && dotLat !== null && (() => {
                            const [dx, dy] = proj(dotLng, dotLat)
                            return (
                                <g>
                                    <circle cx={dx} cy={dy} r={5} fill="#a5b4fc" filter="url(#dotglow)" />
                                    <circle cx={dx} cy={dy} r={9} fill="none" stroke="#a5b4fc" strokeWidth={1} opacity={0.4} />
                                </g>
                            )
                        })()}

                        {/* SVG filters */}
                        <defs>
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <filter id="dotglow" x="-100%" y="-100%" width="300%" height="300%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>
                    </svg>
                )}
            </div>

            {/* Hop progress list */}
            {currentHops.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-800">Journey Steps — {JOURNEY_LABELS[journeyType]}</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {currentHops.map((hop, i) => (
                            <div key={i} className={`px-4 py-2.5 flex items-center gap-3 transition-colors ${animating && currentHopIndex === i ? 'bg-indigo-50' : ''}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${animating && currentHopIndex > i ? 'bg-emerald-100 text-emerald-700' : animating && currentHopIndex === i ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {animating && currentHopIndex > i ? '✓' : hop.hop_sequence}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{hop.hop_label}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{hop.from_service_name} → {hop.to_service_name}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`px-1.5 py-0.5 text-[9px] rounded ${hop.data_sensitivity === 'restricted' ? 'bg-red-50 text-red-600' : hop.data_sensitivity === 'confidential' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'}`}>
                                        {hop.data_sensitivity}
                                    </span>
                                    <span className="text-[10px] text-slate-400 w-14 text-right">{formatDuration(hop.typical_latency_ms)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Legend</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                    <div>
                        <p className="text-[10px] font-medium text-slate-500 mb-1.5">Node types</p>
                        <div className="space-y-1">
                            {Object.entries(NODE_COLORS).map(([type, color]) => (
                                <div key={type} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-[10px] text-slate-600 capitalize">{type.replace(/_/g, ' ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-medium text-slate-500 mb-1.5">Data sensitivity</p>
                        <div className="space-y-1">
                            {Object.entries(SENSITIVITY_LINE_COLORS).map(([sens, color]) => (
                                <div key={sens} className="flex items-center gap-2">
                                    <div className="w-5 h-0.5 shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-[10px] text-slate-600 capitalize">{sens}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-5 h-0.5 shrink-0 rounded-full border-2 border-white ring-1 ring-slate-300" />
                                <span className="text-[10px] text-slate-600">Node with data at rest (white border)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

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
        if (hopsRes.data) setJourneyHops(hopsRes.data as JourneyHop[])
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
                    <DataJourneyMap nodes={serviceNodes} hops={journeyHops} />
                )}
                {activeTab === 'health' && (
                    <SystemHealth />
                )}
            </div>
        </div>
    )
}
