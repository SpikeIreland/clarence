'use client'

import { useState, useRef, useEffect } from 'react'

// Simple SVG Icon Components
const ChevronDown = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
)

const TrendingUp = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
)

const AlertCircle = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

const CheckCircle = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

const Clock = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

const MessageSquare = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
)

const BarChart3 = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
)

const Scale = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
)

const Lightbulb = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
)

// ========================================
// TYPE DEFINITIONS
// ========================================

type ClauseStatus = 'aligned' | 'negotiating' | 'disputed' | 'pending'
type Party = 'customer' | 'provider' | 'clarence'

interface Clause {
    id: string
    number: number
    title: string
    status: ClauseStatus
    customerPosition: string | number
    providerPosition: string | number
    industryStandard?: string | number
    gap: number // percentage
    leverage: {
        customer: number
        provider: number
        reason: string
    }
    tradeOffs?: {
        clauseId: string
        impact: string
    }[]
    priority: 'high' | 'medium' | 'low'
}

interface Message {
    id: string
    sender: Party
    content: string
    timestamp: Date
    relatedClauseId?: string
}

interface LeverageFactors {
    marketDynamics: { score: number; reason: string }
    economicFactors: { score: number; reason: string }
    strategicPosition: { score: number; reason: string }
    batnaAnalysis: { score: number; reason: string }
}

// ========================================
// MOCK DATA
// ========================================

const OVERALL_LEVERAGE: LeverageFactors = {
    marketDynamics: {
        score: 10,
        reason: '15 qualified providers in market. Customer has procurement power. Service commoditization: Medium'
    },
    economicFactors: {
        score: -5,
        reason: 'Contract size significant for provider. Customer budget known (£2M). Payment terms favorable to provider'
    },
    strategicPosition: {
        score: 0,
        reason: 'Both parties benefit equally. No strategic dependency identified'
    },
    batnaAnalysis: {
        score: 5,
        reason: 'Customer has 3 alternate bidders. Provider BATNA strength: Moderate'
    }
}

const MOCK_CLAUSES: Clause[] = [
    {
        id: 'c1',
        number: 1,
        title: 'Scope of Services',
        status: 'aligned',
        customerPosition: 'IT Infrastructure Management + Cloud Migration',
        providerPosition: 'IT Infrastructure Management + Cloud Migration',
        gap: 0,
        leverage: { customer: 50, provider: 50, reason: 'Mutually agreed scope' },
        priority: 'high'
    },
    {
        id: 'c2',
        number: 2,
        title: 'Service Deliverables',
        status: 'aligned',
        customerPosition: '24/7 Support, Monthly Reports, Quarterly Reviews',
        providerPosition: '24/7 Support, Monthly Reports, Quarterly Reviews',
        gap: 0,
        leverage: { customer: 50, provider: 50, reason: 'Standard deliverables accepted' },
        priority: 'high'
    },
    {
        id: 'c3',
        number: 3,
        title: 'Pricing Structure',
        status: 'negotiating',
        customerPosition: 850000,
        providerPosition: 950000,
        industryStandard: 900000,
        gap: 10.5,
        leverage: {
            customer: 55,
            provider: 45,
            reason: 'Market competition favors customer, but provider costs are justified'
        },
        tradeOffs: [
            { clauseId: 'c4', impact: 'Concede £25K here → Gain 0.2% SLA improvement' },
            { clauseId: 'c7', impact: 'Accept £925K → Request favorable payment terms' }
        ],
        priority: 'high'
    },
    {
        id: 'c4',
        number: 4,
        title: 'Service Level Agreement',
        status: 'disputed',
        customerPosition: '99.9%',
        providerPosition: '99.5%',
        industryStandard: '99.7%',
        gap: 0.4,
        leverage: {
            customer: 60,
            provider: 40,
            reason: 'Mission-critical service gives customer leverage'
        },
        tradeOffs: [
            { clauseId: 'c3', impact: 'Accept 99.7% → Request £25K price reduction' },
            { clauseId: 'c5', impact: 'Accept 99.7% → Request reduced penalties' }
        ],
        priority: 'high'
    },
    {
        id: 'c5',
        number: 5,
        title: 'Performance Penalties',
        status: 'negotiating',
        customerPosition: '5% monthly fee per 0.1% below SLA',
        providerPosition: '2% monthly fee per 0.1% below SLA',
        industryStandard: '3% monthly fee per 0.1% below SLA',
        gap: 3,
        leverage: {
            customer: 55,
            provider: 45,
            reason: 'Customer position reasonable but provider seeks balance'
        },
        priority: 'medium'
    },
    {
        id: 'c6',
        number: 6,
        title: 'Contract Term',
        status: 'negotiating',
        customerPosition: '24 months',
        providerPosition: '36 months',
        industryStandard: '24-36 months',
        gap: 12,
        leverage: {
            customer: 50,
            provider: 50,
            reason: 'Both positions have merit based on investment required'
        },
        priority: 'medium'
    },
    {
        id: 'c7',
        number: 7,
        title: 'Payment Terms',
        status: 'pending',
        customerPosition: 'Net 60',
        providerPosition: 'Net 30',
        industryStandard: 'Net 45',
        gap: 30,
        leverage: {
            customer: 45,
            provider: 55,
            reason: 'Provider cash flow concerns are valid'
        },
        priority: 'medium'
    },
    {
        id: 'c8',
        number: 8,
        title: 'Termination Clause',
        status: 'pending',
        customerPosition: '90 days notice',
        providerPosition: '180 days notice',
        gap: 90,
        leverage: {
            customer: 55,
            provider: 45,
            reason: 'Market standard favors shorter notice periods'
        },
        priority: 'low'
    },
    {
        id: 'c9',
        number: 9,
        title: 'Intellectual Property',
        status: 'pending',
        customerPosition: 'All IP remains with customer',
        providerPosition: 'Shared IP for custom developments',
        gap: 50,
        leverage: {
            customer: 60,
            provider: 40,
            reason: 'Customer funded development supports ownership'
        },
        priority: 'medium'
    }
]

