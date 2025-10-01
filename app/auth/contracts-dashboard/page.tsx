'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserInfo {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  role?: string
}

interface Session {
  sessionId: string
  customerCompany: string
  serviceRequired: string
  dealValue: string
  status: string
}

export default function ContractsDashboard() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    const authData = JSON.parse(auth)
    setUserInfo(authData.userInfo)
    
    // Load sessions (mock data for now)
    setSessions([]) // Empty for now, will add real data later
    setLoading(false)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Contract Dashboard</h1>
        <p className="mb-4">Welcome, {userInfo?.firstName || 'User'}</p>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4">Loading contracts...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm text-center">
            <p className="text-gray-600 mb-4">No active contracts yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map(session => (
              <div key={session.sessionId} className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-semibold">{session.customerCompany}</h3>
                <p className="text-gray-600">{session.serviceRequired}</p>
              </div>
            ))}
          </div>
        )}
        
        <Link href="/chat" className="mt-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
          Open CLARENCE Chat
        </Link>
      </div>
    </div>
  )
}