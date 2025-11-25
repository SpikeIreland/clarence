'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

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
// SECTION 2: API CONFIGURATION & FUNCTIONS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

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

function getMockSession(): Session {
    return {
        sessionId: 'fba5fcab-ab6d-428d-9227-5389696100aa',
        sessionNumber: 'SIS-16092025-001',
        customerCompany: 'Spike Island Studios',
        providerCompany: 'TechFirst Solutions',
        serviceType: 'IT Services',
        dealValue: '£2,000,000',
        phase: 2,
        status: 'active'
    }
}

function getMockLeverageData(): LeverageData {
    return {
        // Leverage Score (from onboarding analysis - fixed baseline)
        leverageScoreCustomer: 55,
        leverageScoreProvider: 45,
        leverageScoreCalculatedAt: '2025-01-15T10:30:00Z',

        // Leverage Tracker (from current clause positions - changes in real-time)
        leverageTrackerCustomer: 62,
        leverageTrackerProvider: 38,
        alignmentPercentage: 87,
        isAligned: false,
        leverageTrackerCalculatedAt: new Date().toISOString(),

        // Factor breakdown
        marketDynamicsScore: 12,
        marketDynamicsRationale: 'Multiple qualified providers competing; buyer\'s market conditions',
        economicFactorsScore: 8,
        economicFactorsRationale: 'Deal represents 3% of provider revenue; moderate dependency',
        strategicPositionScore: -5,
        strategicPositionRationale: 'Mission-critical service increases provider leverage',
        batnaScore: 10,
        batnaRationale: 'Customer has viable alternatives; provider needs the win'
    }
}

