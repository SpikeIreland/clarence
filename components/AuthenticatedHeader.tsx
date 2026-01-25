'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ============================================================================
// AUTHENTICATED HEADER COMPONENT
// Location: app/components/AuthenticatedHeader.tsx
// 
// Shared header for authenticated pages:
// - Dashboard (/auth/contracts-dashboard)
// - Contract Library (/auth/contracts)
// - Training (/auth/training)
// 
// Props:
// - userInfo: User's name, email, company
// - onSignOut: Function to handle sign out
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
}

interface AuthenticatedHeaderProps {
    userInfo: UserInfo | null
    onSignOut: () => void
}

export default function AuthenticatedHeader({ userInfo, onSignOut }: AuthenticatedHeaderProps) {
    const pathname = usePathname()
    const [showUserMenu, setShowUserMenu] = useState(false)

    // Helper to check if link is active
    const isActive = (path: string) => pathname === path

    // Get link styling based on active state
    const getLinkClass = (path: string) => {
        if (isActive(path)) {
            return "px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-lg"
        }
        return "px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
    }

    return (
        <>
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center justify-between h-16">
                        {/* ============================================================ */}
                        {/* Left side - Logo & Navigation Links */}
                        {/* ============================================================ */}
                        <div className="flex items-center gap-8">
                            {/* Logo */}
                            <Link href="/auth/contracts-dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">C</span>
                                </div>
                                <span className="font-semibold text-slate-800">CLARENCE</span>
                            </Link>

                            {/* Navigation Links - Centered area */}
                            <div className="hidden md:flex items-center gap-1">
                                <Link
                                    href="/auth/contracts-dashboard"
                                    className={getLinkClass('/auth/contracts-dashboard')}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/auth/contracts"
                                    className={getLinkClass('/auth/contracts')}
                                >
                                    Contract Library
                                </Link>
                                <Link
                                    href="/auth/training"
                                    className={getLinkClass('/auth/training')}
                                >
                                    Training
                                </Link>
                            </div>
                        </div>

                        {/* ============================================================ */}
                        {/* Right side - User Menu */}
                        {/* ============================================================ */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <span className="text-emerald-700 font-medium text-sm">
                                        {userInfo?.firstName?.[0]}{userInfo?.lastName?.[0]}
                                    </span>
                                </div>
                                <span className="hidden sm:block text-sm text-slate-700">{userInfo?.firstName}</span>
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

                                    {/* Quick Links */}
                                    <div className="py-2">
                                        <Link
                                            href="/auth/contracts-dashboard"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                            Dashboard
                                        </Link>
                                        <Link
                                            href="/auth/contracts"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Contract Library
                                        </Link>
                                        <Link
                                            href="/auth/training"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                            Training
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