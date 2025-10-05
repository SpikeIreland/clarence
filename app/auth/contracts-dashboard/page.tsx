'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'

// ========== SECTION 1: INTERFACES ==========
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

// ========== SECTION 2: MAIN COMPONENT START ==========
export default function ContractsDashboard() {
  const router = useRouter()
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetrics, setShowMetrics] = useState(true)

  // ========== SECTION 4: FUNCTIONS ==========
  const loadUserInfo = useCallback(async () => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    const authData = JSON.parse(auth)
    setUserInfo(authData.userInfo)
  }, [router])

  async function loadSessions() {
    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) return
      
      const authData = JSON.parse(auth)
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}`
      
      console.log('Loading sessions from:', apiUrl) // Debug log
      
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        console.log('Sessions data received:', data) // Debug log
        setSessions(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to load sessions:', response.status)
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

  function continueWithClarence(sessionId?: string) {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId)
      router.push(`/chat?sessionId=${sessionId}`)
    } else {
      router.push('/chat')
    }
  }

  function navigateToPhase(session: Session) {
    // Store the full session data for the next page
    localStorage.setItem('currentSessionId', session.sessionId)
    localStorage.setItem('currentSession', JSON.stringify(session))
    
    const phase = session.phase || 1
    
    // Navigate based on actual implemented pages
    // For now, always start at assessment if phase is 1-4
    switch(phase) {
      case 1:
        router.push(`/auth/assessment?session=${session.sessionId}`)
        break
      case 2:
        router.push(`/auth/foundation?session=${session.sessionId}`)
        break
      case 3:
      case 4:
        // For demo purposes, go to assessment first
        console.log('Starting from assessment page')
        router.push(`/auth/assessment?session=${session.sessionId}`)
        break
      case 5:
        router.push(`/auth/commercial?session=${session.sessionId}`)
        break
      case 6:
        // Phase 6 not implemented yet
        continueWithClarence(session.sessionId)
        break
      default:
        router.push(`/auth/assessment?session=${session.sessionId}`)
    }
  }

  function getStatusBadgeClass(status: string) {
    const statusClasses: Record<string, string> = {
      'created': 'bg-yellow-100 text-yellow-800',
      'initiated': 'bg-yellow-100 text-yellow-800',
      'assessment_complete': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'provider_matched': 'bg-purple-100 text-purple-800',
      'mediation_pending': 'bg-orange-100 text-orange-800',
      'in_progress': 'bg-indigo-100 text-indigo-800'
    }
    return statusClasses[status] || 'bg-gray-100 text-gray-800'
  }

  function getPhaseActionButton(session: Session) {
    const phase = session.phase || 1
    
    // Determine button text and style based on phase and status
    if (session.status === 'completed') {
      return {
        text: '✓ Contract Completed',
        className: 'bg-gray-400 cursor-not-allowed text-white',
        disabled: true
      }
    }
    
    // For demo purposes, always allow starting from assessment
    switch(phase) {
      case 1:
        return {
          text: session.status === 'assessment_complete' 
            ? 'Review Assessment' 
            : 'Start Phase 1: Assessment',
          className: session.status === 'assessment_complete'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white',
          disabled: false
        }
      case 2:
        return {
          text: 'Continue Phase 2: Foundation',
          className: 'bg-blue-600 hover:bg-blue-700 text-white',
          disabled: false
        }
      case 3:
      case 4:
        // For phases 3-4, start from assessment for demo
        return {
          text: 'Start Assessment Process',
          className: 'bg-green-600 hover:bg-green-700 text-white',
          disabled: false
        }
      case 5:
        return {
          text: 'Continue Phase 5: Commercial Terms',
          className: 'bg-purple-600 hover:bg-purple-700 text-white',
          disabled: false
        }
      case 6:
        return {
          text: 'Final Review & Execution',
          className: 'bg-green-600 hover:bg-green-700 text-white',
          disabled: false
        }
      default:
        return {
          text: 'Start Assessment',
          className: 'bg-blue-600 hover:bg-blue-700 text-white',
          disabled: false
        }
    }
  }

  // ========== SECTION 5: USE EFFECTS ==========
  useEffect(() => {
    loadUserInfo()
    loadSessions()
  }, [loadUserInfo])

  // ========== SECTION 6: METRICS CALCULATION ==========
  const metrics = getMetricsData()

  // ========== SECTION 7: RENDER START ==========
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== SECTION 8: NAVIGATION BAR ========== */}
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
      {/* ========== END SECTION 8 ========== */}

      {/* ========== SECTION 9: MAIN CONTENT CONTAINER ========== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ========== SECTION 10: HEADER BANNER ========== */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-8 rounded-xl mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {userInfo?.firstName || 'User'}
          </h1>
          <p className="text-blue-100">
            {userInfo?.company || 'Your Company'} | {userInfo?.role === 'admin' ? 'Administrator' : 'Customer Portal'}
          </p>
        </div>
        {/* ========== END SECTION 10 ========== */}

        {/* ========== SECTION 11: METRICS DASHBOARD ========== */}
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
        {/* ========== END SECTION 11 ========== */}

        {/* ========== SECTION 12: QUICK STATS CARDS ========== */}
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
        {/* ========== END SECTION 12 ========== */}

        {/* ========== SECTION 13: SESSIONS LIST ========== */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Active Contract Negotiations</h2>
          
          {loading ? (
            // Loading State
            <div className="bg-white p-12 rounded-xl text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading contracts...</p>
            </div>
          ) : sessions.length === 0 ? (
            // Empty State
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
            // Sessions Grid
            <div className="grid gap-6">
              {sessions.map(session => {
                const phase = session.phase || 1;
                const actionButton = getPhaseActionButton(session);
                
                return (
                  <div key={session.sessionId} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                    {/* Session Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {session.sessionNumber || `Contract ${session.sessionId.substring(0, 8)}`}
                        </h3>
                        <p className="text-gray-600">{session.serviceRequired}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(session.status)}`}>
                        Phase {phase}: {phases[phase]?.name || 'Unknown'}
                      </span>
                    </div>
                    
                    {/* Session Details Grid */}
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

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigateToPhase(session)}
                        disabled={actionButton.disabled}
                        className={`flex-1 py-2 px-4 rounded-lg ${actionButton.className}`}
                      >
                        {actionButton.text}
                      </button>
                      
                      <button
                        onClick={() => continueWithClarence(session.sessionId)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        💬 Chat
                      </button>
                      
                      <button
                        onClick={() => continueWithClarence(session.sessionId)}
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
        {/* ========== END SECTION 13 ========== */}

      </div>
      {/* ========== END SECTION 9 ========== */}

      {/* ========== SECTION 14: FLOATING CHAT BUTTON ========== */}
      <button
        onClick={() => continueWithClarence()}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all"
        title="Open CLARENCE Chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
        </svg>
      </button>
      {/* ========== END SECTION 14 ========== */}
      
    </div>
    /* End of min-h-screen container */
  )
  /* End of component return */
}
/* ========== END OF COMPONENT ========== */