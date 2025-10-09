'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
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
  
  // Use ref to track if providers have been loaded to prevent infinite loop
  const providersLoadedRef = useRef(false)
  const isLoadingRef = useRef(false)
  
  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [activeSection, setActiveSection] = useState<'profile' | 'fit' | 'leverage'>('profile')
  const [leverageScore, setLeverageScore] = useState({ customer: 65, provider: 35 })
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
    contractDuration: '24',
    industrySector: '',
    serviceType: '',
    partyFitScore: 0
  })

  // Define phases for progress indicator
  const phases = [
    { num: 1, name: 'Preliminary', active: true, complete: false },
    { num: 2, name: 'Foundation', active: false, complete: false },
    { num: 3, name: 'Gap Narrowing', active: false, complete: false },
    { num: 4, name: 'Complex Issues', active: false, complete: false },
    { num: 5, name: 'Commercial', active: false, complete: false },
    { num: 6, name: 'Final Review', active: false, complete: false }
  ]

// Party Fit Enhanced Data Structure
const [partyFitData, setPartyFitData] = useState({
  strategic: {
    industryMatch: '',
    deliveryModel: '',
    objectives: '',
    culturalFit: ''
  },
  capability: {
    geographic: '',
    language: '',
    technology: '',
    scalability: '',
    domains: [] as string[]
  },
  relationship: {
    communication: '',
    transparency: '',
    partnership: '',
    trust: 50
  },
  risk: {
    financial: '',
    security: '',
    compliance: '',
    lockin: '',
    redFlags: ''
  }
})

// Party Fit Scores
const [partyFitScores, setPartyFitScores] = useState({
  strategic: 0,
  capability: 0,
  relationship: 0,
  risk: 0
})

const [overallFitScore, setOverallFitScore] = useState(0)

// Helper function to update party fit data
const updatePartyFit = (category: string, field: string, value: any) => {
  setPartyFitData(prev => ({
    ...prev,
    [category]: {
      ...prev[category as keyof typeof prev],
      [field]: value
    }
  }))
  
  // Recalculate scores when data changes
  calculatePartyFitScores()
}

