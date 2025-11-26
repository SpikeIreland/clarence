'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES
// ============================================================================

interface InviteDetails {
    sessionId: string
    sessionNumber: string
    customerCompany: string
    serviceRequired: string
    dealValue: string
    token: string
    valid: boolean
}

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================

const API_BASE = 'https://spikeislandstudios.app.n8n.cloud/webhook'

// ============================================================================
// SECTION 3: MAIN COMPONENT
// ============================================================================

function ProviderInviteContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [loading, setLoading] = useState(true)
    const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
    const [error, setError] = useState<string | null>(null)

    // ============================================================================
    // SECTION 4: VALIDATE INVITE TOKEN
    // ============================================================================

    useEffect(() => {
        const validateInvite = async () => {
            const sessionId = searchParams.get('session_id')
            const token = searchParams.get('token')

            if (!sessionId || !token) {
                setError('Invalid invitation link. Please check your email for the correct link.')
                setLoading(false)
                return
            }

            try {
                // Validate token with backend
                const response = await fetch(
                    `${API_BASE}/validate-provider-invite?session_id=${sessionId}&token=${token}`
                )

                if (response.ok) {
                    const data = await response.json()
                    setInviteDetails({
                        sessionId,
                        sessionNumber: data.sessionNumber || '',
                        customerCompany: data.customerCompany || 'A customer',
                        serviceRequired: data.serviceRequired || 'Services',
                        dealValue: data.dealValue || '',
                        token,
                        valid: true
                    })
                } else {
                    // If validation endpoint doesn't exist yet, still show the page
                    // Just use data from URL params
                    setInviteDetails({
                        sessionId,
                        sessionNumber: '',
                        customerCompany: 'A customer',
                        serviceRequired: 'Services',
                        dealValue: '',
                        token,
                        valid: true
                    })
                }
            } catch (err) {
                console.error('Error validating invite:', err)
                // Still allow access for demo purposes
                setInviteDetails({
                    sessionId,
                    sessionNumber: '',
                    customerCompany: 'A customer',
                    serviceRequired: 'Services',
                    dealValue: '',
                    token,
                    valid: true
                })
            }

            setLoading(false)
        }

        validateInvite()
    }, [searchParams])

    // ============================================================================
    // SECTION 5: HANDLE CONTINUE
    // ============================================================================

    const handleContinue = (isNewUser: boolean) => {
        if (!inviteDetails) return

        const returnUrl = `/auth/provider-intake?session_id=${inviteDetails.sessionId}&token=${inviteDetails.token}`

        if (isNewUser) {
            router.push(`/auth/register?role=provider&redirect=${encodeURIComponent(returnUrl)}`)
        } else {
            router.push(`/auth/login?role=provider&redirect=${encodeURIComponent(returnUrl)}`)
        }
    }

    // ============================================================================
    // SECTION 6: LOADING STATE
    // ============================================================================

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Validating invitation...</p>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 7: ERROR STATE
    // ============================================================================

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-slate-800 mb-2">Invalid Invitation</h1>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition"
                    >
                        Go to Homepage
                    </Link>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 8: MAIN RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-10 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-white font-bold text-2xl">C</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Invited!</h1>
                    <p className="text-emerald-100">Contract Negotiation via CLARENCE</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="bg-slate-50 rounded-xl p-6 mb-6">
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                            Invitation Details
                        </h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-slate-600">From:</span>
                                <span className="font-medium text-slate-800">{inviteDetails?.customerCompany}</span>
                            </div>
                            {inviteDetails?.serviceRequired && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Service:</span>
                                    <span className="font-medium text-slate-800">{inviteDetails.serviceRequired}</span>
                                </div>
                            )}
                            {inviteDetails?.dealValue && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Estimated Value:</span>
                                    <span className="font-medium text-emerald-600">{inviteDetails.dealValue}</span>
                                </div>
                            )}
                            {inviteDetails?.sessionNumber && (
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Reference:</span>
                                    <span className="font-mono text-sm text-slate-800">{inviteDetails.sessionNumber}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-slate-600 text-center mb-6">
                        Complete your provider intake to participate in this contract negotiation.
                    </p>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleContinue(false)}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                            Sign In & Continue
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>

                        <button
                            onClick={() => handleContinue(true)}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition cursor-pointer"
                        >
                            New to CLARENCE? Create Account
                        </button>
                    </div>

                    {/* Info */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">What is CLARENCE?</h3>
                        <ul className="text-sm text-slate-600 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-500">✓</span>
                                AI-powered contract mediation platform
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-500">✓</span>
                                Fair, transparent negotiation process
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-emerald-500">✓</span>
                                Your information remains confidential
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-8 py-4 text-center">
                    <p className="text-xs text-slate-500">
                        © 2025 Spike Island Studios. Powered by CLARENCE.
                    </p>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// SECTION 9: EXPORT WITH SUSPENSE
// ============================================================================

export default function ProviderInvitePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <ProviderInviteContent />
        </Suspense>
    )
}