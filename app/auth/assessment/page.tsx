'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

export default function PreliminaryAssessment() {
  const router = useRouter()
  const [currentPhase] = useState(1)
  const [sessionId, setSessionId] = useState<string>('')
  const [providerId, setProviderId] = useState<string>('')
  const [providerName, setProviderName] = useState<string>('Provider Name')
  const [activeSection, setActiveSection] = useState<'profile' | 'fit' | 'leverage'>('profile')
  const [leverageScore, setLeverageScore] = useState({ customer: 50, provider: 50 })
  const [assessmentComplete, setAssessmentComplete] = useState(false)
  
  // Form states
  const [dealProfile, setDealProfile] = useState<DealProfile>({
    services: '',
    deliveryLocations: [],
    serviceLocations: [],
    pricingApproach: '',
    pricingExpectation: ''
  })

  const [partyFit, setPartyFit] = useState<PartyFit>({
    customerName: '',
    customerAddress: '',
    customerEntity: '',
    customerIncorporation: '',
    customerTurnover: '',
    providerName: '',
    providerAddress: '',
    providerEntity: '',
    providerIncorporation: '',
    providerTurnover: '',
    providerEmployees: '',
    providerExperience: '',
    parentGuarantee: false,
    references: []
  })

  const [leverageFactors, setLeverageFactors] = useState<LeverageFactors>({
    dealSize: '',
    contractDuration: '',
    industrySector: '',
    serviceType: '',
    partyFitScore: 0
  })

  useEffect(() => {
    // Check authentication
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }

    // Get session and provider from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search)
    const sessionParam = urlParams.get('session') || localStorage.getItem('currentSessionId') || ''
    const providerParam = urlParams.get('provider') || localStorage.getItem('currentProviderId') || ''
    const providerNameParam = urlParams.get('providerName') || localStorage.getItem('currentProviderName') || 'Provider'
    
    setSessionId(sessionParam)
    setProviderId(providerParam)
    setProviderName(providerNameParam)
  }, [router])

  const calculateLeverage = () => {
    // Simple leverage calculation based on inputs
    let customerLeverage = 50
    
    // Deal size affects leverage
    const dealValue = parseInt(leverageFactors.dealSize.replace(/\D/g, '')) || 0
    if (dealValue > 5000000) customerLeverage += 10
    else if (dealValue > 1000000) customerLeverage += 5
    
    // Duration affects leverage
    const duration = parseInt(leverageFactors.contractDuration) || 0
    if (duration > 36) customerLeverage += 5
    else if (duration < 12) customerLeverage -= 5
    
    // Party fit affects leverage
    if (leverageFactors.partyFitScore > 80) customerLeverage += 10
    else if (leverageFactors.partyFitScore < 50) customerLeverage -= 10
    
    // Ensure within bounds
    customerLeverage = Math.max(20, Math.min(80, customerLeverage))
    
    setLeverageScore({
      customer: customerLeverage,
      provider: 100 - customerLeverage
    })
  }

  const handleSubmitAssessment = async () => {
    // Here you would submit to your API
    console.log('Submitting assessment:', { dealProfile, partyFit, leverageFactors })

    // For now, just show success and calculate leverage
    calculateLeverage()
        
    setAssessmentComplete(true)

    localStorage.setItem(`phase1_complete_${sessionId}`, 'true')

    alert('Assessment submitted successfully!')
  }

  const phases = [
    { num: 1, name: 'Preliminary', active: true },
    { num: 2, name: 'Foundation', active: false },
    { num: 3, name: 'Gap Narrowing', active: false },
    { num: 4, name: 'Complex Issues', active: false },
    { num: 5, name: 'Commercial', active: false },
    { num: 6, name: 'Final Review', active: false }
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
              <span className="ml-4 text-gray-600">Phase 1: Preliminary Assessment</span>
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
              <h1 className="text-2xl font-bold mb-2">Preliminary Assessment</h1>
              <p className="text-blue-100">Session: {sessionId.substring(0, 8)}...</p>
              <p className="text-blue-100">Provider: {providerName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Contract Phase</p>
              <p className="text-3xl font-bold">1 of 6</p>
            </div>
          </div>
        </div>

        {/* Phase Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                  ${phase.active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {phase.num}
                </div>
                <span className="text-xs mt-1">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '16.66%' }}></div>
          </div>
        </div>

        {/* Assessment Sections */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveSection('profile')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeSection === 'profile' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Deal Profile
              </button>
              <button
                onClick={() => setActiveSection('fit')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeSection === 'fit' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Party Fit
              </button>
              <button
                onClick={() => setActiveSection('leverage')}
                className={`px-6 py-4 font-semibold border-b-2 transition
                  ${activeSection === 'leverage' 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-600 border-transparent hover:text-gray-900'}`}
              >
                Leverage Assessment
              </button>
            </div>
          </div>

          <div className="p-8">
            {/* Deal Profile Section */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Deal Profile</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Services to be Delivered
                  </label>
                  <textarea
                    value={dealProfile.services}
                    onChange={(e) => setDealProfile({...dealProfile, services: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe the services..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Locations (Countries)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., UK, USA, Canada"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => setDealProfile({
                        ...dealProfile, 
                        deliveryLocations: e.target.value.split(',').map(s => s.trim())
                      })}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Locations (Countries)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., India, Philippines"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => setDealProfile({
                        ...dealProfile,
                        serviceLocations: e.target.value.split(',').map(s => s.trim())
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Pricing Approach
                    </label>
                    <select
                      value={dealProfile.pricingApproach}
                      onChange={(e) => setDealProfile({...dealProfile, pricingApproach: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select approach...</option>
                      <option value="per-fte">Per FTE</option>
                      <option value="fixed-price">Fixed Price</option>
                      <option value="time-materials">Time & Materials</option>
                      <option value="outcome-based">Outcome Based</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pricing Expectation
                    </label>
                    <input
                      type="text"
                      value={dealProfile.pricingExpectation}
                      onChange={(e) => setDealProfile({...dealProfile, pricingExpectation: e.target.value})}
                      placeholder="e.g., £50,000 per FTE"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Party Fit Section */}
            {activeSection === 'fit' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Party Fit Assessment</h3>
                
                <div className="bg-blue-50 p-4 rounded-lg mb-6">
                  <h4 className="font-semibold text-blue-900 mb-3">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Company Name"
                      className="px-4 py-2 border rounded-lg"
                      value={partyFit.customerName}
                      onChange={(e) => setPartyFit({...partyFit, customerName: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Annual Turnover"
                      className="px-4 py-2 border rounded-lg"
                      value={partyFit.customerTurnover}
                      onChange={(e) => setPartyFit({...partyFit, customerTurnover: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Provider Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Company Name"
                      className="px-4 py-2 border rounded-lg"
                      value={partyFit.providerName}
                      onChange={(e) => setPartyFit({...partyFit, providerName: e.target.value})}
                    />
                    <input
                      type="text"
                      placeholder="Number of Employees"
                      className="px-4 py-2 border rounded-lg"
                      value={partyFit.providerEmployees}
                      onChange={(e) => setPartyFit({...partyFit, providerEmployees: e.target.value})}
                    />
                    <textarea
                      placeholder="Experience with similar services"
                      className="col-span-2 px-4 py-2 border rounded-lg"
                      rows={3}
                      value={partyFit.providerExperience}
                      onChange={(e) => setPartyFit({...partyFit, providerExperience: e.target.value})}
                    />
                  </div>
                  <label className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={partyFit.parentGuarantee}
                      onChange={(e) => setPartyFit({...partyFit, parentGuarantee: e.target.checked})}
                    />
                    <span>Willing to provide parent company guarantee</span>
                  </label>
                </div>
              </div>
            )}

            {/* Leverage Assessment Section */}
            {activeSection === 'leverage' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Leverage Assessment</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Annual Contract Value
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., £2,000,000"
                      className="w-full px-4 py-2 border rounded-lg"
                      value={leverageFactors.dealSize}
                      onChange={(e) => setLeverageFactors({...leverageFactors, dealSize: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contract Duration (months)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 36"
                      className="w-full px-4 py-2 border rounded-lg"
                      value={leverageFactors.contractDuration}
                      onChange={(e) => setLeverageFactors({...leverageFactors, contractDuration: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-gray-100 p-6 rounded-lg">
                  <h4 className="font-semibold mb-4">Calculated Leverage</h4>
                  <div className="relative h-12 bg-white rounded-full overflow-hidden">
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-600 flex items-center justify-center text-white font-bold"
                      style={{ width: `${leverageScore.customer}%` }}
                    >
                      Customer {leverageScore.customer}%
                    </div>
                    <div 
                      className="absolute right-0 top-0 h-full bg-gray-600 flex items-center justify-center text-white font-bold"
                      style={{ width: `${leverageScore.provider}%` }}
                    >
                      Provider {leverageScore.provider}%
                    </div>
                  </div>
                  <button
                    onClick={calculateLeverage}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Recalculate Leverage
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <button
                onClick={handleSubmitAssessment}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Complete Assessment
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold"
                disabled
              >

                {assessmentComplete && (
              <button
                onClick={() => router.push(`/auth/foundation?session=${sessionId}&provider=${providerId}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Proceed to Phase 2: Foundation →
              </button>
            )}

                Draft Contract (Coming Soon)
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
                disabled
              >
                Progress Report (Coming Soon)
              </button>
            </div>
            <button
              onClick={() => router.push('/auth/contracts-dashboard')}
              className="text-gray-600 hover:text-gray-900 font-semibold"
            >
              Save & Return Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}