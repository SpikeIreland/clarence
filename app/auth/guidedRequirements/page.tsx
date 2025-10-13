'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ========== SECTION 1: INTERFACES ==========
interface ConversationMessage {
  id: string
  type: 'clarence' | 'user'
  content: string
  timestamp: Date
  dataPoint?: string // Which data field this message relates to
  value?: string | number | boolean // The extracted value with proper types
}

interface RequirementsData {
  // Core fields aligned with algorithm
  companyInfo: {
    name?: string
    size?: string
    revenue?: string
    industry?: string
  }
  marketContext: {
    numberOfBidders?: string
    marketPosition?: string
    dealValue?: string
    decisionTimeline?: string
    incumbentStatus?: string
    switchingCosts?: string
  }
  batna: {
    alternatives?: string
    inHouseCapability?: string
    walkAwayPoint?: string
    budgetFlexibility?: string
  }
  serviceNeeds: {
    category?: string
    criticality?: string
    challenge?: string
    outcome?: string
  }
  leverageFactors: {
    customerLeverage?: number
    providerLeverage?: number
  }
  priorities?: {
    cost: number
    quality: number
    speed: number
    risk: number
    flexibility: number
  }
  status?: string
}

// Conversation flow states
type ConversationStage = 
  | 'welcome'
  | 'company-basics'
  | 'service-needs'
  | 'market-context'
  | 'batna-assessment'
  | 'contract-priorities'
  | 'review'
  | 'complete'

// Type for updateRequirements path parameter
type RequirementsPath = 
  | keyof RequirementsData 
  | 'companyInfo.name' 
  | 'companyInfo.size' 
  | 'companyInfo.revenue'
  | 'marketContext.numberOfBidders'
  | 'marketContext.dealValue'
  | 'marketContext.decisionTimeline'
  | 'serviceNeeds.category'
  | 'serviceNeeds.criticality'
  | 'batna.alternatives'
  | 'batna.walkAwayPoint'
  | 'leverageFactors'
  | 'priorities'
  | 'status'

// ========== SECTION 2: CONVERSATION PROMPTS ==========
const CLARENCE_PROMPTS = {
  welcome: `Hello! I'm CLARENCE, your AI contract negotiation assistant. I'll help you prepare for your negotiation by understanding your needs and calculating your leverage position.

This will take about 10-15 minutes, and I'll guide you through everything step by step. Ready to begin?`,

  companyName: `Great! Let's start with the basics. What's your company name?`,

  companySize: (name: string) => `Thanks! Now, how would you describe ${name}'s size?
- Small (1-50 employees)
- Medium (51-200 employees) 
- Large (201-1000 employees)
- Enterprise (1000+ employees)

Just type the size that fits best.`,

  revenue: `To help me understand your negotiating leverage, could you share your approximate annual revenue? This stays completely confidential and helps me negotiate better terms for you.`,

  serviceNeeds: `Now let's talk about what you need. In your own words, what service are you looking to procure?`,

  serviceCriticality: (service: string) => `How critical is this ${service} to your business operations?
  
Think of it this way:
- Mission Critical: Business stops without it
- Business Critical: Major impact on operations
- Important: Significant but manageable impact
- Standard: Helpful but not essential`,

  competitors: `This is important for leverage: How many providers are you considering for this contract?
- Just this one (sole source)
- 2-3 providers
- 4-6 providers  
- More than 7

The more competition, the stronger your position!`,

  dealValue: `What's your budget range for this contract? You can give me a range like "£200k-300k" or a target like "around £250k".`,

  timeline: `How quickly do you need to make this decision?
- Immediate (this week)
- Fast (within 2 weeks)
- Normal (within a month)
- Flexible (2-3 months)`,

  alternatives: `Here's a key question: What happens if this negotiation doesn't work out? Do you have good alternatives?`,

  walkAway: `What's the absolute maximum you'd be willing to pay before walking away? This is your "red line" and stays completely confidential - I just need to know so I don't agree to anything beyond your limits.`,

  leverageResult: (customer: number, provider: number) => `Based on everything you've told me, here's your leverage position:

📊 **Leverage Assessment**
- Your leverage: ${customer}%
- Provider leverage: ${provider}%

${customer > 60 ? `✅ You have a strong negotiating position! I'll push for favorable terms.` :
  customer > 40 ? `⚖️ Relatively balanced negotiation. I'll focus on win-win solutions.` :
  `⚠️ Provider has stronger leverage. I'll focus on protecting critical terms.`}

