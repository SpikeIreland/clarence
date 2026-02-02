'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// TransitionModal for stage transitions
import { TransitionModal } from '@/app/components/create-phase/TransitionModal'
import type { TransitionConfig } from '@/lib/pathway-utils'
import { CreateProgressBar } from '@/app/components/create-phase/CreateProgressHeader';
import FeedbackButton from '@/app/components/FeedbackButton'
import { Link } from 'lucide-react'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

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
  // WP2: Tendering question
  qualificationThreshold: string
}

type QuestionKey = keyof StrategicAnswers

interface StrategicQuestion {
  key: QuestionKey
  question: string
  shortQuestion?: string  // WP2: Abbreviated version for PM pathways
  followUp?: string
  context?: (data: ExistingRequirements) => string | undefined
  category: 'batna' | 'redlines' | 'risk' | 'internal' | 'relationship' | 'tendering'
  priority: 'core' | 'extended'  // WP2: Core questions for all, extended for FM only
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

interface TransitionState {
  isOpen: boolean
  transition: TransitionConfig | null
  redirectUrl: string | null
}

// WP2: Assessment mode based on pathway
type AssessmentMode = 'full' | 'abbreviated' | 'fast-track'

// ============================================================================
// SECTION 2: DISPLAY HELPERS
// ============================================================================

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

// ============================================================================
// SECTION 3: STRATEGIC QUESTIONS (WP2 ENHANCED)
// ============================================================================

const ALL_STRATEGIC_QUESTIONS: StrategicQuestion[] = [
  // BATNA Questions (Category: batna)
  {
    key: 'batnaSpecifics',
    question: "You mentioned having alternative options. Walk me through your Plan B specifically - if negotiations with your preferred provider(s) fell through tomorrow, what would you actually do?",
    shortQuestion: "Briefly describe your backup plan if this negotiation fails.",
    context: (data) => data.numberOfBidders ? `I see you've identified ${data.numberOfBidders} competing providers.` : undefined,
    category: 'batna',
    priority: 'core'
  },
  {
    key: 'batnaTimeline',
    question: "How quickly could you realistically execute that Plan B? I need to understand your true timeline pressure.",
    shortQuestion: "How long would it take to execute your backup plan?",
    category: 'batna',
    priority: 'extended'
  },
  {
    key: 'batnaRealismScore',
    question: "On a scale of 1-10, how confident are you that your backup option would actually work as well as your preferred choice? And why?",
    shortQuestion: "Rate your backup plan confidence (1-10).",
    category: 'batna',
    priority: 'core'
  },

  // Red Lines Questions (Category: redlines)
  {
    key: 'absoluteRedLines',
    question: "What are your absolute red lines - the terms where you'd walk away from this deal entirely, even if everything else was perfect?",
    shortQuestion: "What are your absolute deal-breakers?",
    category: 'redlines',
    priority: 'core'
  },
  {
    key: 'flexibleAreas',
    question: "Conversely, where do you have genuine flexibility? What could you concede without significant pain?",
    shortQuestion: "Where do you have flexibility to concede?",
    category: 'redlines',
    priority: 'core'
  },

  // Risk Questions (Category: risk)
  {
    key: 'riskAppetite',
    question: "How would your board react if this provider relationship failed in 12 months? Is this a career-defining decision for anyone?",
    shortQuestion: "What's the internal consequence if this fails?",
    category: 'risk',
    priority: 'extended'
  },
  {
    key: 'worstCaseScenario',
    question: "Paint me the worst case scenario if negotiations break down completely. How bad would that actually be for the business?",
    shortQuestion: "What's your worst-case scenario?",
    category: 'risk',
    priority: 'core'
  },

  // Internal Dynamics Questions (Category: internal)
  {
    key: 'stakeholderPressure',
    question: "Who else needs this deal to happen, and why? Any internal stakeholders pushing for a quick resolution?",
    shortQuestion: "Who internally is pushing for this deal?",
    category: 'internal',
    priority: 'extended'
  },
  {
    key: 'internalPolitics',
    question: "Is there anything politically sensitive I should know? Previous failed relationships, internal champions for this provider, or competing priorities?",
    shortQuestion: "Any internal politics I should know about?",
    category: 'internal',
    priority: 'extended'
  },

  // Relationship Questions (Category: relationship)
  {
    key: 'relationshipVsTerms',
    question: "If you had to choose: would you prefer better commercial terms or a stronger long-term partnership? What matters more for this engagement?",
    shortQuestion: "Do you prioritize terms or relationship?",
    category: 'relationship',
    priority: 'core'
  },
  {
    key: 'longTermVision',
    question: "Where do you see this provider relationship in 3-5 years? Is this a tactical fix or strategic partnership?",
    shortQuestion: "Is this tactical or strategic long-term?",
    category: 'relationship',
    priority: 'extended'
  },

  // WP2: Tendering Question (Category: tendering) - Only shown for multi-provider scenarios
  {
    key: 'qualificationThreshold',
    question: "You're evaluating multiple providers. What minimum alignment percentage would a provider need to meet to stay in consideration? (e.g., 60%, 70%, 80%)",
    shortQuestion: "Minimum provider alignment % to qualify?",
    category: 'tendering',
    priority: 'core'
  }
]

// ============================================================================
// SECTION 4: DEFAULT VALUES FOR FAST-TRACK (STC)
// ============================================================================

const generateDefaultAnswers = (data: ExistingRequirements): Partial<StrategicAnswers> => {
  // Generate sensible defaults based on deal context
  const isHighValue = data.dealValue && parseFloat(data.dealValue.replace(/[^0-9.]/g, '')) > 250000
  const isUrgent = data.decisionTimeline === 'Urgent' || data.decisionTimeline === 'urgent'
  const hasAlternatives = data.numberOfBidders && parseInt(data.numberOfBidders) > 1

  return {
    batnaSpecifics: hasAlternatives
      ? `Alternative providers available (${data.numberOfBidders} in consideration)`
      : 'Limited alternatives - primary provider preferred',
    batnaTimeline: isUrgent ? '2-4 weeks' : '4-8 weeks',
    batnaRealismScore: hasAlternatives ? '7' : '4',
    absoluteRedLines: 'Standard commercial terms apply - no specific red lines identified',
    flexibleAreas: 'Open to reasonable adjustments on timeline and payment terms',
    riskAppetite: isHighValue ? 'Moderate - requires thorough due diligence' : 'Standard business risk',
    worstCaseScenario: 'Delay to project timeline; seek alternative provider',
    stakeholderPressure: 'Normal procurement process - no unusual pressure',
    internalPolitics: 'Standard approval process applies',
    relationshipVsTerms: 'Balanced approach - good terms with reliable delivery',
    longTermVision: data.serviceCriticality === 'mission-critical' ? 'Strategic partnership' : 'Tactical engagement',
    qualificationThreshold: hasAlternatives ? '65' : 'N/A - single provider'
  }
}

// ============================================================================
// SECTION 5: PATHWAY UTILITIES (WP2)
// ============================================================================

/**
 * Determine assessment mode based on pathway
 * - STC pathways: fast-track (show defaults confirmation)
 * - PM pathways: abbreviated (core questions only)
 * - FM pathways: full (all questions)
 */
const getAssessmentMode = (pathwayId: string | null): AssessmentMode => {
  if (!pathwayId) return 'full'

  if (pathwayId.startsWith('STC-')) {
    return 'fast-track'
  }
  if (pathwayId.startsWith('PM-')) {
    return 'abbreviated'
  }
  // FM pathways and unknown
  return 'full'
}

/**
 * Get questions based on assessment mode and provider count
 */
const getQuestionsForMode = (
  mode: AssessmentMode,
  numberOfBidders: string | undefined
): StrategicQuestion[] => {
  const isMultiProvider = numberOfBidders && parseInt(numberOfBidders) > 1

  // Filter out tendering question for single provider scenarios
  let questions = ALL_STRATEGIC_QUESTIONS.filter(q => {
    if (q.category === 'tendering' && !isMultiProvider) return false
    return true
  })

  if (mode === 'abbreviated') {
    // PM pathways: Only core priority questions
    questions = questions.filter(q => q.priority === 'core')
  }

  // Full mode: All questions (FM pathways)
  // Fast-track mode: All questions but with defaults (handled separately)
  return questions
}

/**
 * Get mode-specific messaging
 */
const getModeDescription = (mode: AssessmentMode): { title: string; description: string } => {
  switch (mode) {
    case 'fast-track':
      return {
        title: 'Quick Review',
        description: "Since you're using standard terms, I've pre-filled typical strategic positions. Review and adjust if needed."
      }
    case 'abbreviated':
      return {
        title: 'Focused Assessment',
        description: "I'll ask you a few key strategic questions to understand your negotiating position."
      }
    case 'full':
    default:
      return {
        title: 'Strategic Assessment',
        description: "Let's explore your negotiating position in depth to maximize your leverage."
      }
  }
}

// ============================================================================
// SECTION 6: MAIN COMPONENT
// ============================================================================

function IntelligentQuestionnaireContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // URL Parameters
  const sessionId = searchParams.get('session_id')
  const contractId = searchParams.get('contract_id')
  const pathwayId = searchParams.get('pathway_id')

