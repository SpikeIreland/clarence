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

interface UniversalDealProfile {
  serviceCategory: string
  engagementModel: string
  duration: string
  totalValue: string
  pricingModel: string
  serviceDescription: string
  scaleIndicator: string
  geographicCoverage: string
  complexity: string
  criticality: string
  serviceLevelRequirement: string
  transitionTimeline: string
  kpis: string
  businessDrivers: string[]
  successCriteria: string
}

interface PartyFitData {
  strategic: {
    industryMatch: string
    deliveryModel: string
    objectives: string
    culturalFit: string
  }
  capability: {
    geographic: string
    language: string
    technology: string
    scalability: string
    domains: string[]
  }
  relationship: {
    communication: string
    transparency: string
    partnership: string
    trust: number
  }
  risk: {
    financial: string
    security: string
    compliance: string
    lockin: string
    redFlags: string
  }
}

interface AdvancedLeverageFactors {
  marketDynamics: {
    alternatives: string
    marketCondition: string
    customerTimePresure: string
    providerCapacity: string
  }
  economic: {
    dealSizeRatio: string
    providerDependence: string
    switchingCosts: string
    budgetFlexibility: string
  }
  strategic: {
    serviceCriticality: string
    providerInterest: string
    incumbentAdvantage: string
    reputationalValue: string
  }
  batna: {
    customerAlternative: string
    providerPipeline: string
  }
}

