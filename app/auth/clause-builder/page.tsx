'use client'

// ============================================================================
// CLAUSE BUILDER PAGE V2.0 - WITH CONTRACT UPLOAD & PARSING
// auth/clause-builder/page.tsx
// Created: 2025-12-28
// Updated: 2026-01-03 - Added contract upload, parsing, and verification
// Purpose: Allow customers to select, upload, or build clauses before negotiation
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { eventLogger } from '@/lib/eventLogger'

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// Builder modes (NEW)
type BuilderMode = 'select' | 'template' | 'upload' | 'manual' | 'verify'

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
    'Service',
    'Service Levels',
    'Term and Termination',
    'Intellectual Property',
    'Employment',
    'Charges and Payment',
    'Liability',
    'Data Protection'
]

// Weight options
const WEIGHT_OPTIONS = [
    { value: 1, label: 'Low', description: 'Willing to concede' },
    { value: 3, label: 'Medium-Low', description: 'Prefer but flexible' },
    { value: 5, label: 'Medium', description: 'Standard importance' },
    { value: 7, label: 'High', description: 'Important to us' },
    { value: 10, label: 'Non-Negotiable', description: 'Deal breaker' }
]

// Supported upload file types (NEW)
const SUPPORTED_FILE_TYPES: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt'
}

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

// Parsed clause from uploaded document (NEW)
interface ParsedClause {
    parsedClauseId: string
    sessionId: string
    sourceDocumentName: string
    sourceDocumentType: string
    sourceSectionIndex: number
    parsedNumber: string
    clauseLevel: number
    displayOrder: number
    suggestedName: string
    suggestedCategory: string
    clauseText: string
    detectionMethod: string
    contractStyle: string
    confidenceScore: number
    confidenceFactors: {
        categoryConfidence: number
        hasNumbering: boolean
        contentLength: number
    }
    flags: string[]
    isVerified: boolean
    verifiedName: string | null
    verifiedCategory: string | null
    status: 'pending' | 'verified' | 'rejected' | 'committed'
}

// Upload state tracking (NEW)
interface UploadState {
    file: File | null
    fileName: string
    fileType: string
    fileSize: number
    status: 'idle' | 'reading' | 'parsing' | 'completed' | 'error'
    progress: number
    progressMessage: string
    error: string | null
}

// Parsing result from API (NEW)
interface ParsingResult {
    success: boolean
    documentName: string
    detectedStyle: string
    styleConfidence: number
    totalClausesFound: number
    clauses: ParsedClause[]
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
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ========================================================================
    // SECTION 6: STATE DECLARATIONS
    // ========================================================================

    // Session & loading
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [session, setSession] = useState<SessionData | null>(null)

    // Builder mode (NEW)
    const [builderMode, setBuilderMode] = useState<BuilderMode>('select')
    const [showModeSelector, setShowModeSelector] = useState(true)

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

    // Provider check modal
    const [showProviderCheckModal, setShowProviderCheckModal] = useState(false)
    const [hasInvitedProviders, setHasInvitedProviders] = useState(false)

