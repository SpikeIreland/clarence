'use client'

// ============================================================================
// SHARED DASHBOARD HEADER COMPONENT
// ============================================================================
// Used across: Negotiations Dashboard, Quick Contracts Dashboard
// Location: /app/components/DashboardHeader.tsx
// ============================================================================

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import FeedbackButton from '@/app/components/FeedbackButton'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface DashboardHeaderProps {
    userInfo?: {
        firstName?: string
        lastName?: string
        email?: string
        company?: string
    } | null
    onSignOut: () => void
    onOpenChat?: () => void  // Optional - only shown if provided
}

// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function DashboardHeader({
    userInfo,
    onSignOut,
    onOpenChat
}: DashboardHeaderProps) {
    const pathname = usePathname()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // ========================================================================
    // SECTION 3: CLICK OUTSIDE HANDLER
    // ========================================================================

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false)
            }
        }

        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showUserMenu])

    // ========================================================================
    // SECTION 4: HELPER FUNCTIONS
    // ========================================================================

    const isActive = (path: string) => {
        // Exact match for Contracts Library to avoid matching contracts-dashboard
        if (path === '/auth/contracts') {
            return pathname === '/auth/contracts'
        }
        // For other paths, use startsWith for nested routes
        return pathname?.startsWith(path)
    }
    
    // ========================================================================
    // SECTION 5: RENDER
    // ========================================================================

    return (
        <header className="bg-slate-800 text-white sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <nav className="flex justify-between items-center h-16">

                    {/* ============================================================ */}
                    {/* SECTION 5A: LOGO & BRAND */}
                    {/* ============================================================ */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                        </div>
                        <div>
                            <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                            <div className="text-xs text-slate-400">The Honest Broker</div>
                        </div>
                    </Link>

                    {/* ============================================================ */}
                    {/* SECTION 5B: NAVIGATION LINKS (Center) */}
                    {/* ============================================================ */}
                    <div className="hidden md:flex items-center gap-8">
                        <div className="h-4 w-px bg-slate-600"></div>

                        <div className="flex items-center gap-6">
                            {/* Negotiations (Main Dashboard) */}
                            <Link
                                href="/auth/contracts-dashboard"
                                className={`font-medium text-sm transition-colors ${isActive('/auth/contracts-dashboard')
                                    ? 'text-white border-b-2 border-emerald-500 pb-1'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Negotiations
                            </Link>

                            {/* Quick Contracts */}
                            <Link
                                href="/auth/quick-contract"
                                className={`font-medium text-sm transition-colors ${isActive('/auth/quick-contract')
                                    ? 'text-white border-b-2 border-emerald-500 pb-1'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Quick to Contracts
                            </Link>

                            {/* Contracts Library */}
                            <Link
                                href="/auth/contracts"
                                className={`font-medium text-sm transition-colors ${isActive('/auth/contracts')
                                    ? 'text-white border-b-2 border-emerald-500 pb-1'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Contracts Library
                            </Link>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 5C: RIGHT SIDE - ACTIONS & USER MENU */}
                    {/* ============================================================ */}
                    <div className="flex items-center gap-4">
                        {/* Feedback Button */}
                        <FeedbackButton position="header" />

                        {/* Ask CLARENCE Button - Only shown if onOpenChat provided */}
                        {onOpenChat && (
                            <button
                                onClick={onOpenChat}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                                </svg>
                                Ask CLARENCE
                            </button>
                        )}

                        {/* User Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                            >
                                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                    {userInfo?.firstName?.[0] || '?'}{userInfo?.lastName?.[0] || ''}
                                </div>
                                <span className="hidden sm:block text-sm">
                                    {userInfo?.firstName || 'User'}
                                </span>
                                <svg
                                    className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* ======================================================== */}
                            {/* SECTION 5D: USER DROPDOWN MENU */}
                            {/* ======================================================== */}
                            {showUserMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                    {/* User Info */}
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <div className="font-medium text-slate-800">
                                            {userInfo?.firstName} {userInfo?.lastName}
                                        </div>
                                        <div className="text-sm text-slate-500">{userInfo?.email}</div>
                                        <div className="text-xs text-slate-400 mt-1">{userInfo?.company}</div>
                                    </div>

                                    {/* Menu Links */}
                                    <div className="py-2">
                                        <Link
                                            href="/how-it-works"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            How It Works
                                        </Link>

                                        <Link
                                            href="/auth/training"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            Training Studio
                                        </Link>
                                    </div>

                                    {/* Sign Out */}
                                    <div className="border-t border-slate-100 pt-2">
                                        <button
                                            onClick={() => {
                                                setShowUserMenu(false)
                                                onSignOut()
                                            }}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>
            </div>

            {/* ================================================================== */}
            {/* SECTION 6: MOBILE NAVIGATION (Future Enhancement) */}
            {/* ================================================================== */}
            {/* TODO: Add hamburger menu for mobile */}
        </header>
    )
}