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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customerRequirements, setCustomerRequirements] = useState<any>(null)


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
  const generateAssessmentPrompt = (type: string, data: Record<string, unknown>): string => {
    switch (type) {
      case 'party-fit-strategic':
        return `Assess strategic alignment between ${data.customerName} and ${data.providerName}`
      case 'leverage-market':
        return `Analyze market dynamics for ${data.serviceType} engagement`
      default:
        return `Provide assessment for ${type}`
    }
  }

  // Get CLARENCE Assessment (for future use)
  const runClarenceAssessment = async (assessmentType: string) => {
    try {
      const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/clarence-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assess',
          type: assessmentType,
          context: { session, provider: selectedProvider },
          prompt: generateAssessmentPrompt(assessmentType, {
            customerName: session?.customerCompany,
            providerName: selectedProvider?.providerName,
            serviceType: session?.serviceRequired
          })
        })
      })

      if (response.ok) {
        const result = await response.json()
        setClarenceAssessments(prev => ({
          ...prev,
          [assessmentType]: result.assessment || 'Assessment completed'
        }))
      }
    } catch {
      console.error('CLARENCE Assessment Error')
      // Use fallback assessment
      setClarenceAssessments(prev => ({
        ...prev,
        [assessmentType]: 'Moderate alignment detected based on initial analysis'
      }))
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

  console.log('customerRequirements object:', customerRequirements)
  console.log('serviceRequired path:', customerRequirements?.requirements?.serviceRequired)
  console.log('businessChallenge path:', customerRequirements?.requirements?.businessChallenge)

  const populateDealProfile = (capabilities: Record<string, unknown>, requirements: Record<string, unknown>, sessionData: Session | null) => {
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
      geographicCoverage: (capabilities?.geographicCoverage as string) || 'UK',
      complexity: (requirements?.complexity as string) || 'moderate',
      criticality: (requirements?.criticality as string) || 'important'
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

      // Run CLARENCE assessment if needed
      if (activeSection === 'fit') {
        runClarenceAssessment('party-fit-strategic')
      }
    } catch {
      console.error('Data integration error')
      populateDealProfile({}, {}, session)
    }
  }

  const loadProviders = useCallback(async (sessionId: string) => {
    if (isLoadingRef.current || providersLoadedRef.current) return

    isLoadingRef.current = true

    try {
      const response = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${sessionId}`
      )

      if (response.ok) {
        const result = await response.json()

        console.log('API Response:', result) // Debug log

        // The API returns data wrapped in a success object
        const providersArray = result.data ?
          (Array.isArray(result.data) ? result.data : [result.data]) :
          []

        if (providersArray.length > 0) {
          // FIX: Update mapping to use the actual structure returned by API
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedProviders = providersArray.map((p: any) => ({
            providerId: p.providerId || p.provider_id,
            providerName: p.provider?.company || p.capabilities?.company?.name || 'Unknown Provider', // FIXED PATH
            providerTurnover: p.capabilities?.company?.annualRevenue || 'Not specified',
            providerEmployees: p.capabilities?.company?.numberOfEmployees?.toString() || 'Not specified',
            providerExperience: p.capabilities?.company?.yearsInBusiness?.toString() + ' years' || 'Not specified'
          }))

          console.log('Mapped providers:', mappedProviders) // Debug log

          setProviders(mappedProviders)
          providersLoadedRef.current = true
          if (mappedProviders.length === 1) selectProvider(mappedProviders[0])
          isLoadingRef.current = false
          return
        }
      }
    } catch (error) {
      console.log('API failed:', error)
    }

    // Use mock data as fallback (keep your existing mock data)
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

    console.log('Using mock providers:', mockProviders) // Add logging

    setProviders(mockProviders)
    providersLoadedRef.current = true
    isLoadingRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessionData = useCallback(async () => {
    try {
      const sessionId = searchParams.get('session') || searchParams.get('session_id')

      if (sessionId) {
        // Load providers first
        await loadProviders(sessionId)

        // NEW: Load customer requirements with leverage data from API
        try {
          const requirementsResponse = await fetch(
            `https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session=${sessionId}`
          )

          if (requirementsResponse.ok) {
            const requirementsData = await requirementsResponse.json()

            setCustomerRequirements(requirementsData)

            console.log('✅ Customer requirements loaded:', requirementsData)

            // Extract and set leverage scores from API
            if (requirementsData.leverage) {
              const customerLev = requirementsData.leverage.customerLeveragePercentage || 65
              const providerLev = requirementsData.leverage.providerLeveragePercentage || 35

              setLeverageScore({
                customer: customerLev,
                provider: providerLev
              })

              console.log('✅ Leverage set from API:', { customer: customerLev, provider: providerLev })
            }

            // Set session data from API response
            const apiSession: Session = {
              sessionId: requirementsData.sessionId || sessionId,
              sessionNumber: requirementsData.sessionNumber,
              customerCompany: requirementsData.customer?.company || 'Customer',
              serviceRequired: requirementsData.requirements?.serviceRequired || 'Service',
              dealValue: requirementsData.requirements?.budget?.dealValue?.toString() || '0',
              status: requirementsData.metadata?.sessionStatus || 'initiated',
              phase: 1
            }
            setSession(apiSession)
            setLoading(false)
            return
          } else {
            console.log('⚠️ API returned error, using demo data')
          }
        } catch (apiError) {
          console.log('⚠️ API call failed, using demo data:', apiError)
        }
      }

      // Fallback demo session if API fails or no sessionId
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
      console.error('❌ Error in loadSessionData:', error)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyFitScores])

  useEffect(() => {
    const hasFactors = Object.values(leverageFactors.marketDynamics).some(v => v) ||
      Object.values(leverageFactors.economic).some(v => v)
    if (hasFactors) {
      calculateAdvancedLeverage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                  className={`p-4 border-2 rounded-lg text-left transition ${selectedProvider?.providerId === provider.providerId
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

              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Deal Profile & Requirements</h3>

                  {/* Service Overview Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Service Overview
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Service Required</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-blue-200">
                          {customerRequirements?.requirements?.serviceRequired || session?.serviceRequired || 'Not specified'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Deal Value</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-blue-200 font-semibold">
                          £{parseInt(customerRequirements?.requirements?.budget?.dealValue || session?.dealValue || '0').toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Contract Duration</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-blue-200">
                          {customerRequirements?.requirements?.team?.projectDurationMonths || '24'} months
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Service Criticality</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2">
                            <div className="text-sm">{customerRequirements?.requirements?.serviceCriticality || 'Important'}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(customerRequirements?.requirements?.serviceCriticality || 5) * 10}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-blue-800 mb-1">Business Challenge</label>
                      <div className="px-3 py-2 bg-white rounded-lg border border-blue-200 text-sm">
                        {customerRequirements?.requirements?.businessChallenge || 'Not specified'}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-blue-800 mb-1">Desired Outcome</label>
                      <div className="px-3 py-2 bg-white rounded-lg border border-blue-200 text-sm">
                        {customerRequirements?.requirements?.desiredOutcome || 'Not specified'}
                      </div>
                    </div>
                  </div>

                  {/* Operational Requirements Section */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Operational Requirements
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Team Size Required</label>
                        <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                          {customerRequirements?.requirements?.team?.minimumSize || '5'} - {customerRequirements?.requirements?.team?.maximumSize || '20'} FTEs
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Required Start Date</label>
                        <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                          {customerRequirements?.requirements?.team?.requiredStartDate ?
                            new Date(customerRequirements.requirements.team.requiredStartDate).toLocaleDateString() :
                            'ASAP'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Required Certifications</label>
                        <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex flex-wrap gap-1">
                            {(customerRequirements?.requirements?.technical?.requiredCertifications || ['ISO 27001', 'SOC2']).map((cert: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-slate-200 text-xs rounded-full">{cert}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Methodologies</label>
                        <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex flex-wrap gap-1">
                            {(customerRequirements?.requirements?.technical?.requiredMethodologies || ['Agile']).map((method: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-slate-200 text-xs rounded-full">{method}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Required Technologies</label>
                      <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                        {customerRequirements?.requirements?.technical?.requiredTechnologies?.join(', ') || 'Not specified'}
                      </div>
                    </div>
                  </div>

                  {/* Commercial Requirements Section */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Commercial Requirements
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-green-800 mb-1">Budget Range</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-green-200 font-semibold">
                          £{(customerRequirements?.requirements?.budget?.min || 400000).toLocaleString()} -
                          £{(customerRequirements?.requirements?.budget?.max || 600000).toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-green-800 mb-1">Pricing Model</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-green-200">
                          {customerRequirements?.requirements?.commercial?.preferredPricingModel || 'Time & Materials'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-green-800 mb-1">Payment Terms</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-green-200">
                          NET {customerRequirements?.requirements?.commercial?.paymentTermsRequired || '45'} days
                          {customerRequirements?.requirements?.commercial?.paymentTermsFlexibility === false &&
                            <span className="ml-2 text-xs text-red-600">(Non-negotiable)</span>
                          }
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-green-800 mb-1">Max Acceptable Rate</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-green-200">
                          {customerRequirements?.requirements?.commercial?.maximumAcceptableRate ?
                            `£${customerRequirements.requirements.commercial.maximumAcceptableRate}/day` :
                            'Open to negotiation'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk & Compliance Requirements Section */}
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Risk & Compliance Requirements
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-1">Minimum Liability Cap</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-red-200">
                          £{(customerRequirements?.requirements?.riskCompliance?.minimumLiabilityCap || 1000000).toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-1">Insurance Coverage</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-red-200">
                          £{(customerRequirements?.requirements?.riskCompliance?.minimumInsuranceCoverage || 5000000).toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-1">Response Time SLA</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-red-200">
                          ≤ {customerRequirements?.requirements?.riskCompliance?.maximumResponseTimeHours || '1'} hour(s)
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-1">Availability SLA</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-red-200">
                          ≥ {customerRequirements?.requirements?.riskCompliance?.minimumAvailabilityGuarantee || '99.5'}%
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-1">Data Location</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-red-200">
                          {customerRequirements?.requirements?.riskCompliance?.dataLocationRequirement || 'UK or EU only'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-red-800 mb-1">GDPR Audit</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-red-200">
                          {customerRequirements?.requirements?.riskCompliance?.gdprAuditRequired ?
                            <span className="text-green-700 font-medium">✓ Required</span> :
                            <span className="text-slate-600">Not required</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Strategic Context Section (for leverage) */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Strategic Context (Impacts Leverage)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-1">Alternative Providers</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-purple-200">
                          {customerRequirements?.leverage?.factors?.market?.alternativeProviders || '7'} available
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-1">Market Conditions</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-purple-200">
                          <span className="capitalize">{customerRequirements?.leverage?.factors?.market?.marketConditions?.replace('_', ' ') || "Buyer's Market"}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-1">Time Pressure</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full"
                                style={{ width: `${(customerRequirements?.leverage?.factors?.market?.timePressure || 5) * 10}%` }}
                              />
                            </div>
                            <span className="text-sm">{customerRequirements?.leverage?.factors?.market?.timePressure || '5'}/10</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-1">Walk-Away Point</label>
                        <div className="px-3 py-2 bg-white rounded-lg border border-purple-200 font-semibold">
                          £{(customerRequirements?.leverage?.factors?.batna?.notes || '850,000')}
                        </div>
                      </div>
                    </div>

                    {customerRequirements?.leverage && (
                      <div className="mt-4 p-3 bg-purple-100 rounded-lg">
                        <div className="text-sm text-purple-900">
                          <strong>Leverage Impact:</strong> Based on these factors, customer has {customerRequirements.leverage.customerLeveragePercentage}% leverage
                          ({customerRequirements.leverage.customerNegotiationPoints} negotiation points) versus providers {customerRequirements.leverage.providerLeveragePercentage}%
                          ({customerRequirements.leverage.providerNegotiationPoints} points).
                        </div>
                      </div>
                    )}
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

                    {clarenceAssessments['party-fit-strategic'] && (
                      <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-800">
                          <strong>CLARENCE Assessment:</strong> {clarenceAssessments['party-fit-strategic']}
                        </p>
                      </div>
                    )}
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

              {/* ========== SECTION 15: LEVERAGE CONTENT (COMPLETE 4-CATEGORY) ========== */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Advanced Leverage Assessment</h3>

                  {/* Introduction */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 mb-6">
                    <p className="text-sm text-purple-900">
                      This assessment determines the negotiating power balance using 4 key categories.
                      The leverage ratio directly impacts how many priority points each party receives to allocate across contract clauses.
                    </p>
                  </div>

                  {/* Leverage Score Display */}
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border border-slate-300">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-800">Negotiation Power Balance</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${leverageScore.customer >= 55
                        ? 'bg-blue-100 text-blue-700'
                        : leverageScore.customer >= 45
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-green-100 text-green-700'
                        }`}>
                        {leverageScore.customer >= 55
                          ? 'Customer Advantage'
                          : leverageScore.customer >= 45
                            ? 'Balanced Position'
                            : 'Provider Advantage'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-4">
                      {leverageScore.customer >= 60
                        ? 'Customer has strong negotiating position. Can push for favorable terms across most contract clauses.'
                        : leverageScore.customer >= 40
                          ? 'Relatively balanced negotiation expected. Success will depend on negotiation skill and compromise.'
                          : 'Provider has stronger leverage. Customer should focus on protecting critical requirements.'}
                    </p>

                    {/* Visual Leverage Bar */}
                    <div className="relative h-14 bg-white rounded-lg overflow-hidden border-2 border-slate-300 mb-4">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-start px-3 text-white font-medium transition-all duration-700 ease-out"
                        style={{ width: `${leverageScore.customer}%` }}
                      >
                        <span>Customer {leverageScore.customer}%</span>
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full bg-gradient-to-l from-green-500 to-green-600 flex items-center justify-end px-3 text-white font-medium transition-all duration-700 ease-out"
                        style={{ width: `${leverageScore.provider}%` }}
                      >
                        <span>Provider {leverageScore.provider}%</span>
                      </div>
                    </div>

                    {/* Point Allocation Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-700">{leverageScore.customer * 2}</div>
                          <div className="text-sm text-blue-600">Customer Points</div>
                          <div className="text-xs text-blue-500 mt-1">For prioritizing contract clauses</div>
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-700">{leverageScore.provider * 2}</div>
                          <div className="text-sm text-green-600">Provider Points</div>
                          <div className="text-xs text-green-500 mt-1">For prioritizing contract clauses</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CATEGORY 1: Market Dynamics */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                      Market Dynamics (25% weight)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alternative Providers Available</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.alternatives}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'alternatives', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="many">Many (10+ qualified providers)</option>
                          <option value="several">Several (5-9 providers)</option>
                          <option value="few">Few (2-4 providers)</option>
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
                          <option value="buyer">Strong buyer&apos;s market</option>
                          <option value="balanced">Balanced market</option>
                          <option value="seller">Strong seller&apos;s market</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Customer Time Pressure</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.customerTimePresure}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'customerTimePresure', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="urgent">Urgent (need decision within weeks)</option>
                          <option value="moderate">Moderate (1-3 months)</option>
                          <option value="relaxed">Relaxed (3+ months)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Provider Capacity</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.providerCapacity}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'providerCapacity', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="eager">Eager for business</option>
                          <option value="available">Available capacity</option>
                          <option value="constrained">Capacity constrained</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CATEGORY 2: Economic Factors */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                      Economic Factors (25% weight)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Deal Size Relative to Customer Budget</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.dealSizeRatio}
                          onChange={(e) => updateLeverageFactor('economic', 'dealSizeRatio', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="minimal">Minimal (&lt;2% of IT budget)</option>
                          <option value="moderate">Moderate (2-10% of budget)</option>
                          <option value="significant">Significant (10-25% of budget)</option>
                          <option value="major">Major (&gt;25% of budget)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Provider Dependence on This Deal</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.providerDependence}
                          onChange={(e) => updateLeverageFactor('economic', 'providerDependence', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="critical">Critical (&gt;15% of provider revenue)</option>
                          <option value="important">Important (5-15% of revenue)</option>
                          <option value="small">Small (1-5% of revenue)</option>
                          <option value="tiny">Tiny (&lt;1% of revenue)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Switching Costs</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.switchingCosts}
                          onChange={(e) => updateLeverageFactor('economic', 'switchingCosts', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="minimal">Minimal (easy to switch)</option>
                          <option value="moderate">Moderate (some disruption)</option>
                          <option value="high">High (significant cost/time)</option>
                          <option value="prohibitive">Prohibitive (near impossible)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Budget Flexibility</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.budgetFlexibility}
                          onChange={(e) => updateLeverageFactor('economic', 'budgetFlexibility', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="flexible">Flexible (can adjust budget)</option>
                          <option value="moderate">Moderate flexibility</option>
                          <option value="fixed">Fixed (hard budget limit)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CATEGORY 3: Strategic Position */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                      Strategic Position (25% weight)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Service Criticality</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.strategic.serviceCriticality}
                          onChange={(e) => updateLeverageFactor('strategic', 'serviceCriticality', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="mission-critical">Mission-critical (business stops without it)</option>
                          <option value="business-critical">Business-critical (major impact)</option>
                          <option value="important">Important (noticeable impact)</option>
                          <option value="non-core">Non-core (minimal impact)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Provider&apos;s Strategic Interest</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.strategic.providerInterest}
                          onChange={(e) => updateLeverageFactor('strategic', 'providerInterest', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="critical">Critical (must-win deal)</option>
                          <option value="high">High interest (want this deal)</option>
                          <option value="moderate">Moderate interest</option>
                          <option value="low">Low interest (take it or leave it)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Incumbent Advantage</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.strategic.incumbentAdvantage}
                          onChange={(e) => updateLeverageFactor('strategic', 'incumbentAdvantage', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="none">No incumbent / New service</option>
                          <option value="weak">Weak incumbent advantage</option>
                          <option value="moderate">Moderate advantage</option>
                          <option value="strong">Strong incumbent advantage</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reputational Value</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.strategic.reputationalValue}
                          onChange={(e) => updateLeverageFactor('strategic', 'reputationalValue', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="minimal">Minimal (standard reference)</option>
                          <option value="moderate">Moderate (good reference)</option>
                          <option value="significant">Significant (strong brand value)</option>
                          <option value="transformational">Transformational (game-changing reference)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CATEGORY 4: BATNA Analysis */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm mr-3">4</span>
                      BATNA - Best Alternative to Negotiated Agreement (25% weight)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Customer&apos;s Best Alternative</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.batna.customerAlternative}
                          onChange={(e) => updateLeverageFactor('batna', 'customerAlternative', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="strong">Strong alternative (credible Plan B)</option>
                          <option value="moderate">Moderate alternative (acceptable fallback)</option>
                          <option value="weak">Weak alternative (poor fallback)</option>
                          <option value="none">No alternative (must do this deal)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Provider&apos;s Pipeline Strength</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.batna.providerPipeline}
                          onChange={(e) => updateLeverageFactor('batna', 'providerPipeline', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="full">Full pipeline (can walk away)</option>
                          <option value="healthy">Healthy pipeline (other options)</option>
                          <option value="light">Light pipeline (need this deal)</option>
                          <option value="desperate">Desperate (must win this deal)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Algorithm Explanation */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-amber-900">How CLARENCE Uses This</p>
                        <p className="text-xs text-amber-700 mt-1">
                          All 4 categories (Market Dynamics, Economic Factors, Strategic Position, BATNA) are equally weighted at 25% each.
                          The algorithm calculates the leverage percentage, which determines negotiation point allocation. During contract negotiation,
                          each party uses their points to prioritize which clauses matter most. CLARENCE then calculates optimal compromise positions
                          based on these priorities and the leverage balance.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={calculateAdvancedLeverage}
                    className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-3 rounded-lg font-medium"
                  >
                    Recalculate Leverage
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <p className="text-yellow-800 mb-4">Please select a provider to begin the assessment</p>
          </div>
        )}

        {/* ========== SECTION 16: ACTION BUTTONS (INTEGRATED) ========== */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => router.push('/auth/contracts-dashboard')}
            className="text-slate-600 hover:text-slate-900 font-medium text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Save & Return to Dashboard
          </button>

          <div className="flex gap-3">
            {!assessmentComplete ? (
              <button
                onClick={handleSubmitAssessment}
                disabled={!selectedProvider}
                className={`px-6 py-3 rounded-lg font-medium text-sm shadow-sm transition ${selectedProvider
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
              >
                Complete Assessment & Continue
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium text-sm">Assessment Complete</span>
                </div>
                <button
                  onClick={() => router.push(`/auth/foundation?session=${session?.sessionId}&provider=${selectedProvider?.providerId}`)}
                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-lg font-medium text-sm shadow-sm flex items-center gap-2"
                >
                  Proceed to Phase 2: Foundation ({Math.floor(leverageScore.customer * 2)} points)
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
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