function getMockClauses(): ContractClause[] {
    return [
        // Category 1: Scope of Services
        {
            positionId: 'pos-001',
            clauseId: 'clause-001',
            clauseNumber: '1',
            clauseName: 'Scope of Services',
            category: 'scope',
            description: 'Defines the services to be provided under this agreement',
            parentPositionId: null,
            clauseLevel: 1,
            displayOrder: 1,
            customerPosition: null,
            providerPosition: null,
            currentCompromise: null,
            clarenceRecommendation: null,
            industryStandard: null,
            gapSize: 0,
            customerWeight: 8,
            providerWeight: 7,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'pending',
            isExpanded: true,
            children: []
        },
        {
            positionId: 'pos-002',
            clauseId: 'clause-002',
            clauseNumber: '1.1',
            clauseName: 'Core Services',
            category: 'scope',
            description: 'Primary services included in the base contract',
            parentPositionId: 'pos-001',
            clauseLevel: 2,
            displayOrder: 2,
            customerPosition: 85,
            providerPosition: 80,
            currentCompromise: 82,
            clarenceRecommendation: 83,
            industryStandard: 80,
            gapSize: 5,
            customerWeight: 9,
            providerWeight: 8,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: 'The Provider shall deliver the following core services...',
            customerNotes: 'Need 24/7 coverage included',
            providerNotes: null,
            status: 'aligned',
            children: []
        },
        {
            positionId: 'pos-003',
            clauseId: 'clause-003',
            clauseNumber: '1.2',
            clauseName: 'Additional Services',
            category: 'scope',
            description: 'Optional services available upon request',
            parentPositionId: 'pos-001',
            clauseLevel: 2,
            displayOrder: 3,
            customerPosition: 70,
            providerPosition: 60,
            currentCompromise: 65,
            clarenceRecommendation: 68,
            industryStandard: 65,
            gapSize: 10,
            customerWeight: 5,
            providerWeight: 6,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'negotiating',
            children: []
        },

        // Category 2: Pricing Structure
        {
            positionId: 'pos-004',
            clauseId: 'clause-004',
            clauseNumber: '2',
            clauseName: 'Pricing Structure',
            category: 'pricing',
            description: 'Commercial terms and fee arrangements',
            parentPositionId: null,
            clauseLevel: 1,
            displayOrder: 4,
            customerPosition: null,
            providerPosition: null,
            currentCompromise: null,
            clarenceRecommendation: null,
            industryStandard: null,
            gapSize: 0,
            customerWeight: 10,
            providerWeight: 10,
            isDealBreakerCustomer: true,
            isDealBreakerProvider: true,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'negotiating',
            isExpanded: true,
            children: []
        },
        {
            positionId: 'pos-005',
            clauseId: 'clause-005',
            clauseNumber: '2.1',
            clauseName: 'Base Annual Fee',
            category: 'pricing',
            description: 'Fixed annual service charge',
            parentPositionId: 'pos-004',
            clauseLevel: 2,
            displayOrder: 5,
            customerPosition: 850000,
            providerPosition: 950000,
            currentCompromise: null,
            clarenceRecommendation: 900000,
            industryStandard: 875000,
            gapSize: 100000,
            customerWeight: 10,
            providerWeight: 10,
            isDealBreakerCustomer: true,
            isDealBreakerProvider: false,
            clauseContent: 'The Customer shall pay the Provider an annual fee of £[AMOUNT]...',
            customerNotes: 'Budget ceiling is £900K',
            providerNotes: 'Minimum viable is £920K given scope',
            status: 'disputed',
            children: []
        },
        {
            positionId: 'pos-006',
            clauseId: 'clause-006',
            clauseNumber: '2.2',
            clauseName: 'Variable Costs',
            category: 'pricing',
            description: 'Usage-based and volume-dependent charges',
            parentPositionId: 'pos-004',
            clauseLevel: 2,
            displayOrder: 6,
            customerPosition: null,
            providerPosition: null,
            currentCompromise: null,
            clarenceRecommendation: null,
            industryStandard: null,
            gapSize: 0,
            customerWeight: 7,
            providerWeight: 8,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'pending',
            isExpanded: false,
            children: []
        },
        {
            positionId: 'pos-007',
            clauseId: 'clause-007',
            clauseNumber: '2.2.1',
            clauseName: 'Usage-Based Fees',
            category: 'pricing',
            description: 'Per-transaction or per-user charges',
            parentPositionId: 'pos-006',
            clauseLevel: 3,
            displayOrder: 7,
            customerPosition: 15,
            providerPosition: 25,
            currentCompromise: 20,
            clarenceRecommendation: 18,
            industryStandard: 20,
            gapSize: 10,
            customerWeight: 6,
            providerWeight: 7,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'negotiating',
            children: []
        },
        {
            positionId: 'pos-008',
            clauseId: 'clause-008',
            clauseNumber: '2.2.2',
            clauseName: 'Volume Discounts',
            category: 'pricing',
            description: 'Tiered pricing based on transaction volumes',
            parentPositionId: 'pos-006',
            clauseLevel: 3,
            displayOrder: 8,
            customerPosition: 20,
            providerPosition: 10,
            currentCompromise: 15,
            clarenceRecommendation: 15,
            industryStandard: 12,
            gapSize: 10,
            customerWeight: 5,
            providerWeight: 4,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'aligned',
            children: []
        },
        {
            positionId: 'pos-009',
            clauseId: 'clause-009',
            clauseNumber: '2.3',
            clauseName: 'Payment Schedule',
            category: 'pricing',
            description: 'Timing and terms of payments',
            parentPositionId: 'pos-004',
            clauseLevel: 2,
            displayOrder: 9,
            customerPosition: 60,
            providerPosition: 30,
            currentCompromise: 45,
            clarenceRecommendation: 45,
            industryStandard: 45,
            gapSize: 30,
            customerWeight: 6,
            providerWeight: 8,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: 'Payment shall be made within [X] days of invoice...',
            customerNotes: 'Prefer 60 days for cash flow',
            providerNotes: 'Need 30 days maximum',
            status: 'negotiating',
            children: []
        },

        // Category 3: Service Levels
        {
            positionId: 'pos-010',
            clauseId: 'clause-010',
            clauseNumber: '3',
            clauseName: 'Service Levels',
            category: 'sla',
            description: 'Performance standards and guarantees',
            parentPositionId: null,
            clauseLevel: 1,
            displayOrder: 10,
            customerPosition: null,
            providerPosition: null,
            currentCompromise: null,
            clarenceRecommendation: null,
            industryStandard: null,
            gapSize: 0,
            customerWeight: 9,
            providerWeight: 7,
            isDealBreakerCustomer: true,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'disputed',
            isExpanded: true,
            children: []
        },
        {
            positionId: 'pos-011',
            clauseId: 'clause-011',
            clauseNumber: '3.1',
            clauseName: 'Uptime SLA',
            category: 'sla',
            description: 'System availability guarantees',
            parentPositionId: 'pos-010',
            clauseLevel: 2,
            displayOrder: 11,
            customerPosition: 99.9,
            providerPosition: 99.5,
            currentCompromise: null,
            clarenceRecommendation: 99.7,
            industryStandard: 99.5,
            gapSize: 0.4,
            customerWeight: 10,
            providerWeight: 8,
            isDealBreakerCustomer: true,
            isDealBreakerProvider: false,
            clauseContent: 'The Provider guarantees system availability of [X]% measured monthly...',
            customerNotes: 'Mission critical - need 99.9%',
            providerNotes: '99.9% requires significant infrastructure investment',
            status: 'disputed',
            children: []
        },
        {
            positionId: 'pos-012',
            clauseId: 'clause-012',
            clauseNumber: '3.2',
            clauseName: 'Response Times',
            category: 'sla',
            description: 'Incident response time commitments',
            parentPositionId: 'pos-010',
            clauseLevel: 2,
            displayOrder: 12,
            customerPosition: 15,
            providerPosition: 30,
            currentCompromise: 20,
            clarenceRecommendation: 20,
            industryStandard: 30,
            gapSize: 15,
            customerWeight: 8,
            providerWeight: 6,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: '15 minutes for P1 issues',
            providerNotes: null,
            status: 'negotiating',
            children: []
        },

        // Category 4: Liability
        {
            positionId: 'pos-013',
            clauseId: 'clause-013',
            clauseNumber: '4',
            clauseName: 'Liability & Indemnification',
            category: 'liability',
            description: 'Liability caps and indemnity provisions',
            parentPositionId: null,
            clauseLevel: 1,
            displayOrder: 13,
            customerPosition: null,
            providerPosition: null,
            currentCompromise: null,
            clarenceRecommendation: null,
            industryStandard: null,
            gapSize: 0,
            customerWeight: 8,
            providerWeight: 9,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: true,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'negotiating',
            isExpanded: false,
            children: []
        },
        {
            positionId: 'pos-014',
            clauseId: 'clause-014',
            clauseNumber: '4.1',
            clauseName: 'Liability Cap',
            category: 'liability',
            description: 'Maximum liability exposure',
            parentPositionId: 'pos-013',
            clauseLevel: 2,
            displayOrder: 14,
            customerPosition: 200,
            providerPosition: 50,
            currentCompromise: null,
            clarenceRecommendation: 100,
            industryStandard: 100,
            gapSize: 150,
            customerWeight: 9,
            providerWeight: 10,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: true,
            clauseContent: 'The Provider\'s total liability shall not exceed [X]% of annual charges...',
            customerNotes: 'Need 200% of annual fees',
            providerNotes: 'Cannot exceed 50% of contract value',
            status: 'disputed',
            children: []
        },

        // Category 5: Term & Termination
        {
            positionId: 'pos-015',
            clauseId: 'clause-015',
            clauseNumber: '5',
            clauseName: 'Term & Termination',
            category: 'term',
            description: 'Contract duration and exit provisions',
            parentPositionId: null,
            clauseLevel: 1,
            displayOrder: 15,
            customerPosition: null,
            providerPosition: null,
            currentCompromise: null,
            clarenceRecommendation: null,
            industryStandard: null,
            gapSize: 0,
            customerWeight: 7,
            providerWeight: 8,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: null,
            providerNotes: null,
            status: 'pending',
            isExpanded: false,
            children: []
        },
        {
            positionId: 'pos-016',
            clauseId: 'clause-016',
            clauseNumber: '5.1',
            clauseName: 'Initial Term',
            category: 'term',
            description: 'Primary contract period',
            parentPositionId: 'pos-015',
            clauseLevel: 2,
            displayOrder: 16,
            customerPosition: 24,
            providerPosition: 36,
            currentCompromise: 30,
            clarenceRecommendation: 30,
            industryStandard: 36,
            gapSize: 12,
            customerWeight: 6,
            providerWeight: 8,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: 'Prefer 24 months for flexibility',
            providerNotes: '36 months needed for ROI',
            status: 'negotiating',
            children: []
        },
        {
            positionId: 'pos-017',
            clauseId: 'clause-017',
            clauseNumber: '5.2',
            clauseName: 'Termination for Convenience',
            category: 'term',
            description: 'Notice period for early exit',
            parentPositionId: 'pos-015',
            clauseLevel: 2,
            displayOrder: 17,
            customerPosition: 30,
            providerPosition: 90,
            currentCompromise: 60,
            clarenceRecommendation: 60,
            industryStandard: 90,
            gapSize: 60,
            customerWeight: 7,
            providerWeight: 7,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: '30 days notice preferred',
            providerNotes: '90 days minimum for transition',
            status: 'negotiating',
            children: []
        }
    ]
}

