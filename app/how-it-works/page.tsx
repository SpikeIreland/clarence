'use client'
import { useState } from 'react'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface ProcessStep {
  id: number
  title: string
  icon: string
  description: string
  details: string[]
  color: 'emerald' | 'blue' | 'amber'
}

// ============================================================================
// SECTION 2: PROCESS STEPS DATA
// ============================================================================

const processSteps: ProcessStep[] = [
  {
    id: 1,
    title: "Deal Definition",
    icon: "📋",
    description: "CLARENCE creates a comprehensive deal profile from party inputs",
    details: [
      "CLARENCE will ask the parties for a number of details from which it will create a comprehensive deal profile",
      "These details will auto-populate into the relevant parts of the contract negotiation process",
      "Expected length of term will go into the Phase 2 term clause",
      "Expected service levels will display in the Phase 5 services schedule",
      "All information gathered becomes the foundation for the negotiation"
    ],
    color: 'emerald'
  },
  {
    id: 2,
    title: "Party Fit",
    icon: "🤝",
    description: "Detailed assessment of compatibility between negotiating parties",
    details: [
      "CLARENCE will obtain detailed information about each party",
      "Present a comprehensive fit assessment",
      "Work with the parties to understand compatibility",
      "Find ways to optimize the fit between parties",
      "Mitigate concerns in areas where the fit is less optimal"
    ],
    color: 'emerald'
  },
  {
    id: 3,
    title: "Leverage Assessment",
    icon: "⚖️",
    description: "Realistic evaluation of each party's negotiating position",
    details: [
      "CLARENCE considers several data points to assess parties' respective leverage",
      "Provides for a realistic negotiation process",
      "Includes point weighting in relation to each party's position selection",
      "Accounts for leverage throughout the negotiation",
      "Ensures balanced and fair outcomes based on actual negotiating power"
    ],
    color: 'blue'
  },
  {
    id: 4,
    title: "6-Phase Negotiation Process",
    icon: "🔄",
    description: "Structured negotiation through six comprehensive phases",
    details: [
      "Phase 1 – Deal profile, party fit and leverage",
      "Phase 2 – Contract foundation",
      "Phase 3 – Gap narrowing",
      "Phase 4 – Points of contention",
      "Phase 5 – Deal drivers (the schedules)",
      "Phase 6 – Final review and closure"
    ],
    color: 'blue'
  },
  {
    id: 5,
    title: "CLARENCE Chat",
    icon: "💬",
    description: "AI advisor for position selection and compromise brokering",
    details: [
      "Always available to pragmatically advise parties on position selection",
      "Provides guidance on points of law and business considerations",
      "Informed by knowledge of contract type, jurisdiction, and regulatory landscape",
      "Considers deal profile and leverage in all recommendations",
      "Transparently brokers compromises between parties to efficiently produce optimal outcomes"
    ],
    color: 'amber'
  },
  {
    id: 6,
    title: "Contract Generation",
    icon: "📄",
    description: "Real-time contract updates as negotiations progress",
    details: [
      "CLARENCE updates the draft contract in real time as negotiation progresses",
      "Reflects positions agreed between the parties immediately",
      "Maintains clear drafting language throughout the contract evolution",
      "Ensures internal consistency across all contract sections",
      "Produces professional, legally sound documentation"
    ],
    color: 'amber'
  },
  {
    id: 7,
    title: "Contract Governance",
    icon: "🛡️",
    description: "Post-signature relationship management tools",
    details: [
      "CLARENCE prepares a comprehensive contract handbook for the parties",
      "Clearly outlines key obligations for each party",
      "Details governance mechanisms to be implemented",
      "Ensures harmonious post-signature relationship",
      "Provides ongoing reference for contract management"
    ],
    color: 'emerald'
  }
]

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

