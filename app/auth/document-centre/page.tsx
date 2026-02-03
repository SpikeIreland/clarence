'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { eventLogger } from '@/lib/eventLogger'
import { createClient } from '@/lib/supabase'
import FeedbackButton from '@/app/components/FeedbackButton'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

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

// ============================================================================
// SECTION 2: CONSTANTS & CONFIGURATION
// ============================================================================

const N8N_BASE_URL = 'https://spikeislandstudios.app.n8n.cloud/webhook';

// Document generation endpoints
const DOCUMENT_ENDPOINTS: Record<string, string> = {
    'executive-summary': `${N8N_BASE_URL}/document-executive-summary`,
    'leverage-report': `${N8N_BASE_URL}/document-leverage-report`,
    'position-history': `${N8N_BASE_URL}/document-position-history`,
    'chat-transcript': `${N8N_BASE_URL}/document-chat-transcript`,
    'trade-off-register': `${N8N_BASE_URL}/document-trade-off-register`,
    'timeline-audit': `${N8N_BASE_URL}/document-timeline-audit`,
    'contract-draft': `${N8N_BASE_URL}/document-contract-draft`,
    'contract-roadmap': `${N8N_BASE_URL}/document-contract-roadmap`,
};

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook';

const DOCUMENT_DEFINITIONS: Omit<DocumentItem, 'status' | 'generatedAt' | 'downloadUrl' | 'progress' | 'documentDbId'>[] = [
    {
        id: 'executive-summary',
        name: 'Executive Summary',
        description: 'One-page overview of the negotiation outcome for leadership sign-off',
        category: 'assessment',
        icon: '📋',
        prerequisites: []
    },
    {
        id: 'leverage-report',
        name: 'Leverage Assessment Report',
        description: 'Detailed breakdown of how leverage was calculated and applied',
        category: 'assessment',
        icon: '⚖️',
        prerequisites: []
    },
    {
        id: 'position-history',
        name: 'Position Movement History',
        description: 'Complete record of how each clause evolved during negotiation',
        category: 'negotiation',
        icon: '📊',
        prerequisites: []
    },
    {
        id: 'chat-transcript',
        name: 'Chat Transcript',
        description: 'All party communications and CLARENCE conversations',
        category: 'negotiation',
        icon: '💬',
        prerequisites: []
    },
    {
        id: 'trade-off-register',
        name: 'Trade-Off Register',
        description: 'Formal record of all linked concessions and exchanges',
        category: 'negotiation',
        icon: '🔄',
        prerequisites: []
    },
    {
        id: 'timeline-audit',
        name: 'Timeline & Audit Log',
        description: 'Chronological record of every event in the negotiation',
        category: 'negotiation',
        icon: '📅',
        prerequisites: []
    },
    {
        id: 'contract-draft',
        name: 'Contract Draft',
        description: 'Complete clause-by-clause agreement ready for signature',
        category: 'agreement',
        icon: '📄',
        prerequisites: ['executive-summary']
    },
    {
        id: 'contract-roadmap',
        name: 'Contract Roadmap',
        description: 'Governance guide for managing the contract relationship',
        category: 'governance',
        icon: '🗺️',
        prerequisites: ['contract-draft']
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
        case 'locked': return '🔒'
        case 'generating': return '⏳'
        case 'in_progress': return '📝'
        case 'ready': return '✅'
        case 'final': return '🎯'
        default: return '○'
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
    if (!value) return '£0'
    const num = typeof value === 'string' ? parseFloat(value) : value
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
    if (num >= 1000000) {
        return `${symbol}${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
        return `${symbol}${(num / 1000).toFixed(0)}K`
    }
    return `${symbol}${num.toFixed(0)}`
}

// ============================================================================
// SECTION 4: LOADING COMPONENT
// ============================================================================

function DocumentCentreLoading() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
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
    isGenerating: boolean
}

function EvidencePackageCard({ documents, onDownload, isGenerating }: EvidencePackageProps) {
    const readyCount = documents.filter(d => d.status === 'ready' || d.status === 'final').length
    const totalCount = documents.length
    const isUnlocked = readyCount === totalCount

    return (
        <div className={`mx-4 mb-4 p-4 rounded-xl border-2 ${isUnlocked
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300'
            : 'bg-slate-50 border-slate-200'
            }`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isUnlocked ? 'bg-emerald-100' : 'bg-slate-200'
                    }`}>
                    📦
                </div>
                <div className="flex-1">
                    <h3 className={`font-semibold ${isUnlocked ? 'text-emerald-800' : 'text-slate-600'}`}>
                        Evidence Package
                    </h3>
                    <p className="text-xs text-slate-500">
                        {isUnlocked
                            ? 'All documents ready - download complete package'
                            : `${readyCount}/${totalCount} documents ready`
                        }
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
                <div
                    className={`h-full transition-all duration-500 ${isUnlocked ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                    style={{ width: `${(readyCount / totalCount) * 100}%` }}
                />
            </div>

            {/* Download Button */}
            <button
                onClick={onDownload}
                disabled={!isUnlocked || isGenerating}
                className={`w-full py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 ${isUnlocked && !isGenerating
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
            >
                {isGenerating ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating Package...
                    </>
                ) : isUnlocked ? (
                    <>
                        <span>⬇️</span>
                        Download ZIP Package
                    </>
                ) : (
                    <>
                        <span>🔒</span>
                        Complete All Documents First
                    </>
                )}
            </button>
        </div>
    )
}

// ============================================================================
// SECTION 7: DOCUMENT PREVIEW PANEL COMPONENT
// ============================================================================

interface DocumentPreviewProps {
    document: DocumentItem | null
    session: Session | null
    onGenerate: (docId: DocumentId) => void
    onDownload: (docId: DocumentId, format: 'pdf' | 'docx') => void
    isGenerating: boolean
}

function DocumentPreviewPanel({ document, session, onGenerate, onDownload, isGenerating }: DocumentPreviewProps) {
    if (!document) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
                <div className="text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">📋</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Document</h3>
                    <p className="text-slate-500 max-w-sm">
                        Choose a document from the list to preview, generate, or download.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Document Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                            {document.icon}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">{document.name}</h2>
                            <p className="text-sm text-slate-500">{document.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(document.status)}`}>
                            {getStatusIcon(document.status)} {getStatusLabel(document.status)}
                        </span>

                        {/* Action Buttons */}
                        {document.status === 'in_progress' && (
                            <button
                                onClick={() => onGenerate(document.id)}
                                disabled={isGenerating}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                            >
                                {isGenerating ? 'Generating...' : '⚡ Generate'}
                            </button>
                        )}

                        {document.status === 'ready' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onGenerate(document.id)}
                                    disabled={isGenerating}
                                    className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm transition"
                                >
                                    🔄 Regenerate
                                </button>
                                <button
                                    onClick={() => onDownload(document.id, 'pdf')}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
                                >
                                    ⬇️ Download PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Document Content / Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                    {document.status === 'generating' && (
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
                    )}

                    {document.status !== 'generating' && (
                        <DocumentContentPreview document={document} session={session} />
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 8: DOCUMENT VIEW SUB-COMPONENTS
// ============================================================================

function DocumentContentPreview({ document, session }: { document: DocumentItem; session: Session | null }) {
    switch (document.id) {
        case 'executive-summary':
            return (
                <div className="prose prose-sm max-w-none">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">📋 EXECUTIVE SUMMARY</h1>
                        <p className="text-slate-500">Negotiation Outcome for {session?.customerCompany} & {session?.providerCompany}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-emerald-50 rounded-lg">
                            <div className="text-xs text-emerald-600 mb-1">Customer</div>
                            <div className="font-semibold text-emerald-800">{session?.customerCompany}</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <div className="text-xs text-blue-600 mb-1">Provider</div>
                            <div className="font-semibold text-blue-800">{session?.providerCompany}</div>
                        </div>
                    </div>
                    <div className="text-center p-6 bg-slate-50 rounded-lg">
                        <div className="text-4xl font-bold text-emerald-600">{session?.alignmentPercentage || 0}%</div>
                        <div className="text-sm text-slate-500 mt-1">Overall Alignment</div>
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
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">📄 CONTRACT DRAFT</h1>
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
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">🗺️ CONTRACT ROADMAP</h1>
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
    onBackToStudio: () => void
}

function DocumentCentreHeader({ session, userInfo, onBackToStudio }: DocumentCentreHeaderProps) {
    const isCustomer = userInfo?.role === 'customer'

    return (
        <div className="bg-slate-800 text-white">
            {/* Navigation Row */}
            <div className="px-6 py-2 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    {/* Left: Back to Studio */}
                    <button
                        onClick={onBackToStudio}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-sm">Contract Studio</span>
                    </button>

                    {/* Center: Title */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white tracking-wide">CLARENCE</span>
                                <span className="font-semibold text-violet-400">Agree</span>
                            </div>
                            <span className="text-slate-500 text-xs">The Honest Broker</span>
                        </div>
                    </div>

                    {/* Right: User Info */}
                    <div className="text-right">
                        <div className="text-sm text-slate-300">
                            {userInfo?.firstName} {userInfo?.lastName}
                        </div>
                        <div className="text-xs text-slate-500">
                            {isCustomer ? 'Customer' : 'Provider'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Session Context Row */}
            <div className="px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Customer */}
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-400" />
                        <div>
                            <div className="text-xs text-slate-400">Customer</div>
                            <div className="text-sm font-medium text-emerald-400">{session?.customerCompany || '—'}</div>
                        </div>
                    </div>

                    {/* Center: Session Details */}
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <div className="text-xs text-slate-400">Session</div>
                            <div className="text-sm font-mono text-white">{session?.sessionNumber || '—'}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-400">Deal Value</div>
                            <div className="text-sm font-semibold text-emerald-400">{session?.dealValue || '—'}</div>
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

                    {/* Provider */}
                    <div className="flex items-center gap-3">
                        <div>
                            <div className="text-xs text-slate-400">Provider</div>
                            <div className="text-sm font-medium text-blue-400">{session?.providerCompany || '—'}</div>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-blue-400" />
                    </div>
                </div>
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
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [documents, setDocuments] = useState<DocumentItem[]>([])
    const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null)
    const [chatMessages, setChatMessages] = useState<ClarenceChatMessage[]>([])
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [isGeneratingDocument, setIsGeneratingDocument] = useState(false)
    const [isGeneratingPackage, setIsGeneratingPackage] = useState(false)

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

    const initializeDocuments = useCallback((session: Session): DocumentItem[] => {
        return DOCUMENT_DEFINITIONS.map(def => {
            let status: DocumentStatus = 'locked'
            let progress = 0

            const prerequisitesMet = def.prerequisites.every(prereqId => {
                return false
            })

            if (def.prerequisites.length === 0) {
                status = 'in_progress'
                progress = 0
            } else if (prerequisitesMet) {
                status = 'in_progress'
                progress = 0
            } else {
                status = 'locked'
            }

            // If alignment is high, some docs might be ready
            if (session.alignmentPercentage >= 50) {
                if (def.id === 'executive-summary' || def.id === 'leverage-report') {
                    status = 'ready'
                    progress = 100
                }
            }

            return {
                ...def,
                status,
                progress,
                generatedAt: status === 'ready' ? new Date().toISOString() : undefined,
                downloadUrl: undefined
            }
        })
    }, [])

    // Initial Load
    useEffect(() => {
        const init = async () => {
            const user = loadUserInfo()
            if (!user) return

            setUserInfo(user)

            const sessionId = searchParams.get('session_id') || searchParams.get('session')
            if (!sessionId) {
                router.push('/auth/contracts-dashboard')
                return
            }

            const sessionData = await loadSessionData(sessionId)
            if (sessionData) {
                setSession(sessionData)
                const docs = initializeDocuments(sessionData)
                setDocuments(docs)

                // Auto-select first available document
                const firstAvailable = docs.find(d => d.status !== 'locked')
                if (firstAvailable) {
                    setSelectedDocument(firstAvailable)
                }

                // Add welcome message
                setChatMessages([{
                    messageId: 'welcome-1',
                    sessionId: sessionId,
                    sender: 'clarence',
                    message: `Welcome to the Document Centre. I'm here to help you prepare all documentation for the ${sessionData.customerCompany} and ${sessionData.providerCompany} negotiation.\n\nYou can generate individual documents or ask me questions about any of them. When all documents are ready, you'll be able to download the complete Evidence Package.`,
                    createdAt: new Date().toISOString()
                }])

                // Log page view
                eventLogger.setSession(sessionId)
                eventLogger.setUser(user.userId || '')
                eventLogger.completed('documentation', 'document_centre_loaded', {
                    sessionId,
                    alignmentPercentage: sessionData.alignmentPercentage
                })
            }

            setLoading(false)
        }

        init()
    }, [loadUserInfo, loadSessionData, initializeDocuments, searchParams, router])

    // ============================================================================
    // SECTION 11C: EVENT HANDLERS
    // ============================================================================

    const handleDocumentSelect = (doc: DocumentItem) => {
        if (doc.status !== 'locked') {
            setSelectedDocument(doc)
        }
    }

    // ============================================================================
    // SECTION 11D: GENERATE DOCUMENT HANDLER
    // ============================================================================

    const handleGenerateDocument = async (documentId: string) => {
        if (!session || !userInfo) {
            console.error('Missing session or user info');
            return;
        }

        const endpoint = DOCUMENT_ENDPOINTS[documentId];
        if (!endpoint) {
            console.error(`No endpoint configured for document: ${documentId}`);
            return;
        }

        // Update document status to generating
        setDocuments(prev => prev.map(doc =>
            doc.id === documentId
                ? { ...doc, status: 'generating' as DocumentStatus, progress: 0 }
                : doc
        ));
        setIsGeneratingDocument(true);

        // Add CLARENCE message
        const generatingMessage: ClarenceChatMessage = {
            messageId: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            sender: 'clarence',
            message: `I'm generating the ${documentId.replace(/-/g, ' ')} now. This typically takes 15-30 seconds...`,
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
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    user_id: userInfo.userId,
                    provider_id: session.providerId,
                    format: 'pdf',
                    regenerate: false
                })
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Update document with result
                setDocuments(prev => prev.map(doc =>
                    doc.id === documentId
                        ? {
                            ...doc,
                            status: 'ready' as DocumentStatus,
                            progress: 100,
                            downloadUrl: result.downloads?.pdf || result.pdf_public_url,
                            generatedAt: result.generated_at,
                            documentDbId: result.document_id
                        }
                        : doc
                ));

                // Success message from CLARENCE
                const successMessage: ClarenceChatMessage = {
                    messageId: `msg-${Date.now()}`,
                    sessionId: session.sessionId,
                    sender: 'clarence',
                    message: `✅ Your ${documentId.replace(/-/g, ' ')} is ready! Click the download button to get your PDF.`,
                    createdAt: new Date().toISOString()
                };
                setChatMessages(prev => [...prev, successMessage]);

                // Update selected document if it's the one we just generated
                if (selectedDocument?.id === documentId) {
                    setSelectedDocument(prev => prev ? {
                        ...prev,
                        status: 'ready' as DocumentStatus,
                        downloadUrl: result.downloads?.pdf || result.pdf_public_url
                    } : null);
                }

            } else {
                throw new Error(result.error || 'Generation failed');
            }

        } catch (error) {
            clearInterval(progressInterval);
            console.error('Document generation error:', error);

            // Update document status to show error
            setDocuments(prev => prev.map(doc =>
                doc.id === documentId
                    ? { ...doc, status: 'in_progress' as DocumentStatus, progress: 0 }
                    : doc
            ));

            // Error message from CLARENCE
            const errorMessage: ClarenceChatMessage = {
                messageId: `msg-${Date.now()}`,
                sessionId: session.sessionId,
                sender: 'clarence',
                message: `❌ Sorry, I encountered an error generating the document: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                createdAt: new Date().toISOString()
            };
            setChatMessages(prev => [...prev, errorMessage]);

        } finally {
            setIsGeneratingDocument(false);
        }
    };

    const handleDownloadDocument = async (docId: string, format: 'pdf' | 'docx') => {
        const doc = documents.find(d => d.id === docId)

        if (!doc?.downloadUrl) {
            console.error('No download URL available for document:', docId)

            const errorMessage: ClarenceChatMessage = {
                messageId: `msg-${Date.now()}`,
                sessionId: session?.sessionId || '',
                sender: 'clarence',
                message: `❌ Sorry, the download URL for this document isn't available. Try regenerating the document.`,
                createdAt: new Date().toISOString()
            }
            setChatMessages(prev => [...prev, errorMessage])
            return
        }

        if (format === 'pdf') {
            window.open(doc.downloadUrl, '_blank')
        } else if (format === 'docx') {
            const infoMessage: ClarenceChatMessage = {
                messageId: `msg-${Date.now()}`,
                sessionId: session?.sessionId || '',
                sender: 'clarence',
                message: `📘 DOCX format is coming soon. For now, please download the PDF version.`,
                createdAt: new Date().toISOString()
            }
            setChatMessages(prev => [...prev, infoMessage])
        }
    }

    const handleDownloadPackage = async () => {
        if (!session) return

        setIsGeneratingPackage(true)

        try {
            // TODO: Call API to generate and download package
            await new Promise(resolve => setTimeout(resolve, 2000))
            alert('Evidence Package download - Coming soon!')
        } catch (error) {
            console.error('Error downloading package:', error)
        } finally {
            setIsGeneratingPackage(false)
        }
    }

    const handleSendChatMessage = async (message: string) => {
        if (!session) return

        const userMessage: ClarenceChatMessage = {
            messageId: `user-${Date.now()}`,
            sessionId: session.sessionId,
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
                sessionId: session.sessionId,
                sender: 'clarence',
                message: `I understand you're asking about "${message}". I can help you with document generation, explain what each document contains, or answer questions about the negotiation outcome. What would you like to know?`,
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
        const sessionId = searchParams.get('session_id') || searchParams.get('session')
        router.push(`/auth/contract-studio?session_id=${sessionId}`)
    }

    // ============================================================================
    // SECTION 11E: SAVE AS TEMPLATE HANDLER
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

            // Step 4: Map session_clause_positions to template_clauses
            // UPDATED: Use ORIGINAL positions as template defaults (starting positions)
            // and store final positions separately for training comparison
            const templateClauses = positionsData.map((pos: Record<string, unknown>, index: number) => {
                // Starting positions — used when creating new sessions from this template
                const customerPos = pos.original_customer_position
                    ? parseFloat(String(pos.original_customer_position))
                    : (pos.customer_position ? parseFloat(String(pos.customer_position)) : 5)
                const providerPos = pos.original_provider_position
                    ? parseFloat(String(pos.original_provider_position))
                    : (pos.provider_position ? parseFloat(String(pos.provider_position)) : 5)

                // Final/outcome positions — for training comparison ("you achieved X, actual was Y")
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

            // Add CLARENCE chat message about the save
            const templateMessage: ClarenceChatMessage = {
                messageId: `msg-template-${Date.now()}`,
                sessionId: session.sessionId,
                sender: 'clarence',
                message: `✅ I've saved the negotiation outcome as a template: "${saveTemplateName.trim()}" with ${templateClauses.length} clauses. You can find it in your Contract Library under "My Templates" and use it to start new negotiations with the same clause structure and positions.`,
                createdAt: new Date().toISOString()
            }
            setChatMessages(prev => [...prev, templateMessage])

        } catch (error) {
            console.error('Save as template error:', error)
            setSaveTemplateResult({
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred'
            })
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
                                <span className="text-xl">{isTraining ? '🎓' : '💾'}</span>
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
                                    <span className="text-3xl">✅</span>
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
                                    <span className="text-3xl">❌</span>
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
                                    '💾 Save Template'
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

    if (!session || !userInfo) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">Failed to load session data</p>
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="px-6 py-2 text-slate-600 hover:text-slate-800 transition"
                    >
                        ← Return to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    const readyCount = documents.filter(d => d.status === 'ready' || d.status === 'final').length
    const totalCount = documents.length
    const isCustomer = userInfo?.role === 'customer'

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <DocumentCentreHeader
                session={session}
                userInfo={userInfo}
                onBackToStudio={handleBackToStudio}
            />

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL: Document List */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
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
                                style={{ width: `${(readyCount / totalCount) * 100}%` }}
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

                    {/* Evidence Package Card */}
                    <EvidencePackageCard
                        documents={documents}
                        onDownload={handleDownloadPackage}
                        isGenerating={isGeneratingPackage}
                    />

                    {/* Save as Template Card - Customers Only */}
                    {isCustomer && (
                        <div className={`mx-4 mb-4 p-4 rounded-xl border-2 ${session.isTraining
                            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
                            : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200'
                            }`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${session.isTraining ? 'bg-amber-100' : 'bg-violet-100'
                                    }`}>
                                    {session.isTraining ? '🎓' : '💾'}
                                </div>
                                <div className="flex-1">
                                    <h3 className={`font-semibold text-sm ${session.isTraining ? 'text-amber-800' : 'text-violet-800'}`}>
                                        Save as Template
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Reuse this clause structure
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={openSaveTemplateModal}
                                className={`w-full py-2 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2 ${session.isTraining
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                                    }`}
                            >
                                💾 Save Outcome as Template
                            </button>
                        </div>
                    )}
                </div>

                {/* CENTER PANEL: Document Preview */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <DocumentPreviewPanel
                        document={selectedDocument}
                        session={session}
                        onGenerate={handleGenerateDocument}
                        onDownload={handleDownloadDocument}
                        isGenerating={isGeneratingDocument}
                    />
                </div>

                {/* RIGHT PANEL: CLARENCE Chat */}
                <div className="w-96 border-l border-slate-200">
                    <ClarenceChatPanel
                        sessionId={session.sessionId}
                        selectedDocument={selectedDocument}
                        messages={chatMessages}
                        onSendMessage={handleSendChatMessage}
                        isLoading={isChatLoading}
                    />
                </div>
            </div>

            {/* Save as Template Modal */}
            <SaveAsTemplateModal />

            {/* Beta Feedback Button */}
            <FeedbackButton position="bottom-left" />
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