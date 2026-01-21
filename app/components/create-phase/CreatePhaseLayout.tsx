// ============================================================================
// CLARENCE CREATE PHASE - LAYOUT COMPONENT
// ============================================================================
// File: components/create-phase/CreatePhaseLayout.tsx
// Purpose: Wrapper component providing consistent layout for Create Phase pages
// Version: 1.0
// ============================================================================

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    PathwayId,
    PathwayState,
    StageId,
    TransitionId,
    createInitialPathwayState,
    completeStage,
    getNextStage,
    getNextStageUrl,
    getStageMetadata,
    isStraightToContract,
    TRANSITION_CONFIGS,
    shouldShowTransition,
} from '@/lib/pathway-utils';
import { CreatePhaseProgressBar, CreatePhaseProgressLinear } from './CreatePhaseProgressBar';
import { TransitionModal, useTransitionModal } from './TransitionModal';
import { ArrowLeft, HelpCircle, X } from 'lucide-react';

// ============================================================================
// SECTION 1: CONTEXT DEFINITION
// ============================================================================

interface CreatePhaseContextValue {
    // Identity
    sessionId: string | null;
    contractId: string | null;
    pathwayId: PathwayId | null;

    // State
    pathwayState: PathwayState | null;
    currentStage: StageId | null;

    // Actions
    setPathwayId: (id: PathwayId) => void;
    setPathwayState: (state: PathwayState) => void;
    completeCurrentStage: () => void;
    goToNextStage: () => void;
    showTransition: (transitionId: TransitionId) => void;

    // Navigation
    canGoBack: boolean;
    goBack: () => void;
}

const CreatePhaseContext = createContext<CreatePhaseContextValue | null>(null);

/**
 * Hook to access Create Phase context
 */
export function useCreatePhase() {
    const context = useContext(CreatePhaseContext);
    if (!context) {
        throw new Error('useCreatePhase must be used within CreatePhaseLayout');
    }
    return context;
}

// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface CreatePhaseLayoutProps {
    children: ReactNode;
    /** Current page/stage identifier */
    currentPage: 'create-contract' | 'strategic-assessment' | 'contract-prep' | 'invite-provider' | 'contract-studio';
    /** Page title displayed in header */
    title: string;
    /** Optional subtitle */
    subtitle?: string;
    /** Whether to show the progress bar */
    showProgress?: boolean;
    /** Whether to show the back button */
    showBackButton?: boolean;
    /** Custom back button handler */
    onBack?: () => void;
    /** Whether to show help button */
    showHelp?: boolean;
    /** Help content or handler */
    onHelp?: () => void;
    /** Additional header content */
    headerRight?: ReactNode;
    /** Custom className for the main container */
    className?: string;
    /** Whether this is a full-width layout */
    fullWidth?: boolean;
}

// ============================================================================
// SECTION 3: PAGE TO STAGE MAPPING
// ============================================================================

const PAGE_TO_STAGE: Record<CreatePhaseLayoutProps['currentPage'], StageId> = {
    'create-contract': 'pathway_review', // Last stage of create-contract
    'strategic-assessment': 'strategic_assessment',
    'contract-prep': 'contract_prep',
    'invite-provider': 'invite_providers',
    'contract-studio': 'contract_studio',
};

// ============================================================================
// SECTION 4: HEADER COMPONENT
// ============================================================================

