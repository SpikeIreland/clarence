'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ========== SECTION 1: INTERFACES ==========
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
  providers?: Provider[]
}

interface Provider {
  id: string
  name: string
  phase: number
  alignment: number
  status?: 'active' | 'eliminated' | 'selected'
}

interface Message {
  id: string
  type: 'user' | 'clarence' | 'system'
  content: string
  timestamp: Date
  sessionId?: string
  metadata?: {
    phase?: number
    clauseUpdate?: string
    alignmentChange?: number
  }
}

interface ClauseStatus {
  id: string
  name: string
  status: 'aligned' | 'negotiating' | 'disputed' | 'pending'
  customerPosition?: string | number
  providerPosition?: string | number
  alignment: number
  priority: 'high' | 'medium' | 'low'
}

interface UserInfo {
  firstName?: string
  lastName?: string
  email?: string
  company?: string
  role?: string
}

// ========== SECTION 2: CONSTANTS ==========
const phases: Record<number, { name: string; description: string }> = {
  1: { name: 'Preliminary', description: 'Deal profile & leverage assessment' },
  2: { name: 'Foundation', description: 'Contract foundation' },
  3: { name: 'Gap Narrowing', description: 'High-moderate alignment' },
  4: { name: 'Complex Issues', description: 'Low alignment areas' },
  5: { name: 'Commercial', description: 'Schedules & operations' },
  6: { name: 'Final Review', description: 'Consistency & execution' }
}

