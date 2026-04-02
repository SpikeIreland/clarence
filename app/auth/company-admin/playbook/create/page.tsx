'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ContractTypeSelector, getContractType } from '@/app/components/create-phase/YourRoleStep'
import {
    normaliseCategory,
    getCategoryDisplayName,
    getEffectiveRangeContext,
    translateRulePosition,
} from '@/lib/playbook-compliance'
import {
    DraftRule,
    DEFAULT_RULE_TEMPLATES,
    CATEGORY_DESCRIPTIONS,
    generateDefaultRules,
} from '@/lib/playbook-defaults'

// ============================================================================
// CONSTANTS
// ============================================================================

const N8N_API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const ALL_CATEGORIES = Object.keys(DEFAULT_RULE_TEMPLATES)
const DEFAULT_SELECTED = ['liability', 'payment', 'termination', 'confidentiality', 'data_protection']

type WizardStep = 'welcome' | 'setup' | 'upload' | 'categories' | 'rules' | 'review'

interface WizardState {
    step: WizardStep
    sourcePath: 'upload' | 'scratch' | null
    playbookName: string
    perspective: 'customer' | 'provider'
    contractTypeKey: string
    uploadedFile: File | null
    uploadStatus: 'idle' | 'extracting' | 'parsing' | 'complete' | 'error'
    uploadError: string | null
    createdPlaybookId: string | null
    selectedCategories: string[]
    rules: DraftRule[]
    creating: boolean
    nameError: string | null
    checkingName: boolean
}

const initialState: WizardState = {
    step: 'welcome',
    sourcePath: null,
    playbookName: '',
    perspective: 'customer',
    contractTypeKey: '',
    uploadedFile: null,
    uploadStatus: 'idle',
    uploadError: null,
    createdPlaybookId: null,
    selectedCategories: [...DEFAULT_SELECTED],
    rules: [],
    creating: false,
    nameError: null,
    checkingName: false,
}

// ============================================================================
// LOADING
// ============================================================================

function PlaybookIQLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading PlaybookIQ...</p>
            </div>
        </div>
    )
}

// ============================================================================
// CLARENCE GUIDANCE BLOCK
// ============================================================================

function ClarenceGuide({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">C</span>
            </div>
            <p className="text-sm text-indigo-900 leading-relaxed">{text}</p>
        </div>
    )
}

// ============================================================================
// PROGRESS BAR
// ============================================================================

