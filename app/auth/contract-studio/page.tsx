'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

// Session status types
type SessionStatus =
    | 'pending_provider'      // Customer done, waiting for provider invite
    | 'provider_invited'      // Provider has been invited but not completed
    | 'provider_intake'       // Provider completing their questionnaire
    | 'leverage_pending'      // Both done, calculating leverage
    | 'ready'                 // Full negotiation ready
    | 'active'                // Negotiation in progress

interface Session {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    providerCompany: string
    serviceType: string
    dealValue: string
    phase: number
    status: string
}

interface ContractClause {
    positionId: string
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    description: string

    // Nesting
    parentPositionId: string | null
    clauseLevel: number
    displayOrder: number

    // Positions
    customerPosition: number | null
    providerPosition: number | null
    currentCompromise: number | null
    clarenceRecommendation: number | null
    industryStandard: number | null
    gapSize: number

    // Weighting
    customerWeight: number
    providerWeight: number
    isDealBreakerCustomer: boolean
    isDealBreakerProvider: boolean

    // Content
    clauseContent: string | null
    customerNotes: string | null
    providerNotes: string | null

    // Status
    status: 'aligned' | 'negotiating' | 'disputed' | 'pending'

    // UI State
    isExpanded?: boolean
    children?: ContractClause[]
}

interface LeverageData {
    // Leverage Score (from onboarding - fixed baseline)
    leverageScoreCustomer: number
    leverageScoreProvider: number
    leverageScoreCalculatedAt: string

    // Leverage Tracker (from current positions - changes)
    leverageTrackerCustomer: number
    leverageTrackerProvider: number
    alignmentPercentage: number
    isAligned: boolean
    leverageTrackerCalculatedAt: string

    // Factor Breakdown
    marketDynamicsScore: number
    marketDynamicsRationale: string
    economicFactorsScore: number
    economicFactorsRationale: string
    strategicPositionScore: number
    strategicPositionRationale: string
    batnaScore: number
    batnaRationale: string
}

interface ClauseChatMessage {
    messageId: string
    sessionId: string
    positionId: string | null
    sender: 'customer' | 'provider' | 'clarence'
    senderUserId: string | null
    message: string
    messageType: 'discussion' | 'proposal' | 'notification' | 'question' | 'auto_response'
    relatedPositionChange: boolean
    triggeredBy: string | null
    createdAt: string
}

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: 'customer' | 'provider'
    userId?: string
}

interface PartyStatus {
    isOnline: boolean
    lastSeen: string | null
    userName: string | null
}

// API Response Types (for mapping from N8N API)
interface ApiClauseResponse {
    positionId: string
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    description: string
    parentPositionId: string | null
    clauseLevel: number
    displayOrder: number
    customerPosition: string | null
    providerPosition: string | null
    currentCompromise: string | null
    aiSuggestedCompromise: string | null
    gapSize: string
    gapSeverity: string
    customerWeight: number
    providerWeight: number
    isDealBreakerCustomer: boolean
    isDealBreakerProvider: boolean
    clauseContent: string | null
    customerNotes: string | null
    providerNotes: string | null
    priorityLevel: number
    status: string
    isExpanded: boolean
}

interface ApiMessageResponse {
    messageId?: string
    message_id?: string
    sessionId?: string
    session_id?: string
    positionId?: string | null
    position_id?: string | null
    sender: string
    senderUserId?: string | null
    sender_user_id?: string | null
    message: string
    messageType?: string
    message_type?: string
    relatedPositionChange?: boolean
    related_position_change?: boolean
    triggeredBy?: string | null
    triggered_by?: string | null
    createdAt?: string
    created_at?: string
}

// ============================================================================
// SECTION 1B: CLARENCE AI TYPES (NEW)
// ============================================================================

interface ClarenceAIResponse {
    success: boolean
    promptType: string
    sessionId: string
    clauseId?: string
    response: string
    leverage: {
        customer: number
        provider: number
        alignment: number
    }
    timestamp: string
}

// ============================================================================
// SECTION 2: API CONFIGURATION & FUNCTIONS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 2B: CLARENCE AI API FUNCTIONS (NEW)
// ============================================================================

const CLARENCE_AI_URL = `${API_BASE}/clarence-ai`

/**
 * Call CLARENCE AI with specified prompt type
 */
