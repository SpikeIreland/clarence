'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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
  providers?: Provider[]
}

interface Provider {
  providerId: string
  name: string
  score: number
}

interface Message {
  id: string
  sender: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface CustomerRequirements {
  customer?: {
    company?: string
  }
  [key: string]: unknown
}

interface ProviderCapabilities {
  provider?: {
    company?: string
  }
  assessment_score?: number
  capabilities?: {
    assessment_score?: number
  }
  sessionNumber?: string
  [key: string]: unknown
}

interface NegotiationContext {
  customerRequirements: CustomerRequirements | null
  providerCapabilities: ProviderCapabilities | null
  providerDetails: unknown
  leverage: LeverageData
}

interface LeverageData {
  customer: number
  provider: number
  simulatedBidders: number
  factors: {
    bidders: string
    budget: string
    position: string
    timeline: string
    service: string
  }
}

// ========== SECTION 2: MAIN COMPONENT START ==========
function ClarenceChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ========== SECTION 3: STATE DECLARATIONS ==========
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [artifactPanelCollapsed, setArtifactPanelCollapsed] = useState(true)
  const [artifactContent, setArtifactContent] = useState<string>('')
  const [hasArtifact, setHasArtifact] = useState(false)
  
  // Negotiation data states
  const [customerRequirements, setCustomerRequirements] = useState<CustomerRequirements | null>(null)
  const [providerCapabilities, setProviderCapabilities] = useState<ProviderCapabilities | null>(null)
  const [currentAlignment, setCurrentAlignment] = useState(0)
  const [leverageData, setLeverageData] = useState<LeverageData | null>(null)

  // ========== SECTION 4: FUNCTIONS ==========
  
  // Authentication and User Management
  const getCurrentUser = useCallback(async () => {
    try {
      const clarenceAuth = localStorage.getItem('clarence_auth')
      if (clarenceAuth) {
        const authData = JSON.parse(clarenceAuth)
        const userId = authData.userId || authData.user_id || authData.userInfo?.userId
        if (userId) {
          setCurrentUserId(userId)
          localStorage.setItem('userId', userId)
          return userId
        }
      }
      
      // Check URL params
      const urlUserId = searchParams.get('userId')
      if (urlUserId) {
        setCurrentUserId(urlUserId)
        localStorage.setItem('userId', urlUserId)
        return urlUserId
      }
      
      return null
    } catch (error) {
      console.error('Error getting user:', error)
      return null
    }
  }, [searchParams])

