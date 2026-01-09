'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// ========== SECTION 1: INTERFACES ==========
interface ConversationMessage {
  id: string
  type: 'clarence' | 'user'
  content: string
  timestamp: Date
  questionKey?: string
}

interface ExistingRequirements {
  companyName: string
  companySize: string
  annualRevenue: string
  industry: string
  contactName: string
  contactEmail: string
  numberOfBidders: string
  marketPosition: string
  dealValue: string
  decisionTimeline: string
  incumbentStatus: string
  switchingCosts: string
  serviceRequired: string
  serviceCriticality: string
  businessChallenge: string
  desiredOutcome: string
  alternativeOptions: string
  inHouseCapability: string
  walkAwayPoint: string
  budgetFlexibility: string
  liabilityCap?: number
  paymentTerms?: number
  slaTarget?: number
  terminationNotice?: number
  contractPositions?: {
    liabilityCap?: number
    paymentTerms?: number
    slaTarget?: number
    dataRetention?: number
    terminationNotice?: number
  } | string
  priorities?: {
    cost: number
    quality: number
    speed: number
    innovation: number
    riskMitigation: number
  } | string
}

interface StrategicAnswers {
  batnaSpecifics: string
  batnaTimeline: string
  batnaRealismScore: string
  absoluteRedLines: string
  flexibleAreas: string
  riskAppetite: string
  worstCaseScenario: string
  stakeholderPressure: string
  internalPolitics: string
  relationshipVsTerms: string
  longTermVision: string
}

type QuestionKey = keyof StrategicAnswers

interface StrategicQuestion {
  key: QuestionKey
  question: string
  followUp?: string
  context?: (data: ExistingRequirements) => string | undefined
}

interface LeverageBreakdown {
  marketDynamicsScore: number
  economicFactorsScore: number
  strategicPositionScore: number
  batnaScore: number
}

interface LeverageAssessment {
  customerLeverage: number
  providerLeverage: number
  breakdown: LeverageBreakdown
  reasoning: string
}

// ========== SECTION 2: DISPLAY HELPERS ==========
const getIncumbentDisplay = (status: string): string => {
  const statusMap: Record<string, string> = {
    'no-incumbent': 'New engagement (no current provider)',
    'replacing-poor': 'Replacing a poor performer',
    'replacing-good': 'Replacing a satisfactory provider',
    'expanding': 'Expanding existing relationship',
    '': 'Not specified'
  }
  return statusMap[status] || status.replace(/-/g, ' ')
}

const getTimelineDisplay = (timeline: string): string => {
  const timelineMap: Record<string, string> = {
    'Urgent': 'Urgent - under 2 weeks',
    'Normal': 'Standard - within 1 month',
    'Flexible': 'Flexible - 1-3 months',
    'No Rush': 'No time pressure',
    '': 'Not specified'
  }
  return timelineMap[timeline] || timeline
}

const getCriticalityDisplay = (criticality: string): string => {
  const criticalityMap: Record<string, string> = {
    'mission-critical': 'Mission-critical (business stops without it)',
    'business-critical': 'Business-critical (major impact)',
    'important': 'Important to operations',
    'standard': 'Standard business function',
    '': 'Not specified'
  }
  return criticalityMap[criticality] || criticality.replace(/-/g, ' ')
}

const getSwitchingCostsDisplay = (costs: string): string => {
  const costsMap: Record<string, string> = {
    'minimal': 'Minimal (< £10k)',
    'moderate': 'Moderate (£10-50k)',
    'high': 'High (£50-200k)',
    'prohibitive': 'Prohibitive (> £200k)',
    '': 'Not assessed'
  }
  return costsMap[costs] || costs
}

