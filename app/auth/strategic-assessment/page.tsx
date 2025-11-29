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
  // From customer requirements form
  companyName: string
  companySize: string
  annualRevenue: string
  industry: string
  contactName: string
  contactEmail: string
  // Market context
  numberOfBidders: string
  marketPosition: string
  dealValue: string
  decisionTimeline: string
  incumbentStatus: string
  switchingCosts: string
  // Service
  serviceRequired: string
  serviceCriticality: string
  businessChallenge: string
  desiredOutcome: string
  // BATNA (may be partial from form)
  alternativeOptions: string
  inHouseCapability: string
  walkAwayPoint: string
  budgetFlexibility: string
  // Contract positions - individual fields (legacy)
  liabilityCap?: number
  paymentTerms?: number
  slaTarget?: number
  terminationNotice?: number
  // Contract positions - nested object (from API)
  contractPositions?: {
    liabilityCap?: number
    paymentTerms?: number
    slaTarget?: number
    dataRetention?: number
    terminationNotice?: number
  } | string
  // Priorities - can be object or JSON string from API
  priorities?: {
    cost: number
    quality: number
    speed: number
    innovation: number
    riskMitigation: number
  } | string
}

interface StrategicAnswers {
  // Deep BATNA probing
  batnaSpecifics: string
  batnaTimeline: string
  batnaRealismScore: string
  // Red lines
  absoluteRedLines: string
  flexibleAreas: string
  // Risk tolerance
  riskAppetite: string
  worstCaseScenario: string
  // Internal dynamics
  stakeholderPressure: string
  internalPolitics: string
  // Relationship priorities
  relationshipVsTerms: string
  longTermVision: string
  // Provider-specific
  providerConcerns: string
  trustLevel: string
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

// ========================================================================
// SECTION 1.5: DISPLAY FORMATTING HELPERS
// ========================================================================

// Format incumbent status for display
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

// Format timeline for display
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

// Format criticality for display
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

// Format switching costs for display
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

// Format currency value
const formatCurrency = (value: string | number): string => {
  if (!value) return 'Not specified'
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value
  if (isNaN(num)) return String(value)
  if (num >= 1000000) return `£${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `£${(num / 1000).toFixed(0)}K`
  return `£${num.toLocaleString()}`
}

// Format priorities for display (sorted by points)
const formatPrioritiesDisplay = (
  priorities: Record<string, number> | string | null | undefined
): string => {
  if (!priorities) return 'Not specified'

  // Parse if string
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

// Format number of bidders for display
const getBiddersDisplay = (bidders: string): string => {
  if (!bidders) return 'Not specified'
  if (bidders === '1') return 'Sole source (1 provider)'
  if (bidders === '7+') return 'Highly competitive (7+ providers)'
  return `${bidders} providers in consideration`
}

// ========== SECTION 2: STRATEGIC QUESTIONS ==========
// These are the INTELLIGENT questions that go beyond the form
const STRATEGIC_QUESTIONS: StrategicQuestion[] = [
  {
    key: 'batnaSpecifics',
    question: "You mentioned having alternative options. Walk me through your Plan B specifically - if this provider walked away tomorrow, what would you actually do?",
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
  },
  {
    key: 'providerConcerns',
    question: "What worries you most about this provider specifically? Any concerns you haven't raised yet?",
  },
  {
    key: 'trustLevel',
    question: "Based on your interactions so far, how much do you trust this provider to deliver? And what would increase that trust?",
  }
]

// ========== SECTION 3: MAIN COMPONENT ==========
function IntelligentQuestionnaireContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ========================================================================
  // SECTION 3A: PROGRESS TRACKING FOR QUESTIONNAIRE
  // ========================================================================

  // Define questionnaire sections matching STRATEGIC_QUESTIONS
  const questionnaireSections = [
    {
      id: 'summary',
      name: 'Requirements Summary',
      icon: '📋',
      questionIndices: [] as number[],
    },
    {
      id: 'batna',
      name: 'BATNA Deep Dive',
      icon: '⚖️',
      questionIndices: [0, 1, 2],
    },
    {
      id: 'redlines',
      name: 'Red Lines & Flexibility',
      icon: '🚫',
      questionIndices: [3, 4],
    },
    {
      id: 'risk',
      name: 'Risk Tolerance',
      icon: '⚠️',
      questionIndices: [5, 6],
    },
    {
      id: 'internal',
      name: 'Internal Dynamics',
      icon: '🏢',
      questionIndices: [7, 8],
    },
    {
      id: 'relationship',
      name: 'Relationship Priorities',
      icon: '🤝',
      questionIndices: [9, 10],
    },
    {
      id: 'trust',
      name: 'Provider Trust',
      icon: '🔍',
      questionIndices: [11, 12],
    },
    {
      id: 'complete',  // Changed from 'result'
      name: 'Invite Provider',  // Changed from 'Leverage Result'
      icon: '✉️',  // Changed from '🏆'
      questionIndices: [] as number[],
    }
  ]

  // Calculate which section the current question belongs to
  const getCurrentSectionId = (): string => {
    if (conversationComplete) return 'complete'  // Changed from 'result'
    if (currentQuestionIndex === 0 && messages.length <= 2) return 'summary'

    for (const section of questionnaireSections) {
      if (section.questionIndices.includes(currentQuestionIndex)) {
        return section.id
      }
    }
    return 'summary'
  }

  // Calculate section completion status
  const getSectionStatus = (sectionId: string): 'complete' | 'current' | 'pending' => {
    const section = questionnaireSections.find(s => s.id === sectionId)
    if (!section) return 'pending'

    if (sectionId === 'summary') return 'complete'
    if (sectionId === 'complete') return conversationComplete ? 'complete' : 'pending'  // Changed from 'result'

    if (section.questionIndices.length === 0) return 'pending'

    const maxIndex = Math.max(...section.questionIndices)
    const minIndex = Math.min(...section.questionIndices)

    if (currentQuestionIndex > maxIndex) return 'complete'
    if (currentQuestionIndex >= minIndex && currentQuestionIndex <= maxIndex) return 'current'
    return 'pending'
  }

  // Calculate section progress (answered/total)
  const getSectionProgress = (sectionId: string): { answered: number; total: number } => {
    const section = questionnaireSections.find(s => s.id === sectionId)
    if (!section || section.questionIndices.length === 0) return { answered: 0, total: 0 }

    const answered = section.questionIndices.filter(idx => {
      const questionKey = STRATEGIC_QUESTIONS[idx]?.key
      return questionKey && strategicAnswers[questionKey]
    }).length

    return { answered, total: section.questionIndices.length }
  }

  // Calculate overall progress percentage
  const getOverallProgress = (): number => {
    const totalQuestions = STRATEGIC_QUESTIONS.length
    const answeredQuestions = Object.keys(strategicAnswers).length
    return Math.round((answeredQuestions / totalQuestions) * 100)
  }

  // ========== SECTION 4: STATE ==========
  const [loading, setLoading] = useState(true)
  const [existingData, setExistingData] = useState<ExistingRequirements | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [strategicAnswers, setStrategicAnswers] = useState<Partial<StrategicAnswers>>({})
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionNumber, setSessionNumber] = useState<string | null>(null)
  const [conversationComplete, setConversationComplete] = useState(false)
  const [leverageAssessment, setLeverageAssessment] = useState<LeverageAssessment | null>(null)

  // ========== SECTION 5: LOAD EXISTING DATA ==========
  useEffect(() => {
    const loadExistingRequirements = async () => {
      const sid = searchParams.get('session_id')
      if (!sid) {
        setLoading(false)
        return
      }

      setSessionId(sid)

      try {
        // FIXED: Use correct API endpoint
        const response = await fetch(`https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sid}`)

        if (response.ok) {
          const data = await response.json()

          // Store session number for later
          setSessionNumber(data.sessionNumber || null)

          // FIXED: Map nested API response to our flat interface
          const requirements: ExistingRequirements = mapApiResponseToRequirements(data)

          setExistingData(requirements)

          // Start intelligent conversation
          startIntelligentConversation(requirements)
        } else {
          // No existing data - shouldn't happen in normal flow
          addClarenceMessage("I don't have your requirements data yet. Please complete the Customer Requirements form first.")
        }
      } catch (error) {
        console.error('Error loading requirements:', error)
        addClarenceMessage("I had trouble loading your requirements. Let me try a different approach...")
      }

      setLoading(false)
    }

    loadExistingRequirements()
  }, [searchParams])

  // ========== SECTION 6: MAP API RESPONSE ==========
  interface ApiResponseData {
    requirements?: {
      serviceRequired?: string
      serviceCriticality?: string
      businessChallenge?: string
      desiredOutcome?: string
      budget?: { dealValue?: string }
      commercial?: { paymentTermsRequired?: number }
      riskCompliance?: {
        minimumLiabilityCap?: number
        minimumAvailabilityGuarantee?: number
        terminationNoticeDays?: number
      }
    }
    customer?: { company?: string }
    metadata?: { industry?: string }
    sessionNumber?: string
    company_name?: string
    companyName?: string
    company_size?: string
    companySize?: string
    annual_revenue?: string
    annualRevenue?: string
    industry?: string
    contact_name?: string
    contactName?: string
    contact_email?: string
    contactEmail?: string
    number_of_bidders?: string
    numberOfBidders?: string
    market_position?: string
    marketPosition?: string
    deal_value?: string
    dealValue?: string
    decision_timeline?: string
    decisionTimeline?: string
    incumbent_status?: string
    incumbentStatus?: string
    switching_costs?: string
    switchingCosts?: string
    service_required?: string
    serviceRequired?: string
    service_criticality?: string
    service_criticality_text?: string
    serviceCriticality?: string
    business_challenge?: string
    businessChallenge?: string
    desired_outcome?: string
    desiredOutcome?: string
    alternative_options?: string
    alternativeOptions?: string
    in_house_capability?: string
    inHouseCapability?: string
    walk_away_point?: string
    walkAwayPoint?: string
    budget_flexibility?: string
    budget_flexibility_text?: string
    budgetFlexibility?: string
    contractPositions?: string | {
      liabilityCap?: number
      paymentTerms?: number
      slaTarget?: number
      terminationNotice?: number
    }
    priorities?: string | {
      cost?: number
      quality?: number
      speed?: number
      innovation?: number
      riskMitigation?: number
    }
  }

  const mapApiResponseToRequirements = (data: ApiResponseData): ExistingRequirements => {
    // Handle both flat and nested response structures
    const requirements = data.requirements || {}
    const customer = data.customer || {}
    const metadata = data.metadata || {}

    // Try to get contract positions from JSON field
    let contractPositions = { liabilityCap: 0, paymentTerms: 0, slaTarget: 0, terminationNotice: 0 }
    try {
      if (data.contractPositions) {
        contractPositions = typeof data.contractPositions === 'string'
          ? JSON.parse(data.contractPositions)
          : data.contractPositions
      } else if (requirements.commercial) {
        contractPositions = {
          liabilityCap: requirements.riskCompliance?.minimumLiabilityCap || 0,
          paymentTerms: requirements.commercial?.paymentTermsRequired || 0,
          slaTarget: requirements.riskCompliance?.minimumAvailabilityGuarantee || 0,
          terminationNotice: requirements.riskCompliance?.terminationNoticeDays || 0
        }
      }
    } catch (e) {
      console.error('Error parsing contract positions:', e)
    }

    // Try to get priorities from JSON field
    let priorities = { cost: 0, quality: 0, speed: 0, innovation: 0, riskMitigation: 0 }
    try {
      if (data.priorities) {
        priorities = typeof data.priorities === 'string'
          ? JSON.parse(data.priorities)
          : data.priorities
      }
    } catch (e) {
      console.error('Error parsing priorities:', e)
    }

    return {
      // Company info - check both flat and nested
      companyName: data.company_name || customer.company || data.companyName || '',
      companySize: data.company_size || data.companySize || '',
      annualRevenue: data.annual_revenue || data.annualRevenue || '',
      industry: data.industry || metadata.industry || '',
      contactName: data.contact_name || data.contactName || '',
      contactEmail: data.contact_email || data.contactEmail || '',

      // Market context
      numberOfBidders: data.number_of_bidders || data.numberOfBidders || '',
      marketPosition: data.market_position || data.marketPosition || '',
      dealValue: data.deal_value || requirements.budget?.dealValue || data.dealValue || '',
      decisionTimeline: data.decision_timeline || data.decisionTimeline || '',
      incumbentStatus: data.incumbent_status || data.incumbentStatus || '',
      switchingCosts: data.switching_costs || data.switchingCosts || '',

      // Service
      serviceRequired: data.service_required || requirements.serviceRequired || data.serviceRequired || '',
      serviceCriticality: data.service_criticality || data.service_criticality_text || requirements.serviceCriticality || data.serviceCriticality || '',
      businessChallenge: data.business_challenge || requirements.businessChallenge || data.businessChallenge || '',
      desiredOutcome: data.desired_outcome || requirements.desiredOutcome || data.desiredOutcome || '',

      // BATNA
      alternativeOptions: data.alternative_options || data.alternativeOptions || '',
      inHouseCapability: data.in_house_capability || data.inHouseCapability || '',
      walkAwayPoint: data.walk_away_point || data.walkAwayPoint || '',
      budgetFlexibility: data.budget_flexibility || data.budget_flexibility_text || data.budgetFlexibility || '',

      // Contract positions
      liabilityCap: contractPositions.liabilityCap || 0,
      paymentTerms: contractPositions.paymentTerms || 0,
      slaTarget: contractPositions.slaTarget || 0,
      terminationNotice: contractPositions.terminationNotice || 0,

      // Priorities
      priorities
    }
  }

  // ========== SECTION 7: SCROLL TO BOTTOM ==========
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ========== SECTION 8: MESSAGE HELPERS ==========
  const addClarenceMessage = (content: string, questionKey?: QuestionKey) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'clarence',
      content,
      timestamp: new Date(),
      questionKey
    }
    setMessages(prev => [...prev, message])
  }

  const addUserMessage = (content: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, message])
  }

  // ========== SECTION 9: INTELLIGENT OPENING ==========
  const startIntelligentConversation = async (data: ExistingRequirements) => {
    setIsTyping(true)

    // Brief pause for natural feel
    await new Promise(resolve => setTimeout(resolve, 800))

    // INTELLIGENT OPENING - Shows we already know the basics
    const openingMessage = generateIntelligentOpening(data)
    addClarenceMessage(openingMessage)

    await new Promise(resolve => setTimeout(resolve, 1500))

    // Transition to strategic questions
    const transitionMessage = `These questions will help me calculate your true leverage and recommend defensible first-draft positions.

Let's start with your alternatives...`

