'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: string
    userId?: string
}

interface ClauseScore {
    clauseId: string
    clauseName: string
    customerPosition: number  // 1-5 scale
    providerPosition: number  // 1-5 scale
    alignmentScore: number    // 0-100%
    weight: number            // weighting factor
    status: 'aligned' | 'minor_gap' | 'major_gap' | 'deal_breaker'
}

interface CategoryScore {
    categoryId: string
    categoryName: string
    categoryIcon: string
    overallScore: number      // 0-100%
    weight: number
    clauses: ClauseScore[]
}

interface ProviderAlignment {
    bidId: string
    providerId: string
    providerCompany: string
    providerContactName: string
    providerContactEmail: string
    overallAlignmentScore: number  // 0-100%
    qualificationStatus: 'qualified' | 'below_threshold' | 'pending'
    mustHavesMet: boolean
    mustHavesDetails: {
        requirement: string
        met: boolean
    }[]
    categories: CategoryScore[]
    submittedAt?: string
    status: string
}

interface TenderingConfig {
    qualificationThreshold: number
    evaluationPriorities: string[]
    mustHaveCapabilities: string
}

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    currency: string
    templateName?: string
    clauseCount?: number
    tenderingConfig: TenderingConfig
    providers: ProviderAlignment[]
}

interface ChatMessage {
    id: string
    type: 'user' | 'clarence'
    content: string
    timestamp: Date
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const PRIORITY_LABELS: Record<string, { label: string, icon: string }> = {
    'cost': { label: 'Cost Optimization', icon: '💰' },
    'quality': { label: 'Quality & Standards', icon: '⭐' },
    'speed': { label: 'Speed & Delivery', icon: '⚡' },
    'innovation': { label: 'Innovation', icon: '💡' },
    'risk_mitigation': { label: 'Risk Mitigation', icon: '🛡️' },
    'relationship': { label: 'Partnership Fit', icon: '🤝' },
}

const CATEGORY_ICONS: Record<string, string> = {
    'service_delivery': '🔧',
    'service_levels': '📊',
    'termination': '🚪',
    'intellectual_property': '💡',
    'employment': '👥',
    'charges_payment': '💳',
    'liability': '⚖️',
    'governance': '📋',
    'data_protection': '🔒',
}

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function getScoreColor(score: number): string {
    if (score >= 75) return 'bg-emerald-500'
    if (score >= 60) return 'bg-lime-500'
    if (score >= 45) return 'bg-amber-500'
    if (score >= 30) return 'bg-orange-500'
    return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
    if (score >= 75) return 'text-emerald-600'
    if (score >= 60) return 'text-lime-600'
    if (score >= 45) return 'text-amber-600'
    if (score >= 30) return 'text-orange-600'
    return 'text-red-600'
}

function getScoreBgLight(score: number): string {
    if (score >= 75) return 'bg-emerald-50 border-emerald-200'
    if (score >= 60) return 'bg-lime-50 border-lime-200'
    if (score >= 45) return 'bg-amber-50 border-amber-200'
    if (score >= 30) return 'bg-orange-50 border-orange-200'
    return 'bg-red-50 border-red-200'
}

function formatCurrency(value: string, currency: string = 'GBP'): string {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
    const labels: Record<string, string> = {
        'under_50k': `Under ${symbol}50k`,
        '50k_250k': `${symbol}50k - ${symbol}250k`,
        '250k_1m': `${symbol}250k - ${symbol}1M`,
        'over_1m': `Over ${symbol}1M`,
    }
    return labels[value] || value
}

// ============================================================================
// SECTION 5: DATA LOADING FROM API
// ============================================================================

async function fetchTenderReviewData(sessionId: string): Promise<SessionData | null> {
    try {
        const response = await fetch(`${API_BASE}/tender-review-api?session_id=${sessionId}`)

        if (!response.ok) {
            console.error('Tender Review API error:', response.status)
            return null
        }

        const result = await response.json()

        if (!result.success || !result.data) {
            console.error('Tender Review API returned error:', result.error)
            return null
        }

        // Transform API response to match our interface
        const apiData = result.data

        return {
            sessionId: apiData.sessionId,
            sessionNumber: apiData.sessionNumber,
            customerCompany: apiData.customerCompany,
            serviceRequired: apiData.serviceRequired,
            dealValue: apiData.dealValue,
            currency: apiData.currency,
            templateName: apiData.templateName,
            clauseCount: apiData.clauseCount,
            tenderingConfig: {
                qualificationThreshold: apiData.tenderingConfig.qualificationThreshold,
                evaluationPriorities: apiData.tenderingConfig.evaluationPriorities,
                mustHaveCapabilities: apiData.tenderingConfig.mustHaveCapabilities,
            },
            providers: apiData.providers.map((p: any) => ({
                bidId: p.bidId,
                providerId: p.providerId,
                providerCompany: p.providerCompany,
                providerContactName: p.providerContactName,
                providerContactEmail: p.providerContactEmail,
                overallAlignmentScore: p.overallAlignmentScore,
                qualificationStatus: p.qualificationStatus,
                mustHavesMet: p.mustHavesMet,
                mustHavesDetails: p.mustHavesDetails,
                categories: p.categories.map((cat: any) => ({
                    categoryId: cat.categoryId,
                    categoryName: cat.categoryName,
                    categoryIcon: cat.categoryIcon,
                    overallScore: cat.overallScore,
                    weight: cat.weight,
                    clauses: cat.clauses.map((clause: any) => ({
                        clauseId: clause.clauseId,
                        clauseName: clause.clauseName,
                        customerPosition: clause.customerPosition,
                        providerPosition: clause.providerPosition,
                        alignmentScore: clause.alignmentScore,
                        weight: clause.weight,
                        status: clause.status,
                    })),
                })),
                submittedAt: p.submittedAt,
                status: p.status,
            })),
        }
    } catch (error) {
        console.error('Failed to fetch tender review data:', error)
        return null
    }
}

// ============================================================================
// SECTION 5B: MOCK DATA GENERATOR (Fallback when API unavailable)
// ============================================================================

function generateMockData(sessionId: string): SessionData {
    const mockCategories: CategoryScore[] = [
        {
            categoryId: 'service_delivery',
            categoryName: 'Service Delivery',
            categoryIcon: '🔧',
            overallScore: 0,
            weight: 10,
            clauses: [
                { clauseId: 'sd1', clauseName: 'Scope of Services', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'sd2', clauseName: 'Due Diligence', customerPosition: 3, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'sd3', clauseName: 'Customer Dependencies', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'sd4', clauseName: 'Transition & Transformation', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
            ]
        },
        {
            categoryId: 'service_levels',
            categoryName: 'Service Levels',
            categoryIcon: '📊',
            overallScore: 0,
            weight: 10,
            clauses: [
                { clauseId: 'sl1', clauseName: 'At Risk Amount', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'sl2', clauseName: 'Link to Damages', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'sl3', clauseName: 'Termination & Step In', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
            ]
        },
        {
            categoryId: 'termination',
            categoryName: 'Termination',
            categoryIcon: '🚪',
            overallScore: 0,
            weight: 10,
            clauses: [
                { clauseId: 't1', clauseName: 'Termination for Convenience', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 't2', clauseName: 'Exit Assistance', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 't3', clauseName: 'Termination Fee', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
            ]
        },
        {
            categoryId: 'liability',
            categoryName: 'Liability',
            categoryIcon: '⚖️',
            overallScore: 0,
            weight: 10,
            clauses: [
                { clauseId: 'l1', clauseName: 'Cap for Customer', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'l2', clauseName: 'Cap for Supplier', customerPosition: 3, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'l3', clauseName: 'Exclusions', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'l4', clauseName: 'Indemnities', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
            ]
        },
        {
            categoryId: 'charges_payment',
            categoryName: 'Charges & Payment',
            categoryIcon: '💳',
            overallScore: 0,
            weight: 10,
            clauses: [
                { clauseId: 'cp1', clauseName: 'Certainty of Pricing', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'cp2', clauseName: 'Time for Payment', customerPosition: 3, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'cp3', clauseName: 'Benchmarking', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
            ]
        },
        {
            categoryId: 'data_protection',
            categoryName: 'Data Protection',
            categoryIcon: '🔒',
            overallScore: 0,
            weight: 10,
            clauses: [
                { clauseId: 'dp1', clauseName: 'Data Processing Agreement', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'dp2', clauseName: 'Data Residency', customerPosition: 5, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
                { clauseId: 'dp3', clauseName: 'Data Breach Notification', customerPosition: 4, providerPosition: 0, alignmentScore: 0, weight: 10, status: 'aligned' },
            ]
        },
    ]

    // Generate random provider positions and calculate alignment
    function generateProviderData(providerName: string, baseScore: number): ProviderAlignment {
        const categories = mockCategories.map(cat => {
            const clauses = cat.clauses.map(clause => {
                const variance = Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
                const providerPos = Math.max(1, Math.min(5, clause.customerPosition + variance + (baseScore > 70 ? 0 : -1)))
                const diff = Math.abs(clause.customerPosition - providerPos)
                const alignment = Math.max(0, 100 - (diff * 25))

                let status: ClauseScore['status'] = 'aligned'
                if (diff === 1) status = 'minor_gap'
                else if (diff === 2) status = 'major_gap'
                else if (diff >= 3) status = 'deal_breaker'

                return {
                    ...clause,
                    providerPosition: providerPos,
                    alignmentScore: alignment,
                    status,
                }
            })

            const categoryScore = clauses.reduce((sum, c) => sum + c.alignmentScore, 0) / clauses.length

            return {
                ...cat,
                clauses,
                overallScore: Math.round(categoryScore),
            }
        })

        const overallScore = Math.round(
            categories.reduce((sum, cat) => sum + cat.overallScore * cat.weight, 0) /
            categories.reduce((sum, cat) => sum + cat.weight, 0)
        )

        return {
            bidId: `bid_${Math.random().toString(36).substr(2, 9)}`,
            providerId: `prov_${Math.random().toString(36).substr(2, 9)}`,
            providerCompany: providerName,
            providerContactName: `${['James', 'Sarah', 'Michael', 'Emma'][Math.floor(Math.random() * 4)]} ${['Smith', 'Johnson', 'Williams', 'Brown'][Math.floor(Math.random() * 4)]}`,
            providerContactEmail: `contact@${providerName.toLowerCase().replace(/\s+/g, '')}.com`,
            overallAlignmentScore: overallScore,
            qualificationStatus: overallScore >= 65 ? 'qualified' : 'below_threshold',
            mustHavesMet: overallScore >= 60,
            mustHavesDetails: [
                { requirement: 'ISO 27001 certification', met: Math.random() > 0.3 },
                { requirement: '24/7 support availability', met: Math.random() > 0.4 },
                { requirement: 'UK data residency', met: Math.random() > 0.2 },
            ],
            categories,
            submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'questionnaire_complete',
        }
    }

    return {
        sessionId,
        sessionNumber: 'CLR-2025-0042',
        customerCompany: 'Acme Corporation',
        serviceRequired: 'IT Managed Services',
        dealValue: '250k_1m',
        currency: 'GBP',
        templateName: 'IT Services Agreement v2.1',
        clauseCount: 24,
        tenderingConfig: {
            qualificationThreshold: 65,
            evaluationPriorities: ['quality', 'cost', 'risk_mitigation'],
            mustHaveCapabilities: 'ISO 27001 certification, 24/7 support, UK data residency',
        },
        providers: [
            generateProviderData('TechServe Solutions', 78),
            generateProviderData('GlobalIT Partners', 62),
            generateProviderData('CloudFirst Services', 71),
        ],
    }
}

// ============================================================================
// SECTION 6: MAIN COMPONENT WRAPPER
// ============================================================================

export default function TenderReviewPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading tender review...</p>
                </div>
            </div>
        }>
            <TenderReviewContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 7: MAIN COMPONENT
// ============================================================================

function TenderReviewContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session_id')
    const chatEndRef = useRef<HTMLDivElement>(null)

    // ==========================================================================
    // SECTION 8: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [sessionData, setSessionData] = useState<SessionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
    const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set())
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
    const [sortBy, setSortBy] = useState<'score' | 'name' | 'date'>('score')
    const [showEliminatedOnly, setShowEliminatedOnly] = useState(false)

    // Chat state
    const [showChatPanel, setShowChatPanel] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isChatLoading, setIsChatLoading] = useState(false)

    // ==========================================================================
    // SECTION 9: DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        try {
            const response = await fetch('/api/user')
            if (response.ok) {
                const data = await response.json()
                setUserInfo(data)
            }
        } catch (error) {
            console.error('Failed to load user info:', error)
        }
    }, [])