// Calculate party fit scores based on inputs
const calculatePartyFitScores = () => {
  // Strategic Score
  let strategicScore = 0
  if (partyFitData.strategic.industryMatch === 'exact') strategicScore += 30
  else if (partyFitData.strategic.industryMatch === 'adjacent') strategicScore += 20
  else if (partyFitData.strategic.industryMatch === 'similar') strategicScore += 10
  
  if (partyFitData.strategic.deliveryModel === 'perfect') strategicScore += 30
  else if (partyFitData.strategic.deliveryModel === 'good') strategicScore += 20
  else if (partyFitData.strategic.deliveryModel === 'moderate') strategicScore += 10
  
  if (partyFitData.strategic.culturalFit === 'excellent') strategicScore += 40
  else if (partyFitData.strategic.culturalFit === 'good') strategicScore += 30
  else if (partyFitData.strategic.culturalFit === 'fair') strategicScore += 15
  
  // Capability Score
  let capabilityScore = 0
  if (partyFitData.capability.geographic === 'full') capabilityScore += 25
  else if (partyFitData.capability.geographic === 'most') capabilityScore += 18
  else if (partyFitData.capability.geographic === 'partial') capabilityScore += 10
  
  if (partyFitData.capability.language === 'all') capabilityScore += 25
  else if (partyFitData.capability.language === 'most') capabilityScore += 18
  else if (partyFitData.capability.language === 'english') capabilityScore += 10
  
  if (partyFitData.capability.technology === 'same') capabilityScore += 25
  else if (partyFitData.capability.technology === 'compatible') capabilityScore += 18
  else if (partyFitData.capability.technology === 'different') capabilityScore += 10
  
  if (partyFitData.capability.scalability === 'excellent') capabilityScore += 25
  else if (partyFitData.capability.scalability === 'good') capabilityScore += 18
  else if (partyFitData.capability.scalability === 'moderate') capabilityScore += 10
  
  // Relationship Score
  let relationshipScore = 0
  if (partyFitData.relationship.communication === 'excellent') relationshipScore += 30
  else if (partyFitData.relationship.communication === 'good') relationshipScore += 20
  else if (partyFitData.relationship.communication === 'moderate') relationshipScore += 10
  
  if (partyFitData.relationship.transparency === 'full') relationshipScore += 30
  else if (partyFitData.relationship.transparency === 'high') relationshipScore += 20
  else if (partyFitData.relationship.transparency === 'moderate') relationshipScore += 10
  
  relationshipScore += (partyFitData.relationship.trust / 100) * 40
  
  // Risk Score (inverse - lower risk = higher score)
  let riskScore = 100
  if (partyFitData.risk.financial === 'weak') riskScore -= 30
  else if (partyFitData.risk.financial === 'moderate') riskScore -= 15
  else if (partyFitData.risk.financial === 'stable') riskScore -= 5
  
  if (partyFitData.risk.security === 'basic') riskScore -= 30
  else if (partyFitData.risk.security === 'developing') riskScore -= 15
  else if (partyFitData.risk.security === 'mature') riskScore -= 5
  
  if (partyFitData.risk.compliance === 'poor') riskScore -= 25
  else if (partyFitData.risk.compliance === 'mixed') riskScore -= 15
  else if (partyFitData.risk.compliance === 'good') riskScore -= 5
  
  if (partyFitData.risk.lockin === 'extreme') riskScore -= 15
  else if (partyFitData.risk.lockin === 'high') riskScore -= 10
  else if (partyFitData.risk.lockin === 'moderate') riskScore -= 5
  
  // Update scores
  setPartyFitScores({
    strategic: Math.round(strategicScore),
    capability: Math.round(capabilityScore),
    relationship: Math.round(relationshipScore),
    risk: Math.round(riskScore)
  })
  
  // Calculate overall score (weighted average)
  const overall = Math.round(
    (strategicScore * 0.3) + 
    (capabilityScore * 0.25) + 
    (relationshipScore * 0.25) + 
    (riskScore * 0.2)
  )
  setOverallFitScore(overall)
  
  // Update leverage factors with the party fit score
  setLeverageFactors(prev => ({
    ...prev,
    partyFitScore: overall
  }))
}

  // ========== SECTION 4: FUNCTIONS ==========
  // ========== REPLACE THE ENTIRE selectProvider FUNCTION WITH THIS ==========
  // This removes the unused loadingCapabilities state and its usage
  
  const selectProvider = async (provider: Provider) => {
    console.log('selectProvider called with:', provider)
    
    setSelectedProvider(provider)
    // Removed setLoadingCapabilities(true) - was unused
    
    // Pre-fill basic provider information in party fit
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
    
    // Get session ID - check multiple sources
    const currentSessionId = session?.sessionId || 
                           searchParams.get('session') || 
                           localStorage.getItem('currentSessionId')
    
    // Load detailed provider capabilities
    if (provider.providerId && currentSessionId) {
      console.log('Loading provider capabilities for:', provider.providerId)
      try {
        const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${currentSessionId}&provider_id=${provider.providerId}`
        console.log('Fetching capabilities from:', apiUrl)
        
        const response = await fetch(apiUrl)
        if (response.ok) {
          const result = await response.json()
          console.log('Capabilities response received')
          
          // Extract the data from the response structure
          let capabilityData = null
          
          if (Array.isArray(result) && result.length > 0) {
            capabilityData = result[0].data || result[0]
          } else if (result.data) {
            capabilityData = result.data
          } else {
            capabilityData = result
          }
          
          if (capabilityData) {
            // Update party fit with detailed provider information
            if (capabilityData.provider) {
              setPartyFit(prev => ({
                ...prev,
                providerName: capabilityData.provider.company || prev.providerName,
                providerEntity: capabilityData.provider.industry !== 'undefined' ? capabilityData.provider.industry : prev.providerEntity,
                providerAddress: capabilityData.provider.address || prev.providerAddress
              }))
            }
            
            // Update with company capabilities
            if (capabilityData.capabilities?.company) {
              const company = capabilityData.capabilities.company
              setPartyFit(prev => ({
                ...prev,
                providerEmployees: company.numberOfEmployees?.toString() || company.size || prev.providerEmployees,
                providerTurnover: company.annualRevenue || prev.providerTurnover,
                providerExperience: company.yearsInBusiness || prev.providerExperience
              }))
              
              if (company.notableClients) {
                setPartyFit(prev => ({
                  ...prev,
                  references: [company.notableClients]
                }))
              }
            }
            
            // Calculate leverage based on John's algorithm concepts
            if (capabilityData.leverage) {
              const customerLev = parseInt(capabilityData.leverage.customerLeverage) || 65
              const providerLev = parseInt(capabilityData.leverage.providerLeverage) || 35
              setLeverageScore({
                customer: customerLev,
                provider: providerLev
              })
            }
            
            // Update deal profile with service information
            if (capabilityData.capabilities?.services) {
              const services = capabilityData.capabilities.services
              setDealProfile(prev => ({
                ...prev,
                services: services.primary || prev.services || '',
                serviceLocations: services.geographicCoverage ? 
                  services.geographicCoverage.split(',').map((s: string) => s.trim()) : 
                  prev.serviceLocations
              }))
            }
            
            // Update leverage factors with commercial info
            if (capabilityData.capabilities?.commercial) {
              const commercial = capabilityData.capabilities.commercial
              
              if (commercial.rateMin && commercial.rateMax) {
                setDealProfile(prev => ({
                  ...prev,
                  pricingExpectation: `£${commercial.rateMin} - £${commercial.rateMax} per hour`
                }))
              }
            }
            
            // Store full capability data for reference
            localStorage.setItem(`provider_capabilities_${provider.providerId}`, JSON.stringify(capabilityData))
          }
        } else {
          console.error('Failed to load provider capabilities:', response.status)
        }
      } catch (error) {
        console.error('Error loading provider capabilities:', error)
      }
      // Removed finally block with setLoadingCapabilities(false)
    }
    // Removed else block with setLoadingCapabilities(false)
  }

    const loadProviders = useCallback(async (sessionId: string) => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current || providersLoadedRef.current) {
      console.log('Providers already loading or loaded, skipping...')
      return
    }
    
    isLoadingRef.current = true
    
    try {
      console.log('Loading providers for session:', sessionId)
      
      // For demo mode, use mock providers
      if (sessionId === 'demo-session') {
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
        providersLoadedRef.current = true
        return
      }

      // TEMPORARY: Use mock data while webhook is deactivated
      console.log('Using mock providers while webhook is deactivated')
      const mockProviders: Provider[] = [
        {
          providerId: '3f126f60-561a-4f14-a847-70ac8138fecd',
          providerName: 'TechFirst Solutions',
          providerTurnover: '£5M',
          providerEmployees: '48',
          providerExperience: '6-10 years'
        },
        {
          providerId: 'a266dd75-7d2e-4c57-afc6-2a5e1daed66e',
          providerName: 'Global Support Solutions Ltd',
          providerTurnover: '£15M',
          providerEmployees: '450',
          providerExperience: '15+ years'
        }
      ]
      setProviders(mockProviders)
      providersLoadedRef.current = true
      
      // Auto-select if only one provider
      if (mockProviders.length === 1) {
        selectProvider(mockProviders[0])
      }
      
      /* REACTIVATE WHEN WEBHOOK IS FIXED:
      const apiUrl = `https://spikeislandstudios.app.n8n.cloud/webhook/session-providers?session=${sessionId}`
      const response = await fetch(apiUrl)
      if (response.ok) {
        const data = await response.json()
        // Process providers data...
      }
      */
      
    } catch (error) {
      console.error('Error loading providers:', error)
    } finally {
      isLoadingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty dependency array - selectProvider creates circular dependency

  const loadSessionData = useCallback(async () => {
    try {
      let sessionId = searchParams.get('session')
      const providerId = searchParams.get('provider')
      
      console.log('Loading session data - sessionId:', sessionId)
      
      if (!sessionId) {
        const storedSessionId = localStorage.getItem('currentSessionId')
        const storedSession = localStorage.getItem('currentSession')
        
        if (storedSessionId && storedSession) {
          const sessionData = JSON.parse(storedSession)
          setSession(sessionData)
          setDealProfile(prev => ({
            ...prev,
            services: sessionData.serviceRequired || ''
          }))
          setLeverageFactors(prev => ({
            ...prev,
            dealSize: sessionData.dealValue || '',
            contractDuration: '24'
          }))
          sessionId = storedSessionId
        } else {
          // Demo mode
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
            dealSize: sessionData.dealValue || '',
            contractDuration: '24'
          }))
        }
      }

      if (providerId) {
        localStorage.setItem('selectedProviderId', providerId)
      }

      // Load providers ONLY ONCE
      if (sessionId && !providersLoadedRef.current) {
      await loadProviders(sessionId)
      }
      
    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, loadProviders])

  // John's leverage calculation algorithm
  const calculateLeverage = () => {
    // Base leverage from deal size
    const dealValue = parseInt(leverageFactors.dealSize.replace(/\D/g, '')) || 0
    let customerLeverage = 50
    
    // Deal size impact (larger deals = more customer leverage)
    if (dealValue > 5000000) customerLeverage += 15
    else if (dealValue > 2000000) customerLeverage += 10
    else if (dealValue > 1000000) customerLeverage += 5
    else if (dealValue < 250000) customerLeverage -= 10
    
    // Contract duration impact
    const duration = parseInt(leverageFactors.contractDuration) || 24
    if (duration > 36) customerLeverage += 10
    else if (duration > 24) customerLeverage += 5
    else if (duration < 12) customerLeverage -= 10
    
    // Party fit impact
    if (leverageFactors.partyFitScore > 80) customerLeverage += 5
    else if (leverageFactors.partyFitScore < 50) customerLeverage -= 5
    
    // Provider size impact (smaller provider = more customer leverage)
    const employees = parseInt(partyFit.providerEmployees) || 0
    if (employees < 50) customerLeverage += 10
    else if (employees < 200) customerLeverage += 5
    else if (employees > 1000) customerLeverage -= 10
    
    // Ensure bounds
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
    alert('Assessment submitted successfully!')
  }

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading assessment...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Session not found</p>
          <button
            onClick={() => router.push('/auth/contracts-dashboard')}
            className="mt-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== NAVIGATION - Updated to Slate theme ===== */}
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
              <span className="ml-4 text-slate-600 text-sm">Phase 1: Preliminary Assessment</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-slate-600 hover:text-slate-900 text-sm"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push(`/auth/chat?sessionId=${session?.sessionId || 'demo'}`)}
                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg text-sm"
              >
                💬 Chat with CLARENCE
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Contract Header - Updated to Slate */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-2">Preliminary Assessment</h1>
              <p className="text-slate-300 text-sm">Session: {session.sessionNumber || session.sessionId.substring(0, 8)}...</p>
              <p className="text-slate-300 text-sm">Service: {session.serviceRequired}</p>
              <p className="text-slate-300 text-sm">Deal Value: £{parseInt(session.dealValue || '0').toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Contract Phase</p>
              <p className="text-3xl font-medium">1 of 6</p>
            </div>
          </div>
        </div>

        {/* PHASE PROGRESS INDICATOR - PROMINENT PLACEMENT */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Contract Negotiation Progress</h3>
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm
                  ${phase.active ? 'bg-slate-700 text-white shadow-lg' : 
                    phase.complete ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {phase.complete ? '✓' : phase.num}
                </div>
                <span className="text-xs mt-1 text-slate-600">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 h-2 rounded-full transition-all duration-500" 
                 style={{ width: '16.66%' }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">Phase 1 of 6: Gathering initial requirements and assessing party fit</p>
        </div>

        {/* Provider Selection */}
        {providers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-medium mb-4 text-slate-800">
              {providers.length > 1 
                ? 'Select Provider to Assess' 
                : 'Provider for Assessment'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map(provider => (
                <button
                  key={provider.providerId}
                  onClick={() => selectProvider(provider)}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    selectedProvider?.providerId === provider.providerId
                      ? 'border-slate-600 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-800">{provider.providerName || 'Unknown Provider'}</div>
                  {provider.providerTurnover && (
                    <div className="text-sm text-slate-600">Turnover: {provider.providerTurnover}</div>
                  )}
                  {provider.providerEmployees && (
                    <div className="text-sm text-slate-600">Employees: {provider.providerEmployees}</div>
                  )}
                  <div className="mt-2 text-xs text-slate-600">
                    {selectedProvider?.providerId === provider.providerId
                      ? '✓ Currently Assessing' 
                      : 'Click to Assess'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assessment Sections */}
        {selectedProvider ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="border-b border-slate-200">
              <div className="flex">
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition
                    ${activeSection === 'profile' 
                      ? 'text-slate-700 border-slate-600' 
                      : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                >
                  Deal Profile
                </button>
                <button
                  onClick={() => setActiveSection('fit')}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition
                    ${activeSection === 'fit' 
                      ? 'text-slate-700 border-slate-600' 
                      : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                >
                  Party Fit
                </button>
                <button
                  onClick={() => setActiveSection('leverage')}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition
                    ${activeSection === 'leverage' 
                      ? 'text-slate-700 border-slate-600' 
                      : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                >
                  Leverage Assessment
                </button>
              </div>
            </div>

            <div className="p-8">
              {/* Deal Profile Section */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Deal Profile</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Services to be Delivered
                    </label>
                    <textarea
                      value={dealProfile.services}
                      onChange={(e) => setDealProfile({...dealProfile, services: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      rows={3}
                      placeholder="Describe the services..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Delivery Locations
                      </label>
                      <input
                        type="text"
                        value={dealProfile.deliveryLocations.join(', ')}
                        placeholder="e.g., UK, USA, Canada"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        onChange={(e) => setDealProfile({
                          ...dealProfile, 
                          deliveryLocations: e.target.value.split(',').map(s => s.trim())
                        })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Service Locations
                      </label>
                      <input
                        type="text"
                        value={dealProfile.serviceLocations.join(', ')}
                        placeholder="e.g., India, Philippines"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        onChange={(e) => setDealProfile({
                          ...dealProfile,
                          serviceLocations: e.target.value.split(',').map(s => s.trim())
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Preferred Pricing Approach
                      </label>
                      <select
                        value={dealProfile.pricingApproach}
                        onChange={(e) => setDealProfile({...dealProfile, pricingApproach: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      >
                        <option value="">Select approach...</option>
                        <option value="per-fte">Per FTE</option>
                        <option value="fixed-price">Fixed Price</option>
                        <option value="time-materials">Time & Materials</option>
                        <option value="outcome-based">Outcome Based</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Pricing Expectation
                      </label>
                      <input
                        type="text"
                        value={dealProfile.pricingExpectation}
                        onChange={(e) => setDealProfile({...dealProfile, pricingExpectation: e.target.value})}
                        placeholder="e.g., £50,000 per FTE"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Party Fit Section - Fixed field labels */}
{activeSection === 'fit' && (
  <div className="space-y-6">
    <h3 className="text-xl font-medium text-slate-900 mb-4">Party Fit Assessment</h3>
    
    {/* Introduction */}
    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
      <p className="text-sm text-blue-800">
        Evaluating alignment and compatibility between {selectedProvider?.providerName || 'provider'} and {session.customerCompany || 'customer'} 
        across strategic, capability, relationship, and risk dimensions.
      </p>
    </div>

    {/* Party Fit Score Overview */}
    <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-6 rounded-lg border border-slate-300 mb-6">
      <h4 className="font-medium text-slate-800 mb-4">Overall Party Fit Score</h4>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-700">{partyFitScores.strategic || 0}%</div>
          <div className="text-xs text-slate-600">Strategic Alignment</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-700">{partyFitScores.capability || 0}%</div>
          <div className="text-xs text-slate-600">Capability Match</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-700">{partyFitScores.relationship || 0}%</div>
          <div className="text-xs text-slate-600">Relationship Potential</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-700">{partyFitScores.risk || 0}%</div>
          <div className="text-xs text-slate-600">Risk Assessment</div>
        </div>
      </div>
      <div className="relative h-8 bg-white rounded-full overflow-hidden border border-slate-300">
        <div 
          className={`h-full transition-all duration-500 ${
            overallFitScore > 70 ? 'bg-green-500' : 
            overallFitScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${overallFitScore}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-2">
        <span>Poor Fit</span>
        <span className="font-medium">{overallFitScore}% Overall Fit</span>
        <span>Excellent Fit</span>
      </div>
    </div>

    {/* 1. Strategic Alignment */}
    <div className="bg-white p-6 rounded-lg border border-slate-200">
      <h4 className="font-medium text-slate-800 mb-4 flex items-center">
        <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm mr-3">1</span>
        Strategic Alignment
      </h4>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Industry Expertise Match</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.strategic.industryMatch}
            onChange={(e) => updatePartyFit('strategic', 'industryMatch', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="exact">Exact industry match</option>
            <option value="adjacent">Adjacent industry experience</option>
            <option value="similar">Similar industry characteristics</option>
            <option value="limited">Limited relevant experience</option>
            <option value="none">No industry experience</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Service Delivery Model Alignment</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.strategic.deliveryModel}
            onChange={(e) => updatePartyFit('strategic', 'deliveryModel', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="perfect">Perfect alignment</option>
            <option value="good">Good with minor adjustments</option>
            <option value="moderate">Moderate - requires adaptation</option>
            <option value="poor">Significant misalignment</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">Business Objectives Alignment</label>
        <textarea
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          rows={2}
          placeholder="How well do the provider's objectives align with your F&A transformation goals?"
          value={partyFitData.strategic.objectives}
          onChange={(e) => updatePartyFit('strategic', 'objectives', e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">Cultural Fit Assessment</label>
        <div className="flex gap-4">
          {['Poor', 'Fair', 'Good', 'Excellent'].map((level) => (
            <label key={level} className="flex items-center">
              <input
                type="radio"
                name="culturalFit"
                value={level.toLowerCase()}
                checked={partyFitData.strategic.culturalFit === level.toLowerCase()}
                onChange={(e) => updatePartyFit('strategic', 'culturalFit', e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">{level}</span>
            </label>
          ))}
        </div>
      </div>
    </div>

    {/* 2. Capability Match */}
    <div className="bg-white p-6 rounded-lg border border-slate-200">
      <h4 className="font-medium text-slate-800 mb-4 flex items-center">
        <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm mr-3">2</span>
        Capability Match
      </h4>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Geographic Coverage</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.capability.geographic}
            onChange={(e) => updatePartyFit('capability', 'geographic', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="full">Full coverage of required locations</option>
            <option value="most">Covers most required locations</option>
            <option value="partial">Partial coverage</option>
            <option value="limited">Limited coverage</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Language Capabilities</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.capability.language}
            onChange={(e) => updatePartyFit('capability', 'language', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="all">All required languages</option>
            <option value="most">Most required languages</option>
            <option value="english">English only</option>
            <option value="limited">Limited language support</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Technology Platform Compatibility</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.capability.technology}
            onChange={(e) => updatePartyFit('capability', 'technology', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="same">Same platforms we use</option>
            <option value="compatible">Compatible platforms</option>
            <option value="different">Different but adaptable</option>
            <option value="incompatible">Incompatible systems</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Scalability Assessment</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.capability.scalability}
            onChange={(e) => updatePartyFit('capability', 'scalability', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="excellent">Can scale up/down easily</option>
            <option value="good">Good scalability</option>
            <option value="moderate">Some limitations</option>
            <option value="poor">Limited scalability</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">F&A Domain Expertise</label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {['Accounts Payable', 'Accounts Receivable', 'General Ledger', 'Fixed Assets', 'Tax', 'Treasury'].map((domain) => (
            <label key={domain} className="flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={partyFitData.capability.domains?.includes(domain)}
                onChange={(e) => {
                  const domains = partyFitData.capability.domains || [];
                  if (e.target.checked) {
                    updatePartyFit('capability', 'domains', [...domains, domain]);
                  } else {
                    updatePartyFit('capability', 'domains', domains.filter(d => d !== domain));
                  }
                }}
              />
              <span className="text-sm">{domain}</span>
            </label>
          ))}
        </div>
      </div>
    </div>

    {/* 3. Relationship Potential */}
    <div className="bg-white p-6 rounded-lg border border-slate-200">
      <h4 className="font-medium text-slate-800 mb-4 flex items-center">
        <span className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm mr-3">3</span>
        Relationship Potential
      </h4>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Communication Style Compatibility</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.relationship.communication}
            onChange={(e) => updatePartyFit('relationship', 'communication', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="excellent">Highly compatible</option>
            <option value="good">Generally compatible</option>
            <option value="moderate">Some differences</option>
            <option value="poor">Significant differences</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Transparency Level</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.relationship.transparency}
            onChange={(e) => updatePartyFit('relationship', 'transparency', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="full">Fully transparent</option>
            <option value="high">High transparency</option>
            <option value="moderate">Moderate transparency</option>
            <option value="low">Limited transparency</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-600 mb-1">Partnership Approach</label>
        <textarea
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          rows={2}
          placeholder="Describe the provider's approach to partnership and collaboration"
          value={partyFitData.relationship.partnership}
          onChange={(e) => updatePartyFit('relationship', 'partnership', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Initial Trust Assessment</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={partyFitData.relationship.trust || 50}
            onChange={(e) => updatePartyFit('relationship', 'trust', e.target.value)}
            className="flex-1"
          />
          <span className="text-sm font-medium w-12 text-right">{partyFitData.relationship.trust || 50}%</span>
        </div>
      </div>
    </div>

    {/* 4. Risk Assessment */}
    <div className="bg-white p-6 rounded-lg border border-red-200">
      <h4 className="font-medium text-slate-800 mb-4 flex items-center">
        <span className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm mr-3">4</span>
        Risk Assessment
      </h4>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Financial Stability</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.risk.financial}
            onChange={(e) => updatePartyFit('risk', 'financial', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="strong">Strong financial position</option>
            <option value="stable">Stable</option>
            <option value="moderate">Some concerns</option>
            <option value="weak">Significant concerns</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Information Security Maturity</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.risk.security}
            onChange={(e) => updatePartyFit('risk', 'security', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="certified">ISO/SOC certified</option>
            <option value="mature">Mature practices</option>
            <option value="developing">Developing practices</option>
            <option value="basic">Basic security only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Compliance Track Record</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.risk.compliance}
            onChange={(e) => updatePartyFit('risk', 'compliance', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="excellent">Excellent track record</option>
            <option value="good">Generally compliant</option>
            <option value="mixed">Mixed record</option>
            <option value="poor">Compliance issues</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Vendor Lock-in Risk</label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
            value={partyFitData.risk.lockin}
            onChange={(e) => updatePartyFit('risk', 'lockin', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="low">Low - easy transition</option>
            <option value="moderate">Moderate</option>
            <option value="high">High - difficult to change</option>
            <option value="extreme">Extreme lock-in</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Red Flags or Concerns</label>
        <textarea
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
          rows={2}
          placeholder="Note any specific concerns or red flags identified"
          value={partyFitData.risk.redFlags}
          onChange={(e) => updatePartyFit('risk', 'redFlags', e.target.value)}
        />
      </div>
    </div>

    {/* Summary and Recommendations */}
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-300">
      <h4 className="font-medium text-slate-800 mb-3">Party Fit Summary</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Overall Fit Score:</span>
          <span className={`font-medium ${
            overallFitScore > 70 ? 'text-green-700' : 
            overallFitScore > 40 ? 'text-yellow-700' : 'text-red-700'
          }`}>
            {overallFitScore}% - {
              overallFitScore > 70 ? 'Strong Fit' : 
              overallFitScore > 40 ? 'Moderate Fit' : 'Poor Fit'
            }
          </span>
        </div>
        <div className="pt-2 border-t border-slate-300">
          <p className="text-slate-600">
            {overallFitScore > 70 
              ? 'This provider shows strong alignment with your requirements. Proceed with detailed negotiations.'
              : overallFitScore > 40
              ? 'This provider shows moderate fit. Consider addressing gaps before proceeding.'
              : 'Significant alignment issues identified. Consider alternative providers or major adjustments.'}
          </p>
        </div>
      </div>
    </div>
  </div>
)}

              {/* Leverage Assessment Section - Added Contract Duration */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Leverage Assessment</h3>
                  
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                    <p className="text-sm text-slate-600 mb-3">
                      Leverage calculation considers deal size, contract duration, party fit, and provider characteristics 
                      to determine negotiating power distribution.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Annual Contract Value
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., £2,000,000"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        value={leverageFactors.dealSize || session.dealValue}
                        onChange={(e) => setLeverageFactors({...leverageFactors, dealSize: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Contract Duration (months)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 36"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                        value={leverageFactors.contractDuration}
                        onChange={(e) => setLeverageFactors({...leverageFactors, contractDuration: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-100 p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium mb-4 text-slate-800">Calculated Leverage Distribution</h4>
                    <div className="mb-4">
                      <div className="text-sm text-slate-600 mb-2">Current Assessment:</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Deal Size: £{parseInt(leverageFactors.dealSize || '0').toLocaleString()}</div>
                        <div>Duration: {leverageFactors.contractDuration} months</div>
                        <div>Provider Size: {partyFit.providerEmployees || 'Unknown'} employees</div>
                        <div>Provider Experience: {partyFit.providerExperience || 'Not specified'}</div>
                      </div>
                    </div>
                    <div className="relative h-12 bg-white rounded-full overflow-hidden border border-slate-300">
                      <div 
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium"
                        style={{ width: `${leverageScore.customer}%` }}
                      >
                        Customer {leverageScore.customer}%
                      </div>
                      <div 
                        className="absolute right-0 top-0 h-full bg-slate-500 flex items-center justify-center text-white font-medium"
                        style={{ width: `${leverageScore.provider}%` }}
                      >
                        Provider {leverageScore.provider}%
                      </div>
                    </div>
                    <button
                      onClick={calculateLeverage}
                      className="mt-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Recalculate Leverage
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                      This leverage ratio will determine point allocation in negotiation phases.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <p className="text-yellow-800 mb-4">Please select a provider to begin the assessment</p>
          </div>
        )}

        {/* Action Buttons - Updated styling */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              {!assessmentComplete ? (
                <button
                  onClick={handleSubmitAssessment}
                  disabled={!selectedProvider}
                  className={`px-6 py-3 rounded-lg font-medium text-sm ${
                    selectedProvider
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Complete Assessment
                </button>
              ) : (
                <>
                  <button
                    className="bg-slate-400 text-white px-6 py-3 rounded-lg font-medium text-sm cursor-not-allowed"
                    disabled
                  >
                    ✓ Assessment Complete
                  </button>
                  <button
                    onClick={() => router.push(`/auth/foundation?session=${session.sessionId}&provider=${selectedProvider?.providerId}`)}
                    className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-lg font-medium text-sm animate-pulse"
                  >
                    Proceed to Phase 2: Foundation →
                  </button>
                </>
              )}
            </div>

            <div className="flex justify-end">
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
    </div>
  )
}

export default function PreliminaryAssessment() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading assessment...</p>
        </div>
      </div>
    }>
      <PreliminaryAssessmentContent />
    </Suspense>
  )
}