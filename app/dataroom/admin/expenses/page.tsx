'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Receipt, Trash2, RefreshCw } from 'lucide-react'
import AddExpenseModal from '../../components/AddExpenseModal'

interface Expense {
  expense_id: string
  expense_category_id: string
  amount: number
  currency: string
  description: string
  expense_date: string
  is_recurring: boolean
  recurring_frequency: string | null
  entered_by: string
  created_at: string
  category: { name: string } | null
}

interface Summary {
  total: number
  thisMonth: number
  recurringMonthly: number
}

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, thisMonth: 0, recurringMonthly: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [categories, setCategories] = useState<{ expense_category_id: string; name: string }[]>([])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dataroom/expenses')
      const data = await res.json()
      if (data.expenses) {
        setExpenses(data.expenses)
        setSummary(data.summary)
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err)
    }
    setLoading(false)
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/dataroom/expense-categories')
      const data = await res.json()
      if (data.categories) {
        setCategories(data.categories)
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }, [])

  useEffect(() => {
    fetchExpenses()
    fetchCategories()
  }, [fetchExpenses, fetchCategories])

  async function handleDelete(expenseId: string) {
    if (!confirm('Are you sure you want to delete this expense?')) return

    setDeleting(expenseId)
    try {
      const res = await fetch('/api/dataroom/expenses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_id: expenseId }),
      })

      if (res.ok) {
        fetchExpenses()
      }
    } catch (err) {
      console.error('Failed to delete expense:', err)
    }
    setDeleting(null)
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const filteredExpenses = filterCategory
    ? expenses.filter((e) => e.expense_category_id === filterCategory)
    : expenses

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
        <div className="flex items-center gap-3">
          <button
            onClick={fetchExpenses}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Expenses</p>
          <p className="text-2xl font-semibold text-white">
            {loading ? '...' : formatCurrency(summary.total)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">This Month</p>
          <p className="text-2xl font-semibold text-white">
            {loading ? '...' : formatCurrency(summary.thisMonth)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Recurring Monthly</p>
          <p className="text-2xl font-semibold text-white">
            {loading ? '...' : formatCurrency(summary.recurringMonthly)}
          </p>
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-4">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.expense_category_id} value={cat.expense_category_id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Expense table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_2fr_1fr_auto] gap-4 px-6 py-3 bg-slate-800/50 text-slate-400 text-xs font-medium uppercase tracking-wider">
          <span>Date</span>
          <span>Category</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="w-8" />
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-6 flex items-center gap-4 text-slate-500">
            <Receipt className="w-5 h-5" />
            <span className="text-sm">
              {filterCategory ? 'No expenses in this category.' : 'No expenses logged yet.'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.expense_id}
                className="grid grid-cols-[1fr_1fr_2fr_1fr_auto] gap-4 px-6 py-3 items-center hover:bg-slate-800/30 transition-colors"
              >
                <span className="text-slate-300 text-sm">
                  {formatDate(expense.expense_date)}
                </span>
                <span className="text-slate-400 text-sm">
                  {expense.category?.name || 'Unknown'}
                </span>
                <div>
                  <span className="text-white text-sm">{expense.description}</span>
                  {expense.is_recurring && (
                    <span className="ml-2 text-xs text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">
                      {expense.recurring_frequency}
                    </span>
                  )}
                </div>
                <span className="text-white text-sm font-medium text-right">
                  {formatCurrency(Number(expense.amount))}
                </span>
                <button
                  onClick={() => handleDelete(expense.expense_id)}
                  disabled={deleting === expense.expense_id}
                  className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50 w-8 flex justify-center"
                  title="Delete expense"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <AddExpenseModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchExpenses}
        />
      )}
    </div>
  )
}
