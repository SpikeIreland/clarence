import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from './components/MainNavigation'
import HeroCTA from './components/HeroCTA'

export const metadata: Metadata = {
  title: 'CLARENCE | AI-Powered Contract Mediation - The Honest Broker',
  description: 'Remove the emotion from contract negotiation. CLARENCE is the AI-powered honest broker that helps both parties reach fair agreements faster through transparent leverage and principled mediation.',
}

// ============================================================================
// SECTION 1: MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 2: NAVIGATION HEADER */}
      {/* ================================================================== */}
      <MainNavigation />

      {/* ================================================================== */}
      {/* SECTION 3: HERO SECTION */}
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

            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 tracking-tight">
              AI-Powered Contract Mediation
            </h1>

            {/* Subheadline - Key Message */}
            <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
              Remove the emotion. See the leverage. Reach fair agreements faster.
            </p>

            {/* Supporting Text */}
            <p className="text-base text-slate-500 mb-8 max-w-2xl mx-auto">
              CLARENCE guides both parties through principled, transparent negotiation—
              creating balanced contracts without the stress of traditional red-lining.
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
      {/* SECTION 4: VALUE PROPOSITION CARDS */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
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
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all group">
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
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all group">
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
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all group">
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
      {/* SECTION 5: THREE STUDIOS - Training, Tendering, Contracts */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Training, Tendering, Contracting
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Three integrated studios that cover your complete contract lifecycle—from
              learning to negotiating to documenting.
            </p>
          </div>

          {/* Studio Cards */}
          <div className="space-y-12 max-w-5xl mx-auto">

            {/* ============================================================ */}
            {/* STUDIO 1: Training Studio */}
            {/* ============================================================ */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
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
            {/* STUDIO 2: Contract Studio */}
            {/* ============================================================ */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Screenshot (reversed order) */}
                <div className="bg-slate-100 flex items-center justify-center p-6 order-2 md:order-1">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200 w-full">
                    <img
                      src="/images/contract-studio-preview.png"
                      alt="CLARENCE Contract Studio - AI-powered contract negotiation"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
                {/* Content */}
                <div className="p-8 flex flex-col justify-center order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium w-fit mb-4">
                    <span>⚖️</span>
                    <span>Contract Studio</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-3">
                    Where AI-Powered Negotiation Meets Gamification
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Live, AI-mediated negotiation with real-time leverage tracking.
                    Work through clauses collaboratively, guided by CLARENCE's
                    principled approach to agreement.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-500">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Three-panel workspace with clause navigation
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Real-time leverage baseline and tracker
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
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
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
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
      {/* SECTION 6: GAMIFICATION - Make Negotiation Fun */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Make Negotiation Fun!
            </h2>
            <p className="text-slate-600 mb-12 max-w-2xl mx-auto">
              CLARENCE transforms contract negotiation from a stressful chore into an
              engaging, satisfying experience with real-time feedback and progress tracking.
            </p>

            {/* Gamification Features */}
            <div className="grid md:grid-cols-3 gap-8">
              {/* Real-Time Progress */}
              <div className="text-center">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Real-Time Progress</h3>
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
                <h3 className="font-semibold text-slate-800 mb-2">Alignment Scores</h3>
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
                <h3 className="font-semibold text-slate-800 mb-2">Achievement Milestones</h3>
                <p className="text-sm text-slate-600">
                  Celebrate progress with milestone markers as you move through each stage toward agreement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: HOW IT WORKS - Simplified */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              How CLARENCE Works
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From setup to signed agreement—a structured, principled approach.
            </p>
          </div>

          {/* Three Step Process */}
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1: Create */}
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                  1
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Create</h3>
                <p className="text-sm text-slate-600">
                  Set up your contract through our guided intake. Choose your mediation
                  level—from standard templates to fully negotiable terms.
                </p>
              </div>

              {/* Step 2: Negotiate */}
              <div className="text-center">
                <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                  2
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Negotiate</h3>
                <p className="text-sm text-slate-600">
                  Work through clauses in the Contract Studio. CLARENCE tracks leverage,
                  suggests trade-offs, and guides both parties toward agreement.
                </p>
              </div>

              {/* Step 3: Agree */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                  3
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Agree</h3>
                <p className="text-sm text-slate-600">
                  Generate your complete evidence package—contract draft, audit trail,
                  and governance handbook—all ready for signature.
                </p>
              </div>
            </div>

            {/* Learn More Link */}
            <div className="text-center mt-12">
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                Learn more about our process
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 8: VIDEO PLACEHOLDER (Commented out for now) */}
      {/* ================================================================== */}
      {/* 
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              See CLARENCE in Action
            </h2>
            <p className="text-slate-600 mb-8">
              Watch how CLARENCE transforms contract negotiation.
            </p>
            <div className="aspect-video bg-slate-200 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-slate-500">Video Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}

      {/* ================================================================== */}
      {/* SECTION 9: CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-6 text-center">
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
      {/* SECTION 10: FOOTER */}
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
            <p className="text-slate-500 mt-1">Remove the emotion. See the leverage. Reach fair agreements faster.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}