'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText,
  Users,
  Receipt,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react'

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/documents', label: 'Documents', icon: FileText },
  { href: '/admin/investors', label: 'Investors', icon: Users },
  { href: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { href: '/admin/financial-model', label: 'Financial Model', icon: TrendingUp },
]

export default function DataroomSidebar() {
  const pathname = usePathname()

  // Normalise pathname: strip /dataroom prefix for matching
  const normalised = pathname.replace(/^\/dataroom/, '') || '/'

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-[calc(100vh-4rem-4.5rem)]">
      <nav className="p-4 space-y-1">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider px-3 mb-3">
          Administration
        </p>
        {adminLinks.map((link) => {
          const isActive =
            normalised === link.href ||
            (link.href !== '/admin' && normalised.startsWith(link.href))

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
