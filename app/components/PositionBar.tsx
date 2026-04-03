// ============================================================================
// FILE: app/components/PositionBar.tsx
// PURPOSE: Unified position bar component for the Clarence Legal platform
// ============================================================================
//
// Single component with togglable overlays, used across all pages:
//
//   FIXED (always present):
//     • Gradient bar (blue → teal → emerald, 1–10 scale)
//     • Range labels underneath (when scalePoints provided)
//     • Party orientation labels
//
//   TOGGLABLE OVERLAYS (pass prop to enable):
//     1. clarence      — Purple "C" badge (draggable or read-only)
//     2. parties       — Blue (provider) + Green (customer) badges with initials
//     3. playbook      — Ideal, Fallback, Market band, Escalation line
//     4. compliance    — 4-tier colour diamond (clause vs playbook thresholds)
//     5. documentInfo  — "Your Document Says" + "Industry Standard" cards
//     6. escalation    — Alert banner with contact details
//
// Usage examples:
//
//   Playbook Rule Card:
//     <PositionBar scalePoints={pts} playbook={{ ideal: 8, fallback: 5, ... editable: true }} />
//
//   QC Overview Tab:
//     <PositionBar scalePoints={pts} clarence={{ position: 7, draggable: true }} />
//
//   QC Playbook Tab:
//     <PositionBar scalePoints={pts} playbook={...} compliance={{ position: 6 }} />
//
//   Contract Studio:
//     <PositionBar scalePoints={pts} parties={{ provider: {...}, customer: {...} }} />
//
// ============================================================================

'use client'

import { useState, useCallback, type MouseEvent as ReactMouseEvent } from 'react'


// ============================================================================
// TYPES
// ============================================================================

export interface ScalePoint {
    position: number
    label: string
    value: number
    description?: string
}

export interface ClarenceOverlay {
    position: number
    draggable?: boolean
    onPositionChange?: (position: number) => void
    fairnessLabel?: string
}

export interface PartyConfig {
    position: number
    initials: string
    label: string
    draggable?: boolean
    onPositionChange?: (position: number) => void
}

export interface PartiesOverlay {
    provider: PartyConfig
    customer: PartyConfig
}

export interface PlaybookOverlay {
    ideal: number
    fallback: number
    minimum: number
    maximum: number
    escalation?: number | null
}

export interface ComplianceOverlay {
    position: number
}

export interface DocumentInfoOverlay {
    documentValue: string
    documentLabel?: string
    industryRange?: {
        label: string
        description: string
    }
}

export interface EscalationOverlay {
    contact: string
    email?: string
}

export interface PositionBarProps {
    // Fixed layer
    scalePoints?: ScalePoint[]
    leftParty?: string
    rightParty?: string

    // Togglable overlays
    clarence?: ClarenceOverlay | null
    parties?: PartiesOverlay | null
    playbook?: PlaybookOverlay | null
    compliance?: ComplianceOverlay | null
    documentInfo?: DocumentInfoOverlay | null
    escalation?: EscalationOverlay | null

    className?: string
}


// ============================================================================
// HELPERS
// ============================================================================

/** Maps position 1–10 to 0–100% */
const toPercent = (pos: number): number =>
    ((Math.max(1, Math.min(10, pos)) - 1) / 9) * 100

/** Snap to nearest 0.5 */
const snapToHalf = (val: number): number => Math.round(val * 2) / 2

/** Convert percentage back to position */
const fromPercent = (pct: number): number => (pct / 100) * 9 + 1

/** Interpolate a real-world label from scale points */
const interpolateLabel = (position: number, scalePoints: ScalePoint[]): string | null => {
    if (!scalePoints.length) return null
    const sorted = [...scalePoints].sort((a, b) => a.position - b.position)
    const exact = sorted.find(p => Math.abs(p.position - position) < 0.05)
    if (exact) return exact.label

    let lo = sorted[0]
    let hi = sorted[sorted.length - 1]
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].position <= position && sorted[i + 1].position >= position) {
            lo = sorted[i]
            hi = sorted[i + 1]
            break
        }
    }
    if (lo === hi) return lo.label
    const ratio = (position - lo.position) / (hi.position - lo.position)
    const val = Math.round(lo.value + ratio * (hi.value - lo.value))
    return `~${val}${lo.label.includes('%') ? '%' : ''}`
}

/** 4-tier compliance status from position vs playbook thresholds */
interface ComplianceTier {
    label: string
    bg: string
    text: string
    diamond: string
    border: string
}

