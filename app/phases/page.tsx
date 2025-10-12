import { useState } from 'react'

// ========== INTERFACES ==========
interface Phase {
  number: number
  title: string
  subtitle: string
  description: string[]
  keyOutcome: string
}

// ========== DATA ==========
const phases: Phase[] = [
  {
    number: 1,
    title: "Phase 1",
    subtitle: "Deal Profile, Party Fit and Leverage",
    description: [
      "CLARENCE will capture the inputs required to create a detailed legal, commercial and operational profile of the deal.",
      "Assess the fit between the parties (including the fit between bidders in a competitive contracting process).",
      "Develop a calculation of the parties' respective leverage and the parties will be allocated a corresponding number of points to use in priority-ranking each clause.",
      "Auto-populate any data points into the relevant contract clauses or schedules."
    ],
    keyOutcome: "Comprehensive deal profile with leverage-weighted negotiation framework"
  },
  {
    number: 2,
    title: "Phase 2",
    subtitle: "Contract Foundation",
    description: [
      "CLARENCE will elicit the parties' first set of inputs on the full range of contract clauses.",
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
      "CLARENCE will guide the parties through areas where alignment is high to moderate.",
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
      "CLARENCE will lead the parties through areas of moderate to low alignment.",
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
      "With most of the main agreement completed, CLARENCE will guide parties through key commercial and operational terms.",
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
      "CLARENCE will lead the process of reaching agreement on any remaining points.",
      "Tying up various loose ends throughout the contract.",
      "Ensuring internal consistency across all sections.",
      "Finalizing the contract for execution."
    ],
    keyOutcome: "Contract ready for signature"
  }
]

// ========== MAIN COMPONENT ==========
export default function PhasesPage() {
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set())

  const togglePhaseExpansion = (phaseNumber: number) => {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(phaseNumber)) {
      newExpanded.delete(phaseNumber)
    } else {
      newExpanded.add(phaseNumber)
    }
    setExpandedPhases(newExpanded)
  }

  // Navigation handler for Next.js routing
  const handleNavigation = (path: string) => {
    window.location.href = path
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
      {/* ========== NAVIGATION SECTION ========== */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-medium text-white tracking-wide">CLARENCE</h1>
              <p className="text-xs text-slate-400 font-light tracking-wider">The Honest Broker</p>
            </div>
            <button 
              onClick={() => handleNavigation('/how-it-works')}
              className="text-slate-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              ← How CLARENCE Works
            </button>
          </div>
        </div>
      </div>

      {/* ========== HERO SECTION ========== */}
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-medium text-white mb-6 animate-fade-in">
            The 6-Phase Negotiation Process
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto font-light leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            CLARENCE guides parties through a structured negotiation framework from initial deal profiling to contract execution.
          </p>
        </div>

        {/* ========== PHASE TIMELINE ========== */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="flex justify-between items-center relative">
            {/* Progress Line Background */}
            <div className="absolute top-8 left-0 right-0 h-1 bg-slate-700/50 z-0" />
            
            {/* Progress Line Active (if phase selected) */}
            {selectedPhase && (
              <div 
                className="absolute top-8 left-0 h-1 bg-slate-500 z-0 transition-all duration-500"
                style={{ width: `${((selectedPhase - 1) / 5) * 100}%` }}
              />
            )}
            
            {/* Phase Circle Buttons */}
            {phases.map((phase) => (
              <button
                key={phase.number}
                onClick={() => setSelectedPhase(phase.number)}
                className="relative z-10 group"
              >
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center font-medium text-lg
                  transition-all duration-300 transform hover:scale-110
                  ${selectedPhase === phase.number 
                    ? 'bg-slate-600 text-white shadow-lg shadow-slate-600/30' 
                    : selectedPhase && selectedPhase > phase.number
                    ? 'bg-slate-700/70 text-slate-300'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }
                `}>
                  {phase.number}
                </div>
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-32 text-center">
                  <p className="text-xs text-slate-400 font-light whitespace-nowrap">
                    {phase.subtitle.split(' ').slice(0, 2).join(' ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ========== PHASE CARDS LIST ========== */}
        <div className="max-w-4xl mx-auto space-y-4">
          {phases.map((phase) => (
            <div 
              key={phase.number}
              className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 overflow-hidden"
            >
              {/* Phase Header - Always Visible */}
              <button
                onClick={() => togglePhaseExpansion(phase.number)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-700/30 rounded-xl flex items-center justify-center">
                    <span className="text-2xl font-medium text-slate-400">
                      {phase.number}
                    </span>
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-medium text-white mb-1">
                      {phase.title}
                    </h2>
                    <p className="text-base text-slate-400 font-light">
                      {phase.subtitle}
                    </p>
                  </div>
                </div>
                <div 
                  className="text-slate-500 text-lg transition-transform duration-300"
                  style={{ transform: expandedPhases.has(phase.number) ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▼
                </div>
              </button>

              {/* Phase Details - Expandable */}
              {expandedPhases.has(phase.number) && (
                <div className="px-6 pb-6 border-t border-slate-700/50 animate-fade-in">
                  <div className="pt-6 space-y-3 mb-6">
                    {phase.description.map((desc, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span className="text-slate-500 mt-1 text-sm">▸</span>
                        <p className="text-slate-300 leading-relaxed text-sm font-light">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-600/30">
                    <h3 className="text-base font-medium text-slate-400 mb-2">Key Outcome</h3>
                    <p className="text-slate-300 text-sm font-light">{phase.keyOutcome}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ========== SELECTED PHASE DETAIL (Optional Alternative View) ========== */}
        {selectedPhase && (
          <div className="max-w-4xl mx-auto mt-8">
            <div className="bg-slate-900/50 backdrop-blur rounded-xl border border-slate-600/50 p-8">
              <h3 className="text-lg font-medium text-slate-300 mb-4">
                Currently Viewing: {phases[selectedPhase - 1].title}
              </h3>
              
              {/* Navigation Buttons */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setSelectedPhase(Math.max(1, selectedPhase - 1))}
                  disabled={selectedPhase === 1}
                  className={`
                    px-5 py-2.5 rounded-lg font-medium text-sm transition-all
                    ${selectedPhase === 1 
                      ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed' 
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700/70 hover:text-white'
                    }
                  `}
                >
                  ← Previous Phase
                </button>
                
                <button
                  onClick={() => setSelectedPhase(null)}
                  className="px-5 py-2.5 rounded-lg font-medium text-sm bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all"
                >
                  Clear Selection
                </button>
                
                <button
                  onClick={() => setSelectedPhase(Math.min(6, selectedPhase + 1))}
                  disabled={selectedPhase === 6}
                  className={`
                    px-5 py-2.5 rounded-lg font-medium text-sm transition-all
                    ${selectedPhase === 6 
                      ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white'
                    }
                  `}
                >
                  Next Phase →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== BOTTOM NAVIGATION ========== */}
        <div className="mt-16 pt-8 border-t border-slate-700/50">
          <div className="flex justify-center gap-8">
            <button 
              onClick={() => handleNavigation('/')} 
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Home
            </button>
            <button 
              onClick={() => handleNavigation('/how-it-works')} 
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              How It Works
            </button>
            <button 
              onClick={() => handleNavigation('/terms')} 
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Terms
            </button>
            <button 
              onClick={() => handleNavigation('/privacy')} 
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Privacy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}