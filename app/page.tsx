import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from './components/MainNavigation'
import HeroCTA from './components/HeroCTA'
import ContractStudioPreview from './components/ContractStudioPreview'

export const metadata: Metadata = {
  title: 'CLARENCE | AI-Powered Contract Mediation',
  description: 'The Honest Broker - AI-powered contract negotiation platform that transforms adversarial negotiations into collaborative deal-making.',
}

// ============================================================================
// SECTION 1: MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 2: NAVIGATION HEADER (AUTH-AWARE) */}
      {/* ================================================================== */}
      <MainNavigation />

      {/* ================================================================== */}
      {/* SECTION 3: HERO SECTION */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50"></div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-50/50 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-32 bg-gradient-to-t from-slate-100/50 to-transparent"></div>

        <div className="relative container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 tracking-tight">
              AI-Powered Contract Mediation
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              CLARENCE leads parties through an intuitive, structured negotiation process—combining
              AI-powered insights with transparent brokering to efficiently agree optimal contracts.
            </p>

            {/* CTA Buttons (AUTH-AWARE) */}
            <HeroCTA />

            {/* Trust Indicator */}
            <div className="mt-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Enterprise-grade security • Data-driven mediation • Fair outcomes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 4: VALUE PROPOSITION CARDS */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Transform How You Negotiate
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Move beyond adversarial red-lining to collaborative, data-driven deal-making.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Card 1: Transparent Leverage */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group">
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

            {/* Card 2: AI-Powered Insights */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                <svg className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">AI-Powered Insights</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                CLARENCE analyzes positions, identifies trade-offs, and suggests compromises that maximize value for both parties.
              </p>
            </div>

            {/* Card 3: Structured Process */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors">
                <svg className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Structured Process</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Our 6-phase framework guides negotiations from initial positions to signed agreement—efficiently and professionally.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 5: HOW IT WORKS PREVIEW */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              The CLARENCE Process
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From first contact to signed contract in six structured phases.
            </p>
          </div>

          {/* Phase Timeline */}
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between relative">
              {/* Connecting Line */}
              <div className="absolute top-6 left-0 right-0 h-0.5 bg-slate-300"></div>
              <div className="absolute top-6 left-0 w-1/2 h-0.5 bg-gradient-to-r from-emerald-500 to-blue-500"></div>

              {/* Phase 1 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-emerald-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">Deal Profile</span>
              </div>

              {/* Phase 2 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-emerald-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">Leverage Assessment</span>
              </div>

              {/* Phase 3 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-blue-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">Gap Narrowing</span>
              </div>

              {/* Phase 4 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-slate-300">
                  4
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">Points of Contention</span>
              </div>

              {/* Phase 5 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-slate-300">
                  5
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">Deal Drivers</span>
              </div>

              {/* Phase 6 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-slate-300">
                  6
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">Closure</span>
              </div>
            </div>
          </div>

          {/* Learn More CTA */}
          <div className="text-center mt-12">
            <Link
              href="/phases"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Learn about each phase
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION: THE CONTRACT STUDIO (Consolidated with Gamification) */}
      {/* ================================================================== */}

      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-3">
              The Contract Studio
            </h2>
            <p className="text-xl text-emerald-600 font-medium mb-4">
              Where AI-Powered Negotiation meets Gamification
            </p>
            <p className="text-slate-600 max-w-2xl mx-auto">
              A powerful three-panel workspace where parties negotiate clause-by-clause,
              guided by CLARENCE's real-time leverage tracking and AI-powered insights.
            </p>
          </div>

          {/* Screenshot Preview */}
          <ContractStudioPreview />

          {/* Gamification Features */}
          <div className="mt-16 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-800 text-center mb-8">
              Make Negotiation Fun!
            </h3>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Real-Time Progress */}
              <div className="text-center">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">Real-Time Progress</h4>
                <p className="text-sm text-slate-600">
                  Watch your negotiation advance with live updates as positions align and agreements form.
                </p>
              </div>

              {/* Alignment Scores */}
              <div className="text-center">
                <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">Alignment Scores</h4>
                <p className="text-sm text-slate-600">
                  Clear metrics show exactly where you stand, making complex negotiations easy to understand.
                </p>
              </div>

              {/* Achievement Milestones */}
              <div className="text-center">
                <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">Achievement Milestones</h4>
                <p className="text-sm text-slate-600">
                  Celebrate progress with milestone markers as you move through each phase toward agreement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 8: CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Negotiations?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Join forward-thinking organizations using CLARENCE to achieve better contract outcomes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
            >
              Get Started Free
            </Link>
            <Link
              href="/chat"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
            >
              Try the Demo
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
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <div>
                <span className="text-white font-medium">CLARENCE</span>
                <span className="text-slate-500 text-sm ml-2">The Honest Broker</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-8 text-sm">
              <Link href="/how-it-works" className="hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="/phases" className="hover:text-white transition-colors">
                The 6 Phases
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
          </div>
        </div>
      </footer>
    </main>
  )
}