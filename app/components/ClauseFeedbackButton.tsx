// ============================================================================
// CLAUSE-SPECIFIC FEEDBACK BUTTON
// Location: app/components/ClauseFeedbackButton.tsx
//
// A subtle flag icon placed on the clause header in the contract studio.
// When clicked, opens a compact modal that auto-captures the full clause
// context (positions, ranges, draft content, CLARENCE chat) and lets the
// user describe the issue. Sends to /api/feedback with feedback_type
// 'clause_review' and the full snapshot as clause_context JSONB.
// ============================================================================

'use client'
import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface ClauseChatMessage {
    sender: string
    message: string
    createdAt: string
}

interface ClauseData {
    clauseId: string
    clauseNumber: string
    clauseName: string
    category: string
    positionId: string
    description: string
    customerPosition: number | null
    providerPosition: number | null
    clarenceRecommendation: number | null
    gapSize: number
    customerWeight: number
    providerWeight: number
    isDealBreakerCustomer: boolean
    isDealBreakerProvider: boolean
    clauseContent: string | null
    aiContext?: string | null
    negotiationGuidance?: string | null
    positionOptions?: unknown[] | null
    status: string
}

interface ClauseFeedbackButtonProps {
    clause: ClauseData
    sessionId: string
    templateName?: string | null
    contractTypeKey?: string | null
    chatMessages: ClauseChatMessage[]
    userId?: string | null
    companyId?: string | null
}

// ============================================================================
// SECTION 2: ISSUE TYPES
// ============================================================================

const ISSUE_TYPES = [
    { value: 'wrong_position', label: 'Wrong position' },
    { value: 'wrong_party', label: 'Wrong party' },
    { value: 'inaccurate_analysis', label: 'Inaccurate analysis' },
    { value: 'missing_context', label: 'Missing context' },
    { value: 'other', label: 'Other' },
] as const

// ============================================================================
// SECTION 3: COMPONENT
// ============================================================================

export default function ClauseFeedbackButton({
    clause,
    sessionId,
    templateName,
    contractTypeKey,
    chatMessages,
    userId,
    companyId,
}: ClauseFeedbackButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [issueType, setIssueType] = useState('')
    const [explanation, setExplanation] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [showContext, setShowContext] = useState(false)

    // Build the auto-captured context snapshot
    const clauseContext = useMemo(() => ({
        clauseId: clause.clauseId,
        clauseNumber: clause.clauseNumber,
        clauseName: clause.clauseName,
        category: clause.category,
        positionId: clause.positionId,
        status: clause.status,
        customerPosition: clause.customerPosition,
        providerPosition: clause.providerPosition,
        clarenceRecommendation: clause.clarenceRecommendation,
        gapSize: clause.gapSize,
        customerWeight: clause.customerWeight,
        providerWeight: clause.providerWeight,
        isDealBreakerCustomer: clause.isDealBreakerCustomer,
        isDealBreakerProvider: clause.isDealBreakerProvider,
        clauseContent: clause.clauseContent,
        description: clause.description,
        aiContext: clause.aiContext || null,
        negotiationGuidance: clause.negotiationGuidance || null,
        positionOptions: clause.positionOptions || null,
        sessionId,
        templateName: templateName || null,
        contractTypeKey: contractTypeKey || null,
        recentChat: chatMessages.slice(-10).map(m => ({
            sender: m.sender,
            message: m.message,
            createdAt: m.createdAt,
        })),
    }), [clause, sessionId, templateName, contractTypeKey, chatMessages])

    const handleOpen = () => {
        setIsOpen(true)
        setIssueType('')
        setExplanation('')
        setError('')
        setSubmitted(false)
        setShowContext(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!issueType || explanation.trim().length < 20) return

        setError('')
        setIsSubmitting(true)

        try {
            const issueLabel = ISSUE_TYPES.find(t => t.value === issueType)?.label || issueType

            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId || null,
                    company_id: companyId || null,
                    feedback_type: 'clause_review',
                    title: `Clause ${clause.clauseNumber}: ${clause.clauseName} — ${issueLabel}`,
                    description: explanation.trim(),
                    clause_context: clauseContext,
                    page_url: typeof window !== 'undefined' ? window.location.href : null,
                    page_name: '/auth/contract-studio',
                    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                    screen_resolution: typeof window !== 'undefined'
                        ? `${window.innerWidth}x${window.innerHeight}`
                        : null,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to submit feedback')
            }

            setSubmitted(true)
            setTimeout(() => setIsOpen(false), 2000)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to submit feedback'
            setError(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ========================================================================
    // RENDER: Trigger button (subtle flag icon)
    // ========================================================================

    return (
        <>
            <button
                onClick={handleOpen}
                className="p-1 text-slate-300 hover:text-amber-500 transition-colors"
                title="Report clause issue"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                </svg>
            </button>

            {/* ================================================================
                MODAL (via portal)
            ================================================================ */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => !isSubmitting && setIsOpen(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                            <h3 className="text-white font-semibold text-lg">Report Clause Issue</h3>
                            <p className="text-white/80 text-sm mt-0.5">
                                {clause.clauseNumber} {clause.clauseName}
                            </p>
                        </div>

                        {submitted ? (
                            /* Success state */
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-700 font-medium">Feedback submitted</p>
                                <p className="text-slate-500 text-sm mt-1">Thank you for helping improve Clarence.</p>
                            </div>
                        ) : (
                            /* Form */
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {/* Issue type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Issue type <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        value={issueType}
                                        onChange={(e) => setIssueType(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="">Select issue type...</option>
                                        {ISSUE_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Explanation */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                        Detailed explanation <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={explanation}
                                        onChange={(e) => setExplanation(e.target.value)}
                                        placeholder="Describe the issue in detail — what's wrong and what the correct interpretation should be..."
                                        rows={4}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                                        required
                                        minLength={20}
                                    />
                                    {explanation.length > 0 && explanation.length < 20 && (
                                        <p className="text-xs text-amber-500 mt-1">
                                            Please provide at least 20 characters ({20 - explanation.length} more)
                                        </p>
                                    )}
                                </div>

                                {/* Context preview (expandable) */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowContext(!showContext)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition"
                                    >
                                        <span>Context being captured</span>
                                        <svg className={`w-4 h-4 transition-transform ${showContext ? 'rotate-180' : ''}`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {showContext && (
                                        <div className="px-3 pb-3 text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                                            <p><span className="font-medium">Positions:</span> Customer {clause.customerPosition ?? '—'} / Provider {clause.providerPosition ?? '—'} / Clarence {clause.clarenceRecommendation ?? '—'}</p>
                                            <p><span className="font-medium">Gap:</span> {clause.gapSize} | <span className="font-medium">Weights:</span> C:{clause.customerWeight} P:{clause.providerWeight}</p>
                                            <p><span className="font-medium">Deal breakers:</span> C:{clause.isDealBreakerCustomer ? 'Yes' : 'No'} P:{clause.isDealBreakerProvider ? 'Yes' : 'No'}</p>
                                            <p><span className="font-medium">Template:</span> {templateName || '—'}</p>
                                            <p><span className="font-medium">Session:</span> {sessionId}</p>
                                            <p><span className="font-medium">Chat messages:</span> {chatMessages.slice(-10).length} captured</p>
                                            {clause.clauseContent && (
                                                <p><span className="font-medium">Draft:</span> {clause.clauseContent.substring(0, 100)}...</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                        {error}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !issueType || explanation.trim().length < 20}
                                        className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition"
                                    >
                                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
