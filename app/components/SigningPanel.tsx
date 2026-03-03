'use client'

// ============================================================================
// SIGNING PANEL (ORCHESTRATOR)
// Location: app/components/SigningPanel.tsx
//
// The main signing panel shown in the left sidebar of Document Centre.
// Replaces the old Section 8B SigningPanel. Orchestrates the full
// signing ceremony: entity confirmation -> signing -> execution.
//
// Uses emerald (initiator), blue (respondent), violet (execution) colours.
// ============================================================================

import SigningProgressTracker from './SigningProgressTracker'
import type {
    SigningConfirmation,
    ContractSignature,
    SigningCeremonyStatus,
} from '@/lib/signing'
import { formatHash } from '@/lib/signing'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface SigningPanelProps {
    status: SigningCeremonyStatus
    initiatorConfirmation: SigningConfirmation | null
    respondentConfirmation: SigningConfirmation | null
    initiatorSignature: ContractSignature | null
    respondentSignature: ContractSignature | null
    currentPartyRole: 'initiator' | 'respondent' | null
    contractDraftReady: boolean
    isContractCommitted: boolean
    onOpenEntityConfirmation: () => void
    onOpenSigningCeremony: () => void
    initiatorLabel?: string
    respondentLabel?: string
}

// ============================================================================
// SECTION 2: COMPONENT
// ============================================================================

export default function SigningPanel({
    status,
    initiatorConfirmation,
    respondentConfirmation,
    initiatorSignature,
    respondentSignature,
    currentPartyRole,
    contractDraftReady,
    isContractCommitted,
    onOpenEntityConfirmation,
    onOpenSigningCeremony,
    initiatorLabel = 'Initiator',
    respondentLabel = 'Respondent',
}: SigningPanelProps) {
    // Don't show unless the contract is committed
    if (!isContractCommitted) return null

    const isFullyExecuted = status === 'fully_executed'

    // Has the current user already confirmed / signed?
    const myConfirmation = currentPartyRole === 'initiator'
        ? initiatorConfirmation
        : respondentConfirmation
    const mySigned = currentPartyRole === 'initiator'
        ? initiatorSignature
        : respondentSignature

    // Determine border/background based on signing stage
    let containerClasses = 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
    if (isFullyExecuted) {
        containerClasses = 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-300'
    } else if (status === 'partially_signed' || status === 'awaiting_signatures') {
        containerClasses = 'bg-gradient-to-br from-violet-50/50 to-slate-50 border-violet-200'
    }

    return (
        <div className={`mx-4 mb-4 p-4 rounded-xl border-2 ${containerClasses}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isFullyExecuted ? 'bg-violet-100' : 'bg-slate-200'
                }`}>
                    {isFullyExecuted ? (
                        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1">
                    <h3 className={`font-semibold text-sm ${
                        isFullyExecuted ? 'text-violet-800' : 'text-slate-700'
                    }`}>
                        {isFullyExecuted ? 'Contract Executed' : 'Signing Ceremony'}
                    </h3>
                    <p className="text-xs text-slate-500">
                        {status === 'awaiting_confirmations' && 'Confirm entity details to begin'}
                        {status === 'awaiting_signatures' && 'Ready for signatures'}
                        {status === 'partially_signed' && 'Waiting for other party'}
                        {status === 'fully_executed' && 'All parties have signed'}
                    </p>
                </div>
            </div>

            {/* Progress Tracker */}
            <div className="mb-3">
                <SigningProgressTracker
                    initiatorConfirmation={initiatorConfirmation}
                    respondentConfirmation={respondentConfirmation}
                    initiatorSignature={initiatorSignature}
                    respondentSignature={respondentSignature}
                    initiatorLabel={initiatorLabel}
                    respondentLabel={respondentLabel}
                />
            </div>

            {/* Action Buttons — depends on current state and user's role */}
            {currentPartyRole && !isFullyExecuted && (
                <div className="mt-3">
                    {/* Phase 1: Entity confirmation needed */}
                    {!myConfirmation && (
                        <button
                            onClick={onOpenEntityConfirmation}
                            className={`w-full h-9 text-xs font-medium rounded-full transition flex items-center justify-center gap-2 ${
                                currentPartyRole === 'initiator'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Confirm Entity Details
                        </button>
                    )}

                    {/* Phase 1b: User confirmed, waiting for other party */}
                    {myConfirmation && status === 'awaiting_confirmations' && (
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="text-xs text-amber-700">
                                Waiting for other party to confirm
                            </span>
                        </div>
                    )}

                    {/* Phase 2: Both confirmed, ready to sign */}
                    {myConfirmation && !mySigned && (status === 'awaiting_signatures' || status === 'partially_signed') && (
                        <button
                            onClick={onOpenSigningCeremony}
                            disabled={!contractDraftReady}
                            className="w-full h-9 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-medium rounded-full transition flex items-center justify-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Sign Contract
                        </button>
                    )}

                    {/* Phase 2b: User signed, waiting for other party */}
                    {mySigned && !isFullyExecuted && (
                        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-xs text-emerald-700">
                                You have signed. Waiting for other party.
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Execution Summary */}
            {isFullyExecuted && initiatorSignature && respondentSignature && (
                <div className="mt-3 space-y-2">
                    {/* Initiator Signature */}
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-100">
                        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-700 truncate">
                                {initiatorSignature.signatory_name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                                {initiatorSignature.company_name} &middot;{' '}
                                {new Date(initiatorSignature.signed_at).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Respondent Signature */}
                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-100">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-700 truncate">
                                {respondentSignature.signatory_name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                                {respondentSignature.company_name} &middot;{' '}
                                {new Date(respondentSignature.signed_at).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Contract Hash */}
                    <div className="p-2 bg-slate-50 rounded-lg">
                        <div className="text-[10px] text-slate-400">Contract Hash (SHA-256)</div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                            {formatHash(initiatorSignature.contract_hash)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
