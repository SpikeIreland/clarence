import { Metadata } from 'next'

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
      {/* SECTION 2: NAVIGATION HEADER */}
      {/* Matches Contract Studio header styling */}
      {/* ================================================================== */}
      <header className="bg-slate-800 text-white">
        <div className="container mx-auto px-6">
          <nav className="flex justify-between items-center h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                <div className="text-xs text-slate-400">The Honest Broker</div>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-6">
              <a
                href="/how-it-works"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                How It Works
              </a>
              <a
                href="/phases"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                The 6 Phases
              </a>

              {/* Sign In Buttons */}
              <div className="flex items-center gap-3 ml-2">
                <a
                  href="/auth/login"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Customer Sign In
                </a>
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

      {/* ================================================================== */}
      {/* SECTION 3: HERO SECTION */}
      {/* Clean white background with gradient accent */}
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

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/auth/signup"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5"
              >
                Start Your Negotiation
              </a>
              <a
                href="/how-it-works"
                className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-all hover:border-slate-400"
              >
                See How It Works
              </a>
            </div>

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
      {/* Three-column feature highlights */}
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
      {/* Visual representation of the process */}
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

              {/* Phase Indicators */}
              {[
                { num: 1, label: 'Deal Profile', color: 'emerald', complete: true },
                { num: 2, label: 'Positions', color: 'emerald', complete: true },
                { num: 3, label: 'Gap Analysis', color: 'blue', complete: true },
                { num: 4, label: 'Negotiation', color: 'blue', complete: false },
                { num: 5, label: 'Agreement', color: 'amber', complete: false },
                { num: 6, label: 'Execution', color: 'slate', complete: false },
              ].map((phase) => (
                <div key={phase.num} className="relative z-10 flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${phase.complete
                      ? phase.color === 'emerald' ? 'bg-emerald-500'
                        : phase.color === 'blue' ? 'bg-blue-500'
                          : 'bg-amber-500'
                      : 'bg-slate-300'
                    }`}>
                    {phase.complete ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      phase.num
                    )}
                  </div>
                  <span className="mt-2 text-xs font-medium text-slate-600">{phase.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Learn More CTA */}
          <div className="text-center mt-12">
            <a
              href="/phases"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Learn about each phase
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6: LEVERAGE VISUALIZATION PREVIEW */}
      {/* Shows the core product feature */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Description */}
              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-4">
                  See the Real Balance of Power
                </h2>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  CLARENCE calculates leverage based on market dynamics, economic factors,
                  strategic position, and alternatives. Both parties see the same analysis—making
                  negotiations fact-based, not emotion-driven.
                </p>
                <ul className="space-y-3">
                  {[
                    'Market dynamics analysis',
                    'Economic factors assessment',
                    'Strategic position evaluation',
                    'BATNA (alternatives) scoring',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-slate-700">
                      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Leverage Visualization Mock */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="text-sm font-semibold text-slate-700 mb-4">Leverage Balance</div>

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
                  {[
                    { factor: 'Market Dynamics', score: '+8', positive: true },
                    { factor: 'Economic Factors', score: '+4', positive: true },
                    { factor: 'Strategic Position', score: '-2', positive: false },
                    { factor: 'BATNA Strength', score: '+6', positive: true },
                  ].map((item) => (
                    <div key={item.factor} className="flex justify-between items-center p-2 bg-white rounded-lg">
                      <span className="text-sm text-slate-600">{item.factor}</span>
                      <span className={`text-sm font-semibold ${item.positive ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {item.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: CTA SECTION */}
      {/* Final call to action */}
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
            <a
              href="/auth/signup"
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
            >
              Get Started Free
            </a>
            <a
              href="/chat"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
            >
              Try the Demo
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 8: FOOTER */}
      {/* Minimal, professional footer */}
      {/* ================================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-6 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-white font-medium">CLARENCE</span>
            </div>

            {/* Links */}
            <div className="flex gap-8 text-sm">
              <a href="/how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="/phases" className="hover:text-white transition-colors">The 6 Phases</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
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