  // WP2: Determine assessment mode from pathway
  const assessmentMode = useMemo(() => getAssessmentMode(pathwayId), [pathwayId])
  const modeInfo = useMemo(() => getModeDescription(assessmentMode), [assessmentMode])

  // ========================================================================
  // SECTION 6A: STATE
  // ========================================================================

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
  const [isSubmitting, setIsSubmitting] = useState(false)

  // WP2: Fast-track mode state
  const [showFastTrackReview, setShowFastTrackReview] = useState(false)
  const [editingField, setEditingField] = useState<QuestionKey | null>(null)

  // Transition Modal State
  const [transitionState, setTransitionState] = useState<TransitionState>({
    isOpen: false,
    transition: null,
    redirectUrl: null
  })

  // WP2: Get filtered questions based on mode
  const activeQuestions = useMemo(() => {
    return getQuestionsForMode(assessmentMode, existingData?.numberOfBidders)
  }, [assessmentMode, existingData?.numberOfBidders])

  // WP2: Dynamic questionnaire sections based on active questions
  const questionnaireSections = useMemo(() => {
    const sections = [
      { id: 'summary', name: 'Requirements Summary', icon: '📋', questionIndices: [] as number[] }
    ]

    // Group questions by category
    const categoryMap: Record<string, { name: string; icon: string }> = {
      'batna': { name: 'BATNA Deep Dive', icon: '⚖️' },
      'redlines': { name: 'Red Lines & Flexibility', icon: '🚫' },
      'risk': { name: 'Risk Tolerance', icon: '⚠️' },
      'internal': { name: 'Internal Dynamics', icon: '🏢' },
      'relationship': { name: 'Relationship Priorities', icon: '🤝' },
      'tendering': { name: 'Provider Qualification', icon: '📊' }
    }

    const categoryIndices: Record<string, number[]> = {}
    activeQuestions.forEach((q, idx) => {
      if (!categoryIndices[q.category]) {
        categoryIndices[q.category] = []
      }
      categoryIndices[q.category].push(idx)
    })

    Object.entries(categoryIndices).forEach(([category, indices]) => {
      if (categoryMap[category] && indices.length > 0) {
        sections.push({
          id: category,
          name: categoryMap[category].name,
          icon: categoryMap[category].icon,
          questionIndices: indices
        })
      }
    })

    sections.push({ id: 'complete', name: 'Contract Prep', icon: '📝', questionIndices: [] as number[] })

    return sections
  }, [activeQuestions])