// ========== SECTION 3: MAIN COMPONENT ==========
export default function UnifiedDashboardChat() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // ========== SECTION 4: STATE MANAGEMENT ==========
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showArtifacts, setShowArtifacts] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'active' | 'completed' | 'value' | 'phase'>('active')
  const [activeArtifactTab, setActiveArtifactTab] = useState<'draft' | 'clauses' | 'comparison' | 'history'>('draft')
  const [clauseStatuses, setClauseStatuses] = useState<ClauseStatus[]>([])
  const [isTyping, setIsTyping] = useState(false)
  
  // ========== SECTION 5: DATA LOADING FUNCTIONS ==========
  const loadUserInfo = useCallback(async () => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    const authData = JSON.parse(auth)
    setUserInfo(authData.userInfo)
  }, [router])

  const loadSessions = async () => {
    try {
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) return
      
      const authData = JSON.parse(auth)
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/sessions-api?role=${authData.userInfo?.role || 'customer'}&email=${authData.userInfo?.email}`
      
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        
        // Enhance sessions with mock provider data for demo
        const enhancedSessions = (Array.isArray(data) ? data : []).map(session => ({
          ...session,
          providers: session.providers || [
            {
              id: 'p1',
              name: session.providerCompany || 'TechFirst Solutions',
              phase: session.phase || 1,
              alignment: session.phaseAlignment || 65,
              status: 'active' as const
            }
          ]
        }))
        
        setSessions(enhancedSessions)
        
        // Auto-select first session if available
        if (enhancedSessions.length > 0 && !selectedSession) {
          selectSession(enhancedSessions[0])
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const loadClauseStatuses = (sessionId: string) => {
    // Mock clause statuses - would be loaded from API
    const mockClauses: ClauseStatus[] = [
      { id: 'c1', name: 'Payment Terms', status: 'aligned', alignment: 95, priority: 'high' },
      { id: 'c2', name: 'Service Levels', status: 'negotiating', alignment: 65, priority: 'high' },
      { id: 'c3', name: 'Liability Caps', status: 'disputed', alignment: 35, priority: 'medium' },
      { id: 'c4', name: 'IP Rights', status: 'negotiating', alignment: 70, priority: 'low' },
      { id: 'c5', name: 'Confidentiality', status: 'aligned', alignment: 90, priority: 'medium' },
      { id: 'c6', name: 'Termination', status: 'pending', alignment: 0, priority: 'medium' }
    ]
    setClauseStatuses(mockClauses)
  }

  // ========== SECTION 6: SESSION & PROVIDER MANAGEMENT ==========
  const selectSession = (session: Session) => {
    setSelectedSession(session)
    setSelectedProvider(session.providers?.[0] || null)
    loadClauseStatuses(session.sessionId)
    
    // Load chat history for this session
    const initialMessage: Message = {
      id: '1',
      type: 'clarence',
      content: `Welcome back to Contract ${session.sessionNumber || session.sessionId.substring(0, 8)}!\n\nYou're currently in Phase ${session.phase || 1}: ${phases[session.phase || 1]?.name}. Current overall alignment is ${session.phaseAlignment || 0}%.\n\nHow can I assist you with the negotiation today?`,
      timestamp: new Date()
    }
    setMessages([initialMessage])
    
    // Store selected session
    localStorage.setItem('currentSessionId', session.sessionId)
    localStorage.setItem('currentSession', JSON.stringify(session))
  }

  const selectProvider = (provider: Provider) => {
    setSelectedProvider(provider)
    
    const systemMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `Switched to negotiation with ${provider.name}. Current alignment: ${provider.alignment}%`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, systemMessage])
  }

  // ========== SECTION 7: CHAT FUNCTIONS ==========
  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedSession) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      sessionId: selectedSession.sessionId
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)

    // Simulate CLARENCE response
    setTimeout(() => {
      const clarenceResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'clarence',
        content: generateClarenceResponse(inputMessage, selectedSession),
        timestamp: new Date(),
        metadata: {
          phase: selectedSession.phase,
          alignmentChange: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : 0
        }
      }
      setMessages(prev => [...prev, clarenceResponse])
      setIsTyping(false)
      
      // Update alignment if changed
      if (clarenceResponse.metadata?.alignmentChange) {
        updateSessionAlignment(selectedSession.sessionId, clarenceResponse.metadata.alignmentChange)
      }
    }, 1500)
  }

  const generateClarenceResponse = (input: string, session: Session): string => {
    const inputLower = input.toLowerCase()
    
    if (inputLower.includes('liability') || inputLower.includes('cap')) {
      return `I see you're interested in the liability cap clause. Currently, there's a significant gap here:\n\n• Customer position: 200% of annual fees\n• Provider position: 100% of annual fees\n• Suggested compromise: 165% (based on your 65/35 leverage ratio)\n\nWould you like to explore a trade-off? For example, accepting a lower cap in exchange for better payment terms?`
    }
    
    if (inputLower.includes('payment') || inputLower.includes('terms')) {
      return `Payment terms are currently well-aligned at 95%. Both parties have agreed to Net 45 days. This is a strong position that reflects market standards.\n\nWould you like to review other clauses that need attention?`
    }
    
    if (inputLower.includes('help') || inputLower.includes('suggest')) {
      return `Based on the current negotiation state, I recommend focusing on:\n\n1. **Liability Caps** (35% aligned) - Biggest gap to address\n2. **Service Levels** (65% aligned) - Important for operational success\n3. Consider a package deal linking these two areas\n\nYour leverage ratio of 65/35 gives you a strong position. Use it wisely on high-priority items.`
    }
    
    return `I understand you're asking about "${input}". Let me analyze this in the context of your current negotiation.\n\nBased on your leverage position and the current phase, I suggest maintaining flexibility while pushing for favorable terms on your high-priority clauses.\n\nWould you like specific guidance on any particular clause?`
  }

  const updateSessionAlignment = (sessionId: string, change: number) => {
    setSessions(prev => prev.map(s => 
      s.sessionId === sessionId 
        ? { ...s, phaseAlignment: Math.min(100, (s.phaseAlignment || 0) + change) }
        : s
    ))
    
    if (selectedSession?.sessionId === sessionId) {
      setSelectedSession(prev => prev 
        ? { ...prev, phaseAlignment: Math.min(100, (prev.phaseAlignment || 0) + change) }
        : null
      )
    }
  }

  // ========== SECTION 8: NAVIGATION FUNCTIONS ==========
  const navigateToPhase = (phase: number) => {
    if (!selectedSession) return
    
    const queryParams = selectedProvider 
      ? `?session=${selectedSession.sessionId}&provider=${selectedProvider.id}`
      : `?session=${selectedSession.sessionId}`
    
    switch(phase) {
      case 1:
        router.push(`/auth/assessment${queryParams}`)
        break
      case 2:
        router.push(`/auth/foundation${queryParams}`)
        break
      case 3:
      case 4:
        router.push(`/auth/negotiation${queryParams}`)
        break
      case 5:
        router.push(`/auth/commercial${queryParams}`)
        break
      case 6:
        router.push(`/auth/review${queryParams}`)
        break
    }
  }

  // ========== SECTION 9: HELPER FUNCTIONS ==========
  const getFilteredSessions = () => {
    switch(activeFilter) {
      case 'completed':
        return sessions.filter(s => s.status === 'completed')
      case 'value':
        return [...sessions].sort((a, b) => 
          parseInt(b.dealValue || '0') - parseInt(a.dealValue || '0')
        )
      case 'phase':
        return [...sessions].sort((a, b) => (b.phase || 0) - (a.phase || 0))
      case 'active':
      default:
        return sessions.filter(s => s.status !== 'completed')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aligned': return 'text-green-600 bg-green-50'
      case 'negotiating': return 'text-yellow-600 bg-yellow-50'
      case 'disputed': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  // ========== SECTION 10: USE EFFECTS ==========
  useEffect(() => {
    loadUserInfo()
    loadSessions()
  }, [loadUserInfo])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ========== SECTION 11: RENDER ==========
  return (
    <div className="flex h-screen bg-slate-50">
      {/* ========== SECTION 12: LEFT PANEL - CONTRACT LISTINGS ========== */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center text-white font-bold">
                C
              </div>
              <div>
                <div className="font-semibold text-slate-800">CLARENCE</div>
                <div className="text-xs text-slate-500">Contract Dashboard</div>
              </div>
            </Link>
            <button 
              onClick={() => router.push('/auth/contracts-dashboard')}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
              title="Grid View"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2 text-xs">
            {(['active', 'completed', 'value', 'phase'] as const).map(filter => (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-md transition capitalize ${
                  activeFilter === filter 
                    ? 'bg-slate-700 text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {filter === 'value' ? 'By Value' : filter === 'phase' ? 'By Phase' : filter}
              </button>
            ))}
          </div>
        </div>
        
        {/* Contracts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
              <p className="mt-2 text-sm text-slate-500">Loading contracts...</p>
            </div>
          ) : getFilteredSessions().length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No contracts found
            </div>
          ) : (
            getFilteredSessions().map(session => (
              <div
                key={session.sessionId}
                onClick={() => selectSession(session)}
                className={`rounded-lg p-3 cursor-pointer transition border ${
                  selectedSession?.sessionId === session.sessionId
                    ? 'bg-slate-50 border-slate-400'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-semibold text-slate-800">
                    {session.sessionNumber || `Contract ${session.sessionId.substring(0, 8)}`}
                  </div>
                  <div className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    Phase {session.phase || 1}
                  </div>
                </div>
                <div className="text-xs text-slate-600 mb-1">{session.customerCompany}</div>
                <div className="text-xs text-slate-500 mb-2">
                  {session.serviceRequired} • £{parseInt(session.dealValue || '0').toLocaleString()}
                </div>
                
                {/* Mini Progress Bar */}
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">Alignment</div>
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-600 transition-all duration-500"
                      style={{ width: `${session.phaseAlignment || 0}%` }}
                    />
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {session.phaseAlignment || 0}%
                  </div>
                </div>
                
                {/* Providers */}
                {session.providers && session.providers.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">
                      {session.providers.length} Provider{session.providers.length > 1 ? 's' : ''}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {session.providers.slice(0, 3).map(provider => (
                        <div key={provider.id} className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {provider.name.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-slate-700">
                {sessions.filter(s => s.status !== 'completed').length}
              </div>
              <div className="text-xs text-slate-500">Active</div>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-700">
                £{sessions.reduce((sum, s) => sum + parseInt(s.dealValue || '0'), 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">Total Value</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ========== SECTION 13: CENTER PANEL - CHAT/NEGOTIATION ========== */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            {/* Contract Header */}
            <div className="bg-white border-b border-slate-200 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h1 className="text-lg font-semibold text-slate-800">
                    {selectedSession.sessionNumber || `Contract ${selectedSession.sessionId.substring(0, 8)}`}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {selectedSession.serviceRequired} • {selectedSession.customerCompany}
                  </p>
                </div>
                
                {/* Phase Navigation */}
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map(phase => (
                    <button
                      key={phase}
                      onClick={() => navigateToPhase(phase)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition ${
                        selectedSession.phase === phase
                          ? 'bg-slate-700 text-white'
                          : selectedSession.phase && selectedSession.phase > phase
                          ? 'bg-slate-300 text-slate-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title={phases[phase]?.name}
                    >
                      {phase}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Provider Tabs */}
              {selectedSession.providers && selectedSession.providers.length > 1 && (
                <div className="flex gap-2 mb-3">
                  {selectedSession.providers.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => selectProvider(provider)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        selectedProvider?.id === provider.id
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {provider.name}
                      <span className="ml-2 text-xs opacity-75">
                        {provider.alignment}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Overall Progress */}
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Overall Alignment</span>
                  <span className="text-lg font-semibold text-slate-800">
                    {selectedSession.phaseAlignment || 0}%
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-slate-600 to-slate-700 transition-all duration-500"
                    style={{ width: `${selectedSession.phaseAlignment || 0}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {messages.map(message => (
                <div key={message.id} className="mb-4">
                  {message.type === 'clarence' ? (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        C
                      </div>
                      <div className="bg-white rounded-lg p-4 max-w-2xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">
                          {message.content}
                        </div>
                        {message.metadata?.alignmentChange && (
                          <div className="mt-2 text-xs text-green-600">
                            +{message.metadata.alignmentChange}% alignment improvement
                          </div>
                        )}
                      </div>
                    </div>
                  ) : message.type === 'user' ? (
                    <div className="flex justify-end">
                      <div className="bg-slate-700 text-white rounded-lg p-4 max-w-2xl">
                        <div className="text-sm">{message.content}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <div className="bg-slate-100 text-slate-600 rounded-lg px-3 py-1 text-xs">
                        {message.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    C
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask CLARENCE about the negotiation..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <button
                  onClick={sendMessage}
                  className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Contract Selected</h3>
              <p className="text-sm text-slate-500">Select a contract from the left panel to begin</p>
            </div>
          </div>
        )}
      </div>
      
      {/* ========== SECTION 14: RIGHT PANEL - ARTIFACTS ========== */}
      {showArtifacts && selectedSession && (
        <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">Contract Details</h2>
              <button 
                onClick={() => setShowArtifacts(false)}
                className="p-1 hover:bg-slate-100 rounded transition"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Sub-menu Tabs */}
            <div className="flex gap-2 text-sm">
              {(['draft', 'clauses', 'comparison', 'history'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveArtifactTab(tab)}
                  className={`px-3 py-1 rounded-md transition capitalize ${
                    activeArtifactTab === tab
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeArtifactTab === 'clauses' && (
              <>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Clause Alignment Status</h3>
                <div className="space-y-2">
                  {clauseStatuses.map(clause => (
                    <div key={clause.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {clause.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(clause.status)}`}>
                          {clause.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-600 transition-all"
                            style={{ width: `${clause.alignment}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">{clause.alignment}%</span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>Priority: {clause.priority}</span>
                        <button className="text-slate-600 hover:text-slate-800">View →</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {activeArtifactTab === 'draft' && (
              <>
                <h3 className="font-semibold text-slate-800 mb-3">Current Draft</h3>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <h4 className="font-medium text-slate-700 mb-1">1. Payment Terms</h4>
                    <p className="text-slate-600">Net 45 days from invoice date. Late payments subject to 1.5% monthly interest.</p>
                    <div className="mt-2 text-xs text-green-600">✓ Aligned</div>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h4 className="font-medium text-slate-700 mb-1">2. Service Levels</h4>
                    <p className="text-slate-600">[Under negotiation - Gap: 99.5% vs 99.9% uptime]</p>
                    <div className="mt-2 text-xs text-yellow-600">⚠ Negotiating</div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-3">
                    <h4 className="font-medium text-slate-700 mb-1">3. Liability Caps</h4>
                    <p className="text-slate-600">[Disputed - Customer: 200% / Provider: 100% of annual fees]</p>
                    <div className="mt-2 text-xs text-red-600">✗ Disputed</div>
                  </div>
                </div>
                
                {/* Suggested Trade-offs */}
                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    💡 CLARENCE Suggests
                  </h3>
                  <p className="text-xs text-blue-800 mb-2">
                    Consider linking liability caps to SLA performance:
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 99.9% uptime → 150% liability cap</li>
                    <li>• 99.5% uptime → 175% liability cap</li>
                    <li>• Package with payment terms adjustment</li>
                  </ul>
                </div>
              </>
            )}
            
            {activeArtifactTab === 'comparison' && (
              <>
                <h3 className="font-semibold text-slate-800 mb-3">Position Comparison</h3>
                <div className="space-y-3">
                  {clauseStatuses.slice(0, 4).map(clause => (
                    <div key={clause.id} className="bg-slate-50 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">{clause.name}</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Customer:</span>
                          <span className="text-slate-800">Position A</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Provider:</span>
                          <span className="text-slate-800">Position B</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-200">
                          <span className="text-slate-600">CLARENCE:</span>
                          <span className="text-green-700 font-medium">Compromise</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {activeArtifactTab === 'history' && (
              <>
                <h3 className="font-semibold text-slate-800 mb-3">Negotiation History</h3>
                <div className="space-y-2">
                  <div className="border-l-2 border-slate-300 pl-3 ml-1">
                    <div className="text-xs text-slate-500 mb-1">2 hours ago</div>
                    <div className="text-sm text-slate-700">Payment terms agreed at Net 45</div>
                  </div>
                  <div className="border-l-2 border-slate-300 pl-3 ml-1">
                    <div className="text-xs text-slate-500 mb-1">3 hours ago</div>
                    <div className="text-sm text-slate-700">Provider countered liability cap at 125%</div>
                  </div>
                  <div className="border-l-2 border-slate-300 pl-3 ml-1">
                    <div className="text-xs text-slate-500 mb-1">Yesterday</div>
                    <div className="text-sm text-slate-700">Initial positions submitted</div>
                  </div>
                  <div className="border-l-2 border-slate-300 pl-3 ml-1">
                    <div className="text-xs text-slate-500 mb-1">2 days ago</div>
                    <div className="text-sm text-slate-700">Phase 1 assessment completed</div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">
                  {clauseStatuses.filter(c => c.status === 'aligned').length}
                </div>
                <div className="text-xs text-slate-500">Aligned</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {clauseStatuses.filter(c => c.status === 'negotiating').length}
                </div>
                <div className="text-xs text-slate-500">Active</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">
                  {clauseStatuses.filter(c => c.status === 'disputed').length}
                </div>
                <div className="text-xs text-slate-500">Disputed</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Artifact Toggle (when hidden) */}
      {!showArtifacts && selectedSession && (
        <button
          onClick={() => setShowArtifacts(true)}
          className="fixed right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-slate-700 text-white rounded-full shadow-lg hover:bg-slate-800 transition flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l-7 7 7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}