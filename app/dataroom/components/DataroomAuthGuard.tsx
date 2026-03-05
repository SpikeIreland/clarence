'use client'

import { useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/dataroom/supabase'
import { DATAROOM_ADMIN_EMAILS } from '@/lib/dataroom/constants'
import type { DataroomUserRole } from '@/lib/dataroom/types'

interface DataroomAuthGuardProps {
  children: ReactNode
  requiredRole?: DataroomUserRole
}

export default function DataroomAuthGuard({
  children,
  requiredRole,
}: DataroomAuthGuardProps) {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const [role, setRole] = useState<DataroomUserRole | null>(null)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setStatus('unauthenticated')
        return
      }

      // Check if user is an admin
      const isAdmin = DATAROOM_ADMIN_EMAILS.includes(
        (user.email || '').toLowerCase()
      )

      if (isAdmin) {
        setRole('admin')
        setStatus('authenticated')
        return
      }

      // Check if user is an investor
      const { data: investor } = await supabase
        .from('dataroom_investors')
        .select('investor_id, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (investor) {
        setRole('investor')
        setStatus('authenticated')
        return
      }

      setStatus('unauthenticated')
    }

    checkAuth()
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    // Redirect to the data room landing page to sign in
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
    return null
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold mb-2">Insufficient Access</h2>
          <p className="text-slate-400 text-sm">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
