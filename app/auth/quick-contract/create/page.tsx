'use client'

// ============================================================================
// QUICK CREATE - CREATE PAGE
// Version: 2.0
// Date: 24 February 2026
// Path: /app/auth/quick-contract/create/page.tsx
// Description: Create a new Quick Contract from template or upload.
//              Simplified flow: Source → Details → Content → Studio redirect.
//              Removed Review Clauses and Invite steps (consolidated to Studio).
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import FeedbackButton from '@/app/components/FeedbackButton'
import mammoth from 'mammoth'

// Note: pdfjs-dist is imported dynamically in extractTextFromPDF to avoid SSR issues


import {
    CONTRACT_TYPE_DEFINITIONS,
    getContractType,
    getContractTypesByCategory,
    getCategoryDisplayName,
    getRoleContext,
    type PartyRole,
    type ContractTypeDefinition,
} from '@/lib/role-matrix'


// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    companyId: string
    role: string
    userId: string
}

interface QCTemplate {
    templateId: string
    templateName: string
    templateCategory: string
    description: string
    contractType: string
    clauseCount: number
    timesUsed: number
    // Scope
    isSystem: boolean
    isPublic: boolean
    companyId: string | null
    createdByUserId: string | null
    sourceContractId: string | null
    // Legacy fields for qc_templates compatibility
    documentContent: string
    documentFormat: string
    variableSchema: VariableField[]
    isSystemTemplate: boolean
}

interface VariableField {
    key: string
    label: string
    type: 'text' | 'textarea' | 'number' | 'date' | 'currency'
    required: boolean
    default?: string
}

interface ParsedClause {
    clauseId?: string  // Add this line
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
    level: number
    parentClauseNumber: string | null
    displayOrder: number
    isExpanded?: boolean
    // Clarence Certification fields
    clarenceCertified?: boolean
    clarencePosition?: number | null
    clarenceFairness?: 'balanced' | 'slightly_customer_favoring' | 'customer_favoring' | 'heavily_customer_favoring' | 'slightly_provider_favoring' | 'provider_favoring' | 'heavily_provider_favoring' | 'review_recommended' | null
    clarenceSummary?: string | null
    clarenceAssessment?: string | null
    clarenceFlags?: string[]
    clarenceCertifiedAt?: string | null
}

type CreateStep = 'source' | 'details' | 'template_select' | 'variables' | 'content'
type SourceType = 'template' | 'upload' | 'blank' | null
type ContractType = string | null
type ParsingStatus = 'idle' | 'submitting' | 'error'

interface CreateState {
    step: CreateStep
    sourceType: SourceType
    contractType: ContractType
    contractTypeKey: string | null        // Role-matrix key (e.g. 'service_agreement')
    creatorPartyRole: PartyRole | null    // 'protected' or 'providing'
    customProtectedLabel: string          // Custom label for 'other' type
    customProvidingLabel: string          // Custom label for 'other' type
    contractName: string
    description: string
    referenceNumber: string
    selectedTemplate: QCTemplate | null
    variableValues: Record<string, string>
    documentContent: string
    uploadedFileName: string | null
    uploadedFileUrl: string | null
    // Parsing state
    uploadedContractId: string | null
    parsedClauses: ParsedClause[]
    parsingStatus: ParsingStatus
    parsingError: string | null
    certificationProgress?: {
        total: number
        completed: number
    }
    // Session state
    sessionId: string | null
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'


const SOURCE_OPTIONS = [
    {
        value: 'template',
        label: 'Select Template',
        description: 'Choose from your saved contract templates'
    },
    {
        value: 'upload',
        label: 'Upload Document',
        description: 'Upload an existing PDF, DOCX, or text file'
    }
]

const STEPS_CONFIG = [
    { id: 'source', label: 'Source', number: 1 },
    { id: 'details', label: 'Details', number: 2 },
    { id: 'content', label: 'Content', number: 3 }
]

const CLAUSE_CATEGORIES = [
    'Definitions',
    'Scope of Services',
    'Payment Terms',
    'Liability',
    'Indemnification',
    'Intellectual Property',
    'Confidentiality',
    'Term and Termination',
    'Dispute Resolution',
    'General Provisions',
    'Data Protection',
    'Insurance',
    'Warranties',
    'Force Majeure',
    'Other'
]

// ============================================================================
// SECTION 4: INITIAL STATE
// ============================================================================

const initialState: CreateState = {
    step: 'source',
    sourceType: null,
    contractType: null,
    contractName: '',
    description: '',
    referenceNumber: '',
    selectedTemplate: null,
    variableValues: {},
    documentContent: '',
    uploadedFileName: null,
    uploadedFileUrl: null,
    // Parsing state
    uploadedContractId: null,
    parsedClauses: [],
    parsingStatus: 'idle',
    parsingError: null,
    // Session state
    sessionId: null,
    contractTypeKey: null,
    creatorPartyRole: null,
    customProtectedLabel: '',
    customProvidingLabel: '',

}

// ============================================================================
// SECTION 5: LOADING FALLBACK COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN PAGE WRAPPER (with Suspense)
// ============================================================================

export default function CreateQuickContractPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <CreateQuickContractContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 7: MAIN CONTENT COMPONENT
// ============================================================================

function CreateQuickContractContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = useMemo(() => createClient(), [])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ==========================================================================
    // SECTION 8: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [state, setState] = useState<CreateState>(initialState)
    const [templates, setTemplates] = useState<QCTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [loadingTemplate, setLoadingTemplate] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Invite step state
    // (Invite state moved to Studio page)

    // Duplicate mode
    const duplicateId = searchParams.get('duplicate')

    // Template mode - coming from Contracts page "Use Template"
    const sourceTemplateId = searchParams.get('source_template_id')
    const sourceTemplateName = searchParams.get('template_name')
    const sourceContractType = searchParams.get('contract_type')

    // Review panel state
    // (Review clause selection moved to Studio page)
    const [clauseSearchTerm, setClauseSearchTerm] = useState('')

