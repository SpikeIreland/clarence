'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Shield, FileText, BarChart3, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/dataroom/supabase'
import { DATAROOM_ADMIN_EMAILS } from '@/lib/dataroom/constants'

type AuthTab = 'investor' | 'team'

export default function DataroomLanding() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AuthTab>('investor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleTeamSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
        return
      }

      // Verify this email is in the admin list
      if (!DATAROOM_ADMIN_EMAILS.includes(email.toLowerCase())) {
        await supabase.auth.signOut()
        setMessage({ type: 'error', text: 'This account does not have data room admin access.' })
        setLoading(false)
        return
      }

      router.push('/admin')
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
      setLoading(false)
    }
  }

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

      {/* Auth section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => { setActiveTab('investor'); setMessage(null) }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'investor'
                ? 'text-white border-b-2 border-emerald-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Investor Access
          </button>
          <button
            onClick={() => { setActiveTab('team'); setMessage(null) }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'text-white border-b-2 border-emerald-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Team Sign In
          </button>
        </div>

        <div className="p-8">
          {/* Message */}
          {message && (
            <div className={`mb-6 p-3 rounded-lg text-center text-sm ${
              message.type === 'success'
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                : 'bg-red-900/30 text-red-400 border border-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {activeTab === 'investor' ? (
            <div className="text-center">
              <h2 className="text-white text-xl font-semibold mb-2">Investor Access</h2>
              <p className="text-slate-400 text-sm mb-6">
                If you have been invited, enter your email to receive a secure access link.
              </p>
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
          ) : (
            <div className="max-w-md mx-auto">
              <h2 className="text-white text-xl font-semibold mb-2 text-center">
                Team Sign In
              </h2>
              <p className="text-slate-400 text-sm mb-6 text-center">
                Sign in with your Clarence team credentials.
              </p>
              <form onSubmit={handleTeamSignIn} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="you@clarencelegal.ai"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="Your password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