const formatCurrency = (value: string | number): string => {
  if (!value) return 'Not specified'
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value
  if (isNaN(num)) return String(value)
  if (num >= 1000000) return `£${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `£${(num / 1000).toFixed(0)}K`
  return `£${num.toLocaleString()}`
}

const formatPrioritiesDisplay = (priorities: Record<string, number> | string | null | undefined): string => {
  if (!priorities) return 'Not specified'
  let prioritiesObj: Record<string, number>
  if (typeof priorities === 'string') {
    try {
      prioritiesObj = JSON.parse(priorities)
    } catch {
      return 'Not specified'
    }
  } else {
    prioritiesObj = priorities as Record<string, number>
  }
  if (!prioritiesObj || typeof prioritiesObj !== 'object' || Object.keys(prioritiesObj).length === 0) {
    return 'Not specified'
  }
  const labels: Record<string, string> = {
    'cost': 'Cost Optimization',
    'quality': 'Quality Standards',
    'speed': 'Speed of Delivery',
    'innovation': 'Innovation & Technology',
    'riskMitigation': 'Risk Mitigation'
  }
  const sorted = Object.entries(prioritiesObj)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value], index) => `${index + 1}. ${labels[key] || key} (${value} points)`)
  return sorted.length > 0 ? sorted.join('\n') : 'Not specified'
}

const getBiddersDisplay = (bidders: string): string => {
  if (!bidders) return 'Not specified'
  if (bidders === '1') return 'Sole source (1 provider)'
  if (bidders === '7+') return 'Highly competitive (7+ providers)'
  return `${bidders} providers in consideration`
}

// ========== SECTION 3: STRATEGIC QUESTIONS ==========
const STRATEGIC_QUESTIONS: StrategicQuestion[] = [
  {
    key: 'batnaSpecifics',
    question: "You mentioned having alternative options. Walk me through your Plan B specifically - if negotiations with your preferred provider(s) fell through tomorrow, what would you actually do?",
    context: (data) => data.numberOfBidders ? `I see you've identified ${data.numberOfBidders} competing providers.` : undefined
  },
  {
    key: 'batnaTimeline',
    question: "How quickly could you realistically execute that Plan B? I need to understand your true timeline pressure.",
  },
  {
    key: 'batnaRealismScore',
    question: "On a scale of 1-10, how confident are you that your backup option would actually work as well as your preferred choice? And why?",
  },
  {
    key: 'absoluteRedLines',
    question: "What are your absolute red lines - the terms where you'd walk away from this deal entirely, even if everything else was perfect?",
  },
  {
    key: 'flexibleAreas',
    question: "Conversely, where do you have genuine flexibility? What could you concede without significant pain?",
  },
  {
    key: 'riskAppetite',
    question: "How would your board react if this provider relationship failed in 12 months? Is this a career-defining decision for anyone?",
  },
  {
    key: 'worstCaseScenario',
    question: "Paint me the worst case scenario if negotiations break down completely. How bad would that actually be for the business?",
  },
  {
    key: 'stakeholderPressure',
    question: "Who else needs this deal to happen, and why? Any internal stakeholders pushing for a quick resolution?",
  },
  {
    key: 'internalPolitics',
    question: "Is there anything politically sensitive I should know? Previous failed relationships, internal champions for this provider, or competing priorities?",
  },
  {
    key: 'relationshipVsTerms',
    question: "If you had to choose: would you prefer better commercial terms or a stronger long-term partnership? What matters more for this engagement?",
  },
  {
    key: 'longTermVision',
    question: "Where do you see this provider relationship in 3-5 years? Is this a tactical fix or strategic partnership?",
  }
]

