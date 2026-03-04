import { Plus, TrendingUp, Eye, EyeOff } from 'lucide-react'

const sections = [
  { type: 'revenue_projection', label: 'Revenue Projections' },
  { type: 'cost_projection', label: 'Cost Projections' },
  { type: 'unit_economics', label: 'Unit Economics' },
  { type: 'runway', label: 'Runway Analysis' },
  { type: 'use_of_funds', label: 'Use of Funds' },
  { type: 'kpi', label: 'Key Performance Indicators' },
]

export default function AdminFinancialModel() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">
            Financial Model
          </h1>
          <p className="text-slate-400 text-sm">
            Curate financial data for investor presentation. Toggle visibility
            to control what investors can see.
          </p>
        </div>
        <button
          disabled
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {/* Visibility legend */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2 text-emerald-400">
          <Eye className="w-4 h-4" />
          <span>Visible to investors</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <EyeOff className="w-4 h-4" />
          <span>Internal only</span>
        </div>
      </div>

      {/* Section placeholders */}
      <div className="space-y-6">
        {sections.map((section) => (
          <div
            key={section.type}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {section.label}
              </h2>
              <span className="text-slate-600 text-xs">0 entries</span>
            </div>
            <p className="text-slate-500 text-sm">
              No {section.label.toLowerCase()} entries yet.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
