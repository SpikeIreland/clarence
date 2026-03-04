import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import MainNavigation from '@/app/components/MainNavigation'
import FeatureListItem from '@/app/components/FeatureListItem'
import ProductCard from '@/app/components/ProductCard'
import SectionCTA from '@/app/components/SectionCTA'
import Footer from '@/app/components/Footer'
import { getProductBySlug } from '@/app/lib/products'
import { GraduationCap, Target, Bot, UsersRound, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Training Studio | CLARENCE - Contract Negotiation Training',
  description:
    'Master contract negotiation in a risk-free environment. Train your team on company playbooks, practice with AI opponents, and prepare for important deals.',
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
              <span>Practice Mode</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Training Studio
            </h1>
            <p className="text-xl text-amber-100 max-w-2xl mx-auto leading-relaxed">
              Master contract negotiation in a risk-free environment. Train your
              team, practice with AI opponents, and prepare for important deals
              before going live.
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
                <Image
                  src="/images/training-preview.png"
                  alt="Training Studio — contract negotiation training environment"
                  width={800}
                  height={450}
                  className="w-full h-auto"
                  priority
                />
              </div>

              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                  Learn by Doing — Without the Risk
                </h2>
                <p className="text-slate-600 mb-8 text-lg leading-relaxed">
                  The Training Studio provides a safe environment to develop
                  negotiation skills, test strategies, and prepare teams for
                  high-stakes deals. Every training session uses the same
                  AI-powered mediation as live contracts.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        No Real Commitments
                      </h3>
                      <p className="text-sm text-slate-600">
                        Practice negotiations without any binding obligations.
                        Make mistakes, learn, improve.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        AI Opponents
                      </h3>
                      <p className="text-sm text-slate-600">
                        Negotiate against intelligent AI with adjustable
                        difficulty — from beginner to expert.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <UsersRound className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        Team Practice
                      </h3>
                      <p className="text-sm text-slate-600">
                        Run multi-player sessions with colleagues to sharpen
                        skills before important deals.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">
                        Progress Tracking
                      </h3>
                      <p className="text-sm text-slate-600">
                        Monitor skill development and identify areas for
                        improvement over time.
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
              Training Scenarios
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Pre-built scenarios covering common contract types and negotiation
              challenges.
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
                Company Playbook Integration
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Train your team on your actual negotiation playbooks and
                contract standards.
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Customise Training to Your Business
                  </h3>
                  <ul className="space-y-3">
                    <FeatureListItem color="amber">
                      Upload your company's clause playbooks and position guides
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
                    Promote to Live Contracts
                  </h3>
                  <ul className="space-y-3">
                    <FeatureListItem color="amber">
                      Successful training contracts can become live templates
                    </FeatureListItem>
                    <FeatureListItem color="amber">
                      Seamless transition from practice to production
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
        title="Ready to Start Training?"
        subtitle="Build your team's negotiation skills risk-free with the Training Studio."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'See How It Works', href: '/how-it-works' }}
      />

      <Footer />
    </main>
  )
}
