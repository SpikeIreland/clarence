import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from './components/MainNavigation'
import HeroCTA from './components/HeroCTA'

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
                <span className="mt-2 text-xs font-medium text-slate-600">Foundation</span>
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
                <span className="mt-2 text-xs font-medium text-slate-600">Contention</span>
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
      {/* SECTION 6: LEVERAGE-TRACKED NEGOTIATION */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Leverage-Tracked Negotiation
            </h2>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Description */}
              <div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">
                  See the Real Balance of Power
                </h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  CLARENCE calculates leverage based on market dynamics, economic factors,
                  strategic position, and alternatives. Both parties see the same analysis—making
                  negotiations fact-based, not emotion-driven.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-slate-700">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Market dynamics analysis
                  </li>
                  <li className="flex items-center gap-3 text-slate-700">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Economic factors assessment
                  </li>
                  <li className="flex items-center gap-3 text-slate-700">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Strategic position evaluation
                  </li>
                  <li className="flex items-center gap-3 text-slate-700">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    BATNA (alternatives) scoring
                  </li>
                </ul>
              </div>

              {/* Right: Leverage Visualization Mock */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="text-sm font-semibold text-slate-700 mb-4">Leverage Baseline</div>

                {/* Leverage Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-emerald-600 font-medium">Customer</span>
                    <span className="text-blue-600 font-medium">Provider</span>
                  </div>
                  <div className="h-4 bg-slate-200 rounded-full overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[62%] bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full"></div>
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400"></div>
                  </div>
                  <div className="flex justify-between text-lg font-bold mt-2">
                    <span className="text-emerald-600">62%</span>
                    <span className="text-blue-600">38%</span>
                  </div>
                </div>

                {/* Factor Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm text-slate-600">Market Dynamics</span>
                    <span className="text-sm font-semibold text-emerald-600">+8</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm text-slate-600">Economic Factors</span>
                    <span className="text-sm font-semibold text-emerald-600">+4</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm text-slate-600">Strategic Position</span>
                    <span className="text-sm font-semibold text-amber-600">-2</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white rounded-lg">
                    <span className="text-sm text-slate-600">BATNA Strength</span>
                    <span className="text-sm font-semibold text-emerald-600">+6</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: GAMIFIED NEGOTIATION STUDIO */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Gamified Negotiation Studio
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Make negotiation fun!
            </p>

            {/* Feature highlights */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Real-Time Progress</h3>
                <p className="text-sm text-slate-600">
                  Watch your negotiation advance through each phase with live progress tracking
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Alignment Scores</h3>
                <p className="text-sm text-slate-600">
                  See how close you are to agreement on every clause with visual alignment indicators
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Achievement Milestones</h3>
                <p className="text-sm text-slate-600">
                  Celebrate progress as you reach key negotiation milestones together
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