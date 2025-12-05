'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

// ============================================================================
// SECTION 1: HERO CTA COMPONENT
// ============================================================================

export default function HeroCTA() {
    // ========================================================================
    // SECTION 1A: STATE
    // ========================================================================
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<'customer' | 'provider' | null>(null)

    const supabase = createClientComponentClient()

    // ========================================================================
    // SECTION 1B: AUTH CHECK ON MOUNT
    // ========================================================================
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    setIsAuthenticated(true)

                    const authData = localStorage.getItem('clarence_auth')
                    if (authData) {
                        try {
                            const parsed = JSON.parse(authData)
                            setUserRole(parsed.userInfo?.role || 'customer')
                        } catch {
                            setUserRole('customer')
                        }
                    } else {
                        setUserRole('customer')
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error)
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [supabase.auth])

    // ========================================================================
    // SECTION 1C: GET DASHBOARD URL
    // ========================================================================
    const getDashboardUrl = (): string => {
        if (userRole === 'provider') {
            return '/provider'
        }
        return '/auth/contracts-dashboard'
    }

    // ========================================================================
    // SECTION 1D: RENDER LOADING STATE
    // ========================================================================
    if (isLoading) {
        return (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                    href="/auth/login"
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
                >
                    Start Your Negotiation
                </Link>
                <Link
                    href="/how-it-works"
                    className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-all hover:border-slate-400"
                >
                    See How It Works
                </Link>
            </div>
        )
    }

    // ========================================================================
    // SECTION 1E: RENDER AUTHENTICATED STATE
    // ========================================================================
    if (isAuthenticated) {
        return (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                    href={getDashboardUrl()}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                    Go to Your Dashboard
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
                <Link
                    href="/how-it-works"
                    className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-all hover:border-slate-400"
                >
                    See How It Works
                </Link>
            </div>
        )
    }

    // ========================================================================
    // SECTION 1F: RENDER UNAUTHENTICATED STATE
    // ========================================================================
    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
                href="/auth/login"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
            >
                Start Your Negotiation
            </Link>
            <Link
                href="/how-it-works"
                className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-all hover:border-slate-400"
            >
                See How It Works
            </Link>
        </div>
    )
}