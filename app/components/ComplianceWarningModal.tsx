'use client'

// ============================================================================
// FILE: app/components/ComplianceWarningModal.tsx
// PURPOSE: Tiered warning modal for playbook compliance breaches
// ============================================================================

import { type ComplianceCheckResult } from '@/lib/agents/compliance-checker'

interface ComplianceWarningModalProps {
    isOpen: boolean
    onClose: () => void
    onProceed: () => void
    onSeekApproval: () => void
    onAdjust: () => void
    complianceResult: ComplianceCheckResult
    clauseName: string
    proposedPosition: number
}

export default function ComplianceWarningModal({
    isOpen,
    onClose,
    onProceed,
    onSeekApproval,
    onAdjust,
    complianceResult,
    clauseName,
    proposedPosition,
}: ComplianceWarningModalProps) {
    if (!isOpen) return null

    const isDealBreaker = complianceResult.severity === 'deal_breaker'
    const isBreach = complianceResult.severity === 'breach'
    const isCritical = isDealBreaker || isBreach

    const borderColor = isCritical ? 'border-red-300' : 'border-amber-300'
    const bgHeader = isCritical ? 'bg-red-50' : 'bg-amber-50'
    const iconColor = isCritical ? 'text-red-600' : 'text-amber-600'
    const titleText = isDealBreaker
        ? 'Deal Breaker Warning'
        : isBreach
            ? 'Compliance Breach'
            : 'Playbook Warning'

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={`bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 border ${borderColor} overflow-hidden`}>
                {/* Header */}
                <div className={`${bgHeader} px-5 py-4 border-b ${borderColor}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCritical ? 'bg-red-100' : 'bg-amber-100'}`}>
                            <svg className={`w-5 h-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {isCritical ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                )}
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">{titleText}</h3>
                            <p className="text-sm text-slate-500">{clauseName} — Position {proposedPosition}</p>
                        </div>
                    </div>
                </div>

                {/* Score Impact */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm text-slate-600">Compliance Score</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{complianceResult.previousScore}%</span>
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                        <span className={`text-sm font-bold ${complianceResult.scoreDelta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {complianceResult.overallScore}%
                        </span>
                        {complianceResult.scoreDelta !== 0 && (
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${complianceResult.scoreDelta < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {complianceResult.scoreDelta > 0 ? '+' : ''}{complianceResult.scoreDelta}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Breached Rules */}
                <div className="px-5 py-4 max-h-64 overflow-y-auto">
                    {complianceResult.breachedRules.map((rule, idx) => (
                        <div key={rule.ruleId || idx} className="mb-3 last:mb-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-slate-800">{rule.clauseName}</span>
                                {rule.isDealBreaker && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded uppercase">Deal Breaker</span>
                                )}
                                {rule.isNonNegotiable && !rule.isDealBreaker && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase">Non-Negotiable</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-600">{rule.detail}</p>
                            {rule.rationale && (
                                <p className="text-xs text-slate-500 mt-1 italic">{rule.rationale}</p>
                            )}
                            {rule.negotiationTips && (
                                <p className="text-xs text-blue-600 mt-1">Tip: {rule.negotiationTips}</p>
                            )}
                            <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                                <span>Ideal: {rule.idealPosition}</span>
                                <span>Min: {rule.minimumPosition}</span>
                                <span>Proposed: {rule.proposedPosition}</span>
                            </div>
                        </div>
                    ))}

                    {/* Agent reasoning */}
                    {complianceResult.reasoning && (
                        <div className="mt-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-xs text-purple-700">
                                <span className="font-medium">AI Assessment: </span>
                                {complianceResult.reasoning}
                            </p>
                        </div>
                    )}

                    {/* Escalation contact */}
                    {complianceResult.escalationContact && (
                        <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <p className="text-xs text-slate-600">
                                <span className="font-medium">Escalation Contact: </span>
                                {complianceResult.escalationContact}
                                {complianceResult.escalationContactEmail && (
                                    <span className="ml-1 text-blue-600">({complianceResult.escalationContactEmail})</span>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                        onClick={onAdjust}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        {isCritical ? 'Go Back' : 'Adjust Position'}
                    </button>

                    {complianceResult.requiresApproval && (
                        <button
                            onClick={onSeekApproval}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Seek Approval
                        </button>
                    )}

                    <button
                        onClick={onProceed}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            isCritical
                                ? 'text-white bg-red-600 hover:bg-red-700'
                                : 'text-white bg-amber-600 hover:bg-amber-700'
                        }`}
                    >
                        {isCritical ? 'Proceed at Risk' : 'Proceed Anyway'}
                    </button>
                </div>
            </div>
        </div>
    )
}
