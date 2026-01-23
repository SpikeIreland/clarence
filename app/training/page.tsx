import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'

// ============================================================================
// SECTION 1: TRAINING PAGE
// Location: app/training/page.tsx
// 
// NEW DEDICATED PAGE for Training Studio
// Amber colour scheme throughout
// 
// SCREENSHOT REQUIRED:
// - /images/training-studio-preview.png
// ============================================================================

export default function TrainingPage() {
    return (
        <main className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 2: NAVIGATION */}
            {/* ================================================================== */}
            <MainNavigation />

            {/* ================================================================== */}
            {/* SECTION 3: HERO */}
            {/* ================================================================== */}
            <section className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 text-white py-20">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-sm font-medium mb-8">
                            <span className="text-2xl">🎓</span>
                            <span>Practice Mode</span>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold mb-6">
                            Training Studio
                        </h1>
                        <p className="text-xl text-amber-100 max-w-2xl mx-auto leading-relaxed">
                            Master contract negotiation in a risk-free environment. Train your team,
                            practice with AI opponents, and prepare for important deals before going live.
                        </p>

                        {/* CTA */}
                        <div className="mt-10">
                            <Link
                                href="/request-trial"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-amber-600 font-semibold rounded-lg hover:bg-amber-50 transition-colors shadow-lg"
                            >
                                Start Training Free
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 4: SCREENSHOT + KEY BENEFITS */}
            {/* ================================================================== */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            {/* Screenshot */}
                            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
                                <div className="rounded-lg overflow-hidden shadow-lg border border-amber-200">
                                    <img
                                        src="/images/training-studio-preview.png"
                                        alt="CLARENCE Training Studio - Practice negotiations safely"
                                        className="w-full h-auto"
                                    />
                                </div>
                            </div>

                            {/* Benefits */}
                            <div>
                                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                                    Learn by Doing—Without the Risk
                                </h2>
                                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                                    The Training Studio provides a safe environment to develop negotiation
                                    skills, test strategies, and prepare teams for high-stakes deals.
                                    Every training session uses the same AI-powered mediation as live contracts.
                                </p>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl">🎯</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-1">No Real Commitments</h3>
                                            <p className="text-sm text-slate-600">Practice negotiations without any binding obligations. Make mistakes, learn, improve.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl">🤖</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-1">AI Opponents</h3>
                                            <p className="text-sm text-slate-600">Negotiate against intelligent AI with adjustable difficulty—from beginner to expert.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl">👥</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-1">Team Practice</h3>
                                            <p className="text-sm text-slate-600">Run multi-player sessions with colleagues to sharpen skills before important deals.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-xl">📈</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 mb-1">Progress Tracking</h3>
                                            <p className="text-sm text-slate-600">Monitor skill development and identify areas for improvement over time.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 5: USE CASES */}
            {/* ================================================================== */}
            <section className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">
                            Training Scenarios
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">
                            Pre-built scenarios covering common contract types and negotiation challenges.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                        {/* BPO */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                                <span className="text-2xl">🏢</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">BPO Contracts</h3>
                            <p className="text-sm text-slate-600">
                                Business Process Outsourcing agreements with complex service levels and pricing.
                            </p>
                        </div>

                        {/* SaaS */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                                <span className="text-2xl">☁️</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">SaaS Agreements</h3>
                            <p className="text-sm text-slate-600">
                                Software subscription contracts with data handling and uptime requirements.
                            </p>
                        </div>

                        {/* MSA */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                                <span className="text-2xl">📋</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Master Services</h3>
                            <p className="text-sm text-slate-600">
                                Framework agreements that govern ongoing service relationships.
                            </p>
                        </div>

                        {/* NDA */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                                <span className="text-2xl">🔒</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">NDAs</h3>
                            <p className="text-sm text-slate-600">
                                Confidentiality agreements with varying protection levels and terms.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 6: ENTERPRISE FEATURES */}
            {/* ================================================================== */}
            <section className="py-20 bg-white border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-12">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full text-sm font-medium text-amber-700 mb-4">
                                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                Enterprise Feature
                            </div>
                            <h2 className="text-3xl font-bold text-slate-800 mb-4">
                                Company Playbook Integration
                            </h2>
                            <p className="text-slate-600 max-w-2xl mx-auto">
                                Train your team on your actual negotiation playbooks and contract standards.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Customize Training To Your Business</h3>
                                    <ul className="space-y-3 text-slate-600">
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Upload your company's clause playbooks and position guides</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Define acceptable position ranges for each clause type</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Create scenarios based on real upcoming negotiations</span>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Promote to Live Contracts</h3>
                                    <ul className="space-y-3 text-slate-600">
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Successful training contracts can become live templates</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Seamless transition from practice to production</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>Preserve learnings and refine approach before going live</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 7: CTA */}
            {/* ================================================================== */}
            <section className="py-20 bg-gradient-to-br from-amber-500 to-orange-500">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Start Training?
                    </h2>
                    <p className="text-amber-100 mb-8 max-w-xl mx-auto">
                        Experience CLARENCE risk-free. Build your team's negotiation skills
                        before taking on high-stakes contracts.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/request-trial"
                            className="px-8 py-3 bg-white text-amber-600 font-semibold rounded-lg hover:bg-amber-50 transition-colors shadow-lg"
                        >
                            Request Free Trial
                        </Link>
                        <Link
                            href="/how-it-works"
                            className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg border border-amber-400 transition-colors"
                        >
                            See How It Works
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 8: FOOTER */}
            {/* ================================================================== */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        {/* Brand */}
                        <div className="flex items-center gap-3 mb-6 md:mb-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <span className="text-white font-semibold">CLARENCE</span>
                                <span className="text-slate-500 text-sm ml-2">The Honest Broker</span>
                            </div>
                        </div>

                        {/* Links */}
                        <div className="flex gap-8 text-sm">
                            <Link href="/" className="hover:text-white transition-colors">
                                Home
                            </Link>
                            <Link href="/how-it-works" className="hover:text-white transition-colors">
                                How It Works
                            </Link>
                            <Link href="/pricing" className="hover:text-white transition-colors">
                                Pricing
                            </Link>
                            <Link href="/privacy" className="hover:text-white transition-colors">
                                Privacy
                            </Link>
                            <Link href="/terms" className="hover:text-white transition-colors">
                                Terms
                            </Link>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
                        <p>&copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.</p>
                        <p className="text-slate-500 mt-1">
                            <span className="text-emerald-500">Create</span>
                            <span className="mx-2">·</span>
                            <span className="text-slate-400">Negotiate</span>
                            <span className="mx-2">·</span>
                            <span className="text-violet-500">Agree</span>
                        </p>
                    </div>
                </div>
            </footer>
        </main>
    )
}