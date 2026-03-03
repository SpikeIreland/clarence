'use client'

// ============================================================================
// SIGNING PROGRESS TRACKER
// Location: app/components/SigningProgressTracker.tsx
//
// Visual 4-step indicator showing the signing journey progress.
// Uses emerald (initiator) and blue (respondent) colour coding.
// Violet for the execution/completion stage.
// ============================================================================

import type { SigningConfirmation, ContractSignature } from '@/lib/signing'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface SigningProgressTrackerProps {
    initiatorConfirmation: SigningConfirmation | null
    respondentConfirmation: SigningConfirmation | null
    initiatorSignature: ContractSignature | null
    respondentSignature: ContractSignature | null
    initiatorLabel?: string
    respondentLabel?: string
}

// ============================================================================
// SECTION 2: STEP COMPONENT
// ============================================================================

interface StepProps {
    label: string
    sublabel: string
    isComplete: boolean
    isActive: boolean
    accentColor: 'emerald' | 'blue' | 'violet'
    timestamp?: string | null
}

function Step({ label, sublabel, isComplete, isActive, accentColor, timestamp }: StepProps) {
    const bgMap = {
        emerald: isComplete ? 'bg-emerald-500' : isActive ? 'bg-emerald-100 border-2 border-emerald-400' : 'bg-slate-100 border-2 border-slate-200',
        blue: isComplete ? 'bg-blue-500' : isActive ? 'bg-blue-100 border-2 border-blue-400' : 'bg-slate-100 border-2 border-slate-200',
        violet: isComplete ? 'bg-violet-500' : isActive ? 'bg-violet-100 border-2 border-violet-400' : 'bg-slate-100 border-2 border-slate-200',
    }

    const textMap = {
        emerald: isComplete ? 'text-emerald-700' : isActive ? 'text-emerald-600' : 'text-slate-400',
        blue: isComplete ? 'text-blue-700' : isActive ? 'text-blue-600' : 'text-slate-400',
        violet: isComplete ? 'text-violet-700' : isActive ? 'text-violet-600' : 'text-slate-400',
    }

    return (
        <div className="flex flex-col items-center text-center min-w-0 flex-1">
            {/* Circle */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${bgMap[accentColor]}`}>
                {isComplete ? (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                ) : isActive ? (
                    <div className={`w-2.5 h-2.5 rounded-full ${
                        accentColor === 'emerald' ? 'bg-emerald-500' :
                        accentColor === 'blue' ? 'bg-blue-500' : 'bg-violet-500'
                    }`} />
                ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                )}
            </div>

            {/* Labels */}
            <div className="mt-1.5">
                <div className={`text-xs font-medium leading-tight ${textMap[accentColor]}`}>
                    {label}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {sublabel}
                </div>
                {isComplete && timestamp && (
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        {new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 3: CONNECTOR LINE
// ============================================================================

function Connector({ isComplete }: { isComplete: boolean }) {
    return (
        <div className="flex items-center pt-0 mt-3 flex-shrink-0" style={{ width: '24px' }}>
            <div className={`h-0.5 w-full ${isComplete ? 'bg-emerald-300' : 'bg-slate-200'}`} />
        </div>
    )
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function SigningProgressTracker({
    initiatorConfirmation,
    respondentConfirmation,
    initiatorSignature,
    respondentSignature,
    initiatorLabel = 'Initiator',
    respondentLabel = 'Respondent',
}: SigningProgressTrackerProps) {
    const bothConfirmed = !!initiatorConfirmation && !!respondentConfirmation
    const bothSigned = !!initiatorSignature && !!respondentSignature

    return (
        <div className="flex items-start justify-between px-1">
            {/* Step 1: Initiator Confirmed */}
            <Step
                label="Confirmed"
                sublabel={initiatorLabel}
                isComplete={!!initiatorConfirmation}
                isActive={!initiatorConfirmation}
                accentColor="emerald"
                timestamp={initiatorConfirmation?.confirmed_at}
            />

            <Connector isComplete={!!initiatorConfirmation && !!respondentConfirmation} />

            {/* Step 2: Respondent Confirmed */}
            <Step
                label="Confirmed"
                sublabel={respondentLabel}
                isComplete={!!respondentConfirmation}
                isActive={!!initiatorConfirmation && !respondentConfirmation}
                accentColor="blue"
                timestamp={respondentConfirmation?.confirmed_at}
            />

            <Connector isComplete={bothConfirmed && (!!initiatorSignature || !!respondentSignature)} />

            {/* Step 3: Initiator Signed */}
            <Step
                label="Signed"
                sublabel={initiatorLabel}
                isComplete={!!initiatorSignature}
                isActive={bothConfirmed && !initiatorSignature}
                accentColor="emerald"
                timestamp={initiatorSignature?.signed_at}
            />

            <Connector isComplete={bothSigned} />

            {/* Step 4: Respondent Signed */}
            <Step
                label="Signed"
                sublabel={respondentLabel}
                isComplete={!!respondentSignature}
                isActive={bothConfirmed && !respondentSignature}
                accentColor="blue"
                timestamp={respondentSignature?.signed_at}
            />
        </div>
    )
}
