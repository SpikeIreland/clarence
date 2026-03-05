'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/dataroom/supabase'

export default function DataroomHeader() {
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      }
    }
    getUser()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

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

        {/* Right side */}
        <div className="flex items-center gap-4">
          {userEmail ? (
            <>
              <span className="text-slate-400 text-sm hidden sm:inline">
                {userEmail}
              </span>
              <button
                onClick={handleSignOut}
                className="text-slate-500 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <span className="text-slate-500 text-sm">Investor Portal</span>
          )}
        </div>
      </div>
    </header>
  )
}
