import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, X, Plus } from 'lucide-react'
import MainNavigation from '../components/MainNavigation'
import SectionCTA from '../components/SectionCTA'
import Footer from '../components/Footer'

export const metadata: Metadata = {
  title: 'Pricing | CLARENCE - Transparent, Confidence-First Pricing',
  description:
    'Start free. Run real negotiations from £299/month. Scale naturally with add-ons. No forced upgrades — Clarence grows with your team\'s confidence.',
}

// ============================================================================
// PRICING PAGE — MODEL C (CONFIDENCE-FIRST HYBRID)
// Location: app/pricing/page.tsx
//
// Architecture: Explore (free) · Platform (from £299/mo org) · Enterprise (custom)
// Platform add-ons: Additional Seat, Academy Seat, Training Studio, Playbook & Compliance
// Key change: Platform is per-organisation (3 seats included), not per-seat
// ============================================================================

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              Transparent Pricing. Obviously.
            </h1>
            <p className="text-xl text-slate-600 mb-6">
              Start by exploring. Come to the Platform when you're ready.
              Add capabilities as your team's confidence grows.
            </p>
            <p className="text-sm text-slate-400">
              No hidden fees. No forced upgrades. No theatre.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing Tiers ────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

            {/* EXPLORE */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
              <div className="p-6 border-b border-slate-100">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium mb-4">
                  Explore
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Discover the methodology
                </h3>
                <p className="text-slate-500 text-sm">
                  Have a look around. Learn the Clarence approach to principled
                  negotiation — on your own terms, at your own pace.
                </p>
              </div>

              <div className="p-6 bg-slate-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-800">Free</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  No credit card. No expiry. No pressure.
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  <FeatureItem>1 active contract (Quick Create)</FeatureItem>
                  <FeatureItem>Up to 2 respondents</FeatureItem>
                  <FeatureItem>Clarence Academy — full access + certification</FeatureItem>
                  <FeatureItem>Training Studio — Academy scenarios</FeatureItem>
                  <FeatureItem>50 AI interactions/month</FeatureItem>
                  <FeatureItem>Basic document package</FeatureItem>
                </ul>

                <Link
                  href="/request-trial"
                  className="block w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-center font-semibold rounded-lg transition-colors"
                >
                  Start Exploring
                </Link>

                <p className="text-xs text-slate-400 text-center mt-3">
                  Includes Clarence Academy certification
                </p>
              </div>
            </div>

            {/* PLATFORM — FEATURED */}
            <div className="bg-white rounded-2xl border-2 border-emerald-500 overflow-hidden shadow-lg relative">
              <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-center py-1 text-sm font-medium">
                Most Popular
              </div>

              <div className="p-6 border-b border-slate-100 pt-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-4">
                  Platform
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Run real negotiations
                </h3>
                <p className="text-slate-500 text-sm">
                  For teams actively negotiating contracts. Start with the base
                  and add capabilities as you need them.
                </p>
              </div>

              <div className="p-6 bg-emerald-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-500 font-medium">from</span>
                  <span className="text-4xl font-bold text-slate-800">£299</span>
                  <span className="text-slate-500">/ month</span>
                </div>
                <p className="text-sm text-emerald-700 mt-2">
                  Per organisation · 3 seats included · Add more as you grow
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  <FeatureItem highlight>3 team seats included</FeatureItem>
                  <FeatureItem highlight>Up to 10 active contracts</FeatureItem>
                  <FeatureItem>Quick Create — unlimited</FeatureItem>
                  <FeatureItem>Contract Create — full mediation suite</FeatureItem>
                  <FeatureItem>Clarence Academy — included for all seats</FeatureItem>
                  <FeatureItem>Unlimited AI interactions</FeatureItem>
                  <FeatureItem>Full document package</FeatureItem>
                  <FeatureItem>Email support (48hr response)</FeatureItem>
                </ul>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wide">
                    Optional add-ons
                  </p>
                  <ul className="space-y-1.5">
                    <AddOnItem label="Additional seat" price="£49/mo" />
                    <AddOnItem label="Academy seat" price="£29/mo" />
                    <AddOnItem label="Training Studio" price="£99/mo" />
                    <AddOnItem label="Playbook & Compliance" price="£149/mo" />
                  </ul>
                </div>

                <Link
                  href="/request-trial"
                  className="block w-full mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-600/25"
                >
                  Start with Platform — from £299/mo
                </Link>
              </div>
            </div>

            {/* ENTERPRISE */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
              <div className="p-6 border-b border-slate-100">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                  Enterprise
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Govern at scale
                </h3>
                <p className="text-slate-500 text-sm">
                  For organisations embedding Clarence as their negotiation
                  standard — with playbooks, risk visibility, and team development.
                </p>
              </div>

              <div className="p-6 bg-slate-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-800">Custom</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Scoped to your organisation's needs
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  <FeatureItem>Unlimited seats and contracts</FeatureItem>
                  <FeatureItem>Full playbook suite — build, verify, enforce</FeatureItem>
                  <FeatureItem>Admin risk dashboard — full outcome tracking</FeatureItem>
                  <FeatureItem>Training Studio — included for all seats</FeatureItem>
                  <FeatureItem>Clarence Academy — included + white-label option</FeatureItem>
                  <FeatureItem>SSO / SAML authentication</FeatureItem>
                  <FeatureItem>API access</FeatureItem>
                  <FeatureItem>Dedicated account manager</FeatureItem>
                </ul>

                <Link
                  href="/enterprise"
                  className="block w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-center font-semibold rounded-lg transition-colors"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Add-Ons ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-slate-800 mb-3">
                Platform Add-Ons
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto">
                Start with the base Platform and add capabilities when your team
                is ready for them. Add-ons are not upsells — they are the natural
                next step as confidence grows.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <AddOnCard
                title="Additional Seat"
                price="£49"
                unit="seat / month"
                description="One additional full team member with complete Platform access. Scale your team without an Enterprise conversation."
                tag="Growth"
                tagColor="emerald"
              />
              <AddOnCard
                title="Academy Seat"
                price="£29"
                unit="seat / month"
                description="A learning-pathway seat for new joiners and developing negotiators. Full Clarence Academy access, limited live contract exposure. Transitions to a full seat when they're ready."
                tag="Development"
                tagColor="amber"
                highlight
              />
              <AddOnCard
                title="Training Studio"
                price="£99"
                unit="organisation / month"
                description="Unlocks the full Training Studio for your entire organisation. Unlimited AI opponent sessions, post-session scoring, and debrief. Also activates the admin risk dashboard."
                tag="Practice"
                tagColor="violet"
              />
              <AddOnCard
                title="Playbook & Compliance"
                price="£149"
                unit="organisation / month"
                description="The full playbook lifecycle: build, verify, cross-check, and real-time enforcement during negotiation. One active playbook included. Additional playbooks at £49/mo each."
                tag="Governance"
                tagColor="slate"
              />
            </div>

            <div className="mt-8 p-5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-start gap-4">
                <div className="text-2xl">📋</div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Additional Contracts</p>
                  <p className="text-sm text-slate-500">
                    Platform includes 10 active contracts. Need more? Add contracts at{' '}
                    <span className="font-semibold text-slate-700">£15 per contract</span> — pay-per-use
                    for organisations with variable volume.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Example Configurations ───────────────────────────────────── */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-slate-800 mb-3">
                What Teams Actually Pay
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto">
                Every team starts with the base Platform and adds what they need.
                Revenue grows with confidence — not through forced tier jumps.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              <ScenarioCard
                title="Estate Agent"
                config="Platform base"
                seats={3}
                addOns={[]}
                monthly={299}
              />
              <ScenarioCard
                title="Mid-Market Outsourcer"
                config="Platform + 2 extra seats + Playbook"
                seats={5}
                addOns={['2 × Additional Seat', 'Playbook & Compliance']}
                monthly={546}
              />
              <ScenarioCard
                title="Law Firm (training focus)"
                config="Platform + Training Studio + 5 Academy Seats"
                seats={3}
                addOns={['Training Studio', '5 × Academy Seats']}
                monthly={543}
                highlight
              />
              <ScenarioCard
                title="Procurement Team"
                config="Platform + 4 seats + Playbook + Training"
                seats={7}
                addOns={['4 × Additional Seat', 'Playbook & Compliance', 'Training Studio']}
                monthly={743}
              />
            </div>

            <p className="text-center text-xs text-slate-400 mt-6">
              Respondents (the other party in a negotiation) always participate free of charge.
              Only the initiating organisation needs a subscription.
            </p>
          </div>
        </div>
      </section>

      {/* ── Product Access by Tier ────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
              Product Access by Plan
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-4 px-4 font-semibold text-slate-800">Product</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">Explore</th>
                    <th className="text-center py-4 px-4 font-semibold text-emerald-600">Platform</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <ProductRow label="Quick Create" explore={true} platform={true} enterprise={true} />
                  <ProductRow label="Contract Create" explore={false} platform={true} enterprise={true} />
                  <ProductRow label="Co-Create" explore={false} platform={true} enterprise={true} />
                  <ProductRow label="Clarence Academy" explore="Full access + certification" platform="Included" enterprise="Included + white-label" />
                  <ProductRow label="Training Studio" explore="Academy scenarios only" platform="+ Add-on (£99/mo)" enterprise="Included" />
                  <ProductRow label="Playbook & Compliance" explore={false} platform="+ Add-on (£149/mo)" enterprise="Included" />
                  <ProductRow label="Admin Risk Dashboard" explore={false} platform="Basic (with Training add-on)" enterprise="Full · outcome tracking" />
                  <ProductRow label="Document Package" explore="Basic" platform="Full" enterprise="Full + custom branding" />
                  <ProductRow label="SSO / API" explore={false} platform={false} enterprise={true} />
                  <ProductRow label="Tendering" explore={false} platform={false} enterprise={true} note="Coming soon" />
                  <ProductRow label="Sign" explore={false} platform={true} enterprise={true} note="Coming soon" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Comparison ───────────────────────────────────────── */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
              Feature Comparison
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-4 px-4 font-semibold text-slate-800">Feature</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">Explore</th>
                    <th className="text-center py-4 px-4 font-semibold text-emerald-600">Platform</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <ComparisonRow label="Active contracts" explore="1" platform="10 included" enterprise="Unlimited" />
                  <ComparisonRow label="Respondents per contract" explore="2" platform="5" enterprise="Unlimited" />
                  <ComparisonRow label="Team seats" explore="1" platform="3 included" enterprise="Unlimited" />
                  <ComparisonRow label="AI interactions" explore="50/month" platform="Unlimited" enterprise="Unlimited" />
                  <ComparisonRow label="Evidence Package" explore="Basic" platform="Full" enterprise="Full + Custom" />
                  <ComparisonRow label="Support" explore="Community" platform="Email (48hr)" enterprise="Priority + AM" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6">
              <FAQItem
                question="How does the Explore tier work?"
                answer="Explore is free, with no time limit and no credit card required. It gives you one active Quick Create contract, access to the full Clarence Academy (including certification), and Training Studio scenarios. It's designed for exactly what it's called — exploring the Clarence methodology on your own terms, at your own pace."
              />
              <FAQItem
                question="Why is Platform priced per organisation, not per seat?"
                answer="Because most of the value Clarence delivers is organisational — shared playbooks, consistent negotiation standards, team visibility. Charging per-seat penalises teams for growing. The base Platform includes 3 seats for £299/month. Additional seats are £49/month each, so a team of 6 pays £446/month — not six times the base price."
              />
              <FAQItem
                question="What's the difference between a full seat and an Academy Seat?"
                answer="An Academy Seat (£29/mo) is a learning-pathway seat for new joiners or developing negotiators. It includes full Clarence Academy access and Training Studio practice, but limits live contract exposure (observer role or maximum 2 active contracts). When they're ready, it transitions to a full seat at £49/mo."
              />
              <FAQItem
                question="When should I add the Training Studio?"
                answer="When your team wants to practise negotiation in a safe environment before — or between — live matters. The Training Studio unlocks unlimited AI opponent sessions calibrated to each person's specific weaknesses, plus post-session scoring and debrief. It also activates the admin risk dashboard, which connects contract outcomes to training needs."
              />
              <FAQItem
                question="When should I add the Playbook & Compliance add-on?"
                answer="When you want your negotiators working within defined organisational boundaries — not making ad hoc decisions on red lines. The Playbook add-on lets you build your policy, cross-check any contract template before negotiation begins, and enforce compliance in real-time during live sessions. One playbook is included; additional playbooks are £49/mo each."
              />
              <FAQItem
                question="Do respondents need a subscription?"
                answer="No. The counterparty in any negotiation — the respondent — participates entirely free of charge. Only the initiating organisation needs a Platform subscription. This is a deliberate design decision: we believe the barrier to collaborative, principled negotiation should be as low as possible for both sides."
              />
              <FAQItem
                question="What's included in the Evidence Package?"
                answer="The full Evidence Package includes an executive summary, leverage report, position history, chat transcripts, trade-off register, timeline audit, contract draft, and a Contract Handbook for ongoing governance. The basic package (Explore tier) includes the executive summary and contract draft."
              />
              <FAQItem
                question="What is Enterprise, exactly?"
                answer="Enterprise is for organisations embedding Clarence as their standard negotiation environment — not just adopting a piece of software. That typically means unlimited seats, full playbook infrastructure (build, verify, enforce), the admin risk dashboard with full outcome tracking, and the Clarence Academy with optional white-label certification. It's scoped and priced as a custom engagement."
              />
            </div>
          </div>
        </div>
      </section>

      <SectionCTA
        title="Start by Exploring. Commit When You're Ready."
        subtitle="The Clarence Academy is free — no credit card, no trial clock. Come to the Platform when you've seen enough to know it's right for your team."
        primaryCTA={{ text: 'Start Exploring', href: '/request-trial' }}
        secondaryCTA={{ text: 'Contact Sales', href: '/enterprise' }}
      />

      <Footer />
    </main>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function FeatureItem({
  children,
  highlight = false,
}: {
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${highlight ? 'text-emerald-600' : 'text-emerald-400'}`}
      />
      <span className={`text-sm ${highlight ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
        {children}
      </span>
    </li>
  )
}

function AddOnItem({ label, price }: { label: string; price: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Plus className="w-3 h-3 text-emerald-400" />
        {label}
      </span>
      <span className="text-xs font-semibold text-slate-600">{price}</span>
    </li>
  )
}

function AddOnCard({
  title,
  price,
  unit,
  description,
  tag,
  tagColor,
  highlight = false,
}: {
  title: string
  price: string
  unit: string
  description: string
  tag: string
  tagColor: 'emerald' | 'amber' | 'violet' | 'slate'
  highlight?: boolean
}) {
  const tagStyles: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    violet: 'bg-violet-100 text-violet-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div
      className={`rounded-xl border p-6 ${highlight
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-slate-200'
        }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${tagStyles[tagColor]}`}>
          {tag}
        </span>
        <div className="text-right">
          <span className="text-xl font-bold text-slate-800">{price}</span>
          <p className="text-xs text-slate-400 leading-tight">{unit}</p>
        </div>
      </div>
      <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  )
}

function ScenarioCard({
  title,
  config,
  seats,
  addOns,
  monthly,
  highlight = false,
}: {
  title: string
  config: string
  seats: number
  addOns: string[]
  monthly: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${highlight
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-white border-slate-200'
        }`}
    >
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="mb-4">
        <span className="text-3xl font-bold text-slate-800">£{monthly}</span>
        <span className="text-slate-400 text-sm">/mo</span>
      </div>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">{config}</p>
      <div className="pt-3 border-t border-slate-100 space-y-1">
        <p className="text-xs text-slate-400">
          {seats} {seats === 1 ? 'seat' : 'seats'} ·{' '}
          {addOns.length === 0 ? 'base only' : `${addOns.length} add-on${addOns.length > 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  )
}

function ProductRow({
  label,
  explore,
  platform,
  enterprise,
  note,
}: {
  label: string
  explore: boolean | string
  platform: boolean | string
  enterprise: boolean | string
  note?: string
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-4 px-4 text-slate-600">
        {label}
        {note && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">
            {note}
          </span>
        )}
      </td>
      <td className="py-4 px-4 text-center">
        <CellValue value={explore} />
      </td>
      <td className="py-4 px-4 text-center bg-emerald-50/50">
        <CellValue value={platform} />
      </td>
      <td className="py-4 px-4 text-center">
        <CellValue value={enterprise} />
      </td>
    </tr>
  )
}

function ComparisonRow({
  label,
  explore,
  platform,
  enterprise,
}: {
  label: string
  explore: string
  platform: string
  enterprise: string
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-4 px-4 text-slate-600">{label}</td>
      <td className="py-4 px-4 text-center text-slate-800">{explore}</td>
      <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">{platform}</td>
      <td className="py-4 px-4 text-center text-slate-800">{enterprise}</td>
    </tr>
  )
}

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-slate-600 text-sm">{value}</span>
  }
  if (value) {
    return <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
  }
  return <X className="w-5 h-5 text-slate-300 mx-auto" />
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <h3 className="font-semibold text-slate-800 mb-2">{question}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{answer}</p>
    </div>
  )
}