const MOCK_MESSAGES: Message[] = [
    {
        id: 'm1',
        sender: 'clarence',
        content: 'Welcome to the Contract Building Studio. I\'m CLARENCE, your neutral mediator. I can see you\'re negotiating an IT Services contract with TechFirst Solutions.\n\nCurrent overall leverage sits at Customer 55% / Provider 45% based on market analysis.\n\nWe have 3 clauses aligned, 3 in active negotiation, and 3 pending discussion. Where would you like to focus first?',
        timestamp: new Date(Date.now() - 3600000)
    },
    {
        id: 'm2',
        sender: 'customer',
        content: 'I want to focus on the SLA first. 99.9% uptime is critical for our operations.',
        timestamp: new Date(Date.now() - 3000000),
        relatedClauseId: 'c4'
    },
    {
        id: 'm3',
        sender: 'clarence',
        content: 'Understood. Clause 4 - Service Level Agreement is currently disputed.\n\n**Current positions:**\n• Customer: 99.9% uptime\n• Provider: 99.5% uptime\n• Industry standard: 99.7%\n\n**Leverage analysis:** You have 60% leverage on this clause because the service is mission-critical.\n\n**However**, I notice the provider\'s 99.5% position is tied to the £950K pricing in Clause 3. There\'s a trade-off opportunity here:\n\nIf you accept 99.7% (industry standard), you could leverage that concession to reduce pricing by £25-50K.\n\nWould you like me to explore this trade-off with the provider?',
        timestamp: new Date(Date.now() - 2400000),
        relatedClauseId: 'c4'
    }
]

// ========================================
// MAIN COMPONENT
// ========================================

