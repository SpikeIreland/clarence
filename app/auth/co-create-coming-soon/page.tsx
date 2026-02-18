'use client'

// ============================================================================
// CLARENCE Co-Create Coming Soon Page
// ============================================================================
// File: /app/auth/co-create-coming-soon/page.tsx
// Purpose: Placeholder page shown after Co-Create session creation
// Stage: CREATE (Emerald)
// 
// This page is temporary — it will be replaced by the Co-Create Studio
// once that workstream is built. For now, it confirms the session was
// created and provides navigation back to the dashboard.
// ============================================================================

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CreateProgressBar } from '@/app/components/create-phase/CreateProgressHeader'

// ============================================================================
// SECTION 1: INNER COMPONENT
// ============================================================================

function CoCreateComingSoonContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const sessionId = searchParams.get('session_id')
    const pathwayId = searchParams.get('pathway_id')

    // ========================================================================
    // SECTION 2: STATE & USER INFO
    // ========================================================================

    const [userFirstName, setUserFirstName] = useState<string>('there')

    useEffect(() => {
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) {
            router.push('/auth/login')
            return
        }
        try {
            const parsed = JSON.parse(authData)
            setUserFirstName(parsed.userInfo?.firstName || 'there')
        } catch {
            router.push('/auth/login')
        }
    }, [router])

    // ========================================================================
    // SECTION 3: RENDER
    // ========================================================================

    return (
        <div className="h-screen flex flex-col bg-slate-50">
            {/* Header */}
            <div className="h-14 bg-emerald-600 flex items-center px-6">
                <div className="flex items-center gap-3 text-white">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <span className="text-lg">C</span>
                    </div>
                    <div>
                        <h1 className="font-semibold">Co-Create</h1>
                        <p className="text-xs text-white/70">Built together, from the ground up</p>
                    </div>
                </div>
            </div>

            <CreateProgressBar currentStage="create_contract" />

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-lg w-full text-center">
                    {/* Icon */}
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
                        <span className="text-white text-5xl font-bold">C</span>
                    </div>

                    {/* Session Confirmation */}
                    {sessionId && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Session created successfully
                        </div>
                    )}

                    {/* Heading */}
                    <h2 className="text-3xl font-bold text-slate-800 mb-4">
                        The Co-Create Studio is coming soon
                    </h2>

                    {/* Description */}
                    <p className="text-slate-500 text-lg mb-8 leading-relaxed">
                        Hi {userFirstName} — your Co-Create session has been set up.
                        The collaborative studio where both parties work with CLARENCE to
                        build a contract from scratch is currently in development.
                    </p>

                    {/* What Co-Create Will Do */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 text-left">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-xs">C</span>
                            What the Co-Create Studio will include
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">&#10003;</span>
                                <p className="text-sm text-slate-600">
                                    <span className="font-medium text-slate-700">Clause Generation</span> —
                                    CLARENCE proposes a clause set based on contract type and deal context
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">&#10003;</span>
                                <p className="text-sm text-slate-600">
                                    <span className="font-medium text-slate-700">Collaborative Discussion</span> —
                                    Both parties can add, remove, and discuss clauses with CLARENCE facilitating
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">&#10003;</span>
                                <p className="text-sm text-slate-600">
                                    <span className="font-medium text-slate-700">Shared Position Setting</span> —
                                    Both parties set initial positions with CLARENCE providing market-norm guidance
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">&#10003;</span>
                                <p className="text-sm text-slate-600">
                                    <span className="font-medium text-slate-700">Seamless Transition</span> —
                                    Once clauses and positions are set, the session moves to the Contract Studio for formal negotiation
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Session Details (if available) */}
                    {sessionId && (
                        <div className="bg-slate-100 rounded-lg px-4 py-3 mb-8 inline-block">
                            <p className="text-xs text-slate-400">Session ID</p>
                            <p className="text-sm font-mono text-slate-600">{sessionId}</p>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex gap-4 justify-center">
                        <Link
                            href="/auth/contracts"
                            className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors font-medium"
                        >
                            &larr; Contract Library
                        </Link>
                        <Link
                            href="/auth/contracts-dashboard"
                            className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                        >
                            Go to Dashboard
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-white text-center">
                <p className="text-xs text-slate-400">
                    CLARENCE &middot; The Honest Broker &middot; Co-Create Studio coming soon
                </p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 4: LOADING FALLBACK & EXPORT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
}

export default function CoCreateComingSoon() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <CoCreateComingSoonContent />
        </Suspense>
    )
}