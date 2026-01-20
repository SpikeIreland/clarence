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
// COLOR SCHEME (Updated 19 Jan 2026):
// - Create: Emerald (text-emerald-600, bg-emerald-500)
// - Negotiate: Slate/CLARENCE Blue (text-slate-800 on light, text-slate-300 on dark)
// - Agree: Violet (text-violet-600, bg-violet-500)
// - Training Mode: Amber (reserved exclusively for Training Studio)
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
      {/* ================================================================== */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30"></div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-violet-50/50 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-32 bg-gradient-to-t from-slate-100/50 to-transparent"></div>

        <div className="relative container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* The Honest Broker Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-medium mb-6">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span>The Honest Broker</span>
            </div>

            {/* ============================================================ */}
            {/* PRIMARY BRAND MESSAGE: Create, Negotiate, Agree */}
            {/* ============================================================ */}
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              <span className="text-emerald-600">Create</span>
              <span className="text-slate-400 mx-3">·</span>
              <span className="text-slate-800">Negotiate</span>
              <span className="text-slate-400 mx-3">·</span>
              <span className="text-violet-600">Agree</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-slate-700 mb-3 max-w-2xl mx-auto leading-relaxed font-medium">
              AI-Powered Contract Mediation
            </p>

            {/* Secondary Tagline: Training, Tendering, Contracting */}
            <p className="text-lg mb-4 max-w-2xl mx-auto">
              <span className="text-amber-500 font-medium">Training</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="text-slate-600 font-medium">Tendering</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="text-slate-600 font-medium">Contracting</span>
            </p>

            {/* Supporting Text */}
            <p className="text-base text-slate-500 mb-8 max-w-2xl mx-auto">
              Remove the emotion. See the leverage. Reach fair agreements faster.
              CLARENCE guides both parties through principled, transparent negotiation.
            </p>

            {/* CTA Buttons */}
            <HeroCTA />

            {/* Trust Indicators */}
            <div className="mt-12 flex items-center justify-center gap-6 text-sm text-slate-500">
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
      {/* SECTION 4: CREATE · NEGOTIATE · AGREE - EXPANDED */}
      {/* The three stages with colored headers and descriptions */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Your Complete Contract Journey
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              CLARENCE guides you through every stage—from initial setup to signed agreement.
            </p>
          </div>

          {/* Three Stage Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

            {/* ============================================================ */}
            {/* STAGE 1: CREATE (Emerald) */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-8 border border-emerald-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-emerald-600">Create</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Build your contract and gather the strategic intelligence that
                powers objective negotiation—party-fit assessment and leverage
                data that removes guesswork from the table.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Contract Setup & Clause Preparation</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Party-Fit & Leverage Data Gathering</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Strategic Assessment & Invite</span>
                </li>
              </ul>
            </div>

            {/* ============================================================ */}
            {/* STAGE 2: NEGOTIATE (Slate/CLARENCE Blue) */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-br from-slate-100 to-white rounded-2xl p-8 border border-slate-300 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Negotiate</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Work through clauses with AI-powered mediation, real-time leverage
                tracking, and intelligent trade-off suggestions.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>AI-Mediated Clause Negotiation</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Real-Time Leverage Tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Smart Trade-off Suggestions</span>
                </li>
              </ul>
            </div>

            {/* ============================================================ */}
            {/* STAGE 3: AGREE (Violet) */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-8 border border-violet-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-violet-600">Agree</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Finalize your agreement with comprehensive documentation, full
                audit trail, and governance handbook.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Document Centre & Reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Complete Audit Trail</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Contract Handbook</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Learn More Link */}
          <div className="text-center mt-12">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              See how each stage works in detail
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 5: VALUE PROPOSITIONS */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Why Choose CLARENCE?
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Built for professionals who want fair outcomes, not endless negotiations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Value Prop 1: Neutral AI */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Truly Neutral</h3>
              <p className="text-slate-600 text-sm">
                CLARENCE represents neither party. Our AI provides balanced guidance
                based on data, not relationships.
              </p>
            </div>

            {/* Value Prop 2: Leverage Intelligence */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">See Your Leverage</h3>
              <p className="text-slate-600 text-sm">
                Real-time leverage calculations show exactly where you stand.
                Make informed decisions, not emotional ones.
              </p>
            </div>

            {/* Value Prop 3: Speed */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Faster Agreements</h3>
              <p className="text-slate-600 text-sm">
                Cut negotiation time by up to 90%. AI-powered suggestions and
                clear trade-offs accelerate consensus.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6: DETAILED FEATURE SHOWCASE */}
      {/* ================================================================== */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Powerful Features for Every Stage
            </h2>
          </div>

          {/* Feature 1: Contract Studio */}
          <div className="max-w-6xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-sm font-medium text-slate-700 mb-4">
                  <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                  Negotiate
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">
                  Contract Studio
                </h3>
                <p className="text-slate-600 mb-6">
                  The heart of CLARENCE. Work through every clause with real-time
                  leverage tracking, intelligent suggestions, and a neutral AI
                  mediator guiding both parties toward agreement.
                </p>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Three-panel layout: Clauses, Details, CLARENCE Chat
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Real-time leverage bar shows negotiation dynamics
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Industry-standard position references
                  </li>
                </ul>
              </div>
              {/* Screenshot */}
              <div className="bg-slate-100 flex items-center justify-center p-6">
                <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200 w-full">
                  <img
                    src="/images/contract-studio-preview.png"
                    alt="CLARENCE Contract Studio - AI-powered negotiation interface"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Document Centre */}
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Screenshot (on left this time) */}
              <div className="bg-slate-100 flex items-center justify-center p-6 order-2 md:order-1">
                <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200 w-full">
                  <img
                    src="/images/document-centre-preview.png"
                    alt="CLARENCE Document Centre - Complete evidence package"
                    className="w-full h-auto"
                  />
                </div>
              </div>
              {/* Content */}
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 rounded-full text-sm font-medium text-violet-700 mb-4">
                  <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
                  Agree
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">
                  Document Centre
                </h3>
                <p className="text-slate-600 mb-6">
                  Complete evidence package for every negotiation—from executive
                  summaries to full audit trails. Plus a unique Contract Handbook for
                  post-signature governance.
                </p>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Executive summary, leverage report, position history
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Complete audit trail and chat transcripts
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Contract Handbook for ongoing governance
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feature 3: Training Studio */}
          <div className="max-w-6xl mx-auto mt-16">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full text-sm font-medium text-amber-700 mb-4">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Practice Mode
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">
                  Training Studio
                </h3>
                <p className="text-slate-600 mb-6">
                  Train your team on company negotiation strategies, contract types,
                  and simulate real contract negotiations in a safe environment—perfect
                  for preparing staff before important deals.
                </p>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Safe practice environment—no real commitments
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    AI opponents with adjustable negotiation styles
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Prepare for upcoming negotiations risk-free
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Learn company playbooks and contract standards
                  </li>
                </ul>
              </div>
              {/* Screenshot */}
              <div className="bg-amber-50 flex items-center justify-center p-6">
                <div className="rounded-lg overflow-hidden shadow-lg border border-amber-200 w-full">
                  <img
                    src="/images/training-studio-preview.png"
                    alt="CLARENCE Training Studio - Practice negotiations safely"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: STATISTICS / SOCIAL PROOF */}
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
      {/* SECTION 8: CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-6 text-center">
          {/* Create, Negotiate, Agree echo */}
          <div className="text-2xl font-bold mb-6">
            <span className="text-emerald-400">Create</span>
            <span className="text-slate-500 mx-2">·</span>
            <span className="text-slate-300">Negotiate</span>
            <span className="text-slate-500 mx-2">·</span>
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
      {/* SECTION 9: FOOTER */}
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