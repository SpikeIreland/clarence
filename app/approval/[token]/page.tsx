// ============================================================================
// PUBLIC APPROVER PAGE
// ============================================================================
// Token-based access — no CLARENCE account required.
// Approvers receive an email link like /approval/[token]
// They can view the document details and approve or reject.
// ============================================================================

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

interface ApprovalData {
    response_id: string
    approver_name: string
    approver_email: string
    status: string
    decision_note: string | null
    responded_at: string | null
    request_id: string
    internal_approval_requests: {
        request_id: string
        document_name: string
        document_type: string
        document_url: string | null
        requested_by_name: string
        requested_by_email: string
        message: string | null
        priority: string
        status: string
        created_at: string
        request_category: 'document' | 'clause' | 'contract' | null
        clause_name: string | null
        approval_context: Record<string, unknown> | null
    }
}

// ============================================================================
// SECTION 2: COMPONENT
// ============================================================================

export default function ApprovalPage() {
    const params = useParams()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [data, setData] = useState<ApprovalData | null>(null)
    const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)
    const [note, setNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    // ========================================================================
    // SECTION 2.1: LOAD APPROVAL DATA
    // ========================================================================

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch(`/api/approval/respond?token=${token}`)
                const json = await res.json()

                if (!json.success) {
                    setError(json.error || 'Failed to load approval details')
                    return
                }

                setData(json.data)

                // If already responded, show the result
                if (json.data.status === 'approved' || json.data.status === 'rejected') {
                    setSubmitted(true)
                    setDecision(json.data.status)
                    setNote(json.data.decision_note || '')
                }
            } catch {
                setError('Failed to load approval details. The link may be invalid or expired.')
            } finally {
                setLoading(false)
            }
        }

        if (token) loadData()
    }, [token])

    // ========================================================================
    // SECTION 2.2: SUBMIT HANDLER
    // ========================================================================

    const handleSubmit = async () => {
        if (!decision || isSubmitting) return
        setIsSubmitting(true)

        try {
            const res = await fetch('/api/approval/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: token,
                    decision,
                    decision_note: note || null,
                }),
            })

            const json = await res.json()

            if (!json.success) {
                setError(json.error || 'Failed to submit your response')
                return
            }

            setSubmitted(true)
        } catch {
            setError('Failed to submit your response. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    // ========================================================================
    // SECTION 2.3: RENDER — LOADING STATE
    // ========================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading approval details...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 2.4: RENDER — ERROR STATE
    // ========================================================================

    if (error && !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 mb-2">Unable to Load</h2>
                    <p className="text-sm text-slate-500">{error}</p>
                </div>
            </div>
        )
    }

    if (!data) return null

    const request = data.internal_approval_requests

    // ========================================================================
    // SECTION 2.5: RENDER — MAIN
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-slate-800 text-white px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">C</span>
                    </div>
                    <div>
                        <span className="font-semibold text-white tracking-wide">CLARENCE</span>
                        <span className="text-slate-400 text-xs ml-2">
                            {data?.internal_approval_requests.request_category === 'clause'
                                ? 'Clause Approval'
                                : data?.internal_approval_requests.request_category === 'contract'
                                    ? 'Contract Sign-off'
                                    : 'Document Approval'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto p-6">
                {submitted ? (
                    /* Success State */
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            decision === 'approved' ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                            {decision === 'approved' ? (
                                <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            {decision === 'approved' ? 'Approved' : 'Rejected'}
                        </h2>
                        <p className="text-sm text-slate-500 mb-2">
                            Your response for &quot;{request.request_category === 'clause' ? (request.clause_name || request.document_name) : request.document_name}&quot; has been recorded.
                        </p>
                        {note && (
                            <p className="text-sm text-slate-600 italic mt-2">&quot;{note}&quot;</p>
                        )}
                        <p className="text-xs text-slate-400 mt-4">
                            {request.requested_by_name} has been notified.
                        </p>
                    </div>
                ) : (
                    /* Review State */
                    <div className="space-y-4">
                        {/* Request info card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <h2 className="text-lg font-bold text-slate-800">Approval Request</h2>
                                {request.priority !== 'normal' && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        request.priority === 'urgent' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                        {request.priority}
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-slate-600 mb-4">
                                <strong>{request.requested_by_name}</strong> ({request.requested_by_email}) has requested your approval.
                            </p>

                            {/* Request details */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    <span className="text-sm font-semibold text-slate-800">{request.document_name}</span>
                                </div>

                                {/* Clause-specific context */}
                                {request.request_category === 'clause' && request.clause_name && (
                                    <div className="pt-1">
                                        <p className="text-xs font-semibold text-slate-600 mb-0.5">Clause under review</p>
                                        <p className="text-sm text-slate-800">{request.clause_name}</p>
                                    </div>
                                )}

                                {/* Contract-specific context */}
                                {request.request_category === 'contract' && request.approval_context && (
                                    <div className="pt-1 space-y-1">
                                        {(request.approval_context.deal_value as string | undefined) && (
                                            <p className="text-xs text-slate-600">
                                                Deal value: <span className="font-semibold text-slate-800">{request.approval_context.deal_value as string}</span>
                                            </p>
                                        )}
                                        {(request.approval_context.counterparty as string | undefined) && (
                                            <p className="text-xs text-slate-600">
                                                Counterparty: <span className="font-semibold text-slate-800">{request.approval_context.counterparty as string}</span>
                                            </p>
                                        )}
                                    </div>
                                )}

                                {request.request_category === null || request.request_category === 'document' ? (
                                    <p className="text-xs text-slate-500 capitalize">Type: {request.document_type.replace(/-/g, ' ')}</p>
                                ) : null}

                                <p className="text-xs text-slate-400">
                                    Requested {new Date(request.created_at).toLocaleDateString([], {
                                        day: 'numeric', month: 'long', year: 'numeric'
                                    })}
                                </p>
                            </div>

                            {/* Personal message */}
                            {request.message && (
                                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <p className="text-xs font-semibold text-emerald-700 mb-1">Message from {request.requested_by_name}:</p>
                                    <p className="text-sm text-slate-700 italic">&quot;{request.message}&quot;</p>
                                </div>
                            )}
                        </div>

                        {/* Document preview (if URL available) */}
                        {request.document_url && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">Document Preview</span>
                                    <a
                                        href={request.document_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                        </svg>
                                        Open full document
                                    </a>
                                </div>
                                <iframe
                                    src={request.document_url}
                                    className="w-full h-96 border-0"
                                    title="Document Preview"
                                />
                            </div>
                        )}

                        {/* Decision form */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-sm font-bold text-slate-800 mb-4">Your Decision</h3>

                            {/* Approve / Reject toggle */}
                            <div className="flex gap-3 mb-4">
                                <button
                                    onClick={() => setDecision('approved')}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                                        decision === 'approved'
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                                            : 'border-2 border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    Approve
                                </button>
                                <button
                                    onClick={() => setDecision('rejected')}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                                        decision === 'rejected'
                                            ? 'bg-red-600 text-white ring-2 ring-red-300'
                                            : 'border-2 border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Reject
                                </button>
                            </div>

                            {/* Note */}
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add a note (optional)..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm resize-none mb-4 text-slate-800"
                            />

                            {/* Error */}
                            {error && (
                                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 mb-4">
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={!decision || isSubmitting}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit Response'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-slate-400">
                        Powered by CLARENCE - The Honest Broker
                    </p>
                </div>
            </div>
        </div>
    )
}
