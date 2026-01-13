'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// ============================================================================
// SECTION 1: HERO CTA COMPONENT
// Purpose: Auth-aware CTA buttons for the hero section
// Location: app/components/HeroCTA.tsx
// ============================================================================

export default function HeroCTA() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // ========================================================================
    // SECTION 2: AUTH CHECK
    // ========================================================================

    useEffect(() => {
        const checkAuth = () => {
            const authData = localStorage.getItem('clarence_auth')
            if (authData) {
                try {
                    const parsed = JSON.parse(authData)
                    if (parsed.userInfo) {
                        setIsAuthenticated(true)
                    }
                } catch {
                    setIsAuthenticated(false)
                }
            }
            setIsLoading(false)
        }
        checkAuth()
    }, [])

    // ========================================================================
    // SECTION 3: RENDER
    // ========================================================================

    // Show loading state briefly to prevent flash
    if (isLoading) {
        return (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div className="px-8 py-3 bg-slate-200 rounded-lg w-40 h-12 animate-pulse"></div>
                <div className="px-8 py-3 bg-slate-100 rounded-lg w-40 h-12 animate-pulse"></div>
            </div>
        )
    }

    // Authenticated users see Dashboard button
    if (isAuthenticated) {
        return (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                    href="/auth/contracts-dashboard"
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30"
                >
                    Go to Dashboard
                </Link>
                <Link
                    href="/auth/training"
                    className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-lg border border-slate-300 transition-all"
                >
                    Training Studio
                </Link>
            </div>
        )
    }

    // Non-authenticated users see Request Trial
    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
                href="/request-trial"
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30"
            >
                Request Free Trial
            </Link>
            <Link
                href="/how-it-works"
                className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-lg border border-slate-300 transition-all"
            >
                Learn More
            </Link>
        </div>
    )
}