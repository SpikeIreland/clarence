'use client'

// ============================================================================
// CLARENCE CONTRACT LIBRARY PAGE - WP6
// ============================================================================
// File: /app/auth/contracts/page.tsx
// Purpose: Template library for reusable contract configurations
// 
// WP6 CHANGES:
// 1. Renamed from "Contract Studio" to "Contract Library"
// 2. Three sections: System Templates, Company Templates, My Templates
// 3. Data source changed from uploaded_contracts to contract_templates
// 4. "Use Template" now pre-fills Create Contract flow
// 5. Proper empty states for each section
// 6. Upload moved to "My Templates" section
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import AuthenticatedHeader from '@/components/AuthenticatedHeader'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName?: string
    lastName?: string
    email?: string
    company?: string
    role?: string
    userId?: string
    companyId?: string
}

interface ContractTemplate {
    templateId: string
    templateCode: string
    templateName: string
    description: string
    industry: string | null
    contractType: string
    clauseCount: number
    version: number
    timesUsed: number
    lastUsedAt: string | null
    createdAt: string
    updatedAt: string
    // Scope indicators
    isSystem: boolean
    isPublic: boolean
    isActive: boolean
    companyId: string | null
    createdByUserId: string | null
    sourceSessionId: string | null
}

interface TemplateSection {
    id: 'system' | 'company' | 'user'
    title: string
    icon: string
    description: string
    templates: ContractTemplate[]
    isCollapsed: boolean
    canEdit: boolean
    canDelete: boolean
    emptyMessage: string
    emptySubMessage: string
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_ICONS: Record<string, string> = {
    'bpo': '🏢',
    'saas': '☁️',
    'nda': '🔒',
    'msa': '📋',
    'employment': '👔',
    'it_services': '💻',
    'consulting': '💼',
    'custom': '📄',
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    'bpo': 'BPO Agreement',
    'saas': 'SaaS Agreement',
    'nda': 'Non-Disclosure Agreement',
    'msa': 'Master Service Agreement',
    'employment': 'Employment Contract',
    'it_services': 'IT Services Agreement',
    'consulting': 'Consulting Agreement',
    'custom': 'Custom Contract',
}

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function ContractLibraryPage() {
    const router = useRouter()
    const supabase = createClient()

    // ==========================================================================
    // SECTION 4: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [loading, setLoading] = useState(true)

    // Template sections
    const [sections, setSections] = useState<TemplateSection[]>([
        {
            id: 'system',
            title: 'System Templates',
            icon: '🌐',
            description: 'Standard templates provided by CLARENCE',
            templates: [],
            isCollapsed: false,
            canEdit: false,
            canDelete: false,
            emptyMessage: 'No system templates available',
            emptySubMessage: 'System templates will appear here when added by CLARENCE'
        },
        {
            id: 'company',
            title: 'Company Templates',
            icon: '🏢',
            description: 'Managed by your Company Administrator',
            templates: [],
            isCollapsed: false,
            canEdit: false,
            canDelete: false,
            emptyMessage: 'No company templates yet',
            emptySubMessage: 'Your administrator can add company-wide templates from the Admin Panel'
        },
        {
            id: 'user',
            title: 'My Templates',
            icon: '👤',
            description: 'Created from your completed negotiations',
            templates: [],
            isCollapsed: false,
            canEdit: true,
            canDelete: true,
            emptyMessage: 'No templates yet',
            emptySubMessage: 'When you complete a negotiation, you can save it as a reusable template'
        }
    ])

    // View state
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')

    // ==========================================================================
    // SECTION 5: AUTHENTICATION & DATA LOADING
    // ==========================================================================

    const loadUserInfo = useCallback(async () => {
        const auth = localStorage.getItem('clarence_auth')
        if (!auth) {
            router.push('/auth/login')
            return null
        }

        const authData = JSON.parse(auth)
        setUserInfo(authData.userInfo)
        return authData.userInfo
    }, [router])

    const loadTemplates = useCallback(async (user: UserInfo) => {
        try {
            // Fetch all templates in one query, then filter client-side
            const { data, error } = await supabase
                .from('contract_templates')
                .select('*')
                .eq('is_active', true)
                .order('template_name', { ascending: true })

            if (error) {
                console.error('Error loading templates:', error)
                return
            }

            const allTemplates: ContractTemplate[] = (data || []).map(t => ({
                templateId: t.template_id,
                templateCode: t.template_code || '',
                templateName: t.template_name,
                description: t.description || '',
                industry: t.industry,
                contractType: t.contract_type || 'custom',
                clauseCount: t.clause_count || 0,
                version: t.version || 1,
                timesUsed: t.times_used || 0,
                lastUsedAt: t.last_used_at,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
                isSystem: t.is_system || false,
                isPublic: t.is_public || false,
                isActive: t.is_active,
                companyId: t.company_id,
                createdByUserId: t.created_by_user_id,
                sourceSessionId: t.source_session_id
            }))

            // Categorize templates
            const systemTemplates = allTemplates.filter(t => t.isSystem)
            const companyTemplates = allTemplates.filter(t =>
                !t.isSystem &&
                t.isPublic &&
                t.companyId === user.companyId
            )
            const userTemplates = allTemplates.filter(t =>
                !t.isSystem &&
                !t.isPublic &&
                t.createdByUserId === user.userId
            )

            setSections(prev => prev.map(section => {
                if (section.id === 'system') return { ...section, templates: systemTemplates }
                if (section.id === 'company') return { ...section, templates: companyTemplates }
                if (section.id === 'user') return { ...section, templates: userTemplates }
                return section
            }))

        } catch (error) {
            console.error('Error loading templates:', error)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        const init = async () => {
            const user = await loadUserInfo()
            if (user) {
                await loadTemplates(user)
            }
        }
        init()
    }, [loadUserInfo, loadTemplates])

    // ==========================================================================
    // SECTION 6: SIGN OUT
    // ==========================================================================

    async function handleSignOut() {
        try {
            await supabase.auth.signOut()
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        } catch (error) {
            console.error('Sign out error:', error)
            localStorage.removeItem('clarence_auth')
            router.push('/auth/login')
        }
    }

    // ==========================================================================
    // SECTION 7: TEMPLATE ACTIONS
    // ==========================================================================

    const handleUseTemplate = (template: ContractTemplate) => {
        eventLogger.started('contract_library', 'use_template', {
            templateId: template.templateId,
            templateName: template.templateName,
            contractType: template.contractType
        })

        // Navigate to create-contract with pre-filled template data
        const params = new URLSearchParams({
            template_source: 'existing_template',
            source_template_id: template.templateId,
            contract_type: template.contractType,
            template_name: template.templateName
        })

        router.push(`/auth/create-contract?${params.toString()}`)
    }

    const handleViewTemplate = (template: ContractTemplate) => {
        setSelectedTemplate(template)
        setShowTemplateModal(true)
    }

    const handleEditTemplate = (template: ContractTemplate) => {
        // Navigate to template editor (contract-prep in edit mode)
        router.push(`/auth/contract-prep?template_id=${template.templateId}&mode=edit`)
    }

    const handleDeleteTemplate = async (templateId: string) => {
        if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('contract_templates')
                .update({ is_active: false })
                .eq('template_id', templateId)

            if (error) throw error

            // Refresh templates
            if (userInfo) {
                await loadTemplates(userInfo)
            }

            eventLogger.completed('contract_library', 'delete_template', { templateId })
        } catch (error) {
            console.error('Error deleting template:', error)
            alert('Failed to delete template. Please try again.')
        }
    }

    const toggleSectionCollapse = (sectionId: string) => {
        setSections(prev => prev.map(section =>
            section.id === sectionId
                ? { ...section, isCollapsed: !section.isCollapsed }
                : section
        ))
    }

    // ==========================================================================
    // SECTION 8: HELPER FUNCTIONS
    // ==========================================================================

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const getContractTypeIcon = (type: string) => {
        return CONTRACT_TYPE_ICONS[type?.toLowerCase()] || '📄'
    }

    const getContractTypeLabel = (type: string) => {
        return CONTRACT_TYPE_LABELS[type?.toLowerCase()] || type || 'Contract'
    }

    const getTotalTemplateCount = () => {
        return sections.reduce((sum, section) => sum + section.templates.length, 0)
    }

    const filterTemplates = (templates: ContractTemplate[]) => {
        if (!searchQuery.trim()) return templates
        const query = searchQuery.toLowerCase()
        return templates.filter(t =>
            t.templateName.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query) ||
            t.contractType?.toLowerCase().includes(query)
        )
    }

