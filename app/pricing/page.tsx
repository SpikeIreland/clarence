import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, X } from 'lucide-react'
import MainNavigation from '../components/MainNavigation'
import SectionCTA from '../components/SectionCTA'
import Footer from '../components/Footer'

export const metadata: Metadata = {
  title: 'Pricing | CLARENCE - Simple, Transparent Pricing',
  description:
    'Flexible pricing for teams of all sizes. Professional plan from £300/seat/month. Start with a free trial or contact us for enterprise solutions.',
}

// ============================================================================
// PRICING PAGE — REDESIGNED
// Location: app/pricing/page.tsx
//
// Key changes:
// - Professional tier now shows £300/seat/month explicitly
// - Product-tier mapping added
// - Uses shared components (Footer, SectionCTA)
// - Refreshed visual design to match new site style
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
            <p className="text-xl text-slate-600">
              No hidden fees. No surprises. No theatre. Start with a free trial
              and scale as your team grows.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing Tiers ────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* STARTER / FREE TRIAL */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
              <div className="p-6 border-b border-slate-100">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium mb-4">
                  Explore
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Free Trial
                </h3>
                <p className="text-slate-500 text-sm">
                  Explore the Clarence methodology with your first contract —
                  on your own terms.
                </p>
              </div>

              <div className="p-6 bg-slate-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-800">£0</span>
                  <span className="text-slate-500">/ trial</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  1 contract session · Includes Clarence Academy access
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  <FeatureItem>1 active contract session</FeatureItem>
                  <FeatureItem>Up to 2 respondents</FeatureItem>
                  <FeatureItem>QuickCreate access</FeatureItem>
                  <FeatureItem>Full Training Studio access</FeatureItem>
                  <FeatureItem>Basic document package</FeatureItem>
                  <FeatureItem>50 AI interactions/month</FeatureItem>
                </ul>

                <Link
                  href="/request-trial"
                  className="block w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-center font-semibold rounded-lg transition-colors"
                >
                  Request Free Trial
                </Link>
              </div>
            </div>

            {/* PROFESSIONAL — FEATURED */}
            <div className="bg-white rounded-2xl border-2 border-emerald-500 overflow-hidden shadow-lg relative">
              <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-center py-1 text-sm font-medium">
                Most Popular
              </div>

              <div className="p-6 border-b border-slate-100 pt-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-4">
                  Platform
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Growing Teams
                </h3>
                <p className="text-slate-500 text-sm">
                  For procurement teams running regular contract negotiations.
                </p>
              </div>

              <div className="p-6 bg-emerald-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-800">
                    £300
                  </span>
                  <span className="text-slate-500">/ month</span>
                </div>
                <p className="text-sm text-emerald-700 mt-2">
                  Per seat, billed monthly
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  <FeatureItem>Up to 10 active contracts</FeatureItem>
                  <FeatureItem>Up to 5 respondents per contract</FeatureItem>
                  <FeatureItem>Full product suite access</FeatureItem>
                  <FeatureItem>5 team members</FeatureItem>
                  <FeatureItem>Unlimited AI interactions</FeatureItem>
                  <FeatureItem>Full document package</FeatureItem>
                  <FeatureItem>Pre-negotiation playbook cross-check</FeatureItem>
                  <FeatureItem>Email support (48hr response)</FeatureItem>
                </ul>

                <Link
                  href="/request-trial"
                  className="block w-full mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-600/25"
                >
                  Start with Platform — £300/seat/month
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
                  Large Organisations
                </h3>
                <p className="text-slate-500 text-sm">
                  For enterprises with compliance, security, and scale
                  requirements.
                </p>
              </div>

              <div className="p-6 bg-slate-50">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-800">
                    Custom
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Tailored to your organisation
                </p>
              </div>

              <div className="p-6">
                <ul className="space-y-3">
                  <FeatureItem>Unlimited contracts</FeatureItem>
                  <FeatureItem>Unlimited respondents</FeatureItem>
                  <FeatureItem>Unlimited team members</FeatureItem>
                  <FeatureItem>SSO / SAML authentication</FeatureItem>
                  <FeatureItem>API access</FeatureItem>
                  <FeatureItem>Dedicated account manager</FeatureItem>
                  <FeatureItem>Full playbook suite — build, verify, enforce</FeatureItem>
                  <FeatureItem>AI playbook builder + managed service option</FeatureItem>
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
                    <th className="text-left py-4 px-4 font-semibold text-slate-800">
                      Product
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">
                      Explore
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-emerald-600">
                      Platform
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <TableRow label="QuickCreate" starter={true} pro={true} enterprise={true} />
                  <TableRow label="ContractCreate" starter={false} pro={true} enterprise={true} />
                  <TableRow label="Co-Create" starter={false} pro={true} enterprise={true} />
                  <TableRow label="Negotiate" starter="Limited" pro={true} enterprise={true} />
                  <TableRow label="Training Studio" starter={true} pro={true} enterprise={true} />
                  <TableRow label="Document Preparation" starter={false} pro={true} enterprise={true} />
                  <TableRow label="ContractKnowledge" starter={false} pro={true} enterprise={true} />
                  <TableRow label="Protect (Playbooks)" starter={false} pro={true} enterprise={true} />
                  <TableRow label="Tendering" starter={false} pro={false} enterprise={true} note="Coming soon" />
                  <TableRow label="Sign" starter={false} pro={true} enterprise={true} note="Coming soon" />
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
                    <th className="text-left py-4 px-4 font-semibold text-slate-800">
                      Feature
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">
                      Explore
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-emerald-600">
                      Platform
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-800">
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <ComparisonRow label="Active contract sessions" starter="1" pro="10" enterprise="Unlimited" />
                  <ComparisonRow label="Respondents per session" starter="2" pro="5" enterprise="Unlimited" />
                  <ComparisonRow label="Team members" starter="1" pro="5" enterprise="Unlimited" />
                  <ComparisonRow label="CLARENCE AI interactions" starter="50/month" pro="Unlimited" enterprise="Unlimited" />
                  <ComparisonRow label="Evidence Package" starter="Basic" pro="Full" enterprise="Full + Custom" />
                  <ComparisonRow label="Support" starter="Community" pro="Email (48hr)" enterprise="Priority + AM" />
                  <TableRow label="SSO / SAML" starter={false} pro={false} enterprise={true} />
                  <TableRow label="API Access" starter={false} pro={false} enterprise={true} />
                  <TableRow label="Playbook cross-check" starter={false} pro={true} enterprise={true} />
                  <TableRow label="Full playbook suite (build, verify, enforce)" starter={false} pro={false} enterprise={true} />
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
                question="How does the free trial work?"
                answer="Request a trial and we'll set you up with one complete contract session. You'll have access to the Training Studio to learn the platform, then run a real negotiation with up to 2 respondents. No credit card required."
              />
              <FAQItem
                question="What does £300/seat/month include?"
                answer="The Platform plan gives each seat access to the full Clarence product suite including ContractCreate, Co-Create, Negotiate, Training Studio, and QuickCreate. You can run up to 10 active contracts with 5 respondents each, and have 5 team members on the platform."
              />
              <FAQItem
                question="What's included in the Evidence Package?"
                answer="The Evidence Package includes executive summary, leverage report, position history, chat transcripts, trade-off register, timeline audit, contract draft, and the Contract Handbook for ongoing governance."
              />
              <FAQItem
                question="Can I upgrade or downgrade my plan?"
                answer="Yes! Contact us at any time to adjust your plan. We'll pro-rate any changes and ensure a smooth transition for your active contracts."
              />
              <FAQItem
                question="What is the playbook cross-check?"
                answer="Before you send any contract into negotiation, Clarence can cross-check the template against your active playbook. It flags clauses that fall outside your acceptable ranges, identifies missing protections, and highlights potential red line breaches — so you can reduce exposure before the conversation starts. Available on Professional and Enterprise plans."
              />
              <FAQItem
                question="Do I need a playbook to use Clarence?"
                answer="No. Clarence works perfectly without a playbook — you get full access to mediation, leverage visibility, and all negotiation tools. But if you want compliance protection, Platform customers can upload an existing playbook for pre-negotiation cross-checks. Enterprise customers get the full playbook suite: AI-assisted builder, managed creation service, verification dashboard, and real-time enforcement."
              />
              <FAQItem
                question="Is my data secure?"
                answer="Absolutely. CLARENCE is built with enterprise-grade security. All data is encrypted in transit and at rest. Enterprise plans include additional security features like SSO/SAML and dedicated infrastructure options."
              />
            </div>
          </div>
        </div>
      </section>

      <SectionCTA
        title="Ready to Agree?"
        subtitle="Start with a free trial or contact our team to discuss what your organisation needs."
        primaryCTA={{ text: 'Request Free Trial', href: '/request-trial' }}
        secondaryCTA={{ text: 'Contact Sales', href: '/enterprise' }}
      />

      <Footer />
    </main>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-slate-600">{children}</span>
    </li>
  )
}

function TableRow({
  label,
  starter,
  pro,
  enterprise,
  note,
}: {
  label: string
  starter: boolean | string
  pro: boolean | string
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
        <CellValue value={starter} />
      </td>
      <td className="py-4 px-4 text-center bg-emerald-50/50">
        <CellValue value={pro} />
      </td>
      <td className="py-4 px-4 text-center">
        <CellValue value={enterprise} />
      </td>
    </tr>
  )
}

function ComparisonRow({
  label,
  starter,
  pro,
  enterprise,
}: {
  label: string
  starter: string
  pro: string
  enterprise: string
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-4 px-4 text-slate-600">{label}</td>
      <td className="py-4 px-4 text-center text-slate-800">{starter}</td>
      <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">
        {pro}
      </td>
      <td className="py-4 px-4 text-center text-slate-800">{enterprise}</td>
    </tr>
  )
}

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-slate-800 text-sm">{value}</span>
  }
  if (value) {
    return <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
  }
  return <X className="w-5 h-5 text-slate-300 mx-auto" />
}

function FAQItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <h3 className="font-semibold text-slate-800 mb-2">{question}</h3>
      <p className="text-sm text-slate-600">{answer}</p>
    </div>
  )
}