    // ==========================================================================
    // SECTION 9: DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return null
        }

        const authData = JSON.parse(auth)
        let enrichedUserInfo = { ...authData.userInfo }

        // ----------------------------------------------------------------
        // FIX: The login page stores company NAME but not company_id.
        // Look up company_id from Supabase if missing.
        // ----------------------------------------------------------------
        if (!enrichedUserInfo.companyId) {
            console.log('🟡 AUTH: companyId missing, looking up from Supabase...')
            try {
                const { data: { user: supabaseUser } } = await supabase.auth.getUser()
                if (supabaseUser) {
                    // Try auth_id first, then user_id, then email
                    let dbUser = null
                    for (const col of ['auth_id', 'user_id', 'email']) {
                        const val = col === 'email' ? supabaseUser.email : supabaseUser.id
                        const { data } = await supabase
                            .from('users')
                            .select('company_id, company_name')
                            .eq(col, val)
                            .single()
                        if (data?.company_id) { dbUser = data; break }
                    }
                    if (dbUser?.company_id) {
                        enrichedUserInfo.companyId = dbUser.company_id
                        enrichedUserInfo.company = enrichedUserInfo.company || dbUser.company_name
                        authData.userInfo = enrichedUserInfo
                        localStorage.setItem('clarence_auth', JSON.stringify(authData))
                        console.log('🟢 AUTH: Got company_id:', dbUser.company_id)
                    }
                }
            } catch (err) {
                console.warn('Could not enrich user with company_id:', err)
            }
        }

        setUserInfo(enrichedUserInfo)
        return enrichedUserInfo
    }, [router, supabase])

    const loadTemplates = useCallback(async (user?: UserInfo | null) => {
        try {
            // Load from contract_templates (same source as Contracts page)
            // Exclude system templates - only show Company and User templates
            const { data, error } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('is_active', true)
                .eq('is_system', false)
                .order('template_name')

            if (error) {
                console.error('Error loading templates:', error)
                return
            }

            const currentUser = user || userInfo

            const transformedTemplates: QCTemplate[] = (data || []).map(row => ({
                templateId: row.template_id,
                templateName: row.template_name,
                templateCategory: row.contract_type || 'other',
                description: row.description || '',
                contractType: row.contract_type || 'other',
                clauseCount: row.clause_count || 0,
                timesUsed: row.times_used || 0,
                isSystem: row.is_system || false,
                isPublic: row.is_public || false,
                companyId: row.company_id,
                createdByUserId: row.created_by_user_id,
                sourceContractId: row.source_contract_id || row.source_session_id || null,
                // Legacy compatibility
                documentContent: '',
                documentFormat: '',
                variableSchema: [],
                isSystemTemplate: row.is_system || false
            }))

            // Filter: Company templates = public + same company, My templates = private + my user
            const companyTemplates = transformedTemplates.filter(t =>
                t.isPublic && t.companyId === currentUser?.companyId
            )
            const myTemplates = transformedTemplates.filter(t =>
                !t.isPublic && t.createdByUserId === currentUser?.userId
            )

            // Combine: company first, then user's own
            setTemplates([...companyTemplates, ...myTemplates])
        } catch (err) {
            console.error('Error loading templates:', err)
        }
    }, [supabase, userInfo])

    const loadDuplicateContract = useCallback(async (contractId: string) => {
        try {
            const { data, error } = await supabase
                .from('quick_contracts')
                .select('*')
                .eq('quick_contract_id', contractId)
                .single()

            if (error || !data) {
                console.error('Error loading contract to duplicate:', error)
                return
            }

            setState(prev => ({
                ...prev,
                contractName: `${data.contract_name} (Copy)`,
                contractType: data.contract_type,
                description: data.description || '',
                referenceNumber: '',
                documentContent: data.document_content || '',
                variableValues: data.variables || {},
                step: 'details'
            }))
        } catch (err) {
            console.error('Error duplicating contract:', err)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 9B: LOAD FROM TEMPLATE (Contracts page "Use Template")
    // ==========================================================================

    const loadFromTemplate = useCallback(async (templateId: string, templateName: string | null, contractType: string | null, user: UserInfo) => {
        setLoadingTemplate(true)
        setError(null)

        try {
            console.log('=== loadFromTemplate START ===')
            console.log('Template ID:', templateId)

            // Step 1: Fetch the template metadata from contract_templates
            const { data: templateData, error: templateError } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('template_id', templateId)
                .single()

            if (templateError || !templateData) {
                console.error('Error loading template:', templateError)
                setError('Could not load template. It may have been deleted.')
                setLoadingTemplate(false)
                return
            }

            console.log('Template record columns:', Object.keys(templateData).join(', '))
            console.log('source_contract_id:', templateData.source_contract_id)
            console.log('source_session_id:', templateData.source_session_id)
            console.log('certification_status:', templateData.certification_status)

            // Step 2: Try multiple strategies to find clauses
            let sourceContractId: string | null = null
            let existingClauses: any[] = []
            let clausesFromTemplateTable = false  // Track if we loaded from template_clauses

            // Strategy A: Direct source_contract_id field
            if (templateData.source_contract_id) {
                console.log('Strategy A: Trying source_contract_id:', templateData.source_contract_id)
                const { data: clauseData, error: clauseError } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('*')
                    .eq('contract_id', templateData.source_contract_id)
                    .order('display_order', { ascending: true })

                if (!clauseError && clauseData && clauseData.length > 0) {
                    sourceContractId = templateData.source_contract_id
                    existingClauses = clauseData
                    console.log(`Strategy A SUCCESS: Found ${existingClauses.length} clauses`)
                } else {
                    console.log('Strategy A: No clauses found', clauseError)
                }
            }

            // Strategy B: source_session_id field
            if (existingClauses.length === 0 && templateData.source_session_id) {
                console.log('Strategy B: Trying source_session_id:', templateData.source_session_id)
                const { data: clauseData, error: clauseError } = await supabase
                    .from('uploaded_contract_clauses')
                    .select('*')
                    .eq('contract_id', templateData.source_session_id)
                    .order('display_order', { ascending: true })

                if (!clauseError && clauseData && clauseData.length > 0) {
                    sourceContractId = templateData.source_session_id
                    existingClauses = clauseData
                    console.log(`Strategy B SUCCESS: Found ${existingClauses.length} clauses`)
                } else {
                    console.log('Strategy B: No clauses found', clauseError)
                }
            }

            // Strategy C: Skip - uploaded_contracts does not have source_template_id column

            // Strategy D: Search uploaded_contracts by template name match
            if (existingClauses.length === 0) {
                const searchName = templateName || templateData.template_name
                console.log('Strategy D: Searching uploaded_contracts by name:', searchName)
                const { data: namedContracts, error: namedError } = await supabase
                    .from('uploaded_contracts')
                    .select('contract_id, contract_name, clause_count, status')
                    .ilike('contract_name', `%${searchName}%`)
                    .eq('status', 'ready')
                    .eq('company_id', user.companyId)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (!namedError && namedContracts && namedContracts.length > 0) {
                    sourceContractId = namedContracts[0].contract_id
                    console.log('Strategy D: Found name-matched contract:', sourceContractId, namedContracts[0].contract_name)

                    const { data: clauseData } = await supabase
                        .from('uploaded_contract_clauses')
                        .select('*')
                        .eq('contract_id', sourceContractId)
                        .order('display_order', { ascending: true })

                    if (clauseData && clauseData.length > 0) {
                        existingClauses = clauseData
                        console.log(`Strategy D SUCCESS: Found ${existingClauses.length} clauses`)
                    }
                } else {
                    console.log('Strategy D: No name-matched contracts found', namedError)
                }
            }

            // Strategy E: Query template_clauses directly (for user-created templates from "Save as Template")
            if (existingClauses.length === 0) {
                console.log('Strategy E: Querying template_clauses directly for template_id:', templateId)
                const { data: templateClauses, error: tcError } = await supabase
                    .from('template_clauses')
                    .select('*')
                    .eq('template_id', templateId)
                    .order('category_order', { ascending: true })
                    .order('clause_order', { ascending: true })

                if (!tcError && templateClauses && templateClauses.length > 0) {
                    console.log(`Strategy E SUCCESS: Found ${templateClauses.length} clauses in template_clauses`)
                    clausesFromTemplateTable = true

                    // Map template_clauses to the same format as uploaded_contract_clauses
                    existingClauses = templateClauses.map((tc, index) => ({
                        clause_id: tc.template_clause_id || crypto.randomUUID(),
                        clause_number: tc.clause_number || tc.display_number || String(index + 1),
                        clause_name: tc.clause_name || 'Untitled Clause',
                        category: tc.category || 'Other',
                        content: tc.default_text || '',
                        original_text: tc.default_text || '',
                        clause_level: tc.clause_level || 1,
                        display_order: tc.display_order || (tc.category_order * 100) + tc.clause_order,
                        parent_clause_id: tc.parent_clause_id || tc.parent_template_clause_id,
                        clarence_position: tc.clarence_position,
                        clarence_fairness: tc.clarence_fairness,
                        clarence_summary: tc.clarence_summary,
                        clarence_assessment: tc.clarence_assessment,
                        clarence_flags: tc.clarence_flags || [],
                        clarence_certified: tc.clarence_certified || false,
                        clarence_certified_at: tc.clarence_certified_at,
                        status: tc.status || (tc.clarence_certified ? 'certified' : 'pending'),
                        is_header: tc.is_header || false
                    }))
                } else {
                    console.log('Strategy E: No clauses found in template_clauses', tcError)
                }
            }

            // =====================================================
            // SUCCESS PATH: Found clauses - create contract and go to invite
            // =====================================================
            if (existingClauses.length > 0) {
                console.log(`Creating new contract from ${existingClauses.length} clauses...`)
                console.log(`Source: ${clausesFromTemplateTable ? 'template_clauses (Strategy E)' : 'uploaded_contract_clauses'}`)

                const { data: newContract, error: createError } = await supabase
                    .from('uploaded_contracts')
                    .insert({
                        company_id: user.companyId,
                        uploaded_by_user_id: user.userId,
                        contract_name: templateName || templateData.template_name,
                        file_name: `${templateName || templateData.template_name}.template`,
                        file_type: 'template',
                        file_size: 0,
                        status: 'ready',
                        clause_count: existingClauses.length
                    })
                    .select('contract_id')
                    .single()

                if (createError || !newContract) {
                    console.error('Error creating contract:', createError)
                    setError('Failed to create contract from template. Check console for details.')
                    setLoadingTemplate(false)
                    return
                }

                const newContractId = newContract.contract_id
                console.log('Created new contract:', newContractId)

                // Copy clauses to new contract - PRESERVE CLARENCE certification data!
                const clauseCopies = existingClauses.map(c => ({
                    contract_id: newContractId,
                    clause_number: c.clause_number,
                    clause_name: c.clause_name,
                    category: c.category,
                    content: c.content,
                    original_text: c.original_text || c.content,
                    clause_level: c.clause_level,
                    display_order: c.display_order,
                    is_header: c.is_header || false,
                    parent_clause_id: null,
                    // PRESERVE certification data from template (don't reset to null!)
                    status: c.clarence_certified ? 'certified' : (c.status || 'pending'),
                    clarence_certified: c.clarence_certified || false,
                    clarence_position: c.clarence_position,
                    clarence_fairness: c.clarence_fairness,
                    clarence_summary: c.clarence_summary,
                    clarence_assessment: c.clarence_assessment,
                    clarence_flags: c.clarence_flags || [],
                    clarence_certified_at: c.clarence_certified_at
                }))

                const { error: copyError } = await supabase
                    .from('uploaded_contract_clauses')
                    .insert(clauseCopies)

                if (copyError) {
                    console.error('Error copying clauses:', copyError)
                    setError('Failed to copy template clauses. Check console for details.')
                    setLoadingTemplate(false)
                    return
                }

                const certifiedCount = clauseCopies.filter(c => c.clarence_certified).length
                console.log(`Copied ${clauseCopies.length} clauses to new contract (${certifiedCount} pre-certified)`)

                // Map for display
                const parsedClauses: ParsedClause[] = existingClauses.map(c => ({
                    clauseId: c.clause_id,
                    clauseNumber: c.clause_number,
                    clauseName: c.clause_name,
                    category: c.category || 'Other',
                    clauseText: c.content || '',
                    level: c.clause_level || 1,
                    parentClauseNumber: null,
                    displayOrder: c.display_order,
                    isExpanded: false,
                    clarenceCertified: c.clarence_certified || false,
                    clarencePosition: c.clarence_position,
                    clarenceFairness: c.clarence_fairness,
                    clarenceSummary: c.clarence_summary,
                    clarenceAssessment: c.clarence_assessment,
                    clarenceFlags: c.clarence_flags || [],
                    clarenceCertifiedAt: c.clarence_certified_at
                }))

                // Update times_used
                await supabase
                    .from('contract_templates')
                    .update({
                        times_used: (templateData.times_used || 0) + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('template_id', templateId)

                // Template loaded - redirect straight to Studio
                console.log('Template loaded, redirecting to Studio:', newContractId)
                eventLogger.completed('quick_contract_create', 'template_loaded', {
                    templateId,
                    contractId: newContractId,
                    clauseCount: parsedClauses.length,
                    certifiedCount,
                    strategy: clausesFromTemplateTable ? 'template_clauses' : 'uploaded_contract_clauses'
                })

                console.log('=== loadFromTemplate COMPLETE ===')
                setLoadingTemplate(false)
                router.push(`/auth/quick-contract/studio/${newContractId}`)
                return
            }

            // =====================================================
            // FAILURE PATH: No clauses found by any strategy
            // =====================================================
            console.error('=== loadFromTemplate: No clauses found by any strategy ===')
            setError(
                'This template does not have parsed clauses yet. ' +
                'Try uploading it via the Contract Library first, or use "Upload Document" instead.'
            )
            setLoadingTemplate(false)

        } catch (err) {
            console.error('Error loading from template:', err)
            setError('Failed to load template. Please try again.')
            setLoadingTemplate(false)
        }
    }, [supabase])

    // ==========================================================================
    // SECTION 10: INITIALIZATION EFFECT
    // ==========================================================================

    useEffect(() => {
        let isMounted = true

        const init = async () => {
            try {
                setLoading(true)
                console.log('🔵 INIT: Starting...')
                console.log('🔵 INIT: sourceTemplateId =', sourceTemplateId)

                const user = await loadUserInfo()
                console.log('🔵 INIT: loadUserInfo complete, user =', user?.email)

                if (!isMounted) return

                if (user) {
                    console.log('🔵 INIT: Calling loadTemplates...')
                    await loadTemplates(user)
                    console.log('🔵 INIT: loadTemplates complete')

                    if (!isMounted) return

                    // Priority 1: Incoming template from Contracts page "Use Template"
                    if (sourceTemplateId) {
                        console.log('🔵 INIT: Calling loadFromTemplate with', sourceTemplateId)
                        await loadFromTemplate(sourceTemplateId, sourceTemplateName, sourceContractType, user)
                    }
                    // Priority 2: Duplicate an existing contract
                    else if (duplicateId) {
                        console.log('🔵 INIT: Calling loadDuplicateContract')
                        await loadDuplicateContract(duplicateId)
                    }
                } else {
                    console.log('🔵 INIT: No user found!')
                }
            } catch (err) {
                console.error('🔴 INIT ERROR:', err)
            } finally {
                if (isMounted) {
                    setLoading(false)
                    console.log('🔵 INIT: Complete, loading = false')
                }
            }
        }

        init()

        return () => {
            isMounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duplicateId, sourceTemplateId])

    // ==========================================================================

    // ==========================================================================
    // SECTION 11: NAVIGATION HANDLERS
    // ==========================================================================

    function handleSourceSelect(source: SourceType) {
        console.log('Source selected:', source)

        setState(prev => ({
            ...prev,
            sourceType: source,
            step: source === 'template' ? 'template_select' : 'details'
        }))

        // If upload selected, trigger file picker after state updates
        if (source === 'upload') {
            console.log('Upload selected, will show upload area on details step')
        }

        eventLogger.completed('quick_contract_create', 'source_selected', { source })
    }

    function handleTemplateSelect(template: QCTemplate) {
        if (!userInfo) return

        eventLogger.completed('quick_contract_create', 'template_selected', {
            templateId: template.templateId,
            templateName: template.templateName
        })

        // Use loadFromTemplate which creates a contract, copies clauses, and jumps to invite
        loadFromTemplate(
            template.templateId,
            template.templateName,
            template.contractType,
            userInfo
        )
    }

    function handleVariablesComplete() {
        // Substitute variables in content
        let content = state.selectedTemplate?.documentContent || ''
        Object.entries(state.variableValues).forEach(([key, value]) => {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`)
        })

        setState(prev => ({
            ...prev,
            documentContent: content,
            step: 'details'
        }))
    }

    function handleDetailsComplete() {
        if (!state.contractName.trim()) {
            setError('Please enter a contract name')
            return
        }
        if (!state.contractTypeKey) {
            setError('Please select a contract type')
            return
        }
        if (!state.creatorPartyRole) {
            setError('Please select your role in this contract')
            return
        }
        setError(null)
        setState(prev => ({ ...prev, step: 'content' }))
    }

    function handleBack() {
        const stepOrder: CreateStep[] = ['source', 'template_select', 'variables', 'details', 'content']
        const currentIndex = stepOrder.indexOf(state.step)

        if (currentIndex > 0) {
            let prevStep = stepOrder[currentIndex - 1]

            // Skip template_select if not using template
            if (prevStep === 'template_select' && state.sourceType !== 'template') {
                prevStep = 'source'
            }

            // Skip variables if template has no variables
            if (prevStep === 'variables' && (!state.selectedTemplate?.variableSchema.length)) {
                prevStep = 'template_select'
            }

            setState(prev => ({ ...prev, step: prevStep }))
        }
    }


    // ==========================================================================
    // SECTION 12: FILE UPLOAD HANDLER
    // ==========================================================================

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        console.log('handleFileUpload triggered')

        const file = event.target.files?.[0]
        if (!file) {
            console.log('No file selected')
            return
        }

        console.log('File selected:', file.name, file.type, file.size)
        setUploading(true)
        setError(null)

        try {
            // Validate file type
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
            const fileExtension = file.name.split('.').pop()?.toLowerCase()
            const allowedExtensions = ['pdf', 'docx', 'txt']

            if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
                throw new Error('Please upload a PDF, DOCX, or TXT file')
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('File size must be less than 10MB')
            }

            if (!userInfo?.companyId) {
                throw new Error('User not authenticated - missing company ID')
            }

            // Extract text based on file type
            console.log('Extracting text from document...')
            let extractedText = ''

            if (file.type === 'application/pdf' || fileExtension === 'pdf') {
                extractedText = await extractTextFromPDF(file)
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === 'docx') {
                extractedText = await extractTextFromDOCX(file)
            } else if (file.type === 'text/plain' || fileExtension === 'txt') {
                extractedText = await file.text()
            }

            console.log('Extracted text length:', extractedText.length)

            if (!extractedText || extractedText.length < 50) {
                throw new Error('Could not extract sufficient text from document. Please try a different file.')
            }

            // Upload original file to Supabase storage
            const fileName = `${Date.now()}-${file.name}`
            const filePath = `quick-contracts/${userInfo.companyId}/${fileName}`

            console.log('Uploading to path:', filePath)

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file)

            if (uploadError) {
                console.error('Supabase upload error:', uploadError)
                throw new Error(`Failed to upload file: ${uploadError.message}`)
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath)

            console.log('Public URL:', publicUrl)

            // Format extracted text as HTML paragraphs
            const formattedContent = extractedText
                .split('\n\n')
                .filter(para => para.trim())
                .map(para => `<p>${para.trim()}</p>`)
                .join('\n')

            setState(prev => ({
                ...prev,
                uploadedFileName: file.name,
                uploadedFileUrl: publicUrl,
                documentContent: formattedContent,
                contractName: file.name.replace(/\.[^/.]+$/, ''),
                step: 'details'
            }))

            console.log('Upload and extraction complete')

            eventLogger.completed('quick_contract_create', 'file_uploaded', {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                extractedLength: extractedText.length
            })

        } catch (err) {
            console.error('Upload error:', err)
            setError(err instanceof Error ? err.message : 'Failed to upload file')
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // ==========================================================================
    // SECTION 12A: TEXT EXTRACTION FUNCTIONS
    // ==========================================================================

    async function extractTextFromPDF(file: File): Promise<string> {
        try {
            console.log('Starting PDF extraction...')

            // Dynamic import to avoid SSR issues
            const pdfjsLib = await import('pdfjs-dist')

            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

            console.log(`PDF has ${pdf.numPages} pages`)

            let fullText = ''
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const textContent = await page.getTextContent()
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ')
                fullText += pageText + '\n\n'
                console.log(`Extracted page ${i}/${pdf.numPages}`)
            }

            console.log('PDF extraction complete, total length:', fullText.length)
            return fullText.trim()
        } catch (err) {
            console.error('PDF extraction error:', err)
            throw new Error('Failed to extract text from PDF')
        }
    }

    async function extractTextFromDOCX(file: File): Promise<string> {
        try {
            console.log('Starting DOCX extraction...')
            const arrayBuffer = await file.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer })
            console.log('DOCX extraction complete, length:', result.value.length)
            return result.value
        } catch (err) {
            console.error('DOCX extraction error:', err)
            throw new Error('Failed to extract text from DOCX')
        }
    }


    // ==========================================================================
    // SECTION 13: SUBMIT TO STUDIO HANDLER
    // ==========================================================================

    async function handleSubmitToStudio() {
        if (!userInfo || !state.documentContent) {
            setError('Missing document content')
            return
        }

        if (!userInfo.companyId) {
            setError('Missing company ID. Please log out and log back in.')
            return
        }

        setState(prev => ({
            ...prev,
            parsingStatus: 'submitting',
            parsingError: null
        }))

        try {
            console.log('Submitting document to Studio...')

            // Call parse API - this creates the uploaded_contract record and starts parsing
            const response = await fetch(`${API_BASE}/parse-contract-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userInfo.userId,
                    company_id: userInfo.companyId,
                    file_name: state.uploadedFileName || `${state.contractName}.txt`,
                    file_type: 'text/plain',
                    file_size: state.documentContent.length,
                    raw_text: state.documentContent.replace(/<[^>]*>/g, '\n'),
                    contract_type: state.contractType,
                    contract_type_key: state.contractTypeKey,
                    creator_party_role: state.creatorPartyRole,
                    custom_protected_label: state.customProtectedLabel || null,
                    custom_providing_label: state.customProvidingLabel || null,
                    mediation_type: 'stc',
                    template_source: state.uploadedFileName ? 'uploaded' : 'manual'
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Submission failed with status ${response.status}`)
            }

            const result = await response.json()
            console.log('Submit result:', result)

            if (result.success && result.contractId) {
                console.log('Redirecting to Studio:', result.contractId)
                eventLogger.completed('quick_contract_create', 'submitted_to_studio', {
                    contractId: result.contractId,
                    contractName: state.contractName
                })

                // Redirect immediately — Studio will show real-time parsing progress
                router.push(`/auth/quick-contract/studio/${result.contractId}`)
            } else {
                throw new Error(result.error || 'Submission failed')
            }

        } catch (err) {
            console.error('Submit error:', err)
            const errorMsg = err instanceof Error ? err.message : 'Failed to submit document'
            setError(errorMsg)
            setState(prev => ({
                ...prev,
                parsingStatus: 'error',
                parsingError: errorMsg
            }))
        }
    }

    // ==========================================================================
    // SECTION 14: DRAFT SAVE HANDLER
    // ==========================================================================

    async function handleSaveDraft() {
        if (!userInfo) return

        setSaving(true)
        setError(null)

        try {
            if (state.uploadedContractId) {
                // Already saved during parsing - just update name/description
                const { error: updateError } = await supabase
                    .from('uploaded_contracts')
                    .update({
                        contract_name: state.contractName,
                        contract_type: state.contractType,
                        contract_type_key: state.contractTypeKey,
                        creator_party_role: state.creatorPartyRole,
                        custom_protected_label: state.customProtectedLabel || null,
                        custom_providing_label: state.customProvidingLabel || null,
                    })
                    .eq('contract_id', state.uploadedContractId)

                if (updateError) {
                    throw new Error('Failed to update contract')
                }

                eventLogger.completed('quick_contract_create', 'draft_saved', {
                    contractId: state.uploadedContractId,
                    contractName: state.contractName
                })

                // Redirect to contracts list
                router.push('/auth/quick-contract')
            } else {
                // Save as quick_contract draft (pre-parsing)
                const { data, error } = await supabase
                    .from('quick_contracts')
                    .insert({
                        company_id: userInfo.companyId,
                        created_by_user_id: userInfo.userId,
                        contract_name: state.contractName,
                        contract_type: state.contractType,
                        contract_type_key: state.contractTypeKey,
                        creator_party_role: state.creatorPartyRole,
                        custom_protected_label: state.customProtectedLabel || null,
                        custom_providing_label: state.customProvidingLabel || null,
                        description: state.description,
                        reference_number: state.referenceNumber || null,
                        document_content: state.documentContent,
                        document_format: 'html',
                        original_file_name: state.uploadedFileName,
                        original_file_url: state.uploadedFileUrl,
                        variables: state.variableValues,
                        status: 'draft'
                    })
                    .select('quick_contract_id')
                    .single()

                if (error) {
                    throw new Error('Failed to save contract')
                }

                eventLogger.completed('quick_contract_create', 'draft_saved', {
                    contractId: data.quick_contract_id,
                    contractName: state.contractName
                })

                router.push(`/auth/quick-contract/studio/${data.quick_contract_id}`)
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save contract')
        } finally {
            setSaving(false)
        }
    }

    // ==========================================================================
    // SECTION 15: HELPER FUNCTIONS
    // ==========================================================================

    function getStepNumber(): number {
        switch (state.step) {
            case 'source':
            case 'template_select':
                return 1
            case 'variables':
            case 'details':
                return 2
            case 'content':
                return 3
            default:
                return 1
        }
    }

    function getContractTypeLabel(type: string): string {
        const ct = getContractType(type)
        if (ct) return ct.contractTypeName
        // Fallback for legacy values
        const legacyLabels: Record<string, string> = {
            nda: 'Non-Disclosure Agreement',
            service_agreement: 'Service Agreement',
            lease: 'Lease Agreement',
            employment: 'Employment Contract',
            contractor: 'Contractor Agreement',
            vendor: 'Vendor Agreement',
            other: 'Other',
        }
        return legacyLabels[type] || type
    }

    function getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            'Definitions': 'bg-slate-100 text-slate-700',
            'Scope of Services': 'bg-blue-100 text-blue-700',
            'Payment Terms': 'bg-emerald-100 text-emerald-700',
            'Liability': 'bg-red-100 text-red-700',
            'Indemnification': 'bg-orange-100 text-orange-700',
            'Intellectual Property': 'bg-purple-100 text-purple-700',
            'Confidentiality': 'bg-amber-100 text-amber-700',
            'Term and Termination': 'bg-rose-100 text-rose-700',
            'Dispute Resolution': 'bg-indigo-100 text-indigo-700',
            'General Provisions': 'bg-gray-100 text-gray-700',
            'Data Protection': 'bg-cyan-100 text-cyan-700',
            'Insurance': 'bg-teal-100 text-teal-700',
            'Warranties': 'bg-lime-100 text-lime-700',
            'Force Majeure': 'bg-yellow-100 text-yellow-700'
        }
        return colors[category] || 'bg-slate-100 text-slate-600'
    }

    // Get the party labels for the currently selected contract type
    function getSelectedPartyLabels(): { protectedLabel: string, providingLabel: string } | null {
        if (!state.contractTypeKey) return null
        const ct = getContractType(state.contractTypeKey)
        if (!ct) return null
        if (state.contractTypeKey === 'other') {
            return {
                protectedLabel: state.customProtectedLabel || 'Party A',
                providingLabel: state.customProvidingLabel || 'Party B',
            }
        }
        return {
            protectedLabel: ct.protectedPartyLabel,
            providingLabel: ct.providingPartyLabel,
        }
    }

    // Get the user's selected role label
    function getCreatorRoleLabel(): string {
        const labels = getSelectedPartyLabels()
        if (!labels || !state.creatorPartyRole) return 'Not selected'
        return state.creatorPartyRole === 'protected' ? labels.protectedLabel : labels.providingLabel
    }

    // Get the counterparty role label
    function getCounterpartyRoleLabel(): string {
        const labels = getSelectedPartyLabels()
        if (!labels || !state.creatorPartyRole) return 'Not selected'
        return state.creatorPartyRole === 'protected' ? labels.providingLabel : labels.protectedLabel
    }

    // ==========================================================================
    // SECTION 16: RENDER - LOADING STATE
    // ==========================================================================

    if (loading) {
        return <LoadingFallback />
    }

    // ==========================================================================
    // SECTION 17: RENDER - MAIN LAYOUT
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 18: HEADER */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">Quick Create</div>
                            </div>
                        </Link>

                        <div className="flex items-center gap-4">
                            <FeedbackButton position="header" />
                            <Link
                                href="/auth/quick-contract"
                                className="text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Cancel
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 19: PROGRESS BAR */}
            {/* ================================================================== */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {STEPS_CONFIG.map((stepConfig, index) => {
                            const isActive = getStepNumber() === stepConfig.number
                            const isComplete = getStepNumber() > stepConfig.number

                            return (
                                <React.Fragment key={stepConfig.id}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${isComplete ? 'bg-teal-600 text-white' :
                                            isActive ? 'bg-teal-600 text-white' :
                                                'bg-slate-200 text-slate-500'
                                            }`}>
                                            {isComplete ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                stepConfig.number
                                            )}
                                        </div>
                                        <span className={`text-sm font-medium ${isActive || isComplete ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {stepConfig.label}
                                        </span>
                                    </div>
                                    {index < STEPS_CONFIG.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-4 ${isComplete ? 'bg-teal-600' : 'bg-slate-200'}`} />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* SECTION 20: MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="max-w-4xl mx-auto px-6 py-8">

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 21: STEP - SOURCE SELECTION */}
                {/* ============================================================== */}
                {state.step === 'source' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-slate-800 mb-2">Create a Quick Contract</h1>
                            <p className="text-slate-500">How would you like to start?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {SOURCE_OPTIONS.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleSourceSelect(option.value as SourceType)}
                                    className="p-6 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-left group"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center mb-3">
                                        {option.value === 'template' ? (
                                            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-slate-800 mb-1 group-hover:text-teal-700">
                                        {option.label}
                                    </h3>
                                    <p className="text-sm text-slate-500">{option.description}</p>
                                </button>
                            ))}
                        </div>

                        {/* Hidden file input for upload */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 22: STEP - TEMPLATE SELECTION */}
                {/* ============================================================== */}
                {state.step === 'template_select' && (
                    <div className="space-y-6 relative">

                        {/* Loading overlay when template is being processed */}
                        {loadingTemplate && (
                            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-xl">
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="mt-4 text-slate-600 font-medium">Loading template...</p>
                                    <p className="text-sm text-slate-400 mt-1">Creating contract from template clauses</p>
                                </div>
                            </div>
                        )}
                        {/* Header */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Choose a Template</h2>
                                    <p className="text-slate-500 text-sm">Select a template to create your contract</p>
                                </div>
                                <button
                                    onClick={handleBack}
                                    className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Back
                                </button>
                            </div>
                        </div>

                        {/* No templates at all */}
                        {templates.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No templates available</h3>
                                    <p className="text-slate-500 text-sm mb-4">
                                        Templates are created from the Contract Library. Upload a contract there first, then it will appear here.
                                    </p>
                                    <div className="flex gap-3 justify-center">
                                        <Link
                                            href="/auth/contracts"
                                            className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                                        >
                                            Go to Contract Library
                                        </Link>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            onClick={() => setState(prev => ({ ...prev, sourceType: 'upload', step: 'details' }))}
                                            className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                                        >
                                            Upload a document instead
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Company Templates Section */}
                                {templates.filter(t => t.isPublic).length > 0 && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">Company Templates</h3>
                                                    <p className="text-xs text-slate-500">Shared templates from your organisation</p>
                                                </div>
                                                <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                                                    {templates.filter(t => t.isPublic).length}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {templates.filter(t => t.isPublic).map(template => (
                                                    <button
                                                        key={template.templateId}
                                                        onClick={() => handleTemplateSelect(template)}
                                                        className="p-5 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-left group"
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <h3 className="font-semibold text-slate-800 group-hover:text-teal-700">
                                                                {template.templateName}
                                                            </h3>
                                                        </div>
                                                        {template.description && (
                                                            <p className="text-sm text-slate-500 mb-3 line-clamp-2">{template.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                {template.clauseCount} clauses
                                                            </span>
                                                            {template.timesUsed > 0 && (
                                                                <span>Used {template.timesUsed} time{template.timesUsed !== 1 ? 's' : ''}</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* My Templates Section */}
                                {templates.filter(t => !t.isPublic).length > 0 && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">My Templates</h3>
                                                    <p className="text-xs text-slate-500">Templates you created or uploaded</p>
                                                </div>
                                                <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                                                    {templates.filter(t => !t.isPublic).length}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {templates.filter(t => !t.isPublic).map(template => (
                                                    <button
                                                        key={template.templateId}
                                                        onClick={() => handleTemplateSelect(template)}
                                                        className="p-5 rounded-xl border-2 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 transition-all text-left group"
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <h3 className="font-semibold text-slate-800 group-hover:text-teal-700">
                                                                {template.templateName}
                                                            </h3>
                                                        </div>
                                                        {template.description && (
                                                            <p className="text-sm text-slate-500 mb-3 line-clamp-2">{template.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-4 text-xs text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                {template.clauseCount} clauses
                                                            </span>
                                                            {template.timesUsed > 0 && (
                                                                <span>Used {template.timesUsed} time{template.timesUsed !== 1 ? 's' : ''}</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 23: STEP - VARIABLES (TEMPLATE FIELDS) */}
                {/* ============================================================== */}
                {state.step === 'variables' && state.selectedTemplate && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Fill in the Details</h2>
                                <p className="text-slate-500 text-sm">
                                    Complete the fields below to personalize your {state.selectedTemplate.templateName}
                                </p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        <div className="space-y-5 max-w-xl">
                            {state.selectedTemplate.variableSchema.map(field => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            value={state.variableValues[field.key] || ''}
                                            onChange={(e) => setState(prev => ({
                                                ...prev,
                                                variableValues: { ...prev.variableValues, [field.key]: e.target.value }
                                            }))}
                                            rows={4}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder={`Enter ${field.label.toLowerCase()}`}
                                        />
                                    ) : (
                                        <input
                                            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                            value={state.variableValues[field.key] || ''}
                                            onChange={(e) => setState(prev => ({
                                                ...prev,
                                                variableValues: { ...prev.variableValues, [field.key]: e.target.value }
                                            }))}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder={`Enter ${field.label.toLowerCase()}`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleVariablesComplete}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 24: STEP - CONTRACT DETAILS */}
                {/* ============================================================== */}
                {state.step === 'details' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Contract Details</h2>
                                <p className="text-slate-500 text-sm">Enter the basic information for your contract</p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        {/* Upload trigger for upload source type */}
                        {state.sourceType === 'upload' && !state.uploadedFileName && (
                            <div className="mb-6">
                                <div
                                    onClick={() => {
                                        console.log('Dropzone clicked')
                                        console.log('File input ref:', fileInputRef.current)
                                        fileInputRef.current?.click()
                                    }}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-colors"
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                            <p className="text-slate-600">Uploading...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <p className="text-slate-600 mb-1">Click to upload or drag and drop</p>
                                            <p className="text-slate-400 text-sm">PDF, DOCX, or TXT (max 10MB)</p>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </div>
                        )}

                        {/* Uploaded file indicator */}
                        {state.uploadedFileName && (
                            <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">{state.uploadedFileName}</p>
                                        <p className="text-xs text-slate-500">Uploaded successfully</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setState(prev => ({
                                            ...prev,
                                            uploadedFileName: null,
                                            uploadedFileUrl: null,
                                            documentContent: ''
                                        }))
                                        fileInputRef.current?.click()
                                    }}
                                    className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                                >
                                    Replace
                                </button>
                            </div>
                        )}

                        <div className="space-y-5 max-w-xl">
                            {/* Contract Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Contract Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={state.contractName}
                                    onChange={(e) => setState(prev => ({ ...prev, contractName: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="e.g., NDA - Acme Corporation"
                                />
                            </div>

                            {/* Contract Type - Grouped by Category */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Contract Type <span className="text-red-500">*</span>
                                </label>
                                <div className="space-y-4">
                                    {Object.entries(getContractTypesByCategory()).map(([category, types]) => {
                                        if (types.length === 0) return null
                                        return (
                                            <div key={category}>
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                                    {getCategoryDisplayName(category)}
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {types.map(ct => (
                                                        <button
                                                            key={ct.contractTypeKey}
                                                            onClick={() => setState(prev => ({
                                                                ...prev,
                                                                contractType: ct.contractTypeKey as ContractType,
                                                                contractTypeKey: ct.contractTypeKey,
                                                                // Reset role when type changes
                                                                creatorPartyRole: null,
                                                                customProtectedLabel: '',
                                                                customProvidingLabel: '',
                                                            }))}
                                                            className={`p-3 rounded-lg border-2 text-left transition-colors ${state.contractTypeKey === ct.contractTypeKey
                                                                ? 'border-teal-500 bg-teal-50'
                                                                : 'border-slate-200 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${state.contractTypeKey === ct.contractTypeKey ? 'bg-teal-500' : 'bg-slate-300'}`} />
                                                                <span className="font-medium text-sm text-slate-800">{ct.contractTypeName}</span>
                                                            </div>
                                                            {state.contractTypeKey === ct.contractTypeKey && (
                                                                <p className="text-xs text-slate-500 mt-1 ml-4">
                                                                    {ct.protectedPartyLabel} ↔ {ct.providingPartyLabel}
                                                                </p>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Other / Custom option */}
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Other
                                        </p>
                                        <button
                                            onClick={() => setState(prev => ({
                                                ...prev,
                                                contractType: 'other' as ContractType,
                                                contractTypeKey: 'other',
                                                creatorPartyRole: null,
                                                customProtectedLabel: '',
                                                customProvidingLabel: '',
                                            }))}
                                            className={`p-3 rounded-lg border-2 text-left transition-colors w-full ${state.contractTypeKey === 'other'
                                                ? 'border-teal-500 bg-teal-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${state.contractTypeKey === 'other' ? 'bg-teal-500' : 'bg-slate-300'}`} />
                                                <span className="font-medium text-sm text-slate-800">Other / Custom</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 ml-4">Define your own party labels</p>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Custom Party Labels - Only for 'Other' */}
                            {state.contractTypeKey === 'other' && (
                                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                                    <p className="text-sm font-medium text-slate-700">Define the party labels for this contract</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">
                                                Party A (Position 10 favours)
                                            </label>
                                            <input
                                                type="text"
                                                value={state.customProtectedLabel}
                                                onChange={(e) => setState(prev => ({ ...prev, customProtectedLabel: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                placeholder="e.g., Licensor"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">
                                                Party B (Position 1 favours)
                                            </label>
                                            <input
                                                type="text"
                                                value={state.customProvidingLabel}
                                                onChange={(e) => setState(prev => ({ ...prev, customProvidingLabel: e.target.value }))}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                placeholder="e.g., Licensee"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Role Selection - Appears after contract type is chosen */}
                            {state.contractTypeKey && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Your Role <span className="text-red-500">*</span>
                                    </label>
                                    <p className="text-xs text-slate-500 mb-3">
                                        Which party are you in this {getContractType(state.contractTypeKey)?.contractTypeName || 'contract'}?
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Protected Party Option */}
                                        <button
                                            onClick={() => setState(prev => ({ ...prev, creatorPartyRole: 'protected' }))}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${state.creatorPartyRole === 'protected'
                                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${state.creatorPartyRole === 'protected'
                                                    ? 'border-emerald-500'
                                                    : 'border-slate-300'
                                                    }`}>
                                                    {state.creatorPartyRole === 'protected' && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    )}
                                                </div>
                                                <span className={`font-semibold text-sm ${state.creatorPartyRole === 'protected' ? 'text-emerald-800' : 'text-slate-800'}`}>
                                                    {(() => {
                                                        if (state.contractTypeKey === 'other') {
                                                            return state.customProtectedLabel || 'Party A'
                                                        }
                                                        return getContractType(state.contractTypeKey)?.protectedPartyLabel || 'Party A'
                                                    })()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 ml-5">
                                                {(() => {
                                                    if (state.contractTypeKey === 'other') {
                                                        return 'Higher positions (7-10) favour you'
                                                    }
                                                    return getContractType(state.contractTypeKey)?.protectedPartyDescription || 'The protected party'
                                                })()}
                                            </p>
                                        </button>

                                        {/* Providing Party Option */}
                                        <button
                                            onClick={() => setState(prev => ({ ...prev, creatorPartyRole: 'providing' }))}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${state.creatorPartyRole === 'providing'
                                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${state.creatorPartyRole === 'providing'
                                                    ? 'border-blue-500'
                                                    : 'border-slate-300'
                                                    }`}>
                                                    {state.creatorPartyRole === 'providing' && (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                    )}
                                                </div>
                                                <span className={`font-semibold text-sm ${state.creatorPartyRole === 'providing' ? 'text-blue-800' : 'text-slate-800'}`}>
                                                    {(() => {
                                                        if (state.contractTypeKey === 'other') {
                                                            return state.customProvidingLabel || 'Party B'
                                                        }
                                                        return getContractType(state.contractTypeKey)?.providingPartyLabel || 'Party B'
                                                    })()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 ml-5">
                                                {(() => {
                                                    if (state.contractTypeKey === 'other') {
                                                        return 'Lower positions (1-3) favour you'
                                                    }
                                                    return getContractType(state.contractTypeKey)?.providingPartyDescription || 'The providing party'
                                                })()}
                                            </p>
                                        </button>
                                    </div>

                                    {/* Confirmation Banner */}
                                    {state.creatorPartyRole && (
                                        <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <svg className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <div>
                                                    <p className="text-sm text-teal-800">
                                                        You are the <strong>{getCreatorRoleLabel()}</strong> in this {getContractType(state.contractTypeKey!)?.contractTypeName || 'contract'}.
                                                    </p>
                                                    <p className="text-xs text-teal-600 mt-0.5">
                                                        The other party will be referred to as the <strong>{getCounterpartyRoleLabel()}</strong>.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Description <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={state.description}
                                    onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="Brief description of this contract..."
                                />
                            </div>

                            {/* Reference Number */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Reference Number <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={state.referenceNumber}
                                    onChange={(e) => setState(prev => ({ ...prev, referenceNumber: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="e.g., CONTRACT-2026-001"
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleDetailsComplete}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 25: STEP - CONTENT EDITOR */}
                {/* ============================================================== */}

                {state.step === 'content' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Contract Content</h2>
                                <p className="text-slate-500 text-sm">Review the extracted text, then parse into clauses</p>
                            </div>
                            <button
                                onClick={handleBack}
                                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        </div>

                        {/* Content Preview/Editor */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                                <span className="text-xs text-slate-500">Document content</span>
                                <span className="text-xs text-slate-400">
                                    {state.documentContent.replace(/<[^>]*>/g, '').length.toLocaleString()} characters
                                </span>
                            </div>

                            <textarea
                                value={state.documentContent.replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n')}
                                onChange={(e) => setState(prev => ({ ...prev, documentContent: e.target.value }))}
                                className="w-full h-96 p-4 text-sm focus:outline-none resize-none"
                                placeholder="Your contract content will appear here..."
                            />
                        </div>

                        {/* Info Box */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="text-sm text-blue-800 font-medium">What happens next?</p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        CLARENCE will open the Studio where you can watch your contract being analysed in real time.
                                        Each clause will be assessed, certified, and given a position range.
                                        Once complete, you can review everything before inviting the other party.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <button
                                onClick={handleSaveDraft}
                                disabled={saving}
                                className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save as Draft'}
                            </button>

                            <button
                                onClick={handleSubmitToStudio}
                                disabled={!state.documentContent.trim() || state.parsingStatus === 'submitting'}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {state.parsingStatus === 'submitting' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Submitting to Studio...
                                    </>
                                ) : (
                                    <>
                                        Open in Studio
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}


            </main>
        </div>
    )
}