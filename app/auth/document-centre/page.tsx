'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { eventLogger } from '@/lib/eventLogger'
import { createClient } from '@/lib/supabase'
import PlaybookComplianceIndicator, {
    ScoreRing,
    RedLinesTab,
    CategoriesTab,
    FlexibilityTab,
    ShieldCheckIcon,
    ShieldAlertIcon,
    LockIcon as PlaybookLockIcon,
} from '@/app/components/PlaybookComplianceIndicator'
import {
    calculatePlaybookCompliance,
    type PlaybookRule,
    type ContractClause,
    type ComplianceResult,
} from '@/lib/playbook-compliance'
import FeedbackButton from '@/app/components/FeedbackButton'
import { useRoleContext } from '@/lib/useRoleContext'
import type { RoleContext } from '@/lib/role-matrix'
import RequestApprovalModal from '@/app/components/RequestApprovalModal'
import SigningPanelNew from '@/app/components/SigningPanel'
import EntityConfirmationModal from '@/app/components/EntityConfirmationModal'
import SigningCeremonyModal from '@/app/components/SigningCeremonyModal'
import {
    type SigningConfirmation,
    type ContractSignature,
    type SigningState,
    type EntityConfirmationFormData,
    deriveSigningStatus,
    hashFileFromUrl,
    generateConsentText,
    buildInitialFormData,
} from '@/lib/signing'


// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

type DocumentCentreMode = 'mediation' | 'quick_contract'

type DocumentStatus = 'locked' | 'generating' | 'in_progress' | 'ready' | 'final'

type DocumentId =
    | 'executive-summary'
    | 'leverage-report'
    | 'position-history'
    | 'chat-transcript'
    | 'trade-off-register'
    | 'timeline-audit'
    | 'contract-draft'
    | 'contract-roadmap'
    | 'playbook-compliance'
    | 'internal-approvals'


interface DocumentItem {
    id: DocumentId;
    name: string;
    description: string;
    category: string;
    icon: string;
    status: DocumentStatus;
    progress?: number;
    prerequisites: string[];
    downloadUrl?: string;
    generatedAt?: string;
    documentDbId?: string;
    canGenerate?: boolean;
}

interface Session {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    providerCompany: string
    providerId: string | null
    customerContactName: string | null
    providerContactName: string | null
    serviceType: string
    dealValue: string
    phase: number
    status: string
    alignmentPercentage: number
    isTraining?: boolean
    contractType?: string
}

interface QuickContractData {
    contractId: string
    contractName: string
    contractType: string
    contractTypeKey: string | null
    status: string
    clauseCount: number
    totalClauses: number
    certifiedClauses: number
    agreedClauses: number
    modifiedClauses: number
    alignmentPercentage: number
    committedAt: string | null
    uploadedByUserId: string | null
    companyId: string | null
    createdAt: string
}

