'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ========== INTERFACES ==========
interface Clause {
  id: string
  groupId: string
  title: string
  customerPosition: number
  providerPosition: number
  customerPriority: number
  providerPriority: number
  aligned: boolean
  positions: string[]
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
  const [activeTab, setActiveTab] = useState<'payment' | 'liability' | 'termination'>('payment')
  const [overallAlignment, setOverallAlignment] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  
  // Clause data organized by groups as per John's specification
  const [clauses, setClauses] = useState<Clause[]>([
    // Payment and Invoicing Group
    {
      id: 'payment-terms',
      groupId: 'payment',
      title: 'Payment Terms',
      customerPosition: 1, // 30 days
      providerPosition: 2, // 60 days
      customerPriority: 9,
      providerPriority: 8,
      aligned: false,
      positions: [
        '30 days from date of receipt by customer',
        '60 days from date of receipt by customer',
        '90 days from date of receipt by customer',
        '120 days from date of receipt by customer'
      ]
    },
    {
      id: 'late-payment',
      groupId: 'payment',
      title: 'Late Payment Interest',
      customerPosition: 1, // 10% per annum
      providerPosition: 5, // No late payment interest
      customerPriority: 6,
      providerPriority: 4,
      aligned: false,
      positions: [
        '10% per annum calculated on a monthly basis',
        'The lower of 10% or the legal rate of interest',
        '4% above the base lending rate',
        '2% above the base lending rate',
        'No late payment interest'
      ]
    },
    {
      id: 'vat-liability',
      groupId: 'payment',
      title: 'Liability for VAT / Sales Tax',
      customerPosition: 1, // Yes (exclusive)
      providerPosition: 0, // No (inclusive)
      customerPriority: 7,
      providerPriority: 7,
      aligned: false,
      positions: ['No (prices include VAT)', 'Yes (prices exclude VAT)']
    },
    
    // Limitation of Liability Group
    {
      id: 'liability-cap',
      groupId: 'liability',
      title: 'General Liability Cap',
      customerPosition: 1, // 100% of annual fees
      providerPosition: 4, // Annual cap = greater amount
      customerPriority: 9,
      providerPriority: 10,
      aligned: false,
      positions: [
        'Aggregate cap (whole term) = 100% of the annual fees',
        'Aggregate cap = 150% of the annual fees',
        'Aggregate cap = greater of [agreed amount] and 150% of annual fees',
        'Annual cap = 150% of the annual fees',
        'Annual cap = greater of [agreed amount] and 150% of annual fees',
        'Annual cap (per year) = 200% of the annual fees'
      ]
    },
    {
      id: 'excluded-losses',
      groupId: 'liability',
      title: 'Excluded Losses (Indirect Damages)',
      customerPosition: 1, // Exclude all indirect and consequential
      providerPosition: 3, // Exclude indirect but not lost profits
      customerPriority: 8,
      providerPriority: 9,
      aligned: false,
      positions: [
        'Exclude all indirect/consequential damages and lost profits (direct or indirect)',
        'Exclude all indirect/consequential damages and lost profits',
        'Exclude all indirect/consequential damages including lost profits',
        'Exclude all indirect/consequential damages excluding lost profits',
        'Exclude indirect/consequential but include reasonably foreseeable',
        'No exclusion for indirect or consequential losses'
      ]
    },
    {
      id: 'unlimited-losses',
      groupId: 'liability',
      title: 'Unlimited Losses (UK Positions)',
      customerPosition: 1, // Death, injury, fraud
      providerPosition: 3, // Plus gross misconduct and negligence
      customerPriority: 7,
      providerPriority: 8,
      aligned: false,
      positions: [
        'Death/injury by negligence, fraud, Sale of Goods Act',
        'Death/injury by negligence, fraud, Sale of Goods Act, gross misconduct',
        'Death/injury by negligence, fraud, Sale of Goods Act, gross misconduct, gross negligence',
        'Death/injury by negligence, fraud, Sale of Goods Act, gross misconduct, gross negligence, willful default'
      ]
    },
    
    // Term and Termination Group
    {
      id: 'initial-term',
      groupId: 'termination',
      title: 'Length of Initial Term',
      customerPosition: 3, // 2 years
      providerPosition: 1, // 5 years
      customerPriority: 8,
      providerPriority: 9,
      aligned: false,
      positions: ['5 years', '3 years', '2 years', '1 year']
    },
    {
      id: 'renewal-term',
      groupId: 'termination',
      title: 'Renewal Term',
      customerPosition: 3, // Client right to extend 2 years
      providerPosition: 1, // No renewal option
      customerPriority: 6,
      providerPriority: 5,
      aligned: false,
      positions: [
        'No renewal option (mutual agreement required)',
        'Client right to extend for up to 12 months on existing terms',
        'Client right to extend for up to 2 years on existing terms',
        'Client right to extend for up to 3 years on existing terms'
      ]
    },
    {
      id: 'termination-convenience',
      groupId: 'termination',
      title: 'Right to Terminate for Convenience',
      customerPosition: 5, // Customer only - 60 days
      providerPosition: 1, // Mutual - 180 days
      customerPriority: 9,
      providerPriority: 7,
      aligned: false,
      positions: [
        'Mutual - 180 days notice',
        'Customer only - 180 days notice',
        'Customer only - 120 days notice',
        'Customer only - 90 days notice',
        'Customer only - 60 days notice',
        'Customer only - 30 days notice'
      ]
    }
  ])

