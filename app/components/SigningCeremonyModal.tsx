'use client'

// ============================================================================
// SIGNING CEREMONY MODAL
// Location: app/components/SigningCeremonyModal.tsx
//
// Step 3 of the signing ceremony. The formal signing event.
// Displays both parties' confirmed entity details, the contract hash,
// consent statement, and the Sign button.
// ============================================================================

import type { SigningConfirmation } from '@/lib/signing'
import { formatHash, generateConsentText } from '@/lib/signing'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface SigningCeremonyModalProps {
    show: boolean
    onClose: () => void
    onSign: () => void
    isSigning: boolean
    isComputingHash: boolean
    contractHash: string | null
    contractName: string
    currentPartyRole: 'initiator' | 'respondent'
    initiatorConfirmation: SigningConfirmation | null
    respondentConfirmation: SigningConfirmation | null
}

// ============================================================================
// SECTION 2: ENTITY CARD SUB-COMPONENT
// ============================================================================

function EntityCard({
    confirmation,
    roleLabel,
    accentColor,
}: {
    confirmation: SigningConfirmation
    roleLabel: string
    accentColor: 'emerald' | 'blue'
}) {
    const bgClass = accentColor === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'
    const badgeClass = accentColor === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'

    return (
        <div className={`rounded-lg border p-3 ${bgClass}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                    {roleLabel}
                </span>
            </div>
            <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-800">
                    {confirmation.entity_name}
                </div>
                {confirmation.registration_number && (
                    <div className="text-xs text-slate-500">
                        Reg: {confirmation.registration_number}
                    </div>
                )}
                {confirmation.jurisdiction && (
                    <div className="text-xs text-slate-500">
                        {confirmation.jurisdiction}
                    </div>
                )}
                <div className="text-xs text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200/60">
                    <span className="font-medium">{confirmation.signatory_name}</span>
                    {' '}
                    <span className="text-slate-400">{confirmation.signatory_title}</span>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function SigningCeremonyModal({
    show,
    onClose,
    onSign,
    isSigning,
    isComputingHash,
    contractHash,
    contractName,
    currentPartyRole,
    initiatorConfirmation,
    respondentConfirmation,
}: SigningCeremonyModalProps) {
    if (!show) return null

    // The current party's confirmation provides signatory details for consent text
    const myConfirmation = currentPartyRole === 'initiator'
        ? initiatorConfirmation
        : respondentConfirmation

    const consentText = myConfirmation && contractHash
        ? generateConsentText(
            myConfirmation.signatory_name,
            myConfirmation.signatory_title,
            myConfirmation.entity_name,
            contractHash
        )
        : ''

    const shortHash = contractHash ? formatHash(contractHash) : 'Computing...'

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Signing Ceremony</h2>
                            <p className="text-sm text-slate-500">{contractName}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Parties */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Contracting Parties</h3>
                        <div className="space-y-2">
                            {initiatorConfirmation && (
                                <EntityCard
                                    confirmation={initiatorConfirmation}
                                    roleLabel="Initiator"
                                    accentColor="emerald"
                                />
                            )}
                            {respondentConfirmation && (
                                <EntityCard
                                    confirmation={respondentConfirmation}
                                    roleLabel="Respondent"
                                    accentColor="blue"
                                />
                            )}
                        </div>
                    </div>

                    {/* Contract Hash */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Contract Fingerprint</h3>
                        <div className="bg-slate-800 rounded-lg p-3">
                            {isComputingHash ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm text-slate-300">Computing SHA-256 hash...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="text-xs text-slate-400 mb-1">SHA-256</div>
                                    <div className="text-sm font-mono text-emerald-400 break-all">{contractHash}</div>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            This hash uniquely identifies the Contract Draft. Any modification would produce a different hash.
                        </p>
                    </div>

                    {/* Consent Statement */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Consent Statement</h3>
                        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                            {myConfirmation && contractHash ? (
                                <p className="text-sm text-violet-900 leading-relaxed">
                                    I, <strong>{myConfirmation.signatory_name}</strong>,{' '}
                                    <strong>{myConfirmation.signatory_title}</strong> of{' '}
                                    <strong>{myConfirmation.entity_name}</strong>, confirm that I have
                                    reviewed the contract (SHA-256:{' '}
                                    <span className="font-mono text-xs">{shortHash}</span>) and agree
                                    to be bound by its terms. I understand this constitutes a legally
                                    binding agreement.
                                </p>
                            ) : (
                                <p className="text-sm text-violet-600">Loading consent details...</p>
                            )}
                        </div>
                    </div>

                    {/* Audit Notice */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                        <p className="font-medium text-slate-600 mb-1">This action will be recorded:</p>
                        <p>
                            Your signature, timestamp, IP address, and browser details will be
                            stored as part of the legally auditable signing record.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="h-9 px-4 text-slate-600 hover:bg-slate-100 text-xs font-medium rounded-full transition"
                        disabled={isSigning}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSign}
                        disabled={isSigning || isComputingHash || !contractHash || !myConfirmation}
                        className="h-9 px-6 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-medium rounded-full transition flex items-center gap-2"
                    >
                        {isSigning ? (
                            <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Signing...
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Confirm &amp; Sign
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
