'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface Phase {
  number: number
  title: string
  subtitle: string
  description: string[]
  keyOutcome: string
  color: 'emerald' | 'blue' | 'amber'
}

// ============================================================================
// SECTION 2: PHASE DATA - UPDATED PER JOHN'S FEEDBACK (SCHEDULE B)
// ============================================================================

const phases: Phase[] = [
  {
    number: 1,
    title: "Phase 1",
    subtitle: "Deal Profile, Party Fit and Leverage Assessment",
    description: [
      "CLARENCE gathers the inputs required to create a detailed legal, commercial and operational deal profile and assesses the fit between the parties (including the fit between bidders in a competitive contracting process).",
      "CLARENCE assesses the parties' respective leverage (the leverage baseline) and algorithmically tracks the leverage position against the baseline as the negotiation unfolds and suggests trade offs to arrive at a contract as close to the baseline as possible (a balanced and optimal contractual outcome).",
      "CLARENCE uses the Phase 1 data collection process to set the parties initial positions on the main contract clauses and establish an initial alignment score."
    ],
    keyOutcome: "Comprehensive deal profile with leverage-weighted negotiation baseline.",
    color: 'emerald'
  },
  {
    number: 2,
    title: "Phase 2",
    subtitle: "Contract Foundation",
    description: [
      "CLARENCE will elicit the parties' inputs on the full range of contract clauses, highlight where this places the parties leverage position against the baseline score and show the parties where they are aligned and where they need to adjust their positions.",
      "CLARENCE will suggest trade offs and compromises to bring the parties closer to agreement."
    ],
    keyOutcome: "Complete mapping of contract positions, set the alignment positions and point the way to increasing alignment.",
    color: 'emerald'
  },
  {
    number: 3,
    title: "Phase 3",
    subtitle: "Gap Narrowing",
    description: [
      "CLARENCE will guide the parties in areas where the alignment gap is small and where compromises are readily available.",
      "This allows the parties to reach agreement on several clauses relatively quickly to build negotiating momentum."
    ],
    keyOutcome: "Quick wins achieved on items where alignment gap is small.",
    color: 'blue'
  },
  {
    number: 4,
    title: "Phase 4",
    subtitle: "Points of Contention",
    description: [
      "CLARENCE will use its deep expertise to guide the parties through areas of low alignment where compromises require more nuanced trade offs including compromises across unrelated clauses."
    ],
    keyOutcome: "Resolution of contentious points through creative compromises.",
    color: 'blue'
  },
  {
    number: 5,
    title: "Phase 5",
    subtitle: "Deal Drivers (The Schedules)",
    description: [
      "CLARENCE will guide the parties through key commercial, operational and technical terms generally captured in schedules and frequently driving the success of the deal.",
      "Deals often become bogged down at this stage and CLARENCE's expertise will be invaluable in brokering creative and pragmatic trade-offs."
    ],
    keyOutcome: "Commercial, operational and technical schedules finalized.",
    color: 'amber'
  },
  {
    number: 6,
    title: "Phase 6",
    subtitle: "Final Review and Closure",
    description: [
      "CLARENCE will lead the process of reaching agreement on any remaining points and tying up loose ends throughout the contract.",
      "CLARENCE will ensure internal consistency across all sections and prepare the final contract for execution."
    ],
    keyOutcome: "Contract ready for signature.",
    color: 'amber'
  }
]

// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

