'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ============================================================================
// SECTION 1: MAIN COMPONENT WRAPPER (Suspense)
// ============================================================================
export default function ProviderConfirmationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-slate-300 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        }>
            <ProviderConfirmationContent />
        </Suspense>
    )
}

// ============================================================================
// SECTION 2: MAIN CONTENT COMPONENT
// ============================================================================
function ProviderConfirmationContent() {
    const searchParams = useSearchParams()
    const [sessionId, setSessionId] = useState<string | null>(null)

    useEffect(() => {
        setSessionId(searchParams.get('session_id'))
    }, [searchParams])

    // ========================================================================
    // SECTION 3: MAIN RENDER
    // ========================================================================
    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================ */}
            {/* SECTION 4: NAVIGATION */}
            {/* ================================================================ */}
            <nav className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <div>
                                <div className="text-2xl font-medium text-slate-700">CLARENCE</div>
                                <div className="text-xs text-slate-500 tracking-widest font-light">THE HONEST BROKER</div>
                            </div>
                            <span className="ml-4 text-emerald-600 text-sm font-medium">Provider Portal</span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ================================================================ */}
            {/* SECTION 5: CONFIRMATION CONTENT */}
            {/* ================================================================ */}
            <div className="max-w-2xl mx-auto px-4 py-16">
                {/* Success Icon */}
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-medium text-slate-800 mb-2">Capabilities Submitted!</h1>
                    <p className="text-lg text-slate-600">Thank you for your submission</p>
                </div>

                {/* Confirmation Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
                    <div className="space-y-6">
                        {/* Status */}
                        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xl">✓</span>
                            </div>
                            <div>
                                <div className="font-medium text-slate-800">Submission Received</div>
                                <div className="text-sm text-slate-500">
                                    {new Date().toLocaleDateString('en-GB', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* What Happens Next */}
                        <div>
                            <h2 className="text-lg font-medium text-slate-800 mb-4">What Happens Next?</h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-slate-600 text-sm font-medium">1</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-700">CLARENCE Analysis</div>
                                        <p className="text-sm text-slate-500">Our AI will analyze your capabilities against the customer&apos;s requirements to identify alignment and potential negotiation points.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-slate-600 text-sm font-medium">2</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-700">Leverage Calculation</div>
                                        <p className="text-sm text-slate-500">Fair leverage positions will be calculated based on market data, ensuring transparent and balanced negotiations.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-slate-600 text-sm font-medium">3</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-700">Negotiation Invitation</div>
                                        <p className="text-sm text-slate-500">You&apos;ll receive an email when the contract negotiation is ready to begin, with access to the Contract Studio.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Estimate */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                    <div className="flex items-start gap-3">
                        <span className="text-blue-500 text-xl">⏱️</span>
                        <div>
                            <h3 className="font-medium text-blue-800">Expected Timeline</h3>
                            <p className="text-sm text-blue-700">You should receive notification within 2-3 business days once the customer is ready to proceed with negotiations.</p>
                        </div>
                    </div>
                </div>

                {/* Session Reference */}
                {sessionId && (
                    <div className="bg-slate-50 rounded-lg p-4 mb-8 text-center">
                        <span className="text-xs text-slate-500">Reference ID</span>
                        <div className="font-mono text-sm text-slate-600">{sessionId}</div>
                    </div>
                )}

                {/* Actions */}
                <div className="text-center space-y-4">
                    <p className="text-slate-600">A confirmation email has been sent with these details.</p>

                    <div className="flex justify-center gap-4">
                        <Link
                            href="/"
                            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all font-medium"
                        >
                            Return Home
                        </Link>
                    </div>
                </div>

                {/* Contact Support */}
                <div className="mt-12 text-center">
                    <p className="text-sm text-slate-500">
                        Questions? Contact us at{' '}
                        <a href="mailto:support@spikeisland.ai" className="text-emerald-600 hover:underline">
                            support@spikeisland.ai
                        </a>
                    </p>
                </div>
            </div>

            {/* ================================================================ */}
            {/* SECTION 6: FOOTER */}
            {/* ================================================================ */}
            <footer className="border-t border-slate-200 py-8 mt-16">
                <div className="max-w-5xl mx-auto px-4 text-center">
                    <div className="text-slate-400 text-sm">
                        © {new Date().getFullYear()} CLARENCE by Spike Island Studios. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    )
}