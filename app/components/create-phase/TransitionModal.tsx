// ============================================================================
// CLARENCE CREATE PHASE - TRANSITION MODAL COMPONENT
// ============================================================================
// File: components/create-phase/TransitionModal.tsx
// Purpose: Modal overlay for stage transitions with Clarence messaging
// Version: 1.0
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import {
    TransitionConfig,
    TransitionId,
    PathwayId,
    TRANSITION_CONFIGS,
    shouldShowTransition,
} from '@/lib/pathway-utils';
import { X, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

interface TransitionModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** The transition to display */
    transition: TransitionConfig | null;
    /** Callback when user clicks continue */
    onContinue: () => void;
    /** Callback when user closes modal (optional - some transitions may be required) */
    onClose?: () => void;
    /** Whether the modal can be dismissed */
    dismissible?: boolean;
    /** Optional provider name for T4 transition */
    providerName?: string;
    /** Custom className */
    className?: string;
}

interface TransitionModalControllerProps {
    /** Current pathway ID */
    pathwayId: PathwayId;
    /** Transition ID to potentially show */
    transitionId: TransitionId;
    /** Callback when user continues - receives the destination URL */
    onContinue: (destinationUrl: string) => void;
    /** Session ID for URL building */
    sessionId: string;
    /** Contract ID for URL building */
    contractId?: string;
    /** Provider name (for T4) */
    providerName?: string;
}

// ============================================================================
// SECTION 2: CLARENCE AVATAR COMPONENT
// ============================================================================

const ClarenceAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-10 h-10',
        md: 'w-16 h-16',
        lg: 'w-20 h-20',
    };

    return (
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg`}>
            <Sparkles className="text-white" size={size === 'sm' ? 20 : size === 'md' ? 28 : 36} />
        </div>
    );
};

// ============================================================================
// SECTION 3: MAIN MODAL COMPONENT
// ============================================================================

export const TransitionModal: React.FC<TransitionModalProps> = ({
    isOpen,
    transition,
    onContinue,
    onClose,
    dismissible = false,
    providerName,
    className = '',
}) => {
    const [isAnimating, setIsAnimating] = useState(false);

    // Handle animation on open
    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        }
    }, [isOpen]);

    if (!isOpen || !transition) return null;

    // Replace placeholder in message if provider name is provided
    const message = providerName
        ? transition.message.replace('[Provider Name]', providerName)
        : transition.message;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="transition-title"
        >
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={dismissible ? onClose : undefined}
            />

            {/* Modal Content */}
            <div
                className={`relative bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all duration-300 ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                    }`}
            >
                {/* Close button (if dismissible) */}
                {dismissible && onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                )}

                {/* Header with Clarence Avatar */}
                <div className="pt-8 pb-4 px-8 text-center border-b border-slate-100">
                    <div className="flex justify-center mb-4">
                        <ClarenceAvatar size="lg" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <CheckCircle2 className="text-emerald-500" size={20} />
                        <span className="text-sm font-medium text-emerald-600">Stage Complete</span>
                    </div>
                    <h2
                        id="transition-title"
                        className="text-2xl font-bold text-slate-800"
                    >
                        {transition.title}
                    </h2>
                </div>

                {/* Body */}
                <div className="px-8 py-6">
                    {/* Clarence's Message */}
                    <div className="bg-slate-50 rounded-xl p-5 mb-6">
                        <p className="text-slate-700 leading-relaxed">
                            "{message}"
                        </p>
                    </div>

                    {/* Bullet Points */}
                    <ul className="space-y-3">
                        {transition.bulletPoints.map((point, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-emerald-600 text-sm font-semibold">{index + 1}</span>
                                </div>
                                <span className="text-slate-600">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 rounded-b-2xl">
                    <button
                        onClick={onContinue}
                        className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl 
                       flex items-center justify-center gap-2 transition-all duration-200 
                       shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                    >
                        {transition.buttonText}
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SECTION 4: TRANSITION MODAL CONTROLLER
// ============================================================================

/**
 * Controller component that manages transition modal state
 * Use this when you want automatic transition handling
 */
export const TransitionModalController: React.FC<TransitionModalControllerProps> = ({
    pathwayId,
    transitionId,
    onContinue,
    sessionId,
    contractId,
    providerName,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hasShown, setHasShown] = useState(false);

    // Find the transition config
    const transition = TRANSITION_CONFIGS.find(t => t.id === transitionId) || null;

    // Check if this transition should be shown for this pathway
    const shouldShow = transition && shouldShowTransition(pathwayId, transitionId);

    // Show modal on mount if appropriate
    useEffect(() => {
        if (shouldShow && !hasShown) {
            // Small delay for better UX
            const timer = setTimeout(() => {
                setIsOpen(true);
                setHasShown(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [shouldShow, hasShown]);

    const handleContinue = () => {
        setIsOpen(false);

        // Build destination URL based on transition
        const baseUrls: Record<string, string> = {
            'strategic_assessment': '/auth/strategic-assessment',
            'contract_prep': '/auth/contract-prep',
            'invite_providers': '/auth/invite-provider',
            'contract_studio': '/auth/contract-studio',
        };

        const toStage = transition?.toStage;
        if (toStage && baseUrls[toStage]) {
            let url = `${baseUrls[toStage]}?session_id=${sessionId}`;
            if (contractId) url += `&contract_id=${contractId}`;
            url += `&pathway_id=${pathwayId}`;
            onContinue(url);
        }
    };

    if (!shouldShow) return null;

    return (
        <TransitionModal
            isOpen={isOpen}
            transition={transition}
            onContinue={handleContinue}
            providerName={providerName}
        />
    );
};

// ============================================================================
// SECTION 5: HOOK FOR MANUAL TRANSITION CONTROL
// ============================================================================

/**
 * Hook for manual control of transition modals
 */
export function useTransitionModal(pathwayId: PathwayId) {
    const [activeTransition, setActiveTransition] = useState<TransitionConfig | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const showTransition = (transitionId: TransitionId) => {
        if (shouldShowTransition(pathwayId, transitionId)) {
            const transition = TRANSITION_CONFIGS.find(t => t.id === transitionId);
            if (transition) {
                setActiveTransition(transition);
                setIsOpen(true);
            }
        }
    };

    const hideTransition = () => {
        setIsOpen(false);
        // Clear transition after animation
        setTimeout(() => setActiveTransition(null), 300);
    };

    return {
        activeTransition,
        isOpen,
        showTransition,
        hideTransition,
    };
}

// ============================================================================
// SECTION 6: INLINE TRANSITION BANNER (Alternative)
// ============================================================================

/**
 * An inline banner version for pages that prefer not to use modals
 */
export const TransitionBanner: React.FC<{
    transition: TransitionConfig;
    onContinue: () => void;
    onDismiss?: () => void;
    providerName?: string;
}> = ({ transition, onContinue, onDismiss, providerName }) => {
    const message = providerName
        ? transition.message.replace('[Provider Name]', providerName)
        : transition.message;

    return (
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
                <ClarenceAvatar size="sm" />
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="text-emerald-500" size={18} />
                        <span className="text-sm font-medium text-emerald-600">{transition.title}</span>
                    </div>
                    <p className="text-slate-700 text-sm mb-3">"{message}"</p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onContinue}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg 
                         flex items-center gap-2 transition-colors"
                        >
                            {transition.buttonText}
                            <ArrowRight size={16} />
                        </button>
                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SECTION 7: EXPORTS
// ============================================================================

export default TransitionModal;