const getStepColors = (color: 'emerald' | 'blue' | 'amber') => {
  const colors = {
    emerald: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-600',
      border: 'border-emerald-200',
      accent: 'bg-emerald-50',
      dot: 'bg-emerald-500',
    },
    blue: {
      bg: 'bg-blue-100',
      text: 'text-blue-600',
      border: 'border-blue-200',
      accent: 'bg-blue-50',
      dot: 'bg-blue-500',
    },
    amber: {
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      border: 'border-amber-200',
      accent: 'bg-amber-50',
      dot: 'bg-amber-500',
    },
  }
  return colors[color]
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(1)

  // ============================================================================
  // SECTION 5: EVENT HANDLERS
  // ============================================================================

  const toggleStep = (stepId: number) => {
    setExpandedStep(expandedStep === stepId ? null : stepId)
  }

  // ============================================================================
  // SECTION 6: RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ================================================================== */}
      {/* SECTION 7: NAVIGATION HEADER */}
      {/* Matches Contract Studio and Landing Page header */}
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
                className="text-white text-sm font-medium transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/phases"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                The 6 Phases
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
      {/* SECTION 8: HERO SECTION */}
      {/* ================================================================== */}
      <section className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-slate-800 mb-4">
                How CLARENCE Works
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                A structured, transparent approach to contract negotiation that produces
                balanced, optimal, and durable agreements.
              </p>
            </div>

            {/* Value Propositions */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Collaboration</h3>
                <p className="text-sm text-slate-600">
                  Supports transparency and impartiality to achieve balanced outcomes
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Stronger Relationships</h3>
                <p className="text-sm text-slate-600">
                  Takes the emotion and strain out of negotiation
                </p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">Expert Knowledge</h3>
                <p className="text-sm text-slate-600">
                  Expertise akin to a leading practitioner with decades of experience
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 9: PROCESS STEPS */}
      {/* ================================================================== */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                The CLARENCE Process
              </h2>
              <p className="text-slate-600">
                Seven key components that power effective contract negotiation
              </p>
            </div>

            {/* Process Steps List */}
            <div className="space-y-4">
              {processSteps.map((step) => {
                const colors = getStepColors(step.color)
                const isExpanded = expandedStep === step.id

                return (
                  <div
                    key={step.id}
                    className={`
                      bg-white rounded-xl border overflow-hidden transition-all duration-300
                      ${isExpanded
                        ? 'border-slate-300 shadow-lg'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Step Header */}
                    <button
                      onClick={() => toggleStep(step.id)}
                      className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* Step Icon */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                          <span className="text-2xl">{step.icon}</span>
                        </div>

                        {/* Step Info */}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                              Step {step.id}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-slate-800 mt-1">
                            {step.title}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      {/* Expand/Collapse Icon */}
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                        ${isExpanded ? 'bg-slate-200' : 'bg-slate-100'}
                        transition-all duration-300
                      `}>
                        <svg
                          className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-100">
                        <div className="pt-5 pl-16">
                          <ul className="space-y-3">
                            {step.details.map((detail, index) => (
                              <li key={index} className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${colors.dot}`}></div>
                                <span className="text-slate-600 leading-relaxed">{detail}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Special callout for 6-Phase step */}
                          {step.id === 4 && (
                            <div className={`mt-6 p-4 rounded-xl border ${colors.accent} ${colors.border}`}>
                              <div className="flex items-center gap-3">
                                <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <p className="text-slate-700">
                                  <span className="font-medium">Explore in detail:</span>{' '}
                                  <Link href="/phases" className={`font-semibold hover:underline ${colors.text}`}>
                                    View the complete 6-Phase breakdown →
                                  </Link>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 10: CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Ready to Experience CLARENCE?
          </h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto">
            Start your first negotiation with the AI-powered honest broker.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/25"
            >
              Get Started
            </Link>
            <Link
              href="/phases"
              className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all"
            >
              View the 6 Phases
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 11: FOOTER */}
      {/* ================================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-6 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-white font-medium">CLARENCE</span>
            </div>

            {/* Links */}
            <div className="flex gap-8 text-sm">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
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