Would you like me to explain what this means for your negotiation?`,

  contractPriorities: `Now let's set your priorities. I have 25 "negotiation points" to spend on your behalf. 

What matters most to you? (Rank from 1-10):
1. Getting the lowest price
2. Ensuring quality/SLAs
3. Speed of implementation
4. Risk protection (liability, insurance)
5. Flexibility (termination, changes)

Just give me a number for each, and make sure they add up to 25 or less.`
}

// ========== SECTION 3: MAIN COMPONENT ==========
export default function ClarenceGuidedRequirements() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // ========== SECTION 4: STATE MANAGEMENT ==========
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [currentStage, setCurrentStage] = useState<ConversationStage>('welcome')
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [requirementsData, setRequirementsData] = useState<RequirementsData>({
    companyInfo: {},
    marketContext: {},
    batna: {},
    serviceNeeds: {},
    leverageFactors: {}
  })
  const [showSummary, setShowSummary] = useState(false)

  // ========== SECTION 5: INITIALIZATION ==========
  useEffect(() => {
    // Start conversation
    addClarenceMessage(CLARENCE_PROMPTS.welcome, 'welcome')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ========== SECTION 6: MESSAGE HANDLERS ==========
  const addClarenceMessage = (content: string, dataPoint?: string) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'clarence',
      content,
      timestamp: new Date(),
      dataPoint
    }
    setMessages(prev => [...prev, message])
  }

  const addUserMessage = (content: string, value?: string | number | boolean) => {
    const message: ConversationMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
      value
    }
    setMessages(prev => [...prev, message])
  }

  // ========== SECTION 7: CONVERSATION FLOW LOGIC ==========
  const processUserInput = async (input: string) => {
    setIsProcessing(true)
    addUserMessage(input)

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800))

    switch(currentStage) {
      case 'welcome':
        if (input.toLowerCase().includes('yes') || input.toLowerCase().includes('ready')) {
          setCurrentStage('company-basics')
          addClarenceMessage(CLARENCE_PROMPTS.companyName)
          updateRequirements('status', 'started')
        }
        break

      case 'company-basics':
        // Handle company name
        if (!requirementsData.companyInfo.name) {
          updateRequirements('companyInfo.name', input)
          addClarenceMessage(CLARENCE_PROMPTS.companySize(input))
        } 
        // Handle company size
        else if (!requirementsData.companyInfo.size) {
          const size = extractCompanySize(input)
          updateRequirements('companyInfo.size', size)
          addClarenceMessage(CLARENCE_PROMPTS.revenue)
        }
        // Handle revenue
        else if (!requirementsData.companyInfo.revenue) {
          updateRequirements('companyInfo.revenue', input)
          setCurrentStage('service-needs')
          addClarenceMessage(CLARENCE_PROMPTS.serviceNeeds)
        }
        break

      case 'service-needs':
        if (!requirementsData.serviceNeeds.category) {
          updateRequirements('serviceNeeds.category', input)
          addClarenceMessage(CLARENCE_PROMPTS.serviceCriticality(input))
        } else if (!requirementsData.serviceNeeds.criticality) {
          const criticality = extractCriticality(input)
          updateRequirements('serviceNeeds.criticality', criticality)
          setCurrentStage('market-context')
          addClarenceMessage(CLARENCE_PROMPTS.competitors)
        }
        break

      case 'market-context':
        if (!requirementsData.marketContext.numberOfBidders) {
          updateRequirements('marketContext.numberOfBidders', extractBidderCount(input))
          addClarenceMessage(CLARENCE_PROMPTS.dealValue)
        } else if (!requirementsData.marketContext.dealValue) {
          updateRequirements('marketContext.dealValue', input)
          addClarenceMessage(CLARENCE_PROMPTS.timeline)
        } else if (!requirementsData.marketContext.decisionTimeline) {
          updateRequirements('marketContext.decisionTimeline', extractTimeline(input))
          setCurrentStage('batna-assessment')
          addClarenceMessage(CLARENCE_PROMPTS.alternatives)
        }
        break

      case 'batna-assessment':
        if (!requirementsData.batna.alternatives) {
          updateRequirements('batna.alternatives', input)
          addClarenceMessage(CLARENCE_PROMPTS.walkAway)
        } else if (!requirementsData.batna.walkAwayPoint) {
          updateRequirements('batna.walkAwayPoint', input)
          
          // Calculate leverage
          const leverage = calculateLeverage()
          updateRequirements('leverageFactors', leverage)
          
          addClarenceMessage(CLARENCE_PROMPTS.leverageResult(leverage.customerLeverage, leverage.providerLeverage))
          setCurrentStage('contract-priorities')
          
          setTimeout(() => {
            addClarenceMessage(CLARENCE_PROMPTS.contractPriorities)
          }, 2000)
        }
        break

      case 'contract-priorities':
        // Parse priorities
        const priorities = extractPriorities(input)
        if (priorities) {
          updateRequirements('priorities', priorities)
          setCurrentStage('review')
          setShowSummary(true)
          addClarenceMessage(`Perfect! I've captured all your requirements. Let me show you a summary...`)
        } else {
          addClarenceMessage(`I couldn't parse those priorities. Please give me 5 numbers (1-10 each) that add up to 25 or less.`)
        }
        break
    }

    setIsProcessing(false)
    setInputValue('')
  }

  // ========== SECTION 8: DATA EXTRACTION HELPERS ==========
  const extractCompanySize = (input: string): string => {
    const lower = input.toLowerCase()
    if (lower.includes('small') || lower.includes('1-50')) return 'Small'
    if (lower.includes('medium') || lower.includes('51-200')) return 'Medium'
    if (lower.includes('large') || lower.includes('201-1000')) return 'Large'
    if (lower.includes('enterprise') || lower.includes('1000+')) return 'Enterprise'
    return 'Medium' // default
  }

  const extractCriticality = (input: string): string => {
    const lower = input.toLowerCase()
    if (lower.includes('mission')) return 'mission-critical'
    if (lower.includes('business')) return 'business-critical'
    if (lower.includes('important')) return 'important'
    if (lower.includes('standard')) return 'standard'
    return 'important' // default
  }

  const extractBidderCount = (input: string): string => {
    const lower = input.toLowerCase()
    if (lower.includes('one') || lower.includes('sole') || lower.includes('1')) return '1'
    if (lower.includes('2-3') || lower.includes('two') || lower.includes('three')) return '2-3'
    if (lower.includes('4-6') || lower.includes('four') || lower.includes('five')) return '4-6'
    if (lower.includes('7') || lower.includes('more')) return '7+'
    return '2-3' // default
  }

  const extractTimeline = (input: string): string => {
    const lower = input.toLowerCase()
    if (lower.includes('immediate') || lower.includes('week')) return 'Immediate'
    if (lower.includes('fast') || lower.includes('2 week')) return 'Fast'
    if (lower.includes('normal') || lower.includes('month')) return 'Normal'
    if (lower.includes('flexible') || lower.includes('2-3')) return 'Flexible'
    return 'Normal'
  }

  const extractPriorities = (input: string): { cost: number; quality: number; speed: number; risk: number; flexibility: number } | null => {
    // Try to extract 5 numbers from the input
    const numbers = input.match(/\d+/g)?.map(Number)
    if (numbers && numbers.length >= 5) {
      const total = numbers.slice(0, 5).reduce((sum, n) => sum + n, 0)
      if (total <= 25) {
        return {
          cost: numbers[0],
          quality: numbers[1],
          speed: numbers[2],
          risk: numbers[3],
          flexibility: numbers[4]
        }
      }
    }
    return null
  }

  // ========== SECTION 9: LEVERAGE CALCULATION ==========
  const calculateLeverage = (): { customerLeverage: number, providerLeverage: number } => {
    let customerLeverage = 50 // Base

    // Market dynamics
    const bidders = requirementsData.marketContext.numberOfBidders
    if (bidders === '7+') customerLeverage += 20
    else if (bidders === '4-6') customerLeverage += 10
    else if (bidders === '1') customerLeverage -= 20

    // Service criticality
    const criticality = requirementsData.serviceNeeds.criticality
    if (criticality === 'mission-critical') customerLeverage -= 15
    else if (criticality === 'standard') customerLeverage += 10

    // BATNA strength
    const alternatives = requirementsData.batna.alternatives?.toLowerCase() || ''
    if (alternatives.includes('strong') || alternatives.includes('many')) customerLeverage += 15
    else if (alternatives.includes('none') || alternatives.includes('no')) customerLeverage -= 15

    // Timeline pressure
    const timeline = requirementsData.marketContext.decisionTimeline
    if (timeline === 'Immediate') customerLeverage -= 10
    else if (timeline === 'Flexible') customerLeverage += 5

    // Ensure bounds
    customerLeverage = Math.max(20, Math.min(80, customerLeverage))

    return {
      customerLeverage,
      providerLeverage: 100 - customerLeverage
    }
  }

  // ========== SECTION 10: UPDATE HELPERS ==========
  const updateRequirements = (path: RequirementsPath, value: string | number | { customerLeverage: number; providerLeverage: number } | { cost: number; quality: number; speed: number; risk: number; flexibility: number }) => {
    setRequirementsData(prev => {
      const updated = { ...prev }
      const keys = path.split('.')
      let current: Record<string, unknown> = updated
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        if (!current[key]) current[key] = {}
        current = current[key] as Record<string, unknown>
      }
      
      current[keys[keys.length - 1]] = value
      return updated
    })
  }

  const handleSubmit = () => {
    const finalData = {
      ...requirementsData,
      timestamp: new Date().toISOString(),
      collectionMethod: 'clarence-guided',
      sessionId: `GUIDED-${Date.now()}`
    }
    
    // Save and proceed
    localStorage.setItem('customerRequirements', JSON.stringify(finalData))
    router.push('/auth/assessment')
  }

  // ========== SECTION 11: MAIN RENDER ==========
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-medium text-slate-700">CLARENCE</span>
              <span className="ml-4 text-slate-600 text-sm">Guided Requirements Collection</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-slate-500">
                {currentStage !== 'welcome' && `Progress: ${currentStage}`}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {/* Chat Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-2xl ${
                  message.type === 'clarence' 
                    ? 'bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200' 
                    : 'bg-blue-600 text-white'
                } rounded-lg p-4`}>
                  {message.type === 'clarence' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        C
                      </div>
                      <span className="text-xs text-slate-600">CLARENCE</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="Type your response..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isProcessing && inputValue.trim()) {
                    processUserInput(inputValue)
                  }
                }}
                disabled={isProcessing}
              />
              <button
                onClick={() => processUserInput(inputValue)}
                disabled={isProcessing || !inputValue.trim()}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-400"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Summary Panel */}
        {showSummary && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-800 mb-4">Requirements Summary</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Company</h4>
                <p className="text-sm text-slate-600">{requirementsData.companyInfo.name}</p>
                <p className="text-xs text-slate-500">{requirementsData.companyInfo.size} • {requirementsData.companyInfo.revenue}</p>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Service</h4>
                <p className="text-sm text-slate-600">{requirementsData.serviceNeeds.category}</p>
                <p className="text-xs text-slate-500">{requirementsData.serviceNeeds.criticality}</p>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Deal</h4>
                <p className="text-sm text-slate-600">{requirementsData.marketContext.dealValue}</p>
                <p className="text-xs text-slate-500">{requirementsData.marketContext.numberOfBidders} providers</p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-700 mb-2">Your Leverage</h4>
                <p className="text-2xl font-bold text-green-600">{requirementsData.leverageFactors?.customerLeverage}%</p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Proceed to Contract Negotiation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}