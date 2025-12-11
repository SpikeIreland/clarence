'use client'
import { useState } from 'react'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface PricingTier {
    name: string
    price: string
    priceSubtext: string
    description: string
    features: string[]
    limitations?: string[]
    cta: {
        text: string
        href: string
        style: 'primary' | 'secondary' | 'outline'
    }
    highlighted?: boolean
    badge?: string
    color: 'emerald' | 'blue' | 'amber'
}

interface FAQ {
    question: string
    answer: string
}

interface FeatureRow {
    feature: string
    starter: string | boolean
    professional: string | boolean
    enterprise: string | boolean
    category?: string
}

// ============================================================================
// SECTION 2: PRICING DATA
// ============================================================================

const pricingTiers: PricingTier[] = [
    {
        name: 'Starter',
        price: 'Free Trial',
        priceSubtext: 'By request',
        description: 'Perfect for evaluating CLARENCE with a real contract negotiation.',
        features: [
            '1 active contract session',
            '2 providers per session',
            '1 team member',
            '50 CLARENCE AI interactions',
            'Standard 55-clause library',
            'Basic document export',
        ],
        limitations: [
            'Community support only',
            'No evidence package',
        ],
        cta: {
            text: 'Request Free Trial',
            href: '/request-trial',
            style: 'outline',
        },
        color: 'emerald',
    },
    {
        name: 'Professional',
        price: '£149',
        priceSubtext: 'per month',
        description: 'For growing teams with regular contract negotiations.',
        features: [
            '10 active contract sessions',
            '5 providers per session',
            '5 team members',
            'Unlimited CLARENCE AI',
            'Extended clause library (100+)',
            'Full evidence package',
            'Boilerplate upload (10 docs)',
            'Email support (48hr response)',
        ],
        cta: {
            text: 'Get Started',
            href: '/auth/signup?plan=professional',
            style: 'primary',
        },
        highlighted: true,
        badge: 'Most Popular',
        color: 'blue',
    },
    {
        name: 'Enterprise',
        price: 'From £499',
        priceSubtext: 'per month',
        description: 'For large organisations with advanced requirements.',
        features: [
            'Unlimited contract sessions',
            'Unlimited providers',
            'Unlimited team members',
            'Unlimited CLARENCE AI',
            'Full clause library + custom',
            'Customisable evidence package',
            'Unlimited boilerplate upload',
            'Priority support + Account Manager',
            'SSO / SAML authentication',
            'API access',
        ],
        cta: {
            text: 'Contact Sales',
            href: '/contact-sales',
            style: 'secondary',
        },
        color: 'amber',
    },
]

// ============================================================================
// SECTION 3: FEATURE COMPARISON DATA
// ============================================================================

const featureComparison: FeatureRow[] = [
    // Core Features
    { feature: 'Active contract sessions', starter: '1', professional: '10', enterprise: 'Unlimited', category: 'Core Features' },
    { feature: 'Providers per session', starter: '2', professional: '5', enterprise: 'Unlimited' },
    { feature: 'Team members', starter: '1', professional: '5', enterprise: 'Unlimited' },
    { feature: 'CLARENCE AI interactions', starter: '50/month', professional: 'Unlimited', enterprise: 'Unlimited' },

    // Negotiation Tools
    { feature: 'Standard clause library (55)', starter: true, professional: true, enterprise: true, category: 'Negotiation Tools' },
    { feature: 'Extended clause library (100+)', starter: false, professional: true, enterprise: true },
    { feature: 'Custom clause development', starter: false, professional: false, enterprise: true },
    { feature: 'Leverage calculation', starter: true, professional: true, enterprise: true },
    { feature: 'Trade-off suggestions', starter: true, professional: true, enterprise: true },
    { feature: 'Party chat', starter: true, professional: true, enterprise: true },

    // Documents & Output
    { feature: 'Contract draft generation', starter: true, professional: true, enterprise: true, category: 'Documents & Output' },
    { feature: 'Basic document export', starter: true, professional: true, enterprise: true },
    { feature: 'Evidence package', starter: false, professional: true, enterprise: true },
    { feature: 'Custom evidence package', starter: false, professional: false, enterprise: true },
    { feature: 'Boilerplate upload', starter: false, professional: '10 documents', enterprise: 'Unlimited' },
    { feature: 'Contract governance handbook', starter: false, professional: true, enterprise: true },

    // Support & Security
    { feature: 'Community support', starter: true, professional: true, enterprise: true, category: 'Support & Security' },
    { feature: 'Email support', starter: false, professional: '48hr response', enterprise: '24hr response' },
    { feature: 'Dedicated Account Manager', starter: false, professional: false, enterprise: true },
    { feature: 'SSO / SAML', starter: false, professional: false, enterprise: true },
    { feature: 'API access', starter: false, professional: false, enterprise: true },
    { feature: 'Custom integrations', starter: false, professional: false, enterprise: true },
]