const getComplianceTier = (pos: number, playbook: PlaybookOverlay): ComplianceTier => {
    if (pos < playbook.minimum)
        return { label: 'Out of market', bg: 'bg-slate-900', text: 'text-white', diamond: 'bg-slate-900', border: '' }
    if (pos < playbook.fallback)
        return { label: 'Out of company range', bg: 'bg-red-50', text: 'text-red-600', diamond: 'bg-red-500', border: 'border-red-200' }
    if (pos < playbook.ideal - 0.5)
        return { label: 'Outside ideal', bg: 'bg-amber-50', text: 'text-amber-700', diamond: 'bg-amber-500', border: 'border-amber-200' }
    return { label: 'Within ideal', bg: 'bg-emerald-50', text: 'text-emerald-700', diamond: 'bg-emerald-500', border: 'border-emerald-200' }
}


// ============================================================================
// DRAG HOOK
// ============================================================================

function useDrag(
    onPositionChange: ((pos: number) => void) | undefined,
    enabled: boolean
) {
    const [dragging, setDragging] = useState(false)

    const onMouseDown = useCallback((e: ReactMouseEvent) => {
        if (!enabled || !onPositionChange) return
        e.preventDefault()
        setDragging(true)

        const bar = (e.target as HTMLElement).closest('[data-bar-track]') as HTMLElement | null
        if (!bar) return

        const move = (ev: globalThis.MouseEvent) => {
            const rect = bar.getBoundingClientRect()
            const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left))
            const pct = (x / rect.width) * 100
            onPositionChange(snapToHalf(Math.max(1, Math.min(10, fromPercent(pct)))))
        }

        const up = () => {
            setDragging(false)
            document.removeEventListener('mousemove', move)
            document.removeEventListener('mouseup', up)
        }

        document.addEventListener('mousemove', move)
        document.addEventListener('mouseup', up)
    }, [enabled, onPositionChange])

    return { dragging, onMouseDown }
}


