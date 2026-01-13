import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'

export const metadata: Metadata = {
    title: 'Pricing | CLARENCE - AI-Powered Contract Mediation',
    description: 'Flexible pricing for teams of all sizes. From free trials to enterprise solutions. Contact us for custom pricing.',
}

// ============================================================================
// SECTION 1: MAIN PRICING PAGE COMPONENT
// Location: app/pricing/page.tsx
// ============================================================================

export default function PricingPage() {
    return (
        <main className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 2: NAVIGATION */}
            {/* ================================================================== */}
            <MainNavigation />

            {/* ================================================================== */}
            {/* SECTION 3: HERO SECTION */}
            {/* ================================================================== */}
            <section className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-6 py-16">
                    <div className="max-w-3xl mx-auto text-center">
                        <h1 className="text-4xl font-bold text-slate-800 mb-4">
                            Simple, Transparent Pricing
                        </h1>
                        <p className="text-xl text-slate-600">
                            Start with a free trial. Scale as you grow.
                            No hidden fees, no surprises.
                        </p>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 4: PRICING TIERS */}
            {/* ================================================================== */}
            <section className="py-16">
                <div className="container mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

                        {/* ============================================================ */}
                        {/* TIER 1: Starter / Free Trial */}
                        {/* ============================================================ */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium mb-4">
                                    <span>🚀</span>
                                    <span>Starter</span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Free Trial</h3>
                                <p className="text-slate-500 text-sm">
                                    Perfect for evaluating CLARENCE with your first contract negotiation.
                                </p>
                            </div>

                            {/* Price */}
                            <div className="p-6 bg-slate-50">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold text-slate-800">£0</span>
                                    <span className="text-slate-500">/ trial</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-2">1 contract session included</p>
                            </div>

                            {/* Features */}
                            <div className="p-6">
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">1 active contract session</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Up to 2 respondents</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Full Training Studio access</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Basic document package</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Community support</span>
                                    </li>
                                </ul>

                                <Link
                                    href="/request-trial"
                                    className="block w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-center font-semibold rounded-lg transition-colors"
                                >
                                    Request Free Trial
                                </Link>
                            </div>
                        </div>

                        {/* ============================================================ */}
                        {/* TIER 2: Professional - FEATURED */}
                        {/* ============================================================ */}
                        <div className="bg-white rounded-2xl border-2 border-emerald-500 overflow-hidden shadow-lg relative">
                            {/* Popular Badge */}
                            <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-center py-1 text-sm font-medium">
                                Most Popular
                            </div>

                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 pt-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-4">
                                    <span>⚡</span>
                                    <span>Professional</span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Growing Teams</h3>
                                <p className="text-slate-500 text-sm">
                                    For procurement teams running regular contract negotiations.
                                </p>
                            </div>

                            {/* Price */}
                            <div className="p-6 bg-emerald-50">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold text-slate-800">Contact Us</span>
                                </div>
                                <p className="text-sm text-emerald-700 mt-2">Custom pricing based on your needs</p>
                            </div>

                            {/* Features */}
                            <div className="p-6">
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Up to 10 active contracts</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Up to 5 respondents per contract</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">5 team members</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Unlimited CLARENCE AI interactions</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Full document package</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Email support (48hr response)</span>
                                    </li>
                                </ul>

                                <Link
                                    href="/request-trial"
                                    className="block w-full mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-600/25"
                                >
                                    Contact Sales
                                </Link>
                            </div>
                        </div>

                        {/* ============================================================ */}
                        {/* TIER 3: Enterprise */}
                        {/* ============================================================ */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                                    <span>🏢</span>
                                    <span>Enterprise</span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Large Organizations</h3>
                                <p className="text-slate-500 text-sm">
                                    For enterprises with compliance, security, and scale requirements.
                                </p>
                            </div>

                            {/* Price */}
                            <div className="p-6 bg-slate-50">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold text-slate-800">Custom</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-2">Tailored to your organization</p>
                            </div>

                            {/* Features */}
                            <div className="p-6">
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Unlimited contracts</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Unlimited respondents</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Unlimited team members</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">SSO / SAML authentication</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">API access</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Dedicated account manager</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm text-slate-600">Custom playbook integration</span>
                                    </li>
                                </ul>

                                <Link
                                    href="/request-trial"
                                    className="block w-full mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-center font-semibold rounded-lg transition-colors"
                                >
                                    Contact Sales
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 5: FEATURE COMPARISON TABLE */}
            {/* ================================================================== */}
            <section className="py-16 bg-white border-t border-slate-200">
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
                                        <th className="text-center py-4 px-4 font-semibold text-slate-800">Starter</th>
                                        <th className="text-center py-4 px-4 font-semibold text-emerald-600">Professional</th>
                                        <th className="text-center py-4 px-4 font-semibold text-slate-800">Enterprise</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {/* Contract Sessions */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">Active contract sessions</td>
                                        <td className="py-4 px-4 text-center text-slate-800">1</td>
                                        <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">10</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Unlimited</td>
                                    </tr>
                                    {/* Respondents */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">Respondents per session</td>
                                        <td className="py-4 px-4 text-center text-slate-800">2</td>
                                        <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">5</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Unlimited</td>
                                    </tr>
                                    {/* Team Members */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">Team members</td>
                                        <td className="py-4 px-4 text-center text-slate-800">1</td>
                                        <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">5</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Unlimited</td>
                                    </tr>
                                    {/* Training Studio */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">Training Studio</td>
                                        <td className="py-4 px-4 text-center"><CheckIcon /></td>
                                        <td className="py-4 px-4 text-center bg-emerald-50/50"><CheckIcon /></td>
                                        <td className="py-4 px-4 text-center"><CheckIcon /></td>
                                    </tr>
                                    {/* CLARENCE AI */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">CLARENCE AI interactions</td>
                                        <td className="py-4 px-4 text-center text-slate-800">50/month</td>
                                        <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">Unlimited</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Unlimited</td>
                                    </tr>
                                    {/* Document Package */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">Evidence Package</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Basic</td>
                                        <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">Full</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Full + Custom</td>
                                    </tr>
                                    {/* Support */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">Support</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Community</td>
                                        <td className="py-4 px-4 text-center text-slate-800 bg-emerald-50/50">Email (48hr)</td>
                                        <td className="py-4 px-4 text-center text-slate-800">Priority + AM</td>
                                    </tr>
                                    {/* SSO */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">SSO / SAML</td>
                                        <td className="py-4 px-4 text-center"><CrossIcon /></td>
                                        <td className="py-4 px-4 text-center bg-emerald-50/50"><CrossIcon /></td>
                                        <td className="py-4 px-4 text-center"><CheckIcon /></td>
                                    </tr>
                                    {/* API Access */}
                                    <tr className="border-b border-slate-100">
                                        <td className="py-4 px-4 text-slate-600">API Access</td>
                                        <td className="py-4 px-4 text-center"><CrossIcon /></td>
                                        <td className="py-4 px-4 text-center bg-emerald-50/50"><CrossIcon /></td>
                                        <td className="py-4 px-4 text-center"><CheckIcon /></td>
                                    </tr>
                                    {/* Playbook Integration */}
                                    <tr>
                                        <td className="py-4 px-4 text-slate-600">Custom playbook integration</td>
                                        <td className="py-4 px-4 text-center"><CrossIcon /></td>
                                        <td className="py-4 px-4 text-center bg-emerald-50/50"><CrossIcon /></td>
                                        <td className="py-4 px-4 text-center"><CheckIcon /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 6: FAQ */}
            {/* ================================================================== */}
            <section className="py-16 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">
                            Frequently Asked Questions
                        </h2>

                        <div className="space-y-6">
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-2">
                                    How does the free trial work?
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Request a trial and we'll set you up with one complete contract session.
                                    You'll have access to the Training Studio to learn the platform, then run
                                    a real negotiation with up to 2 respondents. No credit card required.
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-2">
                                    What's included in the Evidence Package?
                                </h3>
                                <p className="text-sm text-slate-600">
                                    The Evidence Package includes executive summary, leverage report, position
                                    history, chat transcripts, trade-off register, timeline audit, contract draft,
                                    and the Contract Handbook for ongoing governance.
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-2">
                                    Can I upgrade or downgrade my plan?
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Yes! Contact us at any time to adjust your plan. We'll pro-rate any changes
                                    and ensure a smooth transition for your active contracts.
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-2">
                                    Is my data secure?
                                </h3>
                                <p className="text-sm text-slate-600">
                                    Absolutely. CLARENCE is built with enterprise-grade security. All data is
                                    encrypted in transit and at rest. Enterprise plans include additional security
                                    features like SSO/SAML and dedicated infrastructure options.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 7: CTA */}
            {/* ================================================================== */}
            <section className="py-16 bg-gradient-to-br from-slate-800 to-slate-900">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Get Started?
                    </h2>
                    <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                        Start with a free trial or contact our team to discuss your requirements.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/request-trial"
                            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25"
                        >
                            Request Free Trial
                        </Link>
                        <Link
                            href="/request-trial"
                            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
                        >
                            Contact Sales
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 8: FOOTER */}
            {/* ================================================================== */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center gap-3 mb-6 md:mb-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <span className="text-white font-semibold">CLARENCE</span>
                                <span className="text-slate-500 text-sm ml-2">The Honest Broker</span>
                            </div>
                        </div>

                        <div className="flex gap-8 text-sm">
                            <Link href="/how-it-works" className="hover:text-white transition-colors">
                                How It Works
                            </Link>
                            <Link href="/pricing" className="hover:text-white transition-colors">
                                Pricing
                            </Link>
                            <Link href="/privacy" className="hover:text-white transition-colors">
                                Privacy
                            </Link>
                            <Link href="/terms" className="hover:text-white transition-colors">
                                Terms
                            </Link>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
                        <p>&copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.</p>
                    </div>
                </div>
            </footer>
        </main>
    )
}

// ============================================================================
// SECTION 9: HELPER COMPONENTS
// ============================================================================

function CheckIcon() {
    return (
        <svg className="w-5 h-5 text-emerald-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
    )
}

function CrossIcon() {
    return (
        <svg className="w-5 h-5 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    )
}