interface ClarenceChatMessage {
    messageId: string
    sessionId: string
    sender: 'user' | 'clarence'
    message: string
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

interface GeneratedDocumentRecord {
    document_id: string
    contract_id?: string | null
    session_id?: string | null
    document_type: string
    source_type?: string | null
    document_name?: string
    storage_path_pdf?: string | null      // Actual column: "contract-drafts/{id}_qc_contract_draft.pdf"
    storage_path?: string | null           // Fallback if naming varies
    pdf_public_url?: string | null         // Fallback
    public_url?: string | null             // Fallback
    file_size?: number | null
    mime_type?: string | null
    status: string                         // 'generating', 'generated', 'failed'
    generation_params?: Record<string, unknown> | string | null  // JSONB: { bucket, filename, public_url } — may arrive as string
    preview_data?: Record<string, unknown> | null
    ai_model_used?: string | null
    created_at: string
    updated_at?: string | null
}

interface SignatureRecord {
    signature_id: string
    contract_id?: string | null
    session_id?: string | null
    document_id?: string | null
    source_type: string
    user_id: string
    party_role: string
    company_name: string
    signatory_name: string
    signatory_title?: string | null
    signed_at: string
    ip_address?: string | null
    user_agent?: string | null
    contract_hash: string
    consent_text: string
    status: string
}

interface PlaybookComplianceData {
    compliance: ComplianceResult | null
    playbookName: string
    companyName: string
    isVisible: boolean       // true only if active playbook + user is initiator
    isLoading: boolean
}

// ============================================================================
// SECTION 2: CONSTANTS & CONFIGURATION
// ============================================================================

const N8N_BASE_URL = 'https://spikeislandstudios.app.n8n.cloud/webhook';

// Document generation endpoints - Mediation Studio (session-based)
const MEDIATION_ENDPOINTS: Record<string, string> = {
    'executive-summary': `${N8N_BASE_URL}/document-executive-summary`,
    'leverage-report': `${N8N_BASE_URL}/document-leverage-report`,
    'position-history': `${N8N_BASE_URL}/document-position-history`,
    'chat-transcript': `${N8N_BASE_URL}/document-chat-transcript`,
    'trade-off-register': `${N8N_BASE_URL}/document-trade-off-register`,
    'timeline-audit': `${N8N_BASE_URL}/document-timeline-audit`,
    'contract-draft': `${N8N_BASE_URL}/document-contract-draft`,
    'contract-roadmap': `${N8N_BASE_URL}/document-contract-roadmap`,
};

// Document generation endpoints - Quick Contract (contract_id-based)
// Each QC workflow is a separate 6.xQ variant with its own webhook
const QC_ENDPOINTS: Record<string, string> = {
    'executive-summary': `${N8N_BASE_URL}/document-qc-executive-summary`,
    'position-history': `${N8N_BASE_URL}/document-qc-position-history`,
    'chat-transcript': `${N8N_BASE_URL}/document-qc-chat-transcript`,
    'timeline-audit': `${N8N_BASE_URL}/document-qc-timeline-audit`,
    'contract-draft': `${N8N_BASE_URL}/document-qc-contract-draft`,
    'playbook-compliance': `${N8N_BASE_URL}/document-qc-playbook-compliance`,
};

// Legacy alias - kept for any references elsewhere
const DOCUMENT_ENDPOINTS = MEDIATION_ENDPOINTS;

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook';

// Documents available per mode
const QC_AVAILABLE_DOCUMENTS: DocumentId[] = [
    'executive-summary',
    'position-history',
    'chat-transcript',
    'timeline-audit',
    'contract-draft',
    'internal-approvals'
]

const MEDIATION_AVAILABLE_DOCUMENTS: DocumentId[] = [
    'executive-summary',
    'leverage-report',
    'position-history',
    'chat-transcript',
    'trade-off-register',
    'timeline-audit',
    'contract-draft',
    'contract-roadmap',
    'internal-approvals'
]

// Dynamic documents added at runtime based on conditions
// 'playbook-compliance' — added when QC mode + initiator + active playbook

const DOCUMENT_DEFINITIONS: Omit<DocumentItem, 'status' | 'generatedAt' | 'downloadUrl' | 'progress' | 'documentDbId'>[] = [
    {
        id: 'executive-summary',
        name: 'Executive Summary',
        description: 'One-page overview of the contract outcome for leadership sign-off',
        category: 'assessment',
        icon: '\u{1F4CB}',
        prerequisites: []
    },
    {
        id: 'leverage-report',
        name: 'Leverage Assessment Report',
        description: 'Detailed breakdown of how leverage was calculated and applied',
        category: 'assessment',
        icon: '\u2696\uFE0F',
        prerequisites: []
    },
    {
        id: 'position-history',
        name: 'Position Movement History',
        description: 'Complete record of how each clause evolved during review',
        category: 'negotiation',
        icon: '\u{1F4CA}',
        prerequisites: []
    },
    {
        id: 'chat-transcript',
        name: 'Chat Transcript',
        description: 'All party communications and CLARENCE conversations',
        category: 'negotiation',
        icon: '\u{1F4AC}',
        prerequisites: []
    },
    {
        id: 'trade-off-register',
        name: 'Trade-Off Register',
        description: 'Formal record of all linked concessions and exchanges',
        category: 'negotiation',
        icon: '\u{1F504}',
        prerequisites: []
    },
    {
        id: 'timeline-audit',
        name: 'Timeline & Audit Log',
        description: 'Chronological record of every event in the contract lifecycle',
        category: 'negotiation',
        icon: '\u{1F4C5}',
        prerequisites: []
    },
    {
        id: 'contract-draft',
        name: 'Contract Draft',
        description: 'Complete clause-by-clause agreement ready for signature',
        category: 'agreement',
        icon: '\u{1F4C4}',
        prerequisites: ['executive-summary']
    },
    {
        id: 'contract-roadmap',
        name: 'Contract Roadmap',
        description: 'Governance guide for managing the contract relationship',
        category: 'governance',
        icon: '\u{1F5FA}\uFE0F',
        prerequisites: ['contract-draft']
    },
    {
        id: 'playbook-compliance',
        name: 'Playbook Compliance Report',
        description: 'Compliance analysis against your active playbook rules',
        category: 'compliance',
        icon: '\u{1F6E1}\uFE0F',
        prerequisites: []
    },
    {
        id: 'internal-approvals',
        name: 'Internal Approvals',
        description: 'Request and track internal stakeholder approvals',
        category: 'workflow',
        icon: '\u2705',
        prerequisites: []
    }
]

// Contract type options for Save as Template
const CONTRACT_TYPE_OPTIONS = [
    { value: 'bpo', label: 'BPO (Business Process Outsourcing)' },
    { value: 'saas', label: 'SaaS (Software as a Service)' },
    { value: 'nda', label: 'NDA (Non-Disclosure Agreement)' },
    { value: 'msa', label: 'MSA (Master Service Agreement)' },
    { value: 'employment', label: 'Employment Contract' },
    { value: 'consulting', label: 'Consulting Agreement' },
    { value: 'procurement', label: 'Procurement Contract' },
    { value: 'partnership', label: 'Partnership Agreement' },
    { value: 'custom', label: 'Custom / Other' }
]



// ============================================================================
// SECTION 3: HELPER FUNCTIONS
// ============================================================================

function getStatusColor(status: DocumentStatus): string {
    switch (status) {
        case 'locked': return 'text-slate-400 bg-slate-100'
        case 'generating': return 'text-amber-600 bg-amber-100'
        case 'in_progress': return 'text-blue-600 bg-blue-100'
        case 'ready': return 'text-emerald-600 bg-emerald-100'
        case 'final': return 'text-purple-600 bg-purple-100'
        default: return 'text-slate-400 bg-slate-100'
    }
}

function getStatusIcon(status: DocumentStatus): string {
    switch (status) {
        case 'locked': return '\u{1F512}'
        case 'generating': return '\u23F3'
        case 'in_progress': return '\u{1F4DD}'
        case 'ready': return '\u2705'
        case 'final': return '\u{1F3AF}'
        default: return '\u25CB'
    }
}

function getStatusLabel(status: DocumentStatus): string {
    switch (status) {
        case 'locked': return 'Locked'
        case 'generating': return 'Generating...'
        case 'in_progress': return 'In Progress'
        case 'ready': return 'Ready'
        case 'final': return 'Final'
        default: return 'Unknown'
    }
}

function formatCurrency(value: string | number | null, currency: string = 'GBP'): string {
    if (!value) return '\u00A30'
    const num = typeof value === 'string' ? parseFloat(value) : value
    const symbol = currency === 'GBP' ? '\u00A3' : currency === 'USD' ? '$' : '\u20AC'
    if (num >= 1000000) {
        return `${symbol}${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
        return `${symbol}${(num / 1000).toFixed(0)}K`
    }
    return `${symbol}${num.toFixed(0)}`
}

function getDocumentsForMode(mode: DocumentCentreMode, extraDocIds: DocumentId[] = []): typeof DOCUMENT_DEFINITIONS {
    const base = mode === 'quick_contract' ? QC_AVAILABLE_DOCUMENTS : MEDIATION_AVAILABLE_DOCUMENTS
    const available = [...base, ...extraDocIds]
    return DOCUMENT_DEFINITIONS.filter(d => available.includes(d.id))
}

// ============================================================================
// SECTION 4: LOADING COMPONENT
// ============================================================================

function DocumentCentreLoading() {
    return (
        <div className="h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Loading Document Centre...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 5: DOCUMENT ITEM COMPONENT
// ============================================================================

interface DocumentItemProps {
    document: DocumentItem
    isSelected: boolean
    onClick: () => void
}

function DocumentListItem({ document, isSelected, onClick }: DocumentItemProps) {
    const isLocked = document.status === 'locked'

    return (
        <button
            onClick={onClick}
            disabled={isLocked}
            className={`w-full px-4 py-3 flex items-center gap-3 transition-all text-left ${isSelected
                ? 'bg-emerald-50 border-l-4 border-emerald-600'
                : isLocked
                    ? 'opacity-50 cursor-not-allowed hover:bg-slate-50 border-l-4 border-transparent'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
        >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${isSelected ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                {document.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${isSelected ? 'text-emerald-800' : 'text-slate-800'
                        }`}>
                        {document.name}
                    </span>
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                    {document.description}
                </div>
            </div>

            {/* Status Badge */}
            <div className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                {getStatusIcon(document.status)} {getStatusLabel(document.status)}
            </div>
        </button>
    )
}

// ============================================================================
// SECTION 6: EVIDENCE PACKAGE COMPONENT
// ============================================================================

interface EvidencePackageProps {
    documents: DocumentItem[]
    onDownload: () => void
    onGenerateAll: () => void
    isDownloading: boolean
    isGeneratingAll: boolean
    generatingAllProgress: { done: number; total: number }
    isGeneratingDocument: boolean
}

function EvidencePackageBar({ documents, onDownload, onGenerateAll, isDownloading, isGeneratingAll, generatingAllProgress, isGeneratingDocument }: EvidencePackageProps) {
    const readyCount = documents.filter(d => d.status === 'ready' || d.status === 'final').length
    const totalCount = documents.length
    const allReady = readyCount === totalCount
    const hasAnyReady = readyCount > 0
    const pendingCount = documents.filter(d => d.status === 'in_progress').length

    return (
        <div className="mx-3 mb-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
            {/* Compact progress row */}
            <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${allReady ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${totalCount > 0 ? (readyCount / totalCount) * 100 : 0}%` }}
                    />
                </div>
                <span className="text-[11px] text-slate-500 flex-shrink-0 tabular-nums">
                    {readyCount}/{totalCount}
                </span>
            </div>

            {/* Action buttons row */}
            <div className="flex gap-2">
                {/* Generate All — only when there are pending docs */}
                {pendingCount > 0 && (
                    <button
                        onClick={onGenerateAll}
                        disabled={isGeneratingAll || isGeneratingDocument}
                        className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-medium rounded-full transition flex items-center justify-center gap-1.5"
                    >
                        {isGeneratingAll ? (
                            <>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                {generatingAllProgress.done}/{generatingAllProgress.total}
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Generate All
                            </>
                        )}
                    </button>
                )}

                {/* Download ZIP */}
                <button
                    onClick={onDownload}
                    disabled={!hasAnyReady || isDownloading}
                    className={`${pendingCount > 0 ? 'flex-1' : 'w-full'} h-8 text-xs font-medium rounded-full transition flex items-center justify-center gap-1.5 ${
                        hasAnyReady && !isDownloading
                            ? allReady
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {isDownloading ? (
                        <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Zipping...
                        </>
                    ) : (
                        <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {allReady ? 'Download ZIP' : hasAnyReady ? `Download ${readyCount}` : 'No Docs'}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 7: DOCUMENT ACTION HUB (Centre Panel)
// ============================================================================
// Replaces the former passive PDF viewer with an active document workspace.
// Shows document header, action buttons (View/Print/Save/Share/Generate),
// and context-specific content area (inline PDF viewer, static previews, etc.)
// ============================================================================

interface DocumentActionHubProps {
    document: DocumentItem | null
    session: Session | null
    quickContract: QuickContractData | null
    onGenerate: (docId: DocumentId) => void
    onDownload: (docId: DocumentId, format: 'pdf' | 'docx') => void
    isGenerating: boolean
    playbookCompliance?: PlaybookComplianceData
    onRequestApproval?: (doc: DocumentItem) => void
    approvalRequests?: InternalApprovalsViewProps['requests']
    roleContext?: RoleContext | null
}

function DocumentActionHub({ document, session, quickContract, onGenerate, onDownload, isGenerating, playbookCompliance, onRequestApproval, approvalRequests, roleContext }: DocumentActionHubProps) {
    const [showPdfViewer, setShowPdfViewer] = useState(false)
    const printIframeRef = useRef<HTMLIFrameElement>(null)

    // Reset PDF viewer when document changes
    useEffect(() => {
        setShowPdfViewer(false)
    }, [document?.id])

    // ========================================================================
    // SECTION 7.1: EMPTY STATE
    // ========================================================================

    if (!document) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
                <div className="text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Document</h3>
                    <p className="text-slate-500 max-w-sm">
                        Choose a document from the list to preview, generate, or download.
                    </p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 7.2: ACTION HANDLERS
    // ========================================================================

    const isReady = document.status === 'ready' || document.status === 'final'
    const hasUrl = !!document.downloadUrl

    const handleViewPdf = () => {
        setShowPdfViewer(prev => !prev)
    }

    const handlePopOut = () => {
        if (document.downloadUrl) {
            window.open(document.downloadUrl, '_blank', 'noopener,noreferrer')
        }
    }

    const handlePrint = () => {
        if (!document.downloadUrl) return
        // Create a temporary hidden iframe for printing
        const iframe = printIframeRef.current
        if (iframe) {
            iframe.src = document.downloadUrl
            iframe.onload = () => {
                try {
                    iframe.contentWindow?.print()
                } catch {
                    // Cross-origin: fall back to opening in new tab
                    window.open(document.downloadUrl, '_blank')
                }
            }
        }
    }

    const handleSaveAsPdf = () => {
        if (!document.downloadUrl) return
        const a = window.document.createElement('a')
        a.href = document.downloadUrl
        a.download = `${document.name.replace(/\s+/g, '_')}.pdf`
        a.target = '_blank'
        window.document.body.appendChild(a)
        a.click()
        window.document.body.removeChild(a)
    }

    const getCategoryBadge = (category: string) => {
        const styles: Record<string, string> = {
            assessment: 'text-blue-600 bg-blue-50 border-blue-200',
            negotiation: 'text-amber-600 bg-amber-50 border-amber-200',
            agreement: 'text-emerald-600 bg-emerald-50 border-emerald-200',
            governance: 'text-violet-600 bg-violet-50 border-violet-200',
            compliance: 'text-violet-600 bg-violet-50 border-violet-200',
            workflow: 'text-slate-600 bg-slate-50 border-slate-200',
        }
        return styles[category] || styles.workflow
    }

    // ========================================================================
    // SECTION 7.3: RENDER
    // ========================================================================

    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* ============================================================ */}
            {/* SECTION 7.3A: DOCUMENT ACTION HEADER */}
            {/* ============================================================ */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                            {document.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-slate-800">{document.name}</h2>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getCategoryBadge(document.category)}`}>
                                    {document.category}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500">{document.description}</p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                        {getStatusIcon(document.status)} {getStatusLabel(document.status)}
                    </span>
                </div>

                {/* Generated date line */}
                {isReady && document.generatedAt && (
                    <p className="text-xs text-slate-400 mb-3">
                        Generated {new Date(document.generatedAt).toLocaleString([], {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                )}

                {/* ======================================================== */}
                {/* SECTION 7.3B: ACTION BUTTON ROW */}
                {/* ======================================================== */}
                <div className="flex flex-wrap items-center gap-1.5">

                    {/* Generate (when in_progress) */}
                    {document.status === 'in_progress' && (
                        <button
                            onClick={() => onGenerate(document.id)}
                            disabled={isGenerating}
                            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-full transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isGenerating ? (
                                <>
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Generate
                                </>
                            )}
                        </button>
                    )}

                    {/* Ready-state actions */}
                    {isReady && (
                        <>
                            {/* View PDF */}
                            {hasUrl && (
                                <button
                                    onClick={handleViewPdf}
                                    className={`h-8 px-3.5 text-xs font-medium rounded-full transition flex items-center gap-1.5 ${
                                        showPdfViewer
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {showPdfViewer ? 'Hide Preview' : 'View PDF'}
                                </button>
                            )}

                            {/* Print */}
                            {hasUrl && (
                                <button
                                    onClick={handlePrint}
                                    className="h-8 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-full transition flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                                    </svg>
                                    Print
                                </button>
                            )}

                            {/* Save as PDF */}
                            {hasUrl && (
                                <button
                                    onClick={handleSaveAsPdf}
                                    className="h-8 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-full transition flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Save PDF
                                </button>
                            )}

                            {/* Save as DOCX (disabled, coming soon) */}
                            <button
                                disabled
                                className="h-8 px-3.5 border border-slate-200 text-slate-400 text-xs font-medium rounded-full cursor-not-allowed flex items-center gap-1.5"
                                title="DOCX export coming soon"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                DOCX
                            </button>

                            {/* Divider */}
                            <div className="w-px h-5 bg-slate-200 mx-0.5" />

                            {/* Regenerate */}
                            <button
                                onClick={() => onGenerate(document.id)}
                                disabled={isGenerating}
                                className="h-8 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-full transition disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                                </svg>
                                Regenerate
                            </button>

                            {/* Request Approval */}
                            {document.id !== 'internal-approvals' && onRequestApproval && (
                                <button
                                    onClick={() => onRequestApproval(document)}
                                    className="h-8 px-3.5 border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-600 text-xs font-medium rounded-full transition flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 4.97-4.03 9-9 9a9.003 9.003 0 01-8.354-5.646M21 12A9 9 0 006.354 5.646M21 12H3" />
                                    </svg>
                                    Request Approval
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 7.3C: DOCUMENT CONTENT AREA */}
            {/* ============================================================ */}
            <div className="flex-1 overflow-y-auto bg-slate-50">

                {/* Generating State */}
                {document.status === 'generating' && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center py-12">
                            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-slate-600 font-medium">Generating {document.name}...</p>
                            <p className="text-sm text-slate-400 mt-2">This typically takes 15-30 seconds</p>
                            {document.progress !== undefined && (
                                <div className="mt-4 w-48 mx-auto">
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-1000"
                                            style={{ width: `${document.progress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">{document.progress}%</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Ready State — inline PDF viewer (toggleable) */}
                {isReady && hasUrl && showPdfViewer && (
                    <div className="h-full flex flex-col">
                        <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>PDF Preview</span>
                            </div>
                            <button
                                onClick={handlePopOut}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                Pop out
                            </button>
                        </div>
                        <iframe
                            src={document.downloadUrl}
                            className="flex-1 w-full border-0"
                            title={`${document.name} Preview`}
                        />
                    </div>
                )}

                {/* Ready State — action hub view (when PDF viewer is hidden) */}
                {isReady && !showPdfViewer && (
                    <div className="p-6">
                        <div className="max-w-3xl mx-auto">
                            {hasUrl ? (
                                /* Document ready with URL — show info card */
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800 mb-1">{document.name}</h3>
                                            <p className="text-sm text-slate-500 mb-3">
                                                Document generated successfully. Use the action buttons above to view, print, save, or share.
                                            </p>
                                            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                                                {document.generatedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {new Date(document.generatedAt).toLocaleString([], {
                                                            day: 'numeric', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                    </svg>
                                                    PDF
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick action: Click to view */}
                                    <button
                                        onClick={handleViewPdf}
                                        className="mt-4 w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/50 transition flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Click to preview document
                                    </button>
                                </div>
                            ) : (
                                /* Document ready without URL — show fallback */
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="font-semibold text-slate-700 mb-2">{document.name} is Ready</h3>
                                        <p className="text-sm text-slate-500 mb-4">
                                            Document generated successfully. Click Download PDF to get your copy.
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            PDF preview unavailable — the download URL could not be resolved.
                                            Try regenerating the document.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* SECTION 7.3D: PLAYBOOK COMPLIANCE REPORT VIEW */}
                {/* ======================================================== */}
                {document.id === 'playbook-compliance' && !showPdfViewer && playbookCompliance?.compliance && (
                    <PlaybookComplianceReportView
                        compliance={playbookCompliance.compliance}
                        playbookName={playbookCompliance.playbookName}
                        companyName={playbookCompliance.companyName}
                        hasGeneratedPdf={isReady && hasUrl}
                        onGenerate={() => onGenerate('playbook-compliance')}
                        isGenerating={isGenerating}
                    />
                )}

                {/* ======================================================== */}
                {/* SECTION 7.3E: INTERNAL APPROVALS VIEW (placeholder) */}
                {/* ======================================================== */}
                {document.id === 'internal-approvals' && (
                    <InternalApprovalsView requests={approvalRequests} />
                )}

                {/* Not Ready States — show static preview placeholders */}
                {document.id !== 'playbook-compliance' && document.id !== 'internal-approvals' && document.status !== 'generating' && !isReady && (
                    <div className="p-6">
                        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                            <DocumentContentPreview document={document} session={session} quickContract={quickContract} roleContext={roleContext} />
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden iframe for printing */}
            <iframe ref={printIframeRef} className="hidden" title="Print frame" />
        </div>
    )
}

// ============================================================================
// SECTION 7B: PLAYBOOK COMPLIANCE REPORT VIEW
// ============================================================================
// Full compliance breakdown shown in centre panel when 'playbook-compliance'
// is selected. Reuses ScoreRing, RedLinesTab, CategoriesTab, FlexibilityTab
// exported from PlaybookComplianceIndicator.tsx.
// ============================================================================

interface PlaybookComplianceReportViewProps {
    compliance: ComplianceResult
    playbookName: string
    companyName: string
    hasGeneratedPdf: boolean
    onGenerate: () => void
    isGenerating: boolean
}

function PlaybookComplianceReportView({
    compliance, playbookName, companyName, hasGeneratedPdf, onGenerate, isGenerating
}: PlaybookComplianceReportViewProps) {
    const [activeTab, setActiveTab] = useState<'redlines' | 'categories' | 'flexibility'>('redlines')
    const hasBreaches = compliance.redLineBreaches > 0

    const tabs = [
        { key: 'redlines' as const, label: `Red Lines (${compliance.redLines.length})` },
        { key: 'categories' as const, label: `Categories (${compliance.categories.length})` },
        { key: 'flexibility' as const, label: `Flexibility (${compliance.flexibility.length})` },
    ]

    return (
        <div className="p-6">
            <div className="max-w-3xl mx-auto space-y-4">

                {/* Summary Card */}
                <div className={`bg-white rounded-xl shadow-sm border p-5 ${
                    hasBreaches ? 'border-amber-200' : 'border-emerald-200'
                }`}>
                    <div className="flex items-center gap-4">
                        <ScoreRing score={compliance.overallScore} size={72} strokeWidth={5} />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-slate-800">Compliance Score</h3>
                                {hasBreaches ? (
                                    <ShieldAlertIcon size={18} className="text-amber-500" />
                                ) : (
                                    <ShieldCheckIcon size={18} className="text-emerald-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-500 mb-2">{playbookName}</p>
                            <div className="flex flex-wrap gap-3 text-xs">
                                <span className="flex items-center gap-1 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    {compliance.rulesPassed} passed
                                </span>
                                <span className="flex items-center gap-1 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    {compliance.rulesWarning} warnings
                                </span>
                                <span className="flex items-center gap-1 text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {compliance.rulesFailed} failed
                                </span>
                                {compliance.redLineBreaches > 0 && (
                                    <span className="flex items-center gap-1 text-red-600 font-semibold">
                                        <span className="w-2 h-2 rounded-full bg-red-600" />
                                        {compliance.redLineBreaches} red line breach{compliance.redLineBreaches > 1 ? 'es' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wide">
                            <PlaybookLockIcon size={8} /> Initiator Only
                        </div>
                    </div>
                </div>

                {/* Generate PDF button (when no PDF yet) */}
                {!hasGeneratedPdf && (
                    <button
                        onClick={onGenerate}
                        disabled={isGenerating}
                        className="w-full h-10 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Generating PDF Report...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                Generate PDF Report
                            </>
                        )}
                    </button>
                )}

                {/* Privacy notice */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md border border-slate-100 text-[10px] text-slate-400">
                    <PlaybookLockIcon size={10} className="flex-shrink-0" />
                    This analysis is private to {companyName} and compares negotiation outcomes
                    against your active playbook. The other party cannot see this information.
                </div>

                {/* Tab bar */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex border-b border-slate-200 bg-slate-50/80 px-4">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                                    activeTab === tab.key
                                        ? 'text-slate-800 font-semibold border-emerald-500'
                                        : 'text-slate-500 border-transparent hover:text-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="p-4 max-h-[500px] overflow-y-auto">
                        {activeTab === 'redlines' && <RedLinesTab redLines={compliance.redLines} />}
                        {activeTab === 'categories' && <CategoriesTab categories={compliance.categories} />}
                        {activeTab === 'flexibility' && <FlexibilityTab flexibility={compliance.flexibility} />}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 7C: INTERNAL APPROVALS VIEW (Phase 3 placeholder)
// ============================================================================
// Shows active approval requests and their statuses. Full implementation
// will be added in Phase 3 (database tables, email workflow, approver page).
// ============================================================================

interface InternalApprovalsViewProps {
    requests?: Array<{
        request_id: string
        document_name: string
        document_type: string
        priority: string
        status: string
        created_at: string
        responses: Array<{
            approver_name: string
            approver_email: string
            status: string
            responded_at: string | null
        }>
    }>
}

function InternalApprovalsView({ requests = [] }: InternalApprovalsViewProps) {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-100 text-emerald-700'
            case 'rejected': return 'bg-red-100 text-red-700'
            case 'viewed': return 'bg-blue-100 text-blue-700'
            case 'sent': return 'bg-amber-100 text-amber-700'
            default: return 'bg-slate-100 text-slate-600'
        }
    }

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-100 text-red-600'
            case 'high': return 'bg-amber-100 text-amber-600'
            default: return ''
        }
    }

    if (requests.length === 0) {
        return (
            <div className="p-6">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 4.97-4.03 9-9 9a9.003 9.003 0 01-8.354-5.646M21 12A9 9 0 006.354 5.646M21 12H3" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-slate-700 mb-2">Internal Approvals</h3>
                            <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                                Request internal sign-off from stakeholders before finalising your contract.
                                Select any generated document from the list and click &quot;Request Approval&quot; to get started.
                            </p>
                            <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                No active approval requests
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="max-w-3xl mx-auto space-y-3">
                {requests.map((req) => {
                    const approvedCount = req.responses.filter(r => r.status === 'approved').length
                    const totalCount = req.responses.length

                    return (
                        <div key={req.request_id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-semibold text-slate-800">{req.document_name}</h4>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${getStatusBadge(req.status)}`}>
                                            {req.status}
                                        </span>
                                        {req.priority !== 'normal' && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${getPriorityBadge(req.priority)}`}>
                                                {req.priority}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Requested {new Date(req.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="text-xs text-slate-500 font-medium tabular-nums">
                                    {approvedCount}/{totalCount} approved
                                </div>
                            </div>

                            {/* Approver list */}
                            <div className="space-y-1.5">
                                {req.responses.map((resp, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            resp.status === 'approved' ? 'bg-emerald-100' :
                                            resp.status === 'rejected' ? 'bg-red-100' :
                                            'bg-slate-100'
                                        }`}>
                                            {resp.status === 'approved' ? (
                                                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                            ) : resp.status === 'rejected' ? (
                                                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-slate-700 font-medium">{resp.approver_name}</span>
                                        <span className="text-slate-400">{resp.approver_email}</span>
                                        <span className={`ml-auto capitalize ${getStatusBadge(resp.status)} px-1.5 py-0.5 rounded text-[10px] font-medium`}>
                                            {resp.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 8: DOCUMENT VIEW SUB-COMPONENTS
// ============================================================================

function DocumentContentPreview({ document, session, quickContract, roleContext }: { document: DocumentItem; session: Session | null; quickContract: QuickContractData | null; roleContext?: RoleContext | null }) {
    // Derive display values — prefer session (mediation) data, fall back to quickContract (QC) data
    const alignmentPct = session?.alignmentPercentage ?? quickContract?.alignmentPercentage ?? 0
    const partyALabel = roleContext?.protectedPartyLabel || (session ? 'Customer' : 'Initiator')
    const partyBLabel = roleContext?.providingPartyLabel || (session ? 'Provider' : 'Respondent')
    const partyAName = session?.customerCompany || quickContract?.contractName || 'Party A'
    const partyBName = session?.providerCompany || 'Party B'

    switch (document.id) {
        case 'executive-summary':
            return (
                <div className="prose prose-sm max-w-none">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">{'\u{1F4CB}'} EXECUTIVE SUMMARY</h1>
                        <p className="text-slate-500">
                            {session
                                ? `Negotiation Outcome for ${partyAName} & ${partyBName}`
                                : `Contract Review: ${quickContract?.contractName || 'Untitled'}`
                            }
                        </p>
                    </div>
                    {session && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-emerald-50 rounded-lg">
                                <div className="text-xs text-emerald-600 mb-1">{partyALabel}</div>
                                <div className="font-semibold text-emerald-800">{partyAName}</div>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <div className="text-xs text-blue-600 mb-1">{partyBLabel}</div>
                                <div className="font-semibold text-blue-800">{partyBName}</div>
                            </div>
                        </div>
                    )}
                    {quickContract && !session && (
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-emerald-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-emerald-600">{quickContract.agreedClauses}</div>
                                <div className="text-xs text-emerald-600 mt-1">Agreed</div>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-amber-600">{quickContract.totalClauses - quickContract.agreedClauses}</div>
                                <div className="text-xs text-amber-600 mt-1">Pending</div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg text-center">
                                <div className="text-2xl font-bold text-slate-600">{quickContract.totalClauses}</div>
                                <div className="text-xs text-slate-500 mt-1">Total Clauses</div>
                            </div>
                        </div>
                    )}
                    <div className="text-center p-6 bg-slate-50 rounded-lg">
                        <div className={`text-4xl font-bold ${alignmentPct >= 80 ? 'text-emerald-600' : alignmentPct >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {alignmentPct}%
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                            {session ? 'Overall Alignment' : 'Clause Agreement'}
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-6">
                        Generated by CLARENCE - The Honest Broker
                    </p>
                </div>
            )

        case 'contract-draft':
            return (
                <div className="prose prose-sm max-w-none">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">{'\u{1F4C4}'} CONTRACT DRAFT</h1>
                        <p className="text-slate-500">Agreement between {session?.customerCompany} & {session?.providerCompany}</p>
                    </div>
                    <div className="space-y-4">
                        <div className="border-l-4 border-emerald-500 pl-4">
                            <h3 className="font-semibold text-slate-700">Preamble</h3>
                            <p className="text-sm text-slate-500">Parties, definitions, and scope</p>
                        </div>
                        <div className="border-l-4 border-blue-500 pl-4">
                            <h3 className="font-semibold text-slate-700">Commercial Terms</h3>
                            <p className="text-sm text-slate-500">Pricing, payment, and financial obligations</p>
                        </div>
                        <div className="border-l-4 border-purple-500 pl-4">
                            <h3 className="font-semibold text-slate-700">Service Levels</h3>
                            <p className="text-sm text-slate-500">Performance standards and remedies</p>
                        </div>
                        <div className="border-l-4 border-amber-500 pl-4">
                            <h3 className="font-semibold text-slate-700">Legal Provisions</h3>
                            <p className="text-sm text-slate-500">Liability, indemnity, and termination</p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-6">
                        Generated by CLARENCE - The Honest Broker
                    </p>
                </div>
            )

        case 'contract-roadmap':
            return (
                <div className="prose prose-sm max-w-none">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">{'\u{1F5FA}\uFE0F'} CONTRACT ROADMAP</h1>
                        <p className="text-slate-500">Governance Guide for {session?.customerCompany} & {session?.providerCompany}</p>
                    </div>
                    <div className="space-y-4">
                        <div className="border-l-4 border-emerald-500 pl-4">
                            <h3 className="font-semibold text-slate-700">1. Governance Framework</h3>
                            <p className="text-sm text-slate-500">Decision-making structures and responsibilities</p>
                        </div>
                        <div className="border-l-4 border-blue-500 pl-4">
                            <h3 className="font-semibold text-slate-700">2. Escalation Procedures</h3>
                            <p className="text-sm text-slate-500">How to handle disputes and escalations</p>
                        </div>
                        <div className="border-l-4 border-purple-500 pl-4">
                            <h3 className="font-semibold text-slate-700">3. Key Obligations Summary</h3>
                            <p className="text-sm text-slate-500">Plain-English guide to each party&apos;s duties</p>
                        </div>
                        <div className="border-l-4 border-amber-500 pl-4">
                            <h3 className="font-semibold text-slate-700">4. Review Schedules</h3>
                            <p className="text-sm text-slate-500">When to revisit terms and performance</p>
                        </div>
                        <div className="border-l-4 border-red-500 pl-4">
                            <h3 className="font-semibold text-slate-700">5. Contact Matrix</h3>
                            <p className="text-sm text-slate-500">Who to call for what</p>
                        </div>
                        <div className="border-l-4 border-teal-500 pl-4">
                            <h3 className="font-semibold text-slate-700">6. Performance Monitoring</h3>
                            <p className="text-sm text-slate-500">SLA tracking and reporting guidelines</p>
                        </div>
                        <div className="border-l-4 border-indigo-500 pl-4">
                            <h3 className="font-semibold text-slate-700">7. Change Management</h3>
                            <p className="text-sm text-slate-500">How to handle contract amendments</p>
                        </div>
                    </div>
                </div>
            )

        default:
            return (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">{document.icon}</span>
                    </div>
                    <h3 className="font-semibold text-slate-700 mb-2">{document.name}</h3>
                    <p className="text-sm text-slate-500">{document.description}</p>
                    <p className="text-xs text-slate-400 mt-4">
                        Full document content will appear here after generation.
                    </p>
                </div>
            )
    }
}

// ============================================================================
// SECTION 8B: SIGNING PANEL COMPONENT
// ============================================================================
// Appears in the left panel below the Evidence Package card when the
// Contract Draft is in 'ready' status. Shows who has signed and provides
// the "Sign Contract" button for the current user.

interface SigningPanelProps {
    documents: DocumentItem[]
    signatures: SignatureRecord[]
    currentUserId?: string
    onSign: () => void
    mode: DocumentCentreMode
}

function SigningPanel({ documents, signatures, currentUserId, onSign, mode }: SigningPanelProps) {
    const contractDraft = documents.find(d => d.id === 'contract-draft')
    const isContractReady = contractDraft?.status === 'ready'

    // Don't show unless the draft is ready
    if (!isContractReady) return null

    const currentUserSigned = signatures.some(s => s.user_id === currentUserId && s.status === 'signed')
    const signedCount = signatures.filter(s => s.status === 'signed').length
    const requiredSignatures = mode === 'quick_contract' ? 1 : 2
    const allSigned = signedCount >= requiredSignatures

    return (
        <div className={`mx-4 mb-4 p-4 rounded-xl border-2 ${allSigned
            ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-300'
            : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
            }`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${allSigned ? 'bg-violet-100' : 'bg-slate-200'
                    }`}>
                    {allSigned ? '\u2705' : '\u270D\uFE0F'}
                </div>
                <div className="flex-1">
                    <h3 className={`font-semibold ${allSigned ? 'text-violet-800' : 'text-slate-700'}`}>
                        {allSigned ? 'Contract Executed' : 'Signing Ceremony'}
                    </h3>
                    <p className="text-xs text-slate-500">
                        {allSigned
                            ? 'All parties have signed'
                            : `${signedCount}/${requiredSignatures} signatures`
                        }
                    </p>
                </div>
            </div>

            {/* Signature Status List */}
            <div className="space-y-2 mb-3">
                {signatures.filter(s => s.status === 'signed').map(sig => (
                    <div key={sig.signature_id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">{'\u2705'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate">
                                {sig.signatory_name}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                                {sig.company_name} &middot; {new Date(sig.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Pending signatures */}
                {!allSigned && !currentUserSigned && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">{'\u23F3'}</span>
                        </div>
                        <div className="text-sm text-amber-700">Your signature required</div>
                    </div>
                )}

                {!allSigned && currentUserSigned && signedCount < requiredSignatures && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs">{'\u23F3'}</span>
                        </div>
                        <div className="text-sm text-blue-700">Waiting for other party</div>
                    </div>
                )}
            </div>

            {/* Sign Button */}
            {!currentUserSigned && (
                <button
                    onClick={onSign}
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    I Agree to Sign
                </button>
            )}

            {/* Contract Hash (compact) */}
            {allSigned && signatures.length > 0 && (
                <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-400">Contract Hash (SHA-256)</div>
                    <div className="text-xs font-mono text-slate-500 truncate">{signatures[0]?.contract_hash}</div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// SECTION 8C: SIGNING MODAL COMPONENT
// ============================================================================
// Full-screen modal with identity confirmation, contract hash display,
// consent text, and job title input. This is the "signing ceremony".

interface SigningModalProps {
    show: boolean
    onClose: () => void
    onSign: () => void
    isSigning: boolean
    isComputingHash: boolean
    contractHash: string | null
    userInfo: UserInfo | null
    companyName: string
    signingTitle: string
    onTitleChange: (value: string) => void
}

function SigningModal({
    show, onClose, onSign, isSigning, isComputingHash,
    contractHash, userInfo, companyName, signingTitle, onTitleChange
}: SigningModalProps) {
    if (!show) return null

    const signatoryName = `${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`.trim()
    const shortHash = contractHash ? `${contractHash.substring(0, 16)}...${contractHash.substring(contractHash.length - 8)}` : 'Computing...'

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Signing Ceremony</h2>
                            <p className="text-sm text-slate-500">Review and confirm your signature</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Identity Confirmation */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Your Identity</h3>
                        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Name</span>
                                <span className="text-sm font-medium text-slate-800">{signatoryName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Company</span>
                                <span className="text-sm font-medium text-slate-800">{companyName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-slate-500">Email</span>
                                <span className="text-sm font-medium text-slate-800">{userInfo?.email}</span>
                            </div>
                        </div>
                    </div>

                    {/* Job Title Input */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Job Title <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={signingTitle}
                            onChange={(e) => onTitleChange(e.target.value)}
                            placeholder="e.g. Head of Procurement, Legal Director"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                    </div>

                    {/* Contract Hash */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Contract Fingerprint</h3>
                        <div className="bg-slate-800 rounded-lg p-3">
                            {isComputingHash ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm text-slate-300">Computing SHA-256 hash...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="text-xs text-slate-400 mb-1">SHA-256</div>
                                    <div className="text-sm font-mono text-emerald-400 break-all">{contractHash}</div>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            This hash uniquely identifies the Contract Draft at the time of signing.
                            Any modification to the document would produce a different hash.
                        </p>
                    </div>

                    {/* Consent Statement */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Consent Statement</h3>
                        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                            <p className="text-sm text-violet-900 leading-relaxed">
                                I, <strong>{signatoryName}</strong>, on behalf of <strong>{companyName}</strong>,
                                confirm that I have reviewed the Contract Draft
                                (SHA-256: <span className="font-mono text-xs">{shortHash}</span>)
                                and agree to the terms set out therein. This electronic signature
                                constitutes my legally binding consent.
                            </p>
                        </div>
                    </div>

                    {/* Audit Notice */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                        <p className="font-medium text-slate-600 mb-1">This action will be recorded:</p>
                        <p>Your signature, timestamp, and browser details will be stored as part of the legally auditable signing record.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        disabled={isSigning}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSign}
                        disabled={isSigning || isComputingHash || !contractHash}
                        className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-lg font-medium transition flex items-center gap-2"
                    >
                        {isSigning ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Signing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Confirm &amp; Sign
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 9: CLARENCE CHAT PANEL COMPONENT
// ============================================================================

interface ClarenceChatPanelProps {
    sessionId: string
    selectedDocument: DocumentItem | null
    messages: ClarenceChatMessage[]
    onSendMessage: (message: string) => void
    isLoading: boolean
}

function ClarenceChatPanel({ sessionId, selectedDocument, messages, onSendMessage, isLoading }: ClarenceChatPanelProps) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (!input.trim() || isLoading) return
        onSendMessage(input.trim())
        setInput('')
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Chat Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">C</span>
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">CLARENCE</div>
                        <div className="text-xs text-slate-500">
                            {selectedDocument
                                ? `Discussing: ${selectedDocument.name}`
                                : 'Document Centre Assistant'
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map(msg => (
                    <div
                        key={msg.messageId}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] rounded-lg p-3 ${msg.sender === 'clarence'
                            ? 'bg-white text-slate-700 border border-slate-200'
                            : 'bg-emerald-500 text-white'
                            }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <div className={`text-xs mt-2 ${msg.sender === 'clarence' ? 'text-slate-400' : 'text-white/70'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
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

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t border-slate-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask CLARENCE about documents..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-300 text-white rounded-lg transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 10: HEADER COMPONENT
// ============================================================================

interface DocumentCentreHeaderProps {
    session: Session | null
    userInfo: UserInfo | null
    mode: DocumentCentreMode
    quickContract: QuickContractData | null
    onBackToStudio: () => void
    roleContext?: RoleContext | null
}

function DocumentCentreHeader({ session, userInfo, mode, quickContract, onBackToStudio, roleContext }: DocumentCentreHeaderProps) {
    const isCustomer = userInfo?.role === 'customer'

    // Determine display values based on mode
    const backLabel = mode === 'quick_contract' ? 'QC Studio' : 'Contract Studio'
    const contractName = mode === 'quick_contract'
        ? (quickContract?.contractName || 'Quick Contract')
        : `${session?.customerCompany || ''} & ${session?.providerCompany || ''}`

    return (
        <div className="bg-slate-800 text-white">
            {/* Navigation Row */}
            <div className="px-6 py-2 border-b border-slate-700">
                <div className="flex items-center">
                    {/* Left: Back to Studio — fixed width to balance right side */}
                    <div className="flex-1 flex items-center">
                        <button
                            onClick={onBackToStudio}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span className="text-sm">{backLabel}</span>
                        </button>
                    </div>

                    {/* Center: Title — truly centred */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white tracking-wide">CLARENCE</span>
                                <span className="font-semibold text-violet-400">
                                    {mode === 'quick_contract' ? 'Quick Contract' : 'Agree'}
                                </span>
                            </div>
                            <span className="text-slate-500 text-xs">The Honest Broker</span>
                        </div>
                    </div>

                    {/* Right: Feedback + User Info — fixed width to balance left side */}
                    <div className="flex-1 flex items-center justify-end gap-3">
                        <FeedbackButton position="header" />
                        <div className="text-right">
                            <div className="text-sm text-slate-300">
                                {userInfo?.firstName} {userInfo?.lastName}
                            </div>
                            <div className="text-xs text-slate-500">
                                {mode === 'quick_contract' ? 'Document Centre' : (roleContext?.userRoleLabel || (isCustomer ? 'Customer' : 'Provider'))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Row */}
            <div className="px-6 py-3">
                {mode === 'quick_contract' ? (
                    /* Quick Contract Context */
                    <div className="flex items-center">
                        {/* Left: Contract Name */}
                        <div className="flex-1 flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-teal-400" />
                            <div>
                                <div className="text-xs text-slate-400">Contract</div>
                                <div className="text-sm font-medium text-teal-400">{quickContract?.contractName || '\u2014'}</div>
                            </div>
                        </div>

                        {/* Center: Contract Stats */}
                        <div className="flex items-center gap-8">
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Type</div>
                                <div className="text-sm font-mono text-white">{quickContract?.contractType || '\u2014'}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Clauses</div>
                                <div className="text-sm font-semibold text-white">{quickContract?.totalClauses || 0}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Status</div>
                                <div className={`text-sm font-semibold ${quickContract?.status === 'committed' ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                    {quickContract?.status === 'committed' ? 'Committed' : 'In Progress'}
                                </div>
                            </div>
                        </div>

                        {/* Right: Certification Stats */}
                        <div className="flex-1 flex items-center justify-end gap-3">
                            <div className="text-right">
                                <div className="text-xs text-slate-400">Agreed</div>
                                <div className="text-sm font-medium text-emerald-400">
                                    {quickContract?.agreedClauses || 0}/{quickContract?.totalClauses || 0}
                                </div>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                        </div>
                    </div>
                ) : (
                    /* Mediation Context (original) */
                    <div className="flex items-center">
                        {/* Protected Party (Customer) */}
                        <div className="flex-1 flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-400" />
                            <div>
                                <div className="text-xs text-slate-400">{roleContext?.protectedPartyLabel || 'Customer'}</div>
                                <div className="text-sm font-medium text-emerald-400">{session?.customerCompany || '\u2014'}</div>
                            </div>
                        </div>

                        {/* Center: Session Details */}
                        <div className="flex items-center gap-8">
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Session</div>
                                <div className="text-sm font-mono text-white">{session?.sessionNumber || '\u2014'}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Deal Value</div>
                                <div className="text-sm font-semibold text-emerald-400">{session?.dealValue || '\u2014'}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-400">Alignment</div>
                                <div className={`text-sm font-semibold ${(session?.alignmentPercentage || 0) >= 80 ? 'text-emerald-400' :
                                    (session?.alignmentPercentage || 0) >= 50 ? 'text-amber-400' :
                                        'text-red-400'
                                    }`}>
                                    {session?.alignmentPercentage || 0}%
                                </div>
                            </div>
                        </div>

                        {/* Providing Party (Provider) */}
                        <div className="flex-1 flex items-center justify-end gap-3">
                            <div className="text-right">
                                <div className="text-xs text-slate-400">{roleContext?.providingPartyLabel || 'Provider'}</div>
                                <div className="text-sm font-medium text-blue-400">{session?.providerCompany || '\u2014'}</div>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-blue-400" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 11: MAIN DOCUMENT CENTRE COMPONENT
// ============================================================================

function DocumentCentreContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // State
    const [loading, setLoading] = useState(true)
    const [mode, setMode] = useState<DocumentCentreMode>('mediation')
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [quickContract, setQuickContract] = useState<QuickContractData | null>(null)
    const [documents, setDocuments] = useState<DocumentItem[]>([])
    const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null)
    const [chatMessages, setChatMessages] = useState<ClarenceChatMessage[]>([])
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [isGeneratingDocument, setIsGeneratingDocument] = useState(false)
    const [isGeneratingPackage, setIsGeneratingPackage] = useState(false)
    const [isGeneratingAll, setIsGeneratingAll] = useState(false)
    const [generatingAllProgress, setGeneratingAllProgress] = useState({ done: 0, total: 0 })


    const [playbookCompliance, setPlaybookCompliance] = useState<PlaybookComplianceData>({
        compliance: null,
        playbookName: '',
        companyName: '',
        isVisible: false,
        isLoading: false,
    })

    // Role Matrix context — dynamic party labels for this contract type
    const { roleContext } = useRoleContext({
        sessionId: session?.sessionId,
        contractId: quickContract?.contractId,
        userId: userInfo?.userId,
    })

    // SECTION 11B-PLAYBOOK: PLAYBOOK COMPLIANCE LOADER
    const loadPlaybookCompliance = useCallback(async (
        contractId: string,
        userId: string,
        companyId: string | null,
        uploadedByUserId: string | null,
        contractTypeKey: string | null = null
    ) => {
        // Only show for initiator (the person who uploaded the contract)
        const isInitiator = userId === uploadedByUserId
        if (!isInitiator || !companyId) {
            setPlaybookCompliance(prev => ({ ...prev, isVisible: false, isLoading: false }))
            return
        }

        setPlaybookCompliance(prev => ({ ...prev, isLoading: true }))

        try {
            // Step 1: Find best-matching active playbook (type-specific > general > any)
            const { findActivePlaybook } = await import('@/lib/playbook-loader')
            const playbookData = await findActivePlaybook(companyId, contractTypeKey)

            if (!playbookData) {
                // No active playbook — hide indicator
                setPlaybookCompliance(prev => ({ ...prev, isVisible: false, isLoading: false }))
                return
            }

            // Step 2: Fetch playbook rules
            const { data: rulesData, error: rulesError } = await supabase
                .from('playbook_rules')
                .select('*')
                .eq('playbook_id', playbookData.playbook_id)
                .eq('is_active', true)

            if (rulesError || !rulesData || rulesData.length === 0) {
                setPlaybookCompliance(prev => ({ ...prev, isVisible: false, isLoading: false }))
                return
            }

            // Step 3: Fetch contract clauses with positions
            const { data: clausesData, error: clausesError } = await supabase
                .from('uploaded_contract_clauses')
                .select('clause_id, clause_name, category, clarence_position, initiator_position, respondent_position, customer_position, is_header')
                .eq('contract_id', contractId)

            if (clausesError || !clausesData) {
                setPlaybookCompliance(prev => ({ ...prev, isVisible: false, isLoading: false }))
                return
            }

            // Step 4: Fetch company name for display
            const { data: companyData } = await supabase
                .from('companies')
                .select('company_name')
                .eq('company_id', companyId)
                .single()


            // ===== TEMPORARY DIAGNOSTIC — remove after debugging =====
            console.log('=== PLAYBOOK COMPLIANCE DEBUG ===')
            console.log('Rules loaded:', rulesData?.length, 'Clauses loaded:', clausesData?.length)

            // Show what categories normalise to
            const { normaliseCategory, getEffectivePosition } = await import('@/lib/playbook-compliance')

            const ruleCategories = [...new Set((rulesData || []).map((r: any) =>
                `${r.category} → ${normaliseCategory(r.category)}`
            ))]
            console.log('Rule categories:', ruleCategories)

            const clauseCategories = [...new Set((clausesData || []).map((c: any) =>
                `${c.category} → ${normaliseCategory(c.category)}`
            ))]
            console.log('Clause categories:', clauseCategories)

            // Check positions for first few clauses
            const sampleClauses = (clausesData || []).slice(0, 5).map((c: any) => ({
                category: c.category,
                clarence_position: c.clarence_position,
                type: typeof c.clarence_position,
                effective: getEffectivePosition(c as any),
            }))
            console.log('Sample clause positions:', sampleClauses)
            console.log('=== END DEBUG ===')
            // ===== END TEMPORARY DIAGNOSTIC =====

            // Step 5: Calculate compliance (existing line)
            const compliance = calculatePlaybookCompliance(
                rulesData as PlaybookRule[],
                clausesData as ContractClause[]
            )

            setPlaybookCompliance({
                compliance,
                playbookName: playbookData.playbook_name || 'Company Playbook',
                companyName: companyData?.company_name || 'Your Company',
                isVisible: true,
                isLoading: false,
            })

            // Log the compliance check
            eventLogger.completed('documentation', 'playbook_compliance_calculated', {
                contractId,
                playbookId: playbookData.playbook_id,
                overallScore: compliance.overallScore,
                rulesChecked: compliance.rulesChecked,
                redLineBreaches: compliance.redLineBreaches,
            })

        } catch (error) {
            console.error('Error loading playbook compliance:', error)
            setPlaybookCompliance(prev => ({ ...prev, isVisible: false, isLoading: false }))
        }
    }, [supabase])

    // ============================================================================
    // SECTION 11A: SAVE AS TEMPLATE STATE
    // ============================================================================

    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
    const [saveTemplateName, setSaveTemplateName] = useState('')
    const [saveTemplateContractType, setSaveTemplateContractType] = useState('')
    const [saveTemplateDescription, setSaveTemplateDescription] = useState('')
    const [isSavingTemplate, setIsSavingTemplate] = useState(false)
    const [saveTemplateResult, setSaveTemplateResult] = useState<{
        success: boolean
        templateName?: string
        clauseCount?: number
        error?: string
    } | null>(null)

    // ============================================================================
    // SECTION 11A-2: SIGNING CEREMONY STATE (Entity Confirmation + Signing)
    // ============================================================================

    const [signatures, setSignatures] = useState<SignatureRecord[]>([])
    const [showSigningModal, setShowSigningModal] = useState(false)
    const [signingTitle, setSigningTitle] = useState('')
    const [isSigning, setIsSigning] = useState(false)
    const [isComputingHash, setIsComputingHash] = useState(false)
    const [contractHash, setContractHash] = useState<string | null>(null)

    // Entity confirmation state
    const [signingState, setSigningState] = useState<SigningState>({
        initiatorConfirmation: null,
        respondentConfirmation: null,
        initiatorSignature: null,
        respondentSignature: null,
        contractHash: null,
        status: 'awaiting_confirmations',
        isLoading: true,
    })
    const [showEntityConfirmationModal, setShowEntityConfirmationModal] = useState(false)
    const [showNewSigningModal, setShowNewSigningModal] = useState(false)
    const [isSubmittingConfirmation, setIsSubmittingConfirmation] = useState(false)
    const [currentPartyRole, setCurrentPartyRole] = useState<'initiator' | 'respondent' | null>(null)
    const [entityFormInitialData, setEntityFormInitialData] = useState<EntityConfirmationFormData>({
        entityName: '', registrationNumber: '', jurisdiction: '',
        registeredAddress: '', signatoryName: '', signatoryTitle: '', signatoryEmail: '',
    })

    // ============================================================================
    // SECTION 11A-3: INTERNAL APPROVALS STATE
    // ============================================================================
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [approvalDocumentTarget, setApprovalDocumentTarget] = useState<DocumentItem | null>(null)
    const [approvalRequests, setApprovalRequests] = useState<Array<{
        request_id: string
        document_name: string
        document_type: string
        priority: string
        status: string
        created_at: string
        responses: Array<{
            approver_name: string
            approver_email: string
            status: string
            responded_at: string | null
        }>
    }>>([])
    const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)

    // ============================================================================
    // SECTION 11B: DATA LOADING
    // ============================================================================

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

    // SECTION 11B-1: MEDIATION SESSION LOADER (existing)
    const loadSessionData = useCallback(async (sessionId: string): Promise<Session | null> => {
        try {
            const response = await fetch(`${API_BASE}/contract-studio-api?session_id=${sessionId}`)
            if (!response.ok) throw new Error('Failed to fetch session')

            const data = await response.json()

            console.log('=== API RESPONSE ===', JSON.stringify(data, null, 2))

            return {
                sessionId: data.session?.sessionId || sessionId,
                sessionNumber: data.session?.sessionNumber || '',
                customerCompany: data.session?.customerCompany || '',
                providerCompany: data.session?.providerCompany || '',
                providerId: data.session?.providerId || null,
                customerContactName: data.session?.customerContactName || null,
                providerContactName: data.session?.providerContactName || null,
                serviceType: data.session?.contractType || 'Service Agreement',
                dealValue: formatCurrency(data.session?.dealValue, data.session?.currency || 'GBP'),
                phase: data.session?.phase || 0,
                status: data.session?.status || '',
                alignmentPercentage: data.leverage?.alignmentPercentage || 0,
                isTraining: data.session?.is_training || data.session?.isTraining || false,
                contractType: data.session?.contractType || data.session?.contract_type || ''
            }
        } catch (error) {
            console.error('Error loading session:', error)
            return null
        }
    }, [])

    // SECTION 11B-2: QUICK CONTRACT LOADER (new)
    const loadQuickContractData = useCallback(async (contractId: string): Promise<QuickContractData | null> => {
        try {
            // Load contract metadata
            const { data: contractData, error: contractError } = await supabase
                .from('uploaded_contracts')
                .select('*')
                .eq('contract_id', contractId)
                .single()

            if (contractError || !contractData) {
                console.error('QC Contract load error:', contractError)
                return null
            }

            // Load clause stats
            const { data: clausesData } = await supabase
                .from('uploaded_contract_clauses')
                .select('clause_id, is_header, clarence_certified, draft_text')
                .eq('contract_id', contractId)

            const leafClauses = (clausesData || []).filter((c: Record<string, unknown>) => !c.is_header)
            const certifiedCount = leafClauses.filter((c: Record<string, unknown>) => c.clarence_certified).length
            const modifiedCount = leafClauses.filter((c: Record<string, unknown>) => !!c.draft_text).length

            // Load agreement events from qc_clause_events (matches QC Studio table)
            const { data: eventsData } = await supabase
                .from('qc_clause_events')
                .select('event_type, clause_id, party_role')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: true })

            // Dual-party agreement tracking (matches QC Studio logic)
            // Both initiator AND respondent must agree for a clause to be "fully agreed"
            const initiatorAgreed = new Set<string>()
            const respondentAgreed = new Set<string>()
            let committedAt: string | null = null

            if (eventsData) {
                for (const evt of eventsData) {
                    if (evt.event_type === 'agreed' && evt.clause_id) {
                        if (evt.party_role === 'initiator') {
                            initiatorAgreed.add(evt.clause_id)
                        } else if (evt.party_role === 'respondent') {
                            respondentAgreed.add(evt.clause_id)
                        }
                    }
                    if (evt.event_type === 'agreement_withdrawn' && evt.clause_id) {
                        if (evt.party_role === 'initiator') {
                            initiatorAgreed.delete(evt.clause_id)
                        } else if (evt.party_role === 'respondent') {
                            respondentAgreed.delete(evt.clause_id)
                        }
                    }
                    if (evt.event_type === 'committed') {
                        committedAt = new Date().toISOString()
                    }
                }
            }

            // Fully agreed = both parties agreed on the clause
            const fullyAgreedCount = leafClauses.filter((c: Record<string, unknown>) =>
                c.clarence_certified &&
                initiatorAgreed.has(c.clause_id as string) &&
                respondentAgreed.has(c.clause_id as string)
            ).length

            // Calculate alignment percentage from agreement ratio
            const alignmentPercentage = leafClauses.length > 0
                ? Math.round((fullyAgreedCount / leafClauses.length) * 100)
                : 0

            return {
                contractId: contractData.contract_id,
                contractName: contractData.contract_name || 'Untitled Contract',
                contractType: contractData.detected_contract_type || contractData.contract_type || 'Contract',
                contractTypeKey: contractData.contract_type_key || null,
                status: contractData.status || 'unknown',
                clauseCount: contractData.clause_count || leafClauses.length,
                totalClauses: leafClauses.length,
                certifiedClauses: certifiedCount,
                agreedClauses: fullyAgreedCount,
                modifiedClauses: modifiedCount,
                alignmentPercentage,
                committedAt,
                uploadedByUserId: contractData.uploaded_by_user_id,
                companyId: contractData.company_id,
                createdAt: contractData.created_at
            }
        } catch (error) {
            console.error('Error loading quick contract:', error)
            return null
        }
    }, [supabase])

    // ============================================================================
    // SECTION 11B-2.5: LOAD GENERATED DOCUMENTS FROM DB
    // ============================================================================
    // Queries the generated_documents table to get real statuses and PDF URLs
    // for any documents that have already been generated for this contract/session.
    // Returns a Map keyed by document_type for fast lookup during initialisation.

    const loadGeneratedDocuments = useCallback(async (
        currentMode: DocumentCentreMode,
        contextId: string
    ): Promise<Map<string, GeneratedDocumentRecord>> => {
        const docMap = new Map<string, GeneratedDocumentRecord>()

        try {
            // Build query based on mode
            const filterColumn = currentMode === 'quick_contract' ? 'contract_id' : 'session_id'

            const { data, error } = await supabase
                .from('generated_documents')
                .select('*')
                .eq(filterColumn, contextId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error loading generated documents:', error)
                return docMap
            }

            if (!data || data.length === 0) {
                console.log('No previously generated documents found')
                return docMap
            }

            // Build map — if multiple records exist for the same type,
            // the first one wins (newest, due to order by desc)
            for (const row of data) {
                const docType = row.document_type as string
                if (docType && !docMap.has(docType)) {
                    docMap.set(docType, row as GeneratedDocumentRecord)
                }
            }

            console.log(`Loaded ${docMap.size} generated document records from DB:`,
                Array.from(docMap.keys()))

        } catch (err) {
            console.error('Exception loading generated documents:', err)
        }

        return docMap
    }, [supabase])

    // ============================================================================
    // SECTION 11B-2.6: LOAD EXISTING SIGNATURES
    // ============================================================================
    // Queries contract_signatures to see who has already signed.
    // Returns an array of SignatureRecord for display in the Signing Panel.

    const loadSignatures = useCallback(async (
        currentMode: DocumentCentreMode,
        contextId: string
    ): Promise<SignatureRecord[]> => {
        try {
            const filterColumn = currentMode === 'quick_contract' ? 'contract_id' : 'session_id'

            const { data, error } = await supabase
                .from('contract_signatures')
                .select('*')
                .eq(filterColumn, contextId)
                .eq('status', 'signed')
                .order('signed_at', { ascending: true })

            if (error) {
                console.error('Error loading signatures:', error)
                return []
            }

            return (data || []) as SignatureRecord[]
        } catch (err) {
            console.error('Exception loading signatures:', err)
            return []
        }
    }, [supabase])

    // ============================================================================
    // SECTION 11B-2.7: LOAD SIGNING CONFIRMATIONS & FULL SIGNING STATE
    // ============================================================================
    // Queries signing_confirmations and contract_signatures tables to build the
    // full SigningState. Also detects the current user's party role.

    const loadSigningState = useCallback(async (
        contractId: string,
        userId: string,
        uploadedByUserId: string | null
    ) => {
        try {
            // 1. Determine party role
            const isInitiator = userId === uploadedByUserId
            let partyRole: 'initiator' | 'respondent' | null = null

            if (isInitiator) {
                partyRole = 'initiator'
            } else {
                // Check if user is a respondent via qc_recipients
                const { data: recipientData } = await supabase
                    .from('qc_recipients')
                    .select('user_id')
                    .eq('contract_id', contractId)
                    .eq('user_id', userId)
                    .maybeSingle()

                if (recipientData) {
                    partyRole = 'respondent'
                }
            }
            setCurrentPartyRole(partyRole)

            // 2. Load signing confirmations
            const { data: confirmations, error: confError } = await supabase
                .from('signing_confirmations')
                .select('*')
                .eq('contract_id', contractId)

            if (confError) {
                console.error('Error loading signing confirmations:', confError)
            }

            const initiatorConf = (confirmations || []).find(
                (c: SigningConfirmation) => c.party_role === 'initiator'
            ) as SigningConfirmation | undefined
            const respondentConf = (confirmations || []).find(
                (c: SigningConfirmation) => c.party_role === 'respondent'
            ) as SigningConfirmation | undefined

            // 3. Load signatures
            const { data: sigs, error: sigError } = await supabase
                .from('contract_signatures')
                .select('*')
                .eq('contract_id', contractId)
                .eq('status', 'signed')

            if (sigError) {
                console.error('Error loading contract signatures:', sigError)
            }

            const initiatorSig = (sigs || []).find(
                (s: ContractSignature) => s.party_role === 'initiator'
            ) as ContractSignature | undefined
            const respondentSig = (sigs || []).find(
                (s: ContractSignature) => s.party_role === 'respondent'
            ) as ContractSignature | undefined

            // 4. Derive status
            const status = deriveSigningStatus(
                initiatorConf || null,
                respondentConf || null,
                initiatorSig || null,
                respondentSig || null
            )

            setSigningState({
                initiatorConfirmation: initiatorConf || null,
                respondentConfirmation: respondentConf || null,
                initiatorSignature: initiatorSig || null,
                respondentSignature: respondentSig || null,
                contractHash: initiatorSig?.contract_hash || respondentSig?.contract_hash || null,
                status,
                isLoading: false,
            })

            // Also update the legacy signatures array for backwards compat
            setSignatures((sigs || []) as SignatureRecord[])

            // 5. Pre-populate entity form if user hasn't confirmed yet
            if (partyRole) {
                const myConf = partyRole === 'initiator' ? initiatorConf : respondentConf
                if (!myConf) {
                    // Fetch company data for pre-population
                    const { data: companyData } = await supabase
                        .from('companies')
                        .select('company_name, registration_number, jurisdiction, registered_address')
                        .eq('company_id', (await supabase
                            .from('uploaded_contracts')
                            .select('company_id')
                            .eq('contract_id', contractId)
                            .single()
                        ).data?.company_id || '')
                        .maybeSingle()

                    // For respondent, try their own company info
                    let entityCompanyData = companyData
                    if (partyRole === 'respondent') {
                        const { data: recipientData } = await supabase
                            .from('qc_recipients')
                            .select('company_name, recipient_name, recipient_email')
                            .eq('contract_id', contractId)
                            .eq('user_id', userId)
                            .maybeSingle()

                        if (recipientData) {
                            // Try to get the respondent's company details
                            const { data: respCompanyData } = await supabase
                                .from('companies')
                                .select('company_name, registration_number, jurisdiction, registered_address')
                                .eq('company_name', recipientData.company_name)
                                .maybeSingle()

                            entityCompanyData = respCompanyData || null
                        }
                    }

                    const authData = localStorage.getItem('clarence_auth')
                    const parsed = authData ? JSON.parse(authData) : {}
                    const ui = parsed.userInfo || {}

                    setEntityFormInitialData(buildInitialFormData(
                        entityCompanyData?.company_name || ui.companyName || ui.company || '',
                        entityCompanyData?.registration_number || null,
                        entityCompanyData?.jurisdiction || null,
                        entityCompanyData?.registered_address || null,
                        ui.firstName || '',
                        ui.lastName || '',
                        ui.email || ''
                    ))
                }
            }

        } catch (err) {
            console.error('Error loading signing state:', err)
            setSigningState(prev => ({ ...prev, isLoading: false }))
        }
    }, [supabase])

    // SECTION 11B-3: INITIALIZE DOCUMENTS (mode-aware, DB-merged)
    // Merges document definitions with real status from generated_documents table.
    // DB record status mapping:
    //   'generated' → ready (has PDF URL)
    //   'generating' → generating (workflow in progress)
    //   'failed' → in_progress (can retry)
    //   no record → in_progress (not yet generated)

    const initializeDocuments = useCallback((
        currentMode: DocumentCentreMode,
        dbRecords: Map<string, GeneratedDocumentRecord>,
        sessionData?: Session | null,
        qcData?: QuickContractData | null,
        extraDocIds?: DocumentId[]
    ): DocumentItem[] => {
        const availableDefs = getDocumentsForMode(currentMode, extraDocIds)

        return availableDefs.map(def => {
            // Check if we have a DB record for this document type
            const dbRecord = dbRecords.get(def.id)

            // If a DB record exists, use its real status
            if (dbRecord) {
                const dbStatus = dbRecord.status

                if (dbStatus === 'generated') {
                    // Document is ready — reconstruct public URL from storage_path_pdf
                    // N8N workflows store: storage_path_pdf = "contract-drafts/{id}_qc_contract_draft.pdf"
                    // The public URL must be reconstructed as the full Supabase Storage public URL
                    const SUPABASE_STORAGE_BASE = 'https://wlrlkvqiakaiydfqqdmu.supabase.co/storage/v1/object/public/documents'

                    let downloadUrl: string | undefined

                    // DEBUG: Log the raw DB record so we can trace URL issues
                    console.log(`[DocCentre] DB record for "${def.id}":`, {
                        storage_path_pdf: dbRecord.storage_path_pdf,
                        generation_params: dbRecord.generation_params,
                        generation_params_type: typeof dbRecord.generation_params,
                    })

                    // Priority 1: Check generation_params.public_url (N8N stores the full URL here)
                    // Handle both parsed JSONB (object) and double-stringified (string) cases
                    let parsedParams: Record<string, unknown> | null = null
                    const rawParams = dbRecord.generation_params
                    if (rawParams && typeof rawParams === 'object') {
                        parsedParams = rawParams as Record<string, unknown>
                    } else if (rawParams && typeof rawParams === 'string') {
                        try {
                            parsedParams = JSON.parse(rawParams) as Record<string, unknown>
                        } catch {
                            parsedParams = null
                        }
                    }

                    if (parsedParams && parsedParams.public_url && typeof parsedParams.public_url === 'string') {
                        downloadUrl = parsedParams.public_url
                        console.log(`[DocCentre] "${def.id}" URL from generation_params.public_url:`, downloadUrl)
                    }
                    // Priority 2: Reconstruct from storage_path_pdf column
                    else if (dbRecord.storage_path_pdf) {
                        const relativePath = dbRecord.storage_path_pdf
                        downloadUrl = `${SUPABASE_STORAGE_BASE}/${relativePath}`
                        console.log(`[DocCentre] "${def.id}" URL reconstructed from storage_path_pdf:`, downloadUrl)
                    }
                    // Priority 3: Fallbacks for any other column naming patterns
                    else if (dbRecord.storage_path) {
                        downloadUrl = dbRecord.storage_path.startsWith('http')
                            ? dbRecord.storage_path
                            : `${SUPABASE_STORAGE_BASE}/${dbRecord.storage_path}`
                        console.log(`[DocCentre] "${def.id}" URL from storage_path fallback:`, downloadUrl)
                    }
                    else if (dbRecord.pdf_public_url) {
                        downloadUrl = dbRecord.pdf_public_url
                        console.log(`[DocCentre] "${def.id}" URL from pdf_public_url fallback:`, downloadUrl)
                    }
                    else if (dbRecord.public_url) {
                        downloadUrl = dbRecord.public_url
                        console.log(`[DocCentre] "${def.id}" URL from public_url fallback:`, downloadUrl)
                    }
                    else {
                        console.warn(`[DocCentre] "${def.id}" — no URL found in any column!`, dbRecord)
                    }

                    return {
                        ...def,
                        status: 'ready' as DocumentStatus,
                        progress: 100,
                        generatedAt: dbRecord.updated_at || dbRecord.created_at,
                        downloadUrl: downloadUrl || undefined,
                        documentDbId: dbRecord.document_id,
                        canGenerate: true
                    }
                }

                if (dbStatus === 'generating') {
                    // Workflow is currently running
                    return {
                        ...def,
                        status: 'generating' as DocumentStatus,
                        progress: 50,
                        generatedAt: undefined,
                        downloadUrl: undefined,
                        documentDbId: dbRecord.document_id,
                        canGenerate: false
                    }
                }

                // 'failed' or any other status — allow retry
                return {
                    ...def,
                    status: 'in_progress' as DocumentStatus,
                    progress: 0,
                    generatedAt: undefined,
                    downloadUrl: undefined,
                    documentDbId: dbRecord.document_id,
                    canGenerate: true
                }
            }

            // No DB record — determine initial status from prerequisites
            let status: DocumentStatus = 'in_progress'

            if (currentMode === 'quick_contract') {
                // QC mode: all docs start as in_progress (no prerequisites blocking)
                status = 'in_progress'
            } else {
                // Mediation mode: check prerequisites
                if (def.prerequisites.length === 0) {
                    status = 'in_progress'
                } else {
                    // Check if prerequisite docs are ready in DB
                    const prerequisitesMet = def.prerequisites.every(prereqId =>
                        dbRecords.has(prereqId) && dbRecords.get(prereqId)?.status === 'generated'
                    )
                    status = prerequisitesMet ? 'in_progress' : 'locked'
                }
            }

            return {
                ...def,
                status,
                progress: 0,
                generatedAt: undefined,
                downloadUrl: undefined,
                documentDbId: undefined,
                canGenerate: status === 'in_progress'
            }
        })
    }, [])

    // ============================================================================
    // SECTION 11B-4: INITIAL LOAD (dual-mode detection)
    // ============================================================================

    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (!user) return

            setUserInfo(user)

            // DUAL-MODE DETECTION: Check for contract_id (QC) or session_id (mediation)
            const contractId = searchParams.get('contract_id')
            const sessionId = searchParams.get('session_id') || searchParams.get('session')
            const isCommitted = searchParams.get('committed') === 'true'

            if (contractId) {
                // ---- QUICK CONTRACT MODE ----
                setMode('quick_contract')

                const qcData = await loadQuickContractData(contractId)
                if (qcData) {
                    setQuickContract(qcData)

                    // Load real document statuses from DB
                    const dbRecords = await loadGeneratedDocuments('quick_contract', contractId)

                    const docs = initializeDocuments('quick_contract', dbRecords, null, qcData)
                    setDocuments(docs)

                    // Auto-select first available document
                    const firstAvailable = docs.find(d => d.status !== 'locked')
                    if (firstAvailable) {
                        setSelectedDocument(firstAvailable)
                    }

                    // Build welcome message showing which docs are already ready
                    const readyDocs = docs.filter(d => d.status === 'ready')
                    const pendingDocs = docs.filter(d => d.status === 'in_progress')
                    const statusNote = isCommitted
                        ? 'Your contract has been committed and is ready for documentation.'
                        : 'Your contract is in progress.'

                    let readySummary = ''
                    if (readyDocs.length > 0) {
                        readySummary = `\n\n${readyDocs.length} document${readyDocs.length > 1 ? 's are' : ' is'} already generated and ready to download:\n${readyDocs.map(d => `\u2705 ${d.name}`).join('\n')}`
                    }

                    let pendingSummary = ''
                    if (pendingDocs.length > 0) {
                        pendingSummary = `\n\n${pendingDocs.length} document${pendingDocs.length > 1 ? 's' : ''} can be generated:\n${pendingDocs.map(d => `\u25CB ${d.name}`).join('\n')}`
                    }

                    setChatMessages([{
                        messageId: 'welcome-1',
                        sessionId: contractId,
                        sender: 'clarence',
                        message: `Welcome to the Document Centre for "${qcData.contractName}".\n\n${statusNote}${readySummary}${pendingSummary}\n\nSelect a document from the list to preview, generate, or download.`,
                        createdAt: new Date().toISOString()
                    }])

                    // Load existing signatures for this contract
                    const sigs = await loadSignatures('quick_contract', contractId)
                    setSignatures(sigs)

                    // Load full signing state (confirmations + signatures + party role)
                    loadSigningState(contractId, user.userId || '', qcData.uploadedByUserId)

                    // Log page view
                    eventLogger.setSession(contractId)
                    eventLogger.setUser(user.userId || '')
                    eventLogger.completed('documentation', 'document_centre_loaded', {
                        contractId,
                        mode: 'quick_contract',
                        isCommitted,
                        clauseCount: qcData.totalClauses,
                        agreedClauses: qcData.agreedClauses
                    })

                    // Load playbook compliance indicator (initiator only)
                    loadPlaybookCompliance(
                        contractId,
                        user.userId || '',
                        qcData.companyId,
                        qcData.uploadedByUserId,
                        qcData.contractTypeKey
                    )
                } else {
                    // Failed to load QC data - redirect to dashboard
                    router.push('/auth/contracts-dashboard')
                    return
                }

            } else if (sessionId) {
                // ---- MEDIATION MODE ----
                setMode('mediation')

                const sessionData = await loadSessionData(sessionId)
                if (sessionData) {
                    setSession(sessionData)

                    // Load real document statuses from DB
                    const dbRecords = await loadGeneratedDocuments('mediation', sessionId)

                    const docs = initializeDocuments('mediation', dbRecords, sessionData, null)
                    setDocuments(docs)

                    // Auto-select first available document
                    const firstAvailable = docs.find(d => d.status !== 'locked')
                    if (firstAvailable) {
                        setSelectedDocument(firstAvailable)
                    }

                    // Build welcome message showing real status
                    const readyDocs = docs.filter(d => d.status === 'ready')
                    let readySummary = ''
                    if (readyDocs.length > 0) {
                        readySummary = `\n\n${readyDocs.length} document${readyDocs.length > 1 ? 's are' : ' is'} already generated:\n${readyDocs.map(d => `\u2705 ${d.name}`).join('\n')}`
                    }

                    setChatMessages([{
                        messageId: 'welcome-1',
                        sessionId: sessionId,
                        sender: 'clarence',
                        message: `Welcome to the Document Centre. I'm here to help you prepare all documentation for the ${sessionData.customerCompany} and ${sessionData.providerCompany} negotiation.${readySummary}\n\nYou can generate individual documents or ask me questions about any of them. When all documents are ready, you'll be able to download the complete Evidence Package.`,
                        createdAt: new Date().toISOString()
                    }])

                    // Load existing signatures for this session
                    const sigs = await loadSignatures('mediation', sessionId)
                    setSignatures(sigs)

                    // Log page view
                    eventLogger.setSession(sessionId)
                    eventLogger.setUser(user.userId || '')
                    eventLogger.completed('documentation', 'document_centre_loaded', {
                        sessionId,
                        mode: 'mediation',
                        alignmentPercentage: sessionData.alignmentPercentage
                    })
                }

            } else {
                // No identifier found - redirect to dashboard
                router.push('/auth/contracts-dashboard')
                return
            }

            setLoading(false)
        }

        init()
    }, [loadUserInfo, loadSessionData, loadQuickContractData, loadGeneratedDocuments, loadSignatures, loadSigningState, initializeDocuments, searchParams, router])

    // ============================================================================
    // SECTION 11C: EVENT HANDLERS
    // ============================================================================

    const handleDocumentSelect = (doc: DocumentItem) => {
        if (doc.status !== 'locked') {
            setSelectedDocument(doc)
        }
    }

    // ============================================================================
    // SECTION 11C-2: ADD PLAYBOOK COMPLIANCE DOC WHEN DATA LOADS
    // ============================================================================
    // Playbook compliance loads async after initializeDocuments.
    // When it becomes visible, inject the playbook-compliance document into the list.
    useEffect(() => {
        if (playbookCompliance.isVisible && mode === 'quick_contract') {
            setDocuments(prev => {
                // Only add if not already in the list
                if (prev.some(d => d.id === 'playbook-compliance')) return prev
                const def = DOCUMENT_DEFINITIONS.find(d => d.id === 'playbook-compliance')
                if (!def) return prev
                // Insert before internal-approvals (last item) if present
                const approvalIdx = prev.findIndex(d => d.id === 'internal-approvals')
                const newDoc: DocumentItem = {
                    ...def,
                    status: 'in_progress',     // compliance data is ready, PDF not yet generated
                    canGenerate: true,
                }
                if (approvalIdx >= 0) {
                    const updated = [...prev]
                    updated.splice(approvalIdx, 0, newDoc)
                    return updated
                }
                return [...prev, newDoc]
            })
        }
    }, [playbookCompliance.isVisible, mode])

    // ============================================================================
    // SECTION 11D: GENERATE DOCUMENT HANDLER
    // ============================================================================

    const handleGenerateDocument = async (documentId: string) => {
        if (!userInfo) {
            console.error('Missing user info');
            return;
        }

        // Need either session (mediation) or quickContract (QC)
        const contextId = mode === 'quick_contract'
            ? quickContract?.contractId
            : session?.sessionId
        if (!contextId) {
            console.error('Missing context ID for document generation');
            return;
        }

        const endpointMap = mode === 'quick_contract' ? QC_ENDPOINTS : MEDIATION_ENDPOINTS;
        const endpoint = endpointMap[documentId];
        if (!endpoint) {
            console.error(`No endpoint configured for document: ${documentId} in mode: ${mode}`);
            return;
        }

        // Detect if this is a regeneration (document already has a URL or was previously ready)
        const existingDoc = documents.find(d => d.id === documentId)
        const isRegeneration = existingDoc?.status === 'ready' || !!existingDoc?.downloadUrl

        // Update document status to generating
        setDocuments(prev => prev.map(doc =>
            doc.id === documentId
                ? { ...doc, status: 'generating' as DocumentStatus, progress: 0 }
                : doc
        ));
        setIsGeneratingDocument(true);

        // Update selected document to show generating state
        if (selectedDocument?.id === documentId) {
            setSelectedDocument(prev => prev ? {
                ...prev,
                status: 'generating' as DocumentStatus,
                progress: 0
            } : null);
        }

        // Add CLARENCE message
        const generatingMessage: ClarenceChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: contextId,
            sender: 'clarence',
            message: isRegeneration
                ? `I'm regenerating the ${documentId.replace(/-/g, ' ')} with the latest data. This typically takes 15-30 seconds...`
                : `I'm generating the ${documentId.replace(/-/g, ' ')} now. This typically takes 15-30 seconds...`,
            createdAt: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, generatingMessage]);

        // Simulate progress while waiting for API
        const progressInterval = setInterval(() => {
            setDocuments(prev => prev.map(doc =>
                doc.id === documentId && doc.status === 'generating'
                    ? { ...doc, progress: Math.min((doc.progress || 0) + 10, 90) }
                    : doc
            ));
        }, 2000);

        try {
            // Build request body based on mode
            const requestBody: Record<string, unknown> = mode === 'quick_contract'
                ? {
                    contract_id: quickContract?.contractId,
                    user_id: userInfo.userId,
                    mode: 'quick_contract',
                    format: 'pdf',
                    regenerate: isRegeneration,
                    roleContext: roleContext || null,
                }
                : {
                    session_id: session?.sessionId,
                    user_id: userInfo.userId,
                    provider_id: session?.providerId,
                    mode: 'mediation',
                    format: 'pdf',
                    regenerate: isRegeneration,
                    roleContext: roleContext || null,
                }

            // Playbook compliance needs the computed compliance data in the payload
            if (documentId === 'playbook-compliance' && playbookCompliance?.compliance) {
                requestBody.compliance = playbookCompliance.compliance
                requestBody.playbook_name = playbookCompliance.playbookName
                requestBody.company_name = playbookCompliance.companyName
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                const newDownloadUrl = result.downloads?.pdf || result.pdf_public_url
                const newGeneratedAt = result.generated_at || new Date().toISOString()
                const newDocDbId = result.document_id

                // PERSIST the PDF URL back to the generated_documents row
                // so it's available on next page load (N8N workflows may not
                // always populate storage_path_pdf or generation_params)
                if (newDocDbId && newDownloadUrl) {
                    // Extract relative path from full URL for storage_path_pdf
                    const storageBase = 'https://wlrlkvqiakaiydfqqdmu.supabase.co/storage/v1/object/public/documents/'
                    const relativePath = newDownloadUrl.startsWith(storageBase)
                        ? newDownloadUrl.replace(storageBase, '')
                        : null

                    const updateData: Record<string, unknown> = {
                        generation_params: JSON.stringify({
                            public_url: newDownloadUrl,
                            persisted_by: 'document_centre_frontend'
                        }),
                        updated_at: new Date().toISOString()
                    }
                    if (relativePath) {
                        updateData.storage_path_pdf = relativePath
                    }

                    supabase
                        .from('generated_documents')
                        .update(updateData)
                        .eq('document_id', newDocDbId)
                        .then(({ error: updateError }) => {
                            if (updateError) {
                                console.warn('[DocCentre] Could not persist PDF URL to DB:', updateError)
                            } else {
                                console.log(`[DocCentre] Persisted PDF URL for "${documentId}" to generated_documents`)
                            }
                        })
                }

                // Update document in list
                setDocuments(prev => prev.map(doc =>
                    doc.id === documentId
                        ? {
                            ...doc,
                            status: 'ready' as DocumentStatus,
                            progress: 100,
                            downloadUrl: newDownloadUrl,
                            generatedAt: newGeneratedAt,
                            documentDbId: newDocDbId
                        }
                        : doc
                ));

                // Update selected document if it's the one we just generated
                if (selectedDocument?.id === documentId) {
                    setSelectedDocument(prev => prev ? {
                        ...prev,
                        status: 'ready' as DocumentStatus,
                        progress: 100,
                        downloadUrl: newDownloadUrl,
                        generatedAt: newGeneratedAt,
                        documentDbId: newDocDbId
                    } : null);
                }

                // Success message from CLARENCE
                const successMessage: ClarenceChatMessage = {
                    messageId: `msg-${Date.now()}`,
                    sessionId: contextId,
                    sender: 'clarence',
                    message: isRegeneration
                        ? `\u2705 Your ${documentId.replace(/-/g, ' ')} has been regenerated with the latest data. The preview is now updated.`
                        : `\u2705 Your ${documentId.replace(/-/g, ' ')} is ready! You can preview it in the centre panel or click Download PDF.`,
                    createdAt: new Date().toISOString()
                };
                setChatMessages(prev => [...prev, successMessage]);

            } else {
                throw new Error(result.error || 'Generation failed');
            }

        } catch (error) {
            clearInterval(progressInterval);
            console.error('Document generation error:', error);

            // Update document status to show error — revert to in_progress for retry
            setDocuments(prev => prev.map(doc =>
                doc.id === documentId
                    ? { ...doc, status: 'in_progress' as DocumentStatus, progress: 0 }
                    : doc
            ));

            // Update selected document too
            if (selectedDocument?.id === documentId) {
                setSelectedDocument(prev => prev ? {
                    ...prev,
                    status: 'in_progress' as DocumentStatus,
                    progress: 0
                } : null);
            }

            // Error message from CLARENCE
            const errorMessage: ClarenceChatMessage = {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: `\u274C Sorry, I encountered an error generating the document: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                createdAt: new Date().toISOString()
            };
            setChatMessages(prev => [...prev, errorMessage]);

        } finally {
            setIsGeneratingDocument(false);
        }
    };

    // ============================================================================
    // SECTION 11D-1B: GENERATE ALL DOCUMENTS HANDLER
    // ============================================================================
    // Queues generation for every document that hasn't been generated yet.
    // Documents are generated sequentially to avoid overwhelming the backend.

    const handleGenerateAll = async () => {
        if (!userInfo || isGeneratingAll) return

        const contextId = mode === 'quick_contract'
            ? quickContract?.contractId
            : session?.sessionId
        if (!contextId) return

        // Find documents that can be generated (in_progress status = not yet generated)
        const pendingDocs = documents.filter(d =>
            d.status === 'in_progress' && d.canGenerate !== false
        )

        if (pendingDocs.length === 0) {
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: 'All documents have already been generated. You can regenerate individual documents by selecting them and clicking Regenerate.',
                createdAt: new Date().toISOString()
            }])
            return
        }

        setIsGeneratingAll(true)
        setGeneratingAllProgress({ done: 0, total: pendingDocs.length })

        // CLARENCE message
        setChatMessages(prev => [...prev, {
            messageId: `msg-${Date.now()}`,
            sessionId: contextId,
            sender: 'clarence',
            message: `Generating ${pendingDocs.length} document${pendingDocs.length > 1 ? 's' : ''}. This will take a few minutes \u2014 I'll update you as each one completes.`,
            createdAt: new Date().toISOString()
        }])

        const endpointMap = mode === 'quick_contract' ? QC_ENDPOINTS : MEDIATION_ENDPOINTS
        let successCount = 0
        let failCount = 0

        for (const doc of pendingDocs) {
            const endpoint = endpointMap[doc.id]
            if (!endpoint) {
                failCount++
                setGeneratingAllProgress(prev => ({ ...prev, done: prev.done + 1 }))
                continue
            }

            // Mark this doc as generating
            setDocuments(prev => prev.map(d =>
                d.id === doc.id ? { ...d, status: 'generating' as DocumentStatus, progress: 0 } : d
            ))
            if (selectedDocument?.id === doc.id) {
                setSelectedDocument(prev => prev ? { ...prev, status: 'generating' as DocumentStatus, progress: 0 } : null)
            }

            try {
                const requestBody = mode === 'quick_contract'
                    ? {
                        contract_id: quickContract?.contractId,
                        user_id: userInfo.userId,
                        mode: 'quick_contract',
                        format: 'pdf',
                        regenerate: false
                    }
                    : {
                        session_id: session?.sessionId,
                        user_id: userInfo.userId,
                        provider_id: session?.providerId,
                        mode: 'mediation',
                        format: 'pdf',
                        regenerate: false
                    }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                })

                if (!response.ok) throw new Error(`HTTP ${response.status}`)

                const result = await response.json()

                if (result.success) {
                    const newDownloadUrl = result.downloads?.pdf || result.pdf_public_url
                    const newGeneratedAt = result.generated_at || new Date().toISOString()
                    const newDocDbId = result.document_id

                    // Persist URL to DB (same logic as single generate)
                    if (newDocDbId && newDownloadUrl) {
                        const storageBase = 'https://wlrlkvqiakaiydfqqdmu.supabase.co/storage/v1/object/public/documents/'
                        const relativePath = newDownloadUrl.startsWith(storageBase)
                            ? newDownloadUrl.replace(storageBase, '') : null
                        const updateData: Record<string, unknown> = {
                            generation_params: JSON.stringify({ public_url: newDownloadUrl, persisted_by: 'document_centre_frontend' }),
                            updated_at: new Date().toISOString()
                        }
                        if (relativePath) updateData.storage_path_pdf = relativePath
                        supabase.from('generated_documents').update(updateData).eq('document_id', newDocDbId).then(() => {})
                    }

                    // Update document state
                    setDocuments(prev => prev.map(d =>
                        d.id === doc.id
                            ? { ...d, status: 'ready' as DocumentStatus, progress: 100, downloadUrl: newDownloadUrl, generatedAt: newGeneratedAt, documentDbId: newDocDbId }
                            : d
                    ))
                    if (selectedDocument?.id === doc.id) {
                        setSelectedDocument(prev => prev ? { ...prev, status: 'ready' as DocumentStatus, progress: 100, downloadUrl: newDownloadUrl, generatedAt: newGeneratedAt, documentDbId: newDocDbId } : null)
                    }

                    successCount++
                } else {
                    throw new Error(result.error || 'Generation failed')
                }

            } catch (err) {
                console.error(`Generate All — error generating ${doc.id}:`, err)
                // Revert to in_progress so user can retry individually
                setDocuments(prev => prev.map(d =>
                    d.id === doc.id ? { ...d, status: 'in_progress' as DocumentStatus, progress: 0 } : d
                ))
                if (selectedDocument?.id === doc.id) {
                    setSelectedDocument(prev => prev ? { ...prev, status: 'in_progress' as DocumentStatus, progress: 0 } : null)
                }
                failCount++
            }

            setGeneratingAllProgress(prev => ({ ...prev, done: prev.done + 1 }))
        }

        // Final summary message
        let summaryMsg = ''
        if (failCount === 0) {
            summaryMsg = `All ${successCount} document${successCount > 1 ? 's' : ''} generated successfully. You can now download individual PDFs or the full Evidence Package.`
        } else if (successCount === 0) {
            summaryMsg = `Generation failed for all ${failCount} document${failCount > 1 ? 's' : ''}. Please try again or generate them individually.`
        } else {
            summaryMsg = `${successCount} of ${pendingDocs.length} documents generated. ${failCount} failed \u2014 you can retry those individually.`
        }

        setChatMessages(prev => [...prev, {
            messageId: `msg-${Date.now()}`,
            sessionId: contextId,
            sender: 'clarence',
            message: summaryMsg,
            createdAt: new Date().toISOString()
        }])

        eventLogger.completed('documentation', 'generate_all_completed', {
            contextId, mode, successCount, failCount, totalAttempted: pendingDocs.length
        })

        setIsGeneratingAll(false)
        setGeneratingAllProgress({ done: 0, total: 0 })
    }

    const handleDownloadDocument = async (docId: string, format: 'pdf' | 'docx') => {
        const doc = documents.find(d => d.id === docId)
        const contextId = mode === 'quick_contract' ? quickContract?.contractId : session?.sessionId

        if (!doc?.downloadUrl) {
            console.error('No download URL available for document:', docId)

            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId || '',
                sender: 'clarence',
                message: `\u274C Sorry, the download URL for this document isn't available. Try regenerating the document.`,
                createdAt: new Date().toISOString()
            }])
            return
        }

        if (format === 'pdf') {
            window.open(doc.downloadUrl, '_blank')
        } else {
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId || '',
                sender: 'clarence',
                message: `\u{1F4D8} DOCX format is coming soon. For now, please download the PDF version.`,
                createdAt: new Date().toISOString()
            }])
        }
    }

    const handleDownloadPackage = async () => {
        const contextId = mode === 'quick_contract' ? quickContract?.contractId : session?.sessionId
        if (!contextId) return

        // Collect all ready documents with download URLs
        const readyDocs = documents.filter(d => d.status === 'ready' && d.downloadUrl)
        if (readyDocs.length === 0) {
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: 'No documents are ready for download yet. Generate all documents first, then download the Evidence Package.',
                createdAt: new Date().toISOString()
            }])
            return
        }

        setIsGeneratingPackage(true)

        // CLARENCE progress message
        setChatMessages(prev => [...prev, {
            messageId: `msg-${Date.now()}`,
            sessionId: contextId,
            sender: 'clarence',
            message: `Assembling Evidence Package with ${readyDocs.length} document${readyDocs.length > 1 ? 's' : ''}. This may take a moment...`,
            createdAt: new Date().toISOString()
        }])

        try {
            // Dynamic import of JSZip (keeps bundle size down for non-ZIP pages)
            const JSZip = (await import('jszip')).default
            const zip = new JSZip()

            // Build a contract name for the ZIP filename
            const contractName = mode === 'quick_contract'
                ? (quickContract?.contractName || 'Contract')
                : `${session?.customerCompany || 'Customer'}_${session?.providerCompany || 'Provider'}`
            const safeName = contractName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)

            // Fetch each PDF and add to ZIP
            let successCount = 0
            let failCount = 0

            for (const doc of readyDocs) {
                try {
                    const response = await fetch(doc.downloadUrl!)
                    if (!response.ok) {
                        console.error(`Failed to fetch ${doc.name}: HTTP ${response.status}`)
                        failCount++
                        continue
                    }

                    const blob = await response.blob()
                    // Create a clean filename: "01_Executive_Summary.pdf"
                    const index = String(successCount + failCount + 1).padStart(2, '0')
                    const cleanName = doc.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')
                    const filename = `${index}_${cleanName}.pdf`

                    zip.file(filename, blob)
                    successCount++
                } catch (err) {
                    console.error(`Error fetching document ${doc.name}:`, err)
                    failCount++
                }
            }

            if (successCount === 0) {
                throw new Error('Could not fetch any documents for the package')
            }

            // Add a manifest text file
            const manifestDate = new Date().toLocaleString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            const manifestLines = [
                'CLARENCE EVIDENCE PACKAGE',
                '========================',
                '',
                `Generated: ${manifestDate}`,
                `Contract: ${contractName}`,
                `Mode: ${mode === 'quick_contract' ? 'Quick Contract' : 'Contract Mediation'}`,
                `Documents: ${successCount} of ${readyDocs.length}`,
                '',
                'Contents:',
                ...readyDocs.map((doc, i) => {
                    const index = String(i + 1).padStart(2, '0')
                    const cleanName = doc.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')
                    return `  ${index}. ${cleanName}.pdf — ${doc.name}`
                }),
                '',
                '---',
                'CLARENCE · The Honest Broker',
                'Clarence Legal Limited · Confidential'
            ]
            zip.file('_MANIFEST.txt', manifestLines.join('\n'))

            // Generate and download the ZIP
            const zipBlob = await zip.generateAsync({ type: 'blob' })
            const dateStr = new Date().toISOString().split('T')[0]
            const zipFilename = `CLARENCE_Evidence_Package_${safeName}_${dateStr}.zip`

            // Trigger browser download
            const url = URL.createObjectURL(zipBlob)
            const link = document.createElement('a')
            link.href = url
            link.download = zipFilename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            // Success message
            let resultMessage = `\u2705 Evidence Package downloaded successfully — ${successCount} document${successCount > 1 ? 's' : ''} bundled.`
            if (failCount > 0) {
                resultMessage += ` (${failCount} document${failCount > 1 ? 's' : ''} could not be included — try regenerating them.)`
            }

            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: resultMessage,
                createdAt: new Date().toISOString()
            }])

            // Log the event
            eventLogger.completed('documentation', 'evidence_package_downloaded', {
                contextId,
                mode,
                documentCount: successCount,
                failedCount: failCount
            })

        } catch (error) {
            console.error('Error generating evidence package:', error)
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: `\u274C Sorry, I couldn't assemble the Evidence Package: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                createdAt: new Date().toISOString()
            }])
        } finally {
            setIsGeneratingPackage(false)
        }
    }

    const handleSendChatMessage = async (message: string) => {
        const contextId = mode === 'quick_contract' ? quickContract?.contractId : session?.sessionId
        if (!contextId) return

        const userMessage: ClarenceChatMessage = {
            messageId: `user-${Date.now()}`,
            sessionId: contextId,
            sender: 'user',
            message,
            createdAt: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, userMessage])

        setIsChatLoading(true)

        try {
            // TODO: Call CLARENCE AI API
            await new Promise(resolve => setTimeout(resolve, 1500))

            const response: ClarenceChatMessage = {
                messageId: `clarence-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: `I understand you're asking about "${message}". I can help you with document generation, explain what each document contains, or answer questions about the ${mode === 'quick_contract' ? 'contract' : 'negotiation'} outcome. What would you like to know?`,
                createdAt: new Date().toISOString()
            }
            setChatMessages(prev => [...prev, response])

        } catch (error) {
            console.error('Chat error:', error)
        } finally {
            setIsChatLoading(false)
        }
    }

    const handleBackToStudio = () => {
        if (mode === 'quick_contract' && quickContract) {
            router.push(`/auth/quick-contract/studio/${quickContract.contractId}`)
        } else {
            const sessionId = searchParams.get('session_id') || searchParams.get('session')
            router.push(`/auth/contract-studio?session_id=${sessionId}`)
        }
    }

    // ============================================================================
    // SECTION 11D-2: SIGNING CEREMONY HANDLERS
    // ============================================================================

    // Compute SHA-256 hash of the Contract Draft PDF
    const computeContractHash = useCallback(async (pdfUrl: string): Promise<string> => {
        try {
            setIsComputingHash(true)
            const hashHex = await hashFileFromUrl(pdfUrl)
            return hashHex
        } catch (err) {
            console.error('Error computing contract hash:', err)
            // Fallback: hash based on URL + timestamp as a fingerprint
            const fallbackData = new TextEncoder().encode(pdfUrl + '|' + new Date().toISOString())
            const hashBuffer = await crypto.subtle.digest('SHA-256', fallbackData)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        } finally {
            setIsComputingHash(false)
        }
    }, [])

    // Open signing modal — only if Contract Draft is ready (legacy mediation path)
    const openSigningModal = useCallback(async () => {
        const contractDraft = documents.find(d => d.id === 'contract-draft')
        if (!contractDraft || contractDraft.status !== 'ready' || !contractDraft.downloadUrl) {
            return
        }

        const currentUserId = userInfo?.userId
        const alreadySigned = signatures.some(s => s.user_id === currentUserId && s.status === 'signed')
        if (alreadySigned) {
            const contextId = mode === 'quick_contract' ? quickContract?.contractId : session?.sessionId
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId || '',
                sender: 'clarence',
                message: 'You have already signed this contract. Waiting for the other party to sign.',
                createdAt: new Date().toISOString()
            }])
            return
        }

        const hash = await computeContractHash(contractDraft.downloadUrl)
        setContractHash(hash)
        setSigningTitle('')
        setShowSigningModal(true)
    }, [documents, userInfo, signatures, mode, quickContract, session, computeContractHash])

    // Submit signature (legacy mediation path)
    const handleSignContract = async () => {
        if (!userInfo || !contractHash) return

        const contextId = mode === 'quick_contract' ? quickContract?.contractId : session?.sessionId
        if (!contextId) return

        const contractDraft = documents.find(d => d.id === 'contract-draft')
        if (!contractDraft) return

        setIsSigning(true)

        try {
            const companyName = mode === 'quick_contract'
                ? (userInfo.company || 'Unknown Company')
                : (userInfo.role === 'customer'
                    ? (session?.customerCompany || userInfo.company || '')
                    : (session?.providerCompany || userInfo.company || ''))

            const partyRole = mode === 'quick_contract'
                ? 'initiator'
                : (userInfo.role || 'customer')

            const signatoryName = `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
            const consentText = `I, ${signatoryName}, on behalf of ${companyName}, confirm that I have reviewed the Contract Draft (SHA-256: ${contractHash.substring(0, 16)}...) and agree to the terms set out therein. This electronic signature constitutes my legally binding consent.`

            const { data, error } = await supabase
                .from('contract_signatures')
                .insert({
                    contract_id: mode === 'quick_contract' ? contextId : null,
                    session_id: mode === 'mediation' ? contextId : null,
                    document_id: contractDraft.documentDbId || null,
                    source_type: mode === 'quick_contract' ? 'quick_contract' : 'mediation',
                    user_id: userInfo.userId,
                    party_role: partyRole,
                    company_name: companyName,
                    signatory_name: signatoryName,
                    signatory_title: signingTitle || null,
                    contract_hash: contractHash,
                    consent_text: consentText,
                    ip_address: null,
                    user_agent: navigator.userAgent,
                    status: 'signed'
                })
                .select()
                .single()

            if (error) throw error

            setSignatures(prev => [...prev, data as SignatureRecord])
            setShowSigningModal(false)

            eventLogger.completed('signing', 'contract_signed', {
                contextId, mode, partyRole, signatureId: data?.signature_id
            })

            const allPartiesSigned = mode === 'quick_contract'
                ? true
                : (signatures.length + 1) >= 2

            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: allPartiesSigned
                    ? `\u2705 ${signatoryName} has signed the contract. All parties have now signed. The contract is now EXECUTED. A signing certificate will be available shortly.`
                    : `\u2705 ${signatoryName} has signed the contract on behalf of ${companyName}. Waiting for the other party to review and sign.`,
                createdAt: new Date().toISOString()
            }])

        } catch (err) {
            console.error('Signing error:', err)
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId || '',
                sender: 'clarence',
                message: `\u274C Sorry, there was an error recording your signature: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
                createdAt: new Date().toISOString()
            }])
        } finally {
            setIsSigning(false)
        }
    }

    // ============================================================================
    // SECTION 11D-3: ENTITY CONFIRMATION + NEW SIGNING CEREMONY HANDLERS
    // ============================================================================

    // Open entity confirmation modal
    const openEntityConfirmation = useCallback(() => {
        setShowEntityConfirmationModal(true)
    }, [])

    // Submit entity confirmation
    const handleEntityConfirmation = useCallback(async (formData: EntityConfirmationFormData) => {
        if (!userInfo || !currentPartyRole) return

        const contractId = quickContract?.contractId
        if (!contractId) return

        setIsSubmittingConfirmation(true)

        try {
            const { data, error } = await supabase
                .from('signing_confirmations')
                .insert({
                    contract_id: contractId,
                    user_id: userInfo.userId,
                    party_role: currentPartyRole,
                    entity_name: formData.entityName.trim(),
                    registration_number: formData.registrationNumber.trim() || null,
                    jurisdiction: formData.jurisdiction || null,
                    registered_address: formData.registeredAddress.trim() || null,
                    signatory_name: formData.signatoryName.trim(),
                    signatory_title: formData.signatoryTitle.trim(),
                    signatory_email: formData.signatoryEmail.trim(),
                    user_agent: navigator.userAgent,
                })
                .select()
                .single()

            if (error) throw error

            const confirmation = data as SigningConfirmation

            // Update signing state
            setSigningState(prev => {
                const updated = {
                    ...prev,
                    [currentPartyRole === 'initiator' ? 'initiatorConfirmation' : 'respondentConfirmation']: confirmation,
                }
                updated.status = deriveSigningStatus(
                    updated.initiatorConfirmation,
                    updated.respondentConfirmation,
                    updated.initiatorSignature,
                    updated.respondentSignature
                )
                return updated
            })

            setShowEntityConfirmationModal(false)

            // CLARENCE message
            const contextId = contractId
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: `\u2705 Entity details confirmed for ${formData.entityName}. ${
                    signingState.initiatorConfirmation && signingState.respondentConfirmation
                        ? 'Both parties have confirmed — the signing ceremony is now available.'
                        : 'Waiting for the other party to confirm their entity details.'
                }`,
                createdAt: new Date().toISOString()
            }])

            eventLogger.completed('signing', 'entity_confirmed', {
                contractId, partyRole: currentPartyRole, entityName: formData.entityName
            })

        } catch (err) {
            console.error('Entity confirmation error:', err)
            const contextId = quickContract?.contractId || ''
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contextId,
                sender: 'clarence',
                message: `\u274C Error confirming entity details: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
                createdAt: new Date().toISOString()
            }])
        } finally {
            setIsSubmittingConfirmation(false)
        }
    }, [userInfo, currentPartyRole, quickContract, supabase, signingState])

    // Open signing ceremony modal (new flow — after entity confirmation)
    const openNewSigningCeremony = useCallback(async () => {
        const contractDraft = documents.find(d => d.id === 'contract-draft')
        if (!contractDraft || contractDraft.status !== 'ready' || !contractDraft.downloadUrl) {
            return
        }

        // Compute hash
        const hash = await computeContractHash(contractDraft.downloadUrl)
        setContractHash(hash)
        setSigningState(prev => ({ ...prev, contractHash: hash }))
        setShowNewSigningModal(true)
    }, [documents, computeContractHash])

    // Submit signature (new flow — uses entity confirmation data)
    const handleNewSignContract = useCallback(async () => {
        if (!userInfo || !contractHash || !currentPartyRole) return

        const contractId = quickContract?.contractId
        if (!contractId) return

        const contractDraft = documents.find(d => d.id === 'contract-draft')
        if (!contractDraft) return

        const myConfirmation = currentPartyRole === 'initiator'
            ? signingState.initiatorConfirmation
            : signingState.respondentConfirmation
        if (!myConfirmation) return

        setIsSigning(true)

        try {
            const consentText = generateConsentText(
                myConfirmation.signatory_name,
                myConfirmation.signatory_title,
                myConfirmation.entity_name,
                contractHash
            )

            const { data, error } = await supabase
                .from('contract_signatures')
                .insert({
                    contract_id: contractId,
                    document_id: contractDraft.documentDbId || null,
                    confirmation_id: myConfirmation.confirmation_id,
                    source_type: 'quick_contract',
                    user_id: userInfo.userId,
                    party_role: currentPartyRole,
                    company_name: myConfirmation.entity_name,
                    signatory_name: myConfirmation.signatory_name,
                    signatory_title: myConfirmation.signatory_title,
                    contract_hash: contractHash,
                    consent_text: consentText,
                    user_agent: navigator.userAgent,
                    status: 'signed'
                })
                .select()
                .single()

            if (error) throw error

            const signature = data as unknown as ContractSignature

            // Update signing state
            setSigningState(prev => {
                const updated = {
                    ...prev,
                    [currentPartyRole === 'initiator' ? 'initiatorSignature' : 'respondentSignature']: signature,
                    contractHash,
                }
                updated.status = deriveSigningStatus(
                    updated.initiatorConfirmation,
                    updated.respondentConfirmation,
                    updated.initiatorSignature,
                    updated.respondentSignature
                )

                // If fully executed, update contract status
                if (updated.status === 'fully_executed') {
                    supabase
                        .from('uploaded_contracts')
                        .update({ status: 'executed' })
                        .eq('contract_id', contractId)
                        .then(({ error: updateErr }) => {
                            if (updateErr) console.error('Error updating contract status:', updateErr)
                            else console.log('Contract status updated to executed')
                        })
                }

                return updated
            })

            // Also update legacy signatures state
            setSignatures(prev => [...prev, data as SignatureRecord])
            setShowNewSigningModal(false)

            eventLogger.completed('signing', 'contract_signed', {
                contractId, mode: 'quick_contract', partyRole: currentPartyRole,
                signatureId: signature.signature_id, withEntityConfirmation: true,
            })

            // Determine if both have signed
            const otherSig = currentPartyRole === 'initiator'
                ? signingState.respondentSignature
                : signingState.initiatorSignature
            const allSigned = !!otherSig

            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contractId,
                sender: 'clarence',
                message: allSigned
                    ? `\u2705 ${myConfirmation.signatory_name} has signed the contract on behalf of ${myConfirmation.entity_name}. All parties have now signed — the contract is EXECUTED.`
                    : `\u2705 ${myConfirmation.signatory_name} has signed the contract on behalf of ${myConfirmation.entity_name}. Waiting for the other party to sign.`,
                createdAt: new Date().toISOString()
            }])

        } catch (err) {
            console.error('Signing error:', err)
            setChatMessages(prev => [...prev, {
                messageId: `msg-${Date.now()}`,
                sessionId: contractId,
                sender: 'clarence',
                message: `\u274C Error recording signature: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
                createdAt: new Date().toISOString()
            }])
        } finally {
            setIsSigning(false)
        }
    }, [userInfo, contractHash, currentPartyRole, quickContract, documents, signingState, supabase])

    // ============================================================================
    // SECTION 11D-4: INTERNAL APPROVALS HANDLERS
    // ============================================================================

    const openApprovalModal = useCallback((doc: DocumentItem) => {
        setApprovalDocumentTarget(doc)
        setShowApprovalModal(true)
    }, [])

    const loadApprovalRequests = useCallback(async () => {
        const contractId = quickContract?.contractId || null
        const sessionId = session?.sessionId || null
        if (!contractId && !sessionId) return

        try {
            let query = supabase
                .from('internal_approval_requests')
                .select('request_id, document_name, document_type, priority, status, created_at')
                .order('created_at', { ascending: false })

            if (contractId) {
                query = query.eq('contract_id', contractId)
            } else if (sessionId) {
                query = query.eq('session_id', sessionId)
            }

            const { data: requests } = await query

            if (requests && requests.length > 0) {
                // Load responses for each request
                const requestIds = requests.map(r => r.request_id)
                const { data: responses } = await supabase
                    .from('internal_approval_responses')
                    .select('request_id, approver_name, approver_email, status, responded_at')
                    .in('request_id', requestIds)

                const enriched = requests.map(req => ({
                    ...req,
                    responses: (responses || []).filter(r => r.request_id === req.request_id)
                }))

                setApprovalRequests(enriched)
            } else {
                setApprovalRequests([])
            }
        } catch (err) {
            console.error('Error loading approval requests:', err)
        }
    }, [quickContract?.contractId, session?.sessionId, supabase])

    const handleSubmitApprovalRequest = useCallback(async (
        approvers: Array<{ name: string; email: string; company: string }>,
        message: string,
        priority: 'normal' | 'high' | 'urgent'
    ) => {
        if (!approvalDocumentTarget || !userInfo) return
        setIsSubmittingApproval(true)

        try {
            const contractId = quickContract?.contractId || null
            const sessionId = session?.sessionId || null
            const contractName = quickContract?.contractName || session?.customerCompany || 'Contract'

            // 1. Create the approval request
            const { data: requestRow, error: insertError } = await supabase
                .from('internal_approval_requests')
                .insert({
                    contract_id: contractId,
                    session_id: sessionId,
                    source_type: mode,
                    document_type: approvalDocumentTarget.id,
                    document_name: approvalDocumentTarget.name,
                    document_url: approvalDocumentTarget.downloadUrl || null,
                    requested_by_user_id: userInfo.userId,
                    requested_by_name: `${userInfo.firstName} ${userInfo.lastName}`.trim(),
                    requested_by_email: userInfo.email,
                    message: message || null,
                    priority,
                    requires_all_approvers: true,
                })
                .select('request_id')
                .single()

            if (insertError || !requestRow) {
                throw new Error(insertError?.message || 'Failed to create approval request')
            }

            // 2. Create response rows for each approver (with unique access tokens)
            const responseRows = approvers.map(approver => ({
                request_id: requestRow.request_id,
                approver_email: approver.email,
                approver_name: approver.name,
                approver_company: approver.company || null,
                access_token: crypto.randomUUID(),
                status: 'pending',
            }))

            const { data: insertedResponses, error: respError } = await supabase
                .from('internal_approval_responses')
                .insert(responseRows)
                .select('response_id, approver_email, approver_name, access_token')

            if (respError) {
                throw new Error(respError.message || 'Failed to create approver records')
            }

            // 3. Send emails to each approver
            const baseUrl = window.location.origin
            for (const resp of (insertedResponses || [])) {
                try {
                    await fetch('/api/email/send-approval-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            approverEmail: resp.approver_email,
                            approverName: resp.approver_name,
                            requesterName: `${userInfo.firstName} ${userInfo.lastName}`.trim(),
                            requesterEmail: userInfo.email,
                            requesterCompany: userInfo.company || '',
                            documentName: approvalDocumentTarget.name,
                            documentType: approvalDocumentTarget.category,
                            contractName,
                            message,
                            priority,
                            approvalUrl: `${baseUrl}/approval/${resp.access_token}`,
                        }),
                    })

                    // Mark as sent
                    await supabase
                        .from('internal_approval_responses')
                        .update({ status: 'sent', sent_at: new Date().toISOString() })
                        .eq('response_id', resp.response_id)
                } catch (emailErr) {
                    console.error('Failed to send approval email to:', resp.approver_email, emailErr)
                }
            }

            // 4. Refresh the approval requests list
            await loadApprovalRequests()

            // 5. Close modal and show CLARENCE message
            setShowApprovalModal(false)
            setApprovalDocumentTarget(null)

            const currentContextId = quickContract?.contractId || session?.sessionId || ''
            setChatMessages(prev => [...prev, {
                messageId: `approval-${Date.now()}`,
                sessionId: currentContextId,
                sender: 'clarence',
                message: `Approval request sent for "${approvalDocumentTarget.name}" to ${approvers.length} approver${approvers.length > 1 ? 's' : ''}: ${approvers.map(a => a.name).join(', ')}.`,
                createdAt: new Date().toISOString(),
            }])

        } catch (err) {
            console.error('Error submitting approval request:', err)
            alert('Failed to send approval request. Please try again.')
        } finally {
            setIsSubmittingApproval(false)
        }
    }, [approvalDocumentTarget, userInfo, quickContract, session, mode, supabase, loadApprovalRequests])

    // Load approval requests on init
    const approvalContextId = quickContract?.contractId || session?.sessionId || ''
    useEffect(() => {
        if (approvalContextId) {
            loadApprovalRequests()
        }
    }, [approvalContextId, loadApprovalRequests])

    // ============================================================================
    // SECTION 11E: SAVE AS TEMPLATE HANDLER (with Observability Instrumentation)
    // ============================================================================

    const openSaveTemplateModal = () => {
        if (!session) return

        // Pre-fill template name from session context
        const sessionSource = session.isTraining ? 'Training' : 'Negotiation'
        const defaultName = `${session.customerCompany} vs ${session.providerCompany} (${sessionSource})`
        setSaveTemplateName(defaultName)

        // Pre-fill contract type if available
        const contractType = session.contractType || session.serviceType || ''
        const matchedType = CONTRACT_TYPE_OPTIONS.find(opt =>
            contractType.toLowerCase().includes(opt.value)
        )
        setSaveTemplateContractType(matchedType?.value || 'custom')

        setSaveTemplateDescription('')
        setSaveTemplateResult(null)
        setShowSaveTemplateModal(true)

        // --- Observability: Log save template initiated ---
        eventLogger.started('template_save', 'save_template_initiated', {
            sessionId: session.sessionId,
            isTraining: session.isTraining,
            source: session.isTraining ? 'training_outcome' : 'negotiation_outcome'
        })
    }

    const handleSaveAsTemplate = async () => {
        if (!session || !userInfo || !saveTemplateName.trim()) return

        setIsSavingTemplate(true)
        setSaveTemplateResult(null)

        try {
            // Step 1: Fetch session_clause_positions from Supabase
            const { data: positionsData, error: positionsError } = await supabase
                .from('session_clause_positions')
                .select('*')
                .eq('session_id', session.sessionId)
                .eq('is_applicable', true)
                .order('display_order', { ascending: true })

            if (positionsError) {
                throw new Error(`Failed to fetch clause positions: ${positionsError.message}`)
            }

            if (!positionsData || positionsData.length === 0) {
                throw new Error('No clause positions found for this session')
            }

            // Step 2: Generate template ID and code
            const templateId = crypto.randomUUID()
            const templateCode = `USER-${templateId.substring(0, 8).toUpperCase()}`
            const sessionSource = session.isTraining ? 'training_outcome' : 'negotiation_outcome'

            // Step 3: Insert contract_templates record
            const { error: templateError } = await supabase
                .from('contract_templates')
                .insert({
                    template_id: templateId,
                    template_code: templateCode,
                    template_name: saveTemplateName.trim(),
                    description: saveTemplateDescription.trim() || `Template created from ${sessionSource.replace('_', ' ')} - Session ${session.sessionNumber}`,
                    contract_type: saveTemplateContractType || 'custom',
                    industry: null,
                    is_system: false,
                    is_public: false,
                    is_active: true,
                    company_id: null,
                    created_by_user_id: userInfo.userId || null,
                    source_session_id: session.sessionId,
                    clause_count: positionsData.length,
                    version: 1,
                    times_used: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })

            if (templateError) {
                throw new Error(`Failed to create template: ${templateError.message}`)
            }

            // --- Observability: Log template record created ---
            eventLogger.completed('template_save', 'template_record_created', {
                templateId,
                templateCode,
                sessionId: session.sessionId,
                isTraining: session.isTraining
            })

            // Step 4: Map session_clause_positions to template_clauses
            const templateClauses = positionsData.map((pos: Record<string, unknown>, index: number) => {
                const customerPos = pos.original_customer_position
                    ? parseFloat(String(pos.original_customer_position))
                    : (pos.customer_position ? parseFloat(String(pos.customer_position)) : 5)
                const providerPos = pos.original_provider_position
                    ? parseFloat(String(pos.original_provider_position))
                    : (pos.provider_position ? parseFloat(String(pos.provider_position)) : 5)

                const outcomeCustomerPos = pos.customer_position ? parseFloat(String(pos.customer_position)) : null
                const outcomeProviderPos = pos.provider_position ? parseFloat(String(pos.provider_position)) : null

                const customerWeight = pos.customer_weight ? parseFloat(String(pos.customer_weight)) : 3
                const providerWeight = pos.provider_weight ? parseFloat(String(pos.provider_weight)) : 3
                const avgWeight = Math.round((customerWeight + providerWeight) / 2)

                return {
                    template_clause_id: crypto.randomUUID(),
                    template_id: templateId,
                    clause_id: pos.source_master_clause_id || pos.clause_id,
                    clause_name: pos.clause_name || `Clause ${index + 1}`,
                    category_name: pos.category_name || 'General',
                    display_number: pos.clause_number || `${index + 1}`,
                    clause_level: pos.clause_level || 1,
                    category_order: pos.category_order || Math.floor((pos.display_order as number || 0) / 100),
                    clause_order: pos.clause_order || ((pos.display_order as number || 0) % 100),
                    display_order: pos.display_order || (index + 1) * 10,
                    description: pos.description || null,
                    clause_content: pos.clause_content || null,
                    default_customer_position_override: customerPos,
                    default_provider_position_override: providerPos,
                    outcome_customer_position: outcomeCustomerPos,
                    outcome_provider_position: outcomeProviderPos,
                    default_weight_override: avgWeight,
                    is_required: true,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            })

            // Step 5: Insert template_clauses
            const { error: clausesError } = await supabase
                .from('template_clauses')
                .insert(templateClauses)

            if (clausesError) {
                // Rollback template if clauses fail
                await supabase
                    .from('contract_templates')
                    .delete()
                    .eq('template_id', templateId)

                throw new Error(`Failed to save template clauses: ${clausesError.message}`)
            }

            // --- Observability: Log template clauses saved ---
            eventLogger.completed('template_save', 'template_clauses_saved', {
                templateId,
                clauseCount: templateClauses.length,
                sessionId: session.sessionId
            })

            // Step 6: Success
            console.log('Template saved:', {
                sessionId: session.sessionId,
                templateId,
                templateName: saveTemplateName.trim(),
                clauseCount: templateClauses.length,
                source: sessionSource
            })

            setSaveTemplateResult({
                success: true,
                templateName: saveTemplateName.trim(),
                clauseCount: templateClauses.length
            })

            // --- Observability: Log save template completed ---
            eventLogger.completed('template_save', 'save_template_completed', {
                templateId,
                templateName: saveTemplateName.trim(),
                clauseCount: templateClauses.length,
                isTraining: session.isTraining,
                source: sessionSource
            })

            // Add CLARENCE chat message about the save
            const templateMessage: ClarenceChatMessage = {
                messageId: `msg-template-${Date.now()}`,
                sessionId: session.sessionId,
                sender: 'clarence',
                message: `\u2705 I've saved the negotiation outcome as a template: "${saveTemplateName.trim()}" with ${templateClauses.length} clauses. You can find it in your Contract Library under "My Templates" and use it to start new negotiations with the same clause structure and positions.`,
                createdAt: new Date().toISOString()
            }
            setChatMessages(prev => [...prev, templateMessage])

        } catch (error) {
            console.error('Save as template error:', error)
            setSaveTemplateResult({
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred'
            })

            // --- Observability: Log save template failed ---
            eventLogger.failed('template_save', 'save_template_completed',
                error instanceof Error ? error.message : 'Unknown error',
                'SAVE_FAILED'
            )
        } finally {
            setIsSavingTemplate(false)
        }
    }

    const closeSaveTemplateModal = () => {
        if (!isSavingTemplate) {
            setShowSaveTemplateModal(false)
            setSaveTemplateResult(null)
            setSaveTemplateName('')
            setSaveTemplateContractType('')
            setSaveTemplateDescription('')
        }
    }

    // ============================================================================
    // SECTION 11F: SAVE AS TEMPLATE MODAL
    // ============================================================================

    const SaveAsTemplateModal = () => {
        if (!showSaveTemplateModal) return null

        const isTraining = session?.isTraining || false
        const accentColor = isTraining ? 'amber' : 'emerald'

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                    {/* Header */}
                    <div className={`px-6 py-4 border-b border-slate-200 bg-gradient-to-r ${isTraining ? 'from-amber-50 to-orange-50' : 'from-emerald-50 to-teal-50'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isTraining ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                                <span className="text-xl">{isTraining ? '\u{1F393}' : '\u{1F4BE}'}</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">
                                    {isTraining ? 'Save Training Outcome as Template' : 'Save as Template'}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    Capture this {isTraining ? 'training outcome' : 'negotiation'} for reuse in future contracts
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5">
                        {/* Success State */}
                        {saveTemplateResult?.success ? (
                            <div className="text-center py-4">
                                <div className={`w-16 h-16 ${isTraining ? 'bg-amber-100' : 'bg-emerald-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                                    <span className="text-3xl">{'\u2705'}</span>
                                </div>
                                <h4 className="text-lg font-semibold text-slate-800 mb-2">Template Saved!</h4>
                                <p className="text-sm text-slate-600 mb-1">
                                    <span className="font-medium">&quot;{saveTemplateResult.templateName}&quot;</span>
                                </p>
                                <p className="text-sm text-slate-500 mb-6">
                                    {saveTemplateResult.clauseCount} clauses captured with agreed positions
                                </p>

                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => router.push('/auth/contracts')}
                                        className={`px-4 py-2 ${isTraining ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-lg font-medium transition`}
                                    >
                                        View in Template Library
                                    </button>
                                    <button
                                        onClick={closeSaveTemplateModal}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : saveTemplateResult?.error ? (
                            /* Error State */
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">{'\u274C'}</span>
                                </div>
                                <h4 className="text-lg font-semibold text-red-800 mb-2">Save Failed</h4>
                                <p className="text-sm text-red-600 mb-6">{saveTemplateResult.error}</p>

                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => {
                                            setSaveTemplateResult(null)
                                            handleSaveAsTemplate()
                                        }}
                                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition"
                                    >
                                        Try Again
                                    </button>
                                    <button
                                        onClick={closeSaveTemplateModal}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Form State */
                            <div className="space-y-4">
                                {/* Session Summary */}
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Session</span>
                                        <span className="font-mono text-slate-700">{session?.sessionNumber}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mt-1">
                                        <span className="text-slate-500">Parties</span>
                                        <span className="text-slate-700">{session?.customerCompany} vs {session?.providerCompany}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mt-1">
                                        <span className="text-slate-500">Alignment</span>
                                        <span className={`font-semibold ${(session?.alignmentPercentage || 0) >= 80 ? `text-${accentColor}-600` : 'text-amber-600'}`}>
                                            {session?.alignmentPercentage || 0}%
                                        </span>
                                    </div>
                                </div>

                                {/* Template Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Template Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={saveTemplateName}
                                        onChange={(e) => setSaveTemplateName(e.target.value)}
                                        placeholder="e.g., BPO Standard Terms - Agreed"
                                        maxLength={200}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        autoFocus
                                    />
                                    <p className="text-xs text-slate-400 mt-1">{saveTemplateName.length}/200 characters</p>
                                </div>

                                {/* Contract Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Contract Type
                                    </label>
                                    <select
                                        value={saveTemplateContractType}
                                        onChange={(e) => setSaveTemplateContractType(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                    >
                                        <option value="">Select type...</option>
                                        {CONTRACT_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Description <span className="text-slate-400">(optional)</span>
                                    </label>
                                    <textarea
                                        value={saveTemplateDescription}
                                        onChange={(e) => setSaveTemplateDescription(e.target.value)}
                                        placeholder="Notes about this template, e.g., includes agreed liability caps..."
                                        rows={3}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                                    />
                                </div>

                                {/* Info Box */}
                                <div className={`${isTraining ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
                                    <p className={`text-sm ${isTraining ? 'text-amber-800' : 'text-blue-800'}`}>
                                        <strong>What gets saved:</strong> All clause positions from this {isTraining ? 'training session' : 'negotiation'} will be captured as the template defaults. You can use this template to start new contracts with the same clause structure.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer - only show for form state */}
                    {!saveTemplateResult && (
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={closeSaveTemplateModal}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                disabled={isSavingTemplate}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAsTemplate}
                                disabled={isSavingTemplate || !saveTemplateName.trim()}
                                className={`px-6 py-2 ${isTraining
                                    ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                                    } text-white rounded-lg font-medium transition disabled:cursor-not-allowed flex items-center gap-2`}
                            >
                                {isSavingTemplate ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    '\u{1F4BE} Save Template'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 11G: RENDER
    // ============================================================================

    if (loading) {
        return <DocumentCentreLoading />
    }

    // For mediation mode, need session. For QC mode, need quickContract.
    const hasContext = mode === 'quick_contract' ? !!quickContract : !!session
    if (!hasContext || !userInfo) {
        return (
            <div className="h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">
                        {mode === 'quick_contract' ? 'Failed to load contract data' : 'Failed to load session data'}
                    </p>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="px-6 py-2 text-slate-600 hover:text-slate-800 transition"
                    >
                        \u2190 Return to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const readyCount = documents.filter(d => d.status === 'ready' || d.status === 'final').length
    const totalCount = documents.length
    const isCustomer = userInfo?.role === 'customer'
    const contextId = mode === 'quick_contract' ? (quickContract?.contractId || '') : (session?.sessionId || '')

    return (
        <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
            {/* Header */}
            <DocumentCentreHeader
                session={session}
                userInfo={userInfo}
                mode={mode}
                quickContract={quickContract}
                onBackToStudio={handleBackToStudio}
                roleContext={roleContext}
            />

            {/* Playbook Compliance Indicator — initiator only */}
            {playbookCompliance.isVisible && playbookCompliance.compliance && (
                <PlaybookComplianceIndicator
                    compliance={playbookCompliance.compliance}
                    playbookName={playbookCompliance.playbookName}
                    companyName={playbookCompliance.companyName}
                />
            )}

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: Document List */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col min-h-0">
                    {/* Progress Header */}
                    <div className="flex-shrink-0 p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-slate-800">Documents</h2>
                            <span className="text-sm text-slate-500">
                                {readyCount}/{totalCount} ready
                            </span>
                        </div>

                        {/* Overall Progress */}
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${totalCount > 0 ? (readyCount / totalCount) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Document List */}
                    <div className="flex-1 overflow-y-auto py-2">
                        {documents.map(doc => (
                            <DocumentListItem
                                key={doc.id}
                                document={doc}
                                isSelected={selectedDocument?.id === doc.id}
                                onClick={() => handleDocumentSelect(doc)}
                            />
                        ))}
                    </div>

                    {/* Evidence Package — compact bar with Generate All + Download */}
                    <EvidencePackageBar
                        documents={documents}
                        onDownload={handleDownloadPackage}
                        onGenerateAll={handleGenerateAll}
                        isDownloading={isGeneratingPackage}
                        isGeneratingAll={isGeneratingAll}
                        generatingAllProgress={generatingAllProgress}
                        isGeneratingDocument={isGeneratingDocument}
                    />

                    {/* Signing Panel — New Entity Confirmation flow (QC mode) */}
                    {mode === 'quick_contract' && (
                        <SigningPanelNew
                            status={signingState.status}
                            initiatorConfirmation={signingState.initiatorConfirmation}
                            respondentConfirmation={signingState.respondentConfirmation}
                            initiatorSignature={signingState.initiatorSignature}
                            respondentSignature={signingState.respondentSignature}
                            currentPartyRole={currentPartyRole}
                            contractDraftReady={documents.some(d => d.id === 'contract-draft' && d.status === 'ready')}
                            isContractCommitted={quickContract?.status === 'committed'}
                            onOpenEntityConfirmation={openEntityConfirmation}
                            onOpenSigningCeremony={openNewSigningCeremony}
                            initiatorLabel="Initiator"
                            respondentLabel="Respondent"
                        />
                    )}

                    {/* Legacy Signing Panel — Mediation mode (original simple flow) */}
                    {mode === 'mediation' && (
                        <SigningPanel
                            documents={documents}
                            signatures={signatures}
                            currentUserId={userInfo?.userId}
                            onSign={openSigningModal}
                            mode={mode}
                        />
                    )}

                    {/* Save as Template — Customers Only, Mediation mode only */}
                    {isCustomer && mode === 'mediation' && session && (
                        <div className="mx-3 mb-3">
                            <button
                                onClick={openSaveTemplateModal}
                                className={`w-full h-8 text-xs font-medium rounded-full transition flex items-center justify-center gap-1.5 ${session.isTraining
                                    ? 'border border-amber-300 text-amber-700 hover:bg-amber-50'
                                    : 'border border-violet-300 text-violet-700 hover:bg-violet-50'
                                }`}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Save as Template
                            </button>
                        </div>
                    )}
                </div>

                {/* CENTER PANEL: Document Action Hub */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <DocumentActionHub
                        document={selectedDocument}
                        session={session}
                        quickContract={quickContract}
                        onGenerate={handleGenerateDocument}
                        onDownload={handleDownloadDocument}
                        isGenerating={isGeneratingDocument}
                        playbookCompliance={playbookCompliance}
                        onRequestApproval={openApprovalModal}
                        approvalRequests={approvalRequests}
                        roleContext={roleContext}
                    />
                </div>

                {/* RIGHT PANEL: CLARENCE Chat */}
                <div className="w-96 border-l border-slate-200 flex flex-col overflow-hidden min-h-0">
                    <ClarenceChatPanel
                        sessionId={contextId}
                        selectedDocument={selectedDocument}
                        messages={chatMessages}
                        onSendMessage={handleSendChatMessage}
                        isLoading={isChatLoading}
                    />
                </div>
            </div>

            {/* Save as Template Modal */}
            <SaveAsTemplateModal />

            {/* Signing Ceremony Modal (legacy — mediation mode) */}
            <SigningModal
                show={showSigningModal}
                onClose={() => setShowSigningModal(false)}
                onSign={handleSignContract}
                isSigning={isSigning}
                isComputingHash={isComputingHash}
                contractHash={contractHash}
                userInfo={userInfo}
                companyName={mode === 'quick_contract'
                    ? (userInfo?.company || 'Unknown Company')
                    : (userInfo?.role === 'customer'
                        ? (session?.customerCompany || userInfo?.company || '')
                        : (session?.providerCompany || userInfo?.company || ''))
                }
                signingTitle={signingTitle}
                onTitleChange={setSigningTitle}
            />

            {/* Entity Confirmation Modal (new — QC mode) */}
            <EntityConfirmationModal
                show={showEntityConfirmationModal}
                onClose={() => setShowEntityConfirmationModal(false)}
                onConfirm={handleEntityConfirmation}
                initialData={entityFormInitialData}
                partyRole={currentPartyRole || 'initiator'}
                isSubmitting={isSubmittingConfirmation}
            />

            {/* New Signing Ceremony Modal (new — QC mode, after entity confirmation) */}
            <SigningCeremonyModal
                show={showNewSigningModal}
                onClose={() => setShowNewSigningModal(false)}
                onSign={handleNewSignContract}
                isSigning={isSigning}
                isComputingHash={isComputingHash}
                contractHash={contractHash}
                contractName={quickContract?.contractName || session?.customerCompany || 'Contract'}
                currentPartyRole={currentPartyRole || 'initiator'}
                initiatorConfirmation={signingState.initiatorConfirmation}
                respondentConfirmation={signingState.respondentConfirmation}
            />

            {/* Request Approval Modal */}
            <RequestApprovalModal
                show={showApprovalModal}
                onClose={() => { setShowApprovalModal(false); setApprovalDocumentTarget(null) }}
                onSubmit={handleSubmitApprovalRequest}
                documentName={approvalDocumentTarget?.name || ''}
                documentCategory={approvalDocumentTarget?.category || ''}
                isSubmitting={isSubmittingApproval}
            />

        </div>
    )
}

// ============================================================================
// SECTION 12: DEFAULT EXPORT WITH SUSPENSE
// ============================================================================

export default function DocumentCentrePage() {
    return (
        <Suspense fallback={<DocumentCentreLoading />}>
            <DocumentCentreContent />
        </Suspense>
    )
}