function getMockChatMessages(positionId: string | null): ClauseChatMessage[] {
    const baseMessages: ClauseChatMessage[] = [
        {
            messageId: 'msg-001',
            sessionId: 'fba5fcab-ab6d-428d-9227-5389696100aa',
            positionId: null,
            sender: 'clarence',
            senderUserId: null,
            message: 'Welcome to Contract Studio. I\'m here to help you negotiate the IT Services agreement between Spike Island Studios and TechFirst Solutions. Select a clause from the left panel to begin detailed discussions.',
            messageType: 'notification',
            relatedPositionChange: false,
            triggeredBy: 'session_start',
            createdAt: new Date(Date.now() - 3600000).toISOString()
        }
    ]

    if (positionId === 'pos-005') {
        baseMessages.push(
            {
                messageId: 'msg-002',
                sessionId: 'fba5fcab-ab6d-428d-9227-5389696100aa',
                positionId: 'pos-005',
                sender: 'customer',
                senderUserId: 'user-001',
                message: 'The £950K ask is too high. Our budget ceiling is £900K.',
                messageType: 'discussion',
                relatedPositionChange: false,
                triggeredBy: 'manual',
                createdAt: new Date(Date.now() - 1800000).toISOString()
            },
            {
                messageId: 'msg-003',
                sessionId: 'fba5fcab-ab6d-428d-9227-5389696100aa',
                positionId: 'pos-005',
                sender: 'clarence',
                senderUserId: null,
                message: 'I understand the budget constraint. The Base Annual Fee has a significant gap of £100K between positions. Industry benchmarks suggest £875K for similar scope.\n\nConsider: meeting at £900K here could give you leverage on the SLA clause where you\'re seeking 99.9% uptime. Would you like me to model this trade-off?',
                messageType: 'auto_response',
                relatedPositionChange: false,
                triggeredBy: 'clause_selected',
                createdAt: new Date(Date.now() - 1700000).toISOString()
            }
        )
    }

    if (positionId === 'pos-011') {
        baseMessages.push(
            {
                messageId: 'msg-004',
                sessionId: 'fba5fcab-ab6d-428d-9227-5389696100aa',
                positionId: 'pos-011',
                sender: 'clarence',
                senderUserId: null,
                message: 'The Uptime SLA is marked as a deal-breaker for Spike Island Studios. The 0.4% gap between 99.9% and 99.5% represents significant infrastructure investment for the provider.\n\nSuggestion: Accepting 99.7% with enhanced service credits could satisfy both parties while keeping costs reasonable.',
                messageType: 'auto_response',
                relatedPositionChange: false,
                triggeredBy: 'clause_selected',
                createdAt: new Date(Date.now() - 900000).toISOString()
            }
        )
    }

    return baseMessages
}

