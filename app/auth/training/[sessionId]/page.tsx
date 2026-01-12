'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    companyId?: string
    role?: string
    userId?: string
}

interface TrainingSessionData {
    sessionId: string
    sessionNumber: string
    scenarioName: string
    counterpartyType: 'ai' | 'partner'
    counterpartyName: string
    aiMode?: 'cooperative' | 'balanced' | 'aggressive'
    status: string
    createdAt: string
}

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function TrainingSessionPage() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()

    const sessionId = params?.sessionId as string

    // =========================================================================
    // SECTION 4: STATE DECLARATIONS
    // =========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [sessionData, setSessionData] = useState<TrainingSessionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // =========================================================================
    // SECTION 5: DATA LOADING
    // =========================================================================

    const loadData = useCallback(async () => {
        try {
            // Load user info
            const auth = localStorage.getItem('clarence_auth')
            if (!auth) {
                router.push('/auth/login')
                return
            }

            const authData = JSON.parse(auth)
            setUserInfo(authData.userInfo)

            // Load session data
            if (sessionId) {
                const { data: session, error: sessionError } = await supabase
                    .from('sessions')
                    .select('*')
                    .eq('session_id', sessionId)
                    .eq('is_training', true)
                    .single()

                if (sessionError) {
                    console.error('Error loading session:', sessionError)
                    setError('Training session not found')
                } else if (session) {
                    setSessionData({
                        sessionId: session.session_id,
                        sessionNumber: session.session_number || 'TRN-000',
                        scenarioName: session.scenario_name || 'Training Session',
                        counterpartyType: session.counterparty_type || 'ai',
                        counterpartyName: session.counterparty_name || 'CLARENCE AI',
                        aiMode: session.ai_mode,
                        status: session.status || 'active',
                        createdAt: session.created_at
                    })
                }
            }
        } catch (err) {
            console.error('Error loading data:', err)
            setError('Failed to load training session')
        } finally {
            setLoading(false)
        }
    }, [sessionId, router, supabase])

    useEffect(() => {
        loadData()
    }, [loadData])

    // =========================================================================
    // SECTION 6: LOADING STATE
    // =========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-amber-50/30 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading training session...</p>
                </div>
            </div>
        )
    }

    // =========================================================================
    // SECTION 7: ERROR STATE
    // =========================================================================

    if (error) {
        return (
            <div className="min-h-screen bg-amber-50/30 flex items-center justify-center">
                <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center shadow-lg">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Session Not Found</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <Link
                        href="/auth/training"
                        className="inline-block bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        Back to Training Studio
                    </Link>
                </div>
            </div>
        )
    }

    // =========================================================================
    // SECTION 8: RENDER
    // =========================================================================

    return (
        <div className="min-h-screen bg-amber-50/30">
            {/* ================================================================ */}
            {/* SECTION 9: TRAINING MODE BANNER */}
            {/* ================================================================ */}
            <div className="bg-amber-500 text-white py-2 px-4">
                <div className="container mx-auto flex items-center justify-center gap-2 text-sm font-medium">
                    <span>🎓</span>
                    <span>TRAINING MODE - This session is for practice only. Outcomes are non-binding.</span>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 10: NAVIGATION HEADER */}
            {/* ================================================================ */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo & Brand */}
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-amber-400">Training Mode</div>
                            </div>
                        </Link>

                        {/* Session Info */}
                        <div className="text-center">
                            <div className="text-sm font-medium">{sessionData?.scenarioName}</div>
                            <div className="text-xs text-slate-400">{sessionData?.sessionNumber}</div>
                        </div>

                        {/* Exit Button */}
                        <Link
                            href="/auth/training"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Exit Training
                        </Link>
                    </nav>
                </div>
            </header>

            {/* ================================================================ */}
            {/* SECTION 11: PLACEHOLDER CONTENT */}
            {/* ================================================================ */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-4xl">🎓</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">{sessionData?.scenarioName}</h1>
                                <p className="text-amber-100 mt-1">
                                    {sessionData?.counterpartyType === 'ai'
                                        ? `Training with CLARENCE AI (${sessionData?.aiMode} mode)`
                                        : `Training with ${sessionData?.counterpartyName}`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {/* Session Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-slate-50 rounded-lg p-4 text-center">
                                <div className="text-2xl mb-1">📋</div>
                                <div className="text-xs text-slate-500">Session</div>
                                <div className="font-semibold text-slate-800">{sessionData?.sessionNumber}</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 text-center">
                                <div className="text-2xl mb-1">
                                    {sessionData?.counterpartyType === 'ai' ? '🤖' : '👥'}
                                </div>
                                <div className="text-xs text-slate-500">Opponent</div>
                                <div className="font-semibold text-slate-800">
                                    {sessionData?.counterpartyType === 'ai' ? 'AI' : 'Partner'}
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 text-center">
                                <div className="text-2xl mb-1">
                                    {sessionData?.aiMode === 'cooperative' ? '😊' :
                                        sessionData?.aiMode === 'balanced' ? '🤝' : '😤'}
                                </div>
                                <div className="text-xs text-slate-500">Difficulty</div>
                                <div className="font-semibold text-slate-800 capitalize">
                                    {sessionData?.aiMode || 'N/A'}
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 text-center">
                                <div className="text-2xl mb-1">⏱️</div>
                                <div className="text-xs text-slate-500">Status</div>
                                <div className="font-semibold text-slate-800 capitalize">{sessionData?.status}</div>
                            </div>
                        </div>

                        {/* Coming Soon Message */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-4xl">🚧</span>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">
                                Training Interface Coming Soon
                            </h2>
                            <p className="text-slate-600 max-w-md mx-auto mb-6">
                                The full training negotiation interface is being built.
                                Soon you'll be able to practice clause negotiations with CLARENCE
                                as your AI counterparty, complete with teaching moments and progress tracking.
                            </p>

                            {/* What's Coming */}
                            <div className="bg-white rounded-lg p-6 max-w-md mx-auto text-left">
                                <h3 className="font-semibold text-slate-700 mb-3">What's Coming:</h3>
                                <ul className="space-y-2 text-sm text-slate-600">
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-500">✦</span>
                                        Full clause negotiation interface
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-500">✦</span>
                                        AI counterparty with adjustable difficulty
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-500">✦</span>
                                        Real-time teaching moments and tips
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-500">✦</span>
                                        Performance scoring and feedback
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-500">✦</span>
                                        Progress tracking and achievements
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-center gap-4 mt-8">
                            <Link
                                href="/auth/training"
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                Back to Training Studio
                            </Link>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                            >
                                Refresh Session
                            </button>
                        </div>
                    </div>
                </div>

                {/* Debug Info (can be removed later) */}
                <div className="mt-8 bg-slate-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">Session Debug Info:</h3>
                    <pre className="text-xs text-slate-500 overflow-auto">
                        {JSON.stringify({ sessionId, sessionData }, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    )
}