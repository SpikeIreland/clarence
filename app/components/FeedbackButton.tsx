// ============================================================================
// FEEDBACK BUTTON COMPONENT
// ============================================================================
// File: app/components/FeedbackButton.tsx
// Supports two positions:
//   - "bottom-left" / "bottom-right": Fixed floating button
//   - "header": Inline button for placement in page headers
// ============================================================================

'use client'

// ============================================================================
// SECTION 1: IMPORTS
// ============================================================================

import { useState } from 'react'
import FeedbackModal from './FeedbackModal'

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

interface FeedbackButtonProps {
    position?: 'bottom-left' | 'bottom-right' | 'header'
}

// ============================================================================
// SECTION 3: COMPONENT
// ============================================================================

export default function FeedbackButton({ position = 'header' }: FeedbackButtonProps) {
    const [isOpen, setIsOpen] = useState(false)

    // ========================================================================
    // SECTION 3.1: POSITION-BASED STYLES
    // ========================================================================

    const getButtonStyles = () => {
        switch (position) {
            case 'bottom-left':
                return 'fixed bottom-6 left-6 z-50 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105'

            case 'bottom-right':
                return 'fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105'

            case 'header':
            default:
                return 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium'
        }
    }

    // ========================================================================
    // SECTION 3.2: RENDER
    // ========================================================================

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={getButtonStyles()}
                title="Send Feedback"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                </svg>
                <span>Feedback</span>
            </button>

            {isOpen && (
                <FeedbackModal onClose={() => setIsOpen(false)} />
            )}
        </>
    )
}