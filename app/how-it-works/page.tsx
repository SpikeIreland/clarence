import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'
import FeatureListItem from '../components/FeatureListItem'
import SectionCTA from '../components/SectionCTA'
import Footer from '../components/Footer'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How It Works | CLARENCE - The Create, Negotiate, Agree Platform',
  description:
    'A principled approach to contract negotiation. Transparent leverage, principled mediation, and a framework that guides both parties to agreements that reflect reality.',
}

// ============================================================================
// HOW IT WORKS / PLATFORM PAGE — REDESIGNED
// Location: app/how-it-works/page.tsx
//
// Repositioned as "Platform" page. Shows the Create/Negotiate/Agree journey
// with product callouts linking to individual product pages.
// ============================================================================

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 backdrop-blur rounded-full text-sm font-medium mb-8 border border-slate-600/50">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span className="text-slate-300">The Honest Broker</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              How Agreements Get Made
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              A principled approach that removes the theatre, reveals leverage,
              and guides both parties to agreements that reflect reality.
            </p>
          </div>
        </div>
      </section>

      {/* ── Value Propositions ───────────────────────────────────────── */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Collaboration Over Confrontation
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Clarence guides both parties toward the agreement itself — not
                advantage for one side.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💎</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Stronger Relationships
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Professionalism does not require hostility. Agreements made
                through Clarence start relationships on solid ground.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎓</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Expert-Level Knowledge
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every negotiation benefits from expertise akin to a specialist
                law partner with decades of experience.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Transparent Leverage
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Both parties see the same data. No hidden agendas. Truth is
                safer to disclose.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Visual Journey ───────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Your Agreement Journey
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From initial setup to signed agreement — see how CLARENCE guides
              you through every stage with intelligent, data-driven mediation.
            </p>
          </div>

          <div className="max-w-6xl mx-auto space-y-20">
            {/* ── STAGE 1: CREATE ──────────────────────────────────── */}
            <div id="create" className="scroll-mt-20">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-emerald-200">
                    <img
                      src="/images/contract-prep-preview.png"
                      alt="CLARENCE Contract Preparation"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full text-sm font-medium text-emerald-700 mb-4">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Step 1
                  </div>
                  <h3 className="text-3xl font-bold text-emerald-600 mb-4">
                    Create
                  </h3>
                  <p className="text-slate-600 mb-6 text-lg leading-relaxed">
                    Build your contract and gather the strategic intelligence
                    that powers data-driven negotiation. This is where CLARENCE
                    differentiates — capturing party-fit and leverage data{' '}
                    <em>before</em> negotiation begins.
                  </p>
                  <ul className="space-y-3 mb-6">
                    <FeatureListItem color="emerald">
                      Choose your pathway: QuickCreate, ContractCreate, or
                      Co-Create
                    </FeatureListItem>
                    <FeatureListItem color="emerald">
                      Both parties complete strategic assessments
                    </FeatureListItem>
                    <FeatureListItem color="emerald">
                      CLARENCE calculates party-fit scores and leverage
                      positions
                    </FeatureListItem>
                  </ul>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/products/quickcreate"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                    >
                      QuickCreate <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/products/contract-create"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                    >
                      ContractCreate <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/products/co-create"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200 transition-colors"
                    >
                      Co-Create <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* ── STAGE 2: NEGOTIATE ───────────────────────────────── */}
            <div id="negotiate" className="scroll-mt-20">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 rounded-full text-sm font-medium text-slate-700 mb-4">
                    <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                    Step 2
                  </div>
                  <h3 className="text-3xl font-bold text-slate-800 mb-4">
                    Negotiate
                  </h3>
                  <p className="text-slate-600 mb-6 text-lg leading-relaxed">
                    The heart of CLARENCE. Work through every clause with
                    principled mediation, real-time leverage visibility, and
                    intelligent trade-off suggestions.
                  </p>
                  <ul className="space-y-3 mb-6">
                    <FeatureListItem color="slate">
                      Three-panel workspace: clause navigation, negotiation,
                      CLARENCE chat
                    </FeatureListItem>
                    <FeatureListItem color="slate">
                      Real-time leverage bar shows negotiation dynamics
                    </FeatureListItem>
                    <FeatureListItem color="slate">
                      AI-suggested trade-offs for mutually beneficial
                      compromises
                    </FeatureListItem>
                  </ul>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/products/negotiate"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                    >
                      Negotiate <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/products/training"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                    >
                      Training Studio & Academy <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="order-1 md:order-2 bg-slate-100 rounded-2xl p-6 border border-slate-300">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-slate-200">
                    <img
                      src="/images/contract-studio-preview.png"
                      alt="CLARENCE Contract Studio"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── STAGE 3: AGREE ───────────────────────────────────── */}
            <div id="agree" className="scroll-mt-20">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="bg-violet-50 rounded-2xl p-6 border border-violet-200">
                  <div className="rounded-lg overflow-hidden shadow-lg border border-violet-200">
                    <img
                      src="/images/document-centre-preview.png"
                      alt="CLARENCE Document Centre"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 rounded-full text-sm font-medium text-violet-700 mb-4">
                    <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
                    Step 3
                  </div>
                  <h3 className="text-3xl font-bold text-violet-600 mb-4">
                    Agree
                  </h3>
                  <p className="text-slate-600 mb-6 text-lg leading-relaxed">
                    Complete your negotiation with comprehensive documentation.
                    Every decision, every trade-off, every compromise — captured
                    in a professional evidence package.
                  </p>
                  <ul className="space-y-3">
                    <FeatureListItem color="violet">
                      Executive summary for leadership sign-off
                    </FeatureListItem>
                    <FeatureListItem color="violet">
                      Leverage assessment report with detailed calculations
                    </FeatureListItem>
                    <FeatureListItem color="violet">
                      Complete audit trail and chat transcripts
                    </FeatureListItem>
                    <FeatureListItem color="violet">
                      Contract Handbook for post-signature governance
                    </FeatureListItem>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three Pathways ───────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Choose Your Pathway
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Three ways to work with CLARENCE — each following the same
              principled framework, adapted to how you want to engage.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Link
              href="/products/quickcreate"
              className="bg-slate-50 rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">
                Quick Create
              </h3>
              <p className="text-xs text-slate-400 italic mb-3">
                Standard contracts, fast.
              </p>
              <p className="text-sm text-slate-600 mb-4">
                Upload or select a template. AI auto-configures clause ranges.
                Review, adjust, and send.
              </p>
              <span className="text-sm font-medium text-emerald-600 group-hover:text-emerald-700 inline-flex items-center gap-1">
                Learn more <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            <Link
              href="/products/contract-create"
              className="bg-white rounded-xl border-2 border-emerald-200 p-6 hover:shadow-lg transition-shadow relative group"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
                Most Popular
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">
                Contract Create
              </h3>
              <p className="text-xs text-slate-400 italic mb-3">
                Your contract, professionally mediated.
              </p>
              <p className="text-sm text-slate-600 mb-4">
                Bring your own template, complete the strategic assessment. Full
                leverage analysis and mediation.
              </p>
              <span className="text-sm font-medium text-emerald-600 group-hover:text-emerald-700 inline-flex items-center gap-1">
                Learn more <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            <Link
              href="/products/co-create"
              className="bg-slate-50 rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">
                Co-Create
              </h3>
              <p className="text-xs text-slate-400 italic mb-3">
                Built together, from the ground up.
              </p>
              <p className="text-sm text-slate-600 mb-4">
                No starting document. CLARENCE generates the clause set. Both
                parties shape the agreement collaboratively.
              </p>
              <span className="text-sm font-medium text-violet-600 group-hover:text-violet-700 inline-flex items-center gap-1">
                Learn more <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <SectionCTA
        title="This Is How Agreements Should Be Made"
        subtitle="Start with the Clarence Academy to learn the methodology, practise in the Training Studio, then bring principled negotiation to your real agreements."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{
          text: 'Explore the Academy',
          href: '/products/training',
        }}
      />

      <Footer />
    </main>
  )
}
