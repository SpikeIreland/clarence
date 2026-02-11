import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'

// ============================================================================
// SECTION 1: HOW IT WORKS PAGE
// Location: app/how-it-works/page.tsx
// 
// RESTRUCTURED VERSION - Visual journey with screenshots
// Screenshots for Create, Negotiate, Agree stages
// Value propositions moved here from Landing Page
// 
// SCREENSHOTS REQUIRED:
// - /images/contract-prep-preview.png (Create stage)
// - /images/contract-studio-preview.png (Negotiate stage)
// - /images/document-centre-preview.png (Agree stage)
// ============================================================================

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 2: NAVIGATION */}
      {/* ================================================================== */}
      <MainNavigation />

      {/* ================================================================== */}
      {/* SECTION 3: HERO */}
      {/* ================================================================== */}
      <section className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 backdrop-blur rounded-full text-sm font-medium mb-8 border border-slate-600/50">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span className="text-slate-300">The Honest Broker</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              How CLARENCE Works
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              A principled approach to contract negotiation that removes emotion,
              reveals leverage, and guides both parties to fair agreements.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 4: VALUE PROPOSITIONS */}
      {/* Moved from Landing Page */}
      {/* ================================================================== */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">

            {/* Collaboration */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Collaboration Over Confrontation</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                CLARENCE guides both parties toward mutually beneficial outcomes rather than adversarial winners and losers.
              </p>
            </div>

            {/* Relationships */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💎</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Stronger Relationships</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Remove the emotional friction from negotiations. Start your business relationship on positive terms.
              </p>
            </div>

            {/* Expertise */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎓</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Expert-Level Knowledge</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every negotiation benefits from expertise akin to a specialist law partner with decades of experience.
              </p>
            </div>

            {/* Leverage */}
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Transparent Leverage</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Both parties see the same data. No hidden agendas—just facts that drive fair, realistic negotiations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 5: VISUAL JOURNEY - CREATE, NEGOTIATE, AGREE */}
      {/* Each stage with screenshot */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Your Contract Journey
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From initial setup to signed agreement—see how CLARENCE guides you through
              every stage with intelligent, data-driven mediation.
            </p>
          </div>

          <div className="max-w-6xl mx-auto space-y-20">

            {/* ============================================================ */}
            {/* STAGE 1: CREATE */}
            {/* ============================================================ */}
            <div id="create" className="scroll-mt-20">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Screenshot */}
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-emerald-200">
                    <img
                      src="/images/contract-prep-preview.png"
                      alt="CLARENCE Contract Preparation - Build your contract and gather strategic intelligence"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full text-sm font-medium text-emerald-700 mb-4">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Step 1
                  </div>
                  <h3 className="text-3xl font-bold text-emerald-600 mb-4">
                    Create
                  </h3>
                  <p className="text-slate-600 mb-6 text-lg leading-relaxed">
                    Build your contract and gather the strategic intelligence that powers
                    data-driven negotiation. This is where CLARENCE differentiates—capturing
                    party-fit and leverage data <em>before</em> negotiation begins.
                  </p>
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Choose mediation level: Quick to Contract, Partial, or Full Mediation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Both parties complete strategic assessments—priorities, constraints, alternatives</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>CLARENCE calculates party-fit scores and leverage positions from submitted data</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>This upfront intelligence removes guesswork and enables truly objective mediation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* STAGE 2: NEGOTIATE */}
            {/* ============================================================ */}
            <div id="negotiate" className="scroll-mt-20">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Content (on left for variety) */}
                <div className="order-2 md:order-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 rounded-full text-sm font-medium text-slate-700 mb-4">
                    <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                    Step 2
                  </div>
                  <h3 className="text-3xl font-bold text-slate-800 mb-4">
                    Negotiate
                  </h3>
                  <p className="text-slate-600 mb-6 text-lg leading-relaxed">
                    The heart of CLARENCE. Work through every clause with AI-powered mediation,
                    real-time leverage tracking, and intelligent trade-off suggestions that
                    guide both parties toward agreement.
                  </p>
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Three-panel workspace: clause navigation, negotiation area, CLARENCE chat</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Real-time leverage bar shows negotiation dynamics and position strength</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>AI-suggested trade-offs help parties find mutually beneficial compromises</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Industry-standard position references for benchmarking decisions</span>
                    </li>
                  </ul>
                </div>

                {/* Screenshot */}
                <div className="order-1 md:order-2 bg-slate-100 rounded-2xl p-6 border border-slate-300">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200">
                    <img
                      src="/images/contract-studio-preview.png"
                      alt="CLARENCE Contract Studio - AI-powered negotiation interface"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* STAGE 3: AGREE */}
            {/* ============================================================ */}
            <div id="agree" className="scroll-mt-20">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Screenshot */}
                <div className="bg-violet-50 rounded-2xl p-6 border border-violet-200">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-violet-200">
                    <img
                      src="/images/document-centre-preview.png"
                      alt="CLARENCE Document Centre - Complete evidence package"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 rounded-full text-sm font-medium text-violet-700 mb-4">
                    <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
                    Step 3
                  </div>
                  <h3 className="text-3xl font-bold text-violet-600 mb-4">
                    Agree
                  </h3>
                  <p className="text-slate-600 mb-6 text-lg leading-relaxed">
                    Complete your negotiation with comprehensive documentation. Every decision,
                    every trade-off, every compromise—captured in a professional evidence package
                    that supports ongoing contract governance.
                  </p>
                  <ul className="space-y-3 text-slate-600">
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Executive summary for leadership sign-off</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Leverage assessment report with detailed calculations</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Complete audit trail and chat transcripts</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Contract Handbook for post-signature governance</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 6: MEDIATION LEVELS */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Choose Your Mediation Level
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              CLARENCE adapts to your needs—from quick standard agreements to
              fully negotiable complex contracts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Quick to Contract */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Quick to Contract
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Standard template with minimal negotiation. Perfect for routine
                agreements like NDAs or standard service terms.
              </p>
              <div className="text-xs text-slate-500">
                <span className="font-medium">Best for:</span> Simple, routine contracts
              </div>
            </div>

            {/* Partial Mediation */}
            <div className="bg-white rounded-xl border-2 border-emerald-200 p-6 hover:shadow-lg transition-shadow relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
                Most Popular
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Partial Mediation
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Most terms fixed (~85%) with specific clauses open for negotiation.
                Ideal when you need flexibility on key points.
              </p>
              <div className="text-xs text-slate-500">
                <span className="font-medium">Best for:</span> Standard contracts with key negotiables
              </div>
            </div>

            {/* Full Mediation */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Full Mediation
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                All contract terms are negotiable. Best for complex deals, strategic
                partnerships, or bespoke agreements.
              </p>
              <div className="text-xs text-slate-500">
                <span className="font-medium">Best for:</span> Complex, high-value negotiations
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 7: CTA */}
      {/* ================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Negotiations?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Start with the Training Studio to experience CLARENCE risk-free,
            then bring those skills to your real contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/request-trial"
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25"
            >
              Request Free Trial
            </Link>
            <Link
              href="/training"
              className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-all"
            >
              Try Training Studio
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