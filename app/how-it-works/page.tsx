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
    title: "Deal Definition & Profile",
    icon: "📋",
    description: "Establish clear parameters and objectives for your negotiation",
    details: [
      "Define the scope and boundaries of the contract",
      "Identify key stakeholders and decision-makers",
      "Set measurable objectives and success criteria",
      "Document must-have vs. nice-to-have terms",
      "Establish timeline and milestones"
    ]
  },
  {
    id: 2,
    title: "Party Fit",
    icon: "🤝",
    description: "Assess compatibility and alignment between negotiating parties",
    details: [
      "Analyze organizational compatibility",
      "Evaluate cultural and operational alignment",
      "Identify shared goals and potential conflicts",
      "Assess risk tolerance and negotiation styles",
      "Map complementary strengths and needs"
    ]
  },
  {
    id: 3,
    title: "Leverage Assessment",
    icon: "⚖️",
    description: "Understand negotiation dynamics and relative positions",
    details: [
      "Evaluate each party's alternatives (BATNA)",
      "Identify sources of negotiating power",
      "Assess market conditions and timing factors",
      "Analyze dependencies and critical needs",
      "Map areas of flexibility and firm boundaries"
    ]
  },
  {
    id: 4,
    title: "6-Phase Negotiation Process",
    icon: "🔄",
    description: "Structured approach to reaching mutually beneficial agreements",
    details: [
      "Phase 1: Opening positions and initial proposals",
      "Phase 2: Information exchange and clarification",
      "Phase 3: Bargaining and trade-offs",
      "Phase 4: Creative problem-solving",
      "Phase 5: Agreement refinement",
      "Phase 6: Final terms and documentation"
    ]
  },
  {
    id: 5,
    title: "CLARENCE Chat",
    icon: "💬",
    description: "AI-powered mediation assistant for real-time negotiation support",
    details: [
      "Natural language interaction with CLARENCE AI",
      "Real-time suggestions for win-win solutions",
      "Neutral mediation to break deadlocks",
      "Automated tracking of discussion points",
      "Intelligent recommendations based on precedents"
    ]
  },
  {
    id: 6,
    title: "Contract Generation",
    icon: "📄",
    description: "Automated creation of balanced, comprehensive agreements",
    details: [
      "AI-powered drafting based on negotiated terms",
      "Industry-standard templates and clauses",
      "Balanced language protecting both parties",
      "Automatic consistency and completeness checks",
      "Multiple format exports (PDF, Word, etc.)"
    ]
  },
  {
    id: 7,
    title: "Contract Governance",
    icon: "🛡️",
    description: "Ongoing management and compliance monitoring",
    details: [
      "Performance tracking against contract terms",
      "Automated milestone and deadline reminders",
      "Change management and amendment tracking",
      "Dispute resolution support",
      "Renewal and renegotiation management"
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
            CLARENCE uses a proven 7-step process to facilitate successful B2B contract negotiations,
            combining AI-powered insights with structured mediation techniques.
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
                      {step.id === 5 && (
                        <div className="mt-6 p-4 bg-blue-600/20 rounded-lg border border-blue-500/30">
                          <p className="text-white/90 text-sm">
                            <strong>Try CLARENCE Chat:</strong> Experience our AI mediation assistant firsthand. 
                            <Link href="/auth/signup" className="text-blue-400 hover:text-blue-300 ml-2 font-semibold">
                              Sign up for free →
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
              Join forward-thinking companies using CLARENCE to negotiate better contracts in less time.
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