async function callClarenceAI(
    sessionId: string,
    promptType: 'welcome' | 'clause_explain' | 'chat',
    options: { clauseId?: string; message?: string } = {}
): Promise<ClarenceAIResponse | null> {
    try {
        const response = await fetch(CLARENCE_AI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                promptType,
                ...options
            })
        })

        if (!response.ok) {
            throw new Error(`CLARENCE AI request failed: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error('CLARENCE AI Error:', error)
        return null
    }
}

// ============================================================================
// SECTION 2C: EXISTING API FUNCTIONS
// ============================================================================

// Fetch session and clause data for Contract Studio
async function fetchContractStudioData(sessionId: string): Promise<{
    session: Session
    clauses: ContractClause[]
    leverage: LeverageData
} | null> {
    try {
        const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
        if (!response.ok) throw new Error('Failed to fetch contract studio data')
        const data = await response.json()

        // Map API response to our interfaces
        const session: Session = {
            sessionId: data.session.sessionId,
            sessionNumber: data.session.sessionNumber,
            customerCompany: data.session.customerCompany,
            providerCompany: data.session.providerCompany,
            serviceType: data.session.contractType || 'IT Services',
            dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
            phase: parsePhaseFromState(data.session.phase),
            status: data.session.status
        }

        // Map clauses from API (convert string numbers to actual numbers)
        const clauses: ContractClause[] = data.clauses.map((c: ApiClauseResponse) => ({
            positionId: c.positionId,
            clauseId: c.clauseId,
            clauseNumber: c.clauseNumber,
            clauseName: c.clauseName,
            category: c.category,
            description: c.description,
            parentPositionId: c.parentPositionId,
            clauseLevel: c.clauseLevel,
            displayOrder: c.displayOrder,
            customerPosition: c.customerPosition ? parseFloat(c.customerPosition) : null,
            providerPosition: c.providerPosition ? parseFloat(c.providerPosition) : null,
            currentCompromise: c.currentCompromise ? parseFloat(c.currentCompromise) : null,
            clarenceRecommendation: c.aiSuggestedCompromise ? parseFloat(c.aiSuggestedCompromise) : null,
            industryStandard: null, // Not in current API
            gapSize: c.gapSize ? parseFloat(c.gapSize) : 0,
            customerWeight: c.customerWeight,
            providerWeight: c.providerWeight,
            isDealBreakerCustomer: c.isDealBreakerCustomer,
            isDealBreakerProvider: c.isDealBreakerProvider,
            clauseContent: c.clauseContent,
            customerNotes: c.customerNotes,
            providerNotes: c.providerNotes,
            status: c.status,
            isExpanded: c.isExpanded
        }))

        // Map leverage data
        const leverage: LeverageData = {
            leverageScoreCustomer: data.leverage.leverageScoreCustomer,
            leverageScoreProvider: data.leverage.leverageScoreProvider,
            leverageScoreCalculatedAt: data.leverage.leverageScoreCalculatedAt,
            leverageTrackerCustomer: data.leverage.leverageTrackerCustomer,
            leverageTrackerProvider: data.leverage.leverageTrackerProvider,
            alignmentPercentage: data.leverage.alignmentPercentage,
            isAligned: data.leverage.isAligned,
            leverageTrackerCalculatedAt: data.leverage.leverageTrackerCalculatedAt,
            marketDynamicsScore: data.leverage.marketDynamicsScore,
            marketDynamicsRationale: data.leverage.marketDynamicsRationale,
            economicFactorsScore: data.leverage.economicFactorsScore,
            economicFactorsRationale: data.leverage.economicFactorsRationale,
            strategicPositionScore: data.leverage.strategicPositionScore,
            strategicPositionRationale: data.leverage.strategicPositionRationale,
            batnaScore: data.leverage.batnaScore,
            batnaRationale: data.leverage.batnaRationale
        }

        return { session, clauses, leverage }
    } catch (error) {
        console.error('Error fetching contract studio data:', error)
        return null
    }
}

// Helper: Format currency from numeric value
function formatCurrency(value: string | number | null, currency: string): string {
    if (!value) return '£0'
    const num = typeof value === 'string' ? parseFloat(value) : value
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
    if (num >= 1000000) {
        return `${symbol}${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
        return `${symbol}${(num / 1000).toFixed(0)}K`
    }
    return `${symbol}${num.toLocaleString()}`
}

// Helper: Format position values (can be % or currency depending on clause)
function formatPositionValue(value: number): string {
    if (value >= 1000000) {
        return `£${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
        return `£${(value / 1000).toFixed(0)}K`
    }
    return `${value}`
}

// Helper: Parse phase number from negotiation state
function parsePhaseFromState(state: string | null): number {
    if (!state) return 2 // Default to phase 2
    const phaseMap: Record<string, number> = {
        'deal_profiling': 1,
        'initial_positions': 2,
        'mediation_pending': 2,
        'gap_analysis': 3,
        'negotiation': 4,
        'agreement': 5,
        'execution': 6,
        'completed': 6
    }
    return phaseMap[state] || 2
}

// Fetch clause-specific chat messages
async function fetchClauseChat(sessionId: string, positionId: string | null): Promise<ClauseChatMessage[]> {
    try {
        const url = positionId
            ? `${API_BASE}/clause-chat-api-get?session_id=${sessionId}&position_id=${positionId}`
            : `${API_BASE}/clause-chat-api-get?session_id=${sessionId}&general=true`
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to fetch clause chat')
        const data = await response.json()

        // Handle both array response and object with messages array
        const messages = Array.isArray(data) ? data : (data.messages || [])

        return messages.map((m: ApiMessageResponse) => ({
            messageId: m.messageId || m.message_id,
            sessionId: m.sessionId || m.session_id,
            positionId: m.positionId || m.position_id,
            sender: m.sender,
            senderUserId: m.senderUserId || m.sender_user_id,
            message: m.message,
            messageType: m.messageType || m.message_type || 'discussion',
            relatedPositionChange: m.relatedPositionChange || m.related_position_change || false,
            triggeredBy: m.triggeredBy || m.triggered_by,
            createdAt: m.createdAt || m.created_at
        }))
    } catch (error) {
        console.error('Error fetching clause chat:', error)
        return []
    }
}

// Send message to CLARENCE
async function sendClauseMessage(
    sessionId: string,
    positionId: string | null,
    message: string,
    sender: 'customer' | 'provider'
): Promise<ClauseChatMessage | null> {
    try {
        const response = await fetch(`${API_BASE}/clarence-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                positionId,
                message,
                sender,
                action: 'clause_chat'
            })
        })

        if (!response.ok) throw new Error('Failed to send message')
        return await response.json()
    } catch (error) {
        console.error('Error sending message:', error)
        return null
    }
}

// Update clause position
async function updateClausePosition(
    positionId: string,
    party: 'customer' | 'provider',
    newPosition: number,
    rationale: string
): Promise<boolean> {
    try {
        // TODO: Replace with actual API endpoint
        // const response = await fetch(`${API_BASE}/clause-position-api`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ positionId, party, newPosition, rationale })
        // })
        // return response.ok

        console.log('Position update:', { positionId, party, newPosition, rationale })
        return true
    } catch (error) {
        console.error('Error updating position:', error)
        return false
    }
}

// Check other party's online status
async function checkPartyStatus(sessionId: string, partyRole: 'customer' | 'provider'): Promise<PartyStatus> {
    try {
        // TODO: Replace with actual API endpoint for real-time status
        // For now, simulate that the other party is sometimes online
        return {
            isOnline: Math.random() > 0.3, // 70% chance online for demo
            lastSeen: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
            userName: partyRole === 'customer' ? 'Sarah Mitchell' : 'James Chen'
        }
    } catch (error) {
        console.error('Error checking party status:', error)
        return { isOnline: false, lastSeen: null, userName: null }
    }
}

// ============================================================================
// SECTION 3: MOCK DATA (Temporary - Replace with API data)
// ============================================================================



// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function buildClauseTree(clauses: ContractClause[]): ContractClause[] {
    const clauseMap = new Map<string, ContractClause>()
    const rootClauses: ContractClause[] = []

    // First pass: create map
    clauses.forEach(clause => {
        clauseMap.set(clause.positionId, { ...clause, children: [] })
    })

    // Second pass: build tree
    clauses.forEach(clause => {
        const current = clauseMap.get(clause.positionId)!
        if (clause.parentPositionId && clauseMap.has(clause.parentPositionId)) {
            const parent = clauseMap.get(clause.parentPositionId)!
            parent.children = parent.children || []
            parent.children.push(current)
        } else {
            rootClauses.push(current)
        }
    })

    return rootClauses
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'aligned': return 'text-emerald-600'
        case 'negotiating': return 'text-amber-600'
        case 'disputed': return 'text-red-600'
        default: return 'text-slate-400'
    }
}

function getStatusBgColor(status: string): string {
    switch (status) {
        case 'aligned': return 'bg-emerald-500'
        case 'negotiating': return 'bg-amber-500'
        case 'disputed': return 'bg-red-500'
        default: return 'bg-slate-300'
    }
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'aligned': return '✓'
        case 'negotiating': return '⟷'
        case 'disputed': return '!'
        default: return '○'
    }
}

function calculateClauseStats(clauses: ContractClause[]): {
    aligned: number
    negotiating: number
    disputed: number
    pending: number
} {
    const stats = { aligned: 0, negotiating: 0, disputed: 0, pending: 0 }

    function countStatus(clause: ContractClause) {
        if (clause.status === 'aligned') stats.aligned++
        else if (clause.status === 'negotiating') stats.negotiating++
        else if (clause.status === 'disputed') stats.disputed++
        else stats.pending++

        clause.children?.forEach(countStatus)
    }

    clauses.forEach(countStatus)
    return stats
}

// ============================================================================
// SECTION 5: LOADING COMPONENT
// ============================================================================

function ContractStudioLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Contract Studio...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN CONTRACT STUDIO COMPONENT
// ============================================================================

function ContractStudioContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // State
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [otherPartyStatus, setOtherPartyStatus] = useState<PartyStatus>({ isOnline: false, lastSeen: null, userName: null })
    const [session, setSession] = useState<Session | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [clauseTree, setClauseTree] = useState<ContractClause[]>([])
    const [leverage, setLeverage] = useState<LeverageData | null>(null)
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [chatMessages, setChatMessages] = useState<ClauseChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'dynamics' | 'tradeoffs' | 'history' | 'draft'>('dynamics')
    const [showLeverageDetails, setShowLeverageDetails] = useState(false)

    // ============================================================================
    // SECTION 6B: CLARENCE AI STATE (NEW)
    // ============================================================================

    const [clarenceWelcomeLoaded, setClarenceWelcomeLoaded] = useState(false)
    const [lastExplainedClauseId, setLastExplainedClauseId] = useState<string | null>(null)

    const chatEndRef = useRef<HTMLDivElement>(null)

    // ============================================================================
    // SECTION 7: DATA LOADING
    // ============================================================================

    const [sessionStatus, setSessionStatus] = useState<SessionStatus>('pending_provider')
    const [providerEmail, setProviderEmail] = useState('')
    const [inviteSending, setInviteSending] = useState(false)
    const [inviteSent, setInviteSent] = useState(false)

    const loadUserInfo = useCallback(() => {
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) {
            router.push('/auth/login')
            return null
        }

        try {
            const parsed = JSON.parse(authData)
            return {
                firstName: parsed.userInfo?.firstName || 'User',
                lastName: parsed.userInfo?.lastName || '',
                email: parsed.userInfo?.email || '',
                company: parsed.userInfo?.company || '',
                role: parsed.userInfo?.role || 'customer',
                userId: parsed.userInfo?.userId || ''
            } as UserInfo
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    const loadContractData = useCallback(async (sessionId: string) => {
        try {
            const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
            if (!response.ok) throw new Error('Failed to fetch')

            const data = await response.json()

            // Check if provider has completed intake
            const status = data.session?.status || 'pending_provider'

            // Map status from database to our status types
            if (status === 'customer_assessment_complete' || status === 'pending_provider') {
                setSessionStatus('pending_provider')
                return null // Don't load full data yet
            } else if (status === 'provider_invited' || status === 'providers_invited') {
                setSessionStatus('provider_invited')
                // Load basic session data even for invited state
                const basicSession: Session = {
                    sessionId: data.session.sessionId || sessionId,
                    sessionNumber: data.session.sessionNumber || '',
                    customerCompany: data.session.customerCompany || '',
                    providerCompany: 'Awaiting Provider Response',
                    serviceType: data.session.contractType || 'Service Agreement',
                    dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                    phase: 1,
                    status: status
                }
                setSession(basicSession)
                return null
            } else if (status === 'provider_intake_complete' || status === 'leverage_pending') {
                setSessionStatus('leverage_pending')
                return null
            }

            // Full data available
            setSessionStatus('ready')

            const session: Session = {
                sessionId: data.session.sessionId,
                sessionNumber: data.session.sessionNumber,
                customerCompany: data.session.customerCompany,
                providerCompany: data.session.providerCompany || 'Provider (Pending)',
                serviceType: data.session.contractType || 'IT Services',
                dealValue: formatCurrency(data.session.dealValue, data.session.currency || 'GBP'),
                phase: parsePhaseFromState(data.session.phase),
                status: data.session.status
            }

            const clauses: ContractClause[] = (data.clauses || []).map((c: ApiClauseResponse) => ({
                positionId: c.positionId,
                clauseId: c.clauseId,
                clauseNumber: c.clauseNumber,
                clauseName: c.clauseName,
                category: c.category,
                description: c.description,
                parentPositionId: c.parentPositionId,
                clauseLevel: c.clauseLevel,
                displayOrder: c.displayOrder,
                customerPosition: c.customerPosition ? parseFloat(c.customerPosition) : null,
                providerPosition: c.providerPosition ? parseFloat(c.providerPosition) : null,
                currentCompromise: c.currentCompromise ? parseFloat(c.currentCompromise) : null,
                clarenceRecommendation: c.aiSuggestedCompromise ? parseFloat(c.aiSuggestedCompromise) : null,
                industryStandard: null,
                gapSize: c.gapSize ? parseFloat(c.gapSize) : 0,
                customerWeight: c.customerWeight,
                providerWeight: c.providerWeight,
                isDealBreakerCustomer: c.isDealBreakerCustomer,
                isDealBreakerProvider: c.isDealBreakerProvider,
                clauseContent: c.clauseContent,
                customerNotes: c.customerNotes,
                providerNotes: c.providerNotes,
                status: c.status,
                isExpanded: c.isExpanded
            }))

            const leverage: LeverageData = data.leverage || {
                leverageScoreCustomer: 50,
                leverageScoreProvider: 50,
                leverageScoreCalculatedAt: '',
                leverageTrackerCustomer: 50,
                leverageTrackerProvider: 50,
                alignmentPercentage: 0,
                isAligned: false,
                leverageTrackerCalculatedAt: '',
                marketDynamicsScore: 0,
                marketDynamicsRationale: '',
                economicFactorsScore: 0,
                economicFactorsRationale: '',
                strategicPositionScore: 0,
                strategicPositionRationale: '',
                batnaScore: 0,
                batnaRationale: ''
            }

            return { session, clauses, leverage }
        } catch (error) {
            console.error('Error fetching contract studio data:', error)
            // Default to pending provider state if API fails
            setSessionStatus('pending_provider')
            return null
        }
    }, [])

    const loadClauseChat = useCallback(async (sessionId: string, positionId: string | null) => {
        const apiMessages = await fetchClauseChat(sessionId, positionId)
        return apiMessages
    }, [])

    // ============================================================================
    // SECTION 7B: CLARENCE AI WELCOME MESSAGE LOADER (NEW)
    // ============================================================================

    const loadClarenceWelcome = useCallback(async (sessionId: string) => {
        if (clarenceWelcomeLoaded) return // Only load once

        setIsChatLoading(true)

        try {
            const response = await callClarenceAI(sessionId, 'welcome')

            if (response?.success && response.response) {
                const welcomeMessage: ClauseChatMessage = {
                    messageId: `clarence-welcome-${Date.now()}`,
                    sessionId: sessionId,
                    positionId: null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'session_load',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [welcomeMessage, ...prev])
                setClarenceWelcomeLoaded(true)
            }
        } catch (error) {
            console.error('Failed to load CLARENCE welcome:', error)
        } finally {
            setIsChatLoading(false)
        }
    }, [clarenceWelcomeLoaded])

    // ============================================================================
    // SECTION 7C: CLARENCE AI CLAUSE EXPLAINER (NEW)
    // ============================================================================

    const explainClauseWithClarence = useCallback(async (sessionId: string, clause: ContractClause) => {
        // Don't re-explain the same clause
        if (lastExplainedClauseId === clause.clauseId) return

        setIsChatLoading(true)
        setLastExplainedClauseId(clause.clauseId)

        try {
            const response = await callClarenceAI(sessionId, 'clause_explain', {
                clauseId: clause.clauseId
            })

            if (response?.success && response.response) {
                const explainMessage: ClauseChatMessage = {
                    messageId: `clarence-explain-${Date.now()}`,
                    sessionId: sessionId,
                    positionId: clause.positionId,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'clause_selection',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, explainMessage])
            }
        } catch (error) {
            console.error('Failed to explain clause:', error)
        } finally {
            setIsChatLoading(false)
        }
    }, [lastExplainedClauseId])

    // Initial load
    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (!user) return

            setUserInfo(user)

            // Get session ID and status from URL params
            const sessionId = searchParams.get('session_id') || searchParams.get('session')
            const urlStatus = searchParams.get('status')
            const sessionNumber = searchParams.get('session_number')

            if (!sessionId) {
                router.push('/auth/contracts-dashboard')
                return
            }

            // Check URL status first
            if (urlStatus === 'pending_provider') {
                setSessionStatus('pending_provider')

                // Load session data from customer-requirements-api (where we saved it)
                try {
                    const response = await fetch(`${API_BASE}/customer-requirements-api?session_id=${sessionId}`)
                    if (response.ok) {
                        const data = await response.json()
                        console.log('Customer requirements data:', data)

                        // Map the data to session format
                        setSession({
                            sessionId: sessionId,
                            sessionNumber: data.sessionNumber || sessionNumber || '',
                            customerCompany: data.companyName || data.company_name || user.company || '',
                            providerCompany: 'Awaiting Provider',
                            serviceType: data.serviceRequired || data.service_required || 'Service Agreement',
                            dealValue: formatCurrency(data.dealValue || data.deal_value || '0', 'GBP'),
                            phase: 1,
                            status: 'pending_provider'
                        })
                    } else {
                        console.error('Failed to load customer requirements:', response.status)
                        // Set minimal session data from URL params
                        setSession({
                            sessionId: sessionId,
                            sessionNumber: sessionNumber || '',
                            customerCompany: user.company || 'Your Company',
                            providerCompany: 'Awaiting Provider',
                            serviceType: 'Service Agreement',
                            dealValue: '£0',
                            phase: 1,
                            status: 'pending_provider'
                        })
                    }
                } catch (e) {
                    console.error('Error loading customer requirements:', e)
                    // Set minimal session data
                    setSession({
                        sessionId: sessionId,
                        sessionNumber: sessionNumber || '',
                        customerCompany: user.company || 'Your Company',
                        providerCompany: 'Awaiting Provider',
                        serviceType: 'Service Agreement',
                        dealValue: '£0',
                        phase: 1,
                        status: 'pending_provider'
                    })
                }

                setLoading(false)
                return
            }

            // Load full contract data for non-pending states
            const data = await loadContractData(sessionId)

            if (data) {
                setSession(data.session)
                setClauses(data.clauses)
                setClauseTree(buildClauseTree(data.clauses))
                setLeverage(data.leverage)

                const messages = await loadClauseChat(sessionId, null)
                setChatMessages(messages)

                const otherRole = user.role === 'customer' ? 'provider' : 'customer'
                const status = await checkPartyStatus(sessionId, otherRole)
                setOtherPartyStatus(status)
            }

            setLoading(false)
        }

        init()
    }, [loadUserInfo, loadContractData, loadClauseChat, searchParams, router])

    // ============================================================================
    // SECTION 7D: LOAD CLARENCE WELCOME WHEN SESSION IS READY (NEW)
    // ============================================================================

    useEffect(() => {
        if (session?.sessionId && sessionStatus === 'ready' && !clarenceWelcomeLoaded && !loading) {
            loadClarenceWelcome(session.sessionId)
        }
    }, [session?.sessionId, sessionStatus, clarenceWelcomeLoaded, loading, loadClarenceWelcome])

    // ============================================================================
    // SECTION 7E: AUTO-SCROLL CHAT TO BOTTOM (NEW)
    // ============================================================================

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ============================================================================
    // SECTION 8: EVENT HANDLERS
    // ============================================================================

    // ============================================================================
    // SECTION 8B: CLAUSE SELECT WITH CLARENCE EXPLANATION (MODIFIED)
    // ============================================================================

    const handleClauseSelect = (clause: ContractClause) => {
        setSelectedClause(clause)
        setActiveTab('dynamics')

        // Trigger CLARENCE to explain the clause (NEW)
        if (session?.sessionId && sessionStatus === 'ready') {
            explainClauseWithClarence(session.sessionId, clause)
        }
    }

    const handleClauseToggle = (positionId: string) => {
        const toggleExpanded = (items: ContractClause[]): ContractClause[] => {
            return items.map(item => {
                if (item.positionId === positionId) {
                    return { ...item, isExpanded: !item.isExpanded }
                }
                if (item.children && item.children.length > 0) {
                    return { ...item, children: toggleExpanded(item.children) }
                }
                return item
            })
        }

        setClauseTree(toggleExpanded(clauseTree))
    }

    // ============================================================================
    // SECTION 8C: SEND MESSAGE WITH REAL CLARENCE AI (MODIFIED)
    // ============================================================================

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !session || !userInfo) return

        const userMessage = chatInput.trim()

        // Add user message immediately
        const newMessage: ClauseChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            positionId: selectedClause?.positionId || null,
            sender: userInfo.role || 'customer',
            senderUserId: userInfo.userId || null,
            message: userMessage,
            messageType: 'discussion',
            relatedPositionChange: false,
            triggeredBy: 'manual',
            createdAt: new Date().toISOString()
        }

        setChatMessages(prev => [...prev, newMessage])
        setChatInput('')
        setIsChatLoading(true)

        // Call CLARENCE AI for response (MODIFIED - was simulated, now real)
        try {
            const response = await callClarenceAI(session.sessionId, 'chat', {
                message: userMessage,
                clauseId: selectedClause?.clauseId
            })

            if (response?.success && response.response) {
                const clarenceResponse: ClauseChatMessage = {
                    messageId: `clarence-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'user_message',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, clarenceResponse])
            } else {
                // Fallback error message
                const errorMessage: ClauseChatMessage = {
                    messageId: `error-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: 'I apologize, but I encountered an issue processing your request. Please try again.',
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'error',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error('CLARENCE chat error:', error)

            const errorMessage: ClauseChatMessage = {
                messageId: `error-${Date.now()}`,
                sessionId: session.sessionId,
                positionId: selectedClause?.positionId || null,
                sender: 'clarence',
                senderUserId: null,
                message: 'I apologize, but I encountered a connection issue. Please try again in a moment.',
                messageType: 'auto_response',
                relatedPositionChange: false,
                triggeredBy: 'error',
                createdAt: new Date().toISOString()
            }

            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setIsChatLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    // ============================================================================
    // SECTION 8D: QUICK ACTION HANDLER (NEW)
    // ============================================================================

    const handleQuickAction = async (message: string) => {
        if (!session || !userInfo || isChatLoading) return

        // Add user message immediately
        const newMessage: ClauseChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            positionId: selectedClause?.positionId || null,
            sender: userInfo.role || 'customer',
            senderUserId: userInfo.userId || null,
            message: message,
            messageType: 'discussion',
            relatedPositionChange: false,
            triggeredBy: 'quick_action',
            createdAt: new Date().toISOString()
        }

        setChatMessages(prev => [...prev, newMessage])
        setIsChatLoading(true)

        // Call CLARENCE AI for response
        try {
            const response = await callClarenceAI(session.sessionId, 'chat', {
                message: message,
                clauseId: selectedClause?.clauseId
            })

            if (response?.success && response.response) {
                const clarenceResponse: ClauseChatMessage = {
                    messageId: `clarence-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: response.response,
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'quick_action',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, clarenceResponse])
            } else {
                const errorMessage: ClauseChatMessage = {
                    messageId: `error-${Date.now()}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: 'I apologize, but I encountered an issue processing your request. Please try again.',
                    messageType: 'auto_response',
                    relatedPositionChange: false,
                    triggeredBy: 'error',
                    createdAt: new Date().toISOString()
                }

                setChatMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error('CLARENCE quick action error:', error)

            const errorMessage: ClauseChatMessage = {
                messageId: `error-${Date.now()}`,
                sessionId: session.sessionId,
                positionId: selectedClause?.positionId || null,
                sender: 'clarence',
                senderUserId: null,
                message: 'I apologize, but I encountered a connection issue. Please try again in a moment.',
                messageType: 'auto_response',
                relatedPositionChange: false,
                triggeredBy: 'error',
                createdAt: new Date().toISOString()
            }

            setChatMessages(prev => [...prev, errorMessage])
        } finally {
            setIsChatLoading(false)
        }
    }

    // ============================================================================
    // SECTION 8D: PENDING PROVIDER VIEW COMPONENT
    // ============================================================================

    const handleSendInvite = async () => {
        if (!providerEmail.trim() || !session) return

        setInviteSending(true)

        try {
            // Match the workflow's expected structure
            const response = await fetch(`${API_BASE}/invite-provider`, {  // Changed URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.sessionId,  // camelCase to match workflow
                    sessionNumber: session.sessionNumber,
                    customerCompany: session.customerCompany,
                    serviceRequired: session.serviceType,
                    dealValue: session.dealValue.replace(/[£$€,]/g, ''), // Strip currency symbols
                    provider: {  // Nested structure
                        companyName: '',  // Will be filled by provider
                        contactName: '',
                        contactEmail: providerEmail
                    }
                })
            })

            if (response.ok) {
                const result = await response.json()
                console.log('Invite sent successfully:', result)
                setInviteSent(true)
                setSessionStatus('provider_invited')
            } else {
                const errorText = await response.text()
                console.error('Failed to send invite:', errorText)
                alert('Failed to send invitation. Please try again.')
            }
        } catch (error) {
            console.error('Error sending invite:', error)
            alert('Failed to send invitation. Please check your connection and try again.')
        }

        setInviteSending(false)
    }

    const PendingProviderView = () => {
        return (
            <div className="min-h-screen bg-slate-50">
                {/* Header */}
                <div className="bg-slate-800 text-white px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <h1 className="font-semibold">Contract Studio</h1>
                                <p className="text-sm text-slate-400">{session?.sessionNumber}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/auth/contracts-dashboard')}
                            className="text-slate-400 hover:text-white transition"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-4xl mx-auto p-8">
                    {/* Status Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Progress Steps */}
                        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                {/* Step 1: Customer Assessment */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-emerald-700">Your Assessment</div>
                                        <div className="text-xs text-slate-500">Complete</div>
                                    </div>
                                </div>

                                <div className="flex-1 h-1 bg-slate-200 mx-4 rounded">
                                    <div className={`h-full rounded transition-all duration-500 ${sessionStatus === 'pending_provider' ? 'w-0 bg-slate-300' :
                                        sessionStatus === 'provider_invited' ? 'w-1/2 bg-amber-400' :
                                            'w-full bg-emerald-500'
                                        }`}></div>
                                </div>

                                {/* Step 2: Provider Invited */}
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sessionStatus === 'provider_invited' || sessionStatus === 'leverage_pending' || sessionStatus === 'ready'
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-200'
                                        }`}>
                                        {sessionStatus === 'provider_invited' || sessionStatus === 'leverage_pending' || sessionStatus === 'ready' ? (
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span className="text-slate-500 font-medium">2</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-medium ${sessionStatus === 'pending_provider' ? 'text-slate-600' : 'text-emerald-700'
                                            }`}>Invite Provider</div>
                                        <div className="text-xs text-slate-500">
                                            {sessionStatus === 'pending_provider' ? 'Pending' :
                                                sessionStatus === 'provider_invited' ? 'Invited' : 'Complete'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 h-1 bg-slate-200 mx-4 rounded">
                                    <div className={`h-full rounded transition-all duration-500 ${sessionStatus === 'leverage_pending' ? 'w-1/2 bg-amber-400' :
                                        sessionStatus === 'ready' ? 'w-full bg-emerald-500' :
                                            'w-0 bg-slate-300'
                                        }`}></div>
                                </div>

                                {/* Step 3: Provider Assessment */}
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sessionStatus === 'ready' ? 'bg-emerald-500' : 'bg-slate-200'
                                        }`}>
                                        {sessionStatus === 'ready' ? (
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span className="text-slate-500 font-medium">3</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-medium ${sessionStatus === 'ready' ? 'text-emerald-700' : 'text-slate-600'
                                            }`}>Provider Assessment</div>
                                        <div className="text-xs text-slate-500">
                                            {sessionStatus === 'leverage_pending' ? 'In Progress' :
                                                sessionStatus === 'ready' ? 'Complete' : 'Waiting'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="p-8">
                            {sessionStatus === 'pending_provider' && !inviteSent && (
                                <>
                                    <div className="text-center mb-8">
                                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-2xl font-semibold text-slate-800 mb-2">Invite Your Provider</h2>
                                        <p className="text-slate-600 max-w-md mx-auto">
                                            Your strategic assessment is complete. Now invite the provider to complete their intake questionnaire so CLARENCE can calculate the true leverage balance.
                                        </p>
                                    </div>

                                    {/* Session Summary */}
                                    <div className="bg-slate-50 rounded-xl p-6 mb-8">
                                        <h3 className="text-sm font-semibold text-slate-700 mb-4">Session Summary</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xs text-slate-500">Your Company</div>
                                                <div className="font-medium text-slate-800">{session?.customerCompany}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500">Service Type</div>
                                                <div className="font-medium text-slate-800">{session?.serviceType}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500">Deal Value</div>
                                                <div className="font-medium text-emerald-600">{session?.dealValue}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500">Session Number</div>
                                                <div className="font-medium text-slate-800 font-mono">{session?.sessionNumber}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invite Form */}
                                    <div className="max-w-md mx-auto">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Provider Contact Email
                                        </label>
                                        <input
                                            type="email"
                                            value={providerEmail}
                                            onChange={(e) => setProviderEmail(e.target.value)}
                                            placeholder="provider@company.com"
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent mb-4"
                                        />
                                        <button
                                            onClick={handleSendInvite}
                                            disabled={!providerEmail.trim() || inviteSending}
                                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                                        >
                                            {inviteSending ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    Sending Invitation...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                    </svg>
                                                    Send Invitation
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}

                            {(sessionStatus === 'provider_invited' || inviteSent) && (
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-semibold text-slate-800 mb-2">Awaiting Provider Response</h2>
                                    <p className="text-slate-600 max-w-md mx-auto mb-6">
                                        {inviteSent
                                            ? <>We&apos;ve sent an invitation to <strong>{providerEmail}</strong>.</>
                                            : <>An invitation has been sent to the provider.</>
                                        }
                                        {' '}You&apos;ll be notified when they complete their intake questionnaire.
                                    </p>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto mb-6">
                                        <div className="text-sm text-blue-800">
                                            <strong>What happens next?</strong>
                                            <ul className="mt-2 text-left space-y-1">
                                                <li>• Provider receives email invitation</li>
                                                <li>• They complete their intake questionnaire</li>
                                                <li>• CLARENCE calculates leverage balance</li>
                                                <li>• First-draft positions are generated</li>
                                                <li>• You&apos;ll be notified to start negotiation</li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                                        <button
                                            onClick={() => router.push('/auth/contracts-dashboard')}
                                            className="px-6 py-2 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg transition cursor-pointer"
                                        >
                                            ← Return to Dashboard
                                        </button>
                                        <button
                                            onClick={() => setSessionStatus('ready')}
                                            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer"
                                        >
                                            Preview Contract Studio →
                                        </button>
                                    </div>

                                    {/* Resend Invite Option */}
                                    <div className="mt-6 pt-6 border-t border-slate-200 max-w-md mx-auto">
                                        <p className="text-sm text-slate-500 mb-2">Provider hasn&apos;t responded?</p>
                                        <button
                                            onClick={() => {
                                                setInviteSent(false)
                                                setSessionStatus('pending_provider')
                                            }}
                                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                                        >
                                            Send to a different email address
                                        </button>
                                    </div>
                                </div>
                            )}

                            {sessionStatus === 'leverage_pending' && (
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                    <h2 className="text-2xl font-semibold text-slate-800 mb-2">Calculating Leverage...</h2>
                                    <p className="text-slate-600 max-w-md mx-auto mb-6">
                                        Both parties have completed their assessments. CLARENCE is now calculating the leverage balance and generating first-draft positions.
                                    </p>
                                    <p className="text-sm text-slate-500">This usually takes less than a minute.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info Cards */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <div className="text-2xl mb-2">🔒</div>
                            <h4 className="font-medium text-slate-800 mb-1">Confidential</h4>
                            <p className="text-xs text-slate-500">Each party&apos;s data is kept private until positions are shared</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <div className="text-2xl mb-2">⚖️</div>
                            <h4 className="font-medium text-slate-800 mb-1">Fair Calculation</h4>
                            <p className="text-xs text-slate-500">Leverage is calculated using market data and both parties&apos; inputs</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <div className="text-2xl mb-2">📊</div>
                            <h4 className="font-medium text-slate-800 mb-1">Transparent Process</h4>
                            <p className="text-xs text-slate-500">Both parties see how positions are calculated and justified</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 9: LOADING & CONDITIONAL RENDERING
    // ============================================================================

    if (loading) {
        return <ContractStudioLoading />
    }

    // Show pending provider view if provider hasn't completed intake
    if (sessionStatus === 'pending_provider' || sessionStatus === 'provider_invited' || sessionStatus === 'leverage_pending') {
        return <PendingProviderView />
    }

    // Only proceed to full contract studio if we have all required data
    if (!session || !userInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Failed to load contract data</p>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="mt-6 px-6 py-2 text-slate-600 hover:text-slate-800 transition cursor-pointer"
                    >
                        ← Return to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    // Create placeholder leverage if not available (preview mode)
    const displayLeverage: LeverageData = leverage || {
        leverageScoreCustomer: 50,
        leverageScoreProvider: 50,
        leverageScoreCalculatedAt: '',
        leverageTrackerCustomer: 50,
        leverageTrackerProvider: 50,
        alignmentPercentage: 0,
        isAligned: false,
        leverageTrackerCalculatedAt: '',
        marketDynamicsScore: 0,
        marketDynamicsRationale: 'Pending provider intake',
        economicFactorsScore: 0,
        economicFactorsRationale: 'Pending provider intake',
        strategicPositionScore: 0,
        strategicPositionRationale: 'Pending provider intake',
        batnaScore: 0,
        batnaRationale: 'Pending provider intake'
    }

    const clauseStats = calculateClauseStats(clauseTree)

    // ============================================================================
    // SECTION 10: PARTY STATUS BANNER COMPONENT
    // ============================================================================

    const PartyStatusBanner = () => {
        const isCustomer = userInfo.role === 'customer'
        const myCompany = isCustomer ? session.customerCompany : session.providerCompany
        const otherCompany = isCustomer ? session.providerCompany : session.customerCompany
        const myRole = isCustomer ? 'Customer' : 'Provider'
        const otherRole = isCustomer ? 'Provider' : 'Customer'

        return (
            <div className="bg-slate-800 text-white px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Left: My Login Status */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/auth/contracts-dashboard')}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="text-sm">Dashboard</span>
                        </button>
                        <div className="w-px h-6 bg-slate-600"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                            <span className="text-sm">
                                Logged in as <span className="font-semibold text-emerald-400">{myCompany}</span>
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                                {myRole}
                            </span>
                        </div>
                        {userInfo.firstName && (
                            <span className="text-xs text-slate-400">
                                ({userInfo.firstName} {userInfo.lastName})
                            </span>
                        )}
                    </div>

                    {/* Center: Session Info */}
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-xs text-slate-400">Session</div>
                            <div className="text-sm font-mono">{session.sessionNumber}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-400">Deal Value</div>
                            <div className="text-sm font-semibold text-emerald-400">{session.dealValue}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-400">Phase</div>
                            <div className="text-sm">
                                <span className="inline-flex items-center gap-1">
                                    <span className="w-5 h-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                        {session.phase}
                                    </span>
                                    <span className="text-slate-300">of 6</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Other Party Status */}
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-xs text-slate-400">Other Party</div>
                            <div className="text-sm">
                                <span className="font-medium">{otherCompany}</span>
                                <span className="text-xs text-slate-500 ml-2">({otherRole})</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${otherPartyStatus.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`}></div>
                            <span className={`text-xs mt-0.5 ${otherPartyStatus.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {otherPartyStatus.isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        {otherPartyStatus.isOnline && otherPartyStatus.userName && (
                            <div className="text-xs text-slate-400">
                                {otherPartyStatus.userName}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 11: LEVERAGE INDICATOR COMPONENT (Updated Terminology)
    // ============================================================================

    const LeverageIndicator = () => {
        // Calculate how much dynamic differs from master
        const customerShift = displayLeverage.leverageTrackerCustomer - displayLeverage.leverageScoreCustomer
        const isCustomerGaining = customerShift > 0

        return (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                {/* Three Metrics Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">Negotiation Metrics</h3>
                        <button
                            onClick={() => setShowLeverageDetails(!showLeverageDetails)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                        >
                            {showLeverageDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>

                    {/* Alignment Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${displayLeverage.alignmentPercentage >= 90
                        ? 'bg-emerald-100 text-emerald-700'
                        : displayLeverage.alignmentPercentage >= 70
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {displayLeverage.alignmentPercentage}% Aligned
                    </div>
                </div>

                {/* Three Metrics Cards */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {/* Leverage Score (Fixed Baseline) */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Leverage Score</div>
                        <div className="text-lg font-bold text-slate-800">
                            {displayLeverage.leverageScoreCustomer} : {displayLeverage.leverageScoreProvider}
                        </div>
                        <div className="text-xs text-slate-400">Fixed baseline from assessment</div>
                    </div>

                    {/* Alignment Score */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Alignment Score</div>
                        <div className="text-lg font-bold text-emerald-600">
                            {displayLeverage.alignmentPercentage}%
                        </div>
                        <div className="text-xs text-slate-400">Progress to agreement</div>
                    </div>

                    {/* Leverage Tracker (Dynamic) */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Leverage Tracker</div>
                        <div className="text-lg font-bold text-slate-800">
                            {displayLeverage.leverageTrackerCustomer} : {displayLeverage.leverageTrackerProvider}
                        </div>
                        <div className={`text-xs ${isCustomerGaining ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isCustomerGaining ? '↑' : '↓'} {Math.abs(customerShift)}% from baseline
                        </div>
                    </div>
                </div>

                {/* Visual Leverage Bar */}
                <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-emerald-600 font-medium w-24">{session.customerCompany.split(' ')[0]}</span>
                        <div className="flex-1"></div>
                        <span className="text-xs text-blue-600 font-medium w-24 text-right">{session.providerCompany.split(' ')[0]}</span>
                    </div>

                    {/* Leverage Bar */}
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                        {/* Leverage Score (baseline - shown as markers) */}
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-slate-800 z-10"
                            style={{ left: `${displayLeverage.leverageScoreCustomer}%`, transform: 'translateX(-50%)' }}
                            title={`Leverage Score: ${displayLeverage.leverageScoreCustomer}%`}
                        >
                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-600 whitespace-nowrap">
                                ◆ {displayLeverage.leverageScoreCustomer}%
                            </div>
                        </div>

                        {/* Leverage Tracker (dynamic - shown as fill) */}
                        <div
                            className={`h-full transition-all duration-500 ${displayLeverage.leverageTrackerCustomer > displayLeverage.leverageScoreCustomer
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                                }`}
                            style={{ width: `${displayLeverage.leverageTrackerCustomer}%` }}
                        ></div>

                        {/* Center line */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300"></div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-800 transform rotate-45"></div>
                            <span>Leverage Score (baseline)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-2 bg-emerald-500 rounded-sm"></div>
                            <span>Leverage Tracker (current)</span>
                        </div>
                    </div>
                </div>

                {/* Detailed Breakdown (expandable) */}
                {showLeverageDetails && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="text-xs font-medium text-slate-600 mb-3">Leverage Score Breakdown</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Market Dynamics</span>
                                <span className={`text-xs font-medium ${displayLeverage.marketDynamicsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.marketDynamicsScore >= 0 ? '+' : ''}{displayLeverage.marketDynamicsScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Economic Factors</span>
                                <span className={`text-xs font-medium ${displayLeverage.economicFactorsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.economicFactorsScore >= 0 ? '+' : ''}{displayLeverage.economicFactorsScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Strategic Position</span>
                                <span className={`text-xs font-medium ${displayLeverage.strategicPositionScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.strategicPositionScore >= 0 ? '+' : ''}{displayLeverage.strategicPositionScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">BATNA Strength</span>
                                <span className={`text-xs font-medium ${displayLeverage.batnaScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {displayLeverage.batnaScore >= 0 ? '+' : ''}{displayLeverage.batnaScore}
                                </span>
                            </div>
                        </div>

                        {/* Factor Rationales */}
                        <div className="mt-3 space-y-2">
                            {displayLeverage.marketDynamicsRationale && (
                                <div className="text-xs text-slate-500">
                                    <span className="font-medium">Market:</span> {displayLeverage.marketDynamicsRationale}
                                </div>
                            )}
                            {displayLeverage.batnaRationale && (
                                <div className="text-xs text-slate-500">
                                    <span className="font-medium">BATNA:</span> {displayLeverage.batnaRationale}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // SECTION 12: CLAUSE TREE ITEM COMPONENT
    // ============================================================================

    const ClauseTreeItem = ({ clause, depth = 0 }: { clause: ContractClause, depth?: number }) => {
        const hasChildren = clause.children && clause.children.length > 0
        const isSelected = selectedClause?.positionId === clause.positionId

        return (
            <div>
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition group ${isSelected
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'hover:bg-slate-50'
                        }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => handleClauseSelect(clause)}
                >
                    {/* Expand/Collapse Arrow */}
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClauseToggle(clause.positionId)
                            }}
                            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
                        >
                            <svg
                                className={`w-3 h-3 transition-transform ${clause.isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-4"></div>
                    )}

                    {/* Status Indicator */}
                    <div className={`w-2 h-2 rounded-full ${getStatusBgColor(clause.status)}`}></div>

                    {/* Clause Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-mono">{clause.clauseNumber}</span>
                            <span className={`text-sm truncate ${isSelected ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                                {clause.clauseName}
                            </span>
                        </div>
                    </div>

                    {/* Weight Badge (if high priority) */}
                    {(clause.customerWeight >= 8 || clause.providerWeight >= 8) && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            W{Math.max(clause.customerWeight, clause.providerWeight)}
                        </span>
                    )}

                    {/* Deal Breaker Flag */}
                    {(clause.isDealBreakerCustomer || clause.isDealBreakerProvider) && (
                        <span className="text-red-500 text-xs">⚑</span>
                    )}
                </div>

                {/* Children */}
                {hasChildren && clause.isExpanded && (
                    <div>
                        {clause.children!.map(child => (
                            <ClauseTreeItem key={child.positionId} clause={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // SECTION 13: MAIN LAYOUT RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Party Status Banner */}
            <PartyStatusBanner />

            {/* Main Three-Panel Layout - FIXED HEIGHT, INDEPENDENT SCROLLING */}
            <div className="flex h-[calc(100vh-52px)] overflow-hidden">
                {/* ================================================================== */}
                {/* LEFT PANEL: Clause Navigation - INDEPENDENT SCROLL */}
                {/* ================================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                    {/* Panel Header */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-slate-800">Contract Clauses</h2>
                        </div>

                        {/* Clause Stats Grid */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-emerald-50 rounded p-2">
                                <div className="text-lg font-bold text-emerald-600">{clauseStats.aligned}</div>
                                <div className="text-xs text-emerald-600">Aligned</div>
                            </div>
                            <div className="bg-amber-50 rounded p-2">
                                <div className="text-lg font-bold text-amber-600">{clauseStats.negotiating}</div>
                                <div className="text-xs text-amber-600">Active</div>
                            </div>
                            <div className="bg-red-50 rounded p-2">
                                <div className="text-lg font-bold text-red-600">{clauseStats.disputed}</div>
                                <div className="text-xs text-red-600">Disputed</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-lg font-bold text-slate-600">{clauseStats.pending}</div>
                                <div className="text-xs text-slate-600">Pending</div>
                            </div>
                        </div>
                    </div>

                    {/* Clause Tree - SCROLLABLE */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {clauseTree.map(clause => (
                            <ClauseTreeItem key={clause.positionId} clause={clause} />
                        ))}
                    </div>

                    {/* Add Clause Button */}
                    <div className="flex-shrink-0 p-4 border-t border-slate-200">
                        <button className="w-full py-2 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Clause
                        </button>
                    </div>
                </div>

                {/* ================================================================== */}
                {/* CENTER PANEL: Main Workspace - INDEPENDENT SCROLL */}
                {/* ================================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Leverage Indicator - FIXED AT TOP */}
                    <div className="flex-shrink-0 p-4 pb-0">
                        <LeverageIndicator />
                    </div>

                    {/* Workspace Header - FIXED */}
                    {selectedClause && (
                        <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-white mx-4 rounded-t-xl mt-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-mono text-slate-400">{selectedClause.clauseNumber}</span>
                                        <h2 className="text-lg font-semibold text-slate-800">{selectedClause.clauseName}</h2>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedClause.status === 'aligned' ? 'bg-emerald-100 text-emerald-700' :
                                            selectedClause.status === 'negotiating' ? 'bg-amber-100 text-amber-700' :
                                                selectedClause.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-700'
                                            }`}>
                                            {selectedClause.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">{selectedClause.description}</p>
                                </div>

                                {/* Tab Navigation */}
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                    {(['dynamics', 'tradeoffs', 'history', 'draft'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-3 py-1.5 text-sm rounded-md transition ${activeTab === tab
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Workspace Content - SCROLLABLE */}
                    <div className="flex-1 overflow-y-auto p-4 pt-0">
                        {/* YOUR EXISTING WORKSPACE CONTENT (activeTab logic) */}
                        {activeTab === 'dynamics' && selectedClause && (
                            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                                {/* Position Comparison */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Position Comparison</h3>

                                    <div className="space-y-4">
                                        {/* Customer Position */}
                                        <div>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-emerald-600 font-medium">{session.customerCompany}</span>
                                                <span className="text-slate-600">
                                                    {selectedClause.customerPosition !== null
                                                        ? (selectedClause.customerPosition >= 1000
                                                            ? formatPositionValue(selectedClause.customerPosition)
                                                            : selectedClause.customerPosition + (selectedClause.clauseName.includes('SLA') ? '%' : ''))
                                                        : 'Not set'}
                                                </span>
                                            </div>
                                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 transition-all"
                                                    style={{ width: selectedClause.customerPosition !== null ? `${Math.min(selectedClause.customerPosition, 100)}%` : '0%' }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Provider Position */}
                                        <div>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-blue-600 font-medium">{session.providerCompany}</span>
                                                <span className="text-slate-600">
                                                    {selectedClause.providerPosition !== null
                                                        ? (selectedClause.providerPosition >= 1000
                                                            ? formatPositionValue(selectedClause.providerPosition)
                                                            : selectedClause.providerPosition + (selectedClause.clauseName.includes('SLA') ? '%' : ''))
                                                        : 'Not set'}
                                                </span>
                                            </div>
                                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all"
                                                    style={{ width: selectedClause.providerPosition !== null ? `${Math.min(selectedClause.providerPosition, 100)}%` : '0%' }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Gap Indicator */}
                                        {selectedClause.gapSize > 0 && (
                                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                                                <span className="text-sm text-amber-700">Gap to Close</span>
                                                <span className="text-sm font-semibold text-amber-700">
                                                    {selectedClause.gapSize >= 1000
                                                        ? formatPositionValue(selectedClause.gapSize)
                                                        : selectedClause.gapSize + (selectedClause.clauseName.includes('SLA') ? '%' : '')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CLARENCE Recommendation */}
                                {selectedClause.clarenceRecommendation !== null && (
                                    <div className="mb-6 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-white font-bold text-sm">C</span>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-emerald-800 mb-1">CLARENCE Recommendation</div>
                                                <div className="text-lg font-bold text-emerald-700">
                                                    {selectedClause.clarenceRecommendation >= 1000
                                                        ? formatPositionValue(selectedClause.clarenceRecommendation)
                                                        : selectedClause.clarenceRecommendation + (selectedClause.clauseName.includes('SLA') ? '%' : '')}
                                                </div>
                                                {selectedClause.industryStandard !== null && (
                                                    <div className="text-xs text-emerald-600 mt-1">
                                                        Industry standard: {selectedClause.industryStandard >= 1000
                                                            ? formatPositionValue(selectedClause.industryStandard)
                                                            : selectedClause.industryStandard + (selectedClause.clauseName.includes('SLA') ? '%' : '')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Keep rest of dynamics tab content */}
                                {/* Weighting, Notes, etc. */}
                            </div>
                        )}

                        {/* Keep other tab content (draft, tradeoffs, history) */}
                        {/* And the "no clause selected" state */}

                        {!selectedClause && (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-700 mb-2">Select a Clause</h3>
                                    <p className="text-sm text-slate-500">Choose a clause from the left panel to view its details</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* View Full Contract Button - FIXED AT BOTTOM */}
                    <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-3">
                        <button className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Full Contract Draft
                        </button>
                    </div>
                </div>

                {/* ================================================================== */}
                {/* RIGHT PANEL: CLARENCE Chat - INDEPENDENT SCROLL */}
                {/* ================================================================== */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
                    {/* Chat Header - FIXED */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-slate-800">CLARENCE</div>
                                <div className="text-xs text-slate-500">
                                    {selectedClause
                                        ? `Discussing: ${selectedClause.clauseNumber} ${selectedClause.clauseName}`
                                        : 'General Discussion'
                                    }
                                </div>
                            </div>
                            {/* AI Status Indicator (NEW) */}
                            <div className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${isChatLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                                <span className="text-xs text-slate-400">{isChatLoading ? 'Thinking...' : 'Ready'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Chat Messages - SCROLLABLE */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {chatMessages.map((msg) => (
                            <div
                                key={msg.messageId}
                                className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-lg p-3 ${msg.sender === 'clarence'
                                    ? 'bg-white text-slate-700 border border-slate-200'
                                    : msg.sender === 'customer'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-blue-500 text-white'
                                    }`}>
                                    {msg.sender === 'clarence' && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">C</span>
                                            </div>
                                            <span className="text-xs font-medium text-emerald-700">CLARENCE</span>
                                        </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                    <div className={`text-xs mt-2 ${msg.sender === 'clarence' ? 'text-slate-400' : 'text-white/70'
                                        }`}>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-lg p-3 border border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input - FIXED AT BOTTOM */}
                    <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={selectedClause
                                    ? `Ask about ${selectedClause.clauseName}...`
                                    : "Ask CLARENCE anything..."
                                }
                                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                disabled={isChatLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim() || isChatLoading}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-lg transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => handleQuickAction('What trade-offs could help us reach agreement faster?')}
                                disabled={isChatLoading}
                                className="flex-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-600 rounded-lg transition"
                            >
                                Suggest Trade-off
                            </button>
                            <button
                                onClick={() => handleQuickAction('What is the industry standard for this clause?')}
                                disabled={isChatLoading}
                                className="flex-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-600 rounded-lg transition"
                            >
                                Industry Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 14: DEFAULT EXPORT WITH SUSPENSE WRAPPER
// ============================================================================

export default function ContractStudioPage() {
    return (
        <Suspense fallback={<ContractStudioLoading />}>
            <ContractStudioContent />
        </Suspense>
    )
}