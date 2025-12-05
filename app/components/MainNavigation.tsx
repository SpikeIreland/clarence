'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface UserAuthState {
    isAuthenticated: boolean
    isLoading: boolean
    userRole: 'customer' | 'provider' | null
    userName: string | null
}

// ============================================================================
// SECTION 2: MAIN NAVIGATION COMPONENT
// ============================================================================

export default function MainNavigation() {
    // ========================================================================
    // SECTION 2A: STATE
    // ========================================================================
    const [authState, setAuthState] = useState<UserAuthState>({
        isAuthenticated: false,
        isLoading: true,
        userRole: null,
        userName: null
    })

    const supabase = createClientComponentClient()

    // ========================================================================
    // SECTION 2B: AUTH CHECK ON MOUNT
    // ========================================================================
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    const authData = localStorage.getItem('clarence_auth')
                    let role: 'customer' | 'provider' = 'customer'
                    let userName: string | null = null

                    if (authData) {
                        try {
                            const parsed = JSON.parse(authData)
                            role = parsed.userInfo?.role || 'customer'
                            userName = parsed.userInfo?.firstName || null
                        } catch {
                            // Use default role
                        }
                    }

                    if (!role) {
                        role = (session.user.user_metadata?.user_type as 'customer' | 'provider') || 'customer'
                    }

                    setAuthState({
                        isAuthenticated: true,
                        isLoading: false,
                        userRole: role,
                        userName: userName
                    })
                } else {
                    setAuthState({
                        isAuthenticated: false,
                        isLoading: false,
                        userRole: null,
                        userName: null
                    })
                }
            } catch (error) {
                console.error('Auth check error:', error)
                setAuthState({
                    isAuthenticated: false,
                    isLoading: false,
                    userRole: null,
                    userName: null
                })
            }
        }

        checkAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const authData = localStorage.getItem('clarence_auth')
                let role: 'customer' | 'provider' = 'customer'

                if (authData) {
                    try {
                        const parsed = JSON.parse(authData)
                        role = parsed.userInfo?.role || 'customer'
                    } catch {
                        // Use default
                    }
                }

                setAuthState({
                    isAuthenticated: true,
                    isLoading: false,
                    userRole: role,
                    userName: null
                })
            } else {
                setAuthState({
                    isAuthenticated: false,
                    isLoading: false,
                    userRole: null,
                    userName: null
                })
            }
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    // ========================================================================
    // SECTION 2C: GET DASHBOARD URL BASED ON ROLE
    // ========================================================================
    const getDashboardUrl = (): string => {
        if (authState.userRole === 'provider') {
            return '/provider'
        }
        return '/auth/contracts-dashboard'
    }

    // ========================================================================
    // SECTION 2D: RENDER AUTH BUTTONS
    // ========================================================================
    const renderAuthButtons = () => {
        if (authState.isLoading) {
            return (
                <div className="px-4 py-2 bg-slate-700 text-slate-400 text-sm font-medium rounded-lg">
                    <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )
        }

        if (authState.isAuthenticated) {
            return (
                <>
                    {authState.userName && (
                        <span className="text-slate-300 text-sm">
                            Welcome, {authState.userName}
                        </span>
                    )}
                    <Link
                        href={getDashboardUrl()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        Go to Dashboard
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </>
            )
        }

        return (
            <>
                <Link
                    href="/auth/login"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    Customer Sign In
                </Link>
                <Link
                    href="https://www.clarencelegal.ai/provider"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    Provider Sign In
                </Link>
            </>
        )
    }

    // ========================================================================
    // SECTION 2E: MAIN RENDER
    // ========================================================================
    return (
        <header className="bg-slate-800 text-white">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    {/* Logo & Brand */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">The Honest Broker</div>
                        </div>
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex items-center gap-6">
                        <Link
                            href="/how-it-works"
                            className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                        >
                            How It Works
                        </Link>
                        <Link
                            href="/phases"
                            className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                        >
                            The 6 Phases
                        </Link>

                        {/* Auth-Aware Buttons */}
                        <div className="flex items-center gap-3 ml-2">
                            {renderAuthButtons()}
                        </div>
                    </div>
                </nav>
            </div>
        </header>
    )
}