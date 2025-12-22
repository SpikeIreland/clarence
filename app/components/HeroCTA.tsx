'use client'

import Link from 'next/link'

// ============================================================================
// HERO CTA COMPONENT - SIMPLIFIED
// Location: app/components/HeroCTA.tsx
// Always shows Customer and Provider options
// ============================================================================

export default function HeroCTA() {
    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Customer CTA - Primary */}
            <Link
                href="/auth/login"
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5"
            >
                Customer Sign In
            </Link>

            {/* Provider CTA */}
            <Link
                href="/provider"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
            >
                Provider Sign In
            </Link>

            {/* How It Works - Secondary */}
            <Link
                href="/how-it-works"
                className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-all hover:border-slate-400"
            >
                See How It Works
            </Link>
        </div>
    )
}