function getMockUserInfo(): UserInfo {
    return {
        firstName: 'Paul',
        lastName: 'Crosbie',
        email: 'paul@spikeisland.tv',
        company: 'Spike Island Studios',
        role: 'customer',
        userId: '76783a96-b05f-4bd1-b0ab-6ebbeb0647e4'
    }
}

function getMockOtherPartyStatus(): PartyStatus {
    return {
        isOnline: true,
        lastSeen: new Date().toISOString(),
        userName: 'James Chen'
    }
}

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

    const chatEndRef = useRef<HTMLDivElement>(null)

    // ============================================================================
    // SECTION 7: DATA LOADING
    // ============================================================================

    const loadUserInfo = useCallback(() => {
        // Check for auth in localStorage
        const authData = localStorage.getItem('clarence_auth')
        if (!authData) {
            router.push('/auth/login')
            return null
        }

        try {
            const parsed = JSON.parse(authData)
            return getMockUserInfo() // Use mock for now
        } catch {
            router.push('/auth/login')
            return null
        }
    }, [router])

    const loadContractData = useCallback(async (sessionId: string) => {
        // Try API first
        const apiData = await fetchContractStudioData(sessionId)

        if (apiData) {
            return apiData
        }

        // Fall back to mock data
        return {
            session: getMockSession(),
            clauses: getMockClauses(),
            leverage: getMockLeverageData()
        }
    }, [])

    const loadClauseChat = useCallback(async (sessionId: string, positionId: string | null) => {
        // Try API first
        const apiMessages = await fetchClauseChat(sessionId, positionId)

        if (apiMessages.length > 0) {
            return apiMessages
        }

        // Fall back to mock messages
        return getMockChatMessages(positionId)
    }, [])

    // Initial load
    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (!user) return

            setUserInfo(user)

            const sessionId = searchParams.get('session') || 'fba5fcab-ab6d-428d-9227-5389696100aa'
            const data = await loadContractData(sessionId)

            setSession(data.session)
            setClauses(data.clauses)
            setClauseTree(buildClauseTree(data.clauses))
            setLeverage(data.leverage)

            // Load general chat
            const messages = await loadClauseChat(sessionId, null)
            setChatMessages(messages)

            // Check other party status
            const otherRole = user.role === 'customer' ? 'provider' : 'customer'
            const status = getMockOtherPartyStatus()
            setOtherPartyStatus(status)

            setLoading(false)
        }

        init()
    }, [loadUserInfo, loadContractData, loadClauseChat, searchParams])

    // Load clause-specific chat when selection changes
    useEffect(() => {
        if (!session) return

        const loadChat = async () => {
            const messages = await loadClauseChat(session.sessionId, selectedClause?.positionId || null)
            setChatMessages(messages)
        }

        loadChat()
    }, [selectedClause, session, loadClauseChat])

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // Periodically check other party status
    useEffect(() => {
        const interval = setInterval(() => {
            // In production, this would call the API
            // For demo, randomly toggle status occasionally
            setOtherPartyStatus(prev => ({
                ...prev,
                isOnline: Math.random() > 0.2, // Stay mostly online
                lastSeen: prev.isOnline ? new Date().toISOString() : prev.lastSeen
            }))
        }, 30000) // Every 30 seconds

        return () => clearInterval(interval)
    }, [])

    // ============================================================================
    // SECTION 8: EVENT HANDLERS
    // ============================================================================

    const handleClauseSelect = (clause: ContractClause) => {
        setSelectedClause(clause)
        setActiveTab('dynamics')
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

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !session || !userInfo) return

        const newMessage: ClauseChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            positionId: selectedClause?.positionId || null,
            sender: userInfo.role || 'customer',
            senderUserId: userInfo.userId || null,
            message: chatInput,
            messageType: 'discussion',
            relatedPositionChange: false,
            triggeredBy: 'manual',
            createdAt: new Date().toISOString()
        }

        setChatMessages(prev => [...prev, newMessage])
        setChatInput('')
        setIsChatLoading(true)

        // Simulate CLARENCE response
        setTimeout(() => {
            const clarenceResponse: ClauseChatMessage = {
                messageId: `msg-${Date.now() + 1}`,
                sessionId: session.sessionId,
                positionId: selectedClause?.positionId || null,
                sender: 'clarence',
                senderUserId: null,
                message: selectedClause
                    ? `I understand your point about ${selectedClause.clauseName}. Based on the current positions and market data, I would suggest exploring a middle ground. Would you like me to analyze potential trade-offs with other clauses?`
                    : 'Thank you for your input. How can I help you progress the negotiation?',
                messageType: 'auto_response',
                relatedPositionChange: false,
                triggeredBy: 'user_message',
                createdAt: new Date().toISOString()
            }

            setChatMessages(prev => [...prev, clarenceResponse])
            setIsChatLoading(false)
        }, 1000)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    // ============================================================================
    // SECTION 9: LOADING STATE RENDER
    // ============================================================================

    if (loading) {
        return <ContractStudioLoading />
    }

    if (!session || !leverage || !userInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600">Failed to load contract data</p>
                    <button
                        onClick={() => router.push('/auth/dashboard')}
                        className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        )
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
        const customerShift = leverage.leverageTrackerCustomer - leverage.leverageScoreCustomer
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
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${leverage.alignmentPercentage >= 90
                        ? 'bg-emerald-100 text-emerald-700'
                        : leverage.alignmentPercentage >= 70
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {leverage.alignmentPercentage}% Aligned
                    </div>
                </div>

                {/* Three Metrics Cards */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {/* Leverage Score (Fixed Baseline) */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Leverage Score</div>
                        <div className="text-lg font-bold text-slate-800">
                            {leverage.leverageScoreCustomer} : {leverage.leverageScoreProvider}
                        </div>
                        <div className="text-xs text-slate-400">Fixed baseline from assessment</div>
                    </div>

                    {/* Alignment Score */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Alignment Score</div>
                        <div className="text-lg font-bold text-emerald-600">
                            {leverage.alignmentPercentage}%
                        </div>
                        <div className="text-xs text-slate-400">Progress to agreement</div>
                    </div>

                    {/* Leverage Tracker (Dynamic) */}
                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 mb-1">Leverage Tracker</div>
                        <div className="text-lg font-bold text-slate-800">
                            {leverage.leverageTrackerCustomer} : {leverage.leverageTrackerProvider}
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
                            style={{ left: `${leverage.leverageScoreCustomer}%`, transform: 'translateX(-50%)' }}
                            title={`Leverage Score: ${leverage.leverageScoreCustomer}%`}
                        >
                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-600 whitespace-nowrap">
                                ◆ {leverage.leverageScoreCustomer}%
                            </div>
                        </div>

                        {/* Leverage Tracker (dynamic - shown as fill) */}
                        <div
                            className={`h-full transition-all duration-500 ${leverage.leverageTrackerCustomer > leverage.leverageScoreCustomer
                                ? 'bg-emerald-500'
                                : 'bg-amber-500'
                                }`}
                            style={{ width: `${leverage.leverageTrackerCustomer}%` }}
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
                                <span className={`text-xs font-medium ${leverage.marketDynamicsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {leverage.marketDynamicsScore >= 0 ? '+' : ''}{leverage.marketDynamicsScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Economic Factors</span>
                                <span className={`text-xs font-medium ${leverage.economicFactorsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {leverage.economicFactorsScore >= 0 ? '+' : ''}{leverage.economicFactorsScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">Strategic Position</span>
                                <span className={`text-xs font-medium ${leverage.strategicPositionScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {leverage.strategicPositionScore >= 0 ? '+' : ''}{leverage.strategicPositionScore}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs text-slate-600">BATNA Strength</span>
                                <span className={`text-xs font-medium ${leverage.batnaScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {leverage.batnaScore >= 0 ? '+' : ''}{leverage.batnaScore}
                                </span>
                            </div>
                        </div>

                        {/* Factor Rationales */}
                        <div className="mt-3 space-y-2">
                            {leverage.marketDynamicsRationale && (
                                <div className="text-xs text-slate-500">
                                    <span className="font-medium">Market:</span> {leverage.marketDynamicsRationale}
                                </div>
                            )}
                            {leverage.batnaRationale && (
                                <div className="text-xs text-slate-500">
                                    <span className="font-medium">BATNA:</span> {leverage.batnaRationale}
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

            {/* Main Three-Panel Layout */}
            <div className="flex-1 flex overflow-hidden h-0">
                {/* ================================================================== */}
                {/* LEFT PANEL: Clause Navigation */}
                {/* ================================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                    {/* Panel Header */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-slate-800">Contract Clauses</h2>
                            <button
                                onClick={() => router.push('/auth/dashboard')}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                </svg>
                            </button>
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

                    {/* Clause Tree */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {clauseTree.map(clause => (
                            <ClauseTreeItem key={clause.positionId} clause={clause} />
                        ))}
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-slate-200 flex-shrink-0 bg-white">
                        <button className="w-full py-2 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Clause
                        </button>
                    </div>
                </div>

                {/* ================================================================== */}
                {/* CENTER PANEL: Main Workspace */}
                {/* ================================================================== */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Leverage Indicator */}
                    <div className="p-4 pb-0">
                        <LeverageIndicator />
                    </div>

                    {/* Workspace Header */}
                    {selectedClause && (
                        <div className="px-6 py-3 border-b border-slate-200 bg-white mx-4 rounded-t-xl mt-2">
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

                    {/* Workspace Content */}
                    <div className="flex-1 overflow-y-auto p-4 pt-0">
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

                                {/* Weighting */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Clause Weighting</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-emerald-50 rounded-lg">
                                            <div className="text-xs text-emerald-600 mb-1">Customer Weight</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-bold text-emerald-700">{selectedClause.customerWeight}</span>
                                                <span className="text-xs text-emerald-600">/10</span>
                                                {selectedClause.isDealBreakerCustomer && (
                                                    <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Deal Breaker</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg">
                                            <div className="text-xs text-blue-600 mb-1">Provider Weight</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-bold text-blue-700">{selectedClause.providerWeight}</span>
                                                <span className="text-xs text-blue-600">/10</span>
                                                {selectedClause.isDealBreakerProvider && (
                                                    <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Deal Breaker</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                {(selectedClause.customerNotes || selectedClause.providerNotes) && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Party Notes</h3>
                                        <div className="space-y-2">
                                            {selectedClause.customerNotes && (
                                                <div className="p-3 bg-emerald-50 rounded-lg">
                                                    <div className="text-xs text-emerald-600 mb-1">Customer Notes</div>
                                                    <p className="text-sm text-emerald-800">{selectedClause.customerNotes}</p>
                                                </div>
                                            )}
                                            {selectedClause.providerNotes && (
                                                <div className="p-3 bg-blue-50 rounded-lg">
                                                    <div className="text-xs text-blue-600 mb-1">Provider Notes</div>
                                                    <p className="text-sm text-blue-800">{selectedClause.providerNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'draft' && selectedClause && (
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Clause Draft</h3>
                                {selectedClause.clauseContent ? (
                                    <div className="prose prose-sm max-w-none">
                                        <p className="text-slate-700 leading-relaxed">{selectedClause.clauseContent}</p>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-400">
                                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p>No draft content yet for this clause</p>
                                        <button className="mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition text-sm">
                                            Generate Draft
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'tradeoffs' && (
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Trade-Off Analysis</h3>
                                <div className="text-center py-12 text-slate-400">
                                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    <p>Trade-off suggestions will appear here</p>
                                    <p className="text-sm mt-2">Ask CLARENCE for cross-clause trade-off recommendations</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Position History</h3>
                                <div className="text-center py-12 text-slate-400">
                                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>No position changes recorded yet</p>
                                </div>
                            </div>
                        )}

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

                    {/* View Full Contract Button */}
                    <div className="bg-white border-t border-slate-200 px-6 py-3">
                        <button className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Full Contract Draft
                        </button>
                    </div>
                </div>

                {/* ================================================================== */}
                {/* RIGHT PANEL: CLARENCE Chat */}
                {/* ================================================================== */}
                <div className="w-96 bg-white border-l border-slate-200 flex flex-col relative">
                    {/* Chat Header - Fixed */}
                    <div className="absolute top-0 left-0 right-0 z-10 bg-white p-4 border-b border-slate-200">
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
                        </div>
                    </div>

                    {/* Chat Messages - Scrollable middle section */}
                    <div className="absolute top-[73px] bottom-[140px] left-0 right-0 overflow-y-auto p-4 space-y-4">
                        {chatMessages.map((msg) => (
                            <div
                                key={msg.messageId}
                                className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-lg p-3 ${msg.sender === 'clarence'
                                    ? 'bg-slate-100 text-slate-700'
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
                                <div className="bg-slate-100 rounded-lg p-3">
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

                    {/* Chat Input - Fixed at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 bg-white p-4 border-t border-slate-200">
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
                            <button className="flex-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition">
                                Suggest Trade-off
                            </button>
                            <button className="flex-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition">
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