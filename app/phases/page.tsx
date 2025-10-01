'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Phase {
  number: number
  title: string
  subtitle: string
  description: string[]
  keyOutcome: string
}

const phases: Phase[] = [
  {
    number: 1,
    title: "Phase 1",
    subtitle: "Deal Profile, Party Fit and Leverage",
    description: [
      "During Phase 1, CLARENCE will capture the inputs required to create a detailed and holistic profile of the deal from commercial, legal and operational perspectives.",
      "Assess the fit between the parties in relation to the deal (including the fit between bidders in a competitive contracting process).",
      "Develop a calculation of the parties' respective leverage.",
      "CLARENCE will auto-populate any data points into the relevant contract clauses or schedules.",
      "The ensuing negotiation will then include a point weighting in relation to each party's position selection to account for leverage."
    ],
    keyOutcome: "Comprehensive deal profile with leverage-weighted negotiation framework"
  },
  {
    number: 2,
    title: "Phase 2",
    subtitle: "Contract Foundation",
    description: [
      "During Phase 2, CLARENCE will elicit the parties' first set of inputs on the full range of contract clauses.",
      "This includes both the clause positions and the leverage-constrained priority ranking of each clause.",
      "CLARENCE will identify for the parties where they are not yet aligned.",
      "Highlights areas requiring compromises during the balance of the negotiation."
    ],
    keyOutcome: "Complete initial positions mapped with alignment gaps identified"
  },
  {
    number: 3,
    title: "Phase 3",
    subtitle: "Gap Narrowing",
    description: [
      "During Phase 3, CLARENCE will guide the parties through areas where alignment is high to moderate.",
      "Focus on areas where compromises are readily available.",
      "Parties can reach agreement relatively quickly through one or two iterations.",
      "Building momentum through quick wins on easier agreement points."
    ],
    keyOutcome: "Quick wins achieved on high-alignment items"
  },
  {
    number: 4,
    title: "Phase 4",
    subtitle: "Points of Contention",
    description: [
      "During Phase 4, CLARENCE will lead the parties through areas of moderate to low alignment.",
      "Address points where compromises might be more nuanced.",
      "Facilitate trade-offs across unrelated clauses to prevent negotiation deadlock.",
      "Navigate complex interdependencies to avoid the negotiation process becoming stuck."
    ],
    keyOutcome: "Resolution of complex contentious points through creative compromises"
  },
  {
    number: 5,
    title: "Phase 5",
    subtitle: "Deal Drivers (The Schedules)",
    description: [
      "During Phase 5, with most of the main agreement completed, CLARENCE will guide parties through key commercial and operational terms.",
      "These terms are often captured in schedules and frequently drive and determine the success of the deal.",
      "Negotiations often get bogged down in this phase.",
      "CLARENCE's focus on creative and pragmatic trade-offs is critical at this stage."
    ],
    keyOutcome: "Commercial and operational schedules finalized"
  },
  {
    number: 6,
    title: "Phase 6",
    subtitle: "Final Review and Closure",
    description: [
      "During Phase 6, CLARENCE will lead the process of reaching agreement on any remaining points.",
      "Tying up various loose ends throughout the contract.",
      "Ensuring internal consistency across all sections.",
      "Finalizing the contract for execution."
    ],
    keyOutcome: "Contract ready for signature"
  }
]

export default function PhasesPage() {
  const [selectedPhase, setSelectedPhase] = useState<number>(1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <div className="bg-black/20 backdrop-blur border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-3xl font-bold text-white">CLARENCE</Link>
            <div className="flex gap-6">
              <Link href="/how-it-works" className="text-white/80 hover:text-white transition">How It Works</Link>
              <Link href="/phases" className="text-white font-semibold">6-Phase Process</Link>
              <Link href="/auth/login" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition inline-block">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            The 6-Phase Negotiation Process
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            CLARENCE&apos;s structured approach guides parties through a proven negotiation framework,
            from initial profiling to final contract execution.
          </p>
        </div>

        {/* Phase Timeline */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="flex justify-between items-center relative">
            {/* Progress Line */}
            <div className="absolute top-8 left-0 right-0 h-1 bg-white/20 z-0" />
            <div 
              className="absolute top-8 left-0 h-1 bg-blue-500 z-0 transition-all duration-500"
              style={{ width: `${((selectedPhase - 1) / 5) * 100}%` }}
            />
            
            {/* Phase Circles */}
            {phases.map((phase) => (
              <button
                key={phase.number}
                onClick={() => setSelectedPhase(phase.number)}
                className="relative z-10 group"
              >
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg
                  transition-all duration-300 transform hover:scale-110
                  ${selectedPhase === phase.number 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                    : selectedPhase > phase.number
                    ? 'bg-blue-600/50 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                  }
                `}>
                  {phase.number}
                </div>
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-32 text-center">
                  <p className="text-xs text-white/80 font-medium whitespace-nowrap">
                    {phase.subtitle.split(' ').slice(0, 2).join(' ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Phase Details */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8 md:p-12">
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <span className="text-4xl font-bold text-blue-400">
                    {phases[selectedPhase - 1].number}
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {phases[selectedPhase - 1].title}
                  </h2>
                  <p className="text-xl text-blue-400">
                    {phases[selectedPhase - 1].subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {phases[selectedPhase - 1].description.map((desc, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-blue-400 mt-1">▸</span>
                  <p className="text-white/90 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="bg-blue-600/20 rounded-xl p-6 border border-blue-500/30">
              <h3 className="text-lg font-semibold text-blue-400 mb-2">Key Outcome</h3>
              <p className="text-white/90">{phases[selectedPhase - 1].keyOutcome}</p>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8">
              <button
                onClick={() => setSelectedPhase(Math.max(1, selectedPhase - 1))}
                disabled={selectedPhase === 1}
                className={`
                  px-6 py-3 rounded-lg font-semibold transition
                  ${selectedPhase === 1 
                    ? 'bg-white/10 text-white/30 cursor-not-allowed' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                  }
                `}
              >
                ← Previous Phase
              </button>
              
              <button
                onClick={() => setSelectedPhase(Math.min(6, selectedPhase + 1))}
                disabled={selectedPhase === 6}
                className={`
                  px-6 py-3 rounded-lg font-semibold transition
                  ${selectedPhase === 6 
                    ? 'bg-white/10 text-white/30 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                Next Phase →
              </button>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur rounded-2xl p-12 border border-white/20 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Experience the Complete Negotiation Process
            </h2>
            <p className="text-white/80 mb-8">
              Start your first negotiation and let CLARENCE guide you through each phase.
            </p>
            <Link href="/auth/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition inline-block">
              Begin Your Negotiation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}