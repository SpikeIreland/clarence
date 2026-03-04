'use client'

// ============================================================================
// SECTION 1: FILE HEADER
// ============================================================================
// CLARENCE Create Gateway Page
// Path: /app/auth/create/page.tsx
// Purpose: Primary entry point for contract creation. Users choose their
//          pathway here, which routes them to the appropriate dashboard.
// Stage: CREATE (Emerald)
// FA-26: New page — replaces "Dashboard" and "Quick Contracts" as nav entry
//
// ARCHITECTURE:
//   This is a lightweight gateway page, NOT a full dashboard.
//   Each pathway card links to its own dedicated dashboard:
//     - Quick Create    → /auth/quick-contract (existing QC Dashboard)
//     - Contract Create → /auth/contracts-dashboard (existing Contracts Dashboard)
//     - Co-Create       → /auth/create-contract?pathway=co_create
//
// AUTH PATTERN:
//   Uses localStorage('clarence_auth') — matching QC Dashboard, Contract
//   Studio, and all other authenticated pages in the system.
//
// FUTURE:
//   - Pathway-specific "New Contract" buttons that pre-select the pathway
//   - Tendering section within Contract Create
// ============================================================================

// ============================================================================
// SECTION 2: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'

// ============================================================================
// SECTION 3: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: string
    userId?: string
}