function ProgressBar({ steps, currentStep }: {
    steps: { id: string; label: string }[]
    currentStep: string
}) {
    const currentIndex = steps.findIndex(s => s.id === currentStep)

    return (
        <div className="flex items-center gap-1">
            {steps.map((step, i) => {
                const isComplete = i < currentIndex
                const isActive = step.id === currentStep
                return (
                    <React.Fragment key={step.id}>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                                isComplete ? 'bg-emerald-500 text-white' :
                                    isActive ? 'bg-indigo-600 text-white' :
                                        'bg-slate-200 text-slate-400'
                            }`}>
                                {isComplete ? (
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : i + 1}
                            </div>
                            <span className={`text-[11px] font-medium ${isActive ? 'text-indigo-700' : isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {step.label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-8 h-0.5 rounded ${i < currentIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    )
}

// ============================================================================
// SIMPLE POSITION BAR (read-only for wizard)
// ============================================================================

function SimplePositionBar({ rule }: { rule: DraftRule }) {
    const toPercent = (val: number) => ((val - 1) / 9) * 100

    return (
        <div className="relative h-6 mt-1">
            <div className="absolute top-2 left-0 right-0 h-2 bg-slate-100 rounded-full" />
            <div className="absolute top-2 h-2 bg-blue-100 rounded-full border border-blue-200"
                style={{
                    left: `${toPercent(rule.minimum_position)}%`,
                    width: `${toPercent(rule.maximum_position) - toPercent(rule.minimum_position)}%`,
                }} />
            <div className="absolute top-1.5 w-3 h-3 rounded-full bg-purple-600 border-2 border-white shadow-sm z-10"
                style={{ left: `${toPercent(rule.ideal_position)}%`, transform: 'translateX(-50%)' }} />
            <div className="absolute top-2 w-1.5 h-2 rounded-full bg-slate-400"
                style={{ left: `${toPercent(rule.fallback_position)}%`, transform: 'translateX(-50%)' }} />
        </div>
    )
}

// ============================================================================
// MAIN WIZARD CONTENT
// ============================================================================

function CreatePlaybookContent() {
    const router = useRouter()
    const [state, setState] = useState<WizardState>(initialState)
    const [loading, setLoading] = useState(true)
    const [userInfo, setUserInfo] = useState<{ userId: string; email: string; companyId: string } | null>(null)
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

    // Auth check
    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) { router.push('/auth/login'); return }

            let companyId = user.user_metadata?.company_id
            if (!companyId) {
                const { data } = await supabase.from('company_users').select('company_id').eq('email', user.email).eq('status', 'active').single()
                companyId = data?.company_id
            }
            const isHardcoded = ['paul.lyons67@icloud.com'].includes((user.email || '').toLowerCase())
            if (!isHardcoded && companyId) {
                const { data } = await supabase.from('company_users').select('role').eq('email', user.email).eq('company_id', companyId).eq('status', 'active').single()
                if (data?.role !== 'admin') { router.push('/auth/contracts-dashboard'); return }
            } else if (!isHardcoded) { router.push('/auth/contracts-dashboard'); return }

            if (!companyId) {
                const { data } = await supabase.from('companies').select('company_id').limit(1).single()
                companyId = data?.company_id
            }

            setUserInfo({ userId: user.id, email: user.email || '', companyId })
            setLoading(false)
        }
        init()
    }, [router])

    const update = useCallback((changes: Partial<WizardState>) => {
        setState(prev => ({ ...prev, ...changes }))
    }, [])

    const advanceFromSetup = async () => {
        if (!userInfo || !state.playbookName.trim()) return
        update({ checkingName: true, nameError: null })
        const supabase = createClient()
        const { data } = await supabase
            .from('company_playbooks')
            .select('playbook_id')
            .eq('company_id', userInfo.companyId)
            .ilike('playbook_name', state.playbookName.trim())
            .limit(1)
            .single()
        if (data) {
            update({ checkingName: false, nameError: 'A playbook with this name already exists. Please choose a unique name.' })
            return
        }
        update({ checkingName: false, step: state.sourcePath === 'upload' ? 'upload' : 'categories' })
    }

    // Step config based on path
    const getSteps = () => {
        if (state.sourcePath === 'upload') {
            return [
                { id: 'welcome', label: 'Source' },
                { id: 'setup', label: 'Setup' },
                { id: 'upload', label: 'Upload' },
            ]
        }
        return [
            { id: 'welcome', label: 'Source' },
            { id: 'setup', label: 'Setup' },
            { id: 'categories', label: 'Categories' },
            { id: 'rules', label: 'Rules' },
            { id: 'review', label: 'Review' },
        ]
    }

    // ── Upload path: extract text from file ──
    const extractAndParse = async (file: File) => {
        if (!userInfo) return
        update({ uploadStatus: 'extracting', uploadError: null })

        try {
            // Extract text client-side
            const extractedText = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = async (event) => {
                    try {
                        if (file.type === 'text/plain') {
                            resolve(event.target?.result as string)
                        } else if (file.type === 'application/pdf') {
                            const pdfjsLib = await import('pdfjs-dist')
                            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
                            const arrayBuffer = event.target?.result as ArrayBuffer
                            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
                            let fullText = ''
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i)
                                const content = await page.getTextContent()
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                fullText += content.items.map((item: any) => item.str).join(' ') + '\n'
                            }
                            resolve(fullText)
                        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                            const mammoth = await import('mammoth')
                            const arrayBuffer = event.target?.result as ArrayBuffer
                            const result = await mammoth.extractRawText({ arrayBuffer })
                            resolve(result.value)
                        } else {
                            reject(new Error('Unsupported file type'))
                        }
                    } catch (err) { reject(err) }
                }
                reader.onerror = () => reject(new Error('Failed to read file'))
                if (file.type === 'text/plain') reader.readAsText(file)
                else reader.readAsArrayBuffer(file)
            })

            if (!extractedText || extractedText.length < 100) {
                update({ uploadStatus: 'error', uploadError: 'Could not extract sufficient text from the document' })
                return
            }

            // Create playbook record
            const pbRes = await fetch('/api/playbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: userInfo.companyId,
                    playbook_name: state.playbookName || file.name.replace(/\.[^/.]+$/, ''),
                    contract_type_key: state.contractTypeKey || null,
                    playbook_perspective: state.perspective,
                    status: 'pending_parse',
                    created_by_user_id: userInfo.userId,
                }),
            })
            if (!pbRes.ok) {
                const errText = await pbRes.text().catch(() => 'Unknown error')
                update({ uploadStatus: 'error', uploadError: `Failed to create playbook (${pbRes.status}): ${errText}` })
                return
            }
            const pbData = await pbRes.json()
            if (!pbData.success) {
                update({ uploadStatus: 'error', uploadError: pbData.error || 'Failed to create playbook' })
                return
            }
            const playbookId = pbData.playbook.playbook_id
            update({ createdPlaybookId: playbookId, uploadStatus: 'parsing' })

            // Send to server-side proxy for n8n parsing (contract single-pass workflow)
            const n8nRes = await fetch('/api/playbooks/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playbook_id: playbookId,
                    extracted_text: extractedText,
                    workflow: 'contract',
                }),
            })
            if (!n8nRes.ok) {
                console.error('Parse proxy error:', n8nRes.status, await n8nRes.text().catch(() => ''))
                update({ uploadStatus: 'error', uploadError: 'Failed to start playbook analysis. Please try again.' })
                return
            }

            // Poll for completion
            const supabase = createClient()
            const pollInterval = setInterval(async () => {
                const { data } = await supabase
                    .from('company_playbooks')
                    .select('status')
                    .eq('playbook_id', playbookId)
                    .single()

                if (data?.status === 'parsed' || data?.status === 'active' || data?.status === 'review_required') {
                    clearInterval(pollInterval)
                    update({ uploadStatus: 'complete' })
                    router.push(`/auth/company-admin/playbook/${playbookId}`)
                } else if (data?.status === 'parse_failed') {
                    clearInterval(pollInterval)
                    update({ uploadStatus: 'error', uploadError: 'Parsing failed. Please try again.' })
                }
            }, 10000)

            // Timeout after 10 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                if (state.uploadStatus === 'parsing') {
                    update({ uploadStatus: 'complete' })
                    router.push(`/auth/company-admin/playbook/${playbookId}`)
                }
            }, 600000)
        } catch (err) {
            console.error('Upload error:', err)
            update({ uploadStatus: 'error', uploadError: 'Failed to process document' })
        }
    }

    // ── From-scratch: create playbook with rules ──
    const createPlaybook = async () => {
        if (!userInfo || state.rules.length === 0) return
        update({ creating: true })

        try {
            // Create playbook
            const pbRes = await fetch('/api/playbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: userInfo.companyId,
                    playbook_name: state.playbookName,
                    contract_type_key: state.contractTypeKey || null,
                    playbook_perspective: state.perspective,
                    status: 'active',
                    created_by_user_id: userInfo.userId,
                }),
            })
            const pbData = await pbRes.json()
            if (!pbData.success) throw new Error(pbData.error)
            const playbookId = pbData.playbook.playbook_id

            // Bulk insert rules
            const rulesPayload = state.rules.map(r => ({
                clause_name: r.clause_name,
                clause_code: r.clause_code,
                category: r.category,
                ideal_position: r.ideal_position,
                minimum_position: r.minimum_position,
                maximum_position: r.maximum_position,
                fallback_position: r.fallback_position,
                is_deal_breaker: r.is_deal_breaker,
                is_non_negotiable: r.is_non_negotiable,
                requires_approval_below: r.requires_approval_below,
                importance_level: r.importance_level,
                rationale: r.rationale,
                negotiation_tips: r.negotiation_tips,
                range_context: r.range_context,
                display_order: r.display_order,
            }))

            const rulesRes = await fetch(`/api/playbooks/${playbookId}/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: rulesPayload }),
            })
            const rulesData = await rulesRes.json()
            if (!rulesData.success) throw new Error(rulesData.error)

            router.push(`/auth/company-admin/playbook/${playbookId}`)
        } catch (err) {
            console.error('Create error:', err)
            update({ creating: false })
        }
    }

    // ── Rule editing helpers ──
    const updateRule = (tempId: string, changes: Partial<DraftRule>) => {
        setState(prev => ({
            ...prev,
            rules: prev.rules.map(r => r.tempId === tempId ? { ...r, ...changes } : r),
        }))
    }

    const updateRulePosition = (tempId: string, field: string, value: number) => {
        setState(prev => ({
            ...prev,
            rules: prev.rules.map(r => {
                if (r.tempId !== tempId) return r
                const updated = { ...r, [field]: value }
                // Auto-adjust to maintain ordering
                if (field === 'minimum_position') {
                    if (value > updated.fallback_position) updated.fallback_position = value
                    if (value > updated.ideal_position) updated.ideal_position = value
                    if (value > updated.maximum_position) updated.maximum_position = value
                } else if (field === 'fallback_position') {
                    if (value < updated.minimum_position) updated.minimum_position = value
                    if (value > updated.ideal_position) updated.ideal_position = value
                    if (value > updated.maximum_position) updated.maximum_position = value
                } else if (field === 'ideal_position') {
                    if (value < updated.minimum_position) updated.minimum_position = value
                    if (value < updated.fallback_position) updated.fallback_position = value
                    if (value > updated.maximum_position) updated.maximum_position = value
                } else if (field === 'maximum_position') {
                    if (value < updated.minimum_position) updated.minimum_position = value
                    if (value < updated.fallback_position) updated.fallback_position = value
                    if (value < updated.ideal_position) updated.ideal_position = value
                }
                return updated
            }),
        }))
    }

    const deleteRule = (tempId: string) => {
        setState(prev => ({ ...prev, rules: prev.rules.filter(r => r.tempId !== tempId) }))
    }

    const addRule = (category: string) => {
        const catRules = state.rules.filter(r => r.category === category)
        const code = `${category.substring(0, 3).toUpperCase()}-${String(catRules.length + 1).padStart(3, '0')}`
        const newRule: DraftRule = {
            tempId: crypto.randomUUID(),
            clause_name: '',
            clause_code: code,
            category,
            ideal_position: 5,
            minimum_position: 3,
            maximum_position: 8,
            fallback_position: 4,
            is_deal_breaker: false,
            is_non_negotiable: false,
            requires_approval_below: null,
            importance_level: 5,
            rationale: null,
            negotiation_tips: null,
            range_context: null,
            display_order: state.rules.length + 1,
        }
        setState(prev => ({ ...prev, rules: [...prev.rules, newRule] }))
    }

    const toggleCategory = (key: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    if (loading) return <PlaybookIQLoading />

    const steps = getSteps()

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/auth/company-admin?tab=playbooks')} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-bold text-slate-800">PlaybookIQ</h1>
                                    <span className="text-lg text-slate-300">|</span>
                                    <span className="text-lg font-medium text-slate-600">Create Playbook</span>
                                </div>
                            </div>
                        </div>
                        <ProgressBar steps={steps} currentStep={state.step} />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* ── STEP 1: WELCOME ── */}
                {state.step === 'welcome' && (
                    <>
                        <ClarenceGuide text="Let's build your playbook. A playbook captures your company's negotiation positions so Clarence can check every contract against your standards. Do you have an existing playbook document, or shall we build one from scratch?" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => update({ step: 'setup', sourcePath: 'upload' })}
                                className="p-6 bg-white rounded-xl border-2 border-slate-200 hover:border-indigo-400 transition-all text-left group"
                            >
                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                                    <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-800 mb-1">I have a document</h3>
                                <p className="text-xs text-slate-500">Upload an existing contract (PDF or Word) and Clarence will extract your negotiation rules automatically.</p>
                            </button>
                            <button
                                onClick={() => update({ step: 'setup', sourcePath: 'scratch' })}
                                className="p-6 bg-white rounded-xl border-2 border-slate-200 hover:border-indigo-400 transition-all text-left group"
                            >
                                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-800 mb-1">Start from scratch</h3>
                                <p className="text-xs text-slate-500">Build your playbook step-by-step with industry-standard rules as a starting point.</p>
                            </button>
                        </div>
                    </>
                )}

                {/* ── STEP 2: SETUP ── */}
                {state.step === 'setup' && (
                    <>
                        <ClarenceGuide text="Great. Let's set the foundations. First, select the contract type, then tell me which side of the table you're on, and finally give your playbook a name." />

                        {/* Contract Type */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Contract Type</label>
                            <p className="text-xs text-slate-500 mb-3">What type of contract is this playbook for? Leave blank for a general playbook.</p>
                            <ContractTypeSelector
                                selectedKey={state.contractTypeKey}
                                onSelect={(key) => update({ contractTypeKey: key })}
                            />
                        </div>

                        {/* Perspective */}
                        {(() => {
                            const selectedType = getContractType(state.contractTypeKey)
                            const protectedLabel = selectedType?.protectedPartyLabel || 'Customer / Buyer'
                            const providingLabel = selectedType?.providingPartyLabel || 'Provider / Supplier'
                            return (
                                <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">Your Perspective</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => update({ perspective: 'customer' })}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                                                state.perspective === 'customer'
                                                    ? 'border-emerald-400 bg-emerald-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="text-lg mb-1">🛡️</div>
                                            <div className="text-sm font-semibold text-slate-800">{protectedLabel}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">Higher positions = more {protectedLabel.toLowerCase()} protection</div>
                                        </button>
                                        <button
                                            onClick={() => update({ perspective: 'provider' })}
                                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                                                state.perspective === 'provider'
                                                    ? 'border-blue-400 bg-blue-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="text-lg mb-1">🏢</div>
                                            <div className="text-sm font-semibold text-slate-800">{providingLabel}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">Higher positions = more {providingLabel.toLowerCase()} protection</div>
                                        </button>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Playbook Name */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Playbook Name</label>
                            <input
                                type="text"
                                value={state.playbookName}
                                onChange={e => update({ playbookName: e.target.value, nameError: null })}
                                placeholder="e.g. IT Services Negotiation Playbook"
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none ${state.nameError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                            />
                            {state.nameError && (
                                <p className="mt-1.5 text-xs text-red-600">{state.nameError}</p>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-6">
                            <button onClick={() => update({ step: 'welcome' })} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                Back
                            </button>
                            <button
                                onClick={advanceFromSetup}
                                disabled={!state.playbookName.trim() || state.checkingName}
                                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {state.checkingName ? 'Checking…' : 'Next'}
                            </button>
                        </div>
                    </>
                )}

                {/* ── STEP 3A: UPLOAD ── */}
                {state.step === 'upload' && (
                    <>
                        <ClarenceGuide text="Upload an existing contract and I'll extract the negotiation rules from it to build your playbook. I can handle PDF and Word documents." />

                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            {state.uploadStatus === 'idle' && (
                                <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all">
                                    <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <span className="text-sm font-medium text-slate-600 mb-1">Drop your file here or click to browse</span>
                                    <span className="text-xs text-slate-400">PDF or Word, up to 10MB</span>
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            if (file.size > 10 * 1024 * 1024) {
                                                update({ uploadError: 'File is too large (max 10MB)' })
                                                return
                                            }
                                            update({ uploadedFile: file })
                                            extractAndParse(file)
                                        }}
                                    />
                                </label>
                            )}

                            {(state.uploadStatus === 'extracting' || state.uploadStatus === 'parsing') && (
                                <div className="flex flex-col items-center py-12">
                                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="text-sm font-medium text-slate-700 mb-1">
                                        {state.uploadStatus === 'extracting' ? 'Extracting text from document...' : 'AI is extracting negotiation rules from your contract...'}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {state.uploadStatus === 'parsing' && 'This usually takes 1-3 minutes'}
                                    </p>
                                </div>
                            )}

                            {state.uploadStatus === 'error' && (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-red-600 mb-3">{state.uploadError}</p>
                                    <button
                                        onClick={() => update({ uploadStatus: 'idle', uploadError: null, uploadedFile: null })}
                                        className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-6">
                            <button onClick={() => update({ step: 'setup', uploadStatus: 'idle', uploadError: null })} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                Back
                            </button>
                        </div>
                    </>
                )}

                {/* ── STEP 3B: CATEGORIES ── */}
                {state.step === 'categories' && (
                    <>
                        <ClarenceGuide text="Select the clause categories you want in your playbook. I've pre-selected the most common ones, but you can add or remove any." />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ALL_CATEGORIES.map(cat => {
                                const isSelected = state.selectedCategories.includes(cat)
                                const ruleCount = (DEFAULT_RULE_TEMPLATES[cat] || []).length
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            update({
                                                selectedCategories: isSelected
                                                    ? state.selectedCategories.filter(c => c !== cat)
                                                    : [...state.selectedCategories, cat],
                                            })
                                        }}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                                            isSelected
                                                ? 'border-indigo-400 bg-indigo-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-800">
                                                    {getCategoryDisplayName(cat)}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {CATEGORY_DESCRIPTIONS[cat] || ''}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    {ruleCount} default rule{ruleCount !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                                                isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                                            }`}>
                                                {isSelected && (
                                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-between mt-6">
                            <button onClick={() => update({ step: 'setup' })} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                Back
                            </button>
                            <button
                                onClick={() => {
                                    const rules = generateDefaultRules(state.perspective, state.selectedCategories)
                                    const cats = new Set(state.selectedCategories)
                                    setExpandedCategories(cats)
                                    update({ step: 'rules', rules })
                                }}
                                disabled={state.selectedCategories.length === 0}
                                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next ({state.selectedCategories.length} categories)
                            </button>
                        </div>
                    </>
                )}

                {/* ── STEP 4B: RULES ── */}
                {state.step === 'rules' && (
                    <>
                        <ClarenceGuide text="Here are suggested rules based on industry standards. Adjust the positions to match your company's actual negotiation stance. You can also add your own custom rules or remove any you don't need." />

                        <div className="space-y-2">
                            {state.selectedCategories.map(cat => {
                                const catRules = state.rules.filter(r => r.category === cat)
                                const isExpanded = expandedCategories.has(cat)
                                if (catRules.length === 0 && !isExpanded) return null

                                return (
                                    <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <button
                                            onClick={() => toggleCategory(cat)}
                                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800">{getCategoryDisplayName(cat)}</span>
                                                <span className="text-[10px] text-slate-400">{catRules.length} rule{catRules.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                                className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                                                {catRules.map(rule => (
                                                    <div key={rule.tempId} className="bg-slate-50 rounded-lg border border-slate-100 p-3">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1 mr-3">
                                                                <input
                                                                    type="text"
                                                                    value={rule.clause_name}
                                                                    onChange={e => updateRule(rule.tempId, { clause_name: e.target.value })}
                                                                    placeholder="Rule name"
                                                                    className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 w-full p-0"
                                                                />
                                                                {rule.clause_code && (
                                                                    <span className="text-[9px] font-mono text-slate-400">{rule.clause_code}</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => deleteRule(rule.tempId)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                                                            >
                                                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                                </svg>
                                                            </button>
                                                        </div>

                                                        <SimplePositionBar rule={rule} />

                                                        {/* Position dropdowns */}
                                                        <div className="grid grid-cols-4 gap-2 mt-2">
                                                            {(['minimum_position', 'fallback_position', 'ideal_position', 'maximum_position'] as const).map(field => {
                                                                const labels = { minimum_position: 'Min', fallback_position: 'Fallback', ideal_position: 'Ideal', maximum_position: 'Max' }
                                                                return (
                                                                    <div key={field}>
                                                                        <label className="text-[9px] text-slate-400 block">{labels[field]}</label>
                                                                        <select
                                                                            value={rule[field]}
                                                                            onChange={e => updateRulePosition(rule.tempId, field, Number(e.target.value))}
                                                                            className="w-full px-1.5 py-1 text-[11px] border border-slate-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                                                        >
                                                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
                                                                                <option key={v} value={v}>{v}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>

                                                        {/* Deal breaker + importance */}
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={rule.is_deal_breaker}
                                                                    onChange={e => updateRule(rule.tempId, { is_deal_breaker: e.target.checked })}
                                                                    className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                                                />
                                                                <span className="text-[10px] text-slate-600">Deal Breaker</span>
                                                            </label>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-slate-400">Importance:</span>
                                                                <select
                                                                    value={rule.importance_level}
                                                                    onChange={e => updateRule(rule.tempId, { importance_level: Number(e.target.value) })}
                                                                    className="px-1 py-0.5 text-[10px] border border-slate-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                                                >
                                                                    {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
                                                                        <option key={v} value={v}>{v}/10</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Rationale */}
                                                        <textarea
                                                            value={rule.rationale || ''}
                                                            onChange={e => updateRule(rule.tempId, { rationale: e.target.value })}
                                                            placeholder="Why is this rule important?"
                                                            rows={2}
                                                            className="w-full mt-2 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                                                        />
                                                    </div>
                                                ))}

                                                <button
                                                    onClick={() => addRule(cat)}
                                                    className="w-full py-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-200 transition-colors"
                                                >
                                                    + Add Rule
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-between mt-6">
                            <button onClick={() => update({ step: 'categories' })} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                Back
                            </button>
                            <button
                                onClick={() => update({ step: 'review' })}
                                disabled={state.rules.length === 0}
                                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Review ({state.rules.length} rules)
                            </button>
                        </div>
                    </>
                )}

                {/* ── STEP 5B: REVIEW ── */}
                {state.step === 'review' && (
                    <>
                        <ClarenceGuide text="Here's a summary of your playbook. Once you create it, you can always come back to the Review page to fine-tune individual rules." />

                        {/* Summary card */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">{state.playbookName}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                                            state.perspective === 'provider' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        }`}>
                                            {state.perspective === 'provider' ? 'Provider' : 'Customer'}
                                        </span>
                                        {state.contractTypeKey && (
                                            <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                                {state.contractTypeKey.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-indigo-600">{state.rules.length}</div>
                                    <div className="text-[10px] text-slate-400">rules</div>
                                </div>
                            </div>

                            {/* Category breakdown */}
                            <div className="space-y-2">
                                {state.selectedCategories.map(cat => {
                                    const catRules = state.rules.filter(r => r.category === cat)
                                    if (catRules.length === 0) return null
                                    const dealBreakers = catRules.filter(r => r.is_deal_breaker).length
                                    return (
                                        <div key={cat} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-700">{getCategoryDisplayName(cat)}</span>
                                                {dealBreakers > 0 && (
                                                    <span className="px-1 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 rounded">
                                                        {dealBreakers} deal breaker{dealBreakers > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-400">{catRules.length} rule{catRules.length !== 1 ? 's' : ''}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6">
                            <button onClick={() => update({ step: 'rules' })} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                Back
                            </button>
                            <button
                                onClick={createPlaybook}
                                disabled={state.creating}
                                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {state.creating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Playbook'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// PAGE EXPORT
// ============================================================================

export default function CreatePlaybookPage() {
    return (
        <Suspense fallback={<PlaybookIQLoading />}>
            <CreatePlaybookContent />
        </Suspense>
    )
}