    const loadSessionData = useCallback(async () => {
        if (!sessionId) return

        setLoading(true)
        try {
            // Try to fetch from real API first
            const apiData = await fetchTenderReviewData(sessionId)

            if (apiData && apiData.providers.length > 0) {
                // Use real API data
                setSessionData(apiData)

                // Auto-select all qualified providers
                const qualifiedIds = apiData.providers
                    .filter(p => p.qualificationStatus === 'qualified')
                    .map(p => p.bidId)
                setSelectedProviders(new Set(qualifiedIds))
            } else {
                // Fallback to mock data if API returns no data
                console.log('Using mock data - API returned no providers')
                await new Promise(resolve => setTimeout(resolve, 500))
                const mockData = generateMockData(sessionId)
                setSessionData(mockData)

                // Auto-select all qualified providers
                const qualifiedIds = mockData.providers
                    .filter(p => p.qualificationStatus === 'qualified')
                    .map(p => p.bidId)
                setSelectedProviders(new Set(qualifiedIds))
            }

        } catch (error) {
            console.error('Failed to load session data:', error)

            // Fallback to mock data on error
            const mockData = generateMockData(sessionId)
            setSessionData(mockData)

            const qualifiedIds = mockData.providers
                .filter(p => p.qualificationStatus === 'qualified')
                .map(p => p.bidId)
            setSelectedProviders(new Set(qualifiedIds))
        } finally {
            setLoading(false)
        }
    }, [sessionId])

