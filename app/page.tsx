import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from './components/MainNavigation'
import HeroCTA from './components/HeroCTA'

export const metadata: Metadata = {
  title: 'CLARENCE | Create, Negotiate, Agree - AI-Powered Contract Mediation',
  description: 'Create, Negotiate, Agree. CLARENCE is the AI-powered honest broker that removes emotion from contract negotiation, helping both parties reach fair agreements faster.',
}

// ============================================================================
// SECTION 1: MAIN PAGE COMPONENT
// Location: app/page.tsx
// 
// SIMPLIFIED VERSION - More white-space, cleaner structure
// Detailed feature panels with screenshots moved to How It Works page
// Training Studio moved to dedicated /training page
// 
// COLOR SCHEME:
// - Create: Emerald (text-emerald-600)
// - Negotiate: Slate (text-slate-800) - EMPHASIZED larger/heavier
// - Agree: Violet (text-violet-600)
// - Training Mode: Amber (reserved for Training Studio)
// ============================================================================

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 2: NAVIGATION HEADER */}
      {/* ================================================================== */}
      <MainNavigation />

      {/* ================================================================== */}
      {/* SECTION 3: HERO SECTION - "Create, Negotiate, Agree" */}
      {/* More breathing room with increased padding */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30"></div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-violet-50/50 to-transparent"></div>

        <div className="relative container mx-auto px-6 py-28 md:py-36">
          <div className="max-w-4xl mx-auto text-center">
            {/* The Honest Broker Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-medium mb-10">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span>The Honest Broker</span>
            </div>

            {/* ============================================================ */}
            {/* PRIMARY BRAND MESSAGE: Create, Negotiate, Agree */}
            {/* "Negotiate" is emphasized - larger and heavier */}
            {/* ============================================================ */}
            <h1 className="text-5xl md:text-6xl font-bold mb-8 tracking-tight flex items-baseline justify-center flex-wrap gap-x-3">
              <span className="text-emerald-600">Create</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-800 text-6xl md:text-7xl font-black">Negotiate</span>
              <span className="text-slate-400">·</span>
              <span className="text-violet-600">Agree</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-slate-700 mb-3 max-w-2xl mx-auto leading-relaxed font-medium">
              AI-Powered Contract Mediation
            </p>

            {/* Secondary Tagline - All consistent slate colour */}
            <p className="text-lg mb-8 max-w-2xl mx-auto">
              <span className="text-slate-600 font-medium">Training</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="text-slate-600 font-medium">Tendering</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="text-slate-600 font-medium">Contracting</span>
            </p>

            {/* Supporting Text */}
            <p className="text-base text-slate-500 mb-12 max-w-2xl mx-auto">
              Remove the emotion. See the leverage. Reach fair agreements faster.
            </p>

            {/* CTA Buttons */}
            <HeroCTA />

            {/* Trust Indicators */}
            <div className="mt-16 flex items-center justify-center gap-8 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Neutral Mediation</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Data-Driven Leverage</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Enterprise Security</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 4: THREE STAGE CARDS - SIMPLIFIED */}
      {/* Brief descriptions, links to How It Works */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Your Contract Journey
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              From setup to signature—a structured path to fair agreements.
            </p>
          </div>

          {/* Three Stage Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* STAGE 1: CREATE (Emerald) */}
            <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-6 border border-emerald-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-emerald-600">Create</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">
                Build your contract and gather strategic intelligence—party-fit
                and leverage data that powers objective negotiation.
              </p>
              <ul className="space-y-2 text-sm text-slate-500 mb-4">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">•</span>
                  Contract setup & clause preparation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">•</span>
                  Party-fit & leverage assessment
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">•</span>
                  Invite respondents
                </li>
              </ul>
              <Link href="/how-it-works#create" className="text-emerald-600 text-sm font-medium hover:text-emerald-700 inline-flex items-center gap-1">
                Learn more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* STAGE 2: NEGOTIATE (Slate) */}
            <div className="bg-gradient-to-br from-slate-100 to-white rounded-2xl p-6 border border-slate-300 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800">Negotiate</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">
                AI-mediated clause-by-clause negotiation with real-time leverage
                tracking and intelligent trade-off suggestions.
              </p>
              <ul className="space-y-2 text-sm text-slate-500 mb-4">
                <li className="flex items-center gap-2">
                  <span className="text-slate-600">•</span>
                  Three-panel workspace
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-slate-600">•</span>
                  Real-time leverage tracking
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-slate-600">•</span>
                  CLARENCE AI guidance
                </li>
              </ul>
              <Link href="/how-it-works#negotiate" className="text-slate-700 text-sm font-medium hover:text-slate-900 inline-flex items-center gap-1">
                Learn more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* STAGE 3: AGREE (Violet) */}
            <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-6 border border-violet-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-violet-600">Agree</h3>
              </div>
              <p className="text-slate-600 text-sm mb-4">
                Complete evidence package for every negotiation—executive
                summaries, audit trails, and governance handbook.
              </p>
              <ul className="space-y-2 text-sm text-slate-500 mb-4">
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">•</span>
                  Document Centre
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">•</span>
                  Complete audit trail
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">•</span>
                  Contract Handbook
                </li>
              </ul>
              <Link href="/how-it-works#agree" className="text-violet-600 text-sm font-medium hover:text-violet-700 inline-flex items-center gap-1">
                Learn more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 5: TRAINING STUDIO HIGHLIGHT */}
      {/* Links to dedicated /training page */}
      {/* ================================================================== */}
      <section className="py-16 bg-gradient-to-br from-amber-50 to-orange-50 border-t border-amber-200">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
            {/* Icon */}
            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-4xl">🎓</span>
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                Training Studio
              </h3>
              <p className="text-slate-600 mb-4">
                Master contract negotiation in a risk-free environment. Train your team
                on company playbooks, practice with AI opponents, and prepare for
                important deals before going live.
              </p>
              <Link
                href="/training"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
              >
                Explore Training Studio
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6: STATISTICS / SOCIAL PROOF */}
      {/* ================================================================== */}
      <section className="py-16 bg-slate-800">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold text-emerald-400 mb-2">90%</div>
              <div className="text-slate-300 text-sm">Faster Agreement Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-slate-300 mb-2">100%</div>
              <div className="text-slate-300 text-sm">Transparent Leverage</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-violet-400 mb-2">0</div>
              <div className="text-slate-300 text-sm">Hidden Agendas</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-6 text-center">
          {/* Create, Negotiate, Agree echo */}
          <div className="text-2xl font-bold mb-6 flex items-baseline justify-center gap-2">
            <span className="text-emerald-400">Create</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300 text-3xl font-black">Negotiate</span>
            <span className="text-slate-500">·</span>
            <span className="text-violet-400">Agree</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Negotiations?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Join forward-thinking organizations using CLARENCE to achieve better
            contract outcomes with less stress.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/request-trial"
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
            >
              Request Free Trial
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
            >
              View Pricing
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
              <Link href="/how-it-works" className="hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="/training" className="hover:text-white transition-colors">
                Training
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