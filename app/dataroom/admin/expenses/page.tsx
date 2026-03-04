import { Plus, Receipt } from 'lucide-react'

export default function AdminExpenses() {
  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Expenses</h1>
          <p className="text-slate-400 text-sm">
            Track development costs and operational expenses. Internal only —
            not visible to investors.
          </p>
        </div>
        <button
          disabled
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Log Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Expenses</p>
          <p className="text-2xl font-semibold text-white">£0.00</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">This Month</p>
          <p className="text-2xl font-semibold text-white">£0.00</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Recurring Monthly</p>
          <p className="text-2xl font-semibold text-white">£0.00</p>
        </div>
      </div>

      {/* Expense table placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-slate-800/50 text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Date</span>
          <span>Category</span>
          <span>Description</span>
          <span>Amount</span>
          <span>Entered By</span>
        </div>
        <div className="p-6 flex items-center gap-4 text-slate-500">
          <Receipt className="w-5 h-5" />
          <span className="text-sm">No expenses logged yet.</span>
        </div>
      </div>
    </div>
  )
}
