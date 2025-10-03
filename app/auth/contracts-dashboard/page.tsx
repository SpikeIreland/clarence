'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'

interface UserInfo {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  role?: string
  userId?: string
}

interface Session {
  sessionId: string
  sessionNumber?: string
  customerCompany: string
  providerCompany?: string
  serviceRequired: string
  dealValue: string
  status: string
  phase?: number
  phaseAlignment?: number
  createdAt?: string
  lastUpdated?: string
}

const phases: Record<number, { name: string; description: string; color: string }> = {
  1: { name: 'Preliminary', description: 'Deal profile & leverage assessment', color: '#6c757d' },
  2: { name: 'Foundation', description: 'Contract foundation', color: '#ffc107' },
  3: { name: 'Gap Narrowing', description: 'High-moderate alignment', color: '#007bff' },
  4: { name: 'Complex Issues', description: 'Low alignment areas', color: '#fd7e14' },
  5: { name: 'Commercial', description: 'Schedules & operations', color: '#e83e8c' },
  6: { name: 'Final Review', description: 'Consistency & execution', color: '#28a745' }
}

export default function ContractsDashboard() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)

  const loadUserInfo = useCallback(async () => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    const authData = JSON.parse(auth)
    setUserInfo(authData.userInfo)
  }, [router])

  useEffect(() => {
    loadUserInfo()
    loadSessions()
  }, [loadUserInfo])

  async function loadSessions() {
    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) return
      
      const authData = JSON.parse(auth)
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}`
      
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        setSessions(Array.isArray(data) ? data : [])
      } else {
        setSessions([])
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const getMetricsData = () => {
    const active = sessions.filter(s => s.status !== 'completed').length
    const completed = sessions.filter(s => s.status === 'completed').length
    const totalValue = sessions.reduce((sum, s) => sum + parseInt(s.dealValue || '0'), 0)
    
    return {
      statusData: [
        { name: 'Active', value: active || 0, color: '#3498db' },
        { name: 'Completed', value: completed || 0, color: '#27ae60' }
      ],
      phaseData: Object.keys(phases).map(p => ({
        phase: `P${p}`,
        count: sessions.filter(s => (s.phase || 1) === parseInt(p)).length
      })),
      dealValueData: sessions
        .sort((a, b) => parseInt(b.dealValue || '0') - parseInt(a.dealValue || '0'))
        .slice(0, 5)
        .map(s => ({
          company: s.customerCompany.substring(0, 15),
          value: Math.round(parseInt(s.dealValue || '0') / 1000)
        })),
      totalValue,
      avgCompletion: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.phaseAlignment || 0), 0) / sessions.length)
        : 0
    }
  }

  const metrics = getMetricsData()

  function continueWithClarence(sessionId?: string) {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId)
      router.push(`/chat?sessionId=${sessionId}`)
    } else {
      router.push('/chat')
    }
  }

  function startAssessment(sessionId: string) {
    localStorage.setItem('currentSessionId', sessionId)
    router.push(`/auth/assessment?session=${sessionId}`)
  }

  function viewDetails(sessionId: string) {
    continueWithClarence(sessionId)
  }

  function getStatusBadgeClass(status: string) {
    const statusClasses: Record<string, string> = {
      'created': 'bg-yellow-100 text-yellow-800',
      'initiated': 'bg-yellow-100 text-yellow-800',
      'assessment_complete': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'provider_matched': 'bg-purple-100 text-purple-800',
      'mediation_pending': 'bg-orange-100 text-orange-800'
    }
    return statusClasses[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex flex-col">
                <span className="text-2xl font-bold text-blue-600">CLARENCE</span>
                <span className="text-xs text-gray-500">The Honest Broker</span>
              </Link>
              <span className="ml-4 text-gray-600">Contract Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="text-gray-600 hover:text-gray-900"
              >
                {showMetrics ? '📊 Hide Metrics' : '📊 Show Metrics'}
              </button>
              <button
                onClick={() => continueWithClarence()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                💬 CLARENCE Chat
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-8 rounded-xl mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {userInfo?.firstName || 'User'}
          </h1>
          <p className="text-blue-100">
            {userInfo?.company || 'Your Company'} | {userInfo?.role === 'admin' ? 'Administrator' : 'Customer Portal'}
          </p>
        </div>

        {/* Metrics Dashboard */}
        {showMetrics && sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Contract Status Pie Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Contract Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metrics.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {metrics.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Phase Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Phase Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.phaseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="phase" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Deal Value Leaderboard */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Top Deal Values (£k)</h3>
              {metrics.dealValueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={metrics.dealValueData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="company" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#27ae60" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-blue-600">{sessions.length}</div>
            <div className="text-gray-600">Total Contracts</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-green-600">
              {sessions.filter(s => s.status !== 'completed').length}
            </div>
            <div className="text-gray-600">Active Negotiations</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-purple-600">
              £{metrics.totalValue.toLocaleString()}
            </div>
            <div className="text-gray-600">Total Deal Value</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-orange-600">
              {metrics.avgCompletion}%
            </div>
            <div className="text-gray-600">Avg. Completion</div>
          </div>
        </div>

        {/* Sessions */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Active Contract Negotiations</h2>
          {loading ? (
            <div className="bg-white p-12 rounded-xl text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading contracts...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white p-12 rounded-xl text-center">
              <h3 className="text-xl font-semibold mb-2">Welcome to CLARENCE!</h3>
              <p className="text-gray-600 mb-6">{`You don't have any active contracts yet.`}</p>
              <button
                onClick={() => continueWithClarence()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
              >
                💬 Start with CLARENCE Chat
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {sessions.map(session => {
                const phase = session.phase || 1;
                
                return (
                  <div key={session.sessionId} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {session.sessionNumber || `Contract ${session.sessionId.substring(0, 8)}`}
                        </h3>
                        <p className="text-gray-600">{session.serviceRequired}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(session.status)}`}>
                        Phase {phase}: {phases[phase].name}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Customer:</span>
                        <p className="font-medium">{session.customerCompany}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Provider:</span>
                        <p className="font-medium">{session.providerCompany || 'TBD'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Value:</span>
                        <p className="font-medium">£{parseInt(session.dealValue || '0').toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Progress:</span>
                        <p className="font-medium">{session.phaseAlignment || 0}%</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${session.phaseAlignment || 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Phase-based navigation buttons */}
                    <div className="flex gap-2">
                      {phase === 1 ? (
                        <>
                          <button
                            onClick={() => startAssessment(session.sessionId)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                          >
                            Start Phase 1: Assessment
                          </button>
                          <button
                            onClick={() => continueWithClarence(session.sessionId)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                          >
                            💬 Chat
                          </button>
                        </>
                      ) : phase === 2 ? (
                        <>
                          <button
                            onClick={() => router.push(`/auth/foundation?session=${session.sessionId}`)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                          >
                            Continue Phase 2: Foundation
                          </button>
                          <button
                            onClick={() => continueWithClarence(session.sessionId)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                          >
                            💬 Chat
                          </button>
                        </>
                      ) : phase >= 3 && phase <= 5 ? (
                        <>
                          <button
                            onClick={() => continueWithClarence(session.sessionId)}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg"
                          >
                            Continue Phase {phase} Negotiation
                          </button>
                          <button
                            onClick={() => continueWithClarence(session.sessionId)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                          >
                            💬 Chat
                          </button>
                        </>
                      ) : phase === 6 ? (
                        <>
                          <button
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                          >
                            Finalize Contract
                          </button>
                          <button
                            onClick={() => continueWithClarence(session.sessionId)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                          >
                            💬 Chat
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => continueWithClarence(session.sessionId)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                        >
                          Continue with CLARENCE
                        </button>
                      )}
                      
                      <button
                        onClick={() => viewDetails(session.sessionId)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={() => continueWithClarence()}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
        title="Open CLARENCE Chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
        </svg>
      </button>
    </div>
  )
}