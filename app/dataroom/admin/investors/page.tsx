import { UserPlus, Users } from 'lucide-react'

export default function AdminInvestors() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Investors</h1>
          <p className="text-slate-400 text-sm">
            Manage investor access, tiers, and invitations.
          </p>
        </div>
        <button
          disabled
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          Invite Investor
        </button>
      </div>

      {/* Investor table placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-slate-800/50 text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Name</span>
          <span>Company</span>
          <span>Tier</span>
          <span>Status</span>
          <span>Last Access</span>
        </div>
        <div className="p-6 flex items-center gap-4 text-slate-500">
          <Users className="w-5 h-5" />
          <span className="text-sm">No investors invited yet.</span>
        </div>
      </div>
    </div>
  )
}
