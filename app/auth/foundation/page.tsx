'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ========== SECTION 1: INTERFACES ==========
interface Clause {
  id: string
  title: string
  description: string
  customerPosition: number
  providerPosition: number
  priority: number
  alignment: 'aligned' | 'close' | 'far'
  notes?: string
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
}

interface DealProfile {
  services: string
  deliveryLocations: string[]
  serviceLocations: string[]
  pricingApproach: string
  pricingExpectation: string
}

interface PartyFit {
  customerName: string
  customerAddress: string
  customerEntity: string
  customerIncorporation: string
  customerTurnover: string
  providerName: string
  providerAddress: string
  providerEntity: string
  providerIncorporation: string
  providerTurnover: string
  providerEmployees: string
  providerExperience: string
  parentGuarantee: boolean
  references: string[]
}

interface LeverageFactors {
  dealSize: string
  contractDuration: string
  industrySector: string
  serviceType: string
  partyFitScore: number
}

interface AssessmentData {
  sessionId: string
  providerId: string
  providerName: string
  dealProfile: DealProfile
  partyFit: PartyFit
  leverageFactors: LeverageFactors
  leverageScore: {
    customer: number
    provider: number
  }
}

// ========== SECTION 2: MAIN COMPONENT START ==========
export default function FoundationPhase() {
  const router = useRouter()
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [session, setSession] = useState<Session | null>(null)
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'priorities' | 'review'>('positions')
  const [overallAlignment, setOverallAlignment] = useState(0)
  const [showDemo, setShowDemo] = useState(false)
  
  const [clauses, setClauses] = useState<Clause[]>([
    {
      id: '1',
      title: 'Service Level Agreement',
      description: 'Defines performance standards and uptime requirements',
      customerPosition: 5,
      providerPosition: 3,
      priority: 8,
      alignment: 'close',
      notes: ''
    },
    {
      id: '2',
      title: 'Payment Terms',
      description: 'Specifies payment schedule and methods',
      customerPosition: 7,
      providerPosition: 6,
      priority: 9,
      alignment: 'aligned',
      notes: ''
    },
    {
      id: '3',
      title: 'Liability Limitations',
      description: 'Caps on liability and indemnification',
      customerPosition: 3,
      providerPosition: 8,
      priority: 7,
      alignment: 'far',
      notes: ''
    },
    {
      id: '4',
      title: 'Intellectual Property',
      description: 'Ownership of work product and IP rights',
      customerPosition: 8,
      providerPosition: 7,
      priority: 8,
      alignment: 'aligned',
      notes: ''
    },
    {
      id: '5',
      title: 'Termination Rights',
      description: 'Conditions and notice periods for termination',
      customerPosition: 6,
      providerPosition: 5,
      priority: 6,
      alignment: 'aligned',
      notes: ''
    },
    {
      id: '6',
      title: 'Data Protection',
      description: 'GDPR compliance and data handling procedures',
      customerPosition: 9,
      providerPosition: 8,
      priority: 10,
      alignment: 'aligned',
      notes: ''
    }
  ])

  // ========== SECTION 4: FUNCTIONS ==========
  const calculateAlignment = useCallback(() => {
    let alignedCount = 0
    let totalCount = 0
    
    clauses.forEach(clause => {
      totalCount++
      if (Math.abs(clause.customerPosition - clause.providerPosition) <= 2) {
        alignedCount++
      }
    })
    
    const percentage = totalCount > 0 ? Math.round((alignedCount / totalCount) * 100) : 0
    setOverallAlignment(percentage)
  }, [clauses])

  const updateClausePosition = (clauseId: string, party: 'customer' | 'provider', value: number) => {
    setClauses(prevClauses => 
      prevClauses.map(clause => {
        if (clause.id === clauseId) {
          const updatedClause = { ...clause }
          if (party === 'customer') {
            updatedClause.customerPosition = value
          } else {
            updatedClause.providerPosition = value
          }
          
          // Update alignment status
          const diff = Math.abs(updatedClause.customerPosition - updatedClause.providerPosition)
          if (diff <= 1) {
            updatedClause.alignment = 'aligned'
          } else if (diff <= 3) {
            updatedClause.alignment = 'close'
          } else {
            updatedClause.alignment = 'far'
          }
          
          return updatedClause
        }
        return clause
      })
    )
  }

  const updateClausePriority = (clauseId: string, priority: number) => {
    setClauses(prevClauses =>
      prevClauses.map(clause =>
        clause.id === clauseId ? { ...clause, priority } : clause
      )
    )
  }

  const updateClauseNotes = (clauseId: string, notes: string) => {
    setClauses(prevClauses =>
      prevClauses.map(clause =>
        clause.id === clauseId ? { ...clause, notes } : clause
      )
    )
  }

  const getAlignmentColor = (alignment: string) => {
    switch(alignment) {
      case 'aligned': return 'bg-green-500'
      case 'close': return 'bg-yellow-500'
      case 'far': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const handleCompleteFoundation = () => {
    if (overallAlignment < 70) {
      alert('Please achieve at least 70% alignment before proceeding to the next phase.')
      return
    }
    
    // Save foundation data
    if (session) {
      localStorage.setItem(`foundation_${session.sessionId}`, JSON.stringify({
        clauses,
        alignment: overallAlignment,
        completedAt: new Date().toISOString()
      }))
    }
    
    alert('Foundation phase completed successfully!')
    setShowDemo(true)
  }

  const loadSessionData = () => {
    // Get session ID from URL
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session')
    
    if (sessionId) {
      // Try to load cached session data
      const cachedSession = localStorage.getItem('currentSession')
      if (cachedSession) {
        const sessionData = JSON.parse(cachedSession)
        if (sessionData.sessionId === sessionId) {
          setSession(sessionData)
        }
      }
      
      // Try to load assessment data
      const cachedAssessment = localStorage.getItem(`assessment_${sessionId}`)
      if (cachedAssessment) {
        setAssessmentData(JSON.parse(cachedAssessment))
      }
    }
  }

  // ========== SECTION 5: USE EFFECTS ==========
  useEffect(() => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    loadSessionData()
    calculateAlignment()
  }, [calculateAlignment, router])

  useEffect(() => {
    calculateAlignment()
  }, [clauses, calculateAlignment])

  // ========== SECTION 6: RENDER START ==========
  const phases = [
    { num: 1, name: 'Preliminary', active: false, complete: true },
    { num: 2, name: 'Foundation', active: true, complete: false },
    { num: 3, name: 'Gap Narrowing', active: false, complete: false },
    { num: 4, name: 'Complex Issues', active: false, complete: false },
    { num: 5, name: 'Commercial', active: false, complete: false },
    { num: 6, name: 'Final Review', active: false, complete: false }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== SECTION 7: NAVIGATION ========== */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/auth/contracts-dashboard" className="flex flex-col">
                <span className="text-2xl font-bold text-blue-600">CLARENCE</span>
                <span className="text-xs text-gray-500">The Honest Broker</span>
              </Link>
              <span className="ml-4 text-gray-600">Phase 2: Foundation</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push(`/chat?sessionId=${session?.sessionId}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>
      {/* ========== END SECTION 7 ========== */}

      {/* ========== SECTION 8: MAIN CONTENT ========== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-purple-800 to-purple-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Contract Foundation</h1>
              {session && (
                <>
                  <p className="text-purple-100">Customer: {session.customerCompany}</p>
                  <p className="text-purple-100">Provider: {assessmentData?.providerName || 'TBD'}</p>
                </>
              )}
              {assessmentData && (
                <p className="text-purple-100 mt-2">
                  Leverage: Customer {assessmentData.leverageScore.customer}% | Provider {assessmentData.leverageScore.provider}%
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-200">Overall Alignment</p>
              <p className="text-4xl font-bold">{overallAlignment}%</p>
              <p className="text-sm text-purple-200 mt-1">Target: 70%</p>
            </div>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                  ${phase.complete ? 'bg-green-500 text-white' : 
                    phase.active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {phase.complete ? '✓' : phase.num}
                </div>
                <span className="text-xs mt-1">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: '33.33%' }}></div>
          </div>
        </div>

        {/* ========== SECTION 9: TABS NAVIGATION ========== */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('positions')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeTab === 'positions' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Position Alignment
              </button>
              <button
                onClick={() => setActiveTab('priorities')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeTab === 'priorities' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Priority Setting
              </button>
              <              button
                onClick={() => setActiveTab('review')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeTab === 'review' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Review and Notes
              </button>
            </div>
          </div>
          {/* ========== END SECTION 9 ========== */}

          {/* ========== SECTION 10: TAB CONTENT ========== */}
          <div className="p-8">
            {/* Position Alignment Tab */}
            {activeTab === 'positions' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold mb-4">Align Positions on Key Clauses</h3>
                <p className="text-gray-600 mb-6">
                  Adjust the sliders to indicate each party's position (1 = Strongly Opposed, 10 = Strongly Favorable)
                </p>
                
                {clauses.map(clause => (
                  <div key={clause.id} className="border rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{clause.title}</h4>
                        <p className="text-gray-600 text-sm mt-1">{clause.description}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${getAlignmentColor(clause.alignment)}`} 
                           title={clause.alignment}></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Customer Position: {clause.customerPosition}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.customerPosition}
                          onChange={(e) => updateClausePosition(clause.id, 'customer', parseInt(e.target.value))}
                          className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Opposed</span>
                          <span>Neutral</span>
                          <span>Favorable</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Provider Position: {clause.providerPosition}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.providerPosition}
                          onChange={(e) => updateClausePosition(clause.id, 'provider', parseInt(e.target.value))}
                          className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Opposed</span>
                          <span>Neutral</span>
                          <span>Favorable</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 text-sm text-gray-600">
                      Alignment Gap: {Math.abs(clause.customerPosition - clause.providerPosition)} points
                      {clause.alignment === 'aligned' && <span className="text-green-600 ml-2">✓ Aligned</span>}
                      {clause.alignment === 'close' && <span className="text-yellow-600 ml-2">⚠ Close</span>}
                      {clause.alignment === 'far' && <span className="text-red-600 ml-2">⚠ Far Apart</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Priority Setting Tab */}
            {activeTab === 'priorities' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold mb-4">Set Clause Priorities</h3>
                <p className="text-gray-600 mb-6">
                  Rate the importance of each clause (1 = Low Priority, 10 = Critical)
                </p>
                
                {clauses.map(clause => (
                  <div key={clause.id} className="border rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="font-semibold">{clause.title}</h4>
                        <p className="text-gray-600 text-sm mt-1">{clause.description}</p>
                      </div>
                      <div className="w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Priority Level: {clause.priority}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.priority}
                          onChange={(e) => updateClausePriority(clause.id, parseInt(e.target.value))}
                          className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Low</span>
                          <span>High</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Review & Notes Tab */}
                          {activeTab === 'review' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold mb-4">Review and Add Notes</h3>
                <p className="text-gray-600 mb-6">
                  Add any specific notes or considerations for each clause
                </p>
                
                {clauses.map(clause => (
                  <div key={clause.id} className="border rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold">{clause.title}</h4>
                        <p className="text-gray-600 text-sm mt-1">{clause.description}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className={`px-2 py-1 rounded ${getAlignmentColor(clause.alignment)} text-white`}>
                            {clause.alignment}
                          </span>
                          <span className="text-gray-600">
                            Priority: {clause.priority}/10
                          </span>
                          <span className="text-gray-600">
                            Gap: {Math.abs(clause.customerPosition - clause.providerPosition)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <textarea
                      placeholder="Add notes or specific requirements..."
                      value={clause.notes}
                      onChange={(e) => updateClauseNotes(clause.id, e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* ========== END SECTION 10 ========== */}
        </div>

        {/* ========== SECTION 11: ACTION BUTTONS ========== */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-lg font-semibold">Foundation Progress</p>
              <p className="text-gray-600">Achieve 70% alignment to proceed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{overallAlignment}%</p>
              <p className="text-sm text-gray-600">Current Alignment</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            {!showDemo ? (
              <>
                <button
                  onClick={handleCompleteFoundation}
                  disabled={overallAlignment < 70}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold transition
                    ${overallAlignment >= 70 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  {overallAlignment >= 70 ? 'Complete Foundation Phase' : `Need ${70 - overallAlignment}% More Alignment`}
                </button>
                <button
                  onClick={() => router.push(`/auth/commercial?session=${session?.sessionId}`)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Demo: Skip to Phase 5 →
                </button>
              </>
            ) : (
              <>
                <button
                  className="bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold cursor-not-allowed"
                  disabled
                >
                  ✓ Foundation Complete
                </button>
                <button
                  onClick={() => router.push(`/auth/commercial?session=${session?.sessionId}`)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold animate-pulse"
                >
                  Proceed to Phase 5: Commercial Terms →
                </button>
              </>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              onClick={() => router.push('/auth/contracts-dashboard')}
              className="text-gray-600 hover:text-gray-900 font-semibold"
            >
              Save & Return Later
            </button>
          </div>
        </div>
        {/* ========== END SECTION 11 ========== */}
      </div>
      {/* ========== END SECTION 8 ========== */}
    </div> 
    /* End of min-h-screen container */
  )
  /* End of component return */
}
/* ========== END OF COMPONENT ========== */