  // Load Sessions
  const loadSessions = useCallback(async () => {
    try {
      const userEmail = localStorage.getItem('userEmail')
      const userId = currentUserId || localStorage.getItem('userId')
      
      let queryParams = 'role=customer'
      if (userId) queryParams += `&userId=${userId}`
      if (userEmail) queryParams += `&email=${encodeURIComponent(userEmail)}`
      
      const response = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/sessions-api?${queryParams}`
      )
      
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
        localStorage.setItem('sessions', JSON.stringify(data))
        return data
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
      const stored = localStorage.getItem('sessions')
      if (stored) {
        const data = JSON.parse(stored)
        setSessions(data)
        return data
      }
    }
    return []
  }, [currentUserId])

  // Load Provider Data
  const loadProviderData = useCallback(async (sessionId: string, providerId: string) => {
    try {
      // Load customer requirements
      const reqResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/customer-requirements-api?session=${sessionId}`
      )
      if (reqResponse.ok) {
        const reqData = await reqResponse.json()
        setCustomerRequirements(reqData)
        localStorage.setItem('customerRequirements', JSON.stringify(reqData))
      }

      // Load provider capabilities
      const capResponse = await fetch(
        `https://spikeislandstudios.app.n8n.cloud/webhook/provider-capabilities-api?session=${sessionId}&provider=${providerId}`
      )
      if (capResponse.ok) {
        const capData = await capResponse.json()
        setProviderCapabilities(capData)
        localStorage.setItem('providerCapabilities', JSON.stringify(capData))
        
        // Update alignment from capabilities
        if (capData?.assessment_score) {
          setCurrentAlignment(Math.round(capData.assessment_score))
        }
      }
    } catch (error) {
      console.error('Error loading provider data:', error)
    }
  }, [])

  // Calculate Leverage
  const calculateLeverage = useCallback(() => {
    let customerLeverage = 50
    const simulatedBidders = 4
    
    customerLeverage += simulatedBidders * 5
    customerLeverage += 10 // Large budget
    customerLeverage += 10 // Strong market position
    customerLeverage -= 5 // Specialized service
    customerLeverage += 5 // Flexible timeline
    
    if (currentAlignment > 75) {
      customerLeverage -= 5
    }
    
    customerLeverage = Math.min(Math.max(customerLeverage, 20), 85)
    
    const data: LeverageData = {
      customer: customerLeverage,
      provider: 100 - customerLeverage,
      simulatedBidders: simulatedBidders,
      factors: {
        bidders: `${simulatedBidders} competing providers`,
        budget: 'Enterprise budget (£1.5-2M)',
        position: 'Strong market position',
        timeline: 'Flexible timeline',
        service: 'Specialized F&A services'
      }
    }
    
    setLeverageData(data)
    return data
  }, [currentAlignment])

  // Select Provider
  const selectProvider = useCallback(async (sessionId: string, providerId: string) => {
    setCurrentSessionId(sessionId)
    setCurrentProviderId(providerId)
    
    // Find session and provider info
    const session = sessions.find(s => s.sessionId === sessionId)
    const provider = session?.providers?.find(p => p.providerId === providerId)
    
    if (session) setSelectedSession(session)
    if (provider) setSelectedProvider(provider)
    
    // Load provider data
    await loadProviderData(sessionId, providerId)
    
    // Calculate leverage
    calculateLeverage()
    
    // Add welcome message
    if (provider) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        sender: 'assistant',
        content: `Welcome to CLARENCE Contract Negotiation! I'm here to help you and ${provider.name} reach a mutually beneficial agreement.\n\nWe're currently in Phase 2: Foundational Drafting with ${currentAlignment}% compatibility achieved.\n\nWhat aspect of the contract would you like to focus on today?`,
        timestamp: new Date()
      }
      setMessages([welcomeMessage])
    }
  }, [sessions, loadProviderData, calculateLeverage, currentAlignment])

  // Send Message
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !currentSessionId || !currentUserId || isSending) return
    
    setIsSending(true)
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: inputMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    
    // Show thinking indicator
    const thinkingMessage: Message = {
      id: 'thinking',
      sender: 'assistant',
      content: 'thinking',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, thinkingMessage])
    
    try {
      const negotiationContext: NegotiationContext = {
        customerRequirements,
        providerCapabilities,
        providerDetails: null,
        leverage: leverageData || calculateLeverage()
      }
      
      const response = await fetch('https://spikeislandstudios.app.n8n.cloud/webhook/clarence-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          sessionId: currentSessionId,
          providerId: currentProviderId,
          message: inputMessage,
          currentPhase: 2,
          alignmentScore: currentAlignment,
          negotiationContext
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Remove thinking message and add response
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== 'thinking')
          const responseMessage: Message = {
            id: Date.now().toString(),
            sender: 'assistant',
            content: data.response || 'I apologize, but I encountered an issue processing your request.',
            timestamp: new Date()
          }
          return [...filtered, responseMessage]
        })
        
        // Update alignment if provided
        if (data.alignmentScore) {
          setCurrentAlignment(data.alignmentScore)
        }
        
        // Handle artifacts if present
        if (data.artifact) {
          generateContractArtifact()
        }
      } else {
        throw new Error('Failed to get response')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking')
        const errorMessage: Message = {
          id: Date.now().toString(),
          sender: 'assistant',
          content: 'I apologize, but I encountered an error processing your message. Please try again.',
          timestamp: new Date()
        }
        return [...filtered, errorMessage]
      })
    } finally {
      setIsSending(false)
    }
  }, [inputMessage, currentSessionId, currentUserId, currentProviderId, isSending, 
      currentAlignment, customerRequirements, providerCapabilities, leverageData, calculateLeverage])

  // Generate Contract Artifact
  const generateContractArtifact = () => {
    const artifact = `
      <div class="p-6 space-y-6">
        <h3 class="text-lg font-semibold text-slate-800">Contract Draft</h3>
        
        <div class="bg-white p-4 rounded-lg border border-slate-200">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-green-700">Payment Terms</span>
            <span class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Agreed</span>
          </div>
          <p class="text-sm text-slate-600">
            Payment shall be made within forty-five (45) days of invoice receipt for the initial three (3) month period.
          </p>
        </div>
        
        <div class="bg-white p-4 rounded-lg border border-slate-200">
          <div class="flex justify-between items-center mb-2">
            <span class="font-medium text-yellow-700">Liability & Infrastructure</span>
            <span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Proposed</span>
          </div>
          <p class="text-sm text-slate-600">
            Liability capped at 2x annual contract value with complimentary disaster recovery infrastructure.
          </p>
        </div>
      </div>
    `
    setArtifactContent(artifact)
    setHasArtifact(true)
    setArtifactPanelCollapsed(false)
  }

 // Demo Triggers
  const triggerDemo = (scenario: string) => {
    const demos: Record<string, {userMessage: string, response: string, alignmentIncrease?: number}> = {
      payment_stuck: {
        userMessage: "We're really stuck on payment terms. They want 60 days but we need 30 days.",
        response: "I understand this payment terms gap is significant. Let me help you find a creative solution.\n\n💡 **Basic Compromise:** A simple middle ground would be 45 days, but let's think more creatively...\n\n🔄 **Creative Trade-Off:** Link payment terms to performance metrics:\n• Start with 45-day terms for 3 months\n• If they maintain 95%+ SLA, terms improve to 40 days\n• After 6 months of consistency, consider 35 days\n• Offer 2% early payment discount for payments within 15 days\n\nThis creates a win-win with performance guarantees and relationship incentives.",
        alignmentIncrease: 5
      },
      cross_clause: {
        userMessage: "I don't see how we can move forward. They won't budge on liability caps.",
        response: "I can see you're at an impasse with liability caps. Here's an unexpected cross-clause trade-off:\n\n✨ **Creative Solution:** Connect liability caps to infrastructure benefits:\n• They maintain their 2x liability cap\n• BUT provide complimentary disaster recovery infrastructure (worth ~£50k/year)\n• You get GDPR-compliant backup without additional cost\n• Their involvement with your data reduces liability risk\n\nThis links operational benefits to risk concerns, creating value that offsets your exposure.",
        alignmentIncrease: 10
      },
      emotional: {
        userMessage: "This is so frustrating. I feel like they're not listening to our concerns about quality standards.",
        response: "I hear your frustration, and it's completely understandable. Quality standards are fundamental.\n\n💙 **Emotional Reset:** Let's reframe this constructively:\n\n1. **Acknowledge Their Perspective:** \"We understand you have established processes...\"\n2. **Bridge to Your Needs:** \"...and we want to build on that success while ensuring our requirements are met.\"\n3. **Collaborative Solution:** Propose a quality standards workshop where both parties identify gaps together.\n\nWould you like me to help draft this message to turn adversarial positions into collaborative problem-solving?",
        alignmentIncrease: 7
      },
      generate_contract: {
        userMessage: "Can you generate a draft contract based on what we've discussed?",
        response: "Excellent timing! I'll generate a Phase 2 Foundational Draft capturing your current alignment.\n\n📄 **Generating Contract Draft** with:\n• Agreed payment terms (45 days with performance incentives)\n• Creative infrastructure-liability trade-off\n• Quality standards framework\n• Remaining negotiation points marked\n\nThe draft appears in the Contract Artifacts panel. You can edit any section directly, and I'll track changes for your next discussion.",
        alignmentIncrease: 15
      }
    }
    
    const demo = demos[scenario]
    if (!demo) return
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: demo.userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    
    // Add response after delay
    setTimeout(() => {
      const responseMessage: Message = {
        id: Date.now().toString(),
        sender: 'assistant',
        content: demo.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, responseMessage])
      
      if (demo.alignmentIncrease) {
        setCurrentAlignment(prev => Math.min(100, prev + demo.alignmentIncrease!))
      }  // <-- THIS WAS MISSING!
      
      if (scenario === 'generate_contract') {
        generateContractArtifact()
      }
    }, 1500)
  }

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ========== SECTION 5: USE EFFECTS ==========
// ========== SECTION 5: USE EFFECTS ==========
  // This is the complete Section 5 that fixes the infinite loop
  
  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  // Main initialization effect - fixed to prevent infinite loop
  useEffect(() => {
    let mounted = true
    
    const initializeChat = async () => {
      // Check authentication
      const auth = localStorage.getItem('clarence_auth')
      if (!auth) {
        router.push('/auth/login')
        return
      }
      
      // Get user ID
      const userId = await getCurrentUser()
      if (!userId) {
        if (mounted) {
          setMessages([{
            id: '1',
            sender: 'assistant',
            content: 'Authentication required. Please log in to use CLARENCE.',
            timestamp: new Date()
          }])
        }
        return
      }
      
      // Store the user ID for use in the component
      if (mounted) {
        setCurrentUserId(userId)
      }
      
      // Load sessions ONCE (not in a callback to avoid dependency issues)
      try {
        const userEmail = localStorage.getItem('userEmail')
        let queryParams = 'role=customer'
        if (userId) queryParams += `&userId=${userId}`
        if (userEmail) queryParams += `&email=${encodeURIComponent(userEmail)}`
        
        const response = await fetch(
          `https://spikeislandstudios.app.n8n.cloud/webhook/sessions-api?${queryParams}`
        )
        
        if (response.ok && mounted) {
          const data = await response.json()
          setSessions(data)
          localStorage.setItem('sessions', JSON.stringify(data))
        }
      } catch (error) {
        console.error('Error loading sessions:', error)
        // Try loading from localStorage as fallback
        const stored = localStorage.getItem('sessions')
        if (stored && mounted) {
          setSessions(JSON.parse(stored))
        }
      }
      
      // Check for session/provider in URL
      const sessionId = searchParams.get('sessionId')
      const providerId = searchParams.get('providerId')
      
      if (sessionId && providerId && mounted) {
        // We need to load the provider data here
        // Since selectProvider needs sessions to be loaded, we'll do it directly
        const session = sessions.find(s => s.sessionId === sessionId)
        const provider = session?.providers?.find(p => p.providerId === providerId)
        
        if (session && provider) {
          setSelectedSession(session)
          setSelectedProvider(provider)
          setCurrentSessionId(sessionId)
          setCurrentProviderId(providerId)
          
          // Load provider data
          await loadProviderData(sessionId, providerId)
          calculateLeverage()
          
          // Set welcome message
          const welcomeMessage: Message = {
            id: Date.now().toString(),
            sender: 'assistant',
            content: `Welcome to CLARENCE Contract Negotiation! I'm here to help you and ${provider.name} reach a mutually beneficial agreement.\n\nWe're currently in Phase 2: Foundational Drafting.\n\nWhat aspect of the contract would you like to focus on today?`,
            timestamp: new Date()
          }
          setMessages([welcomeMessage])
        }
      } else if (mounted) {
        // No session/provider in URL, show default message
        setMessages([{
          id: '1',
          sender: 'assistant',
          content: 'Welcome to CLARENCE Contract Negotiation Platform!\n\nPlease select a session and provider from the sidebar menu to begin the negotiation process.',
          timestamp: new Date()
        }])
      }
    }
    
    initializeChat()
    
    // Cleanup function to prevent state updates on unmounted component
    return () => {
      mounted = false
    }
  }, [router, searchParams]) // Only essential dependencies - removed all callbacks to prevent loops

  // ========== SECTION 6: RENDER START ==========
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/auth/contracts-dashboard')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            <span>←</span>
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          
          {selectedSession && (
            <>
              <span className="px-3 py-1 bg-gradient-to-r from-slate-600 to-slate-700 text-white text-sm rounded-md font-medium">
                {selectedSession.sessionNumber || selectedSession.sessionId.substring(0, 8)}
              </span>
              <span className="font-medium text-slate-700">
                {selectedSession.customerCompany}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {leverageData && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
              <span className="text-sm text-slate-600">Leverage</span>
              <span className="text-sm font-bold" style={{
                color: leverageData.customer >= 70 ? '#38a169' : 
                       leverageData.customer >= 40 ? '#f6ad55' : '#e53e3e'
              }}>
                {leverageData.customer >= 70 ? 'Strong Advantage' :
                 leverageData.customer >= 40 ? 'Balanced' : 'Limited'}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Alignment</span>
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500"
                style={{
                  width: `${currentAlignment}%`,
                  background: currentAlignment < 50 ? '#fc8181' :
                            currentAlignment < 75 ? '#f6e05e' : '#48bb78'
                }}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700">{currentAlignment}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        // ========== REPLACE THE SIDEBAR SECTION IN CHAT PAGE ==========
  // This fixes the duplicate customer display issue
  
  {/* Sidebar */}
  <div className={`bg-slate-800 text-white transition-all duration-300 ${
    sidebarCollapsed ? 'w-16' : 'w-64'
  }`}>
    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg flex items-center justify-center font-bold">
          C
        </div>
        {!sidebarCollapsed && (
          <span className="font-semibold">CLARENCE</span>
        )}
      </div>
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="p-1 hover:bg-slate-700 rounded transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
    
    {!sidebarCollapsed && (
      <div className="p-4 overflow-y-auto">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">
          Active Negotiations
        </div>
        
        {/* Group sessions properly - one contract with multiple providers */}
        {sessions.length > 0 ? (
          // Assuming sessions might have duplicates, we'll group them by sessionId
          Object.values(
            sessions.reduce((acc: any, session) => {
              if (!acc[session.sessionId]) {
                acc[session.sessionId] = {
                  ...session,
                  providers: session.providers || []
                }
              } else {
                // Merge providers if this is a duplicate session
                if (session.providers) {
                  acc[session.sessionId].providers = [
                    ...acc[session.sessionId].providers,
                    ...session.providers
                  ]
                }
              }
              return acc
            }, {})
          ).map((session: any) => (
            <div key={session.sessionId} className="mb-4">
              {/* Contract/Session Header */}
              <div 
                className={`p-3 rounded-lg cursor-pointer transition ${
                  session.sessionId === currentSessionId 
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700' 
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
                onClick={() => {
                  const sessionEl = document.getElementById(`providers-${session.sessionId}`)
                  if (sessionEl) {
                    sessionEl.style.display = sessionEl.style.display === 'none' ? 'block' : 'none'
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{session.customerCompany}</div>
                    <div className="text-xs text-slate-400">{session.sessionNumber || session.sessionId.substring(0, 13)}</div>
                    <div className="text-xs text-slate-300 mt-1">{session.serviceRequired}</div>
                  </div>
                  <svg 
                    className={`w-4 h-4 transition-transform ${
                      session.sessionId === currentSessionId ? 'rotate-90' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              {/* Providers List - Sub-items under the contract */}
              <div 
                id={`providers-${session.sessionId}`}
                className="mt-2 ml-2 border-l-2 border-slate-600 pl-2"
                style={{ display: session.sessionId === currentSessionId ? 'block' : 'none' }}
              >
                <div className="text-xs text-slate-400 mb-2 ml-2">Select Provider:</div>
                {session.providers && session.providers.length > 0 ? (
                  session.providers.map((provider: Provider) => (
                    <div
                      key={provider.providerId}
                      className={`p-2 mb-1 ml-2 rounded cursor-pointer text-sm transition ${
                        provider.providerId === currentProviderId
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        selectProvider(session.sessionId, provider.providerId)
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{provider.name}</div>
                          {provider.providerId === currentProviderId && (
                            <div className="text-xs text-green-400 mt-1">● Currently negotiating</div>
                          )}
                        </div>
                        <span className="text-xs bg-slate-900 px-2 py-1 rounded">
                          {provider.score || 80}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic ml-2 p-2">
                    No providers available
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-slate-400 text-sm mt-4">
            No active negotiations
          </div>
        )}
      </div>
    )}
  </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Provider Info Bar */}
          {selectedProvider && (
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-700">Negotiating with:</span>
                <div className="px-3 py-1 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium">
                  {selectedProvider.name}
                </div>
              </div>
              
              {/* Demo Triggers */}
              <div className="flex gap-2">
                <button
                  onClick={() => triggerDemo('payment_stuck')}
                  className="px-3 py-1 text-sm bg-white border border-slate-300 rounded-md hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700 hover:text-white hover:border-slate-600 transition"
                >
                  💰 Payment Stuck
                </button>
                <button
                  onClick={() => triggerDemo('cross_clause')}
                  className="px-3 py-1 text-sm bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-md hover:from-yellow-500 hover:to-yellow-600 transition"
                >
                  ✨ Cross-Clause Magic
                </button>
                <button
                  onClick={() => triggerDemo('emotional')}
                  className="px-3 py-1 text-sm bg-white border border-slate-300 rounded-md hover:bg-gradient-to-r hover:from-slate-600 hover:to-slate-700 hover:text-white hover:border-slate-600 transition"
                >
                  💙 Feeling Frustrated
                </button>
                <button
                  onClick={() => triggerDemo('generate_contract')}
                  className="px-3 py-1 text-sm bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-md hover:from-yellow-500 hover:to-yellow-600 transition"
                >
                  📄 Generate Draft
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0 ${
                  message.sender === 'user' 
                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white'
                    : 'bg-slate-800 text-white'
                }`}>
                  {message.sender === 'user' ? 'U' : 'C'}
                </div>
                
                <div className={`max-w-[70%] ${message.sender === 'user' ? 'text-right' : ''}`}>
                  {message.content === 'thinking' ? (
                    <div className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-slate-600 italic text-sm">Analyzing...</span>
                    </div>
                  ) : (
                    <div className={`rounded-lg px-4 py-3 ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white'
                        : 'bg-white border border-slate-200'
                    }`}>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-slate-200 p-4">
            <div className="flex gap-3">
              <div className="flex-1 bg-slate-50 rounded-lg px-4 py-3">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedProvider ? "Type your message..." : "Select a provider from the sidebar first..."}
                  disabled={!selectedProvider || isSending}
                  className="w-full bg-transparent outline-none resize-none text-slate-700 placeholder-slate-400"
                  rows={1}
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!selectedProvider || !inputMessage.trim() || isSending}
                className="px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium hover:from-slate-700 hover:to-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Artifact Panel */}
        {hasArtifact && (
          <div className={`bg-slate-50 border-l border-slate-200 transition-all duration-300 ${
            artifactPanelCollapsed ? 'w-0' : 'w-96'
          } overflow-hidden`}>
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Contract Artifacts</span>
              <button
                onClick={() => setArtifactPanelCollapsed(!artifactPanelCollapsed)}
                className="p-1 hover:bg-slate-100 rounded transition"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={artifactPanelCollapsed ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto" dangerouslySetInnerHTML={{ __html: artifactContent }} />
          </div>
        )}
      </div>

      {/* Floating Artifact Toggle (when panel is collapsed) */}
      {hasArtifact && artifactPanelCollapsed && (
        <button
          onClick={() => setArtifactPanelCollapsed(false)}
          className="fixed right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-full shadow-lg hover:scale-110 transition flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ========== SECTION 7: EXPORT WITH SUSPENSE ==========
export default function ClarenceChat() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading CLARENCE Chat...</p>
        </div>
      </div>
    }>
      <ClarenceChatContent />
    </Suspense>
  )
}