    useEffect(() => {
        loadUserInfo()
        loadSessionData()
    }, [loadUserInfo, loadSessionData])

    // ==========================================================================
    // SECTION 10: CHAT FUNCTIONS
    // ==========================================================================

    async function sendChatMessage() {
        if (!chatInput.trim() || isChatLoading) return

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: chatInput,
            timestamp: new Date()
        }

        setChatMessages(prev => [...prev, userMessage])
        setChatInput('')
        setIsChatLoading(true)

        try {
            // TODO: Integrate with CLARENCE API
            await new Promise(resolve => setTimeout(resolve, 1000))

            const clarenceMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'clarence',
                content: `I can help you analyze these provider bids. Based on your qualification threshold of ${sessionData?.tenderingConfig.qualificationThreshold}%, ${sessionData?.providers.filter(p => p.qualificationStatus === 'qualified').length} providers meet your minimum requirements. Would you like me to highlight the key differences between them?`,
                timestamp: new Date()
            }

            setChatMessages(prev => [...prev, clarenceMessage])
        } catch (error) {
            console.error('Chat error:', error)
        } finally {
            setIsChatLoading(false)
        }
    }

    useEffect(() => {
        if (showChatPanel && chatMessages.length === 0) {
            const welcomeMessage: ChatMessage = {
                id: '1',
                type: 'clarence',
                content: `Hello ${userInfo?.firstName || 'there'}! I'm here to help you review your provider bids. I can explain alignment scores, compare specific clauses across providers, or help you make elimination decisions. What would you like to explore?`,
                timestamp: new Date()
            }
            setChatMessages([welcomeMessage])
        }
    }, [showChatPanel, chatMessages.length, userInfo])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // ==========================================================================
    // SECTION 11: ACTION HANDLERS
    // ==========================================================================

    function toggleProviderExpansion(bidId: string) {
        setExpandedProviders(prev => {
            const next = new Set(prev)
            if (next.has(bidId)) {
                next.delete(bidId)
            } else {
                next.add(bidId)
            }
            return next
        })
    }

    function toggleCategoryExpansion(key: string) {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }

    function toggleProviderSelection(bidId: string) {
        setSelectedProviders(prev => {
            const next = new Set(prev)
            if (next.has(bidId)) {
                next.delete(bidId)
            } else {
                next.add(bidId)
            }
            return next
        })
    }

    function eliminateProvider(bidId: string) {
        // TODO: Call API to mark provider as eliminated
        setSelectedProviders(prev => {
            const next = new Set(prev)
            next.delete(bidId)
            return next
        })
    }

    function beginNegotiation(bidId: string) {
        router.push(`/auth/contract-studio?session_id=${sessionId}&bid_id=${bidId}`)
    }

    // ==========================================================================
    // SECTION 12: COMPUTED VALUES
    // ==========================================================================

    const sortedProviders = sessionData?.providers
        .filter(p => showEliminatedOnly ? !selectedProviders.has(p.bidId) : true)
        .sort((a, b) => {
            if (sortBy === 'score') return b.overallAlignmentScore - a.overallAlignmentScore
            if (sortBy === 'name') return a.providerCompany.localeCompare(b.providerCompany)
            if (sortBy === 'date') return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
            return 0
        }) || []

    const qualifiedCount = sessionData?.providers.filter(p => p.qualificationStatus === 'qualified').length || 0
    const selectedCount = selectedProviders.size

    // ==========================================================================
    // SECTION 13: LOADING STATE
    // ==========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <span className="text-white text-2xl font-bold">C</span>
                    </div>
                    <p className="text-slate-600 mb-2">Loading tender review...</p>
                    <p className="text-sm text-slate-400">Analyzing provider alignment</p>
                </div>
            </div>
        )
    }

    if (!sessionData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-slate-400 text-2xl">?</span>
                    </div>
                    <p className="text-slate-600 mb-4">Session not found</p>
                    <Link href="/auth/contracts-dashboard" className="text-emerald-600 hover:text-emerald-700">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 14: RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 15: HEADER */}
            {/* ================================================================== */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Back & Title */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/auth/contracts-dashboard"
                                className="text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </Link>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                                    <span className="text-white font-bold">C</span>
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold text-slate-800">Tender Review</h1>
                                    <p className="text-xs text-slate-500">{sessionData.sessionNumber} • {sessionData.serviceRequired}</p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowChatPanel(!showChatPanel)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${showChatPanel
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                                </svg>
                                Ask CLARENCE
                            </button>

                            <button
                                onClick={() => {/* Export functionality */ }}
                                className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-all"
                            >
                                Export Report
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 16: MAIN CONTENT */}
            {/* ================================================================== */}
            <div className="flex">
                {/* Main Content Area */}
                <main className={`flex-1 transition-all ${showChatPanel ? 'mr-96' : ''}`}>
                    {/* ============================================================ */}
                    {/* SECTION 17: SUMMARY BAR */}
                    {/* ============================================================ */}
                    <div className="bg-white border-b border-slate-200">
                        <div className="max-w-7xl mx-auto px-6 py-4">
                            <div className="flex items-center justify-between">
                                {/* Stats */}
                                <div className="flex items-center gap-8">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-800">{sessionData.providers.length}</div>
                                        <div className="text-xs text-slate-500">Providers</div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-200"></div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-emerald-600">{qualifiedCount}</div>
                                        <div className="text-xs text-slate-500">Qualified</div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-200"></div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-amber-600">{sessionData.providers.length - qualifiedCount}</div>
                                        <div className="text-xs text-slate-500">Below Threshold</div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-200"></div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{selectedCount}</div>
                                        <div className="text-xs text-slate-500">Selected</div>
                                    </div>
                                </div>

                                {/* Threshold Indicator */}
                                <div className="flex items-center gap-4">
                                    <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                        <div className="text-xs text-emerald-600 font-medium mb-0.5">Qualification Threshold</div>
                                        <div className="text-lg font-bold text-emerald-700">{sessionData.tenderingConfig.qualificationThreshold}%</div>
                                    </div>

                                    <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="text-xs text-slate-500 font-medium mb-0.5">Top Priorities</div>
                                        <div className="flex items-center gap-1">
                                            {sessionData.tenderingConfig.evaluationPriorities.slice(0, 3).map((p, i) => (
                                                <span key={p} className="text-sm" title={PRIORITY_LABELS[p]?.label}>
                                                    {PRIORITY_LABELS[p]?.icon}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 18: CONTROLS BAR */}
                    {/* ============================================================ */}
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* View Mode Toggle */}
                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewMode('cards')}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'cards' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                                            }`}
                                    >
                                        Cards
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                                            }`}
                                    >
                                        Table
                                    </button>
                                </div>

                                {/* Sort */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'score' | 'name' | 'date')}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                >
                                    <option value="score">Sort by Score</option>
                                    <option value="name">Sort by Name</option>
                                    <option value="date">Sort by Submission</option>
                                </select>

                                {/* Filter */}
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={showEliminatedOnly}
                                        onChange={(e) => setShowEliminatedOnly(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    Show eliminated only
                                </label>
                            </div>

                            {/* Bulk Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedProviders(new Set(sessionData.providers.filter(p => p.qualificationStatus === 'qualified').map(p => p.bidId)))}
                                    className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800"
                                >
                                    Select Qualified
                                </button>
                                <button
                                    onClick={() => setSelectedProviders(new Set())}
                                    className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 19: PROVIDER CARDS */}
                    {/* ============================================================ */}
                    <div className="max-w-7xl mx-auto px-6 pb-8">
                        {viewMode === 'cards' ? (
                            <div className="space-y-4">
                                {sortedProviders.map((provider) => (
                                    <div
                                        key={provider.bidId}
                                        className={`bg-white rounded-xl border-2 transition-all ${selectedProviders.has(provider.bidId)
                                                ? 'border-emerald-300 shadow-md'
                                                : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        {/* Provider Header */}
                                        <div className="p-5 flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                {/* Selection Checkbox */}
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedProviders.has(provider.bidId)}
                                                        onChange={() => toggleProviderSelection(provider.bidId)}
                                                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </div>

                                                {/* Provider Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-semibold text-slate-800">{provider.providerCompany}</h3>
                                                        {/* Qualification Badge */}
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${provider.qualificationStatus === 'qualified'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {provider.qualificationStatus === 'qualified' ? '✓ Qualified' : '⚠ Below Threshold'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-500">
                                                        {provider.providerContactName} • {provider.providerContactEmail}
                                                    </p>
                                                    {provider.submittedAt && (
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Submitted {new Date(provider.submittedAt).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Overall Score */}
                                            <div className="flex items-center gap-4">
                                                <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${getScoreColor(provider.overallAlignmentScore)}`}>
                                                    <span className="text-2xl font-bold text-white">{provider.overallAlignmentScore}%</span>
                                                    <span className="text-xs text-white/80">Alignment</span>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => beginNegotiation(provider.bidId)}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
                                                    >
                                                        Begin Negotiation →
                                                    </button>
                                                    <button
                                                        onClick={() => eliminateProvider(provider.bidId)}
                                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-all"
                                                    >
                                                        Eliminate
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Must-Haves Summary */}
                                        {sessionData.tenderingConfig.mustHaveCapabilities && (
                                            <div className="px-5 pb-3 border-t border-slate-100 pt-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-medium text-slate-500">Must-Have Requirements:</span>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${provider.mustHavesMet
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {provider.mustHavesDetails.filter(m => m.met).length} of {provider.mustHavesDetails.length} met
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {provider.mustHavesDetails.map((mh, i) => (
                                                        <span
                                                            key={i}
                                                            className={`px-2 py-1 text-xs rounded-md ${mh.met
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                    : 'bg-red-50 text-red-700 border border-red-200'
                                                                }`}
                                                        >
                                                            {mh.met ? '✓' : '✗'} {mh.requirement}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Expand/Collapse Button */}
                                        <button
                                            onClick={() => toggleProviderExpansion(provider.bidId)}
                                            className="w-full px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                                        >
                                            {expandedProviders.has(provider.bidId) ? (
                                                <>
                                                    <span>Hide Category Breakdown</span>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Show Category Breakdown</span>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </>
                                            )}
                                        </button>

                                        {/* ======================================================== */}
                                        {/* SECTION 20: CATEGORY BREAKDOWN (Expanded) */}
                                        {/* ======================================================== */}
                                        {expandedProviders.has(provider.bidId) && (
                                            <div className="border-t border-slate-200 bg-slate-50 p-5">
                                                <h4 className="text-sm font-semibold text-slate-700 mb-4">Category Alignment Scores</h4>

                                                {/* Category Grid (DLA Piper Style) */}
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                                                    {provider.categories.map((cat) => (
                                                        <button
                                                            key={cat.categoryId}
                                                            onClick={() => toggleCategoryExpansion(`${provider.bidId}-${cat.categoryId}`)}
                                                            className={`p-3 rounded-xl border-2 transition-all hover:shadow-md ${getScoreBgLight(cat.overallScore)}`}
                                                        >
                                                            <div className="text-2xl mb-1">{cat.categoryIcon}</div>
                                                            <div className={`text-xl font-bold ${getScoreTextColor(cat.overallScore)}`}>
                                                                {cat.overallScore}%
                                                            </div>
                                                            <div className="text-xs text-slate-600 font-medium truncate">
                                                                {cat.categoryName}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Expanded Category Clauses */}
                                                {provider.categories.map((cat) => (
                                                    expandedCategories.has(`${provider.bidId}-${cat.categoryId}`) && (
                                                        <div key={cat.categoryId} className="bg-white rounded-lg border border-slate-200 p-4 mb-3">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h5 className="font-semibold text-slate-800 flex items-center gap-2">
                                                                    <span>{cat.categoryIcon}</span>
                                                                    {cat.categoryName}
                                                                </h5>
                                                                <button
                                                                    onClick={() => toggleCategoryExpansion(`${provider.bidId}-${cat.categoryId}`)}
                                                                    className="text-slate-400 hover:text-slate-600"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {cat.clauses.map((clause) => (
                                                                    <div
                                                                        key={clause.clauseId}
                                                                        className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                                                                    >
                                                                        <div className="flex-1">
                                                                            <span className="text-sm text-slate-700">{clause.clauseName}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="text-xs text-slate-500">
                                                                                Customer: <span className="font-medium">{clause.customerPosition}/5</span>
                                                                            </div>
                                                                            <div className="text-xs text-slate-500">
                                                                                Provider: <span className="font-medium">{clause.providerPosition}/5</span>
                                                                            </div>
                                                                            <div className={`w-16 text-center py-1 rounded text-xs font-medium ${clause.status === 'aligned' ? 'bg-emerald-100 text-emerald-700' :
                                                                                    clause.status === 'minor_gap' ? 'bg-amber-100 text-amber-700' :
                                                                                        clause.status === 'major_gap' ? 'bg-orange-100 text-orange-700' :
                                                                                            'bg-red-100 text-red-700'
                                                                                }`}>
                                                                                {clause.alignmentScore}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* ============================================================ */
                            /* SECTION 21: TABLE VIEW */
                            /* ============================================================ */
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProviders.size === sortedProviders.length && sortedProviders.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedProviders(new Set(sortedProviders.map(p => p.bidId)))
                                                        } else {
                                                            setSelectedProviders(new Set())
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Provider</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Score</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                            {sessionData.providers[0]?.categories.slice(0, 4).map(cat => (
                                                <th key={cat.categoryId} className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                    <span title={cat.categoryName}>{cat.categoryIcon}</span>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedProviders.map((provider) => (
                                            <tr key={provider.bidId} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedProviders.has(provider.bidId)}
                                                        onChange={() => toggleProviderSelection(provider.bidId)}
                                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-slate-800">{provider.providerCompany}</div>
                                                    <div className="text-xs text-slate-500">{provider.providerContactName}</div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-white font-bold ${getScoreColor(provider.overallAlignmentScore)}`}>
                                                        {provider.overallAlignmentScore}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${provider.qualificationStatus === 'qualified'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {provider.qualificationStatus === 'qualified' ? 'Qualified' : 'Below'}
                                                    </span>
                                                </td>
                                                {provider.categories.slice(0, 4).map(cat => (
                                                    <td key={cat.categoryId} className="px-4 py-4 text-center">
                                                        <span className={`text-sm font-medium ${getScoreTextColor(cat.overallScore)}`}>
                                                            {cat.overallScore}%
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => beginNegotiation(provider.bidId)}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-all"
                                                    >
                                                        Negotiate
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>

                {/* ================================================================== */}
                {/* SECTION 22: CHAT PANEL */}
                {/* ================================================================== */}
                {showChatPanel && (
                    <aside className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 flex flex-col z-30">
                        {/* Chat Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="font-bold text-lg">C</span>
                                </div>
                                <div>
                                    <div className="font-semibold">CLARENCE</div>
                                    <div className="text-xs text-white/80">Tender Analysis Assistant</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowChatPanel(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                            {chatMessages.map(message => (
                                <div key={message.id} className={`mb-4 ${message.type === 'user' ? 'text-right' : ''}`}>
                                    <div className={`inline-block max-w-[85%] ${message.type === 'user'
                                        ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2'
                                        : 'bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200'
                                        }`}>
                                        {message.type === 'clarence' && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded flex items-center justify-center">
                                                    <span className="text-white text-xs font-bold">C</span>
                                                </div>
                                                <span className="text-xs font-medium text-emerald-600">CLARENCE</span>
                                            </div>
                                        )}
                                        <p className="text-sm">{message.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && (
                                <div className="mb-4">
                                    <div className="inline-block bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-200">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Quick Actions */}
                        <div className="p-3 border-t border-slate-100 bg-white">
                            <div className="flex flex-wrap gap-2 mb-3">
                                <button
                                    onClick={() => setChatInput('Compare the top two providers')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-600 transition-colors"
                                >
                                    Compare top providers
                                </button>
                                <button
                                    onClick={() => setChatInput('What are the key differences in liability terms?')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-600 transition-colors"
                                >
                                    Liability differences
                                </button>
                                <button
                                    onClick={() => setChatInput('Which provider has the best termination terms?')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-600 transition-colors"
                                >
                                    Best termination terms
                                </button>
                            </div>
                        </div>

                        {/* Chat Input */}
                        <div className="p-4 border-t border-slate-200 bg-white">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                    placeholder="Ask about provider alignment..."
                                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                                />
                                <button
                                    onClick={sendChatMessage}
                                    disabled={isChatLoading || !chatInput.trim()}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            {/* ================================================================== */}
            {/* SECTION 23: FLOATING ACTION BUTTON */}
            {/* ================================================================== */}
            {!showChatPanel && (
                <button
                    onClick={() => setShowChatPanel(true)}
                    className="fixed bottom-6 right-6 p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-50"
                    title="Ask CLARENCE"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z" />
                    </svg>
                </button>
            )}
        </div>
    )
}