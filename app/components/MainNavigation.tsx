'use client'

import Link from 'next/link'

// ============================================================================
// MAIN NAVIGATION COMPONENT - SIMPLIFIED
// Location: app/components/MainNavigation.tsx
// Always shows Customer and Provider sign-in options
// ============================================================================

export default function MainNavigation() {
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

                        {/* Sign In Buttons - Always Visible */}
                        <div className="flex items-center gap-3 ml-2">
                            <Link
                                href="/auth/login"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Customer Sign In
                            </Link>
                            <Link
                                href="/provider"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Provider Sign In
                            </Link>
                        </div>
                    </div>
                </nav>
            </div>
        </header>
    )
}