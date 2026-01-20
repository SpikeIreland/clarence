'use client'
import { useState } from 'react'
import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// Location: app/how-it-works/page.tsx
// ============================================================================

interface ProcessStep {
  id: string
  number: number
  title: string
  icon: string
  description: string
  details: string[]
  color: string
}

interface StudioFeature {
  id: string
  title: string
  icon: string
  description: string
  features: string[]
  color: string
  screenshot: string
}

// ============================================================================
// SECTION 2: PROCESS STEPS DATA
// ============================================================================

const processSteps: ProcessStep[] = [
  {
    id: 'create',
    number: 1,
    title: "Create Your Contract",
    icon: "📋",
    description: "Build your contract and gather the strategic intelligence that powers data-driven negotiation",
    color: "emerald",
    details: [
      "Choose your mediation level: Straight to Contract, Partial Mediation, or Full Mediation",
      "Select from pre-built templates or upload your existing contract",
      "Both parties complete strategic assessments—capturing priorities, constraints, and alternatives",
      "CLARENCE calculates party-fit scores and leverage positions from submitted data",
      "This upfront intelligence removes guesswork and enables truly objective mediation",
      "Invite respondents to begin the negotiation process"
    ]
  },
  {
    id: 'negotiate',
    number: 2,
    title: "Negotiate with CLARENCE",
    icon: "⚖️",
    description: "Work through clauses with AI-powered mediation and real-time leverage tracking",
    color: "teal",
    details: [
      "Review clauses in a three-panel workspace with integrated CLARENCE chat",
      "See transparent leverage calculations for both parties",
      "Receive AI-suggested trade-offs and compromise positions",
      "Track alignment scores as positions converge",
      "CLARENCE brokers compromises based on principles, not adversarial tactics"
    ]
  },
  {
    id: 'agree',
    number: 3,
    title: "Agree & Document",
    icon: "✅",
    description: "Generate your complete evidence package and contract documentation",
    color: "blue",
    details: [
      "Executive summary for leadership sign-off",
      "Complete audit trail of the negotiation process",
      "Position history showing how each clause evolved",
      "Final contract draft ready for signature",
      "Contract Handbook for post-signature governance"
    ]
  }
]

// ============================================================================
// SECTION 3: THREE STUDIOS DATA
// ============================================================================

const studios: StudioFeature[] = [
  {
    id: 'training',
    title: "Training Studio",
    icon: "🎓",
    description: "Master contract negotiation in a risk-free environment before going live",
    color: "amber",
    screenshot: "/images/training-studio-preview.png",
    features: [
      "Single-player scenarios with AI opponents at adjustable difficulty levels",
      "Multi-player practice sessions with colleagues",
      "Pre-built scenarios: BPO, SaaS, MSA, NDA negotiations",
      "Enterprise playbook integration for company-specific training",
      "Progress tracking and skills development metrics",
      "Promote successful training contracts to live templates"
    ]
  },
  {
    id: 'contract',
    title: "Contract Studio",
    icon: "⚖️",
    description: "Live, AI-mediated negotiation with real-time leverage tracking and gamification",
    color: "emerald",
    screenshot: "/images/contract-studio-preview.png",
    features: [
      "Three-panel workspace: clause navigation, negotiation area, CLARENCE chat",
      "Real-time leverage baseline and movement tracker",
      "55+ clause templates across 6 categories",
      "AI-suggested trade-offs and compromise positions",
      "Alignment scores and progress visualization",
      "Multi-respondent support for competitive tendering"
    ]
  },
  {
    id: 'documents',
    title: "Document Centre",
    icon: "📄",
    description: "Generate comprehensive documentation and evidence packages",
    color: "blue",
    screenshot: "/images/document-centre-preview.png",
    features: [
      "Executive Summary for leadership sign-off",
      "Leverage Assessment Report with detailed calculations",
      "Position Movement History for each clause",
      "Complete Chat Transcripts and audit trail",
      "Trade-Off Register documenting all exchanges",
      "Contract Handbook for ongoing governance"
    ]
  }
]

// ============================================================================
// SECTION 4: VALUE PROPOSITIONS
// ============================================================================

