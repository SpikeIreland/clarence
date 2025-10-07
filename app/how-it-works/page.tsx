'use client'
import { useState } from 'react'
import Link from 'next/link'

interface ProcessStep {
  id: number
  title: string
  icon: string
  description: string
  details: string[]
}

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

export default function HowItWorksPage() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const toggleStep = (stepId: number) => {
    setExpandedStep(expandedStep === stepId ? null : stepId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800">
      {/* Navigation */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-slate-700/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-medium text-white tracking-wide">
              CLARENCE
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

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-medium text-white mb-6 tracking-wide animate-fade-in">
            How CLARENCE Works
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto font-light leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            CLARENCE leads parties through an intuitive and structured negotiation process,
            combining AI-powered insights with transparent compromise brokering to efficiently produce optimal outcomes.
          </p>
        </div>

        {/* Process Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-3">
            {processSteps.map((step, index) => (
              <div
                key={step.id}
                className="bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700/50 overflow-hidden transition-all duration-300 hover:bg-slate-800/70 animate-fade-in"
                style={{ animationDelay: `${0.1 * (index + 3)}s`, animationFillMode: 'both' }}
              >
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex items-center justify-center w-14 h-14 bg-slate-700/50 rounded-lg group-hover:bg-slate-700/70 transition-colors">
                      <span className="text-2xl">{step.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-slate-500 text-sm font-medium">Step {step.id}</span>
                        <h3 className="text-lg font-medium text-white">{step.title}</h3>
                      </div>
                      <p className="text-slate-400 text-sm font-light">{step.description}</p>
                    </div>
                  </div>
                  <div className="text-slate-500 text-xl transition-transform duration-300"
                       style={{ transform: expandedStep === step.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                  </div>
                </button>
                
                {expandedStep === step.id && (
                  <div className="px-6 pb-5 border-t border-slate-700/50">
                    <div className="pt-5 pl-19">
                      <ul className="space-y-2">
                        {step.details.map((detail, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <span className="text-slate-500 mt-1 text-sm">•</span>
                            <span className="text-slate-300 text-sm font-light leading-relaxed">{detail}</span>
                          </li>
                        ))}
                      </ul>
                      {step.id === 4 && (
                        <div className="mt-5 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                          <p className="text-slate-300 text-sm">
                            <strong className="font-medium">Explore in detail:</strong> View the complete breakdown of each negotiation phase. 
                            <Link href="/phases" className="text-slate-400 hover:text-slate-200 ml-2 font-medium transition-colors">
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

        {/* Bottom Navigation */}
        <div className="mt-16 pt-8 border-t border-slate-700/50">
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