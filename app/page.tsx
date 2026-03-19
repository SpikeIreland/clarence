import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from './components/MainNavigation'
import HeroCTA from './components/HeroCTA'
import ProductCard from './components/ProductCard'
import SectionCTA from './components/SectionCTA'
import Footer from './components/Footer'
import { getFeaturedProducts } from './lib/products'
import { ArrowRight, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'CLARENCE | Agreements, Not Arguments',
  description:
    'The principled platform for contract creation, negotiation, and agreement. Neutral mediation that changes the structure, not the people.',
}

// ============================================================================
// LANDING PAGE — PRODUCT-FIRST DESIGN
// Location: app/page.tsx
//
// Sections:
// 1. Navigation
// 2. Hero — Product-first headline with Create/Negotiate/Agree subtitle
// 3. Product Showcase — Featured products grid
// 4. Journey — Condensed Create/Negotiate/Agree timeline
// 5. Platform Principles — Neutral/Transparent/Fair
// 6. CTA
// 7. Footer
// ============================================================================

export default function Home() {
  const featuredProducts = getFeaturedProducts()

  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ================================================================== */}
      {/* HERO SECTION — Product-first messaging                             */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30"></div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-violet-50/50 to-transparent"></div>

        <div className="relative container mx-auto px-6 py-28 md:py-36">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-medium mb-10">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span>The Honest Broker</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-slate-800">
              Agreements,{' '}
              <span className="text-emerald-600">not arguments</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
              The professional excellence platform for contract negotiation.
              Principled mediation, structured development, and a methodology
              that changes how agreements get made.
            </p>

            {/* Brand echo — Create/Negotiate/Agree */}
            <p className="text-lg mb-12 max-w-2xl mx-auto">
              <span className="text-emerald-600 font-medium">Create</span>
              <span className="text-slate-300 mx-2 font-light">·</span>
              <span className="text-slate-800 font-medium">Negotiate</span>
              <span className="text-slate-300 mx-2 font-light">·</span>
              <span className="text-violet-600 font-medium">Agree</span>
            </p>

            {/* CTA Buttons */}
            <HeroCTA />

            {/* Trust Indicators */}
            <div className="mt-16 flex items-center justify-center gap-8 text-sm text-slate-500 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Neutral by design</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Transparent leverage</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Fairness is not naivete</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PRODUCT SHOWCASE — Featured products grid                          */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              The Clarence Suite
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              A professional excellence platform — every tool built on the same
              principled methodology, from first negotiation to ongoing development.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {featuredProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View all products
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PROFESSIONAL EXCELLENCE LOOP                                       */}
      {/* ================================================================== */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              The Professional Excellence Loop
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Most platforms stop at the agreement. Clarence closes the loop —
              connecting how your team learns, practises, performs, and improves.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {/* Learn */}
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">1</span>
              </div>
              <h3 className="text-xl font-bold text-emerald-600 mb-2">
                Learn
              </h3>
              <p className="text-sm text-slate-600">
                Structured methodology through the Clarence Academy. Not a
                course — a professional standard for principled negotiation.
              </p>
            </div>

            {/* Practise */}
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-amber-600">2</span>
              </div>
              <h3 className="text-xl font-bold text-amber-600 mb-2">
                Practise
              </h3>
              <p className="text-sm text-slate-600">
                The Training Studio: rehearse real scenarios against intelligent
                opponents calibrated to your weaknesses. Build confidence before
                the stakes are real.
              </p>
            </div>

            {/* Perform */}
            <div className="text-center">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-slate-700">3</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Perform
              </h3>
              <p className="text-sm text-slate-600">
                Create, negotiate, and agree with full mediation support,
                leverage visibility, and playbook compliance. The methodology
                in action.
              </p>
            </div>

            {/* Measure */}
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-violet-600">4</span>
              </div>
              <h3 className="text-xl font-bold text-violet-600 mb-2">
                Measure
              </h3>
              <p className="text-sm text-slate-600">
                Performance scorecards, outcome analytics, and playbook
                compliance tracking. Weaknesses feed back into targeted
                development.
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              Explore the methodology
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* RISK PROTECTION — Playbook lifecycle                               */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-white rounded-full text-sm font-medium mb-4">
              <Shield className="w-4 h-4" />
              <span>Risk Protection</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Never Sign Blind
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Your negotiation playbook is your organisation&apos;s line of defence.
              Clarence helps you build it, verify it, and enforce it — so every
              agreement reflects your standards, not just the other party&apos;s draft.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-lg font-bold text-emerald-600">1</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Build Your Playbook
              </h3>
              <p className="text-sm text-slate-600">
                Define your red lines, acceptable ranges, and escalation rules.
                Self-service AI tools or managed service — no law firm fees required.
              </p>
            </div>

            <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-lg font-bold text-emerald-600">2</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Verify the Parse
              </h3>
              <p className="text-sm text-slate-600">
                See exactly how Clarence interprets your playbook. Check every
                rule, every threshold, every escalation path before it goes live.
              </p>
            </div>

            <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-lg font-bold text-emerald-600">3</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Cross-Check Before You Start
              </h3>
              <p className="text-sm text-slate-600">
                Run any contract template against your playbook before negotiation
                begins. Identify exposure, flag gaps, reduce risk at the source.
              </p>
            </div>

            <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-lg font-bold text-emerald-600">4</span>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Enforce During Negotiation
              </h3>
              <p className="text-sm text-slate-600">
                Real-time compliance checking throughout. Red line breach alerts,
                flexibility tracking, and escalation triggers — automatically.
              </p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/enterprise"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Learn about playbook services
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PLATFORM PRINCIPLES — Neutral / Transparent / Fair                 */}
      {/* ================================================================== */}
      <section className="py-16 bg-slate-800">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-4 md:gap-8 mb-6">
              <span className="text-2xl md:text-3xl font-bold text-emerald-400">
                Neutral
              </span>
              <span className="text-slate-600 text-2xl font-light">·</span>
              <span className="text-2xl md:text-3xl font-bold text-slate-300">
                Transparent
              </span>
              <span className="text-slate-600 text-2xl font-light">·</span>
              <span className="text-2xl md:text-3xl font-bold text-violet-400">
                Fair
              </span>
            </div>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              A professional excellence platform built on principled
              methodology. CLARENCE does not just facilitate agreements — it
              develops the practitioners who make them.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA + FOOTER                                                       */}
      {/* ================================================================== */}
      <SectionCTA
        title="Change the Structure, Not the People"
        subtitle="Better environments produce better decisions. Better decisions produce better agreements. Better agreements produce better relationships. Start with the Clarence Academy."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'Explore the Academy', href: 'https://academy.clarencelegal.ai' }}
      />

      <Footer />
    </main>
  )
}
