'use client'

// ============================================================================
// QUICK CREATE - CREATE PAGE
// Version: 2.0
// Date: 25 February 2026
// Path: /app/auth/quick-contract/create/page.tsx
// Description: Create a new Quick Create contract from template or upload
// Changes v2.0:
//   - Removed Invite step (invite now lives in QC Studio)
//   - Removed Review Clauses panel (duplicate of Studio's 3-panel view)
//   - After parsing completes → redirect straight to Studio
//   - After template loads → redirect straight to Studio
//   - Progress bar: Source → Details → Content (upload path)
//   - Template path: Source → Template Select → redirect to Studio
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
    clauseId?: string
    clauseNumber: string
    clauseName: string
    category: string
    clauseText: string
    level: number
    parentClauseNumber: string | null
    displayOrder: number
    isExpanded?: boolean
    clarenceCertified?: boolean
    clarencePosition?: string | null
    clarenceFairness?: 'balanced' | 'slightly_customer_favoring' | 'customer_favoring' | 'heavily_customer_favoring' | 'slightly_provider_favoring' | 'provider_favoring' | 'heavily_provider_favoring' | 'review_recommended' | null
    clarenceSummary?: string | null
    clarenceAssessment?: string | null
    clarenceFlags?: string[]
    clarenceCertifiedAt?: string | null
}

type CreateStep = 'source' | 'details' | 'template_select' | 'variables' | 'content' | 'parsing'
type SourceType = 'template' | 'upload' | 'blank' | null
type ContractType = 'nda' | 'service_agreement' | 'lease' | 'employment' | 'contractor' | 'vendor' | 'other' | null
type ParsingStatus = 'idle' | 'parsing' | 'certifying' | 'complete' | 'error'

interface CreateState {
    step: CreateStep
    sourceType: SourceType
    contractType: ContractType
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

const CONTRACT_TYPE_OPTIONS = [
    { value: 'nda', label: 'Non-Disclosure Agreement', description: 'Protect confidential information' },
    { value: 'service_agreement', label: 'Service Agreement', description: 'Define service terms and deliverables' },
    { value: 'lease', label: 'Lease Agreement', description: 'Property or equipment rental terms' },
    { value: 'contractor', label: 'Contractor Agreement', description: 'Independent contractor terms' },
    { value: 'vendor', label: 'Vendor Agreement', description: 'Supplier and vendor terms' },
    { value: 'other', label: 'Other', description: 'Custom contract type' }
]

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
    sessionId: null
}

// ============================================================================
// SECTION 5: LOADING FALLBACK COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-slate-600 font-medium">Loading...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN PAGE WRAPPER (with Suspense)
// ============================================================================

export default function QuickContractCreatePage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <QuickContractCreateContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 7: MAIN CONTENT COMPONENT
// ============================================================================

function QuickContractCreateContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Memoize Supabase client to prevent re-creation on every render
    const supabase = useMemo(() => createClient(), [])

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

    // Duplicate mode
    const duplicateId = searchParams.get('duplicate')

    // Template mode - coming from Contracts page "Use Template"
    const sourceTemplateId = searchParams.get('source_template_id')
    const sourceTemplateName = searchParams.get('template_name')
    const sourceContractType = searchParams.get('contract_type')

    // ==========================================================================
    // SECTION 9: DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            console.log('🔴 QC Create: No clarence_auth in localStorage, redirecting to login')
            router.push('/login')
            return null
        }

        try {
            const parsed = JSON.parse(auth)
            console.log('🔵 QC Create loadUserInfo: localStorage parsed', {
                email: parsed.email,
                companyId: parsed.companyId || '(missing)',
                userId: parsed.userId || '(missing)',
                company: parsed.companyName || parsed.company || '(missing)'
            })

            let info: UserInfo = {
                firstName: parsed.firstName || '',
                lastName: parsed.lastName || '',
                email: parsed.email || '',
                company: parsed.companyName || parsed.company || '',
                companyId: parsed.companyId || '',
                role: parsed.role || 'user',
                userId: parsed.userId || ''
            }

            // ============================================================
            // ENRICHMENT: If companyId is missing from localStorage,
            // look it up from Supabase users table.
            // The login page stores company name but not company_id,
            // so this fallback is essential for template filtering.
            // ============================================================
            if (!info.companyId) {
                console.log('🟡 QC Create: companyId missing from localStorage, enriching from Supabase...')
                try {
                    // Strategy 1: Look up by auth_id (most reliable)
                    const { data: { user: authUser } } = await supabase.auth.getUser()

                    if (authUser) {
                        const { data: dbUser, error: dbError } = await supabase
                            .from('users')
                            .select('user_id, company_id, email, first_name, last_name')
                            .eq('auth_id', authUser.id)
                            .single()

                        if (dbUser && !dbError) {
                            console.log('🟢 QC Create: Enriched from Supabase users table (auth_id match)', {
                                companyId: dbUser.company_id,
                                userId: dbUser.user_id,
                                email: dbUser.email
                            })
                            info = {
                                ...info,
                                companyId: dbUser.company_id || '',
                                userId: dbUser.user_id || info.userId,
                                email: dbUser.email || info.email,
                                firstName: dbUser.first_name || info.firstName,
                                lastName: dbUser.last_name || info.lastName
                            }

                            // Persist enrichment back to localStorage so future loads are instant
                            try {
                                const authData = JSON.parse(localStorage.getItem('clarence_auth') || '{}')
                                authData.companyId = info.companyId
                                authData.userId = info.userId
                                localStorage.setItem('clarence_auth', JSON.stringify(authData))
                                console.log('🟢 QC Create: Persisted companyId back to localStorage')
                            } catch (persistErr) {
                                console.warn('Could not persist enrichment to localStorage:', persistErr)
                            }
                        } else {
                            console.log('🟡 QC Create: auth_id lookup returned no match, trying email fallback...')

                            // Strategy 2: Look up by email
                            if (info.email) {
                                const { data: emailUser } = await supabase
                                    .from('users')
                                    .select('user_id, company_id, first_name, last_name')
                                    .eq('email', info.email)
                                    .single()

                                if (emailUser) {
                                    console.log('🟢 QC Create: Enriched from Supabase users table (email match)', {
                                        companyId: emailUser.company_id,
                                        userId: emailUser.user_id
                                    })
                                    info = {
                                        ...info,
                                        companyId: emailUser.company_id || '',
                                        userId: emailUser.user_id || info.userId,
                                        firstName: emailUser.first_name || info.firstName,
                                        lastName: emailUser.last_name || info.lastName
                                    }

                                    // Persist back
                                    try {
                                        const authData = JSON.parse(localStorage.getItem('clarence_auth') || '{}')
                                        authData.companyId = info.companyId
                                        authData.userId = info.userId
                                        localStorage.setItem('clarence_auth', JSON.stringify(authData))
                                        console.log('🟢 QC Create: Persisted companyId back to localStorage (email fallback)')
                                    } catch (persistErr) {
                                        console.warn('Could not persist enrichment to localStorage:', persistErr)
                                    }
                                } else {
                                    console.log('🔴 QC Create: Email lookup also returned no match')
                                }
                            }
                        }
                    } else {
                        console.log('🔴 QC Create: No authenticated Supabase user found')
                    }
                } catch (enrichErr) {
                    console.warn('🟡 QC Create: Enrichment failed (non-fatal):', enrichErr)
                }
            }

            console.log('🔵 QC Create loadUserInfo FINAL:', {
                email: info.email,
                companyId: info.companyId || '(STILL MISSING)',
                userId: info.userId
            })

            setUserInfo(info)
            return info
        } catch {
            router.push('/login')
            return null
        }
    }, [router, supabase])

    const loadTemplates = useCallback(async (companyId: string, userId: string) => {
        try {
            // Load from contract_templates table
            // Broad server-side filter, then narrow client-side by ownership
            const { data, error: loadError } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('is_active', true)
                .eq('is_system', false)
                .order('template_name')

            if (loadError) {
                console.error('Error loading templates:', loadError)
                return
            }

            if (data) {
                const allTemplates: QCTemplate[] = data.map(t => ({
                    templateId: t.template_id,
                    templateName: t.template_name,
                    templateCategory: t.template_category || 'Other',
                    description: t.description || '',
                    contractType: t.contract_type || 'other',
                    clauseCount: t.clause_count || 0,
                    timesUsed: t.times_used || 0,
                    isSystem: t.is_system || false,
                    isPublic: t.is_public || false,
                    companyId: t.company_id,
                    createdByUserId: t.created_by_user_id,
                    sourceContractId: t.source_contract_id || t.source_session_id || null,
                    documentContent: '',
                    documentFormat: '',
                    variableSchema: t.variable_schema || [],
                    isSystemTemplate: t.is_system || false
                }))

                // Client-side filter by ownership:
                // Company templates = public + same company
                // My templates = private + created by this user
                const companyTemplates = allTemplates.filter(t =>
                    t.isPublic && t.companyId === companyId
                )
                const myTemplates = allTemplates.filter(t =>
                    !t.isPublic && t.createdByUserId === userId
                )

                setTemplates([...companyTemplates, ...myTemplates])
            }
        } catch (err) {
            console.error('Error loading templates:', err)
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
            let clausesFromTemplateTable = false

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
            // SUCCESS PATH: Found clauses - create contract and go to Studio
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

                // =========================================================
                // COPY RANGE MAPPINGS from source contract to new contract
                // =========================================================
                if (sourceContractId) {
                    try {
                        console.log(`[Range Copy] Copying range mappings from source: ${sourceContractId} to new: ${newContractId}`)

                        const { data: sourceRanges, error: rangeReadError } = await supabase
                            .from('clause_range_mappings')
                            .select('*')
                            .eq('contract_id', sourceContractId)

                        if (rangeReadError) {
                            console.warn('[Range Copy] Error reading source ranges:', rangeReadError)
                        } else if (sourceRanges && sourceRanges.length > 0) {
                            const { data: newClauses } = await supabase
                                .from('uploaded_contract_clauses')
                                .select('clause_id, clause_number, clause_name')
                                .eq('contract_id', newContractId)

                            const { data: sourceClauses } = await supabase
                                .from('uploaded_contract_clauses')
                                .select('clause_id, clause_number, clause_name')
                                .eq('contract_id', sourceContractId)

                            if (newClauses && sourceClauses) {
                                const sourceClauseIdToNumber = new Map<string, string>()
                                for (const sc of sourceClauses) {
                                    sourceClauseIdToNumber.set(sc.clause_id, sc.clause_number)
                                }

                                const numberToNewClauseId = new Map<string, string>()
                                for (const nc of newClauses) {
                                    numberToNewClauseId.set(nc.clause_number, nc.clause_id)
                                }

                                const rangeCopies = sourceRanges
                                    .map(rm => {
                                        const clauseNumber = sourceClauseIdToNumber.get(rm.clause_id)
                                        if (!clauseNumber) return null
                                        const newClauseId = numberToNewClauseId.get(clauseNumber)
                                        if (!newClauseId) return null

                                        const { mapping_id, ...rest } = rm
                                        return {
                                            ...rest,
                                            contract_id: newContractId,
                                            clause_id: newClauseId
                                        }
                                    })
                                    .filter(Boolean)

                                if (rangeCopies.length > 0) {
                                    const { error: rangeWriteError } = await supabase
                                        .from('clause_range_mappings')
                                        .insert(rangeCopies)

                                    if (rangeWriteError) {
                                        console.warn('[Range Copy] Error writing range mappings:', rangeWriteError)
                                    } else {
                                        console.log(`[Range Copy] Copied ${rangeCopies.length} range mappings to new contract`)
                                    }
                                } else {
                                    console.log('[Range Copy] No clause_number matches found between source and new contract')
                                }
                            }
                        } else {
                            console.log('[Range Copy] No range mappings found on source contract')
                        }
                    } catch (rangeErr) {
                        console.warn('[Range Copy] Failed to copy range mappings:', rangeErr)
                    }
                } else if (clausesFromTemplateTable) {
                    console.log('[Range Copy] Skipped: clauses from template_clauses (no source contract_id)')
                }

                // Update times_used
                await supabase
                    .from('contract_templates')
                    .update({
                        times_used: (templateData.times_used || 0) + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('template_id', templateId)

                eventLogger.completed('quick_contract_create', 'template_loaded', {
                    templateId,
                    contractId: newContractId,
                    clauseCount: existingClauses.length,
                    certifiedCount,
                    strategy: clausesFromTemplateTable ? 'template_clauses' : 'uploaded_contract_clauses'
                })

                console.log('=== loadFromTemplate COMPLETE - Redirecting to Studio ===')
                setLoadingTemplate(false)

                // REDIRECT TO STUDIO instead of showing invite step
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
    }, [supabase, router])

    // ==========================================================================
    // SECTION 10: INITIALIZATION EFFECT
    // ==========================================================================

    useEffect(() => {
        let mounted = true

        async function init() {
            const user = await loadUserInfo()
            if (!user || !mounted) return

            await loadTemplates(user.companyId, user.userId)

            // Auto-load template if source_template_id is in URL
            if (sourceTemplateId) {
                console.log('Auto-loading template from URL params:', sourceTemplateId)
                loadFromTemplate(
                    sourceTemplateId,
                    sourceTemplateName,
                    sourceContractType,
                    user
                )
            }

            // Load duplicate if specified
            if (duplicateId) {
                try {
                    const { data: dupContract } = await supabase
                        .from('uploaded_contracts')
                        .select('contract_name, contract_type')
                        .eq('contract_id', duplicateId)
                        .single()

                    if (dupContract && mounted) {
                        setState(prev => ({
                            ...prev,
                            contractName: `Copy of ${dupContract.contract_name}`,
                            contractType: dupContract.contract_type as ContractType,
                            step: 'details'
                        }))
                    }
                } catch (err) {
                    console.error('Error loading duplicate:', err)
                }
            }

            if (mounted) {
                setLoading(false)
            }
        }

        init()

        return () => {
            mounted = false
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

        loadFromTemplate(
            template.templateId,
            template.templateName,
            template.contractType,
            userInfo
        )
    }

    function handleVariablesComplete() {
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

        setError(null)
        setState(prev => ({ ...prev, step: 'content' }))
    }

    function handleBack() {
        const stepOrder: CreateStep[] = ['source', 'template_select', 'variables', 'details', 'content', 'parsing']
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

            // Reset parsing state when going back from parsing
            if (state.step === 'parsing') {
                setState(prev => ({
                    ...prev,
                    step: prevStep,
                    parsingStatus: 'idle',
                    parsingError: null
                }))
                return
            }

            setState(prev => ({ ...prev, step: prevStep }))
        }
    }

    // ==========================================================================
    // SECTION 12: FILE UPLOAD HANDLER
    // ==========================================================================

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file || !userInfo) return

        setUploading(true)
        setError(null)

        try {
            const fileName = file.name
            const fileType = file.type || 'application/octet-stream'
            const fileSize = file.size

            console.log('Uploading file:', fileName, fileType, fileSize)

            // Extract text based on file type
            let extractedText = ''

            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                extractedText = await extractTextFromPDF(file)
            } else if (
                fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                fileName.endsWith('.docx')
            ) {
                extractedText = await extractTextFromDocx(file)
            } else {
                extractedText = await file.text()
            }

            if (!extractedText.trim()) {
                throw new Error('Could not extract text from the document. The file may be empty, scanned, or in an unsupported format.')
            }

            console.log('Extracted text length:', extractedText.length)

            // Auto-fill contract name from filename if empty
            const baseName = fileName.replace(/\.[^/.]+$/, '')

            setState(prev => ({
                ...prev,
                uploadedFileName: fileName,
                documentContent: extractedText,
                contractName: prev.contractName || baseName
            }))

            eventLogger.completed('quick_contract_create', 'file_uploaded', {
                fileName,
                fileType,
                fileSize,
                textLength: extractedText.length
            })

        } catch (err) {
            console.error('File upload error:', err)
            setError(err instanceof Error ? err.message : 'Failed to upload file')
        } finally {
            setUploading(false)
            // Reset file input so same file can be re-selected
            if (event.target) event.target.value = ''
        }
    }

    // ==========================================================================
    // SECTION 12A: TEXT EXTRACTION FUNCTIONS
    // ==========================================================================

    async function extractTextFromPDF(file: File): Promise<string> {
        // Dynamic import to avoid SSR issues
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'

        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ')
            fullText += pageText + '\n\n'
        }

        return fullText.trim()
    }

    async function extractTextFromDocx(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        return result.value
    }

    // ==========================================================================
    // SECTION 13: PARSING HANDLERS
    // ==========================================================================

    async function handleStartParsing() {
        if (!userInfo || !state.documentContent) {
            setError('Missing document content')
            return
        }

        setState(prev => ({
            ...prev,
            step: 'parsing',
            parsingStatus: 'parsing',
            parsingError: null
        }))

        try {
            console.log('Starting document parsing...')

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
                    mediation_type: 'stc',
                    template_source: state.uploadedFileName ? 'uploaded' : 'manual'
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Parsing failed with status ${response.status}`)
            }

            const result = await response.json()
            console.log('Parsing result:', result)

            if (result.success && result.contractId) {
                // Start polling for parsing completion
                await pollForParsingComplete(result.contractId)
            } else {
                throw new Error(result.error || 'Parsing failed')
            }

        } catch (err) {
            console.error('Parsing error:', err)
            setState(prev => ({
                ...prev,
                parsingStatus: 'error',
                parsingError: err instanceof Error ? err.message : 'Failed to parse document'
            }))
        }
    }

    async function pollForParsingComplete(contractId: string) {
        const maxAttempts = 60
        let attempts = 0
        const startTime = Date.now()

        const poll = async () => {
            attempts++
            const elapsed = Math.round((Date.now() - startTime) / 1000)
            console.log(`Polling attempt ${attempts}/${maxAttempts}... (${elapsed}s elapsed)`)

            try {
                const { data: contractData, error: contractError } = await supabase
                    .from('uploaded_contracts')
                    .select('status, clause_count')
                    .eq('contract_id', contractId)
                    .single()

                if (contractError) {
                    throw new Error('Failed to check parsing status')
                }

                console.log('Contract status:', contractData.status)

                if (contractData.status === 'ready') {
                    console.log(`Parsing complete! Contract ${contractId} is ready with ${contractData.clause_count} clauses`)

                    // Update state briefly (for any cleanup logic)
                    setState(prev => ({
                        ...prev,
                        uploadedContractId: contractId,
                        parsingStatus: 'complete'
                    }))

                    eventLogger.completed('quick_contract_create', 'parsing_complete', {
                        contractId,
                        clauseCount: contractData.clause_count
                    })

                    // REDIRECT TO STUDIO - no more review panel here
                    console.log('Redirecting to Studio:', contractId)
                    router.push(`/auth/quick-contract/studio/${contractId}`)
                    return
                }

                if (contractData.status === 'failed') {
                    throw new Error('Document parsing failed. Please try again.')
                }

                // Still processing, continue polling
                if (attempts < maxAttempts) {
                    setTimeout(poll, 3000)
                } else {
                    throw new Error(
                        'Parsing is taking longer than expected. The document may still be processing in the background. ' +
                        'Try clicking "Try Again" in a moment, or go back and re-upload.'
                    )
                }

            } catch (err) {
                console.error('Polling error:', err)
                setState(prev => ({
                    ...prev,
                    parsingStatus: 'error',
                    parsingError: err instanceof Error ? err.message : 'Failed to check parsing status'
                }))
            }
        }

        poll()
    }

    function handleRetryParsing() {
        setState(prev => ({
            ...prev,
            step: 'content',
            parsingStatus: 'idle',
            parsingError: null,
            parsedClauses: []
        }))
    }

    // ==========================================================================
    // SECTION 14: SAVE DRAFT HANDLER
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
                        contract_type: state.contractType
                    })
                    .eq('contract_id', state.uploadedContractId)

                if (updateError) {
                    throw new Error('Failed to update contract')
                }

                eventLogger.completed('quick_contract_create', 'draft_saved', {
                    contractId: state.uploadedContractId,
                    contractName: state.contractName
                })

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
            case 'parsing':
                return 3
            default:
                return 1
        }
    }

    function getContractTypeLabel(type: ContractType): string {
        const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type)
        return option?.label || 'Other'
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
                            <h1 className="text-2xl font-bold text-slate-800 mb-2">Create Quick Contract</h1>
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
                                                    <p className="text-xs text-slate-500">Shared across your organization</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                )}

                                {/* Personal/Private Templates Section */}
                                {templates.filter(t => !t.isPublic && !t.isSystem).length > 0 && (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">My Templates</h3>
                                                    <p className="text-xs text-slate-500">Your personal templates</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {templates.filter(t => !t.isPublic && !t.isSystem).map(template => (
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

                            {/* Contract Type */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Contract Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CONTRACT_TYPE_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => setState(prev => ({ ...prev, contractType: option.value as ContractType }))}
                                            className={`p-3 rounded-lg border-2 text-left transition-colors ${state.contractType === option.value
                                                ? 'border-teal-500 bg-teal-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${state.contractType === option.value ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                                                <span className="font-medium text-sm text-slate-800">{option.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

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
                                        CLARENCE will analyze this document and extract individual clauses.
                                        Once complete, you&apos;ll be taken directly to the Studio where you can
                                        review clauses, invite the other party, and begin negotiation.
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
                                onClick={handleStartParsing}
                                disabled={!state.documentContent.trim()}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                Parse &amp; Open Studio
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 26: STEP - PARSING (Spinner & Error only) */}
                {/* After parsing completes, user is redirected to Studio */}
                {/* ============================================================== */}
                {state.step === 'parsing' && (
                    <>
                        {/* Parsing In Progress */}
                        {(state.parsingStatus === 'parsing' || state.parsingStatus === 'complete') && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">
                                        {state.parsingStatus === 'complete' ? 'Opening Studio...' : 'Analyzing Your Contract'}
                                    </h2>
                                    <p className="text-slate-500 mb-2">
                                        {state.parsingStatus === 'complete'
                                            ? 'Parsing complete! Redirecting to the Studio now...'
                                            : 'CLARENCE is identifying and extracting clauses...'
                                        }
                                    </p>
                                    {state.parsingStatus === 'parsing' && (
                                        <p className="text-sm text-slate-400 mb-4">Larger documents may take 2-3 minutes</p>
                                    )}
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-slate-500">
                                            {state.parsingStatus === 'complete' ? 'Redirecting...' : 'Processing in progress'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Parsing Error */}
                        {state.parsingStatus === 'error' && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">Processing Failed</h2>
                                    <p className="text-slate-500 mb-6">{state.parsingError || 'Something went wrong.'}</p>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={handleRetryParsing}
                                            className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors"
                                        >
                                            Go Back &amp; Edit
                                        </button>
                                        <button
                                            onClick={handleStartParsing}
                                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

            </main>
        </div>
    )
}