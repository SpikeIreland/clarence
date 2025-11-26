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
  // Contract positions
  liabilityCap: number
  paymentTerms: number
  slaTarget: number
  terminationNotice: number
  // Priorities
  priorities: {
    cost: number
    quality: number
    speed: number
    innovation: number
    riskMitigation: number
  }
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
  context?: (data: ExistingRequirements) => string
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
    question: "How quickly could you realistically execute that Plan B? Be honest - I need to understand your true timeline pressure.",
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
        const response = await fetch(`https://clairence.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sid}`)

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
  const mapApiResponseToRequirements = (data: any): ExistingRequirements => {
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
    const transitionMessage = `Now I need to understand the strategic dynamics that will shape your negotiating position. These questions will help me calculate your true leverage and recommend defensible first-draft positions.

Let's start with your alternatives...`

    addClarenceMessage(transitionMessage)

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Ask first strategic question
    askStrategicQuestion(0, data)

    setIsTyping(false)
  }

  // ========== SECTION 10: GENERATE INTELLIGENT OPENING ==========
  const generateIntelligentOpening = (data: ExistingRequirements): string => {
    const priorityRanking = getPriorityRanking(data.priorities)
    const timeline = getTimelineDescription(data.decisionTimeline)

    return `Good to continue, ${data.contactName || 'there'}. I've reviewed your requirements submission for **${data.companyName}**.

Here's what I understand:

**The Deal:**
• ${data.serviceRequired || 'Service'} contract worth ${formatCurrency(data.dealValue)}
• ${data.serviceCriticality || 'Business critical'} to your operations
• ${data.numberOfBidders || '2-3'} providers in consideration

**Your Position:**
• ${data.incumbentStatus === 'Replacing Provider' || data.incumbentStatus === 'replacing-incumbent' ? 'Replacing an underperforming incumbent' : data.incumbentStatus === 'no-incumbent' ? 'New engagement - no incumbent' : data.incumbentStatus || 'New engagement'}
• Timeline: ${timeline}
• Switching costs assessed as: ${data.switchingCosts || 'Moderate'}

**Your Priorities (from highest):**
${priorityRanking}

**Your Starting Positions:**
• Liability cap: ${data.liabilityCap}% of annual value
• Payment terms: ${data.paymentTerms} days
• SLA target: ${data.slaTarget}% uptime
• Termination notice: ${data.terminationNotice} days

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

    addClarenceMessage("Thank you. I now have everything I need to calculate your leverage position and generate defensible first-draft positions.")

    await new Promise(resolve => setTimeout(resolve, 1500))

    // Calculate leverage based on strategic answers - aligned with algorithm spec
    const leverage = calculateLeverage()
    setLeverageAssessment(leverage)

    const summaryMessage = `**Leverage Assessment Complete**

Based on your strategic inputs:

**Customer Leverage: ${leverage.customerLeverage}%**
**Provider Leverage: ${leverage.providerLeverage}%**

**Breakdown (25% weight each):**
• Market Dynamics: ${leverage.breakdown.marketDynamicsScore}/100
• Economic Factors: ${leverage.breakdown.economicFactorsScore}/100
• Strategic Position: ${leverage.breakdown.strategicPositionScore}/100
• BATNA Analysis: ${leverage.breakdown.batnaScore}/100

${leverage.reasoning}

I'm now ready to generate your first-draft positions across all contract clauses. These will be calibrated to your leverage position and defensible based on the market data and strategic context you've provided.

Click "Generate Positions" to proceed to the Contract Studio.`

    addClarenceMessage(summaryMessage)

    setIsTyping(false)
    setConversationComplete(true)
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

    // Save strategic answers and leverage assessment to backend
    try {
      const response = await fetch('https://clairence.app.n8n.cloud/webhook/strategic-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          session_number: sessionNumber,
          strategic_answers: strategicAnswers,
          leverage_assessment: leverageAssessment,
          completed_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        console.error('Failed to save strategic assessment:', await response.text())
      }
    } catch (error) {
      console.error('Error saving assessment:', error)
      // Continue anyway - don't block navigation for save errors
    }

    // Navigate to Contract Studio
    router.push(`/auth/contract-studio?session_id=${sessionId}`)
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
    <div className="min-h-screen bg-slate-50">
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

      {/* Progress Indicator */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-4xl mx-auto">
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
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">

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
                className="w-full py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                Generate Positions & Open Contract Studio
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          )}
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