    // ==========================================================================
    // SECTION 9: RENDER - TEMPLATE CARD
    // ==========================================================================

    const renderTemplateCard = (template: ContractTemplate, section: TemplateSection) => (
        <div
            key={template.templateId}
            className="bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden group"
        >
            {/* Card Header */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-xl">
                            {getContractTypeIcon(template.contractType)}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                                {template.templateName}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {getContractTypeLabel(template.contractType)}
                            </p>
                        </div>
                    </div>
                    {template.isSystem && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Official
                        </span>
                    )}
                </div>
                {template.description && (
                    <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
                )}
            </div>

            {/* Card Stats */}
            <div className="px-5 py-3 bg-slate-50 grid grid-cols-3 gap-2 text-center">
                <div>
                    <div className="text-lg font-semibold text-slate-800">{template.clauseCount || '—'}</div>
                    <div className="text-xs text-slate-500">Clauses</div>
                </div>
                <div>
                    <div className="text-lg font-semibold text-slate-800">{template.timesUsed}</div>
                    <div className="text-xs text-slate-500">Uses</div>
                </div>
                <div>
                    <div className="text-xs font-medium text-slate-600">v{template.version}</div>
                    <div className="text-xs text-slate-500">Version</div>
                </div>
            </div>

            {/* Card Actions */}
            <div className="p-4 flex gap-2">
                <button
                    onClick={() => handleViewTemplate(template)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                    Preview
                </button>
                <button
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1 py-2 px-3 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                    Use Template
                </button>
                {section.canEdit && (
                    <button
                        onClick={() => handleEditTemplate(template)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Edit template"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                )}
                {section.canDelete && (
                    <button
                        onClick={() => handleDeleteTemplate(template.templateId)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete template"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )

    // ==========================================================================
    // SECTION 10: RENDER - SECTION COMPONENT
    // ==========================================================================

    const renderSection = (section: TemplateSection) => {
        const filteredTemplates = filterTemplates(section.templates)
        const isEmpty = filteredTemplates.length === 0

        return (
            <div key={section.id} className="mb-8">
                {/* Section Header */}
                <button
                    onClick={() => toggleSectionCollapse(section.id)}
                    className="w-full flex items-center justify-between p-4 bg-white rounded-t-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{section.icon}</span>
                        <div className="text-left">
                            <h2 className="font-semibold text-slate-800">{section.title}</h2>
                            <p className="text-sm text-slate-500">{section.description}</p>
                        </div>
                        <span className="ml-3 px-2.5 py-0.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-full">
                            {section.templates.length}
                        </span>
                    </div>
                    <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${section.isCollapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Section Content */}
                {!section.isCollapsed && (
                    <div className="border border-t-0 border-slate-200 rounded-b-xl bg-slate-50/50 p-6">
                        {isEmpty ? (
                            /* Empty State */
                            <div className="text-center py-8">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-xl opacity-50">{section.icon}</span>
                                </div>
                                <p className="text-slate-600 font-medium mb-1">{section.emptyMessage}</p>
                                <p className="text-sm text-slate-400 mb-4">{section.emptySubMessage}</p>
                                {section.id === 'user' && (
                                    <Link
                                        href="/auth/contracts-dashboard"
                                        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                                    >
                                        Or start from a System Template →
                                    </Link>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            /* Grid View */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTemplates.map(template => renderTemplateCard(template, section))}
                            </div>
                        ) : (
                            /* List View */
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Template</th>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                            <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Clauses</th>
                                            <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Uses</th>
                                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredTemplates.map(template => (
                                            <tr key={template.templateId} className="hover:bg-slate-50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl">{getContractTypeIcon(template.contractType)}</span>
                                                        <div>
                                                            <div className="font-medium text-slate-800 text-sm">{template.templateName}</div>
                                                            {template.description && (
                                                                <div className="text-xs text-slate-400 truncate max-w-xs">{template.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {getContractTypeLabel(template.contractType)}
                                                </td>
                                                <td className="px-6 py-4 text-center text-sm text-slate-600">{template.clauseCount || '—'}</td>
                                                <td className="px-6 py-4 text-center text-sm text-slate-600">{template.timesUsed}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => handleViewTemplate(template)}
                                                            className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                                                        >
                                                            Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleUseTemplate(template)}
                                                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                                                        >
                                                            Use
                                                        </button>
                                                        {section.canEdit && (
                                                            <button
                                                                onClick={() => handleEditTemplate(template)}
                                                                className="text-slate-400 hover:text-emerald-600"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                        {section.canDelete && (
                                                            <button
                                                                onClick={() => handleDeleteTemplate(template.templateId)}
                                                                className="text-slate-400 hover:text-red-600"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // ==========================================================================
    // SECTION 11: RENDER - TEMPLATE PREVIEW MODAL
    // ==========================================================================

    const renderTemplateModal = () => {
        if (!showTemplateModal || !selectedTemplate) return null

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{getContractTypeIcon(selectedTemplate.contractType)}</span>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">{selectedTemplate.templateName}</h2>
                                <p className="text-sm text-slate-500">{getContractTypeLabel(selectedTemplate.contractType)}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-auto p-6">
                        {/* Description */}
                        {selectedTemplate.description && (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">Description</h3>
                                <p className="text-slate-600">{selectedTemplate.description}</p>
                            </div>
                        )}

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-emerald-600">{selectedTemplate.clauseCount || '—'}</div>
                                <div className="text-sm text-slate-500">Clauses included</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-slate-700">{selectedTemplate.timesUsed}</div>
                                <div className="text-sm text-slate-500">Times used</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-slate-700">{formatDate(selectedTemplate.createdAt)}</div>
                                <div className="text-sm text-slate-500">Created</div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="text-sm font-medium text-slate-700">v{selectedTemplate.version}</div>
                                <div className="text-sm text-slate-500">Version</div>
                            </div>
                        </div>

                        {/* Industry */}
                        {selectedTemplate.industry && (
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">Industry</h3>
                                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                                    {selectedTemplate.industry}
                                </span>
                            </div>
                        )}

                        {/* System Template Badge */}
                        {selectedTemplate.isSystem && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 text-blue-700">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <span className="font-medium">Official CLARENCE Template</span>
                                </div>
                                <p className="text-sm text-blue-600 mt-1">
                                    This template is maintained by CLARENCE and represents industry best practices.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                setShowTemplateModal(false)
                                handleUseTemplate(selectedTemplate)
                            }}
                            className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                        >
                            Use This Template →
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 12: MAIN RENDER
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 13: HEADER */}
            {/* ================================================================== */}

            <AuthenticatedHeader
                userInfo={userInfo}
                onSignOut={handleSignOut}
            />

            {/* ================================================================== */}
            {/* SECTION 14: MAIN CONTENT */}
            {/* ================================================================== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Page Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">📚 Contract Library</h1>
                        <p className="text-slate-500 text-sm">
                            Browse and use templates to start new negotiations
                        </p>
                    </div>
                    <Link
                        href="/auth/create-contract"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Contract
                    </Link>
                </div>

                {/* Search & View Toggle */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-64"
                            />
                        </div>
                        <span className="text-sm text-slate-500">
                            {getTotalTemplateCount()} template{getTotalTemplateCount() !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    /* Template Sections */
                    <div>
                        {sections.map(section => renderSection(section))}
                    </div>
                )}
            </div>

            {/* Template Preview Modal */}
            {renderTemplateModal()}

        </div>
    )
}