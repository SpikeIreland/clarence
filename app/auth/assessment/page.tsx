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

  // Party Fit Data State with sliders
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

  // CLARENCE Assessment States
  const [clarenceAssessments, setClarenceAssessments] = useState<Record<string, string>>({})
  const [isAssessing, setIsAssessing] = useState(false)

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
        return `Assess the strategic alignment between ${data.customerName} requiring ${data.serviceType} 
                and ${data.providerName} offering ${data.providerServices}. 
                Consider industry match, delivery model compatibility, and cultural fit. 
                Return scores for: industryMatch, deliveryModel, objectives, culturalFit.`

      case 'party-fit-capability':
        return `Evaluate ${data.providerName}'s capability to deliver ${data.serviceType} for ${data.customerName}.
                Provider has ${data.employees} employees, operates in ${data.locations}, 
                uses ${data.technology} systems. Customer needs ${data.requirements}.
                Return scores for: geographic, language, technology, scalability.`

      case 'party-fit-risk':
        return `Assess risks in engaging ${data.providerName} for ${data.serviceType}.
                Provider: ${data.employees} employees, ${data.yearsInBusiness} years in business,
                Revenue: ${data.revenue}. Service criticality: ${data.criticality}.
                Return risk assessment for: financial, security, compliance, lockin.`

      case 'leverage-market':
        return `Analyze market dynamics for ${data.serviceType} engagement.
                Deal size: ${data.dealValue}, Market: ${data.location}, 
                Timeline: ${data.timeline}, Providers available: ${data.providerCount}.
                Return assessment of: alternatives, marketCondition, timePresure, providerCapacity.`

      case 'leverage-strategic':
        return `Evaluate strategic leverage factors.
                Service: ${data.serviceType} (${data.criticality} criticality),
                Customer: ${data.customerRevenue} revenue, ${data.customerSize} size,
                Provider interest level based on deal size ${data.dealValue} vs their revenue ${data.providerRevenue}.
                Return: serviceCriticality, providerInterest, incumbentAdvantage, reputationalValue.`

      default:
        return `Provide assessment for ${type} with context: ${JSON.stringify(data)}`
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'assess',
          type: assessmentType,
          context: data,
          prompt: generateAssessmentPrompt(assessmentType, data)
        })
      })

      if (!response.ok) {
        throw new Error(`Assessment failed: ${response.status}`)
      }

      const result = await response.json()
      
      // Store CLARENCE's assessment
      setClarenceAssessments(prev => ({
        ...prev,
        [assessmentType]: result.assessment || 'Assessment completed'
      }))
      
      return result
    } catch (error) {
      console.error('CLARENCE Assessment Error:', error)
      // Fallback to mock assessment
      const mockAssessment = {
        score: Math.floor(Math.random() * 30) + 60,
        recommendation: 'Based on the analysis, this appears to be a moderate fit with room for improvement.',
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

    // Recalculate scores when data changes
    setTimeout(() => calculatePartyFitScores(), 100)
  }

  // Calculate party fit scores
  const calculatePartyFitScores = () => {
    // Strategic Score
    let strategicScore = partyFitScores.strategic // Start with slider value
    if (partyFitData.strategic.industryMatch === 'exact') strategicScore = Math.min(100, strategicScore + 10)
    else if (partyFitData.strategic.industryMatch === 'adjacent') strategicScore = Math.min(100, strategicScore + 5)

    if (partyFitData.strategic.deliveryModel === 'perfect') strategicScore = Math.min(100, strategicScore + 10)
    else if (partyFitData.strategic.deliveryModel === 'good') strategicScore = Math.min(100, strategicScore + 5)

    if (partyFitData.strategic.culturalFit === 'excellent') strategicScore = Math.min(100, strategicScore + 15)
    else if (partyFitData.strategic.culturalFit === 'good') strategicScore = Math.min(100, strategicScore + 10)

    // Capability Score
    let capabilityScore = partyFitScores.capability // Start with slider value
    if (partyFitData.capability.geographic === 'full') capabilityScore = Math.min(100, capabilityScore + 10)
    else if (partyFitData.capability.geographic === 'most') capabilityScore = Math.min(100, capabilityScore + 5)

    if (partyFitData.capability.technology === 'same') capabilityScore = Math.min(100, capabilityScore + 10)
    else if (partyFitData.capability.technology === 'compatible') capabilityScore = Math.min(100, capabilityScore + 5)

    // Relationship Score includes trust slider
    let relationshipScore = (partyFitData.relationship.trust / 100) * 40
    if (partyFitData.relationship.communication === 'excellent') relationshipScore += 30
    else if (partyFitData.relationship.communication === 'good') relationshipScore += 20

    if (partyFitData.relationship.transparency === 'full') relationshipScore += 30
    else if (partyFitData.relationship.transparency === 'high') relationshipScore += 20

    // Risk Score (inverse - lower risk = higher score)
    let riskScore = 100
    if (partyFitData.risk.financial === 'weak') riskScore -= 30
    else if (partyFitData.risk.financial === 'moderate') riskScore -= 15

    if (partyFitData.risk.security === 'basic') riskScore -= 30
    else if (partyFitData.risk.security === 'developing') riskScore -= 15

    // Update scores
    setPartyFitScores({
      strategic: Math.round(Math.min(100, strategicScore)),
      capability: Math.round(Math.min(100, capabilityScore)),
      relationship: Math.round(Math.min(100, relationshipScore)),
      risk: Math.round(Math.max(0, riskScore))
    })

    // Calculate overall score (weighted average)
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
    let factorsAnalyzed = 0

    // Market Dynamics Impact (25% weight as per algorithm)
    if (leverageFactors.marketDynamics.alternatives === 'many') {
      customerScore += 8
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.alternatives === 'several') {
      customerScore += 4
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.alternatives === 'few') {
      customerScore -= 4
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.alternatives === 'sole') {
      customerScore -= 10
      factorsAnalyzed++
    }

    if (leverageFactors.marketDynamics.marketCondition === 'buyer') {
      customerScore += 6
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.marketCondition === 'seller') {
      customerScore -= 6
      factorsAnalyzed++
    }

    if (leverageFactors.marketDynamics.customerTimePresure === 'urgent') {
      customerScore -= 8
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.customerTimePresure === 'moderate') {
      customerScore -= 3
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.customerTimePresure === 'relaxed') {
      customerScore += 3
      factorsAnalyzed++
    }

    if (leverageFactors.marketDynamics.providerCapacity === 'constrained') {
      customerScore -= 6
      factorsAnalyzed++
    } else if (leverageFactors.marketDynamics.providerCapacity === 'eager') {
      customerScore += 6
      factorsAnalyzed++
    }

    // Economic Factors Impact (25% weight)
    if (leverageFactors.economic.dealSizeRatio === 'minimal') {
      customerScore += 5
      factorsAnalyzed++
    } else if (leverageFactors.economic.dealSizeRatio === 'major') {
      customerScore -= 8
      factorsAnalyzed++
    }

    if (leverageFactors.economic.providerDependence === 'critical') {
      customerScore += 10
      factorsAnalyzed++
    } else if (leverageFactors.economic.providerDependence === 'important') {
      customerScore += 5
      factorsAnalyzed++
    } else if (leverageFactors.economic.providerDependence === 'tiny') {
      customerScore -= 5
      factorsAnalyzed++
    }

    if (leverageFactors.economic.switchingCosts === 'prohibitive') {
      customerScore -= 10
      factorsAnalyzed++
    } else if (leverageFactors.economic.switchingCosts === 'high') {
      customerScore -= 5
      factorsAnalyzed++
    } else if (leverageFactors.economic.switchingCosts === 'minimal') {
      customerScore += 5
      factorsAnalyzed++
    }

    // Strategic Position Impact (25% weight)
    if (leverageFactors.strategic.serviceCriticality === 'mission-critical') {
      customerScore -= 8
      factorsAnalyzed++
    } else if (leverageFactors.strategic.serviceCriticality === 'non-core') {
      customerScore += 5
      factorsAnalyzed++
    }

    if (leverageFactors.strategic.providerInterest === 'critical') {
      customerScore += 8
      factorsAnalyzed++
    } else if (leverageFactors.strategic.providerInterest === 'low') {
      customerScore -= 4
      factorsAnalyzed++
    }

    // BATNA Impact (25% weight)
    if (leverageFactors.batna.customerAlternative === 'strong') {
      customerScore += 10
      factorsAnalyzed++
    } else if (leverageFactors.batna.customerAlternative === 'none') {
      customerScore -= 10
      factorsAnalyzed++
    }

    if (leverageFactors.batna.providerPipeline === 'full') {
      customerScore -= 8
      factorsAnalyzed++
    } else if (leverageFactors.batna.providerPipeline === 'desperate') {
      customerScore += 8
      factorsAnalyzed++
    }

    // Include Party Fit Score if available
    if (overallFitScore > 0) {
      if (overallFitScore > 70) {
        customerScore += 5
      } else if (overallFitScore < 40) {
        customerScore -= 5
      }
    }

    // Normalize to 0-100 range and ensure bounds
    customerScore = Math.max(20, Math.min(80, customerScore))

    // Update leverage scores
    setLeverageScore({
      customer: Math.round(customerScore),
      provider: Math.round(100 - customerScore)
    })

    // Store detailed calculation for algorithm use
    const leverageDetails = {
      score: customerScore,
      factorsAnalyzed: factorsAnalyzed,
      pointAllocation: {
        customer: Math.floor(customerScore * 2), // As per algorithm: X*2 points
        provider: Math.floor((100 - customerScore) * 2) // Y*2 points
      }
    }

    console.log('Leverage Calculation Details:', leverageDetails)
    localStorage.setItem('leverageCalculation', JSON.stringify(leverageDetails))
  }

  // Auto-populate Deal Profile from data
  const populateDealProfile = (capabilities: any, requirements: any, sessionData: any) => {
    console.log('Auto-populating Deal Profile...')

    const serviceType = sessionData?.serviceRequired?.toLowerCase() || ''
    let category = 'other'

    if (serviceType.includes('customer') || serviceType.includes('support')) {
      category = 'customer-support'
    } else if (serviceType.includes('technical') || serviceType.includes('it')) {
      category = 'it-services'
    } else if (serviceType.includes('financ') || serviceType.includes('f&a')) {
      category = 'financial-support'
    } else if (serviceType.includes('hr') || serviceType.includes('human')) {
      category = 'hr-services'
    }

    setDealProfile(prev => ({
      ...prev,
      serviceCategory: category,
      totalValue: sessionData?.dealValue || prev.totalValue,
      serviceDescription: sessionData?.serviceRequired || prev.serviceDescription,
      geographicCoverage: capabilities?.capabilities?.services?.geographicCoverage || 'UK',
      scaleIndicator: capabilities?.capabilities?.company?.size || '100-500 employees',
      complexity: requirements?.complexity || 'moderate',
      criticality: requirements?.criticality || 'important',
      serviceLevelRequirement: requirements?.slaRequirement || 'standard',
      transitionTimeline: requirements?.timeline || 'standard',
      kpis: requirements?.keyMetrics?.join(', ') || 'Response time, Quality score, Customer satisfaction',
      businessDrivers: requirements?.drivers || ['Cost Reduction', 'Quality Improvement'],
      successCriteria: requirements?.successCriteria || 'Successful transition with maintained service levels'
    }))
  }

  // Auto-populate Party Fit with AI assistance
  const populatePartyFitWithAI = async (provider: any, capabilities: any, requirements: any) => {
    console.log('Getting AI assessment for Party Fit...')

    const assessmentData = {
      customerName: session?.customerCompany,
      customerRequirements: requirements,
      providerName: provider.providerName,
      providerCapabilities: capabilities,
      serviceType: session?.serviceRequired,
      dealValue: session?.dealValue
    }

    // Get strategic alignment assessment
    const strategicAssessment = await getClarenceAssessment('party-fit-strategic', assessmentData)
    if (strategicAssessment) {
      setPartyFitData(prev => ({
        ...prev,
        strategic: {
          industryMatch: strategicAssessment.industryMatch || 'adjacent',
          deliveryModel: strategicAssessment.deliveryModel || 'good',
          objectives: strategicAssessment.objectives || 'Aligned on key transformation goals',
          culturalFit: strategicAssessment.culturalFit || 'good'
        }
      }))
    }

    calculatePartyFitScores()
  }

  // Enhanced select provider with data integration
  const selectProvider = async (provider: Provider) => {
    console.log('Loading comprehensive provider data...', provider)
    setSelectedProvider(provider)

    const sessionId = session?.sessionId || searchParams.get('session')

    try {
      // Load Provider Capabilities (with fallback)
      const capabilitiesResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${sessionId}&provider_id=${provider.providerId}`
      )
      const capabilities = capabilitiesResponse.ok ? await capabilitiesResponse.json() : {}

      // Load Customer Requirements (with fallback)
      const requirementsResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sessionId}`
      )
      const requirements = requirementsResponse.ok ? await requirementsResponse.json() : {}

      // Auto-populate all sections
      populateDealProfile(capabilities, requirements, session)
      await populatePartyFitWithAI(provider, capabilities, requirements)

    } catch (error) {
      console.error('Data integration error:', error)
      // Use fallback data
      populateDealProfile({}, {}, session)
    }
  }

  const loadProviders = useCallback(async (sessionId: string) => {
    if (isLoadingRef.current || providersLoadedRef.current) {
      console.log('Providers already loading or loaded, skipping...')
      return
    }

    isLoadingRef.current = true

    try {
      console.log('Loading providers for session:', sessionId)

      // Try to fetch from API first
      try {
        const response = await fetch(
          `https://spikeislandstudios.app.n8n.cloud/webhook/providers-api?session_id=${sessionId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        )

        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            setProviders(data)
            providersLoadedRef.current = true
            if (data.length === 1) {
              selectProvider(data[0])
            }
            return
          }
        }
      } catch (apiError) {
        console.log('API call failed, using mock data:', apiError)
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

    } catch (error) {
      console.error('Error loading providers:', error)
    } finally {
      isLoadingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessionData = useCallback(async () => {
    try {
      let sessionId = searchParams.get('session') || searchParams.get('session_id')
      const providerId = searchParams.get('provider') || searchParams.get('provider_id')

      console.log('Loading session data - sessionId:', sessionId)

      if (!sessionId) {
        const storedSessionId = localStorage.getItem('currentSessionId')
        const storedSession = localStorage.getItem('currentSession')

        if (storedSessionId && storedSession) {
          const sessionData = JSON.parse(storedSession)
          setSession(sessionData)
          setDealProfile(prev => ({
            ...prev,
            serviceDescription: sessionData.serviceRequired || '',
            totalValue: sessionData.dealValue || ''
          }))
          sessionId = storedSessionId
        }
      }

      if (sessionId && !providersLoadedRef.current) {
        await loadProviders(sessionId)
      }

      if (providerId) {
        localStorage.setItem('selectedProviderId', providerId)
      }

    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, loadProviders])

  const handleSubmitAssessment = async () => {
    if (!session || !selectedProvider) {
      alert('Please select a provider before completing the assessment')
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
      clarenceAssessments,
      clarenceRecommendations: {
        partyFitSummary: overallFitScore > 70 ? 'Strong fit - proceed with confidence' :
          overallFitScore > 40 ? 'Moderate fit - address gaps before proceeding' :
            'Poor fit - consider alternatives',
        leverageSummary: leverageScore.customer > 60 ? 'Customer has strong negotiating position' :
          leverageScore.customer > 40 ? 'Balanced negotiating position' :
            'Provider has stronger position - manage expectations',
        nextSteps: 'Proceed to Phase 2: Foundation Drafting with allocated negotiation points'
      }
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

  // Auto-calculate leverage when factors change
  useEffect(() => {
    const hasFactors = Object.values(leverageFactors.marketDynamics).some(v => v) ||
                      Object.values(leverageFactors.economic).some(v => v) ||
                      Object.values(leverageFactors.strategic).some(v => v) ||
                      Object.values(leverageFactors.batna).some(v => v)
    
    if (hasFactors) {
      calculateAdvancedLeverage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leverageFactors])

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ========== SECTION 7: NAVIGATION ========== */}
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
        {/* ========== SECTION 8: CONTRACT HEADER ========== */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-6 rounded-xl mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-2">Preliminary Assessment</h1>
              <p className="text-slate-300 text-sm">Service: {session?.serviceRequired || 'IT Services'}</p>
              <p className="text-slate-300 text-sm">Deal Value: £{parseInt(session?.dealValue || '500000').toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Contract Phase</p>
              <p className="text-3xl font-medium">1 of 6</p>
            </div>
          </div>
        </div>

        {/* ========== SECTION 9: PHASE PROGRESS INDICATOR ========== */}
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

        {/* ========== SECTION 10: PROVIDER SELECTION ========== */}
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
                  className={`p-4 border-2 rounded-lg text-left transition ${selectedProvider?.providerId === provider.providerId
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

        {/* ========== SECTION 11: ASSESSMENT SECTIONS ========== */}
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
              {/* ========== SECTION 12: DEAL PROFILE CONTENT ========== */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Deal Profile</h3>

                  {/* Service Type Selector */}
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-6">
                    <label className="block text-sm font-medium text-purple-900 mb-2">Service Category</label>
                    <select
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white"
                      value={dealProfile.serviceCategory}
                      onChange={(e) => setDealProfile({ ...dealProfile, serviceCategory: e.target.value })}
                    >
                      <option value="">Select service type...</option>
                      <option value="customer-support">Customer Support</option>
                      <option value="technical-support">Technical Support</option>
                      <option value="data-processing">Data Processing</option>
                      <option value="financial-support">Financial Support (F&A)</option>
                      <option value="hr-services">HR Services</option>
                      <option value="it-services">IT Services</option>
                      <option value="legal-process">Legal Process Outsourcing</option>
                      <option value="other">Other Services</option>
                    </select>
                  </div>

                  {/* Contract Overview */}
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
                          <option value="project-based">Project Based</option>
                          <option value="managed-service">Managed Service</option>
                          <option value="hybrid">Hybrid Model</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-1">Contract Duration</label>
                        <select
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white"
                          value={dealProfile.duration}
                          onChange={(e) => setDealProfile({ ...dealProfile, duration: e.target.value })}
                        >
                          <option value="">Select duration...</option>
                          <option value="6">6 months</option>
                          <option value="12">12 months</option>
                          <option value="24">24 months</option>
                          <option value="36">36 months</option>
                          <option value="48">48 months</option>
                          <option value="60">60 months</option>
                          <option value="60+">More than 5 years</option>
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
                          <option value="outcome-based">Outcome Based</option>
                          <option value="hybrid-pricing">Hybrid Pricing</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Scope & Scale */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-3">Scope & Scale</h4>

                    <div className="space-y-4">
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
                </div>
              )}

              {/* ========== SECTION 13: PARTY FIT CONTENT WITH SLIDERS ========== */}
              {activeSection === 'fit' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-medium text-slate-900">Party Fit Assessment</h3>
                    {isAssessing && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                        CLARENCE is assessing...
                      </div>
                    )}
                  </div>

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

                  {/* 1. Strategic Alignment with Sliders */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                      Strategic Alignment
                    </h4>

                    {/* Strategic Score Slider */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Strategic Alignment Score: <span className="text-purple-700 font-bold">{partyFitScores.strategic}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitScores.strategic}
                        onChange={(e) => {
                          setPartyFitScores(prev => ({ ...prev, strategic: parseInt(e.target.value) }))
                          setTimeout(() => calculatePartyFitScores(), 100)
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${partyFitScores.strategic}%, #e2e8f0 ${partyFitScores.strategic}%, #e2e8f0 100%)`
                        }}
                      />
                    </div>

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
                  </div>

                  {/* 2. Capability Match with Sliders */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                      Capability Match
                    </h4>

                    {/* Capability Score Slider */}
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
                          setTimeout(() => calculatePartyFitScores(), 100)
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${partyFitScores.capability}%, #e2e8f0 ${partyFitScores.capability}%, #e2e8f0 100%)`
                        }}
                      />
                    </div>
                  </div>

                  {/* 3. Relationship Potential with Trust Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                      Economic Factors (25% weight)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Deal Size vs Customer Revenue</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.dealSizeRatio}
                          onChange={(e) => updateLeverageFactor('economic', 'dealSizeRatio', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="minimal">Minimal (&lt; 1% of revenue)</option>
                          <option value="small">Small (1-5% of revenue)</option>
                          <option value="significant">Significant (5-10% of revenue)</option>
                          <option value="major">Major (&gt; 10% of revenue)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Deal Size vs Provider Revenue</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.providerDependence}
                          onChange={(e) => updateLeverageFactor('economic', 'providerDependence', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="tiny">Tiny (&lt; 1% of provider revenue)</option>
                          <option value="small">Small (1-5% of provider revenue)</option>
                          <option value="important">Important (5-15% of provider revenue)</option>
                          <option value="critical">Critical (&gt; 15% of provider revenue)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Switching Costs for Customer</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.economic.switchingCosts}
                          onChange={(e) => updateLeverageFactor('economic', 'switchingCosts', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="minimal">Minimal</option>
                          <option value="moderate">Moderate</option>
                          <option value="high">High</option>
                          <option value="prohibitive">Prohibitive</option>
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
                          <option value="fixed">Fixed budget</option>
                          <option value="limited">Limited flexibility</option>
                          <option value="moderate">Moderate flexibility</option>
                          <option value="flexible">Very flexible</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Strategic Position (25% weight) */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                      Strategic Position (25% weight)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Service Criticality to Customer</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.strategic.serviceCriticality}
                          onChange={(e) => updateLeverageFactor('strategic', 'serviceCriticality', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="non-core">Non-core activity</option>
                          <option value="supporting">Supporting function</option>
                          <option value="important">Important function</option>
                          <option value="mission-critical">Mission critical</option>
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
                          <option value="low">Low - just another deal</option>
                          <option value="moderate">Moderate interest</option>
                          <option value="high">High - strategic account</option>
                          <option value="critical">Critical - must win</option>
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
                          <option value="none">No incumbent</option>
                          <option value="weak">Weak incumbent position</option>
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
                          <option value="minimal">Minimal</option>
                          <option value="moderate">Moderate</option>
                          <option value="significant">Significant</option>
                          <option value="transformational">Transformational</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* BATNA Analysis (25% weight) */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm mr-3">4</span>
                      BATNA Analysis (25% weight)
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
                          <option value="strong">Strong alternative (in-house/other provider)</option>
                          <option value="viable">Viable alternative exists</option>
                          <option value="weak">Weak alternatives only</option>
                          <option value="none">No real alternative</option>
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
                          <option value="full">Full pipeline - can walk away</option>
                          <option value="healthy">Healthy pipeline</option>
                          <option value="light">Light pipeline</option>
                          <option value="desperate">Desperate for deals</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Leverage Score (Algorithm Output) */}
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-6 rounded-lg border border-slate-300">
                    <h4 className="font-medium text-slate-800 mb-4">Calculated Leverage Distribution (Algorithm Output)</h4>

                    <div className="mb-4">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <div className="text-center mb-2">
                            <div className="text-3xl font-bold text-slate-700">{leverageScore.customer}%</div>
                            <div className="text-sm text-slate-600">Customer Leverage</div>
                          </div>
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>• {Math.floor(leverageScore.customer * 2)} total negotiation points</div>
                            <div>• Stronger position in {leverageScore.customer > 50 ? 'most' : 'some'} clauses</div>
                            <div>• {leverageScore.customer > 60 ? 'Can push for favorable terms' : 'Balanced negotiation expected'}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-center mb-2">
                            <div className="text-3xl font-bold text-slate-700">{leverageScore.provider}%</div>
                            <div className="text-sm text-slate-600">Provider Leverage</div>
                          </div>
                          <div className="text-xs text-slate-500 space-y-1">
                            <div>• {Math.floor(leverageScore.provider * 2)} total negotiation points</div>
                            <div>• Stronger position in {leverageScore.provider > 50 ? 'most' : 'some'} clauses</div>
                            <div>• {leverageScore.provider > 60 ? 'Can maintain firm positions' : 'Will need to compromise'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative h-16 bg-white rounded-lg overflow-hidden border border-slate-300">
                      <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium transition-all duration-500"
                        style={{ width: `${leverageScore.customer}%` }}
                      >
                        Customer {leverageScore.customer}%
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full bg-gradient-to-l from-green-500 to-green-600 flex items-center justify-center text-white font-medium transition-all duration-500"
                        style={{ width: `${leverageScore.provider}%` }}
                      >
                        Provider {leverageScore.provider}%
                      </div>
                    </div>

                    <button
                      onClick={calculateAdvancedLeverage}
                      className="mt-4 w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Recalculate Leverage Score (Using Algorithm)
                    </button>

                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">
                        <strong>Algorithm Implementation:</strong> This leverage calculation follows the CLARENCE Negotiation Algorithm specification.
                        The four factor categories (Market Dynamics, Economic, Strategic, BATNA) each have 25% weight. The resulting ratio 
                        determines point allocation for negotiation phases: Customer receives {Math.floor(leverageScore.customer * 2)} points,
                        Provider receives {Math.floor(leverageScore.provider * 2)} points to prioritize clauses.
                      </p>
                    </div>

                    {clarenceAssessments['leverage-market'] && (
                      <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-700">
                          <strong>CLARENCE Market Assessment:</strong> {clarenceAssessments['leverage-market']}
                        </p>
                      </div>
                    )}
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

        {/* ========== SECTION 15: ACTION BUTTONS ========== */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              {!assessmentComplete ? (
                <button
                  onClick={handleSubmitAssessment}
                  disabled={!selectedProvider}
                  className={`px-6 py-3 rounded-lg font-medium text-sm ${selectedProvider
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                >
                  Complete Assessment & Calculate Points
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
                    className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-lg font-medium text-sm animate-pulse"
                  >
                    Proceed to Phase 2: Foundation (with {Math.floor(leverageScore.customer * 2)} customer points) →
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

// ========== SECTION 16: MAIN EXPORT WITH SUSPENSE ========== 
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
}-center text-sm mr-3">3</span>
                      Relationship Potential
                    </h4>

                    {/* Relationship Score Slider */}
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
                          setTimeout(() => calculatePartyFitScores(), 100)
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${partyFitScores.relationship}%, #e2e8f0 ${partyFitScores.relationship}%, #e2e8f0 100%)`
                        }}
                      />
                    </div>

                    {/* Trust Assessment Slider */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-600 mb-2">
                        Initial Trust Assessment: <span className="text-green-700 font-bold">{partyFitData.relationship.trust}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={partyFitData.relationship.trust}
                        onChange={(e) => updatePartyFit('relationship', 'trust', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${partyFitData.relationship.trust}%, #e2e8f0 ${partyFitData.relationship.trust}%, #e2e8f0 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Low Trust</span>
                        <span>Moderate</span>
                        <span>High Trust</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Risk Assessment with Slider */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm mr-3">4</span>
                      Risk Assessment
                    </h4>

                    {/* Risk Score Slider (inverse - higher is better) */}
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
                          setTimeout(() => calculatePartyFitScores(), 100)
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${partyFitScores.risk}%, #e2e8f0 ${partyFitScores.risk}%, #e2e8f0 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>High Risk</span>
                        <span>Moderate</span>
                        <span>Low Risk</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========== SECTION 14: LEVERAGE CONTENT ========== */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Advanced Leverage Assessment</h3>

                  {/* Introduction referencing algorithm */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 mb-6">
                    <p className="text-sm text-purple-900">
                      This assessment uses the CLARENCE Negotiation Algorithm to determine negotiating power balance.
                      Each factor category has 25% weight as per the algorithm specification. The resulting leverage ratio 
                      determines point allocation: Customer gets X*2 points, Provider gets Y*2 points.
                    </p>
                  </div>

                  {/* Market Dynamics (25% weight) */}
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Time Pressure - Customer</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={leverageFactors.marketDynamics.customerTimePresure}
                          onChange={(e) => updateLeverageFactor('marketDynamics', 'customerTimePresure', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="urgent">Urgent (&lt; 1 month)</option>
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
                          <option value="constrained">Highly constrained</option>
                          <option value="limited">Limited availability</option>
                          <option value="available">Good availability</option>
                          <option value="eager">Eager for business</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Economic Factors (25% weight) */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                      Economic Factors (25% weight)