'use client'

// ============================================================================
// FILE: app/components/ComplianceGuidanceBanner.tsx
// PURPOSE: Inline guidance banner for soft playbook compliance tips
// ============================================================================

import { useState, useEffect } from 'react'
import { type GuidanceTip } from '@/lib/agents/compliance-checker'

interface ComplianceGuidanceBannerProps {
    tips: GuidanceTip[]
    autoDismissMs?: number
    onDismiss?: () => void
}

export default function ComplianceGuidanceBanner({
    tips,
    autoDismissMs = 8000,
    onDismiss,
}: ComplianceGuidanceBannerProps) {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        if (autoDismissMs <= 0) return
        const timer = setTimeout(() => {
            setVisible(false)
            onDismiss?.()
        }, autoDismissMs)
        return () => clearTimeout(timer)
    }, [autoDismissMs, onDismiss])

    useEffect(() => {
        setVisible(true)
    }, [tips])

    if (!visible || tips.length === 0) return null

    return (
        <div className="animate-in slide-in-from-top-2 duration-300 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mt-2 mb-1">
            <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-blue-700 mb-1">Playbook Guidance</p>
                    {tips.map((tip, idx) => (
                        <p key={tip.ruleId || idx} className="text-xs text-blue-600 leading-relaxed">
                            {tip.clauseName !== tips[0]?.clauseName && (
                                <span className="font-medium">{tip.clauseName}: </span>
                            )}
                            {tip.tip}
                        </p>
                    ))}
                </div>
                <button
                    onClick={() => { setVisible(false); onDismiss?.() }}
                    className="text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
