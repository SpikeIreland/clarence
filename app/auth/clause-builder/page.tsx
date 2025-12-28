'use client'

// ============================================================================
// CLAUSE BUILDER PAGE
// auth/clause-builder/page.tsx
// Created: 2025-12-28
// Purpose: Allow customers to select and configure clauses before negotiation
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// Service categories (matches Customer Requirements dropdown)
const SERVICE_CATEGORIES = [
    { value: '', label: 'All Clauses' },
    { value: 'Back Office Operations', label: 'Back Office Operations' },
    { value: 'Customer Support', label: 'Customer Support' },
    { value: 'Technical Support', label: 'Technical Support' },
    { value: 'Data Processing', label: 'Data Processing' },
    { value: 'IT Services', label: 'IT Services' },
    { value: 'Finance & Accounting', label: 'Finance & Accounting' },
    { value: 'HR Services', label: 'HR Services' }
]

// Clause categories (matches contract_clauses structure)
const CLAUSE_CATEGORIES = [
    'Commercial Terms',
    'Service Delivery',
    'Termination',
    'Intellectual Property',
    'Data Protection',
    'Liability',
    'Governance',
    'Personnel',
    'Miscellaneous'
]

// Weight options
const WEIGHT_OPTIONS = [
    { value: 1, label: 'Low', description: 'Willing to concede' },
    { value: 3, label: 'Medium-Low', description: 'Prefer but flexible' },
    { value: 5, label: 'Medium', description: 'Standard importance' },
    { value: 7, label: 'High', description: 'Important to us' },
    { value: 10, label: 'Non-Negotiable', description: 'Deal breaker' }
]

// ============================================================================
// SECTION 3: INTERFACES
// ============================================================================

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    status: string
}

interface MasterClause {
    clauseId: string
    clauseName: string
    category: string
    description: string
    clauseLevel: number
    displayOrder: number
    applicableServiceTypes: string[] | null
    applicableIndustries: string[] | null
    regulatoryRequired: boolean
    regulatorySource: string | null
    includedInPacks: PackReference[]
}

interface PackReference {
    packId: string
    packName: string
    packType: string
}

interface ClausePack {
    packId: string
    packName: string
    packType: 'service' | 'industry' | 'regulatory' | 'favourite'
    description: string
    serviceCategory: string | null
    industry: string | null
    regulatoryFramework: string | null
    ownerType: 'clarence' | 'customer'
    companyId: string | null
    isBasePack: boolean
    clauseCount: number
}

interface SelectedClause {
    clauseId: string
    clauseName: string
    category: string
    description: string
    displayOrder: number

    // Configuration
    position: number           // 1-10 starting position
    weight: number             // 1-10 (customerWeight)
    isNonNegotiable: boolean   // Maps to isDealBreakerCustomer

    // Source tracking
    sourcePackId: string | null
    addedManually: boolean

    // UI state
    hasSubClauses: boolean
}

interface SubClause {
    clauseId: string
    clauseName: string
    parentClauseId: string
    description: string | null
}

// ============================================================================
// SECTION 4: SUSPENSE WRAPPER
// ============================================================================

export default function ClauseBuilderPage() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ClauseBuilderContent />
        </Suspense>
    )
}

function LoadingState() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500">Loading Clause Builder...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: MAIN COMPONENT
// ============================================================================

function ClauseBuilderContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 6: STATE DECLARATIONS
    // ========================================================================

    // Session & loading
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [session, setSession] = useState<SessionData | null>(null)

    // Clause library (left panel)
    const [masterClauses, setMasterClauses] = useState<MasterClause[]>([])
    const [filteredClauses, setFilteredClauses] = useState<MasterClause[]>([])
    const [serviceFilter, setServiceFilter] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CLAUSE_CATEGORIES))

    // Centre panel (configurator)
    const [activeClause, setActiveClause] = useState<MasterClause | null>(null)
    const [clausePosition, setClausePosition] = useState(5)
    const [clauseWeight, setClauseWeight] = useState(5)
    const [isNonNegotiable, setIsNonNegotiable] = useState(false)

    // Templates/Packs dropdown
    const [availablePacks, setAvailablePacks] = useState<ClausePack[]>([])
    const [selectedPackId, setSelectedPackId] = useState<string>('')

    // Right panel (selected clauses)
    const [selectedClauses, setSelectedClauses] = useState<SelectedClause[]>([])
    const [expandedSelectedCategories, setExpandedSelectedCategories] = useState<Set<string>>(new Set(CLAUSE_CATEGORIES))

    // Modals
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [savePackName, setSavePackName] = useState('')
    const [savePackDescription, setSavePackDescription] = useState('')
    const [showConfirmReplace, setShowConfirmReplace] = useState(false)
    const [pendingPackLoad, setPendingPackLoad] = useState<string | null>(null)

    // ========================================================================
    // SECTION 7: INITIALIZATION
    // ========================================================================

    const loadInitialData = useCallback(async () => {
        const sessionId = searchParams.get('session_id')

        if (!sessionId) {
            console.error('No session_id provided')
            router.push('/auth/contract-dashboard')
            return
        }

        eventLogger.setSession(sessionId)
        eventLogger.started('clause_builder', 'page_loaded')

        try {
            // Load session data
            const sessionResponse = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
            if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json()
                const sessionInfo = sessionData.session || sessionData

                setSession({
                    sessionId: sessionId,
                    sessionNumber: sessionInfo.sessionNumber || sessionInfo.session_number || '',
                    customerCompany: sessionInfo.customerCompany || sessionInfo.customer_company || '',
                    serviceRequired: sessionInfo.contractType || sessionInfo.contract_type || sessionInfo.serviceRequired || '',
                    dealValue: sessionInfo.dealValue || sessionInfo.deal_value || '',
                    status: sessionInfo.status || 'draft'
                })

                // Auto-set service filter based on session
                if (sessionInfo.serviceRequired || sessionInfo.contractType) {
                    setServiceFilter(sessionInfo.serviceRequired || sessionInfo.contractType)
                }
            }

            // Load master clause library
            const clausesResponse = await fetch(`${API_BASE}/clause-library-api`)
            if (clausesResponse.ok) {
                const clausesData = await clausesResponse.json()
                const clauses = Array.isArray(clausesData) ? clausesData : (clausesData.clauses || [])
                setMasterClauses(clauses)
                setFilteredClauses(clauses)
            }

            // Load available packs
            const packsResponse = await fetch(`${API_BASE}/clause-packs-api?session_id=${sessionId}`)
            if (packsResponse.ok) {
                const packsData = await packsResponse.json()
                const packs = Array.isArray(packsData) ? packsData : (packsData.packs || [])
                setAvailablePacks(packs)
            }

            // Load existing session clauses (if returning to page)
            const existingResponse = await fetch(`${API_BASE}/session-clauses-api?session_id=${sessionId}&customer_selected=true`)
            if (existingResponse.ok) {
                const existingData = await existingResponse.json()
                const existing = Array.isArray(existingData) ? existingData : (existingData.clauses || [])
                if (existing.length > 0) {
                    setSelectedClauses(existing.map((c: any) => ({
                        clauseId: c.clauseId || c.clause_id,
                        clauseName: c.clauseName || c.clause_name,
                        category: c.category,
                        description: c.description,
                        displayOrder: c.displayOrder || c.display_order || 0,
                        position: c.customerPosition || c.customer_position || 5,
                        weight: c.customerWeight || c.customer_weight || 5,
                        isNonNegotiable: c.isDealBreakerCustomer || c.is_deal_breaker_customer || false,
                        sourcePackId: c.sourcePackId || c.source_pack_id || null,
                        addedManually: !c.sourcePackId && !c.source_pack_id,
                        hasSubClauses: false
                    })))
                }
            }

            eventLogger.completed('clause_builder', 'page_loaded', { sessionId })

        } catch (error) {
            console.error('Error loading clause builder data:', error)
            eventLogger.failed('clause_builder', 'page_loaded',
                error instanceof Error ? error.message : 'Unknown error',
                'LOAD_ERROR'
            )
        } finally {
            setLoading(false)
        }
    }, [searchParams, router])

    useEffect(() => {
        loadInitialData()
    }, [loadInitialData])

    // ========================================================================
    // SECTION 8: FILTERING LOGIC
    // ========================================================================

    useEffect(() => {
        let filtered = [...masterClauses]

        // Filter by service type
        if (serviceFilter) {
            filtered = filtered.filter(c =>
                !c.applicableServiceTypes ||
                c.applicableServiceTypes.length === 0 ||
                c.applicableServiceTypes.includes(serviceFilter)
            )
        }

        // Filter by category
        if (categoryFilter) {
            filtered = filtered.filter(c => c.category === categoryFilter)
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(c =>
                c.clauseName.toLowerCase().includes(query) ||
                c.description?.toLowerCase().includes(query) ||
                c.category.toLowerCase().includes(query)
            )
        }

        setFilteredClauses(filtered)
    }, [masterClauses, serviceFilter, categoryFilter, searchQuery])

    // ========================================================================
    // SECTION 9: CLAUSE ACTIONS
    // ========================================================================

    // Add clause to centre panel for configuration
    const handleClauseClick = (clause: MasterClause) => {
        setActiveClause(clause)

        // Check if already selected and load its config
        const existing = selectedClauses.find(c => c.clauseId === clause.clauseId)
        if (existing) {
            setClausePosition(existing.position)
            setClauseWeight(existing.weight)
            setIsNonNegotiable(existing.isNonNegotiable)
        } else {
            // Default values
            setClausePosition(5)
            setClauseWeight(5)
            setIsNonNegotiable(false)
        }
    }

    // Add configured clause to contract (right panel)
    const handleAddToContract = () => {
        if (!activeClause) return

        const newClause: SelectedClause = {
            clauseId: activeClause.clauseId,
            clauseName: activeClause.clauseName,
            category: activeClause.category,
            description: activeClause.description,
            displayOrder: activeClause.displayOrder,
            position: clausePosition,
            weight: isNonNegotiable ? 10 : clauseWeight,
            isNonNegotiable: isNonNegotiable,
            sourcePackId: null,
            addedManually: true,
            hasSubClauses: false
        }

        // Check if already exists
        const existingIndex = selectedClauses.findIndex(c => c.clauseId === activeClause.clauseId)

        if (existingIndex >= 0) {
            // Update existing
            const updated = [...selectedClauses]
            updated[existingIndex] = newClause
            setSelectedClauses(updated)
        } else {
            // Add new
            setSelectedClauses(prev => [...prev, newClause])
        }

        // Clear centre panel
        setActiveClause(null)

        eventLogger.completed('clause_builder', 'clause_added', {
            clauseId: activeClause.clauseId,
            clauseName: activeClause.clauseName,
            position: clausePosition,
            weight: clauseWeight,
            isNonNegotiable
        })
    }

    // Remove clause from contract
    const handleRemoveClause = (clauseId: string) => {
        setSelectedClauses(prev => prev.filter(c => c.clauseId !== clauseId))

        eventLogger.completed('clause_builder', 'clause_removed', { clauseId })
    }

    // Edit clause (load into centre panel)
    const handleEditClause = (clause: SelectedClause) => {
        const masterClause = masterClauses.find(c => c.clauseId === clause.clauseId)
        if (masterClause) {
            setActiveClause(masterClause)
            setClausePosition(clause.position)
            setClauseWeight(clause.weight)
            setIsNonNegotiable(clause.isNonNegotiable)
        }
    }

    // ========================================================================
    // SECTION 10: TEMPLATE/PACK LOADING
    // ========================================================================

    const handlePackSelect = (packId: string) => {
        if (!packId) return

        // Check if there are existing selections
        if (selectedClauses.length > 0) {
            setPendingPackLoad(packId)
            setShowConfirmReplace(true)
        } else {
            loadPack(packId)
        }
    }

    const loadPack = async (packId: string) => {
        if (!session?.sessionId) return

        try {
            const response = await fetch(`${API_BASE}/load-clause-pack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    pack_id: packId,
                    replace_existing: true
                })
            })

            if (response.ok) {
                const data = await response.json()
                const loadedClauses = data.clauses || []

                setSelectedClauses(loadedClauses.map((c: any) => ({
                    clauseId: c.clauseId || c.clause_id,
                    clauseName: c.clauseName || c.clause_name,
                    category: c.category,
                    description: c.description,
                    displayOrder: c.displayOrder || c.display_order || 0,
                    position: c.defaultPosition || c.default_position || 5,
                    weight: c.weightNumeric || c.weight_numeric || 5,
                    isNonNegotiable: c.isNonNegotiable || c.is_non_negotiable || false,
                    sourcePackId: packId,
                    addedManually: false,
                    hasSubClauses: false
                })))

                setSelectedPackId(packId)

                eventLogger.completed('clause_builder', 'pack_loaded', {
                    packId,
                    clauseCount: loadedClauses.length
                })
            }
        } catch (error) {
            console.error('Error loading pack:', error)
        }

        setShowConfirmReplace(false)
        setPendingPackLoad(null)
    }

    // ========================================================================
    // SECTION 11: SAVE AS FAVOURITE
    // ========================================================================

    const handleSaveAsFavourite = async () => {
        if (!session?.sessionId || !savePackName.trim()) return

        setSaving(true)

        try {
            // Get company_id from auth
            const auth = localStorage.getItem('clarence_auth')
            const authData = auth ? JSON.parse(auth) : {}
            const companyId = authData.userInfo?.companyId || authData.companyId

            const response = await fetch(`${API_BASE}/save-clause-pack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    company_id: companyId,
                    pack_name: savePackName.trim(),
                    description: savePackDescription.trim() || null,
                    clauses: selectedClauses.map(c => ({
                        clause_id: c.clauseId,
                        default_position: c.position,
                        weight_numeric: c.weight,
                        is_non_negotiable: c.isNonNegotiable,
                        display_order: c.displayOrder
                    }))
                })
            })

            if (response.ok) {
                const data = await response.json()

                // Add to available packs
                setAvailablePacks(prev => [...prev, {
                    packId: data.pack_id,
                    packName: savePackName.trim(),
                    packType: 'favourite',
                    description: savePackDescription.trim(),
                    serviceCategory: null,
                    industry: null,
                    regulatoryFramework: null,
                    ownerType: 'customer',
                    companyId: companyId,
                    isBasePack: false,
                    clauseCount: selectedClauses.length
                }])

                eventLogger.completed('clause_builder', 'pack_saved', {
                    packName: savePackName,
                    clauseCount: selectedClauses.length
                })

                setShowSaveModal(false)
                setSavePackName('')
                setSavePackDescription('')
            }
        } catch (error) {
            console.error('Error saving pack:', error)
        } finally {
            setSaving(false)
        }
    }

    // ========================================================================
    // SECTION 12: PROCEED TO CONTRACT STUDIO
    // ========================================================================

    const handleProceedToStudio = async () => {
        if (!session?.sessionId || selectedClauses.length === 0) return

        setSaving(true)

        try {
            // Save all selected clauses to session_clause_positions
            const response = await fetch(`${API_BASE}/save-session-clauses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    clauses: selectedClauses.map(c => ({
                        clause_id: c.clauseId,
                        clause_name: c.clauseName,
                        category: c.category,
                        description: c.description,
                        display_order: c.displayOrder,
                        customer_position: c.position,
                        customer_weight: c.weight,
                        is_deal_breaker_customer: c.isNonNegotiable,
                        source_pack_id: c.sourcePackId,
                        selected_by_customer: true,
                        customer_selected_at: new Date().toISOString()
                    }))
                })
            })

            if (response.ok) {
                eventLogger.completed('clause_builder', 'clauses_saved', {
                    sessionId: session.sessionId,
                    clauseCount: selectedClauses.length
                })

                // Navigate to Contract Studio
                router.push(`/auth/contract-studio?session_id=${session.sessionId}`)
            } else {
                throw new Error('Failed to save clauses')
            }
        } catch (error) {
            console.error('Error saving clauses:', error)
            alert('Failed to save clauses. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    // ========================================================================
    // SECTION 13: HELPER FUNCTIONS
    // ========================================================================

    const isClauseSelected = (clauseId: string) => {
        return selectedClauses.some(c => c.clauseId === clauseId)
    }

    // Separate typed functions for each panel to avoid union type issues
    const getMasterClausesByCategory = (clauses: MasterClause[], category: string): MasterClause[] => {
        return clauses.filter(c => c.category === category)
    }

    const getSelectedClausesByCategory = (clauses: SelectedClause[], category: string): SelectedClause[] => {
        return clauses.filter(c => c.category === category)
    }

    const toggleCategory = (category: string, isSelectedPanel: boolean) => {
        const setter = isSelectedPanel ? setExpandedSelectedCategories : setExpandedCategories
        setter(prev => {
            const newSet = new Set(prev)
            if (newSet.has(category)) {
                newSet.delete(category)
            } else {
                newSet.add(category)
            }
            return newSet
        })
    }

    // ========================================================================
    // SECTION 14: LOADING STATE
    // ========================================================================

    if (loading) {
        return <LoadingState />
    }

    // ========================================================================
    // SECTION 15: MAIN RENDER
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* ============================================================ */}
            {/* SECTION 16: HEADER */}
            {/* ============================================================ */}
            <header className="bg-slate-800 text-white shadow-lg">
                <div className="px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <Link href="/auth/contract-dashboard" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">Clause Builder</div>
                            </div>
                        </Link>

                        {/* Session Info */}
                        <div className="flex items-center gap-6">
                            {session?.sessionNumber && (
                                <div className="text-sm">
                                    <span className="text-slate-400">Session:</span>
                                    <span className="ml-2 font-mono text-white">{session.sessionNumber}</span>
                                </div>
                            )}
                            {session?.customerCompany && (
                                <div className="text-sm">
                                    <span className="text-slate-400">Customer:</span>
                                    <span className="ml-2 text-white">{session.customerCompany}</span>
                                </div>
                            )}
                            <Link
                                href="/auth/contract-dashboard"
                                className="text-sm text-slate-400 hover:text-white transition"
                            >
                                ← Back to Dashboard
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ============================================================ */}
            {/* SECTION 17: INSTRUCTIONAL BANNER */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-4 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Build Your Contract</h1>
                        <p className="text-emerald-100 text-sm mt-1">
                            Select clauses from the library, configure your starting positions, then proceed to negotiation.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-2xl font-bold">{selectedClauses.length}</div>
                            <div className="text-xs text-emerald-200">Clauses Selected</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 18: THREE-PANEL LAYOUT */}
            {/* ============================================================ */}
            <div className="flex-1 flex overflow-hidden">

                {/* ======================================================== */}
                {/* SECTION 19: LEFT PANEL - CLAUSE LIBRARY */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                    {/* Panel Header */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <h2 className="font-semibold text-slate-800 mb-3">Clause Library</h2>

                        {/* Search */}
                        <div className="relative mb-3">
                            <input
                                type="text"
                                placeholder="Search clauses..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Service Type Filter */}
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white mb-2"
                            value={serviceFilter}
                            onChange={(e) => setServiceFilter(e.target.value)}
                        >
                            {SERVICE_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>

                        {/* Category Filter */}
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {CLAUSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clause List */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {CLAUSE_CATEGORIES.map(category => {
                            const categoryClauses = getMasterClausesByCategory(filteredClauses, category)
                            if (categoryClauses.length === 0) return null

                            return (
                                <div key={category} className="mb-2">
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(category, false)}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
                                    >
                                        <svg
                                            className={`w-4 h-4 transition-transform ${expandedCategories.has(category) ? 'rotate-90' : ''}`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                        <span>{category}</span>
                                        <span className="ml-auto text-xs text-slate-500">({categoryClauses.length})</span>
                                    </button>

                                    {/* Category Clauses */}
                                    {expandedCategories.has(category) && (
                                        <div className="mt-1 space-y-1">
                                            {categoryClauses.map(clause => (
                                                <div
                                                    key={clause.clauseId}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition ${activeClause?.clauseId === clause.clauseId
                                                            ? 'bg-emerald-50 border border-emerald-200'
                                                            : 'hover:bg-slate-50'
                                                        }`}
                                                    onClick={() => handleClauseClick(clause)}
                                                >
                                                    {/* Selection indicator */}
                                                    {isClauseSelected(clause.clauseId) ? (
                                                        <div className="w-5 h-5 bg-emerald-500 rounded flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5 border-2 border-slate-300 rounded flex-shrink-0 group-hover:border-emerald-400" />
                                                    )}

                                                    {/* Clause name */}
                                                    <span className="text-sm text-slate-700 truncate flex-1">
                                                        {clause.clauseName}
                                                    </span>

                                                    {/* Hover add button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleClauseClick(clause)
                                                        }}
                                                        className="w-5 h-5 rounded bg-slate-200 hover:bg-emerald-500 hover:text-white text-slate-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Configure clause"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {filteredClauses.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <p className="text-sm">No clauses match your filters</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* SECTION 20: CENTRE PANEL - CLAUSE CONFIGURATOR */}
                {/* ======================================================== */}
                <div className="flex-1 bg-slate-50 flex flex-col">
                    {/* Template Dropdown */}
                    <div className="p-4 bg-white border-b border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Load Template or Favourite
                        </label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            value={selectedPackId}
                            onChange={(e) => handlePackSelect(e.target.value)}
                        >
                            <option value="">Select a template...</option>
                            <optgroup label="CLARENCE Templates">
                                {availablePacks.filter(p => p.ownerType === 'clarence').map(pack => (
                                    <option key={pack.packId} value={pack.packId}>
                                        {pack.packName} ({pack.clauseCount} clauses)
                                    </option>
                                ))}
                            </optgroup>
                            {availablePacks.filter(p => p.ownerType === 'customer').length > 0 && (
                                <optgroup label="Your Favourites">
                                    {availablePacks.filter(p => p.ownerType === 'customer').map(pack => (
                                        <option key={pack.packId} value={pack.packId}>
                                            {pack.packName} ({pack.clauseCount} clauses)
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* Clause Configurator */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {activeClause ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
                                {/* Clause Header */}
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                            {activeClause.category}
                                        </span>
                                        {activeClause.regulatoryRequired && (
                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                                                Regulatory
                                            </span>
                                        )}
                                        {isClauseSelected(activeClause.clauseId) && (
                                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                                                ✓ In Contract
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-800">
                                        {activeClause.clauseName}
                                    </h3>
                                    <p className="text-slate-600 mt-2">
                                        {activeClause.description}
                                    </p>
                                </div>

                                {/* Position Slider */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Your Starting Position: <span className="text-emerald-600 font-bold">{clausePosition}</span>
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs text-blue-600">Provider</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            step="1"
                                            value={clausePosition}
                                            onChange={(e) => setClausePosition(parseInt(e.target.value))}
                                            className="flex-1 h-2 bg-gradient-to-r from-blue-200 via-slate-200 to-emerald-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <span className="text-xs text-emerald-600">Customer</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>1 (Provider-favourable)</span>
                                        <span>5 (Balanced)</span>
                                        <span>10 (Customer-favourable)</span>
                                    </div>
                                </div>

                                {/* Weight Selection */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Importance to You
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {WEIGHT_OPTIONS.map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setClauseWeight(option.value)
                                                    setIsNonNegotiable(option.value === 10)
                                                }}
                                                className={`p-3 rounded-lg border text-center transition ${clauseWeight === option.value
                                                        ? option.value === 10
                                                            ? 'bg-red-50 border-red-300 text-red-700'
                                                            : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="font-medium text-sm">{option.label}</div>
                                                <div className="text-xs opacity-75">{option.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Non-Negotiable Toggle */}
                                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isNonNegotiable}
                                            onChange={(e) => {
                                                setIsNonNegotiable(e.target.checked)
                                                if (e.target.checked) setClauseWeight(10)
                                            }}
                                            className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-800">Lock as Non-Negotiable</div>
                                            <div className="text-sm text-slate-500">
                                                Provider cannot negotiate this clause. Your position is final.
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Add Button */}
                                <button
                                    onClick={handleAddToContract}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    {isClauseSelected(activeClause.clauseId) ? (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Update Configuration
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add to Contract
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-slate-500">
                                    <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-lg font-medium mb-2">Select a Clause</p>
                                    <p className="text-sm">
                                        Click a clause from the library to configure<br />
                                        your starting position and importance.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* SECTION 21: RIGHT PANEL - YOUR CONTRACT */}
                {/* ======================================================== */}
                <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
                    {/* Panel Header */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-semibold text-slate-800">Your Contract</h2>
                            <span className="bg-emerald-100 text-emerald-700 text-sm font-medium px-2 py-1 rounded">
                                {selectedClauses.length} clauses
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            These clauses will be negotiated with your provider.
                        </p>
                    </div>

                    {/* Selected Clauses List */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {selectedClauses.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-sm">No clauses selected yet</p>
                                <p className="text-xs mt-1">Add clauses from the library or load a template</p>
                            </div>
                        ) : (
                            CLAUSE_CATEGORIES.map(category => {
                                const categoryClauses = getSelectedClausesByCategory(selectedClauses, category)
                                if (categoryClauses.length === 0) return null

                                return (
                                    <div key={category} className="mb-2">
                                        {/* Category Header */}
                                        <button
                                            onClick={() => toggleCategory(category, true)}
                                            className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg text-sm font-medium text-emerald-800 hover:bg-emerald-100 transition"
                                        >
                                            <svg
                                                className={`w-4 h-4 transition-transform ${expandedSelectedCategories.has(category) ? 'rotate-90' : ''}`}
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>{category}</span>
                                            <span className="ml-auto text-xs">({categoryClauses.length})</span>
                                        </button>

                                        {/* Category Clauses */}
                                        {expandedSelectedCategories.has(category) && (
                                            <div className="mt-1 space-y-1">
                                                {categoryClauses.map(clause => (
                                                    <div
                                                        key={clause.clauseId}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-100 hover:border-emerald-200 transition group"
                                                    >
                                                        {/* Status indicators */}
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {clause.isNonNegotiable && (
                                                                <span className="w-4 h-4 bg-red-100 text-red-600 rounded flex items-center justify-center" title="Locked">
                                                                    🔒
                                                                </span>
                                                            )}
                                                            <span
                                                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${clause.weight >= 7 ? 'bg-red-100 text-red-700' :
                                                                        clause.weight >= 4 ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-slate-100 text-slate-600'
                                                                    }`}
                                                                title={`Weight: ${clause.weight}`}
                                                            >
                                                                W{clause.weight}
                                                            </span>
                                                        </div>

                                                        {/* Clause name */}
                                                        <span
                                                            className="text-sm text-slate-700 truncate flex-1 cursor-pointer hover:text-emerald-600"
                                                            onClick={() => handleEditClause(clause)}
                                                        >
                                                            {clause.clauseName}
                                                        </span>

                                                        {/* Position */}
                                                        <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                                                            P{clause.position}
                                                        </span>

                                                        {/* Remove button */}
                                                        <button
                                                            onClick={() => handleRemoveClause(clause.clauseId)}
                                                            className="w-5 h-5 rounded bg-slate-100 hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Remove clause"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="p-4 border-t border-slate-200 space-y-3">
                        {/* Save as Favourite */}
                        <button
                            onClick={() => setShowSaveModal(true)}
                            disabled={selectedClauses.length === 0}
                            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            Save as Favourite
                        </button>

                        {/* Proceed to Contract Studio */}
                        <button
                            onClick={handleProceedToStudio}
                            disabled={selectedClauses.length === 0 || saving}
                            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Go to Contract Studio
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 22: SAVE AS FAVOURITE MODAL */}
            {/* ============================================================ */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Save as Favourite</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Template Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    placeholder="e.g., Standard IT Services 2025"
                                    value={savePackName}
                                    onChange={(e) => setSavePackName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Description (Optional)
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    rows={3}
                                    placeholder="Brief description of when to use this template..."
                                    value={savePackDescription}
                                    onChange={(e) => setSavePackDescription(e.target.value)}
                                />
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                <p className="text-sm text-slate-600">
                                    This will save <strong>{selectedClauses.length} clauses</strong> with their current positions and weights.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAsFavourite}
                                disabled={!savePackName.trim() || saving}
                                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Template'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 23: CONFIRM REPLACE MODAL */}
            {/* ============================================================ */}
            {showConfirmReplace && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Replace Current Selection?</h3>

                        <p className="text-slate-600 mb-4">
                            You have <strong>{selectedClauses.length} clauses</strong> currently selected.
                            Loading a template will replace all current selections.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowConfirmReplace(false)
                                    setPendingPackLoad(null)
                                }}
                                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => pendingPackLoad && loadPack(pendingPackLoad)}
                                className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition"
                            >
                                Replace All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}