  // ========================================================================
  // SECTION 6B: PROGRESS HELPERS
  // ========================================================================

  const getCurrentSectionId = (): string => {
    if (conversationComplete) return 'complete'
    if (showFastTrackReview) return 'summary'
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
      const questionKey = activeQuestions[idx]?.key
      return questionKey && strategicAnswers[questionKey]
    }).length
    return { answered, total: section.questionIndices.length }
  }

  const getOverallProgress = (): number => {
    const totalQuestions = activeQuestions.length
    if (totalQuestions === 0) return 100
    const answeredQuestions = Object.keys(strategicAnswers).filter(key =>
      activeQuestions.some(q => q.key === key)
    ).length
    return Math.round((answeredQuestions / totalQuestions) * 100)
  }

  // ========================================================================
  // SECTION 6C: LOAD DATA
  // ========================================================================

  useEffect(() => {
    const loadExistingRequirements = async () => {
      if (!sessionId) {
        setLoading(false)
        return
      }
      try {
        const response = await fetch(`https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session_id=${sessionId}`)

        if (response.ok) {
          const data = await response.json()

          if (data && (data.company_name || data.companyName || data.session_id || data.sessionId)) {
            setSessionNumber(data.sessionNumber || data.session_number || null)
            const requirements: ExistingRequirements = mapApiResponseToRequirements(data)
            setExistingData(requirements)

            // WP2: Handle different modes
            if (assessmentMode === 'fast-track') {
              // Pre-populate with defaults and show review screen
              const defaults = generateDefaultAnswers(requirements)
              setStrategicAnswers(defaults)
              setShowFastTrackReview(true)
            } else {
              // Normal conversation flow
              startIntelligentConversation(requirements)
            }

            setLoading(false)
            return
          }
        }

        // Fallback: Load from get-session
        console.log('[Strategic Assessment] No requirements found, falling back to get-session')
        const sessionResponse = await fetch(`https://spikeislandstudios.app.n8n.cloud/webhook/get-session?session_id=${sessionId}`)

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json()
          const session = sessionData.session || sessionData

          if (session) {
            setSessionNumber(session.session_number || session.sessionNumber || null)

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

            if (assessmentMode === 'fast-track') {
              const defaults = generateDefaultAnswers(minimalRequirements)
              setStrategicAnswers(defaults)
              setShowFastTrackReview(true)
            } else {
              startIntelligentConversation(minimalRequirements)
            }
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
  }, [sessionId, assessmentMode])

  // ========================================================================
  // SECTION 6D: MAP API RESPONSE
  // ========================================================================

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

  // ========================================================================
  // SECTION 6E: MESSAGE HELPERS
  // ========================================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addClarenceMessage = (content: string, questionKey?: QuestionKey) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'clarence', content, timestamp: new Date(), questionKey }])
  }

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', content, timestamp: new Date() }])
  }

  // ========================================================================
  // SECTION 6F: CONVERSATION FLOW
  // ========================================================================

  const startIntelligentConversation = async (data: ExistingRequirements) => {
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    const openingMessage = generateIntelligentOpening(data)
    addClarenceMessage(openingMessage)
    await new Promise(resolve => setTimeout(resolve, 1500))

    // WP2: Mode-specific intro
    const questionCount = getQuestionsForMode(assessmentMode, data.numberOfBidders).length
    const modeIntro = assessmentMode === 'abbreviated'
      ? `I have ${questionCount} focused questions to understand your key negotiating priorities.`
      : `These ${questionCount} questions will help me objectively calculate your leverage and recommend first-draft positions.`

    addClarenceMessage(`${modeIntro}\n\nLet's start with your alternatives...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    askStrategicQuestion(0, data)
    setIsTyping(false)
  }

  const generateIntelligentOpening = (data: ExistingRequirements): string => {
    const hasFullData = data.dealValue || data.serviceCriticality || data.numberOfBidders

    if (!hasFullData) {
      return `Good to meet you, ${data.contactName || data.companyName || 'there'}. I see you've started a new negotiation session for **${data.companyName || 'your company'}**.

I don't have all the details about this deal yet, but that's fine - I'll gather what I need through our conversation.

${data.serviceRequired ? `**Contract Type:** ${data.serviceRequired}` : ''}

Let me ask you some strategic questions to understand your position and calculate your leverage.`
    }

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
    if (index >= activeQuestions.length) {
      await completeAssessment()
      return
    }
    const question = activeQuestions[index]
    // WP2: Use short question for abbreviated mode
    let questionText = assessmentMode === 'abbreviated' && question.shortQuestion
      ? question.shortQuestion
      : question.question
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
    const currentQuestion = activeQuestions[currentQuestionIndex]
    if (currentQuestion) {
      setStrategicAnswers(prev => ({ ...prev, [currentQuestion.key]: input }))
    }
    const nextIndex = currentQuestionIndex + 1
    setCurrentQuestionIndex(nextIndex)
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    const acknowledgments = ["Got it.", "Understood.", "That's helpful context.", "Clear.", "Noted.", "Important to know.", "That tells me a lot."]
    if (Math.random() > 0.5 && nextIndex < activeQuestions.length) {
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

    const avgScore = (customerFactors.marketDynamicsScore + customerFactors.economicFactorsScore +
      customerFactors.strategicPositionScore + customerFactors.batnaScore) / 4
    const customerLeverage = Math.round(avgScore)
    const providerLeverage = 100 - customerLeverage

    // WP2: Mode-specific completion message
    const completionItems = assessmentMode === 'abbreviated'
      ? `✓ **Key Priorities** - What matters most to you
✓ **Red Lines** - Your non-negotiables
✓ **Flexibility** - Where you can give ground
✓ **Alternatives** - Your backup options`
      : `✓ **BATNA Analysis** - Your alternatives and fallback options
✓ **Red Lines** - What you absolutely won't compromise on
✓ **Flexibility Areas** - Where you have room to negotiate
✓ **Risk Tolerance** - How much uncertainty you can accept
✓ **Internal Dynamics** - Stakeholder pressures and politics
✓ **Relationship Priorities** - Partnership vs. commercial focus`

    addClarenceMessage(`**Strategic Assessment Complete**

I've captured your position on:

${completionItems}

**What happens next:**

1. **Invite your provider(s)** - Send invitations to start the negotiation
2. **Provider intake** - They'll complete their own assessment
3. **Leverage calculation** - I'll calculate leverage once both sides are ready
4. **Negotiate** - I'll generate draft positions and guide the mediation

Your data is saved and ready. Click below to continue.`)

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

  // ========================================================================
  // SECTION 6G: NAVIGATION HANDLERS
  // ========================================================================

  const handleProceedToContractPrep = async () => {
    if (!sessionId) return
    setIsSubmitting(true)

    try {
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
            providerConcerns: '',
            trustLevel: ''
          },
          leverage_assessment: leveragePayload,
          assessment_mode: assessmentMode,  // WP2: Track which mode was used
          completed_at: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Error saving assessment:', error)
    }

    const params = new URLSearchParams()
    params.set('session_id', sessionId)
    if (contractId) params.set('contract_id', contractId)
    if (pathwayId) params.set('pathway_id', pathwayId)

    const redirectUrl = `/auth/contract-prep?${params.toString()}`

    const transition: TransitionConfig = {
      id: 'transition_to_prep',
      fromStage: 'strategic_assessment',
      toStage: 'contract_prep',
      title: assessmentMode === 'fast-track' ? 'Ready to Configure' : 'Strategic Profile Complete',
      message: assessmentMode === 'fast-track'
        ? "Great! Your strategic defaults are saved. Let's configure your clause positions."
        : "Excellent work! I now have a clear picture of your negotiating position. Let's move to Contract Preparation where you'll:",
      bulletPoints: [
        'Review and configure each clause',
        'Set your ideal positions and acceptable ranges',
        'Weight clauses by strategic importance'
      ],
      buttonText: 'Continue to Contract Prep'
    }

    setTransitionState({
      isOpen: true,
      transition,
      redirectUrl
    })
    setIsSubmitting(false)
  }

  const handleTransitionContinue = () => {
    const { redirectUrl } = transitionState
    setTransitionState({ isOpen: false, transition: null, redirectUrl: null })

    if (redirectUrl) {
      router.push(redirectUrl)
    }
  }

  // ========================================================================
  // SECTION 7: FAST-TRACK REVIEW COMPONENT (WP2 NEW)
  // ========================================================================

  const renderFastTrackReview = () => {
    const questionLabels: Record<QuestionKey, string> = {
      batnaSpecifics: 'Backup Plan',
      batnaTimeline: 'Backup Timeline',
      batnaRealismScore: 'Backup Confidence',
      absoluteRedLines: 'Deal Breakers',
      flexibleAreas: 'Flexibility Areas',
      riskAppetite: 'Risk Tolerance',
      worstCaseScenario: 'Worst Case',
      stakeholderPressure: 'Stakeholder Pressure',
      internalPolitics: 'Internal Politics',
      relationshipVsTerms: 'Priority Focus',
      longTermVision: 'Long-term Vision',
      qualificationThreshold: 'Min. Alignment %'
    }

    const handleFieldEdit = (key: QuestionKey, value: string) => {
      setStrategicAnswers(prev => ({ ...prev, [key]: value }))
    }

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
            {/* Left: Home + CLARENCE Create branding */}
            <div className="flex items-center gap-3">
              <Link
                href="/auth/contracts-dashboard"
                className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <div className="h-6 w-px bg-slate-600"></div>
              <Link href="/auth/contracts-dashboard" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">C</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">CLARENCE</span>
                    <span className="text-emerald-400 font-semibold">Create</span>
                  </div>
                  <span className="text-slate-500 text-xs">The Honest Broker</span>
                </div>
              </Link>
            </div>

          </div>

          {/* Deal Summary */}
          {existingData && (
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700 mb-2">Deal Summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Company:</span> <span className="font-medium">{existingData.companyName}</span></div>
                <div><span className="text-slate-500">Contract:</span> <span className="font-medium">{existingData.serviceRequired || 'Not specified'}</span></div>
                <div><span className="text-slate-500">Value:</span> <span className="font-medium">{formatCurrency(existingData.dealValue)}</span></div>
                <div><span className="text-slate-500">Providers:</span> <span className="font-medium">{getBiddersDisplay(existingData.numberOfBidders)}</span></div>
              </div>
            </div>
          )}

          {/* Editable Fields */}
          <div className="px-6 py-4">
            <h3 className="font-medium text-slate-700 mb-4">Strategic Defaults</h3>
            <p className="text-sm text-slate-500 mb-4">Click any field to edit. These defaults are based on your deal context.</p>

            <div className="space-y-3">
              {Object.entries(strategicAnswers).map(([key, value]) => {
                const questionKey = key as QuestionKey
                const label = questionLabels[questionKey] || key
                const isEditing = editingField === questionKey

                return (
                  <div key={key} className="border border-slate-200 rounded-lg p-3 hover:border-emerald-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <label className="text-sm font-medium text-slate-600">{label}</label>
                      {!isEditing && (
                        <button
                          onClick={() => setEditingField(questionKey)}
                          className="text-xs text-emerald-600 hover:text-emerald-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          value={value}
                          onChange={(e) => handleFieldEdit(questionKey, e.target.value)}
                          className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => setEditingField(null)}
                            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 mt-1">{value}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFastTrackReview(false)
                  if (existingData) startIntelligentConversation(existingData)
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Answer All Questions Instead
              </button>
              <button
                onClick={handleProceedToContractPrep}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    Confirm & Continue
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================================
  // SECTION 8: PROGRESS MENU COMPONENT
  // ========================================================================

  const ProgressMenu = () => {
    const overallProgress = getOverallProgress()
    const currentSectionId = getCurrentSectionId()

    return (
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-[104px] h-[calc(100vh-104px)]">
        {/* 104px = 56px header + 48px progress bar */}
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{modeInfo.title}</h3>
          {/* WP2: Show mode badge */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${assessmentMode === 'fast-track' ? 'bg-emerald-100 text-emerald-700' :
              assessmentMode === 'abbreviated' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
              {assessmentMode === 'fast-track' ? '⚡ Fast Track' :
                assessmentMode === 'abbreviated' ? '📝 Focused' :
                  '📊 Full Assessment'}
            </span>
          </div>
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
        {/* SKIP BUTTON REMOVED */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500">
            {sessionNumber && <div className="font-mono">{sessionNumber}</div>}
            {existingData?.companyName && <div className="truncate mt-1">{existingData.companyName}</div>}
            {pathwayId && <div className="truncate mt-1 text-slate-400">{pathwayId}</div>}
          </div>
        </div>
      </div>
    )
  }

  // ========================================================================
  // SECTION 9: LOADING STATE
  // ========================================================================

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

  // ========================================================================
  // SECTION 10: MAIN RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ================================================================ */}
      {/* FULL-WIDTH HEADER */}
      {/* ================================================================ */}
      <header className="h-14 bg-slate-800 flex items-center justify-between px-6 relative sticky top-0 z-40">
        {/* Left: CLARENCE Create branding */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">C</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">CLARENCE</span>
              <span className="text-emerald-400 font-semibold">Create</span>
            </div>
            <span className="text-slate-500 text-xs">The Honest Broker</span>
          </div>
        </div>

        {/* Centre: Page Title */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <h1 className="text-white font-medium">{modeInfo.title}</h1>
        </div>

        {/* Right: Feedback & Session Info */}
        <div className="flex items-center gap-4">
          <FeedbackButton position="header" />
          {existingData && (
            <div className="text-right text-sm">
              <p className="font-medium text-slate-300">{existingData.companyName}</p>
              <p className="text-slate-500">{existingData.serviceRequired} • {formatCurrency(existingData.dealValue)}</p>
            </div>
          )}
        </div>
      </header>

      {/* ================================================================ */}
      {/* FULL-WIDTH PROGRESS BAR */}
      {/* ================================================================ */}
      <CreateProgressBar currentStage="strategic_assessment" />

      {/* ================================================================ */}
      {/* MAIN CONTENT WITH SIDEBAR */}
      {/* ================================================================ */}
      <div className="flex-1 flex">
        <ProgressMenu />
        <div className="flex-1 flex flex-col min-w-0">
          {/* WP2: Conditional rendering based on mode */}
          {showFastTrackReview ? (
            <div className="flex-1 p-6 overflow-auto">
              {renderFastTrackReview()}
            </div>
          ) : (
            <>
              {/* Question progress bar (mobile) */}
              <div className="bg-white border-b border-slate-200 px-6 py-3 lg:hidden">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Question {Math.min(currentQuestionIndex + 1, activeQuestions.length)} of {activeQuestions.length}</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(currentQuestionIndex / activeQuestions.length) * 100}%` }} />
                  </div>
                  {conversationComplete && <span className="text-green-600 font-medium">Complete ✓</span>}
                </div>
              </div>

              {/* Conversation panel */}
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
                          onClick={handleProceedToContractPrep}
                          disabled={isSubmitting}
                          className="w-full py-4 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              Continue to Contract Prep
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </>
                          )}
                        </button>
                        <p className="text-center text-sm text-slate-500 mt-3">Configure your clause positions before inviting providers</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Beta Feedback Button */}
      <FeedbackButton position="bottom-left" />

      {/* Transition Modal */}
      <TransitionModal
        isOpen={transitionState.isOpen}
        transition={transitionState.transition}
        onContinue={handleTransitionContinue}
      />
    </div>
  )
}

// ============================================================================
// SECTION 11: EXPORT
// ============================================================================

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