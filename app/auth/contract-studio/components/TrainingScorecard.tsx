'use client'

// ============================================================================
// TRAINING SCORECARD
// Location: app/auth/contract-studio/components/TrainingScorecard.tsx
//
// Full-screen overlay showing training session results and scoring.
// Rendered inside Contract Studio when training ends (manual or auto-complete).
// ============================================================================

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
    calculatePlaybookCompliance,
    type PlaybookRule,
    type ContractClause as ComplianceClause,
} from '@/lib/playbook-compliance'

// ============================================================================
// SECTION 1: INTERFACES (duplicated from contract-studio to keep standalone)
// ============================================================================

interface ContractClause {
    positionId: string
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    customerPosition: number | null
    providerPosition: number | null
    originalCustomerPosition: number | null
    originalProviderPosition: number | null
    gapSize: number
    customerWeight: number
    providerWeight: number
    isDealBreakerCustomer: boolean
    isDealBreakerProvider: boolean
    status: string
    isCategoryHeader?: boolean
    isAgreed?: boolean
    finalAgreedPosition?: number | null
    children?: ContractClause[]
}

interface ClauseChatMessage {
    messageId: string
    sender: string
    message: string
    triggeredBy: string | null
    createdAt: string
}

interface TrainingAvatarInfo {
    characterName: string
    scenarioName: string
    aiPersonality: 'cooperative' | 'balanced' | 'aggressive'
    avatarInitials: string
    companyName: string
}

interface TrainingScorecardProps {
    clauses: ContractClause[]
    chatMessages: ClauseChatMessage[]
    trainingAvatarInfo: TrainingAvatarInfo | null
    sessionCreatedAt: string | null
    sessionId: string | null
    userId?: string | null
    generatedAgentId?: string | null
    onClose: () => void
    onBackToTraining: () => void
}

// ============================================================================
// SECTION 2: SCORING ALGORITHM
// ============================================================================

interface ScoredClause {
    clauseNumber: string
    clauseName: string
    category: string
    originalCustomerPosition: number
    finalCustomerPosition: number
    originalProviderPosition: number
    finalProviderPosition: number
    gap: number
    status: 'agreed' | 'negotiating' | 'disputed' | 'pending'
    positionStrength: number  // 0-100: how well trainee held position
    engaged: boolean
}

interface TrainingScore {
    overall: number
    agreementRate: number
    positionStrength: number
    grade: string
    gradeLabel: string
    clausesEngaged: number
    clausesAgreed: number
    clausesTotal: number
    clausesPending: number
    alignmentPercentage: number
    scoredClauses: ScoredClause[]
}

