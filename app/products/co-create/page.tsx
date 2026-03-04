import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import MainNavigation from '@/app/components/MainNavigation'
import FeatureListItem from '@/app/components/FeatureListItem'
import ProductCard from '@/app/components/ProductCard'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { getProductBySlug } from '@/app/lib/products'
import { Users, FilePlus, Handshake, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Co-Create | CLARENCE - Collaborative Contract Building',
  description:
    'No starting document from either side. Clarence generates the clause set and both parties shape the agreement collaboratively from inception.',
}

export default function CoCreatePage() {
  const quickCreate = getProductBySlug('quickcreate')
  const contractCreate = getProductBySlug('contract-create')
  const negotiate = getProductBySlug('negotiate')

  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Product Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-violet-600 via-violet-500 to-purple-500 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-sm font-medium mb-8">
              <Users className="w-4 h-4" />
              <span>Contract Creation</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">Co-Create</h1>
            <p className="text-xl text-violet-100 max-w-2xl mx-auto leading-relaxed">
              Built together, from the ground up. No starting document from
              either side — Clarence generates the clause set and both parties
              shape the agreement collaboratively.
            </p>

            <div className="mt-10">
              <Link
                href="/request-trial"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-violet-600 font-semibold rounded-lg hover:bg-violet-50 transition-colors shadow-lg"
              >
                Try Co-Create Free
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
              <div className="rounded-2xl overflow-hidden border border-violet-200 shadow-lg">
                <Image
                  src="/images/cocreate-preview.png"
                  alt="Co-Create — collaborative contract building"
                  width={800}
                  height={450}
                  className="w-full h-auto"
                  priority
                />
              </div>

              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                  True Collaboration from Neutral Ground
                </h2>
                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                  Co-Create is the most collaborative pathway. Neither party
                  brings a starting document — Clarence generates the clause set
                  based on the contract type, and both parties shape every term
                  together.
                </p>
                <ul className="space-y-3">
                  <FeatureListItem color="violet">
                    AI-generated clause sets by contract type
                  </FeatureListItem>
                  <FeatureListItem color="violet">
                    Collaborative drafting from neutral ground
                  </FeatureListItem>
                  <FeatureListItem color="violet">
                    Both parties shape terms equally
                  </FeatureListItem>
                  <FeatureListItem color="violet">
                    Built-in leverage balancing
                  </FeatureListItem>
                  <FeatureListItem color="violet">
                    Full mediation support throughout
                  </FeatureListItem>
                  <FeatureListItem color="violet">
                    Complete audit trail of collaborative decisions
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
              How Co-Create Works
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Start from nothing, build together, agree on everything.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FilePlus className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                1. Clarence Generates
              </h3>
              <p className="text-sm text-slate-600">
                Select the contract type and Clarence generates a comprehensive
                clause set as the starting point.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                2. Shape Together
              </h3>
              <p className="text-sm text-slate-600">
                Both parties collaboratively refine each clause with AI
                mediation guiding the process.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">
                3. Reach Agreement
              </h3>
              <p className="text-sm text-slate-600">
                Finalise terms with full audit trail and evidence package
                documenting every decision.
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
                'New partnerships and joint ventures',
                'Equal-leverage deals',
                'Parties wanting neutral ground',
                'First-time business relationships',
              ].map((useCase) => (
                <div
                  key={useCase}
                  className="flex items-center gap-3 p-4 bg-violet-50 rounded-xl border border-violet-100"
                >
                  <div className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0"></div>
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
            {[quickCreate, contractCreate, negotiate]
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
        title="Ready to Build Together?"
        subtitle="Start from neutral ground with your free Co-Create trial."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'View Pricing', href: '/pricing' }}
      />

      <Footer />
    </main>
  )
}
