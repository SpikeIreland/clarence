// Updated: Wed Oct  1 07:02:47 AWST 2025

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <div className="bg-black/20 backdrop-blur border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-3xl font-bold text-white">CLARENCE</Link>
            <div className="flex gap-6">
              <Link href="/how-it-works" className="text-white font-semibold">How It Works</Link>
              <Link href="/auth/login" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition inline-block">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            How CLARENCE Works
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            CLARENCE leads parties through an intuitive and structured negotiation process,
            combining AI-powered insights with transparent compromise brokering to efficiently produce optimal outcomes.
          </p>
        </div>

        {/* Process Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {processSteps.map((step) => (
              <div
                key={step.id}
                className="bg-white/10 backdrop-blur rounded-xl border border-white/20 overflow-hidden transition-all duration-300 hover:bg-white/15"
              >
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-6">
                    <div className="flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-xl">
                      <span className="text-3xl">{step.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-blue-400 font-semibold">Step {step.id}</span>
                        <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                      </div>
                      <p className="text-white/70">{step.description}</p>
                    </div>
                  </div>
                  <div className="text-white/60 text-2xl transition-transform duration-300"
                       style={{ transform: expandedStep === step.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                  </div>
                </button>
                
                {expandedStep === step.id && (
                  <div className="px-8 pb-6 border-t border-white/10">
                    <div className="pt-6 pl-22">
                      <ul className="space-y-3">
                        {step.details.map((detail, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <span className="text-blue-400 mt-1">•</span>
                            <span className="text-white/80">{detail}</span>
                          </li>
                        ))}
                      </ul>
                      {step.id === 4 && (
                        <div className="mt-6 p-4 bg-blue-600/20 rounded-lg border border-blue-500/30">
                          <p className="text-white/90 text-sm">
                            <strong>Explore in detail:</strong> View the complete breakdown of each negotiation phase. 
                            <Link href="/negotiation-phases" className="text-blue-400 hover:text-blue-300 ml-2 font-semibold">
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

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur rounded-2xl p-12 border border-white/20">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Transform Your Contract Negotiations?
            </h2>
            <p className="text-white/80 mb-8 max-w-2xl mx-auto">
              Join forward-thinking companies using CLARENCE to negotiate better contracts with 
              transparent compromise brokering and real-time contract generation.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/auth/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition inline-block">
                Get Started Free
              </Link>
              <Link href="/auth/login" className="border border-white/30 hover:border-white/50 text-white px-8 py-4 rounded-lg text-lg transition inline-block">
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <div className="flex justify-center gap-8">
            <Link href="/" className="text-white/60 hover:text-white transition">Home</Link>
            <Link href="/terms" className="text-white/60 hover:text-white transition">Terms</Link>
            <Link href="/privacy" className="text-white/60 hover:text-white transition">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}