  const calculateAlignment = useCallback(() => {
    let alignedCount = 0
    const totalCount = clauses.length
    
    clauses.forEach(clause => {
      if (clause.customerPosition === clause.providerPosition) {
        alignedCount++
      }
    })
    
    const percentage = totalCount > 0 ? Math.round((alignedCount / totalCount) * 100) : 0
    setOverallAlignment(percentage)
  }, [clauses])

  const updatePosition = (clauseId: string, party: 'customer' | 'provider', position: number) => {
    setClauses(prevClauses =>
      prevClauses.map(clause => {
        if (clause.id === clauseId) {
          const updated = { ...clause }
          if (party === 'customer') {
            updated.customerPosition = position
          } else {
            updated.providerPosition = position
          }
          updated.aligned = updated.customerPosition === updated.providerPosition
          return updated
        }
        return clause
      })
    )
  }

  const updatePriority = (clauseId: string, party: 'customer' | 'provider', priority: number) => {
    setClauses(prevClauses =>
      prevClauses.map(clause => {
        if (clause.id === clauseId) {
          return {
            ...clause,
            [party === 'customer' ? 'customerPriority' : 'providerPriority']: priority
          }
        }
        return clause
      })
    )
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
    setShowComplete(true)
  }

  useEffect(() => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    // Load session data
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session')
    
    if (sessionId) {
      const storedSession = localStorage.getItem('currentSession')
      if (storedSession) {
        const sessionData = JSON.parse(storedSession)
        setSession(sessionData)
      } else {
        setSession({
          sessionId: sessionId,
          sessionNumber: 'SESS-001',
          customerCompany: 'Customer Company',
          serviceRequired: 'Contract Services',
          dealValue: '1000000',
          status: 'active'
        })
      }
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

  const getClausesByGroup = (groupId: string) => {
    return clauses.filter(clause => clause.groupId === groupId)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
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
                onClick={() => router.push(`/auth/chat?sessionId=${session?.sessionId}`)}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg text-sm"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Card */}
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

        {/* Phase Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Contract Negotiation Progress</h3>
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm
                  ${phase.complete ? 'bg-green-600 text-white' : 
                    phase.active ? 'bg-slate-700 text-white shadow-lg' : 'bg-slate-200 text-slate-600'}`}>
                  {phase.complete ? '✓' : phase.num}
                </div>
                <span className="text-xs mt-1 text-slate-600">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-green-600 to-slate-700 h-2 rounded-full transition-all duration-500" 
                 style={{ width: '33.33%' }}></div>
          </div>
        </div>

        {/* Clause Grouping Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="border-b border-slate-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('payment')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition
                  ${activeTab === 'payment' 
                    ? 'text-slate-700 border-slate-600' 
                    : 'text-slate-500 border-transparent hover:text-slate-700'}`}
              >
                Payment and Invoicing
              </button>
              <button
                onClick={() => setActiveTab('liability')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition
                  ${activeTab === 'liability' 
                    ? 'text-slate-700 border-slate-600' 
                    : 'text-slate-500 border-transparent hover:text-slate-700'}`}
              >
                Limitation of Liability
              </button>
              <button
                onClick={() => setActiveTab('termination')}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition
                  ${activeTab === 'termination' 
                    ? 'text-slate-700 border-slate-600' 
                    : 'text-slate-500 border-transparent hover:text-slate-700'}`}
              >
                Term and Termination
              </button>
            </div>
          </div>

          <div className="p-8">
            {/* Render clauses for active tab */}
            {getClausesByGroup(activeTab).map(clause => (
              <div key={clause.id} className="mb-8 border border-slate-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-medium text-lg text-slate-800">{clause.title}</h4>
                  {/* Alignment Circle - as requested by John */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm
                    ${clause.aligned ? 'bg-green-500' : 'bg-red-500'}`}>
                    {clause.aligned ? '✓' : '✗'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Customer Side */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h5 className="font-medium text-slate-800 mb-3">Customer Position</h5>
                    <select
                      value={clause.customerPosition}
                      onChange={(e) => updatePosition(clause.id, 'customer', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 mb-4"
                    >
                      {clause.positions.map((position, index) => (
                        <option key={index} value={index}>
                          {position}
                        </option>
                      ))}
                    </select>
                    
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Priority: {clause.customerPriority}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={clause.customerPriority}
                      onChange={(e) => updatePriority(clause.id, 'customer', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>

                  {/* Provider Side */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h5 className="font-medium text-green-900 mb-3">Provider Position</h5>
                    <select
                      value={clause.providerPosition}
                      onChange={(e) => updatePosition(clause.id, 'provider', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg bg-white mb-4"
                    >
                      {clause.positions.map((position, index) => (
                        <option key={index} value={index}>
                          {position}
                        </option>
                      ))}
                    </select>
                    
                    <label className="block text-sm font-medium text-green-800 mb-2">
                      Priority: {clause.providerPriority}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={clause.providerPriority}
                      onChange={(e) => updatePriority(clause.id, 'provider', parseInt(e.target.value))}
                      className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-green-600 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
            {!showComplete ? (
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
            ) : (
              <>
                <button
                  className="bg-slate-400 text-white px-6 py-3 rounded-lg font-medium text-sm cursor-not-allowed"
                  disabled
                >
                  ✓ Foundation Complete
                </button>
                <button
                  onClick={() => router.push(`/auth/gap-narrowing?session=${session?.sessionId}`)}
                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-lg font-medium text-sm animate-pulse"
                >
                  Proceed to Phase 3: Gap Narrowing →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}