function calculateTrainingScore(clauses: ContractClause[]): TrainingScore {
    // Flatten clause tree
    const allClauses: ContractClause[] = []
    function flatten(list: ContractClause[]) {
        for (const c of list) {
            if (!c.isCategoryHeader) allClauses.push(c)
            if (c.children) flatten(c.children)
        }
    }
    flatten(clauses)

    const scoredClauses: ScoredClause[] = allClauses.map(c => {
        const originalCust = c.originalCustomerPosition ?? c.customerPosition ?? 5
        const finalCust = c.customerPosition ?? originalCust
        const originalProv = c.originalProviderPosition ?? c.providerPosition ?? 3
        const finalProv = c.providerPosition ?? originalProv

        const gap = Math.abs(finalCust - finalProv)
        const status = (gap <= 1 ? 'agreed' : gap <= 4 ? 'negotiating' : 'disputed') as ScoredClause['status']

        // A clause is "engaged" if the trainee has interacted with it
        const positionChanged = c.customerPosition !== null &&
            c.originalCustomerPosition !== null &&
            Math.abs(c.customerPosition - c.originalCustomerPosition) > 0.01
        const engaged = status !== 'pending' && (positionChanged || c.isAgreed || gap <= 1)

        // Position strength: how well did the trainee hold their position?
        // 100 = held original, 0 = gave everything away to provider
        let positionStrength = 100
        if (engaged && Math.abs(originalCust - originalProv) > 0.01) {
            const range = originalCust - originalProv
            const achieved = finalCust - originalProv
            positionStrength = Math.round(Math.max(0, Math.min(100, (achieved / range) * 100)))
        }

        return {
            clauseNumber: c.clauseNumber,
            clauseName: c.clauseName,
            category: c.category || '',
            originalCustomerPosition: originalCust,
            finalCustomerPosition: finalCust,
            originalProviderPosition: originalProv,
            finalProviderPosition: finalProv,
            gap: Math.round(gap * 10) / 10,
            status: c.status === 'pending' ? 'pending' : status,
            positionStrength,
            engaged,
        }
    })

    const engaged = scoredClauses.filter(c => c.engaged)
    const agreed = scoredClauses.filter(c => c.status === 'agreed' && c.engaged)
    const pending = scoredClauses.filter(c => !c.engaged)

    // Agreement rate: what % of engaged clauses reached agreement?
    const agreementRate = engaged.length > 0
        ? Math.round((agreed.length / engaged.length) * 100)
        : 0

    // Position strength: average across engaged clauses
    const positionStrength = engaged.length > 0
        ? Math.round(engaged.reduce((sum, c) => sum + c.positionStrength, 0) / engaged.length)
        : 0

    // Overall score: weighted average
    const overall = Math.round(agreementRate * 0.5 + positionStrength * 0.5)

    // Alignment percentage (continuous scoring like contract studio)
    const scorable = allClauses.filter(c => c.customerPosition !== null && c.providerPosition !== null)
    const totalAlignment = scorable.reduce((sum, c) => {
        const g = Math.abs((c.customerPosition || 0) - (c.providerPosition || 0))
        return sum + Math.max(0, ((9 - g) / 9) * 100)
    }, 0)
    const alignmentPercentage = scorable.length > 0
        ? Math.round((totalAlignment / scorable.length) * 10) / 10
        : 0

    // Grade
    let grade: string, gradeLabel: string
    if (overall >= 85) { grade = 'A'; gradeLabel = 'Excellent' }
    else if (overall >= 70) { grade = 'B'; gradeLabel = 'Good' }
    else if (overall >= 55) { grade = 'C'; gradeLabel = 'Needs Work' }
    else { grade = 'D'; gradeLabel = 'Review Required' }

    return {
        overall,
        agreementRate,
        positionStrength,
        grade,
        gradeLabel,
        clausesEngaged: engaged.length,
        clausesAgreed: agreed.length,
        clausesTotal: allClauses.length,
        clausesPending: pending.length,
        alignmentPercentage,
        scoredClauses,
    }
}

// ============================================================================
// SECTION 3: SUB-COMPONENTS
// ============================================================================

