'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ClausePosition {
  clauseId: string
  groupName: string
  clauseName: string
  options: string[]
  customerPosition: number
  providerPosition: number
  customerPriority: number
  providerPriority: number
  aligned: boolean
}

export default function FoundationPhase() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const [activeGroup, setActiveGroup] = useState<'payment' | 'liability' | 'termination'>('payment')
  const [overallAlignment, setOverallAlignment] = useState(0)
  
  // Clause positions with alignment status
  const [clauses, setClauses] = useState<ClausePosition[]>([
    // Payment and Invoicing Group
    {
      clauseId: 'payment-terms',
      groupName: 'Payment and Invoicing',
      clauseName: 'Payment Terms',
      options: [
        '30 days from date of receipt by customer',
        '60 days from date of receipt by customer',
        '90 days from date of receipt by customer',
        '120 days from date of receipt by customer'
      ],
      customerPosition: 1,
      providerPosition: 0,
      customerPriority: 8,
      providerPriority: 9,
      aligned: false
    },
    {
      clauseId: 'late-payment',
      groupName: 'Payment and Invoicing',
      clauseName: 'Late Payment Interest',
      options: [
        '10% per annum calculated on a monthly basis',
        'The lower of 10% or the legal rate of interest',
        '4% above the base lending rate',
        '2% above the base lending rate',
        'No late payment interest'
      ],
      customerPosition: 4,
      providerPosition: 0,
      customerPriority: 4,
      providerPriority: 7,
      aligned: false
    },
    {
      clauseId: 'vat-liability',
      groupName: 'Payment and Invoicing',
      clauseName: 'Liability for VAT/Sales Tax',
      options: [
        'Yes - Prices exclude VAT/Sales Tax',
        'No - Prices include VAT/Sales Tax'
      ],
      customerPosition: 0,
      providerPosition: 0,
      customerPriority: 5,
      providerPriority: 5,
      aligned: true
    },
    // Limitation of Liability Group
    {
      clauseId: 'liability-cap',
      groupName: 'Limitation of Liability',
      clauseName: 'General Liability Cap',
      options: [
        'Aggregate cap (whole term) = 100% of annual fees',
        'Aggregate cap = 150% of annual fees',
        'Aggregate cap = greater of agreed amount and 150% of annual fees',
        'Annual cap = 150% of annual fees',
        'Annual cap = greater of agreed amount and 150% of annual fees',
        'Annual cap (per year) = 200% of annual fees'
      ],
      customerPosition: 2,
      providerPosition: 0,
      customerPriority: 9,
      providerPriority: 10,
      aligned: false
    },
    {
      clauseId: 'excluded-losses',
      groupName: 'Limitation of Liability',
      clauseName: 'Excluded Losses (Indirect Damages)',
      options: [
        'Exclude all indirect/consequential damages and lost profits/savings',
        'Exclude indirect/consequential damages and lost profits',
        'Exclude indirect/consequential including lost profits',
        'Exclude indirect/consequential excluding lost profits',
        'Exclude indirect but include reasonably foreseeable',
        'No exclusion for indirect or consequential losses'
      ],
      customerPosition: 3,
      providerPosition: 0,
      customerPriority: 7,
      providerPriority: 8,
      aligned: false
    },
    {
      clauseId: 'unlimited-losses',
      groupName: 'Limitation of Liability',
      clauseName: 'Unlimited Losses (UK)',
      options: [
        'Death/injury by negligence, fraud, Sale of Goods Act',
        'Above plus gross misconduct',
        'Above plus gross negligence',
        'All of the above plus wilful default'
      ],
      customerPosition: 1,
      providerPosition: 0,
      customerPriority: 6,
      providerPriority: 9,
      aligned: false
    },
    // Term and Termination Group
    {
      clauseId: 'initial-term',
      groupName: 'Term and Termination',
      clauseName: 'Length of Initial Term',
      options: [
        '5 years',
        '3 years',
        '2 years',
        '1 year'
      ],
      customerPosition: 1,
      providerPosition: 2,
      customerPriority: 8,
      providerPriority: 7,
      aligned: false
    },
    {
      clauseId: 'renewal-term',
      groupName: 'Term and Termination',
      clauseName: 'Renewal Term',
      options: [
        'No renewal option',
        'Client right to extend 12 months',
        'Client right to extend 2 years',
        'Client right to extend 3 years'
      ],
      customerPosition: 2,
      providerPosition: 1,
      customerPriority: 6,
      providerPriority: 5,
      aligned: false
    },
    {
      clauseId: 'termination-convenience',
      groupName: 'Term and Termination',
      clauseName: 'Termination for Convenience',
      options: [
        'Mutual - 180 days notice',
        'Customer only - 180 days',
        'Customer only - 120 days',
        'Customer only - 90 days',
        'Customer only - 60 days',
        'Customer only - 30 days'
      ],
      customerPosition: 3,
      providerPosition: 1,
      customerPriority: 9,
      providerPriority: 8,
      aligned: false
    }
  ])

  useEffect(() => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const sessionParam = urlParams.get('session') || localStorage.getItem('currentSessionId') || ''
    setSessionId(sessionParam)
    
    calculateAlignment()
  }, [clauses])

    useEffect(() => {
    // Only check if we have a sessionId
    if (!sessionId) return
    
    // Check if Phase 1 is complete
    const checkPhaseAccess = async () => {
      const phase1Complete = localStorage.getItem(`phase1_complete_${sessionId}`)
      
      if (!phase1Complete) {
        alert('Please complete Phase 1 Assessment first')
        router.push(`/auth/assessment?session=${sessionId}`)
      }
    }
    
    checkPhaseAccess()
  }, [sessionId, router])

  const calculateAlignment = () => {
    const alignedClauses = clauses.filter(c => c.aligned).length
    const totalClauses = clauses.length
    const alignment = Math.round((alignedClauses / totalClauses) * 100)
    setOverallAlignment(alignment)
  }

  const updatePosition = (clauseId: string, party: 'customer' | 'provider', position: number) => {
    setClauses(prev => prev.map(clause => {
      if (clause.clauseId === clauseId) {
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
    }))
  }

  const updatePriority = (clauseId: string, party: 'customer' | 'provider', priority: number) => {
    setClauses(prev => prev.map(clause => {
      if (clause.clauseId === clauseId) {
        return {
          ...clause,
          [party === 'customer' ? 'customerPriority' : 'providerPriority']: priority
        }
      }
      return clause
    }))
  }

  const getGroupClauses = (group: string) => {
    return clauses.filter(c => c.groupName.toLowerCase().includes(group))
  }

  const phases = [
    { num: 1, name: 'Preliminary', status: 'completed' },
    { num: 2, name: 'Foundation', status: 'active' },
    { num: 3, name: 'Gap Narrowing', status: 'pending' },
    { num: 4, name: 'Complex Issues', status: 'pending' },
    { num: 5, name: 'Commercial', status: 'pending' },
    { num: 6, name: 'Final Review', status: 'pending' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
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
                onClick={() => router.push(`/chat?sessionId=${sessionId}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Contract Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Foundational Drafting</h1>
              <p className="text-blue-100">Session: {sessionId.substring(0, 8)}...</p>
              <p className="text-blue-100">Building initial contract positions</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Overall Alignment</p>
              <p className="text-3xl font-bold">{overallAlignment}%</p>
              <p className="text-sm text-blue-200 mt-1">Target: 50%</p>
            </div>
          </div>
        </div>

{/* Phase Progress */}
<div className="bg-white rounded-xl shadow-sm p-6 mb-6">
  <div className="flex justify-between items-center mb-4">
    {phases.map((phase) => (
      <div 
        key={phase.num} 
        className={`flex flex-col items-center 
          ${phase.num === 5 ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
        onClick={() => {
          if (phase.num === 5) {
            // Temporary navigation to Phase 5 for demo
            router.push(`/auth/commercial?session=${sessionId}`)
          }
        }}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
          ${phase.status === 'completed' ? 'bg-green-600 text-white' : 
            phase.status === 'active' ? 'bg-blue-600 text-white' : 
            'bg-gray-200 text-gray-600'}
          ${phase.num === 5 ? 'ring-2 ring-purple-400 ring-offset-2' : ''}`}>
          {phase.status === 'completed' ? '✓' : phase.num}
        </div>
        <span className="text-xs mt-1">{phase.name}</span>
        {phase.num === 5 && (
          <span className="text-xs text-purple-600 font-semibold">Demo →</span>
        )}
      </div>
    ))}
  </div>
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: '33%' }}></div>
  </div>
</div>

        {/* Clause Groups Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveGroup('payment')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeGroup === 'payment' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Payment & Invoicing
              </button>
              <button
                onClick={() => setActiveGroup('liability')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeGroup === 'liability' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Limitation of Liability
              </button>
              <button
                onClick={() => setActiveGroup('termination')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeGroup === 'termination' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Term & Termination
              </button>
            </div>
          </div>

          {/* Clause Positions */}
          <div className="p-8">
            <div className="space-y-8">
              {getGroupClauses(activeGroup).map((clause) => (
                <div key={clause.clauseId} className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{clause.clauseName}</h3>
                      {/* Alignment Indicator Circle */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center
                        ${clause.aligned ? 'bg-green-500' : 'bg-red-500'}`}>
                        {clause.aligned ? (
                          <span className="text-white text-sm">✓</span>
                        ) : (
                          <span className="text-white text-sm">✗</span>
                        )}
                      </div>
                      <span className={`text-sm ${clause.aligned ? 'text-green-600' : 'text-red-600'}`}>
                        {clause.aligned ? 'Aligned' : 'Not Aligned'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Customer Position */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-3">Customer Position</h4>
                      <div className="space-y-2 mb-4">
                        {clause.options.map((option, idx) => (
                          <label key={idx} className="flex items-start gap-2">
                            <input
                              type="radio"
                              name={`${clause.clauseId}-customer`}
                              checked={clause.customerPosition === idx}
                              onChange={() => updatePosition(clause.clauseId, 'customer', idx)}
                              className="mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Priority (1-10):</label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.customerPriority}
                          onChange={(e) => updatePriority(clause.clauseId, 'customer', parseInt(e.target.value))}
                          className="w-full mt-2"
                        />
                        <span className="text-sm font-bold text-blue-600">{clause.customerPriority}</span>
                      </div>
                    </div>

                    {/* Provider Position */}
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-900 mb-3">Provider Position</h4>
                      <div className="space-y-2 mb-4">
                        {clause.options.map((option, idx) => (
                          <label key={idx} className="flex items-start gap-2">
                            <input
                              type="radio"
                              name={`${clause.clauseId}-provider`}
                              checked={clause.providerPosition === idx}
                              onChange={() => updatePosition(clause.clauseId, 'provider', idx)}
                              className="mt-1"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Priority (1-10):</label>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={clause.providerPriority}
                          onChange={(e) => updatePriority(clause.clauseId, 'provider', parseInt(e.target.value))}
                          className="w-full mt-2"
                        />
                        <span className="text-sm font-bold text-green-600">{clause.providerPriority}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p>Aligned Clauses: {clauses.filter(c => c.aligned).length} of {clauses.length}</p>
              <p>Ready to proceed when alignment reaches 50%</p>
            </div>
            <div className="flex gap-4">
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Generate Draft Contract
              </button>
              <button
                className={`px-6 py-3 rounded-lg font-semibold
                  ${overallAlignment >= 50 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                disabled={overallAlignment < 50}
              >
                Proceed to Phase 3
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}