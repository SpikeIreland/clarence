'use client'

// ============================================================================
// CLARENCE Beta Feedback Modal Component
// ============================================================================
// File: components/FeedbackModal.tsx
// Purpose: Modal form for beta testers to submit feedback
// Uses React Portal to avoid z-index stacking context issues
// ============================================================================

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface FeedbackModalProps {
    onClose: () => void
}

interface FeedbackType {
    value: string
    label: string
    icon: string
    description: string
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================

const FEEDBACK_TYPES: FeedbackType[] = [
    {
        value: 'bug',
        label: 'Bug Report',
        icon: '🐛',
        description: 'Something isn\'t working correctly'
    },
    {
        value: 'feature',
        label: 'Feature Request',
        icon: '💡',
        description: 'Suggest a new feature or improvement'
    },
    {
        value: 'usability',
        label: 'Usability Issue',
        icon: '🎯',
        description: 'Something is confusing or hard to use'
    },
    {
        value: 'general',
        label: 'General Feedback',
        icon: '💬',
        description: 'Any other comments or thoughts'
    },
]

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
    const pathname = usePathname()
    const supabase = createClient()

    // -------------------------------------------------------------------------
    // SECTION 3.1: STATE
    // -------------------------------------------------------------------------

    const [feedbackType, setFeedbackType] = useState('')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [rating, setRating] = useState<number | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [mounted, setMounted] = useState(false)

    // User context
    const [userId, setUserId] = useState<string | null>(null)
    const [companyId, setCompanyId] = useState<string | null>(null)

    // -------------------------------------------------------------------------
    // SECTION 3.2: PORTAL MOUNT CHECK
    // -------------------------------------------------------------------------

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    // -------------------------------------------------------------------------
    // SECTION 3.3: USER CONTEXT EFFECTS
    // -------------------------------------------------------------------------

    useEffect(() => {
        // Get current user context from multiple sources
        async function getUserContext() {
            let foundUserId: string | null = null
            let foundCompanyId: string | null = null

            // Source 1: Supabase Auth (primary)
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    foundUserId = user.id
                    console.log('📧 Feedback: Got user from Supabase auth:', foundUserId)

                    // Try to get company_id from user profile
                    const { data: profile } = await supabase
                        .from('users')
                        .select('company_id')
                        .eq('user_id', user.id)
                        .single()

                    if (profile?.company_id) {
                        foundCompanyId = profile.company_id
                    }
                }
            } catch (err) {
                console.log('Supabase auth check:', err)
            }

            // Source 2: clarence_auth localStorage (fallback for regular users)
            if (!foundUserId) {
                try {
                    const clarenceAuth = localStorage.getItem('clarence_auth')
                    if (clarenceAuth) {
                        const parsed = JSON.parse(clarenceAuth)
                        foundUserId = parsed.userInfo?.userId || parsed.userId || parsed.user_id || null
                        foundCompanyId = parsed.userInfo?.companyId || parsed.companyId || parsed.company_id || null
                        if (foundUserId) {
                            console.log('📧 Feedback: Got user from clarence_auth:', foundUserId)
                        }
                    }
                } catch (err) {
                    console.log('clarence_auth parse error:', err)
                }
            }

            // Source 3: Provider context from URL or localStorage (for invited providers)
            if (!foundUserId) {
                try {
                    // Check URL for provider context
                    const urlParams = new URLSearchParams(window.location.search)
                    const providerId = urlParams.get('provider_id')

                    // Check provider_auth localStorage
                    const providerAuth = localStorage.getItem('provider_auth') || localStorage.getItem('clarence_provider_auth')
                    if (providerAuth) {
                        const parsed = JSON.parse(providerAuth)
                        foundUserId = parsed.userId || parsed.user_id || parsed.providerId || providerId || null
                        foundCompanyId = parsed.companyId || parsed.company_id || null
                        if (foundUserId) {
                            console.log('📧 Feedback: Got user from provider_auth:', foundUserId)
                        }
                    }

                    // If still no user but we have provider_id in URL, use that as identifier
                    if (!foundUserId && providerId && providerId !== '00000000-0000-0000-0000-000000000001') {
                        // Try to look up the provider's user_id from bids table
                        const { data: bidData } = await supabase
                            .from('bids')
                            .select('provider_user_id, provider_company_id')
                            .eq('bid_id', providerId)
                            .single()

                        if (bidData?.provider_user_id) {
                            foundUserId = bidData.provider_user_id
                            foundCompanyId = bidData.provider_company_id || null
                            console.log('📧 Feedback: Got user from bids lookup:', foundUserId)
                        }
                    }
                } catch (err) {
                    console.log('Provider context check:', err)
                }
            }

            // Set the values
            if (foundUserId) {
                setUserId(foundUserId)
            }
            if (foundCompanyId) {
                setCompanyId(foundCompanyId)
            }

            // Log final result for debugging
            console.log('📧 Feedback context:', { userId: foundUserId, companyId: foundCompanyId })
        }

