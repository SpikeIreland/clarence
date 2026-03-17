import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'
import FeatureListItem from '../components/FeatureListItem'
import Footer from '../components/Footer'
import { Shield, Lock, Server, Users, HeadphonesIcon, BookOpen, Bot, GraduationCap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Enterprise | CLARENCE - Principled Negotiation at Scale',
  description:
    'Enterprise-grade agreement platform with SSO, API access, custom playbooks, and dedicated support. Built for organisations with compliance and scale requirements.',
}

// ============================================================================
// ENTERPRISE PAGE
// Location: app/enterprise/page.tsx
// ============================================================================

export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <MainNavigation />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 backdrop-blur rounded-full text-sm font-medium mb-8 border border-purple-400/30">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300">Enterprise</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Clarence for Enterprise
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Professional excellence at scale. The Clarence methodology —
              Academy certification, continuous development, and principled
              agreement management — deployed across your organisation.
            </p>

            <div className="mt-10">
              <Link
                href="/request-trial"
                className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors shadow-lg"
              >
                Contact Enterprise Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Enterprise Value Props ───────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Professional Excellence at Scale
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to deploy principled agreement management
              across your organisation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <Lock className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Security & Compliance
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Enterprise-grade encryption, SSO/SAML authentication, and audit
                logging for every action.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  SSO / SAML authentication
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Data encrypted in transit and at rest
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Complete audit trail
                </FeatureListItem>
              </ul>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <Server className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Scale & Performance
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Unlimited contracts, respondents, and team members. Built to
                handle your organisation's volume.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  Unlimited contracts and respondents
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Unlimited team members
                </FeatureListItem>
                <FeatureListItem color="purple">
                  API access for integration
                </FeatureListItem>
              </ul>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <Users className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Team Management
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Role-based access controls, user management, and team
                collaboration features.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  Role-based access (Admin, Manager, User, Viewer)
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Company-wide template management
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Training access approvals
                </FeatureListItem>
              </ul>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <BookOpen className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Playbook Protection
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Build, verify, and enforce your negotiation playbook. Never sign
                blind — every contract checked against your standards automatically.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  AI-assisted playbook creation or managed service
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Verification dashboard for every parsed rule
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Real-time compliance monitoring in negotiation
                </FeatureListItem>
              </ul>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <HeadphonesIcon className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Dedicated Support
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Priority support with a dedicated account manager and custom
                SLAs.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  Dedicated account manager
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Priority support with custom SLAs
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Onboarding and training assistance
                </FeatureListItem>
              </ul>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
              <GraduationCap className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Clarence Academy
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Structured professional development with certification. Your
                team learns the Clarence methodology, practises against real
                scenarios, and earns credentials that reflect genuine
                competence — not attendance.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  Academy certification programme
                </FeatureListItem>
                <FeatureListItem color="purple">
                  CPD-linked professional development
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Performance-based credentials, not course completion
                </FeatureListItem>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Playbook Services ────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-full text-sm font-medium text-purple-700 mb-4">
                <Shield className="w-4 h-4" />
                <span>Risk Protection</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">
                Build, Verify, and Enforce Your Playbook
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Most organisations know they need a negotiation playbook. Few have
                one that actually works. Clarence gives you the tools to build it
                properly and the platform to enforce it automatically.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 bg-white rounded-2xl border border-slate-200">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <Bot className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  AI-Assisted Playbook Builder
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Answer guided questions about your negotiation standards and
                  Clarence generates a structured playbook — complete with red
                  lines, acceptable ranges, and escalation rules. No legal team
                  required.
                </p>
                <ul className="space-y-2">
                  <FeatureListItem color="purple">
                    Guided self-service creation workflow
                  </FeatureListItem>
                  <FeatureListItem color="purple">
                    AI extracts rules from your existing policy documents
                  </FeatureListItem>
                  <FeatureListItem color="purple">
                    Verification dashboard to review every parsed rule
                  </FeatureListItem>
                  <FeatureListItem color="purple">
                    Included with Enterprise plan
                  </FeatureListItem>
                </ul>
              </div>

              <div className="p-8 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-200">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <HeadphonesIcon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  Managed Playbook Service
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Our team works with your legal and procurement leaders to codify
                  your negotiation standards into a production-ready playbook. The
                  expertise of a specialist law firm, at a fraction of the cost.
                </p>
                <ul className="space-y-2">
                  <FeatureListItem color="purple">
                    Dedicated playbook specialist assigned to your account
                  </FeatureListItem>
                  <FeatureListItem color="purple">
                    Stakeholder interviews and policy document analysis
                  </FeatureListItem>
                  <FeatureListItem color="purple">
                    Iterative review and verification with your team
                  </FeatureListItem>
                  <FeatureListItem color="purple">
                    Fraction of the cost of traditional law firm engagement
                  </FeatureListItem>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200 text-center">
              <p className="text-sm text-slate-600 mb-2">
                Already have a playbook? Upload it and Clarence parses it
                automatically. Then use the verification dashboard to confirm every
                rule before it goes live.
              </p>
              <p className="text-xs text-slate-400">
                Supported formats: PDF, Word, Excel, structured JSON
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Deploy at Scale?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Contact our enterprise team to discuss your requirements and get a
            tailored plan for your organisation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/request-trial"
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25"
            >
              Contact Enterprise Sales
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
