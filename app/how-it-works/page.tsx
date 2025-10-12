'use client'
import { useState } from 'react'
import Link from 'next/link'

// ========== INTERFACES SECTION ==========
interface ProcessStep {
  id: number
  title: string
  icon: string
  description: string
  details: string[]
}

// ========== DATA SECTION ==========
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  }
]

// ========== MAIN COMPONENT SECTION ==========
export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  // ========== HANDLERS SECTION ==========
  const toggleStep = (stepId: number) => {
    setExpandedStep(expandedStep === stepId ? null : stepId)
  }

  // ========== RENDER SECTION ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
      
      {/* ========== NAVIGATION HEADER SECTION ========== */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">
              ← Back to Home
            </Link>
            <div className="flex gap-6 items-center">
              <Link href="/phases" className="text-slate-300 hover:text-white text-sm font-medium transition-colors">
                6-Phase Process
              </Link>
              <Link href="/auth/login" className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========== MAIN CONTENT SECTION ========== */}
      <div className="container mx-auto px-6 py-8">
        
        {/* ========== TITLE SECTION ========== */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-medium text-white tracking-wide mb-2 animate-fade-in">
            CLARENCE
          </h1>
          <p className="text-sm text-slate-400 font-light tracking-wider animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            The Honest Broker
          </p>
        </div>

        {/* ========== SPLIT LAYOUT CONTENT SECTION ========== */}
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 mb-12">
            
            {/* ========== LEFT SIDE - HERO TEXT SECTION ========== */}
            <div className="animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              <h2 className="text-3xl font-medium text-white mb-6">
                How CLARENCE Works
              </h2>
              
              {/* ========== UPDATED THREE PARAGRAPHS SECTION ========== */}
              <div className="space-y-4">
                <p className="text-slate-300 font-light leading-relaxed">
                  Clarence supports the values of collaboration, transparency, impartiality and a desire to achieve balanced, optimal and durable contracts though ones that are realistic and take account of each party&apos;s leverage.
                </p>
                
                <p className="text-slate-300 font-light leading-relaxed">
                  Clarence takes the emotion and strain out of negotiation and facilitates stronger relationships.
                </p>
                
                <p className="text-slate-300 font-light leading-relaxed">
                  Clarence brings to each negotiation a level of expertise akin to a leading practitioner who has specialized in the relevant field for decades.
                </p>
              </div>
            </div>

            {/* ========== RIGHT SIDE - PROCESS STEPS SECTION ========== */}
            <div className="space-y-2 animate-fade-in max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              {processSteps.map((step) => (
                <div
                  key={step.id}
                  className="bg-slate-800/30 backdrop-blur rounded-lg border border-slate-700/30 overflow-hidden transition-all duration-300 hover:bg-slate-800/50"
                >
                  {/* ========== STEP HEADER BUTTON ========== */}
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-slate-700/30 rounded-lg group-hover:bg-slate-700/50 transition-colors">
                        <span className="text-lg">{step.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white">{step.title}</h3>
                        </div>
                        <p className="text-slate-400 text-xs font-light mt-0.5">{step.description}</p>
                      </div>
                    </div>
                    <div className="text-slate-500 text-sm transition-transform duration-300 ml-2"
                         style={{ transform: expandedStep === step.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </div>
                  </button>
                  
                  {/* ========== EXPANDED STEP DETAILS ========== */}
                  {expandedStep === step.id && (
                    <div className="px-4 pb-3 border-t border-slate-700/30">
                      <div className="pt-3 pl-13">
                        <ul className="space-y-1.5">
                          {step.details.map((detail, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-0.5">•</span>
                              <span className="text-slate-300 text-xs font-light leading-relaxed">{detail}</span>
                            </li>
                          ))}
                        </ul>
                        
                        {/* ========== PHASE 4 SPECIAL CALLOUT ========== */}
                        {step.id === 4 && (
                          <div className="mt-3 p-2 bg-slate-700/20 rounded border border-slate-600/20">
                            <p className="text-slate-300 text-xs">
                              <strong className="font-medium">Explore in detail:</strong> View the complete breakdown of each negotiation phase. 
                              <Link href="/phases" className="text-slate-400 hover:text-slate-200 ml-1 font-medium transition-colors">
                                See the 6-Phase Process →
                              </Link>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========== BOTTOM NAVIGATION SECTION ========== */}
        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <div className="flex justify-center gap-8">
            <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Home</Link>
            <Link href="/terms" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Terms</Link>
            <Link href="/privacy" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}