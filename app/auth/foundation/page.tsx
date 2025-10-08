'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ========== INTERFACES ==========
interface Clause {
  id: string
  title: string
  description: string
  customerPosition: number
  providerPosition: number
  priority: number
  alignment: 'aligned' | 'close' | 'far'
  notes?: string
  clarenceRecommendation?: string
  recommendedCompromise?: number
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

// ========== MAIN COMPONENT ==========
export default function FoundationPhase() {
  const router = useRouter()
  
  const [session, setSession] = useState<Session | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'priorities' | 'review'>('positions')
  const [overallAlignment, setOverallAlignment] = useState(0)
  const [showDemo, setShowDemo] = useState(false)
  const [loadingRecommendation, setLoadingRecommendation] = useState<string | null>(null)
  
  const [clauses, setClauses] = useState<Clause[]>([
    {
      id: '1',
      title: 'Service Level Agreement',
      description: 'Defines performance standards and uptime requirements',
      customerPosition: 5,
      providerPosition: 3,
      priority: 8,
      alignment: 'close',
      notes: '',
      clarenceRecommendation: '',
      recommendedCompromise: 4
    },
    {
      id: '2',
      title: 'Payment Terms',
      description: 'Specifies payment schedule and methods',
      customerPosition: 7,
      providerPosition: 6,
      priority: 9,
      alignment: 'aligned',
      notes: '',
      clarenceRecommendation: 'Parties are well-aligned. Consider net-30 terms with 2% early payment discount.',
      recommendedCompromise: 6.5
    },
    {
      id: '3',
      title: 'Liability Limitations',
      description: 'Caps on liability and indemnification',
      customerPosition: 3,
      providerPosition: 8,
      priority: 7,
      alignment: 'far',
      notes: '',
      clarenceRecommendation: '',
      recommendedCompromise: 5
    },
    {
      id: '4',
      title: 'Intellectual Property',
      description: 'Ownership of work product and IP rights',
      customerPosition: 8,
      providerPosition: 7,
      priority: 8,
      alignment: 'aligned',
      notes: '',
      clarenceRecommendation: 'Strong alignment. Standard work-for-hire with provider retaining methodologies.',
      recommendedCompromise: 7.5
    },
    {
      id: '5',
      title: 'Termination Rights',
      description: 'Conditions and notice periods for termination',
      customerPosition: 6,
      providerPosition: 5,
      priority: 6,
      alignment: 'aligned',
      notes: '',
      clarenceRecommendation: '',
      recommendedCompromise: 5.5
    },
    {
      id: '6',
      title: 'Data Protection',
      description: 'GDPR compliance and data handling procedures',
      customerPosition: 9,
      providerPosition: 8,
      priority: 10,
      alignment: 'aligned',
      notes: '',
      clarenceRecommendation: 'Excellent alignment on critical clause. Include standard GDPR provisions.',
      recommendedCompromise: 8.5
    }
  ])

  // Request CLARENCE recommendation for a specific clause
  const requestClarenceRecommendation = async (clauseId: string) => {
    setLoadingRecommendation(clauseId)
    
    const clause = clauses.find(c => c.id === clauseId)
    if (!clause) return
    
    // Simulate API call to CLARENCE webhook
    // In production, this would call your actual webhook
    try {
      // Mock response for now
      setTimeout(() => {
        setClauses(prev => prev.map(c => {
          if (c.id === clauseId) {
            const gap = Math.abs(c.customerPosition - c.providerPosition)
            let recommendation = ''
            
            if (gap <= 1) {
              recommendation = `Strong alignment achieved. Minor adjustments could include ${
                c.customerPosition > c.providerPosition ? 'provider accepting slightly higher standards' : 
                'customer allowing reasonable flexibility'
              }.`
            } else if (gap <= 3) {
              const compromise = (c.customerPosition + c.providerPosition) / 2
              recommendation = `Consider middle ground at position ${compromise.toFixed(1)}. ${
                c.title === 'Liability Limitations' ? 
                'Perhaps cap at 12 months fees with carve-outs for gross negligence.' :
                'Both parties showing flexibility can achieve win-win outcome.'
              }`
            } else {
              recommendation = `Significant gap requires creative solution. Consider: 
                1) Phased approach over contract term
                2) Performance-based adjustments
                3) Trade-off with other clauses where you have better alignment`
            }
            
            return {
              ...c,
              clarenceRecommendation: recommendation,
              recommendedCompromise: (c.customerPosition + c.providerPosition) / 2
            }
          }
          return c
        }))
        setLoadingRecommendation(null)
      }, 1500)
      
      /* ACTUAL API CALL (when webhook is active):
      const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/clarence-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: localStorage.getItem('userId'),
          sessionId: session?.sessionId,
          message: `Provide mediation recommendation for ${clause.title}. Customer position: ${clause.customerPosition}/10, Provider position: ${clause.providerPosition}/10. Priority: ${clause.priority}/10.`,
          currentPhase: 2,
          alignmentScore: overallAlignment,
          negotiationContext: {
            clauseDetails: clause,
            session: session
          }
        })
      })
      
      const data = await response.json()
      // Update clause with CLARENCE recommendation
      */
      
    } catch (error) {
      console.error('Error getting CLARENCE recommendation:', error)
      setLoadingRecommendation(null)
    }
  }

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
          
          const diff = Math.abs(updatedClause.customerPosition - updatedClause.providerPosition)
          if (diff <= 1) {
            updatedClause.alignment = 'aligned'
          } else if (diff <= 3) {
            updatedClause.alignment = 'close'
          } else {
            updatedClause.alignment = 'far'
          }
          
          // Clear recommendation when positions change
          updatedClause.clarenceRecommendation = ''
          
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
      default: return 'bg-slate-500'
    }
  }

  const handleCompleteFoundation = () => {
    if (overallAlignment < 70) {
      alert('Please achieve at least 70% alignment before proceeding to the next phase.')
      return
    }
    
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

  useEffect(() => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    calculateAlignment()
  }, [calculateAlignment, router])

  useEffect(() => {
    calculateAlignment()
  }, [clauses, calculateAlignment])

  const phases = [
    { num: 1, name: 'Preliminary', active: false, complete: true },
    { num: 2, name: 'Foundation', active: true, complete: false },
    { num: 3, name: 'Gap Narrowing', active: false, complete: false },
    { num: 4, name: 'Complex Issues', active: false, complete: false },
    { num: 5, name: 'Commercial', active: false, complete: false },
    { num: 6, name: 'Final Review', active: false, complete: false }
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation - Updated to Slate */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/auth/contracts-dashboard" className="flex items-center">
                <div>
                  <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                  <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                </div>
              </Link>
              <span className="ml-4 text-slate-600 text-sm">Phase 2: Foundation</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-slate-600 hover:text-slate-900 text-sm"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push(`/chat?sessionId=${session?.sessionId}`)}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg text-sm"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Card - Updated to Slate */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-2">Contract Foundation</h1>
              <p className="text-slate-300 text-sm">Building agreement on core contract terms</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Overall Alignment</p>
              <p className="text-4xl font-medium">{overallAlignment}%</p>
              <p className="text-sm text-slate-300 mt-1">Target: 70%</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('positions')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition
                  ${activeTab === 'positions' 
                    ? 'text-slate-700 border-slate-600' 
                    : 'text-slate-500 border-transparent hover:text-slate-700'}`}
              >
                Position Alignment
              </button>
              <button
                onClick={() => setActiveTab('priorities')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition
                  ${activeTab === 'priorities' 
                    ? 'text-slate-700 border-slate-600' 
                    : 'text-slate-500 border-transparent hover:text-slate-700'}`}
              >
                Priority Setting
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition
                  ${activeTab === 'review' 
                    ? 'text-slate-700 border-slate-600' 
                    : 'text-slate-500 border-transparent hover:text-slate-700'}`}
              >
                Review and Notes
              </button>
            </div>
          </div>

          <div className="p-8">
            {/* Position Alignment Tab with CLARENCE Mediation */}
            {activeTab === 'positions' && (
              <div className="space-y-6">
                <h3 className="text-xl font-medium mb-4 text-slate-800">Align Positions on Key Clauses</h3>
                <p className="text-slate-600 mb-6 text-sm">
                  Adjust positions and request CLARENCE mediation for misaligned clauses
                </p>
                
                {clauses.map(clause => (
                  <div key={clause.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-lg text-slate-800">{clause.title}</h4>
                        <p className="text-slate-600 text-sm mt-1">{clause.description}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${getAlignmentColor(clause.alignment)}`} 
                           title={clause.alignment}></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Customer Position: {clause.customerPosition}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.customerPosition}
                          onChange={(e) => updateClausePosition(clause.id, 'customer', parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                          <span>Opposed</span>
                          <span>Neutral</span>
                          <span>Favorable</span>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Provider Position: {clause.providerPosition}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.providerPosition}
                          onChange={(e) => updateClausePosition(clause.id, 'provider', parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                          <span>Opposed</span>
                          <span>Neutral</span>
                          <span>Favorable</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          Alignment Gap: {Math.abs(clause.customerPosition - clause.providerPosition)} points
                        </span>
                        <div className="flex items-center gap-2">
                          {clause.alignment === 'aligned' && <span className="text-green-600 text-sm">✓ Aligned</span>}
                          {clause.alignment === 'close' && <span className="text-yellow-600 text-sm">⚠ Close</span>}
                          {clause.alignment === 'far' && <span className="text-red-600 text-sm">⚠ Far Apart</span>}
                        </div>
                      </div>
                      
                      {/* CLARENCE Mediation Section */}
                      {clause.alignment !== 'aligned' && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          {clause.clarenceRecommendation ? (
                            <div className="bg-white p-3 rounded-lg">
                              <div className="flex items-start gap-2">
                                <span className="text-slate-600 text-sm font-medium">🤝 CLARENCE Mediation:</span>
                              </div>
                              <p className="text-slate-700 text-sm mt-1">{clause.clarenceRecommendation}</p>
                              {clause.recommendedCompromise && (
                                <p className="text-slate-500 text-xs mt-2">
                                  Suggested position: {clause.recommendedCompromise.toFixed(1)}/10
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => requestClarenceRecommendation(clause.id)}
                              disabled={loadingRecommendation === clause.id}
                              className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                            >
                              {loadingRecommendation === clause.id ? (
                                <span className="flex items-center justify-center">
                                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Getting CLARENCE recommendation...
                                </span>
                              ) : (
                                '🤝 Request CLARENCE Mediation'
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Priority Setting Tab */}
            {activeTab === 'priorities' && (
              <div className="space-y-6">
                <h3 className="text-xl font-medium mb-4 text-slate-800">Set Clause Priorities</h3>
                <p className="text-slate-600 mb-6 text-sm">
                  Rate the importance of each clause (1 = Low Priority, 10 = Critical)
                </p>
                
                {clauses.map(clause => (
                  <div key={clause.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-800">{clause.title}</h4>
                        <p className="text-slate-600 text-sm mt-1">{clause.description}</p>
                      </div>
                      <div className="w-48">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
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
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
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
                <h3 className="text-xl font-medium mb-4 text-slate-800">Review and Add Notes</h3>
                
                {clauses.map(clause => (
                  <div key={clause.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-medium text-slate-800">{clause.title}</h4>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className={`px-2 py-1 rounded ${getAlignmentColor(clause.alignment)} text-white`}>
                            {clause.alignment}
                          </span>
                          <span className="text-slate-600">
                            Priority: {clause.priority}/10
                          </span>
                          <span className="text-slate-600">
                            Gap: {Math.abs(clause.customerPosition - clause.providerPosition)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {clause.clarenceRecommendation && (
                      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-700">
                          <strong>CLARENCE Mediation:</strong> {clause.clarenceRecommendation}
                        </p>
                      </div>
                    )}
                    <textarea
                      placeholder="Add notes or specific requirements..."
                      value={clause.notes}
                      onChange={(e) => updateClauseNotes(clause.id, e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-lg font-medium text-slate-800">Foundation Progress</p>
              <p className="text-slate-600 text-sm">Achieve 70% alignment to proceed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-medium text-slate-700">{overallAlignment}%</p>
              <p className="text-sm text-slate-600">Current Alignment</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            {!showDemo ? (
              <>
                <button
                  onClick={handleCompleteFoundation}
                  disabled={overallAlignment < 70}
                  className={`flex-1 py-3 px-6 rounded-lg font-medium text-sm transition
                    ${overallAlignment >= 70 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                >
                  {overallAlignment >= 70 ? 'Complete Foundation Phase' : `Need ${70 - overallAlignment}% More Alignment`}
                </button>
              </>
            ) : (
              <button
                className="bg-slate-400 text-white px-6 py-3 rounded-lg font-medium text-sm cursor-not-allowed"
                disabled
              >
                ✓ Foundation Complete
              </button>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              onClick={() => router.push('/auth/contracts-dashboard')}
              className="text-slate-600 hover:text-slate-900 font-medium text-sm"
            >
              Save & Return Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}