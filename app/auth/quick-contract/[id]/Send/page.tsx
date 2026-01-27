'use client'

// ============================================================================
// QUICK CONTRACT - SEND PAGE
// Version: 1.0
// Date: 27 January 2026
// Path: /app/auth/quick-contract/[id]/send/page.tsx
// Description: Send a Quick Contract to recipients
// ============================================================================

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { eventLogger } from '@/lib/eventLogger'
import FeedbackButton from '@/app/components/FeedbackButton'

// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface UserInfo {
    firstName: string
    lastName: string
    email: string
    company: string
    companyId: string
    role: string
    userId: string
}

interface QuickContract {
    quickContractId: string
    companyId: string
    createdByUserId: string
    contractName: string
    contractType: string | null
    description: string | null
    referenceNumber: string | null
    documentContent: string | null
    status: string
    createdAt: string
    allowRecipientComments: boolean
    requireFullScroll: boolean
    sendReminderAfterDays: number
    autoExpireAfterDays: number
}

interface RecipientInput {
    id: string
    name: string
    email: string
    company: string
    role: string
}

interface SendSettings {
    personalMessage: string
    expiresInDays: number
    sendReminderAfterDays: number
    allowComments: boolean
    requireFullScroll: boolean
}

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
    'other': 'Other'
}

const EXPIRY_OPTIONS = [
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 60, label: '60 days' },
    { value: 90, label: '90 days' }
]

const REMINDER_OPTIONS = [
    { value: 0, label: 'No reminder' },
    { value: 1, label: 'After 1 day' },
    { value: 3, label: 'After 3 days' },
    { value: 7, label: 'After 7 days' }
]

// ============================================================================
// SECTION 4: HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
    return Math.random().toString(36).substring(2, 15)
}

function validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
}

function createEmptyRecipient(): RecipientInput {
    return {
        id: generateId(),
        name: '',
        email: '',
        company: '',
        role: ''
    }
}

// ============================================================================
// SECTION 5: LOADING FALLBACK COMPONENT
// ============================================================================

function LoadingFallback() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading...</p>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 6: MAIN PAGE WRAPPER (with Suspense)
// ============================================================================

export default function SendQuickContractPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <SendQuickContractContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 7: MAIN CONTENT COMPONENT
// ============================================================================