interface PathwaySummary {
    quickCreate: { active: number; completed: number }
    contractCreate: { active: number; completed: number }
    coCreate: { active: number; completed: number }
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function CreateGatewayPage() {
    const router = useRouter()
    const supabase = createClient()
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [pathwaySummary, setPathwaySummary] = useState<PathwaySummary>({
        quickCreate: { active: 0, completed: 0 },
        contractCreate: { active: 0, completed: 0 },
        coCreate: { active: 0, completed: 0 },
    })

    // ==========================================================================
    // SECTION 5: AUTHENTICATION — localStorage PATTERN
    // Matches QC Dashboard, Contract Studio, and all other authenticated pages.
    // User data is stored in localStorage at login time by the login page.
    // ==========================================================================

    const loadUserInfo = useCallback((): UserInfo | null => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return null
        }

        try {
            const authData = JSON.parse(auth)
            const info = authData.userInfo || authData
            setUserInfo(info)
            return info
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    // ==========================================================================
    // SECTION 6: PATHWAY SUMMARY DATA
    // Quick Create   → counted from quick_contracts table (created_by_user_id)
    // Contract Create → counted from sessions table (customer_user_id, non-training)
    // Co-Create      → counted from sessions table (customer_user_id, non-training, co_create)
    // ==========================================================================

    const loadPathwaySummary = useCallback(async (userId: string) => {
        try {
            const summary: PathwaySummary = {
                quickCreate: { active: 0, completed: 0 },
                contractCreate: { active: 0, completed: 0 },
                coCreate: { active: 0, completed: 0 },
            }

            // --- Quick Create: from quick_contracts table ---
            const { data: qcData } = await supabase
                .from('quick_contracts')
                .select('quick_contract_id, status')
                .eq('created_by_user_id', userId)

            if (qcData) {
                qcData.forEach((qc: any) => {
                    const isCompleted = qc.status === 'accepted' || qc.status === 'completed'
                    if (isCompleted) {
                        summary.quickCreate.completed++
                    } else {
                        summary.quickCreate.active++
                    }
                })
            }

            // --- Contract Create: from sessions table ---
            // Includes both new values (contract_create) and legacy (partial_mediation, full_mediation)
            const { data: sessionsData } = await supabase
                .from('sessions')
                .select('session_id, mediation_type, status, is_training')
                .eq('customer_user_id', userId)
                .eq('is_training', false)
                .in('mediation_type', ['contract_create', 'partial_mediation', 'full_mediation'])

            if (sessionsData) {
                sessionsData.forEach((s: any) => {
                    const isCompleted = s.status === 'completed'
                    if (isCompleted) {
                        summary.contractCreate.completed++
                    } else {
                        summary.contractCreate.active++
                    }
                })
            }

            // --- Co-Create: from sessions table ---
            const { data: coCreateData } = await supabase
                .from('sessions')
                .select('session_id, mediation_type, status, is_training')
                .eq('customer_user_id', userId)
                .eq('is_training', false)
                .eq('mediation_type', 'co_create')

            if (coCreateData) {
                coCreateData.forEach((s: any) => {
                    const isCompleted = s.status === 'completed'
                    if (isCompleted) {
                        summary.coCreate.completed++
                    } else {
                        summary.coCreate.active++
                    }
                })
            }

            setPathwaySummary(summary)
        } catch (err) {
            console.error('Error loading pathway summary:', err)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 7: EFFECTS
    // ==========================================================================

    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (user?.userId) {
                await loadPathwaySummary(user.userId)
            }
            setLoading(false)
        }
        init()
    }, [loadUserInfo, loadPathwaySummary])

    // ==========================================================================
    // SECTION 8: SIGN OUT HANDLER
    // ==========================================================================

    const handleSignOut = async () => {
        localStorage.removeItem('clarence_auth')
        await supabase.auth.signOut()
        router.push('/')
    }

    // ==========================================================================
    // SECTION 9: RENDER — LOADING STATE
    // ==========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-600">Loading...</p>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 10: RENDER — MAIN PAGE
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 11: NAVIGATION HEADER */}
            {/* FeedbackButton is inside AuthenticatedHeader — not duplicated here */}
            {/* ================================================================== */}
            <AuthenticatedHeader
                activePage="create"
                userInfo={userInfo}
                onSignOut={handleSignOut}
            />

            {/* ================================================================== */}
            {/* SECTION 12: PAGE HEADER */}
            {/* No FeedbackButton here — already in AuthenticatedHeader */}
            {/* ================================================================== */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">
                            Create
                        </h1>
                        <p className="text-slate-500">
                            Choose how you want to build your contract. Each pathway follows the same
                            principled framework—adapted to your needs.
                        </p>
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* SECTION 13: PATHWAY CARDS */}
            {/* Three visually distinctive cards — the primary navigation choice */}
            {/* ================================================================== */}
            <main className="max-w-6xl mx-auto px-6 py-10">

                <div className="grid md:grid-cols-3 gap-8">

                    {/* ============================================================ */}
                    {/* SECTION 13A: QUICK CREATE CARD */}
                    {/* Links to existing QC Dashboard at /auth/quick-contract */}
                    {/* ============================================================ */}
                    <Link
                        href="/auth/quick-contract"
                        className="group block bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-400 p-8 transition-all hover:shadow-xl hover:shadow-emerald-500/10 relative overflow-hidden"
                    >
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>

                        {/* Icon */}
                        <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>

                        {/* Title & Tagline */}
                        <h2 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">
                            Quick Create
                        </h2>
                        <p className="text-sm text-emerald-600 font-medium mb-4">
                            Standard contracts, fast.
                        </p>

                        {/* Description */}
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            Upload or select a template. CLARENCE auto-configures clause ranges
                            and positions. Review, adjust, invite, and agree—all in one streamlined workspace.
                        </p>

                        {/* Stats */}
                        <div className="flex gap-4 mb-6">
                            <div className="bg-emerald-50 rounded-lg px-3 py-2 flex-1 text-center">
                                <div className="text-lg font-bold text-emerald-700">{pathwaySummary.quickCreate.active}</div>
                                <div className="text-xs text-emerald-600">Active</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 flex-1 text-center">
                                <div className="text-lg font-bold text-slate-600">{pathwaySummary.quickCreate.completed}</div>
                                <div className="text-xs text-slate-500">Completed</div>
                            </div>
                        </div>

                        {/* Best for */}
                        <div className="text-xs text-slate-500 mb-4">
                            <span className="font-semibold text-slate-600">Best for:</span> NDAs, renewals,
                            standard service agreements, routine contracts at volume
                        </div>

                        {/* CTA */}
                        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm group-hover:gap-3 transition-all">
                            Open Quick Create
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>

                    {/* ============================================================ */}
                    {/* SECTION 13B: CONTRACT CREATE CARD */}
                    {/* Links to existing Contracts Dashboard */}
                    {/* ============================================================ */}
                    <Link
                        href="/auth/contracts-dashboard"
                        className="group block bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-400 p-8 transition-all hover:shadow-xl hover:shadow-slate-500/10 relative overflow-hidden"
                    >
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-600 to-slate-800"></div>

                        {/* Icon */}
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-7 h-7 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>

                        {/* Title & Tagline */}
                        <h2 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 transition-colors">
                            Contract Create
                        </h2>
                        <p className="text-sm text-slate-500 font-medium mb-4">
                            Your contract, professionally mediated.
                        </p>

                        {/* Description */}
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            Bring your own contract template, complete strategic assessment and
                            invite the other party. Full leverage analysis, three-position
                            negotiation, and clause-by-clause mediation.
                        </p>

                        {/* Stats */}
                        <div className="flex gap-4 mb-6">
                            <div className="bg-slate-100 rounded-lg px-3 py-2 flex-1 text-center">
                                <div className="text-lg font-bold text-slate-700">{pathwaySummary.contractCreate.active}</div>
                                <div className="text-xs text-slate-600">Active</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 flex-1 text-center">
                                <div className="text-lg font-bold text-slate-500">{pathwaySummary.contractCreate.completed}</div>
                                <div className="text-xs text-slate-500">Completed</div>
                            </div>
                        </div>

                        {/* Best for */}
                        <div className="text-xs text-slate-500 mb-4">
                            <span className="font-semibold text-slate-600">Best for:</span> Procurement,
                            legal teams, enterprise contracts requiring structured negotiation
                        </div>

                        {/* CTA */}
                        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm group-hover:gap-3 transition-all">
                            Open Contract Create
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>

                    {/* ============================================================ */}
                    {/* SECTION 13C: CO-CREATE CARD */}
                    {/* Links to create-contract with co_create pathway */}
                    {/* ============================================================ */}
                    <Link
                        href="/auth/create-contract?pathway=co_create"
                        className="group block bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-400 p-8 transition-all hover:shadow-xl hover:shadow-violet-500/10 relative overflow-hidden"
                    >
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-400 to-violet-600"></div>

                        {/* Icon */}
                        <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                            <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>

                        {/* Title & Tagline */}
                        <h2 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-violet-700 transition-colors">
                            Co-Create
                        </h2>
                        <p className="text-sm text-violet-500 font-medium mb-4">
                            Built together, from the ground up.
                        </p>

                        {/* Description */}
                        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                            No starting document from either side. CLARENCE generates the clause
                            set and both parties shape the agreement collaboratively from
                            inception. The fullest expression of the Honest Broker.
                        </p>

                        {/* Stats */}
                        <div className="flex gap-4 mb-6">
                            <div className="bg-violet-50 rounded-lg px-3 py-2 flex-1 text-center">
                                <div className="text-lg font-bold text-violet-700">{pathwaySummary.coCreate.active}</div>
                                <div className="text-xs text-violet-600">Active</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 flex-1 text-center">
                                <div className="text-lg font-bold text-slate-600">{pathwaySummary.coCreate.completed}</div>
                                <div className="text-xs text-slate-500">Completed</div>
                            </div>
                        </div>

                        {/* Best for */}
                        <div className="text-xs text-slate-500 mb-4">
                            <span className="font-semibold text-slate-600">Best for:</span> New
                            partnerships, equal-leverage deals, parties who want neutral ground
                        </div>

                        {/* CTA */}
                        <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
                            Start Co-Create
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>

                </div>

                {/* ================================================================ */}
                {/* SECTION 14: QUICK ACTIONS BAR */}
                {/* Convenient shortcuts below the pathway cards */}
                {/* ================================================================ */}
                <div className="mt-10 bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Quick Actions
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/auth/create-contract?pathway=quick_create"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors border border-emerald-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Quick Create
                        </Link>
                        <Link
                            href="/auth/create-contract?pathway=contract_create"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Contract Create
                        </Link>
                        <Link
                            href="/auth/contracts"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Template Library
                        </Link>
                    </div>
                </div>

            </main>
        </div>
    )
}