const valueProps = [
  {
    id: 'collaboration',
    icon: "🤝",
    title: "Collaboration Over Confrontation",
    description: "CLARENCE guides both parties toward mutually beneficial outcomes rather than adversarial winners and losers."
  },
  {
    id: 'relationships',
    icon: "💎",
    title: "Stronger Relationships",
    description: "Remove the emotional friction from negotiations. Start your business relationship on positive terms."
  },
  {
    id: 'expertise',
    icon: "🎓",
    title: "Expert-Level Knowledge",
    description: "Every negotiation benefits from expertise akin to a specialist law partner with decades of experience."
  },
  {
    id: 'leverage',
    icon: "⚖️",
    title: "Transparent Leverage",
    description: "Both parties see the same data. No hidden agendas—just facts that drive fair, realistic negotiations."
  }
]

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [expandedStudio, setExpandedStudio] = useState<string | null>(null)

  const toggleStep = (stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId)
  }

  const toggleStudio = (studioId: string) => {
    setExpandedStudio(expandedStudio === studioId ? null : studioId)
  }

  // ========================================================================
  // SECTION 6: RENDER
  // ========================================================================

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 7: NAVIGATION */}
      {/* ================================================================== */}
      <MainNavigation />

      {/* ================================================================== */}
      {/* SECTION 8: HERO SECTION */}
      {/* ================================================================== */}
      <section className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 backdrop-blur rounded-full text-sm font-medium mb-6 border border-slate-600/50">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span className="text-slate-300">The Honest Broker</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              How CLARENCE Works
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              A principled approach to contract negotiation that removes emotion,
              reveals leverage, and guides both parties to fair agreements.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 9: VALUE PROPOSITIONS */}
      {/* ================================================================== */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {valueProps.map((prop) => (
              <div
                key={prop.id}
                className="text-center p-6"
              >
                <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{prop.icon}</span>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{prop.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 10: THREE-STEP PROCESS */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Three Steps to Agreement
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              From initial setup to signed contract—a structured, principled approach
              that transforms weeks of negotiation into hours.
            </p>
          </div>

          {/* Process Steps */}
          <div className="max-w-4xl mx-auto space-y-4">
            {processSteps.map((step) => (
              <div
                key={step.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Step Header - Clickable */}
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-4">
                    {/* Step Number */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                      ${step.color === 'emerald' ? 'bg-emerald-500' : ''}
                      ${step.color === 'teal' ? 'bg-teal-500' : ''}
                      ${step.color === 'blue' ? 'bg-blue-500' : ''}
                    `}>
                      {step.number}
                    </div>

                    {/* Step Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 group-hover:text-slate-900">
                        {step.title}
                      </h3>
                      <p className="text-sm text-slate-500">{step.description}</p>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${expandedStep === step.id ? 'bg-slate-200 rotate-180' : 'bg-slate-100'}
                  `}>
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedStep === step.id && (
                  <div className="px-6 pb-6 border-t border-slate-100">
                    <div className="pt-4 pl-16">
                      <ul className="space-y-2">
                        {step.details.map((detail, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5
                              ${step.color === 'emerald' ? 'text-emerald-500' : ''}
                              ${step.color === 'teal' ? 'text-teal-500' : ''}
                              ${step.color === 'blue' ? 'text-blue-500' : ''}
                            `} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-slate-600">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 11: THREE STUDIOS */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Three Integrated Studios
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Training, Tendering, Contracts—a complete platform for your entire
              contract lifecycle from learning to negotiating to documenting.
            </p>
          </div>

          {/* Studios Grid */}
          <div className="max-w-5xl mx-auto space-y-6">
            {studios.map((studio) => (
              <div
                key={studio.id}
                className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Studio Header - Clickable */}
                <button
                  onClick={() => toggleStudio(studio.id)}
                  className="w-full px-6 py-6 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl
                      ${studio.color === 'amber' ? 'bg-amber-100' : ''}
                      ${studio.color === 'emerald' ? 'bg-emerald-100' : ''}
                      ${studio.color === 'blue' ? 'bg-blue-100' : ''}
                    `}>
                      {studio.icon}
                    </div>

                    {/* Info */}
                    <div>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-1
                        ${studio.color === 'amber' ? 'bg-amber-100 text-amber-700' : ''}
                        ${studio.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${studio.color === 'blue' ? 'bg-blue-100 text-blue-700' : ''}
                      `}>
                        {studio.title}
                      </div>
                      <p className="text-slate-600">{studio.description}</p>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${expandedStudio === studio.id ? 'bg-slate-200 rotate-180' : 'bg-white'}
                  `}>
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedStudio === studio.id && (
                  <div className="px-6 pb-6 border-t border-slate-200">
                    <div className="grid md:grid-cols-2 gap-6 pt-6">
                      {/* Features List */}
                      <div>
                        <h4 className="font-semibold text-slate-800 mb-4">Key Features</h4>
                        <ul className="space-y-2">
                          {studio.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <svg className={`w-5 h-5 flex-shrink-0 mt-0.5
                                ${studio.color === 'amber' ? 'text-amber-500' : ''}
                                ${studio.color === 'emerald' ? 'text-emerald-500' : ''}
                                ${studio.color === 'blue' ? 'text-blue-500' : ''}
                              `} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm text-slate-600">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Screenshot */}
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <img
                          src={studio.screenshot}
                          alt={`${studio.title} screenshot`}
                          className="w-full h-auto"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 12: MEDIATION LEVELS */}
      {/* ================================================================== */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              Choose Your Mediation Level
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              CLARENCE adapts to your needs—from quick standard agreements to
              fully negotiable complex contracts.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Straight to Contract */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Straight to Contract
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Standard template with minimal negotiation. Perfect for routine
                agreements like NDAs or standard service terms.
              </p>
              <div className="text-xs text-slate-500">
                <span className="font-medium">Best for:</span> Simple, routine contracts
              </div>
            </div>

            {/* Partial Mediation */}
            <div className="bg-white rounded-xl border-2 border-emerald-200 p-6 hover:shadow-lg transition-shadow relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
                Most Popular
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚖️</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Partial Mediation
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Most terms fixed (~85%) with specific clauses open for negotiation.
                Ideal when you need flexibility on key points.
              </p>
              <div className="text-xs text-slate-500">
                <span className="font-medium">Best for:</span> Standard contracts with key negotiables
              </div>
            </div>

            {/* Full Mediation */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🤝</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Full Mediation
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                All contract terms are negotiable. Best for complex deals, strategic
                partnerships, or bespoke agreements.
              </p>
              <div className="text-xs text-slate-500">
                <span className="font-medium">Best for:</span> Complex, high-value negotiations
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 13: CLARENCE'S APPROACH */}
      {/* ================================================================== */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Text Content */}
              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-6">
                  Principled, Not Adversarial
                </h2>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Traditional contract negotiation is adversarial—each party tries to
                  "win" at the other's expense. CLARENCE takes a different approach.
                </p>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Built on the principles of collaboration, transparency, and impartiality,
                  CLARENCE helps both parties achieve balanced, optimal, and durable outcomes.
                  Outcomes that are realistic and account for each party's actual leverage.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  The result: contracts that took weeks now take hours. Better outcomes.
                  Preserved relationships. Less stress for everyone involved.
                </p>
              </div>

              {/* Stats/Benefits */}
              <div className="space-y-4">
                <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                  <div className="text-3xl font-bold text-emerald-600 mb-2">90%</div>
                  <p className="text-sm text-emerald-800">Reduction in negotiation time</p>
                </div>
                <div className="bg-teal-50 rounded-xl p-6 border border-teal-100">
                  <div className="text-3xl font-bold text-teal-600 mb-2">100%</div>
                  <p className="text-sm text-teal-800">Transparency on leverage calculations</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                  <div className="text-3xl font-bold text-blue-600 mb-2">0</div>
                  <p className="text-sm text-blue-800">Hidden agendas or adversarial tactics</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 14: CTA */}
      {/* ================================================================== */}
      <section className="py-20 bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Negotiations?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Start with the Training Studio to experience CLARENCE risk-free,
            then bring those skills to your real contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/request-trial"
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-500/25"
            >
              Request Free Trial
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

      {/* ================================================================== */}
      {/* SECTION 15: FOOTER */}
      {/* ================================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-6 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <div>
                <span className="text-white font-semibold">CLARENCE</span>
                <span className="text-slate-500 text-sm ml-2">The Honest Broker</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-8 text-sm">
              <Link href="/" className="hover:text-white transition-colors">
                Home
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
            <p className="text-slate-500 mt-1">Remove the emotion. See the leverage. Reach fair agreements faster.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}