    // Auto-load template from session
    const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)
    const [sessionTemplatePackId, setSessionTemplatePackId] = useState<string | null>(null)

    // Upload state (NEW)
    const [uploadState, setUploadState] = useState<UploadState>({
        file: null,
        fileName: '',
        fileType: '',
        fileSize: 0,
        status: 'idle',
        progress: 0,
        progressMessage: '',
        error: null
    })

    // Parsed clauses from upload (NEW)
    const [parsedClauses, setParsedClauses] = useState<ParsedClause[]>([])
    const [parsingResult, setParsingResult] = useState<ParsingResult | null>(null)

    // Verification panel state (NEW)
    const [selectedParsedClause, setSelectedParsedClause] = useState<ParsedClause | null>(null)
    const [editingClauseName, setEditingClauseName] = useState('')
    const [editingClauseCategory, setEditingClauseCategory] = useState('')
    const [verificationFilter, setVerificationFilter] = useState<'all' | 'pending' | 'verified' | 'low-confidence'>('all')

    // Drag and drop state (NEW)
    const [isDragging, setIsDragging] = useState(false)

    // Deal value editing (NEW)
    const [isEditingDealValue, setIsEditingDealValue] = useState(false)
    const [editingDealValue, setEditingDealValue] = useState('')
    const [savingDealValue, setSavingDealValue] = useState(false)

    // ========================================================================
    // SECTION 7: INITIALIZATION
    // ========================================================================

    const loadInitialData = useCallback(async () => {
        const sessionId = searchParams.get('session_id')

        console.log('[ClauseBuilder] Starting initialization...')
        console.log('[ClauseBuilder] Session ID:', sessionId)

        if (!sessionId) {
            console.error('[ClauseBuilder] No session_id provided, redirecting...')
            router.push('/auth/contracts-dashboard')
            return
        }

        // Try eventLogger but don't let it block the page
        try {
            eventLogger.setSession(sessionId)
            eventLogger.started('clause_builder', 'page_loaded')
        } catch (logError) {
            console.warn('[ClauseBuilder] EventLogger error (non-fatal):', logError)
        }

        // Set minimal session data immediately so page can render
        setSession({
            sessionId: sessionId,
            sessionNumber: '',
            customerCompany: '',
            serviceRequired: '',
            dealValue: '',
            status: 'draft'
        })

        // Load session data (independent - failure won't stop other loads)
        const loadSession = async () => {
            try {
                console.log('[ClauseBuilder] Fetching session data...')
                const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
                console.log('[ClauseBuilder] Session response status:', response.status)

                if (response.ok) {
                    const text = await response.text()
                    console.log('[ClauseBuilder] Session response text length:', text.length)

                    if (text && text.length > 0) {
                        const sessionData = JSON.parse(text)
                        const sessionInfo = sessionData.session || sessionData
                        console.log('[ClauseBuilder] Session data parsed:', sessionInfo)

                        setSession({
                            sessionId: sessionId,
                            sessionNumber: sessionInfo.sessionNumber || sessionInfo.session_number || '',
                            customerCompany: sessionInfo.customerCompany || sessionInfo.customer_company || '',
                            serviceRequired: sessionInfo.contractType || sessionInfo.contract_type || sessionInfo.serviceRequired || '',
                            dealValue: sessionInfo.dealValue || sessionInfo.deal_value || '',
                            status: sessionInfo.status || 'draft'
                        })

                        if (sessionInfo.serviceRequired || sessionInfo.contractType) {
                            setServiceFilter(sessionInfo.serviceRequired || sessionInfo.contractType)
                        }

                        // Capture template_pack_id for auto-loading
                        const templatePackId = sessionInfo.templatePackId || sessionInfo.template_pack_id
                        if (templatePackId) {
                            console.log('[ClauseBuilder] Found template_pack_id:', templatePackId)
                            setSessionTemplatePackId(templatePackId)
                        }

                        // Check if providers have been invited
                        const hasProviders = sessionInfo.providers && sessionInfo.providers.length > 0
                        setHasInvitedProviders(hasProviders)
                    } else {
                        console.warn('[ClauseBuilder] Session response was empty')
                    }
                } else {
                    console.error('[ClauseBuilder] Session fetch failed:', response.status)
                }
            } catch (error) {
                console.error('[ClauseBuilder] Error loading session (non-fatal):', error)
            }
        }

        // Load master clause library (independent)
        const loadClauses = async () => {
            try {
                console.log('[ClauseBuilder] Fetching clause library...')
                const response = await fetch(`${API_BASE}/clause-library-api`)
                console.log('[ClauseBuilder] Clause library response status:', response.status)

                if (response.ok) {
                    const text = await response.text()
                    console.log('[ClauseBuilder] Clause library response length:', text.length)

                    if (text && text.length > 0) {
                        const clausesData = JSON.parse(text)
                        console.log('[ClauseBuilder] Clause library raw data:', clausesData)
                        const clauses = Array.isArray(clausesData) ? clausesData : (clausesData.clauses || [])
                        console.log('[ClauseBuilder] Processed clauses count:', clauses.length)
                        setMasterClauses(clauses)
                        setFilteredClauses(clauses)
                    } else {
                        console.warn('[ClauseBuilder] Clause library response was empty')
                    }
                } else {
                    console.error('[ClauseBuilder] Clause library fetch failed:', response.status)
                }
            } catch (error) {
                console.error('[ClauseBuilder] Error loading clauses:', error)
            }
        }

        // Load available packs (independent)
        const loadPacks = async () => {
            try {
                console.log('[ClauseBuilder] Fetching clause packs...')
                const response = await fetch(`${API_BASE}/clause-packs-api?session_id=${sessionId}`)
                console.log('[ClauseBuilder] Clause packs response status:', response.status)

                if (response.ok) {
                    const text = await response.text()
                    if (text && text.length > 0) {
                        const packsData = JSON.parse(text)
                        const rawPacks = Array.isArray(packsData) ? packsData : (packsData.packs || [])

                        // Transform snake_case to camelCase
                        const packs = rawPacks.map((p: any) => ({
                            packId: p.packId || p.pack_id,
                            packName: p.packName || p.pack_name,
                            packType: p.packType || p.pack_type,
                            description: p.description,
                            serviceCategory: p.serviceCategory || p.service_category,
                            industry: p.industry,
                            regulatoryFramework: p.regulatoryFramework || p.regulatory_framework,
                            ownerType: p.ownerType || p.owner_type,
                            companyId: p.companyId || p.company_id,
                            isBasePack: p.isBasePack ?? p.is_base_pack ?? false,
                            clauseCount: p.clauseCount ?? p.clause_count ?? 0
                        }))

                        console.log('[ClauseBuilder] Packs count:', packs.length)
                        setAvailablePacks(packs)
                    }
                } else {
                    console.error('[ClauseBuilder] Packs fetch failed:', response.status)
                }
            } catch (error) {
                console.error('[ClauseBuilder] Error loading packs:', error)
            }
        }

        // Load existing session clauses (independent)
        const loadExistingClauses = async () => {
            try {
                console.log('[ClauseBuilder] Fetching existing session clauses...')
                const response = await fetch(`${API_BASE}/session-clauses-api?session_id=${sessionId}&customer_selected=true`)
                console.log('[ClauseBuilder] Session clauses response status:', response.status)

                if (response.ok) {
                    const text = await response.text()
                    if (text && text.length > 0) {
                        const existingData = JSON.parse(text)
                        const existing = Array.isArray(existingData) ? existingData : (existingData.clauses || [])
                        console.log('[ClauseBuilder] Existing clauses count:', existing.length)

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

                            // If clauses exist, skip mode selector (NEW)
                            setShowModeSelector(false)
                            setBuilderMode('template')
                        }
                    }
                } else {
                    console.error('[ClauseBuilder] Session clauses fetch failed:', response.status)
                }
            } catch (error) {
                console.error('[ClauseBuilder] Error loading existing clauses:', error)
            }
        }

        // Run all loads in parallel - each is independent
        await Promise.all([
            loadSession(),
            loadClauses(),
            loadPacks(),
            loadExistingClauses()
        ])

        console.log('[ClauseBuilder] All data loading complete')

        try {
            eventLogger.completed('clause_builder', 'page_loaded', { sessionId })
        } catch (logError) {
            // Ignore eventLogger errors
        }

        console.log('[ClauseBuilder] Setting loading to false')
        setLoading(false)
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
    // SECTION 8B: AUTO-LOAD TEMPLATE FROM SESSION
    // ========================================================================

    useEffect(() => {
        // Only run once after initial data load
        if (loading || autoLoadAttempted) return

        const autoLoad = searchParams.get('auto_load')

        // If auto_load=true and we have a template_pack_id from session
        // AND no clauses have been selected yet, auto-load the template
        if (autoLoad === 'true' && sessionTemplatePackId && selectedClauses.length === 0) {
            console.log('[ClauseBuilder] Auto-loading template:', sessionTemplatePackId)
            loadPack(sessionTemplatePackId)
            setShowModeSelector(false)
            setBuilderMode('template')
        }

        setAutoLoadAttempted(true)
    }, [loading, autoLoadAttempted, searchParams, sessionTemplatePackId, selectedClauses.length])

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
            console.log('[ClauseBuilder] Loading pack:', packId)
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
                console.log('[ClauseBuilder] Pack response:', data)
                const loadedClauses = data.clauses || []
                console.log('[ClauseBuilder] Loaded clauses count:', loadedClauses.length)

                const mappedClauses = loadedClauses.map((c: any) => ({
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
                }))

                console.log('[ClauseBuilder] Mapped clauses:', mappedClauses)
                console.log('[ClauseBuilder] Categories in loaded clauses:', [...new Set(mappedClauses.map((c: any) => c.category))])

                setSelectedClauses(mappedClauses)
                setSelectedPackId(packId)

                eventLogger.completed('clause_builder', 'pack_loaded', {
                    packId,
                    clauseCount: loadedClauses.length
                })
            } else {
                console.error('[ClauseBuilder] Pack load failed:', response.status)
            }
        } catch (error) {
            console.error('[ClauseBuilder] Error loading pack:', error)
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
    // SECTION 12: PROCEED TO CONTRACT STUDIO (WITH PROVIDER CHECK)
    // ========================================================================

    // Check if user wants to proceed - show modal if no providers
    const handleProceedToStudio = () => {
        if (!session?.sessionId || selectedClauses.length === 0) return

        // Check if providers have been invited
        if (!hasInvitedProviders) {
            setShowProviderCheckModal(true)
        } else {
            // Providers exist - proceed directly
            saveClausesAndNavigate('studio')
        }
    }

    // Navigate to Invite Providers page
    const handleGoToInviteProviders = () => {
        if (!session?.sessionId) return
        setShowProviderCheckModal(false)

        // Save clauses first, then navigate to invite
        saveClausesAndNavigate('invite')
    }

    // Proceed to studio anyway (user confirmed)
    const handleProceedAnyway = () => {
        setShowProviderCheckModal(false)
        saveClausesAndNavigate('studio')
    }

    // Save clauses and navigate to destination
    const saveClausesAndNavigate = async (destination: 'studio' | 'invite') => {
        if (!session?.sessionId) return

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
                    clauseCount: selectedClauses.length,
                    destination: destination
                })

                // Navigate based on destination
                if (destination === 'invite') {
                    router.push(`/auth/invite-providers?session_id=${session.sessionId}&session_number=${session.sessionNumber}`)
                } else {
                    router.push(`/auth/contract-studio?session_id=${session.sessionId}`)
                }
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
    // SECTION 12B: UPLOAD HANDLERS (WITH CLIENT-SIDE PDF EXTRACTION)
    // ========================================================================

    // Import at top of file
    // import * as pdfjsLib from 'pdfjs-dist'
    // import 'pdfjs-dist/build/pdf.worker.entry'

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) processSelectedFile(file)
    }

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (event: React.DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setIsDragging(false)
        const file = event.dataTransfer.files?.[0]
        if (file) processSelectedFile(file)
    }

    // Extract text from PDF using pdf.js
    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdfjsLib = await import('pdfjs-dist')
        
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        
        console.log(`[ClauseBuilder] PDF has ${pdf.numPages} pages`)
        
        let fullText = ''
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum)
            const textContent = await page.getTextContent()
            
            // Extract text items and preserve structure
            const pageText = textContent.items
                .map((item: any) => {
                    // Handle text items
                    if ('str' in item) {
                        return item.str
                    }
                    return ''
                })
                .join(' ')
            
            fullText += pageText + '\n\n'
            
            // Update progress
            setUploadState(prev => ({
                ...prev,
                progress: Math.round((pageNum / pdf.numPages) * 25),
                progressMessage: `Extracting text from page ${pageNum} of ${pdf.numPages}...`
            }))
        }
        
        return fullText.trim()
    }

    // Extract text from DOCX (basic implementation)
    const extractTextFromDocx = async (file: File): Promise<string> => {
        // For DOCX, we'll use mammoth.js
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value
    }

    const readFileContent = async (file: File, fileType: string): Promise<string> => {
        console.log(`[ClauseBuilder] Extracting text from ${fileType} file...`)
        
        try {
            if (fileType === 'txt') {
                // Plain text - read directly
                return await file.text()
            } else if (fileType === 'pdf') {
                // PDF - extract with pdf.js
                return await extractTextFromPdf(file)
            } else if (fileType === 'docx' || fileType === 'doc') {
                // DOCX - extract with mammoth
                return await extractTextFromDocx(file)
            } else {
                throw new Error(`Unsupported file type: ${fileType}`)
            }
        } catch (error) {
            console.error('[ClauseBuilder] Text extraction failed:', error)
            throw new Error(`Failed to extract text from ${fileType.toUpperCase()} file. The file may be corrupted or password-protected.`)
        }
    }

    const processSelectedFile = async (file: File) => {
        console.log('[ClauseBuilder] File selected:', file.name, file.type, file.size)

        const fileType = SUPPORTED_FILE_TYPES[file.type]
        if (!fileType) {
            setUploadState(prev => ({
                ...prev,
                status: 'error',
                error: `Unsupported file type: ${file.type}. Please upload a PDF, DOCX, or TXT file.`
            }))
            return
        }

        if (file.size > 50 * 1024 * 1024) {  // Increased limit since we extract locally
            setUploadState(prev => ({
                ...prev,
                status: 'error',
                error: 'File too large. Maximum size is 50MB.'
            }))
            return
        }

        setUploadState({
            file,
            fileName: file.name,
            fileType,
            fileSize: file.size,
            status: 'reading',
            progress: 5,
            progressMessage: 'Extracting text from document...',
            error: null
        })

        try {
            // Extract text on the client side
            const documentText = await readFileContent(file, fileType)

            if (!documentText || documentText.length < 100) {
                throw new Error('Could not extract text from document. Please ensure the file is not empty or password-protected.')
            }

            console.log('[ClauseBuilder] Text extracted successfully:', {
                length: documentText.length,
                preview: documentText.substring(0, 200)
            })

            setUploadState(prev => ({
                ...prev,
                status: 'parsing',
                progress: 30,
                progressMessage: 'CLARENCE is analyzing your contract...'
            }))

            // Send extracted text to backend (not base64 binary)
            await parseDocument(documentText, file.name, fileType)

        } catch (error) {
            console.error('[ClauseBuilder] File processing error:', error)
            setUploadState(prev => ({
                ...prev,
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to process document'
            }))
        }
    }

    const parseDocument = async (
        documentText: string, 
        fileName: string, 
        fileType: string
    ) => {
        if (!session?.sessionId) throw new Error('No active session')

        const progressInterval = setInterval(() => {
            setUploadState(prev => {
                if (prev.progress < 85) {
                    const messages = [
                        'Identifying clause structure...',
                        'Detecting contract format...',
                        'Categorizing clauses...',
                        'Calculating confidence scores...'
                    ]
                    const idx = Math.floor((prev.progress - 30) / 15) % messages.length
                    return { ...prev, progress: prev.progress + 5, progressMessage: messages[idx] }
                }
                return prev
            })
        }, 800)

        try {
            // Send extracted text directly - no base64 needed!
            const requestBody = {
                session_id: session.sessionId,
                file_name: fileName,
                file_type: fileType,
                document_text: documentText  // Plain text, already extracted
            }

            console.log('[ClauseBuilder] Sending to parser:', {
                sessionId: session.sessionId,
                fileName,
                fileType,
                textLength: documentText.length
            })

            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })

            clearInterval(progressInterval)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Parsing failed')
            }

            const result = await response.json()

            if (result.success) {
                setParsingResult({
                    success: true,
                    documentName: result.documentName,
                    detectedStyle: result.parsing.detectedStyle,
                    styleConfidence: result.parsing.styleConfidence,
                    totalClausesFound: result.parsing.totalClausesFound,
                    clauses: []
                })

                await loadParsedClauses()

                setUploadState(prev => ({
                    ...prev,
                    status: 'completed',
                    progress: 100,
                    progressMessage: `Found ${result.parsing.totalClausesFound} clauses!`
                }))

                setBuilderMode('verify')
            } else {
                throw new Error(result.error || 'Parsing returned unsuccessful result')
            }
        } catch (error) {
            clearInterval(progressInterval)
            throw error
        }
    }

    const loadParsedClauses = async () => {
        if (!session?.sessionId) return

        try {
            const response = await fetch(`${API_BASE}/get-parsed-clauses?session_id=${session.sessionId}`)
            if (response.ok) {
                const data = await response.json()
                const clauses = Array.isArray(data) ? data : (data.clauses || [])
                setParsedClauses(clauses)
            }
        } catch (error) {
            console.error('[ClauseBuilder] Error loading parsed clauses:', error)
        }
    }

    const resetUpload = () => {
        setUploadState({
            file: null, fileName: '', fileType: '', fileSize: 0,
            status: 'idle', progress: 0, progressMessage: '', error: null
        })
        setParsedClauses([])
        setParsingResult(null)
        setSelectedParsedClause(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // ========================================================================
    // SECTION 12C: VERIFICATION HANDLERS (NEW)
    // ========================================================================

    const verifyClause = async (clause: ParsedClause, verifiedName?: string, verifiedCategory?: string) => {
        if (!session?.sessionId) return

        setParsedClauses(prev => prev.map(c =>
            c.parsedClauseId === clause.parsedClauseId
                ? { ...c, isVerified: true, verifiedName: verifiedName || c.suggestedName, verifiedCategory: verifiedCategory || c.suggestedCategory, status: 'verified' as const }
                : c
        ))

        try {
            await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    parsed_clause_id: clause.parsedClauseId,
                    verified_name: verifiedName || clause.suggestedName,
                    verified_category: verifiedCategory || clause.suggestedCategory,
                    status: 'verified'
                })
            })
        } catch (error) {
            console.error('[ClauseBuilder] Error verifying clause:', error)
        }

        setSelectedParsedClause(null)
        setEditingClauseName('')
        setEditingClauseCategory('')
    }

    const rejectClause = async (clause: ParsedClause) => {
        if (!session?.sessionId) return

        setParsedClauses(prev => prev.map(c =>
            c.parsedClauseId === clause.parsedClauseId ? { ...c, status: 'rejected' as const } : c
        ))

        try {
            await fetch(`${API_BASE}/update-parsed-clause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    parsed_clause_id: clause.parsedClauseId,
                    status: 'rejected'
                })
            })
        } catch (error) {
            console.error('[ClauseBuilder] Error rejecting clause:', error)
        }
    }

    const verifyAllPending = async () => {
        const pending = parsedClauses.filter(c => c.status === 'pending')
        for (const clause of pending) {
            await verifyClause(clause)
        }
    }

    const commitVerifiedClauses = async () => {
        if (!session?.sessionId) return

        const verified = parsedClauses.filter(c => c.status === 'verified')
        if (verified.length === 0) {
            alert('No verified clauses to commit.')
            return
        }

        setSaving(true)

        try {
            const response = await fetch(`${API_BASE}/commit-parsed-clauses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    clause_ids: verified.map(c => c.parsedClauseId)
                })
            })

            if (response.ok) {
                // Reload existing clauses to show committed ones
                const sessionId = session.sessionId
                const clausesResponse = await fetch(`${API_BASE}/session-clauses-api?session_id=${sessionId}&customer_selected=true`)
                if (clausesResponse.ok) {
                    const data = await clausesResponse.json()
                    const clauses = Array.isArray(data) ? data : (data.clauses || [])
                    const mapped: SelectedClause[] = clauses.map((c: any) => ({
                        clauseId: c.clauseId || c.clause_id,
                        clauseName: c.clauseName || c.clause_name,
                        category: c.category,
                        description: c.description || '',
                        displayOrder: c.displayOrder || c.display_order || 0,
                        position: c.customerPosition || c.customer_position || 5,
                        weight: c.customerWeight || c.customer_weight || 5,
                        isNonNegotiable: c.isDealBreakerCustomer || c.is_deal_breaker_customer || false,
                        sourcePackId: c.sourcePackId || c.source_pack_id || null,
                        addedManually: false,
                        hasSubClauses: false
                    }))
                    setSelectedClauses(mapped)
                }

                setParsedClauses([])
                setParsingResult(null)
                setBuilderMode('template')
                setShowModeSelector(false)
            }
        } catch (error) {
            console.error('[ClauseBuilder] Error committing clauses:', error)
            alert('Failed to commit clauses.')
        } finally {
            setSaving(false)
        }
    }

    const getFilteredParsedClauses = (): ParsedClause[] => {
        switch (verificationFilter) {
            case 'pending': return parsedClauses.filter(c => c.status === 'pending')
            case 'verified': return parsedClauses.filter(c => c.status === 'verified')
            case 'low-confidence': return parsedClauses.filter(c => c.confidenceScore < 0.7 && c.status !== 'rejected')
            default: return parsedClauses.filter(c => c.status !== 'rejected')
        }
    }

    // ========================================================================
    // SECTION 12D: SAVE DEAL VALUE (NEW)
    // ========================================================================

    const saveDealValue = async () => {
        if (!session?.sessionId || !editingDealValue.trim()) return

        setSavingDealValue(true)

        try {
            const response = await fetch(`${API_BASE}/update-session-deal-value`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    deal_value: editingDealValue.trim()
                })
            })

            if (response.ok) {
                // Update local session state
                setSession(prev => prev ? { ...prev, dealValue: editingDealValue.trim() } : null)
                setIsEditingDealValue(false)

                eventLogger.completed('clause_builder', 'deal_value_saved', {
                    sessionId: session.sessionId,
                    dealValue: editingDealValue
                })
            } else {
                console.error('Failed to save deal value')
                alert('Failed to save deal value. Please try again.')
            }
        } catch (error) {
            console.error('Error saving deal value:', error)
            alert('Failed to save deal value. Please try again.')
        } finally {
            setSavingDealValue(false)
        }
    }

    const startEditingDealValue = () => {
        setEditingDealValue(session?.dealValue || '')
        setIsEditingDealValue(true)
    }

    const cancelEditingDealValue = () => {
        setIsEditingDealValue(false)
        setEditingDealValue('')
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
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
            {/* ============================================================ */}
            {/* SECTION 16: HEADER */}
            {/* ============================================================ */}
            <header className="bg-slate-800 text-white shadow-lg">
                <div className="px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <Link href="/auth/contracts-dashboard" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">Clause Builder</div>
                            </div>
                        </Link>

                        {/* Session Info & Mode Badge */}
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

                            {/* Deal Value - Editable (NEW) */}
                            <div className="text-sm">
                                <span className="text-slate-400">Deal Value:</span>
                                {isEditingDealValue ? (
                                    <span className="ml-2 inline-flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={editingDealValue}
                                            onChange={(e) => setEditingDealValue(e.target.value)}
                                            placeholder="e.g., £500,000"
                                            className="w-32 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            autoFocus
                                        />
                                        <button
                                            onClick={saveDealValue}
                                            disabled={savingDealValue}
                                            className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
                                        >
                                            {savingDealValue ? '...' : '✓'}
                                        </button>
                                        <button
                                            onClick={cancelEditingDealValue}
                                            className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ) : (
                                    <span
                                        onClick={startEditingDealValue}
                                        className="ml-2 text-white cursor-pointer hover:text-emerald-300 transition group"
                                        title="Click to edit deal value"
                                    >
                                        {session?.dealValue || (
                                            <span className="text-amber-400 group-hover:text-amber-300">
                                                + Add value
                                            </span>
                                        )}
                                        <svg className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </span>
                                )}
                            </div>

                            {/* Mode Badge (NEW) */}
                            {!showModeSelector && builderMode !== 'select' && (
                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${builderMode === 'template' ? 'bg-emerald-500/20 text-emerald-300' :
                                    builderMode === 'upload' ? 'bg-blue-500/20 text-blue-300' :
                                        builderMode === 'verify' ? 'bg-purple-500/20 text-purple-300' :
                                            'bg-slate-500/20 text-slate-300'
                                    }`}>
                                    {builderMode === 'template' ? '📋 Template' :
                                        builderMode === 'upload' ? '📤 Upload' :
                                            builderMode === 'verify' ? '✓ Verify' :
                                                '🔧 Manual'}
                                </span>
                            )}

                            <Link
                                href="/auth/contracts-dashboard"
                                className="text-sm text-slate-400 hover:text-white transition"
                            >
                                ← Back to Dashboard
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ============================================================ */}
            {/* SECTION 17: MODE SELECTOR (NEW) */}
            {/* ============================================================ */}
            {showModeSelector && (
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                                    How would you like to set up your contract?
                                </h1>
                                <p className="text-slate-500">Choose the method that works best for your situation</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Template Option */}
                                <button
                                    onClick={() => { setBuilderMode('template'); setShowModeSelector(false) }}
                                    className="group p-6 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-400 rounded-xl transition-all duration-200 text-left"
                                >
                                    <div className="text-4xl mb-4">📋</div>
                                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-emerald-700 mb-2">
                                        Use a Template
                                    </h3>
                                    <p className="text-sm text-slate-500 group-hover:text-emerald-600">
                                        Start with CLARENCE&apos;s professionally crafted clause templates
                                    </p>
                                    <div className="mt-4 text-xs text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Recommended for new users →
                                    </div>
                                </button>

                                {/* Upload Option */}
                                <button
                                    onClick={() => { setBuilderMode('upload'); setShowModeSelector(false) }}
                                    className="group p-6 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-xl transition-all duration-200 text-left"
                                >
                                    <div className="text-4xl mb-4">📤</div>
                                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-700 mb-2">
                                        Upload Your Contract
                                    </h3>
                                    <p className="text-sm text-slate-500 group-hover:text-blue-600">
                                        Upload an existing contract and CLARENCE will parse it
                                    </p>
                                    <div className="mt-4 text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Best for existing contracts →
                                    </div>
                                </button>

                                {/* Manual Option */}
                                <button
                                    onClick={() => { setBuilderMode('manual'); setShowModeSelector(false) }}
                                    className="group p-6 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-400 rounded-xl transition-all duration-200 text-left"
                                >
                                    <div className="text-4xl mb-4">🔧</div>
                                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-purple-700 mb-2">
                                        Build from Scratch
                                    </h3>
                                    <p className="text-sm text-slate-500 group-hover:text-purple-600">
                                        Select individual clauses from our comprehensive library
                                    </p>
                                    <div className="mt-4 text-xs text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Full control →
                                    </div>
                                </button>
                            </div>

                            {selectedClauses.length > 0 && (
                                <div className="text-center mt-8 pt-6 border-t border-slate-200">
                                    <p className="text-sm text-slate-500 mb-2">
                                        You have {selectedClauses.length} clauses already configured
                                    </p>
                                    <button
                                        onClick={() => { setShowModeSelector(false); setBuilderMode('template') }}
                                        className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                                    >
                                        Continue with existing clauses →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 17B: UPLOAD PANEL (NEW) */}
            {/* ============================================================ */}
            {!showModeSelector && builderMode === 'upload' && (
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Upload Your Contract</h2>
                                    <p className="text-slate-500 text-sm">CLARENCE will analyze and extract clauses for negotiation</p>
                                </div>
                                <button
                                    onClick={() => { setShowModeSelector(true); setBuilderMode('select'); resetUpload() }}
                                    className="text-slate-400 hover:text-slate-600 text-sm"
                                >
                                    ← Change method
                                </button>
                            </div>

                            {/* Idle State */}
                            {uploadState.status === 'idle' && (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.docx,.doc,.txt"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <div className="text-5xl mb-4">{isDragging ? '📥' : '📄'}</div>
                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                        {isDragging ? 'Drop your contract here' : 'Drag and drop your contract'}
                                    </h3>
                                    <p className="text-slate-500 mb-4">
                                        or{' '}
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            browse to upload
                                        </button>
                                    </p>
                                    <p className="text-xs text-slate-400">Supported: PDF, DOCX, DOC, TXT • Max 10MB</p>
                                </div>
                            )}

                            {/* Progress State */}
                            {(uploadState.status === 'reading' || uploadState.status === 'parsing') && (
                                <div className="text-center py-12">
                                    <div className="w-24 h-24 mx-auto mb-6 relative">
                                        <svg className="w-24 h-24 transform -rotate-90">
                                            <circle cx="48" cy="48" r="44" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                                            <circle cx="48" cy="48" r="44" stroke="#3b82f6" strokeWidth="8" fill="none"
                                                strokeDasharray={`${uploadState.progress * 2.76} 276`} className="transition-all duration-500" />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-blue-600">{uploadState.progress}%</span>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                        {uploadState.status === 'reading' ? 'Reading Document' : 'Analyzing Contract'}
                                    </h3>
                                    <p className="text-slate-500 mb-4">{uploadState.progressMessage}</p>
                                    <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
                                        <span>📄 {uploadState.fileName}</span>
                                        <span>•</span>
                                        <span>{Math.round(uploadState.fileSize / 1024)} KB</span>
                                    </div>
                                </div>
                            )}

                            {/* Completed State */}
                            {uploadState.status === 'completed' && parsingResult && (
                                <div className="text-center py-8">
                                    <div className="text-5xl mb-4">✅</div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Contract Parsed Successfully!</h3>
                                    <p className="text-slate-500 mb-6">
                                        CLARENCE found <span className="font-semibold text-blue-600">{parsingResult.totalClausesFound} clauses</span>
                                    </p>
                                    <div className="bg-slate-50 rounded-lg p-4 max-w-sm mx-auto mb-6">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><span className="text-slate-500">Document:</span><p className="font-medium truncate">{parsingResult.documentName}</p></div>
                                            <div><span className="text-slate-500">Format:</span><p className="font-medium capitalize">{parsingResult.detectedStyle.replace('_', ' ')}</p></div>
                                            <div><span className="text-slate-500">Confidence:</span><p className="font-medium">{Math.round(parsingResult.styleConfidence * 100)}%</p></div>
                                            <div><span className="text-slate-500">Clauses:</span><p className="font-medium">{parsingResult.totalClausesFound}</p></div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setBuilderMode('verify')}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                                    >
                                        Review & Verify Clauses →
                                    </button>
                                </div>
                            )}

                            {/* Error State */}
                            {uploadState.status === 'error' && (
                                <div className="text-center py-8">
                                    <div className="text-5xl mb-4">❌</div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Failed</h3>
                                    <p className="text-red-600 mb-6">{uploadState.error}</p>
                                    <button
                                        onClick={resetUpload}
                                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 17C: VERIFICATION PANEL (NEW) */}
            {/* ============================================================ */}
            {!showModeSelector && builderMode === 'verify' && (
                <div className="flex-1 flex overflow-hidden p-4 gap-4">
                    {/* Left: Clause List */}
                    <div className="w-1/2 bg-white rounded-lg border border-slate-200 flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-slate-800">Parsed Clauses ({getFilteredParsedClauses().length})</h2>
                                <button onClick={() => { setBuilderMode('upload'); resetUpload() }} className="text-sm text-slate-500 hover:text-slate-700">
                                    Upload different
                                </button>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => setVerificationFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-full ${verificationFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                    All ({parsedClauses.filter(c => c.status !== 'rejected').length})
                                </button>
                                <button onClick={() => setVerificationFilter('pending')} className={`px-3 py-1 text-xs font-medium rounded-full ${verificationFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                                    Pending ({parsedClauses.filter(c => c.status === 'pending').length})
                                </button>
                                <button onClick={() => setVerificationFilter('verified')} className={`px-3 py-1 text-xs font-medium rounded-full ${verificationFilter === 'verified' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                    Verified ({parsedClauses.filter(c => c.status === 'verified').length})
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {getFilteredParsedClauses().length === 0 ? (
                                <div className="text-center text-slate-400 py-8">No clauses match the current filter</div>
                            ) : (
                                <div className="space-y-2">
                                    {getFilteredParsedClauses().map((clause, index) => (
                                        <button
                                            key={clause.parsedClauseId || index}
                                            onClick={() => {
                                                setSelectedParsedClause(clause)
                                                setEditingClauseName(clause.verifiedName || clause.suggestedName)
                                                setEditingClauseCategory(clause.verifiedCategory || clause.suggestedCategory)
                                            }}
                                            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedParsedClause?.parsedClauseId === clause.parsedClauseId
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-slate-400">{clause.parsedNumber}</span>
                                                        {clause.confidenceScore < 0.7 && <span className="text-xs text-red-500">⚠️</span>}
                                                    </div>
                                                    <p className="font-medium text-slate-800 truncate">{clause.verifiedName || clause.suggestedName}</p>
                                                    <p className="text-xs text-slate-500">{clause.verifiedCategory || clause.suggestedCategory}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${clause.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                                        clause.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {clause.status}
                                                    </span>
                                                    <span className="text-xs text-slate-400">{Math.round(clause.confidenceScore * 100)}%</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                            <button onClick={verifyAllPending} disabled={parsedClauses.filter(c => c.status === 'pending').length === 0} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                ✓ Verify All Pending
                            </button>
                            <button onClick={commitVerifiedClauses} disabled={parsedClauses.filter(c => c.status === 'verified').length === 0 || saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition">
                                {saving ? 'Committing...' : `Commit ${parsedClauses.filter(c => c.status === 'verified').length} Clauses →`}
                            </button>
                        </div>
                    </div>

                    {/* Right: Clause Detail */}
                    <div className="w-1/2 bg-white rounded-lg border border-slate-200 flex flex-col">
                        {selectedParsedClause ? (
                            <>
                                <div className="p-4 border-b border-slate-200 bg-slate-50">
                                    <h3 className="font-semibold text-slate-800">Clause Details</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <div className={`p-3 rounded-lg ${selectedParsedClause.confidenceScore >= 0.8 ? 'bg-emerald-50 border border-emerald-200' :
                                        selectedParsedClause.confidenceScore >= 0.6 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">
                                                {selectedParsedClause.confidenceScore >= 0.8 ? '✅ High confidence' :
                                                    selectedParsedClause.confidenceScore >= 0.6 ? '⚠️ Medium confidence - please verify' : '❌ Low confidence - review carefully'}
                                            </span>
                                            <span className="text-sm font-mono">{Math.round(selectedParsedClause.confidenceScore * 100)}%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Clause Name</label>
                                        <input type="text" value={editingClauseName} onChange={(e) => setEditingClauseName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                        <select value={editingClauseCategory} onChange={(e) => setEditingClauseCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                            {CLAUSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Original Numbering</label>
                                        <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-600 font-mono text-sm">{selectedParsedClause.parsedNumber}</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Clause Content</label>
                                        <div className="p-3 bg-slate-50 rounded-lg max-h-48 overflow-y-auto">
                                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedParsedClause.clauseText || 'No content extracted'}</p>
                                        </div>
                                    </div>

                                    {selectedParsedClause.flags && selectedParsedClause.flags.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Parsing Notes</label>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedParsedClause.flags.map((flag, i) => (
                                                    <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">{flag.replace(/_/g, ' ')}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                                    <button onClick={() => rejectClause(selectedParsedClause)} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
                                        Reject Clause
                                    </button>
                                    <button onClick={() => verifyClause(selectedParsedClause, editingClauseName, editingClauseCategory)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition">
                                        ✓ Verify Clause
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400">
                                <div className="text-center">
                                    <div className="text-4xl mb-2">👈</div>
                                    <p>Select a clause to review</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SECTION 17D: TEMPLATE/MANUAL MODE - INSTRUCTIONAL BANNER */}
            {/* ============================================================ */}
            {!showModeSelector && (builderMode === 'template' || builderMode === 'manual') && (
                <>
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-4 px-6">
                        <div className="max-w-7xl mx-auto flex items-center justify-between">
                            <div>
                                <h1 className="text-xl font-semibold">Build Your Contract</h1>
                                <p className="text-emerald-100 text-sm mt-1">
                                    Select clauses from the library, configure your starting positions, then proceed to negotiation.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => { setShowModeSelector(true); setBuilderMode('select') }}
                                    className="text-sm text-emerald-200 hover:text-white transition"
                                >
                                    ← Change method
                                </button>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{selectedClauses.length}</div>
                                    <div className="text-xs text-emerald-200">Clauses Selected</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 17E: TEMPLATE SELECTOR SUB-HEADER */}
                    {/* ============================================================ */}
                    <div className="bg-white border-b border-slate-200 px-6 py-3">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                                Load Template:
                            </label>
                            <select
                                className="flex-1 max-w-md px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                            {selectedPackId && (
                                <span className="text-sm text-emerald-600 font-medium">
                                    ✓ Template loaded
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ============================================================ */}
                    {/* SECTION 18: THREE-PANEL LAYOUT */}
                    {/* ============================================================ */}
                    <div className="flex-1 flex overflow-hidden">

                        {/* ======================================================== */}
                        {/* SECTION 19: LEFT PANEL - CLAUSE LIBRARY */}
                        {/* ======================================================== */}
                        <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                            {/* Panel Header */}
                            <div className="p-4 border-b border-slate-200 bg-slate-50">
                                <h2 className="font-semibold text-slate-800 mb-3">Clause Library</h2>

                                {/* Search */}
                                <div className="relative mb-3">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search clauses..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Category Filter */}
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
                                                <div className="mt-1 ml-2 border-l-2 border-slate-200">
                                                    {categoryClauses.map(clause => (
                                                        <button
                                                            key={clause.clauseId}
                                                            onClick={() => handleClauseClick(clause)}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 ml-2 rounded-r-lg text-left transition ${activeClause?.clauseId === clause.clauseId
                                                                ? 'bg-emerald-50 border-l-2 border-emerald-500 -ml-0.5'
                                                                : isClauseSelected(clause.clauseId)
                                                                    ? 'bg-slate-50 text-slate-500'
                                                                    : 'hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            {isClauseSelected(clause.clauseId) && (
                                                                <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                            <span className="text-sm truncate">{clause.clauseName}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* SECTION 20: CENTRE PANEL - CLAUSE CONFIGURATOR */}
                        {/* ======================================================== */}
                        <div className="flex-1 bg-slate-50 overflow-y-auto">
                            <div className="p-6">
                                {activeClause ? (
                                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                        {/* Clause Header */}
                                        <div className="mb-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                                                    {activeClause.category}
                                                </span>
                                                {isClauseSelected(activeClause.clauseId) && (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-600 rounded">
                                                        Already Selected
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
                                                <span className="text-xs text-emerald-600 font-medium">Customer</span>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    step="1"
                                                    value={11 - clausePosition}
                                                    onChange={(e) => setClausePosition(11 - parseInt(e.target.value))}
                                                    className="flex-1 h-2 bg-gradient-to-r from-emerald-200 via-slate-200 to-blue-200 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <span className="text-xs text-blue-600 font-medium">Provider</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                <span>10 (Customer-favourable)</span>
                                                <span>5 (Balanced)</span>
                                                <span>1 (Provider-favourable)</span>
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
                        <div className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
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
                                                    <div className="mt-1 ml-2 border-l-2 border-emerald-200">
                                                        {categoryClauses.map(clause => (
                                                            <div
                                                                key={clause.clauseId}
                                                                className="flex items-center gap-2 px-3 py-2 ml-2 rounded-r-lg bg-white border-l-2 border-transparent hover:border-emerald-400 transition group"
                                                                onClick={() => handleEditClause(clause)}
                                                            >
                                                                {/* Lock indicator */}
                                                                {clause.isNonNegotiable && (
                                                                    <span className="text-sm" title="Non-Negotiable">
                                                                        🔒
                                                                    </span>
                                                                )}

                                                                {/* Clause name */}
                                                                <span className="text-sm text-slate-700 truncate flex-1 cursor-pointer hover:text-emerald-600">
                                                                    {clause.clauseName}
                                                                </span>

                                                                {/* Weight badge */}
                                                                <span
                                                                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${clause.weight >= 7 ? 'bg-red-100 text-red-700' :
                                                                        clause.weight >= 4 ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-slate-100 text-slate-600'
                                                                        }`}
                                                                    title={`Weight: ${clause.weight}`}
                                                                >
                                                                    W{clause.weight}
                                                                </span>

                                                                {/* Position badge - always emerald (customer colour) */}
                                                                <span
                                                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700"
                                                                    title={`Position: ${clause.position}`}
                                                                >
                                                                    P{clause.position}
                                                                </span>

                                                                {/* Remove button */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleRemoveClause(clause.clauseId)
                                                                    }}
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
                                    className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-medium rounded-lg transition text-sm flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    Save as Template
                                </button>

                                {/* Proceed to Studio */}
                                <button
                                    onClick={handleProceedToStudio}
                                    disabled={selectedClauses.length === 0 || saving}
                                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Proceed to Contract Studio
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ============================================================ */}
            {/* SECTION 22: SAVE AS FAVOURITE MODAL */}
            {/* ============================================================ */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Save as Template</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Template Name *
                                </label>
                                <input
                                    type="text"
                                    value={savePackName}
                                    onChange={(e) => setSavePackName(e.target.value)}
                                    placeholder="e.g., My Standard BPO Clauses"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={savePackDescription}
                                    onChange={(e) => setSavePackDescription(e.target.value)}
                                    placeholder="Brief description of this template..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowSaveModal(false)
                                    setSavePackName('')
                                    setSavePackDescription('')
                                }}
                                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAsFavourite}
                                disabled={!savePackName.trim() || saving}
                                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
                            >
                                {saving ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </span>
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

            {/* ============================================================ */}
            {/* SECTION 24: PROVIDER CHECK MODAL */}
            {/* ============================================================ */}
            {showProviderCheckModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
                        {/* Warning Icon */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">No Providers Invited</h3>
                                <p className="text-sm text-slate-500">You haven&apos;t invited any providers yet</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                            <p className="text-slate-600 text-sm">
                                Your <strong>{selectedClauses.length} clauses</strong> have been configured.
                                Would you like to invite providers to negotiate, or continue to the Contract Studio to review your setup first?
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Primary action - Invite Providers */}
                            <button
                                onClick={handleGoToInviteProviders}
                                disabled={saving}
                                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        Invite Providers First
                                    </>
                                )}
                            </button>

                            {/* Secondary action - Continue to Studio */}
                            <button
                                onClick={handleProceedAnyway}
                                disabled={saving}
                                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Review in Contract Studio First
                            </button>

                            {/* Cancel */}
                            <button
                                onClick={() => setShowProviderCheckModal(false)}
                                className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}