        getUserContext()
    }, [supabase])

    // -------------------------------------------------------------------------
    // SECTION 3.4: FORM SUBMISSION
    // -------------------------------------------------------------------------

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setIsSubmitting(true)

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    company_id: companyId,
                    feedback_type: feedbackType,
                    title: title || null,
                    description,
                    rating,
                    page_url: window.location.href,
                    page_name: pathname,
                    user_agent: navigator.userAgent,
                    screen_resolution: `${window.innerWidth}x${window.innerHeight}`
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to submit feedback')
            }

            setSubmitted(true)

            // Auto-close after 2 seconds
            setTimeout(() => {
                onClose()
            }, 2000)

        } catch (err: any) {
            setError(err.message || 'Failed to submit feedback. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    // -------------------------------------------------------------------------
    // SECTION 3.5: HELPER FUNCTIONS
    // -------------------------------------------------------------------------

    function getPageDisplayName(): string {
        // Convert pathname to readable name
        const path = pathname || '/'
        if (path === '/') return 'Home'

        return path
            .split('/')
            .filter(Boolean)
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))
            .join(' > ')
    }

    // -------------------------------------------------------------------------
    // SECTION 3.6: MODAL CONTENT
    // -------------------------------------------------------------------------

    const modalContent = (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
            style={{ zIndex: 99999 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto"
                style={{ zIndex: 100000 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ================================================================ */}
                {/* HEADER */}
                {/* ================================================================ */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-[#1e3a5f] to-[#2563eb]">
                    <div className="flex items-center justify-between">
                        <h2
                            id="feedback-modal-title"
                            className="text-xl font-bold text-white"
                        >
                            {submitted ? '✅ Thank You!' : 'Send Feedback'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white text-2xl font-light transition-colors"
                            aria-label="Close modal"
                        >
                            ×
                        </button>
                    </div>
                    {!submitted && (
                        <p className="text-sm text-white/80 mt-1">
                            Help us improve CLARENCE with your feedback
                        </p>
                    )}
                </div>

                {/* ================================================================ */}
                {/* CONTENT */}
                {/* ================================================================ */}
                <div className="p-6">

                    {/* -------------------------------------------------------------- */}
                    {/* SUCCESS STATE */}
                    {/* -------------------------------------------------------------- */}
                    {submitted ? (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">🎉</div>
                            <p className="text-lg text-slate-700 font-medium">
                                Your feedback has been submitted successfully!
                            </p>
                            <p className="text-sm text-slate-500 mt-2">
                                We appreciate you taking the time to help us improve CLARENCE.
                            </p>
                        </div>
                    ) : (

                        /* ------------------------------------------------------------ */
                        /* FEEDBACK FORM */
                        /* ------------------------------------------------------------ */
                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* ---------------------------------------------------------- */}
                            {/* FEEDBACK TYPE SELECTION */}
                            {/* ---------------------------------------------------------- */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    What type of feedback is this? <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {FEEDBACK_TYPES.map(type => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => setFeedbackType(type.value)}
                                            className={`p-3 rounded-lg border-2 text-left transition-all ${feedbackType === type.value
                                                ? 'border-[#2563eb] bg-blue-50 ring-2 ring-blue-200'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="font-medium text-sm">
                                                {type.icon} {type.label}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {type.description}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ---------------------------------------------------------- */}
                            {/* TITLE (OPTIONAL) */}
                            {/* ---------------------------------------------------------- */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    Title <span className="text-slate-400">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Brief summary of your feedback"
                                    maxLength={255}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200 transition-all text-slate-800"
                                />
                            </div>

                            {/* ---------------------------------------------------------- */}
                            {/* DESCRIPTION */}
                            {/* ---------------------------------------------------------- */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Please describe your feedback in detail. For bugs, include steps to reproduce if possible..."
                                    rows={4}
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200 resize-none transition-all text-slate-800"
                                />
                            </div>

                            {/* ---------------------------------------------------------- */}
                            {/* RATING (OPTIONAL) */}
                            {/* ---------------------------------------------------------- */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Overall Experience <span className="text-slate-400">(optional)</span>
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(rating === star ? null : star)}
                                            className={`text-2xl transition-all hover:scale-110 ${rating && rating >= star
                                                ? 'text-amber-400'
                                                : 'text-slate-300 hover:text-amber-300'
                                                }`}
                                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                    {rating && (
                                        <span className="text-sm text-slate-500 ml-2 self-center">
                                            {rating}/5
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ---------------------------------------------------------- */}
                            {/* CONTEXT INFO */}
                            {/* ---------------------------------------------------------- */}
                            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                                <div className="font-semibold mb-1 text-slate-600">
                                    📍 Auto-captured context:
                                </div>
                                <div>Page: {getPageDisplayName()}</div>
                                <div>
                                    Browser: {typeof navigator !== 'undefined'
                                        ? navigator.userAgent.split(' ').slice(-2).join(' ')
                                        : 'Unknown'}
                                </div>
                                <div>
                                    Screen: {typeof window !== 'undefined'
                                        ? `${window.innerWidth}x${window.innerHeight}`
                                        : 'Unknown'}
                                </div>
                            </div>

                            {/* ---------------------------------------------------------- */}
                            {/* ERROR MESSAGE */}
                            {/* ---------------------------------------------------------- */}
                            {error && (
                                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
                                    ❌ {error}
                                </div>
                            )}

                            {/* ---------------------------------------------------------- */}
                            {/* BUTTONS */}
                            {/* ---------------------------------------------------------- */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!feedbackType || !description || isSubmitting}
                                    className="flex-1 px-4 py-3 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Submitting...
                                        </span>
                                    ) : (
                                        'Submit Feedback'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )

    // -------------------------------------------------------------------------
    // SECTION 3.7: RENDER WITH PORTAL
    // -------------------------------------------------------------------------

    // Use portal to render modal at document.body level, avoiding z-index issues
    if (!mounted) return null

    return createPortal(modalContent, document.body)
}