// ========== SECTION 2: MAIN COMPONENT START ==========
function PreliminaryAssessmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [isAssessing, setIsAssessing] = useState(false)
  const [clarenceAssessments, setClarenceAssessments] = useState<Record<string, string>>({})

  // Universal Deal Profile State
  const [dealProfile, setDealProfile] = useState<UniversalDealProfile>({
    serviceCategory: '',
    engagementModel: '',
    duration: '36',
    totalValue: '',
    pricingModel: '',
    serviceDescription: '',
    scaleIndicator: '',
    geographicCoverage: '',
    complexity: '',
    criticality: '',
    serviceLevelRequirement: '',
    transitionTimeline: '',
    kpis: '',
    businessDrivers: [],
    successCriteria: ''
  })

  // Party Fit Data State
  const [partyFitData, setPartyFitData] = useState<PartyFitData>({
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
      domains: []
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

  // Party Fit Scores with sliders
  const [partyFitScores, setPartyFitScores] = useState({
    strategic: 50,
    capability: 50,
    relationship: 50,
    risk: 50
  })

  const [overallFitScore, setOverallFitScore] = useState(50)

  // Advanced Leverage Factors State
  const [leverageFactors, setLeverageFactors] = useState<AdvancedLeverageFactors>({
    marketDynamics: {
      alternatives: '',
      marketCondition: '',
      customerTimePresure: '',
      providerCapacity: ''
    },
    economic: {
      dealSizeRatio: '',
      providerDependence: '',
      switchingCosts: '',
      budgetFlexibility: ''
    },
    strategic: {
      serviceCriticality: '',
      providerInterest: '',
      incumbentAdvantage: '',
      reputationalValue: ''
    },
    batna: {
      customerAlternative: '',
      providerPipeline: ''
    }
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

  // ========== SECTION 4: HELPER FUNCTIONS ==========

  // Generate assessment prompt for CLARENCE
  const generateAssessmentPrompt = (type: string, data: any): string => {
    switch (type) {
      case 'party-fit-strategic':
        return `Assess strategic alignment between ${data.customerName} and ${data.providerName}`
      case 'leverage-market':
        return `Analyze market dynamics for ${data.serviceType} engagement`
      default:
        return `Provide assessment for ${type}`
    }
  }

  // Get CLARENCE AI Assessment
  const getClarenceAssessment = async (
    assessmentType: string,
    data: any
  ): Promise<any> => {
    setIsAssessing(true)
    try {
      const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/clarence-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assess',
          type: assessmentType,
          context: data,
          prompt: generateAssessmentPrompt(assessmentType, data)
        })
      })

      if (!response.ok) throw new Error(`Assessment failed: ${response.status}`)
      
      const result = await response.json()
      setClarenceAssessments(prev => ({
        ...prev,
        [assessmentType]: result.assessment || 'Assessment completed'
      }))
      
      return result
    } catch (error) {
      console.error('CLARENCE Assessment Error:', error)
      // Fallback mock assessment
      const mockAssessment = {
        score: Math.floor(Math.random() * 30) + 60,
        assessment: 'Moderate alignment detected'
      }
      setClarenceAssessments(prev => ({
        ...prev,
        [assessmentType]: mockAssessment.assessment
      }))
      return mockAssessment
    } finally {
      setIsAssessing(false)
    }
  }

  // Update party fit data helper
  const updatePartyFit = (category: string, field: string, value: string | number | string[]) => {
    setPartyFitData(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: value
      }
    }))
    setTimeout(() => calculatePartyFitScores(), 100)
  }

  // Calculate party fit scores
  const calculatePartyFitScores = () => {
    // Strategic Score calculation
    let strategicScore = partyFitScores.strategic
    if (partyFitData.strategic.industryMatch === 'exact') strategicScore = Math.min(100, strategicScore + 10)
    else if (partyFitData.strategic.industryMatch === 'adjacent') strategicScore = Math.min(100, strategicScore + 5)

    // Capability Score calculation  
    let capabilityScore = partyFitScores.capability
    if (partyFitData.capability.geographic === 'full') capabilityScore = Math.min(100, capabilityScore + 10)
    
    // Relationship Score includes trust
    let relationshipScore = (partyFitData.relationship.trust / 100) * 40
    if (partyFitData.relationship.communication === 'excellent') relationshipScore += 30
    
    // Risk Score (inverse)
    let riskScore = 100
    if (partyFitData.risk.financial === 'weak') riskScore -= 30

    // Calculate overall score
    const overall = Math.round(
      (strategicScore * 0.3) +
      (capabilityScore * 0.25) +
      (relationshipScore * 0.25) +
      (riskScore * 0.2)
    )
    setOverallFitScore(Math.min(100, overall))
  }

  // Update leverage factor helper
  const updateLeverageFactor = (category: string, field: string, value: string) => {
    setLeverageFactors(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof AdvancedLeverageFactors],
        [field]: value
      }
    }))
  }

  // Advanced leverage calculation (aligned with algorithm document)
  const calculateAdvancedLeverage = () => {
    let customerScore = 50 // Start at neutral
    
    // Market Dynamics Impact (25% weight)
    if (leverageFactors.marketDynamics.alternatives === 'many') customerScore += 8
    else if (leverageFactors.marketDynamics.alternatives === 'several') customerScore += 4
    else if (leverageFactors.marketDynamics.alternatives === 'few') customerScore -= 4
    else if (leverageFactors.marketDynamics.alternatives === 'sole') customerScore -= 10

    if (leverageFactors.marketDynamics.marketCondition === 'buyer') customerScore += 6
    else if (leverageFactors.marketDynamics.marketCondition === 'seller') customerScore -= 6

    if (leverageFactors.marketDynamics.customerTimePresure === 'urgent') customerScore -= 8
    else if (leverageFactors.marketDynamics.customerTimePresure === 'moderate') customerScore -= 3
    else if (leverageFactors.marketDynamics.customerTimePresure === 'relaxed') customerScore += 3

    // Economic Factors Impact (25% weight)
    if (leverageFactors.economic.dealSizeRatio === 'minimal') customerScore += 5
    else if (leverageFactors.economic.dealSizeRatio === 'major') customerScore -= 8

    if (leverageFactors.economic.providerDependence === 'critical') customerScore += 10
    else if (leverageFactors.economic.providerDependence === 'important') customerScore += 5
    else if (leverageFactors.economic.providerDependence === 'tiny') customerScore -= 5

    // Strategic Position Impact (25% weight)
    if (leverageFactors.strategic.serviceCriticality === 'mission-critical') customerScore -= 8
    else if (leverageFactors.strategic.serviceCriticality === 'non-core') customerScore += 5

    // BATNA Impact (25% weight)
    if (leverageFactors.batna.customerAlternative === 'strong') customerScore += 10
    else if (leverageFactors.batna.customerAlternative === 'none') customerScore -= 10

    // Include Party Fit Score
    if (overallFitScore > 70) customerScore += 5
    else if (overallFitScore < 40) customerScore -= 5

    // Normalize to 0-100 range
    customerScore = Math.max(20, Math.min(80, customerScore))

    // Update leverage scores
    setLeverageScore({
      customer: Math.round(customerScore),
      provider: Math.round(100 - customerScore)
    })

    // Store for algorithm use
    const leverageDetails = {
      score: customerScore,
      pointAllocation: {
        customer: Math.floor(customerScore * 2),
        provider: Math.floor((100 - customerScore) * 2)
      }
    }
    localStorage.setItem('leverageCalculation', JSON.stringify(leverageDetails))
  }

  // Auto-populate Deal Profile from data
  const populateDealProfile = (capabilities: any, requirements: any, sessionData: any) => {
    console.log('Auto-populating Deal Profile...')
    
    const serviceType = sessionData?.serviceRequired?.toLowerCase() || ''
    let category = 'it-services'
    
    if (serviceType.includes('customer')) category = 'customer-support'
    else if (serviceType.includes('financ')) category = 'financial-support'
    
    setDealProfile(prev => ({
      ...prev,
      serviceCategory: category,
      totalValue: sessionData?.dealValue || prev.totalValue,
      serviceDescription: sessionData?.serviceRequired || prev.serviceDescription,
      geographicCoverage: capabilities?.geographicCoverage || 'UK',
      complexity: requirements?.complexity || 'moderate',
      criticality: requirements?.criticality || 'important'
    }))
  }

  // Enhanced select provider with data integration
  const selectProvider = async (provider: Provider) => {
    console.log('Loading provider data...', provider)
    setSelectedProvider(provider)
    
    const sessionId = session?.sessionId || searchParams.get('session')
    
    try {
      // Try to load capabilities
      const capResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${sessionId}&provider_id=${provider.providerId}`
      )
      const capabilities = capResponse.ok ? await capResponse.json() : {}
      
      // Try to load requirements
      const reqResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sessionId}`
      )
      const requirements = reqResponse.ok ? await reqResponse.json() : {}
      
      populateDealProfile(capabilities, requirements, session)
    } catch (error) {
      console.error('Data integration error:', error)
      populateDealProfile({}, {}, session)
    }
  }

  const loadProviders = useCallback(async (sessionId: string) => {
    if (isLoadingRef.current || providersLoadedRef.current) return
    
    isLoadingRef.current = true
    
    try {
      // Try API first
      const response = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/providers-api?session_id=${sessionId}`
      )
      
      if (response.ok) {
        const data = await response.json()
        if (data && data.length > 0) {
          setProviders(data)
          providersLoadedRef.current = true
          if (data.length === 1) selectProvider(data[0])
          return
        }
      }
    } catch (error) {
      console.log('API failed, using mock data')
    }
    
    // Use mock data as fallback
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
    isLoadingRef.current = false
  }, [])

  const loadSessionData = useCallback(async () => {
    try {
      const sessionId = searchParams.get('session') || searchParams.get('session_id')
      
      if (sessionId) {
        await loadProviders(sessionId)
      }
      
      // Set demo session
      const demoSession: Session = {
        sessionId: sessionId || 'demo-session',
        customerCompany: 'Demo Customer Ltd',
        serviceRequired: 'IT Consulting Services',
        dealValue: '500000',
        status: 'initiated',
        phase: 1
      }
      setSession(demoSession)
      
    } catch (error) {
      console.error('Error loading session:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, loadProviders])

  const handleSubmitAssessment = async () => {
    if (!selectedProvider) {
      alert('Please select a provider')
      return
    }
    
    calculateAdvancedLeverage()
    
    const assessmentData = {
      sessionId: session?.sessionId,
      providerId: selectedProvider?.providerId,
      timestamp: new Date().toISOString(),
      dealProfile,
      partyFitData,
      partyFitScores,
      overallFitScore,
      leverageFactors,
      leverageScore,
      clarenceAssessments
    }
    
    localStorage.setItem(`assessment_${session?.sessionId}_${selectedProvider?.providerId}`, JSON.stringify(assessmentData))
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

  useEffect(() => {
    calculatePartyFitScores()
  }, [partyFitScores])

  useEffect(() => {
    const hasFactors = Object.values(leverageFactors.marketDynamics).some(v => v) ||
                      Object.values(leverageFactors.economic).some(v => v)
    if (hasFactors) {
      calculateAdvancedLeverage()
    }
  }, [leverageFactors])

  // ========== SECTION 6: LOADING STATE ==========
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

  // ========== SECTION 7: MAIN RENDER ==========
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ========== SECTION 8: NAVIGATION BAR ========== */}
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
        {/* ========== SECTION 9: CONTRACT HEADER ========== */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-2">Preliminary Assessment</h1>
              <p className="text-slate-300 text-sm">Service: {session?.serviceRequired}</p>
              <p className="text-slate-300 text-sm">Deal Value: £{parseInt(session?.dealValue || '0').toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Contract Phase</p>
              <p className="text-3xl font-medium">1 of 6</p>
            </div>
          </div>
        </div>

        {/* ========== SECTION 10: PHASE PROGRESS INDICATOR ========== */}
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
        </div>

        {/* ========== SECTION 11: PROVIDER SELECTION ========== */}
        {providers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-medium mb-4 text-slate-800">
              {providers.length > 1 ? 'Select Provider to Assess' : 'Provider for Assessment'}
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
                  <div className="font-medium text-slate-800">{provider.providerName}</div>
                  {provider.providerTurnover && (
                    <div className="text-sm text-slate-600">Turnover: {provider.providerTurnover}</div>
                  )}
                  {provider.providerEmployees && (
                    <div className="text-sm text-slate-600">Employees: {provider.providerEmployees}</div>
                  )}
                  <div className="mt-2 text-xs text-slate-600">
                    {selectedProvider?.providerId === provider.providerId
                      ? '✓ Currently Assessing' : 'Click to Assess'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ========== SECTION 12: ASSESSMENT TABS ========== */}
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
              {/* ========== SECTION 13: DEAL PROFILE CONTENT ========== */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Deal Profile</h3>

                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <label className="block text-sm font-medium text-purple-900 mb-2">Service Category</label>
                    <select
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white"
                      value={dealProfile.serviceCategory}
                      onChange={(e) => setDealProfile({ ...dealProfile, serviceCategory: e.target.value })}
                    >
                      <option value="">Select service type...</option>
                      <option value="customer-support">Customer Support</option>
                      <option value="technical-support">Technical Support</option>
                      <option value="it-services">IT Services</option>
                      <option value="financial-support">Financial Support (F&A)</option>
                      <option value="hr-services">HR Services</option>
                    </select>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-3">Contract Overview</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Engagement Model</label>
                        <select
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white"
                          value={dealProfile.engagementModel}
                          onChange={(e) => setDealProfile({ ...dealProfile, engagementModel: e.target.value })}
                        >
                          <option value="">Select model...</option>
                          <option value="full-outsource">Full Outsourcing</option>
                          <option value="co-managed">Co-Managed Service</option>
                          <option value="staff-augmentation">Staff Augmentation</option>
                          <option value="managed-service">Managed Service</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Contract Duration</label>
                        <select
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white"
                          value={dealProfile.duration}
                          onChange={(e) => setDealProfile({ ...dealProfile, duration: e.target.value })}
                        >
                          <option value="12">12 months</option>
                          <option value="24">24 months</option>
                          <option value="36">36 months</option>
                          <option value="48">48 months</option>
                          <option value="60">60 months</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Total Contract Value</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white"
                          placeholder="e.g., £2,000,000"
                          value={dealProfile.totalValue}
                          onChange={(e) => setDealProfile({ ...dealProfile, totalValue: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Pricing Model</label>
                        <select
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white"
                          value={dealProfile.pricingModel}
                          onChange={(e) => setDealProfile({ ...dealProfile, pricingModel: e.target.value })}
                        >
                          <option value="">Select pricing...</option>
                          <option value="fixed-price">Fixed Price</option>
                          <option value="time-materials">Time & Materials</option>
                          <option value="per-fte">Per FTE</option>
                          <option value="per-transaction">Per Transaction</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-3">Scope & Scale</h4>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Service Description</label>
                      <textarea
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        rows={3}
                        placeholder="Describe the services required..."
                        value={dealProfile.serviceDescription}
                        onChange={(e) => setDealProfile({ ...dealProfile, serviceDescription: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========== SECTION 14: PARTY FIT CONTENT ========== */}
              {activeSection === 'fit' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Party Fit Assessment</h3>

                  {/* Overall Fit Score Display */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-4">Overall Party Fit Score</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-4 bg-white rounded-full overflow-hidden border border-purple-300">
                          <div 
                            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                            style={{ width: `${overallFitScore}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-purple-700 mt-1">
                          <span>Poor Fit</span>
                          <span>Moderate</span>
                          <span>Strong Fit</span>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-purple-900">
                        {overallFitScore}%
                      </div>
                    </div>
                  </div>

                  {/* Strategic Alignment with Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">1. Strategic Alignment</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Strategic Score: <span className="text-purple-700 font-bold">{partyFitScores.strategic}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.strategic}
                        onChange={(e) => {
                          setPartyFitScores(prev => ({ ...prev, strategic: parseInt(e.target.value) }))
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Industry Match</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={partyFitData.strategic.industryMatch}
                          onChange={(e) => updatePartyFit('strategic', 'industryMatch', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="exact">Exact industry match</option>
                          <option value="adjacent">Adjacent industry</option>
                          <option value="similar">Similar industry</option>
                          <option value="limited">Limited experience</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Cultural Fit</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={partyFitData.strategic.culturalFit}
                          onChange={(e) => updatePartyFit('strategic', 'culturalFit', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="poor">Poor</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Capability with Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">2. Capability Match</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Capability Score: <span className="text-blue-700 font-bold">{partyFitScores.capability}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.capability}
                        onChange={(e) => {
                          setPartyFitScores(prev => ({ ...prev, capability: parseInt(e.target.value) }))
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Relationship with Trust Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">3. Relationship Potential</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Relationship Score: <span className="text-green-700 font-bold">{partyFitScores.relationship}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.relationship}
                        onChange={(e) => {
                          setPartyFitScores(prev => ({ ...prev, relationship: parseInt(e.target.value) }))
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Initial Trust: <span className="text-green-700 font-bold">{partyFitData.relationship.trust}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitData.relationship.trust}
                        onChange={(e) => updatePartyFit('relationship', 'trust', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Risk with Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">4. Risk Assessment</h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Risk Mitigation Score: <span className="text-red-700 font-bold">{partyFitScores.risk}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.risk}
                        onChange={(e) => {
                          setPartyFitScores(prev => ({ ...prev, risk: parseInt(e.target.value) }))
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========== SECTION 15: LEVERAGE CONTENT ========== */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Advanced Leverage Assessment</h3>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-900">
                      Algorithm-based calculation: Each factor category has 25% weight. 
                      Point allocation: Customer gets X*2 points, Provider gets Y*2 points.
                    </p>
                  </div>

                  {/* Market Dynamics (25%) */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Market Dynamics (25% weight)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alternative Providers</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.alternatives}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'alternatives', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="many">Many (10+ providers)</option>
                          <option value="several">Several (5-9)</option>
                          <option value="few">Few (2-4)</option>
                          <option value="sole">Sole source</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Market Conditions</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.marketCondition}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'marketCondition', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="buyer">Buyer's market</option>
                          <option value="balanced">Balanced</option>
                          <option value="seller">Seller's market</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Economic Factors (25%) */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Economic Factors (25% weight)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Deal Size Ratio</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.dealSizeRatio}
                          onChange={(e) => updateLeverageFactor('economic', 'dealSizeRatio', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="minimal">Minimal (&lt;1%)</option>
                          <option value="small">Small (1-5%)</option>
                          <option value="significant">Significant (5-10%)</option>
                          <option value="major">Major (&gt;10%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Provider Dependence</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.providerDependence}
                          onChange={(e) => updateLeverageFactor('economic', 'providerDependence', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="tiny">Tiny</option>
                          <option value="small">Small</option>
                          <option value="important">Important</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Leverage Score */}
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-6 rounded-lg border border-slate-300">
                    <h4 className="font-medium text-slate-800 mb-4">Calculated Leverage Distribution</h4>
                    
                    <div className="grid grid-cols-2 gap-8 mb-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-700">{leverageScore.customer}%</div>
                        <div className="text-sm text-slate-600">Customer Leverage</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {Math.floor(leverageScore.customer * 2)} negotiation points
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-700">{leverageScore.provider}%</div>
                        <div className="text-sm text-slate-600">Provider Leverage</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {Math.floor(leverageScore.provider * 2)} negotiation points
                        </div>
                      </div>
                    </div>

                    <div className="relative h-16 bg-white rounded-lg overflow-hidden border border-slate-300">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium"
                        style={{ width: `${leverageScore.customer}%` }}
                      >
                        {leverageScore.customer}%
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full bg-gradient-to-l from-green-500 to-green-600 flex items-center justify-center text-white font-medium"
                        style={{ width: `${leverageScore.provider}%` }}
                      >
                        {leverageScore.provider}%
                      </div>
                    </div>

                    <button
                      onClick={calculateAdvancedLeverage}
                      className="mt-4 w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Recalculate Leverage Score
                    </button>
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

        {/* ========== SECTION 16: ACTION BUTTONS ========== */}
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
                    onClick={() => router.push(`/auth/foundation?session=${session?.sessionId}&provider=${selectedProvider?.providerId}`)}
                    className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-lg font-medium text-sm"
                  >
                    Proceed to Phase 2: Foundation ({Math.floor(leverageScore.customer * 2)} points) →
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

// ========== SECTION 17: MAIN EXPORT WITH SUSPENSE ==========
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