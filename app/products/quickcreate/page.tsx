import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '@/app/components/MainNavigation'
import FeatureListItem from '@/app/components/FeatureListItem'
import ProductCard from '@/app/components/ProductCard'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { getProductBySlug } from '@/app/lib/products'
import { Zap, Upload, Send, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'QuickCreate | CLARENCE - Rapid Contract Creation from Templates',
  description:
    'Upload or select a template and let Clarence handle the rest. AI auto-configures clause ranges and positions for rapid contract creation and sending.',
}

export default function QuickCreatePage() {
  const contractCreate = getProductBySlug('contract-create')
  const coCreate = getProductBySlug('co-create')
  const negotiate = getProductBySlug('negotiate')

  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Product Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              <span>Contract Creation</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              QuickCreate
            </h1>
            <p className="text-xl text-emerald-100 max-w-2xl mx-auto leading-relaxed">
              Standard contracts, fast. Upload or select a template and let
              Clarence handle the rest — review, adjust, and send without full
              mediation.
            </p>

            <div className="mt-10">
              <Link
                href="/request-trial"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transition-colors shadow-lg"
              >
                Try QuickCreate Free
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
              <div className="rounded-2xl overflow-hidden border border-emerald-200 shadow-lg">
                <img
                  src="/images/quickcreate-preview.png"
                  alt="QuickCreate — rapid contract creation from templates"
                  className="w-full h-auto"
                />
              </div>

              {/* Features */}
              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                  Send Contracts in Minutes, Not Days
                </h2>
                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                  QuickCreate removes the complexity from routine contract
                  creation. Choose a template, let AI configure the clause
                  positions, and send to recipients — all in a streamlined
                  workflow.
                </p>
                <ul className="space-y-3">
                  <FeatureListItem color="emerald">
                    Template-based contract generation
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    AI auto-configured clause positions
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Multi-recipient sending and tracking
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Status tracking from draft to signature
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Support for NDAs, service agreements, leases, and more
                  </FeatureListItem>
                  <FeatureListItem color="emerald">
                    Quick review and send workflow
                  </FeatureListItem>
                </ul>
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
              How QuickCreate Works
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Three simple steps from template to sent contract.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                1. Choose Template
              </h3>
              <p className="text-sm text-slate-600">
                Upload your own contract or select from our library of
                pre-configured templates.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                2. Review & Adjust
              </h3>
              <p className="text-sm text-slate-600">
                AI auto-configures clause ranges and positions. Review and make
                any adjustments.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Send className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                3. Send & Track
              </h3>
              <p className="text-sm text-slate-600">
                Send to one or many recipients and track their status in
                real-time.
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
                'Routine agreements and renewals',
                'NDAs and confidentiality agreements',
                'Standard service terms',
                'Employment and contractor agreements',
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
            {[contractCreate, coCreate, negotiate]
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
        title="Ready to Send Your First Contract?"
        subtitle="Start with a free trial and send your first QuickCreate contract in minutes."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'View Pricing', href: '/pricing' }}
      />

      <Footer />
    </main>
  )
}