const CreatePhaseHeader: React.FC<{
    title: string;
    subtitle?: string;
    showBackButton: boolean;
    onBack?: () => void;
    showHelp: boolean;
    onHelp?: () => void;
    headerRight?: ReactNode;
    pathwayId: PathwayId | null;
    pathwayState: PathwayState | null;
    showProgress: boolean;
}> = ({
    title,
    subtitle,
    showBackButton,
    onBack,
    showHelp,
    onHelp,
    headerRight,
    pathwayId,
    pathwayState,
    showProgress,
}) => {
        const router = useRouter();

        const handleBack = () => {
            if (onBack) {
                onBack();
            } else {
                router.back();
            }
        };

        return (
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                {/* Progress Bar (if enabled and we have pathway data) */}
                {showProgress && pathwayId && pathwayState && (
                    <div className="border-b border-slate-100 px-6 py-3 bg-slate-50">
                        <div className="max-w-6xl mx-auto">
                            <CreatePhaseProgressBar
                                pathwayId={pathwayId}
                                pathwayState={pathwayState}
                                showDetails={false}
                                showPercentage={true}
                                compact={true}
                            />
                        </div>
                    </div>
                )}

                {/* Main Header */}
                <div className="px-6 py-4">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        {/* Left: Back button and title */}
                        <div className="flex items-center gap-4">
                            {showBackButton && (
                                <button
                                    onClick={handleBack}
                                    className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                    aria-label="Go back"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                                {subtitle && (
                                    <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                                )}
                            </div>
                        </div>

                        {/* Right: Help and custom content */}
                        <div className="flex items-center gap-3">
                            {headerRight}
                            {showHelp && (
                                <button
                                    onClick={onHelp}
                                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                    aria-label="Help"
                                >
                                    <HelpCircle size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        );
    };

// ============================================================================
// SECTION 5: PATHWAY BADGE COMPONENT
// ============================================================================

const PathwayBadge: React.FC<{ pathwayId: PathwayId }> = ({ pathwayId }) => {
    const isSTC = isStraightToContract(pathwayId);

    return (
        <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${isSTC
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
        >
            {pathwayId}
        </span>
    );
};

// ============================================================================
// SECTION 6: MAIN LAYOUT COMPONENT
// ============================================================================

export const CreatePhaseLayout: React.FC<CreatePhaseLayoutProps> = ({
    children,
    currentPage,
    title,
    subtitle,
    showProgress = true,
    showBackButton = true,
    onBack,
    showHelp = false,
    onHelp,
    headerRight,
    className = '',
    fullWidth = false,
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Extract IDs from URL
    const sessionId = searchParams.get('session_id');
    const contractId = searchParams.get('contract_id');
    const pathwayIdParam = searchParams.get('pathway_id') as PathwayId | null;

    // State
    const [pathwayId, setPathwayId] = useState<PathwayId | null>(pathwayIdParam);
    const [pathwayState, setPathwayState] = useState<PathwayState | null>(null);

    // Transition modal control
    const { activeTransition, isOpen, showTransition, hideTransition } = useTransitionModal(pathwayId || 'FM-SCRATCH');

    // Initialize pathway state if we have a pathway ID
    useEffect(() => {
        if (pathwayId && !pathwayState) {
            // In production, you'd fetch this from the database
            // For now, we create a default state based on current page
            const initialState = createInitialPathwayState(pathwayId);

            // Mark previous stages as complete based on current page
            const stageOrder: StageId[] = [
                'mediation_type', 'contract_type', 'quick_intake', 'template_source',
                'template_selection', 'document_upload', 'pathway_review',
                'strategic_assessment', 'contract_prep', 'invite_providers', 'contract_studio'
            ];

            const currentStage = PAGE_TO_STAGE[currentPage];
            const currentIndex = stageOrder.indexOf(currentStage);

            // All stages before current are completed (simplified)
            const completedStages = stageOrder.slice(0, currentIndex).filter(
                s => !initialState.skippedStages.includes(s)
            );

            setPathwayState({
                ...initialState,
                currentStage,
                completedStages,
            });
        }
    }, [pathwayId, currentPage, pathwayState]);

    // Update pathway ID from URL params
    useEffect(() => {
        if (pathwayIdParam && pathwayIdParam !== pathwayId) {
            setPathwayId(pathwayIdParam);
        }
    }, [pathwayIdParam, pathwayId]);

    // Context actions
    const completeCurrentStage = () => {
        if (!pathwayState || !pathwayId) return;

        const newState = completeStage(pathwayState, pathwayState.currentStage, pathwayId);
        setPathwayState(newState);

        // Check if we should show a transition
        const nextStage = getNextStage(pathwayId, pathwayState.currentStage);
        if (nextStage) {
            const transitionConfig = TRANSITION_CONFIGS.find(
                t => t.fromStage === pathwayState.currentStage && t.toStage === nextStage
            );
            if (transitionConfig && shouldShowTransition(pathwayId, transitionConfig.id)) {
                showTransition(transitionConfig.id);
            }
        }
    };

    const goToNextStage = () => {
        if (!pathwayState || !pathwayId || !sessionId) return;

        const nextUrl = getNextStageUrl(pathwayId, pathwayState.currentStage, sessionId, contractId || undefined);
        router.push(nextUrl);
    };

    const handleTransitionContinue = () => {
        hideTransition();
        goToNextStage();
    };

    // Determine if back navigation is available
    const canGoBack = currentPage !== 'create-contract'; // Can go back on all pages except first

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    // Context value
    const contextValue: CreatePhaseContextValue = {
        sessionId,
        contractId,
        pathwayId,
        pathwayState,
        currentStage: pathwayState?.currentStage || null,
        setPathwayId,
        setPathwayState,
        completeCurrentStage,
        goToNextStage,
        showTransition,
        canGoBack,
        goBack: handleBack,
    };

    return (
        <CreatePhaseContext.Provider value={contextValue}>
            <div className="min-h-screen bg-slate-50">
                {/* Header */}
                <CreatePhaseHeader
                    title={title}
                    subtitle={subtitle}
                    showBackButton={showBackButton && canGoBack}
                    onBack={onBack}
                    showHelp={showHelp}
                    onHelp={onHelp}
                    headerRight={
                        <>
                            {pathwayId && <PathwayBadge pathwayId={pathwayId} />}
                            {headerRight}
                        </>
                    }
                    pathwayId={pathwayId}
                    pathwayState={pathwayState}
                    showProgress={showProgress}
                />

                {/* Main Content */}
                <main className={`${fullWidth ? '' : 'max-w-6xl mx-auto'} px-6 py-8 ${className}`}>
                    {children}
                </main>

                {/* Transition Modal */}
                <TransitionModal
                    isOpen={isOpen}
                    transition={activeTransition}
                    onContinue={handleTransitionContinue}
                />
            </div>
        </CreatePhaseContext.Provider>
    );
};

// ============================================================================
// SECTION 7: SIMPLIFIED WRAPPER (for quick integration)
// ============================================================================

/**
 * Simplified wrapper that just adds the progress bar to existing pages
 * Use this for minimal integration without full layout changes
 */
export const CreatePhaseProgressWrapper: React.FC<{
    children: ReactNode;
    pathwayId: PathwayId;
    pathwayState: PathwayState;
}> = ({ children, pathwayId, pathwayState }) => {
    return (
        <div>
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    <CreatePhaseProgressBar
                        pathwayId={pathwayId}
                        pathwayState={pathwayState}
                        showDetails={true}
                        showPercentage={true}
                    />
                </div>
            </div>
            {children}
        </div>
    );
};

// ============================================================================
// SECTION 8: EXPORTS
// ============================================================================

export default CreatePhaseLayout;