// ============================================================================
// SECTION 4: FAQ DATA
// ============================================================================

const faqs: FAQ[] = [
    {
        question: 'How does the free trial work?',
        answer: 'The free trial gives you access to one complete contract negotiation session. Simply request access, and once approved, you can experience the full CLARENCE negotiation process with up to 2 providers. The trial is by request to ensure we can provide proper onboarding support.',
    },
    {
        question: 'Can I upgrade or downgrade my plan at any time?',
        answer: 'Yes, you can upgrade your plan at any time and the change will take effect immediately. If you downgrade, the change will take effect at the start of your next billing cycle. Any active sessions beyond your new plan limits will remain accessible until completed.',
    },
    {
        question: 'What happens to my data if I cancel?',
        answer: 'Your data remains secure and accessible for 30 days after cancellation. You can export all your contracts, evidence packages, and negotiation history during this period. After 30 days, data is permanently deleted in accordance with our privacy policy.',
    },
    {
        question: 'Is there a discount for annual billing?',
        answer: 'Yes, we offer a 20% discount for annual billing on Professional and Enterprise plans. Contact our sales team to arrange annual billing.',
    },
    {
        question: 'What counts as an "active session"?',
        answer: 'An active session is any contract negotiation that has not been completed or archived. Once a contract is signed or you archive the session, it no longer counts against your limit. Completed sessions remain accessible for reference.',
    },
    {
        question: 'Do providers need their own CLARENCE subscription?',
        answer: 'No, providers do not need their own subscription. When you invite a provider to a negotiation, they receive free access to participate in that specific session. They can set positions, use CLARENCE chat, and collaborate on the contract at no cost.',
    },
    {
        question: 'What is included in the Evidence Package?',
        answer: 'The Evidence Package includes: the final contract, a negotiation summary, complete position history with timestamps, all party communications, trade-off records, leverage analysis report, and a contract governance handbook. It provides a comprehensive audit trail of the entire negotiation.',
    },
    {
        question: 'How does CLARENCE handle confidential information?',
        answer: 'CLARENCE uses enterprise-grade encryption for all data at rest and in transit. Each negotiation session is isolated, and data is never shared between parties or used to train AI models. We are SOC 2 compliant and can provide additional security documentation for Enterprise customers.',
    },
]

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

