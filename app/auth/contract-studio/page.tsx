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
    // Master Leverage (from onboarding - fixed)
    masterCustomerLeverage: number
    masterProviderLeverage: number
    masterCalculatedAt: string

    // Dynamic Leverage (from current positions - changes)
    dynamicCustomerLeverage: number
    dynamicProviderLeverage: number
    alignmentPercentage: number
    isAligned: boolean
    dynamicCalculatedAt: string

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
        // TODO: Replace with actual API endpoint once N8N workflow is created
        // const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
        // if (!response.ok) throw new Error('Failed to fetch contract studio data')
        // return await response.json()

        // For now, return null to trigger mock data
        return null
    } catch (error) {
        console.error('Error fetching contract studio data:', error)
        return null
    }
}

// Fetch clause-specific chat messages
async function fetchClauseChat(sessionId: string, positionId: string | null): Promise<ClauseChatMessage[]> {
    try {
        // TODO: Replace with actual API endpoint once N8N workflow is created
        // const url = positionId 
        //   ? `${API_BASE}/clause-chat-api?session_id=${sessionId}&position_id=${positionId}`
        //   : `${API_BASE}/clause-chat-api?session_id=${sessionId}&general=true`
        // const response = await fetch(url)
        // if (!response.ok) throw new Error('Failed to fetch clause chat')
        // return await response.json()

        return []
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

// ============================================================================
// SECTION 3: MOCK DATA (Temporary - Replace with API data)
// ============================================================================

function getMockSession(): Session {
    return {
        sessionId: 'sis-demo-session-001',
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
        // Master (from onboarding analysis)
        masterCustomerLeverage: 55,
        masterProviderLeverage: 45,
        masterCalculatedAt: '2025-01-15T10:30:00Z',

        // Dynamic (from current clause positions)
        dynamicCustomerLeverage: 62,
        dynamicProviderLeverage: 38,
        alignmentPercentage: 87,
        isAligned: false,
        dynamicCalculatedAt: new Date().toISOString(),

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
            customerWeight: 7,
            providerWeight: 10,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: true,
            clauseContent: 'Total liability shall not exceed [X]% of annual contract value...',
            customerNotes: 'Need 200% given criticality',
            providerNotes: 'Cannot exceed 100% - insurance limitation',
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
            description: 'Initial contract period',
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
            clauseContent: 'The initial term of this Agreement shall be [X] months...',
            customerNotes: 'Prefer shorter term for flexibility',
            providerNotes: 'Need 36 months to recover setup costs',
            status: 'negotiating',
            children: []
        },
        {
            positionId: 'pos-017',
            clauseId: 'clause-017',
            clauseNumber: '5.2',
            clauseName: 'Termination for Convenience',
            category: 'term',
            description: 'Right to terminate without cause',
            parentPositionId: 'pos-015',
            clauseLevel: 2,
            displayOrder: 17,
            customerPosition: 30,
            providerPosition: 90,
            currentCompromise: 60,
            clarenceRecommendation: 60,
            industryStandard: 90,
            gapSize: 60,
            customerWeight: 8,
            providerWeight: 7,
            isDealBreakerCustomer: false,
            isDealBreakerProvider: false,
            clauseContent: null,
            customerNotes: '30 days notice preferred',
            providerNotes: 'Need 90 days to transition',
            status: 'negotiating',
            children: []
        }
    ]
}

function getMockChatMessages(positionId: string | null): ClauseChatMessage[] {
    const generalMessages: ClauseChatMessage[] = [
        {
            messageId: 'msg-001',
            sessionId: 'sis-demo-session-001',
            positionId: null,
            sender: 'clarence',
            senderUserId: null,
            message: "Welcome to the Contract Studio! I've analyzed both parties' positions across all clauses. Your current dynamic leverage is 62% (7% above your master target of 55%). I recommend reviewing the Pricing and SLA sections where you may be overreaching.",
            messageType: 'notification',
            relatedPositionChange: false,
            triggeredBy: 'session_start',
            createdAt: new Date(Date.now() - 3600000).toISOString()
        }
    ]

    const clauseMessages: Record<string, ClauseChatMessage[]> = {
        'pos-005': [
            {
                messageId: 'msg-002',
                sessionId: 'sis-demo-session-001',
                positionId: 'pos-005',
                sender: 'clarence',
                senderUserId: null,
                message: "The Base Annual Fee has a significant gap of £100,000. The provider's position of £950K reflects their cost structure plus margin. Your £850K target is below industry standard (£875K). Consider: meeting at £900K here could give you leverage on the SLA clause.",
                messageType: 'discussion',
                relatedPositionChange: false,
                triggeredBy: 'clause_selected',
                createdAt: new Date(Date.now() - 1800000).toISOString()
            },
            {
                messageId: 'msg-003',
                sessionId: 'sis-demo-session-001',
                positionId: 'pos-005',
                sender: 'customer',
                senderUserId: 'user-001',
                message: "What if we offer £875K but request the higher SLA tier?",
                messageType: 'question',
                relatedPositionChange: false,
                triggeredBy: 'manual',
                createdAt: new Date(Date.now() - 1700000).toISOString()
            },
            {
                messageId: 'msg-004',
                sessionId: 'sis-demo-session-001',
                positionId: 'pos-005',
                sender: 'clarence',
                senderUserId: null,
                message: "That's a strategic approach! Moving to £875K here (saving you £25K from your current position) while pushing for 99.7% SLA would:\n\n• Reduce your dynamic leverage by ~3% (closer to target)\n• Create a compelling trade-off for the provider\n• Industry data shows this combination is achievable\n\nWould you like me to model this scenario?",
                messageType: 'discussion',
                relatedPositionChange: false,
                triggeredBy: 'auto_response',
                createdAt: new Date(Date.now() - 1600000).toISOString()
            }
        ],
        'pos-011': [
            {
                messageId: 'msg-005',
                sessionId: 'sis-demo-session-001',
                positionId: 'pos-011',
                sender: 'clarence',
                senderUserId: null,
                message: "The Uptime SLA is marked as a deal-breaker for you. The gap between 99.9% (your position) and 99.5% (provider) may seem small but represents significant infrastructure differences. The provider's concern is valid - achieving 99.9% requires redundant systems. Consider: accepting 99.7% with enhanced service credits could satisfy both parties.",
                messageType: 'discussion',
                relatedPositionChange: false,
                triggeredBy: 'clause_selected',
                createdAt: new Date(Date.now() - 900000).toISOString()
            }
        ]
    }

    if (positionId && clauseMessages[positionId]) {
        return clauseMessages[positionId]
    }

    return generalMessages
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

// Build nested tree structure from flat clause list
function buildClauseTree(clauses: ContractClause[]): ContractClause[] {
    const clauseMap = new Map<string, ContractClause>()
    const rootClauses: ContractClause[] = []

    // First pass: create map and initialize children arrays
    clauses.forEach(clause => {
        clauseMap.set(clause.positionId, { ...clause, children: [] })
    })

    // Second pass: build tree
    clauses.forEach(clause => {
        const currentClause = clauseMap.get(clause.positionId)!
        if (clause.parentPositionId && clauseMap.has(clause.parentPositionId)) {
            const parent = clauseMap.get(clause.parentPositionId)!
            parent.children = parent.children || []
            parent.children.push(currentClause)
        } else {
            rootClauses.push(currentClause)
        }
    })

    // Sort children by display order
    const sortChildren = (clauses: ContractClause[]) => {
        clauses.sort((a, b) => a.displayOrder - b.displayOrder)
        clauses.forEach(clause => {
            if (clause.children && clause.children.length > 0) {
                sortChildren(clause.children)
            }
        })
    }

    sortChildren(rootClauses)
    return rootClauses
}

// Get status color classes
function getStatusColor(status: string): string {
    switch (status) {
        case 'aligned': return 'bg-emerald-500'
        case 'negotiating': return 'bg-amber-500'
        case 'disputed': return 'bg-red-500'
        case 'pending': return 'bg-slate-400'
        default: return 'bg-slate-300'
    }
}

function getStatusBgColor(status: string): string {
    switch (status) {
        case 'aligned': return 'bg-emerald-50 border-emerald-200 text-emerald-700'
        case 'negotiating': return 'bg-amber-50 border-amber-200 text-amber-700'
        case 'disputed': return 'bg-red-50 border-red-200 text-red-700'
        case 'pending': return 'bg-slate-50 border-slate-200 text-slate-600'
        default: return 'bg-slate-50 border-slate-200 text-slate-600'
    }
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'aligned': return '✓'
        case 'negotiating': return '⟷'
        case 'disputed': return '!'
        case 'pending': return '○'
        default: return '○'
    }
}

// Format currency
function formatCurrency(value: number): string {
    if (value >= 1000000) {
        return `£${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
        return `£${(value / 1000).toFixed(0)}K`
    }
    return `£${value}`
}

// Calculate clause statistics
function calculateClauseStats(clauses: ContractClause[]): {
    total: number
    aligned: number
    negotiating: number
    disputed: number
    pending: number
} {
    const flatClauses = clauses.flatMap(c => [c, ...(c.children || []).flatMap(c2 => [c2, ...(c2.children || [])])])
    return {
        total: flatClauses.length,
        aligned: flatClauses.filter(c => c.status === 'aligned').length,
        negotiating: flatClauses.filter(c => c.status === 'negotiating').length,
        disputed: flatClauses.filter(c => c.status === 'disputed').length,
        pending: flatClauses.filter(c => c.status === 'pending').length
    }
}

// ============================================================================
// SECTION 5: LOADING COMPONENT
// ============================================================================

function ContractStudioLoading() {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Contract Studio...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN CONTENT COMPONENT
// ============================================================================

function ContractStudioContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const chatEndRef = useRef<HTMLDivElement>(null)

    // State
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [clauses, setClauses] = useState<ContractClause[]>([])
    const [clauseTree, setClauseTree] = useState<ContractClause[]>([])
    const [leverage, setLeverage] = useState<LeverageData | null>(null)
    const [selectedClause, setSelectedClause] = useState<ContractClause | null>(null)
    const [chatMessages, setChatMessages] = useState<ClauseChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'dynamics' | 'draft' | 'tradeoffs' | 'history'>('dynamics')
    const [showLeverageDetails, setShowLeverageDetails] = useState(false)

    // ============================================================================
    // SECTION 7: DATA LOADING
    // ============================================================================

    const loadUserInfo = useCallback(() => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return null
        }
        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        return authData.userInfo
    }, [router])

    const loadContractData = useCallback(async (sessionId: string) => {
        setLoading(true)

        try {
            // Try to fetch real data first
            const data = await fetchContractStudioData(sessionId)

            if (data) {
                setSession(data.session)
                setClauses(data.clauses)
                setClauseTree(buildClauseTree(data.clauses))
                setLeverage(data.leverage)
            } else {
                // Use mock data for development
                console.log('Using mock data for Contract Studio')
                const mockSession = getMockSession()
                const mockClauses = getMockClauses()
                const mockLeverage = getMockLeverageData()

                setSession(mockSession)
                setClauses(mockClauses)
                setClauseTree(buildClauseTree(mockClauses))
                setLeverage(mockLeverage)
            }
        } catch (error) {
            console.error('Error loading contract data:', error)
            // Fallback to mock data
            const mockSession = getMockSession()
            const mockClauses = getMockClauses()
            const mockLeverage = getMockLeverageData()

            setSession(mockSession)
            setClauses(mockClauses)
            setClauseTree(buildClauseTree(mockClauses))
            setLeverage(mockLeverage)
        } finally {
            setLoading(false)
        }
    }, [])

    const loadClauseChat = useCallback(async (positionId: string | null) => {
        if (!session) return

        try {
            const messages = await fetchClauseChat(session.sessionId, positionId)
            if (messages.length > 0) {
                setChatMessages(messages)
            } else {
                // Use mock messages
                setChatMessages(getMockChatMessages(positionId))
            }
        } catch (error) {
            console.error('Error loading clause chat:', error)
            setChatMessages(getMockChatMessages(positionId))
        }
    }, [session])

    // Initial load
    useEffect(() => {
        const user = loadUserInfo()
        if (!user) return

        const sessionId = searchParams.get('session') || 'sis-demo-session-001'
        loadContractData(sessionId)
    }, [loadUserInfo, loadContractData, searchParams])

    // Load chat when clause selection changes
    useEffect(() => {
        loadClauseChat(selectedClause?.positionId || null)
    }, [selectedClause, loadClauseChat])

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ============================================================================
    // SECTION 8: EVENT HANDLERS
    // ============================================================================

    const handleClauseSelect = (clause: ContractClause) => {
        setSelectedClause(clause)
    }

    const handleClauseToggle = (positionId: string) => {
        const updateExpanded = (clauses: ContractClause[]): ContractClause[] => {
            return clauses.map(clause => {
                if (clause.positionId === positionId) {
                    return { ...clause, isExpanded: !clause.isExpanded }
                }
                if (clause.children && clause.children.length > 0) {
                    return { ...clause, children: updateExpanded(clause.children) }
                }
                return clause
            })
        }
        setClauseTree(updateExpanded(clauseTree))
    }

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !session || !userInfo) return

        const newMessage: ClauseChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            positionId: selectedClause?.positionId || null,
            sender: (userInfo.role as 'customer' | 'provider') || 'customer',
            senderUserId: userInfo.email || null,
            message: chatInput,
            messageType: 'discussion',
            relatedPositionChange: false,
            triggeredBy: 'manual',
            createdAt: new Date().toISOString()
        }

        setChatMessages(prev => [...prev, newMessage])
        setChatInput('')
        setIsChatLoading(true)

        try {
            // Send to CLARENCE and get response
            const response = await sendClauseMessage(
                session.sessionId,
                selectedClause?.positionId || null,
                chatInput,
                (userInfo.role as 'customer' | 'provider') || 'customer'
            )

            if (response) {
                setChatMessages(prev => [...prev, response])
            } else {
                // Mock CLARENCE response
                const clarenceResponse: ClauseChatMessage = {
                    messageId: `msg-${Date.now() + 1}`,
                    sessionId: session.sessionId,
                    positionId: selectedClause?.positionId || null,
                    sender: 'clarence',
                    senderUserId: null,
                    message: selectedClause
                        ? `I understand your question about ${selectedClause.clauseName}. Let me analyze the current positions and suggest some options...`
                        : "I'm here to help you navigate this negotiation. What aspect would you like to explore?",
                    messageType: 'discussion',
                    relatedPositionChange: false,
                    triggeredBy: 'auto_response',
                    createdAt: new Date().toISOString()
                }

                setTimeout(() => {
                    setChatMessages(prev => [...prev, clarenceResponse])
                    setIsChatLoading(false)
                }, 1000)
                return
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }

        setIsChatLoading(false)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    // ============================================================================
    // SECTION 9: RENDER - LOADING STATE
    // ============================================================================

    if (loading) {
        return <ContractStudioLoading />
    }

    const clauseStats = calculateClauseStats(clauseTree)

    // ============================================================================
    // SECTION 10: RENDER - LEVERAGE INDICATOR COMPONENT
    // ============================================================================

    const LeverageIndicator = () => {
        if (!leverage) return null

        const masterPosition = leverage.masterCustomerLeverage
        const dynamicPosition = leverage.dynamicCustomerLeverage
        const difference = dynamicPosition - masterPosition

        return (
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-700">Leverage Positions</h2>
                        <p className="text-xs text-slate-500">
                            Master (target) vs Dynamic (current) alignment
                        </p>
                    </div>
                    <button
                        onClick={() => setShowLeverageDetails(!showLeverageDetails)}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                        {showLeverageDetails ? 'Hide' : 'Show'} Details
                        <svg className={`w-4 h-4 transition-transform ${showLeverageDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* Leverage Bar */}
                <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden mb-2">
                    {/* Customer side gradient */}
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${masterPosition}%` }}
                    />

                    {/* Master position marker */}
                    <div
                        className="absolute top-0 h-full w-1 bg-slate-800 z-10"
                        style={{ left: `${masterPosition}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45"></div>
                    </div>

                    {/* Dynamic position marker */}
                    <div
                        className={`absolute top-0 h-full w-1 z-20 ${difference > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ left: `${dynamicPosition}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rotate-45 ${difference > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}></div>
                    </div>

                    {/* Labels */}
                    <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-medium">
                        <span className="text-white">Customer</span>
                        <span className="text-slate-600">Provider</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-slate-800 rounded-sm"></div>
                            <span className="text-slate-600">Master: {masterPosition}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded-sm ${difference > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`}></div>
                            <span className="text-slate-600">Dynamic: {dynamicPosition}%</span>
                        </div>
                    </div>

                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${Math.abs(difference) <= 5
                            ? 'bg-emerald-100 text-emerald-700'
                            : difference > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                        {difference === 0
                            ? '✓ Aligned'
                            : difference > 0
                                ? `↑ ${difference}% over target`
                                : `↓ ${Math.abs(difference)}% under target`
                        }
                    </div>
                </div>

                {/* Detailed breakdown */}
                {showLeverageDetails && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">Market Dynamics</div>
                            <div className={`text-lg font-bold ${leverage.marketDynamicsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {leverage.marketDynamicsScore >= 0 ? '+' : ''}{leverage.marketDynamicsScore}
                            </div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">Economic Factors</div>
                            <div className={`text-lg font-bold ${leverage.economicFactorsScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {leverage.economicFactorsScore >= 0 ? '+' : ''}{leverage.economicFactorsScore}
                            </div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">Strategic Position</div>
                            <div className={`text-lg font-bold ${leverage.strategicPositionScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {leverage.strategicPositionScore >= 0 ? '+' : ''}{leverage.strategicPositionScore}
                            </div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">BATNA Analysis</div>
                            <div className={`text-lg font-bold ${leverage.batnaScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {leverage.batnaScore >= 0 ? '+' : ''}{leverage.batnaScore}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ============================================================================
    // SECTION 11: RENDER - CLAUSE TREE COMPONENT
    // ============================================================================

    const ClauseTreeItem = ({ clause, depth = 0 }: { clause: ContractClause; depth?: number }) => {
        const hasChildren = clause.children && clause.children.length > 0
        const isSelected = selectedClause?.positionId === clause.positionId

        return (
            <div>
                <div
                    onClick={() => handleClauseSelect(clause)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors rounded-lg mx-2 mb-1 ${isSelected
                            ? 'bg-emerald-100 border border-emerald-300'
                            : 'hover:bg-slate-100'
                        }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                    {/* Expand/Collapse button */}
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClauseToggle(clause.positionId)
                            }}
                            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${clause.isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-5 h-5" />
                    )}

                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(clause.status)}`} />

                    {/* Clause info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">{clause.clauseNumber}</span>
                            <span className={`text-sm truncate ${isSelected ? 'font-medium text-emerald-800' : 'text-slate-700'}`}>
                                {clause.clauseName}
                            </span>
                        </div>
                    </div>

                    {/* Weight indicator */}
                    {clause.customerWeight >= 8 && (
                        <div className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                            {clause.isDealBreakerCustomer ? '!' : clause.customerWeight}
                        </div>
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
    // SECTION 12: RENDER - MAIN LAYOUT
    // ============================================================================

    return (
        <div className="flex h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* LEFT PANEL: Clause Navigation */}
            {/* ================================================================== */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-slate-800">Contract Studio</div>
                                <div className="text-xs text-slate-500">{session?.sessionNumber}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/auth/contracts-dashboard')}
                            className="p-2 hover:bg-slate-100 rounded-lg transition"
                            title="Back to Dashboard"
                        >
                            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Session info */}
                    <div className="text-xs text-slate-500 mb-3">
                        {session?.customerCompany} ↔ {session?.providerCompany}
                    </div>

                    {/* Clause stats */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-emerald-50 rounded">
                            <div className="text-lg font-bold text-emerald-600">{clauseStats.aligned}</div>
                            <div className="text-xs text-emerald-700">Aligned</div>
                        </div>
                        <div className="p-2 bg-amber-50 rounded">
                            <div className="text-lg font-bold text-amber-600">{clauseStats.negotiating}</div>
                            <div className="text-xs text-amber-700">Active</div>
                        </div>
                        <div className="p-2 bg-red-50 rounded">
                            <div className="text-lg font-bold text-red-600">{clauseStats.disputed}</div>
                            <div className="text-xs text-red-700">Disputed</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                            <div className="text-lg font-bold text-slate-600">{clauseStats.pending}</div>
                            <div className="text-xs text-slate-700">Pending</div>
                        </div>
                    </div>
                </div>

                {/* Clause Tree */}
                <div className="flex-1 overflow-y-auto py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Contract Clauses ({clauseStats.total})
                    </div>
                    {clauseTree.map(clause => (
                        <ClauseTreeItem key={clause.positionId} clause={clause} />
                    ))}
                </div>

                {/* Add Clause Button */}
                <div className="p-4 border-t border-slate-200">
                    <button className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New Clause
                    </button>
                </div>
            </div>

            {/* ================================================================== */}
            {/* CENTER PANEL: Clause Workspace */}
            {/* ================================================================== */}
            <div className="flex-1 flex flex-col">
                {/* Leverage Indicator */}
                <LeverageIndicator />

                {/* Workspace Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            {selectedClause ? (
                                <>
                                    <h1 className="text-lg font-semibold text-slate-800">
                                        {selectedClause.clauseNumber} {selectedClause.clauseName}
                                    </h1>
                                    <p className="text-sm text-slate-500">{selectedClause.description}</p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-lg font-semibold text-slate-800">Contract Overview</h1>
                                    <p className="text-sm text-slate-500">Select a clause to view details</p>
                                </>
                            )}
                        </div>

                        {selectedClause && (
                            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusBgColor(selectedClause.status)}`}>
                                {getStatusIcon(selectedClause.status)} {selectedClause.status.charAt(0).toUpperCase() + selectedClause.status.slice(1)}
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-3">
                        {(['dynamics', 'draft', 'tradeoffs', 'history'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm rounded-t-lg transition ${activeTab === tab
                                        ? 'bg-slate-100 text-slate-800 font-medium'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {tab === 'dynamics' && 'Dynamics'}
                                {tab === 'draft' && 'Clause Draft'}
                                {tab === 'tradeoffs' && 'Trade-Offs'}
                                {tab === 'history' && 'History'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Workspace Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {activeTab === 'dynamics' && selectedClause && (
                        <div className="space-y-6">
                            {/* Position Visualization */}
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Position Comparison</h3>

                                <div className="space-y-4">
                                    {/* Customer Position */}
                                    <div>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-slate-600">Customer Position</span>
                                            <span className="font-medium text-emerald-600">
                                                {selectedClause.customerPosition !== null
                                                    ? (selectedClause.category === 'pricing'
                                                        ? formatCurrency(selectedClause.customerPosition)
                                                        : selectedClause.customerPosition)
                                                    : 'Not set'}
                                            </span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${selectedClause.customerPosition || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Provider Position */}
                                    <div>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-slate-600">Provider Position</span>
                                            <span className="font-medium text-blue-600">
                                                {selectedClause.providerPosition !== null
                                                    ? (selectedClause.category === 'pricing'
                                                        ? formatCurrency(selectedClause.providerPosition)
                                                        : selectedClause.providerPosition)
                                                    : 'Not set'}
                                            </span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{ width: `${selectedClause.providerPosition || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Gap indicator */}
                                    {selectedClause.gapSize > 0 && (
                                        <div className="flex items-center justify-center py-2">
                                            <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                                                Gap: {selectedClause.category === 'pricing'
                                                    ? formatCurrency(selectedClause.gapSize)
                                                    : selectedClause.gapSize}
                                            </div>
                                        </div>
                                    )}

                                    {/* CLARENCE Recommendation */}
                                    {selectedClause.clarenceRecommendation !== null && (
                                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                                    <span className="text-white text-xs font-bold">C</span>
                                                </div>
                                                <span className="text-sm font-medium text-emerald-800">CLARENCE Recommendation</span>
                                            </div>
                                            <p className="text-sm text-emerald-700">
                                                Suggested position: <strong>
                                                    {selectedClause.category === 'pricing'
                                                        ? formatCurrency(selectedClause.clarenceRecommendation)
                                                        : selectedClause.clarenceRecommendation}
                                                </strong>
                                                {selectedClause.industryStandard && (
                                                    <span className="text-emerald-600">
                                                        {' '}(Industry standard: {selectedClause.category === 'pricing'
                                                            ? formatCurrency(selectedClause.industryStandard)
                                                            : selectedClause.industryStandard})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Weighting & Importance */}
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4">Importance & Weighting</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-emerald-50 rounded-lg">
                                        <div className="text-xs text-emerald-600 mb-1">Customer Weight</div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-2xl font-bold text-emerald-700">{selectedClause.customerWeight}/10</div>
                                            {selectedClause.isDealBreakerCustomer && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Deal Breaker</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <div className="text-xs text-blue-600 mb-1">Provider Weight</div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-2xl font-bold text-blue-700">{selectedClause.providerWeight}/10</div>
                                            {selectedClause.isDealBreakerProvider && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Deal Breaker</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {(selectedClause.customerNotes || selectedClause.providerNotes) && (
                                <div className="bg-white rounded-xl border border-slate-200 p-6">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Party Notes</h3>
                                    <div className="space-y-3">
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
            <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-200">
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

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

                {/* Chat Input */}
                <div className="p-4 border-t border-slate-200">
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
    )
}

// ============================================================================
// SECTION 13: DEFAULT EXPORT WITH SUSPENSE WRAPPER
// ============================================================================

export default function ContractStudioPage() {
    return (
        <Suspense fallback={<ContractStudioLoading />}>
            <ContractStudioContent />
        </Suspense>
    )
}