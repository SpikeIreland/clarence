// ============================================================================
// WORKFLOW HEADER COMPONENT
// Location: app/components/WorkflowHeader.tsx
// Purpose: Shared header for all authenticated workflow pages
// Shows stage indicator (Create/Negotiate/Agree) and page title
// 
// COLOR SCHEME:
// - Create: Emerald (fresh start, growth)
// - Negotiate: Amber (energy, active discussion)
// - Agree: Blue (trust, completion)
// ============================================================================

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

type WorkflowStage = 'create' | 'negotiate' | 'agree'

interface WorkflowHeaderProps {
    stage: WorkflowStage
    pageTitle: string
    showBackButton?: boolean
    backButtonHref?: string
    backButtonLabel?: string
}

// ============================================================================
// SECTION 2: STAGE CONFIGURATION
// ============================================================================

const stageConfig = {
    create: {
        label: 'Create',
        textColor: 'text-emerald-500',
        textColorLight: 'text-emerald-600',
        bgColor: 'bg-emerald-500',
        borderColor: 'border-emerald-500',
        lightBg: 'bg-emerald-50',
        hoverBg: 'hover:bg-emerald-600',
    },
    negotiate: {
        label: 'Negotiate',
        textColor: 'text-amber-500',
        textColorLight: 'text-amber-600',
        bgColor: 'bg-amber-500',
        borderColor: 'border-amber-500',
        lightBg: 'bg-amber-50',
        hoverBg: 'hover:bg-amber-600',
    },
    agree: {
        label: 'Agree',
        textColor: 'text-blue-500',
        textColorLight: 'text-blue-600',
        bgColor: 'bg-blue-500',
        borderColor: 'border-blue-500',
        lightBg: 'bg-blue-50',
        hoverBg: 'hover:bg-blue-600',
    },
}

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function WorkflowHeader({
    stage,
    pageTitle,
    showBackButton = false,
    backButtonHref = '/auth/contracts-dashboard',
    backButtonLabel = 'Back to Dashboard',
}: WorkflowHeaderProps) {
    const router = useRouter()
    const config = stageConfig[stage]

    return (
        <header className="bg-slate-800 border-b border-slate-700">
            <div className="container mx-auto px-6">
                {/* ================================================================ */}
                {/* SECTION 3.1: MAIN HEADER ROW */}
                {/* ================================================================ */}
                <div className="flex items-center justify-between h-16">

                    {/* ============================================================== */}
                    {/* LEFT: CLARENCE Brand + Stage Indicator */}
                    {/* ============================================================== */}
                    <div className="flex items-center gap-4">
                        {/* Back Button (optional) */}
                        {showBackButton && (
                            <Link
                                href={backButtonHref}
                                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors mr-2"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                                <span className="text-sm hidden sm:inline">{backButtonLabel}</span>
                            </Link>
                        )}

                        {/* CLARENCE Logo */}
                        <Link href="/auth/contracts-dashboard" className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold text-lg tracking-tight">
                                        CLARENCE
                                    </span>
                                    <span className={`font-semibold ${config.textColor}`}>
                                        {config.label}
                                    </span>
                                </div>
                                <span className="text-slate-400 text-xs hidden sm:block">
                                    The Honest Broker
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* ============================================================== */}
                    {/* CENTER: Page Title */}
                    {/* ============================================================== */}
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                        <h1 className="text-white font-semibold text-lg">
                            {pageTitle}
                        </h1>
                    </div>

                    {/* ============================================================== */}
                    {/* RIGHT: Stage Progress Indicator */}
                    {/* ============================================================== */}
                    <div className="flex items-center gap-2">
                        {/* Create dot */}
                        <div className="flex items-center gap-1">
                            <div
                                className={`w-2.5 h-2.5 rounded-full ${stage === 'create' ? 'bg-emerald-500' : 'bg-slate-600'
                                    }`}
                            />
                            <span className={`text-xs hidden md:inline ${stage === 'create' ? 'text-emerald-500' : 'text-slate-500'
                                }`}>
                                Create
                            </span>
                        </div>

                        {/* Connector */}
                        <div className="w-4 h-px bg-slate-600 hidden md:block" />

                        {/* Negotiate dot */}
                        <div className="flex items-center gap-1">
                            <div
                                className={`w-2.5 h-2.5 rounded-full ${stage === 'negotiate' ? 'bg-amber-500' : 'bg-slate-600'
                                    }`}
                            />
                            <span className={`text-xs hidden md:inline ${stage === 'negotiate' ? 'text-amber-500' : 'text-slate-500'
                                }`}>
                                Negotiate
                            </span>
                        </div>

                        {/* Connector */}
                        <div className="w-4 h-px bg-slate-600 hidden md:block" />

                        {/* Agree dot */}
                        <div className="flex items-center gap-1">
                            <div
                                className={`w-2.5 h-2.5 rounded-full ${stage === 'agree' ? 'bg-blue-500' : 'bg-slate-600'
                                    }`}
                            />
                            <span className={`text-xs hidden md:inline ${stage === 'agree' ? 'text-blue-500' : 'text-slate-500'
                                }`}>
                                Agree
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}