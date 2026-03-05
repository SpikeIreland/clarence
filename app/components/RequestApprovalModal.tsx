// ============================================================================
// REQUEST APPROVAL MODAL
// ============================================================================
// Modal for requesting internal approval on a generated document.
// Allows adding multiple approvers (name + email), optional message, priority.
// ============================================================================

'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface Approver {
    name: string
    email: string
    company: string
}

interface RequestApprovalModalProps {
    show: boolean
    onClose: () => void
    onSubmit: (
        approvers: Approver[],
        message: string,
        priority: 'normal' | 'high' | 'urgent'
    ) => void
    documentName: string
    documentCategory: string
    isSubmitting: boolean
}

// ============================================================================
// SECTION 2: COMPONENT
// ============================================================================

export default function RequestApprovalModal({
    show, onClose, onSubmit, documentName, documentCategory, isSubmitting
}: RequestApprovalModalProps) {
    const [approvers, setApprovers] = useState<Approver[]>([{ name: '', email: '', company: '' }])
    const [message, setMessage] = useState('')
    const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal')

    if (!show) return null

    // ========================================================================
    // SECTION 2.1: APPROVER MANAGEMENT
    // ========================================================================

    const addApprover = () => {
        if (approvers.length >= 5) return
        setApprovers(prev => [...prev, { name: '', email: '', company: '' }])
    }

    const removeApprover = (idx: number) => {
        if (approvers.length <= 1) return
        setApprovers(prev => prev.filter((_, i) => i !== idx))
    }

    const updateApprover = (idx: number, field: keyof Approver, value: string) => {
        setApprovers(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
    }

    // ========================================================================
    // SECTION 2.2: VALIDATION
    // ========================================================================

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const isValid = approvers.every(a => a.name.trim() && isValidEmail(a.email))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValid || isSubmitting) return
        onSubmit(approvers, message, priority)
    }

    // ========================================================================
    // SECTION 2.3: RENDER
    // ========================================================================

    const modalContent = (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
            style={{ zIndex: 99999 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto"
                style={{ zIndex: 100000 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Request Approval</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Send &quot;{documentName}&quot; for internal sign-off
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">

                    {/* Document preview card */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-800">{documentName}</div>
                            <div className="text-xs text-slate-500 capitalize">{documentCategory}</div>
                        </div>
                    </div>

                    {/* Approvers */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Approvers
                        </label>
                        <div className="space-y-2">
                            {approvers.map((approver, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={approver.name}
                                        onChange={(e) => updateApprover(idx, 'name', e.target.value)}
                                        placeholder="Name"
                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm text-slate-800"
                                    />
                                    <input
                                        type="email"
                                        value={approver.email}
                                        onChange={(e) => updateApprover(idx, 'email', e.target.value)}
                                        placeholder="Email"
                                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm text-slate-800"
                                    />
                                    <input
                                        type="text"
                                        value={approver.company}
                                        onChange={(e) => updateApprover(idx, 'company', e.target.value)}
                                        placeholder="Company"
                                        className="w-28 px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm text-slate-800"
                                    />
                                    {approvers.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeApprover(idx)}
                                            className="text-slate-400 hover:text-red-500 transition px-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {approvers.length < 5 && (
                            <button
                                type="button"
                                onClick={addApprover}
                                className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add another approver
                            </button>
                        )}
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Message <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Add context or instructions for the approver..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-sm resize-none text-slate-800"
                        />
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                        <div className="flex gap-2">
                            {(['normal', 'high', 'urgent'] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPriority(p)}
                                    className={`h-8 px-4 text-xs font-medium rounded-full transition capitalize ${
                                        priority === p
                                            ? p === 'urgent'
                                                ? 'bg-red-600 text-white'
                                                : p === 'high'
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-emerald-600 text-white'
                                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-10 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg transition text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || isSubmitting}
                            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                'Send Approval Request'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
