'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
}

interface Provider {
  providerId: string
  providerName: string
  providerAddress?: string
  providerEntity?: string
  providerIncorporation?: string
  providerTurnover?: string
  providerEmployees?: string
  providerExperience?: string
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

// ========== SECTION 2: MAIN COMPONENT START ==========
function PreliminaryAssessmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [activeSection, setActiveSection] = useState<'profile' | 'fit' | 'leverage'>('profile')
  const [leverageScore, setLeverageScore] = useState({ customer: 50, provider: 50 })
  const [assessmentComplete, setAssessmentComplete] = useState(false)
  
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

  // ========== SECTION 4: FUNCTIONS ==========
  const selectProvider = useCallback((provider: Provider) => {
    setSelectedProvider(provider)
    // Pre-fill provider information in party fit
    setPartyFit(prev => ({
      ...prev,
      providerName: provider.providerName || '',
      providerAddress: provider.providerAddress || '',
      providerEntity: provider.providerEntity || '',
      providerIncorporation: provider.providerIncorporation || '',
      providerTurnover: provider.providerTurnover || '',
      providerEmployees: provider.providerEmployees || '',
      providerExperience: provider.providerExperience || ''
    }))
  }, [])

  const loadProviders = useCallback(async (sessionId: string) => {
    try {
      console.log('Loading providers for session:', sessionId)
      
      // For demo mode, use mock providers
      if (sessionId === 'demo-session') {
        console.log('Creating demo providers')
        const demoProviders: Provider[] = [
          {
            providerId: 'provider-1',
            providerName: 'TechCorp Solutions',
            providerTurnover: '£10M',
            providerEmployees: '250',
            providerExperience: 'Extensive experience in IT consulting'
          },
          {
            providerId: 'provider-2',
            providerName: 'Global Services Ltd',
            providerTurnover: '£25M',
            providerEmployees: '500',
            providerExperience: 'Leading provider of managed services'
          }
        ]
        setProviders(demoProviders)
        // Don't auto-select in demo mode with multiple providers
        return
      }

      // For real sessions, use 'session' parameter (not 'sessionId')
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/session-providers?session=${sessionId}`
      console.log('Loading providers from API:', apiUrl)
      
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        console.log('Providers data received:', data)
        
        if (Array.isArray(data) && data.length > 0) {
          setProviders(data)
          // Auto-select first provider if only one exists
          if (data.length === 1) {
            selectProvider(data[0])
          }
        } else {
          // If no providers from API, create default ones
          console.log('No providers from API, creating defaults')
          const defaultProviders: Provider[] = [
            {
              providerId: `provider-${sessionId}-1`,
              providerName: session?.providerCompany || 'Provider Company A',
              providerTurnover: 'Not specified',
              providerEmployees: 'Not specified'
            }
          ]
          setProviders(defaultProviders)
        }
      } else {
        console.error('Failed to load providers:', response.status, 'from URL:', apiUrl)
        // Create a default provider on error
        const fallbackProvider: Provider[] = [{
          providerId: `provider-${sessionId}-fallback`,
          providerName: session?.providerCompany || 'Selected Provider',
          providerTurnover: 'Not specified',
          providerEmployees: 'Not specified'
        }]
        setProviders(fallbackProvider)
      }
    } catch (error) {
      console.error('Error loading providers:', error)
      // Create a default provider on error
      const fallbackProvider: Provider[] = [{
        providerId: `provider-${sessionId}-error`,
        providerName: session?.providerCompany || 'Available Provider',
        providerTurnover: 'Not specified',
        providerEmployees: 'Not specified'
      }]
      setProviders(fallbackProvider)
    }
  }, [selectProvider, session?.providerCompany])

  const loadSessionData = useCallback(async () => {
    try {
      // Get session ID from URL params
      let sessionId = searchParams.get('session')
      
      // If no session ID in URL, check localStorage
      if (!sessionId) {
        const storedSessionId = localStorage.getItem('currentSessionId')
        const storedSession = localStorage.getItem('currentSession')
        
        if (storedSessionId && storedSession) {
          // Use stored session data
          const sessionData = JSON.parse(storedSession)
          setSession(sessionData)
          setDealProfile(prev => ({
            ...prev,
            services: sessionData.serviceRequired || ''
          }))
          setLeverageFactors(prev => ({
            ...prev,
            dealSize: sessionData.dealValue || ''
          }))
          sessionId = storedSessionId
        } else {
          // Demo mode
          console.log('No session found, entering demo mode')
          const demoSession: Session = {
            sessionId: 'demo-session',
            sessionNumber: 'DEMO-001',
            customerCompany: 'Demo Customer Ltd',
            serviceRequired: 'IT Consulting Services',
            dealValue: '500000',
            status: 'initiated',
            phase: 1
          }
          setSession(demoSession)
          sessionId = 'demo-session'
        }
      } else {
        // Load session from localStorage if available
        const cachedSession = localStorage.getItem('currentSession')
        if (cachedSession) {
          const sessionData = JSON.parse(cachedSession)
          setSession(sessionData)
          setDealProfile(prev => ({
            ...prev,
            services: sessionData.serviceRequired || ''
          }))
          setLeverageFactors(prev => ({
            ...prev,
            dealSize: sessionData.dealValue || ''
          }))
        }
      }

      // Load providers for this session
      if (sessionId) {
        await loadProviders(sessionId)
      }
      
    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, router, loadProviders])

  const calculateLeverage = () => {
    let customerLeverage = 50
    
    const dealValue = parseInt(leverageFactors.dealSize.replace(/\D/g, '')) || 0
    if (dealValue > 5000000) customerLeverage += 10
    else if (dealValue > 1000000) customerLeverage += 5
    
    const duration = parseInt(leverageFactors.contractDuration) || 0
    if (duration > 36) customerLeverage += 5
    else if (duration < 12) customerLeverage -= 5
    
    if (leverageFactors.partyFitScore > 80) customerLeverage += 10
    else if (leverageFactors.partyFitScore < 50) customerLeverage -= 10
    
    customerLeverage = Math.max(20, Math.min(80, customerLeverage))
    
    setLeverageScore({
      customer: customerLeverage,
      provider: 100 - customerLeverage
    })
  }

  const handleSubmitAssessment = async () => {
    if (!session || !selectedProvider) {
      alert('Please select a provider before completing the assessment')
      return
    }

    console.log('Submitting assessment:', { 
      sessionId: session.sessionId,
      providerId: selectedProvider.providerId,
      dealProfile, 
      partyFit, 
      leverageFactors 
    })
    
    calculateLeverage()
    
    // Save assessment data for next phase
    localStorage.setItem(`assessment_${session.sessionId}`, JSON.stringify({
      sessionId: session.sessionId,
      providerId: selectedProvider.providerId,
      providerName: selectedProvider.providerName,
      dealProfile,
      partyFit,
      leverageFactors,
      leverageScore
    }))
    
    setAssessmentComplete(true)
    
    // TODO: Send assessment data to backend via n8n webhook
    // const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/provider-assessmentresults', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ ... })
    // })
    
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

  // ========== SECTION 5: USE EFFECTS ==========
  useEffect(() => {
    const auth = localStorage.getItem('clarence_auth')
    if (!auth) {
      router.push('/auth/login')
      return
    }
    
    loadSessionData()
  }, [loadSessionData, router])

  // ========== SECTION 6: RENDER START ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Session not found</p>
          <button
            onClick={() => router.push('/auth/contracts-dashboard')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== SECTION 7: NAVIGATION ===== */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/auth/contracts-dashboard" className="flex items-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">CLARENCE</div>
                  <div className="text-xs text-gray-500 tracking-widest">THE HONEST BROKER</div>
                </div>
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
                onClick={() => router.push(`/chat?sessionId=${session?.sessionId || 'demo'}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== SECTION 8: MAIN CONTENT CONTAINER ===== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Contract Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-2">Preliminary Assessment</h1>
              <p className="text-blue-100">Session: {session.sessionNumber || session.sessionId.substring(0, 8)}...</p>
              <p className="text-blue-100">Service: {session.serviceRequired}</p>
              <p className="text-blue-100">Deal Value: £{parseInt(session.dealValue || '0').toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Contract Phase</p>
              <p className="text-3xl font-bold">1 of 6</p>
            </div>
          </div>
        </div>

        {/* Provider Selection (if multiple providers) */}
        {providers.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Select Provider for Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(provider => (
                <button
                  key={provider.providerId}
                  onClick={() => selectProvider(provider)}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    selectedProvider?.providerId === provider.providerId
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{provider.providerName}</div>
                  {provider.providerTurnover && (
                    <div className="text-sm text-gray-600">Turnover: {provider.providerTurnover}</div>
                  )}
                  {provider.providerEmployees && (
                    <div className="text-sm text-gray-600">Employees: {provider.providerEmployees}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Provider Info */}
        {selectedProvider && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-green-800 font-semibold">Selected Provider: </span>
                <span className="text-green-900">{selectedProvider.providerName}</span>
              </div>
              {providers.length > 1 && (
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="text-sm text-green-600 hover:text-green-800"
                >
                  Change Provider
                </button>
              )}
            </div>
          </div>
        )}

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

        {/* ===== SECTION 9: ASSESSMENT SECTIONS ===== */}
        {selectedProvider ? (
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
                        value={partyFit.customerName || session.customerCompany}
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
                        className="px-4 py-2 border rounded-lg bg-gray-100"
                        value={partyFit.providerName}
                        readOnly
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
                        value={leverageFactors.dealSize || session.dealValue}
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
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <p className="text-yellow-800 mb-4">Please select a provider to begin the assessment</p>
            {providers.length === 0 && (
              <p className="text-yellow-600 text-sm">No providers found for this session. Please check the session configuration.</p>
            )}
          </div>
        )}

        {/* ===== SECTION 10: ACTION BUTTONS ===== */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-4">
            {/* Primary Actions */}
            <div className="flex gap-4">
              {!assessmentComplete ? (
                <button
                  onClick={handleSubmitAssessment}
                  disabled={!selectedProvider}
                  className={`px-6 py-3 rounded-lg font-semibold ${
                    selectedProvider
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Complete Assessment
                </button>
              ) : (
                <>
                  <button
                    className="bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold cursor-not-allowed"
                    disabled
                  >
                    ✓ Assessment Complete
                  </button>
                  <button
                    onClick={() => {
                      console.log('Navigating to foundation with:', {
                        sessionId: session.sessionId,
                        providerId: selectedProvider?.providerId
                      })
                      router.push(`/auth/foundation?session=${session.sessionId}&provider=${selectedProvider?.providerId}`)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold animate-pulse"
                  >
                    Proceed to Phase 2: Foundation →
                  </button>
                </>
              )}
            </div>

            {/* Secondary Actions */}
            <div className="flex gap-4">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold"
                disabled
              >
                Draft Contract (Coming Soon)
              </button>
              <button
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold"
                disabled
              >
                Progress Report (Coming Soon)
              </button>
            </div>

            {/* Save Action */}
            <div className="flex justify-end">
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
    </div>
  )
}

// Wrapper component with Suspense boundary
export default function PreliminaryAssessment() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading assessment...</p>
        </div>
      </div>
    }>
      <PreliminaryAssessmentContent />
    </Suspense>
  )
}