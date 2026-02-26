'use client'

// ============================================================================
// QUICK CONTRACT - PUBLIC RECIPIENT PAGE
// Version: 1.2
// Date: 26 February 2026
// Path: /app/qc/[token]/page.tsx
// Description: Public page for recipients to view and respond to contracts
// Note: This page does NOT require authentication
//
// CHANGELOG:
// 26 Feb 2026 - v1.2: TWO-BUTTON FIX + CONTENT FALLBACK
//   - Removed duplicate Section 23 "Review Contract" button
//   - Section 22B is now the single CTA ("Enter CLARENCE Studio")
//   - Added content fallback: if quick_contracts.document_content is null,
//     loads from uploaded_contracts.extracted_text via source_contract_id
//   - Also loads clause count from uploaded_contract_clauses for display
//
// 25 Feb 2026 - v1.1: ENTER STUDIO SUPPORT (Task 2)
//   - Added handleEnterStudio (Section 8B) - stores contract context in
//     sessionStorage (clarence_qc_redirect) and hard-navs to /provider
//   - Added Enter Studio CTA card (Section 22B) between comments and 
//     response buttons
//   - Added Enter Studio link on post-acceptance confirmation (Section 16)
//   - This completes the routing chain: Token Page → Auth → QC Studio
//     (see HANDOVER-Provider-Experience.docx Section 5.3, Option C)
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
    sourceContractId: string | null
    clauseCount: number
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

            // Load contract from quick_contracts
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

            // ================================================================
            // CONTENT FALLBACK: If quick_contracts has no document_content,
            // load from uploaded_contracts via source_contract_id.
            // This is the normal case for QC pathway contracts where the
            // document lives in uploaded_contracts.extracted_text
            // ================================================================
            let documentContent = contractData.document_content
            let clauseCount = 0
            const sourceContractId = contractData.source_contract_id || null

            if (sourceContractId) {
                // Try to load content from the source uploaded contract
                if (!documentContent) {
                    try {
                        const { data: sourceContract } = await supabase
                            .from('uploaded_contracts')
                            .select('extracted_text, contract_name, description')
                            .eq('contract_id', sourceContractId)
                            .single()

                        if (sourceContract?.extracted_text) {
                            documentContent = sourceContract.extracted_text
                        }
                    } catch (err) {
                        console.log('Could not load source contract content:', err)
                    }
                }

                // Load clause count for display
                try {
                    const { count } = await supabase
                        .from('uploaded_contract_clauses')
                        .select('clause_id', { count: 'exact', head: true })
                        .eq('contract_id', sourceContractId)
                        .eq('is_header', false)

                    clauseCount = count || 0
                } catch (err) {
                    console.log('Could not load clause count:', err)
                }
            }

            // Build recipient info object
            const recipientInfo: RecipientData = {
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
            }

            // Build contract info object
            const contractInfo: ContractData = {
                quickContractId: contractData.quick_contract_id,
                contractName: contractData.contract_name,
                contractType: contractData.contract_type,
                description: contractData.description,
                referenceNumber: contractData.reference_number,
                documentContent: documentContent,
                status: contractData.status,
                expiresAt: contractData.expires_at,
                allowRecipientComments: contractData.allow_recipient_comments ?? true,
                requireFullScroll: contractData.require_full_scroll ?? false,
                senderName: contractData.users?.contact_person,
                senderEmail: contractData.users?.email,
                senderCompany: contractData.companies?.company_name,
                sourceContractId: sourceContractId,
                clauseCount: clauseCount
            }

            // Check if already responded
            if (['accepted', 'declined'].includes(recipientData.status)) {
                setRecipient(recipientInfo)
                setContract(contractInfo)
                setPageState('already_responded')
                return
            }

            // Set data for normal view
            setRecipient(recipientInfo)
            setContract(contractInfo)

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
    // SECTION 8B: ENTER STUDIO HANDLER
    // Stores contract context in sessionStorage and navigates to /provider.
    // The Provider Landing Page (Task 1) checks for this on login and
    // routes to /auth/quick-contract/studio/[contractId].
    // Uses window.location.href (hard nav) to prevent GoTrueClient render loop.
    // See: HANDOVER-Provider-Experience.docx Section 5.3 (Option C)
    // ==========================================================================

    async function handleEnterStudio() {
        if (!contract) return

        // Auto-accept in background (entering studio = engaging)
        try {
            if (recipient?.recipientId) {
                await supabase
                    .from('qc_recipients')
                    .update({
                        status: 'accepted',
                        response_type: 'accepted',
                        responded_at: new Date().toISOString()
                    })
                    .eq('recipient_id', recipient.recipientId)
            }
        } catch (err) {
            console.warn('Auto-accept failed (non-blocking):', err)
        }

        // Store QC redirect context in sessionStorage
        // The Provider Landing Page reads this after login
        const qcRedirect = {
            contractId: contract.sourceContractId || contract.quickContractId,
            contractName: contract.contractName,
            contractType: contract.contractType,
            senderCompany: contract.senderCompany,
            source: 'qc_token_page'
        }
        sessionStorage.setItem('clarence_qc_redirect', JSON.stringify(qcRedirect))

        // Log audit event (fire-and-forget — navigate regardless of outcome)
        if (recipient) {
            try {
                await supabase
                    .from('qc_audit_log')
                    .insert({
                        quick_contract_id: contract.quickContractId,
                        recipient_id: recipient.recipientId,
                        event_type: 'enter_studio_clicked',
                        event_description: 'Recipient clicked Enter Studio — routing to authentication',
                        event_data: { source: 'qc_token_page' }
                    })
            } catch {
                // Audit log failure is non-blocking
            }
        }

        // Hard nav to provider auth page
        window.location.href = '/provider'
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
                        This contract has expired and is no longer available for response. Please contact the sender if you believe this is an error.
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
                        {isAccepted ? 'Contract Under Review' : 'Contract Declined'}
                    </h1>
                    <p className="text-slate-500 mb-2">
                        {isAccepted
                            ? 'You are reviewing this contract.'
                            : `You declined this contract on ${formatDate(recipient?.respondedAt || null)}.`
                        }
                    </p>
                    {contract && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg text-left">
                            <p className="font-medium text-slate-800">{contract.contractName}</p>
                            <p className="text-sm text-slate-500">{getContractTypeLabel(contract.contractType)}</p>
                            {contract.clauseCount > 0 && (
                                <p className="text-sm text-slate-400 mt-1">{contract.clauseCount} clauses</p>
                            )}
                        </div>
                    )}
                    {isAccepted && contract && (
                        <button
                            onClick={handleEnterStudio}
                            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Return to Review Studio
                        </button>
                    )}
                    {!isAccepted && (
                        <Link
                            href="/"
                            className="mt-6 inline-block text-teal-600 hover:text-teal-700 font-medium text-sm"
                        >
                            Go to CLARENCE Homepage
                        </Link>
                    )}
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

                    {/* Enter Studio CTA for accepted contracts */}
                    {isAccepted && contract && (
                        <div className="mb-6">
                            <div className="border border-teal-200 bg-teal-50 rounded-lg p-4">
                                <p className="text-sm text-teal-800 mb-3">
                                    Ready to negotiate the details? Enter the CLARENCE Studio to discuss terms with the sender.
                                </p>
                                <button
                                    onClick={handleEnterStudio}
                                    className="w-full px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Enter CLARENCE Studio
                                </button>
                            </div>
                        </div>
                    )}

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
                            <div className="flex items-center gap-3 text-slate-500">
                                <span>{getContractTypeLabel(contract?.contractType || null)}</span>
                                {contract && contract.clauseCount > 0 && (
                                    <>
                                        <span className="text-slate-300">&middot;</span>
                                        <span>{contract.clauseCount} clauses</span>
                                    </>
                                )}
                            </div>
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
                            <div className="text-center py-12">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-slate-500 font-medium">Contract document is being processed</p>
                                <p className="text-slate-400 text-sm mt-1">
                                    {contract && contract.clauseCount > 0
                                        ? `${contract.clauseCount} clauses have been identified and are ready for review in the Studio.`
                                        : 'Enter the CLARENCE Studio below to review the full contract and its clauses.'
                                    }
                                </p>
                            </div>
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
                {/* SECTION 22B: ENTER STUDIO (SINGLE CTA)                         */}
                {/* This is the ONLY action button for the recipient.               */}
                {/*  1. Auto-accepts the contract (entering = engaging)             */}
                {/*  2. Stores redirect context in sessionStorage                   */}
                {/*  3. Routes to /provider for authentication                      */}
                {/*  4. Provider Landing Page reads context and routes to Studio    */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="font-semibold text-white text-lg">Ready to Review This Contract?</h2>
                                <p className="text-teal-100 text-sm">
                                    Enter the CLARENCE Studio to review clauses, discuss terms, and negotiate with {contract?.senderCompany || 'the sender'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-5">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-1 text-center sm:text-left">
                                <p className="text-sm text-slate-600">
                                    CLARENCE, The Honest Broker, will guide both parties through each clause to help you reach a fair agreement. You will be asked to sign in or create an account.
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <button
                                    onClick={handleEnterStudio}
                                    disabled={!contract?.quickContractId}
                                    className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    Enter CLARENCE Studio
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* NOTE: Section 23 (duplicate "Review Contract" button) has been  */}
                {/* removed in v1.2. Section 22B above is the single CTA.           */}

            </main>

            {/* ================================================================== */}
            {/* SECTION 24: RESPONSE MODAL */}
            {/* ================================================================== */}
            {showResponseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            {responseType === 'accepted' ? 'Confirm Acceptance' : 'Confirm Decline'}
                        </h2>

                        {responseType === 'declined' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Reason for declining (optional)
                                </label>
                                <select
                                    value={declineReason}
                                    onChange={(e) => setDeclineReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                                >
                                    <option value="">Select a reason...</option>
                                    <option value="terms_unfavorable">Terms are unfavorable</option>
                                    <option value="pricing">Pricing concerns</option>
                                    <option value="timeline">Timeline doesn&apos;t work</option>
                                    <option value="scope">Scope mismatch</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Message to sender (optional)
                            </label>
                            <textarea
                                value={responseMessage}
                                onChange={(e) => setResponseMessage(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                                placeholder={responseType === 'accepted'
                                    ? 'Any comments for the sender...'
                                    : 'Explain your decision...'}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowResponseModal(false)
                                    setResponseType(null)
                                    setDeclineReason('')
                                    setResponseMessage('')
                                }}
                                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitResponse}
                                disabled={submitting}
                                className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50
                                    ${responseType === 'accepted'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {submitting ? 'Submitting...' : (responseType === 'accepted' ? 'Confirm Accept' : 'Confirm Decline')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}