export default function ClarenceContractStudio() {
    // State
    const [selectedClause, setSelectedClause] = useState<Clause>(MOCK_CLAUSES[2]) // Start with Pricing
    const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES)
    const [inputMessage, setInputMessage] = useState('')
    const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set(['c3', 'c4', 'c5']))
    const [showLeverageDetails, setShowLeverageDetails] = useState(false)
    const [activeTab, setActiveTab] = useState<'dynamics' | 'contract' | 'tradeoffs' | 'timeline'>('dynamics')

    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Calculate overall leverage
    const overallLeverageCustomer = Object.values(OVERALL_LEVERAGE).reduce((sum, factor) => sum + factor.score, 0) + 50
    const overallLeverageProvider = 100 - overallLeverageCustomer

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Toggle clause expansion
    const toggleClause = (clauseId: string) => {
        const newExpanded = new Set(expandedClauses)
        if (newExpanded.has(clauseId)) {
            newExpanded.delete(clauseId)
        } else {
            newExpanded.add(clauseId)
        }
        setExpandedClauses(newExpanded)
    }

    // Send message
    const sendMessage = () => {
        if (!inputMessage.trim()) return

        const newMessage: Message = {
            id: `m${messages.length + 1}`,
            sender: 'customer',
            content: inputMessage,
            timestamp: new Date(),
            relatedClauseId: selectedClause.id
        }

        setMessages([...messages, newMessage])
        setInputMessage('')

        // Simulate CLARENCE response
        setTimeout(() => {
            const clarenceResponse: Message = {
                id: `m${messages.length + 2}`,
                sender: 'clarence',
                content: `I understand your position on ${selectedClause.title}. Let me analyze the implications and check with the provider...`,
                timestamp: new Date(),
                relatedClauseId: selectedClause.id
            }
            setMessages(prev => [...prev, clarenceResponse])
        }, 1500)
    }

    // Get status color
    const getStatusColor = (status: ClauseStatus) => {
        switch (status) {
            case 'aligned': return 'text-green-600 bg-green-50 border-green-200'
            case 'negotiating': return 'text-amber-600 bg-amber-50 border-amber-200'
            case 'disputed': return 'text-red-600 bg-red-50 border-red-200'
            case 'pending': return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    const getStatusIcon = (status: ClauseStatus) => {
        switch (status) {
            case 'aligned': return <CheckCircle className="w-4 h-4" />
            case 'negotiating': return <Clock className="w-4 h-4" />
            case 'disputed': return <AlertCircle className="w-4 h-4" />
            case 'pending': return <Clock className="w-4 h-4 opacity-50" />
        }
    }

    // Calculate progress
    const alignedCount = MOCK_CLAUSES.filter(c => c.status === 'aligned').length
    const totalCount = MOCK_CLAUSES.length
    const progressPercentage = (alignedCount / totalCount) * 100

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* ========================================
          HEADER - Overall Leverage & Progress
          ======================================== */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                {/* Top Row - Contract Info */}
                <div className="px-6 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Contract SIS-16092025-001</h1>
                            <p className="text-sm text-gray-600">IT Services Agreement • Spike Island Studios ↔ TechFirst Solutions</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Contract Value</div>
                                <div className="text-lg font-bold text-gray-900">£850K - £950K</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Progress</div>
                                <div className="text-lg font-bold text-green-600">{alignedCount}/{totalCount} Aligned</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overall Leverage Display */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-indigo-600" />
                            <h2 className="font-semibold text-gray-900">Current Leverage Position</h2>
                        </div>
                        <button
                            onClick={() => setShowLeverageDetails(!showLeverageDetails)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                            {showLeverageDetails ? 'Hide' : 'Show'} Details
                            {showLeverageDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Leverage Bar */}
                    <div className="flex items-center gap-3 mb-2">
                        <div className="text-sm font-semibold text-gray-700 w-24">Customer</div>
                        <div className="flex-1 h-8 bg-gray-200 rounded-full overflow-hidden flex">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end px-3 text-white font-bold text-sm transition-all duration-500"
                                style={{ width: `${overallLeverageCustomer}%` }}
                            >
                                {overallLeverageCustomer}%
                            </div>
                            <div
                                className="bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-start px-3 text-white font-bold text-sm transition-all duration-500"
                                style={{ width: `${overallLeverageProvider}%` }}
                            >
                                {overallLeverageProvider}%
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-700 w-24 text-right">Provider</div>
                    </div>

                    <div className="text-xs text-gray-600 text-center">
                        ⚖️ Based on: Market Analysis • BATNA Strength • Strategic Position • Economic Factors
                    </div>

                    {/* Expanded Leverage Details */}
                    {showLeverageDetails && (
                        <div className="mt-4 pt-4 border-t border-indigo-200 grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">📊 Market Dynamics</span>
                                    <span className="text-sm font-bold text-green-600">+{OVERALL_LEVERAGE.marketDynamics.score}% Customer</span>
                                </div>
                                <p className="text-xs text-gray-600">{OVERALL_LEVERAGE.marketDynamics.reason}</p>
                            </div>

                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">💰 Economic Factors</span>
                                    <span className="text-sm font-bold text-amber-600">{OVERALL_LEVERAGE.economicFactors.score}% Provider</span>
                                </div>
                                <p className="text-xs text-gray-600">{OVERALL_LEVERAGE.economicFactors.reason}</p>
                            </div>

                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">⚡ Strategic Position</span>
                                    <span className="text-sm font-bold text-gray-600">Neutral</span>
                                </div>
                                <p className="text-xs text-gray-600">{OVERALL_LEVERAGE.strategicPosition.reason}</p>
                            </div>

                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">🚪 BATNA Analysis</span>
                                    <span className="text-sm font-bold text-green-600">+{OVERALL_LEVERAGE.batnaAnalysis.score}% Customer</span>
                                </div>
                                <p className="text-xs text-gray-600">{OVERALL_LEVERAGE.batnaAnalysis.reason}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Phase Progress */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gray-700">Negotiation Phases:</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-green-500 h-2 rounded-full"></div>
                            <span className="text-xs text-gray-600">1. Deal Profile ✓</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-green-500 h-2 rounded-full"></div>
                            <span className="text-xs text-gray-600">2. Requirements ✓</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-green-500 h-2 rounded-full"></div>
                            <span className="text-xs text-gray-600">3. Capabilities ✓</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-amber-400 h-2 rounded-full"></div>
                            <span className="text-xs font-semibold text-amber-700">4. Negotiation 🔄</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-gray-300 h-2 rounded-full"></div>
                            <span className="text-xs text-gray-400">5. Review</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                            <div className="flex-1 bg-gray-300 h-2 rounded-full"></div>
                            <span className="text-xs text-gray-400">6. Execute</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ========================================
          MAIN LAYOUT - Three Panels
          ======================================== */}
            <div className="flex-1 flex overflow-hidden">

                {/* ========================================
            LEFT PANEL - Clause Navigator
            ======================================== */}
                <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-bold text-gray-900 mb-1">Contract Clauses</h2>
                        <div className="text-sm text-gray-600">
                            {alignedCount} aligned • {MOCK_CLAUSES.filter(c => c.status === 'negotiating' || c.status === 'disputed').length} active • {MOCK_CLAUSES.filter(c => c.status === 'pending').length} pending
                        </div>

                        {/* Overall Progress Bar */}
                        <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>Overall Progress</span>
                                <span className="font-semibold">{Math.round(progressPercentage)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {MOCK_CLAUSES.map(clause => {
                            const isExpanded = expandedClauses.has(clause.id)
                            const isSelected = selectedClause.id === clause.id

                            return (
                                <div key={clause.id} className="mb-2">
                                    <button
                                        onClick={() => {
                                            setSelectedClause(clause)
                                            toggleClause(clause.id)
                                        }}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected
                                                ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className={`${getStatusColor(clause.status)} p-1 rounded`}>
                                                    {getStatusIcon(clause.status)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-gray-500">Clause {clause.number}</div>
                                                    <div className="font-semibold text-sm text-gray-900 truncate">{clause.title}</div>
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                                        </div>

                                        {/* Status Badge */}
                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(clause.status)}`}>
                                            {clause.status === 'aligned' && '✅ Aligned'}
                                            {clause.status === 'negotiating' && '🟡 Negotiating'}
                                            {clause.status === 'disputed' && '❌ Disputed'}
                                            {clause.status === 'pending' && '⚪ Pending'}
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && clause.status !== 'pending' && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                                <div>
                                                    <div className="text-xs text-gray-500 mb-1">Current Positions:</div>
                                                    <div className="text-xs">
                                                        <div className="text-blue-700 font-medium">Customer: {clause.customerPosition}</div>
                                                        <div className="text-amber-700 font-medium">Provider: {clause.providerPosition}</div>
                                                        {clause.industryStandard && (
                                                            <div className="text-gray-600 mt-1">Industry: {clause.industryStandard}</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {clause.status !== 'aligned' && (
                                                    <>
                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1">Gap:</div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-red-500"
                                                                        style={{ width: `${Math.min(clause.gap, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs font-semibold text-red-600">{clause.gap}%</span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="text-xs text-gray-500 mb-1">Leverage:</div>
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
                                                                    <div className="bg-blue-500" style={{ width: `${clause.leverage.customer}%` }} />
                                                                    <div className="bg-amber-500" style={{ width: `${clause.leverage.provider}%` }} />
                                                                </div>
                                                                <span className="font-semibold text-blue-600 w-8">{clause.leverage.customer}%</span>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ========================================
            CENTER PANEL - Negotiation Workspace
            ======================================== */}
                <div className="flex-1 flex flex-col bg-white">
                    {/* Tabs */}
                    <div className="border-b border-gray-200 px-6 pt-4">
                        <div className="flex gap-4">
                            {(['dynamics', 'contract', 'tradeoffs', 'timeline'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`pb-3 px-2 font-medium text-sm border-b-2 transition-colors capitalize ${activeTab === tab
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'dynamics' && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Clause Header */}
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-bold text-gray-900">
                                            Clause {selectedClause.number}: {selectedClause.title}
                                        </h2>
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedClause.status)}`}>
                                            {selectedClause.status === 'aligned' && '✅ Aligned'}
                                            {selectedClause.status === 'negotiating' && '🟡 Negotiating'}
                                            {selectedClause.status === 'disputed' && '❌ Disputed'}
                                            {selectedClause.status === 'pending' && '⚪ Pending Discussion'}
                                        </span>
                                    </div>
                                    <p className="text-gray-600">
                                        Priority: <span className="font-semibold capitalize">{selectedClause.priority}</span>
                                    </p>
                                </div>

                                {/* Positions Comparison */}
                                {selectedClause.status !== 'pending' && (
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-indigo-200">
                                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                                            Current Positions
                                        </h3>

                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="bg-white rounded-lg p-4 border border-blue-200">
                                                <div className="text-xs text-gray-500 mb-1">Customer Position</div>
                                                <div className="text-xl font-bold text-blue-700">
                                                    {typeof selectedClause.customerPosition === 'number'
                                                        ? `£${selectedClause.customerPosition.toLocaleString()}`
                                                        : selectedClause.customerPosition
                                                    }
                                                </div>
                                            </div>

                                            <div className="bg-white rounded-lg p-4 border border-gray-300">
                                                <div className="text-xs text-gray-500 mb-1">Industry Standard</div>
                                                <div className="text-xl font-bold text-gray-700">
                                                    {selectedClause.industryStandard
                                                        ? (typeof selectedClause.industryStandard === 'number'
                                                            ? `£${selectedClause.industryStandard.toLocaleString()}`
                                                            : selectedClause.industryStandard)
                                                        : 'Varies'
                                                    }
                                                </div>
                                            </div>

                                            <div className="bg-white rounded-lg p-4 border border-amber-200">
                                                <div className="text-xs text-gray-500 mb-1">Provider Position</div>
                                                <div className="text-xl font-bold text-amber-700">
                                                    {typeof selectedClause.providerPosition === 'number'
                                                        ? `£${selectedClause.providerPosition.toLocaleString()}`
                                                        : selectedClause.providerPosition
                                                    }
                                                </div>
                                            </div>
                                        </div>

                                        {/* Visual Gap Representation */}
                                        {selectedClause.status !== 'aligned' && (
                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-semibold text-gray-700">Negotiation Gap</span>
                                                    <span className="text-sm font-bold text-red-600">{selectedClause.gap}% apart</span>
                                                </div>
                                                <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                                                    {/* Customer position marker */}
                                                    <div
                                                        className="absolute top-0 bottom-0 w-1 bg-blue-600"
                                                        style={{ left: '0%' }}
                                                    />
                                                    {/* Provider position marker */}
                                                    <div
                                                        className="absolute top-0 bottom-0 w-1 bg-amber-600"
                                                        style={{ right: '0%' }}
                                                    />
                                                    {/* Industry standard marker (if applicable) */}
                                                    {selectedClause.industryStandard && typeof selectedClause.customerPosition === 'number' && typeof selectedClause.providerPosition === 'number' && typeof selectedClause.industryStandard === 'number' && (
                                                        <div
                                                            className="absolute top-0 bottom-0 w-1 bg-green-600"
                                                            style={{
                                                                left: `${((selectedClause.industryStandard - selectedClause.customerPosition) / (selectedClause.providerPosition - selectedClause.customerPosition)) * 100}%`
                                                            }}
                                                        />
                                                    )}
                                                    {/* Gap visualization */}
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="text-xs font-semibold text-gray-600">
                                                            ← Customer | Industry | Provider →
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Leverage Analysis for This Clause */}
                                {selectedClause.status !== 'pending' && selectedClause.status !== 'aligned' && (
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Scale className="w-5 h-5 text-purple-600" />
                                            Leverage for This Clause
                                        </h3>

                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="text-sm font-semibold text-gray-700 w-20">Customer</div>
                                            <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden flex">
                                                <div
                                                    className="bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end px-2 text-white font-bold text-xs"
                                                    style={{ width: `${selectedClause.leverage.customer}%` }}
                                                >
                                                    {selectedClause.leverage.customer}%
                                                </div>
                                                <div
                                                    className="bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-start px-2 text-white font-bold text-xs"
                                                    style={{ width: `${selectedClause.leverage.provider}%` }}
                                                >
                                                    {selectedClause.leverage.provider}%
                                                </div>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-700 w-20 text-right">Provider</div>
                                        </div>

                                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                                            <div className="text-sm text-gray-700">
                                                <strong>Analysis:</strong> {selectedClause.leverage.reason}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CLARENCE's Insight */}
                                {selectedClause.status !== 'pending' && selectedClause.status !== 'aligned' && (
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Lightbulb className="w-5 h-5 text-green-600" />
                                            CLARENCE&apos;s Neutral Analysis
                                        </h3>

                                        <div className="space-y-3">
                                            {selectedClause.id === 'c3' && (
                                                <>
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Market Data:</strong> Similar IT services contracts in your industry typically range from £875K-£925K for this scope. The customer&apos;s £850K position is below market, while the provider&apos;s £950K is at the upper end but justifiable given the comprehensive SLA requirements.
                                                    </p>
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Recommendation:</strong> A fair middle ground would be £900K (±£25K) depending on final SLA terms agreed in Clause 4. This represents a 5.6% increase for the customer and a 5.3% concession for the provider.
                                                    </p>
                                                    <div className="bg-white rounded-lg p-3 border border-green-300">
                                                        <div className="text-sm font-semibold text-green-700 mb-2">💡 Strategic Opportunity:</div>
                                                        <div className="text-sm text-gray-700">
                                                            Consider bundling this pricing discussion with the SLA negotiation (Clause 4). You could propose: <strong>£900K with 99.7% SLA</strong> - this gives both parties a balanced compromise.
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {selectedClause.id === 'c4' && (
                                                <>
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Industry Standards:</strong> For mission-critical IT infrastructure services, 99.7% uptime is the industry standard. 99.9% is typically reserved for premium-tier services with significant cost implications.
                                                    </p>
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Cost Impact:</strong> The provider&apos;s infrastructure investment to guarantee 99.9% vs 99.5% represents approximately £40-50K additional annual cost. The 0.4% difference equals roughly 35 hours of additional downtime per year.
                                                    </p>
                                                    <div className="bg-white rounded-lg p-3 border border-green-300">
                                                        <div className="text-sm font-semibold text-green-700 mb-2">💡 Compromise Path:</div>
                                                        <div className="text-sm text-gray-700">
                                                            <strong>99.7% base SLA</strong> with escalation bonuses: If provider maintains 99.9% for 6+ months, customer pays £10K bonus. This aligns incentives without committing to unrealistic guarantees upfront.
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {selectedClause.id === 'c5' && (
                                                <>
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Market Analysis:</strong> Performance penalty clauses in IT services typically range from 2-4% of monthly fees per 0.1% SLA breach. Your positions of 5% (customer) and 2% (provider) bracket this range.
                                                    </p>
                                                    <p className="text-sm text-gray-700">
                                                        <strong>Balance Consideration:</strong> Higher penalties create strong incentives but can make providers overly risk-averse. Lower penalties reduce accountability. The 3% industry standard provides appropriate balance.
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Trade-Off Opportunities */}
                                {selectedClause.tradeOffs && selectedClause.tradeOffs.length > 0 && (
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-amber-600" />
                                            Cross-Clause Trade-Off Opportunities
                                        </h3>

                                        <div className="space-y-3">
                                            {selectedClause.tradeOffs.map((tradeOff, index) => {
                                                const linkedClause = MOCK_CLAUSES.find(c => c.id === tradeOff.clauseId)
                                                return (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            if (linkedClause) setSelectedClause(linkedClause)
                                                        }}
                                                        className="w-full bg-white rounded-lg p-4 border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all text-left"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                <span className="text-lg">🔄</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                                                    Link to Clause {linkedClause?.number}: {linkedClause?.title}
                                                                </div>
                                                                <div className="text-sm text-gray-700">{tradeOff.impact}</div>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <div className="mt-4 p-3 bg-white rounded-lg border border-amber-300">
                                            <div className="text-xs text-amber-800">
                                                💡 <strong>Strategic Tip:</strong> Multi-clause packages often lead to faster agreements. Consider proposing a bundled compromise across related clauses.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {selectedClause.status !== 'aligned' && (
                                    <div className="flex gap-3 pt-4">
                                        <button className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-md hover:shadow-lg transition-all">
                                            📊 View Market Data
                                        </button>
                                        <button className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold shadow-md hover:shadow-lg transition-all">
                                            🎯 Propose Compromise
                                        </button>
                                        <button className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 font-semibold shadow-md hover:shadow-lg transition-all">
                                            🔄 Explore Trade-Offs
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'contract' && (
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-8">
                                    <h3 className="text-xl font-bold text-gray-900 mb-6">IT Services Agreement - Draft Contract</h3>

                                    <div className="space-y-6 text-sm text-gray-700">
                                        <section>
                                            <h4 className="font-semibold text-gray-900 mb-2">1. Scope of Services</h4>
                                            <p className="bg-green-50 border-l-4 border-green-500 pl-4 py-2">
                                                ✅ <strong>Agreed:</strong> IT Infrastructure Management + Cloud Migration services as detailed in Appendix A.
                                            </p>
                                        </section>

                                        <section>
                                            <h4 className="font-semibold text-gray-900 mb-2">2. Service Deliverables</h4>
                                            <p className="bg-green-50 border-l-4 border-green-500 pl-4 py-2">
                                                ✅ <strong>Agreed:</strong> 24/7 Support, Monthly Reports, Quarterly Business Reviews as specified in Service Schedule.
                                            </p>
                                        </section>

                                        <section>
                                            <h4 className="font-semibold text-gray-900 mb-2">3. Pricing Structure</h4>
                                            <div className="bg-amber-50 border-l-4 border-amber-500 pl-4 py-2 space-y-2">
                                                <p>🟡 <strong>Under Negotiation:</strong></p>
                                                <p><span className="text-blue-700 font-medium">Customer proposal:</span> Annual fee of £850,000</p>
                                                <p><span className="text-amber-700 font-medium">Provider proposal:</span> Annual fee of £950,000</p>
                                                <p className="text-gray-600 italic">Industry standard: £875K-£925K</p>
                                            </div>
                                        </section>

                                        <section>
                                            <h4 className="font-semibold text-gray-900 mb-2">4. Service Level Agreement</h4>
                                            <div className="bg-red-50 border-l-4 border-red-500 pl-4 py-2 space-y-2">
                                                <p>❌ <strong>Disputed:</strong></p>
                                                <p><span className="text-blue-700 font-medium">Customer requirement:</span> 99.9% system uptime</p>
                                                <p><span className="text-amber-700 font-medium">Provider commitment:</span> 99.5% system uptime</p>
                                                <p className="text-gray-600 italic">Industry standard: 99.7% for this service tier</p>
                                            </div>
                                        </section>

                                        <section>
                                            <h4 className="font-semibold text-gray-900 mb-2">5. Performance Penalties</h4>
                                            <div className="bg-amber-50 border-l-4 border-amber-500 pl-4 py-2">
                                                <p>🟡 <strong>Under Negotiation:</strong> Penalty structure for SLA breaches</p>
                                            </div>
                                        </section>

                                        <section>
                                            <h4 className="font-semibold text-gray-900 mb-2">6-9. Additional Terms</h4>
                                            <p className="bg-gray-50 border-l-4 border-gray-400 pl-4 py-2">
                                                ⚪ <strong>Pending:</strong> Contract term, payment terms, termination clause, and IP rights awaiting discussion.
                                            </p>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tradeoffs' && (
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">Cross-Clause Impact Matrix</h3>
                                    <p className="text-gray-700 mb-4">
                                        Understanding how concessions in one clause can create leverage in another is key to efficient negotiation.
                                        CLARENCE analyzes these relationships to suggest strategic bundled proposals.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-white rounded-lg border border-gray-300 p-6">
                                        <h4 className="font-semibold text-gray-900 mb-3">Pricing ↔ SLA Bundle</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl">📊</span>
                                                <div>
                                                    <div className="font-medium text-gray-900">Scenario A: Customer Optimized</div>
                                                    <div className="text-sm text-gray-700">Accept £925K (+£75K) → Gain 99.9% SLA</div>
                                                    <div className="text-xs text-green-600 mt-1">✓ Strong service guarantee, moderate price increase</div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl">⚖️</span>
                                                <div>
                                                    <div className="font-medium text-gray-900">Scenario B: Balanced</div>
                                                    <div className="text-sm text-gray-700">Accept £900K (+£50K) → Gain 99.7% SLA</div>
                                                    <div className="text-xs text-green-600 mt-1">✓ Industry standard service, fair price point</div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl">💰</span>
                                                <div>
                                                    <div className="font-medium text-gray-900">Scenario C: Cost Optimized</div>
                                                    <div className="text-sm text-gray-700">Accept £875K (+£25K) → Accept 99.5% SLA</div>
                                                    <div className="text-xs text-amber-600 mt-1">⚠️ Lower cost but reduced service commitment</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-lg border border-gray-300 p-6">
                                        <h4 className="font-semibold text-gray-900 mb-3">SLA ↔ Penalties Bundle</h4>
                                        <div className="text-sm text-gray-700">
                                            Higher SLA commitments (99.7%+) typically justify lower penalty rates (2-3%) since breaches are less frequent.
                                            Conversely, lower SLAs (99.5%) warrant higher penalties (4-5%) to maintain accountability.
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-lg border border-gray-300 p-6">
                                        <h4 className="font-semibold text-gray-900 mb-3">Contract Term ↔ Pricing Bundle</h4>
                                        <div className="text-sm text-gray-700">
                                            Longer contract terms (36 months) can justify 5-7% price discounts due to reduced acquisition costs and
                                            guaranteed revenue. Shorter terms (24 months) typically command premium pricing but offer flexibility.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'timeline' && (
                            <div className="max-w-4xl mx-auto">
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="w-24 text-sm text-gray-500 text-right pt-1">2 hours ago</div>
                                        <div className="flex-1">
                                            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
                                                <div className="font-semibold text-green-900 mb-1">Clause 2 Aligned</div>
                                                <div className="text-sm text-gray-700">Both parties agreed on Service Deliverables: 24/7 Support, Monthly Reports, Quarterly Reviews</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-24 text-sm text-gray-500 text-right pt-1">4 hours ago</div>
                                        <div className="flex-1">
                                            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
                                                <div className="font-semibold text-blue-900 mb-1">Customer Proposal - Clause 3</div>
                                                <div className="text-sm text-gray-700">Proposed pricing of £850K annually</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-24 text-sm text-gray-500 text-right pt-1">5 hours ago</div>
                                        <div className="flex-1">
                                            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
                                                <div className="font-semibold text-amber-900 mb-1">Provider Counter - Clause 3</div>
                                                <div className="text-sm text-gray-700">Counter-proposed £950K with justification based on comprehensive SLA requirements</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-24 text-sm text-gray-500 text-right pt-1">6 hours ago</div>
                                        <div className="flex-1">
                                            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
                                                <div className="font-semibold text-purple-900 mb-1">CLARENCE Analysis</div>
                                                <div className="text-sm text-gray-700">Provided market data showing £875K-£925K range for similar contracts. Suggested bundling with SLA discussion.</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-24 text-sm text-gray-500 text-right pt-1">8 hours ago</div>
                                        <div className="flex-1">
                                            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
                                                <div className="font-semibold text-green-900 mb-1">Clause 1 Aligned</div>
                                                <div className="text-sm text-gray-700">Scope of Services agreed: IT Infrastructure Management + Cloud Migration</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ========================================
            RIGHT PANEL - CLARENCE Chat
            ======================================== */}
                <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
                    {/* Chat Header */}
                    <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                                <Scale className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">CLARENCE</h2>
                                <p className="text-sm opacity-90">The Honest Broker</p>
                            </div>
                        </div>
                        <div className="text-xs bg-white/20 rounded px-2 py-1 inline-block">
                            Discussing: Clause {selectedClause.number} - {selectedClause.title}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map(message => (
                            <div key={message.id}>
                                {message.sender === 'clarence' ? (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                                            C
                                        </div>
                                        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex-1">
                                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</div>
                                            <div className="text-xs text-gray-400 mt-2">
                                                {message.timestamp.toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ) : message.sender === 'customer' ? (
                                    <div className="flex gap-3 justify-end">
                                        <div className="bg-blue-600 text-white rounded-lg p-4 shadow-sm max-w-sm">
                                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                                            <div className="text-xs opacity-75 mt-2">
                                                {message.timestamp.toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                                            Y
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-3 justify-end">
                                        <div className="bg-amber-500 text-white rounded-lg p-4 shadow-sm max-w-sm">
                                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                                            <div className="text-xs opacity-75 mt-2">
                                                {message.timestamp.toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                                            P
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-gray-200 bg-white">
                        <div className="flex gap-2 mb-3">
                            <button className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-xs font-medium">
                                📊 Request Data
                            </button>
                            <button className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-xs font-medium">
                                💡 Get Suggestion
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Ask CLARENCE anything..."
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                                onClick={sendMessage}
                                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold transition-all shadow-md hover:shadow-lg"
                            >
                                <MessageSquare className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}