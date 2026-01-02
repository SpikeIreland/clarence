'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================
interface ProviderInvite {
    id: string
    companyName: string
    contactName: string
    contactEmail: string
    status: 'pending' | 'sending' | 'sent' | 'error'
    errorMessage?: string
}

interface SessionData {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    status: string
}

// ============================================================================
// SECTION 2: CONSTANTS
// ============================================================================
const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 3: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================
export default function InviteProvidersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        }>
            <InviteProvidersContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 4: MAIN CONTENT COMPONENT
// ============================================================================
function InviteProvidersContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // ========================================================================
    // SECTION 5: STATE
    // ========================================================================
    const [loading, setLoading] = useState(true)
    const [session, setSession] = useState<SessionData | null>(null)
    const [providers, setProviders] = useState<ProviderInvite[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [allSent, setAllSent] = useState(false)

    // New provider form
    const [newProvider, setNewProvider] = useState({
        companyName: '',
        contactName: '',
        contactEmail: ''
    })

    // ========================================================================
    // SECTION 6: INITIALIZATION
    // ========================================================================
    useEffect(() => {
        const initializePage = async () => {
            const sessionId = searchParams.get('session_id')
            const sessionNumber = searchParams.get('session_number')

            if (!sessionId) {
                router.push('/auth/contracts-dashboard')
                return
            }

            // Load session data
            try {
                const response = await fetch(`${API_BASE}/customer-requirements-api?session_id=${sessionId}`)
                if (response.ok) {
                    const data = await response.json()
                    setSession({
                        sessionId,
                        sessionNumber: sessionNumber || data.session_number || '',
                        customerCompany: data.company_name || data.companyName || '',
                        serviceRequired: data.service_required || data.serviceRequired || '',
                        dealValue: data.deal_value || data.dealValue || '',
                        status: 'customer_onboarding_complete'
                    })
                } else {
                    // Set basic session data if API fails
                    setSession({
                        sessionId,
                        sessionNumber: sessionNumber || '',
                        customerCompany: '',
                        serviceRequired: '',
                        dealValue: '',
                        status: 'customer_onboarding_complete'
                    })
                }
            } catch (error) {
                console.error('Error loading session:', error)
                setSession({
                    sessionId,
                    sessionNumber: sessionNumber || '',
                    customerCompany: '',
                    serviceRequired: '',
                    dealValue: '',
                    status: 'customer_onboarding_complete'
                })
            }

            setLoading(false)
        }

        initializePage()
    }, [searchParams, router])

    // ========================================================================
    // SECTION 7: PROVIDER MANAGEMENT
    // ========================================================================
    const addProvider = () => {
        if (!newProvider.companyName || !newProvider.contactEmail) {
            alert('Please enter at least company name and email')
            return
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(newProvider.contactEmail)) {
            alert('Please enter a valid email address')
            return
        }

        // Check for duplicate email
        if (providers.some(p => p.contactEmail.toLowerCase() === newProvider.contactEmail.toLowerCase())) {
            alert('This email has already been added')
            return
        }

        const provider: ProviderInvite = {
            id: Date.now().toString(),
            companyName: newProvider.companyName,
            contactName: newProvider.contactName || newProvider.companyName,
            contactEmail: newProvider.contactEmail,
            status: 'pending'
        }

        setProviders(prev => [...prev, provider])
        setNewProvider({ companyName: '', contactName: '', contactEmail: '' })
    }

    const removeProvider = (id: string) => {
        if (window.confirm('Remove this provider from the invite list?')) {
            setProviders(prev => prev.filter(p => p.id !== id))
        }
    }

    const resetProviderStatus = (id: string) => {
        setProviders(prev => prev.map(p =>
            p.id === id ? { ...p, status: 'pending' as const, errorMessage: undefined } : p
        ))
    }

    // ========================================================================
    // SECTION 8: SEND INVITATIONS
    // ========================================================================
    const sendInvitations = async () => {
        // Only send pending providers (allows retry of failed ones)
        const pendingProviders = providers.filter(p => p.status === 'pending')

        if (pendingProviders.length === 0) {
            alert('No pending invitations to send')
            return
        }

        if (!session?.sessionId) return

        setIsSubmitting(true)

        let successCount = 0
        let failCount = 0

        // Send invitations one by one
        for (const provider of pendingProviders) {
            // Update status to sending
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'sending' as const } : p
            ))

            try {
                const response = await fetch(`${API_BASE}/invite-provider`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: session.sessionId,
                        sessionNumber: session.sessionNumber,
                        customerCompany: session.customerCompany,
                        serviceRequired: session.serviceRequired,
                        dealValue: session.dealValue,
                        provider: {
                            companyName: provider.companyName,
                            contactName: provider.contactName,
                            contactEmail: provider.contactEmail
                        }
                    })
                })

                if (response.ok) {
                    setProviders(prev => prev.map(p =>
                        p.id === provider.id ? { ...p, status: 'sent' as const } : p
                    ))
                    successCount++
                } else {
                    const error = await response.json()
                    setProviders(prev => prev.map(p =>
                        p.id === provider.id ? { ...p, status: 'error' as const, errorMessage: error.message || 'Failed to send' } : p
                    ))
                    failCount++
                }
            } catch (error) {
                console.error('Error sending invitation:', error)
                setProviders(prev => prev.map(p =>
                    p.id === provider.id ? { ...p, status: 'error' as const, errorMessage: 'Network error' } : p
                ))
                failCount++
            }

            // Small delay between sends
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        setIsSubmitting(false)

        // Check if at least one was sent successfully
        const anySuccessful = providers.some(p => p.status === 'sent')
        if (anySuccessful) {
            setAllSent(true)
        }

        // Show summary
        if (failCount > 0 && successCount > 0) {
            alert(`${successCount} invitation(s) sent successfully. ${failCount} failed - you can retry or remove them.`)
        } else if (failCount > 0 && successCount === 0) {
            alert(`Failed to send invitations. Please check the errors and retry.`)
        }
    }

    const proceedToWaiting = () => {
        router.push(`/auth/contracts-dashboard?session_id=${session?.sessionId}`)
    }

    // ========================================================================
    // SECTION 9: LOADING STATE
    // ========================================================================
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        )
    }

    // ========================================================================
    // SECTION 10: MAIN RENDER
    // ========================================================================
    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================ */}
            {/* SECTION 11: NAVIGATION */}
            {/* ================================================================ */}
            <nav className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/auth/contracts-dashboard" className="flex items-center">
                                <div>
                                    <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                                    <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                                </div>
                            </Link>
                            <span className="ml-4 text-slate-600 text-sm">Invite Providers</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {session?.sessionNumber && (
                                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    {session.sessionNumber}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Session Banner */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white py-3">
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-slate-300 text-xs">Session</span>
                            <div className="font-mono text-sm">{session?.sessionNumber}</div>
                        </div>
                        <div>
                            <span className="text-slate-300 text-xs">Status</span>
                            <div className="text-sm">
                                <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-xs">
                                    Ready to Invite Providers
                                </span>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-300 text-xs">Phase</span>
                            <div className="text-sm">3 - Provider Selection</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 12: MAIN CONTENT */}
            {/* ================================================================ */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Session Summary Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-medium text-slate-800 mb-4">Contract Summary</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Customer</span>
                            <div className="text-sm font-medium text-slate-800">{session?.customerCompany || '—'}</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Service Required</span>
                            <div className="text-sm font-medium text-slate-800">{session?.serviceRequired || '—'}</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <span className="text-xs text-slate-500">Deal Value</span>
                            <div className="text-sm font-medium text-slate-800">
                                {session?.dealValue ? `£${Number(session.dealValue).toLocaleString()}` : '—'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Provider Form */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-medium text-slate-800 mb-4">Add Providers to Invite</h2>
                    <p className="text-sm text-slate-600 mb-4">
                        Enter the details of providers you want to invite to participate in this contract negotiation.
                        They will receive an email with instructions to submit their capabilities.
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Company Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                                placeholder="Provider Corp"
                                value={newProvider.companyName}
                                onChange={(e) => setNewProvider(prev => ({ ...prev, companyName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Contact Name
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                                placeholder="John Smith"
                                value={newProvider.contactName}
                                onChange={(e) => setNewProvider(prev => ({ ...prev, contactName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                                placeholder="john@provider.com"
                                value={newProvider.contactEmail}
                                onChange={(e) => setNewProvider(prev => ({ ...prev, contactEmail: e.target.value }))}
                                onKeyPress={(e) => e.key === 'Enter' && addProvider()}
                            />
                        </div>
                    </div>

                    <button
                        onClick={addProvider}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
                    >
                        + Add Provider
                    </button>
                </div>

                {/* Provider List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-slate-800">Providers to Invite</h2>
                        <span className="text-sm text-slate-500">{providers.length} provider{providers.length !== 1 ? 's' : ''}</span>
                    </div>

                    {providers.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <div className="text-4xl mb-2">📧</div>
                            <p>No providers added yet</p>
                            <p className="text-sm">Add providers using the form above</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {providers.map((provider) => (
                                <div
                                    key={provider.id}
                                    className={`flex items-center justify-between p-4 rounded-lg border ${provider.status === 'sent'
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : provider.status === 'error'
                                            ? 'bg-red-50 border-red-200'
                                            : provider.status === 'sending'
                                                ? 'bg-blue-50 border-blue-200'
                                                : 'bg-slate-50 border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${provider.status === 'sent'
                                            ? 'bg-emerald-500'
                                            : provider.status === 'error'
                                                ? 'bg-red-500'
                                                : provider.status === 'sending'
                                                    ? 'bg-blue-500'
                                                    : 'bg-slate-400'
                                            }`}>
                                            {provider.status === 'sent' ? '✓' :
                                                provider.status === 'error' ? '!' :
                                                    provider.status === 'sending' ? '...' :
                                                        provider.companyName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-800">{provider.companyName}</div>
                                            <div className="text-sm text-slate-500">
                                                {provider.contactName} • {provider.contactEmail}
                                            </div>
                                            {provider.errorMessage && (
                                                <div className="text-xs text-red-600 mt-1">{provider.errorMessage}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2 py-1 rounded ${provider.status === 'sent'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : provider.status === 'error'
                                                ? 'bg-red-100 text-red-700'
                                                : provider.status === 'sending'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {provider.status === 'sent' ? 'Invitation Sent' :
                                                provider.status === 'error' ? 'Failed' :
                                                    provider.status === 'sending' ? 'Sending...' :
                                                        'Ready to Send'}
                                        </span>

                                        {/* Action buttons based on status */}
                                        {provider.status === 'pending' && (
                                            <button
                                                onClick={() => removeProvider(provider.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                title="Remove provider"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}

                                        {provider.status === 'error' && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => resetProviderStatus(provider.id)}
                                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all"
                                                    title="Retry sending"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => removeProvider(provider.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                    title="Remove provider"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}

                                        {provider.status === 'sent' && (
                                            <span className="text-emerald-500">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => router.push('/auth/contracts-dashboard')}
                        className="px-6 py-3 text-slate-600 hover:text-slate-800 transition-all"
                    >
                        ← Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Show "Continue" button once any invitations have been sent */}
                        {allSent && (
                            <button
                                onClick={proceedToWaiting}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 font-medium transition-all"
                            >
                                Continue to Dashboard →
                            </button>
                        )}

                        {/* Always show send button if there are pending providers */}
                        {providers.some(p => p.status === 'pending') && (
                            <button
                                onClick={sendInvitations}
                                disabled={isSubmitting}
                                className="px-8 py-3 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Sending...
                                    </>
                                ) : (
                                    <>Send {providers.filter(p => p.status === 'pending').length} Invitation{providers.filter(p => p.status === 'pending').length !== 1 ? 's' : ''}</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Help Text */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">What happens next?</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Each provider will receive an email invitation with a unique link</li>
                        <li>• They&apos;ll complete a capabilities form (similar to your requirements)</li>
                        <li>• CLARENCE will analyze both parties and calculate leverage positions</li>
                        <li>• Once a provider submits, you&apos;ll be notified and can begin negotiation</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}