export default function PricingPage() {
    const [expandedFaq, setExpandedFaq] = useState<number | null>(0)
    const [showAnnual, setShowAnnual] = useState(false)

    // ============================================================================
    // SECTION 6: HELPER FUNCTIONS
    // ============================================================================

    const getCtaClasses = (style: 'primary' | 'secondary' | 'outline') => {
        const baseClasses = 'w-full px-6 py-3 font-semibold rounded-lg transition-all text-center block'

        switch (style) {
            case 'primary':
                return `${baseClasses} bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 hover:shadow-xl`
            case 'secondary':
                return `${baseClasses} bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl`
            case 'outline':
                return `${baseClasses} bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 hover:border-slate-400`
        }
    }

    const renderFeatureValue = (value: string | boolean) => {
        if (typeof value === 'boolean') {
            return value ? (
                <svg className="w-5 h-5 text-emerald-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
            ) : (
                <svg className="w-5 h-5 text-slate-300 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            )
        }
        return <span className="text-sm text-slate-600">{value}</span>
    }

    // ============================================================================
    // SECTION 7: RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 8: NAVIGATION HEADER */}
            {/* Matches existing site header style */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo & Brand */}
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">The Honest Broker</div>
                            </div>
                        </Link>

                        {/* Navigation Links */}
                        <div className="flex items-center gap-6">
                            <Link
                                href="/how-it-works"
                                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                            >
                                How It Works
                            </Link>
                            <Link
                                href="/phases"
                                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                            >
                                The 6 Phases
                            </Link>
                            <Link
                                href="/pricing"
                                className="text-white text-sm font-medium transition-colors"
                            >
                                Pricing
                            </Link>

                            {/* Sign In Buttons */}
                            <div className="flex items-center gap-3 ml-2">
                                <Link
                                    href="/auth/login"
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Customer Sign In
                                </Link>
                                <a
                                    href="https://www.clarencelegal.ai/provider"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Provider Sign In
                                </a>
                            </div>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 9: HERO SECTION */}
            {/* ================================================================== */}
            <section className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-6 py-16">
                    <div className="max-w-3xl mx-auto text-center">
                        <h1 className="text-4xl font-bold text-slate-800 mb-4">
                            Simple, Transparent Pricing
                        </h1>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Choose the plan that fits your negotiation needs. Start with a free trial
                            or scale up as your requirements grow.
                        </p>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 10: PRICING CARDS */}
            {/* ================================================================== */}
            <section className="py-16 bg-slate-50">
                <div className="container mx-auto px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid md:grid-cols-3 gap-8">
                            {pricingTiers.map((tier) => (
                                <div
                                    key={tier.name}
                                    className={`
                    relative bg-white rounded-2xl border-2 overflow-hidden transition-all
                    ${tier.highlighted
                                            ? 'border-blue-500 shadow-xl shadow-blue-500/10 scale-105 z-10'
                                            : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                                        }
                  `}
                                >
                                    {/* Badge */}
                                    {tier.badge && (
                                        <div className="absolute top-0 right-0">
                                            <div className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                                                {tier.badge}
                                            </div>
                                        </div>
                                    )}

                                    {/* Card Content */}
                                    <div className="p-8">
                                        {/* Tier Name */}
                                        <div className="mb-4">
                                            <h3 className={`text-xl font-bold ${tier.color === 'emerald' ? 'text-emerald-600' :
                                                    tier.color === 'blue' ? 'text-blue-600' : 'text-amber-600'
                                                }`}>
                                                {tier.name}
                                            </h3>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-4">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-bold text-slate-800">{tier.price}</span>
                                                <span className="text-slate-500 text-sm">/{tier.priceSubtext}</span>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="text-slate-600 text-sm mb-6 min-h-[40px]">
                                            {tier.description}
                                        </p>

                                        {/* CTA Button */}
                                        <Link href={tier.cta.href} className={getCtaClasses(tier.cta.style)}>
                                            {tier.cta.text}
                                        </Link>

                                        {/* Features List */}
                                        <div className="mt-8 space-y-3">
                                            {tier.features.map((feature, index) => (
                                                <div key={index} className="flex items-start gap-3">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tier.color === 'emerald' ? 'bg-emerald-100' :
                                                            tier.color === 'blue' ? 'bg-blue-100' : 'bg-amber-100'
                                                        }`}>
                                                        <svg className={`w-3 h-3 ${tier.color === 'emerald' ? 'text-emerald-600' :
                                                                tier.color === 'blue' ? 'text-blue-600' : 'text-amber-600'
                                                            }`} fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-sm text-slate-600">{feature}</span>
                                                </div>
                                            ))}

                                            {/* Limitations (for Starter tier) */}
                                            {tier.limitations && tier.limitations.map((limitation, index) => (
                                                <div key={`limit-${index}`} className="flex items-start gap-3">
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-100">
                                                        <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-sm text-slate-400">{limitation}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Annual Discount Note */}
                        <div className="mt-8 text-center">
                            <p className="text-sm text-slate-500">
                                💡 <span className="font-medium">Save 20%</span> with annual billing on Professional and Enterprise plans.{' '}
                                <Link href="/contact-sales" className="text-blue-600 hover:underline">Contact sales</Link> to learn more.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 11: FEATURE COMPARISON TABLE */}
            {/* ================================================================== */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-slate-800 mb-4">
                                Compare Plans
                            </h2>
                            <p className="text-slate-600">
                                A detailed breakdown of what's included in each plan.
                            </p>
                        </div>

                        {/* Comparison Table */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    {/* Table Header */}
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left py-4 px-6 font-semibold text-slate-700 w-1/3">Feature</th>
                                            <th className="text-center py-4 px-4 font-semibold text-emerald-600 w-1/5">Starter</th>
                                            <th className="text-center py-4 px-4 font-semibold text-blue-600 w-1/5 bg-blue-50">Professional</th>
                                            <th className="text-center py-4 px-4 font-semibold text-amber-600 w-1/5">Enterprise</th>
                                        </tr>
                                    </thead>

                                    {/* Table Body */}
                                    <tbody>
                                        {featureComparison.map((row, index) => (
                                            <>
                                                {/* Category Header */}
                                                {row.category && (
                                                    <tr key={`cat-${index}`} className="bg-slate-100">
                                                        <td colSpan={4} className="py-3 px-6 font-semibold text-slate-800 text-sm">
                                                            {row.category}
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Feature Row */}
                                                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                    <td className="py-3 px-6 text-sm text-slate-700">{row.feature}</td>
                                                    <td className="py-3 px-4 text-center">{renderFeatureValue(row.starter)}</td>
                                                    <td className="py-3 px-4 text-center bg-blue-50/50">{renderFeatureValue(row.professional)}</td>
                                                    <td className="py-3 px-4 text-center">{renderFeatureValue(row.enterprise)}</td>
                                                </tr>
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 12: FAQ SECTION */}
            {/* ================================================================== */}
            <section className="py-16 bg-slate-50 border-t border-slate-200">
                <div className="container mx-auto px-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-slate-800 mb-4">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-slate-600">
                                Everything you need to know about CLARENCE pricing and plans.
                            </p>
                        </div>

                        {/* FAQ Accordion */}
                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <div
                                    key={index}
                                    className={`
                    bg-white rounded-xl border overflow-hidden transition-all
                    ${expandedFaq === index
                                            ? 'border-slate-300 shadow-md'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }
                  `}
                                >
                                    <button
                                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                        className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                                    >
                                        <span className="font-semibold text-slate-800 pr-4">{faq.question}</span>
                                        <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${expandedFaq === index ? 'bg-slate-200' : 'bg-slate-100'}
                      transition-all
                    `}>
                                            <svg
                                                className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${expandedFaq === index ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {expandedFaq === index && (
                                        <div className="px-5 pb-5 border-t border-slate-100">
                                            <p className="pt-4 text-slate-600 leading-relaxed">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 13: CTA SECTION */}
            {/* ================================================================== */}
            <section className="py-16 bg-gradient-to-br from-slate-800 to-slate-900">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Transform Your Negotiations?
                    </h2>
                    <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                        Start with a free trial or talk to our team about Enterprise solutions.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/request-trial"
                            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                        >
                            Request Free Trial
                        </Link>
                        <Link
                            href="/contact-sales"
                            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg border border-slate-600 transition-all"
                        >
                            Contact Sales
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================================================================== */}
            {/* SECTION 14: FOOTER */}
            {/* Matches existing site footer style */}
            {/* ================================================================== */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        {/* Brand */}
                        <div className="flex items-center gap-3 mb-6 md:mb-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <div>
                                <span className="text-white font-medium">CLARENCE</span>
                                <span className="text-slate-500 text-sm ml-2">The Honest Broker</span>
                            </div>
                        </div>

                        {/* Links */}
                        <div className="flex gap-8 text-sm">
                            <Link href="/" className="hover:text-white transition-colors">Home</Link>
                            <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
                            <Link href="/phases" className="hover:text-white transition-colors">The 6 Phases</Link>
                            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
                        <p>&copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}