    addClarenceMessage(transitionMessage)

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Ask first strategic question
    askStrategicQuestion(0, data)

    setIsTyping(false)
  }

  // ========================================================================
  // SECTION 10: GENERATE INTELLIGENT OPENING
  // ========================================================================
  const generateIntelligentOpening = (data: ExistingRequirements): string => {
    const priorityRanking = formatPrioritiesDisplay(data.priorities)
    const timeline = getTimelineDisplay(data.decisionTimeline)

    // Parse contract positions if needed
    let positions: {
      liabilityCap?: number
      paymentTerms?: number
      slaTarget?: number
      dataRetention?: number
      terminationNotice?: number
    } = {}

    if (data.contractPositions) {
      if (typeof data.contractPositions === 'string') {
        try {
          positions = JSON.parse(data.contractPositions)
        } catch {
          positions = {}
        }
      } else {
        positions = data.contractPositions
      }
    }

    // Get position values with defaults
    const liabilityCap = positions.liabilityCap ?? data.liabilityCap ?? 0
    const paymentTerms = positions.paymentTerms ?? data.paymentTerms ?? 0
    const slaTarget = positions.slaTarget ?? data.slaTarget ?? 0
    const terminationNotice = positions.terminationNotice ?? data.terminationNotice ?? 0

    return `Good to meet you, ${data.contactName || data.companyName || 'there'}. I've reviewed your requirements submission for **${data.companyName}**.

Here's what I understand:

**The Deal:**
- ${data.serviceRequired || 'Service'} contract worth ${formatCurrency(data.dealValue)}
- ${getCriticalityDisplay(data.serviceCriticality)}
- ${getBiddersDisplay(data.numberOfBidders)}

**Your Position:**
- ${getIncumbentDisplay(data.incumbentStatus)}
- Timeline: ${timeline}
- Switching costs: ${getSwitchingCostsDisplay(data.switchingCosts)}

**Your Priorities (from highest):**
${priorityRanking}

**Your Starting Positions:**
- Liability cap: ${liabilityCap}% of annual value
- Payment terms: ${paymentTerms} days
- SLA target: ${slaTarget}% uptime
- Termination notice: ${terminationNotice} days

I have the facts. Now I need to understand the *dynamics* that will determine your leverage.`
  }

  // ========== SECTION 11: HELPER FUNCTIONS ==========
  const getPriorityRanking = (priorities: ExistingRequirements['priorities']): string => {
    if (!priorities || Object.values(priorities).every(v => v === 0)) {
      return '• Not specified'
    }

    const labels: Record<string, string> = {
      cost: 'Cost Optimization',
      quality: 'Quality Standards',
      speed: 'Speed of Delivery',
      innovation: 'Innovation & Technology',
      riskMitigation: 'Risk Mitigation'
    }

    const sorted = Object.entries(priorities)
      .filter(([, value]) => value > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([key, value], index) => `${index + 1}. ${labels[key] || key} (${value} points)`)

    return sorted.length > 0 ? sorted.join('\n') : '• Not specified'
  }

  const getTimelineDescription = (timeline: string): string => {
    const descriptions: Record<string, string> = {
      'Urgent': 'Under pressure - less than 2 weeks',
      'Normal': 'Standard - within 1 month',
      'Flexible': 'Relaxed - 1-3 months',
      'No Rush': 'No time pressure',
      'urgent': 'Under pressure - less than 2 weeks',
      'normal': 'Standard - within 1 month',
      'flexible': 'Relaxed - 1-3 months',
      'no-rush': 'No time pressure'
    }
    return descriptions[timeline] || timeline || 'Not specified'
  }

  const formatCurrency = (value: string): string => {
    if (!value) return 'Not specified'
    const num = parseFloat(value.replace(/[^0-9.]/g, ''))
    if (isNaN(num)) return value
    if (num >= 1000000) return `£${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `£${(num / 1000).toFixed(0)}K`
    return `£${num}`
  }

  // ========== SECTION 12: ASK STRATEGIC QUESTION ==========
  const askStrategicQuestion = async (index: number, data: ExistingRequirements) => {
    if (index >= STRATEGIC_QUESTIONS.length) {
      // All questions answered - proceed to assessment
      await completeAssessment()
      return
    }

    const question = STRATEGIC_QUESTIONS[index]
    let questionText = question.question

    // Replace placeholders with actual data
    questionText = questionText.replace('{providerName}', 'this provider')
    questionText = questionText.replace('{companyName}', data.companyName || 'your company')

    // Add context if available
    if (question.context) {
      const context = question.context(data)
      if (context) {
        questionText = `${context}\n\n${questionText}`
      }
    }

    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 600))
    addClarenceMessage(questionText, question.key)
    setIsTyping(false)
  }

  // ========== SECTION 13: HANDLE USER RESPONSE ==========
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userInput.trim() || isTyping) return

    const input = userInput.trim()
    setUserInput('')
    addUserMessage(input)

    // Store the answer
    const currentQuestion = STRATEGIC_QUESTIONS[currentQuestionIndex]
    if (currentQuestion) {
      setStrategicAnswers(prev => ({
        ...prev,
        [currentQuestion.key]: input
      }))
    }

    // Move to next question
    const nextIndex = currentQuestionIndex + 1
    setCurrentQuestionIndex(nextIndex)

    // Small acknowledgment before next question
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 500))

    const acknowledgments = [
      "Got it.",
      "Understood.",
      "That's helpful context.",
      "Clear.",
      "Noted.",
      "Important to know.",
      "That tells me a lot."
    ]

    // Don't acknowledge on every question - feels more natural
    if (Math.random() > 0.5 && nextIndex < STRATEGIC_QUESTIONS.length) {
      addClarenceMessage(acknowledgments[Math.floor(Math.random() * acknowledgments.length)])
      await new Promise(resolve => setTimeout(resolve, 400))
    }

    // Ask next question or complete
    if (existingData) {
      askStrategicQuestion(nextIndex, existingData)
    }
  }

  // ========== SECTION 14: COMPLETE ASSESSMENT ==========
  const completeAssessment = async () => {
    setIsTyping(true)

    await new Promise(resolve => setTimeout(resolve, 1000))

    addClarenceMessage("Thank you. I now have a complete picture of your strategic position and priorities.")

    await new Promise(resolve => setTimeout(resolve, 1500))

    // Calculate PRELIMINARY customer-side factors only
    // Full leverage calculation happens AFTER provider intake
    const customerFactors = calculateCustomerFactors()

    const summaryMessage = `**Strategic Assessment Complete**

I've captured your position on:

✓ **BATNA Analysis** - Your alternatives and fallback options
✓ **Red Lines** - What you absolutely won't compromise on
✓ **Flexibility Areas** - Where you have room to negotiate
✓ **Risk Tolerance** - How much uncertainty you can accept
✓ **Internal Dynamics** - Stakeholder pressures and politics
✓ **Relationship Priorities** - Partnership vs. commercial focus
✓ **Provider Trust** - Your confidence level and concerns

**What happens next:**

1. **Invite your provider** to complete their intake questionnaire
2. Once they submit, I'll calculate the **true leverage balance** using both parties' data
3. Then I'll generate **defensible first-draft positions** calibrated to that leverage

Your data is saved and ready. Click below to proceed to the Contract Studio where you can invite your provider.`

    addClarenceMessage(summaryMessage)

    // Store preliminary assessment (not full leverage yet)
    setLeverageAssessment({
      customerLeverage: 0, // Placeholder - calculated after provider intake
      providerLeverage: 0,
      breakdown: customerFactors,
      reasoning: "Full leverage calculation pending provider intake."
    })

    setIsTyping(false)
    setConversationComplete(true)
  }

  // ========== SECTION 14B: CALCULATE CUSTOMER-SIDE FACTORS ONLY ==========
  const calculateCustomerFactors = (): LeverageBreakdown => {
    // These are preliminary scores based on customer data only
    // Full leverage calculation requires provider data too

    let marketScore = 50
    let economicScore = 50
    let strategicScore = 50
    let batnaScore = 50

    // Market factors from customer perspective
    if (existingData?.numberOfBidders === '4+' || existingData?.numberOfBidders === '4-plus') {
      marketScore += 15
    } else if (existingData?.numberOfBidders === 'Single Source' || existingData?.numberOfBidders === 'single') {
      marketScore -= 20
    }

    if (existingData?.decisionTimeline === 'Urgent' || existingData?.decisionTimeline === 'urgent') {
      marketScore -= 10
    } else if (existingData?.decisionTimeline === 'Flexible' || existingData?.decisionTimeline === 'flexible') {
      marketScore += 10
    }

    // Economic factors
    if (existingData?.switchingCosts === 'High' || existingData?.switchingCosts === 'high') {
      economicScore -= 15
    } else if (existingData?.switchingCosts === 'Low' || existingData?.switchingCosts === 'low') {
      economicScore += 10
    }

    // Strategic factors
    if (existingData?.serviceCriticality === 'mission-critical') {
      strategicScore -= 10
    } else if (existingData?.serviceCriticality === 'non-core') {
      strategicScore += 10
    }

    // BATNA from questionnaire answers
    const batnaRealism = strategicAnswers.batnaRealismScore
    if (batnaRealism) {
      const score = parseInt(batnaRealism)
      if (!isNaN(score)) {
        if (score >= 8) batnaScore += 20
        else if (score >= 6) batnaScore += 10
        else if (score <= 4) batnaScore -= 15
      }
    }

    if (existingData?.alternativeOptions === 'many-alternatives' || existingData?.alternativeOptions === 'strong') {
      batnaScore += 10
    } else if (existingData?.alternativeOptions === 'no-alternatives' || existingData?.alternativeOptions === 'none') {
      batnaScore -= 15
    }

    return {
      marketDynamicsScore: Math.max(0, Math.min(100, marketScore)),
      economicFactorsScore: Math.max(0, Math.min(100, economicScore)),
      strategicPositionScore: Math.max(0, Math.min(100, strategicScore)),
      batnaScore: Math.max(0, Math.min(100, batnaScore))
    }
  }

  // ========== SECTION 15: CALCULATE LEVERAGE (ALIGNED WITH ALGORITHM SPEC) ==========
  const calculateLeverage = (): LeverageAssessment => {
    // Algorithm spec: 4 factors at 25% weight each
    // Each factor scored 0-100, then weighted average determines final leverage

    const factors: string[] = []

    // ===== MARKET DYNAMICS (25% weight) =====
    // Factors: Alternative providers, market conditions, time pressure, capacity constraints
    let marketScore = 50 // Neutral baseline

    // Number of bidders
    if (existingData?.numberOfBidders === '4+' || existingData?.numberOfBidders === '4-plus') {
      marketScore += 20
      factors.push("Strong competition: 4+ providers bidding")
    } else if (existingData?.numberOfBidders === '2-3') {
      marketScore += 10
      factors.push("Moderate competition: 2-3 providers in play")
    } else if (existingData?.numberOfBidders === 'Single Source' || existingData?.numberOfBidders === 'single') {
      marketScore -= 25
      factors.push("Single source: No competitive pressure")
    }

    // Timeline pressure
    if (existingData?.decisionTimeline === 'Urgent' || existingData?.decisionTimeline === 'urgent') {
      marketScore -= 15
      factors.push("Time pressure: Urgency reduces leverage")
    } else if (existingData?.decisionTimeline === 'Flexible' || existingData?.decisionTimeline === 'flexible' ||
      existingData?.decisionTimeline === 'No Rush' || existingData?.decisionTimeline === 'no-rush') {
      marketScore += 10
      factors.push("Flexible timeline: No urgency strengthens position")
    }

    marketScore = Math.max(0, Math.min(100, marketScore))

    // ===== ECONOMIC FACTORS (25% weight) =====
    // Factors: Deal size to revenue, switching costs, budget flexibility
    let economicScore = 50

    // Deal size attractiveness
    const dealValue = parseFloat((existingData?.dealValue || '0').replace(/[^0-9.]/g, ''))
    if (dealValue >= 1000000) {
      economicScore += 15
      factors.push("Large deal value: Very attractive to providers")
    } else if (dealValue >= 500000) {
      economicScore += 10
      factors.push("Significant deal value: Attractive to providers")
    }

    // Switching costs
    if (existingData?.switchingCosts === 'High' || existingData?.switchingCosts === 'high') {
      economicScore -= 15
      factors.push("High switching costs: Makes walking away expensive")
    } else if (existingData?.switchingCosts === 'Low' || existingData?.switchingCosts === 'low') {
      economicScore += 10
      factors.push("Low switching costs: Easier to change if needed")
    }

    // Budget flexibility
    if (existingData?.budgetFlexibility === 'high' || existingData?.budgetFlexibility === 'flexible') {
      economicScore += 5
    } else if (existingData?.budgetFlexibility === 'none' || existingData?.budgetFlexibility === 'fixed') {
      economicScore -= 5
    }

    economicScore = Math.max(0, Math.min(100, economicScore))

    // ===== STRATEGIC POSITION (25% weight) =====
    // Factors: Service criticality, incumbent advantage, reputational value
    let strategicScore = 50

    // Service criticality (cuts both ways - more critical = more provider leverage)
    if (existingData?.serviceCriticality === 'Mission Critical' || existingData?.serviceCriticality === 'mission-critical') {
      strategicScore -= 10
      factors.push("Mission critical service: Provider knows you need this")
    } else if (existingData?.serviceCriticality === 'business-critical') {
      strategicScore -= 5
    } else if (existingData?.serviceCriticality === 'Nice to Have' || existingData?.serviceCriticality === 'nice-to-have') {
      strategicScore += 10
      factors.push("Non-critical service: You can walk away easily")
    }

    // Incumbent status
    if (existingData?.incumbentStatus === 'no-incumbent') {
      strategicScore += 5
      factors.push("No incumbent: Fresh start, more options")
    } else if (existingData?.incumbentStatus === 'replacing-incumbent' || existingData?.incumbentStatus === 'Replacing Provider') {
      strategicScore += 10
      factors.push("Replacing incumbent: Demonstrated willingness to change")
    }

    strategicScore = Math.max(0, Math.min(100, strategicScore))

    // ===== BATNA ANALYSIS (25% weight) =====
    // Based on strategic questionnaire answers
    let batnaScore = 50

    // BATNA realism score (from questionnaire)
    const batnaRealism = strategicAnswers.batnaRealismScore
    if (batnaRealism) {
      const score = parseInt(batnaRealism)
      if (!isNaN(score)) {
        if (score >= 8) {
          batnaScore += 20
          factors.push("Strong BATNA: Your alternatives are credible (rated ${score}/10)")
        } else if (score >= 6) {
          batnaScore += 10
          factors.push("Moderate BATNA: Decent alternatives available")
        } else if (score <= 4) {
          batnaScore -= 15
          factors.push("Weak BATNA: Limited realistic alternatives")
        }
      }
    }

    // BATNA timeline
    if (strategicAnswers.batnaTimeline) {
      const timeline = strategicAnswers.batnaTimeline.toLowerCase()
      if (timeline.includes('immediate') || timeline.includes('week') || timeline.includes('quick')) {
        batnaScore += 10
        factors.push("Quick BATNA execution: Can pivot rapidly")
      } else if (timeline.includes('month') || timeline.includes('long') || timeline.includes('slow')) {
        batnaScore -= 5
      }
    }

    // Alternative options from form
    if (existingData?.alternativeOptions === 'many-alternatives' || existingData?.alternativeOptions === 'strong') {
      batnaScore += 10
    } else if (existingData?.alternativeOptions === 'no-alternatives' || existingData?.alternativeOptions === 'none') {
      batnaScore -= 15
    }

    // In-house capability
    if (existingData?.inHouseCapability === 'full' || existingData?.inHouseCapability === 'strong') {
      batnaScore += 10
      factors.push("In-house capability: Can do this internally if needed")
    } else if (existingData?.inHouseCapability === 'none') {
      batnaScore -= 5
    }

    batnaScore = Math.max(0, Math.min(100, batnaScore))

    // ===== CALCULATE WEIGHTED AVERAGE =====
    // Each factor is 25% weight per algorithm spec
    const customerLeverage = Math.round(
      (marketScore * 0.25) +
      (economicScore * 0.25) +
      (strategicScore * 0.25) +
      (batnaScore * 0.25)
    )

    // Clamp to reasonable range (no one has 0% or 100% leverage)
    const finalCustomerLeverage = Math.max(25, Math.min(75, customerLeverage))
    const finalProviderLeverage = 100 - finalCustomerLeverage

    return {
      customerLeverage: finalCustomerLeverage,
      providerLeverage: finalProviderLeverage,
      breakdown: {
        marketDynamicsScore: marketScore,
        economicFactorsScore: economicScore,
        strategicPositionScore: strategicScore,
        batnaScore: batnaScore
      },
      reasoning: factors.length > 0
        ? "**Key factors:**\n• " + factors.join("\n• ")
        : "Assessment based on market dynamics and strategic positioning."
    }
  }

  // ========== SECTION 16: PROCEED TO STUDIO ==========
  const handleProceedToStudio = async () => {
    if (!sessionId) return

    // Save strategic answers (NOT leverage - that comes later)
    try {
      const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/strategic-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_number: sessionNumber,
          strategic_answers: strategicAnswers,
          customer_factors: leverageAssessment?.breakdown, // Preliminary factors only
          status: 'customer_assessment_complete', // Not 'leverage_calculated'
          completed_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        console.error('Failed to save strategic assessment:', await response.text())
      }
    } catch (error) {
      console.error('Error saving assessment:', error)
    }

    // Navigate to Contract Studio (which should show "Invite Provider" state)
    router.push(`/auth/invite-providers?session_id=${sessionId}&session_number=${sessionNumber}&status=pending_provider`)
  }

  // ========================================================================
  // SECTION 16B: PROGRESS MENU COMPONENT
  // ========================================================================
  const ProgressMenu = () => {
    const overallProgress = getOverallProgress()
    const currentSectionId = getCurrentSectionId()

    return (
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Strategic Assessment</h3>
          <div className="mt-3">
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Section List */}
        <div className="flex-1 overflow-y-auto p-3">
          {questionnaireSections.map((section) => {
            const status = getSectionStatus(section.id)
            const progress = getSectionProgress(section.id)
            const isActive = currentSectionId === section.id

            return (
              <div
                key={section.id}
                className={`p-3 rounded-lg mb-2 transition-all ${isActive
                  ? 'bg-blue-50 border border-blue-200'
                  : status === 'complete'
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-slate-50 border border-transparent'
                  }`}
              >
                <div className="flex items-center">
                  {/* Status indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 ${status === 'complete'
                    ? 'bg-green-100 text-green-600'
                    : isActive
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-slate-200 text-slate-400'
                    }`}>
                    {status === 'complete' ? '✓' : section.icon}
                  </div>

                  {/* Section info */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${isActive ? 'text-blue-700' :
                      status === 'complete' ? 'text-green-700' : 'text-slate-600'
                      }`}>
                      {section.name}
                    </div>

                    {progress.total > 0 && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {progress.answered}/{progress.total} questions
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar for sections with questions */}
                {progress.total > 0 && (
                  <div className="mt-2 ml-11">
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${status === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                        style={{ width: `${(progress.answered / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer with session info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500">
            {sessionNumber && <div className="font-mono">{sessionNumber}</div>}
            {existingData?.companyName && (
              <div className="truncate mt-1">{existingData.companyName}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ========== SECTION 17: LOADING STATE ==========
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

  // ========== SECTION 18: RENDER ==========
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Progress Menu */}
      <ProgressMenu />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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

            {existingData && (
              <div className="text-right text-sm">
                <p className="font-medium text-slate-700">{existingData.companyName}</p>
                <p className="text-slate-500">{existingData.serviceRequired} • {formatCurrency(existingData.dealValue)}</p>
              </div>
            )}
          </div>
        </header>

        {/* Progress Bar (Mobile/Compact) */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 lg:hidden">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Question {Math.min(currentQuestionIndex + 1, STRATEGIC_QUESTIONS.length)} of {STRATEGIC_QUESTIONS.length}</span>
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${(currentQuestionIndex / STRATEGIC_QUESTIONS.length) * 100}%` }}
              />
            </div>
            {conversationComplete && (
              <span className="text-green-600 font-medium">Complete ✓</span>
            )}
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="max-w-3xl mx-auto h-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                        }`}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content.split('**').map((part, i) =>
                          i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                        )}
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

              {/* Input Area */}
              {!conversationComplete ? (
                <div className="border-t border-slate-200 p-4">
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Type your response..."
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isTyping}
                    />
                    <button
                      type="submit"
                      disabled={!userInput.trim() || isTyping}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Send
                    </button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-slate-200 p-4">
                  <button
                    onClick={handleProceedToStudio}
                    className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Proceed to Contract Studio & Invite Provider
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== SECTION 19: EXPORT WITH SUSPENSE ==========
export default function StrategicAssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <IntelligentQuestionnaireContent />
    </Suspense>
  )
}