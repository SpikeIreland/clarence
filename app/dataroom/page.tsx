import { ArrowRight, Shield, FileText, BarChart3 } from 'lucide-react'

export default function DataroomLanding() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 mb-6">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-400 text-sm">Investment Opportunity</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          CLARENCE
        </h1>
        <p className="text-xl text-slate-400 mb-2">The Honest Broker</p>
        <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed mt-6">
          AI-powered contract intelligence platform. From creation to signature —
          fair, transparent, principled. Welcome to the Clarence Legal Data Room.
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <FileText className="w-8 h-8 text-emerald-500 mb-4" />
          <h3 className="text-white font-semibold mb-2">Due Diligence Materials</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Comprehensive documentation including technical architecture,
            financial projections, and legal materials.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <Shield className="w-8 h-8 text-emerald-500 mb-4" />
          <h3 className="text-white font-semibold mb-2">Secure Access</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Tiered access controls with full audit logging. Every document view
            and download is tracked.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <BarChart3 className="w-8 h-8 text-emerald-500 mb-4" />
          <h3 className="text-white font-semibold mb-2">Financial Model</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Revenue projections, unit economics, runway analysis, and
            use of funds breakdown.
          </p>
        </div>
      </div>

      {/* Sign in prompt */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <h2 className="text-white text-xl font-semibold mb-2">Investor Access</h2>
        <p className="text-slate-400 text-sm mb-6">
          If you have been invited, enter your email to receive a secure access link.
        </p>
        {/* Placeholder for magic link form */}
        <div className="max-w-md mx-auto flex gap-3">
          <input
            type="email"
            placeholder="your@email.com"
            disabled
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-slate-500 disabled:opacity-50"
          />
          <button
            disabled
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            Access
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-3">
          Magic link authentication — coming soon
        </p>
      </div>
    </div>
  )
}