function SendQuickContractContent() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const contractId = params.id as string

    // ==========================================================================
    // SECTION 8: STATE DECLARATIONS
    // ==========================================================================

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
    const [contract, setContract] = useState<QuickContract | null>(null)
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

    // Recipients state
    const [recipients, setRecipients] = useState<RecipientInput[]>([createEmptyRecipient()])

    // Settings state
    const [settings, setSettings] = useState<SendSettings>({
        personalMessage: '',
        expiresInDays: 30,
        sendReminderAfterDays: 3,
        allowComments: true,
        requireFullScroll: false
    })

    // Email preview
    const [showPreview, setShowPreview] = useState(false)

    // ==========================================================================
    // SECTION 9: DATA LOADING
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

    const loadContract = useCallback(async () => {
        if (!contractId) return

        try {
            const { data, error: loadError } = await supabase
                .from('quick_contracts')
                .select('*')
                .eq('quick_contract_id', contractId)
                .single()

            if (loadError || !data) {
                console.error('Error loading contract:', loadError)
                setError('Contract not found')
                return
            }

            // Check if contract can be sent
            if (!['draft', 'ready'].includes(data.status)) {
                setError('This contract has already been sent or is not available for sending')
                return
            }

            const transformedContract: QuickContract = {
                quickContractId: data.quick_contract_id,
                companyId: data.company_id,
                createdByUserId: data.created_by_user_id,
                contractName: data.contract_name,
                contractType: data.contract_type,
                description: data.description,
                referenceNumber: data.reference_number,
                documentContent: data.document_content,
                status: data.status,
                createdAt: data.created_at,
                allowRecipientComments: data.allow_recipient_comments ?? true,
                requireFullScroll: data.require_full_scroll ?? false,
                sendReminderAfterDays: data.send_reminder_after_days ?? 3,
                autoExpireAfterDays: data.auto_expire_after_days ?? 30
            }

            setContract(transformedContract)

            // Initialize settings from contract defaults
            setSettings(prev => ({
                ...prev,
                expiresInDays: transformedContract.autoExpireAfterDays,
                sendReminderAfterDays: transformedContract.sendReminderAfterDays,
                allowComments: transformedContract.allowRecipientComments,
                requireFullScroll: transformedContract.requireFullScroll
            }))

        } catch (err) {
            console.error('Error loading contract:', err)
            setError('Failed to load contract')
        } finally {
            setLoading(false)
        }
    }, [contractId, supabase])

    // ==========================================================================
    // SECTION 10: EFFECTS
    // ==========================================================================

    useEffect(() => {
        const init = async () => {
            const user = await loadUserInfo()
            if (user) {
                await loadContract()
            }
        }
        init()
    }, [loadUserInfo, loadContract])

    // ==========================================================================
    // SECTION 11: RECIPIENT HANDLERS
    // ==========================================================================

    function handleAddRecipient() {
        setRecipients(prev => [...prev, createEmptyRecipient()])
    }

    function handleRemoveRecipient(id: string) {
        if (recipients.length === 1) return
        setRecipients(prev => prev.filter(r => r.id !== id))
        // Clear validation error for this recipient
        setValidationErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors[`${id}-name`]
            delete newErrors[`${id}-email`]
            return newErrors
        })
    }

    function handleRecipientChange(id: string, field: keyof RecipientInput, value: string) {
        setRecipients(prev => prev.map(r =>
            r.id === id ? { ...r, [field]: value } : r
        ))
        // Clear validation error when user starts typing
        if (validationErrors[`${id}-${field}`]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[`${id}-${field}`]
                return newErrors
            })
        }
    }

    // ==========================================================================
    // SECTION 12: VALIDATION
    // ==========================================================================

    function validateForm(): boolean {
        const errors: Record<string, string> = {}

        recipients.forEach(recipient => {
            if (!recipient.name.trim()) {
                errors[`${recipient.id}-name`] = 'Name is required'
            }
            if (!recipient.email.trim()) {
                errors[`${recipient.id}-email`] = 'Email is required'
            } else if (!validateEmail(recipient.email)) {
                errors[`${recipient.id}-email`] = 'Invalid email address'
            }
        })

        // Check for duplicate emails
        const emails = recipients.map(r => r.email.toLowerCase().trim()).filter(e => e)
        const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index)
        if (duplicates.length > 0) {
            recipients.forEach(r => {
                if (duplicates.includes(r.email.toLowerCase().trim())) {
                    errors[`${r.id}-email`] = 'Duplicate email address'
                }
            })
        }

        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    // ==========================================================================
    // SECTION 13: SEND HANDLER
    // ==========================================================================

    async function handleSend() {
        if (!contract || !userInfo) return

        if (!validateForm()) {
            setError('Please fix the errors below')
            return
        }

        setSending(true)
        setError(null)

        try {
            // Calculate expiry date
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + settings.expiresInDays)

            // Create recipient records
            const recipientRecords = recipients.map(r => ({
                quick_contract_id: contractId,
                recipient_name: r.name.trim(),
                recipient_email: r.email.trim().toLowerCase(),
                recipient_company: r.company.trim() || null,
                recipient_role: r.role.trim() || null,
                access_token: generateId() + generateId(), // Generate unique token
                status: 'pending',
                personal_message: settings.personalMessage || null
            }))

            // Insert recipients
            const { data: insertedRecipients, error: insertError } = await supabase
                .from('qc_recipients')
                .insert(recipientRecords)
                .select('recipient_id, recipient_email, access_token')

            if (insertError) {
                console.error('Error inserting recipients:', insertError)
                throw new Error('Failed to add recipients')
            }

            // Update contract status and settings
            const { error: updateError } = await supabase
                .from('quick_contracts')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString(),
                    allow_recipient_comments: settings.allowComments,
                    require_full_scroll: settings.requireFullScroll,
                    send_reminder_after_days: settings.sendReminderAfterDays,
                    auto_expire_after_days: settings.expiresInDays,
                    updated_at: new Date().toISOString()
                })
                .eq('quick_contract_id', contractId)

            if (updateError) {
                console.error('Error updating contract:', updateError)
                throw new Error('Failed to update contract status')
            }

            // Log audit event
            await supabase
                .from('qc_audit_log')
                .insert({
                    quick_contract_id: contractId,
                    event_type: 'sent',
                    event_description: `Contract sent to ${recipients.length} recipient(s)`,
                    actor_user_id: userInfo.userId,
                    event_data: {
                        recipients: recipients.map(r => ({ name: r.name, email: r.email })),
                        expiresAt: expiresAt.toISOString(),
                        settings: settings
                    }
                })

            // Call N8N workflow to send emails
            try {
                const emailPayload = {
                    contractId: contractId,
                    contractName: contract.contractName,
                    contractType: contract.contractType,
                    senderName: userInfo.firstName + ' ' + userInfo.lastName,
                    senderEmail: userInfo.email,
                    senderCompany: userInfo.company,
                    personalMessage: settings.personalMessage,
                    expiresAt: expiresAt.toISOString(),
                    recipients: (insertedRecipients || []).map(r => ({
                        email: r.recipient_email,
                        token: r.access_token,
                        recipientId: r.recipient_id
                    }))
                }

                await fetch(`${API_BASE}/qc-send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailPayload)
                })

                // Update recipients to 'sent' status
                await supabase
                    .from('qc_recipients')
                    .update({ status: 'sent', updated_at: new Date().toISOString() })
                    .eq('quick_contract_id', contractId)

            } catch (emailError) {
                console.error('Error sending emails:', emailError)
                // Don't fail the whole operation if email fails
                // Recipients are created, emails can be resent
            }

            eventLogger.completed('quick_contract', 'contract_sent', {
                contractId: contractId,
                recipientCount: recipients.length
            })

            // Redirect to contract view
            router.push(`/auth/quick-contract/${contractId}`)

        } catch (err) {
            console.error('Error sending contract:', err)
            setError(err instanceof Error ? err.message : 'Failed to send contract')
        } finally {
            setSending(false)
        }
    }

    // ==========================================================================
    // SECTION 14: HELPER FUNCTIONS
    // ==========================================================================

    function getContractTypeLabel(type: string | null): string {
        if (!type) return 'Contract'
        return CONTRACT_TYPE_LABELS[type] || type
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    // ==========================================================================
    // SECTION 15: RENDER - LOADING STATE
    // ==========================================================================

    if (loading) {
        return <LoadingFallback />
    }

    // ==========================================================================
    // SECTION 16: RENDER - ERROR STATE
    // ==========================================================================

    if (error && !contract) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Cannot Send Contract</h2>
                    <p className="text-slate-500 mb-4">{error}</p>
                    <Link
                        href="/auth/quick-contract"
                        className="text-teal-600 hover:text-teal-700 font-medium"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    if (!contract) return null

    // ==========================================================================
    // SECTION 17: RENDER - MAIN LAYOUT
    // ==========================================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ================================================================== */}
            {/* SECTION 18: HEADER */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">Quick Contract</div>
                            </div>
                        </Link>

                        <div className="flex items-center gap-4">
                            <FeedbackButton position="header" />
                            <Link
                                href={`/auth/quick-contract/${contractId}`}
                                className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 19: MAIN CONTENT */}
            {/* ================================================================== */}
            <main className="max-w-4xl mx-auto px-6 py-8">

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 20: PAGE HEADER */}
                {/* ============================================================== */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Send Contract</h1>
                    <p className="text-slate-500">Add recipients and send your contract for review and acceptance.</p>
                </div>

                {/* ============================================================== */}
                {/* SECTION 21: CONTRACT SUMMARY */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                            📄
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-slate-800">{contract.contractName}</h2>
                            <p className="text-slate-500 text-sm">{getContractTypeLabel(contract.contractType)}</p>
                            {contract.referenceNumber && (
                                <p className="text-slate-400 text-xs mt-1">Ref: {contract.referenceNumber}</p>
                            )}
                        </div>
                        <Link
                            href={`/auth/quick-contract/${contractId}`}
                            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                            View Contract
                        </Link>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 22: RECIPIENTS */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Recipients</h2>
                            <p className="text-slate-500 text-sm">Who should receive this contract?</p>
                        </div>
                        <button
                            onClick={handleAddRecipient}
                            className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Another
                        </button>
                    </div>

                    <div className="space-y-4">
                        {recipients.map((recipient, index) => (
                            <div
                                key={recipient.id}
                                className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-slate-600">
                                        Recipient {recipients.length > 1 ? index + 1 : ''}
                                    </span>
                                    {recipients.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveRecipient(recipient.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={recipient.name}
                                            onChange={(e) => handleRecipientChange(recipient.id, 'name', e.target.value)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm ${validationErrors[`${recipient.id}-name`] ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                }`}
                                            placeholder="John Smith"
                                        />
                                        {validationErrors[`${recipient.id}-name`] && (
                                            <p className="text-red-500 text-xs mt-1">{validationErrors[`${recipient.id}-name`]}</p>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={recipient.email}
                                            onChange={(e) => handleRecipientChange(recipient.id, 'email', e.target.value)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm ${validationErrors[`${recipient.id}-email`] ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                                }`}
                                            placeholder="john@example.com"
                                        />
                                        {validationErrors[`${recipient.id}-email`] && (
                                            <p className="text-red-500 text-xs mt-1">{validationErrors[`${recipient.id}-email`]}</p>
                                        )}
                                    </div>

                                    {/* Company */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Company <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={recipient.company}
                                            onChange={(e) => handleRecipientChange(recipient.id, 'company', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder="Acme Corporation"
                                        />
                                    </div>

                                    {/* Role */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Role <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={recipient.role}
                                            onChange={(e) => handleRecipientChange(recipient.id, 'role', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                            placeholder="CEO, Legal Counsel, etc."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 23: PERSONAL MESSAGE */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-1">Personal Message</h2>
                    <p className="text-slate-500 text-sm mb-4">Add an optional message that will be included in the email.</p>

                    <textarea
                        value={settings.personalMessage}
                        onChange={(e) => setSettings(prev => ({ ...prev, personalMessage: e.target.value }))}
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                        placeholder="Hi,

I'm sending you this contract for your review. Please let me know if you have any questions.

Best regards"
                    />
                </div>

                {/* ============================================================== */}
                {/* SECTION 24: SETTINGS */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Settings</h2>

                    <div className="space-y-5">
                        {/* Expiry */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Contract Expires In
                                </label>
                                <select
                                    value={settings.expiresInDays}
                                    onChange={(e) => setSettings(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                >
                                    {EXPIRY_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    Recipients must respond before the contract expires
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Send Reminder
                                </label>
                                <select
                                    value={settings.sendReminderAfterDays}
                                    onChange={(e) => setSettings(prev => ({ ...prev, sendReminderAfterDays: parseInt(e.target.value) }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                >
                                    {REMINDER_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    Automatic reminder if no response
                                </p>
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.allowComments}
                                    onChange={(e) => setSettings(prev => ({ ...prev, allowComments: e.target.checked }))}
                                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Allow recipient comments</span>
                                    <p className="text-xs text-slate-400">Recipients can leave comments or questions</p>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.requireFullScroll}
                                    onChange={(e) => setSettings(prev => ({ ...prev, requireFullScroll: e.target.checked }))}
                                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-slate-700">Require full document scroll</span>
                                    <p className="text-xs text-slate-400">Recipients must scroll through the entire contract before accepting</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 25: EMAIL PREVIEW */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Email Preview</h2>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                            {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </button>
                    </div>

                    {showPreview && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                                <p className="text-xs text-slate-500">
                                    <strong>From:</strong> {userInfo?.firstName} {userInfo?.lastName} via CLARENCE
                                </p>
                                <p className="text-xs text-slate-500">
                                    <strong>To:</strong> {recipients.filter(r => r.email).map(r => r.email).join(', ') || 'recipient@example.com'}
                                </p>
                                <p className="text-xs text-slate-500">
                                    <strong>Subject:</strong> Contract for Review: {contract.contractName}
                                </p>
                            </div>
                            <div className="p-4 text-sm text-slate-600">
                                <p className="mb-4">
                                    Hello {recipients[0]?.name || '[Recipient Name]'},
                                </p>
                                <p className="mb-4">
                                    <strong>{userInfo?.firstName} {userInfo?.lastName}</strong> from <strong>{userInfo?.company}</strong> has
                                    sent you a contract for review.
                                </p>
                                {settings.personalMessage && (
                                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border-l-4 border-teal-500 italic">
                                        {settings.personalMessage}
                                    </div>
                                )}
                                <div className="mb-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                                    <p className="font-semibold text-teal-800 mb-1">{contract.contractName}</p>
                                    <p className="text-xs text-teal-600">{getContractTypeLabel(contract.contractType)}</p>
                                </div>
                                <p className="mb-4">
                                    Please review the contract and respond by clicking the button below.
                                    This contract expires in <strong>{settings.expiresInDays} days</strong>.
                                </p>
                                <div className="text-center my-6">
                                    <span className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg font-medium">
                                        Review Contract
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-6">
                                    This email was sent via CLARENCE Contract Management.
                                    If you have questions, please reply to this email.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 26: ACTION BUTTONS */}
                {/* ============================================================== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <Link
                            href={`/auth/quick-contract/${contractId}`}
                            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Contract
                        </Link>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        Send Contract to {recipients.length} Recipient{recipients.length > 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    )
}