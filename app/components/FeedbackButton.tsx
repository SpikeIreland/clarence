'use client'

// ============================================================================
// CLARENCE Beta Feedback Button Component
// ============================================================================
// File: components/FeedbackButton.tsx
// Purpose: Floating feedback button that appears on authenticated pages
// Usage: Add <FeedbackButton /> to any page or layout
// ============================================================================

import { useState } from 'react'
import FeedbackModal from '@/app/components/FeedbackModal'

// ============================================================================
// SECTION 1: COMPONENT PROPS
// ============================================================================

interface FeedbackButtonProps {
    // Optional: Override the default position
    position?: 'bottom-right' | 'bottom-left'
    // Optional: Custom button text
    buttonText?: string
    // Optional: Hide the text label (icon only)
    iconOnly?: boolean
}

// ============================================================================
// SECTION 2: MAIN COMPONENT
// ============================================================================

export default function FeedbackButton({
    position = 'bottom-right',
    buttonText = 'Feedback',
    iconOnly = false
}: FeedbackButtonProps) {

    // -------------------------------------------------------------------------
    // SECTION 2.1: STATE
    // -------------------------------------------------------------------------

    const [isOpen, setIsOpen] = useState(false)

    // -------------------------------------------------------------------------
    // SECTION 2.2: POSITION CLASSES
    // -------------------------------------------------------------------------

    const positionClasses = {
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6'
    }

    // -------------------------------------------------------------------------
    // SECTION 2.3: RENDER
    // -------------------------------------------------------------------------

    return (
        <>
            {/* ================================================================== */}
            {/* FLOATING BUTTON */}
            {/* ================================================================== */}
            <button
                onClick={() => setIsOpen(true)}
                className={`
          fixed ${positionClasses[position]} z-50 
          bg-[#2563eb] hover:bg-[#1d4ed8] 
          text-white 
          ${iconOnly ? 'p-4' : 'px-5 py-3'}
          rounded-full 
          shadow-lg hover:shadow-xl
          flex items-center gap-2 
          transition-all duration-200
          hover:scale-105
          focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2
        `}
                title="Send Feedback to CLARENCE Team"
                aria-label="Open feedback form"
            >
                {/* Icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                </svg>

                {/* Text Label */}
                {!iconOnly && (
                    <span className="font-semibold">{buttonText}</span>
                )}
            </button>

            {/* ================================================================== */}
            {/* FEEDBACK MODAL */}
            {/* ================================================================== */}
            {isOpen && (
                <FeedbackModal onClose={() => setIsOpen(false)} />
            )}
        </>
    )
}