const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PositionBar({
    scalePoints = [],
    leftParty = 'Provider',
    rightParty = 'Customer',
    clarence = null,
    parties = null,
    playbook = null,
    compliance = null,
    documentInfo = null,
    escalation = null,
    className = '',
}: PositionBarProps) {

    // ── Drag handlers ──
    const clarenceDrag = useDrag(clarence?.onPositionChange, !!clarence?.draggable)
    const provDrag = useDrag(parties?.provider?.onPositionChange, !!parties?.provider?.draggable)
    const custDrag = useDrag(parties?.customer?.onPositionChange, !!parties?.customer?.draggable)

    // ── Derived state ──
    const clarencePos = clarence?.position ?? null
    const tier = compliance && playbook
        ? getComplianceTier(compliance.position, playbook)
        : null

    const gap = parties?.provider?.position != null && parties?.customer?.position != null
        ? Math.abs(parties.customer.position - parties.provider.position)
        : null

    // ── Range label hover ──
    const [hoveredLabel, setHoveredLabel] = useState<number | null>(null)

    // ── Display positions for range labels ──
    const labelPositions = [1, 3, 5, 7, 10]

    return (
        <div className={`space-y-0 ${className}`}>

            {/* ── Compliance status badge ── */}
            {tier && (
                <div className="mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${tier.bg} ${tier.text} ${tier.border}`}>
                        {tier.label}
                    </span>
                </div>
            )}

            {/* ── Bar area ── */}
            <div className={`relative ${playbook ? 'pt-7 pb-7' : 'pt-2 pb-2'}`}>
                <div data-bar-track className="relative">

                    {/* ═══ FIXED: Gradient bar ═══ */}
                    <div className="relative h-3 bg-gradient-to-r from-blue-200 via-teal-200 via-50% to-emerald-200 rounded-full">
                        {/* Tick marks */}
                        {POSITIONS.map(n => (
                            <div
                                key={n}
                                className="absolute top-0 bottom-0 w-px bg-white/50"
                                style={{ left: `${toPercent(n)}%` }}
                            />
                        ))}

                        {/* ── Overlay 3: Playbook — Market band ── */}
                        {playbook && (
                            <>
                                <div
                                    className="absolute inset-y-0 bg-amber-200/50 border-y border-amber-300/60 rounded-full"
                                    style={{
                                        left: `${toPercent(playbook.minimum)}%`,
                                        width: `${Math.max(0.5, toPercent(playbook.maximum) - toPercent(playbook.minimum))}%`,
                                    }}
                                />
                                {/* Escalation line */}
                                {playbook.escalation != null && (
                                    <div
                                        className="absolute top-[-4px] bottom-[-4px] w-px border-l-2 border-dashed border-red-400"
                                        style={{ left: `${toPercent(playbook.escalation)}%` }}
                                        title={`Escalation below ${playbook.escalation}`}
                                    />
                                )}
                            </>
                        )}

                        {/* ── Overlay 2: Gap zone between parties ── */}
                        {gap !== null && parties && (
                            <div
                                className={`absolute inset-y-0 rounded-full ${
                                    gap <= 1 ? 'bg-emerald-400/25'
                                        : gap <= 4 ? 'bg-amber-400/25'
                                            : 'bg-red-400/25'
                                }`}
                                style={{
                                    left: `${toPercent(Math.min(parties.provider.position, parties.customer.position))}%`,
                                    width: `${Math.abs(toPercent(parties.customer.position) - toPercent(parties.provider.position))}%`,
                                }}
                            />
                        )}
                    </div>

                    {/* ── Overlay 3: Playbook — Ideal badge (above) ── */}
                    {playbook && (
                        <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${toPercent(playbook.ideal)}%`, transform: 'translateX(-50%)', bottom: '100%', marginBottom: '2px' }}
                        >
                            <div className="bg-emerald-500 text-white px-1.5 py-px text-[9px] font-semibold rounded-full whitespace-nowrap">
                                Ideal · {playbook.ideal}
                            </div>
                            <div className="w-px bg-emerald-500 h-1.5 opacity-60" />
                        </div>
                    )}

                    {/* ── Overlay 3: Playbook — Fallback badge (below) ── */}
                    {playbook && (
                        <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${toPercent(playbook.fallback)}%`, transform: 'translateX(-50%)', top: '100%', marginTop: '2px' }}
                        >
                            <div className="w-px bg-red-500 h-1.5 opacity-60" />
                            <div className="bg-red-500 text-white px-1.5 py-px text-[9px] font-semibold rounded-full whitespace-nowrap">
                                Fallback · {playbook.fallback}
                            </div>
                        </div>
                    )}

                    {/* ── Overlay 4: Compliance diamond ── */}
                    {compliance && tier && (
                        <div
                            className="absolute z-10"
                            style={{ left: `${toPercent(compliance.position)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                            title={`Clause: ${compliance.position} — ${tier.label}`}
                        >
                            <div
                                className={`${tier.diamond} rounded-sm shadow-sm border border-white/50`}
                                style={{ width: '14px', height: '14px', transform: 'rotate(45deg)' }}
                            />
                        </div>
                    )}

                    {/* ── Overlay 1: Clarence badge ── */}
                    {clarencePos != null && clarence && (
                        <div
                            className={`absolute z-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 border-4 border-white flex items-center justify-center shadow-xl transition-transform
                                ${clarence.draggable
                                    ? (clarenceDrag.dragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105')
                                    : 'cursor-default'
                                }`}
                            style={{ width: '44px', height: '44px', left: `${toPercent(clarencePos)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                            onMouseDown={clarenceDrag.onMouseDown}
                            title={`${clarence.draggable ? 'Drag to adjust — ' : ''}Position ${clarencePos}`}
                        >
                            <span className="text-white text-base font-bold select-none">C</span>
                        </div>
                    )}

                    {/* ── Overlay 2: Provider badge (blue) ── */}
                    {parties?.provider?.position != null && (
                        <div
                            className={`absolute z-20 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center shadow-md transition-transform
                                ${parties.provider.draggable
                                    ? (provDrag.dragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105')
                                    : 'cursor-default opacity-80'
                                }`}
                            style={{ width: '30px', height: '30px', left: `${toPercent(parties.provider.position)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                            onMouseDown={provDrag.onMouseDown}
                            title={`${parties.provider.label}: ${parties.provider.position}`}
                        >
                            <span className="text-white text-[9px] font-bold select-none">{parties.provider.initials}</span>
                        </div>
                    )}

                    {/* ── Overlay 2: Customer badge (green) ── */}
                    {parties?.customer?.position != null && (
                        <div
                            className={`absolute z-20 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md transition-transform
                                ${parties.customer.draggable
                                    ? (custDrag.dragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105')
                                    : 'cursor-default opacity-80'
                                }`}
                            style={{ width: '30px', height: '30px', left: `${toPercent(parties.customer.position)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                            onMouseDown={custDrag.onMouseDown}
                            title={`${parties.customer.label}: ${parties.customer.position}`}
                        >
                            <span className="text-white text-[9px] font-bold select-none">{parties.customer.initials}</span>
                        </div>
                    )}

                </div>
            </div>

            {/* ═══ FIXED: Range labels ═══ */}
            {scalePoints.length > 0 && (
                <div className="relative h-5 mt-1.5">
                    {labelPositions.map(pos => {
                        const point = scalePoints.find(p => Math.abs(p.position - pos) < 0.5)
                        if (!point) return null

                        const pct = toPercent(pos)
                        const isFirst = pos === 1
                        const isLast = pos === 10
                        const isLong = point.label.length > 10
                        const isHovered = hoveredLabel === pos

                        return (
                            <div
                                key={pos}
                                className="absolute"
                                style={{
                                    left: `${pct}%`,
                                    transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                                }}
                                onMouseEnter={() => setHoveredLabel(pos)}
                                onMouseLeave={() => setHoveredLabel(null)}
                            >
                                {!isLong ? (
                                    <span className="text-[10px] text-slate-500 font-medium leading-none">
                                        {point.label}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 font-medium leading-none flex items-center gap-0.5 cursor-help">
                                        {point.label.slice(0, 8)}&hellip;
                                        <span className="w-1 h-1 rounded-full bg-slate-300 inline-block" />
                                    </span>
                                )}

                                {isLong && isHovered && (
                                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg z-50 whitespace-nowrap">
                                        <div className="font-medium">{point.label}</div>
                                        {point.description && (
                                            <div className="text-slate-400 text-[9px] mt-0.5">{point.description}</div>
                                        )}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ═══ FIXED: Party orientation labels ═══ */}
            <div className="flex justify-between items-center mt-0.5">
                <span className="text-[9px] text-slate-400">
                    <span className="text-blue-400">←</span> Favours {leftParty}
                </span>
                <span className="text-[9px] text-slate-400">
                    Favours {rightParty} <span className="text-emerald-400">→</span>
                </span>
            </div>

            {/* ── Clarence position readout ── */}
            {clarencePos != null && clarence && (
                <div className="text-center mt-1.5">
                    <span className="text-sm font-semibold text-purple-700">
                        {interpolateLabel(clarencePos, scalePoints) || clarencePos.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                        (Position {clarencePos.toFixed(1)})
                    </span>
                    {clarence.fairnessLabel && (
                        <>
                            <span className="text-xs text-slate-300 mx-1.5">·</span>
                            <span className="text-xs text-purple-500 font-medium">{clarence.fairnessLabel}</span>
                        </>
                    )}
                </div>
            )}

            {/* ── Gap indicator (dual-party) ── */}
            {gap !== null && (
                <div className="flex items-center justify-center mt-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-medium
                        ${gap <= 1
                            ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                            : gap <= 4
                                ? 'text-amber-600 bg-amber-50 border-amber-200'
                                : 'text-red-600 bg-red-50 border-red-200'
                        }`}
                    >
                        <span>Gap: {gap.toFixed(1)}</span>
                        <span className="opacity-40">·</span>
                        <span>{gap <= 1 ? 'Agreed' : gap <= 4 ? 'Negotiating' : 'Disputed'}</span>
                    </div>
                </div>
            )}

            {/* ── Party legend — Blue | Clarence | Green mirrors bar layout ── */}
            {parties && (
                <div className="flex items-center justify-center gap-4 mt-1.5">
                    {parties.provider && (
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                            {parties.provider.label}
                        </span>
                    )}
                    {clarencePos != null && (
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                                <span className="text-white text-[7px] font-bold">C</span>
                            </span>
                            Clarence
                        </span>
                    )}
                    {parties.customer && (
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="w-3 h-3 rounded-full bg-emerald-500" />
                            {parties.customer.label}
                        </span>
                    )}
                </div>
            )}

            {/* ── Playbook summary line ── */}
            {playbook && compliance && tier && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                    <span>Playbook: fallback {playbook.fallback} · ideal {playbook.ideal}</span>
                    <span className="text-slate-300">|</span>
                    <span className={`font-medium ${tier.text}`}>Clause: {compliance.position}</span>
                </div>
            )}

            {/* ── Escalation alert ── */}
            {escalation && (
                <div className="mt-2.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                        <span className="font-semibold">Escalate to:</span> {escalation.contact}
                        {escalation.email && <span className="text-amber-500 ml-1">({escalation.email})</span>}
                    </span>
                </div>
            )}

            {/* ── Overlay 5: Document info sections ── */}
            {documentInfo && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                    {documentInfo.documentValue && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                                Your Document Says
                            </div>
                            <div className="text-xl font-bold text-slate-800">
                                {documentInfo.documentValue}
                            </div>
                            {documentInfo.documentLabel && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                                    <span className="text-[10px] text-slate-500">{documentInfo.documentLabel}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {documentInfo.industryRange && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="text-[10px] font-medium text-purple-600 uppercase tracking-wide mb-1.5">
                                Industry Standard
                            </div>
                            <div className="text-lg font-semibold text-purple-800">
                                {documentInfo.industryRange.label}
                            </div>
                            <div className="mt-1.5 text-[10px] text-purple-600">
                                {documentInfo.industryRange.description}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
