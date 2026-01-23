'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ============================================================================
// MAIN NAVIGATION COMPONENT
// Location: app/components/MainNavigation.tsx
// 
// Shared navigation header for public pages:
// - Landing Page
// - How It Works
// - Training
// - Pricing
// - Phases
// 
// Includes "Training" link between "How It Works" and "Pricing"
// ============================================================================

export default function MainNavigation() {
    const pathname = usePathname()

    // Helper to check if link is active
    const isActive = (path: string) => pathname === path

    return (
        <header className="bg-slate-800 text-white">
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
                    <div className="flex items-center gap-6">
                        {/* How It Works */}
                        <Link
                            href="/how-it-works"
                            className={`text-sm font-medium transition-colors ${isActive('/how-it-works')
                                    ? 'text-white'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            How It Works
                        </Link>

                        {/* Training - NEW LINK */}
                        <Link
                            href="/training"
                            className={`text-sm font-medium transition-colors ${isActive('/training')
                                    ? 'text-white'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            Training
                        </Link>

                        {/* Pricing */}
                        <Link
                            href="/pricing"
                            className={`text-sm font-medium transition-colors ${isActive('/pricing')
                                    ? 'text-white'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            Pricing
                        </Link>

                        {/* ============================================================ */}
                        {/* Sign In Buttons */}
                        {/* ============================================================ */}
                        <div className="flex items-center gap-3 ml-2">
                            <Link
                                href="/auth/login"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Customer Sign In
                            </Link>
                            <a
                                href="https://www.clarencelegal.ai/provider"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Provider Sign In
                            </a>
                        </div>
                    </div>
                </nav>
            </div>
        </header>
    )
}