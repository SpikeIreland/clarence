import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '@/app/components/MainNavigation'
import FeatureListItem from '@/app/components/FeatureListItem'
import ProductCard from '@/app/components/ProductCard'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { getProductBySlug } from '@/app/lib/products'
import { GraduationCap, Target, Bot, UsersRound, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Training Studio | CLARENCE - Rehearse the Deal Before You Do the Deal',
  description:
    'A flight simulator for contract negotiation. Rehearse real scenarios, sharpen strategy on your own playbooks, and build confidence before the stakes are real.',
}

export default function TrainingPage() {
  const negotiate = getProductBySlug('negotiate')
  const contractCreate = getProductBySlug('contract-create')
  const quickCreate = getProductBySlug('quickcreate')

  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Product Hero ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-500 text-white py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-sm font-medium mb-8">
              <GraduationCap className="w-4 h-4" />
              <span>Flight Simulator</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Training Studio
            </h1>
            <p className="text-2xl font-semibold text-amber-200 mb-6">
              Rehearse the deal before you do the deal.
            </p>
            <p className="text-xl text-amber-100 max-w-2xl mx-auto leading-relaxed">
              A flight simulator for contract negotiation. Your team rehearses
              real scenarios against intelligent opponents, sharpens strategy on
              your own playbooks, and builds confidence — before the stakes are
              real.
            </p>

            <div className="mt-10">
              <Link
                href="/request-trial"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-amber-600 font-semibold rounded-lg hover:bg-amber-50 transition-colors shadow-lg"
              >
                Start Training Free
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
              <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-lg">
                <img
                  src="/images/training-preview.png"
                  alt="Training Studio — contract negotiation training environment"
                  className="w-full h-auto"
                />
              </div>

              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                  Every Pilot Trains Before They Fly
                </h2>
                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                  The Training Studio is your negotiation flight simulator. Same
                  instruments as the real thing — same mediation engine, same
                  leverage dynamics, same clause-by-clause structure. The only
                  difference: nothing is binding. Make mistakes. Test strategies.
                  Build muscle memory.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        Zero Consequences
                      </h3>
                      <p className="text-sm text-slate-600">
                        Crash and learn. Every training session uses the full
                        mediation engine but nothing is binding. Experiment
                        freely.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        Intelligent Opponents
                      </h3>
                      <p className="text-sm text-slate-600">
                        Negotiate against opponents calibrated from beginner to
                        expert. They adapt, push back, and make you sharper.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <UsersRound className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        Team War Games
                      </h3>
                      <p className="text-sm text-slate-600">
                        Run multi-player sessions with colleagues. Test your
                        playbook against your own people before facing the real
                        counterparty.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        Performance Scorecard
                      </h3>
                      <p className="text-sm text-slate-600">
                        Track improvement over time. See where you concede too
                        early, where you hold too long, and where you find
                        creative value.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Training Scenarios ───────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Mission Library
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Pre-built scenarios covering common contract types and negotiation
              challenges. Choose your mission.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: '🏢',
                title: 'BPO Contracts',
                desc: 'Business Process Outsourcing agreements with complex service levels and pricing.',
              },
              {
                icon: '☁️',
                title: 'SaaS Agreements',
                desc: 'Software subscription contracts with data handling and uptime requirements.',
              },
              {
                icon: '📋',
                title: 'Master Services',
                desc: 'Framework agreements that govern ongoing service relationships.',
              },
              {
                icon: '🔒',
                title: 'NDAs',
                desc: 'Confidentiality agreements with varying protection levels and terms.',
              },
            ].map((scenario) => (
              <div
                key={scenario.title}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                  <span className="text-2xl">{scenario.icon}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {scenario.title}
                </h3>
                <p className="text-sm text-slate-600">{scenario.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Company Playbook Integration ──────────────────────────────── */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 rounded-full text-sm font-medium text-amber-700 mb-4">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Enterprise Feature
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">
                Train on Your Actual Playbook
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Upload your negotiation standards. Verify how Clarence interprets
                them. Then score your team against your own rules — before a live
                deal is on the line.
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200">
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Load Your Rules of Engagement
                  </h3>
                  <ul className="space-y-3">
                    <FeatureListItem color="amber">
                      Upload your company&apos;s clause playbooks and position guides
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Define acceptable position ranges for each clause type
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Create scenarios based on real upcoming negotiations
                    </FeatureListItem>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Verify Before You Trust
                  </h3>
                  <ul className="space-y-3">
                    <FeatureListItem color="amber">
                      See exactly how Clarence parsed every rule in your playbook
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Check red line thresholds, escalation triggers, and flexibility ranges
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Run test negotiations to validate compliance scoring accuracy
                    </FeatureListItem>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    From Rehearsal to Reality
                  </h3>
                  <ul className="space-y-3">
                    <FeatureListItem color="amber">
                      When a training run goes well, promote it to a live template with one click
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Carry your strategy straight into the real negotiation
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Preserve learnings and refine approach before going live
                    </FeatureListItem>
                  </ul>
                </div>
              </div>
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
            {[negotiate, contractCreate, quickCreate]
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
        title="Ready to Log Your First Hours?"
        subtitle="Build your team's negotiation confidence in the flight simulator — then take what you've learned into the real thing."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'See How It Works', href: '/how-it-works' }}
      />

      <Footer />
    </main>
  )
}
