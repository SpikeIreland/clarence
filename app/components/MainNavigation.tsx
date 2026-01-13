'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ============================================================================
// SECTION 1: MAIN NAVIGATION COMPONENT
// Purpose: Auth-aware navigation with Sign In dropdown for Initiator/Respondent
// Location: app/components/MainNavigation.tsx
// ============================================================================

export default function MainNavigation() {
    const router = useRouter()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [userInfo, setUserInfo] = useState<{ firstName?: string; role?: string } | null>(null)
    const [showSignInDropdown, setShowSignInDropdown] = useState(false)
    const [showUserMenu, setShowUserMenu] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const userMenuRef = useRef<HTMLDivElement>(null)

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
                        setUserInfo(parsed.userInfo)
                    }
                } catch {
                    setIsAuthenticated(false)
                    setUserInfo(null)
                }
            }
        }
        checkAuth()
    }, [])

    // ========================================================================
    // SECTION 3: CLICK OUTSIDE HANDLERS
    // ========================================================================

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSignInDropdown(false)
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // ========================================================================
    // SECTION 4: HANDLERS
    // ========================================================================

    const handleSignOut = () => {
        localStorage.removeItem('clarence_auth')
        setIsAuthenticated(false)
        setUserInfo(null)
        router.push('/')
    }

    // ========================================================================
    // SECTION 5: RENDER
    // ========================================================================

    return (
        <header className="bg-slate-800 text-white sticky top-0 z-50">
            <div className="container mx-auto px-6">
                <nav className="flex justify-between items-center h-16">
                    {/* ============================================================ */}
                    {/* Logo & Brand */}
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
                    {/* Navigation Links */}
                    {/* ============================================================ */}
                    <div className="hidden md:flex items-center gap-6">
                        <Link
                            href="/how-it-works"
                            className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                        >
                            How It Works
                        </Link>
                        <Link
                            href="/pricing"
                            className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                        >
                            Pricing
                        </Link>
                    </div>

                    {/* ============================================================ */}
                    {/* Auth Section */}
                    {/* ============================================================ */}
                    <div className="flex items-center gap-3">
                        {isAuthenticated && userInfo ? (
                            // Logged In State - User Menu
                            <div ref={userMenuRef} className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                >
                                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                        {userInfo.firstName?.[0] || 'U'}
                                    </div>
                                    <span className="text-sm text-white">{userInfo.firstName}</span>
                                    <svg
                                        className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* User Dropdown Menu */}
                                {showUserMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <div className="text-sm font-medium text-slate-800">{userInfo.firstName}</div>
                                            <div className="text-xs text-slate-500 capitalize">{userInfo.role || 'User'}</div>
                                        </div>
                                        <div className="py-2">
                                            <Link
                                                href="/auth/contracts-dashboard"
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                </svg>
                                                Dashboard
                                            </Link>
                                            <Link
                                                href="/auth/training"
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                                Training Studio
                                            </Link>
                                        </div>
                                        <div className="border-t border-slate-100 pt-2">
                                            <button
                                                onClick={handleSignOut}
                                                className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
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
                        ) : (
                            // Logged Out State - Sign In Dropdown
                            <>
                                <Link
                                    href="/request-trial"
                                    className="hidden sm:inline-flex px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Request Trial
                                </Link>

                                <div ref={dropdownRef} className="relative">
                                    <button
                                        onClick={() => setShowSignInDropdown(!showSignInDropdown)}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Sign In
                                        <svg
                                            className={`w-4 h-4 transition-transform ${showSignInDropdown ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Sign In Dropdown */}
                                    {showSignInDropdown && (
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                                            <div className="px-4 py-2 border-b border-slate-100">
                                                <p className="text-xs text-slate-500">Choose your role</p>
                                            </div>
                                            <div className="py-2">
                                                <Link
                                                    href="/auth/login"
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors"
                                                    onClick={() => setShowSignInDropdown(false)}
                                                >
                                                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-800">Contract Initiator</div>
                                                        <div className="text-xs text-slate-500">Start or manage contracts</div>
                                                    </div>
                                                </Link>
                                                <a
                                                    href="https://www.clarencelegal.ai/provider"
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors"
                                                    onClick={() => setShowSignInDropdown(false)}
                                                >
                                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-800">Contract Respondent</div>
                                                        <div className="text-xs text-slate-500">Respond to invitations</div>
                                                    </div>
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    )
}