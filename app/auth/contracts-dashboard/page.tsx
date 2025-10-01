'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ContractsDashboard() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
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
    setLoading(false)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Contract Dashboard</h1>
        <p>Welcome, {userInfo?.firstName || 'User'}</p>
        
        {/* Add your dashboard content here */}
        
        <Link href="/chat" className="mt-8 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg">
          Open CLARENCE Chat
        </Link>
      </div>
    </div>
  )
}