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

  // Party Fit Scores
  const [partyFitScores, setPartyFitScores] = useState({
    strategic: 0,
    capability: 0,
    relationship: 0,
    risk: 0
  })

  const [overallFitScore, setOverallFitScore] = useState(0)

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

 // ========== SECTION 4: HELPER FUNCTIONS ==========

  // Define types for assessment data
  interface AssessmentData {
    customerName?: string
    serviceType?: string
    providerName?: string
    providerServices?: string
    employees?: string
    locations?: string
    technology?: string
    requirements?: string
    yearsInBusiness?: string
    revenue?: string
    criticality?: string
    dealValue?: string
    location?: string
    timeline?: string
    providerCount?: number
    customerRevenue?: string
    customerSize?: string
    providerRevenue?: string
    customerRequirements?: Record<string, unknown>
    providerCapabilities?: Record<string, unknown>
  }

  interface AssessmentResponse {
    industryMatch?: string
    deliveryModel?: string
    objectives?: string
    culturalFit?: string
    geographic?: string
    language?: string
    technology?: string
    scalability?: string
    domains?: string[]
    financial?: string
    security?: string
    compliance?: string
    lockin?: string
    redFlags?: string
    alternatives?: string
    marketCondition?: string
    timePresure?: string
    providerCapacity?: string
    serviceCriticality?: string
    providerInterest?: string
    incumbentAdvantage?: string
    reputationalValue?: string
  }

  interface CapabilitiesData {
    capabilities?: {
      services?: {
        geographicCoverage?: string
      }
      company?: {
        size?: string
        numberOfEmployees?: string
        annualRevenue?: string
      }
    }
  }

  interface RequirementsData {
    complexity?: string
    criticality?: string
    slaRequirement?: string
    timeline?: string
    keyMetrics?: string[]
    drivers?: string[]
    successCriteria?: string
    location?: string
  }

  // Generate assessment prompt for CLARENCE
  const generateAssessmentPrompt = (type: string, data: AssessmentData): string => {
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
    data: AssessmentData
  ): Promise<AssessmentResponse | null> => {
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

      return await response.json() as AssessmentResponse
    } catch (error) {
      console.error('CLARENCE Assessment Error:', error)
      return null
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
    calculatePartyFitScores()
  }

  // Calculate party fit scores
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

  // Advanced leverage calculation
  const calculateAdvancedLeverage = () => {
    let customerScore = 50 // Start at neutral
    let factorsAnalyzed = 0

    // Market Dynamics Impact
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

    // Economic Factors Impact
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

    if (leverageFactors.economic.budgetFlexibility === 'flexible') {
      customerScore += 4
      factorsAnalyzed++
    } else if (leverageFactors.economic.budgetFlexibility === 'fixed') {
      customerScore -= 4
      factorsAnalyzed++
    }

    // Strategic Position Impact
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

    if (leverageFactors.strategic.incumbentAdvantage === 'strong') {
      customerScore -= 8
      factorsAnalyzed++
    } else if (leverageFactors.strategic.incumbentAdvantage === 'none') {
      customerScore += 3
      factorsAnalyzed++
    }

    if (leverageFactors.strategic.reputationalValue === 'transformational') {
      customerScore += 8
      factorsAnalyzed++
    } else if (leverageFactors.strategic.reputationalValue === 'minimal') {
      customerScore -= 2
      factorsAnalyzed++
    }

    // BATNA Impact
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

    // Store detailed calculation
    const leverageDetails = {
      score: customerScore,
      factorsAnalyzed: factorsAnalyzed,
      pointAllocation: {
        customer: Math.floor(customerScore * 2),
        provider: Math.floor((100 - customerScore) * 2)
      }
    }

    console.log('Leverage Calculation Details:', leverageDetails)
    localStorage.setItem('leverageCalculation', JSON.stringify(leverageDetails))
  }

  // Auto-populate Deal Profile from data
  const populateDealProfile = (capabilities: CapabilitiesData, requirements: RequirementsData, sessionData: Session | null) => {
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
    } else if (serviceType.includes('data')) {
      category = 'data-processing'
    } else if (serviceType.includes('legal')) {
      category = 'legal-process'
    }

    setDealProfile(prev => ({
      ...prev,
      serviceCategory: category,
      totalValue: sessionData?.dealValue || prev.totalValue,
      serviceDescription: sessionData?.serviceRequired || prev.serviceDescription,
      geographicCoverage: capabilities?.capabilities?.services?.geographicCoverage || prev.geographicCoverage,
      scaleIndicator: capabilities?.capabilities?.company?.size || prev.scaleIndicator,
      complexity: requirements?.complexity || prev.complexity,
      criticality: requirements?.criticality || prev.criticality,
      serviceLevelRequirement: requirements?.slaRequirement || prev.serviceLevelRequirement,
      transitionTimeline: requirements?.timeline || prev.transitionTimeline,
      kpis: requirements?.keyMetrics?.join(', ') || prev.kpis,
      businessDrivers: requirements?.drivers || prev.businessDrivers,
      successCriteria: requirements?.successCriteria || prev.successCriteria
    }))
  }

  // Auto-populate Party Fit with AI assistance
  const populatePartyFitWithAI = async (provider: Provider, capabilities: CapabilitiesData, requirements: RequirementsData) => {
    console.log('Getting AI assessment for Party Fit...')

    const assessmentData: AssessmentData = {
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
          industryMatch: strategicAssessment.industryMatch || prev.strategic.industryMatch,
          deliveryModel: strategicAssessment.deliveryModel || prev.strategic.deliveryModel,
          objectives: strategicAssessment.objectives || prev.strategic.objectives,
          culturalFit: strategicAssessment.culturalFit || prev.strategic.culturalFit
        }
      }))
    }

    // Get capability assessment
    const capabilityAssessment = await getClarenceAssessment('party-fit-capability', assessmentData)
    if (capabilityAssessment) {
      setPartyFitData(prev => ({
        ...prev,
        capability: {
          geographic: capabilityAssessment.geographic || prev.capability.geographic,
          language: capabilityAssessment.language || prev.capability.language,
          technology: capabilityAssessment.technology || prev.capability.technology,
          scalability: capabilityAssessment.scalability || prev.capability.scalability,
          domains: capabilityAssessment.domains || prev.capability.domains
        }
      }))
    }

    // Get risk assessment
    const riskAssessment = await getClarenceAssessment('party-fit-risk', assessmentData)
    if (riskAssessment) {
      setPartyFitData(prev => ({
        ...prev,
        risk: {
          financial: riskAssessment.financial || prev.risk.financial,
          security: riskAssessment.security || prev.risk.security,
          compliance: riskAssessment.compliance || prev.risk.compliance,
          lockin: riskAssessment.lockin || prev.risk.lockin,
          redFlags: riskAssessment.redFlags || prev.risk.redFlags
        }
      }))
    }

    calculatePartyFitScores()
  }

  // Auto-populate Leverage with AI assistance
  const populateLeverageWithAI = async (provider: Provider, capabilities: CapabilitiesData, requirements: RequirementsData, sessionData: Session | null) => {
    console.log('Getting AI assessment for Leverage...')

    const leverageData: AssessmentData = {
      serviceType: sessionData?.serviceRequired,
      dealValue: sessionData?.dealValue,
      customerCompany: sessionData?.customerCompany,
      providerName: provider.providerName,
      employees: capabilities?.capabilities?.company?.numberOfEmployees,
      providerRevenue: capabilities?.capabilities?.company?.annualRevenue,
      timeline: requirements?.timeline,
      criticality: requirements?.criticality,
      location: requirements?.location || 'UK'
    }

    // Get market dynamics assessment
    const marketAssessment = await getClarenceAssessment('leverage-market', leverageData)
    if (marketAssessment) {
      setLeverageFactors(prev => ({
        ...prev,
        marketDynamics: {
          alternatives: marketAssessment.alternatives || prev.marketDynamics.alternatives,
          marketCondition: marketAssessment.marketCondition || prev.marketDynamics.marketCondition,
          customerTimePresure: marketAssessment.timePresure || prev.marketDynamics.customerTimePresure,
          providerCapacity: marketAssessment.providerCapacity || prev.marketDynamics.providerCapacity
        }
      }))
    }

    // Get strategic position assessment
    const strategicAssessment = await getClarenceAssessment('leverage-strategic', leverageData)
    if (strategicAssessment) {
      setLeverageFactors(prev => ({
        ...prev,
        strategic: {
          serviceCriticality: strategicAssessment.serviceCriticality || prev.strategic.serviceCriticality,
          providerInterest: strategicAssessment.providerInterest || prev.strategic.providerInterest,
          incumbentAdvantage: strategicAssessment.incumbentAdvantage || prev.strategic.incumbentAdvantage,
          reputationalValue: strategicAssessment.reputationalValue || prev.strategic.reputationalValue
        }
      }))
    }

    // Auto-calculate economic factors
    const dealSize = parseInt(sessionData?.dealValue || '0')
    const providerRevenue = parseInt(capabilities?.capabilities?.company?.annualRevenue?.replace(/\D/g, '') || '0')

    if (dealSize && providerRevenue) {
      const ratio = (dealSize / providerRevenue) * 100
      let dependence = 'tiny'
      if (ratio > 15) dependence = 'critical'
      else if (ratio > 5) dependence = 'important'
      else if (ratio > 1) dependence = 'small'

      setLeverageFactors(prev => ({
        ...prev,
        economic: {
          ...prev.economic,
          providerDependence: dependence
        }
      }))
    }

    setTimeout(() => calculateAdvancedLeverage(), 500)
  }

  // Enhanced select provider with data integration
  const selectProvider = async (provider: Provider) => {
    console.log('Loading comprehensive provider data...', provider)
    setSelectedProvider(provider)

    const sessionId = session?.sessionId || searchParams.get('session')

    try {
      // Load Provider Capabilities
      const capabilitiesResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session_id=${sessionId}&provider_id=${provider.providerId}`
      )
      const capabilities = await capabilitiesResponse.json() as CapabilitiesData

      // Load Customer Requirements
      const requirementsResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sessionId}`
      )
      const requirements = await requirementsResponse.json() as RequirementsData

      // Auto-populate all sections
      populateDealProfile(capabilities, requirements, session)
      await populatePartyFitWithAI(provider, capabilities, requirements)
      await populateLeverageWithAI(provider, capabilities, requirements, session)

    } catch (error) {
      console.error('Data integration error:', error)
      // Fallback to manual entry
    }
  }

  const loadProviders = useCallback(async (sessionId: string) => {
    // ... rest of loadProviders code stays the same ...
  }, [])

  const loadSessionData = useCallback(async () => {
    // ... rest of loadSessionData code stays the same ...
  }, [searchParams, loadProviders])

  const handleSubmitAssessment = async () => {
    // ... rest of handleSubmitAssessment code stays the same ...
  }

  // Helper functions for Deal Profile (removed as unused)
  
  // Get color classes for Party Fit (removed as unused)

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

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Scale Indicator</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            placeholder="e.g., 50,000 transactions/month"
                            value={dealProfile.scaleIndicator}
                            onChange={(e) => setDealProfile({ ...dealProfile, scaleIndicator: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Geographic Coverage</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            placeholder="e.g., UK, EU, Global"
                            value={dealProfile.geographicCoverage}
                            onChange={(e) => setDealProfile({ ...dealProfile, geographicCoverage: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Service Complexity</label>
                          <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            value={dealProfile.complexity}
                            onChange={(e) => setDealProfile({ ...dealProfile, complexity: e.target.value })}
                          >
                            <option value="">Select...</option>
                            <option value="standard">Standard - Routine processes</option>
                            <option value="moderate">Moderate - Some customization</option>
                            <option value="complex">Complex - Significant customization</option>
                            <option value="highly-complex">Highly Complex - Bespoke solution</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Critical Service?</label>
                          <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            value={dealProfile.criticality}
                            onChange={(e) => setDealProfile({ ...dealProfile, criticality: e.target.value })}
                          >
                            <option value="">Select...</option>
                            <option value="mission-critical">Mission Critical</option>
                            <option value="business-critical">Business Critical</option>
                            <option value="important">Important</option>
                            <option value="standard">Standard</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Requirements & Expectations */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-3">Requirements & Expectations</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Service Level Requirements</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={dealProfile.serviceLevelRequirement}
                          onChange={(e) => setDealProfile({ ...dealProfile, serviceLevelRequirement: e.target.value })}
                        >
                          <option value="">Select...</option>
                          <option value="premium">Premium (99.9%+ availability)</option>
                          <option value="standard">Standard (99% availability)</option>
                          <option value="basic">Basic (95% availability)</option>
                          <option value="best-effort">Best Effort</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Transition Timeline</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          value={dealProfile.transitionTimeline}
                          onChange={(e) => setDealProfile({ ...dealProfile, transitionTimeline: e.target.value })}
                        >
                          <option value="">Select...</option>
                          <option value="immediate">Immediate (&lt; 1 month)</option>
                          <option value="fast">Fast (1-3 months)</option>
                          <option value="standard">Standard (3-6 months)</option>
                          <option value="gradual">Gradual (6-12 months)</option>
                          <option value="phased">Phased approach</option>
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Key Performance Indicators</label>
                        <textarea
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                          rows={2}
                          placeholder="List the main KPIs for this service..."
                          value={dealProfile.kpis}
                          onChange={(e) => setDealProfile({ ...dealProfile, kpis: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Strategic Context */}
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-900 mb-3">Strategic Context</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-yellow-800 mb-1">Primary Business Drivers</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Cost Reduction', 'Quality Improvement', 'Scalability',
                            'Access to Expertise', 'Technology Enablement', 'Risk Mitigation',
                            'Focus on Core Business', 'Speed to Market'].map((driver) => (
                              <label key={driver} className="flex items-center">
                                <input
                                  type="checkbox"
                                  className="mr-2"
                                  checked={dealProfile.businessDrivers?.includes(driver)}
                                  onChange={(e) => {
                                    const drivers = dealProfile.businessDrivers || []
                                    if (e.target.checked) {
                                      setDealProfile({ ...dealProfile, businessDrivers: [...drivers, driver] })
                                    } else {
                                      setDealProfile({ ...dealProfile, businessDrivers: drivers.filter(d => d !== driver) })
                                    }
                                  }}
                                />
                                <span className="text-sm">{driver}</span>
                              </label>
                            ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-yellow-800 mb-1">Success Criteria</label>
                        <textarea
                          className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-white"
                          rows={2}
                          placeholder="What would make this engagement successful?"
                          value={dealProfile.successCriteria}
                          onChange={(e) => setDealProfile({ ...dealProfile, successCriteria: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========== SECTION 13: PARTY FIT CONTENT ========== */}
              {activeSection === 'fit' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Party Fit Assessment</h3>

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
                        placeholder="How well do the provider's objectives align with your transformation goals?"
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
                      <label className="block text-sm font-medium text-slate-600 mb-1">Domain Expertise (check all that apply)</label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['Customer Service', 'Technical Support', 'Finance & Accounting', 'HR Services', 'IT Services', 'Data Processing'].map((domain) => (
                          <label key={domain} className="flex items-center">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={partyFitData.capability.domains?.includes(domain)}
                              onChange={(e) => {
                                const domains = partyFitData.capability.domains || []
                                if (e.target.checked) {
                                  updatePartyFit('capability', 'domains', [...domains, domain])
                                } else {
                                  updatePartyFit('capability', 'domains', domains.filter(d => d !== domain))
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
                          onChange={(e) => updatePartyFit('relationship', 'trust', parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12 text-right">{partyFitData.relationship.trust || 50}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========== SECTION 14: LEVERAGE CONTENT ========== */}
              {activeSection === 'leverage' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-slate-900 mb-4">Advanced Leverage Assessment</h3>

                  {/* Introduction */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 mb-6">
                    <p className="text-sm text-purple-900">
                      This assessment determines the negotiating power balance and point allocation for the negotiation phases.
                      The leverage ratio directly impacts how many priority points each party receives to allocate across contract clauses.
                    </p>
                  </div>

                  {/* Market Dynamics */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm mr-3">1</span>
                      Market Dynamics
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

                  {/* Economic Factors */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm mr-3">2</span>
                      Economic Factors
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

                  {/* Strategic Position */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm mr-3">3</span>
                      Strategic Position
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

                  {/* BATNA Analysis */}
                  <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h4 className="font-medium text-slate-800 mb-4 flex items-center">
                      <span className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm mr-3">4</span>
                      BATNA (Best Alternative to Negotiated Agreement)
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

                  {/* Calculated Leverage Score */}
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-6 rounded-lg border border-slate-300">
                    <h4 className="font-medium text-slate-800 mb-4">Calculated Leverage Distribution</h4>

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
                      Recalculate Leverage Score
                    </button>

                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-xs text-yellow-800">
                        <strong>How this impacts negotiation:</strong> This leverage ratio determines how many points each party
                        gets to allocate to prioritize clauses during negotiation. CLARENCE will use these points along with
                        party positions to calculate optimal compromise positions in real-time.
                      </p>
                    </div>
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
}