// ========== SECTION 4: MAIN COMPONENT ==========
function IntelligentQuestionnaireContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // URL Parameters
  const sessionId = searchParams.get('session_id')
  const contractId = searchParams.get('contract_id')

  // Questionnaire sections
  const questionnaireSections = [
    { id: 'summary', name: 'Requirements Summary', icon: '📋', questionIndices: [] as number[] },
    { id: 'batna', name: 'BATNA Deep Dive', icon: '⚖️', questionIndices: [0, 1, 2] },
    { id: 'redlines', name: 'Red Lines & Flexibility', icon: '🚫', questionIndices: [3, 4] },
    { id: 'risk', name: 'Risk Tolerance', icon: '⚠️', questionIndices: [5, 6] },
    { id: 'internal', name: 'Internal Dynamics', icon: '🏢', questionIndices: [7, 8] },
    { id: 'relationship', name: 'Relationship Priorities', icon: '🤝', questionIndices: [9, 10] },
    { id: 'complete', name: 'Invite Providers', icon: '📧', questionIndices: [] as number[] }
  ]

  // ========== SECTION 5: STATE ==========
  const [loading, setLoading] = useState(true)
  const [existingData, setExistingData] = useState<ExistingRequirements | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [strategicAnswers, setStrategicAnswers] = useState<Partial<StrategicAnswers>>({})
  const [isTyping, setIsTyping] = useState(false)
  const [sessionNumber, setSessionNumber] = useState<string | null>(null)
  const [conversationComplete, setConversationComplete] = useState(false)
  const [leverageAssessment, setLeverageAssessment] = useState<LeverageAssessment | null>(null)
  const [isSkipping, setIsSkipping] = useState(false)

  // ========== SECTION 6: PROGRESS HELPERS ==========
  const getCurrentSectionId = (): string => {
    if (conversationComplete) return 'complete'
    if (currentQuestionIndex === 0 && messages.length <= 2) return 'summary'
    for (const section of questionnaireSections) {
      if (section.questionIndices.includes(currentQuestionIndex)) {
        return section.id
      }
    }
    return 'summary'
  }

  const getSectionStatus = (sectionId: string): 'complete' | 'current' | 'pending' => {
    const section = questionnaireSections.find(s => s.id === sectionId)
    if (!section) return 'pending'
    if (sectionId === 'summary') return 'complete'
    if (sectionId === 'complete') return conversationComplete ? 'complete' : 'pending'
    if (section.questionIndices.length === 0) return 'pending'
    const maxIndex = Math.max(...section.questionIndices)
    const minIndex = Math.min(...section.questionIndices)
    if (currentQuestionIndex > maxIndex) return 'complete'
    if (currentQuestionIndex >= minIndex && currentQuestionIndex <= maxIndex) return 'current'
    return 'pending'
  }

  const getSectionProgress = (sectionId: string): { answered: number; total: number } => {
    const section = questionnaireSections.find(s => s.id === sectionId)
    if (!section || section.questionIndices.length === 0) return { answered: 0, total: 0 }
    const answered = section.questionIndices.filter(idx => {
      const questionKey = STRATEGIC_QUESTIONS[idx]?.key
      return questionKey && strategicAnswers[questionKey]
    }).length
    return { answered, total: section.questionIndices.length }
  }

  const getOverallProgress = (): number => {
    const totalQuestions = STRATEGIC_QUESTIONS.length
    const answeredQuestions = Object.keys(strategicAnswers).length
    return Math.round((answeredQuestions / totalQuestions) * 100)
  }

  // ========== SECTION 7: LOAD DATA ==========
  useEffect(() => {
    const loadExistingRequirements = async () => {
      if (!sessionId) {
        setLoading(false)
        return
      }
      try {
        // First, try to load from customer-requirements-api
        const response = await fetch(`https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sessionId}`)

        if (response.ok) {
          const data = await response.json()

          // Check if we got actual data
          if (data && (data.company_name || data.companyName || data.session_id || data.sessionId)) {
            setSessionNumber(data.sessionNumber || data.session_number || null)
            const requirements: ExistingRequirements = mapApiResponseToRequirements(data)
            setExistingData(requirements)
            startIntelligentConversation(requirements)
            setLoading(false)
            return
          }
        }

        // Fallback: Load from get-session if customer-requirements returned nothing
        console.log('[Strategic Assessment] No requirements found, falling back to get-session')
        const sessionResponse = await fetch(`https://spikeislandstudios.app.n8n.cloud/webhook/get-session?session_id=${sessionId}`)

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json()
          const session = sessionData.session || sessionData

          if (session) {
            setSessionNumber(session.session_number || session.sessionNumber || null)

            // Build minimal requirements from session data
            const minimalRequirements: ExistingRequirements = {
              companyName: session.customer_company || session.customerCompany || '',
              companySize: '',
              annualRevenue: '',
              industry: '',
              contactName: '',
              contactEmail: '',
              numberOfBidders: '',
              marketPosition: '',
              dealValue: '',
              decisionTimeline: '',
              incumbentStatus: '',
              switchingCosts: '',
              serviceRequired: session.contract_type || session.contractType || '',
              serviceCriticality: '',
              businessChallenge: '',
              desiredOutcome: '',
              alternativeOptions: '',
              inHouseCapability: '',
              walkAwayPoint: '',
              budgetFlexibility: '',
              priorities: undefined
            }

            setExistingData(minimalRequirements)
            startIntelligentConversation(minimalRequirements)
          } else {
            addClarenceMessage("I couldn't load your session data. Please try refreshing the page or go back to the contract preparation step.")
          }
        } else {
          addClarenceMessage("I had trouble loading your session. Please try refreshing the page.")
        }
      } catch (error) {
        console.error('Error loading requirements:', error)
        addClarenceMessage("I had trouble loading your requirements. Let me try a different approach...")
      }
      setLoading(false)
    }
    loadExistingRequirements()
  }, [sessionId])

  // ========== SECTION 8: MAP API RESPONSE ==========
  const mapApiResponseToRequirements = (data: any): ExistingRequirements => {
    const requirements = data.requirements || {}
    const customer = data.customer || {}
    const metadata = data.metadata || {}
    let contractPositions = { liabilityCap: 0, paymentTerms: 0, slaTarget: 0, terminationNotice: 0 }
    try {
      if (data.contractPositions) {
        contractPositions = typeof data.contractPositions === 'string' ? JSON.parse(data.contractPositions) : data.contractPositions
      }
    } catch (e) { console.error('Error parsing contract positions:', e) }
    let priorities = { cost: 0, quality: 0, speed: 0, innovation: 0, riskMitigation: 0 }
    try {
      if (data.priorities) {
        priorities = typeof data.priorities === 'string' ? JSON.parse(data.priorities) : data.priorities
      }
    } catch (e) { console.error('Error parsing priorities:', e) }
    return {
      companyName: data.company_name || customer.company || data.companyName || '',
      companySize: data.company_size || data.companySize || '',
      annualRevenue: data.annual_revenue || data.annualRevenue || '',
      industry: data.industry || metadata.industry || '',
      contactName: data.contact_name || data.contactName || '',
      contactEmail: data.contact_email || data.contactEmail || '',
      numberOfBidders: data.number_of_bidders || data.numberOfBidders || '',
      marketPosition: data.market_position || data.marketPosition || '',
      dealValue: data.deal_value || requirements.budget?.dealValue || data.dealValue || '',
      decisionTimeline: data.decision_timeline || data.decisionTimeline || '',
      incumbentStatus: data.incumbent_status || data.incumbentStatus || '',
      switchingCosts: data.switching_costs || data.switchingCosts || '',
      serviceRequired: data.service_required || requirements.serviceRequired || data.serviceRequired || '',
      serviceCriticality: data.service_criticality || data.service_criticality_text || requirements.serviceCriticality || data.serviceCriticality || '',
      businessChallenge: data.business_challenge || requirements.businessChallenge || data.businessChallenge || '',
      desiredOutcome: data.desired_outcome || requirements.desiredOutcome || data.desiredOutcome || '',
      alternativeOptions: data.alternative_options || data.alternativeOptions || '',
      inHouseCapability: data.in_house_capability || data.inHouseCapability || '',
      walkAwayPoint: data.walk_away_point || data.walkAwayPoint || '',
      budgetFlexibility: data.budget_flexibility || data.budget_flexibility_text || data.budgetFlexibility || '',
      liabilityCap: contractPositions.liabilityCap || 0,
      paymentTerms: contractPositions.paymentTerms || 0,
      slaTarget: contractPositions.slaTarget || 0,
      terminationNotice: contractPositions.terminationNotice || 0,
      priorities
    }
  }

  // ========== SECTION 9: SCROLL & MESSAGE HELPERS ==========
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addClarenceMessage = (content: string, questionKey?: QuestionKey) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'clarence', content, timestamp: new Date(), questionKey }])
  }

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content, timestamp: new Date() }])
  }

  // ========== SECTION 10: CONVERSATION FLOW ==========
  const startIntelligentConversation = async (data: ExistingRequirements) => {
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    const openingMessage = generateIntelligentOpening(data)
    addClarenceMessage(openingMessage)
    await new Promise(resolve => setTimeout(resolve, 1500))
    addClarenceMessage(`These questions will help me objectively calculate your leverage and recommend first-draft positions.\n\nLet's start with your alternatives...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    askStrategicQuestion(0, data)
    setIsTyping(false)
  }

  const generateIntelligentOpening = (data: ExistingRequirements): string => {
    // Check if we have full data or minimal data
    const hasFullData = data.dealValue || data.serviceCriticality || data.numberOfBidders

    if (!hasFullData) {
      // Minimal data path - Contract Studio flow without Quick Intake
      return `Good to meet you, ${data.contactName || data.companyName || 'there'}. I see you've started a new negotiation session for **${data.companyName || 'your company'}**.

I don't have all the details about this deal yet, but that's fine - I'll gather what I need through our conversation.

${data.serviceRequired ? `**Contract Type:** ${data.serviceRequired}` : ''}

Let me ask you some strategic questions to understand your position and calculate your leverage.`
    }

    // Full data path - we have deal context
    const priorityRanking = formatPrioritiesDisplay(data.priorities)
    const timeline = getTimelineDisplay(data.decisionTimeline)
    let positions: any = {}
    if (data.contractPositions) {
      if (typeof data.contractPositions === 'string') {
        try { positions = JSON.parse(data.contractPositions) } catch { positions = {} }
      } else { positions = data.contractPositions }
    }
    const liabilityCap = positions.liabilityCap ?? data.liabilityCap ?? 0
    const paymentTerms = positions.paymentTerms ?? data.paymentTerms ?? 0
    const slaTarget = positions.slaTarget ?? data.slaTarget ?? 0
    const terminationNotice = positions.terminationNotice ?? data.terminationNotice ?? 0

    let opening = `Good to meet you, ${data.contactName || data.companyName || 'there'}. I've reviewed your requirements submission for **${data.companyName}**.

Here's what I understand:

**The Deal:**
- ${data.serviceRequired || 'Service'} contract${data.dealValue ? ` worth ${formatCurrency(data.dealValue)}` : ''}
- ${getCriticalityDisplay(data.serviceCriticality)}
- ${getBiddersDisplay(data.numberOfBidders)}`

    if (data.incumbentStatus || data.decisionTimeline || data.switchingCosts) {
      opening += `

**Your Position:**
- ${getIncumbentDisplay(data.incumbentStatus)}
- Timeline: ${timeline}
- Switching costs: ${getSwitchingCostsDisplay(data.switchingCosts)}`
    }

    if (priorityRanking !== 'Not specified') {
      opening += `

**Your Priorities (from highest):**
${priorityRanking}`
    }

    if (liabilityCap || paymentTerms || slaTarget || terminationNotice) {
      opening += `

**Your Key Starting Positions:**
- Liability cap: ${liabilityCap}% of annual value
- Payment terms: ${paymentTerms} days
- SLA target: ${slaTarget}% uptime
- Termination notice: ${terminationNotice} days`
    }

    opening += `

I have the facts. Now I need to understand the *dynamics* that will determine your leverage.`

    return opening
  }

  const askStrategicQuestion = async (index: number, data: ExistingRequirements) => {
    if (index >= STRATEGIC_QUESTIONS.length) {
      await completeAssessment()
      return
    }
    const question = STRATEGIC_QUESTIONS[index]
    let questionText = question.question
    questionText = questionText.replace('{providerName}', 'this provider').replace('{companyName}', data.companyName || 'your company')
    if (question.context) {
      const context = question.context(data)
      if (context) questionText = `${context}\n\n${questionText}`
    }
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 600))
    addClarenceMessage(questionText, question.key)
    setIsTyping(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userInput.trim() || isTyping) return
    const input = userInput.trim()
    setUserInput('')
    addUserMessage(input)
    const currentQuestion = STRATEGIC_QUESTIONS[currentQuestionIndex]
    if (currentQuestion) {
      setStrategicAnswers(prev => ({ ...prev, [currentQuestion.key]: input }))
    }
    const nextIndex = currentQuestionIndex + 1
    setCurrentQuestionIndex(nextIndex)
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    const acknowledgments = ["Got it.", "Understood.", "That's helpful context.", "Clear.", "Noted.", "Important to know.", "That tells me a lot."]
    if (Math.random() > 0.5 && nextIndex < STRATEGIC_QUESTIONS.length) {
      addClarenceMessage(acknowledgments[Math.floor(Math.random() * acknowledgments.length)])
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    if (existingData) askStrategicQuestion(nextIndex, existingData)
  }

  const completeAssessment = async () => {
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    addClarenceMessage("Thank you. I now have a complete picture of your strategic position and priorities.")
    await new Promise(resolve => setTimeout(resolve, 1500))
    const customerFactors = calculateCustomerFactors()

    // Calculate preliminary leverage based on customer factors
    const avgScore = (customerFactors.marketDynamicsScore + customerFactors.economicFactorsScore +
      customerFactors.strategicPositionScore + customerFactors.batnaScore) / 4
    const customerLeverage = Math.round(avgScore)
    const providerLeverage = 100 - customerLeverage

    addClarenceMessage(`**Strategic Assessment Complete**

I've captured your position on:

✓ **BATNA Analysis** - Your alternatives and fallback options
✓ **Red Lines** - What you absolutely won't compromise on
✓ **Flexibility Areas** - Where you have room to negotiate
✓ **Risk Tolerance** - How much uncertainty you can accept
✓ **Internal Dynamics** - Stakeholder pressures and politics
✓ **Relationship Priorities** - Partnership vs. commercial focus

**What happens next:**

1. **Invite your provider(s)** - Send invitations to start the negotiation
2. **Provider intake** - They'll complete their own assessment
3. **Leverage calculation** - I'll calculate leverage once both sides are ready
4. **Negotiate** - I'll generate draft positions and guide the mediation

Your data is saved and ready. Click below to invite providers.`)

    setLeverageAssessment({
      customerLeverage,
      providerLeverage,
      breakdown: customerFactors,
      reasoning: "Preliminary assessment based on customer data. Final leverage will be calculated after provider intake."
    })
    setIsTyping(false)
    setConversationComplete(true)
  }

  const calculateCustomerFactors = (): LeverageBreakdown => {
    let marketScore = 50, economicScore = 50, strategicScore = 50, batnaScore = 50
    if (existingData?.numberOfBidders === '4+' || existingData?.numberOfBidders === '4-plus') marketScore += 15
    else if (existingData?.numberOfBidders === 'Single Source' || existingData?.numberOfBidders === 'single') marketScore -= 20
    if (existingData?.decisionTimeline === 'Urgent' || existingData?.decisionTimeline === 'urgent') marketScore -= 10
    else if (existingData?.decisionTimeline === 'Flexible' || existingData?.decisionTimeline === 'flexible') marketScore += 10
    if (existingData?.switchingCosts === 'High' || existingData?.switchingCosts === 'high') economicScore -= 15
    else if (existingData?.switchingCosts === 'Low' || existingData?.switchingCosts === 'low') economicScore += 10
    if (existingData?.serviceCriticality === 'mission-critical') strategicScore -= 10
    else if (existingData?.serviceCriticality === 'non-core') strategicScore += 10
    const batnaRealism = strategicAnswers.batnaRealismScore
    if (batnaRealism) {
      const score = parseInt(batnaRealism)
      if (!isNaN(score)) {
        if (score >= 8) batnaScore += 20
        else if (score >= 6) batnaScore += 10
        else if (score <= 4) batnaScore -= 15
      }
    }
    if (existingData?.alternativeOptions === 'many-alternatives' || existingData?.alternativeOptions === 'strong') batnaScore += 10
    else if (existingData?.alternativeOptions === 'no-alternatives' || existingData?.alternativeOptions === 'none') batnaScore -= 15
    return {
      marketDynamicsScore: Math.max(0, Math.min(100, marketScore)),
      economicFactorsScore: Math.max(0, Math.min(100, economicScore)),
      strategicPositionScore: Math.max(0, Math.min(100, strategicScore)),
      batnaScore: Math.max(0, Math.min(100, batnaScore))
    }
  }

  // ========== SECTION 11: NAVIGATION HANDLERS ==========
  const handleProceedToInviteProviders = async () => {
    if (!sessionId) return
    try {
      // Build leverage_assessment object matching N8N schema
      const leveragePayload = {
        customerLeverage: leverageAssessment?.customerLeverage || 50,
        providerLeverage: leverageAssessment?.providerLeverage || 50,
        breakdown: leverageAssessment?.breakdown || {
          marketDynamicsScore: 50,
          economicFactorsScore: 50,
          strategicPositionScore: 50,
          batnaScore: 50
        },
        reasoning: leverageAssessment?.reasoning || 'Preliminary assessment based on customer data'
      }

      await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/strategic-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_number: sessionNumber,
          strategic_answers: {
            ...strategicAnswers,
            providerConcerns: '',  // Optional field expected by N8N
            trustLevel: ''         // Optional field expected by N8N
          },
          leverage_assessment: leveragePayload,
          completed_at: new Date().toISOString()
        })
      })
    } catch (error) { console.error('Error saving assessment:', error) }
    let nextUrl = `/auth/invite-providers?session_id=${sessionId}`
    if (contractId) nextUrl += `&contract_id=${contractId}`
    router.push(nextUrl)
  }

  const handleSkipAssessment = async () => {
    if (!sessionId) return
    setIsSkipping(true)
    try {
      // Send empty assessment with default leverage values
      await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/strategic-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_number: sessionNumber,
          strategic_answers: {},
          leverage_assessment: {
            customerLeverage: 50,
            providerLeverage: 50,
            breakdown: {
              marketDynamicsScore: 50,
              economicFactorsScore: 50,
              strategicPositionScore: 50,
              batnaScore: 50
            },
            reasoning: 'Assessment skipped - using default values'
          },
          completed_at: new Date().toISOString()
        })
      })
    } catch (error) { console.error('Error saving skip status:', error) }
    let nextUrl = `/auth/invite-providers?session_id=${sessionId}`
    if (contractId) nextUrl += `&contract_id=${contractId}`
    router.push(nextUrl)
  }

  // ========== SECTION 12: PROGRESS MENU COMPONENT ==========
  const ProgressMenu = () => {
    const overallProgress = getOverallProgress()
    const currentSectionId = getCurrentSectionId()
    return (
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Strategic Assessment</h3>
          <div className="mt-3">
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {questionnaireSections.map((section) => {
            const status = getSectionStatus(section.id)
            const progress = getSectionProgress(section.id)
            const isActive = currentSectionId === section.id
            return (
              <div key={section.id} className={`p-3 rounded-lg mb-2 transition-all ${isActive ? 'bg-blue-50 border border-blue-200' : status === 'complete' ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-transparent'}`}>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 ${status === 'complete' ? 'bg-green-100 text-green-600' : isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                    {status === 'complete' ? '✓' : section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${isActive ? 'text-blue-700' : status === 'complete' ? 'text-green-700' : 'text-slate-600'}`}>{section.name}</div>
                    {progress.total > 0 && <div className="text-xs text-slate-500 mt-0.5">{progress.answered}/{progress.total} questions</div>}
                  </div>
                </div>
                {progress.total > 0 && (
                  <div className="mt-2 ml-11">
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-300 ${status === 'complete' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(progress.answered / progress.total) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="p-4 border-t border-slate-200">
          <button onClick={handleSkipAssessment} disabled={isSkipping} className="w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
            {isSkipping ? 'Skipping...' : 'Skip → Invite Providers'}
          </button>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500">
            {sessionNumber && <div className="font-mono">{sessionNumber}</div>}
            {existingData?.companyName && <div className="truncate mt-1">{existingData.companyName}</div>}
          </div>
        </div>
      </div>
    )
  }

  // ========== SECTION 13: LOADING STATE ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your requirements...</p>
        </div>
      </div>
    )
  }

  // ========== SECTION 14: MAIN RENDER ==========
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ProgressMenu />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <h1 className="font-semibold text-slate-800">CLARENCE</h1>
                <p className="text-sm text-slate-500">Strategic Assessment</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={handleSkipAssessment} disabled={isSkipping} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
                {isSkipping ? 'Skipping...' : 'Skip Assessment →'}
              </button>
              {existingData && (
                <div className="text-right text-sm">
                  <p className="font-medium text-slate-700">{existingData.companyName}</p>
                  <p className="text-slate-500">{existingData.serviceRequired} • {formatCurrency(existingData.dealValue)}</p>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="bg-white border-b border-slate-200 px-6 py-3 lg:hidden">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Question {Math.min(currentQuestionIndex + 1, STRATEGIC_QUESTIONS.length)} of {STRATEGIC_QUESTIONS.length}</span>
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(currentQuestionIndex / STRATEGIC_QUESTIONS.length) * 100}%` }} />
            </div>
            {conversationComplete && <span className="text-green-600 font-medium">Complete ✓</span>}
          </div>
        </div>
        <div className="flex-1 p-6 overflow-hidden">
          <div className="max-w-3xl mx-auto h-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-4 ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-lg p-4">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {!conversationComplete ? (
                <div className="border-t border-slate-200 p-4">
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Type your response..." className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isTyping} />
                    <button type="submit" disabled={!userInput.trim() || isTyping} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">Send</button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-slate-200 p-4">
                  <button onClick={handleProceedToInviteProviders} className="w-full py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                    Invite Providers
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </button>
                  <p className="text-center text-sm text-slate-500 mt-3">Send invitations to your providers to begin the negotiation</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== SECTION 15: EXPORT ==========
export default function StrategicAssessmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <IntelligentQuestionnaireContent />
    </Suspense>
  )
}