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

// ========== SECTION 2: MAIN COMPONENT ==========
function PreliminaryAssessmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const providersLoadedRef = useRef(false)
  const isLoadingRef = useRef(false)

  // ========== SECTION 3: STATE MANAGEMENT ==========
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [activeSection, setActiveSection] = useState<'profile' | 'fit' | 'leverage'>('profile')
  const [leverageScore, setLeverageScore] = useState({ customer: 65, provider: 35 })
  const [assessmentComplete, setAssessmentComplete] = useState(false)
  const [isAssessing, setIsAssessing] = useState(false)
  const [clarenceAssessments, setClarenceAssessments] = useState<Record<string, string>>({})

  // Deal Profile State
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

  // Leverage Factors State
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

  // Phases for progress indicator
  const phases = [
    { num: 1, name: 'Preliminary', active: true, complete: false },
    { num: 2, name: 'Foundation', active: false, complete: false },
    { num: 3, name: 'Gap Narrowing', active: false, complete: false },
    { num: 4, name: 'Complex Issues', active: false, complete: false },
    { num: 5, name: 'Commercial', active: false, complete: false },
    { num: 6, name: 'Final Review', active: false, complete: false }
  ]

  // ========== SECTION 4: HELPER FUNCTIONS ==========
  
  // Update party fit data
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
    // Calculate overall score based on individual scores
    const overall = Math.round(
      (partyFitScores.strategic * 0.3) +
      (partyFitScores.capability * 0.25) +
      (partyFitScores.relationship * 0.25) +
      (partyFitScores.risk * 0.2)
    )
    setOverallFitScore(Math.min(100, overall))
  }

  // Update leverage factor
  const updateLeverageFactor = (category: string, field: string, value: string) => {
    setLeverageFactors(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof AdvancedLeverageFactors],
        [field]: value
      }
    }))
  }

  // Calculate leverage based on algorithm
  const calculateAdvancedLeverage = () => {
    let customerScore = 50 // Start at neutral
    
    // Market Dynamics (25% weight)
    if (leverageFactors.marketDynamics.alternatives === 'many') customerScore += 8
    else if (leverageFactors.marketDynamics.alternatives === 'several') customerScore += 4
    else if (leverageFactors.marketDynamics.alternatives === 'few') customerScore -= 4
    else if (leverageFactors.marketDynamics.alternatives === 'sole') customerScore -= 10

    if (leverageFactors.marketDynamics.marketCondition === 'buyer') customerScore += 6
    else if (leverageFactors.marketDynamics.marketCondition === 'seller') customerScore -= 6

    if (leverageFactors.marketDynamics.customerTimePresure === 'urgent') customerScore -= 8
    else if (leverageFactors.marketDynamics.customerTimePresure === 'moderate') customerScore -= 3
    else if (leverageFactors.marketDynamics.customerTimePresure === 'relaxed') customerScore += 3

    // Economic Factors (25% weight)
    if (leverageFactors.economic.dealSizeRatio === 'minimal') customerScore += 5
    else if (leverageFactors.economic.dealSizeRatio === 'major') customerScore -= 8

    if (leverageFactors.economic.providerDependence === 'critical') customerScore += 10
    else if (leverageFactors.economic.providerDependence === 'important') customerScore += 5
    else if (leverageFactors.economic.providerDependence === 'tiny') customerScore -= 5

    if (leverageFactors.economic.switchingCosts === 'prohibitive') customerScore -= 10
    else if (leverageFactors.economic.switchingCosts === 'high') customerScore -= 5
    else if (leverageFactors.economic.switchingCosts === 'minimal') customerScore += 5

    // Strategic Position (25% weight)
    if (leverageFactors.strategic.serviceCriticality === 'mission-critical') customerScore -= 8
    else if (leverageFactors.strategic.serviceCriticality === 'non-core') customerScore += 5

    if (leverageFactors.strategic.providerInterest === 'critical') customerScore += 8
    else if (leverageFactors.strategic.providerInterest === 'low') customerScore -= 4

    // BATNA (25% weight)
    if (leverageFactors.batna.customerAlternative === 'strong') customerScore += 10
    else if (leverageFactors.batna.customerAlternative === 'none') customerScore -= 10

    if (leverageFactors.batna.providerPipeline === 'full') customerScore -= 8
    else if (leverageFactors.batna.providerPipeline === 'desperate') customerScore += 8

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

  // Load providers
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

  // Load session data
  const loadSessionData = useCallback(async () => {
    try {
      const sessionId = searchParams.get('session') || searchParams.get('session_id')
      
      if (sessionId) {
        await loadProviders(sessionId)
      }
      
      // Set demo session if no session found
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

  // Select provider
  const selectProvider = (provider: Provider) => {
    setSelectedProvider(provider)
    // Auto-populate some data
    setDealProfile(prev => ({
      ...prev,
      serviceCategory: 'it-services',
      totalValue: session?.dealValue || '500000'
    }))
  }

  // Submit assessment
  const handleSubmitAssessment = () => {
    if (!selectedProvider) {
      alert('Please select a provider')
      return
    }
    
    calculateAdvancedLeverage()
    setAssessmentComplete(true)
    
    const assessmentData = {
      sessionId: session?.sessionId,
      providerId: selectedProvider?.providerId,
      dealProfile,
      partyFitScores,
      overallFitScore,
      leverageScore,
      timestamp: new Date().toISOString()
    }
    
    localStorage.setItem(`assessment_${session?.sessionId}`, JSON.stringify(assessmentData))
    alert('Assessment complete!')
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

  // ========== SECTION 6: RENDER ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">Loading...</p>
      </div>
    )
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
              <span className="ml-4 text-slate-600 text-sm">Phase 1: Preliminary Assessment</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/auth/contracts-dashboard')}
                className="text-slate-600 hover:text-slate-900 text-sm"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-2">Preliminary Assessment</h1>
              <p className="text-slate-300 text-sm">Deal Value: £{parseInt(session?.dealValue || '0').toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Contract Phase</p>
              <p className="text-3xl font-medium">1 of 6</p>
            </div>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            {phases.map((phase) => (
              <div key={phase.num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm
                  ${phase.active ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {phase.num}
                </div>
                <span className="text-xs mt-1 text-slate-600">{phase.name}</span>
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 h-2 rounded-full" style={{ width: '16.66%' }}></div>
          </div>
        </div>

        {/* Provider Selection */}
        {providers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="text-lg font-medium mb-4 text-slate-800">Select Provider</h3>
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
                  <div className="text-sm text-slate-600">Turnover: {provider.providerTurnover}</div>
                  <div className="text-sm text-slate-600">Employees: {provider.providerEmployees}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assessment Sections */}
        {selectedProvider && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="border-b border-slate-200">
              <div className="flex">
                <button
                  onClick={() => setActiveSection('profile')}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition
                    ${activeSection === 'profile' ? 'text-slate-700 border-slate-600' : 'text-slate-500 border-transparent'}`}
                >
                  Deal Profile
                </button>
                <button
                  onClick={() => setActiveSection('fit')}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition
                    ${activeSection === 'fit' ? 'text-slate-700 border-slate-600' : 'text-slate-500 border-transparent'}`}
                >
                  Party Fit
                </button>
                <button
                  onClick={() => setActiveSection('leverage')}
                  className={`px-6 py-4 font-medium text-sm border-b-2 transition
                    ${activeSection === 'leverage' ? 'text-slate-700 border-slate-600' : 'text-slate-500 border-transparent'}`}
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
                  
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <label className="block text-sm font-medium text-purple-900 mb-2">Service Category</label>
                    <select
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white"
                      value={dealProfile.serviceCategory}
                      onChange={(e) => setDealProfile({ ...dealProfile, serviceCategory: e.target.value })}
                    >
                      <option value="">Select...</option>
                      <option value="it-services">IT Services</option>
                      <option value="customer-support">Customer Support</option>
                      <option value="financial-support">Financial Support</option>
                      <option value="hr-services">HR Services</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contract Duration</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={dealProfile.duration}
                        onChange={(e) => setDealProfile({ ...dealProfile, duration: e.target.value })}
                      >
                        <option value="12">12 months</option>
                        <option value="24">24 months</option>
                        <option value="36">36 months</option>
                        <option value="48">48 months</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Total Value</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={dealProfile.totalValue}
                        onChange={(e) => setDealProfile({ ...dealProfile, totalValue: e.target.value })}
                        placeholder="£500,000"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Party Fit Section */}
              {activeSection === 'fit' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Party Fit Assessment</h3>
                  
                  {/* Overall Score */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-4">Overall Fit Score</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-4 bg-white rounded-full overflow-hidden border border-purple-300">
                          <div 
                            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                            style={{ width: `${overallFitScore}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-purple-900">{overallFitScore}%</div>
                    </div>
                  </div>

                  {/* Strategic Alignment Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Strategic Alignment</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Score: <span className="text-purple-700 font-bold">{partyFitScores.strategic}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.strategic}
                        onChange={(e) => setPartyFitScores(prev => ({ ...prev, strategic: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Capability Score Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Capability Match</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Score: <span className="text-blue-700 font-bold">{partyFitScores.capability}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.capability}
                        onChange={(e) => setPartyFitScores(prev => ({ ...prev, capability: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Relationship Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Relationship Potential</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Score: <span className="text-green-700 font-bold">{partyFitScores.relationship}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.relationship}
                        onChange={(e) => setPartyFitScores(prev => ({ ...prev, relationship: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    
                    {/* Trust Slider */}
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Trust Level: <span className="text-green-700 font-bold">{partyFitData.relationship.trust}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitData.relationship.trust}
                        onChange={(e) => updatePartyFit('relationship', 'trust', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Risk Score Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Risk Mitigation</h4>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Score: <span className="text-red-700 font-bold">{partyFitScores.risk}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.risk}
                        onChange={(e) => setPartyFitScores(prev => ({ ...prev, risk: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Leverage Section */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Leverage Assessment</h3>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-900">
                      Algorithm-based calculation: 25% weight per category
                    </p>
                  </div>

                  {/* Market Dynamics */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4">Market Dynamics (25%)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alternatives</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.alternatives}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'alternatives', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="many">Many (10+)</option>
                          <option value="several">Several (5-9)</option>
                          <option value="few">Few (2-4)</option>
                          <option value="sole">Sole source</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Market</label>
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

                  {/* Leverage Score Display */}
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-6 rounded-lg border border-slate-300">
                    <h4 className="font-medium text-slate-800 mb-4">Calculated Leverage</h4>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-700">{leverageScore.customer}%</div>
                        <div className="text-sm text-slate-600">Customer</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {Math.floor(leverageScore.customer * 2)} negotiation points
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-700">{leverageScore.provider}%</div>
                        <div className="text-sm text-slate-600">Provider</div>
                        <div className="text-xs text-slate-500 mt-2">
                          {Math.floor(leverageScore.provider * 2)} negotiation points
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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
              <button
                onClick={() => router.push('/auth/foundation')}
                className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-6 py-3 rounded-lg font-medium text-sm"
              >
                Proceed to Phase 2 →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== SECTION 7: EXPORT ==========
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