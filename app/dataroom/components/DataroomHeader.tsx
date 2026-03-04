'use client'

import Link from 'next/link'

export default function DataroomHeader() {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold tracking-wide text-sm">CLARENCE</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-sm">Data Room</span>
          </div>
        </Link>

        {/* Right side — placeholder for auth-aware user menu */}
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">Investor Portal</span>
        </div>
      </div>
    </header>
  )
}
