import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import MainNavigation from '@/app/components/MainNavigation'
import FeatureListItem from '@/app/components/FeatureListItem'
import ProductCard from '@/app/components/ProductCard'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { getProductBySlug } from '@/app/lib/products'
import { Scale, FileText, BarChart3, MessageSquare } from 'lucide-react'

export const metadata: Metadata = {
  title: 'ContractCreate | CLARENCE - Full Mediation Contract Creation',
  description:
    'Bring your own contract template, complete strategic assessment, and invite the other party. Full leverage analysis, three-position negotiation, and clause-by-clause mediation.',
}

export default function ContractCreatePage() {
  const quickCreate = getProductBySlug('quickcreate')
  const coCreate = getProductBySlug('co-create')
  const negotiate = getProductBySlug('negotiate')

  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Product Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-sm font-medium mb-8">
              <Scale className="w-4 h-4" />
              <span>Contract Creation</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              ContractCreate
            </h1>
            <p className="text-xl text-emerald-100 max-w-2xl mx-auto leading-relaxed">
              Your contract, professionally mediated. Full leverage analysis,
              three-position negotiation, and clause-by-clause AI mediation for
              serious agreements.
            </p>

            <div className="mt-10">
              <Link
                href="/request-trial"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-700 font-semibold rounded-lg hover:bg-emerald-50 transition-colors shadow-lg"
              >
                Try ContractCreate Free
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
                  Structured Negotiation with Data-Driven Intelligence
                </h2>
                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                  ContractCreate captures strategic intelligence from both
                  parties before negotiation begins. Party-fit scores, leverage
                  positions, and clause assessments power truly objective AI
                  mediation.
                </p>
                <ul className="space-y-3">
                  <FeatureListItem color="emerald">
                    Upload your own contract templates
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Strategic assessment for both parties
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Party-fit and leverage scoring
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Three-position negotiation framework
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Clause-by-clause AI mediation
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Full evidence package on completion
                  </FeatureListItem>
                </ul>
              </div>

              <div className="rounded-2xl overflow-hidden border border-emerald-200 shadow-lg">
                <Image
                  src="/images/contractcreate-preview.png"
                  alt="ContractCreate — full mediation contract creation"
                  width={800}
                  height={450}
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              How ContractCreate Works
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              From template upload to fully mediated agreement.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                1. Set Up Contract
              </h3>
              <p className="text-sm text-slate-600">
                Upload your template, configure clause positions, and complete
                the strategic assessment.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                2. Gather Intelligence
              </h3>
              <p className="text-sm text-slate-600">
                Both parties complete assessments. Clarence calculates party-fit
                scores and leverage positions.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                3. Negotiate & Agree
              </h3>
              <p className="text-sm text-slate-600">
                AI-mediated clause-by-clause negotiation with real-time leverage
                tracking and trade-off suggestions.
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
                'Procurement team negotiations',
                'Legal department contract workflows',
                'Enterprise contracts requiring structured negotiation',
                'High-value agreements with multiple stakeholders',
              ].map((useCase) => (
                <div
                  key={useCase}
                  className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100"
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></div>
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
            {[quickCreate, coCreate, negotiate]
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
        title="Ready to Start a Structured Negotiation?"
        subtitle="Experience full AI-mediated contract creation with your free trial."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'View Pricing', href: '/pricing' }}
      />

      <Footer />
    </main>
  )
}
