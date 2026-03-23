'use client'
// ============================================================================
// Shared Data Journey Map component
// Used in: app/admin/monitor/page.tsx (props-driven)
//          app/auth/company-admin/page.tsx (via DataJourneyMapContainer)
// ============================================================================
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceNode {
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

export interface JourneyHop {
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

// ============================================================================
// CONSTANTS
// ============================================================================

export const JOURNEY_LABELS: Record<string, string> = {
    contract_analysis: 'Contract Analysis',
    negotiation:       'Negotiation',
    chat:              'Chat',
    feedback_triage:   'Feedback Triage',
}

export const NODE_COLORS: Record<string, string> = {
    database:      '#6366f1',
    ai_provider:   '#8b5cf6',
    orchestration: '#f59e0b',
    edge_network:  '#10b981',
    serverless:    '#3b82f6',
    auth:          '#06b6d4',
    storage:       '#64748b',
}

export const SENSITIVITY_LINE_COLORS: Record<string, string> = {
    restricted:   '#ef4444',
    confidential: '#f97316',
    internal:     '#6366f1',
    public:       '#94a3b8',
}

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const MAP_W = 900
const MAP_H = 440
const ANIMATION_TOTAL_MS = 10000
const FRAME_MS = 50

// ============================================================================
// HELPERS
// ============================================================================

function interpolate(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function wrapLabel(text: string, maxChars = 13): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word
        if (candidate.length > maxChars && current) {
            lines.push(current)
            current = word
        } else {
            current = candidate
        }
    }
    if (current) lines.push(current)
    return lines
}

function formatDuration(ms: number | null): string {
    if (ms === null) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

// ============================================================================
// DATA JOURNEY MAP COMPONENT
// ============================================================================

export function DataJourneyMap({ nodes, hops, error }: { nodes: ServiceNode[]; hops: JourneyHop[]; error?: string | null }) {
    const [worldPaths, setWorldPaths] = useState<string[]>([])
    const [journeyType, setJourneyType] = useState('contract_analysis')
    const [animating, setAnimating] = useState(false)
    const [currentHopIndex, setCurrentHopIndex] = useState(0)
    const [hopProgress, setHopProgress] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [activeHopInfo, setActiveHopInfo] = useState<JourneyHop | null>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const progressRef = useRef({ hop: 0, progress: 0 })

    const projection = React.useMemo(() =>
        geoNaturalEarth1().scale(148).translate([MAP_W / 2, MAP_H / 2])
    , [])
    const pathGen = React.useMemo(() => geoPath().projection(projection), [projection])
    const proj = React.useCallback((lng: number, lat: number): [number, number] =>
        projection([lng, lat]) ?? [0, 0]
    , [projection])

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
            .catch(() => {/* non-fatal */})
    }, [pathGen])

    const currentHops = hops.filter(h => h.journey_type === journeyType)
        .sort((a, b) => a.hop_sequence - b.hop_sequence)

    const totalLatency = currentHops.reduce((s, h) => s + h.typical_latency_ms, 0)
    const hopDuration = (hop: JourneyHop) =>
        totalLatency > 0
            ? (hop.typical_latency_ms / totalLatency) * (ANIMATION_TOTAL_MS / speed)
            : ANIMATION_TOTAL_MS / speed / currentHops.length

    const stopAnimation = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setAnimating(false)
        setActiveHopInfo(null)
    }

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
                if (nextHop >= currentHops.length) { stopAnimation(); return }
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

    useEffect(() => { return () => stopAnimation() }, [])
    useEffect(() => { stopAnimation() }, [journeyType])

    const currentHop = currentHops[currentHopIndex]
    const journeyNodeIds = new Set(currentHops.flatMap(h => [h.from_service_id, h.to_service_id]))
    const visibleNodes = nodes.filter(n => journeyNodeIds.has(n.service_id))

    const nodeDisplayPos = React.useMemo(() => {
        const pos = new Map<string, [number, number]>()
        if (visibleNodes.length === 0) return pos
        const raw = visibleNodes.map(n => ({ id: n.service_id, xy: proj(n.longitude, n.latitude) }))
        const used = new Set<string>()
        for (const item of raw) {
            if (used.has(item.id)) continue
            const cluster = raw.filter(o => {
                const dx = o.xy[0] - item.xy[0], dy = o.xy[1] - item.xy[1]
                return Math.sqrt(dx * dx + dy * dy) < 12
            })
            cluster.forEach(c => used.add(c.id))
            if (cluster.length === 1) {
                pos.set(cluster[0].id, cluster[0].xy)
            } else {
                cluster.forEach((c, i) => {
                    const angle = (2 * Math.PI * i) / cluster.length - Math.PI / 2
                    pos.set(c.id, [item.xy[0] + 22 * Math.cos(angle), item.xy[1] + 22 * Math.sin(angle)])
                })
            }
        }
        return pos
    }, [visibleNodes, proj])

    const fromPos = currentHop ? (nodeDisplayPos.get(currentHop.from_service_id) ?? proj(currentHop.from_longitude, currentHop.from_latitude)) : null
    const toPos   = currentHop ? (nodeDisplayPos.get(currentHop.to_service_id)   ?? proj(currentHop.to_longitude,   currentHop.to_latitude))   : null
    const dotX = fromPos && toPos ? interpolate(fromPos[0], toPos[0], hopProgress) : null
    const dotY = fromPos && toPos ? interpolate(fromPos[1], toPos[1], hopProgress) : null

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
                            <button key={s} onClick={() => setSpeed(s)}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${speed === s ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >{s}×</button>
                        ))}
                    </div>
                </div>

                <div className="flex items-end gap-2 pb-0.5">
                    {!animating ? (
                        <button onClick={startAnimation} disabled={currentHops.length === 0}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                            Play Journey
                        </button>
                    ) : (
                        <button onClick={stopAnimation}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zm6.5 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                            </svg>
                            Stop
                        </button>
                    )}
                </div>

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
                    <div className="flex flex-col items-center justify-center h-80 text-slate-500 text-sm gap-2 px-6 text-center">
                        {error ? (
                            <>
                                <span className="text-red-400 font-medium">Database error</span>
                                <span className="text-slate-400 text-xs font-mono break-all">{error}</span>
                            </>
                        ) : (
                            <span>No journey data available. Check that service_topology and data_journey_hops tables are seeded.</span>
                        )}
                    </div>
                ) : (
                    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
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

                        <rect width={MAP_W} height={MAP_H} fill="#0f172a" />
                        {worldPaths.map((d, i) => (
                            <path key={i} d={d} fill="#1e293b" stroke="#334155" strokeWidth={0.3} />
                        ))}

                        {currentHops.map((hop, i) => {
                            const [x1, y1] = nodeDisplayPos.get(hop.from_service_id) ?? proj(hop.from_longitude, hop.from_latitude)
                            const [x2, y2] = nodeDisplayPos.get(hop.to_service_id)   ?? proj(hop.to_longitude,   hop.to_latitude)
                            const isActive = animating && currentHopIndex === i
                            return (
                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={SENSITIVITY_LINE_COLORS[hop.data_sensitivity] || '#64748b'}
                                    strokeWidth={isActive ? 2 : 0.8}
                                    strokeLinecap="round"
                                    strokeDasharray={hop.data_sensitivity === 'internal' ? '4 2' : undefined}
                                    opacity={isActive ? 1 : 0.3}
                                />
                            )
                        })}

                        {visibleNodes.map(node => {
                            const [x, y] = nodeDisplayPos.get(node.service_id) ?? proj(node.longitude, node.latitude)
                            return (
                                <g key={node.service_id}>
                                    <circle cx={x} cy={y}
                                        r={node.data_at_rest ? 7 : 5}
                                        fill={NODE_COLORS[node.service_type] || '#64748b'}
                                        stroke={node.data_at_rest ? '#f8fafc' : 'none'}
                                        strokeWidth={node.data_at_rest ? 1.5 : 0}
                                        filter="url(#glow)"
                                    />
                                    {(() => {
                                        const lines = wrapLabel(node.service_name)
                                        const lineH = 9
                                        const startY = y - 12 - (lines.length - 1) * lineH
                                        return lines.map((line, li) => (
                                            <text key={li} x={x} y={startY + li * lineH} textAnchor="middle"
                                                style={{ fontSize: 8, fill: '#cbd5e1', fontFamily: 'system-ui', pointerEvents: 'none' }}>
                                                {line}
                                            </text>
                                        ))
                                    })()}
                                    {node.data_at_rest && (
                                        <text x={x} y={y + 17} textAnchor="middle"
                                            style={{ fontSize: 7, fill: '#94a3b8', fontFamily: 'system-ui' }}>
                                            stored
                                        </text>
                                    )}
                                </g>
                            )
                        })}

                        {animating && dotX !== null && dotY !== null && (
                            <g>
                                <circle cx={dotX} cy={dotY} r={5} fill="#a5b4fc" filter="url(#dotglow)" />
                                <circle cx={dotX} cy={dotY} r={9} fill="none" stroke="#a5b4fc" strokeWidth={1} opacity={0.4} />
                            </g>
                        )}
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
// SELF-FETCHING CONTAINER (for use in company-admin and similar)
// ============================================================================

export function DataJourneyMapContainer() {
    const [hops, setHops] = useState<JourneyHop[]>([])
    const [nodes, setNodes] = useState<ServiceNode[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        async function load() {
            const [nodesRes, hopsRes] = await Promise.all([
                supabase.from('service_topology').select('*'),
                supabase.from('v_data_journey_map').select('*'),
            ])
            if (nodesRes.data) setNodes(nodesRes.data as ServiceNode[])
            if (hopsRes.data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mapped: JourneyHop[] = hopsRes.data.map((h: any) => ({
                    journey_type:       h.journey_type,
                    hop_sequence:       h.hop_sequence,
                    hop_label:          h.hop_label,
                    data_description:   h.data_description,
                    data_sensitivity:   h.data_sensitivity,
                    typical_latency_ms: h.typical_latency_ms,
                    from_service_id:    h.from_id,
                    from_service_name:  h.from_name,
                    from_latitude:      h.from_lat,
                    from_longitude:     h.from_lng,
                    from_region_label:  h.from_region,
                    from_icon_name:     h.from_icon,
                    from_data_at_rest:  h.from_stores_data,
                    to_service_id:      h.to_id,
                    to_service_name:    h.to_name,
                    to_latitude:        h.to_lat,
                    to_longitude:       h.to_lng,
                    to_region_label:    h.to_region,
                    to_icon_name:       h.to_icon,
                    to_data_at_rest:    h.to_stores_data,
                }))
                setHops(mapped)
            }
            if (nodesRes.error || hopsRes.error) {
                setError([nodesRes.error?.message, hopsRes.error?.message].filter(Boolean).join(' | '))
            }
            setLoading(false)
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-80 text-slate-400 text-sm">
                Loading data map…
            </div>
        )
    }

    return <DataJourneyMap nodes={nodes} hops={hops} error={error} />
}
