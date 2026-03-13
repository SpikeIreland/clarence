import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '@/app/components/MainNavigation'
import FeatureListItem from '@/app/components/FeatureListItem'
import ProductCard from '@/app/components/ProductCard'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { getProductBySlug } from '@/app/lib/products'
import { MessageSquare, Columns3, BarChart2, Lightbulb } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Negotiate | CLARENCE - Principled Contract Mediation',
  description:
    'The heart of Clarence. Clause-by-clause mediation with real-time leverage visibility, trade-off suggestions, and industry benchmarking. Both sides see the same data.',
}

export default function NegotiatePage() {
  const contractCreate = getProductBySlug('contract-create')
  const training = getProductBySlug('training')
  const coCreate = getProductBySlug('co-create')

  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Product Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-sm font-medium mb-8 border border-slate-600/50">
              <MessageSquare className="w-4 h-4" />
              <span>Negotiation</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">Negotiate</h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              The heart of Clarence. Clause-by-clause mediation with real-time
              leverage visibility and intelligent trade-off suggestions. Both
              parties see the same data.
            </p>

            <div className="mt-10">
              <Link
                href="/request-trial"
                className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors shadow-lg"
              >
                Try Negotiate Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Features ─────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                  Where Agreements Are Made
                </h2>
                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                  The negotiation workspace is where Clarence truly
                  differentiates. A three-panel interface provides clause
                  navigation, the negotiation area, and Clarence guidance — all
                  powered by the leverage data gathered during creation.
                  Transparency here is not weakness. It is the foundation.
                </p>
                <ul className="space-y-3">
                  <FeatureListItem color="slate">
                    Three-panel negotiation workspace
                  </FeatureListItem>
                  <FeatureListItem color="slate">
                    Real-time leverage bar and position tracking
                  </FeatureListItem>
                  <FeatureListItem color="slate">
                    AI-suggested trade-offs and compromises
                  </FeatureListItem>
                  <FeatureListItem color="slate">
                    Industry-standard position benchmarking
                  </FeatureListItem>
                  <FeatureListItem color="slate">
                    Clause-by-clause mediation guidance
                  </FeatureListItem>
                  <FeatureListItem color="slate">
                    Complete negotiation audit trail
                  </FeatureListItem>
                </ul>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-300 shadow-lg">
                <img
                  src="/images/negotiate-preview.png"
                  alt="Negotiate — AI-mediated contract negotiation workspace"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Three Panels ─────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              The Negotiation Workspace
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Three integrated panels that work together toward agreements
              that reflect reality.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Columns3 className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Clause Navigation
              </h3>
              <p className="text-sm text-slate-600">
                Browse all clauses, see their status, and jump directly to any
                point in the negotiation.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Negotiation Area
              </h3>
              <p className="text-sm text-slate-600">
                The active negotiation space with leverage bars, position
                tracking, and party chat.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                Clarence AI
              </h3>
              <p className="text-sm text-slate-600">
                Intelligent guidance, trade-off suggestions, and industry
                benchmarks to inform decisions. With an active playbook, your
                compliance score and red line proximity are tracked in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use Cases ────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center">
              Best For
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                'Multi-party contract negotiations',
                'Complex clause-by-clause discussions',
                'Procurement and vendor negotiations',
                'High-stakes commercial agreements',
              ].map((useCase) => (
                <div
                  key={useCase}
                  className="flex items-center gap-3 p-4 bg-slate-100 rounded-xl border border-slate-200"
                >
                  <div className="w-2 h-2 bg-slate-600 rounded-full flex-shrink-0"></div>
                  <span className="text-slate-700 font-medium">{useCase}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Related Products ─────────────────────────────────────────── */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
            Related Products
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[contractCreate, coCreate, training]
              .filter(Boolean)
              .map((product) => (
                <ProductCard
                  key={product!.slug}
                  product={product!}
                  showDescription={false}
                />
              ))}
          </div>
        </div>
      </section>

      <SectionCTA
        title="Ready to Negotiate with Principle?"
        subtitle="Experience principled mediation with your free trial."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'View Pricing', href: '/pricing' }}
      />

      <Footer />
    </main>
  )
}