function ScoreRing({ score, size = 120, strokeWidth = 8 }: {
    score: number; size?: number; strokeWidth?: number
}) {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (score / 100) * circumference

    const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
    const strokeTrack = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2'
    const textColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'

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
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${textColor}`}>
                <span className="text-3xl font-bold">{score}%</span>
            </div>
        </div>
    )
}

function MetricCard({ icon, value, label, sublabel }: {
    icon: React.ReactNode; value: string; label: string; sublabel?: string
}) {
    return (
        <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xl font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500 font-medium">{label}</div>
            {sublabel && <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        agreed: 'bg-emerald-100 text-emerald-700',
        negotiating: 'bg-amber-100 text-amber-700',
        disputed: 'bg-red-100 text-red-700',
        pending: 'bg-slate-100 text-slate-500',
    }
    const labels: Record<string, string> = {
        agreed: 'Agreed',
        negotiating: 'In Progress',
        disputed: 'Disputed',
        pending: 'Not Attempted',
    }
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
            {labels[status] || status}
        </span>
    )
}

function PositionDot({ value, color }: { value: number; color: string }) {
    const left = ((value - 1) / 9) * 100
    return (
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${left}%`, backgroundColor: color }}
            title={`Position: ${value}`}
        />
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function TrainingScorecard({
    clauses,
    chatMessages,
    trainingAvatarInfo,
    sessionCreatedAt,
    sessionId,
    userId,
    generatedAgentId,
    onClose,
    onBackToTraining,
}: TrainingScorecardProps) {
    const supabase = createClient()
    const [showTeachingMoments, setShowTeachingMoments] = useState(false)
    const [playbookCompliance, setPlaybookCompliance] = useState<{
        score: number; rulesPassed: number; rulesTotal: number; redLineBreaches: number
    } | null>(null)
    const [clarenceDebrief, setClarenceDebrief] = useState<string | null>(null)
    const [isLoadingDebrief, setIsLoadingDebrief] = useState(false)

    // Calculate score
    const score = calculateTrainingScore(clauses)

    // Trigger Clarence debrief for dynamic agent sessions
    useEffect(() => {
        if (sessionId && userId && generatedAgentId && !clarenceDebrief && !isLoadingDebrief) {
            setIsLoadingDebrief(true)
            fetch('/api/agents/debrief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, userId }),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.debrief?.summary) {
                        setClarenceDebrief(data.debrief.summary)
                    }
                })
                .catch(err => console.error('[TrainingScorecard] Debrief error:', err))
                .finally(() => setIsLoadingDebrief(false))
        }
    }, [sessionId, userId, generatedAgentId, clarenceDebrief, isLoadingDebrief])

    // Extract teaching moments
    const teachingMoments = chatMessages.filter(m =>
        m.triggeredBy === 'training_ai_move' &&
        m.sender === 'clarence' &&
        m.message.includes("CLARENCE's Tip:")
    )

    // Calculate session duration
    const duration = sessionCreatedAt
        ? formatDuration(new Date(sessionCreatedAt), new Date())
        : 'N/A'

    // Load playbook compliance for scorecard (if this is a playbook training session)
    useEffect(() => {
        if (!sessionId) return
        async function loadCompliance() {
            try {
                const { data: ts } = await supabase
                    .from('playbook_training_sessions')
                    .select('playbook_id')
                    .eq('session_id', sessionId)
                    .single()
                if (!ts?.playbook_id) return

                const { data: rules } = await supabase
                    .from('playbook_rules')
                    .select('*')
                    .eq('playbook_id', ts.playbook_id)
                    .eq('is_active', true)
                if (!rules || rules.length === 0) return

                const adaptedClauses: ComplianceClause[] = clauses
                    .filter(c => !c.isCategoryHeader)
                    .map(c => ({
                        clause_id: c.clauseId,
                        clause_name: c.clauseName,
                        category: c.category || '',
                        clarence_position: null,
                        initiator_position: c.customerPosition,
                        respondent_position: c.providerPosition,
                        customer_position: c.customerPosition,
                        is_header: false,
                    }))

                const result = calculatePlaybookCompliance(rules as PlaybookRule[], adaptedClauses)
                setPlaybookCompliance({
                    score: result.overallScore,
                    rulesPassed: result.rulesPassed,
                    rulesTotal: result.totalPlaybookRules,
                    redLineBreaches: result.redLineBreaches,
                })
            } catch {
                // Silently fail — compliance is optional on the scorecard
            }
        }
        loadCompliance()
    }, [sessionId, supabase, clauses])

    // Sort clauses: engaged first, then pending
    const sortedClauses = [...score.scoredClauses].sort((a, b) => {
        if (a.engaged && !b.engaged) return -1
        if (!a.engaged && b.engaged) return 1
        return 0
    })

    const scenarioName = trainingAvatarInfo?.scenarioName || 'Training Session'
    const opponentName = trainingAvatarInfo?.characterName || 'AI Opponent'
    const difficulty = trainingAvatarInfo?.aiPersonality || 'balanced'

    const gradeColor = score.overall >= 80 ? 'text-emerald-600'
        : score.overall >= 60 ? 'text-amber-600'
        : 'text-red-600'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Card */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-6 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Training Complete</h1>
                                <p className="text-amber-100 text-sm mt-0.5">
                                    {scenarioName} &bull; vs {opponentName} &bull; {difficulty} difficulty &bull; {duration}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

                    {/* Score Ring + Grade */}
                    <div className="flex flex-col items-center py-4">
                        <ScoreRing score={score.overall} />
                        <div className={`mt-3 text-lg font-bold ${gradeColor}`}>
                            {score.grade} &mdash; {score.gradeLabel}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            {score.clausesAgreed} of {score.clausesEngaged} negotiated clauses agreed
                            {score.clausesPending > 0 && ` (${score.clausesPending} not attempted)`}
                        </p>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MetricCard
                            icon={<svg className="w-6 h-6 mx-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            value={`${score.clausesAgreed}/${score.clausesEngaged}`}
                            label="Clauses Agreed"
                            sublabel={`of ${score.clausesTotal} total`}
                        />
                        <MetricCard
                            icon={<svg className="w-6 h-6 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                            value={`${score.alignmentPercentage}%`}
                            label="Alignment"
                        />
                        <MetricCard
                            icon={<svg className="w-6 h-6 mx-auto text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                            value={`${score.positionStrength}%`}
                            label="Position Held"
                        />
                        {playbookCompliance ? (
                            <MetricCard
                                icon={<svg className="w-6 h-6 mx-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                                value={`${playbookCompliance.score}%`}
                                label="Playbook Compliance"
                                sublabel={playbookCompliance.redLineBreaches > 0 ? `${playbookCompliance.redLineBreaches} red line breach${playbookCompliance.redLineBreaches > 1 ? 'es' : ''}` : `${playbookCompliance.rulesPassed}/${playbookCompliance.rulesTotal} rules passed`}
                            />
                        ) : (
                            <MetricCard
                                icon={<svg className="w-6 h-6 mx-auto text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                                value={`${teachingMoments.length}`}
                                label="Teaching Moments"
                            />
                        )}
                    </div>

                    {/* Clause Breakdown */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Clause Breakdown</h3>
                        <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                <div className="col-span-4">Clause</div>
                                <div className="col-span-3 text-center">Position Movement</div>
                                <div className="col-span-2 text-center">Gap</div>
                                <div className="col-span-3 text-right">Status</div>
                            </div>
                            {/* Rows */}
                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                {sortedClauses.map((clause) => (
                                    <div key={clause.clauseNumber} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${!clause.engaged ? 'opacity-50' : ''}`}>
                                        <div className="col-span-4">
                                            <div className="text-sm font-medium text-slate-800">{clause.clauseName}</div>
                                            <div className="text-xs text-slate-400">{clause.clauseNumber}</div>
                                        </div>
                                        <div className="col-span-3">
                                            {clause.engaged ? (
                                                <div className="relative h-4 bg-slate-200 rounded-full mx-2">
                                                    <PositionDot value={clause.originalCustomerPosition} color="#94a3b8" />
                                                    <PositionDot value={clause.finalCustomerPosition} color="#3b82f6" />
                                                    <PositionDot value={clause.finalProviderPosition} color="#f59e0b" />
                                                </div>
                                            ) : (
                                                <div className="text-center text-xs text-slate-400">&mdash;</div>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            {clause.engaged ? (
                                                <span className={`text-sm font-mono font-medium ${
                                                    clause.gap <= 1 ? 'text-emerald-600' :
                                                    clause.gap <= 4 ? 'text-amber-600' : 'text-red-600'
                                                }`}>
                                                    {clause.gap}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">&mdash;</span>
                                            )}
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <StatusBadge status={clause.engaged ? clause.status : 'pending'} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Opening
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Your Final
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Opponent
                            </div>
                        </div>
                    </div>

                    {/* Teaching Moments */}
                    {teachingMoments.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowTeachingMoments(!showTeachingMoments)}
                                className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition"
                            >
                                <svg className={`w-4 h-4 transition-transform ${showTeachingMoments ? 'rotate-90' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                Teaching Moments ({teachingMoments.length})
                            </button>
                            {showTeachingMoments && (
                                <div className="mt-3 space-y-2">
                                    {teachingMoments.map((tm, i) => {
                                        // Strip the emoji prefix for cleaner display
                                        const cleanMessage = tm.message
                                            .replace(/^.*\*\*CLARENCE's Tip:\*\*\s*/i, '')
                                            .trim()
                                        return (
                                            <div key={tm.messageId || i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-slate-700">
                                                <div className="flex items-start gap-2">
                                                    <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                    </svg>
                                                    <span>{cleanMessage}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Clarence Debrief (dynamic agent sessions only) */}
                {(clarenceDebrief || isLoadingDebrief) && (
                    <div className="px-8 py-6 border-t border-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">Clarence&apos;s Debrief</h3>
                                <p className="text-xs text-slate-500">Personalised feedback on your negotiation</p>
                            </div>
                        </div>
                        {isLoadingDebrief ? (
                            <div className="flex items-center gap-3 text-slate-500 text-sm">
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin"></div>
                                Clarence is analysing your session...
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                                {clarenceDebrief}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition"
                    >
                        Review Session
                    </button>
                    <button
                        onClick={onBackToTraining}
                        className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
                    >
                        Back to Training Studio
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: UTILITY
// ============================================================================

function formatDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Less than a minute'
    if (mins < 60) return `${mins} min`
    const hrs = Math.floor(mins / 60)
    const remainMins = mins % 60
    return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`
}
