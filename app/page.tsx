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
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-teal-50/50 to-transparent"></div>
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
              <span className="text-teal-600">Negotiate</span>
              <span className="text-slate-400 mx-3">·</span>
              <span className="text-blue-600">Agree</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-slate-700 mb-4 max-w-2xl mx-auto leading-relaxed font-medium">
              AI-Powered Contract Mediation
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
            {/* STAGE 1: CREATE */}
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
                Define your contract scope, choose your mediation level, and set
                up the foundation for a successful negotiation.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Contract Creation & Setup</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Contract Preparation & Templates</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Invite Respondents</span>
                </li>
              </ul>
            </div>

            {/* ============================================================ */}
            {/* STAGE 2: NEGOTIATE */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-8 border border-teal-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-teal-600">Negotiate</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Work through clauses with AI-powered mediation, real-time leverage
                tracking, and intelligent trade-off suggestions.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>AI-Mediated Clause Negotiation</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Real-Time Leverage Tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Smart Trade-off Suggestions</span>
                </li>
              </ul>
            </div>

            {/* ============================================================ */}
            {/* STAGE 3: AGREE */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 border border-blue-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-blue-600">Agree</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Finalize your agreement with comprehensive documentation, full
                audit trail, and governance handbook.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Document Centre & Reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Complete Audit Trail</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              A Better Way to Negotiate
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Move beyond adversarial red-lining to principled, data-driven agreement.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Card 1: Transparent Leverage */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
                <svg className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Transparent Leverage</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Both parties see the same market data and leverage calculations. No hidden agendas—just facts that drive fair negotiations.
              </p>
            </div>

            {/* Card 2: Principled Mediation */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-teal-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-500 transition-colors">
                <svg className="w-6 h-6 text-teal-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Principled Mediation</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                CLARENCE guides negotiations based on principles, not positions. Focus on interests, not adversarial tactics.
              </p>
            </div>

            {/* Card 3: Stress-Free Process */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                <svg className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Stress-Free Process</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Remove the emotional friction from negotiations. Preserve relationships while reaching agreements both parties can support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6: THREE STUDIOS */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Three Integrated Studios
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From learning to negotiating to documenting—everything you need in one platform.
            </p>
          </div>

          {/* Studio Cards */}
          <div className="space-y-12 max-w-5xl mx-auto">

            {/* ============================================================ */}
            {/* STUDIO 1: Training Studio */}
            {/* ============================================================ */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Content */}
                <div className="p-8 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium w-fit mb-4">
                    <span>🎓</span>
                    <span>Training Studio</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-3">
                    Practice Risk-Free
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Master contract negotiation in a safe environment. Train new team members
                    on company playbooks, practice against AI opponents, or run scenarios
                    with colleagues.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-500">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Single-player AI scenarios with adjustable difficulty
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Multi-player practice with colleagues
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Enterprise playbook integration
                    </li>
                  </ul>
                </div>
                {/* Screenshot */}
                <div className="bg-slate-100 flex items-center justify-center p-6">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200 w-full">
                    <img
                      src="/images/training-studio-preview.png"
                      alt="CLARENCE Training Studio - Practice negotiations risk-free"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* STUDIO 2: Negotiation Environment */}
            {/* ============================================================ */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Screenshot (reversed order) */}
                <div className="bg-slate-100 flex items-center justify-center p-6 order-2 md:order-1">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200 w-full">
                    <img
                      src="/images/contract-studio-preview.png"
                      alt="CLARENCE Negotiation Environment - AI-powered contract negotiation"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
                {/* Content */}
                <div className="p-8 flex flex-col justify-center order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium w-fit mb-4">
                    <span>⚖️</span>
                    <span>Negotiation Environment</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-3">
                    AI-Powered Mediation
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Live, AI-mediated negotiation with real-time leverage tracking.
                    Work through clauses collaboratively, guided by CLARENCE's
                    principled approach to agreement.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-500">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Three-panel workspace with clause navigation
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Real-time leverage baseline and tracker
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      AI-suggested trade-offs and compromises
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* STUDIO 3: Document Centre */}
            {/* ============================================================ */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Content */}
                <div className="p-8 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium w-fit mb-4">
                    <span>📄</span>
                    <span>Document Centre</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-3">
                    Complete Evidence Package
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Every negotiation produces comprehensive documentation—from executive
                    summaries to full audit trails. Plus a unique Contract Handbook for
                    post-signature governance.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-500">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Executive summary, leverage report, position history
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Complete audit trail and chat transcripts
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Contract Handbook for ongoing governance
                    </li>
                  </ul>
                </div>
                {/* Screenshot */}
                <div className="bg-slate-100 flex items-center justify-center p-6">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200 w-full">
                    <img
                      src="/images/document-centre-preview.png"
                      alt="CLARENCE Document Centre - Complete evidence package"
                      className="w-full h-auto"
                    />
                  </div>
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
              <div className="text-4xl font-bold text-teal-400 mb-2">100%</div>
              <div className="text-slate-300 text-sm">Transparent Leverage</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-400 mb-2">0</div>
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
            <span className="text-teal-400">Negotiate</span>
            <span className="text-slate-500 mx-2">·</span>
            <span className="text-blue-400">Agree</span>
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
              <span className="text-teal-500">Negotiate</span>
              <span className="mx-2">·</span>
              <span className="text-blue-500">Agree</span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}