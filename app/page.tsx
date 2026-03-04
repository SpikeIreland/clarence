import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from './components/MainNavigation'
import HeroCTA from './components/HeroCTA'
import ProductCard from './components/ProductCard'
import SectionCTA from './components/SectionCTA'
import Footer from './components/Footer'
import { getFeaturedProducts } from './lib/products'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'CLARENCE | AI-Powered Contract Intelligence Platform',
  description:
    'The complete platform for contract intelligence. From creation to signature — ten products that transform how organisations create, negotiate, and agree.',
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

            {/* Product-first headline */}
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight text-slate-800">
              The complete platform for{' '}
              <span className="text-emerald-600">contract intelligence</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto leading-relaxed">
              From creation to signature. AI-powered products that transform how
              organisations create, negotiate, and agree.
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
                <span>Neutral Mediation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Data-Driven Leverage</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span>Enterprise Security</span>
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
              Our Products
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              A comprehensive suite of AI-powered tools for every stage of the
              contract lifecycle.
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
      {/* JOURNEY SECTION — Condensed Create/Negotiate/Agree                 */}
      {/* ================================================================== */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Your Contract Journey
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              A principled framework that guides every contract from setup to
              signature.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Create */}
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">1</span>
              </div>
              <h3 className="text-xl font-bold text-emerald-600 mb-2">
                Create
              </h3>
              <p className="text-sm text-slate-600">
                Build your contract and gather strategic intelligence — party-fit
                and leverage data that powers objective negotiation.
              </p>
            </div>

            {/* Negotiate */}
            <div className="text-center">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-slate-700">2</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Negotiate
              </h3>
              <p className="text-sm text-slate-600">
                AI-mediated clause-by-clause negotiation with real-time leverage
                tracking and intelligent trade-off suggestions.
              </p>
            </div>

            {/* Agree */}
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-violet-600">3</span>
              </div>
              <h3 className="text-xl font-bold text-violet-600 mb-2">Agree</h3>
              <p className="text-sm text-slate-600">
                Complete evidence package for every negotiation — executive
                summaries, audit trails, and governance handbook.
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              See how the platform works
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
              CLARENCE mediates with no hidden agendas, full leverage
              visibility, and a principled framework that serves both parties
              equally.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA + FOOTER                                                       */}
      {/* ================================================================== */}
      <SectionCTA
        title="Ready to Transform Your Negotiations?"
        subtitle="Join forward-thinking organisations using CLARENCE to achieve better contract outcomes with less stress."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'View Pricing', href: '/pricing' }}
      />

      <Footer />
    </main>
  )
}
