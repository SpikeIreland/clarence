import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'
import FeatureListItem from '../components/FeatureListItem'
import Footer from '../components/Footer'
import { Shield, Lock, Server, Users, HeadphonesIcon, BookOpen } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Enterprise | CLARENCE - Contract Intelligence for Large Organisations',
  description:
    'Enterprise-grade contract intelligence with SSO, API access, custom playbooks, and dedicated support. Built for organisations with compliance and scale requirements.',
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
              Enterprise-grade contract intelligence with the security,
              compliance, and scale your organisation demands.
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
              Built for Enterprise
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to deploy AI-powered contract intelligence at
              scale.
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
                Custom Playbooks
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Upload your organisation's negotiation playbooks and enforce
                compliance in every contract.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  Upload company playbooks and position guides
                </FeatureListItem>
                <FeatureListItem color="purple">
                  AI-powered playbook compliance checking
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Train teams on your actual standards
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
              <Shield className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Full Product Suite
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Access to every Clarence product including upcoming releases and
                early access to new features.
              </p>
              <ul className="space-y-2">
                <FeatureListItem color="purple">
                  All current and future products
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Full + Custom evidence packages
                </FeatureListItem>
                <FeatureListItem color="purple">
                  Unlimited AI interactions
                </FeatureListItem>
              </ul>
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
