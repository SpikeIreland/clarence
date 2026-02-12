'use client'

// ============================================================================
// AUTHENTICATED HEADER COMPONENT V2
// Location: components/AuthenticatedHeader.tsx
//
// Unified navigation header for all Tier 1 authenticated pages:
//   - Negotiations  (/auth/contracts-dashboard)
//   - Contracts      (/auth/contracts)
//   - Quick Contracts (/auth/quick-contract)
//   - Training       (/auth/training)
//
// Props:
//   activePage  – which nav link to highlight
//   userInfo    – user's name, email, company
//   onSignOut   – function to handle sign out
//
// Active State Colours:
//   Training page  → amber highlight  (bg-amber-600/80)
//   All other pages → emerald/slate    (bg-slate-700)
//
// Version: 2.0
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState } from 'react'
import Link from 'next/link'
import FeedbackButton from '@/app/components/FeedbackButton'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
}

type ActivePage = 'negotiations' | 'contracts' | 'quick-contracts' | 'training'

interface AuthenticatedHeaderProps {
    activePage: ActivePage
    userInfo: UserInfo | null
    onSignOut: () => void
}

// ============================================================================
// SECTION 3: NAV CONFIGURATION
// ============================================================================

const NAV_ITEMS: { key: ActivePage; label: string; href: string; icon: React.ReactNode }[] = [
    {
        key: 'negotiations',
        label: 'Dashboard',
        href: '/auth/contracts-dashboard',
        icon: (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        key: 'contracts',
        label: 'Templates',
        href: '/auth/contracts',
        icon: (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        key: 'quick-contracts',
        label: 'Quick to Contract',
        href: '/auth/quick-contract',
        icon: (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
    },
    {
        key: 'training',
        label: 'Training',
        href: '/auth/training',
        icon: (
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
    },
]

// ============================================================================
// SECTION 4: COMPONENT
// ============================================================================

export default function AuthenticatedHeader({ activePage, userInfo, onSignOut }: AuthenticatedHeaderProps) {
    const [showUserMenu, setShowUserMenu] = useState(false)

    // ========================================================================
    // SECTION 4A: STYLING HELPERS
    // ========================================================================

    // Training uses amber, everything else uses standard slate
    const getNavLinkClass = (key: ActivePage) => {
        const isActive = key === activePage
        if (!isActive) {
            return 'px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors'
        }
        if (key === 'training') {
            return 'px-3 py-2 text-sm font-medium text-white bg-amber-600/80 rounded-lg'
        }
        return 'px-3 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg'
    }

    // Avatar colour — amber for Training page, emerald for everything else
    const avatarBg = activePage === 'training' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
    const avatarText = activePage === 'training' ? 'text-amber-400' : 'text-emerald-400'

    // ========================================================================
    // SECTION 4B: RENDER
    // ========================================================================

    return (
        <>
            <header className="bg-slate-800 text-white sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="relative flex items-center justify-between h-16">

                        {/* ================================================ */}
                        {/* LEFT: Logo & Brand */}
                        {/* ================================================ */}
                        <Link href="/auth/contracts-dashboard" className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <span className="font-semibold text-white">CLARENCE</span>
                        </Link>

                        {/* ================================================ */}
                        {/* CENTRE: Navigation Links */}
                        {/* ================================================ */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:flex items-center gap-1">
                            {NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    className={getNavLinkClass(item.key)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* ================================================ */}
                        {/* RIGHT: Feedback & User Menu */}
                        {/* ================================================ */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Feedback Button */}
                            <FeedbackButton position="header" />

                            {/* User Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    <div className={`w-8 h-8 ${avatarBg} rounded-full flex items-center justify-center`}>
                                        <span className={`${avatarText} font-medium text-sm`}>
                                            {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                        </span>
                                    </div>
                                    <span className="hidden sm:block text-sm text-slate-300">{userInfo?.firstName}</span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Menu */}
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

                                        {/* Quick Links — all four nav destinations */}
                                        <div className="py-2">
                                            {NAV_ITEMS.map((item) => (
                                                <Link
                                                    key={item.key}
                                                    href={item.href}
                                                    className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                    onClick={() => setShowUserMenu(false)}
                                                >
                                                    {item.icon}
                                                    {item.label}
                                                </Link>
                                            ))}
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
            </header>

            {/* Click outside to close user menu */}
            {showUserMenu && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowUserMenu(false)}
                />
            )}
        </>
    )
}