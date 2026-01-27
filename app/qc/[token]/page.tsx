'use client'

// ============================================================================
// QUICK CONTRACT - PUBLIC RECIPIENT PAGE
// Version: 1.0
// Date: 27 January 2026
// Path: /app/qc/[token]/page.tsx
// Description: Public page for recipients to view and respond to contracts
// Note: This page does NOT require authentication
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface ContractData {
    quickContractId: string
    contractName: string
    contractType: string | null
    description: string | null
    referenceNumber: string | null
    documentContent: string | null
    status: string
    expiresAt: string | null
    allowRecipientComments: boolean
    requireFullScroll: boolean
    senderName: string | null
    senderEmail: string | null
    senderCompany: string | null
}

interface RecipientData {
    recipientId: string
    recipientName: string
    recipientEmail: string
    recipientCompany: string | null
    status: string
    responseType: string | null
    responseMessage: string | null
    declineReason: string | null
    respondedAt: string | null
    personalMessage: string | null
}

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'already_responded' | 'cancelled'
type ResponseType = 'accepted' | 'declined' | null

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_N8N_API_BASE || 'https://spikeislandstudios.app.n8n.cloud/webhook'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
    'nda': 'Non-Disclosure Agreement',
    'service_agreement': 'Service Agreement',
    'lease': 'Lease Agreement',
    'employment': 'Employment Contract',
    'contractor': 'Contractor Agreement',
    'vendor': 'Vendor Agreement',
    'other': 'Contract'
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function PublicRecipientPage() {
    const params = useParams()
    const supabase = createClient()
    const token = params.token as string
    const contentRef = useRef<HTMLDivElement>(null)

    // ==========================================================================
    // SECTION 5: STATE DECLARATIONS
    // ==========================================================================

    const [pageState, setPageState] = useState<PageState>('loading')
    const [contract, setContract] = useState<ContractData | null>(null)
    const [recipient, setRecipient] = useState<RecipientData | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Response state
    const [showResponseModal, setShowResponseModal] = useState(false)
    const [responseType, setResponseType] = useState<ResponseType>(null)
    const [declineReason, setDeclineReason] = useState('')
    const [responseMessage, setResponseMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    // Scroll tracking
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)

    // Comment state
    const [showCommentForm, setShowCommentForm] = useState(false)
    const [comment, setComment] = useState('')
    const [submittingComment, setSubmittingComment] = useState(false)
    const [commentSubmitted, setCommentSubmitted] = useState(false)

    // ==========================================================================
    // SECTION 6: DATA LOADING
    // ==========================================================================

    const loadContractData = useCallback(async () => {
        if (!token) {
            setPageState('invalid')
            return
        }

        try {
            // Find recipient by access token
            const { data: recipientData, error: recipientError } = await supabase
                .from('qc_recipients')
                .select('*')
                .eq('access_token', token)
                .single()

            if (recipientError || !recipientData) {
                console.error('Recipient not found:', recipientError)
                setPageState('invalid')
                return
            }

            // Load contract
            const { data: contractData, error: contractError } = await supabase
                .from('quick_contracts')
                .select(`
          *,
          users!quick_contracts_created_by_user_id_fkey (
            contact_person,
            email
          ),
          companies!quick_contracts_company_id_fkey (
            company_name
          )
        `)
                .eq('quick_contract_id', recipientData.quick_contract_id)
                .single()

            if (contractError || !contractData) {
                console.error('Contract not found:', contractError)
                setPageState('invalid')
                return
            }

            // Check contract status
            if (contractData.status === 'cancelled') {
                setPageState('cancelled')
                return
            }

            // Check if expired
            if (contractData.expires_at && new Date(contractData.expires_at) < new Date()) {
                setPageState('expired')
                return
            }

            // Check if already responded
            if (['accepted', 'declined'].includes(recipientData.status)) {
                setRecipient({
                    recipientId: recipientData.recipient_id,
                    recipientName: recipientData.recipient_name,
                    recipientEmail: recipientData.recipient_email,
                    recipientCompany: recipientData.recipient_company,
                    status: recipientData.status,
                    responseType: recipientData.response_type,
                    responseMessage: recipientData.response_message,
                    declineReason: recipientData.decline_reason,
                    respondedAt: recipientData.responded_at,
                    personalMessage: recipientData.personal_message
                })
                setContract({
                    quickContractId: contractData.quick_contract_id,
                    contractName: contractData.contract_name,
                    contractType: contractData.contract_type,
                    description: contractData.description,
                    referenceNumber: contractData.reference_number,
                    documentContent: contractData.document_content,
                    status: contractData.status,
                    expiresAt: contractData.expires_at,
                    allowRecipientComments: contractData.allow_recipient_comments,
                    requireFullScroll: contractData.require_full_scroll,
                    senderName: contractData.users?.contact_person,
                    senderEmail: contractData.users?.email,
                    senderCompany: contractData.companies?.company_name
                })
                setPageState('already_responded')
                return
            }

            // Set data
            setRecipient({
                recipientId: recipientData.recipient_id,
                recipientName: recipientData.recipient_name,
                recipientEmail: recipientData.recipient_email,
                recipientCompany: recipientData.recipient_company,
                status: recipientData.status,
                responseType: recipientData.response_type,
                responseMessage: recipientData.response_message,
                declineReason: recipientData.decline_reason,
                respondedAt: recipientData.responded_at,
                personalMessage: recipientData.personal_message
            })

            setContract({
                quickContractId: contractData.quick_contract_id,
                contractName: contractData.contract_name,
                contractType: contractData.contract_type,
                description: contractData.description,
                referenceNumber: contractData.reference_number,
                documentContent: contractData.document_content,
                status: contractData.status,
                expiresAt: contractData.expires_at,
                allowRecipientComments: contractData.allow_recipient_comments ?? true,
                requireFullScroll: contractData.require_full_scroll ?? false,
                senderName: contractData.users?.contact_person,
                senderEmail: contractData.users?.email,
                senderCompany: contractData.companies?.company_name
            })

            // Record view
            await recordView(recipientData.recipient_id, recipientData.view_count || 0)

            setPageState('valid')

        } catch (err) {
            console.error('Error loading contract:', err)
            setPageState('invalid')
        }
    }, [token, supabase])

    async function recordView(recipientId: string, currentViewCount: number) {
        try {
            const now = new Date().toISOString()
            const updateData: Record<string, unknown> = {
                view_count: currentViewCount + 1,
                last_viewed_at: now,
                updated_at: now
            }

            // Set first_viewed_at only if this is first view
            if (currentViewCount === 0) {
                updateData.first_viewed_at = now
                updateData.status = 'viewed'
            }

            await supabase
                .from('qc_recipients')
                .update(updateData)
                .eq('recipient_id', recipientId)

            // Also update contract status if first view
            if (currentViewCount === 0 && contract) {
                await supabase
                    .from('quick_contracts')
                    .update({
                        status: 'viewed',
                        updated_at: now
                    })
                    .eq('quick_contract_id', contract.quickContractId)
            }

            // Log audit event
            await supabase
                .from('qc_audit_log')
                .insert({
                    quick_contract_id: contract?.quickContractId,
                    recipient_id: recipientId,
                    event_type: 'viewed',
                    event_description: 'Recipient viewed the contract',
                    event_data: { viewCount: currentViewCount + 1 }
                })

        } catch (err) {
            console.error('Error recording view:', err)
        }
    }

    // ==========================================================================
    // SECTION 7: EFFECTS
    // ==========================================================================

    useEffect(() => {
        loadContractData()
    }, [loadContractData])

    // Scroll tracking
    useEffect(() => {
        const contentElement = contentRef.current
        if (!contentElement || !contract?.requireFullScroll) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = contentElement
            const progress = Math.min((scrollTop / (scrollHeight - clientHeight)) * 100, 100)
            setScrollProgress(progress)

            if (progress >= 95) {
                setHasScrolledToBottom(true)
            }
        }

        contentElement.addEventListener('scroll', handleScroll)
        return () => contentElement.removeEventListener('scroll', handleScroll)
    }, [contract?.requireFullScroll])

    // ==========================================================================
    // SECTION 8: RESPONSE HANDLERS
    // ==========================================================================

    function handleAccept() {
        setResponseType('accepted')
        setShowResponseModal(true)
    }

    function handleDecline() {
        setResponseType('declined')
        setShowResponseModal(true)
    }

    async function submitResponse() {
        if (!recipient || !contract) return

        setSubmitting(true)
        setError(null)

        try {
            const now = new Date().toISOString()

            // Update recipient
            const { error: updateError } = await supabase
                .from('qc_recipients')
                .update({
                    status: responseType,
                    response_type: responseType,
                    response_message: responseMessage || null,
                    decline_reason: responseType === 'declined' ? declineReason || null : null,
                    responded_at: now,
                    updated_at: now
                })
                .eq('recipient_id', recipient.recipientId)

            if (updateError) {
                throw new Error('Failed to submit response')
            }

            // Update contract status
            await supabase
                .from('quick_contracts')
                .update({
                    status: responseType,
                    completed_at: now,
                    updated_at: now
                })
                .eq('quick_contract_id', contract.quickContractId)

            // Log audit event
            await supabase
                .from('qc_audit_log')
                .insert({
                    quick_contract_id: contract.quickContractId,
                    recipient_id: recipient.recipientId,
                    event_type: responseType,
                    event_description: responseType === 'accepted'
                        ? 'Recipient accepted the contract'
                        : 'Recipient declined the contract',
                    event_data: {
                        responseMessage: responseMessage || null,
                        declineReason: responseType === 'declined' ? declineReason || null : null
                    }
                })

            // Notify sender via N8N
            try {
                await fetch(`${API_BASE}/qc-response`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contractId: contract.quickContractId,
                        contractName: contract.contractName,
                        recipientName: recipient.recipientName,
                        recipientEmail: recipient.recipientEmail,
                        responseType: responseType,
                        responseMessage: responseMessage,
                        declineReason: responseType === 'declined' ? declineReason : null,
                        senderEmail: contract.senderEmail,
                        senderName: contract.senderName
                    })
                })
            } catch (notifyError) {
                console.error('Error notifying sender:', notifyError)
            }

            setSubmitted(true)
            setShowResponseModal(false)

        } catch (err) {
            console.error('Error submitting response:', err)
            setError(err instanceof Error ? err.message : 'Failed to submit response')
        } finally {
            setSubmitting(false)
        }
    }

    // ==========================================================================
    // SECTION 9: COMMENT HANDLER
    // ==========================================================================

    async function submitComment() {
        if (!recipient || !contract || !comment.trim()) return

        setSubmittingComment(true)

        try {
            // Insert comment
            const { error: insertError } = await supabase
                .from('qc_comments')
                .insert({
                    quick_contract_id: contract.quickContractId,
                    recipient_id: recipient.recipientId,
                    comment_text: comment.trim(),
                    commenter_type: 'recipient'
                })

            if (insertError) {
                throw new Error('Failed to submit comment')
            }

            // Notify sender
            try {
                await fetch(`${API_BASE}/qc-comment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contractId: contract.quickContractId,
                        contractName: contract.contractName,
                        recipientName: recipient.recipientName,
                        recipientEmail: recipient.recipientEmail,
                        comment: comment.trim(),
                        senderEmail: contract.senderEmail,
                        senderName: contract.senderName
                    })
                })
            } catch (notifyError) {
                console.error('Error notifying sender of comment:', notifyError)
            }

            setComment('')
            setCommentSubmitted(true)
            setShowCommentForm(false)
            setTimeout(() => setCommentSubmitted(false), 3000)

        } catch (err) {
            console.error('Error submitting comment:', err)
            setError('Failed to submit comment')
        } finally {
            setSubmittingComment(false)
        }
    }

    // ==========================================================================
    // SECTION 10: HELPER FUNCTIONS
    // ==========================================================================

    function getContractTypeLabel(type: string | null): string {
        if (!type) return 'Contract'
        return CONTRACT_TYPE_LABELS[type] || type
    }

    function formatDate(dateString: string | null): string {
        if (!dateString) return ''
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    function getDaysUntilExpiry(): number | null {
        if (!contract?.expiresAt) return null
        const now = new Date()
        const expires = new Date(contract.expiresAt)
        const diffTime = expires.getTime() - now.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    function canRespond(): boolean {
        if (!contract?.requireFullScroll) return true
        return hasScrolledToBottom
    }

    // ==========================================================================
    // SECTION 11: RENDER - LOADING STATE
    // ==========================================================================

    if (pageState === 'loading') {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-600">Loading contract...</p>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 12: RENDER - INVALID TOKEN STATE
    // ==========================================================================

    if (pageState === 'invalid') {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Invalid Link</h1>
                    <p className="text-slate-500 mb-6">
                        This contract link is invalid or has been removed. Please contact the sender for a new link.
                    </p>
                    <Link
                        href="/"
                        className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                    >
                        Go to CLARENCE Homepage
                    </Link>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 13: RENDER - EXPIRED STATE
    // ==========================================================================

    if (pageState === 'expired') {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Contract Expired</h1>
                    <p className="text-slate-500 mb-6">
                        This contract has expired and is no longer available for review. Please contact the sender if you need a new contract.
                    </p>
                    <Link
                        href="/"
                        className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                    >
                        Go to CLARENCE Homepage
                    </Link>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 14: RENDER - CANCELLED STATE
    // ==========================================================================

    if (pageState === 'cancelled') {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Contract Cancelled</h1>
                    <p className="text-slate-500 mb-6">
                        This contract has been cancelled by the sender and is no longer available.
                    </p>
                    <Link
                        href="/"
                        className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                    >
                        Go to CLARENCE Homepage
                    </Link>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 15: RENDER - ALREADY RESPONDED STATE
    // ==========================================================================

    if (pageState === 'already_responded') {
        const isAccepted = recipient?.responseType === 'accepted'

        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isAccepted ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                        {isAccepted ? (
                            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">
                        Contract {isAccepted ? 'Accepted' : 'Declined'}
                    </h1>
                    <p className="text-slate-500 mb-2">
                        You {isAccepted ? 'accepted' : 'declined'} this contract on {formatDate(recipient?.respondedAt || null)}.
                    </p>
                    {contract && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg text-left">
                            <p className="font-medium text-slate-800">{contract.contractName}</p>
                            <p className="text-sm text-slate-500">{getContractTypeLabel(contract.contractType)}</p>
                        </div>
                    )}
                    <Link
                        href="/"
                        className="mt-6 inline-block text-teal-600 hover:text-teal-700 font-medium text-sm"
                    >
                        Go to CLARENCE Homepage
                    </Link>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 16: RENDER - SUBMITTED STATE
    // ==========================================================================

    if (submitted) {
        const isAccepted = responseType === 'accepted'

        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isAccepted ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                        {isAccepted ? (
                            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                        {isAccepted ? 'Contract Accepted!' : 'Contract Declined'}
                    </h1>
                    <p className="text-slate-500 mb-6">
                        {isAccepted
                            ? 'Thank you for accepting. The sender has been notified and will be in touch.'
                            : 'Your response has been recorded. The sender has been notified.'
                        }
                    </p>
                    <div className="p-4 bg-slate-50 rounded-lg text-left mb-6">
                        <p className="font-medium text-slate-800">{contract?.contractName}</p>
                        <p className="text-sm text-slate-500">{getContractTypeLabel(contract?.contractType || null)}</p>
                        {contract?.senderCompany && (
                            <p className="text-sm text-slate-400 mt-1">From: {contract.senderCompany}</p>
                        )}
                    </div>
                    <p className="text-xs text-slate-400">
                        You can close this window now.
                    </p>
                </div>
            </div>
        )
    }

    // ==========================================================================
    // SECTION 17: RENDER - VALID STATE (MAIN VIEW)
    // ==========================================================================

    const daysUntilExpiry = getDaysUntilExpiry()

    return (
        <div className="min-h-screen bg-slate-100">

            {/* ================================================================== */}
            {/* SECTION 18: HEADER */}
            {/* ================================================================== */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <span className="text-sm text-slate-500">Powered by CLARENCE</span>
                        </div>
                        {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${daysUntilExpiry <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 19: MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Comment Submitted Toast */}
                {commentSubmitted && (
                    <div className="fixed bottom-4 right-4 p-4 bg-emerald-600 text-white rounded-lg shadow-lg z-50 animate-fade-in">
                        Comment sent successfully!
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 20: CONTRACT INFO */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Contract for Review</p>
                            <h1 className="text-2xl font-bold text-slate-800 mb-1">{contract?.contractName}</h1>
                            <p className="text-slate-500">{getContractTypeLabel(contract?.contractType || null)}</p>
                        </div>
                        {contract?.senderCompany && (
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Sent by</p>
                                <p className="font-medium text-slate-800">{contract.senderName}</p>
                                <p className="text-sm text-slate-500">{contract.senderCompany}</p>
                            </div>
                        )}
                    </div>

                    {/* Personal Message */}
                    {recipient?.personalMessage && (
                        <div className="mt-4 p-4 bg-teal-50 rounded-lg border-l-4 border-teal-500">
                            <p className="text-sm text-teal-800 italic">&quot;{recipient.personalMessage}&quot;</p>
                            <p className="text-xs text-teal-600 mt-2">— {contract?.senderName}</p>
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 21: CONTRACT CONTENT */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                    {/* Scroll Progress (if required) */}
                    {contract?.requireFullScroll && !hasScrolledToBottom && (
                        <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center justify-between">
                            <span className="text-sm text-amber-700">
                                Please scroll through the entire contract to enable response buttons
                            </span>
                            <span className="text-sm font-medium text-amber-700">
                                {Math.round(scrollProgress)}%
                            </span>
                        </div>
                    )}

                    {/* Content */}
                    <div
                        ref={contentRef}
                        className="p-6 sm:p-8 max-h-[60vh] overflow-y-auto"
                    >
                        {contract?.documentContent ? (
                            <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: contract.documentContent }}
                            />
                        ) : (
                            <p className="text-slate-400 text-center py-8">No content available</p>
                        )}
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 22: COMMENT SECTION */}
                {/* ============================================================== */}
                {contract?.allowRecipientComments && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-slate-800">Have Questions?</h2>
                                <p className="text-sm text-slate-500">Send a message to the sender before responding</p>
                            </div>
                            {!showCommentForm && (
                                <button
                                    onClick={() => setShowCommentForm(true)}
                                    className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                                >
                                    Ask a Question
                                </button>
                            )}
                        </div>

                        {showCommentForm && (
                            <div className="mt-4">
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                    placeholder="Type your question or comment..."
                                />
                                <div className="mt-3 flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setShowCommentForm(false)
                                            setComment('')
                                        }}
                                        className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitComment}
                                        disabled={submittingComment || !comment.trim()}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        {submittingComment ? 'Sending...' : 'Send Message'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 23: RESPONSE BUTTONS */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="font-semibold text-slate-800 mb-4 text-center">Your Response</h2>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleDecline}
                            disabled={!canRespond()}
                            className="px-8 py-3 border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Decline
                        </button>
                        <button
                            onClick={handleAccept}
                            disabled={!canRespond()}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Accept Contract
                        </button>
                    </div>

                    {!canRespond() && contract?.requireFullScroll && (
                        <p className="text-center text-sm text-amber-600 mt-4">
                            Please scroll through the entire contract to enable response buttons
                        </p>
                    )}

                    <p className="text-center text-xs text-slate-400 mt-4">
                        By accepting, you agree to the terms outlined in this contract.
                    </p>
                </div>
            </main>

            {/* ================================================================== */}
            {/* SECTION 24: RESPONSE MODAL */}
            {/* ================================================================== */}
            {showResponseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responseType === 'accepted' ? 'bg-emerald-100' : 'bg-red-100'
                                }`}>
                                {responseType === 'accepted' ? (
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">
                                {responseType === 'accepted' ? 'Accept Contract?' : 'Decline Contract?'}
                            </h3>
                        </div>

                        <p className="text-slate-600 text-sm mb-4">
                            {responseType === 'accepted'
                                ? 'By accepting, you agree to all terms outlined in this contract. The sender will be notified of your acceptance.'
                                : 'Please provide a reason for declining (optional). The sender will be notified.'
                            }
                        </p>

                        {/* Decline Reason */}
                        {responseType === 'declined' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Reason for Declining <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={declineReason}
                                    onChange={(e) => setDeclineReason(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                                    placeholder="Please let us know why you're declining..."
                                />
                            </div>
                        )}

                        {/* Optional Message */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Additional Message <span className="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={responseMessage}
                                onChange={(e) => setResponseMessage(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                placeholder="Any additional comments for the sender..."
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowResponseModal(false)
                                    setResponseType(null)
                                    setDeclineReason('')
                                    setResponseMessage('')
                                }}
                                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitResponse}
                                disabled={submitting}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${responseType === 'accepted'
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                    }`}
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Processing...
                                    </>
                                ) : (
                                    responseType === 'accepted' ? 'Confirm Acceptance' : 'Confirm Decline'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}