'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ========== INTERFACES ==========
interface Contract {
  id: string
  contractNumber: string
  customerCompany: string
  serviceType: string
  value: string
  phase: number
  alignment: number
  providers: Provider[]
  status: 'active' | 'completed' | 'pending'
}

interface Provider {
  id: string
  name: string
  phase: number
  alignment: number
  isActive?: boolean
}

interface Move {
  id: string
  type: 'customer' | 'provider' | 'clarence'
  player?: string
  action?: string
  clause?: string
  from?: string | number
  to?: string | number
  impact?: number
  timestamp: Date
  content?: string
  achievement?: Achievement
  challenge?: Challenge
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
}

interface Challenge {
  id: string
  title: string
  description: string
  hint: string
  reward: number
}

interface ClauseStatus {
  id: string
  name: string
  status: 'aligned' | 'negotiating' | 'disputed' | 'pending'
  customerPosition?: string | number
  providerPosition?: string | number
  priority: number
}

// ========== MAIN COMPONENT ==========
export default function UnifiedClarencePage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // State Management
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [moves, setMoves] = useState<Move[]>([])
  const [tokens] = useState({ used: 3, total: 5 }) // removed setTokens as it's not used
  const [achievements, setAchievements] = useState<Achievement[]>([])
  // Removed activeChallenge and setActiveChallenge as they're not used
  const [clauseStatuses, setClauseStatuses] = useState<ClauseStatus[]>([])
  const [activeFilter, setActiveFilter] = useState<'active' | 'completed' | 'value' | 'phase'>('active')
  const [activeArtifactTab, setActiveArtifactTab] = useState<'draft' | 'clauses' | 'comparison' | 'history'>('draft')
  const [inputMessage, setInputMessage] = useState('')
  const [showArtifacts, setShowArtifacts] = useState(true)

  // Initialize with mock data
  useEffect(() => {
    // Mock contracts data
    const mockContracts: Contract[] = [
      {
        id: '1',
        contractNumber: 'SIS-16092025-001',
        customerCompany: 'Spike Island Studios',
        serviceType: 'IT Services',
        value: '£2M',
        phase: 2,
        alignment: 65,
        status: 'active',
        providers: [
          { id: 'p1', name: 'TechFirst Solutions', phase: 2, alignment: 65, isActive: true },
          { id: 'p2', name: 'Global Support Ltd', phase: 3, alignment: 72 }
        ]
      },
      {
        id: '2',
        contractNumber: 'ABC-22102025-002',
        customerCompany: 'ABC Corporation',
        serviceType: 'Finance Services',
        value: '£5M',
        phase: 4,
        alignment: 82,
        status: 'active',
        providers: [
          { id: 'p3', name: 'FinanceExperts', phase: 4, alignment: 82 }
        ]
      }
    ]
    setContracts(mockContracts)
    setSelectedContract(mockContracts[0])
    setSelectedProvider(mockContracts[0].providers[0])

    // Mock moves
    const mockMoves: Move[] = [
      {
        id: '1',
        type: 'clarence',
        content: "Welcome back! You're negotiating with TechFirst Solutions. Current alignment is at 65% - you're making good progress!\n\n🎯 Today's Focus: Liability caps have the biggest gap. Would you like to explore creative solutions there?",
        timestamp: new Date(Date.now() - 10 * 60000)
      },
      {
        id: '2',
        type: 'customer',
        action: 'Adjusted Payment Terms',
        clause: 'Payment Terms',
        from: '60 days',
        to: '45 days',
        impact: 8,
        timestamp: new Date(Date.now() - 2 * 60000)
      }
    ]
    setMoves(mockMoves)

    // Mock clause statuses
    const mockClauses: ClauseStatus[] = [
      { id: 'c1', name: 'Payment Terms', status: 'aligned', priority: 9 },
      { id: 'c2', name: 'Service Levels', status: 'negotiating', priority: 8 },
      { id: 'c3', name: 'Liability Caps', status: 'disputed', priority: 10 },
      { id: 'c4', name: 'IP Rights', status: 'negotiating', priority: 7 },
      { id: 'c5', name: 'Confidentiality', status: 'aligned', priority: 6 },
      { id: 'c6', name: 'Termination', status: 'negotiating', priority: 8 }
    ]
    setClauseStatuses(mockClauses)

    // Mock achievements
    const mockAchievements: Achievement[] = [
      { id: 'a1', title: 'First Agreement', description: 'Made your first compromise', icon: '🏆', unlocked: true },
      { id: 'a2', title: 'Creative Thinker', description: 'Used a cross-clause trade-off', icon: '💡', unlocked: true },
      { id: 'a3', title: 'Master Negotiator', description: 'Reach 90% alignment', icon: '🎯', unlocked: false }
    ]
    setAchievements(mockAchievements)
  }, [])

  // Auto-scroll to bottom of moves
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [moves])

  // Handle provider selection
  const selectProvider = (provider: Provider) => {
    setSelectedProvider(provider)
    // Add CLARENCE message about provider switch
    const clarenceMove: Move = {
      id: Date.now().toString(),
      type: 'clarence',
      content: `Switched to negotiation with ${provider.name}. This provider is currently in Phase ${provider.phase} with ${provider.alignment}% alignment.`,
      timestamp: new Date()
    }
    setMoves(prev => [...prev, clarenceMove])
  }

  // Handle sending a message/move
  const sendMessage = () => {
    if (!inputMessage.trim()) return

    // Add user move
    const userMove: Move = {
      id: Date.now().toString(),
      type: 'customer',
      content: inputMessage,
      timestamp: new Date()
    }
    setMoves(prev => [...prev, userMove])
    setInputMessage('')

    // Simulate CLARENCE response
    setTimeout(() => {
      const clarenceResponse: Move = {
        id: (Date.now() + 1).toString(),
        type: 'clarence',
        content: "Interesting proposal! Let me analyze the impact on overall alignment. Based on your suggestion, I recommend considering the ripple effects on related clauses...",
        timestamp: new Date()
      }
      setMoves(prev => [...prev, clarenceResponse])
    }, 1000)
  }

  // Get color classes based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aligned': return 'bg-emerald-500'
      case 'negotiating': return 'bg-yellow-500'
      case 'disputed': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'aligned': return 'bg-emerald-50 text-emerald-700'
      case 'negotiating': return 'bg-yellow-50 text-yellow-700'
      case 'disputed': return 'bg-red-50 text-red-700'
      default: return 'bg-gray-50 text-gray-700'
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel: Contract Listings */}
      <div className="w-80 bg-slate-800 text-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center font-bold text-white">
                C
              </div>
              <div>
                <div className="font-semibold">CLARENCE</div>
                <div className="text-xs text-slate-400">AI-Powered Mediation</div>
              </div>
            </div>
            <button 
              onClick={() => router.push('/auth/contracts-dashboard')}
              className="p-2 hover:bg-slate-700 rounded-lg transition"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-2 text-xs">
            <button 
              onClick={() => setActiveFilter('active')}
              className={`px-3 py-1 rounded-md transition ${activeFilter === 'active' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveFilter('completed')}
              className={`px-3 py-1 rounded-md transition ${activeFilter === 'completed' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
            >
              Completed
            </button>
            <button 
              onClick={() => setActiveFilter('value')}
              className={`px-3 py-1 rounded-md transition ${activeFilter === 'value' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
            >
              By Value
            </button>
            <button 
              onClick={() => setActiveFilter('phase')}
              className={`px-3 py-1 rounded-md transition ${activeFilter === 'phase' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
            >
              By Phase
            </button>
          </div>
        </div>
        
        {/* Contracts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {contracts.map(contract => (
            <div
              key={contract.id}
              onClick={() => {
                setSelectedContract(contract)
                setSelectedProvider(contract.providers[0])
              }}
              className={`rounded-lg p-3 cursor-pointer transition ${
                selectedContract?.id === contract.id
                  ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30'
                  : 'bg-slate-700/50 hover:bg-slate-700/70'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-semibold">{contract.contractNumber}</div>
                <div className="text-xs px-2 py-0.5 bg-emerald-500/20 rounded-full">
                  Phase {contract.phase}
                </div>
              </div>
              <div className="text-xs text-slate-300 mb-1">{contract.customerCompany}</div>
              <div className="text-xs text-slate-400 mb-2">{contract.serviceType} • {contract.value}</div>
              
              {/* Mini Progress Bar */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-400">Alignment</div>
                <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                    style={{ width: `${contract.alignment}%` }}
                  />
                </div>
                <div className="text-xs font-semibold text-emerald-400">{contract.alignment}%</div>
              </div>
              
              {/* Providers */}
              {contract.providers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">
                    {contract.providers.length} Provider{contract.providers.length > 1 ? 's' : ''} Competing
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {contract.providers.map(provider => (
                      <div key={provider.id} className="text-xs px-2 py-0.5 bg-slate-700 rounded">
                        {provider.name.split(' ')[0]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Quick Stats */}
        <div className="p-4 border-t border-slate-700">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-emerald-400">8</div>
              <div className="text-xs text-slate-400">Active Contracts</div>
            </div>
            <div>
              <div className="text-xl font-bold text-teal-400">£24M</div>
              <div className="text-xs text-slate-400">Total Value</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Center Panel: Negotiation Interface */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar with Gamification */}
        <div className="bg-white border-b border-gray-200 p-4">
          {/* Contract Header - UPDATED WITH JOHN'S CHANGES */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                AI-Powered Contract Mediation
              </h1>
              <p className="text-sm text-gray-600 max-w-md">
                CLARENCE leads transparent negotiations between<br />
                customers and providers for optimal outcomes
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Contract: {selectedContract?.contractNumber} • {selectedContract?.serviceType} • {selectedContract?.customerCompany}
              </p>
            </div>
            
            {/* Gamification Stats */}
            <div className="flex gap-4">
              {/* Tokens */}
              <div className="text-center">
                <div className="text-xs text-gray-500">Your Tokens</div>
                <div className="flex gap-1 mt-1">
                  {[...Array(tokens.total)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full ${
                        i < tokens.used ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Achievements */}
              <div className="flex gap-2">
                {achievements.map(achievement => (
                  <div
                    key={achievement.id}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      achievement.unlocked ? 'bg-yellow-100' : 'bg-gray-200'
                    }`}
                    title={achievement.title}
                  >
                    {achievement.unlocked ? achievement.icon : '🔒'}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Provider Tabs */}
          <div className="flex gap-2 mb-3">
            {selectedContract?.providers.map(provider => (
              <button
                key={provider.id}
                onClick={() => selectProvider(provider)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                  selectedProvider?.id === provider.id
                    ? 'bg-slate-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <span>{provider.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  provider.phase <= 2 ? 'bg-emerald-500' :
                  provider.phase <= 4 ? 'bg-yellow-500' : 'bg-blue-500'
                } text-white`}>
                  Phase {provider.phase}
                </span>
              </button>
            ))}
          </div>
          
          {/* Main Alignment Progress */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Overall Alignment Score</span>
              <span className="text-2xl font-bold text-emerald-600">
                {selectedProvider?.alignment || 0}%
              </span>
            </div>
            <div className="h-4 bg-white rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${selectedProvider?.alignment || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Disputed</span>
              <span>Negotiating</span>
              <span>Aligned</span>
            </div>
          </div>
          
          {/* Heat Map */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Negotiation Heat Map</span>
              <button className="text-xs text-emerald-600 hover:underline">View Details →</button>
            </div>
            <div className="flex gap-1">
              {clauseStatuses.map(clause => (
                <div
                  key={clause.id}
                  className={`w-8 h-8 ${getStatusColor(clause.status)} rounded cursor-pointer hover:scale-110 transition-transform`}
                  title={`${clause.name} - ${clause.status}`}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Chat/Move Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {moves.map(move => (
            <div key={move.id} className="mb-4">
              {move.type === 'clarence' ? (
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                    C
                  </div>
                  <div className="bg-white rounded-lg p-4 max-w-2xl shadow-sm">
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {move.content}
                    </div>
                    {move.achievement && (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex items-center gap-2">
                        <span className="text-2xl">{move.achievement.icon}</span>
                        <div>
                          <div className="text-xs font-semibold text-yellow-700">
                            Achievement Unlocked!
                          </div>
                          <div className="text-xs text-yellow-600">
                            {move.achievement.title} - {move.achievement.description}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : move.type === 'customer' ? (
                <div className={`bg-emerald-50 border border-emerald-200 rounded-lg p-3 max-w-2xl ${
                  move.action ? '' : 'ml-auto'
                }`}>
                  {move.action && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">
                        C
                      </div>
                      <span className="text-sm font-semibold text-emerald-700">Your Move</span>
                      <span className="text-xs text-gray-500">
                        {new Date(move.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-gray-700">
                    {move.action ? (
                      <>
                        {move.action} <strong>{move.clause}</strong> from {move.from} → {move.to}
                        {move.impact && (
                          <span className="ml-2 text-emerald-600 font-bold">
                            +{move.impact}% alignment
                          </span>
                        )}
                      </>
                    ) : (
                      move.content
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-2xl ml-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                      P
                    </div>
                    <span className="text-sm font-semibold text-blue-700">Provider&apos;s Move</span>
                  </div>
                  <div className="text-sm text-gray-700">{move.content}</div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex gap-3">
            {/* Quick Actions */}
            <div className="flex gap-2">
              <button 
                className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition"
                title="Use Token"
              >
                🎯
              </button>
              <button 
                className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                title="Request Mediation"
              >
                🤝
              </button>
              <button 
                className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                title="View Analytics"
              >
                📊
              </button>
            </div>
            
            {/* Message Input */}
            <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Propose a move or ask CLARENCE for advice..."
                className="w-full bg-transparent outline-none text-gray-700"
              />
            </div>
            
            <button
              onClick={sendMessage}
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
      
      {/* Right Panel: Artifacts (Collapsible) */}
      {showArtifacts && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Contract Artifacts</h2>
              <button 
                onClick={() => setShowArtifacts(false)}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      : 'hover:bg-gray-100'
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
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Clause Alignment Status</h3>
                <div className="space-y-2">
                  {clauseStatuses.map(clause => (
                    <div
                      key={clause.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${getStatusBgColor(clause.status)}`}
                    >
                      <span className="text-sm">
                        {clause.status === 'aligned' ? '✅' :
                         clause.status === 'negotiating' ? '⚠️' :
                         clause.status === 'disputed' ? '❌' : '⏳'}
                        {' '}{clause.name}
                      </span>
                      <span className="text-xs font-semibold capitalize">
                        {clause.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {activeArtifactTab === 'draft' && (
              <>
                <h3 className="font-semibold text-gray-800 mb-3">Current Draft</h3>
                <div className="space-y-3 text-sm">
                  {clauseStatuses.slice(0, 3).map((clause, index) => (
                    <div key={clause.id}>
                      <h4 className="font-semibold text-gray-700">
                        {index + 1}. {clause.name}
                      </h4>
                      <p className={`p-2 rounded mt-1 ${getStatusBgColor(clause.status)}`}>
                        {clause.status === 'aligned' 
                          ? 'Terms have been agreed and finalized.'
                          : clause.status === 'negotiating'
                          ? '[Under negotiation - positions being discussed]'
                          : '[DISPUTED: Significant gap between parties]'}
                      </p>
                    </div>
                  ))}
                </div>
                
                {/* Trade-off Suggestions */}
                <div className="mt-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-purple-700 mb-2">
                    💡 Suggested Trade-offs
                  </h3>
                  <div className="space-y-2 text-sm">
                    <button className="w-full text-left p-2 bg-white rounded hover:bg-purple-100 transition">
                      <div className="font-medium text-gray-700">Link SLAs to Liability</div>
                      <div className="text-xs text-gray-500">Higher SLAs = Lower liability cap</div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-600">
                  {clauseStatuses.filter(c => c.status === 'aligned').length}
                </div>
                <div className="text-xs text-gray-500">Aligned</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-600">
                  {clauseStatuses.filter(c => c.status === 'negotiating').length}
                </div>
                <div className="text-xs text-gray-500">Negotiating</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">
                  {clauseStatuses.filter(c => c.status === 'disputed').length}
                </div>
                <div className="text-xs text-gray-500">Disputed</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Artifact Toggle (when hidden) */}
      {!showArtifacts && (
        <button
          onClick={() => setShowArtifacts(true)}
          className="fixed right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-lg hover:scale-110 transition flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l-7 7 7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}