const getPhaseColors = (color: 'emerald' | 'blue' | 'amber', isActive: boolean) => {
  const colors = {
    emerald: {
      bg: isActive ? 'bg-emerald-500' : 'bg-emerald-100',
      text: isActive ? 'text-white' : 'text-emerald-600',
      border: 'border-emerald-200',
      accent: 'bg-emerald-50',
      ring: 'ring-emerald-500',
    },
    blue: {
      bg: isActive ? 'bg-blue-500' : 'bg-blue-100',
      text: isActive ? 'text-white' : 'text-blue-600',
      border: 'border-blue-200',
      accent: 'bg-blue-50',
      ring: 'ring-blue-500',
    },
    amber: {
      bg: isActive ? 'bg-amber-500' : 'bg-amber-100',
      text: isActive ? 'text-white' : 'text-amber-600',
      border: 'border-amber-200',
      accent: 'bg-amber-50',
      ring: 'ring-amber-500',
    },
  }
  return colors[color]
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function PhasesPage() {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]))
  const [selectedPhase, setSelectedPhase] = useState<number>(1)
  const phaseRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  // ============================================================================
  // SECTION 5: EVENT HANDLERS - FIXED SCROLL BEHAVIOR PER JOHN'S FEEDBACK
  // ============================================================================

  const handlePhaseIndicatorClick = (phaseNumber: number) => {
    setSelectedPhase(phaseNumber)
    const newExpanded = new Set<number>()
    newExpanded.add(phaseNumber)
    setExpandedPhases(newExpanded)

    // FIXED: Scroll to show the TOP of the phase card (not center)
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      const element = phaseRefs.current[phaseNumber]
      if (element) {
        const headerOffset = 120 // Account for fixed header + timeline
        const elementPosition = element.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        })
      }
    }, 100)
  }

  const togglePhaseExpansion = (phaseNumber: number) => {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(phaseNumber)) {
      newExpanded.delete(phaseNumber)
      if (selectedPhase === phaseNumber) {
        setSelectedPhase(0)
      }
    } else {
      newExpanded.clear()
      newExpanded.add(phaseNumber)
      setSelectedPhase(phaseNumber)
    }
    setExpandedPhases(newExpanded)
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
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/phases"
                className="text-white text-sm font-medium transition-colors"
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
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              The 6-Phase Negotiation Process
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              CLARENCE guides parties through a structured negotiation framework—from initial
              deal profiling through to contract execution. Each phase builds on the last,
              creating momentum toward agreement.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 9: PHASE TIMELINE */}
      {/* FIXED: Phase names now fully visible with text wrapping */}
      {/* ================================================================== */}
      <section className="bg-slate-100 border-b border-slate-200 py-8">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-start justify-between relative">
              {/* Connecting Line */}
              <div className="absolute top-6 left-8 right-8 h-1 bg-slate-300"></div>

              {/* Progress Line */}
              <div
                className="absolute top-6 left-8 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 transition-all duration-500"
                style={{ width: `${Math.max(0, ((selectedPhase - 1) / 5) * (100 - 8))}%` }}
              ></div>

              {/* Phase Indicators - Full text display with wrapping */}
              {phases.map((phase) => {
                const colors = getPhaseColors(phase.color, selectedPhase === phase.number)
                // Short labels for timeline display
                const shortLabels: Record<number, string> = {
                  1: 'Deal Profile & Leverage',
                  2: 'Contract Foundation',
                  3: 'Gap Narrowing',
                  4: 'Points of Contention',
                  5: 'Deal Drivers',
                  6: 'Final Review'
                }
                return (
                  <button
                    key={phase.number}
                    onClick={() => handlePhaseIndicatorClick(phase.number)}
                    className="relative z-10 group flex flex-col items-center w-28"
                  >
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                      transition-all duration-300 transform group-hover:scale-110 border-4 border-white shadow-md
                      ${colors.bg} ${colors.text}
                      ${selectedPhase === phase.number ? 'ring-4 ring-offset-2 ' + colors.ring : ''}
                    `}>
                      {phase.number}
                    </div>
                    {/* Phase name - short labels that fit */}
                    <div className="mt-3 text-center min-h-[2.5rem] flex items-start justify-center">
                      <p className={`text-xs font-medium transition-colors leading-tight ${selectedPhase === phase.number ? 'text-slate-800' : 'text-slate-500'
                        }`}>
                        {shortLabels[phase.number]}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 10: PHASE CARDS */}
      {/* Expandable cards for each phase - UPDATED with Schedule B content */}
      {/* ================================================================== */}
      <section className="py-12">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {phases.map((phase) => {
              const colors = getPhaseColors(phase.color, false)
              const isExpanded = expandedPhases.has(phase.number)

              return (
                <div
                  key={phase.number}
                  id={`phase-${phase.number}`}
                  ref={(el) => { phaseRefs.current[phase.number] = el }}
                  className={`
                    bg-white rounded-xl border overflow-hidden transition-all duration-300
                    ${isExpanded
                      ? 'border-slate-300 shadow-lg'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }
                  `}
                >
                  {/* Phase Header - Always Visible */}
                  <button
                    onClick={() => togglePhaseExpansion(phase.number)}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Phase Number Badge */}
                      <div className={`
                        w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
                        ${colors.bg}
                      `}>
                        <span className={`text-xl font-bold ${colors.text}`}>
                          {phase.number}
                        </span>
                      </div>

                      {/* Phase Title */}
                      <div className="text-left">
                        <h2 className="text-lg font-semibold text-slate-800">
                          {phase.title}: {phase.subtitle}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                          {phase.keyOutcome}
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

                  {/* Phase Details - Expandable */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-slate-100">
                      <div className="pt-6">
                        {/* Description Points */}
                        <div className="space-y-3 mb-6">
                          {phase.description.map((desc, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${phase.color === 'emerald' ? 'bg-emerald-500' :
                                phase.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
                                }`}></div>
                              <p className="text-slate-600 leading-relaxed">{desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* Key Outcome Box */}
                        <div className={`rounded-xl p-5 border ${colors.accent} ${colors.border}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className={`w-5 h-5 ${phase.color === 'emerald' ? 'text-emerald-600' :
                              phase.color === 'blue' ? 'text-blue-600' : 'text-amber-600'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-sm font-semibold text-slate-700">Key Outcome</h3>
                          </div>
                          <p className="text-slate-600">{phase.keyOutcome}</p>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                          <button
                            onClick={() => phase.number > 1 && handlePhaseIndicatorClick(phase.number - 1)}
                            disabled={phase.number === 1}
                            className={`
                              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                              ${phase.number === 1
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-600 hover:bg-slate-100'
                              }
                            `}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous Phase
                          </button>

                          <span className="text-sm text-slate-400">
                            Phase {phase.number} of 6
                          </span>

                          <button
                            onClick={() => phase.number < 6 && handlePhaseIndicatorClick(phase.number + 1)}
                            disabled={phase.number === 6}
                            className={`
                              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                              ${phase.number === 6
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-blue-600 hover:bg-blue-50'
                              }
                            `}
                          >
                            Next Phase
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 11: CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Ready to Start Your Negotiation?
          </h2>
          <p className="text-slate-600 mb-8 max-w-xl mx-auto">
            Experience the structured, data-driven approach to contract negotiation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/25"
            >
              Get Started
            </Link>
            <Link
              href="/how-it-works"
              className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all"
            >
              Learn How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SECTION 12: FOOTER - UPDATED with tagline */}
      {/* ================================================================== */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            {/* Brand - UPDATED to include tagline */}
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