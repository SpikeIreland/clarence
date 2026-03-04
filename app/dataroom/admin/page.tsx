import { FileText, Users, Receipt, TrendingUp } from 'lucide-react'

const stats = [
  { label: 'Documents', value: '0', icon: FileText },
  { label: 'Investors', value: '0', icon: Users },
  { label: 'Expenses Logged', value: '0', icon: Receipt },
  { label: 'Financial Entries', value: '0', icon: TrendingUp },
]

export default function AdminDashboard() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">
          Admin Dashboard
        </h1>
        <p className="text-slate-400 text-sm">
          Data room overview and management.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5"
          >
            <stat.icon className="w-5 h-5 text-emerald-500 mb-3" />
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
            <p className="text-slate-500 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-white font-medium mb-4">Recent Activity</h2>
        <p className="text-slate-500 text-sm">
          Investor access logs and document activity will appear here.
        </p>
      </div>
    </div>
  )
}
